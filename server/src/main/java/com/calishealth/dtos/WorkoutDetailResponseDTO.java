package com.calishealth.dtos;

import java.time.LocalDateTime;
import java.util.List;

public record WorkoutDetailResponseDTO(
        Long id,
        String title,
        String description,
        String level,
        /** HEALTH / SKILL / FLEX — FLEX hiển thị ở cả tab Health và tab Skill. */
        String type,
        boolean isSharedWithCommunity,
        int saveCount,
        String authorName,
        LocalDateTime createdAt,
        int totalExercises,
        int totalSets,
        int estimatedDuration,
        List<WorkoutExerciseItemDTO> exercises
) {}
