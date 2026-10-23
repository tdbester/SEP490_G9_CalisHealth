package com.calishealth.dtos;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record WorkoutItemDTO(
        @NotNull Long exerciseId,
        @Min(0) int orderIndex,
        @Min(1) int sets,
        @Min(1) Integer reps,
        @Min(1) Integer duration,
        String countBy,
        @Min(0) int restSeconds
) {}
