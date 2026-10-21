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
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "scan_type", length = 60)
    private String scanType;

    @Column(length = 40)
    private String status;

    @Column(precision = 7, scale = 3)
    private BigDecimal score;

    @Column(name = "flagged_terms", columnDefinition = "TEXT")
    private String flaggedTerms;

    @Column(columnDefinition = "TEXT")
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
