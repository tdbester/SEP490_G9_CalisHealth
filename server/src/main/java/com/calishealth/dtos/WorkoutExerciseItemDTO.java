package com.calishealth.dtos;

public record WorkoutExerciseItemDTO(
        Long id,
        Long exerciseId,
        /** Mã bài tập (EX_1, MEMBER-DEMO-001...) — dùng để mở màn tracking AI. */
        String exerciseCode,
        String exerciseTitle,
        boolean isSystem,
        String targetMuscle,
        String level,
        int orderIndex,
        int sets,
        Integer reps,
        Integer duration,
        String countBy,
        /** HOLD | REPS — quyết định đo theo giây hay theo số lần. */
        String category,
        int restSeconds
) {}
