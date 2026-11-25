package com.calishealth.service;

import com.calishealth.dtos.DailyPlanDtos.DailyPlanDayRequest;
import com.calishealth.dtos.DailyPlanDtos.DailyPlanDayResponse;
import com.calishealth.dtos.DailyPlanDtos.DailyPlanTemplateRequest;
import com.calishealth.dtos.DailyPlanDtos.DailyPlanTemplateResponse;
import com.calishealth.models.DailyPlanDay;
import com.calishealth.models.DailyPlanTemplate;
import com.calishealth.models.Exercise;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.User;
import com.calishealth.models.WorkoutEntry;
import com.calishealth.models.WorkoutExerciseItem;
import com.calishealth.repository.DailyPlanTemplateRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.repository.WorkoutRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Unit test cho {@link DailyPlanTemplateService}. */
@ExtendWith(MockitoExtension.class)
class DailyPlanTemplateServiceTest {
    @Mock private DailyPlanTemplateRepository templates;
    @Mock private WorkoutRepository workouts;
    @Mock private FitnessLevelRepository fitnessLevels;
    @Mock private UserRepository users;
    @InjectMocks private DailyPlanTemplateService service;

    private static final String EMAIL = "cm@example.test";

    private static User creator() {
        User user = new User();
        user.setId(1L);
        user.setEmail(EMAIL);
        user.setFullName("Content Manager");
        return user;
    }

    private static FitnessLevel level(String name, String status) {
        FitnessLevel level = new FitnessLevel();
        level.setId(1L);
        level.setName(name);
        level.setStatus(status);
        return level;
    }

    private static Exercise exercise(String code, String name, String type) {
        Exercise exercise = new Exercise();
        exercise.setCode(code);
        exercise.setName(name);
        exercise.setType(type);
        exercise.setCategory("REPS");
        exercise.setSource("SYSTEM");
        return exercise;
    }

    private static WorkoutEntry workout(String code, String name, String workoutLevel, String status) {
        WorkoutEntry workout = new WorkoutEntry();
        workout.setId(1L);
        workout.setCode(code);
        workout.setName(name);
        workout.setType("WORKOUT");
        workout.setSource("SYSTEM");
        workout.setLevel(workoutLevel);
        workout.setTemplateStatus(status);
        WorkoutExerciseItem item = new WorkoutExerciseItem();
        item.setExercise(exercise("PUSH_UP", "Push-up", "HEALTH"));
        item.setSets(3);
        item.setReps(10);
        workout.setExercises(new ArrayList<>(List.of(item)));
        return workout;
    }

    private static DailyPlanTemplate template(String code, String level, int daysPerWeek, boolean active) {
        DailyPlanTemplate template = new DailyPlanTemplate();
        template.setId(1L);
        template.setCode(code);
        template.setName("Plan " + code);
        template.setDescription("desc");
        template.setLevel(level);
        template.setDaysPerWeek(daysPerWeek);
        template.setActive(active);
        template.setCreatedBy(creator());
        template.setUpdatedAt(LocalDateTime.of(2026, 1, 1, 0, 0));
        return template;
    }

    private DailyPlanDayRequest day(int dayNumber, String workoutCode) {
        return new DailyPlanDayRequest(dayNumber, workoutCode);
    }

    // ------------------------------------------------------------------ findAll

    @Test
    @DisplayName("findAll: sap xep theo updatedAt giam dan")
    void findAllSortsByUpdatedAtDesc() {
        DailyPlanTemplate older = template("DP-1", "Beginner", 3, true);
        DailyPlanTemplate newer = template("DP-2", "Beginner", 3, true);
        older.setUpdatedAt(LocalDateTime.of(2026, 1, 1, 0, 0));
        newer.setUpdatedAt(LocalDateTime.of(2026, 2, 1, 0, 0));
        lenient().when(templates.findAll()).thenReturn(List.of(older, newer));

        List<DailyPlanTemplateResponse> result = service.findAll();

        assertEquals(2, result.size());
        assertEquals("DP-2", result.get(0).code());
    }

    @Test
    @DisplayName("findByCode: tra ve template")
    void findByCodeReturnsTemplate() {
        lenient().when(templates.findByCode("DP-1")).thenReturn(Optional.of(template("DP-1", "Beginner", 3, true)));

        assertEquals("DP-1", service.findByCode("DP-1").code());
    }

    @Test
    @DisplayName("findByCode: khong tim thay -> 404")
    void findByCodeRejectsUnknownCode() {
        lenient().when(templates.findByCode("X")).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.findByCode("X"));
        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
    }

    // ------------------------------------------------------------------ create

    @Test
    @DisplayName("create: tao template moi")
    void createStoresTemplate() {
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(creator()));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout("WO-1", "W1", "Beginner", "PUBLISHED")));
        lenient().when(templates.save(any(DailyPlanTemplate.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        DailyPlanTemplateResponse response = service.create(new DailyPlanTemplateRequest(
                "New plan", "desc", "Beginner", 1, true, List.of(day(1, "WO-1"))), EMAIL);

        assertEquals("New plan", response.name());
        assertTrue(response.active());
        assertEquals(1, response.days().size());
        assertEquals("W1", response.days().get(0).workoutName());
        assertEquals(1, response.days().get(0).exerciseCount());
        assertTrue(response.days().get(0).workoutActive());
        assertEquals(List.of("HEALTH"), response.days().get(0).workoutTypes());
    }

    @Test
    @DisplayName("create: null request -> 400")
    void createRejectsNullRequest() {
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(creator()));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.create(null, EMAIL));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("create: khong tim thay nguoi tao -> 401")
    void createRejectsUnknownCreator() {
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.create(new DailyPlanTemplateRequest(
                        "Name", "desc", "Beginner", 1, true, List.of(day(1, "WO-1"))), EMAIL));
        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
    }

    @Test
    @DisplayName("create: ten rong -> 400")
    void createRejectsBlankName() {
        assertThrows(ResponseStatusException.class, () -> service.create(new DailyPlanTemplateRequest(
                "  ", "desc", "Beginner", 1, true, List.of(day(1, "WO-1"))), EMAIL));
    }

    @Test
    @DisplayName("create: ten qua 60 ky tu -> 400")
    void createRejectsTooLongName() {
        assertThrows(ResponseStatusException.class, () -> service.create(new DailyPlanTemplateRequest(
                "x".repeat(70), "desc", "Beginner", 1, true, List.of(day(1, "WO-1"))), EMAIL));
    }

    @Test
    @DisplayName("create: mo ta qua 300 ky tu -> 400")
    void createRejectsTooLongDescription() {
        assertThrows(ResponseStatusException.class, () -> service.create(new DailyPlanTemplateRequest(
                "Name", "d".repeat(400), "Beginner", 1, true, List.of(day(1, "WO-1"))), EMAIL));
    }

    @Test
    @DisplayName("create: so ngay tap ngoai 1..7 -> 400")
    void createRejectsInvalidDaysPerWeek() {
        assertThrows(ResponseStatusException.class, () -> service.create(new DailyPlanTemplateRequest(
                "Name", "desc", "Beginner", 9, true, List.of(day(1, "WO-1"))), EMAIL));
    }

    @Test
    @DisplayName("create: level khong ton tai -> 400")
    void createRejectsUnknownLevel() {
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(creator()));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class, () -> service.create(new DailyPlanTemplateRequest(
                "Name", "desc", "Beginner", 1, true, List.of(day(1, "WO-1"))), EMAIL));
    }

    @Test
    @DisplayName("create: level rong -> 400")
    void createRejectsBlankLevel() {
        assertThrows(ResponseStatusException.class, () -> service.create(new DailyPlanTemplateRequest(
                "Name", "desc", " ", 1, true, List.of(day(1, "WO-1"))), EMAIL));
    }

    @Test
    @DisplayName("create: level dang inactive -> 409")
    void createRejectsInactiveLevel() {
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(creator()));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "INACTIVE")));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.create(new DailyPlanTemplateRequest(
                        "Name", "desc", "Beginner", 1, true, List.of(day(1, "WO-1"))), EMAIL));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    @DisplayName("create: khong gan ngay tap nao -> 400")
    void createRejectsEmptyDays() {
        assertThrows(ResponseStatusException.class, () -> service.create(new DailyPlanTemplateRequest(
                "Name", "desc", "Beginner", 1, true, List.of()), EMAIL));
    }

    @Test
    @DisplayName("create: ngay tap ngoai khoang -> 400")
    void createRejectsDayOutOfRange() {
        assertThrows(ResponseStatusException.class, () -> service.create(new DailyPlanTemplateRequest(
                "Name", "desc", "Beginner", 3, true, List.of(day(5, "WO-1"))), EMAIL));
    }

    @Test
    @DisplayName("create: ngay tap trung nhau -> 400")
    void createRejectsDuplicateDay() {
        assertThrows(ResponseStatusException.class, () -> service.create(new DailyPlanTemplateRequest(
                "Name", "desc", "Beginner", 3, true, List.of(day(1, "WO-1"), day(1, "WO-2"))), EMAIL));
    }

    @Test
    @DisplayName("create: chua gan het so ngay tap -> 400")
    void createRejectsMissingTrainingDay() {
        assertThrows(ResponseStatusException.class, () -> service.create(new DailyPlanTemplateRequest(
                "Name", "desc", "Beginner", 3, true, List.of(day(1, "WO-1"))), EMAIL));
    }

    @Test
    @DisplayName("create: workout khong ton tai -> 400")
    void createRejectsMissingWorkout() {
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(creator()));
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class, () -> service.create(new DailyPlanTemplateRequest(
                "Name", "desc", "Beginner", 1, true, List.of(day(1, "WO-1"))), EMAIL));
    }

    @Test
    @DisplayName("create: workout khong phai he thong -> 400")
    void createRejectsNonSystemWorkout() {
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(creator()));
        WorkoutEntry custom = workout("WO-1", "W1", "Beginner", "PUBLISHED");
        custom.setSource("CUSTOM");
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(custom));

        assertThrows(ResponseStatusException.class, () -> service.create(new DailyPlanTemplateRequest(
                "Name", "desc", "Beginner", 1, true, List.of(day(1, "WO-1"))), EMAIL));
    }

    @Test
    @DisplayName("create: workout khac level -> 400")
    void createRejectsWorkoutWithDifferentLevel() {
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(creator()));
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout("WO-1", "W1", "Advanced", "PUBLISHED")));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.create(new DailyPlanTemplateRequest(
                        "Name", "desc", "Beginner", 1, true, List.of(day(1, "WO-1"))), EMAIL));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("create: workout dang inactive -> 400")
    void createRejectsInactiveWorkout() {
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(creator()));
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout("WO-1", "W1", "Beginner", "DRAFT")));

        assertThrows(ResponseStatusException.class, () -> service.create(new DailyPlanTemplateRequest(
                "Name", "desc", "Beginner", 1, true, List.of(day(1, "WO-1"))), EMAIL));
    }

    @Test
    @DisplayName("create: luu template inactive thi dung kiem tra workout active")
    void createInactivePlanAllowsInactiveWorkout() {
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(creator()));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout("WO-1", "W1", "Beginner", "DRAFT")));
        lenient().when(templates.save(any(DailyPlanTemplate.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        DailyPlanTemplateResponse response = service.create(new DailyPlanTemplateRequest(
                "Name", "desc", "Beginner", 1, false, List.of(day(1, "WO-1"))), EMAIL);

        assertFalse(response.active());
    }

    @Test
    @DisplayName("create: da co plan active cung level va so ngay -> 409")
    void createRejectsConflictingActivePlan() {
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(creator()));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout("WO-1", "W1", "Beginner", "PUBLISHED")));
        lenient().when(templates.findAll()).thenReturn(List.of(template("DP-OTHER", "Beginner", 1, true)));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.create(new DailyPlanTemplateRequest(
                        "Name", "desc", "Beginner", 1, true, List.of(day(1, "WO-1"))), EMAIL));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    // ------------------------------------------------------------------ update

    @Test
    @DisplayName("update: doi thong tin template")
    void updateChangesTemplate() {
        DailyPlanTemplate template = template("DP-1", "Beginner", 1, true);
        lenient().when(templates.findByCode("DP-1")).thenReturn(Optional.of(template));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));
        lenient().when(workouts.findByCode("WO-2")).thenReturn(Optional.of(workout("WO-2", "W2", "Beginner", "PUBLISHED")));
        lenient().when(templates.saveAndFlush(any(DailyPlanTemplate.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        DailyPlanTemplateResponse response = service.update("DP-1", new DailyPlanTemplateRequest(
                "Renamed", "new desc", "Beginner", 1, true, List.of(day(1, "WO-2"))));

        assertEquals("Renamed", response.name());
        assertEquals("W2", response.days().get(0).workoutName());
    }

    @Test
    @DisplayName("update: doi level sang level dang inactive -> 409")
    void updateRejectsChangingToInactiveLevel() {
        DailyPlanTemplate template = template("DP-1", "Beginner", 1, true);
        lenient().when(templates.findByCode("DP-1")).thenReturn(Optional.of(template));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Advanced")).thenReturn(Optional.of(level("Advanced", "INACTIVE")));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.update("DP-1", new DailyPlanTemplateRequest(
                        "Renamed", "desc", "Advanced", 1, true, List.of(day(1, "WO-2")))));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    @DisplayName("update: khong tim thay template -> 404")
    void updateRejectsUnknownTemplate() {
        lenient().when(templates.findByCode("X")).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class, () -> service.update("X", new DailyPlanTemplateRequest(
                "Name", "desc", "Beginner", 1, true, List.of(day(1, "WO-1")))));
    }

    // ------------------------------------------------------------ updateStatus

    @Test
    @DisplayName("updateStatus: bat active")
    void updateStatusActivatesTemplate() {
        DailyPlanTemplate template = template("DP-1", "Beginner", 1, false);
        DailyPlanDay planDay = new DailyPlanDay();
        planDay.setDayNumber(1);
        planDay.setWorkout(workout("WO-1", "W1", "Beginner", "PUBLISHED"));
        template.setDays(new ArrayList<>(List.of(planDay)));
        lenient().when(templates.findByCode("DP-1")).thenReturn(Optional.of(template));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));
        lenient().when(templates.findAll()).thenReturn(List.of(template));
        lenient().when(templates.saveAndFlush(any(DailyPlanTemplate.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        assertTrue(service.updateStatus("DP-1", true).active());
    }

    @Test
    @DisplayName("updateStatus: tat active")
    void updateStatusDeactivatesTemplate() {
        DailyPlanTemplate template = template("DP-1", "Beginner", 1, true);
        lenient().when(templates.findByCode("DP-1")).thenReturn(Optional.of(template));
        lenient().when(templates.saveAndFlush(any(DailyPlanTemplate.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        assertFalse(service.updateStatus("DP-1", false).active());
    }

    @Test
    @DisplayName("updateStatus: trong plan co workout inactive -> 409")
    void updateStatusRejectsPlanWithInactiveWorkout() {
        DailyPlanTemplate template = template("DP-1", "Beginner", 1, false);
        DailyPlanDay planDay = new DailyPlanDay();
        planDay.setDayNumber(1);
        planDay.setWorkout(workout("WO-1", "W1", "Beginner", "DRAFT"));
        template.setDays(new ArrayList<>(List.of(planDay)));
        lenient().when(templates.findByCode("DP-1")).thenReturn(Optional.of(template));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.updateStatus("DP-1", true));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    @DisplayName("updateStatus: level dang inactive -> 409")
    void updateStatusRejectsInactiveLevel() {
        DailyPlanTemplate template = template("DP-1", "Beginner", 1, false);
        lenient().when(templates.findByCode("DP-1")).thenReturn(Optional.of(template));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "INACTIVE")));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.updateStatus("DP-1", true));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    @DisplayName("updateStatus: da co plan active trung -> 409")
    void updateStatusRejectsConflictingPlan() {
        DailyPlanTemplate template = template("DP-1", "Beginner", 1, false);
        DailyPlanDay planDay = new DailyPlanDay();
        planDay.setDayNumber(1);
        planDay.setWorkout(workout("WO-1", "W1", "Beginner", "PUBLISHED"));
        template.setDays(new ArrayList<>(List.of(planDay)));
        lenient().when(templates.findByCode("DP-1")).thenReturn(Optional.of(template));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));
        lenient().when(templates.findAll()).thenReturn(List.of(template("DP-OTHER", "Beginner", 1, true)));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.updateStatus("DP-1", true));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    @DisplayName("updateStatus: khong tim thay template -> 404")
    void updateStatusRejectsUnknownTemplate() {
        lenient().when(templates.findByCode("X")).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class, () -> service.updateStatus("X", true));
    }

    // ------------------------------------------------------------------ delete

    @Test
    @DisplayName("delete: xoa template")
    void deleteRemovesTemplate() {
        DailyPlanTemplate template = template("DP-1", "Beginner", 1, true);
        lenient().when(templates.findByCode("DP-1")).thenReturn(Optional.of(template));

        service.delete("DP-1");

        verify(templates).delete(template);
    }

    @Test
    @DisplayName("delete: khong tim thay template -> 404")
    void deleteRejectsUnknownTemplate() {
        lenient().when(templates.findByCode("X")).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class, () -> service.delete("X"));
    }

    // --------------------------------------------------------------- toResponse

    @Test
    @DisplayName("toResponse: ngay duoc sap xep theo thu tu ngay")
    void toResponseSortsDaysByNumber() {
        DailyPlanTemplate template = template("DP-1", "Beginner", 2, true);
        DailyPlanDay second = new DailyPlanDay();
        second.setDayNumber(2);
        second.setWorkout(workout("WO-2", "W2", "Beginner", "PUBLISHED"));
        DailyPlanDay first = new DailyPlanDay();
        first.setDayNumber(1);
        first.setWorkout(workout("WO-1", "W1", "Beginner", "PUBLISHED"));
        template.setDays(new ArrayList<>(List.of(second, first)));
        lenient().when(templates.findAll()).thenReturn(List.of(template));

        List<DailyPlanDayResponse> days = service.findAll().get(0).days();

        assertEquals(1, days.get(0).dayNumber());
        assertEquals(2, days.get(1).dayNumber());
    }

    @Test
    @DisplayName("toResponse: khong co nguoi tao -> null")
    void toResponseHandlesNullCreator() {
        DailyPlanTemplate template = template("DP-1", "Beginner", 1, true);
        template.setCreatedBy(null);
        lenient().when(templates.findAll()).thenReturn(List.of(template));

        assertNull(service.findAll().get(0).createdByName());
    }

    @Test
    @DisplayName("toResponse: workout type DAILY_TRAINING_PLAN lay bai tu planItems")
    void toResponseUsesPlanItemsForPlanWorkout() {
        DailyPlanTemplate template = template("DP-1", "Beginner", 1, true);
        WorkoutEntry plan = workout("WO-1", "Plan", "Beginner", "PUBLISHED");
        plan.setType("DAILY_TRAINING_PLAN");
        plan.setExercises(new ArrayList<>());
        com.calishealth.models.WorkoutPlanItem planItem = new com.calishealth.models.WorkoutPlanItem();
        planItem.setWorkout(plan);
        planItem.setExercise(exercise("SQUAT", "Squat", "FLEX"));
        planItem.setDayOfWeek(1);
        plan.setPlanItems(new ArrayList<>(List.of(planItem)));

        DailyPlanDay planDay = new DailyPlanDay();
        planDay.setDayNumber(1);
        planDay.setWorkout(plan);
        template.setDays(new ArrayList<>(List.of(planDay)));
        lenient().when(templates.findAll()).thenReturn(List.of(template));

        DailyPlanTemplateResponse response = service.findAll().get(0);

        assertEquals(0, response.days().get(0).exerciseCount());
        assertEquals(List.of("FLEX"), response.days().get(0).workoutTypes());
    }

    @Test
    @DisplayName("toResponse: muscle group rong -> danh sach rong")
    void toResponseHandlesEmptyMuscleGroups() {
        DailyPlanTemplate template = template("DP-1", "Beginner", 1, true);
        WorkoutEntry w = workout("WO-1", "W1", "Beginner", "PUBLISHED");
        w.getExercises().get(0).getExercise().setMuscleGroups(new ArrayList<>());
        DailyPlanDay planDay = new DailyPlanDay();
        planDay.setDayNumber(1);
        planDay.setWorkout(w);
        template.setDays(new ArrayList<>(List.of(planDay)));
        lenient().when(templates.findAll()).thenReturn(List.of(template));

        DailyPlanTemplateResponse response = service.findAll().get(0);

        assertNotNull(response);
        assertTrue(response.days().get(0).targetMuscles().isEmpty());
    }
}
