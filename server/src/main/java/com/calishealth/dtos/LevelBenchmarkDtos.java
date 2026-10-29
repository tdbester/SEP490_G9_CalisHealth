package com.calishealth.dtos;

import java.time.LocalDateTime;
import java.util.List;

public final class LevelBenchmarkDtos {
    private LevelBenchmarkDtos() {}

    public record ExerciseOption(String code, String name, String category) {}

    /**
     * One benchmark exercise. {@code slot} is an internal key (the code of the survey question that
     * supplies the reps / seconds value); it is resolved by the server and never edited by content.
     */
    public record BenchmarkExercise(
            String slot,
            String code,
            String name,
            String category,
            String unit,
            int beginnerMax,
            int intermediateMax,
            /** False when no active survey question supplies this result yet, so users cannot be levelled on it. */
            boolean surveyQuestionReady
    ) {}

    public record LevelBenchmark(
            Long id,
            String level,
            int scoreMin,
            int scoreMax,
            String status,
            LocalDateTime updatedAt,
            String updatedBy
    ) {}

    public record BenchmarkConfiguration(
            List<BenchmarkExercise> exercises,
            List<ExerciseOption> availableExercises,
            List<LevelBenchmark> levels
    ) {}

    public record BenchmarkExerciseUpdate(
            String code,
            String category,
            int beginnerMax,
            int intermediateMax
    ) {}

    public record LevelUpdate(
            Long id,
            String name,
            int scoreMin,
            int scoreMax,
            String status
    ) {}

    public record UpdateBenchmarkConfiguration(
            List<BenchmarkExerciseUpdate> exercises,
            List<LevelUpdate> levels
    ) {}

    public record CreateLevelRequest(
            String name,
            String status
    ) {}
}
