package com.calishealth.dtos;

import jakarta.validation.constraints.Size;

import java.util.List;

public record ContentTextCheckRequestDTO(
        @Size(max = 50) String title,
        @Size(max = 300) String description,
        List<@Size(max = 250) String> guideSteps,
        @Size(max = 120) String targetMuscle
) {}
