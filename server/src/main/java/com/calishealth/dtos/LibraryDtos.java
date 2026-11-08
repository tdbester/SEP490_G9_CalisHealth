package com.calishealth.dtos;

import java.util.List;

public class LibraryDtos {
    public record ExerciseCounts(
        long healthCount,
        long skillCount,
        long memberCount
    ) {}

    public record WorkoutCounts(
        long healthCount,
        long skillCount,
        long customCount
    ) {}

    public record LibrarySummaryResponse(
        ExerciseCounts exercise,
        WorkoutCounts workout
    ) {}

    public record ExerciseListItem(
        Long id,
        String code,
        String name,
        String type,
        String source,
        String category,
        String muscleGroup,
        Integer sets,
        String repsOrDuration,
        String goal,
        String equipment,
        String level,
        String details,
        String description,
        String demoVideoUrl
    ) {}

    public record PagedExerciseListResponse(
        List<ExerciseListItem> items,
        long totalItems,
        int totalPages,
        int currentPage,
        int pageSize
    ) {}

    public record CreateMemberExerciseRequest(
        String name,
        String muscleGroup,
        String level,
        String category,
        String equipment,
        Integer sets,
        String repsOrDuration,
        String description
    ) {}

    /**
     * Một level trong hệ thống. Level do Content Manager cấu hình động (Level & Benchmark
     * Criteria) nên client phải lấy danh sách này thay vì hard-code.
     *
     * @param id       id level
     * @param name     tên level (dùng làm giá trị level của bài tập / workout)
     * @param scoreMin điểm tối thiểu của level
     * @param scoreMax điểm tối đa của level
     * @param status   ACTIVE | INACTIVE
     */
    public record FitnessLevelOption(
        Long id,
        String name,
        int scoreMin,
        int scoreMax,
        String status
    ) {}
}
