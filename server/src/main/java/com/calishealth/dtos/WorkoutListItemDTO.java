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
        boolean isSharedWithCommunity,
        /**
         * Workout hệ thống đang bị khoá vì có bài chưa mở khoá trong Exercise Tree.
         * Member chỉ tập được workout khi MỌI bài trong nó đã mở khoá.
         */
        boolean locked
) {}
