package com.calishealth.dtos;

import java.time.LocalDateTime;
import java.util.List;

public record PersonalExerciseResponseDTO(
        Long id,
        String title,
        String description,
        String level,
        List<String> guideSteps,
        String videoUrl,
        String status,
        String rejectionReason,
        String targetMuscle,
        Integer defaultSets,
        Integer defaultReps,
        Integer defaultDuration,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
