package com.calishealth.service;

import com.calishealth.dtos.AdminStorageDtos.*;
import com.calishealth.models.MediaFile;
import com.calishealth.models.StorageSettings;
import com.calishealth.models.User;
import com.calishealth.repository.MediaFileRepository;
import com.calishealth.repository.StorageSettingsRepository;
import com.calishealth.repository.UserActivityRepository;
import com.calishealth.repository.UserRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Backs the three tabs of Admin > Media storage & infrastructure. Every change is written to the admin's activity log. */
@Service
@RequiredArgsConstructor
public class AdminStorageService {
    private static final long MB = MediaRegistryService.MB;
    private static final long GB = MediaRegistryService.GB;
    private static final Set<String> VIDEO_FORMATS = Set.of("MP4", "MOV", "WEBM");
    private static final Set<String> IMAGE_FORMATS = Set.of("JPG", "PNG", "WEBP");
    private static final List<String> CATEGORIES = List.of(MediaFile.DEMO_VIDEO, MediaFile.FORM_CHECK_VIDEO, MediaFile.ANATOMY_IMAGE);
    private static final List<String> SOURCES = List.of(MediaFile.SOURCE_SYSTEM, MediaFile.SOURCE_MEMBER);
    private static final Map<String, Sort> SORTS = Map.of(
            "size_desc", Sort.by(Sort.Direction.DESC, "sizeBytes"),
            "size_asc", Sort.by(Sort.Direction.ASC, "sizeBytes"),
            "oldest", Sort.by(Sort.Direction.ASC, "inactiveSince"),
            "newest", Sort.by(Sort.Direction.DESC, "inactiveSince"),
            "purge_soon", Sort.by(Sort.Direction.ASC, "purgeAt"),
            "trashed_recent", Sort.by(Sort.Direction.DESC, "trashedAt"));

    private final MediaFileRepository media;
    private final StorageSettingsRepository settingsRepository;
    private final MediaRegistryService registry;
    private final MediaCleanupService cleanup;
    private final UserRepository users;
    private final UserActivityRepository activity;

    // ---------------------------------------------------------------------------------
    // Capacity
    // ---------------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public Overview overview() {
        StorageSettings s = registry.settings();
        LocalDateTime now = LocalDateTime.now();
        long quota = s.getQuotaGb() * GB;
        long used = media.sumBytesOnDisk();

        Map<String, long[]> byCategory = usage(media.usageByCategory());
        Map<String, long[]> bySource = usage(media.usageBySource());
        Map<String, Long> byType = new HashMap<>();
        media.countByFileType().forEach(row -> byType.put((String) row[0], num(row[1])));
        long videos = byType.getOrDefault(MediaFile.TYPE_VIDEO, 0L);
        long images = byType.getOrDefault(MediaFile.TYPE_IMAGE, 0L);

        List<MonthUsage> history = new ArrayList<>();
        for (int i = 5; i >= 0; i--) {
            YearMonth month = YearMonth.from(now).minusMonths(i);
            LocalDateTime at = i == 0 ? now : month.atEndOfMonth().atTime(LocalTime.MAX);
            history.add(new MonthUsage(month.toString(), media.sumBytesOnDiskAt(at)));
        }
        long growth = Math.max(0, (used - media.sumBytesOnDiskAt(now.minusMonths(3))) / 3);
        LocalDate estimatedFull = used >= quota ? LocalDate.now()
                : growth > 0 ? LocalDate.now().plusDays(Math.round((quota - used) / (double) growth * 30.44)) : null;

        List<TopMember> top = media.topMembers(PageRequest.of(0, 5)).stream()
                .map(row -> new TopMember(num(row[0]), (String) row[1], num(row[2]), num(row[3])))
                .toList();

        long[] trash = statusTotals().getOrDefault(MediaFile.TRASHED, new long[2]);
        LocalDateTime nextRun = now.toLocalDate().atTime(LocalTime.parse(StorageCleanupJob.RUN_AT));
        if (!nextRun.isAfter(now)) nextRun = nextRun.plusDays(1);
        AutoCleanup autoCleanup = new AutoCleanup(s.isAutoCleanupEnabled(), StorageCleanupJob.RUN_AT, s.getLastCleanupAt(),
                s.getLastCleanupFreedBytes(), media.sumExpiringBy(nextRun), trash[0], trash[1], s.getTrashRetentionDays());

        return new Overview(quota, used, s.getWarningPercent(), s.getCriticalPercent(), videos + images, videos, images,
                growth, estimatedFull, s.getMemberQuotaMb() * MB,
                CATEGORIES.stream().map(key -> toUsage(key, byCategory)).toList(),
                SOURCES.stream().map(key -> toUsage(key, bySource)).toList(),
                history, top, autoCleanup);
    }

    private static Map<String, long[]> usage(List<Object[]> rows) {
        Map<String, long[]> result = new HashMap<>();
        rows.forEach(row -> result.put((String) row[0], new long[] { num(row[1]), num(row[2]) }));
        return result;
    }

    private static Usage toUsage(String key, Map<String, long[]> totals) {
        long[] value = totals.getOrDefault(key, new long[2]);
        return new Usage(key, value[1], value[0]);
    }

    /** status -> [files, bytes]. */
    private Map<String, long[]> statusTotals() {
        return usage(media.countByStatus());
    }

    // ---------------------------------------------------------------------------------
    // Cleanup
    // ---------------------------------------------------------------------------------

    /** view = inactive (ORPHANED / REJECTED) or trash; in the trash, status filters the status before deletion. */
    @Transactional(readOnly = true)
    public MediaPage media(String view, String status, String source, String type, String sort, int page, int size) {
        boolean trash = "trash".equalsIgnoreCase(view);
        String statusFilter = upper(status);
        String sourceFilter = upper(source);
        String typeFilter = upper(type);
        Specification<MediaFile> spec = (root, query, cb) -> {
            List<Predicate> where = new ArrayList<>();
            where.add(cb.isNotNull(root.get("category")));
            where.add(trash
                    ? cb.equal(root.get("status"), MediaFile.TRASHED)
                    : root.get("status").in(MediaFile.ORPHANED, MediaFile.REJECTED));
            if (statusFilter != null) where.add(cb.equal(root.get(trash ? "previousStatus" : "status"), statusFilter));
            if (sourceFilter != null) where.add(cb.equal(root.get("source"), sourceFilter));
            if (typeFilter != null) where.add(cb.equal(root.get("fileType"), typeFilter));
            return cb.and(where.toArray(Predicate[]::new));
        };
        Sort fallback = trash ? SORTS.get("purge_soon") : SORTS.get("size_desc");
        Sort order = (sort == null ? fallback : SORTS.getOrDefault(sort, fallback)).and(Sort.by("id"));
        int pageSize = Math.min(Math.max(size, 1), 100);
        Page<MediaFile> result = media.findAll(spec, PageRequest.of(Math.max(page, 0), pageSize, order));
        return new MediaPage(result.getContent().stream().map(AdminStorageService::toItem).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages(), summary());
    }

    private MediaSummary summary() {
        LocalDateTime now = LocalDateTime.now();
        Map<String, long[]> totals = statusTotals();
        long[] orphaned = totals.getOrDefault(MediaFile.ORPHANED, new long[2]);
        long[] rejected = totals.getOrDefault(MediaFile.REJECTED, new long[2]);
        long[] trash = totals.getOrDefault(MediaFile.TRASHED, new long[2]);
        Object[] reclaimable = media.reclaimable(now).get(0);
        return new MediaSummary(orphaned[0] + rejected[0], orphaned[0], orphaned[1], rejected[0], rejected[1],
                num(reclaimable[0]), num(reclaimable[1]), trash[0], trash[1],
                media.sumTrashDue(now.plusDays(1)), registry.settings().getTrashRetentionDays());
    }

    private static MediaItem toItem(MediaFile file) {
        User uploader = file.getUploadedBy();
        String sourceLabel = MediaFile.SOURCE_MEMBER.equals(file.getSource())
                ? (uploader == null ? "Unknown member" : uploader.getEmail())
                : "Exercise library";
        String trashedBy = file.getTrashedAt() == null ? null
                : file.getTrashedBy() == null ? "Auto-cleanup" : file.getTrashedBy().getEmail();
        return new MediaItem(file.getId(), file.getOriginalName(), file.getFileType(), file.getStatus(),
                file.getPreviousStatus(), file.getReason(), file.getSource(), sourceLabel, file.getUploadedAt(),
                file.getInactiveSince(), file.getDeletableAt(), file.getTrashedAt(), trashedBy, file.getPurgeAt(),
                file.getSizeBytes(), file.getFileUrl());
    }

    @Transactional
    public TrashResult trash(String adminEmail, List<Long> ids) {
        User admin = admin(adminEmail);
        MediaCleanupService.TrashOutcome outcome = cleanup.trash(ids, admin);
        if (!outcome.purged().isEmpty()) {
            log(admin, "Deleted " + describe(outcome.purged()) + " permanently (trash disabled), freed " + mb(outcome.freedBytes()));
        } else if (!outcome.trashed().isEmpty()) {
            log(admin, "Moved " + describe(outcome.trashed()) + " to the trash");
        }
        return new TrashResult(outcome.trashed().size(), outcome.purged().size(), outcome.freedBytes(), outcome.skipped(),
                outcome.trashed().isEmpty() ? null : outcome.purgeAt());
    }

    @Transactional
    public RestoreResult restore(String adminEmail, List<Long> ids) {
        User admin = admin(adminEmail);
        List<MediaFile> restored = cleanup.restore(ids);
        if (!restored.isEmpty()) log(admin, "Restored " + describe(restored) + " from the trash");
        return new RestoreResult(restored.size(), MediaCleanupService.RESTORE_GRACE_DAYS);
    }

    @Transactional
    public MediaItem extend(String adminEmail, Long id, int days) {
        User admin = admin(adminEmail);
        MediaFile file = cleanup.extend(id, days);
        log(admin, "Extended retention of " + file.getOriginalName() + " by " + days + " days");
        return toItem(file);
    }

    @Transactional
    public DeleteResult delete(String adminEmail, List<Long> ids) {
        User admin = admin(adminEmail);
        MediaCleanupService.PurgeOutcome outcome = cleanup.purge(ids);
        if (!outcome.purged().isEmpty()) {
            log(admin, "Deleted " + describe(outcome.purged()) + " permanently, freed " + mb(outcome.freedBytes()));
        }
        return new DeleteResult(outcome.purged().size(), outcome.freedBytes(), outcome.skipped());
    }

    @Transactional
    public DeleteResult emptyTrash(String adminEmail) {
        User admin = admin(adminEmail);
        MediaCleanupService.PurgeOutcome outcome = cleanup.emptyTrash();
        if (!outcome.purged().isEmpty()) {
            log(admin, "Emptied the media trash: " + outcome.purged().size() + " file(s), freed " + mb(outcome.freedBytes()));
        }
        return new DeleteResult(outcome.purged().size(), outcome.freedBytes(), outcome.skipped());
    }

    // ---------------------------------------------------------------------------------
    // Upload limits
    // ---------------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public Settings settings() {
        return toSettings(registry.settings());
    }

    @Transactional
    public Settings updateSettings(String adminEmail, UpdateSettingsRequest r) {
        User admin = admin(adminEmail);
        range("Maximum video size", r.maxVideoMb(), 10, 500);
        range("Maximum image size", r.maxImageMb(), 1, 20);
        range("Form-check video length", r.formCheckMaxSeconds(), 10, 180);
        range("Exercise demo video length", r.demoMaxSeconds(), 30, 600);
        range("Storage quota per member", r.memberQuotaMb(), 50, 2000);
        range("Uploads per member per day", r.uploadsPerDay(), 1, 50);
        range("Form-check video retention", r.formCheckRetentionDays(), 1, 30);
        range("Rejected media retention", r.rejectedRetentionDays(), 7, 90);
        range("Orphaned file grace period", r.orphanGraceHours(), 1, 72);
        range("Trash retention", r.trashRetentionDays(), 0, 30);
        range("Total storage quota", r.quotaGb(), 1, 1000);
        range("Warning threshold", r.warningPercent(), 50, 95);
        range("Critical threshold", r.criticalPercent(), 51, 99);
        if (r.criticalPercent() <= r.warningPercent()) {
            throw badRequest("Critical threshold must be higher than the warning threshold");
        }
        long used = media.sumBytesOnDisk();
        if (r.quotaGb() * GB <= used) {
            throw badRequest("Total storage quota must be higher than current usage (" + mb(used) + ")");
        }
        List<String> videoFormats = formats("video", r.videoFormats(), VIDEO_FORMATS);
        List<String> imageFormats = formats("image", r.imageFormats(), IMAGE_FORMATS);

        StorageSettings s = registry.settings();
        s.setMaxVideoMb(r.maxVideoMb());
        s.setMaxImageMb(r.maxImageMb());
        s.setVideoFormats(String.join(",", videoFormats));
        s.setImageFormats(String.join(",", imageFormats));
        s.setFormCheckMaxSeconds(r.formCheckMaxSeconds());
        s.setDemoMaxSeconds(r.demoMaxSeconds());
        s.setMemberQuotaMb(r.memberQuotaMb());
        s.setUploadsPerDay(r.uploadsPerDay());
        s.setFormCheckRetentionDays(r.formCheckRetentionDays());
        s.setRejectedRetentionDays(r.rejectedRetentionDays());
        s.setOrphanGraceHours(r.orphanGraceHours());
        s.setTrashRetentionDays(r.trashRetentionDays());
        s.setAutoCleanupEnabled(r.autoCleanupEnabled());
        s.setQuotaGb(r.quotaGb());
        s.setWarningPercent(r.warningPercent());
        s.setCriticalPercent(r.criticalPercent());
        s.setUpdatedBy(admin);
        s.setUpdatedAt(LocalDateTime.now());
        settingsRepository.save(s);
        log(admin, "Updated upload limits and storage settings");
        return toSettings(s);
    }

    private Settings toSettings(StorageSettings s) {
        return new Settings(s.getMaxVideoMb(), s.getMaxImageMb(), s.videoFormatList(), s.imageFormatList(),
                s.getFormCheckMaxSeconds(), s.getDemoMaxSeconds(), s.getMemberQuotaMb(), s.getUploadsPerDay(),
                s.getFormCheckRetentionDays(), s.getRejectedRetentionDays(), s.getOrphanGraceHours(),
                s.getTrashRetentionDays(), s.isAutoCleanupEnabled(), s.getQuotaGb(), s.getWarningPercent(),
                s.getCriticalPercent(), media.sumBytesOnDisk(),
                s.getUpdatedBy() == null ? null : s.getUpdatedBy().getEmail(), s.getUpdatedAt());
    }

    private static void range(String label, int value, int min, int max) {
        if (value < min || value > max) throw badRequest(label + " must be between " + min + " and " + max);
    }

    private static List<String> formats(String kind, List<String> requested, Set<String> allowed) {
        LinkedHashMap<String, String> unique = new LinkedHashMap<>();
        for (String format : requested) {
            String value = MediaRegistryService.normalizeFormat(format);
            if (!allowed.contains(value)) throw badRequest("Unsupported " + kind + " format: " + format);
            unique.put(value, value);
        }
        if (unique.isEmpty()) throw badRequest("Allow at least one " + kind + " format");
        return List.copyOf(unique.keySet());
    }

    // ---------------------------------------------------------------------------------

    private User admin(String email) {
        return users.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "The signed-in user no longer exists"));
    }

    private void log(User admin, String description) {
        activity.logEvent(admin.getId(), "STORAGE", description, "SUCCESS");
    }

    private static String describe(List<MediaFile> files) {
        return files.size() == 1 ? files.get(0).getOriginalName() : files.size() + " media files";
    }

    private static String mb(long bytes) {
        return bytes >= GB ? String.format(Locale.ROOT, "%.1f GB", bytes / (double) GB)
                : String.format(Locale.ROOT, "%.1f MB", bytes / (double) MB);
    }

    /** Aggregates may come back as Long or Integer depending on the query. */
    private static long num(Object value) {
        return value == null ? 0 : ((Number) value).longValue();
    }

    private static String upper(String value) {
        return value == null || value.isBlank() ? null : value.trim().toUpperCase(Locale.ROOT);
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
