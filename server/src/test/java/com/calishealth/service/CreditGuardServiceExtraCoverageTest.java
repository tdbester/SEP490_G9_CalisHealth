package com.calishealth.service;

import com.calishealth.models.MediaFile;
import com.calishealth.models.StorageSettings;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.MediaFileRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Bo sung coverage cho {@link CreditGuardService}: giai phong dung luong va chon admin. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CreditGuardServiceExtraCoverageTest {

    @Mock private MediaFileRepository media;
    @Mock private MediaRegistryService registry;
    @Mock private MediaCleanupService cleanup;
    @Mock private CloudinaryUsageService cloudinary;
    @Mock private UserRepository users;

    private CreditGuardService guard;

    @BeforeEach
    void setUp() {
        guard = new CreditGuardService(media, registry, cleanup, cloudinary, users);
    }

    private static StorageSettings settings(boolean guardEnabled, int threshold, boolean autoCleanup) {
        StorageSettings settings = new StorageSettings();
        settings.setCreditGuardEnabled(guardEnabled);
        settings.setCreditGuardThreshold(threshold);
        settings.setAutoCleanupEnabled(autoCleanup);
        return settings;
    }

    private static CloudinaryUsageService.Usage usage(double percent) {
        return new CloudinaryUsageService.Usage("Free", 5_000L, 10_000L, 0, 0,
                java.math.BigDecimal.ONE, java.math.BigDecimal.TEN, 15, LocalDateTime.now());
    }

    private static MediaFile file(Long id, String status) {
        MediaFile file = new MediaFile();
        file.setId(id);
        file.setStatus(status);
        file.setSizeBytes(100L);
        return file;
    }

    @Test
    @DisplayName("run: khong doc duoc so lieu nha cung cap -> giu im lang")
    void runStaysQuietWhenProviderIsUnreachable() {
        when(registry.settings()).thenReturn(settings(true, 80, true));
        when(cloudinary.usage()).thenReturn(Optional.empty());

        var outcome = guard.run(false);

        assertThat(outcome.active()).isFalse();
        assertThat(outcome.reason()).contains("could not be reached");
        verify(media, never()).findAllByStatus(any());
    }

    @Test
    @DisplayName("run: guard tat -> bao 'The guard is off'")
    void runReportsDisabledGuard() {
        when(registry.settings()).thenReturn(settings(false, 80, true));
        when(cloudinary.usage()).thenReturn(Optional.of(usage(10d)));

        var outcome = guard.run(false);

        assertThat(outcome.active()).isFalse();
        assertThat(outcome.reason()).isEqualTo("The guard is off");
    }

    @Test
    @DisplayName("run: duoi nguong -> bao 'below'")
    void runReportsBelowThreshold() {
        when(registry.settings()).thenReturn(settings(true, 80, true));
        when(cloudinary.usage()).thenReturn(Optional.of(usage(10d)));

        var outcome = guard.run(false);

        assertThat(outcome.active()).isFalse();
        assertThat(outcome.reason()).contains("below 80%");
    }

    @Test
    @DisplayName("run: media khong con dung -> chuyen sang thung rac va dem so da chuyen")
    void runMovesInactiveMediaToTrash() {
        when(registry.settings()).thenReturn(settings(true, 80, true));
        when(cloudinary.usage()).thenReturn(Optional.of(usage(95d)));
        when(media.findAllByStatus(MediaFile.TRASHED)).thenReturn(List.of());
        when(media.findAllByStatusIn(List.of(MediaFile.ORPHANED, MediaFile.REJECTED)))
                .thenReturn(List.of(file(1L, MediaFile.ORPHANED), file(2L, MediaFile.REJECTED)));
        when(cleanup.purge(anyCollection()))
                .thenReturn(new MediaCleanupService.PurgeOutcome(List.of(), 0, 0));
        when(cleanup.trash(anyCollection(), any()))
                .thenReturn(new MediaCleanupService.TrashOutcome(List.of(file(1L, MediaFile.ORPHANED),
                                file(2L, MediaFile.REJECTED)),
                        List.of(), 0, 0, LocalDateTime.now()));
        User admin = new User();
        admin.setId(1L);
        admin.setRole(UserRole.ADMIN);
        when(users.findAll()).thenReturn(List.of(admin));

        var outcome = guard.run(true);

        assertThat(outcome.active()).isTrue();
        assertThat(outcome.trashed()).isEqualTo(2);
        assertThat(outcome.freed()).isTrue();
        verify(cleanup).trash(anyCollection(), eq(admin));
    }

    @Test
    @DisplayName("run: khong co admin -> van chay, khong nem loi")
    void runWithoutAdminStillWorks() {
        when(registry.settings()).thenReturn(settings(true, 80, true));
        when(cloudinary.usage()).thenReturn(Optional.of(usage(95d)));
        when(media.findAllByStatus(MediaFile.TRASHED)).thenReturn(List.of());
        when(media.findAllByStatusIn(List.of(MediaFile.ORPHANED, MediaFile.REJECTED)))
                .thenReturn(List.of(file(1L, MediaFile.ORPHANED)));
        when(cleanup.purge(anyCollection()))
                .thenReturn(new MediaCleanupService.PurgeOutcome(List.of(), 0, 0));
        when(cleanup.trash(anyCollection(), any()))
                .thenReturn(new MediaCleanupService.TrashOutcome(List.of(), List.of(), 0, 0, null));
        when(users.findAll()).thenReturn(List.of());

        var outcome = guard.run(true);

        assertThat(outcome.active()).isTrue();
        assertThat(outcome.trashed()).isZero();
    }

    @Test
    @DisplayName("run: khong co media nao de giai phong -> bao 'nothing to free'")
    void runReportsNothingToFree() {
        when(registry.settings()).thenReturn(settings(true, 80, false));
        when(cloudinary.usage()).thenReturn(Optional.of(usage(95d)));
        when(media.findAllByStatus(MediaFile.TRASHED)).thenReturn(List.of());

        var outcome = guard.run(true);

        assertThat(outcome.active()).isTrue();
        assertThat(outcome.reason()).isEqualTo("There was nothing to free");
    }

    @Test
    @DisplayName("reclaimableBytes: cong don gia tri thu hoi duoc")
    void reclaimableBytesSumsTrashedAndOrphaned() {
        when(media.findAllByStatus(MediaFile.TRASHED)).thenReturn(List.of(file(1L, MediaFile.TRASHED)));
        when(media.reclaimable(any(LocalDateTime.class))).thenReturn(List.<Object[]>of(new Object[]{1L, 250L}));

        assertThat(guard.reclaimableBytes()).isEqualTo(350L);
    }

    @Test
    @DisplayName("reclaimableBytes: khong co gi -> 0")
    void reclaimableBytesIsZeroWhenNothingToReclaim() {
        when(media.findAllByStatus(MediaFile.TRASHED)).thenReturn(List.of());
        when(media.reclaimable(any(LocalDateTime.class))).thenReturn(List.of());

        assertThat(guard.reclaimableBytes()).isZero();
    }
}
