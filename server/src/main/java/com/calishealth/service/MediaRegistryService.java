package com.calishealth.service;

import com.calishealth.models.MediaFile;
import com.calishealth.models.StorageSettings;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.MediaFileRepository;
import com.calishealth.repository.StorageSettingsRepository;
import com.calishealth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Keeps media_files in sync with what the app stores on disk: upload limits, registration of new
 * files, and the ACTIVE / ORPHANED / REJECTED transitions that follow exercise changes.
 * Physical deletion (trash / purge) lives in {@link MediaCleanupService}.
 */
@Service
@RequiredArgsConstructor
public class MediaRegistryService {
    static final long MB = 1024L * 1024;
    static final long GB = MB * 1024;

    private static final String EXERCISE_REJECTED = "REJECTED";
    private static final String EXERCISE_DELETED = "DELETED";

    private final MediaFileRepository media;
    private final StorageSettingsRepository settingsRepository;
    private final ExerciseRepository exercises;
    private final UserRepository users;

    @Transactional(readOnly = true)
    public StorageSettings settings() {
        return settingsRepository.findById(StorageSettings.ID)
                .orElseThrow(() -> new IllegalStateException("storage_settings row 1 is missing (see V64)"));
    }

    // ---------------------------------------------------------------------------------
    // Uploads
    // ---------------------------------------------------------------------------------

    /**
     * Rejects an upload that breaks the admin limits: size, format, total quota and, for members,
     * the personal quota and uploads per day. Returns the uploader (null when unknown).
     */
    @Transactional(readOnly = true)
    public User checkUpload(String category, String extension, long sizeBytes, String uploaderEmail) {
        StorageSettings s = settings();
        boolean video = !MediaFile.ANATOMY_IMAGE.equals(category);
        List<String> formats = video ? s.videoFormatList() : s.imageFormatList();
        String format = normalizeFormat(extension);
        if (!formats.contains(format)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    (video ? "Video" : "Image") + " must be one of: " + String.join(", ", formats));
        }
        int maxMb = video ? s.getMaxVideoMb() : s.getMaxImageMb();
        if (sizeBytes > maxMb * MB) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    (video ? "Video" : "Image") + " must be " + maxMb + " MB or smaller");
        }
        if (media.sumBytesOnDisk() + sizeBytes > s.getQuotaGb() * GB) {
            throw new ResponseStatusException(HttpStatus.INSUFFICIENT_STORAGE,
                    "Storage is full. Ask an administrator to free up space or raise the storage quota");
        }

        User uploader = uploaderEmail == null ? null : users.findByEmail(uploaderEmail).orElse(null);
        if (uploader != null && uploader.getRole() == UserRole.MEMBER) {
            if (media.sumMemberBytes(uploader.getId()) + sizeBytes > s.getMemberQuotaMb() * MB) {
                throw new ResponseStatusException(HttpStatus.INSUFFICIENT_STORAGE,
                        "Storage full: your uploads would exceed the " + s.getMemberQuotaMb() + " MB limit per member");
            }
            if (media.countUploadsSince(uploader.getId(), LocalDate.now().atStartOfDay()) >= s.getUploadsPerDay()) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                        "You can upload at most " + s.getUploadsPerDay() + " files per day");
            }
        }
        return uploader;
    }

    /** JPEG is accepted under the "JPG" setting. */
    static String normalizeFormat(String extension) {
        String upper = extension == null ? "" : extension.trim().toUpperCase(Locale.ROOT);
        return "JPEG".equals(upper) ? "JPG" : upper;
    }

    /** An earlier upload with the same content that is still on disk, so the new upload can reuse it. */
    @Transactional(readOnly = true)
    public Optional<MediaFile> findSameContent(String contentHash, String category) {
        return media.findFirstByContentHashAndCategoryAndStatusNotOrderByIdDesc(contentHash, category, MediaFile.PURGED);
    }

    /** Re-uploading an inactive or trashed file makes it active again instead of storing a copy. */
    @Transactional
    public String reuse(Long mediaId) {
        MediaFile file = media.findById(mediaId).orElseThrow();
        activate(file);
        return file.getFileUrl();
    }

    @Transactional
    public MediaFile register(String url, String originalName, long sizeBytes, String category, String format,
                              String contentHash, User uploader, LocalDateTime uploadedAt) {
        MediaFile file = new MediaFile();
        file.setFileUrl(url);
        file.setOriginalName(originalName == null || originalName.isBlank() ? fileNameOf(url) : truncate(originalName, 255));
        file.setSizeBytes(sizeBytes);
        file.setSizeMb(BigDecimal.valueOf(sizeBytes).divide(BigDecimal.valueOf(MB), 2, RoundingMode.HALF_UP));
        file.setCategory(category);
        file.setFileType(MediaFile.ANATOMY_IMAGE.equals(category) ? MediaFile.TYPE_IMAGE : MediaFile.TYPE_VIDEO);
        file.setFormat(normalizeFormat(format));
        file.setPurpose(category);
        file.setContentHash(contentHash);
        file.setSource(uploader != null && uploader.getRole() == UserRole.MEMBER ? MediaFile.SOURCE_MEMBER : MediaFile.SOURCE_SYSTEM);
        file.setUploadedBy(uploader);
        file.setUploadedAt(uploadedAt);
        file.setStatus(MediaFile.ACTIVE);
        if (MediaFile.FORM_CHECK_VIDEO.equals(category)) {
            file.setExpiresAt(uploadedAt.plusDays(settings().getFormCheckRetentionDays()));
        }
        return media.save(file);
    }

    // ---------------------------------------------------------------------------------
    // Status changes driven by exercises
    // ---------------------------------------------------------------------------------

    /**
     * Call after an exercise stops using a file (replaced, deleted, upload not saved).
     * The file becomes ORPHANED only when no other exercise still uses it.
     */
    @Transactional
    public void release(String url, String reason) {
        if (url == null) return;
        media.findFirstByFileUrlAndStatusNotOrderByIdDesc(url, MediaFile.PURGED)
                .ifPresent(file -> applyReferenceState(file, referenceState(url), reason, LocalDateTime.now()));
    }

    /** A member exercise was rejected: its media is kept for the rejected-media retention period. */
    @Transactional
    public void markRejected(Collection<String> urls, String reason) {
        LocalDateTime now = LocalDateTime.now();
        for (String url : urls) {
            if (url == null) continue;
            media.findFirstByFileUrlAndStatusNotOrderByIdDesc(url, MediaFile.PURGED).ifPresent(file -> {
                String state = referenceState(url);
                if (MediaFile.REJECTED.equals(state) && !MediaFile.TRASHED.equals(file.getStatus())) {
                    setInactive(file, MediaFile.REJECTED, truncate(reason, 255), now,
                            now.plusDays(settings().getRejectedRetentionDays()));
                } else {
                    applyReferenceState(file, state, reason, now);
                }
            });
        }
    }

    /** An exercise using these files was approved: they are active again, even if already in the trash. */
    @Transactional
    public void markActive(Collection<String> urls) {
        for (String url : urls) {
            if (url == null) continue;
            media.findFirstByFileUrlAndStatusNotOrderByIdDesc(url, MediaFile.PURGED).ifPresent(this::activate);
        }
    }

    /** ACTIVE when a live exercise uses the file, REJECTED when only rejected exercises do, null when none. */
    public String referenceState(String url) {
        List<String> statuses = exercises.findModerationStatusesUsingMedia(url).stream()
                .filter(s -> !EXERCISE_DELETED.equalsIgnoreCase(s))
                .toList();
        return referenceState(statuses);
    }

    public static String referenceState(List<String> exerciseStatuses) {
        if (exerciseStatuses.isEmpty()) return null;
        return exerciseStatuses.stream().allMatch(EXERCISE_REJECTED::equalsIgnoreCase) ? MediaFile.REJECTED : MediaFile.ACTIVE;
    }

    /**
     * Moves an ACTIVE / ORPHANED / REJECTED file to the status its references call for. Files that are
     * already in the requested state keep their dates, so the grace period is not restarted.
     * Trashed, purged and form-check files are left alone.
     */
    public void applyReferenceState(MediaFile file, String state, String orphanReason, LocalDateTime now) {
        String status = file.getStatus();
        if (MediaFile.TRASHED.equals(status) || MediaFile.PURGED.equals(status)
                || MediaFile.FORM_CHECK_VIDEO.equals(file.getCategory())) {
            return;
        }
        StorageSettings s = settings();
        if (MediaFile.ACTIVE.equals(state)) {
            activate(file);
        } else if (MediaFile.REJECTED.equals(state)) {
            if (!MediaFile.REJECTED.equals(status)) {
                setInactive(file, MediaFile.REJECTED, "Rejected by moderation", now, now.plusDays(s.getRejectedRetentionDays()));
            }
        } else if (!MediaFile.ORPHANED.equals(status)) {
            setInactive(file, MediaFile.ORPHANED, truncate(orphanReason, 255), now, now.plusHours(s.getOrphanGraceHours()));
        }
    }

    public void activate(MediaFile file) {
        file.setStatus(MediaFile.ACTIVE);
        file.setPreviousStatus(null);
        file.setReason(null);
        file.setInactiveSince(null);
        file.setDeletableAt(null);
        file.setTrashedAt(null);
        file.setTrashedBy(null);
        file.setPurgeAt(null);
    }

    private static void setInactive(MediaFile file, String status, String reason, LocalDateTime now, LocalDateTime deletableAt) {
        // activate() clears inactive_since, so it is only set when the file stops being used.
        if (file.getInactiveSince() == null) {
            file.setInactiveSince(now);
        }
        file.setStatus(status);
        file.setReason(reason);
        file.setDeletableAt(deletableAt);
    }

    static String fileNameOf(String url) {
        return url == null ? null : url.substring(url.lastIndexOf('/') + 1);
    }

    static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
