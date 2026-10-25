package com.calishealth.service;

import com.calishealth.dtos.DayStreakDtos.DayReportResponse;
import com.calishealth.dtos.DayStreakDtos.DayStreakResponse;
import com.calishealth.dtos.DayStreakDtos.ExerciseReportResponse;
import com.calishealth.dtos.DayStreakDtos.WeeklyGoalResponse;
import com.calishealth.repository.DayStreakRepository;
import com.calishealth.repository.DayStreakRepository.DayReportData;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.DayOfWeek;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DayStreakService {
    private static final int WEEKLY_GOAL_TARGET = 6;

    private final DayStreakRepository dayStreaks;

    @Transactional(readOnly = true)
    public DayStreakResponse getDayStreak(String email, int year, int month) {
        YearMonth requestedMonth;
        try {
            requestedMonth = YearMonth.of(year, month);
        } catch (DateTimeException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A valid year and month are required");
        }

        LocalDate today = LocalDate.now();
        Long profileId = dayStreaks.findMemberProfileId(email).orElse(null);
        List<LocalDate> allWorkoutDays = profileId == null
                ? List.of()
                : dayStreaks.findCompletedWorkoutDays(profileId, today);
        List<LocalDate> monthWorkoutDays = allWorkoutDays.stream()
                .filter(day -> YearMonth.from(day).equals(requestedMonth))
                .toList();
        List<LocalDate> currentStreakDays = findCurrentStreak(allWorkoutDays, today);
        int longestStreak = findLongestStreak(allWorkoutDays);
        int sessionsDone = profileId == null
                ? 0
                : dayStreaks.countCompletedSessions(
                        profileId,
                        today.with(DayOfWeek.MONDAY),
                        today.with(DayOfWeek.SUNDAY)
                );
        int weeklyPercent = Math.min(100, (int) Math.round(
                sessionsDone * 100.0 / WEEKLY_GOAL_TARGET
        ));

        return new DayStreakResponse(
                year,
                month,
                monthWorkoutDays,
                currentStreakDays,
                currentStreakDays.size(),
                longestStreak,
                !currentStreakDays.isEmpty(),
                new WeeklyGoalResponse(sessionsDone, WEEKLY_GOAL_TARGET, weeklyPercent)
        );
    }

    @Transactional(readOnly = true)
    public DayReportResponse getDayReport(String email, LocalDate date) {
        Long profileId = dayStreaks.findMemberProfileId(email)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Member profile not found"
                ));
        DayReportData report = dayStreaks.findDayReport(profileId, date);
        if (report.exercises().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No completed workout found for this date");
        }

        int durationMinutes = Math.max(1, (int) Math.round(report.activeSeconds() / 60.0));
        int totalVolume = report.exercises().stream().mapToInt(ExerciseReportResponse::reps).sum();
        return new DayReportResponse(
                date,
                durationMinutes + " mins",
                totalVolume,
                report.exercises()
        );
    }

    private List<LocalDate> findCurrentStreak(List<LocalDate> workoutDays, LocalDate today) {
        if (workoutDays.isEmpty()) {
            return List.of();
        }

        LocalDate cursor = workoutDays.contains(today)
                ? today
                : workoutDays.contains(today.minusDays(1)) ? today.minusDays(1) : null;
        if (cursor == null) {
            return List.of();
        }

        List<LocalDate> streak = new ArrayList<>();
        while (workoutDays.contains(cursor)) {
            streak.add(0, cursor);
            cursor = cursor.minusDays(1);
        }
        return streak;
    }

    private int findLongestStreak(List<LocalDate> workoutDays) {
        int longest = 0;
        int current = 0;
        LocalDate previous = null;
        for (LocalDate day : workoutDays) {
            current = previous != null && previous.plusDays(1).equals(day) ? current + 1 : 1;
            longest = Math.max(longest, current);
            previous = day;
        }
        return longest;
    }
}
