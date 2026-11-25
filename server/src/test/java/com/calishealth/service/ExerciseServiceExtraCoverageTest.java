package com.calishealth.service;

import com.calishealth.dtos.ExerciseDtos.CreateExerciseRequest;
import com.calishealth.dtos.ExerciseDtos.ExerciseResponse;
import com.calishealth.models.Exercise;
import com.calishealth.models.ExerciseMuscleGroup;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.MuscleGroup;
import com.calishealth.models.User;
import com.calishealth.repository.ExerciseModerationHistoryRepository;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.ProgressionRuleRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test bổ sung cho {@link ExerciseService}: các nhánh validate còn thiếu của create/update,
 * mapping muscle group và các nhánh của chi tiết bài tập.
 */
class ExerciseServiceExtraCoverageTest {

    private ExerciseRepository exercises;
    private ExerciseModerationHistoryRepository moderationHistory;
    private UserRepository users;
    private MediaRegistryService mediaRegistry;
    private ProgressionRuleRepository progressionRules;
    private FitnessLevelRepository fitnessLevels;
    private ExerciseMuscleGroupCatalog muscleGroupCatalog;
    private SystemNotificationService systemNotifications;
    private ExercisePhysiologyService physiologyService;
    private ContentNameGuardService contentNameGuard;
    private ExerciseUnlockService unlockService;
    private ExerciseService service;

    private static final String EMAIL = "cm@calishealth.vn";

    @BeforeEach
    void setUp() {
        exercises = mock(ExerciseRepository.class);
        moderationHistory = mock(ExerciseModerationHistoryRepository.class);
        users = mock(UserRepository.class);
        mediaRegistry = mock(MediaRegistryService.class);
        progressionRules = mock(ProgressionRuleRepository.class);
        fitnessLevels = mock(FitnessLevelRepository.class);
        muscleGroupCatalog = mock(ExerciseMuscleGroupCatalog.class);
        systemNotifications = mock(SystemNotificationService.class);
        physiologyService = mock(ExercisePhysiologyService.class);
        contentNameGuard = mock(ContentNameGuardService.class);
        unlockService = mock(ExerciseUnlockService.class);
        service = new ExerciseService(
                exercises, moderationHistory, users, mock(JdbcTemplate.class), mediaRegistry,
                progressionRules, fitnessLevels, muscleGroupCatalog, systemNotifications,
                physiologyService, contentNameGuard, unlockService,
                mock(FormRuleAdminService.class));

        List<FitnessLevel> levels = List.of(
                level("Beginner", 0, "ACTIVE"),
                level("Intermediate", 30, "ACTIVE"),
                level("Advanced", 60, "INACTIVE"));
        lenient().when(fitnessLevels.findAll()).thenReturn(levels);
        lenient().when(fitnessLevels.findByNameIgnoreCase(anyString())).thenAnswer(inv -> {
            String name = inv.getArgument(0, String.class);
            return levels.stream().filter(l -> l.getName().equalsIgnoreCase(name)).findFirst();
        });
    }

    private static FitnessLevel level(String name, int min, String status) {
        FitnessLevel lv = new FitnessLevel();
        lv.setName(name);
        lv.setScoreMin(min);
        lv.setStatus(status);
        return lv;
    }

    private static Exercise exercise(String name, String type, String source, String status) {
        Exercise e = new Exercise();
        e.setId(10L);
        e.setCode("EX_10");
        e.setName(name);
        e.setType(type);
        e.setSource(source);
        e.setCategory("REPS");
        e.setDifficultyLevel("Beginner");
        e.setInstructions("Description");
        e.setExecutionSteps("Step 1\nStep 2");
        e.setModerationStatus(status);
        e.setActive(true);
        e.setDefaultSets(3);
        e.setDefaultReps(10);
        e.setUpdatedAt(LocalDateTime.of(2026, 1, 1, 10, 0));
        return e;
    }

    private static CreateExerciseRequest request(String name, String type, String category, String level,
            String muscleGroup, String guide, Integer sets, Integer reps, Integer duration) {
        return new CreateExerciseRequest(name, type, "desc", category, muscleGroup, level, guide, sets, reps,
                duration, null);
    }

    // ------------------------------------------------------------ create

    @Test
    @DisplayName("create: request null -> 400")
    void createRejectsNullRequest() {
        assertThatThrownBy(() -> service.create(null, null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("create: ten rong -> 400")
    void createRejectsBlankName() {
        assertThatThrownBy(() -> service.create(
                request(" ", "HEALTH", "REPS", "Beginner", "Chest", "Step", 3, 10, null), null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("create: ten qua dai -> 400")
    void createRejectsTooLongName() {
        assertThatThrownBy(() -> service.create(
                request("x".repeat(121), "HEALTH", "REPS", "Beginner", "Chest", "Step", 3, 10, null),
                null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("create: muscle group rong -> 400")
    void createRejectsBlankMuscleGroup() {
        assertThatThrownBy(() -> service.create(
                request("Push-up", "HEALTH", "REPS", "Beginner", " ", "Step", 3, 10, null), null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("create: category khong hop le -> 400")
    void createRejectsInvalidCategory() {
        assertThatThrownBy(() -> service.create(
                request("Push-up", "HEALTH", "OTHER", "Beginner", "Chest", "Step", 3, 10, null), null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("create: type rong -> 400")
    void createRejectsBlankType() {
        assertThatThrownBy(() -> service.create(
                request("Push-up", " ", "REPS", "Beginner", "Chest", "Step", 3, 10, null), null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("create: type khong hop le -> 400")
    void createRejectsInvalidType() {
        assertThatThrownBy(() -> service.create(
                request("Push-up", "YOGA", "REPS", "Beginner", "Chest", "Step", 3, 10, null), null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("create: guide rong -> 400")
    void createRejectsBlankGuide() {
        assertThatThrownBy(() -> service.create(
                request("Push-up", "HEALTH", "REPS", "Beginner", "Chest", " ", 3, 10, null), null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("create: sets ngoai khoang -> 400")
    void createRejectsInvalidSets() {
        assertThatThrownBy(() -> service.create(
                request("Push-up", "HEALTH", "REPS", "Beginner", "Chest", "Step", 0, 10, null), null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("create: reps rong voi category REPS -> 400")
    void createRejectsMissingReps() {
        assertThatThrownBy(() -> service.create(
                request("Push-up", "HEALTH", "REPS", "Beginner", "Chest", "Step", 3, null, null), null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("create: reps va duration cung co -> 400")
    void createRejectsBothRepsAndDuration() {
        assertThatThrownBy(() -> service.create(
                request("Push-up", "HEALTH", "REPS", "Beginner", "Chest", "Step", 3, 10, 30), null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("create: category HOLD nhung co reps -> 400")
    void createRejectsRepsForHoldCategory() {
        assertThatThrownBy(() -> service.create(
                request("Plank", "HEALTH", "HOLD", "Beginner", "Core", "Step", 3, 10, 30), null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("create: level dang INACTIVE -> 400")
    void createRejectsInactiveLevel() {
        assertThatThrownBy(() -> service.create(
                request("Push-up", "HEALTH", "REPS", "Advanced", "Chest", "Step", 3, 10, null), null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("create: level khong ton tai -> 400")
    void createRejectsUnknownLevel() {
        assertThatThrownBy(() -> service.create(
                request("Push-up", "HEALTH", "REPS", "Ghost", "Chest", "Step", 3, 10, null), null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("create: thanh cong -> luu va sinh code he thong")
    void createSucceeds() {
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

        ExerciseResponse response = service.create(
                request("Push-up", "HEALTH", "REPS", "Beginner", "Chest", "Step", 3, 10, null),
                "https://video/a.mp4", "https://img/a.png", EMAIL);

        assertThat(response.name()).isEqualTo("Push-up");
        assertThat(response.type()).isEqualTo("Health");
        verify(muscleGroupCatalog).assign(any(Exercise.class), eq("Chest"));
    }

    // ------------------------------------------------------------ update

    @Test
    @DisplayName("update: bai khong ton tai -> 404")
    void updateRequiresExistingExercise() {
        when(exercises.findByCode("EX_10")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateSystemExercise("EX_10",
                request("Push-up", "HEALTH", "REPS", "Beginner", "Chest", "Step", 3, 10, null), null, null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("update: bai cua member -> 403")
    void updateRejectsCustomExercise() {
        Exercise e = exercise("Push-up", "HEALTH", "CUSTOM", "ACTIVE");
        when(exercises.findByCode("EX_10")).thenReturn(Optional.of(e));

        assertThatThrownBy(() -> service.updateSystemExercise("EX_10",
                request("Push-up", "HEALTH", "REPS", "Beginner", "Chest", "Step", 3, 10, null), null, null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    @DisplayName("update: request null -> 400")
    void updateRejectsNullRequest() {
        when(exercises.findByCode("EX_10"))
                .thenReturn(Optional.of(exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE")));

        assertThatThrownBy(() -> service.updateSystemExercise("EX_10", null, null, null))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("update: ten rong -> 400")
    void updateRejectsBlankName() {
        when(exercises.findByCode("EX_10"))
                .thenReturn(Optional.of(exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE")));

        assertThatThrownBy(() -> service.updateSystemExercise("EX_10",
                request(" ", "HEALTH", "REPS", "Beginner", "Chest", "Step", 3, 10, null), null, null))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("update: doi ten -> kiem tra trung ten")
    void updateChecksDuplicateNameOnRename() {
        when(exercises.findByCode("EX_10"))
                .thenReturn(Optional.of(exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE")));
        org.mockito.Mockito.doThrow(new ResponseStatusException(HttpStatus.CONFLICT, "Duplicate name"))
                .when(contentNameGuard).assertExerciseNameNotUsedByExercise("Pull-up", 10L);

        assertThatThrownBy(() -> service.updateSystemExercise("EX_10",
                request("Pull-up", "HEALTH", "REPS", "Beginner", "Chest", "Step", 3, 10, null), null, null))
                .isInstanceOf(ResponseStatusException.class);
        verify(contentNameGuard).assertExerciseNameNotUsedByExercise("Pull-up", 10L);
    }

    @Test
    @DisplayName("update: muscle group rong -> 400")
    void updateRejectsBlankMuscleGroup() {
        when(exercises.findByCode("EX_10"))
                .thenReturn(Optional.of(exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE")));

        assertThatThrownBy(() -> service.updateSystemExercise("EX_10",
                request("Push-up", "HEALTH", "REPS", "Beginner", " ", "Step", 3, 10, null), null, null))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("update: type rong -> 400")
    void updateRejectsBlankType() {
        when(exercises.findByCode("EX_10"))
                .thenReturn(Optional.of(exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE")));

        assertThatThrownBy(() -> service.updateSystemExercise("EX_10",
                request("Push-up", " ", "REPS", "Beginner", "Chest", "Step", 3, 10, null), null, null))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("update: category khong hop le -> 400")
    void updateRejectsInvalidCategory() {
        when(exercises.findByCode("EX_10"))
                .thenReturn(Optional.of(exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE")));

        assertThatThrownBy(() -> service.updateSystemExercise("EX_10",
                request("Push-up", "HEALTH", "OTHER", "Beginner", "Chest", "Step", 3, 10, null), null, null))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("update: doi sang level INACTIVE -> 400")
    void updateRejectsInactiveLevelChange() {
        when(exercises.findByCode("EX_10"))
                .thenReturn(Optional.of(exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE")));

        assertThatThrownBy(() -> service.updateSystemExercise("EX_10",
                request("Push-up", "HEALTH", "REPS", "Advanced", "Chest", "Step", 3, 10, null), null, null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("update: giu nguyen level cu -> khong kiem tra active")
    void updateAllowsKeepingInactiveLevel() {
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        e.setDifficultyLevel("Advanced");
        when(exercises.findByCode("EX_10")).thenReturn(Optional.of(e));
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> inv.getArgument(0));

        service.updateSystemExercise("EX_10",
                request("Push-up", "HEALTH", "REPS", "Advanced", "Chest", "Step", 3, 10, null), null, null);

        assertThat(e.getDifficultyLevel()).isEqualTo("Advanced");
    }

    @Test
    @DisplayName("update: video moi -> giai phong video cu")
    void updateReleasesReplacedVideo() {
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        e.setVideoUrl("https://video/old.mp4");
        e.setAnatomyImageUrl("https://img/old.png");
        when(exercises.findByCode("EX_10")).thenReturn(Optional.of(e));
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> inv.getArgument(0));

        service.updateSystemExercise("EX_10",
                request("Push-up", "HEALTH", "REPS", "Beginner", "Chest", "Step", 3, 10, null),
                "https://video/new.mp4", "https://img/new.png");

        verify(mediaRegistry).release(eq("https://video/old.mp4"), anyString());
        verify(mediaRegistry).release(eq("https://img/old.png"), anyString());
    }

    // ------------------------------------------------------------ detail

    @Test
    @DisplayName("getSystemExerciseDetail: guide rong -> danh sach buoc rong")
    void getSystemExerciseDetailWithoutGuide() {
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        e.setExecutionSteps(null);
        e.setGuideSteps(null);
        when(exercises.findAcceptedByIdAndSource(10L, "SYSTEM")).thenReturn(Optional.of(e));

        var result = service.getSystemExerciseDetail(10L);

        assertThat(result.guideSteps()).isEmpty();
    }

    @Test
    @DisplayName("getSystemExerciseDetail: chi co 1 buoc -> bo sung buoc chuan bi")
    void getSystemExerciseDetailExpandsSingleStep() {
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        e.setExecutionSteps("Do it");
        when(exercises.findAcceptedByIdAndSource(10L, "SYSTEM")).thenReturn(Optional.of(e));

        var result = service.getSystemExerciseDetail(10L);

        assertThat(result.guideSteps()).hasSize(4);
    }

    @Test
    @DisplayName("getSystemExerciseDetail: khong co muscle group -> dung nhan mac dinh")
    void getSystemExerciseDetailUsesDefaultMuscleLabel() {
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        e.setMuscleGroup(null);
        e.setExecutionSteps(null);
        e.setGuideSteps(null);
        when(exercises.findAcceptedByIdAndSource(10L, "SYSTEM")).thenReturn(Optional.of(e));

        var result = service.getSystemExerciseDetail(10L);

        assertThat(result.guideSteps()).isEmpty();
    }

    @Test
    @DisplayName("getSystemExerciseDetail: member khong ton tai -> locked = false")
    void getSystemExerciseDetailUnknownMemberHasNoLock() {
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        when(exercises.findAcceptedByIdAndSource(10L, "SYSTEM")).thenReturn(Optional.of(e));
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThat(service.getSystemExerciseDetail(10L, EMAIL).locked()).isFalse();
    }

    @Test
    @DisplayName("getSystemExerciseDetail: guest -> locked = null")
    void getSystemExerciseDetailForGuestHasNoLock() {
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        when(exercises.findAcceptedByIdAndSource(10L, "SYSTEM")).thenReturn(Optional.of(e));

        assertThat(service.getSystemExerciseDetail(10L, null).locked()).isNull();
    }

    // ------------------------------------------------------------ mapping

    @Test
    @DisplayName("findAll: bai co muscle group -> ghep ten khong trung")
    void findAllMapsMuscleGroups() {
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        e.setMuscleGroups(List.of(muscleLink("Chest"), muscleLink("Chest"), muscleLink("Triceps")));
        when(exercises.findAll()).thenReturn(List.of(e));

        assertThat(service.findAll().get(0).muscleGroup()).isEqualTo("Chest · Triceps");
    }

    @Test
    @DisplayName("findAll: bai khong co muscle group -> null")
    void findAllWithoutMuscleGroups() {
        when(exercises.findAll()).thenReturn(List.of(exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE")));

        assertThat(service.findAll().get(0).muscleGroup()).isNull();
    }

    @Test
    @DisplayName("findByCode: bai khong ton tai -> 404")
    void findByCodeNotFound() {
        when(exercises.findByCode("NOPE")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.findByCode("NOPE"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("findByCode: bai khong co creator -> source SYSTEM")
    void findByCodeWithoutCreatorIsSystem() {
        Exercise e = exercise("Push-up", "HEALTH", null, "ACTIVE");
        when(exercises.findByCode("EX_10")).thenReturn(Optional.of(e));

        assertThat(service.findByCode("EX_10").source()).isEqualTo("SYSTEM");
    }

    @Test
    @DisplayName("findByCode: bai co creator -> source CUSTOM")
    void findByCodeWithCreatorIsCustom() throws Exception {
        Exercise e = exercise("Push-up", "HEALTH", null, "ACTIVE");
        User creator = new User();
        creator.setFullName("Member");
        e.setCreatedBy(creator);
        // source null chi xay ra khi du lieu cu chua migrate -> phai fallback theo creator.
        java.lang.reflect.Field field = Exercise.class.getDeclaredField("source");
        field.setAccessible(true);
        field.set(e, null);
        when(exercises.findByCode("EX_10")).thenReturn(Optional.of(e));

        assertThat(service.findByCode("EX_10").source()).isEqualTo("CUSTOM");
    }

    @Test
    @DisplayName("toGuestSafe: bo guide, video va anh giai phau")
    void toGuestSafeRemovesPremiumContent() {
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        e.setVideoUrl("https://video/a.mp4");
        e.setAnatomyImageUrl("https://img/a.png");
        when(exercises.findByCode("EX_10")).thenReturn(Optional.of(e));

        ExerciseResponse guest = service.toGuestSafe(service.findByCode("EX_10"));

        assertThat(guest.guide()).isNull();
        assertThat(guest.demoVideoUrl()).isNull();
        assertThat(guest.anatomyImageUrl()).isNull();
        assertThat(service.toGuestSafe(null)).isNull();
    }

    private static ExerciseMuscleGroup muscleLink(String name) {
        MuscleGroup group = new MuscleGroup();
        group.setName(name);
        ExerciseMuscleGroup link = new ExerciseMuscleGroup();
        link.setMuscleGroup(group);
        return link;
    }
}
