package com.calishealth.service;

import com.calishealth.dtos.ExerciseDtos.CreateExerciseRequest;
import com.calishealth.dtos.ExerciseDtos.ExerciseResponse;
import com.calishealth.dtos.ExerciseFilterRequestDTO;
import com.calishealth.dtos.FormRuleAdminDtos;
import com.calishealth.dtos.PageResponseDTO;
import com.calishealth.models.Exercise;
import com.calishealth.models.ExerciseMuscleGroup;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.MuscleGroup;
import com.calishealth.models.ProgressionRule;
import com.calishealth.models.User;
import com.calishealth.repository.ExerciseModerationHistoryRepository;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.ProgressionRuleRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test bổ sung cho {@link ExerciseService}: mapping response, duyet xoa, tao cap nhat
 * va cac nhanh validate con thieu.
 */
class ExerciseServiceCoverageTest {

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
    private FormRuleAdminService formRuleAdminService;
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
        formRuleAdminService = mock(FormRuleAdminService.class);
        service = new ExerciseService(
                exercises, moderationHistory, users, mock(JdbcTemplate.class), mediaRegistry,
                progressionRules, fitnessLevels, muscleGroupCatalog, systemNotifications,
                physiologyService, contentNameGuard, unlockService,
                formRuleAdminService);
    }

    // ------------------------------------------------------------------ helpers

    private static FitnessLevel level(String name, int min, String status) {
        FitnessLevel lv = new FitnessLevel();
        lv.setName(name);
        lv.setScoreMin(min);
        lv.setStatus(status);
        return lv;
    }

    private void stubLevels() {
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(
                level("Beginner", 0, "ACTIVE"),
                level("Intermediate", 30, "ACTIVE"),
                level("Advanced", 60, "INACTIVE")));
        lenient().when(fitnessLevels.findByNameIgnoreCase(anyString()))
                .thenAnswer(inv -> {
                    String name = inv.getArgument(0);
                    return fitnessLevels.findAll().stream()
                            .filter(l -> l.getName().equalsIgnoreCase(name))
                            .findFirst();
                });
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

    private static CreateExerciseRequest validRequest() {
        return new CreateExerciseRequest(
                "Push-up", "HEALTH", "desc", "REPS", "Chest", "Beginner",
                "Step 1\nStep 2", 3, 10, null, null);
    }

    // ------------------------------------------------------- getSystemExercises

    @Test
    @DisplayName("getSystemExercises: filter null -> 400")
    void getSystemExercisesRequiresFilter() {
        assertThatThrownBy(() -> service.getSystemExercises(null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("getSystemExercises: guest -> locked = null")
    void getSystemExercisesForGuestHasNoLockedFlag() {
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        when(exercises.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(e)));

        PageResponseDTO<?> result = service.getSystemExercises(new ExerciseFilterRequestDTO());

        assertThat(result.content()).hasSize(1);
        assertThat(result.totalElements()).isEqualTo(1L);
    }

    @Test
    @DisplayName("getSystemExercises: member -> danh dau bai dang khoa")
    void getSystemExercisesMarksLockedForMember() {
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        e.setId(55L);
        User member = new User();
        member.setId(7L);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        when(unlockService.statesByExercise(7L)).thenReturn(Map.of(55L, ExerciseUnlockService.STATE_LOCKED));
        when(exercises.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(Pageable.class))).thenReturn(new PageImpl<>(List.of(e)));

        var result = service.getSystemExercises(new ExerciseFilterRequestDTO(), EMAIL);

        assertThat(result.content()).hasSize(1);
        var item = (com.calishealth.dtos.ExerciseItemResponseDTO) result.content().get(0);
        assertThat(item.locked()).isTrue();
    }

    @Test
    @DisplayName("getSystemExercises: member khong ton tai -> locked = null")
    void getSystemExercisesUnknownMemberHasNoLockedFlag() {
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());
        when(exercises.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(Pageable.class))).thenReturn(new PageImpl<>(List.of(e)));

        var result = service.getSystemExercises(new ExerciseFilterRequestDTO(), EMAIL);

        var item = (com.calishealth.dtos.ExerciseItemResponseDTO) result.content().get(0);
        assertThat(item.locked()).isNull();
    }

    // ------------------------------------------------------ getSystemExerciseDetail

    @Test
    @DisplayName("getSystemExerciseDetail: bai khong active -> not found")
    void getSystemExerciseDetailRejectsInactive() {
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        e.setActive(false);
        when(exercises.findAcceptedByIdAndSource(10L, "SYSTEM")).thenReturn(Optional.of(e));

        assertThatThrownBy(() -> service.getSystemExerciseDetail(10L))
                .isInstanceOf(com.calishealth.exception.ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("getSystemExerciseDetail: member -> tinh co khoa")
    void getSystemExerciseDetailComputesLockedForMember() {
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        User member = new User();
        member.setId(7L);
        when(exercises.findAcceptedByIdAndSource(10L, "SYSTEM")).thenReturn(Optional.of(e));
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(member));
        when(unlockService.isLocked(10L, 7L)).thenReturn(true);

        var result = service.getSystemExerciseDetail(10L, EMAIL);

        assertThat(result.locked()).isTrue();
    }

    @Test
    @DisplayName("getSystemExerciseDetail: category HOLD duoc chuan hoa")
    void getSystemExerciseDetailNormalisesHoldCategory() {
        Exercise e = exercise("Plank", "HEALTH", "SYSTEM", "ACTIVE");
        e.setCategory("HOLD");
        when(exercises.findAcceptedByIdAndSource(10L, "SYSTEM")).thenReturn(Optional.of(e));

        var result = service.getSystemExerciseDetail(10L);

        assertThat(result.category()).isEqualTo("HOLD");
    }

    // ------------------------------------------------------------------ findAll

    @Test
    @DisplayName("findAll: bo qua bai DELETED va sap xep theo updatedAt giam dan")
    void findAllFiltersDeletedAndSorts() {
        Exercise a = exercise("A", "HEALTH", "SYSTEM", "ACTIVE");
        a.setUpdatedAt(LocalDateTime.of(2026, 2, 1, 10, 0));
        Exercise b = exercise("B", "HEALTH", "SYSTEM", "DELETED");
        b.setUpdatedAt(LocalDateTime.of(2026, 3, 1, 10, 0));
        Exercise c = exercise("C", "SKILL", "CUSTOM", "ACTIVE");
        c.setUpdatedAt(LocalDateTime.of(2026, 1, 1, 10, 0));
        stubLevels();
        when(exercises.findAll()).thenReturn(List.of(a, b, c));

        List<ExerciseResponse> result = service.findAll();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).name()).isEqualTo("A");
        assertThat(result.get(0).type()).isEqualTo("Health");
        assertThat(result.get(1).type()).isEqualTo("Skill");
    }

    @Test
    @DisplayName("findAll: level dang INACTIVE -> bai khong active")
    void findAllTreatsInactiveLevelAsInactive() {
        Exercise a = exercise("A", "HEALTH", "SYSTEM", "ACTIVE");
        a.setDifficultyLevel("Advanced");
        stubLevels();
        when(exercises.findAll()).thenReturn(List.of(a));

        List<ExerciseResponse> result = service.findAll();

        assertThat(result.get(0).levelActive()).isFalse();
        assertThat(result.get(0).active()).isFalse();
        assertThat(result.get(0).selfActive()).isTrue();
    }

    // --------------------------------------------------------------- findByCode

    @Test
    @DisplayName("findByCode: khong tim thay -> 404")
    void findByCodeNotFound() {
        when(exercises.findByCode("EX_1")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.findByCode("EX_1"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("findByCode: tra kem ho so sinh ly")
    void findByCodeIncludesPhysiology() {
        stubLevels();
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        e.setId(33L);
        when(exercises.findByCode("EX_33")).thenReturn(Optional.of(e));
        when(physiologyService.loadProfile(33L)).thenReturn(null);

        ExerciseResponse response = service.findByCode("EX_33");

        assertThat(response.code()).isEqualTo("EX_10");
        verify(physiologyService).loadProfile(33L);
    }

    // ------------------------------------------------------------ toGuestSafe

    @Test
    @DisplayName("toGuestSafe: bo guide, video va anatomy image")
    void toGuestSafeStripsSensitiveContent() {
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        e.setVideoUrl("/media/a.mp4");
        e.setAnatomyImageUrl("/media/b.png");
        stubLevels();
        when(exercises.findAll()).thenReturn(List.of(e));

        ExerciseResponse response = service.toGuestSafe(service.findAll().get(0));

        assertThat(response.guide()).isNull();
        assertThat(response.demoVideoUrl()).isNull();
        assertThat(response.anatomyImageUrl()).isNull();
    }

    @Test
    @DisplayName("toGuestSafe: null -> null")
    void toGuestSafeHandlesNull() {
        assertThat(service.toGuestSafe(null)).isNull();
    }

    // ------------------------------------------------------------------ create

    @Test
    @DisplayName("create: request null -> 400")
    void createRejectsNullRequest() {
        assertThatThrownBy(() -> service.create(null, null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("create: ten qua dai -> 400")
    void createRejectsTooLongName() {
        String longName = "a".repeat(121);
        assertThatThrownBy(() -> service.create(
                new CreateExerciseRequest(longName, "HEALTH", "d", "REPS", "Chest", "Beginner", "g", 3, 10, null, null),
                null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("create: khong co co ban -> 400")
    void createRejectsMissingMuscleGroup() {
        assertThatThrownBy(() -> service.create(
                new CreateExerciseRequest("Push", "HEALTH", "d", "REPS", "  ", "Beginner", "g", 3, 10, null, null),
                null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("create: type khong hop le -> 400")
    void createRejectsInvalidType() {
        stubLevels();
        assertThatThrownBy(() -> service.create(
                new CreateExerciseRequest("Push", "YOGA", "d", "REPS", "Chest", "Beginner", "g", 3, 10, null, null),
                null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("create: thieu huong dan -> 400")
    void createRequiresGuide() {
        stubLevels();
        assertThatThrownBy(() -> service.create(
                new CreateExerciseRequest("Push", "HEALTH", "d", "REPS", "Chest", "Beginner", " ", 3, 10, null, null),
                null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("create: sets ngoai khoang 1..20 -> 400")
    void createRejectsInvalidSets() {
        stubLevels();
        assertThatThrownBy(() -> service.create(
                new CreateExerciseRequest("Push", "HEALTH", "d", "REPS", "Chest", "Beginner", "g", 0, 10, null, null),
                null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("create: reps ngoai khoang -> 400")
    void createRejectsInvalidReps() {
        stubLevels();
        assertThatThrownBy(() -> service.create(
                new CreateExerciseRequest("Push", "HEALTH", "d", "REPS", "Chest", "Beginner", "g", 3, 0, null, null),
                null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("create: category REPS nhung co duration -> 400")
    void createRejectsMixedCategoryValues() {
        stubLevels();
        assertThatThrownBy(() -> service.create(
                new CreateExerciseRequest("Push", "HEALTH", "d", "REPS", "Chest", "Beginner", "g", 3, 10, 30, null),
                null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("create: user khong ton tai -> 401")
    void createRejectsUnknownUser() {
        stubLevels();
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(validRequest(), null, null, EMAIL))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    @DisplayName("create: bai hop le -> luu va gan code EX_<id>")
    void createPersistsSystemExercise() {
        stubLevels();
        User cm = new User();
        cm.setId(3L);
        cm.setFullName("Content Manager");
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(cm));
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> {
            Exercise e = inv.getArgument(0);
            e.setId(99L);
            return e;
        });

        ExerciseResponse response = service.create(validRequest(), "/media/v.mp4", "/media/a.png", EMAIL);

        assertThat(response.code()).isEqualTo("EX_99");
        assertThat(response.source()).isEqualTo("SYSTEM");
        verify(muscleGroupCatalog).assign(any(Exercise.class), eq("Chest"));
        verify(physiologyService).upsert(eq(99L), eq("SYSTEM"), eq(null));
    }

    @Test
    @DisplayName("create: CM khai bao nguong cham form -> luu nguong do")
    void createStoresFormRules() {
        stubLevels();
        User cm = new User();
        cm.setId(3L);
        cm.setFullName("Content Manager");
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(cm));
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> {
            Exercise e = inv.getArgument(0);
            e.setId(99L);
            return e;
        });

        var rule = new FormRuleAdminDtos.FormRuleInput(
                "ELBOW", new BigDecimal("165"), new BigDecimal("97"),
                null, null, new BigDecimal("0.30"), new BigDecimal("20") );
        var request = new CreateExerciseRequest(
                "Push-up", "HEALTH", "desc", "REPS", "Chest", "Beginner",
                "Step 1\nStep 2", 3, 10, null, null, List.of(rule));

        service.create(request, null, null, EMAIL);

        verify(formRuleAdminService).replaceFormRules(
                eq("EX_99"),
                any(FormRuleAdminDtos.FormRulesRequest.class),
                eq(FormRuleAdminService.SOURCE_CONTENT_MANAGER));
    }

    @Test
    @DisplayName("create: khong khai bao nguong -> khong goi service luu rule")
    void createSkipsFormRulesWhenAbsent() {
        stubLevels();
        User cm = new User();
        cm.setId(3L);
        cm.setFullName("Content Manager");
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(cm));
        when(exercises.save(any(Exercise.class))).thenAnswer(inv -> {
            Exercise e = inv.getArgument(0);
            e.setId(99L);
            return e;
        });

        service.create(validRequest(), null, null, EMAIL);

        verify(formRuleAdminService, never()).replaceFormRules(any(), any(), anyString());
    }

    // -------------------------------------------------- updateSystemExercise

    @Test
    @DisplayName("updateSystemExercise: khong tim thay -> 404")
    void updateSystemExerciseNotFound() {
        when(exercises.findByCode("EX_1")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateSystemExercise("EX_1", validRequest(), null, null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("updateSystemExercise: bai CUSTOM -> 403")
    void updateSystemExerciseRejectsCustomExercise() {
        Exercise e = exercise("Push-up", "HEALTH", "CUSTOM", "ACTIVE");
        when(exercises.findByCode("EX_10")).thenReturn(Optional.of(e));

        assertThatThrownBy(() -> service.updateSystemExercise("EX_10", validRequest(), null, null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    @DisplayName("updateSystemExercise: doi ten sang trung ten bai khac -> 409")
    void updateSystemExerciseRejectsDuplicateName() {
        stubLevels();
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        when(exercises.findByCode("EX_10")).thenReturn(Optional.of(e));
        doThrow409(contentNameGuard);

        assertThatThrownBy(() -> service.updateSystemExercise(
                "EX_10",
                new CreateExerciseRequest("Other", "HEALTH", "d", "REPS", "Chest", "Beginner", "g", 3, 10, null, null),
                null, null))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("updateSystemExercise: giu nguyen ten -> khong kiem tra trung ten")
    void updateSystemExerciseKeepsSameName() {
        stubLevels();
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        when(exercises.findByCode("EX_10")).thenReturn(Optional.of(e));
        when(exercises.save(any(Exercise.class))).thenReturn(e);

        ExerciseResponse response = service.updateSystemExercise("EX_10", validRequest(), null, null);

        assertThat(response.name()).isEqualTo("Push-up");
        verify(contentNameGuard, never()).assertExerciseNameNotUsedByExercise(anyString(), any());
    }

    @Test
    @DisplayName("updateSystemExercise: thay video moi -> giai phong video cu")
    void updateSystemExerciseReleasesReplacedVideo() {
        stubLevels();
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        e.setVideoUrl("/media/old.mp4");
        e.setAnatomyImageUrl("/media/old.png");
        when(exercises.findByCode("EX_10")).thenReturn(Optional.of(e));
        when(exercises.save(any(Exercise.class))).thenReturn(e);

        service.updateSystemExercise("EX_10", validRequest(), "/media/new.mp4", "/media/new.png");

        verify(mediaRegistry).release(eq("/media/old.mp4"), anyString());
        verify(mediaRegistry).release(eq("/media/old.png"), anyString());
    }

    @Test
    @DisplayName("updateSystemExercise: CM khai bao nguong cham form -> luu nguong do")
    void updateSystemExerciseStoresFormRules() {
        stubLevels();
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        when(exercises.findByCode("EX_10")).thenReturn(Optional.of(e));
        when(exercises.save(any(Exercise.class))).thenReturn(e);

        var rule = new FormRuleAdminDtos.FormRuleInput(
                "ELBOW", new BigDecimal("165"), new BigDecimal("97"),
                null, null, new BigDecimal("0.30"), new BigDecimal("20") );
        var request = new CreateExerciseRequest(
                "Push-up", "HEALTH", "desc", "REPS", "Chest", "Beginner",
                "Step 1\nStep 2", 3, 10, null, null, List.of(rule));

        service.updateSystemExercise("EX_10", request, null, null);

        verify(formRuleAdminService).replaceFormRules(
                eq("EX_10"),
                any(FormRuleAdminDtos.FormRulesRequest.class),
                eq(FormRuleAdminService.SOURCE_CONTENT_MANAGER));
    }

    @Test
    @DisplayName("updateSystemExercise: khong khai bao nguong -> khong goi service luu rule")
    void updateSystemExerciseSkipsFormRulesWhenAbsent() {
        stubLevels();
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        when(exercises.findByCode("EX_10")).thenReturn(Optional.of(e));
        when(exercises.save(any(Exercise.class))).thenReturn(e);

        service.updateSystemExercise("EX_10", validRequest(), null, null);

        verify(formRuleAdminService, never()).replaceFormRules(any(), any(), anyString());
    }

    @Test
    @DisplayName("updateSystemExercise: chuyen sang level INACTIVE -> 400")
    void updateSystemExerciseRejectsInactiveLevel() {
        stubLevels();
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        when(exercises.findByCode("EX_10")).thenReturn(Optional.of(e));

        assertThatThrownBy(() -> service.updateSystemExercise(
                "EX_10",
                new CreateExerciseRequest("Push-up", "HEALTH", "d", "REPS", "Chest", "Advanced", "g", 3, 10, null, null),
                null, null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    // ------------------------------------------------------------ deleteByCode

    @Test
    @DisplayName("deleteByCode: xoa thanh cong -> giai phong media")
    void deleteByCodeReleasesMedia() {
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        e.setVideoUrl("/media/v.mp4");
        e.setAnatomyImageUrl("/media/a.png");
        when(exercises.findByCode("EX_10")).thenReturn(Optional.of(e));

        service.deleteByCode("EX_10");

        verify(exercises).delete(e);
        verify(exercises).flush();
        verify(mediaRegistry).release(eq("/media/v.mp4"), anyString());
        verify(mediaRegistry).release(eq("/media/a.png"), anyString());
    }

    @Test
    @DisplayName("deleteByCode: con tham chieu -> 409")
    void deleteByCodeConflictsWhenReferenced() {
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        when(exercises.findByCode("EX_10")).thenReturn(Optional.of(e));
        org.mockito.Mockito.doThrow(new DataIntegrityViolationException("fk"))
                .when(exercises).delete(e);

        assertThatThrownBy(() -> service.deleteByCode("EX_10"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("deleteByCode: khong tim thay -> 404")
    void deleteByCodeNotFound() {
        when(exercises.findByCode("EX_1")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.deleteByCode("EX_1"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.NOT_FOUND));
    }

    // ------------------------------------------------------------ updateStatus

    @Test
    @DisplayName("updateStatus: bai SYSTEM o level INACTIVE khong the bat active -> 409")
    void updateStatusRejectsActivatingOnInactiveLevel() {
        stubLevels();
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        e.setDifficultyLevel("Advanced");
        when(exercises.findByCode("EX_10")).thenReturn(Optional.of(e));

        assertThatThrownBy(() -> service.updateStatus("EX_10", true, null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode())
                        .isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("updateStatus: bai SYSTEM vo hieu hoa -> moderationStatus = INACTIVE")
    void updateStatusDeactivatesSystemExercise() {
        stubLevels();
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        when(exercises.findByCode("EX_10")).thenReturn(Optional.of(e));
        when(exercises.saveAndFlush(any(Exercise.class))).thenReturn(e);

        ExerciseResponse response = service.updateStatus("EX_10", false, "Chua dung ky thuat");

        assertThat(e.getModerationStatus()).isEqualTo("INACTIVE");
        assertThat(response.selfActive()).isFalse();
        verify(moderationHistory, never()).insert(anyString(), anyString(), anyString(), any(),
                any(), any(), any(), any(), any(), any(), any(), anyString(), any());
    }

    // -------------------------------------------------- findPendingModeration

    @Test
    @DisplayName("findPendingModeration: chi lay bai CUSTOM dang cho duyet")
    void findPendingModerationFiltersCorrectly() {
        stubLevels();
        Exercise pending = exercise("Pending", "HEALTH", "CUSTOM", "PENDING");
        pending.setActive(false);
        Exercise system = exercise("System", "HEALTH", "SYSTEM", "ACTIVE");
        Exercise rejected = exercise("Rejected", "HEALTH", "CUSTOM", "REJECTED");
        rejected.setActive(false);
        when(exercises.findAll()).thenReturn(List.of(pending, system, rejected));

        List<ExerciseResponse> result = service.findPendingModeration();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).name()).isEqualTo("Pending");
    }

    // ------------------------------------------------------------- helpers

    private void doThrow409(ContentNameGuardService guard) {
        org.mockito.Mockito.doThrow(new ResponseStatusException(HttpStatus.CONFLICT, "Duplicate"))
                .when(guard).assertExerciseNameNotUsedByExercise(anyString(), any());
    }

    @Test
    @DisplayName("autoCheckStatus: bai thieu duong dan -> NEEDS_REVIEW")
    void autoCheckStatusNeedsReview() {
        stubLevels();
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        e.setExecutionSteps(null);
        when(exercises.findAll()).thenReturn(List.of(e));

        List<ExerciseResponse> result = service.findAll();

        assertThat(result.get(0).autoCheckStatus()).isEqualTo("NEEDS_REVIEW");
    }

    @Test
    @DisplayName("findAll: bai khong co muscle group -> muscleGroup null")
    void findAllHandlesMissingMuscleGroups() {
        stubLevels();
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        when(exercises.findAll()).thenReturn(List.of(e));

        List<ExerciseResponse> result = service.findAll();

        assertThat(result.get(0).muscleGroup()).isNull();
    }

    @Test
    @DisplayName("findAll: gon nhieu co ban -> muscleGroup ghep bang dau cham")
    void findAllConcatenatesMuscleGroups() {
        stubLevels();
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        MuscleGroup chest = new MuscleGroup();
        chest.setId(1L);
        chest.setName("Chest");
        MuscleGroup triceps = new MuscleGroup();
        triceps.setId(2L);
        triceps.setName("Triceps");
        ExerciseMuscleGroup a = new ExerciseMuscleGroup();
        a.setMuscleGroup(chest);
        ExerciseMuscleGroup b = new ExerciseMuscleGroup();
        b.setMuscleGroup(triceps);
        e.getMuscleGroups().add(a);
        e.getMuscleGroups().add(b);
        when(exercises.findAll()).thenReturn(List.of(e));

        List<ExerciseResponse> result = service.findAll();

        assertThat(result.get(0).muscleGroup()).isEqualTo("Chest · Triceps");
    }

    @Test
    @DisplayName("getSystemExerciseDetail: bai khong co guide -> guideSteps rong")
    void getSystemExerciseDetailWithoutGuide() {
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        e.setExecutionSteps(null);
        when(exercises.findAcceptedByIdAndSource(10L, "SYSTEM")).thenReturn(Optional.of(e));

        var result = service.getSystemExerciseDetail(10L);

        assertThat(result.guideSteps()).isEmpty();
    }

    @Test
    @DisplayName("getSystemExerciseDetail: co bai ke tiep trong cay tien trinh")
    void getSystemExerciseDetailListsNextExercises() {
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        e.setId(20L);
        ProgressionRule rule = new ProgressionRule();
        Exercise next = new Exercise();
        next.setId(21L);
        next.setName("Archer Push-up");
        rule.setExercise(next);
        rule.setPrerequisiteExercise(e);
        when(exercises.findAcceptedByIdAndSource(20L, "SYSTEM")).thenReturn(Optional.of(e));
        when(progressionRules.findAllByExercise_IdOrPrerequisiteExercise_Id(20L, 20L)).thenReturn(List.of(rule));
        when(exercises.findAllById(any())).thenReturn(List.of(next));

        var result = service.getSystemExerciseDetail(20L);

        assertThat(result.nextExercises()).containsExactly("Archer Push-up");
    }

    @Test
    @DisplayName("findApprovalHistory: tra ve lich su duyet")
    void findApprovalHistoryDelegatesToRepository() {
        when(moderationHistory.findAll()).thenReturn(List.of());

        assertThat(service.findApprovalHistory()).isEmpty();
    }

    @Test
    @DisplayName("getSystemExerciseDetail: level null -> level null")
    void getSystemExerciseDetailWithoutLevel() {
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        e.setDifficultyLevel(null);
        when(exercises.findAcceptedByIdAndSource(10L, "SYSTEM")).thenReturn(Optional.of(e));

        var result = service.getSystemExerciseDetail(10L);

        assertThat(result.level()).isNull();
    }

    @Test
    @DisplayName("getSystemExerciseDetail: goal va targetSkill null -> null")
    void getSystemExerciseDetailWithoutGoal() {
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        when(exercises.findAcceptedByIdAndSource(10L, "SYSTEM")).thenReturn(Optional.of(e));

        var result = service.getSystemExerciseDetail(10L);

        assertThat(result.goal()).isNull();
        assertThat(result.targetSkill()).isNull();
    }

    @Test
    @DisplayName("getSystemExerciseDetail: category REPS")
    void getSystemExerciseDetailRepsCategory() {
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        when(exercises.findAcceptedByIdAndSource(10L, "SYSTEM")).thenReturn(Optional.of(e));

        var result = service.getSystemExerciseDetail(10L);

        assertThat(result.category()).isEqualTo("REPS");
    }

    @Test
    @DisplayName("getSystemExercises: doi voi filter co type SKILL")
    void getSystemExercisesWithSkillType() {
        Exercise e = exercise("Handstand", "SKILL", "SYSTEM", "ACTIVE");
        when(exercises.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(Pageable.class))).thenReturn(new PageImpl<>(List.of(e)));
        ExerciseFilterRequestDTO filter = new ExerciseFilterRequestDTO();
        filter.setType(ExerciseFilterRequestDTO.ExerciseType.SKILL);

        var result = service.getSystemExercises(filter);

        var item = (com.calishealth.dtos.ExerciseItemResponseDTO) result.content().get(0);
        assertThat(item.type()).isEqualTo(ExerciseFilterRequestDTO.ExerciseType.SKILL);
    }

    @Test
    @DisplayName("findAll: bai khong co source -> SYSTEM")
    void findAllDefaultsSourceToSystem() {
        stubLevels();
        Exercise e = exercise("Push-up", "HEALTH", "SYSTEM", "ACTIVE");
        e.setSource(null);
        e.setCreatedBy(null);
        when(exercises.findAll()).thenReturn(List.of(e));

        List<ExerciseResponse> result = service.findAll();

        assertThat(result.get(0).source()).isEqualTo("SYSTEM");
    }

    @Test
    @DisplayName("findAll: bai co source CUSTOM -> CUSTOM")
    void findAllKeepsCustomSource() {
        stubLevels();
        Exercise e = exercise("Push-up", "HEALTH", "CUSTOM", "ACTIVE");
        when(exercises.findAll()).thenReturn(List.of(e));

        List<ExerciseResponse> result = service.findAll();

        assertThat(result.get(0).source()).isEqualTo("CUSTOM");
    }

    @Test
    @DisplayName("getSystemExercises: danh sach rong -> locked null")
    void getSystemExercisesEmptyPage() {
        when(exercises.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(Pageable.class))).thenReturn(new PageImpl<>(List.of()));

        var result = service.getSystemExercises(new ExerciseFilterRequestDTO(), EMAIL);

        assertThat(result.content()).isEmpty();
        verify(unlockService, never()).statesByExercise(anyLong());
    }
}
