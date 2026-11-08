package com.calishealth.service;

import com.calishealth.models.Notification;
import com.calishealth.models.StorageSettings;
import com.calishealth.models.StorageUsageDaily;
import com.calishealth.repository.MediaFileRepository;
import com.calishealth.repository.NotificationRepository;
import com.calishealth.repository.StorageUsageDailyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;

/**
 * Writes the real usage of the Cloudinary account into {@code storage_usage_daily} once a day and
 * warns the admins when the account crosses the warning or the critical threshold.
 * <p>
 * The Storage screen shows the numbers of the provider, not the sum of the registry: only the
 * provider knows how much space the account really uses and how many credits are left.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StorageUsageJob {
    private static final String WARNING = "WARNING";
    private static final String CRITICAL = "CRITICAL";
    /** The chart of the Storage screen shows this many days. */
    private static final int CHART_DAYS = 30;

    private final CloudinaryUsageService cloudinary;
    private final StorageUsageDailyRepository usageDaily;
    private final MediaFileRepository media;
    private final MediaRegistryService registry;
    private final NotificationRepository notifications;

    /** The plan period resets on this day of the month, so the counters are cleared with it. */
    @Value("${app.cloudinary.usage-reset-day:1}")
    private int usageResetDay;

    @Scheduled(cron = "${app.storage.usage-cron:0 15 3 * * *}")
    @Transactional
    public void snapshot() {
        Optional<CloudinaryUsageService.Usage> usage = cloudinary.usage();
        if (usage.isEmpty()) {
            log.debug("No Cloudinary account configured: the daily usage snapshot is skipped");
            return;
        }
        CloudinaryUsageService.Usage value = usage.get();
        LocalDate today = LocalDate.now();
        StorageUsageDaily row = usageDaily.findById(today).orElseGet(StorageUsageDaily::new);
        row.setDay(today);
        row.setStorageUsed(value.storageUsedBytes());
        row.setStorageLimit(value.storageLimitBytes());
        row.setBandwidthUsed(value.bandwidthUsedBytes());
        row.setBandwidthLimit(value.bandwidthLimitBytes());
        row.setCreditsUsed(value.creditsUsed() == null ? BigDecimal.ZERO : value.creditsUsed());
        row.setCreditsLimit(value.creditsLimit() == null ? BigDecimal.ZERO : value.creditsLimit());
        row.setRegistryBytes(media.sumBytesOnDisk());
        row.setPlanName(value.plan());
        row.setSyncedAt(LocalDateTime.now());
        usageDaily.save(row);

        backfillHistory(value);
        checkThreshold(value, row);
        log.info("Storage usage snapshot: {} bytes stored, {} bytes delivered, {} credits used",
                value.storageUsedBytes(), value.bandwidthUsedBytes(), value.creditsUsed());
    }

    /**
     * Fills the days that have no snapshot yet with the size the registry had on that day.
     * <p>
     * The provider only knows the usage of right now, so the past cannot be read from it. The
     * registry does know how many bytes were stored on each day, which is enough to draw the curve
     * of the media of this app. The days the provider already reported keep the real numbers.
     */
    private void backfillHistory(CloudinaryUsageService.Usage value) {
        LocalDate today = LocalDate.now();
        LocalDate oldest = today.minusDays(CHART_DAYS - 1);
        List<StorageUsageDaily> known = usageDaily.findByDayGreaterThanEqualOrderByDayAsc(oldest);
        LocalDate cursor = oldest;
        for (StorageUsageDaily day : known) {
            while (cursor.isBefore(day.getDay())) {
                saveBackfilledDay(cursor, value);
                cursor = cursor.plusDays(1);
            }
            cursor = day.getDay().plusDays(1);
        }
        while (cursor.isBefore(today)) {
            saveBackfilledDay(cursor, value);
            cursor = cursor.plusDays(1);
        }
    }

    /**
     * Writes one day of history: the size the registry had that day, with the limits of the plan.
     * <p>
     * The account size is not known for the past, so it is left at the size of the app: the chart
     * shows the two curves separately and the account line starts at the first real snapshot.
     */
    private void saveBackfilledDay(LocalDate day, CloudinaryUsageService.Usage value) {
        LocalDateTime endOfDay = day.atTime(java.time.LocalTime.MAX);
        long appBytes = media.sumBytesOnDiskAt(endOfDay);
        StorageUsageDaily row = new StorageUsageDaily();
        row.setDay(day);
        row.setStorageUsed(appBytes);
        row.setStorageLimit(value.storageLimitBytes());
        row.setBandwidthUsed(0);
        row.setBandwidthLimit(value.bandwidthLimitBytes());
        row.setCreditsUsed(BigDecimal.ZERO);
        row.setCreditsLimit(value.creditsLimit() == null ? BigDecimal.ZERO : value.creditsLimit());
        row.setRegistryBytes(appBytes);
        row.setPlanName(value.plan());
        row.setSyncedAt(LocalDateTime.now());
        usageDaily.save(row);
    }

    /**
     * Warns the admins when the account crosses a threshold. The warning is sent once per level
     * and plan period: the counters reset when the period restarts, and the rows remember which
     * level the admins were already told about. A critical alert is still sent when only a warning
     * was sent before.
     */
    private void checkThreshold(CloudinaryUsageService.Usage usage, StorageUsageDaily today) {
        double percent = usage.planPercent();
        if (percent <= 0) return;
        StorageSettings settings = registry.settings();
        String level = percent >= settings.getCriticalPercent() ? CRITICAL
                : percent >= settings.getWarningPercent() ? WARNING
                : null;
        if (level == null) {
            // The account is healthy again: the next period may warn a new time.
            if (today.getAlertLevel() != null) {
                today.setAlertLevel(null);
                usageDaily.save(today);
            }
            return;
        }

        LocalDate periodStart = periodStart();
        String notified = usageDaily.findByDayGreaterThanEqualOrderByDayAsc(periodStart).stream()
                .map(StorageUsageDaily::getAlertLevel)
                .filter(Objects::nonNull)
                .max(String::compareTo)
                .orElse(null);
        // A level that was already reported is not reported twice; a critical alert is also new.
        if (CRITICAL.equals(notified) || level.equals(notified)) return;

        Notification notification = new Notification();
        notification.setTargetAudience("ADMIN");
        notification.setTitle("Storage usage " + level.toLowerCase(Locale.ROOT) + ": "
                + Math.round(percent) + "% of the plan limit");
        notification.setMessage("The media storage of the system uses " + Math.round(percent)
                + "% of the plan. Free up space in Admin > Storage or raise the plan limit.");
        notification.setType("UPDATE");
        notification.setStatus("PUBLISHED");
        notifications.save(notification);

        today.setAlertLevel(level);
        usageDaily.save(today);
    }

    /**
     * The first day of the current plan period. Cloudinary resets its counters on the first day of
     * the month by default, so a crossed threshold is reported again in the next period.
     */
    private LocalDate periodStart() {
        LocalDate today = LocalDate.now();
        int reset = Math.max(1, Math.min(28, usageResetDay));
        LocalDate start = today.withDayOfMonth(reset);
        return today.isBefore(start) ? start.minusMonths(1) : start;
    }
}
