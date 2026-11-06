package com.calishealth.dtos;

import java.time.LocalDateTime;
import java.util.List;

public final class DailyPlanDtos {
    private DailyPlanDtos() {}

    public record DailyPlanDayResponse(
            int dayNumber,
            String workoutCode,
            String workoutName,
            String workoutLevel,
            int exerciseCount,
            boolean workoutActive,
            List<String> workoutTypes,
            List<String> targetMuscles
    ) {}

    public record DailyPlanTemplateResponse(
            Long id,
            String code,
            String name,
            String description,
            String level,
            int daysPerWeek,
            boolean active,
            LocalDateTime updatedAt,
            String createdByName,
            List<DailyPlanDayResponse> days
    ) {}

    public record DailyPlanDayRequest(Integer dayNumber, String workoutCode) {}

    public record DailyPlanTemplateRequest(
            String name,
            String description,
            String level,
            Integer daysPerWeek,
            Boolean active,
            List<DailyPlanDayRequest> days
    ) {}

    public record DailyPlanStatusRequest(boolean active) {}
}
