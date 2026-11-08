package com.calishealth.models;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * One row per day with the real usage of the Cloudinary account (storage, bandwidth, credits).
 * The daily job writes it; the Storage screen reads it to draw the history.
 */
@Entity
@Table(name = "storage_usage_daily")
@Getter
@Setter
@NoArgsConstructor
public class StorageUsageDaily {
    @Id
    @Column(name = "day", nullable = false)
    private LocalDate day;

    @Column(name = "storage_used", nullable = false)
    private long storageUsed;

    @Column(name = "storage_limit", nullable = false)
    private long storageLimit;

    @Column(name = "bandwidth_used", nullable = false)
    private long bandwidthUsed;

    @Column(name = "bandwidth_limit", nullable = false)
    private long bandwidthLimit;

    @Column(name = "credits_used", nullable = false, precision = 10, scale = 2)
    private BigDecimal creditsUsed = BigDecimal.ZERO;

    @Column(name = "credits_limit", nullable = false, precision = 10, scale = 2)
    private BigDecimal creditsLimit = BigDecimal.ZERO;

    /** sum(size_bytes) of the registry, kept next to the Cloudinary numbers to compare them. */
    @Column(name = "registry_bytes", nullable = false)
    private long registryBytes;

    @Column(name = "plan_name", length = 100)
    private String planName;

    /** WARNING | CRITICAL: the admins were already told in this plan period. */
    @Column(name = "alert_level", length = 20)
    private String alertLevel;

    @Column(name = "synced_at", nullable = false)
    private LocalDateTime syncedAt;
}
