package com.calishealth.dtos;

import com.calishealth.models.AffectedArea;
import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.Set;

public record CreateMaintenanceScheduleRequestDto(
        @NotBlank(message = "Title is required")
        @Size(max = 255, message = "Title must not exceed 255 characters")
        String title,

        @Size(max = 2000, message = "Message must not exceed 2000 characters")
        String message,

        @NotNull(message = "Start time is required")
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        LocalDateTime startsAt,

        @NotNull(message = "End time is required")
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        LocalDateTime endsAt,

        @NotEmpty(message = "Select at least one affected area")
        Set<AffectedArea> affectedAreas,

        @NotNull(message = "Notify members selection is required")
        Boolean notifyMembers,

        @NotNull(message = "Reminder selection is required")
        @Min(value = 1, message = "Reminder must be at least one hour")
        Integer reminderHours
) {
}
