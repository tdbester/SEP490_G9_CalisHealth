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
            /** SYSTEM = thư viện do Content Manager tạo, CUSTOM = bài tập của người dùng/community. */
            String source,
            String createdByName,
            Integer defaultReps,
            Integer duration,
            boolean active,
            LocalDateTime updatedAt,
            LocalDateTime submittedAt,
            String autoCheckStatus,
            Integer defaultSets
    ) {}

    public record CreateExerciseRequest(
            String name,
            String type,
            String description,
            String category,
            String muscleGroup,
            String level,
            String guide,
            Integer defaultSets,
            Integer defaultReps,
            Integer duration
    ) {}

    public record ExerciseStatusRequest(boolean active) {}

    public record ExerciseModerationHistoryResponse(
            Long id,
            String code,
            String name,
            String type,
            String muscleGroup,
            String level,
            String description,
            String category,
            String guide,
            String demoVideoUrl,
            String anatomyImageUrl,
            String createdByName,
            String decision,
            LocalDateTime reviewedAt
    ) {}

    public record WorkoutResponse(
            String code,
            String name,
            String description,
            String type,
            String level,
            int restSeconds,
            boolean active,
            LocalDateTime updatedAt,
            String source,
            String createdByName,
            List<WorkoutExerciseResponse> exercises,
            List<WorkoutPlanItemResponse> planItems
    ) {}

    public record CreateWorkoutRequest(
            String name,
            String description,
            int restSeconds,
            String level,
            List<String> exerciseCodes,
            List<WorkoutPlanItemRequest> planItems
    ) {}

    public record WorkoutExerciseResponse(
            String code,
            String name,
            String level,
            String muscleGroup,
            String category,
            Integer defaultSets,
            Integer defaultReps,
            Integer duration
    ) {}

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
