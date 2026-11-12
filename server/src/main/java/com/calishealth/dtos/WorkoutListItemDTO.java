package com.calishealth.dtos;

import java.time.LocalDateTime;

public record WorkoutListItemDTO(
        Long id,
        String title,
        String description,
        String level,
        /** HEALTH / SKILL / FLEX — FLEX hiển thị ở cả tab Health và tab Skill. */
        String type,
        String authorName,
        LocalDateTime createdAt,
        int saveCount,
        int totalExercises,
        int totalSets,
        int estimatedDuration,
        String muscleGroup,
        boolean isSharedWithCommunity
) {}
