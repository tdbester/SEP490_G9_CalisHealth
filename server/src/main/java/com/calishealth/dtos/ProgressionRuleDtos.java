package com.calishealth.dtos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public final class ProgressionRuleDtos {
    private ProgressionRuleDtos() {}

    public record ExerciseRef(String code, String name, String type, String category) {}

    /** Một cạnh "làm {@code prerequisite} đạt ngưỡng thì mở khóa {@code exercise}". */
    public record RuleSummary(
            Long id,
            String ruleName,
            String status,
            /** REPS hoặc HOLD, suy ra từ cách đo của bài prerequisite. */
            String measureType,
            int requiredSets,
            Integer requiredReps,
            Integer requiredSeconds,
            BigDecimal minAccuracy,
            ExerciseRef exercise,
            ExerciseRef prerequisite,
            LocalDateTime updatedAt
    ) {}

    public record RuleList(
            List<RuleSummary> rules,
            long activeCount,
            long inactiveCount,
            List<ExerciseRef> availableExercises
    ) {}

    public record RuleDetail(
            RuleSummary rule,
            /** Số member đã mở khóa bài đích. */
            long unlockedMembers,
            /** Các rule khác mở khóa cùng bài đích. */
            List<RuleSummary> sameTargetRules,
            /** Các rule mà bài đích là prerequisite (bước tiếp theo của chuỗi). */
            List<RuleSummary> nextRules
    ) {}

    public record SaveRuleRequest(
            @NotBlank String exerciseCode,
            @NotBlank String prerequisiteCode,
            @Min(1) int requiredSets,
            Integer requiredReps,
            Integer requiredSeconds,
            @NotNull @DecimalMin("1") @DecimalMax("100") BigDecimal minAccuracy,
            String status
    ) {}

    /** Sửa ngưỡng của rule có sẵn. Cặp bài không đổi được, muốn đổi thì tạo rule mới. */
    public record UpdateRuleRequest(
            @Min(1) int requiredSets,
            Integer requiredReps,
            Integer requiredSeconds,
            @NotNull @DecimalMin("1") @DecimalMax("100") BigDecimal minAccuracy,
            String status
    ) {}

    /** Kết quả một set do client (MediaPipe) đếm; backend tự tính lại % từ các số này. */
    public record SetResultInput(
            @Min(0) int totalReps,
            @Min(0) int cleanReps,
            @Min(0) int totalSeconds,
            @Min(0) int cleanSeconds
    ) {}

    public record SubmitExerciseResultRequest(
            @NotBlank String exerciseCode,
            @NotEmpty @Size(max = 30) List<@Valid SetResultInput> sets
    ) {}

    public record RuleEvaluation(
            Long ruleId,
            ExerciseRef unlocks,
            boolean passed,
            int qualifyingSets,
            int requiredSets,
            /** % clean (0-100) tính từ số đếm; null khi không có mẫu để đánh giá. */
            BigDecimal cleanRate,
            BigDecimal minAccuracy,
            String message
    ) {}

    public record ExerciseResultResponse(
            Long sessionId,
            ExerciseRef exercise,
            BigDecimal cleanRate,
            List<RuleEvaluation> evaluations,
            List<ExerciseRef> newlyUnlocked
    ) {}
}
