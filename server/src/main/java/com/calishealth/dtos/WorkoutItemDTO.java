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
        @Min(value = 0, message = "Thời gian nghỉ không được nhỏ hơn 0")
        @Max(value = 600, message = "Thời gian nghỉ không quá 600 giây")
        int restSeconds
) {}
