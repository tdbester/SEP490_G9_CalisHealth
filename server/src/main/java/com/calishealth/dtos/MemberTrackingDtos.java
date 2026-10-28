package com.calishealth.dtos;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public final class MemberTrackingDtos {
    private MemberTrackingDtos() {
    }

    // ============================================================
    // 1. UPDATE STATS MODAL (Màn 5.2)
    // ============================================================
    public record UpdateMeasurementsRequest(
            @NotNull(message = "Cân nặng không được để trống")
            @DecimalMin(value = "20.0", message = "Cân nặng tối thiểu là 20.0 kg")
            @DecimalMax(value = "300.0", message = "Cân nặng tối đa là 300.0 kg")
            @Digits(integer = 3, fraction = 1, message = "Cân nặng chỉ được chứa tối đa 1 chữ số thập phân")
            BigDecimal weightKg,

            @NotNull(message = "Chiều cao không được để trống")
            @DecimalMin(value = "100.0", message = "Chiều cao tối thiểu là 100.0 cm")
            @DecimalMax(value = "250.0", message = "Chiều cao tối đa là 250.0 cm")
            @Digits(integer = 3, fraction = 1, message = "Chiều cao chỉ được chứa tối đa 1 chữ số thập phân")
            BigDecimal heightCm,

            @Size(max = 255, message = "Ghi chú không được vượt quá 255 ký tự")
            String note
    ) {
    }

    // ============================================================
    // 2. HEALTH TRACKING OVERVIEW (Màn 5.1)
    // ============================================================
    public record HealthTrackingOverviewResponse(
            HealthScoreDto healthScore,
            BodyMetricsDto bodyMetrics,
            BmiOverviewDto bmiOverview
    ) {
    }

    public record HealthScoreDto(
            int score,
            Integer changePercent,
            int peerPercentile,
            String statusHeadline,
            String statusDescription
    ) {
    }

    public record BodyMetricsDto(
            BigDecimal weightKg,
            BigDecimal heightCm,
            BigDecimal weightChangeKg,
            String weightNote,
            String heightNote,
            LocalDateTime updatedAt
    ) {
    }

    public record BmiOverviewDto(
            BigDecimal currentBmi,
            String classification,
            String tone,
            List<BmiMonthRecordDto> records,
            LocalDateTime latestReadingTimestamp
    ) {
    }

    public record BmiMonthRecordDto(
            String month, // Format: "YYYY-MM"
            BigDecimal bmi
    ) {
    }

    // ============================================================
    // 3. WORKOUT HISTORY (Màn 5.3)
    // ============================================================
    public record WorkoutHistoryResponse(
            WorkoutHistorySummaryDto summary,
            List<WorkoutSessionSummaryDto> workouts
    ) {
    }

    public record WorkoutHistorySummaryDto(
            int totalWorkouts,
            int totalMinutes,
            double totalHours,
            Integer cleanRepRatio
    ) {
    }

    public record WorkoutSessionSummaryDto(
            Long id,
            String name,
            String category,
            LocalDateTime completedAt,
            int durationMin,
            int accuracy,
            int exerciseCount,
            boolean isLatest
    ) {
    }

    // ============================================================
    // 4. WORKOUT LOG DETAIL (Màn 5.4 Modal)
    // ============================================================
    public record WorkoutSessionDetailResponse(
            Long id,
            String name,
            String category,
            LocalDateTime completedAt,
            int durationMin,
            int accuracy,
            List<ExerciseDetailDto> exercises
    ) {
    }

    public record ExerciseDetailDto(
            Long exerciseId,
            String name,
            String type,
            int sets,
            int reps,
            int durationSec,
            Double formAccuracy
    ) {
    }

    // ============================================================
    // 5. PERFORMANCE ANALYTICS (Màn 5.5)
    // ============================================================
    /** Mọi số liệu lấy từ buổi tập của chính member; sessions = 0 nghĩa là chưa có dữ liệu trong khoảng này. */
    public record PerformanceAnalyticsResponse(
            String range,
            int sessions,
            FormErrorsSummaryDto formErrors,
            RepsSummaryDto reps,
            List<VolumeProgressionDto> volume,
            DurationBreakdownDto duration,
            AiInsightDto insight
    ) {
    }

    public record FormErrorsSummaryDto(
            int totalTags,
            List<FormErrorItemDto> items
    ) {
    }

    public record FormErrorItemDto(
            String label,
            int count,
            int percent
    ) {
    }

    public record RepsSummaryDto(
            int valid,
            int total,
            int cleanRatio
    ) {
    }

    public record VolumeProgressionDto(
            String label,
            int reps
    ) {
    }

    public record DurationBreakdownDto(
            int totalMin,
            int activeMin,
            int restMin,
            int activePercent,
            int restPercent
    ) {
    }

    /** Nhận xét sinh từ số liệu của member; null khi chưa có buổi tập. */
    public record AiInsightDto(
            String title,
            String text
    ) {
    }
}
