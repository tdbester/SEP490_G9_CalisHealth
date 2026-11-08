package com.calishealth.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.api.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

/**
 * Reads the real, billable usage of the Cloudinary account: storage, bandwidth and credits.
 * <p>
 * The registry in {@code media_files} only knows the files this app manages, so it cannot answer
 * "how much space does the account use" or "how many credits are left". Cloudinary's Admin API
 * answers both, and the Storage screen shows those numbers instead of a quota it made up itself.
 * <p>
 * Results are cached for a few minutes: Cloudinary rate-limits the Admin API, and the screen
 * polls it on every visit.
 */
@Slf4j
@Service
public class CloudinaryUsageService {
    /** The Admin API is rate-limited, so the numbers are reused for a short while. */
    private static final Duration CACHE_TTL = Duration.ofMinutes(5);

    /**
     * @param storageUsedBytes    bytes stored in the account (all of them, also the files this app does not know)
     * @param storageLimitBytes   bytes the plan allows; 0 when the plan does not limit storage
     * @param bandwidthUsedBytes  bytes delivered through the CDN since the plan period started
     * @param bandwidthLimitBytes bytes the plan allows per period; 0 when unlimited
     * @param creditsUsed         credits spent in the current period
     * @param creditsLimit        credits the plan gives per period
     * @param creditsUsedPercent  share of the credits that is used; 0 when the plan does not meter them
     */
    public record Usage(
            String plan,
            long storageUsedBytes,
            long storageLimitBytes,
            long bandwidthUsedBytes,
            long bandwidthLimitBytes,
            BigDecimal creditsUsed,
            BigDecimal creditsLimit,
            double creditsUsedPercent,
            LocalDateTime lastUpdated) {

        /** Share of the plan limit that is used; 0 when the plan does not limit it. */
        public double percentOf(long used, long limit) {
            return limit > 0 ? Math.min(100, (used * 100.0) / limit) : 0;
        }

        public double storagePercent() {
            return percentOf(storageUsedBytes, storageLimitBytes);
        }

        public double bandwidthPercent() {
            return percentOf(bandwidthUsedBytes, bandwidthLimitBytes);
        }

        /**
         * The share of the plan that is used, for the alert of the admins.
         * <p>
         * Plans that limit the space use the storage limit; the free plan has no such limit and is
         * bound by its credits instead, so the credits decide there.
         */
        public double planPercent() {
            if (storageLimitBytes > 0) return storagePercent();
            if (creditsUsedPercent > 0) return creditsUsedPercent;
            return bandwidthPercent();
        }

        /** Credits left in the current period; empty when the plan does not meter credits. */
        public Optional<BigDecimal> creditsLeft() {
            if (creditsLimit == null || creditsLimit.signum() <= 0 || creditsUsed == null) return Optional.empty();
            return Optional.of(creditsLimit.subtract(creditsUsed).max(BigDecimal.ZERO));
        }
    }

    private final Cloudinary cloudinary;
    private final boolean enabled;

    private volatile Usage cached;
    private volatile LocalDateTime cachedAt;
    private volatile String lastError;

    public CloudinaryUsageService(
            Cloudinary cloudinary,
            @Value("${app.cloudinary.cloud-name:}") String cloudName) {
        this.cloudinary = cloudinary;
        this.enabled = cloudName != null && !cloudName.isBlank();
    }

    /** True when a Cloudinary account is configured; the local disk is used otherwise. */
    public boolean isEnabled() {
        return enabled;
    }

    /** The last error of the Admin API, so the screen can say why the numbers are missing. */
    public String lastError() {
        return lastError;
    }

    /**
     * The current usage of the account. Empty when Cloudinary is off or unreachable: the caller
     * then falls back to the registry numbers instead of showing zeros.
     */
    public Optional<Usage> usage() {
        if (!enabled) return Optional.empty();
        Usage local = cached;
        if (local != null && cachedAt != null && cachedAt.plus(CACHE_TTL).isAfter(LocalDateTime.now())) {
            return Optional.of(local);
        }
        try {
            ApiResponse response = cloudinary.api().usage(Map.of());
            Usage fresh = parse(response);
            cached = fresh;
            cachedAt = LocalDateTime.now();
            lastError = null;
            return Optional.of(fresh);
        } catch (Exception exception) {
            log.warn("Could not read the Cloudinary usage", exception);
            lastError = exception.getMessage();
            // A failed call must not erase numbers that were read successfully before.
            return cached == null ? Optional.empty() : Optional.of(cached);
        }
    }

    /** True when the Admin API answers; used for the "CDN connected" indicator. */
    public boolean isReachable() {
        if (!enabled) return false;
        try {
            ApiResponse response = cloudinary.api().ping(Map.of());
            Object status = response.get("status");
            return status == null || "ok".equalsIgnoreCase(status.toString());
        } catch (Exception exception) {
            log.warn("Could not reach Cloudinary", exception);
            lastError = exception.getMessage();
            return false;
        }
    }

    @SuppressWarnings("unchecked")
    private Usage parse(ApiResponse response) {
        Map<String, Object> body = response;
        Map<String, Object> storage = section(body, "storage");
        Map<String, Object> bandwidth = section(body, "bandwidth");
        Map<String, Object> credits = section(body, "credits");

        BigDecimal creditsLimit = decimal(credits.get("limit"));
        BigDecimal creditsUsed = decimal(credits.get("usage"));
        double creditsUsedPercent = decimal(credits.get("used_percent")) == null
                ? 0
                : decimal(credits.get("used_percent")).doubleValue();

        return new Usage(
                text(body.get("plan")),
                number(storage.get("usage")),
                number(storage.get("limit")),
                number(bandwidth.get("usage")),
                number(bandwidth.get("limit")),
                creditsUsed == null ? null : creditsUsed.setScale(2, RoundingMode.HALF_UP),
                creditsLimit == null ? null : creditsLimit.setScale(2, RoundingMode.HALF_UP),
                creditsUsedPercent,
                LocalDateTime.now());
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> section(Map<String, Object> body, String key) {
        Object value = body.get(key);
        return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
    }

    private static String text(Object value) {
        return value == null ? null : value.toString();
    }

    private static long number(Object value) {
        return value instanceof Number n ? n.longValue() : 0;
    }

    private static BigDecimal decimal(Object value) {
        return value instanceof Number n ? BigDecimal.valueOf(n.doubleValue()) : null;
    }
}
