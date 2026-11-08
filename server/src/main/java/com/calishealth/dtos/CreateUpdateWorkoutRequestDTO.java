package com.calishealth.dtos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateUpdateWorkoutRequestDTO(
        @NotBlank(message = "Workout title is required")
        @Size(max = 60, message = "Workout title must not exceed 60 characters")
        String title,
        @Size(max = 200, message = "Description must not exceed 200 characters")
        String description,
        /**
         * Tên level lấy động từ bảng fitness_levels (Content Manager tạo/đổi tên level trong
         * Level & Benchmark Criteria), nên không validate bằng danh sách cố định.
         */
        @NotBlank(message = "Please select a workout level")
        String level,
        @Pattern(regexp = "(?i)HEALTH|SKILL|FLEX", message = "Please select a valid workout type")
        String type,
        Boolean isSharedWithCommunity,
        @NotEmpty(message = "A workout must contain at least one exercise")
        List<@NotNull(message = "Workout exercises cannot be null") @Valid WorkoutItemDTO> items
) {}
