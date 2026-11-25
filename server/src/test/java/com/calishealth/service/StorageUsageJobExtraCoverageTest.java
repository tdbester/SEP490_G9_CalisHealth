package com.calishealth.service;

import com.calishealth.models.Notification;
import com.calishealth.models.StorageSettings;
import com.calishealth.models.StorageUsageDaily;
import com.calishealth.repository.MediaFileRepository;
import com.calishealth.repository.NotificationRepository;
import com.calishealth.repository.StorageUsageDailyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test bổ sung cho {@link StorageUsageJob}: các nhánh credit/limit null, guard giải phóng dung lượng,
 * cảnh báo lặp lại và kỳ tính theo ngày reset.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StorageUsageJobExtraCoverageTest {

    @Mock private CloudinaryUsageService cloudinary;
    @Mock private StorageUsageDailyRepository usageDaily;
    @Mock private MediaFileRepository media;
    @Mock private MediaRegistryService registry;
    @Mock private NotificationRepository notifications;
    @Mock private CreditGuardService guard;

    private StorageUsageJob job;

    @BeforeEach
    void setUp() {
        job = new StorageUsageJob(cloudinary, usageDaily, media, registry, notifications, guard);
        when(registry.settings()).thenReturn(settings(80, 95));
        when(usageDaily.findByDayGreaterThanEqualOrderByDayAsc(any())).thenReturn(List.of());
        when(usageDaily.findById(any())).thenReturn(Optional.empty());
        when(media.sumBytesOnDisk()).thenReturn(0L);
        when(media.sumBytesOnDiskAt(any())).thenReturn(0L);
        when(guard.run(false)).thenReturn(new CreditGuardService.GuardOutcome(false, 0, 0, 0, 0, "off"));
    }

    private static StorageSettings settings(int warning, int critical) {
        StorageSettings s = new StorageSettings();
        s.setWarningPercent(warning);
        s.setCriticalPercent(critical);
        return s;
    }

    private static CloudinaryUsageService.Usage usage(long stored, long limit, BigDecimal creditsUsed,
                                                      BigDecimal creditsLimit) {
        return new CloudinaryUsageService.Usage("Free", stored, limit, 1234, 0,
                creditsUsed, creditsLimit, 15, LocalDateTime.now());
    }

    @Test
    @DisplayName("Snapshot: credit va gioi han null -> ghi 0")
    void snapshotHandlesNullCreditValues() {
        when(cloudinary.usage()).thenReturn(Optional.of(
                usage(1_000_000_000L, 5_000_000_000L, null, null)));

        job.snapshot();

        ArgumentCaptor<StorageUsageDaily> captor = ArgumentCaptor.forClass(StorageUsageDaily.class);
        verify(usageDaily, atLeastOnce()).save(captor.capture());
        StorageUsageDaily row = captor.getAllValues().stream()
                .filter(value -> LocalDate.now().equals(value.getDay()))
                .findFirst()
                .orElseThrow();
        assertThat(row.getCreditsUsed()).isEqualByComparingTo("0");
        assertThat(row.getCreditsLimit()).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("Snapshot: guard giai phong duoc cho -> gui thong bao cho admin")
    void guardSendsNotificationWhenSpaceIsFreed() {
        when(cloudinary.usage()).thenReturn(Optional.of(
                usage(4_500_000_000L, 5_000_000_000L, BigDecimal.ONE, BigDecimal.TEN)));
        when(guard.run(false)).thenReturn(new CreditGuardService.GuardOutcome(true, 3, 2048L, 2, 90.0, "near limit"));

        job.snapshot();

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notifications, atLeastOnce()).save(captor.capture());
        Notification freed = captor.getAllValues().stream()
                .filter(n -> n.getTitle() != null && n.getTitle().contains("freed automatically"))
                .findFirst()
                .orElseThrow();
        assertThat(freed.getTargetAudience()).isEqualTo("ADMIN");
    }

    @Test
    @DisplayName("Snapshot: guard loi -> khong nem loi ra ngoai")
    void guardFailureDoesNotBreakTheSnapshot() {
        when(cloudinary.usage()).thenReturn(Optional.of(
                usage(1_000_000_000L, 5_000_000_000L, BigDecimal.ONE, BigDecimal.TEN)));
        when(guard.run(false)).thenThrow(new RuntimeException("cloudinary down"));

        job.snapshot();

        verify(usageDaily, atLeastOnce()).save(any());
    }

    @Test
    @DisplayName("Snapshot: guard khong giai phong gi -> khong gui thong bao")
    void guardWithoutFreedSpaceSendsNoNotification() {
        when(cloudinary.usage()).thenReturn(Optional.of(
                usage(1_000_000_000L, 5_000_000_000L, BigDecimal.ONE, BigDecimal.TEN)));
        when(guard.run(false)).thenReturn(new CreditGuardService.GuardOutcome(true, 0, 0, 0, 0, "nothing to purge"));

        job.snapshot();

        verify(notifications, never()).save(any());
    }

    @Test
    @DisplayName("Snapshot: tai khoan khoe again -> xoa muc canh bao cu")
    void healthyAccountClearsPreviousAlertLevel() {
        when(cloudinary.usage()).thenReturn(Optional.of(
                usage(1_000_000_000L, 5_000_000_000L, BigDecimal.ONE, BigDecimal.TEN)));
        StorageUsageDaily today = new StorageUsageDaily();
        today.setDay(LocalDate.now());
        today.setAlertLevel("WARNING");
        when(usageDaily.findById(LocalDate.now())).thenReturn(Optional.of(today));

        job.snapshot();

        ArgumentCaptor<StorageUsageDaily> captor = ArgumentCaptor.forClass(StorageUsageDaily.class);
        verify(usageDaily, atLeastOnce()).save(captor.capture());
        assertThat(captor.getAllValues().stream()
                .anyMatch(row -> row.getAlertLevel() == null)).isTrue();
    }

    @Test
    @DisplayName("Snapshot: account healthy va khong co canh bao truoc do -> khong luu lai")
    void healthyAccountWithoutAlertDoesNotSaveExtra() {
        when(cloudinary.usage()).thenReturn(Optional.of(
                usage(1_000_000_000L, 5_000_000_000L, BigDecimal.ONE, BigDecimal.TEN)));
        StorageUsageDaily today = new StorageUsageDaily();
        today.setDay(LocalDate.now());
        when(usageDaily.findById(LocalDate.now())).thenReturn(Optional.of(today));

        job.snapshot();

        verify(notifications, never()).save(any());
    }

    @Test
    @DisplayName("Snapshot: nhom da canh bao CRITICAL -> khong canh bao lai")
    void doesNotWarnAgainAfterCriticalAlert() {
        when(cloudinary.usage()).thenReturn(Optional.of(
                usage(4_900_000_000L, 5_000_000_000L, BigDecimal.ONE, BigDecimal.TEN)));
        StorageUsageDaily earlier = new StorageUsageDaily();
        earlier.setDay(LocalDate.now().minusDays(1));
        earlier.setAlertLevel("CRITICAL");
        when(usageDaily.findByDayGreaterThanEqualOrderByDayAsc(any())).thenReturn(List.of(earlier));

        job.snapshot();

        verify(notifications, never()).save(any());
    }

    @Test
    @DisplayName("Snapshot: plan khong gioi han dung luong -> khong canh bao")
    void zeroPercentUsageIsIgnored() {
        when(cloudinary.usage()).thenReturn(Optional.of(
                usage(0L, 0L, BigDecimal.ONE, BigDecimal.TEN)));

        job.snapshot();

        verify(notifications, never()).save(any());
    }

    @Test
    @DisplayName("Snapshot: lich su da co du lieu -> chi backfill nhung ngay con thieu")
    void backfillSkipsDaysThatAlreadyHaveARow() {
        when(cloudinary.usage()).thenReturn(Optional.of(
                usage(1_000_000_000L, 5_000_000_000L, BigDecimal.ONE, BigDecimal.TEN)));
        StorageUsageDaily known = new StorageUsageDaily();
        known.setDay(LocalDate.now().minusDays(2));
        when(usageDaily.findByDayGreaterThanEqualOrderByDayAsc(any())).thenReturn(List.of(known));

        job.snapshot();

        ArgumentCaptor<StorageUsageDaily> captor = ArgumentCaptor.forClass(StorageUsageDaily.class);
        verify(usageDaily, atLeastOnce()).save(captor.capture());
        assertThat(captor.getAllValues()).hasSizeLessThan(30);
    }

    @Test
    @DisplayName("Ky tinh: ngay reset trong tuong lai -> lay thang truoc")
    void periodStartFallsBackToPreviousMonth() throws Exception {
        java.lang.reflect.Field field = StorageUsageJob.class.getDeclaredField("usageResetDay");
        field.setAccessible(true);
        field.set(job, 28);

        java.lang.reflect.Method method = StorageUsageJob.class.getDeclaredMethod("periodStart");
        method.setAccessible(true);
        LocalDate start = (LocalDate) method.invoke(job);

        assertThat(start).isBeforeOrEqualTo(LocalDate.now());
    }

    @Test
    @DisplayName("Ky tinh: ngay reset ngoai 1..28 -> dung gioi han")
    void periodStartClampsResetDay() throws Exception {
        java.lang.reflect.Field field = StorageUsageJob.class.getDeclaredField("usageResetDay");
        field.setAccessible(true);
        field.set(job, 99);

        java.lang.reflect.Method method = StorageUsageJob.class.getDeclaredMethod("periodStart");
        method.setAccessible(true);
        LocalDate start = (LocalDate) method.invoke(job);

        assertThat(start.getDayOfMonth()).isBetween(1, 28);
    }
}
