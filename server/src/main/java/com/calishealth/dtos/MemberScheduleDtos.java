package com.calishealth.dtos;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** DTOs cho chức năng member tự xếp lịch tập theo tháng (màn "Workout schedule"). */
public final class MemberScheduleDtos {
    private MemberScheduleDtos() {}

    /** Một workout được thả vào một ngày cụ thể trên lịch tháng. */
    public record ScheduleEntryRequest(
            LocalDate date,
            String workoutCode,
            Integer orderInDay
    ) {}

    public record SaveScheduleRequest(
            /** Ngày bất kỳ trong tháng cần lưu; backend tự chuẩn hoá về ngày 1. */
            LocalDate month,
            String templateCode,
            List<ScheduleEntryRequest> entries
    ) {}

    /** Event chip trong ô ngày của lịch tháng. */
    public record ScheduleEntryResponse(
            Long id,
            LocalDate date,
            String workoutCode,
            String workoutName,
            String workoutLevel,
            /** HEALTH | SKILL — quyết định màu chip và chấm legend. */
            String category,
            int durationMinutes,
            int exerciseCount,
            int orderInDay,
            String status
    ) {}

    public record MemberScheduleResponse(
            Long id,
            /** Ngày 1 của tháng, dạng YYYY-MM-01. */
            LocalDate month,
            String templateCode,
            String templateName,
            List<ScheduleEntryResponse> entries,
            /** Số ngày trong tháng có ít nhất một workout. */
            int plannedDays,
            int totalWorkouts,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {}

    /** Card workout ở sidebar trái của màn "Workout schedule". */
    public record AvailableWorkoutResponse(
            String code,
            String name,
            String level,
            /** HEALTH | SKILL — badge trên card và filter pill. */
            String category,
            int durationMinutes,
            int exerciseCount,
            List<String> categories,
            List<String> targetMuscles
    ) {}

    /** Thẻ "Plan info" ở màn Review training plan. */
    public record PlanInfoResponse(
            String templateCode,
            String templateName,
            String level,
            int monthNumber,
            int daysPerWeek,
            int year
    ) {}

    /**
     * Một bài tập nằm trong buổi tập hôm nay (màn "Daily workout plan").
     * Cấu hình lấy từ workout_exercises để màn chi tiết hiển thị đúng số hiệp/số lần.
     */
    public record TodayExerciseResponse(
            String exerciseCode,
            String exerciseName,
            /** HOLD | REPS — quyết định hiển thị "45s" hay "12 reps". */
            String category,
            String muscleGroup,
            int sets,
            Integer reps,
            Integer durationSeconds,
            int restSeconds
    ) {}

    /** Buổi tập đã xếp cho hôm nay; một ngày có thể có nhiều workout. */
    public record TodayWorkoutResponse(
            LocalDate date,
            String workoutCode,
            String workoutName,
            String workoutLevel,
            /** HEALTH | SKILL — tô màu badge giống lịch tháng. */
            String category,
            int durationMinutes,
            int exerciseCount,
            String status,
            List<TodayExerciseResponse> exercises
    ) {}
}
