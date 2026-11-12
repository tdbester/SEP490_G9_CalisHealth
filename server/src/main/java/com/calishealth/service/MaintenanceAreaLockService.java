package com.calishealth.service;

import com.calishealth.dtos.MaintenanceAreaLockResponseDto;
import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.models.AffectedArea;
import com.calishealth.models.MaintenanceAreaLock;
import com.calishealth.repository.MaintenanceAreaLockRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Manual maintenance locks per service area.
 *
 * <p>The maintenance schedule only notifies users. An admin locks the affected
 * service areas by hand when the maintenance window actually starts, and unlocks
 * them once the work is finished.
 */
@Service
public class MaintenanceAreaLockService {
    private static final DateTimeFormatter TIMESTAMP =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.ENGLISH);

    private final MaintenanceAreaLockRepository locks;

    public MaintenanceAreaLockService(MaintenanceAreaLockRepository locks) {
        this.locks = locks;
    }

    @Transactional(readOnly = true)
    public boolean isAreaLocked(String area) {
        return locks.findByArea(area)
                .map(MaintenanceAreaLock::isLocked)
                .orElse(false);
    }

    @Transactional(readOnly = true)
    public Map<String, Boolean> getLockStatusByArea() {
        Map<String, Boolean> status = new LinkedHashMap<>();
        for (AffectedArea area : AffectedArea.values()) {
            status.put(area.name(), isAreaLocked(area.name()));
        }
        return status;
    }

    @Transactional(readOnly = true)
    public List<MaintenanceAreaLockResponseDto> getLocks() {
        return locks.findAllByOrderByAreaAsc().stream()
                .map(MaintenanceAreaLockService::toResponse)
                .toList();
    }

    /**
     * Locks or unlocks a single area by hand.
     */
    @Transactional
    public MaintenanceAreaLockResponseDto setLock(
            String requestedArea,
            String requestedState,
            String reason
    ) {
        AffectedArea area = parseArea(requestedArea);
        boolean shouldLock = parseLocked(requestedState);

        MaintenanceAreaLock lock = locks.findByArea(area.name())
                .orElseGet(() -> {
                    MaintenanceAreaLock created = new MaintenanceAreaLock();
                    created.setArea(area.name());
                    return created;
                });

        if (shouldLock) {
            lock.setLocked(true);
            lock.setReason(normalizeReason(reason));
            lock.setLockedAt(LocalDateTime.now());
            lock.setUnlockedAt(null);
        } else {
            lock.setLocked(false);
            lock.setUnlockedAt(LocalDateTime.now());
        }
        return toResponse(locks.save(lock));
    }

    /**
     * Locks every area of a schedule at once, used when the admin starts the work.
     */
    @Transactional
    public void lockScheduleAreas(Long scheduleId, List<String> areas) {
        for (String area : areas) {
            AffectedArea parsed = parseArea(area);
            MaintenanceAreaLock lock = locks.findByArea(parsed.name())
                    .orElseGet(() -> {
                        MaintenanceAreaLock created = new MaintenanceAreaLock();
                        created.setArea(parsed.name());
                        return created;
                    });
            lock.setLocked(true);
            lock.setScheduleId(scheduleId);
            lock.setLockedAt(LocalDateTime.now());
            lock.setUnlockedAt(null);
            locks.save(lock);
        }
    }

    /**
     * Releases every area of a schedule, used when the admin finishes the work.
     */
    @Transactional
    public void unlockScheduleAreas(List<String> areas) {
        for (String area : areas) {
            AffectedArea parsed = parseArea(area);
            locks.findByArea(parsed.name()).ifPresent(lock -> {
                lock.setLocked(false);
                lock.setUnlockedAt(LocalDateTime.now());
                locks.save(lock);
            });
        }
    }

    private static AffectedArea parseArea(String requestedArea) {
        if (requestedArea == null || requestedArea.isBlank()) {
            throw new IllegalArgumentException("Affected area is required");
        }
        String value = requestedArea.trim().toUpperCase(Locale.ROOT);
        for (AffectedArea area : AffectedArea.values()) {
            if (area.name().equals(value)) {
                return area;
            }
        }
        throw new IllegalArgumentException("Unsupported affected area: " + requestedArea);
    }

    private static boolean parseLocked(String requestedState) {
        if (requestedState == null || requestedState.isBlank()) {
            throw new IllegalArgumentException("Lock state is required");
        }
        String value = requestedState.trim().toUpperCase(Locale.ROOT);
        return switch (value) {
            case "LOCKED", "TRUE", "ON", "1" -> true;
            case "UNLOCKED", "FALSE", "OFF", "0" -> false;
            default -> throw new IllegalArgumentException("Unsupported lock state: " + requestedState);
        };
    }

    private static String normalizeReason(String reason) {
        if (reason == null || reason.isBlank()) {
            return null;
        }
        return reason.trim();
    }

    private static MaintenanceAreaLockResponseDto toResponse(MaintenanceAreaLock lock) {
        return new MaintenanceAreaLockResponseDto(
                lock.getArea(),
                lock.isLocked(),
                lock.getReason(),
                lock.getScheduleId(),
                lock.getLockedAt() == null ? null : lock.getLockedAt().format(TIMESTAMP),
                lock.getUnlockedAt() == null ? null : lock.getUnlockedAt().format(TIMESTAMP)
        );
    }

    static ResourceNotFoundException lockNotFound(String area) {
        return new ResourceNotFoundException("Maintenance lock not found: " + area);
    }
}
