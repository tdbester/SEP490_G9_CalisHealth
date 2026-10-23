package com.calishealth.dtos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateUpdateWorkoutRequestDTO(
        @NotBlank @Size(max = 60) String title,
        @Size(max = 200) String description,
        Boolean isSharedWithCommunity,
        @NotEmpty List<@Valid WorkoutItemDTO> items
) {}
