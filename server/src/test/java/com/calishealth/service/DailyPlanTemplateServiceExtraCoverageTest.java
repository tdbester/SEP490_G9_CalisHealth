package com.calishealth.service;

import com.calishealth.dtos.DailyPlanDtos.DailyPlanDayRequest;
import com.calishealth.dtos.DailyPlanDtos.DailyPlanTemplateRequest;
import com.calishealth.models.DailyPlanTemplate;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.User;
import com.calishealth.models.WorkoutEntry;
import com.calishealth.repository.DailyPlanTemplateRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.repository.WorkoutRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bo sung coverage cho {@link DailyPlanTemplateService}: cac nhanh validate
 * trong {@code apply()} va {@code buildDays()} chua duoc chay vi cac test
 * cũ dừng ở lỗi truy van user/level truocc đó.
 */
class DailyPlanTemplateServiceExtraCoverageTest {
    private DailyPlanTemplateRepository templates;
    private WorkoutRepository workouts;
    private FitnessLevelRepository fitnessLevels;
    private UserRepository users;
    private DailyPlanTemplateService service;

    private static final String EMAIL = "cm@example.test";

    @BeforeEach
    void setUp() {
        templates = mock(DailyPlanTemplateRepository.class);
        workouts = mock(WorkoutRepository.class);
        fitnessLevels = mock(FitnessLevelRepository.class);
        users = mock(UserRepository.class);
        service = new DailyPlanTemplateService(templates, workouts, fitnessLevels, users);

        User creator = new User();
        creator.setId(1L);
        creator.setEmail(EMAIL);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(creator));
        when(fitnessLevels.findByNameIgnoreCase("Beginner"))
                .thenReturn(Optional.of(level("Beginner", "ACTIVE")));
        when(templates.save(any(DailyPlanTemplate.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    private static FitnessLevel level(String name, String status) {
        FitnessLevel level = new FitnessLevel();
        level.setId(1L);
        level.setName(name);
        level.setStatus(status);
        return level;
    }

    private static WorkoutEntry workout(String code, String name, String level, boolean active) {
        WorkoutEntry workout = new WorkoutEntry();
        workout.setId(1L);
        workout.setCode(code);
        workout.setName(name);
        workout.setType("WORKOUT");
        workout.setSource("SYSTEM");
        workout.setLevel(level);
        workout.setTemplateStatus(active ? "PUBLISHED" : "DRAFT");
        return workout;
    }

    private static DailyPlanDayRequest day(int dayNumber, String workoutCode) {
        return new DailyPlanDayRequest(dayNumber, workoutCode);
    }

    private DailyPlanTemplateRequest request(String name, String description, Integer daysPerWeek, boolean active,
                                             List<DailyPlanDayRequest> days) {
        return new DailyPlanTemplateRequest(name, description, "Beginner", daysPerWeek, active, days);
    }

    @Test
    @DisplayName("create: ten rong -> 400")
    void createRejectsBlankName() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.create(request("   ", "desc", 1, true, List.of(day(1, "WO-1"))), EMAIL));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("create: ten qua 60 ky tu -> 400")
    void createRejectsTooLongName() {
        assertThrows(ResponseStatusException.class,
                () -> service.create(request("x".repeat(61), "desc", 1, true, List.of(day(1, "WO-1"))), EMAIL));
    }

    @Test
    @DisplayName("create: mo ta qua 300 ky tu -> 400")
    void createRejectsTooLongDescription() {
        assertThrows(ResponseStatusException.class,
                () -> service.create(request("Name", "d".repeat(301), 1, true, List.of(day(1, "WO-1"))), EMAIL));
    }

    @Test
    @DisplayName("create: so ngay tap ngoai 1..7 -> 400")
    void createRejectsInvalidDaysPerWeek() {
        assertThrows(ResponseStatusException.class,
                () -> service.create(request("Name", "desc", 9, true, List.of(day(1, "WO-1"))), EMAIL));
        assertThrows(ResponseStatusException.class,
                () -> service.create(request("Name", "desc", 0, true, List.of(day(1, "WO-1"))), EMAIL));
    }

    @Test
    @DisplayName("create: khong gan ngay tap nao -> 400")
    void createRejectsEmptyDays() {
        assertThrows(ResponseStatusException.class,
                () -> service.create(request("Name", "desc", 1, true, List.of()), EMAIL));
    }

    @Test
    @DisplayName("create: ngay tap ngoai khoang -> 400")
    void createRejectsDayOutOfRange() {
        assertThrows(ResponseStatusException.class,
                () -> service.create(request("Name", "desc", 3, true, List.of(day(5, "WO-1"))), EMAIL));
    }

    @Test
    @DisplayName("create: ngay tap trung nhau -> 400")
    void createRejectsDuplicateDay() {
        assertThrows(ResponseStatusException.class,
                () -> service.create(request("Name", "desc", 3, true,
                        List.of(day(1, "WO-1"), day(1, "WO-2"))), EMAIL));
    }

    @Test
    @DisplayName("create: ngay tap thieu workoutCode -> 400")
    void createRejectsDayWithoutWorkoutCode() {
        assertThrows(ResponseStatusException.class,
                () -> service.create(request("Name", "desc", 1, true, List.of(day(1, "  "))), EMAIL));
    }

    @Test
    @DisplayName("create: workout khong ton tai -> 400")
    void createRejectsMissingWorkout() {
        when(workouts.findByCode("WO-1")).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class,
                () -> service.create(request("Name", "desc", 1, true, List.of(day(1, "WO-1"))), EMAIL));
    }

    @Test
    @DisplayName("create: workout la DAILY_TRAINING_PLAN -> 400")
    void createRejectsPlanWorkout() {
        WorkoutEntry plan = workout("WO-1", "Plan", "Beginner", true);
        plan.setType("DAILY_TRAINING_PLAN");
        when(workouts.findByCode("WO-1")).thenReturn(Optional.of(plan));

        assertThrows(ResponseStatusException.class,
                () -> service.create(request("Name", "desc", 1, true, List.of(day(1, "WO-1"))), EMAIL));
    }

    @Test
    @DisplayName("create: workout khac level -> 400")
    void createRejectsWorkoutWithDifferentLevel() {
        when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout("WO-1", "W1", "Advanced", true)));

        assertThrows(ResponseStatusException.class,
                () -> service.create(request("Name", "desc", 1, true, List.of(day(1, "WO-1"))), EMAIL));
    }

    @Test
    @DisplayName("create: workout dang inactive va plan active -> 400")
    void createRejectsInactiveWorkout() {
        when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout("WO-1", "W1", "Beginner", false)));

        assertThrows(ResponseStatusException.class,
                () -> service.create(request("Name", "desc", 1, true, List.of(day(1, "WO-1"))), EMAIL));
    }

    @Test
    @DisplayName("create: chua gan het so ngay tap -> 400")
    void createRejectsMissingTrainingDay() {
        when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout("WO-1", "W1", "Beginner", true)));

        assertThrows(ResponseStatusException.class,
                () -> service.create(request("Name", "desc", 3, true, List.of(day(1, "WO-1"))), EMAIL));
    }

    @Test
    @DisplayName("create: level rong -> 400")
    void createRejectsBlankLevel() {
        assertThrows(ResponseStatusException.class,
                () -> service.create(new DailyPlanTemplateRequest(
                        "Name", "desc", "  ", 1, true, List.of(day(1, "WO-1"))), EMAIL));
    }

    @Test
    @DisplayName("create: level khong ton tai -> 400")
    void createRejectsUnknownLevel() {
        when(fitnessLevels.findByNameIgnoreCase("NoSuch")).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class,
                () -> service.create(new DailyPlanTemplateRequest(
                        "Name", "desc", "NoSuch", 1, true, List.of(day(1, "WO-1"))), EMAIL));
    }
}
