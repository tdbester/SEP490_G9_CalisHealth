package com.calishealth.dtos;

import com.calishealth.models.ExerciseEntry;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreatePersonalExerciseRequestDTO(
        @NotBlank(message = "Tên bài tập không được để trống")
        @Size(max = 50, message = "Tên bài tập không quá 50 ký tự")
        String title,
        @Size(max = 300, message = "Mô tả không quá 300 ký tự")
        String description,
        @NotNull(message = "Vui lòng chọn cấp độ bài tập")
        ExerciseEntry.EntryLevel level,
        @NotEmpty(message = "Phải có ít nhất 1 bước hướng dẫn")
        List<@NotBlank(message = "Bước hướng dẫn không được để trống") @Size(max = 250) String> guideSteps,
        @NotBlank @Size(max = 120) String targetMuscle,
        @NotNull @Min(1) @Max(20) Integer defaultSets,
        @Min(1) @Max(1000)
        Integer defaultReps,
        @Min(1) @Max(3600)
        Integer defaultDuration,
        Boolean shareWithCommunity,
        Boolean keepCurrentVideo
) {}
