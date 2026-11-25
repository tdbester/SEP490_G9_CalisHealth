package com.calishealth.service;

import com.calishealth.models.MemberSchedule;
import com.calishealth.models.User;
import com.calishealth.repository.DailyPlanTemplateRepository;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.repository.MemberScheduleRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.repository.WorkoutRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bo sung coverage cho {@link MemberScheduleService}: entry thieu ngay, entry thieu workout,
 * danh sach rong va entry nam ngoai thang.
 */
class MemberScheduleServiceGapTest {

    private MemberScheduleRepository schedules;
    private WorkoutRepository workouts;
    private UserRepository users;
    private MemberScheduleService service;

    @BeforeEach
    void setUp() {
        schedules = mock(MemberScheduleRepository.class);
        workouts = mock(WorkoutRepository.class);
        users = mock(UserRepository.class);
        service = new MemberScheduleService(schedules, workouts,
                mock(DailyPlanTemplateRepository.class),
                mock(MemberProfileRepository.class), users);
    }

    private void member() {
        User user = new User();
        user.setId(1L);
        user.setEmail("member@calishealth.vn");
        lenient().when(users.findByEmail("member@calishealth.vn")).thenReturn(Optional.of(user));
    }

    @Test
    @DisplayName("saveWeek: entry thieu ngay -> 400")
    void saveWeekRejectsEntryWithoutDate() {
        member();

        assertThatThrownBy(() -> service.saveWeek("member@calishealth.vn",
                new com.calishealth.dtos.MemberScheduleDtos.SaveWeekRequest(null,
                        List.of(new com.calishealth.dtos.MemberScheduleDtos.ScheduleEntryRequest(null, "W1", 1)))))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST))
                .hasMessageContaining("A date is required");
    }

    @Test
    @DisplayName("saveWeek: entry thieu workout -> 400")
    void saveWeekRejectsEntryWithoutWorkout() {
        member();
        LocalDate date = LocalDate.now().with(java.time.DayOfWeek.MONDAY);

        assertThatThrownBy(() -> service.saveWeek("member@calishealth.vn",
                new com.calishealth.dtos.MemberScheduleDtos.SaveWeekRequest(null,
                        List.of(new com.calishealth.dtos.MemberScheduleDtos.ScheduleEntryRequest(date, "  ", 1)))))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST))
                .hasMessageContaining("Choose a workout");
    }

    @Test
    @DisplayName("saveWeek: khong co entry -> 400")
    void saveWeekRejectsEmptyEntries() {
        member();

        assertThatThrownBy(() -> service.saveWeek("member@calishealth.vn",
                new com.calishealth.dtos.MemberScheduleDtos.SaveWeekRequest(null, List.of())))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST))
                .hasMessageContaining("Pick at least one workout");
    }

    @Test
    @DisplayName("saveWeek: request null -> 400")
    void saveWeekRejectsNullRequest() {
        member();

        assertThatThrownBy(() -> service.saveWeek("member@calishealth.vn", null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("save: entry thieu ngay -> 400")
    void saveRejectsEntryWithoutDate() {
        member();
        MemberSchedule schedule = new MemberSchedule();
        schedule.setPlanMonth(LocalDate.now().withDayOfMonth(1));
        schedule.setEntries(new ArrayList<>());
        lenient().when(schedules.findByUserIdAndPlanMonth(any(), any())).thenReturn(Optional.of(schedule));

        assertThatThrownBy(() -> service.save("member@calishealth.vn",
                new com.calishealth.dtos.MemberScheduleDtos.SaveScheduleRequest(
                        LocalDate.now().withDayOfMonth(1),
                        null,
                        List.of(new com.calishealth.dtos.MemberScheduleDtos.ScheduleEntryRequest(null, "W1", 1)))))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST))
                .hasMessageContaining("A date is required");
    }

    @Test
    @DisplayName("save: entry thieu workout -> 400")
    void saveRejectsEntryWithoutWorkout() {
        member();
        MemberSchedule schedule = new MemberSchedule();
        schedule.setPlanMonth(LocalDate.now().withDayOfMonth(1));
        schedule.setEntries(new ArrayList<>());
        lenient().when(schedules.findByUserIdAndPlanMonth(any(), any())).thenReturn(Optional.of(schedule));

        assertThatThrownBy(() -> service.save("member@calishealth.vn",
                new com.calishealth.dtos.MemberScheduleDtos.SaveScheduleRequest(
                        LocalDate.now().withDayOfMonth(1),
                        null,
                        List.of(new com.calishealth.dtos.MemberScheduleDtos.ScheduleEntryRequest(
                                LocalDate.now().withDayOfMonth(3), "", 1)))))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST))
                .hasMessageContaining("Choose a workout");
    }

    @Test
    @DisplayName("save: danh sach rong -> tao schedule khong co entry")
    void saveWithNoEntriesCreatesEmptySchedule() {
        member();
        MemberSchedule schedule = new MemberSchedule();
        schedule.setPlanMonth(LocalDate.now().withDayOfMonth(1));
        schedule.setEntries(new ArrayList<>());
        when(schedules.findByUserIdAndPlanMonth(any(), any())).thenReturn(Optional.of(schedule));
        when(schedules.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        var response = service.save("member@calishealth.vn",
                new com.calishealth.dtos.MemberScheduleDtos.SaveScheduleRequest(
                        LocalDate.now().withDayOfMonth(1), null, List.of()));

        assertThat(response).isNotNull();
        assertThat(response.entries()).isEmpty();
    }

    @Test
    @DisplayName("save: ngay nam ngoai thang -> 400")
    void saveRejectsDateOutsideMonth() {
        member();
        MemberSchedule schedule = new MemberSchedule();
        schedule.setPlanMonth(LocalDate.now().withDayOfMonth(1));
        schedule.setEntries(new ArrayList<>());
        lenient().when(schedules.findByUserIdAndPlanMonth(any(), any())).thenReturn(Optional.of(schedule));

        assertThatThrownBy(() -> service.save("member@calishealth.vn",
                new com.calishealth.dtos.MemberScheduleDtos.SaveScheduleRequest(
                        LocalDate.now().withDayOfMonth(1),
                        null,
                        List.of(new com.calishealth.dtos.MemberScheduleDtos.ScheduleEntryRequest(
                                LocalDate.now().plusMonths(3).withDayOfMonth(3), "W1", 1)))))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST))
                .hasMessageContaining("outside the month");
    }
}
