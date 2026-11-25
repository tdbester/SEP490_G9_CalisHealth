package com.calishealth.service;

import com.calishealth.dtos.ExerciseDtos.CreateWorkoutRequest;
import com.calishealth.dtos.ExerciseDtos.QuickUpdateWorkoutRequest;
import com.calishealth.dtos.ExerciseDtos.WorkoutExerciseItemRequest;
import com.calishealth.dtos.ExerciseDtos.WorkoutPlanItemRequest;
import com.calishealth.models.Exercise;
import com.calishealth.models.ExerciseMuscleGroup;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.MuscleGroup;
import com.calishealth.models.User;
import com.calishealth.models.WorkoutEntry;
import com.calishealth.models.WorkoutExerciseItem;
import com.calishealth.models.WorkoutPlanItem;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.repository.WorkoutRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bộ test bổ sung cho {@link WorkoutService}: các nhánh validate, helper private và
 * các giá trị mặc định chưa được chạy.
 */
class WorkoutServiceCoverageTest {

    private WorkoutRepository workouts;
    private ExerciseRepository exercises;
    private UserRepository users;
    private FitnessLevelRepository fitnessLevels;
    private ContentNameGuardService contentNameGuard;
    private WorkoutService service;

    private static final String EMAIL = "cm@example.test";

    @BeforeEach
    void setUp() {
        workouts = mock(WorkoutRepository.class);
        exercises = mock(ExerciseRepository.class);
        users = mock(UserRepository.class);
        fitnessLevels = mock(FitnessLevelRepository.class);
        contentNameGuard = mock(ContentNameGuardService.class);
        service = new WorkoutService(workouts, exercises, users, fitnessLevels, contentNameGuard);
    }

    // ------------------------------------------------------------- factories

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
        workout.setCreatedBy(creator());
        return workout;
    }

    private static MuscleGroup muscleGroup(String name) {
        MuscleGroup group = new MuscleGroup();
        group.setId(1L);
        group.setName(name);
        group.setDashboardCode("CHEST");
        group.setIconKey("icon");
        group.setTone("warm");
        return group;
    }

    // ------------------------------------------------------------ reflection

    private Method privateMethod(String name, Class<?>... parameterTypes) {
        try {
            Method method = WorkoutService.class.getDeclaredMethod(name, parameterTypes);
            method.setAccessible(true);
            return method;
        } catch (NoSuchMethodException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private Object invoke(String name, Class<?>[] types, Object... args) {
        try {
            return privateMethod(name, types).invoke(service, args);
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    // --------------------------------------------------------------- tests

    @Test
    @DisplayName("resolveItemRequests: uu tien items, neu rong dung exerciseCodes")
    void resolveItemRequestsPrefersItems() {
        CreateWorkoutRequest withItems = new CreateWorkoutRequest("n", "d", "HEALTH", "Beginner", 3, 1, "PUBLISHED",
                List.of("A"), null, List.of(new WorkoutExerciseItemRequest("A", 3, 10, null, 30)));
        @SuppressWarnings("unchecked")
        List<WorkoutExerciseItemRequest> items = (List<WorkoutExerciseItemRequest>) invoke(
                "resolveItemRequests", new Class<?>[]{CreateWorkoutRequest.class}, withItems);
        assertThat(items).hasSize(1);
        assertThat(items.get(0).exerciseCode()).isEqualTo("A");

        CreateWorkoutRequest withCodes = new CreateWorkoutRequest("n", "d", "HEALTH", "Beginner", 3, 1, "PUBLISHED",
                List.of("A", "B"), null, null);
        @SuppressWarnings("unchecked")
        List<WorkoutExerciseItemRequest> codes = (List<WorkoutExerciseItemRequest>) invoke(
                "resolveItemRequests", new Class<?>[]{CreateWorkoutRequest.class}, withCodes);
        assertThat(codes).hasSize(2);
        assertThat(codes.get(0).sets()).isNull();
        assertThat(codes.get(1).reps()).isNull();
    }

    @Test
    @DisplayName("loadSystemExercises: bai tap bi inactive -> 400")
    void loadSystemExercisesRejectsInactive() {
        Exercise inactive = exercise("A", "A", "REPS", true);
        inactive.setActive(false);
        when(exercises.findAllByCodeIn(List.of("A"))).thenReturn(List.of(inactive));

        assertThatThrownBy(() -> invoke("loadSystemExercises", new Class<?>[]{List.class},
                List.of(new WorkoutExerciseItemRequest("A", null, null, null, null))))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("loadSystemExercises: bai tap khong ton tai -> 400")
    void loadSystemExercisesRejectsMissing() {
        when(exercises.findAllByCodeIn(List.of("A"))).thenReturn(List.of());

        assertThatThrownBy(() -> invoke("loadSystemExercises", new Class<?>[]{List.class},
                List.of(new WorkoutExerciseItemRequest("A", null, null, null, null))))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("loadSystemExercises: bai tap khong phai system -> 400")
    void loadSystemExercisesRejectsCustom() {
        Exercise custom = exercise("A", "A", "REPS", false);
        when(exercises.findAllByCodeIn(List.of("A"))).thenReturn(List.of(custom));

        assertThatThrownBy(() -> invoke("loadSystemExercises", new Class<?>[]{List.class},
                List.of(new WorkoutExerciseItemRequest("A", null, null, null, null))))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("buildExerciseItems: bai HOLD dung duration mac dinh 30")
    void buildExerciseItemsUsesHoldDefaults() throws Exception {
        Exercise hold = exercise("H", "Hold", "HOLD", true);
        hold.setDefaultSets(null);
        hold.setDefaultReps(null);
        hold.setDuration(null);

        Method method = privateMethod("buildExerciseItems", List.class, Map.class);
        @SuppressWarnings("unchecked")
        List<WorkoutExerciseItem> items = (List<WorkoutExerciseItem>) method.invoke(service,
                List.of(new WorkoutExerciseItemRequest("H", null, null, null, null)),
                Map.of("H", hold));

        assertThat(items).hasSize(1);
        assertThat(items.get(0).getSets()).isEqualTo(3);
        assertThat(items.get(0).getRestSeconds()).isEqualTo(60);
        assertThat(items.get(0).getReps()).isNull();
        assertThat(items.get(0).getDurationSeconds()).isEqualTo(30);
    }

    @Test
    @DisplayName("buildExerciseItems: bai REPS dung reps mac dinh 10")
    void buildExerciseItemsUsesRepsDefaults() throws Exception {
        Exercise reps = exercise("R", "Reps", "REPS", true);
        reps.setDefaultSets(null);
        reps.setDefaultReps(null);

        Method method = privateMethod("buildExerciseItems", List.class, Map.class);
        @SuppressWarnings("unchecked")
        List<WorkoutExerciseItem> items = (List<WorkoutExerciseItem>) method.invoke(service,
                List.of(new WorkoutExerciseItemRequest("R", null, null, null, null)),
                Map.of("R", reps));

        assertThat(items.get(0).getReps()).isEqualTo(10);
        assertThat(items.get(0).getDurationSeconds()).isNull();
    }

    @Test
    @DisplayName("validateExerciseItems: ma bai rong -> 400")
    void validateExerciseItemsRejectsBlankCode() {
        assertThatThrownBy(() -> invoke("validateExerciseItems", new Class<?>[]{List.class},
                List.of(new WorkoutExerciseItemRequest(" ", 3, 10, null, null))))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("validateExerciseItems: sets ngoai khoang -> 400")
    void validateExerciseItemsRejectsInvalidSets() {
        assertThatThrownBy(() -> invoke("validateExerciseItems", new Class<?>[]{List.class},
                List.of(new WorkoutExerciseItemRequest("A", 99, 10, null, null))))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("validateExerciseItems: reps ngoai khoang -> 400")
    void validateExerciseItemsRejectsInvalidReps() {
        assertThatThrownBy(() -> invoke("validateExerciseItems", new Class<?>[]{List.class},
                List.of(new WorkoutExerciseItemRequest("A", 3, 0, null, null))))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("validateExerciseItems: duration ngoai khoang -> 400")
    void validateExerciseItemsRejectsInvalidDuration() {
        assertThatThrownBy(() -> invoke("validateExerciseItems", new Class<?>[]{List.class},
                List.of(new WorkoutExerciseItemRequest("A", 3, 10, 5000, null))))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("validateExerciseItems: rest ngoai khoang -> 400")
    void validateExerciseItemsRejectsInvalidRest() {
        assertThatThrownBy(() -> invoke("validateExerciseItems", new Class<?>[]{List.class},
                List.of(new WorkoutExerciseItemRequest("A", 3, 10, null, 9999))))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("validateExerciseItems: item hop le -> khong nem loi")
    void validateExerciseItemsAcceptsValid() {
        invoke("validateExerciseItems", new Class<?>[]{List.class},
                List.of(new WorkoutExerciseItemRequest("A", 3, 10, 30, 60)));
    }

    @Test
    @DisplayName("validateWorkoutRequest: daysPerWeek null -> mac dinh 3")
    void validateWorkoutRequestDefaultsDays() {
        CreateWorkoutRequest request = new CreateWorkoutRequest("n", "d", "HEALTH", "Beginner", null, null,
                "PUBLISHED", List.of("A"), null, null);
        when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));

        invoke("validateWorkoutRequest", new Class<?>[]{CreateWorkoutRequest.class}, request);
    }

    @Test
    @DisplayName("validateWorkoutRequest: khong co bai tap -> 400")
    void validateWorkoutRequestRejectsNoExercise() {
        CreateWorkoutRequest request = new CreateWorkoutRequest("n", "d", "HEALTH", "Beginner", 3, 1,
                "PUBLISHED", List.of(), null, null);
        when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));

        assertThatThrownBy(() -> invoke("validateWorkoutRequest", new Class<?>[]{CreateWorkoutRequest.class}, request))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("validateWorkoutRequest: exerciseCodes co phan tu rong -> 400")
    void validateWorkoutRequestRejectsBlankCodeInCodes() {
        CreateWorkoutRequest request = new CreateWorkoutRequest("n", "d", "HEALTH", "Beginner", 3, 1,
                "PUBLISHED", List.of("A", " "), null, null);
        when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));

        assertThatThrownBy(() -> invoke("validateWorkoutRequest", new Class<?>[]{CreateWorkoutRequest.class}, request))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("validatePlanItems: day ngoai 1..7 -> 400")
    void validatePlanItemsRejectsInvalidDay() {
        WorkoutPlanItemRequest item = new WorkoutPlanItemRequest(9, "A", 3, 10, 3, 10, 3, 10);

        assertThatThrownBy(() -> invoke("validatePlanItems", new Class<?>[]{List.class}, List.of(item)))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("validatePlanItems: trung bai trong mot ngay -> 400")
    void validatePlanItemsRejectsDuplicate() {
        WorkoutPlanItemRequest item = new WorkoutPlanItemRequest(1, "A", 3, 10, 3, 10, 3, 10);

        assertThatThrownBy(() -> invoke("validatePlanItems", new Class<?>[]{List.class}, List.of(item, item)))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("validatePlanItems: sets/reps ngoai khoang -> 400")
    void validatePlanItemsRejectsInvalidSetRep() {
        WorkoutPlanItemRequest item = new WorkoutPlanItemRequest(1, "A", 0, 10, 3, 10, 3, 10);

        assertThatThrownBy(() -> invoke("validatePlanItems", new Class<?>[]{List.class}, List.of(item)))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("validatePlanItems: muc hop le -> khong nem loi")
    void validatePlanItemsAcceptsValid() {
        WorkoutPlanItemRequest item = new WorkoutPlanItemRequest(1, "A", 3, 10, 3, 10, 3, 10);

        invoke("validatePlanItems", new Class<?>[]{List.class}, List.of(item));
    }

    @Test
    @DisplayName("toPlanItem: tao item keo day cau hinh")
    void toPlanItemBuildsItem() throws Exception {
        Exercise exercise = exercise("A", "A", "REPS", true);
        WorkoutEntry workout = workout("WO-1", "n", "WORKOUT", "Beginner", "PUBLISHED");
        WorkoutPlanItemRequest request = new WorkoutPlanItemRequest(2, "A", 3, 10, 4, 12, 5, 15);

        Method method = privateMethod("toPlanItem", WorkoutPlanItemRequest.class, Map.class, WorkoutEntry.class);
        WorkoutPlanItem item = (WorkoutPlanItem) method.invoke(service, request, Map.of("A", exercise), workout);

        assertThat(item.getWorkout()).isSameAs(workout);
        assertThat(item.getExercise()).isSameAs(exercise);
        assertThat(item.getDayOfWeek()).isEqualTo(2);
        assertThat(item.getBeginnerSets()).isEqualTo(3);
        assertThat(item.getBeginnerReps()).isEqualTo(10);
        assertThat(item.getIntermediateSets()).isEqualTo(4);
        assertThat(item.getIntermediateReps()).isEqualTo(12);
        assertThat(item.getAdvancedSets()).isEqualTo(5);
        assertThat(item.getAdvancedReps()).isEqualTo(15);
    }

    @Test
    @DisplayName("applyTemplateMetadata: mac dinh PUBLISHED")
    void applyTemplateMetadataDefaultsStatus() {
        WorkoutEntry workout = workout("WO-1", "n", "WORKOUT", "Beginner", "DRAFT");
        CreateWorkoutRequest request = new CreateWorkoutRequest("n", "d", "HEALTH", "Beginner", null, null,
                null, List.of("A"), null, null);

        invoke("applyTemplateMetadata", new Class<?>[]{WorkoutEntry.class, CreateWorkoutRequest.class},
                workout, request);

        assertThat(workout.getDaysPerWeek()).isEqualTo(3);
        assertThat(workout.getDaySequence()).isEqualTo(1);
        assertThat(workout.getTemplateStatus()).isEqualTo("PUBLISHED");
    }

    @Test
    @DisplayName("applyTemplateMetadata: status khong hop le -> 400")
    void applyTemplateMetadataRejectsInvalidStatus() {
        WorkoutEntry workout = workout("WO-1", "n", "WORKOUT", "Beginner", "DRAFT");
        CreateWorkoutRequest request = new CreateWorkoutRequest("n", "d", "HEALTH", "Beginner", 3, 1,
                "WEIRD", List.of("A"), null, null);

        assertThatThrownBy(() -> invoke("applyTemplateMetadata",
                new Class<?>[]{WorkoutEntry.class, CreateWorkoutRequest.class}, workout, request))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("resolveWorkoutType: type rong -> WORKOUT")
    void resolveWorkoutTypeDefaults() {
        assertThat(invoke("resolveWorkoutType", new Class<?>[]{String.class}, "  ")).isEqualTo("WORKOUT");
        assertThat(invoke("resolveWorkoutType", new Class<?>[]{String.class}, new Object[]{null}))
                .isEqualTo("WORKOUT");
    }

    @Test
    @DisplayName("resolveWorkoutType: type khong hop le -> 400")
    void resolveWorkoutTypeRejectsInvalid() {
        assertThatThrownBy(() -> invoke("resolveWorkoutType", new Class<?>[]{String.class}, "DAILY_TRAINING_PLAN"))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> invoke("resolveWorkoutType", new Class<?>[]{String.class}, "WHAT"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("resolveLevelName: level rong -> 400")
    void resolveLevelNameRejectsBlank() {
        assertThatThrownBy(() -> invoke("resolveLevelName", new Class<?>[]{String.class}, " "))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("resolveLevelName: level khong ton tai -> 400")
    void resolveLevelNameRejectsUnknown() {
        when(fitnessLevels.findByNameIgnoreCase("Nope")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> invoke("resolveLevelName", new Class<?>[]{String.class}, "Nope"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("resolveActiveLevelName: level inactive -> 400")
    void resolveActiveLevelNameRejectsInactive() {
        when(fitnessLevels.findByNameIgnoreCase("Advanced")).thenReturn(Optional.of(level("Advanced", "INACTIVE")));

        assertThatThrownBy(() -> invoke("resolveActiveLevelName", new Class<?>[]{String.class}, "Advanced"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("resolveActiveLevelName: level active -> tra ten chuan hoa")
    void resolveActiveLevelNameReturnsName() {
        when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));

        assertThat(invoke("resolveActiveLevelName", new Class<?>[]{String.class}, "Beginner")).isEqualTo("Beginner");
    }

    @Test
    @DisplayName("isLevelActive: level null hoac rong -> true")
    void isLevelActiveTreatsBlankAsActive() {
        assertThat(invoke("isLevelActive", new Class<?>[]{String.class}, (Object) null)).isEqualTo(true);
        assertThat(invoke("isLevelActive", new Class<?>[]{String.class}, "  ")).isEqualTo(true);
    }

    @Test
    @DisplayName("isLevelActive: level khong duoc cau hinh -> true")
    void isLevelActiveTreatsUnknownAsActive() {
        when(fitnessLevels.findByNameIgnoreCase("Ghost")).thenReturn(Optional.empty());

        assertThat(invoke("isLevelActive", new Class<?>[]{String.class}, "Ghost")).isEqualTo(true);
    }

    @Test
    @DisplayName("isLevelActive: level INACTIVE -> false")
    void isLevelActiveDetectsInactive() {
        when(fitnessLevels.findByNameIgnoreCase("Advanced")).thenReturn(Optional.of(level("Advanced", "INACTIVE")));

        assertThat(invoke("isLevelActive", new Class<?>[]{String.class}, "Advanced")).isEqualTo(false);
    }

    @Test
    @DisplayName("cloneName: bo hau to Month N")
    void cloneNameStripsMonthSuffix() {
        assertThat(invoke("cloneName", new Class<?>[]{String.class}, "Full Body A - Month 2"))
                .isEqualTo("Full Body A - Copy");
        assertThat(invoke("cloneName", new Class<?>[]{String.class}, (Object) null)).isEqualTo("Workout - Copy");
    }

    @Test
    @DisplayName("cloneName: cat ngan 60 ky tu")
    void cloneNameTruncates() {
        String longName = "A".repeat(80);

        String result = (String) invoke("cloneName", new Class<?>[]{String.class}, longName);

        assertThat(result).hasSizeLessThanOrEqualTo(60);
    }

    @Test
    @DisplayName("newCode: sinh ma co tien to WO-")
    void newCodeGeneratesCode() {
        String code = (String) invoke("newCode", new Class<?>[]{});

        assertThat(code).startsWith("WO-").hasSize(11);
    }

    @Test
    @DisplayName("muscleGroupLabel: ghep ten nhom co")
    void muscleGroupLabelJoinsGroups() {
        Exercise exercise = exercise("A", "A", "REPS", true);
        ExerciseMuscleGroup first = new ExerciseMuscleGroup();
        first.setMuscleGroup(muscleGroup("Chest"));
        ExerciseMuscleGroup second = new ExerciseMuscleGroup();
        second.setMuscleGroup(muscleGroup("Arms"));
        exercise.getMuscleGroups().add(first);
        exercise.getMuscleGroups().add(second);

        assertThat((String) invoke("muscleGroupLabel", new Class<?>[]{Exercise.class}, exercise)).contains("Chest");
    }

    @Test
    @DisplayName("muscleGroupLabel: khong co nhom -> null")
    void muscleGroupLabelReturnsNull() {
        Exercise exercise = exercise("A", "A", "REPS", true);

        assertThat(invoke("muscleGroupLabel", new Class<?>[]{Exercise.class}, exercise)).isNull();
    }

    @Test
    @DisplayName("update: ten workout cu null -> chay kiem tra trung ten")
    void updateHandlesNullWorkoutName() {
        WorkoutEntry workout = workout("WO-1", null, "WORKOUT", "Beginner", "PUBLISHED");
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));
        lenient().when(exercises.findAllByCodeIn(List.of("A"))).thenReturn(List.of(exercise("A", "A", "REPS", true)));

        CreateWorkoutRequest request = new CreateWorkoutRequest("New name", "d", "HEALTH", "Beginner", 3, 1,
                "PUBLISHED", List.of("A"), null, null);

        service.update("WO-1", request);

        org.mockito.Mockito.verify(contentNameGuard).assertWorkoutNameNotUsedByExercise("New name", null);
    }

    @Test
    @DisplayName("update: doi sang level active khac -> cho phep")
    void updateAllowsMovingToActiveLevel() {
        WorkoutEntry workout = workout("WO-1", "Old name", "WORKOUT", "Beginner", "PUBLISHED");
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Advanced")).thenReturn(Optional.of(level("Advanced", "ACTIVE")));
        lenient().when(exercises.findAllByCodeIn(List.of("A"))).thenReturn(List.of(exercise("A", "A", "REPS", true)));

        CreateWorkoutRequest request = new CreateWorkoutRequest("Old name", "d", "HEALTH", "Advanced", 3, 1,
                "PUBLISHED", List.of("A"), null, null);

        service.update("WO-1", request);

        assertThat(workout.getLevel()).isEqualTo("Advanced");
    }

    @Test
    @DisplayName("quickUpdate: request null -> 400")
    void quickUpdateRejectsNullRequest() {
        WorkoutEntry workout = workout("WO-1", "n", "WORKOUT", "Beginner", "PUBLISHED");
        when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout));

        assertThatThrownBy(() -> service.quickUpdate("WO-1", null))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("quickUpdate: chi doi sets -> reps/duration giu nguyen")
    void quickUpdateAppliesSetsOnly() {
        WorkoutEntry workout = workout("WO-1", "n", "WORKOUT", "Beginner", "PUBLISHED");
        WorkoutExerciseItem item = new WorkoutExerciseItem();
        item.setExercise(exercise("A", "A", "REPS", true));
        item.setSets(3);
        item.setReps(10);
        item.setDurationSeconds(null);
        item.setRestSeconds(60);
        workout.getExercises().add(item);
        when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout));
        when(workouts.saveAndFlush(workout)).thenReturn(workout);

        service.quickUpdate("WO-1", new QuickUpdateWorkoutRequest(2, null, null));

        assertThat(item.getSets()).isEqualTo(5);
        assertThat(item.getReps()).isEqualTo(10);
    }

    @Test
    @DisplayName("quickUpdate: sets vuot khoang -> phai clamp ve 20")
    void quickUpdateClampsSets() {
        WorkoutEntry workout = workout("WO-1", "n", "WORKOUT", "Beginner", "PUBLISHED");
        WorkoutExerciseItem item = new WorkoutExerciseItem();
        item.setExercise(exercise("A", "A", "REPS", true));
        item.setSets(19);
        item.setReps(10);
        item.setRestSeconds(60);
        workout.getExercises().add(item);
        when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout));
        when(workouts.saveAndFlush(workout)).thenReturn(workout);

        service.quickUpdate("WO-1", new QuickUpdateWorkoutRequest(5, null, null));

        assertThat(item.getSets()).isEqualTo(20);
    }

    @Test
    @DisplayName("toResponse: type null -> WORKOUT")
    void toResponseDefaultsType() {
        WorkoutEntry workout = workout("WO-1", "n", null, "Beginner", "PUBLISHED");
        when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout));

        var response = service.findByCode("WO-1");

        assertThat(response.type()).isEqualTo("WORKOUT");
    }

    @Test
    @DisplayName("assertSystemExercises: bai co createdBy -> 400")
    void assertSystemExercisesRejectsCreatedBy() {
        Exercise exercise = exercise("A", "A", "REPS", true);
        // setSource(null) chuan hoa thanh "SYSTEM", can bo field de source thuc su null.
        setSourceField(exercise, null);
        exercise.setCreatedBy(creator());

        assertThatThrownBy(() -> invoke("assertSystemExercises", new Class<?>[]{java.util.Collection.class},
                List.of(exercise)))
                .isInstanceOf(IllegalStateException.class);
    }

    private static void setSourceField(Exercise exercise, String value) {
        try {
            java.lang.reflect.Field field = Exercise.class.getDeclaredField("source");
            field.setAccessible(true);
            field.set(exercise, value);
        } catch (ReflectiveOperationException exception) {
            throw new IllegalStateException(exception);
        }
    }

    @Test
    @DisplayName("findAll: danh sach rong -> tra ve list rong")
    void findAllReturnsEmptyList() {
        when(workouts.findAll()).thenReturn(List.of());

        assertThat(service.findAll()).isEmpty();
    }

    @Test
    @DisplayName("update: xoa het bai tap cu roi them bai moi")
    void updateReplacesExercises() {
        WorkoutEntry workout = workout("WO-1", "Old name", "WORKOUT", "Beginner", "PUBLISHED");
        WorkoutExerciseItem old = new WorkoutExerciseItem();
        old.setExercise(exercise("OLD", "Old", "REPS", true));
        workout.getExercises().add(old);
        lenient().when(workouts.findByCode("WO-1")).thenReturn(Optional.of(workout));
        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", "ACTIVE")));
        lenient().when(exercises.findAllByCodeIn(List.of("A"))).thenReturn(List.of(exercise("A", "A", "REPS", true)));

        CreateWorkoutRequest request = new CreateWorkoutRequest("Old name", "d", "HEALTH", "Beginner", 3, 1,
                "PUBLISHED", List.of("A"), null, null);

        service.update("WO-1", request);

        assertThat(workout.getExercises()).hasSize(1);
        assertThat(workout.getExercises().get(0).getExercise().getCode()).isEqualTo("A");
    }
}
