package com.calishealth.service;

import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkAssessment;
import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkConfiguration;
import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkExerciseUpdate;
import com.calishealth.dtos.LevelBenchmarkDtos.CreateLevelRequest;
import com.calishealth.dtos.LevelBenchmarkDtos.LevelUpdate;
import com.calishealth.dtos.LevelBenchmarkDtos.UpdateBenchmarkConfiguration;
import com.calishealth.models.AssessmentQuestion;
import com.calishealth.models.BenchmarkCriterion;
import com.calishealth.models.ConfigStatus;
import com.calishealth.models.Exercise;
import com.calishealth.models.FitnessLevel;
import com.calishealth.models.MemberProfile;
import com.calishealth.models.User;
import com.calishealth.repository.AssessmentQuestionRepository;
import com.calishealth.repository.BenchmarkCriterionRepository;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.MemberProfileRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.repository.WorkoutRepository;
import com.calishealth.service.survey.BenchmarkSurveySync;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bộ test bổ sung cho các nhánh còn thiếu của {@link LevelBenchmarkService}.
 */
@ExtendWith(MockitoExtension.class)
class LevelBenchmarkServiceExtraCoverageTest {

    @Mock private BenchmarkCriterionRepository criteria;
    @Mock private AssessmentQuestionRepository assessmentQuestions;
    @Mock private FitnessLevelRepository fitnessLevels;
    @Mock private ExerciseRepository exercises;
    @Mock private UserRepository users;
    @Mock private MemberProfileRepository memberProfiles;
    @Mock private WorkoutRepository workouts;
    @Mock private BenchmarkSurveySync surveySync;
    @Mock private MemberFitnessLevelService fitnessLevelsService;
    @InjectMocks private LevelBenchmarkService service;

    private static final String EMAIL = "cm@example.test";

    private static User actor() {
        User user = new User();
        user.setId(1L);
        user.setEmail(EMAIL);
        user.setFullName("Content Manager");
        return user;
    }

    private static Exercise exercise(String code, String name, String category) {
        Exercise exercise = new Exercise();
        exercise.setCode(code);
        exercise.setName(name);
        exercise.setCategory(category);
        exercise.setType("HEALTH");
        exercise.setSource("SYSTEM");
        return exercise;
    }

    private static FitnessLevel level(long id, String name, int min, int max, String status) {
        FitnessLevel level = new FitnessLevel();
        level.setId(id);
        level.setName(name);
        level.setScoreMin(min);
        level.setScoreMax(max);
        level.setStatus(status);
        level.setUpdatedAt(LocalDateTime.of(2026, 1, 1, 0, 0));
        return level;
    }

    private static BenchmarkCriterion criterion(long id, String slot, Exercise exercise, FitnessLevel level,
                                               BigDecimal min, BigDecimal max) {
        BenchmarkCriterion row = new BenchmarkCriterion();
        row.setId(id);
        row.setBenchmarkSlot(slot);
        row.setExercise(exercise);
        row.setFitnessLevel(level);
        row.setMinValue(min);
        row.setMaxValue(max);
        row.setCriterionWeight(BigDecimal.ONE);
        return row;
    }

    private void stubActor() {
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.of(actor()));
    }

    private void stubEmptyConfig() {
        lenient().when(criteria.findAll()).thenReturn(List.of());
        lenient().when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of());
        lenient().when(exercises.findAll()).thenReturn(List.of());
    }

    // ---------------------------------------------------------- deleteLevel

    @Test
    @DisplayName("Xoa level chua nguong diem: nguong duoc day sang level giu")
    void deleteLevelMovesThresholdsWithNullMaxValue() {
        stubActor();
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS");
        FitnessLevel a = level(1L, "A", 1, 3, "ACTIVE");
        FitnessLevel b = level(2L, "B", 4, 6, "ACTIVE");
        FitnessLevel c = level(3L, "C", 7, 9, "ACTIVE");

        lenient().when(fitnessLevels.findById(1L)).thenReturn(Optional.of(a));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(a, b, c));
        lenient().when(memberProfiles.countByFitnessLevel_Id(1L)).thenReturn(0L);
        lenient().when(exercises.existsInUseByDifficultyLevel("A")).thenReturn(false);
        lenient().when(workouts.existsByLevelIgnoreCase("A")).thenReturn(false);
        // maxValue null -> nguong 1 diem mac dinh, chi mot dong -> nguong 2 diem = nguong 1 + 1
        lenient().when(criteria.findAll()).thenReturn(List.of(
                criterion(1L, "PUSH_UP_MAX_REPS", pushUp, a, BigDecimal.ONE, null)));
        lenient().when(criteria.save(any(BenchmarkCriterion.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.deleteLevel(1L, EMAIL);

        verify(criteria, org.mockito.Mockito.atLeast(3)).save(any(BenchmarkCriterion.class));
    }

    @Test
    @DisplayName("Xoa level: chi co 1 member dung level -> thong bao so it")
    void deleteLevelReportsSingleMember() {
        stubActor();
        FitnessLevel a = level(1L, "A", 1, 3, "ACTIVE");
        FitnessLevel b = level(2L, "B", 4, 6, "ACTIVE");
        lenient().when(fitnessLevels.findById(1L)).thenReturn(Optional.of(a));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(a, b));
        lenient().when(memberProfiles.countByFitnessLevel_Id(1L)).thenReturn(1L);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.deleteLevel(1L, EMAIL));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        assertTrue(error.getMessage().contains("1 member is"));
    }

    // ------------------------------------------------------ updateLevelStatus

    @Test
    @DisplayName("Doi trang thai level: trang thai null -> 400")
    void updateLevelStatusRejectsNullStatus() {
        stubActor();
        FitnessLevel a = level(1L, "A", 1, 3, "ACTIVE");
        lenient().when(fitnessLevels.findByNameIgnoreCase("A")).thenReturn(Optional.of(a));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.updateLevelStatus("A", null, EMAIL));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Doi trang thai level: loi khi ha member -> khong lam vo loi")
    void updateLevelStatusSurvivesDowngradeFailure() {
        stubActor();
        FitnessLevel beginner = level(1L, "Beginner", 1, 3, "ACTIVE");
        FitnessLevel intermediate = level(2L, "Intermediate", 4, 6, "ACTIVE");
        FitnessLevel advanced = level(3L, "Advanced", 7, 9, "ACTIVE");

        MemberProfile profile = new MemberProfile();
        profile.setId(10L);
        profile.setFitnessLevel(advanced);

        lenient().when(fitnessLevels.findByNameIgnoreCase("Advanced")).thenReturn(Optional.of(advanced));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(beginner, intermediate, advanced));
        lenient().when(memberProfiles.findAll()).thenThrow(new IllegalStateException("db down"));
        stubEmptyConfig();

        service.updateLevelStatus("Advanced", "INACTIVE", EMAIL);

        assertEquals("INACTIVE", advanced.getStatus());
        verify(fitnessLevelsService, never()).changeLevel(any(), any());
    }

    // ------------------------------------------------------------ createLevel

    @Test
    @DisplayName("Tao level moi: con diem trong -> level moi an phan diem trong")
    void createLevelUsesFreeScorePoints() {
        stubActor();
        FitnessLevel a = level(1L, "A", 1, 1, "ACTIVE");
        FitnessLevel b = level(2L, "B", 2, 2, "ACTIVE");
        lenient().when(fitnessLevels.existsByNameIgnoreCase("C")).thenReturn(false);
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(a, b));
        stubEmptyConfig();

        service.createLevel(new CreateLevelRequest("C", "ACTIVE"), EMAIL);

        assertEquals(1, a.getScoreMin());
        assertEquals(1, a.getScoreMax());
        assertEquals(2, b.getScoreMin());
        assertEquals(2, b.getScoreMax());
    }

    @Test
    @DisplayName("Tao level moi: du lieu cu khong nhat quan -> chia deu lai")
    void createLevelSplitsLegacyScoresEvenly() {
        stubActor();
        FitnessLevel a = level(1L, "A", 1, 5, "ACTIVE");
        lenient().when(fitnessLevels.existsByNameIgnoreCase("B")).thenReturn(false);
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(a));
        stubEmptyConfig();

        service.createLevel(new CreateLevelRequest("B", "ACTIVE"), EMAIL);

        assertEquals(2, a.getScoreMax());
    }

    @Test
    @DisplayName("Tao level moi: vua du diem -> level rong se nhan 1 diem va level rong nhat nho diem")
    void createLevelTakesPointFromWidestLevel() {
        stubActor();
        FitnessLevel a = level(1L, "A", 1, 3, "ACTIVE");
        lenient().when(fitnessLevels.existsByNameIgnoreCase("B")).thenReturn(false);
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(a));
        stubEmptyConfig();

        service.createLevel(new CreateLevelRequest("B", "ACTIVE"), EMAIL);

        assertEquals(2, a.getScoreMax());
        assertEquals(3, a.getScoreMax() + 1);
    }

    // ------------------------------------------------------------ assessment

    @Test
    @DisplayName("Cham diem: 1 diem -> nhan 'Up to ...'")
    void assessFromOnboardingLabelsFirstBand() {
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS");
        FitnessLevel beginner = level(1L, "Beginner", 1, 3, "ACTIVE");

        lenient().when(criteria.findAll()).thenReturn(List.of(
                criterion(1L, "PUSH_UP_MAX_REPS", pushUp, beginner, BigDecimal.ONE, BigDecimal.valueOf(19))));
        lenient().when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of());
        lenient().when(exercises.findAll()).thenReturn(List.of(pushUp));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(beginner));

        Optional<BenchmarkAssessment> result = service.assessFromOnboarding(Map.of("PUSH_UP_MAX_REPS", 5));

        assertTrue(result.isPresent());
        assertEquals(1, result.get().scores().get(0).points());
        assertTrue(result.get().scores().get(0).bandLabel().startsWith("Up to 19"));
    }

    @Test
    @DisplayName("Cham diem: 2 diem -> nhan khoang '20-40 reps'")
    void assessFromOnboardingLabelsSecondBand() {
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS");
        FitnessLevel beginner = level(1L, "Beginner", 1, 3, "ACTIVE");

        lenient().when(criteria.findAll()).thenReturn(List.of(
                criterion(1L, "PUSH_UP_MAX_REPS", pushUp, beginner, BigDecimal.ONE, BigDecimal.valueOf(19)),
                criterion(2L, "PUSH_UP_MAX_REPS", pushUp, beginner, BigDecimal.valueOf(20), BigDecimal.valueOf(40))));
        lenient().when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of());
        lenient().when(exercises.findAll()).thenReturn(List.of(pushUp));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(beginner));

        Optional<BenchmarkAssessment> result = service.assessFromOnboarding(Map.of("PUSH_UP_MAX_REPS", 30));

        assertTrue(result.isPresent());
        assertEquals(2, result.get().scores().get(0).points());
        assertTrue(result.get().scores().get(0).bandLabel().contains("20"));
        assertTrue(result.get().scores().get(0).bandLabel().contains("40"));
    }

    @Test
    @DisplayName("Cham diem: hai cau hoi cung ma -> ghep khong loi")
    void configurationToleratesDuplicateQuestionCodes() {
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS");
        FitnessLevel holder = level(1L, "Beginner", 1, 3, "ACTIVE");

        AssessmentQuestion first = new AssessmentQuestion();
        first.setQuestionCode("PUSH_UP_MAX_REPS");
        AssessmentQuestion second = new AssessmentQuestion();
        second.setQuestionCode("PUSH_UP_MAX_REPS");

        lenient().when(criteria.findAll()).thenReturn(List.of(
                criterion(1L, "PUSH_UP_MAX_REPS", pushUp, holder, BigDecimal.ONE, BigDecimal.valueOf(19))));
        lenient().when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of(first, second));
        lenient().when(exercises.findAll()).thenReturn(List.of(pushUp));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(holder));

        BenchmarkConfiguration configuration = service.getConfiguration();

        assertEquals(1, configuration.exercises().size());
        assertTrue(configuration.exercises().get(0).surveyQuestionReady());
    }

    @Test
    @DisplayName("Cham diem: bai HOLD -> don vi la giay")
    void configurationUsesSecondsUnitForHoldExercises() {
        Exercise plank = exercise("PLANK", "Plank", "HOLD");
        FitnessLevel holder = level(1L, "Beginner", 1, 3, "ACTIVE");

        lenient().when(criteria.findAll()).thenReturn(List.of(
                criterion(1L, "PLANK_MAX_SECONDS", plank, holder, BigDecimal.ONE, BigDecimal.valueOf(44))));
        lenient().when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of());
        lenient().when(exercises.findAll()).thenReturn(List.of(plank));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(holder));

        BenchmarkConfiguration configuration = service.getConfiguration();

        assertEquals("seconds", configuration.exercises().get(0).unit());
    }

    @Test
    @DisplayName("Cham diem: bai khong co nguong -> nguong 1 diem mac dinh")
    void configurationFallsBackToDefaultThreshold() {
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS");
        FitnessLevel holder = level(1L, "Beginner", 1, 3, "ACTIVE");

        lenient().when(criteria.findAll()).thenReturn(List.of(
                criterion(1L, "PUSH_UP_MAX_REPS", pushUp, holder, BigDecimal.ONE, null)));
        lenient().when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of());
        lenient().when(exercises.findAll()).thenReturn(List.of(pushUp));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(holder));

        BenchmarkConfiguration configuration = service.getConfiguration();

        assertEquals(1, configuration.exercises().get(0).beginnerMax());
        assertEquals(2, configuration.exercises().get(0).intermediateMax());
    }

    @Test
    @DisplayName("Cham diem: bai khong co category -> chuoi rong")
    void configurationHandlesExerciseWithoutCategory() throws Exception {
        Exercise custom = new Exercise();
        custom.setCode("NO_CAT");
        custom.setName("No category");
        custom.setSource("SYSTEM");
        java.lang.reflect.Field field = Exercise.class.getDeclaredField("category");
        field.setAccessible(true);
        field.set(custom, null);
        FitnessLevel holder = level(1L, "Beginner", 1, 3, "ACTIVE");

        lenient().when(criteria.findAll()).thenReturn(List.of(
                criterion(1L, "NO_CAT_MAX_REPS", custom, holder, BigDecimal.ONE, BigDecimal.valueOf(19))));
        lenient().when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of());
        lenient().when(exercises.findAll()).thenReturn(List.of(custom));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(holder));

        BenchmarkConfiguration configuration = service.getConfiguration();

        assertEquals("", configuration.exercises().get(0).category());
    }

    @Test
    @DisplayName("Cham diem: bai khong nguon va khong co nguoi tao -> coi la bai he thong")
    void configurationTreatsCreatorlessExerciseAsSystem() {
        Exercise legacy = new Exercise();
        legacy.setCode("LEGACY");
        legacy.setName("Legacy");
        legacy.setCategory("REPS");
        legacy.setCreatedBy(null);
        FitnessLevel holder = level(1L, "Beginner", 1, 3, "ACTIVE");

        lenient().when(criteria.findAll()).thenReturn(List.of(
                criterion(1L, "LEGACY_MAX_REPS", legacy, holder, BigDecimal.ONE, BigDecimal.valueOf(19))));
        lenient().when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of());
        lenient().when(exercises.findAll()).thenReturn(List.of(legacy));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(holder));

        BenchmarkConfiguration configuration = service.getConfiguration();

        assertEquals(1, configuration.exercises().size());
    }

    @Test
    @DisplayName("Cau hinh: khong con level nao -> loi 500")
    void updateConfigurationFailsWithoutLevels() {
        stubActor();
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS");
        lenient().when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(pushUp));
        lenient().when(exercises.findAll()).thenReturn(List.of(pushUp));
        lenient().when(fitnessLevels.existsById(anyLong())).thenReturn(true);
        lenient().when(criteria.findAll()).thenReturn(List.of());

        AtomicInteger calls = new AtomicInteger();
        lenient().when(fitnessLevels.findAll()).thenAnswer(invocation -> {
            // Lan 1: tinh level bi xoa, lan 2: tim level giu nguong -> khong con level
            return calls.getAndIncrement() == 0 ? List.of(level(1L, "Beginner", 1, 3, "ACTIVE")) : List.of();
        });
        lenient().when(fitnessLevels.findById(1L)).thenReturn(Optional.of(level(1L, "Beginner", 1, 3, "ACTIVE")));
        lenient().when(criteria.save(any(BenchmarkCriterion.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(new BenchmarkExerciseUpdate("PUSH_UP", "REPS", 19, 40)),
                        List.of(new LevelUpdate(1L, "Beginner", 1, 3, "ACTIVE"))), EMAIL));
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, error.getStatusCode());
    }

    @Test
    @DisplayName("Cau hinh: danh sach level rong -> 400")
    void updateConfigurationRejectsEmptyLevels() {
        lenient().when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(exercise("PUSH_UP", "Push-up", "REPS")));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(new BenchmarkExerciseUpdate("PUSH_UP", "REPS", 19, 40)),
                        List.of()), EMAIL));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Cau hinh: trung ma bai -> 400")
    void updateConfigurationRejectsDuplicateExerciseCodes() {
        lenient().when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(exercise("PUSH_UP", "Push-up", "REPS")));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(new BenchmarkExerciseUpdate("PUSH_UP", "REPS", 19, 40),
                                new BenchmarkExerciseUpdate("PUSH_UP", "REPS", 21, 42)),
                        List.of(new LevelUpdate(1L, "Beginner", 1, 3, "ACTIVE"))), EMAIL));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Cau hinh: ten bai chi co ky tu dac biet -> sinh slot tu ma bai")
    void updateConfigurationFallsBackToExerciseCodeForSlot() {
        stubActor();
        Exercise weird = exercise("EX_WEIRD", "???", "REPS");
        FitnessLevel beginner = level(1L, "Beginner", 1, 3, "ACTIVE");

        lenient().when(exercises.findByCode("EX_WEIRD")).thenReturn(Optional.of(weird));
        lenient().when(exercises.findAll()).thenReturn(List.of(weird));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(beginner));
        lenient().when(fitnessLevels.findById(1L)).thenReturn(Optional.of(beginner));
        lenient().when(fitnessLevels.existsById(anyLong())).thenReturn(true);
        lenient().when(criteria.save(any(BenchmarkCriterion.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.updateConfiguration(new UpdateBenchmarkConfiguration(
                List.of(new BenchmarkExerciseUpdate("EX_WEIRD", "REPS", 19, 40)),
                List.of(new LevelUpdate(1L, "Beginner", 1, 3, "ACTIVE"))), EMAIL);

        org.mockito.ArgumentCaptor<BenchmarkCriterion> captor =
                org.mockito.ArgumentCaptor.forClass(BenchmarkCriterion.class);
        verify(criteria, org.mockito.Mockito.atLeast(3)).save(captor.capture());
        assertEquals("EX_WEIRD_MAX_REPS", captor.getAllValues().get(0).getBenchmarkSlot());
    }

    @Test
    @DisplayName("Cau hinh: ten bai rat dai -> slot bi cat ngan 32 ky tu")
    void updateConfigurationTruncatesLongSlot() {
        stubActor();
        String longName = "A Very Long Exercise Name That Exceeds The Slot Limit";
        Exercise weird = exercise("EX_LONG", longName, "REPS");
        FitnessLevel beginner = level(1L, "Beginner", 1, 3, "ACTIVE");

        lenient().when(exercises.findByCode("EX_LONG")).thenReturn(Optional.of(weird));
        lenient().when(exercises.findAll()).thenReturn(List.of(weird));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(beginner));
        lenient().when(fitnessLevels.findById(1L)).thenReturn(Optional.of(beginner));
        lenient().when(fitnessLevels.existsById(anyLong())).thenReturn(true);
        lenient().when(criteria.save(any(BenchmarkCriterion.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.updateConfiguration(new UpdateBenchmarkConfiguration(
                List.of(new BenchmarkExerciseUpdate("EX_LONG", "REPS", 19, 40)),
                List.of(new LevelUpdate(1L, "Beginner", 1, 3, "ACTIVE"))), EMAIL);

        org.mockito.ArgumentCaptor<BenchmarkCriterion> captor =
                org.mockito.ArgumentCaptor.forClass(BenchmarkCriterion.class);
        verify(criteria, org.mockito.Mockito.atLeast(3)).save(captor.capture());
        String slot = captor.getAllValues().get(0).getBenchmarkSlot();
        assertEquals(32, slot.length());
        assertTrue(slot.endsWith("_MAX_REPS"));
    }

    @Test
    @DisplayName("Gan level: ket qua 0 rep hoac lech diem -> ghi log va ha bac")
    void assignLevelFromOnboardingHandlesZeroAndUnbalanced() {
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS");
        Exercise plank = exercise("PLANK", "Plank", "HOLD");
        FitnessLevel beginner = level(1L, "Beginner", 1, 3, "ACTIVE");
        FitnessLevel intermediate = level(2L, "Intermediate", 4, 6, "ACTIVE");
        FitnessLevel advanced = level(3L, "Advanced", 7, 9, "ACTIVE");

        MemberProfile profile = new MemberProfile();
        profile.setId(10L);

        lenient().when(criteria.findAll()).thenReturn(List.of(
                criterion(1L, "PUSH_UP_MAX_REPS", pushUp, beginner, BigDecimal.ONE, BigDecimal.valueOf(19)),
                criterion(2L, "PLANK_MAX_SECONDS", plank, beginner, BigDecimal.ONE, BigDecimal.valueOf(44))));
        lenient().when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of());
        lenient().when(exercises.findAll()).thenReturn(List.of(pushUp, plank));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(beginner, intermediate, advanced));
        lenient().when(memberProfiles.findByUser_Id(5L)).thenReturn(Optional.of(profile));

        Optional<String> name = service.assignLevelFromOnboarding(5L, Map.of(
                "PUSH_UP_MAX_REPS", 0,
                "PLANK_MAX_SECONDS", 0));

        assertTrue(name.isPresent());
        assertEquals("Beginner", name.get());
        verify(fitnessLevelsService).changeLevel(profile, beginner);
    }
}
