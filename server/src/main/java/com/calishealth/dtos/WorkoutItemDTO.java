package com.calishealth.dtos;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record WorkoutItemDTO(
        @NotNull @Positive Long exerciseId,
        @Min(0) int orderIndex,
        @Min(value = 1, message = "Số hiệp tối thiểu là 1")
        @Max(value = 100, message = "Số hiệp tối đa là 100")
        int sets,
        @Min(value = 1, message = "Số lần lặp tối thiểu là 1") Integer reps,
        @Min(value = 1, message = "Thời lượng tối thiểu là 1 giây") Integer duration,
        String countBy,
        @Min(value = 10, message = "Thời gian nghỉ tối thiểu là 10 giây")
        @Max(value = 120, message = "Thời gian nghỉ tối đa là 120 giây")
        int restSeconds
) {}
