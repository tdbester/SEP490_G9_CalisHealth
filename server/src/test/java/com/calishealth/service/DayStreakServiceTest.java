package com.calishealth.service;

import com.calishealth.dtos.DayStreakDtos.DayReportResponse;
import com.calishealth.dtos.DayStreakDtos.DayStreakResponse;
import com.calishealth.dtos.DayStreakDtos.ExerciseReportResponse;
import com.calishealth.repository.DayStreakRepository;
import com.calishealth.repository.DayStreakRepository.DayReportData;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DayStreakServiceTest {
    private final DayStreakRepository repository = mock(DayStreakRepository.class);
    private final DayStreakService service = new DayStreakService(repository);

    @Test
    void returnsMonthDaysCurrentStreakLongestStreakAndWeeklyGoal() {
        String email = "member@example.com";
        LocalDate today = LocalDate.now();
        List<LocalDate> completedDays = List.of(
                LocalDate.of(2026, 1, 1),
                today.minusDays(2),
                today.minusDays(1),
                today
        );
        when(repository.findMemberProfileId(email)).thenReturn(Optional.of(7L));
        when(repository.findCompletedWorkoutDays(7L, today)).thenReturn(completedDays);
        when(repository.countCompletedSessions(
                7L,
                today.with(DayOfWeek.MONDAY),
                today.with(DayOfWeek.SUNDAY)
        )).thenReturn(4);

        DayStreakResponse response = service.getDayStreak(email, today.getYear(), today.getMonthValue());

        assertEquals(3, response.currentStreak());
        assertEquals(3, response.longestStreak());
        assertEquals(List.of(today.minusDays(2), today.minusDays(1), today), response.currentStreakDays());
        assertEquals(
                completedDays.stream().filter(day -> YearMonth.from(day).equals(YearMonth.from(today))).toList(),
                response.workoutDays()
        );
        assertTrue(response.active());
        assertEquals(4, response.weeklyGoal().sessionsDone());
        assertEquals(6, response.weeklyGoal().targetSessions());
        assertEquals(67, response.weeklyGoal().percent());
    }

    @Test
    void returnsEmptyStreakWhenMemberProfileDoesNotExist() {
        LocalDate today = LocalDate.now();
        when(repository.findMemberProfileId("member@example.com")).thenReturn(Optional.empty());

        DayStreakResponse response = service.getDayStreak(
                "member@example.com",
                today.getYear(),
                today.getMonthValue()
        );

        assertTrue(response.workoutDays().isEmpty());
        assertTrue(response.currentStreakDays().isEmpty());
        assertEquals(0, response.longestStreak());
        assertFalse(response.active());
    }

    @Test
    void aggregatesDayReportAndFormatsDuration() {
        String email = "member@example.com";
        LocalDate date = LocalDate.of(2026, 10, 8);
        List<ExerciseReportResponse> exercises = List.of(
                new ExerciseReportResponse(1L, "Push-up", "HEALTH", 3, 20, 91.0)
        );
        when(repository.findMemberProfileId(email)).thenReturn(Optional.of(7L));
        when(repository.findDayReport(7L, date)).thenReturn(new DayReportData(exercises, 28 * 60));

        DayReportResponse response = service.getDayReport(email, date);

        assertEquals(date, response.date());
        assertEquals("28 mins", response.duration());
        assertEquals(20, response.totalVolume());
        assertEquals(exercises, response.exercises());
    }

    @Test
    void rejectsDayReportWhenThereIsNoCompletedWorkout() {
        String email = "member@example.com";
        LocalDate date = LocalDate.of(2026, 10, 8);
        when(repository.findMemberProfileId(email)).thenReturn(Optional.of(7L));
        when(repository.findDayReport(7L, date)).thenReturn(new DayReportData(List.of(), 0));

        assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> service.getDayReport(email, date)
        );
    }
}
