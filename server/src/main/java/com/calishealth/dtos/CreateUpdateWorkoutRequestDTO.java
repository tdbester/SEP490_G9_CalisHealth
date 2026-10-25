package com.calishealth.dtos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateUpdateWorkoutRequestDTO(
        @NotBlank(message = "Tên giáo trình không được để trống")
        @Size(max = 60, message = "Tên giáo trình không quá 60 ký tự")
        String title,
        @Size(max = 200, message = "Ghi chú không quá 200 ký tự")
        String description,
        Boolean isSharedWithCommunity,
        @NotEmpty(message = "Giáo trình phải chứa ít nhất 1 bài tập")
        List<@NotNull(message = "Bài tập trong giáo trình không được để trống") @Valid WorkoutItemDTO> items
) {}
