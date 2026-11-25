package com.calishealth.service;

import com.calishealth.dtos.CreatePersonalExerciseRequestDTO;
import com.calishealth.dtos.FormRuleAdminDtos.FormRuleInput;
import com.calishealth.dtos.FormRuleAdminDtos.FormRulesRequest;
import com.calishealth.models.Exercise;
import com.calishealth.models.User;
import com.calishealth.repository.ExerciseModerationHistoryRepository;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Test phần mới của {@link PersonalExerciseService}: nhóm chuyển động và
 * ngưỡng chấm form do member khai báo.
 */
class PersonalExerciseServiceFormRuleTest {

    private static final String EMAIL = "member@calishealth.vn";

    private ExerciseRepository exercises;
    private ContentModerationService moderation;
    private ExerciseVideoStorageService videoStorage;
    private FormRuleAdminService formRuleAdminService;
    private PersonalExerciseService service;

    @BeforeEach
    void setUp() {
        exercises = mock(ExerciseRepository.class);
        UserRepository users = mock(UserRepository.class);
        FitnessLevelRepository fitnessLevels = mock(FitnessLevelRepository.class);
        moderation = mock(ContentModerationService.class);
        videoStorage = mock(ExerciseVideoStorageService.class);
        formRuleAdminService = mock(FormRuleAdminService.class);

        service = new PersonalExerciseService(
                exercises,
                mock(ExerciseModerationHistoryRepository.class),
                users,
                fitnessLevels,
                moderation,
                videoStorage,
                mock(MediaRegistryService.class),
                mock(ExerciseMuscleGroupCatalog.class),
                mock(SystemNotificationService.class),
                mock(ContentNameGuardService.class),
                formRuleAdminService);

        User member = new User();
        member.setId(7L);
        member.setEmail(EMAIL);
        member.setFullName("Member One");
        lenientUsers(users);

        var level = new com.calishealth.models.FitnessLevel();
        level.setId(1L);
        level.setName("Beginner");
        level.setStatus("ACTIVE");
        org.mockito.Mockito.lenient()
                .when(fitnessLevels.findByNameIgnoreCase(anyString()))
                .thenReturn(Optional.of(level));
        org.mockito.Mockito.lenient()
                .when(moderation.checkText(anyString(), any(), any(), any())).thenReturn(null);
        org.mockito.Mockito.lenient()
                .when(moderation.checkVideo(any())).thenReturn(null);
        org.mockito.Mockito.lenient()
                .when(moderation.combine(any(), any()))
                .thenReturn(new ContentModerationService.ModerationResult(true, null));
        org.mockito.Mockito.lenient()
                .when(videoStorage.store(any(), anyString())).thenReturn(null);
        org.mockito.Mockito.lenient()
                .when(videoStorage.storeAnatomyImage(any(), anyString())).thenReturn(null);
        org.mockito.Mockito.lenient()
                .when(exercises.save(any(Exercise.class))).thenAnswer(inv -> {
                    Exercise saved = inv.getArgument(0);
                    if (saved.getId() == null) {
                        saved.setId(55L);
                    }
                    return saved;
                });
    }

    private void lenientUsers(UserRepository users) {
        org.mockito.Mockito.lenient()
                .when(users.findByEmail(EMAIL)).thenReturn(Optional.of(user()));
    }

    private User user() {
        User user = new User();
        user.setId(7L);
        user.setEmail(EMAIL);
        user.setFullName("Member One");
        return user;
    }

    /** Request có thêm nhóm chuyển động và ngưỡng chấm form. */
    private CreatePersonalExerciseRequestDTO request(String title,
                                                    String movementGroup,
                                                    List<FormRuleInput> formRules) {
        return new CreatePersonalExerciseRequestDTO(
                title, "desc", "Beginner", List.of("step one"), "Chest",
                3, 10, null, true, false, "reps_sets", null, null, null,
                movementGroup, formRules);
    }

    private static FormRuleInput elbowRule() {
        return new FormRuleInput("ELBOW", new BigDecimal("165"), new BigDecimal("97"),
                null, null, new BigDecimal("0.30"), new BigDecimal("20"));
    }

    @Test
    @DisplayName("create: member khai bao nhom chuyen dong -> luu nhom do")
    void createStoresMovementGroup() {
        var response = service.createPersonalExercise(
                EMAIL, request("Bench Press", "PULL", List.of()), null);

        assertThat(response.movementGroup()).isEqualTo("PULL");
    }

    @Test
    @DisplayName("create: khong khai bao nhom -> suy ra tu ten bai (pull-up -> PULL)")
    void createInfersMovementGroupFromName() {
        var response = service.createPersonalExercise(
                EMAIL, request("Barbell Row", null, List.of()), null);

        assertThat(response.movementGroup()).isEqualTo("PULL");
    }

    @Test
    @DisplayName("create: ten khong khop -> fallback PUSH")
    void createFallsBackToPush() {
        var response = service.createPersonalExercise(
                EMAIL, request("Mystery Move", null, List.of()), null);

        assertThat(response.movementGroup()).isEqualTo("PUSH");
    }

    @Test
    @DisplayName("create: ten co 'squat' -> LEGS")
    void createInfersLegs() {
        var response = service.createPersonalExercise(
                EMAIL, request("Bulgarian Squat", null, List.of()), null);

        assertThat(response.movementGroup()).isEqualTo("LEGS");
    }

    @Test
    @DisplayName("create: ten so nhiều 'squats' -> LEGS")
    void createInfersLegsFromPluralName() {
        var response = service.createPersonalExercise(
                EMAIL, request("Bodyweight Squats", null, List.of()), null);

        assertThat(response.movementGroup()).isEqualTo("LEGS");
    }

    @Test
    @DisplayName("create: ten co 'push-ups' -> PUSH")
    void createInfersPushFromPluralName() {
        var response = service.createPersonalExercise(
                EMAIL, request("Push-ups", null, List.of()), null);

        assertThat(response.movementGroup()).isEqualTo("PUSH");
    }

    @Test
    @DisplayName("create: ten co 'leg raise' -> CORE")
    void createInfersCoreFromLegRaise() {
        var response = service.createPersonalExercise(
                EMAIL, request("Leg Raise", null, List.of()), null);

        assertThat(response.movementGroup()).isEqualTo("CORE");
    }

    @Test
    @DisplayName("create: ten co 'knee tuck' -> CORE")
    void createInfersCoreFromKneeTuck() {
        var response = service.createPersonalExercise(
                EMAIL, request("Knee Tuck", null, List.of()), null);

        assertThat(response.movementGroup()).isEqualTo("CORE");
    }

    @Test
    @DisplayName("create: ten co 'plank' -> CORE")
    void createInfersCore() {
        var response = service.createPersonalExercise(
                EMAIL, request("Side Plank", null, List.of()), null);

        assertThat(response.movementGroup()).isEqualTo("CORE");
    }

    @Test
    @DisplayName("create: co khai bao nguong cham form -> luu ngung do")
    void createStoresFormRules() {
        service.createPersonalExercise(
                EMAIL, request("Push Up", "PUSH", List.of(elbowRule())), null);

        verify(formRuleAdminService).replaceFormRules(
                eq("CU_55"),
                any(FormRulesRequest.class),
                eq(FormRuleAdminService.SOURCE_MEMBER));
    }

    @Test
    @DisplayName("create: khong khai bao nguong -> khong goi service luu rule")
    void createSkipsFormRulesWhenEmpty() {
        service.createPersonalExercise(
                EMAIL, request("Push Up", "PUSH", List.of()), null);

        verify(formRuleAdminService, never())
                .replaceFormRules(any(), any(), anyString());
    }

    @Test
    @DisplayName("create: formRules null -> khong goi service luu rule")
    void createSkipsFormRulesWhenNull() {
        service.createPersonalExercise(
                EMAIL, request("Push Up", "PUSH", null), null);

        verify(formRuleAdminService, never())
                .replaceFormRules(any(), any(), anyString());
    }

    @Test
    @DisplayName("resubmit: co khai bao nguong -> luu ngung do")
    void resubmitStoresFormRules() {
        Exercise existing = rejectedExercise();
        when(exercises.findByIdAndCreatedBy_IdAndSource(9L, 7L, "CUSTOM"))
                .thenReturn(Optional.of(existing));

        MultipartFile video = new MockMultipartFile("v", "a.mp4", "video/mp4", new byte[]{1});
        service.resubmitPersonalExercise(EMAIL, 9L,
                request("Push Up", "PUSH", List.of(elbowRule())), video);

        verify(formRuleAdminService).replaceFormRules(
                eq("CU_9"),
                any(FormRulesRequest.class),
                eq(FormRuleAdminService.SOURCE_MEMBER));
    }

    @Test
    @DisplayName("edit bai da duyet: co khai bao nguong -> luu ngung do")
    void editStoresFormRules() {
        Exercise existing = acceptedExercise();
        when(exercises.findByIdAndCreatedBy_IdAndSource(9L, 7L, "CUSTOM"))
                .thenReturn(Optional.of(existing));

        service.updateAcceptedPersonalExercise(EMAIL, 9L,
                request("Push Up", "PUSH", List.of(elbowRule())), null);

        verify(formRuleAdminService).replaceFormRules(
                eq("CU_9"),
                any(FormRulesRequest.class),
                eq(FormRuleAdminService.SOURCE_MEMBER));
    }

    @Test
    @DisplayName("resubmit: khai bao nhom chuyen dong -> luu nhom do")
    void resubmitStoresMovementGroup() {
        Exercise existing = rejectedExercise();
        when(exercises.findByIdAndCreatedBy_IdAndSource(9L, 7L, "CUSTOM"))
                .thenReturn(Optional.of(existing));

        MultipartFile video = new MockMultipartFile("v", "a.mp4", "video/mp4", new byte[]{1});
        var response = service.resubmitPersonalExercise(EMAIL, 9L,
                request("Push Up", "CORE", List.of()), video);

        assertThat(response.movementGroup()).isEqualTo("CORE");
    }

    @Test
    @DisplayName("resubmit: khong khai bao nhom -> suy ra tu ten bai")
    void resubmitInfersMovementGroup() {
        Exercise existing = rejectedExercise();
        when(exercises.findByIdAndCreatedBy_IdAndSource(9L, 7L, "CUSTOM"))
                .thenReturn(Optional.of(existing));

        MultipartFile video = new MockMultipartFile("v", "a.mp4", "video/mp4", new byte[]{1});
        var response = service.resubmitPersonalExercise(EMAIL, 9L,
                request("Pull-up", null, List.of()), video);

        assertThat(response.movementGroup()).isEqualTo("PULL");
    }

    @Test
    @DisplayName("edit bai da duyet: khai bao nhom chuyen dong -> luu nhom do")
    void editStoresMovementGroup() {
        Exercise existing = acceptedExercise();
        when(exercises.findByIdAndCreatedBy_IdAndSource(9L, 7L, "CUSTOM"))
                .thenReturn(Optional.of(existing));

        var response = service.updateAcceptedPersonalExercise(EMAIL, 9L,
                request("Push Up", "LEGS", List.of()), null);

        assertThat(response.movementGroup()).isEqualTo("LEGS");
    }

    @Test
    @DisplayName("edit bai da duyet: khong khai bao nhom -> suy ra tu ten bai")
    void editInfersMovementGroup() {
        Exercise existing = acceptedExercise();
        when(exercises.findByIdAndCreatedBy_IdAndSource(9L, 7L, "CUSTOM"))
                .thenReturn(Optional.of(existing));

        var response = service.updateAcceptedPersonalExercise(EMAIL, 9L,
                request("Side Plank", null, List.of()), null);

        assertThat(response.movementGroup()).isEqualTo("CORE");
    }

    private Exercise acceptedExercise() {
        Exercise exercise = baseExercise();
        exercise.setStatus(Exercise.EntryStatus.ACCEPTED);
        exercise.setActive(true);
        return exercise;
    }

    /** Bài bị từ chối -> member được sửa và gửi lại. */
    private Exercise rejectedExercise() {
        Exercise exercise = baseExercise();
        exercise.setStatus(Exercise.EntryStatus.REJECTED);
        exercise.setActive(false);
        return exercise;
    }

    private Exercise baseExercise() {
        Exercise exercise = new Exercise();
        exercise.setId(9L);
        exercise.setCode("CU_9");
        exercise.setName("Push Up");
        exercise.setDescription("desc");
        exercise.setLevel("Beginner");
        exercise.setGuideSteps("step one");
        exercise.setType(Exercise.EntryType.HEALTH);
        exercise.setMuscleGroup("Chest");
        exercise.setDefaultSets(3);
        exercise.setDefaultReps(10);
        exercise.setCreatedBy(user());
        exercise.setSource("CUSTOM");
        return exercise;
    }
}
