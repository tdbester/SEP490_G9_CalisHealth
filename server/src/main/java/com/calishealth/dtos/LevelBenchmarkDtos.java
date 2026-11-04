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

    // ---- Chấm điểm level test theo bảng level criteria -------------------------------------------

    /**
     * Điểm của 1 bài benchmark trong level test: số member đạt được, điểm (1..3) và nhãn khoảng
     * điểm (vd "20–40 reps"). Dùng cho màn "Result and recommended plan".
     */
    public record BenchmarkScoreItem(
            /** Mã câu hỏi khảo sát cấp giá trị (slot). */
            String slot,
            /** Tên bài tập trong thư viện. */
            String exerciseName,
            /** reps | sec. */
            String unit,
            int value,
            /** 1, 2 hoặc 3 điểm. */
            int points,
            /** Khoảng điểm của bài này, vd "20–40 reps". */
            String bandLabel
    ) {}

    /** 1 bậc trên thang level (rank = vị trí, 1 = thấp nhất). */
    public record BenchmarkLevel(Long id, String name, int rank) {}

    /**
     * Kết quả chấm level test theo bảng level criteria (Exercise point rules).
     * Lấy được khi member đã trả lời đủ mọi bài benchmark.
     */
    public record BenchmarkAssessment(
            /** Tổng điểm của các bài (mỗi bài 1..3 điểm). */
            int totalScore,
            /** Level cuối cùng sau khi cộng điểm và áp luật giảm 1 bậc khi lệch. */
            com.calishealth.models.FitnessLevel level,
            /** Thang level đang active, thấp -> cao. */
            List<BenchmarkLevel> ladder,
            List<BenchmarkScoreItem> scores,
            /** Member không làm được nổi 1 lần bài nào -> luôn ở bậc thấp nhất. */
            boolean zeroResult,
            /** Điểm mạnh yếu lệch nhau >= 2 điểm -> mất 1 bậc. */
            boolean unbalanced
    ) {
        public BenchmarkAssessment {
            ladder = List.copyOf(ladder);
            scores = List.copyOf(scores);
        }
    }
}
