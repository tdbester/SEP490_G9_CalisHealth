package com.calishealth.dtos;

import java.time.LocalDateTime;
import java.util.List;

public final class LevelBenchmarkDtos {
    private LevelBenchmarkDtos() {}

    public record ExerciseOption(String code, String name, String category) {}

    public record BenchmarkExercise(
            String slot,
            String code,
            String name,
            String category,
            String unit,
            int beginnerMax,
            int intermediateMax
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
            String slot,
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
            int scoreMin,
            int scoreMax,
            String status,
            List<BenchmarkExerciseUpdate> exercises
    ) {}
}
