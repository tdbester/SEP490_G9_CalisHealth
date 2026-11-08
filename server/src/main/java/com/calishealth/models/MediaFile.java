package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** One uploaded file. Rows with a category are managed by Admin > Media storage (see V64 for the lifecycle). */
@Entity
@Table(name = "media_files")
@Getter
@Setter
@NoArgsConstructor
public class MediaFile {
    public static final String ACTIVE = "ACTIVE";
    public static final String ORPHANED = "ORPHANED";
    public static final String REJECTED = "REJECTED";
    public static final String TRASHED = "TRASHED";
    public static final String PURGED = "PURGED";

    public static final String DEMO_VIDEO = "DEMO_VIDEO";
    public static final String FORM_CHECK_VIDEO = "FORM_CHECK_VIDEO";
    public static final String ANATOMY_IMAGE = "ANATOMY_IMAGE";

    public static final String SOURCE_SYSTEM = "SYSTEM";
    public static final String SOURCE_MEMBER = "MEMBER";

    public static final String TYPE_VIDEO = "VIDEO";
    public static final String TYPE_IMAGE = "IMAGE";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "file_url", nullable = false, length = 1000)
    private String fileUrl;

    @Column(name = "original_name")
    private String originalName;

    @Column(name = "file_type", length = 50)
    private String fileType;

    @Column(length = 50)
    private String format;

    @Column(name = "size_mb", precision = 10, scale = 2)
    private BigDecimal sizeMb;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Column(length = 100)
    private String purpose;

    @Column(length = 30)
    private String category;

    @Column(length = 20)
    private String source;

    @Column(name = "content_hash", length = 64)
    private String contentHash;

    @Column(length = 50)
    private String status;

    @Column(name = "previous_status", length = 20)
    private String previousStatus;

    @Column(length = 255)
    private String reason;

    @Column(name = "uploaded_at")
    private LocalDateTime uploadedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by")
    private User uploadedBy;

    @Column(name = "inactive_since")
    private LocalDateTime inactiveSince;

    @Column(name = "deletable_at")
    private LocalDateTime deletableAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Column(name = "trashed_at")
    private LocalDateTime trashedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trashed_by")
    private User trashedBy;

    @Column(name = "purge_at")
    private LocalDateTime purgeAt;

    @Column(name = "purged_at")
    private LocalDateTime purgedAt;
}
