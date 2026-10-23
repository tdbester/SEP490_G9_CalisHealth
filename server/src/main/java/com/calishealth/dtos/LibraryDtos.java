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
}
