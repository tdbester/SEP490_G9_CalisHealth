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
        @NotBlank @Size(max = 50) String title,
        @NotBlank @Size(max = 300) String description,
        @NotNull ExerciseEntry.EntryLevel level,
        @NotEmpty List<@NotBlank @Size(max = 250) String> guideSteps,
        @NotBlank @Size(max = 120) String targetMuscle,
        @NotNull @Min(1) @Max(20) Integer defaultSets,
        @Min(1) @Max(1000)
        Integer defaultReps,
        @Min(1) @Max(3600)
        Integer defaultDuration,
        Boolean shareWithCommunity,
        Boolean keepCurrentVideo
) {}
