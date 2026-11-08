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
        LocalDateTime createdAt,
        /** Set when an admin started the maintenance work by hand. */
        LocalDateTime startedAt,
        /** Set when an admin marked the maintenance work as finished. */
        LocalDateTime completedAt,
        /**
         * True from 30 minutes before the window starts until the window ends.
         * The card turns red so the admin knows the maintenance is due.
         */
        boolean dueForExecution,
        /** True when the affected areas are currently locked by an admin. */
        boolean locked
) {
}
