package com.calishealth.dtos;

public record AvailableWorkoutExerciseDTO(
        Long id,
        String title,
        String level,
        String targetMuscle,
        Integer defaultSets,
        Integer defaultReps,
        Integer defaultDuration
) {}
