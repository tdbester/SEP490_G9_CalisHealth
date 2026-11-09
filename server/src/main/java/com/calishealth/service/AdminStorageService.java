package com.calishealth.service;

import com.calishealth.dtos.AdminStorageDtos.*;
import com.calishealth.models.MediaFile;
import com.calishealth.models.StorageSettings;
import com.calishealth.models.StorageUsageDaily;
import com.calishealth.models.User;
import com.calishealth.repository.MediaFileRepository;
import com.calishealth.repository.StorageSettingsRepository;
import com.calishealth.repository.StorageUsageDailyRepository;
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

import java.math.BigDecimal;
import java.math.RoundingMode;
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
import java.util.Optional;
import java.util.Set;

/** Backs the three tabs of Admin > Storage. Every change is written to the admin's activity log. */
@Service
@RequiredArgsConstructor
public class AdminStorageService {
    private static final long MB = MediaRegistryService.MB;
    private static final long GB = MediaRegistryService.GB;
    private static final Set<String> VIDEO_FORMATS = Set.of("MP4", "MOV", "WEBM");
    private static final Set<String> IMAGE_FORMATS = Set.of("JPG", "PNG", "WEBP");
    private static final List<String> CATEGORIES = List.of(
            MediaFile.DEMO_VIDEO, MediaFile.ANATOMY_IMAGE, MediaFile.PROFILE_AVATAR);
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
    private final StorageUsageDailyRepository usageDaily;
    private final MediaRegistryService registry;
    private final MediaCleanupService cleanup;
    private final CloudinaryUsageService cloudinary;
    private final StorageUsageJob usageJob;
    private final UserRepository users;
    private final UserActivityRepository activity;

    // ---------------------------------------------------------------------------------
    // Capacity
    // ---------------------------------------------------------------------------------

    /**
     * The overview of the Storage tab.
     * <p>
     * The numbers that cost money come from the provider (Cloudinary): the registry only knows the
     * files this app manages. When the provider cannot be reached the registry numbers are used,
     * and the screen says so.
     */
    @Transactional(readOnly = true)
    public Overview overview() {
        StorageSettings s = registry.settings();
        LocalDateTime now = LocalDateTime.now();
        long registryBytes = media.sumBytesOnDisk();

        Optional<CloudinaryUsageService.Usage> cloud = cloudinary.usage();
        String provider = cloud.isPresent() ? "CLOUDINARY" : "LOCAL";
        long used = cloud.map(CloudinaryUsageService.Usage::storageUsedBytes).orElse(registryBytes);
        // The plan decides the real limit; the admin setting is only the fallback for the local disk.
        boolean quotaLimited = cloud.map(CloudinaryUsageService.Usage::storageLimitBytes).orElse(0L) > 0;
        long quota = quotaLimited
                ? cloud.get().storageLimitBytes()
                : s.getQuotaGb() * GB;

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

        Map<String, long[]> totals = statusTotals();
        long[] trash = totals.getOrDefault(MediaFile.TRASHED, new long[2]);
        long[] orphaned = totals.getOrDefault(MediaFile.ORPHANED, new long[2]);
        long[] rejected = totals.getOrDefault(MediaFile.REJECTED, new long[2]);
        LocalDateTime nextRun = now.toLocalDate().atTime(LocalTime.parse(StorageCleanupJob.RUN_AT));
        if (!nextRun.isAfter(now)) nextRun = nextRun.plusDays(1);
        AutoCleanup autoCleanup = new AutoCleanup(s.isAutoCleanupEnabled(), StorageCleanupJob.RUN_AT, s.getLastCleanupAt(),
                s.getLastCleanupFreedBytes(), media.sumExpiringBy(nextRun), trash[0], trash[1], s.getTrashRetentionDays(),
                orphaned[0] + rejected[0], orphaned[1] + rejected[1]);

        CloudinaryUsageService.Usage cloudUsage = cloud.orElse(null);
        CloudinaryUsageService.ConsoleLinks links = cloudinary.consoleLinks();
        return new Overview(
                provider,
                cloudUsage == null ? null : cloudUsage.plan(),
                cloudinary.cloudName(),
                links.mediaLibrary() == null ? null : new ConsoleLinks(
                        links.mediaLibrary(),
                        links.usage(),
                        links.uploadSettings(),
                        links.plan()),
                cloudinary.isEnabled(),
                quota,
                quotaLimited,
                used,
                registryBytes,
                cloudUsage == null ? 0 : cloudUsage.bandwidthUsedBytes(),
                cloudUsage == null ? 0 : cloudUsage.bandwidthLimitBytes(),
                cloudUsage == null || cloudUsage.creditsUsed() == null ? null : cloudUsage.creditsUsed().doubleValue(),
                cloudUsage == null || cloudUsage.creditsLimit() == null ? null : cloudUsage.creditsLimit().doubleValue(),
                cloudUsage == null ? 0 : cloudUsage.creditsUsedPercent(),
                s.getWarningPercent(), s.getCriticalPercent(), videos + images, videos, images,
                growth, estimatedFull, s.getMemberQuotaMb() * MB,
                CATEGORIES.stream().map(key -> toUsage(key, byCategory)).toList(),
                SOURCES.stream().map(key -> toUsage(key, bySource)).toList(),
                history, dailyUsage(now), top, autoCleanup);
    }

    /**
     * The last 30 days of the real usage. The rows come from the daily snapshot; the current day
     * is added live so the chart is not one day behind.
     */
    private List<DayUsage> dailyUsage(LocalDateTime now) {
        LocalDate from = now.toLocalDate().minusDays(29);
        Map<LocalDate, StorageUsageDaily> rows = new HashMap<>();
        usageDaily.findByDayGreaterThanEqualOrderByDayAsc(from).forEach(row -> rows.put(row.getDay(), row));

        List<DayUsage> result = new ArrayList<>();
        for (int i = 0; i < 30; i++) {
            LocalDate day = from.plusDays(i);
            StorageUsageDaily row = rows.get(day);
            if (row != null) {
                result.add(new DayUsage(day.toString(), row.getStorageUsed(), row.getBandwidthUsed(),
                        row.getCreditsUsed() == null ? null : row.getCreditsUsed().doubleValue(), row.getRegistryBytes()));
            }
        }
        // Today has no snapshot yet when the job did not run: show the live numbers instead.
        LocalDate today = now.toLocalDate();
        if (!rows.containsKey(today)) {
            long liveStorage = media.sumBytesOnDisk();
            result.add(new DayUsage(today.toString(), liveStorage, 0, null, liveStorage));
        }
        return result;
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
        return new RestoreResult(restored.size(), registry.settings().getRestoreGraceDays());
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

    /**
     * Where the quota comes from. With Cloudinary the plan decides the limit (in bytes or in
     * credits), so the admin cannot type a number of gigabytes that has nothing to do with the real
     * account.
     */
    @Transactional(readOnly = true)
    public QuotaInfo quotaInfo() {
        Optional<CloudinaryUsageService.Usage> cloud = cloudinary.usage();
        if (cloud.isPresent()) {
            return new QuotaInfo("CLOUDINARY", cloud.get().plan(), cloud.get().storageLimitBytes(), false);
        }
        return new QuotaInfo("LOCAL", null, 0, true);
    }

    /**
     * Reads the usage of the provider right now and stores the snapshot of the day, so the admin
     * does not have to wait for the nightly job to see fresh numbers.
     */
    @Transactional
    public Overview refreshUsage(String adminEmail) {
        usageJob.snapshot();
        log(admin(adminEmail), "Refreshed the storage usage from the provider");
        return overview();
    }

    @Transactional
    public Settings updateSettings(String adminEmail, UpdateSettingsRequest r) {
        User admin = admin(adminEmail);
        range("Maximum video size", r.maxVideoMb(), 10, 500);
        range("Maximum image size", r.maxImageMb(), 1, 20);
        range("Video length", r.demoMaxSeconds(), 10, 600);
        range("Storage quota per member", r.memberQuotaMb(), 50, 2000);
        range("Uploads per member per day", r.uploadsPerDay(), 1, 50);
        range("Rejected media retention", r.rejectedRetentionDays(), 7, 90);
        range("Orphaned file grace period", r.orphanGraceHours(), 1, 72);
        range("Trash retention", r.trashRetentionDays(), 0, 30);
        range("Restored file protection", r.restoreGraceDays(), 0, 30);
        range("Total storage quota", r.quotaGb(), 1, 1000);
        range("Warning threshold", r.warningPercent(), 50, 95);
        range("Critical threshold", r.criticalPercent(), 51, 99);
        if (r.criticalPercent() <= r.warningPercent()) {
            throw badRequest("Critical threshold must be higher than the warning threshold");
        }
        StorageSettings s = registry.settings();
        // With Cloudinary the plan decides how much space there is, so the admin cannot set it.
        boolean quotaEditable = quotaInfo().quotaEditable();
        if (quotaEditable) {
            long used = media.sumBytesOnDisk();
            if (r.quotaGb() * GB <= used) {
                throw badRequest("Total storage quota must be higher than current usage (" + mb(used) + ")");
            }
        }
        List<String> videoFormats = formats("video", r.videoFormats(), VIDEO_FORMATS);
        List<String> imageFormats = formats("image", r.imageFormats(), IMAGE_FORMATS);

        s.setMaxVideoMb(r.maxVideoMb());
        s.setMaxImageMb(r.maxImageMb());
        s.setVideoFormats(String.join(",", videoFormats));
        s.setImageFormats(String.join(",", imageFormats));
        s.setDemoMaxSeconds(r.demoMaxSeconds());
        s.setMemberQuotaMb(r.memberQuotaMb());
        s.setUploadsPerDay(r.uploadsPerDay());
        s.setRejectedRetentionDays(r.rejectedRetentionDays());
        s.setOrphanGraceHours(r.orphanGraceHours());
        s.setTrashRetentionDays(r.trashRetentionDays());
        s.setRestoreGraceDays(r.restoreGraceDays());
        s.setAutoCleanupEnabled(r.autoCleanupEnabled());
        if (quotaEditable) {
            s.setQuotaGb(r.quotaGb());
        }
        s.setWarningPercent(r.warningPercent());
        s.setCriticalPercent(r.criticalPercent());
        s.setUpdatedBy(admin);
        s.setUpdatedAt(LocalDateTime.now());
        settingsRepository.save(s);
        log(admin, "Updated upload limits and storage settings");
        return toSettings(s);
    }

    private Settings toSettings(StorageSettings s) {
        long used = cloudinary.usage()
                .map(CloudinaryUsageService.Usage::storageUsedBytes)
                .orElseGet(() -> media.sumBytesOnDisk());
        return new Settings(s.getMaxVideoMb(), s.getMaxImageMb(), s.videoFormatList(), s.imageFormatList(),
                s.getDemoMaxSeconds(), s.getMemberQuotaMb(), s.getUploadsPerDay(),
                s.getRejectedRetentionDays(), s.getOrphanGraceHours(),
                s.getTrashRetentionDays(), s.getRestoreGraceDays(), s.isAutoCleanupEnabled(), s.getQuotaGb(), s.getWarningPercent(),
                s.getCriticalPercent(), used,
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
