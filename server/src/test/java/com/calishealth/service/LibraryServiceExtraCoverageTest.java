package com.calishealth.service;

import com.calishealth.dtos.LibraryDtos.CreateMemberExerciseRequest;
import com.calishealth.dtos.LibraryDtos.ExerciseListItem;
import com.calishealth.dtos.LibraryDtos.PagedExerciseListResponse;
import com.calishealth.models.Exercise;
import com.calishealth.models.ExerciseMuscleGroup;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.MuscleGroup;
import com.calishealth.models.User;
import com.calishealth.models.UserRole;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.repository.WorkoutRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Bo sung coverage cho cac nhanh chua duoc kiem tra cua {@link LibraryService}. */
class LibraryServiceExtraCoverageTest {

    private ExerciseRepository exercises;
    private WorkoutRepository workouts;
    private UserRepository users;
    private ExerciseMuscleGroupCatalog muscleGroups;
    private FitnessLevelRepository levels;
    private SystemNotificationService notifications;
    private ContentNameGuardService nameGuard;
    private LibraryService service;

    private static final String EMAIL = "member@calishealth.vn";

    @BeforeEach
    void setUp() {
        exercises = mock(ExerciseRepository.class);
        workouts = mock(WorkoutRepository.class);
        users = mock(UserRepository.class);
        muscleGroups = mock(ExerciseMuscleGroupCatalog.class);
        levels = mock(FitnessLevelRepository.class);
        notifications = mock(SystemNotificationService.class);
        nameGuard = mock(ContentNameGuardService.class);
        service = new LibraryService(
                exercises, workouts, users, muscleGroups, levels, notifications, nameGuard);
    }

    private static FitnessLevel level(String name, int min, int max, String status) {
        FitnessLevel lv = new FitnessLevel();
        lv.setId((long) min);
        lv.setName(name);
        lv.setScoreMin(min);
        lv.setScoreMax(max);
        lv.setStatus(status);
        return lv;
    }

    private static User member(long id) {
        User u = new User();
        u.setId(id);
        u.setEmail(EMAIL);
        u.setRole(UserRole.MEMBER);
        return u;
    }

    @Test
    @DisplayName("loadAllExercises: bai he thong khong co type -> dung HEALTH")
    void systemExerciseWithoutTypeFallsBackToHealth() {
        lenient().when(levels.findAll()).thenReturn(List.of(level("Beginner", 0, 30, "ACTIVE")));
        Exercise e = new Exercise();
        e.setId(1L);
        e.setCode("EX-001");
        e.setName("No type");
        e.setSource("SYSTEM");
        e.setModerationStatus("ACTIVE");
        e.setActive(true);
        e.setSystem(true);
        e.setMuscleGroup("Chest");
        e.setLevel(null);
        when(exercises.findAll()).thenReturn(List.of(e));
        when(exercises.findMemberExercisesByEmail(anyString())).thenReturn(List.of());

        PagedExerciseListResponse res = service.getExercises("all", "all", "all", "all", null, null, 1, 50, EMAIL);

        assertThat(res.items()).extracting(ExerciseListItem::name).contains("No type");
    }

    @Test
    @DisplayName("loadAllExercises: co ban 'Back' -> equipment Pull-up bar")
    void systemExerciseOnBackUsesPullUpBar() {
        lenient().when(levels.findAll()).thenReturn(List.of(level("Beginner", 0, 30, "ACTIVE")));
        Exercise e = new Exercise();
        e.setId(2L);
        e.setCode("EX-002");
        e.setName("Row");
        e.setType("HEALTH");
        e.setSource("SYSTEM");
        e.setModerationStatus("ACTIVE");
        e.setActive(true);
        e.setSystem(true);
        e.setMuscleGroup("Back");
        e.setLevel("beginner");
        when(exercises.findAll()).thenReturn(List.of(e));
        when(exercises.findMemberExercisesByEmail(anyString())).thenReturn(List.of());

        PagedExerciseListResponse res = service.getExercises("all", "all", "all", "all", null, null, 1, 50, EMAIL);

        assertThat(res.items()).extracting(ExerciseListItem::equipment).contains("Pull-up bar");
    }

    @Test
    @DisplayName("loadAllExercises: ten chua 'dip' -> equipment Parallel bars")
    void systemExerciseWithDipUsesParallelBars() {
        lenient().when(levels.findAll()).thenReturn(List.of(level("Beginner", 0, 30, "ACTIVE")));
        Exercise e = new Exercise();
        e.setId(3L);
        e.setCode("EX-003");
        e.setName("Bench Dips");
        e.setType("HEALTH");
        e.setSource("SYSTEM");
        e.setModerationStatus("ACCEPTED");
        e.setActive(true);
        e.setSystem(true);
        e.setMuscleGroup("Arms");
        e.setLevel("beginner");
        when(exercises.findAll()).thenReturn(List.of(e));
        when(exercises.findMemberExercisesByEmail(anyString())).thenReturn(List.of());

        PagedExerciseListResponse res = service.getExercises("all", "all", "all", "all", null, null, 1, 50, EMAIL);

        assertThat(res.items()).extracting(ExerciseListItem::equipment).contains("Parallel bars");
    }

    @Test
    @DisplayName("loadAllExercises: bai he thong khong co muscle group -> Full body")
    void systemExerciseWithoutMuscleGroupUsesFullBody() {
        lenient().when(levels.findAll()).thenReturn(List.of(level("Beginner", 0, 30, "ACTIVE")));
        Exercise e = new Exercise();
        e.setId(4L);
        e.setCode("EX-004");
        e.setName("Generic");
        e.setType("HEALTH");
        e.setSource("SYSTEM");
        e.setModerationStatus("ACTIVE");
        e.setActive(true);
        e.setSystem(true);
        e.setMuscleGroup(null);
        e.setLevel("beginner");
        when(exercises.findAll()).thenReturn(List.of(e));
        when(exercises.findMemberExercisesByEmail(anyString())).thenReturn(List.of());

        PagedExerciseListResponse res = service.getExercises("all", "all", "all", "all", null, null, 1, 50, EMAIL);

        assertThat(res.items()).extracting(ExerciseListItem::muscleGroup).contains("Full body");
    }

    @Test
    @DisplayName("loadAllExercises: loi khi tai bai member -> bo qua, khong nem loi")
    void memberExerciseLookupFailureIsIgnored() {
        lenient().when(levels.findAll()).thenReturn(List.of(level("Beginner", 0, 30, "ACTIVE")));
        when(exercises.findAll()).thenReturn(List.of());
        when(exercises.findMemberExercisesByEmail(anyString()))
                .thenThrow(new RuntimeException("db down"));

        PagedExerciseListResponse res = service.getExercises("all", "all", "all", "all", null, null, 1, 50, EMAIL);

        assertThat(res).isNotNull();
    }

    @Test
    @DisplayName("getExercises: danh sach rong -> totalPages = 1")
    void emptyExerciseListStillHasOnePage() {
        lenient().when(levels.findAll()).thenReturn(List.of());
        when(exercises.findAll()).thenReturn(List.of());
        when(exercises.findMemberExercisesByEmail(anyString())).thenReturn(List.of());

        PagedExerciseListResponse res = service.getExercises("zzz", "all", "all", "all", null, null, 1, 50, EMAIL);

        assertThat(res.totalItems()).isZero();
        assertThat(res.totalPages()).isEqualTo(1);
    }

    @Test
    @DisplayName("getExercises: muscles co phan tu rong -> bo qua phan tu rong")
    void muscleFilterIgnoresBlankSegments() {
        lenient().when(levels.findAll()).thenReturn(List.of(level("Beginner", 0, 30, "ACTIVE")));
        Exercise e = new Exercise();
        e.setId(5L);
        e.setCode("EX-005");
        e.setName("Push-up");
        e.setType("HEALTH");
        e.setSource("SYSTEM");
        e.setModerationStatus("ACTIVE");
        e.setActive(true);
        e.setSystem(true);
        e.setMuscleGroup("Chest");
        e.setLevel("beginner");
        when(exercises.findAll()).thenReturn(List.of(e));
        when(exercises.findMemberExercisesByEmail(anyString())).thenReturn(List.of());

        PagedExerciseListResponse res = service.getExercises(
                "all", "all", "all", "all", "Chest,,  ,", null, 1, 50, EMAIL);

        assertThat(res.items()).extracting(ExerciseListItem::name).contains("Push-up");
    }

    @Test
    @DisplayName("getExercises: bai khong co co ban -> bi loai khi loc theo co ban")
    void exerciseWithoutMuscleGroupIsFilteredOut() {
        lenient().when(levels.findAll()).thenReturn(List.of(level("Beginner", 0, 30, "ACTIVE")));
        Exercise e = new Exercise();
        e.setId(6L);
        e.setCode("EX-006");
        e.setName("No muscle");
        e.setType("HEALTH");
        e.setSource("SYSTEM");
        e.setModerationStatus("ACTIVE");
        e.setActive(true);
        e.setSystem(true);
        e.setMuscleGroup(null);
        e.setLevel("beginner");
        when(exercises.findAll()).thenReturn(List.of(e));
        when(exercises.findMemberExercisesByEmail(anyString())).thenReturn(List.of());

        PagedExerciseListResponse res = service.getExercises(
                "all", "all", "all", "all", "Chest", null, 1, 50, EMAIL);

        assertThat(res.items()).extracting(ExerciseListItem::name).doesNotContain("No muscle");
    }

    @Test
    @DisplayName("getExerciseById: bai DB khong co type/category/goal/level -> gia tri mac dinh")
    void entityWithoutOptionalFieldsUsesDefaults() {
        lenient().when(levels.findAll()).thenReturn(List.of(level("Beginner", 0, 30, "ACTIVE")));
        Exercise e = new Exercise();
        e.setId(7L);
        e.setCode("EX-007");
        e.setName("Bare");
        e.setSource("SYSTEM");
        e.setType((String) null);
        e.setCategory(null);
        e.setGoal(null);
        e.setDifficultyLevel(null);
        e.setDefaultSets(null);
        e.setDefaultReps(null);
        e.setInstructions(null);
        e.setExecutionSteps(null);
        e.setMuscleGroups(new ArrayList<>());
        when(exercises.findAcceptedSystemById(7L)).thenReturn(Optional.of(e));

        ExerciseListItem item = service.getExerciseById("7");

        assertThat(item.type()).isEqualTo("HEALTH");
        assertThat(item.category()).isEqualTo("REPS");
        assertThat(item.goal()).isEqualTo("Strength");
        assertThat(item.level()).isEqualTo("Beginner");
        assertThat(item.muscleGroup()).isEqualTo("Full body");
        assertThat(item.sets()).isEqualTo(3);
        assertThat(item.repsOrDuration()).isEqualTo("10 reps");
    }

    @Test
    @DisplayName("mapExerciseEntityToDto: link co ban null -> bo qua link do")
    void muscleGroupLinkWithoutMuscleGroupIsSkipped() {
        lenient().when(levels.findAll()).thenReturn(List.of(level("Beginner", 0, 30, "ACTIVE")));
        Exercise e = new Exercise();
        e.setId(8L);
        e.setCode("EX-008");
        e.setName("Link");
        e.setType("HEALTH");
        e.setSource("SYSTEM");
        e.setCategory("REPS");
        e.setMuscleGroups(new ArrayList<>());
        ExerciseMuscleGroup emptyLink = new ExerciseMuscleGroup();
        e.getMuscleGroups().add(emptyLink);
        MuscleGroup chest = new MuscleGroup();
        chest.setId(1L);
        chest.setName("Chest");
        ExerciseMuscleGroup validLink = new ExerciseMuscleGroup();
        validLink.setMuscleGroup(chest);
        e.getMuscleGroups().add(validLink);
        when(exercises.findAcceptedSystemById(8L)).thenReturn(Optional.of(e));

        ExerciseListItem item = service.getExerciseById("8");

        assertThat(item.muscleGroup()).isEqualTo("Chest");
    }

    @Test
    @DisplayName("createMemberExercise: khong co muscle group -> Full body")
    void createMemberExerciseDefaultsMuscleGroup() {
        lenient().when(levels.findAll()).thenReturn(List.of(level("Beginner", 0, 30, "ACTIVE")));
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(5L)));
        when(levels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", 0, 30, "ACTIVE")));
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> {
            Exercise e = inv.getArgument(0);
            e.setId(331L);
            return e;
        });

        ExerciseListItem item = service.createMemberExercise(
                new CreateMemberExerciseRequest("My Move", null, "Beginner", null, null, 3, "10 reps", null),
                EMAIL);

        assertThat(item.muscleGroup()).isEqualTo("Full body");
        verifyAssign("Full body");
    }

    @Test
    @DisplayName("createMemberExercise: reps khong phai so -> defaultReps null, duration null")
    void createMemberExerciseWithNonNumericReps() {
        lenient().when(levels.findAll()).thenReturn(List.of(level("Beginner", 0, 30, "ACTIVE")));
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member(5L)));
        when(levels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(level("Beginner", 0, 30, "ACTIVE")));
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> {
            Exercise e = inv.getArgument(0);
            e.setId(332L);
            return e;
        });

        ExerciseListItem item = service.createMemberExercise(
                new CreateMemberExerciseRequest("My Move", "Chest", "Beginner", null, null, 3, "as many as possible", null),
                EMAIL);

        assertThat(item.category()).isEqualTo("REPS");
        assertThat(item.repsOrDuration()).isEqualTo("as many as possible");
    }

    private void verifyAssign(String expectedMuscleGroup) {
        org.mockito.Mockito.verify(muscleGroups).assign(any(Exercise.class),
                org.mockito.ArgumentMatchers.eq(expectedMuscleGroup));
    }

    @Test
    @DisplayName("seedLevelName: chi co 1 level -> cac vi tri sau deu dung level do")
    void seedLevelNameFallsBackToLastLevel() {
        when(levels.findAll()).thenReturn(List.of(level("Only", 0, 10, "ACTIVE")));
        when(exercises.findAll()).thenReturn(List.of());
        when(exercises.findMemberExercisesByEmail(anyString())).thenReturn(List.of());

        PagedExerciseListResponse res = service.getExercises("all", "all", "all", "all", null, null, 1, 50, EMAIL);

        assertThat(res).isNotNull();
    }

    @Test
    @DisplayName("defaultLevelName: khong co level ACTIVE -> tra null")
    void defaultLevelNameIsNullWhenNoActiveLevel() {
        when(levels.findAll()).thenReturn(List.of(level("Off", 0, 10, "INACTIVE")));
        when(exercises.findAll()).thenReturn(List.of());
        when(exercises.findMemberExercisesByEmail(anyString())).thenReturn(List.of());

        PagedExerciseListResponse res = service.getExercises("all", "all", "all", "all", null, null, 1, 50, EMAIL);

        assertThat(res).isNotNull();
    }

    @Test
    @DisplayName("getExercises: level 'all levels' -> khong loc theo level")
    void levelAllLevelsIsIgnored() {
        lenient().when(levels.findAll()).thenReturn(List.of(level("Beginner", 0, 30, "ACTIVE")));
        Exercise e = new Exercise();
        e.setId(9L);
        e.setCode("EX-009");
        e.setName("Any level");
        e.setType("HEALTH");
        e.setSource("SYSTEM");
        e.setModerationStatus("ACTIVE");
        e.setActive(true);
        e.setSystem(true);
        e.setMuscleGroup("Chest");
        e.setLevel("Advanced");
        when(exercises.findAll()).thenReturn(List.of(e));
        when(exercises.findMemberExercisesByEmail(anyString())).thenReturn(List.of());

        PagedExerciseListResponse res = service.getExercises(
                "all", "all", "all levels", "all", null, null, 1, 50, EMAIL);

        assertThat(res.items()).extracting(ExerciseListItem::name).contains("Any level");
    }

    @Test
    @DisplayName("getExercises: source=member -> chi tra bai CUSTOM/MEMBER")
    void sourceMemberFiltersMemberExercises() {
        lenient().when(levels.findAll()).thenReturn(List.of(level("Beginner", 0, 30, "ACTIVE")));
        Exercise memberEx = new Exercise();
        memberEx.setId(10L);
        memberEx.setCode("CU_10");
        memberEx.setName("Member move");
        memberEx.setType("HEALTH");
        memberEx.setSource("CUSTOM");
        memberEx.setModerationStatus("ACTIVE");
        memberEx.setCategory("REPS");
        memberEx.setMuscleGroup("Chest");
        memberEx.setInstructions("desc");
        when(exercises.findAll()).thenReturn(List.of());
        when(exercises.findMemberExercisesByEmail(EMAIL)).thenReturn(List.of(memberEx));

        PagedExerciseListResponse res = service.getExercises(
                "all", "member", "all", "all", null, null, 1, 50, EMAIL);

        assertThat(res.items()).extracting(ExerciseListItem::name).contains("Member move");
    }

    @Test
    @DisplayName("createMemberExercise: khong co user trong DB -> 401")
    void createMemberExerciseUnknownUserStillRejected() {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createMemberExercise(
                new CreateMemberExerciseRequest("X", "Chest", "Beginner", null, null, 3, "10 reps", null),
                EMAIL))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    @DisplayName("getExerciseById: id khong phai so -> dung seed, khong nem loi")
    void getExerciseByIdWithNonNumericIdUsesSeed() {
        lenient().when(levels.findAll()).thenReturn(List.of(level("Beginner", 0, 30, "ACTIVE")));
        when(exercises.findAcceptedSystemById(anyLong())).thenReturn(Optional.empty());

        ExerciseListItem item = service.getExerciseById("not-a-number");

        assertThat(item.id()).isEqualTo(999L);
    }
}
