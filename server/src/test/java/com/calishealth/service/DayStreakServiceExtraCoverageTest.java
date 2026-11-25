package com.calishealth.service;

import com.calishealth.repository.DayStreakRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bo sung coverage cho {@link DayStreakService}: thang khong hop le va chuoi ngay bi gap.
 */
class DayStreakServiceExtraCoverageTest {

    private DayStreakRepository dayStreaks;
    private DayStreakService service;

    @BeforeEach
    void setUp() {
        dayStreaks = mock(DayStreakRepository.class);
        service = new DayStreakService(dayStreaks);
    }

    @Test
    @DisplayName("getDayStreak: thang khong hop le -> 400")
    void invalidMonthIsRejected() {
        assertThatThrownBy(() -> service.getDayStreak("member@example.test", 2026, 13))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("getDayStreak: thang 0 -> 400")
    void invalidZeroMonthIsRejected() {
        assertThatThrownBy(() -> service.getDayStreak("member@example.test", 2026, 0))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("getDayStreak: khong co ho so -> khong co chuoi hien tai")
    void missingProfileHasNoStreak() {
        when(dayStreaks.findMemberProfileId(any())).thenReturn(Optional.empty());

        var response = service.getDayStreak("member@example.test", 2026, 3);

        assertThat(response.currentStreakDays()).isEmpty();
        assertThat(response.active()).isFalse();
        assertThat(response.weeklyGoal().sessionsDone()).isZero();
    }

    @Test
    @DisplayName("getDayStreak: tap xa ngay nay -> khong co chuoi hien tai")
    void staleWorkoutDaysHaveNoCurrentStreak() {
        LocalDate old = LocalDate.now().minusDays(10);
        when(dayStreaks.findMemberProfileId(any())).thenReturn(Optional.of(7L));
        when(dayStreaks.findCompletedWorkoutDays(anyLong(), any())).thenReturn(List.of(old));
        when(dayStreaks.countCompletedSessions(anyLong(), any(), any())).thenReturn(0);

        var response = service.getDayStreak("member@example.test", 2026, 3);

        assertThat(response.currentStreakDays()).isEmpty();
        assertThat(response.longestStreak()).isEqualTo(1);
    }

    @Test
    @DisplayName("getDayStreak: tap hom qua -> chuoi hien tai bat dau tu hom qua")
    void yesterdayStartsTheStreak() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        when(dayStreaks.findMemberProfileId(any())).thenReturn(Optional.of(7L));
        when(dayStreaks.findCompletedWorkoutDays(anyLong(), any())).thenReturn(List.of(yesterday));
        when(dayStreaks.countCompletedSessions(anyLong(), any(), any())).thenReturn(3);

        var response = service.getDayStreak("member@example.test", 2026, 3);

        assertThat(response.currentStreakDays()).containsExactly(yesterday);
        assertThat(response.active()).isTrue();
        assertThat(response.weeklyGoal().sessionsDone()).isEqualTo(3);
    }
}
