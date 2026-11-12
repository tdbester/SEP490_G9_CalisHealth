package com.calishealth.dtos;

public record MaintenanceAreaLockResponseDto(
        String area,
        boolean locked,
        String reason,
        Long scheduleId,
        String lockedAt,
        String unlockedAt
) {
}
