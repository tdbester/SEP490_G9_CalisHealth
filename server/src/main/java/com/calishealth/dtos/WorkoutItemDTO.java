package com.calishealth.dtos;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record WorkoutItemDTO(
        @NotNull @Positive Long exerciseId,
        @Min(0) int orderIndex,
        @Min(value = 1, message = "Sets must be at least 1")
        @Max(value = 100, message = "Sets must not exceed 100")
        int sets,
        @Min(value = 1, message = "Reps must be at least 1") Integer reps,
        @Min(value = 1, message = "Duration must be at least 1 second") Integer duration,
        String countBy,
        @Min(value = 10, message = "Rest time must be at least 10 seconds")
        @Max(value = 180, message = "Rest time must not exceed 180 seconds")
        int restSeconds
) {}
