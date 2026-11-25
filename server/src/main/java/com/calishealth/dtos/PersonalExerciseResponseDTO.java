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
        String anatomyImageUrl,
        String status,
        String rejectionReason,
        String targetMuscle,
        Integer defaultSets,
        Integer defaultReps,
        Integer defaultDuration,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        /** Nhóm chuyển động: PUSH | PULL | LEGS | CORE — dùng để gợi ý ngưỡng chấm form. */
        String movementGroup
) {

    /** Constructor tương thích ngược — bài tạo trước khi có trường nhóm chuyển động. */
    public PersonalExerciseResponseDTO(
            Long id,
            String title,
            String description,
            String level,
            List<String> guideSteps,
            String videoUrl,
            String anatomyImageUrl,
            String status,
            String rejectionReason,
            String targetMuscle,
            Integer defaultSets,
            Integer defaultReps,
            Integer defaultDuration,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
        this(id, title, description, level, guideSteps, videoUrl, anatomyImageUrl, status,
                rejectionReason, targetMuscle, defaultSets, defaultReps, defaultDuration,
                createdAt, updatedAt, null);
    }
}
