package com.calishealth.dtos;

import java.time.LocalDateTime;

public record WorkoutListItemDTO(
        Long id,
        String title,
        String description,
        String level,
        String authorName,
        LocalDateTime createdAt,
        int saveCount,
        int totalExercises,
        int totalSets,
        int estimatedDuration,
        String muscleGroup,
        boolean isSharedWithCommunity
) {}
