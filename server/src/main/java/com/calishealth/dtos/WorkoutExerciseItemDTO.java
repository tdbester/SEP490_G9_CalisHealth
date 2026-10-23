package com.calishealth.dtos;

public record WorkoutExerciseItemDTO(
        Long id,
        Long exerciseId,
        String exerciseTitle,
        String targetMuscle,
        String level,
        int orderIndex,
        int sets,
        Integer reps,
        Integer duration,
        String countBy,
        int restSeconds
) {}
