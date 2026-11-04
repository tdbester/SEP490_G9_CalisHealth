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

    @Column(name = "form_check_max_seconds", nullable = false)
    private int formCheckMaxSeconds;

    @Column(name = "demo_max_seconds", nullable = false)
    private int demoMaxSeconds;

    @Column(name = "member_quota_mb", nullable = false)
    private int memberQuotaMb;

    @Column(name = "uploads_per_day", nullable = false)
    private int uploadsPerDay;

    @Column(name = "form_check_retention_days", nullable = false)
    private int formCheckRetentionDays;

    @Column(name = "rejected_retention_days", nullable = false)
    private int rejectedRetentionDays;

    @Column(name = "orphan_grace_hours", nullable = false)
    private int orphanGraceHours;

    @Column(name = "trash_retention_days", nullable = false)
    private int trashRetentionDays;

    @Column(name = "auto_cleanup_enabled", nullable = false)
    private boolean autoCleanupEnabled;

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
