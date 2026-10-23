package com.calishealth.dtos;

import java.time.LocalDateTime;
import java.util.List;

public record WorkoutDetailResponseDTO(
        Long id,
        String title,
        String description,
        String level,
        boolean isSharedWithCommunity,
        int saveCount,
        String authorName,
        LocalDateTime createdAt,
        int totalExercises,
        int totalSets,
        int estimatedDuration,
        List<WorkoutExerciseItemDTO> exercises
) {}
