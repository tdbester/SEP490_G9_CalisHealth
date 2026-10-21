package com.calishealth.dtos;

import java.time.LocalDateTime;
import java.util.List;

public final class ExerciseDtos {
    private ExerciseDtos() {}

    public record ExerciseResponse(
            String code,
            String name,
            String type,
            String description,
            String category,
            String muscleGroup,
            String level,
            String guide,
            String demoVideoUrl,
            String anatomyImageUrl,
            boolean active,
            LocalDateTime updatedAt
    ) {}

    public record CreateExerciseRequest(
            String name,
            String type,
            String description,
            String category,
            String muscleGroup,
            String level,
            String guide
    ) {}

    public record ExerciseStatusRequest(boolean active) {}

    public record WorkoutResponse(
            String code,
            String name,
            String description,
            String content,
            String type,
            String level,
            boolean active,
            LocalDateTime updatedAt,
            List<WorkoutExerciseResponse> exercises,
            List<WorkoutPlanItemResponse> planItems
    ) {}

    public record CreateWorkoutRequest(
            String name,
            String description,
            String content,
            String type,
            String level,
            List<String> exerciseCodes,
            List<WorkoutPlanItemRequest> planItems
    ) {}

    public record WorkoutExerciseResponse(String code, String name, String level, String muscleGroup) {}

    public record WorkoutPlanItemRequest(
            int dayOfWeek,
            String exerciseCode,
            int beginnerSets,
            int beginnerReps,
            int intermediateSets,
            int intermediateReps,
            int advancedSets,
            int advancedReps
    ) {}

    public record WorkoutPlanItemResponse(
            int dayOfWeek,
            String exerciseCode,
            String exerciseName,
            String muscleGroup,
            int beginnerSets,
            int beginnerReps,
            int intermediateSets,
            int intermediateReps,
            int advancedSets,
            int advancedReps
    ) {}
}
