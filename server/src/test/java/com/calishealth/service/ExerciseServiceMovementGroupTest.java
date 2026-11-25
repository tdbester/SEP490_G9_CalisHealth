package com.calishealth.service;

import com.calishealth.dtos.ExerciseDtos.CreateExerciseRequest;
import com.calishealth.dtos.ExerciseDtos.ExerciseResponse;
import com.calishealth.models.Exercise;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.User;
import com.calishealth.repository.ExerciseModerationHistoryRepository;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.ProgressionRuleRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
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
 * Test nhóm chuyển động của bài hệ thống: CM khai báo tường minh, suy ra từ
 * tên/nhóm cơ, và từ chối giá trị không hợp lệ.
 */
class ExerciseServiceMovementGroupTest {

    private ExerciseRepository exercises;
    private UserRepository users;
    private FitnessLevelRepository fitnessLevels;
    private ExerciseService service;

    private static final String EMAIL = "cm@calishealth.vn";

    @BeforeEach
    void setUp() {
        exercises = mock(ExerciseRepository.class);
        users = mock(UserRepository.class);
        fitnessLevels = mock(FitnessLevelRepository.class);
        service = new ExerciseService(
                exercises,
                mock(ExerciseModerationHistoryRepository.class),
                users,
                mock(JdbcTemplate.class),
                mock(MediaRegistryService.class),
                mock(ProgressionRuleRepository.class),
                fitnessLevels,
                mock(ExerciseMuscleGroupCatalog.class),
                mock(SystemNotificationService.class),
                mock(ExercisePhysiologyService.class),
                mock(ContentNameGuardService.class),
                mock(ExerciseUnlockService.class),
                mock(FormRuleAdminService.class));

        FitnessLevel level = new FitnessLevel();
        level.setName("Beginner");
        level.setStatus("ACTIVE");
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(level));
        lenient().when(fitnessLevels.findByNameIgnoreCase(anyString()))
                .thenReturn(Optional.of(level));
    }

    private static CreateExerciseRequest request(String name, String muscleGroup, String movementGroup) {
        return new CreateExerciseRequest(name, "HEALTH", "desc", "REPS", muscleGroup, "Beginner",
                "Step", 3, 10, null, null, null, movementGroup);
    }

    private void stubCreator() {
        User creator = new User();
        creator.setId(5L);
        creator.setEmail(EMAIL);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(creator));
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> {
            Exercise saved = inv.getArgument(0);
            if (saved.getId() == null) {
                saved.setId(77L);
            }
            return saved;
        });
    }

    private static Exercise systemExercise() {
        Exercise exercise = new Exercise();
        exercise.setId(10L);
        exercise.setCode("EX_10");
        exercise.setName("Push-up");
        exercise.setType("HEALTH");
        exercise.setSource("SYSTEM");
        exercise.setCategory("REPS");
        exercise.setDifficultyLevel("Beginner");
        exercise.setInstructions("Description");
        exercise.setExecutionSteps("Step 1");
        exercise.setModerationStatus("ACTIVE");
        exercise.setActive(true);
        exercise.setDefaultSets(3);
        exercise.setDefaultReps(10);
        exercise.setUpdatedAt(LocalDateTime.of(2026, 1, 1, 10, 0));
        return exercise;
    }

    // ------------------------------------------------------------ create

    @ParameterizedTest
    @DisplayName("create: CM khai bao nhom chuyen dong -> luu dung nhom")
    @ValueSource(strings = {"PUSH", "PULL", "LEGS", "CORE"})
    void createStoresDeclaredMovementGroup(String group) {
        stubCreator();

        ExerciseResponse response = service.create(
                request("Push-up", "Chest", group), null, null, EMAIL);

        assertThat(response.movementGroup()).isEqualTo(group);
    }

    @ParameterizedTest
    @DisplayName("create: nhom khai bao khong hop le -> 400")
    @ValueSource(strings = {"SHOVE", "push-up", "42"})
    void createRejectsInvalidMovementGroup(String group) {
        stubCreator();

        assertThatThrownBy(() -> service.create(
                request("Push-up", "Chest", group), null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("create: nhom rong -> suy ra tu ten bai (pull-up -> PULL)")
    void createInfersPullFromName() {
        stubCreator();

        ExerciseResponse response = service.create(
                request("Pull-up", "Back", ""), null, null, EMAIL);

        assertThat(response.movementGroup()).isEqualTo("PULL");
    }

    @ParameterizedTest
    @DisplayName("create: ten bai khop -> suy ra dung nhom")
    @CsvSource({
            "Squats,LEGS",
            "Lunge,LEGS",
            "Nordic curl,LEGS",
            "Plank,CORE",
            "Hollow body,CORE",
            "Sit-up,CORE",
            "Leg raise,CORE",
            "Knee tuck,CORE",
            "Push-up,PUSH",
            "Dip,PUSH",
            "Planche,PUSH",
            "Handstand,PUSH",
            "Bench press,PUSH",
    })
    void createInfersMovementGroupFromName(String name, String expected) {
        stubCreator();

        ExerciseResponse response = service.create(
                request(name, "Full Body", ""), null, null, EMAIL);

        assertThat(response.movementGroup()).isEqualTo(expected);
    }

    @Test
    @DisplayName("create: ten khong khop tu khoa -> fallback PUSH")
    void createFallsBackToPush() {
        stubCreator();

        ExerciseResponse response = service.create(
                request("Mystery Move", "Full Body", ""), null, null, EMAIL);

        assertThat(response.movementGroup()).isEqualTo("PUSH");
    }

    @Test
    @DisplayName("create: ten rong -> 400 truocc khi suy ra nhom")
    void createRejectsBlankNameBeforeInferringGroup() {
        stubCreator();

        assertThatThrownBy(() -> service.create(
                request(" ", "Full Body", ""), null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    // ------------------------------------------------------------ update

    @Test
    @DisplayName("update: khai bao nhom moi -> ghi nhom do")
    void updateStoresDeclaredMovementGroup() {
        Exercise exercise = systemExercise();
        when(exercises.findByCode("EX_10")).thenReturn(Optional.of(exercise));
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> inv.getArgument(0));

        service.updateSystemExercise("EX_10",
                request("Push-up", "Chest", "CORE"), null, null);

        assertThat(exercise.getMovementGroup()).isEqualTo(Exercise.MovementGroup.CORE);
    }

    @Test
    @DisplayName("update: nhom rong -> giu nhom cu")
    void updateKeepsExistingGroupWhenNotDeclared() {
        Exercise exercise = systemExercise();
        exercise.setMovementGroup(Exercise.MovementGroup.PULL);
        when(exercises.findByCode("EX_10")).thenReturn(Optional.of(exercise));
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> inv.getArgument(0));

        service.updateSystemExercise("EX_10",
                request("Push-up", "Chest", ""), null, null);

        assertThat(exercise.getMovementGroup()).isEqualTo(Exercise.MovementGroup.PULL);
    }

    @Test
    @DisplayName("update: nhom khong hop le -> 400")
    void updateRejectsInvalidMovementGroup() {
        Exercise exercise = systemExercise();
        when(exercises.findByCode("EX_10")).thenReturn(Optional.of(exercise));

        assertThatThrownBy(() -> service.updateSystemExercise("EX_10",
                request("Push-up", "Chest", "SHOVE"), null, null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("update: nhom rong va bai chua co nhom -> suy ra tu ten bai")
    void updateInfersMovementGroupWhenMissing() {
        Exercise exercise = systemExercise();
        exercise.setMovementGroup(null);
        exercise.setName("Pull-up");
        when(exercises.findByCode("EX_10")).thenReturn(Optional.of(exercise));
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> inv.getArgument(0));

        service.updateSystemExercise("EX_10",
                request("Pull-up", "Back", ""), null, null);

        assertThat(exercise.getMovementGroup()).isEqualTo(Exercise.MovementGroup.PULL);
    }
}
