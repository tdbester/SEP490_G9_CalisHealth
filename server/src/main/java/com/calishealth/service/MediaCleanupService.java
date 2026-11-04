package com.calishealth.service;

import com.calishealth.models.MediaFile;
import com.calishealth.models.StorageSettings;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.MediaFileRepository;
import com.calishealth.repository.StorageSettingsRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.service.ExerciseVideoStorageService.CloudFile;
import com.calishealth.service.ExerciseVideoStorageService.StoredFile;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Soft delete (trash), restore and hard delete (purge) of managed media, plus the daily job:
 * reconcile the registry with the disk, move expired files to the trash, purge trash past its period.
 * Storage is only freed by a purge.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MediaCleanupService {
    /** A restored file is skipped by auto-cleanup for at least this long. */
    public static final int RESTORE_GRACE_DAYS = 7;

    private final MediaFileRepository media;
    private final StorageSettingsRepository settingsRepository;
    private final MediaRegistryService registry;
    private final ExerciseVideoStorageService storage;
    private final ExerciseRepository exercises;
    private final UserRepository users;
    private final JdbcTemplate jdbc;

    public record TrashOutcome(List<MediaFile> trashed, List<MediaFile> purged, long freedBytes, int skipped, LocalDateTime purgeAt) {}

    public record PurgeOutcome(List<MediaFile> purged, long freedBytes, int skipped) {}

    public record CleanupRun(int trashed, int purged, long freedBytes) {}

    // ---------------------------------------------------------------------------------
    // Admin actions
    // ---------------------------------------------------------------------------------

    /** Soft-deletes ORPHANED / REJECTED files whose grace period is over. Purges at once when the trash period is 0. */
    @Transactional
    public TrashOutcome trash(Collection<Long> ids, User admin) {
        LocalDateTime now = LocalDateTime.now();
        int trashDays = registry.settings().getTrashRetentionDays();
        List<MediaFile> eligible = media.findAllByIdIn(ids).stream()
                .filter(file -> file.getCategory() != null && isExpired(file, now))
                .toList();
        if (trashDays == 0) {
            PurgeOutcome outcome = purgeAll(eligible, now);
            return new TrashOutcome(List.of(), outcome.purged(), outcome.freedBytes(), ids.size() - outcome.purged().size(), null);
        }
        LocalDateTime purgeAt = now.plusDays(trashDays);
        eligible.forEach(file -> moveToTrash(file, admin, now, purgeAt));
        return new TrashOutcome(eligible, List.of(), 0, ids.size() - eligible.size(), purgeAt);
    }

    /** Puts trashed files back in their previous status; auto-cleanup skips them for {@link #RESTORE_GRACE_DAYS}. */
    @Transactional
    public List<MediaFile> restore(Collection<Long> ids) {
        LocalDateTime keepUntil = LocalDateTime.now().plusDays(RESTORE_GRACE_DAYS);
        List<MediaFile> restored = new ArrayList<>();
        for (MediaFile file : media.findAllByIdIn(ids)) {
            if (!MediaFile.TRASHED.equals(file.getStatus())) continue;
            String previous = file.getPreviousStatus() == null ? MediaFile.ORPHANED : file.getPreviousStatus();
            file.setStatus(previous);
            file.setPreviousStatus(null);
            file.setTrashedAt(null);
            file.setTrashedBy(null);
            file.setPurgeAt(null);
            if (MediaFile.ACTIVE.equals(previous)) {
                // An expired form-check video: give it a new expiry instead of re-trashing it tonight.
                file.setExpiresAt(later(file.getExpiresAt(), keepUntil));
            } else {
                file.setDeletableAt(later(file.getDeletableAt(), keepUntil));
            }
            restored.add(file);
        }
        return restored;
    }

    /** Keeps an ORPHANED / REJECTED file longer, e.g. when the member asked for more time to resubmit. */
    @Transactional
    public MediaFile extend(Long id, int days) {
        MediaFile file = media.findById(id)
                .filter(f -> f.getCategory() != null)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Media file not found"));
        if (!MediaFile.ORPHANED.equals(file.getStatus()) && !MediaFile.REJECTED.equals(file.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Only orphaned or rejected media can be extended");
        }
        file.setDeletableAt(later(file.getDeletableAt(), LocalDateTime.now()).plusDays(days));
        return file;
    }

    /** Hard delete of trashed files (only files already in the trash can be purged by hand). */
    @Transactional
    public PurgeOutcome purge(Collection<Long> ids) {
        List<MediaFile> trashed = media.findAllByIdIn(ids).stream()
                .filter(file -> MediaFile.TRASHED.equals(file.getStatus()))
                .toList();
        PurgeOutcome outcome = purgeAll(trashed, LocalDateTime.now());
        return new PurgeOutcome(outcome.purged(), outcome.freedBytes(), ids.size() - outcome.purged().size());
    }

    @Transactional
    public PurgeOutcome emptyTrash() {
        return purgeAll(media.findAllByStatus(MediaFile.TRASHED), LocalDateTime.now());
    }

    // ---------------------------------------------------------------------------------
    // Daily job
    // ---------------------------------------------------------------------------------

    /** Runs the whole cleanup. Without auto-cleanup only the registry is reconciled; nothing is deleted. */
    @Transactional
    public CleanupRun runDaily() {
        reconcile();
        StorageSettings settings = registry.settings();
        if (!settings.isAutoCleanupEnabled()) {
            return new CleanupRun(0, 0, 0);
        }
        LocalDateTime now = LocalDateTime.now();
        List<MediaFile> expired = new ArrayList<>(media.findExpiredInactive(now));
        expired.addAll(media.findExpiredFormChecks(now));

        int trashed = 0;
        List<MediaFile> toPurge = new ArrayList<>(media.findTrashDue(now));
        if (settings.getTrashRetentionDays() == 0) {
            toPurge.addAll(expired);
        } else {
            LocalDateTime purgeAt = now.plusDays(settings.getTrashRetentionDays());
            for (MediaFile file : expired) {
                moveToTrash(file, null, now, purgeAt);
                trashed++;
            }
        }
        PurgeOutcome purged = purgeAll(toPurge, now);

        settings.setLastCleanupAt(now);
        settings.setLastCleanupFreedBytes(purged.freedBytes());
        settingsRepository.save(settings);
        return new CleanupRun(trashed, purged.purged().size(), purged.freedBytes());
    }

    /**
     * Brings media_files in line with the disk, Cloudinary and the exercises:
     * registers files that were stored before the registry existed, marks rows whose file disappeared
     * as PURGED, and recomputes ACTIVE / ORPHANED / REJECTED from the exercises that use each file.
     */
    @Transactional
    public void reconcile() {
        LocalDateTime now = LocalDateTime.now();
        Map<String, MediaFile> rows = media.findAllByCategoryIsNotNullAndStatusNot(MediaFile.PURGED).stream()
                .collect(Collectors.toMap(MediaFile::getFileUrl, Function.identity(), (first, second) -> first));
        Map<String, List<String>> references = new HashMap<>();
        Map<String, Long> creators = new HashMap<>();
        for (Object[] row : exercises.findMediaReferences()) {
            String status = (String) row[2];
            if ("DELETED".equalsIgnoreCase(status)) continue;
            for (int i = 0; i < 2; i++) {
                String url = (String) row[i];
                if (url == null) continue;
                references.computeIfAbsent(url, key -> new ArrayList<>()).add(status);
                if (row[3] != null) creators.putIfAbsent(url, (Long) row[3]);
            }
        }

        List<StoredFile> onDisk = storage.listStoredFiles();
        for (StoredFile stored : onDisk) {
            if (rows.containsKey(stored.url())) continue;
            try {
                User uploader = creators.containsKey(stored.url()) ? users.findById(creators.get(stored.url())).orElse(null) : null;
                if (uploader != null && uploader.getRole() != UserRole.MEMBER) uploader = null;
                MediaFile file = registry.register(stored.url(), null, Files.size(stored.path()), stored.category(),
                        extensionOf(stored.url()), storage.hash(stored.path()), uploader,
                        ExerciseVideoStorageService.lastModified(stored.path()));
                rows.put(stored.url(), file);
            } catch (IOException exception) {
                log.warn("Could not register media file {}", stored.path(), exception);
            }
        }

        // Empty when Cloudinary is off or unreachable: then no Cloudinary row is judged missing.
        Optional<Map<String, CloudFile>> cloudFiles = storage.listCloudinaryFiles();
        if (cloudFiles.isPresent()) {
            // Files uploaded straight to Cloudinary (not through the app) get a row too, so they show up
            // in Cleanup as ORPHANED. Fresh files are skipped: an app upload may not be registered yet.
            Set<String> knownKeys = rows.keySet().stream().map(storage::cloudinaryKey)
                    .flatMap(Optional::stream).collect(Collectors.toSet());
            for (CloudFile cloud : cloudFiles.get().values()) {
                if (knownKeys.contains(cloud.key()) || cloud.uploadedAt().isAfter(now.minusMinutes(10))) continue;
                MediaFile file = registry.register(cloud.url(), null, cloud.sizeBytes(), cloud.category(),
                        cloud.format(), null, null, cloud.uploadedAt());
                rows.put(cloud.url(), file);
            }
        }

        Set<String> diskUrls = onDisk.stream().map(StoredFile::url).collect(Collectors.toSet());
        for (MediaFile file : rows.values()) {
            boolean managedHere = storage.resolve(file.getFileUrl()).isPresent();
            Optional<String> cloudKey = storage.cloudinaryKey(file.getFileUrl());
            // Fresh uploads may not show up in Cloudinary's listing yet.
            boolean recent = file.getUploadedAt() != null && file.getUploadedAt().isAfter(now.minusMinutes(10));
            boolean missingInCloud = cloudKey.isPresent() && cloudFiles.isPresent() && !recent
                    && !cloudFiles.get().containsKey(cloudKey.get());
            if ((managedHere && !diskUrls.contains(file.getFileUrl())) || missingInCloud) {
                file.setStatus(MediaFile.PURGED);
                file.setReason("File missing from storage");
                file.setPurgedAt(now);
                // Drop the dead link so exercises show "no media" instead of a broken file.
                // Only for Cloudinary: its listing is trusted, while a missing disk file may just be a changed storage dir.
                if (missingInCloud) clearReferences(file.getFileUrl());
                continue;
            }
            String state = MediaRegistryService.referenceState(references.getOrDefault(file.getFileUrl(), List.of()));
            if (MediaFile.TRASHED.equals(file.getStatus())) {
                // Safety net: never keep a file in the trash while a live exercise uses it.
                if (MediaFile.ACTIVE.equals(state)) registry.activate(file);
                continue;
            }
            registry.applyReferenceState(file, state, "Not linked to any exercise", now);
        }
    }

    // ---------------------------------------------------------------------------------

    private static boolean isExpired(MediaFile file, LocalDateTime now) {
        boolean inactive = MediaFile.ORPHANED.equals(file.getStatus()) || MediaFile.REJECTED.equals(file.getStatus());
        return inactive && file.getDeletableAt() != null && !file.getDeletableAt().isAfter(now);
    }

    private static void moveToTrash(MediaFile file, User by, LocalDateTime now, LocalDateTime purgeAt) {
        file.setPreviousStatus(file.getStatus());
        file.setStatus(MediaFile.TRASHED);
        file.setTrashedAt(now);
        file.setTrashedBy(by);
        file.setPurgeAt(purgeAt);
    }

    /**
     * Deletes the files from disk, marks the rows PURGED and clears the URLs left on rejected exercises
     * and in the approval history (the history then shows "Media removed").
     * A file a live exercise uses again is reactivated instead of deleted.
     */
    private PurgeOutcome purgeAll(List<MediaFile> files, LocalDateTime now) {
        List<MediaFile> purged = new ArrayList<>();
        long freed = 0;
        for (MediaFile file : files) {
            if (MediaFile.ACTIVE.equals(registry.referenceState(file.getFileUrl()))) {
                registry.activate(file);
                continue;
            }
            if (!storage.deleteFile(file.getFileUrl())) continue;
            if (!MediaFile.TRASHED.equals(file.getStatus())) file.setPreviousStatus(file.getStatus());
            file.setStatus(MediaFile.PURGED);
            file.setPurgedAt(now);
            file.setPurgeAt(null);
            clearReferences(file.getFileUrl());
            purged.add(file);
            freed += file.getSizeBytes();
        }
        return new PurgeOutcome(purged, freed, files.size() - purged.size());
    }

    private void clearReferences(String url) {
        jdbc.update("UPDATE exercises SET video_url = NULL WHERE video_url = ?", url);
        jdbc.update("UPDATE exercises SET anatomy_image_url = NULL WHERE anatomy_image_url = ?", url);
        jdbc.update("UPDATE exercise_moderation_history SET demo_video_url = NULL WHERE demo_video_url = ?", url);
        jdbc.update("UPDATE exercise_moderation_history SET anatomy_image_url = NULL WHERE anatomy_image_url = ?", url);
    }

    private static LocalDateTime later(LocalDateTime a, LocalDateTime b) {
        return a == null || b.isAfter(a) ? b : a;
    }

    private static String extensionOf(String url) {
        int dot = url.lastIndexOf('.');
        return dot < 0 ? "" : url.substring(dot + 1);
    }
}
