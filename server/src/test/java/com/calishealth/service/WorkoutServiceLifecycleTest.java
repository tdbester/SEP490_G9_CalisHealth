package com.calishealth.service;

import com.calishealth.dtos.ExerciseDtos.CloneWorkoutRequest;
import com.calishealth.dtos.ExerciseDtos.CreateWorkoutRequest;
import com.calishealth.dtos.ExerciseDtos.QuickUpdateWorkoutRequest;
import com.calishealth.dtos.ExerciseDtos.WorkoutExerciseItemRequest;
import com.calishealth.dtos.ExerciseDtos.WorkoutResponse;
import com.calishealth.models.Exercise;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.User;
import com.calishealth.models.WorkoutEntry;
import com.calishealth.models.WorkoutExerciseItem;
import com.calishealth.models.WorkoutPlanItem;
import com.calishealth.repository.ExerciseRepository;
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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Unit test bo sung cho cac nhanh chua chay cua {@link WorkoutService}. */
@ExtendWith(MockitoExtension.class)
class WorkoutServiceLifecycleTest {
    @Mock private WorkoutRepository workouts;
    @Mock private ExerciseRepository exercises;
    @Mock private UserRepository users;
    @Mock private FitnessLevelRepository fitnessLevels;
    @Mock private ContentNameGuardService contentNameGuard;
    @InjectMocks private WorkoutService service;

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

    private static Exercise exercise(String code, String name, String category, boolean system) {
        Exercise exercise = new Exercise();
        exercise.setCode(code);
        exercise.setName(name);
        exercise.setCategory(category);
        exercise.setType("HEALTH");
        exercise.setDifficultyLevel("Beginner");
        exercise.setDefaultSets(3);
        exercise.setDefaultReps(10);
        exercise.setDuration(45);
        exercise.setActive(true);
        if (system) {
            exercise.setSource("SYSTEM");
        } else {
            exercise.setSource("CUSTOM");
            exercise.setCreatedBy(creator());
        }
        return exercise;
    }

    private static WorkoutEntry workout(String code, String name, String type, String level, String status) {
        WorkoutEntry workout = new WorkoutEntry();
        workout.setId(1L);
        workout.setCode(code);
        workout.setName(name);
        workout.setDescription("description");
        workout.setType(type);
        workout.setLevel(level);
        workout.setTemplateStatus(status);
        workout.setSource("SYSTEM");
        workout.setUpdatedAt(LocalDateTime.of(2026, 1, 1, 0, 0));
        workout.setCreatedBy(creator());
        return workout;
    }

    private static WorkoutExerciseItem item(Exercise exercise, int sets, Integer reps, Integer duration) {
        WorkoutExerciseItem entry = new WorkoutExerciseItem();
        entry.setExercise(exercise);
        entry.setSets(sets);
        entry.setReps(reps);
        entry.setDurationSeconds(duration);
        entry.setRestSeconds(60);
        return entry;
    }

    private CreateWorkoutRequest request(String name) {
        return new CreateWorkoutRequest(name, "Workout description", "HEALTH", "Beginner",
                3, 1, "PUBLISHED", List.of("PUSH_UP"), null, null);
    }

    // ---------------------------------------------------------------- findAll

    @Test
    @DisplayName("findAll: sap xep theo updatedAt giam dan")
    void findAllSortsByUpdatedAtDesc() {
        WorkoutEntry older = workout("WO-1", "Older", "WORKOUT", "Beginner", "PUBLISHED");
        WorkoutEntry newer = workout("WO-2", "Newer", "WORKOUT", "Beginner", "PUBLISHED");
        older.setUpdatedAt(LocalDateTime.of(2026, 1, 1, 0, 0));
        newer.setUpdatedAt(LocalDateTime.of(2026, 2, 1, 0, 0));
        lenient().when(workouts.findAll()).thenReturn(List.of(older, newer));

        List<WorkoutResponse> result = service.findAll();

        assertEquals(2, result.size());
        assertEquals("Newer", result.get(0).name());
    }

    @Test
    @DisplayName("findByCode: tra ve workout")
    void findByCodeReturnsWorkout() {
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout("WO-1", "W", "WORKOUT", "Beginner", "PUBLISHED")));

        assertEquals("W", service.findByCode("WO-1").name());
    }

    @Test
    @DisplayName("findByCode: khong tim thay -> 404")
    void findByCodeRejectsUnknownCode() {
        lenient().when(workouts.findByCode("X")).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.findByCode("X"));
        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
    }

    // ------------------------------------------------------------ updateStatus

    @Test
    @DisplayName("updateStatus: bat active -> templateStatus = PUBLISHED")
    void updateStatusPublishesWorkout() {
        WorkoutEntry workout = workout("WO-1", "W", "WORKOUT", "Beginner", "DRAFT");
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));
        lenient().when(workouts.saveAndFlush(any(WorkoutEntry.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        WorkoutResponse response = service.updateStatus("WO-1", true);

        assertEquals("PUBLISHED", response.templateStatus());
        assertTrue(response.active());
    }

    @Test
    @DisplayName("updateStatus: tat active -> templateStatus = DRAFT")
    void updateStatusUnpublishesWorkout() {
        WorkoutEntry workout = workout("WO-1", "W", "WORKOUT", "Beginner", "PUBLISHED");
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout));
        lenient().when(workouts.saveAndFlush(any(WorkoutEntry.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        WorkoutResponse response = service.updateStatus("WO-1", false);

        assertEquals("DRAFT", response.templateStatus());
        assertFalse(response.active());
    }

    @Test
    @DisplayName("updateStatus: level dang inactive -> 409")
    void updateStatusRejectsInactiveLevel() {
        WorkoutEntry workout = workout("WO-1", "W", "WORKOUT", "Beginner", "DRAFT");
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "INACTIVE")));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.updateStatus("WO-1", true));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    @DisplayName("updateStatus: khong tim thay workout -> 404")
    void updateStatusRejectsUnknownWorkout() {
        lenient().when(workouts.findByCode("X")).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class, () -> service.updateStatus("X", true));
    }

    // ------------------------------------------------------------ deleteByCode

    @Test
    @DisplayName("deleteByCode: xoa workout")
    void deleteByCodeRemovesWorkout() {
        WorkoutEntry workout = workout("WO-1", "W", "WORKOUT", "Beginner", "DRAFT");
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout));

        service.deleteByCode("WO-1");

        verify(workouts).delete(workout);
        verify(workouts).flush();
    }

    @Test
    @DisplayName("deleteByCode: bi rang buoc du lieu -> 409")
    void deleteByCodeReportsConstraintViolation() {
        WorkoutEntry workout = workout("WO-1", "W", "WORKOUT", "Beginner", "DRAFT");
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout));
        org.mockito.Mockito.doThrow(new org.springframework.dao.DataIntegrityViolationException("fk"))
                .when(workouts).delete(workout);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.deleteByCode("WO-1"));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    @DisplayName("deleteByCode: khong tim thay -> 404")
    void deleteByCodeRejectsUnknownWorkout() {
        lenient().when(workouts.findByCode("X")).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class, () -> service.deleteByCode("X"));
    }

    // ----------------------------------------------------------------- update

    @Test
    @DisplayName("update: doi ten + doi bai tap")
    void updateChangesWorkout() {
        WorkoutEntry workout = workout("WO-1", "Old name", "WORKOUT", "Beginner", "PUBLISHED");
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));
        lenient().when(exercises.findAllByCodeIn(List.of("PUSH_UP"))).thenReturn(List.of(pushUp));

        WorkoutResponse response = service.update("WO-1", request("New name"));

        assertEquals("New name", response.name());
        assertEquals(1, response.exercises().size());
        verify(contentNameGuard).assertWorkoutNameNotUsedByExercise("New name", null);
        verify(contentNameGuard).assertSystemWorkoutNameNotUsedByWorkout("New name", workout.getId());
    }

    @Test
    @DisplayName("update: giu nguyen ten thi khong chay kiem tra trung ten")
    void updateKeepsSameNameWithoutGuard() {
        WorkoutEntry workout = workout("WO-1", "Old name", "WORKOUT", "Beginner", "PUBLISHED");
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));
        lenient().when(exercises.findAllByCodeIn(List.of("PUSH_UP"))).thenReturn(List.of(pushUp));

        service.update("WO-1", request("Old name"));

        verify(contentNameGuard, never()).assertWorkoutNameNotUsedByExercise(anyString(), any());
    }

    @Test
    @DisplayName("update: lich tap 7 ngay khong sua duoc -> 400")
    void updateRejectsDailyTrainingPlan() {
        WorkoutEntry workout = workout("WO-1", "Plan", "DAILY_TRAINING_PLAN", "Beginner", "PUBLISHED");
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.update("WO-1", request("New name")));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("update: chuyen sang level inactive -> 400")
    void updateRejectsMovingToInactiveLevel() {
        WorkoutEntry workout = workout("WO-1", "Old name", "WORKOUT", "Beginner", "PUBLISHED");
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Advanced")).thenReturn(Optional.of(level("Advanced", "INACTIVE")));
        lenient().when(exercises.findAllByCodeIn(List.of("PUSH_UP"))).thenReturn(List.of(pushUp));

        CreateWorkoutRequest advancedRequest = new CreateWorkoutRequest("Old name", "d", "HEALTH", "Advanced",
                3, 1, "PUBLISHED", List.of("PUSH_UP"), null, null);

        assertThrows(ResponseStatusException.class, () -> service.update("WO-1", advancedRequest));
    }

    @Test
    @DisplayName("update: khong tim thay workout -> 404")
    void updateRejectsUnknownWorkout() {
        lenient().when(workouts.findByCode("X")).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class, () -> service.update("X", request("Name")));
    }

    // ----------------------------------------------------------- cloneTemplate

    @Test
    @DisplayName("clone: tao ban sao DRAFT voi ten tu sinh")
    void cloneTemplateGeneratesName() {
        WorkoutEntry source = workout("WO-1", "Full Body A", "WORKOUT", "Beginner", "PUBLISHED");
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        source.setExercises(new ArrayList<>(List.of(item(pushUp, 3, 10, null))));
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(source));
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(creator()));
        lenient().when(workouts.save(any(WorkoutEntry.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        WorkoutResponse copy = service.cloneTemplate("WO-1", new CloneWorkoutRequest(null), EMAIL);

        assertEquals("Full Body A - Copy", copy.name());
        assertEquals("DRAFT", copy.templateStatus());
        assertEquals(1, copy.exercises().size());
    }

    @Test
    @DisplayName("clone: bo hau to Month N khi sinh ten")
    void cloneTemplateStripsMonthSuffix() {
        WorkoutEntry source = workout("WO-1", "Full Body A - Month 1", "WORKOUT", "Beginner", "PUBLISHED");
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(source));
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(creator()));
        lenient().when(workouts.save(any(WorkoutEntry.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        assertEquals("Full Body A - Copy", service.cloneTemplate("WO-1", null, EMAIL).name());
    }

    @Test
    @DisplayName("clone: ten do CM dat qua 60 ky tu -> 400")
    void cloneTemplateRejectsLongName() {
        WorkoutEntry source = workout("WO-1", "W", "WORKOUT", "Beginner", "PUBLISHED");
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(source));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.cloneTemplate("WO-1", new CloneWorkoutRequest("x".repeat(80)), EMAIL));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("clone: ten do CM dat -> chay kiem tra trung ten")
    void cloneTemplateRunsNameGuard() {
        WorkoutEntry source = workout("WO-1", "W", "WORKOUT", "Beginner", "PUBLISHED");
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(source));
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(creator()));
        lenient().when(workouts.save(any(WorkoutEntry.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.cloneTemplate("WO-1", new CloneWorkoutRequest("Custom copy"), EMAIL);

        verify(contentNameGuard).assertWorkoutNameNotUsedByExercise("Custom copy", null);
        verify(contentNameGuard).assertSystemWorkoutNameNotUsedByWorkout("Custom copy", null);
    }

    @Test
    @DisplayName("clone: lich tap 7 ngay khong clone duoc -> 400")
    void cloneTemplateRejectsDailyTrainingPlan() {
        WorkoutEntry source = workout("WO-1", "Plan", "DAILY_TRAINING_PLAN", "Beginner", "PUBLISHED");
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(source));

        assertThrows(ResponseStatusException.class,
                () -> service.cloneTemplate("WO-1", new CloneWorkoutRequest(null), EMAIL));
    }

    @Test
    @DisplayName("clone: khong tim thay người tao -> 401")
    void cloneTemplateRejectsUnknownCreator() {
        WorkoutEntry source = workout("WO-1", "W", "WORKOUT", "Beginner", "PUBLISHED");
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(source));
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.cloneTemplate("WO-1", new CloneWorkoutRequest(null), EMAIL));
        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
    }

    @Test
    @DisplayName("clone: khong tim thay workout -> 404")
    void cloneTemplateRejectsUnknownWorkout() {
        lenient().when(workouts.findByCode("X")).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class, () -> service.cloneTemplate("X", null, EMAIL));
    }

    // ------------------------------------------------------------ quickUpdate

    @Test
    @DisplayName("quickUpdate: tang sets va reps cho moi bai")
    void quickUpdateAppliesDeltas() {
        WorkoutEntry workout = workout("WO-1", "W", "WORKOUT", "Beginner", "PUBLISHED");
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        workout.setExercises(new ArrayList<>(List.of(item(pushUp, 3, 10, null))));
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout));
        lenient().when(workouts.saveAndFlush(any(WorkoutEntry.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        WorkoutResponse response = service.quickUpdate("WO-1", new QuickUpdateWorkoutRequest(1, 5, null));

        assertEquals(4, response.exercises().get(0).sets());
        assertEquals(15, response.exercises().get(0).reps());
    }

    @Test
    @DisplayName("quickUpdate: tang duration cho bai HOLD")
    void quickUpdateAppliesDurationDelta() {
        WorkoutEntry workout = workout("WO-1", "W", "WORKOUT", "Beginner", "PUBLISHED");
        Exercise plank = exercise("PLANK", "Plank", "HOLD", true);
        workout.setExercises(new ArrayList<>(List.of(item(plank, 3, null, 30))));
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout));
        lenient().when(workouts.saveAndFlush(any(WorkoutEntry.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        WorkoutResponse response = service.quickUpdate("WO-1", new QuickUpdateWorkoutRequest(0, 0, 15));

        assertEquals(45, response.exercises().get(0).durationSeconds());
    }

    @Test
    @DisplayName("quickUpdate: gia tri vuot khoang cho phep -> 400")
    void quickUpdateRejectsOutOfRangeDelta() {
        WorkoutEntry workout = workout("WO-1", "W", "WORKOUT", "Beginner", "PUBLISHED");
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout));

        assertThrows(ResponseStatusException.class,
                () -> service.quickUpdate("WO-1", new QuickUpdateWorkoutRequest(50, 0, 0)));
    }

    @Test
    @DisplayName("quickUpdate: khong co thay doi nao -> 400")
    void quickUpdateRejectsEmptyDelta() {
        WorkoutEntry workout = workout("WO-1", "W", "WORKOUT", "Beginner", "PUBLISHED");
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.quickUpdate("WO-1", new QuickUpdateWorkoutRequest(0, 0, 0)));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("quickUpdate: lich tap 7 ngay khong duoc -> 400")
    void quickUpdateRejectsDailyTrainingPlan() {
        WorkoutEntry workout = workout("WO-1", "Plan", "DAILY_TRAINING_PLAN", "Beginner", "PUBLISHED");
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout));

        assertThrows(ResponseStatusException.class,
                () -> service.quickUpdate("WO-1", new QuickUpdateWorkoutRequest(1, 0, 0)));
    }

    @Test
    @DisplayName("quickUpdate: khong tim thay workout -> 404")
    void quickUpdateRejectsUnknownWorkout() {
        lenient().when(workouts.findByCode("X")).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class,
                () -> service.quickUpdate("X", new QuickUpdateWorkoutRequest(1, 0, 0)));
    }

    // --------------------------------------------------------------- create

    @Test
    @DisplayName("create: bai HOLD dung duration, mac dinh 30 giay")
    void createUsesHoldDefaults() {
        Exercise plank = exercise("PLANK", "Plank", "HOLD", true);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(creator()));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));
        lenient().when(exercises.findAllByCodeIn(List.of("PLANK"))).thenReturn(List.of(plank));
        lenient().when(workouts.save(any(WorkoutEntry.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        WorkoutResponse response = service.create(new CreateWorkoutRequest(
                "Plank workout", "d", "HEALTH", "Beginner", 3, 1, "PUBLISHED",
                List.of("PLANK"), null, null), EMAIL);

        assertEquals("DURATION", response.exercises().get(0).countBy());
        assertEquals(45, response.exercises().get(0).durationSeconds());
        assertNull(response.exercises().get(0).reps());
    }

    @Test
    @DisplayName("create: bai REPS dung reps, mac dinh 10")
    void createUsesRepsDefaults() {
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(creator()));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));
        lenient().when(exercises.findAllByCodeIn(List.of("PUSH_UP"))).thenReturn(List.of(pushUp));
        lenient().when(workouts.save(any(WorkoutEntry.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        WorkoutResponse response = service.create(new CreateWorkoutRequest(
                "Push-up workout", "d", "HEALTH", "Beginner", 3, 1, "PUBLISHED",
                List.of("PUSH_UP"), null, null), EMAIL);

        assertEquals("REPS", response.exercises().get(0).countBy());
        assertEquals(10, response.exercises().get(0).reps());
        assertNull(response.exercises().get(0).durationSeconds());
    }

    @Test
    @DisplayName("create: items co cau hinh rieng duoc dung")
    void createUsesProvidedItemSettings() {
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(creator()));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));
        lenient().when(exercises.findAllByCodeIn(List.of("PUSH_UP"))).thenReturn(List.of(pushUp));
        lenient().when(workouts.save(any(WorkoutEntry.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        WorkoutResponse response = service.create(new CreateWorkoutRequest(
                "Custom workout", "d", "HEALTH", "Beginner", 3, 1, "PUBLISHED",
                null, null, List.of(new WorkoutExerciseItemRequest("PUSH_UP", 5, 20, null, 45))), EMAIL);

        assertEquals(5, response.exercises().get(0).sets());
        assertEquals(20, response.exercises().get(0).reps());
        assertEquals(45, response.exercises().get(0).restSeconds());
    }

    @Test
    @DisplayName("create: bai tap khong con ton tai -> 400")
    void createRejectsMissingExercise() {
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(creator()));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));
        lenient().when(exercises.findAllByCodeIn(List.of("PUSH_UP"))).thenReturn(List.of());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.create(request("Name"), EMAIL));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("create: bai tap dang inactive -> 400")
    void createRejectsInactiveExercise() {
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        pushUp.setActive(false);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(creator()));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));
        lenient().when(exercises.findAllByCodeIn(List.of("PUSH_UP"))).thenReturn(List.of(pushUp));

        assertThrows(ResponseStatusException.class, () -> service.create(request("Name"), EMAIL));
    }

    @Test
    @DisplayName("create: bai tap cua member -> 400")
    void createRejectsCustomExercise() {
        Exercise custom = exercise("MY_EX", "My ex", "REPS", false);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(creator()));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));
        lenient().when(exercises.findAllByCodeIn(List.of("MY_EX"))).thenReturn(List.of(custom));

        assertThrows(ResponseStatusException.class, () -> service.create(new CreateWorkoutRequest(
                "Name", "d", "HEALTH", "Beginner", 3, 1, "PUBLISHED",
                List.of("MY_EX"), null, null), EMAIL));
    }

    @Test
    @DisplayName("create: level khong ton tai -> 400")
    void createRejectsUnknownLevel() {
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.create(request("Name"), EMAIL));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("create: level khong co (null) -> 400")
    void createRejectsNullLevel() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.create(new CreateWorkoutRequest(
                        "Name", "d", "HEALTH", null, 3, 1, "PUBLISHED",
                        List.of("PUSH_UP"), null, null), EMAIL));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("create: level dang inactive -> 400")
    void createRejectsInactiveLevel() {
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "INACTIVE")));

        assertThrows(ResponseStatusException.class, () -> service.create(request("Name"), EMAIL));
    }

    @Test
    @DisplayName("create: khong co bai tap nao -> 400")
    void createRejectsEmptyExerciseList() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.create(new CreateWorkoutRequest(
                        "Name", "d", "HEALTH", "Beginner", 3, 1, "PUBLISHED",
                        List.of(), null, null), EMAIL));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("create: ten qua 60 ky tu -> 400")
    void createRejectsTooLongName() {
        assertThrows(ResponseStatusException.class, () -> service.create(
                new CreateWorkoutRequest("x".repeat(70), "d", "HEALTH", "Beginner", 3, 1, "PUBLISHED",
                        List.of("PUSH_UP"), null, null), EMAIL));
    }

    @Test
    @DisplayName("create: mo ta qua 300 ky tu -> 400")
    void createRejectsTooLongDescription() {
        assertThrows(ResponseStatusException.class, () -> service.create(
                new CreateWorkoutRequest("Name", "d".repeat(400), "HEALTH", "Beginner", 3, 1, "PUBLISHED",
                        List.of("PUSH_UP"), null, null), EMAIL));
    }

    @Test
    @DisplayName("create: so ngay tap ngoai 1..7 -> 400")
    void createRejectsInvalidDaysPerWeek() {
        assertThrows(ResponseStatusException.class, () -> service.create(
                new CreateWorkoutRequest("Name", "d", "HEALTH", "Beginner", 9, 1, "PUBLISHED",
                        List.of("PUSH_UP"), null, null), EMAIL));
    }

    @Test
    @DisplayName("create: thu tu ngay vuot so ngay tap -> 400")
    void createRejectsInvalidDaySequence() {
        assertThrows(ResponseStatusException.class, () -> service.create(
                new CreateWorkoutRequest("Name", "d", "HEALTH", "Beginner", 3, 5, "PUBLISHED",
                        List.of("PUSH_UP"), null, null), EMAIL));
    }

    @Test
    @DisplayName("create: sets ngoai 1..20 -> 400")
    void createRejectsInvalidSets() {
        assertThrows(ResponseStatusException.class, () -> service.create(
                new CreateWorkoutRequest("Name", "d", "HEALTH", "Beginner", 3, 1, "PUBLISHED",
                        null, null, List.of(new WorkoutExerciseItemRequest("PUSH_UP", 30, 10, null, null))), EMAIL));
    }

    @Test
    @DisplayName("create: reps ngoai 1..100 -> 400")
    void createRejectsInvalidReps() {
        assertThrows(ResponseStatusException.class, () -> service.create(
                new CreateWorkoutRequest("Name", "d", "HEALTH", "Beginner", 3, 1, "PUBLISHED",
                        null, null, List.of(new WorkoutExerciseItemRequest("PUSH_UP", 3, 500, null, null))), EMAIL));
    }

    @Test
    @DisplayName("create: duration ngoai 1..3600 -> 400")
    void createRejectsInvalidDuration() {
        assertThrows(ResponseStatusException.class, () -> service.create(
                new CreateWorkoutRequest("Name", "d", "HEALTH", "Beginner", 3, 1, "PUBLISHED",
                        null, null, List.of(new WorkoutExerciseItemRequest("PUSH_UP", 3, null, 9999, null))), EMAIL));
    }

    @Test
    @DisplayName("create: rest ngoai 0..3600 -> 400")
    void createRejectsInvalidRest() {
        assertThrows(ResponseStatusException.class, () -> service.create(
                new CreateWorkoutRequest("Name", "d", "HEALTH", "Beginner", 3, 1, "PUBLISHED",
                        null, null, List.of(new WorkoutExerciseItemRequest("PUSH_UP", 3, 10, null, -5))), EMAIL));
    }

    @Test
    @DisplayName("create: ma bai tap rong -> 400")
    void createRejectsBlankExerciseCode() {
        assertThrows(ResponseStatusException.class, () -> service.create(
                new CreateWorkoutRequest("Name", "d", "HEALTH", "Beginner", 3, 1, "PUBLISHED",
                        null, null, List.of(new WorkoutExerciseItemRequest(" ", 3, 10, null, null))), EMAIL));
    }

    @Test
    @DisplayName("create: ma bai tap rong trong exerciseCodes -> 400")
    void createRejectsBlankExerciseCodeInCodes() {
        assertThrows(ResponseStatusException.class, () -> service.create(
                new CreateWorkoutRequest("Name", "d", "HEALTH", "Beginner", 3, 1, "PUBLISHED",
                        List.of(" "), null, null), EMAIL));
    }

    @Test
    @DisplayName("create: type khong hop le -> 400")
    void createRejectsInvalidType() {
        assertThrows(ResponseStatusException.class, () -> service.create(
                new CreateWorkoutRequest("Name", "d", "YOGA", "Beginner", 3, 1, "PUBLISHED",
                        List.of("PUSH_UP"), null, null), EMAIL));
    }

    @Test
    @DisplayName("create: template status khong hop le -> 400")
    void createRejectsInvalidTemplateStatus() {
        assertThrows(ResponseStatusException.class, () -> service.create(
                new CreateWorkoutRequest("Name", "d", "HEALTH", "Beginner", 3, 1, "PENDING",
                        List.of("PUSH_UP"), null, null), EMAIL));
    }

    @Test
    @DisplayName("create: null request -> 400")
    void createRejectsNullRequest() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.create(null, EMAIL));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("create: khong tim thay nguoi tao -> 401")
    void createRejectsUnknownCreator() {
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));
        lenient().when(exercises.findAllByCodeIn(List.of("PUSH_UP")))
                .thenReturn(List.of(exercise("PUSH_UP", "Push-up", "REPS", true)));
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.create(request("Name"), EMAIL));
        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
    }

    @Test
    @DisplayName("create: type rong -> mac dinh WORKOUT")
    void createDefaultsType() {
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(creator()));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));
        lenient().when(exercises.findAllByCodeIn(List.of("PUSH_UP"))).thenReturn(List.of(pushUp));
        lenient().when(workouts.save(any(WorkoutEntry.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        WorkoutResponse response = service.create(new CreateWorkoutRequest(
                "Name", "d", null, "Beginner", 3, 1, "PUBLISHED",
                List.of("PUSH_UP"), null, null), EMAIL);

        assertEquals("WORKOUT", response.type());
    }

    // ------------------------------------------------------- toResponse extras

    @Test
    @DisplayName("toResponse: lich tap 7 ngay lay bai tu planItems")
    void toResponseUsesPlanItemsForDailyPlan() {
        WorkoutEntry plan = workout("WO-1", "Plan", "DAILY_TRAINING_PLAN", "Beginner", "PUBLISHED");
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        WorkoutPlanItem planItem = new WorkoutPlanItem();
        planItem.setWorkout(plan);
        planItem.setExercise(pushUp);
        planItem.setDayOfWeek(1);
        planItem.setBeginnerSets(2);
        planItem.setBeginnerReps(10);
        planItem.setIntermediateSets(3);
        planItem.setIntermediateReps(12);
        planItem.setAdvancedSets(4);
        planItem.setAdvancedReps(15);
        plan.setPlanItems(new ArrayList<>(List.of(planItem)));
        lenient().when(workouts.findAll()).thenReturn(List.of(plan));

        WorkoutResponse response = service.findAll().get(0);

        assertEquals(1, response.exercises().size());
        assertEquals("PUSH_UP", response.exercises().get(0).code());
        assertNull(response.exercises().get(0).countBy());
        assertEquals(1, response.planItems().size());
        assertEquals(1, response.planItems().get(0).dayOfWeek());
    }

    @Test
    @DisplayName("toResponse: ten nguoi tao hien thi")
    void toResponseIncludesCreatorName() {
        WorkoutEntry workout = workout("WO-1", "W", "WORKOUT", "Beginner", "PUBLISHED");
        lenient().when(workouts.findAll()).thenReturn(List.of(workout));

        assertEquals("Content Manager", service.findAll().get(0).createdByName());
    }

    @Test
    @DisplayName("toResponse: khong co nguoi tao -> null")
    void toResponseHandlesNullCreator() {
        WorkoutEntry workout = workout("WO-1", "W", "WORKOUT", "Beginner", "PUBLISHED");
        workout.setCreatedBy(null);
        lenient().when(workouts.findAll()).thenReturn(List.of(workout));

        assertNull(service.findAll().get(0).createdByName());
    }

    @Test
    @DisplayName("toResponse: khong co muscle group -> null")
    void toResponseHandlesEmptyMuscleGroups() {
        WorkoutEntry workout = workout("WO-1", "W", "WORKOUT", "Beginner", "PUBLISHED");
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        pushUp.setMuscleGroups(new ArrayList<>());
        workout.setExercises(new ArrayList<>(List.of(item(pushUp, 3, 10, null))));
        lenient().when(workouts.findAll()).thenReturn(List.of(workout));

        WorkoutResponse response = service.findAll().get(0);

        assertNotNull(response);
        assertNull(response.exercises().get(0).muscleGroup());
    }
}
