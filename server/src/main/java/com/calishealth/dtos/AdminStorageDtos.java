package com.calishealth.dtos;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Admin > Media storage & infrastructure. Shapes match client/src/api/adminStorage.js. */
public class AdminStorageDtos {

    // ---- Capacity tab ----

    /** key = DEMO_VIDEO | FORM_CHECK_VIDEO | ANATOMY_IMAGE (byCategory) or SYSTEM | MEMBER (bySource). */
    public record Usage(String key, long bytes, long files) {}

    /** month = "2026-10"; usedBytes = storage used at the end of that month (or now for the current one). */
    public record MonthUsage(String month, long usedBytes) {}

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

    public record Overview(
            long quotaBytes,
            long usedBytes,
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
            int formCheckMaxSeconds,
            int demoMaxSeconds,
            int memberQuotaMb,
            int uploadsPerDay,
            int formCheckRetentionDays,
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

    /** Ranges are checked in AdminStorageService (same ranges as the form). */
    public record UpdateSettingsRequest(
            @NotNull Integer maxVideoMb,
            @NotNull Integer maxImageMb,
            @NotNull List<String> videoFormats,
            @NotNull List<String> imageFormats,
            @NotNull Integer formCheckMaxSeconds,
            @NotNull Integer demoMaxSeconds,
            @NotNull Integer memberQuotaMb,
            @NotNull Integer uploadsPerDay,
            @NotNull Integer formCheckRetentionDays,
            @NotNull Integer rejectedRetentionDays,
            @NotNull Integer orphanGraceHours,
            @NotNull Integer trashRetentionDays,
            @NotNull Integer restoreGraceDays,
            @NotNull Boolean autoCleanupEnabled,
            @NotNull Integer quotaGb,
            @NotNull Integer warningPercent,
            @NotNull Integer criticalPercent) {}
}
