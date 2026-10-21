package com.calishealth.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "content_scans")
@Getter
@Setter
@NoArgsConstructor
public class ContentScan {
    public enum ScanType { PROFANITY_TEXT, MEDIAPIPE_POSE }
    public enum Status { PENDING, PASSED, FLAGGED, FAILED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "scan_type", nullable = false)
    private ScanType scanType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.PENDING;

    @Column(precision = 5, scale = 2)
    private BigDecimal score;

    @Column(name = "flagged_terms", columnDefinition = "TEXT")
    private String flaggedTerms;

    @Column(columnDefinition = "json")
    private String details;

    @Column(name = "scanned_at", nullable = false)
    private LocalDateTime scannedAt;

    @Column(name = "content_review_id", nullable = false)
    private Long contentReviewId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "media_file_id")
    private MediaFile mediaFile;

    @PrePersist
    void setScannedAtIfMissing() {
        if (scannedAt == null) {
            scannedAt = LocalDateTime.now();
        }
    }
}