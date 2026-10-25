package com.calishealth.dtos;

import java.time.LocalDate;
import java.util.List;

public final class DayStreakDtos {
    private DayStreakDtos() {
    }

    public record DayStreakResponse(
            int year,
            int month,
            List<LocalDate> workoutDays,
            List<LocalDate> currentStreakDays,
            int currentStreak,
            int longestStreak,
            boolean active,
            WeeklyGoalResponse weeklyGoal
    ) {
    }

    public record WeeklyGoalResponse(int sessionsDone, int targetSessions, int percent) {
    }

    public record DayReportResponse(
            LocalDate date,
            String duration,
            int totalVolume,
            List<ExerciseReportResponse> exercises
    ) {
    }

    public record ExerciseReportResponse(
            Long id,
            String name,
            String type,
            int sets,
            int reps,
            double formAccuracy
    ) {
    }
}
