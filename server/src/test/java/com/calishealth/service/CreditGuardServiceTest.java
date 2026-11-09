package com.calishealth.service;

import com.calishealth.models.MediaFile;
import com.calishealth.models.StorageSettings;
import com.calishealth.repository.MediaFileRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The credit guard frees space when the account of the provider is close to its limit.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CreditGuardServiceTest {

    @Mock
    private MediaFileRepository media;
    @Mock
    private MediaRegistryService registry;
    @Mock
    private MediaCleanupService cleanup;
    @Mock
    private CloudinaryUsageService cloudinary;
    @Mock
    private UserRepository users;

    private CreditGuardService guard;

    @BeforeEach
    void setUp() {
        guard = new CreditGuardService(media, registry, cleanup, cloudinary, users);
    }

    private StorageSettings settings(boolean enabled, int threshold) {
        StorageSettings s = new StorageSettings();
        s.setCreditGuardEnabled(enabled);
        s.setCreditGuardThreshold(threshold);
        s.setAutoCleanupEnabled(true);
        return s;
    }

    private CloudinaryUsageService.Usage usage(double creditsUsed, double creditsLimit) {
        // A plan without a byte limit: the credits are what counts.
        return new CloudinaryUsageService.Usage("Free", 0, 0, 0, 0,
                BigDecimal.valueOf(creditsUsed), BigDecimal.valueOf(creditsLimit),
                (creditsUsed * 100.0) / creditsLimit, LocalDateTime.now());
    }

    @Test
    void doesNothingWhenTheGuardIsOff() {
        when(registry.settings()).thenReturn(settings(false, 90));
        when(cloudinary.usage()).thenReturn(Optional.of(usage(95, 100)));

        CreditGuardService.GuardOutcome outcome = guard.run(false);

        assertThat(outcome.active()).isFalse();
        assertThat(outcome.freed()).isFalse();
        verify(cleanup, never()).purge(anyList());
    }

    @Test
    void doesNothingWhenTheAccountIsBelowTheThreshold() {
        when(registry.settings()).thenReturn(settings(true, 90));
        when(cloudinary.usage()).thenReturn(Optional.of(usage(50, 100)));

        CreditGuardService.GuardOutcome outcome = guard.run(false);

        assertThat(outcome.active()).isFalse();
        assertThat(outcome.freed()).isFalse();
        verify(cleanup, never()).purge(anyList());
    }

    @Test
    void purgesTheTrashWhenTheAccountIsOverTheThreshold() {
        when(registry.settings()).thenReturn(settings(true, 90));
        when(cloudinary.usage()).thenReturn(Optional.of(usage(95, 100)));
        MediaFile trashed = new MediaFile();
        trashed.setId(1L);
        trashed.setStatus(MediaFile.TRASHED);
        when(media.findAllByStatus(MediaFile.TRASHED)).thenReturn(List.of(trashed));
        when(media.findAllByStatusIn(List.of(MediaFile.ORPHANED, MediaFile.REJECTED))).thenReturn(List.of());
        when(cleanup.purge(anyList())).thenReturn(new MediaCleanupService.PurgeOutcome(List.of(trashed), 2048, 0));

        CreditGuardService.GuardOutcome outcome = guard.run(false);

        assertThat(outcome.active()).isTrue();
        assertThat(outcome.purged()).isEqualTo(1);
        assertThat(outcome.freedBytes()).isEqualTo(2048);
        assertThat(outcome.freed()).isTrue();
    }

    @Test
    void anAdminCanFreeTheSpaceWhateverTheUsageIs() {
        when(registry.settings()).thenReturn(settings(false, 90));
        when(cloudinary.usage()).thenReturn(Optional.of(usage(10, 100)));
        when(media.findAllByStatus(MediaFile.TRASHED)).thenReturn(List.of());
        when(media.findAllByStatusIn(List.of(MediaFile.ORPHANED, MediaFile.REJECTED))).thenReturn(List.of());

        CreditGuardService.GuardOutcome outcome = guard.run(true);

        // The guard is off, but the admin asked for it, so it still runs.
        assertThat(outcome.active()).isTrue();
        verify(cleanup, never()).purge(anyList());
    }

    @Test
    void doesNothingWhenTheProviderCannotBeReached() {
        when(registry.settings()).thenReturn(settings(true, 90));
        when(cloudinary.usage()).thenReturn(Optional.empty());

        CreditGuardService.GuardOutcome outcome = guard.run(false);

        assertThat(outcome.active()).isFalse();
        assertThat(outcome.reason()).contains("unknown");
        verify(cleanup, never()).purge(anyList());
    }

    @Test
    void countsWhatCouldBeFreed() {
        MediaFile trashed = new MediaFile();
        trashed.setId(1L);
        trashed.setStatus(MediaFile.TRASHED);
        trashed.setSizeBytes(1000);
        when(media.findAllByStatus(MediaFile.TRASHED)).thenReturn(List.of(trashed));
        when(media.reclaimable(any())).thenReturn(List.<Object[]>of(new Object[]{2L, 500L}));

        assertThat(guard.reclaimableBytes()).isEqualTo(1500);
    }
}
