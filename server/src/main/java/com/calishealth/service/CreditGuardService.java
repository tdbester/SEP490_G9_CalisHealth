package com.calishealth.service;

import com.calishealth.models.MediaFile;
import com.calishealth.models.StorageSettings;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.MediaFileRepository;
import com.calishealth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Frees space when the account of the provider is close to its limit.
 *
 * <p>The plan of this app counts credits instead of bytes, so the account runs out of credits long
 * before it runs out of space. The warning thresholds of {@link StorageUsageJob} only tell the
 * admins; the guard acts as well.
 *
 * <p>What it does, in this order:
 * <ol>
 *   <li>the media that is already deleted (the trash) is purged right away, instead of waiting for
 *       the retention period. This frees the most space and touches nothing an exercise uses;</li>
 *   <li>the media that is not linked to an exercise any more (orphaned or rejected) is moved to the
 *       trash, so the next run can purge it.</li>
 * </ol>
 *
 * <p>Media that a live exercise uses is never touched: {@link MediaCleanupService} checks the
 * references before it removes a file.
 *
 * <p>The guard is off by default and the admins turn it on in Admin &gt; Storage.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CreditGuardService {

    /** What the guard did the last time it ran. */
    public record GuardOutcome(boolean active, int purged, long freedBytes, int trashed,
                               double usedPercent, String reason) {
        /** True when the guard freed something. */
        public boolean freed() {
            return purged > 0 || trashed > 0;
        }
    }

    private final MediaFileRepository media;
    private final MediaRegistryService registry;
    private final MediaCleanupService cleanup;
    private final CloudinaryUsageService cloudinary;
    private final UserRepository users;

    /**
     * Runs the guard when the account is close to its limit.
     *
     * @param force true when an admin pressed the button: the guard runs even when the account is
     *              still below the threshold
     */
    @Transactional
    public GuardOutcome run(boolean force) {
        StorageSettings settings = registry.settings();
        Optional<CloudinaryUsageService.Usage> usage = cloudinary.usage();
        double usedPercent = usage.map(CloudinaryUsageService.Usage::planPercent).orElse(0d);

        if (usage.isEmpty()) {
            // Without the numbers of the provider the guard cannot know how close the account is to
            // its limit, so it stays quiet.
            return new GuardOutcome(false, 0, 0, 0, usedPercent,
                    "The provider could not be reached, so the usage is unknown");
        }
        if (!force) {
            if (!settings.isCreditGuardEnabled()) {
                return new GuardOutcome(false, 0, 0, 0, usedPercent, "The guard is off");
            }
            if (usedPercent < settings.getCreditGuardThreshold()) {
                return new GuardOutcome(false, 0, 0, 0, usedPercent,
                        "The account is below " + settings.getCreditGuardThreshold() + "% of the plan");
            }
        }

        LocalDateTime now = LocalDateTime.now();

        // 1. The media that is already deleted goes away now: it frees the most and no exercise
        //    uses it any more.
        List<MediaFile> trashed = media.findAllByStatus(MediaFile.TRASHED);
        MediaCleanupService.PurgeOutcome purged = trashed.isEmpty()
                ? new MediaCleanupService.PurgeOutcome(List.of(), 0, 0)
                : cleanup.purge(trashed.stream().map(MediaFile::getId).toList());

        // 2. The media that no exercise uses any more is moved to the trash, so the next run of the
        //    guard (or the daily cleanup) can purge it.
        int moved = 0;
        if (settings.isAutoCleanupEnabled()) {
            List<MediaFile> inactive = media.findAllByStatusIn(List.of(MediaFile.ORPHANED, MediaFile.REJECTED));
            if (!inactive.isEmpty()) {
                moved = cleanup.trash(inactive.stream().map(MediaFile::getId).toList(), admin()).trashed().size();
            }
        }

        if (purged.freedBytes() > 0 || moved > 0) {
            log.info("Credit guard: {} file(s) purged, {} file(s) trashed, {} bytes freed",
                    purged.purged().size(), moved, purged.freedBytes());
        }
        return new GuardOutcome(true, purged.purged().size(), purged.freedBytes(), moved, usedPercent,
                purged.freedBytes() > 0 || moved > 0
                        ? "Freed " + purged.freedBytes() + " bytes"
                        : "There was nothing to free");
    }

    /**
     * How much space the guard could free right now.
     *
     * @return the bytes of the trashed media and of the media that no exercise uses any more
     */
    @Transactional(readOnly = true)
    public long reclaimableBytes() {
        LocalDateTime now = LocalDateTime.now();
        long trashed = media.findAllByStatus(MediaFile.TRASHED).stream()
                .mapToLong(MediaFile::getSizeBytes)
                .sum();
        long inactive = media.reclaimable(now).isEmpty() ? 0 : asLong(media.reclaimable(now).get(0)[1]);
        return trashed + inactive;
    }

    /** The admin the guard acts as. The first admin of the account is used. */
    private User admin() {
        return users.findAll().stream()
                .filter(user -> user.getRole() == UserRole.ADMIN)
                .findFirst()
                .orElse(null);
    }

    private static long asLong(Object value) {
        return value instanceof Number number ? number.longValue() : 0;
    }
}
