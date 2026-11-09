package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

/** Single row (id = 1) behind the admin "Upload limits" tab. */
@Entity
@Table(name = "storage_settings")
@Getter
@Setter
@NoArgsConstructor
public class StorageSettings {
    public static final int ID = 1;

    @Id
    private Integer id;

    @Column(name = "max_video_mb", nullable = false)
    private int maxVideoMb;

    @Column(name = "max_image_mb", nullable = false)
    private int maxImageMb;

    /** Comma separated, e.g. "MP4,MOV,WEBM". */
    @Column(name = "video_formats", nullable = false, length = 100)
    private String videoFormats;

    @Column(name = "image_formats", nullable = false, length = 100)
    private String imageFormats;

    @Column(name = "demo_max_seconds", nullable = false)
    private int demoMaxSeconds;

    @Column(name = "member_quota_mb", nullable = false)
    private int memberQuotaMb;

    @Column(name = "uploads_per_day", nullable = false)
    private int uploadsPerDay;

    @Column(name = "rejected_retention_days", nullable = false)
    private int rejectedRetentionDays;

    @Column(name = "orphan_grace_hours", nullable = false)
    private int orphanGraceHours;

    @Column(name = "trash_retention_days", nullable = false)
    private int trashRetentionDays;

    @Column(name = "restore_grace_days", nullable = false)
    private int restoreGraceDays;

    @Column(name = "auto_cleanup_enabled", nullable = false)
    private boolean autoCleanupEnabled;

    /**
     * True when the app frees space by itself when the account runs out of room.
     *
     * <p>The plan of this app counts credits, so the account can run out of credits long before it
     * runs out of space. The warning thresholds only tell the admins; the guard acts: the media
     * that is already deleted is purged right away instead of waiting for the retention period.
     */
    @Column(name = "credit_guard_enabled", nullable = false)
    private boolean creditGuardEnabled;

    /**
     * The share of the plan that switches the guard on, in percent.
     *
     * <p>It has to be above the critical threshold of the warnings, or the guard would act before
     * the admins were told.
     */
    @Column(name = "credit_guard_threshold", nullable = false)
    private int creditGuardThreshold;

    @Column(name = "quota_gb", nullable = false)
    private int quotaGb;

    @Column(name = "warning_percent", nullable = false)
    private int warningPercent;

    @Column(name = "critical_percent", nullable = false)
    private int criticalPercent;

    @Column(name = "last_cleanup_at")
    private LocalDateTime lastCleanupAt;

    @Column(name = "last_cleanup_freed_bytes", nullable = false)
    private long lastCleanupFreedBytes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by")
    private User updatedBy;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public List<String> videoFormatList() {
        return split(videoFormats);
    }

    public List<String> imageFormatList() {
        return split(imageFormats);
    }

    private static List<String> split(String csv) {
        return csv == null || csv.isBlank() ? List.of() : Arrays.stream(csv.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }
}
