package com.calishealth.dtos;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Admin > Storage. Shapes match client/src/api/adminStorage.js. */
public class AdminStorageDtos {

    // ---- Capacity tab ----

    /** key = DEMO_VIDEO | ANATOMY_IMAGE (byCategory) or SYSTEM | MEMBER (bySource). */
    public record Usage(String key, long bytes, long files) {}

    /** month = "2026-10"; usedBytes = storage used at the end of that month (or now for the current one). */
    public record MonthUsage(String month, long usedBytes) {}

    /**
     * day = "2026-11-09"; a snapshot of the real Cloudinary usage of that day.
     *
     * @param usedBytes     bytes the account used that day (the provider knows only the current value,
     *                      so the days before the first snapshot carry the size of the app registry)
     * @param bandwidthBytes bytes the CDN delivered that day
     * @param creditsUsed   credits spent that day
     * @param appBytes      bytes of the media this app manages, to tell the two apart
     */
    public record DayUsage(String day, long usedBytes, long bandwidthBytes, Double creditsUsed, long appBytes) {}

    public record TopMember(Long userId, String email, long bytes, long files) {}

    public record AutoCleanup(
            boolean enabled,
            String runAt,
            LocalDateTime lastRunAt,
            long lastFreedBytes,
            long nextExpiringBytes,
            long trashFiles,
            long trashBytes,
            int trashRetentionDays,
            /** ORPHANED + REJECTED files an admin can move to the trash right away. */
            long inactiveFiles,
            long inactiveBytes) {}

    /**
     * Where the media really lives.
     *
     * @param provider        CLOUDINARY (the media is on the CDN) or LOCAL (the local disk)
     * @param plan            name of the Cloudinary plan, when there is one
     * @param cdnReachable    whether the Cloudinary Admin API answered
     * @param quotaBytes      the real limit of the account; 0 when the plan does not limit storage
     * @param quotaLimited    true when the plan really caps the storage (a false value means the plan
     *                         counts credits instead, so the admin setting is used for the display)
     * @param usedBytes       bytes really used, taken from the provider (not from the registry)
     * @param registryBytes   sum of the files this app manages, shown next to the real usage
     * @param bandwidthUsedBytes bytes delivered through the CDN in the current plan period
     * @param bandwidthLimitBytes bytes the plan allows per period (0 = unlimited)
     * @param creditsUsed     credits spent in the current plan period
     * @param creditsLimit    credits the plan gives per period (0 = not metered)
     * @param creditsUsedPercent share of the credits that is used
     * @param daily           the last 30 days, for the usage chart
     */
    public record Overview(
            String provider,
            String plan,
            boolean cdnReachable,
            long quotaBytes,
            boolean quotaLimited,
            long usedBytes,
            long registryBytes,
            long bandwidthUsedBytes,
            long bandwidthLimitBytes,
            Double creditsUsed,
            Double creditsLimit,
            double creditsUsedPercent,
            int warningPercent,
            int criticalPercent,
            long fileCount,
            long videoCount,
            long imageCount,
            long growthPerMonthBytes,
            LocalDate estimatedFullDate,
            long memberQuotaBytes,
            List<Usage> byCategory,
            List<Usage> bySource,
            List<MonthUsage> history,
            List<DayUsage> daily,
            List<TopMember> topMembers,
            AutoCleanup autoCleanup) {}

    // ---- Cleanup tab ----

    /** previousStatus / trashedAt / trashedBy / purgeAt are only set for files in the trash. */
    public record MediaItem(
            Long id,
            String fileName,
            String fileType,
            String status,
            String previousStatus,
            String reason,
            String source,
            String sourceLabel,
            LocalDateTime uploadedAt,
            LocalDateTime inactiveSince,
            LocalDateTime deletableAt,
            LocalDateTime trashedAt,
            String trashedBy,
            LocalDateTime purgeAt,
            long sizeBytes,
            String url) {}

    /** Whole-registry numbers for the stat tiles (ignore the current filters). total = inactive files. */
    public record MediaSummary(
            long total,
            long orphanedFiles,
            long orphanedBytes,
            long rejectedFiles,
            long rejectedBytes,
            long reclaimableFiles,
            long reclaimableBytes,
            long trashFiles,
            long trashBytes,
            long purgeSoonBytes,
            int trashRetentionDays) {}

    public record MediaPage(
            List<MediaItem> items,
            int page,
            int size,
            long totalElements,
            int totalPages,
            MediaSummary summary) {}

    public record IdsRequest(@NotEmpty List<Long> ids) {}

    public record ExtendRequest(@NotNull @Min(1) @Max(90) Integer days) {}

    /** purged / freedBytes are non-zero only when the trash period is 0 (delete immediately). */
    public record TrashResult(int trashed, int purged, long freedBytes, int skipped, LocalDateTime purgeAt) {}

    public record RestoreResult(int restored, int graceDays) {}

    public record DeleteResult(int deleted, long freedBytes, int skipped) {}

    // ---- Upload limits tab ----

    public record Settings(
            int maxVideoMb,
            int maxImageMb,
            List<String> videoFormats,
            List<String> imageFormats,
            int demoMaxSeconds,
            int memberQuotaMb,
            int uploadsPerDay,
            int rejectedRetentionDays,
            int orphanGraceHours,
            int trashRetentionDays,
            int restoreGraceDays,
            boolean autoCleanupEnabled,
            int quotaGb,
            int warningPercent,
            int criticalPercent,
            long usedBytes,
            String updatedBy,
            LocalDateTime updatedAt) {}

    /**
     * Where the quota of the system comes from.
     *
     * @param provider       CLOUDINARY or LOCAL
     * @param plan           name of the Cloudinary plan
     * @param planLimitBytes the real limit of the account; 0 when the plan does not limit storage
     * @param quotaEditable  false when the plan decides the limit, so the admin cannot change it
     */
    public record QuotaInfo(String provider, String plan, long planLimitBytes, boolean quotaEditable) {}

    /** Ranges are checked in AdminStorageService (same ranges as the form). */
    public record UpdateSettingsRequest(
            @NotNull Integer maxVideoMb,
            @NotNull Integer maxImageMb,
            @NotNull List<String> videoFormats,
            @NotNull List<String> imageFormats,
            @NotNull Integer demoMaxSeconds,
            @NotNull Integer memberQuotaMb,
            @NotNull Integer uploadsPerDay,
            @NotNull Integer rejectedRetentionDays,
            @NotNull Integer orphanGraceHours,
            @NotNull Integer trashRetentionDays,
            @NotNull Integer restoreGraceDays,
            @NotNull Boolean autoCleanupEnabled,
            @NotNull Integer quotaGb,
            @NotNull Integer warningPercent,
            @NotNull Integer criticalPercent) {}
}
