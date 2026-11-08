package com.calishealth.service;

import com.calishealth.models.MediaFile;
import com.calishealth.models.StorageSettings;
import com.calishealth.models.StorageUsageDaily;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.MediaFileRepository;
import com.calishealth.repository.NotificationRepository;
import com.calishealth.repository.StorageUsageDailyRepository;
import org.junit.jupiter.api.BeforeEach;
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
 * The daily job writes the real usage of the Cloudinary account and warns the admins when the
 * account crosses a threshold.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StorageUsageJobTest {

    @Mock
    private CloudinaryUsageService cloudinary;
    @Mock
    private StorageUsageDailyRepository usageDaily;
    @Mock
    private MediaFileRepository media;
    @Mock
    private MediaRegistryService registry;
    @Mock
    private NotificationRepository notifications;

    private StorageUsageJob job;

    @BeforeEach
    void setUp() {
        job = new StorageUsageJob(cloudinary, usageDaily, media, registry, notifications);
        when(registry.settings()).thenReturn(settings(80, 95));
        // No day has a snapshot yet, so the job fills the last 30 days.
        when(usageDaily.findByDayGreaterThanEqualOrderByDayAsc(any())).thenReturn(List.of());
    }

    private CloudinaryUsageService.Usage usage(long stored, long limit) {
        return new CloudinaryUsageService.Usage("Free", stored, limit, 1234, 0,
                BigDecimal.valueOf(1.5), BigDecimal.valueOf(10), 15, LocalDateTime.now());
    }

    private StorageSettings settings(int warning, int critical) {
        StorageSettings s = new StorageSettings();
        s.setWarningPercent(warning);
        s.setCriticalPercent(critical);
        return s;
    }

    @Test
    void writesTheUsageOfTheProviderIntoTheDailyRow() {
        when(cloudinary.usage()).thenReturn(Optional.of(usage(2_000_000_000L, 5_000_000_000L)));
        when(usageDaily.findById(LocalDate.now())).thenReturn(Optional.empty());
        when(media.sumBytesOnDisk()).thenReturn(1_500_000_000L);
        // The days before the first snapshot are filled with the size of the registry.
        when(usageDaily.findByDayGreaterThanEqualOrderByDayAsc(any())).thenReturn(List.of());

        job.snapshot();

        ArgumentCaptor<StorageUsageDaily> captor = ArgumentCaptor.forClass(StorageUsageDaily.class);
        verify(usageDaily, atLeastOnce()).save(captor.capture());
        StorageUsageDaily row = captor.getAllValues().stream()
                .filter(value -> LocalDate.now().equals(value.getDay()))
                .findFirst()
                .orElseThrow();
        assertThat(row.getStorageUsed()).isEqualTo(2_000_000_000L);
        assertThat(row.getStorageLimit()).isEqualTo(5_000_000_000L);
        assertThat(row.getBandwidthUsed()).isEqualTo(1234);
        assertThat(row.getPlanName()).isEqualTo("Free");
        assertThat(row.getRegistryBytes()).isEqualTo(1_500_000_000L);
    }

    @Test
    void fillsTheMissingDaysWithTheSizeOfTheRegistry() {
        when(cloudinary.usage()).thenReturn(Optional.of(usage(2_000_000_000L, 5_000_000_000L)));
        when(usageDaily.findById(LocalDate.now())).thenReturn(Optional.empty());
        when(usageDaily.findByDayGreaterThanEqualOrderByDayAsc(any())).thenReturn(List.of());
        when(media.sumBytesOnDisk()).thenReturn(1_500_000_000L);
        when(media.sumBytesOnDiskAt(any())).thenReturn(1_000_000_000L);

        job.snapshot();

        ArgumentCaptor<StorageUsageDaily> captor = ArgumentCaptor.forClass(StorageUsageDaily.class);
        verify(usageDaily, atLeastOnce()).save(captor.capture());
        // 29 days before today plus the day of today.
        assertThat(captor.getAllValues()).hasSize(30);
        StorageUsageDaily yesterday = captor.getAllValues().stream()
                .filter(value -> LocalDate.now().minusDays(1).equals(value.getDay()))
                .findFirst()
                .orElseThrow();
        assertThat(yesterday.getStorageUsed()).isEqualTo(1_000_000_000L);
        assertThat(yesterday.getRegistryBytes()).isEqualTo(1_000_000_000L);
        assertThat(yesterday.getAlertLevel()).isNull();
    }

    @Test
    void skipsTheSnapshotWithoutACloudinaryAccount() {
        when(cloudinary.usage()).thenReturn(Optional.empty());

        job.snapshot();

        verify(usageDaily, never()).save(any());
    }

    @Test
    void warnsTheAdminsWhenTheWarningThresholdIsCrossed() {
        when(cloudinary.usage()).thenReturn(Optional.of(usage(4_500_000_000L, 5_000_000_000L)));
        when(registry.settings()).thenReturn(settings(80, 95));
        when(usageDaily.findById(LocalDate.now())).thenReturn(Optional.empty());
        when(usageDaily.findByDayGreaterThanEqualOrderByDayAsc(any())).thenReturn(List.of());
        when(media.sumBytesOnDisk()).thenReturn(0L);

        job.snapshot();

        ArgumentCaptor<StorageUsageDaily> row = ArgumentCaptor.forClass(StorageUsageDaily.class);
        verify(usageDaily, org.mockito.Mockito.atLeastOnce()).save(row.capture());
        assertThat(row.getAllValues().get(row.getAllValues().size() - 1).getAlertLevel()).isEqualTo("WARNING");
        verify(notifications).save(any());
    }

    @Test
    void staysQuietBelowTheWarningThreshold() {
        when(cloudinary.usage()).thenReturn(Optional.of(usage(1_000_000_000L, 5_000_000_000L)));
        when(registry.settings()).thenReturn(settings(80, 95));
        when(usageDaily.findById(LocalDate.now())).thenReturn(Optional.empty());
        when(media.sumBytesOnDisk()).thenReturn(0L);

        job.snapshot();

        verify(notifications, never()).save(any());
    }

    @Test
    void doesNotWarnTwiceInTheSamePlanPeriod() {
        when(cloudinary.usage()).thenReturn(Optional.of(usage(4_500_000_000L, 5_000_000_000L)));
        when(registry.settings()).thenReturn(settings(80, 95));
        when(usageDaily.findById(LocalDate.now())).thenReturn(Optional.empty());
        StorageUsageDaily earlier = new StorageUsageDaily();
        earlier.setDay(LocalDate.now().minusDays(1));
        earlier.setAlertLevel("WARNING");
        when(usageDaily.findByDayGreaterThanEqualOrderByDayAsc(any())).thenReturn(List.of(earlier));
        when(media.sumBytesOnDisk()).thenReturn(0L);

        job.snapshot();

        verify(notifications, never()).save(any());
    }

    @Test
    void warnsAgainWhenTheAccountBecomesCritical() {
        when(cloudinary.usage()).thenReturn(Optional.of(usage(4_800_000_000L, 5_000_000_000L)));
        when(registry.settings()).thenReturn(settings(80, 95));
        when(usageDaily.findById(LocalDate.now())).thenReturn(Optional.empty());
        StorageUsageDaily earlier = new StorageUsageDaily();
        earlier.setDay(LocalDate.now().minusDays(1));
        earlier.setAlertLevel("WARNING");
        when(usageDaily.findByDayGreaterThanEqualOrderByDayAsc(any())).thenReturn(List.of(earlier));
        when(media.sumBytesOnDisk()).thenReturn(0L);

        job.snapshot();

        verify(notifications).save(any());
    }
}
