package com.calishealth.dtos;

import java.time.LocalDateTime;
import java.util.List;

public final class ExerciseDtos {
    private ExerciseDtos() {}

    public record ExerciseResponse(
            String code,
            String movementGroup,
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
            Integer defaultSets,
            /** The exercise's own flag, ignoring its level. {@code active} = selfActive && levelActive. */
            boolean selfActive,
            /** False when the exercise's level is inactive in Level &amp; Benchmark Criteria. */
            boolean levelActive,
            /** Hồ sơ sinh lý V76 (null khi chưa có) — CM xem nguồn trích dẫn. */
            ExercisePhysiologyDTO physiology
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
            Integer duration,
            /** Hồ sơ sinh lý (chỉ dùng cho bài SYSTEM). Null = không tạo/cập nhật hồ sơ. */
            ExercisePhysiologyInputDTO physiology
    ) {}

    public record ExerciseStatusRequest(boolean active, String rejectionReason) {}

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
            String rejectionReason,
            LocalDateTime reviewedAt
    ) {}

    public record WorkoutResponse(
            String code,
            String name,
            String description,
            String type,
            String level,
            int monthNumber,
            int daysPerWeek,
            int daySequence,
            String templateStatus,
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
            String type,
            String level,
            Integer monthNumber,
            Integer daysPerWeek,
            Integer daySequence,
            String templateStatus,
            /** Cách cũ: chỉ danh sách mã bài, cấu hình lấy theo mặc định của bài. Dùng khi {@code items} rỗng. */
            List<String> exerciseCodes,
            List<WorkoutPlanItemRequest> planItems,
            /** Bài tập kèm cấu hình riêng, theo thứ tự hiển thị. */
            List<WorkoutExerciseItemRequest> items
    ) {}

    /** Clone Workout Template: copies every exercise setting into a new DRAFT template for the target month. */
    public record CloneWorkoutRequest(Integer monthNumber, String name) {}

    /**
     * Quick Update Sets/Reps: adds the deltas to every exercise of the template (progressive overload).
     * repsDelta applies to REPS exercises, durationDelta (seconds) to HOLD exercises.
     */
    public record QuickUpdateWorkoutRequest(Integer setsDelta, Integer repsDelta, Integer durationDelta) {}

    /** Cách đếm không gửi lên: bài HOLD dùng durationSeconds, các bài còn lại dùng reps. */
    public record WorkoutExerciseItemRequest(
            String exerciseCode,
            Integer sets,
            Integer reps,
            Integer durationSeconds,
            Integer restSeconds
    ) {}

    public record WorkoutExerciseResponse(
            String code,
            String name,
            String level,
            String muscleGroup,
            String category,
            Integer defaultSets,
            Integer defaultReps,
            Integer duration,
            String countBy,
            Integer sets,
            Integer reps,
            Integer durationSeconds,
            Integer restSeconds
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
