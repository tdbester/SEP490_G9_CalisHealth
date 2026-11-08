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
import lombok.extern.slf4j.Slf4j;
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
@Slf4j
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
    private final CloudinaryUsageService cloudinary;

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
        checkTotalQuota(sizeBytes);

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

    /**
     * Rejects the upload when the account has no room left.
     * <p>
     * With Cloudinary the real limit of the account decides, not the quota the admin typed: the
     * plan gives the space and the provider refuses the upload when it is full. A plan without a
     * byte limit (the free plan counts credits instead) is not checked here: the credits are read
     * by the daily job and the admins are warned before the account runs out.
     * The registry sum is only used when there is no Cloudinary account (the local disk).
     */
    private void checkTotalQuota(long sizeBytes) {
        StorageSettings s = settings();
        long used = media.sumBytesOnDisk();
        long limit = s.getQuotaGb() * GB;
        String source = "the storage quota";

        var cloudUsage = cloudinary.usage();
        if (cloudUsage.isPresent()) {
            long planLimit = cloudUsage.get().storageLimitBytes();
            if (planLimit > 0) {
                used = cloudUsage.get().storageUsedBytes();
                limit = planLimit;
                source = "the plan limit";
            }
        }
        if (used + sizeBytes > limit) {
            throw new ResponseStatusException(HttpStatus.INSUFFICIENT_STORAGE,
                    "Storage is full: this upload would exceed " + source
                            + ". Ask an administrator to free up space or raise the limit");
        }
    }

    /** JPEG is accepted under the "JPG" setting. */
    static String normalizeFormat(String extension) {
        String upper = extension == null ? "" : extension.trim().toUpperCase(Locale.ROOT);
        return "JPEG".equals(upper) ? "JPG" : upper;
    }

    /** The file extension of a URL, in upper case. */
    static String extensionOf(String url) {
        if (url == null) return "";
        int dot = url.lastIndexOf('.');
        int slash = url.lastIndexOf('/');
        return dot > slash ? url.substring(dot + 1) : "";
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
        return register(url, originalName, sizeBytes, category, format, contentHash, uploader, uploadedAt, null);
    }

    @Transactional
    public MediaFile register(String url, String originalName, long sizeBytes, String category, String format,
                              String contentHash, User uploader, LocalDateTime uploadedAt, Integer durationSeconds) {
        MediaFile file = new MediaFile();
        file.setFileUrl(url);
        file.setOriginalName(originalName == null || originalName.isBlank() ? fileNameOf(url) : truncate(originalName, 255));
        file.setSizeBytes(sizeBytes);
        file.setSizeMb(BigDecimal.valueOf(sizeBytes).divide(BigDecimal.valueOf(MB), 2, RoundingMode.HALF_UP));
        file.setCategory(category);
        file.setFileType(MediaFile.ANATOMY_IMAGE.equals(category) ? MediaFile.TYPE_IMAGE : MediaFile.TYPE_VIDEO);
        file.setFormat(normalizeFormat(format));
        file.setContentHash(contentHash);
        file.setSource(uploader != null && uploader.getRole() == UserRole.MEMBER ? MediaFile.SOURCE_MEMBER : MediaFile.SOURCE_SYSTEM);
        file.setUploadedBy(uploader);
        file.setUploadedAt(uploadedAt);
        file.setDurationSeconds(durationSeconds);
        file.setStatus(MediaFile.ACTIVE);
        return media.save(file);
    }

    // ---------------------------------------------------------------------------------
    // Status changes driven by exercises
    // ---------------------------------------------------------------------------------

    /**
     * Writes a profile photo into the registry, so it counts toward the storage of the system like
     * every other media file. The photo itself lives on the local disk.
     */
    @Transactional
    public void registerAvatar(String url, String originalName, long sizeBytes, User owner) {
        if (url == null) return;
        media.findFirstByFileUrlAndStatusNotOrderByIdDesc(url, MediaFile.PURGED).ifPresentOrElse(
                existing -> {
                    // The same photo is uploaded again: refresh its size and owner.
                    existing.setSizeBytes(sizeBytes);
                    existing.setStatus(MediaFile.ACTIVE);
                    existing.setUploadedAt(LocalDateTime.now());
                    media.save(existing);
                },
                () -> {
                    MediaFile file = new MediaFile();
                    file.setFileUrl(url);
                    file.setOriginalName(truncate(originalName, 255));
                    file.setSizeBytes(sizeBytes);
                    file.setSizeMb(BigDecimal.valueOf(sizeBytes).divide(BigDecimal.valueOf(MB), 2, RoundingMode.HALF_UP));
                    file.setCategory(MediaFile.PROFILE_AVATAR);
                    file.setFileType(MediaFile.TYPE_IMAGE);
                    file.setFormat(normalizeFormat(extensionOf(url)));
                    file.setSource(owner != null && owner.getRole() == UserRole.MEMBER
                            ? MediaFile.SOURCE_MEMBER : MediaFile.SOURCE_SYSTEM);
                    file.setUploadedBy(owner);
                    file.setUploadedAt(LocalDateTime.now());
                    file.setStatus(MediaFile.ACTIVE);
                    media.save(file);
                });
    }

    /** Marks a removed profile photo as PURGED, so it stops counting toward the storage. */
    @Transactional
    public void purgeAvatar(String url) {
        if (url == null) return;
        media.findFirstByFileUrlAndStatusNotOrderByIdDesc(url, MediaFile.PURGED).ifPresent(file -> {
            file.setStatus(MediaFile.PURGED);
            file.setReason("Profile photo removed");
            file.setPurgedAt(LocalDateTime.now());
        });
    }

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
     * Trashed and purged files are left alone.
     * <p>
     * A profile photo is not linked to an exercise, so it would always end up as ORPHANED. Its life
     * is decided by the profile screen instead (a new photo replaces the old one), so it stays ACTIVE.
     */
    public void applyReferenceState(MediaFile file, String state, String orphanReason, LocalDateTime now) {
        String status = file.getStatus();
        if (MediaFile.TRASHED.equals(status) || MediaFile.PURGED.equals(status)
                || MediaFile.PROFILE_AVATAR.equals(file.getCategory())) {
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
