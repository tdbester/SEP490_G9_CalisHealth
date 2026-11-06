package com.calishealth.dtos;

import java.time.LocalDateTime;
import java.util.Set;

public record MaintenanceScheduleResponseDto(
        Long id,
        String title,
        String message,
        LocalDateTime startsAt,
        LocalDateTime endsAt,
        Set<String> affectedAreas,
        boolean notifyMembers,
        boolean notificationSent,
        int reminderHours,
        Long notificationId,
        String status,
        LocalDateTime createdAt
) {
}
