package com.calishealth.service;

import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkAssessment;
import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkConfiguration;
import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkExercise;
import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkExerciseUpdate;
import com.calishealth.dtos.LevelBenchmarkDtos.CreateLevelRequest;
import com.calishealth.dtos.LevelBenchmarkDtos.LevelUpdate;
import com.calishealth.dtos.LevelBenchmarkDtos.UpdateBenchmarkConfiguration;
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
import org.mockito.ArgumentCaptor;
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bo test bo sung cho cac nhanh chua duoc chay cua {@link LevelBenchmarkService}: xoa level,
 * doi trang thai level, tao level moi, cham diem level test va gan level cho member.
 */
@ExtendWith(MockitoExtension.class)
class LevelBenchmarkServiceLifecycleTest {
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

    private static Exercise exercise(String code, String name, String category, boolean system) {
        Exercise exercise = new Exercise();
        exercise.setCode(code);
        exercise.setName(name);
        exercise.setCategory(category);
        exercise.setType("HEALTH");
        if (system) {
            exercise.setSource("SYSTEM");
        } else {
            exercise.setSource("CUSTOM");
            exercise.setCreatedBy(actor());
        }
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

    // ------------------------------------------------------------ deleteLevel

    @Test
    @DisplayName("Xoa level: xoa level giua va chuyen diem sang level ke")
    void deleteLevelMovesRangeToPreviousNeighbour() {
        stubActor();
        FitnessLevel beginner = level(1L, "Beginner", 1, 3, "ACTIVE");
        FitnessLevel intermediate = level(2L, "Intermediate", 4, 6, "ACTIVE");
        FitnessLevel advanced = level(3L, "Advanced", 7, 9, "ACTIVE");

        lenient().when(fitnessLevels.findById(2L)).thenReturn(Optional.of(intermediate));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(beginner, intermediate, advanced));
        lenient().when(memberProfiles.countByFitnessLevel_Id(2L)).thenReturn(0L);
        lenient().when(exercises.existsInUseByDifficultyLevel("Intermediate")).thenReturn(false);
        lenient().when(workouts.existsByLevelIgnoreCase("Intermediate")).thenReturn(false);
        stubEmptyConfig();

        service.deleteLevel(2L, EMAIL);

        assertEquals(6, beginner.getScoreMax());
        verify(fitnessLevels).delete(intermediate);
        verify(fitnessLevels).saveAndFlush(beginner);
    }

    @Test
    @DisplayName("Xoa level: xoa level thap nhat thi cap nhat level ke tren")
    void deleteLevelMovesRangeToNextNeighbour() {
        stubActor();
        FitnessLevel beginner = level(1L, "Beginner", 1, 3, "ACTIVE");
        FitnessLevel intermediate = level(2L, "Intermediate", 4, 6, "ACTIVE");

        lenient().when(fitnessLevels.findById(1L)).thenReturn(Optional.of(beginner));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(beginner, intermediate));
        lenient().when(memberProfiles.countByFitnessLevel_Id(1L)).thenReturn(0L);
        lenient().when(exercises.existsInUseByDifficultyLevel("Beginner")).thenReturn(false);
        lenient().when(workouts.existsByLevelIgnoreCase("Beginner")).thenReturn(false);
        stubEmptyConfig();

        service.deleteLevel(1L, EMAIL);

        assertEquals(1, intermediate.getScoreMin());
        verify(fitnessLevels).delete(beginner);
    }

    @Test
    @DisplayName("Xoa level: chi con mot level -> 409")
    void deleteLevelRejectsLastLevel() {
        stubActor();
        FitnessLevel only = level(1L, "Beginner", 1, 3, "ACTIVE");
        lenient().when(fitnessLevels.findById(1L)).thenReturn(Optional.of(only));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(only));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.deleteLevel(1L, EMAIL));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    @DisplayName("Xoa level: khong con level active nao -> 409")
    void deleteLevelRejectsWhenNoOtherActiveLevel() {
        stubActor();
        FitnessLevel a = level(1L, "A", 1, 3, "INACTIVE");
        FitnessLevel b = level(2L, "B", 4, 6, "INACTIVE");
        lenient().when(fitnessLevels.findById(1L)).thenReturn(Optional.of(a));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(a, b));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.deleteLevel(1L, EMAIL));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    @DisplayName("Xoa level: level dang duoc dung -> 409")
    void deleteLevelRejectsLevelUsedByMembers() {
        stubActor();
        FitnessLevel a = level(1L, "A", 1, 3, "ACTIVE");
        FitnessLevel b = level(2L, "B", 4, 6, "ACTIVE");
        lenient().when(fitnessLevels.findById(1L)).thenReturn(Optional.of(a));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(a, b));
        lenient().when(memberProfiles.countByFitnessLevel_Id(1L)).thenReturn(3L);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.deleteLevel(1L, EMAIL));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    @DisplayName("Xoa level: bai tap van dung level -> 409")
    void deleteLevelRejectsLevelUsedByExercises() {
        stubActor();
        FitnessLevel a = level(1L, "A", 1, 3, "ACTIVE");
        FitnessLevel b = level(2L, "B", 4, 6, "ACTIVE");
        lenient().when(fitnessLevels.findById(1L)).thenReturn(Optional.of(a));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(a, b));
        lenient().when(memberProfiles.countByFitnessLevel_Id(1L)).thenReturn(0L);
        lenient().when(exercises.existsInUseByDifficultyLevel("A")).thenReturn(true);

        assertThrows(ResponseStatusException.class, () -> service.deleteLevel(1L, EMAIL));
    }

    @Test
    @DisplayName("Xoa level: workout van dung level -> 409")
    void deleteLevelRejectsLevelUsedByWorkouts() {
        stubActor();
        FitnessLevel a = level(1L, "A", 1, 3, "ACTIVE");
        FitnessLevel b = level(2L, "B", 4, 6, "ACTIVE");
        lenient().when(fitnessLevels.findById(1L)).thenReturn(Optional.of(a));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(a, b));
        lenient().when(memberProfiles.countByFitnessLevel_Id(1L)).thenReturn(0L);
        lenient().when(exercises.existsInUseByDifficultyLevel("A")).thenReturn(false);
        lenient().when(workouts.existsByLevelIgnoreCase("A")).thenReturn(true);

        assertThrows(ResponseStatusException.class, () -> service.deleteLevel(1L, EMAIL));
    }

    @Test
    @DisplayName("Xoa level: khong tim thay level -> 404")
    void deleteLevelRejectsUnknownLevel() {
        stubActor();
        lenient().when(fitnessLevels.findById(99L)).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.deleteLevel(99L, EMAIL));
        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
    }

    @Test
    @DisplayName("Xoa level: nguoi dung khong con ton tai -> 401")
    void deleteLevelRejectsUnknownActor() {
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.deleteLevel(1L, EMAIL));
        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
    }

    @Test
    @DisplayName("Xoa level: level giu nguong thi luu lai nguong sang level giu moi")
    void deleteLevelMovesThresholdsWhenHolderIsRemoved() {
        stubActor();
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        FitnessLevel a = level(1L, "A", 1, 3, "ACTIVE");
        FitnessLevel b = level(2L, "B", 4, 6, "ACTIVE");
        FitnessLevel c = level(3L, "C", 7, 9, "ACTIVE");

        lenient().when(fitnessLevels.findById(1L)).thenReturn(Optional.of(a));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(a, b, c));
        lenient().when(memberProfiles.countByFitnessLevel_Id(1L)).thenReturn(0L);
        lenient().when(exercises.existsInUseByDifficultyLevel("A")).thenReturn(false);
        lenient().when(workouts.existsByLevelIgnoreCase("A")).thenReturn(false);
        lenient().when(criteria.findAll()).thenReturn(List.of(
                criterion(1L, "PUSH_UP_MAX_REPS", pushUp, a, BigDecimal.ONE, BigDecimal.valueOf(19)),
                criterion(2L, "PUSH_UP_MAX_REPS", pushUp, a, BigDecimal.valueOf(20), BigDecimal.valueOf(40))));
        lenient().when(criteria.save(any(BenchmarkCriterion.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.deleteLevel(1L, EMAIL);

        ArgumentCaptor<BenchmarkCriterion> captor = ArgumentCaptor.forClass(BenchmarkCriterion.class);
        verify(criteria, org.mockito.Mockito.atLeast(3)).save(captor.capture());
    }

    // -------------------------------------------------------- updateLevelStatus

    @Test
    @DisplayName("Doi trang thai level: chuyen sang INACTIVE")
    void updateLevelStatusDeactivatesLevel() {
        stubActor();
        FitnessLevel a = level(1L, "A", 1, 3, "ACTIVE");
        lenient().when(fitnessLevels.findByNameIgnoreCase("A")).thenReturn(Optional.of(a));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(a));
        stubEmptyConfig();

        service.updateLevelStatus("A", "INACTIVE", EMAIL);

        assertEquals("INACTIVE", a.getStatus());
        verify(fitnessLevels).save(a);
    }

    @Test
    @DisplayName("Doi trang thai level: trang thai khong hop le -> 400")
    void updateLevelStatusRejectsInvalidStatus() {
        stubActor();
        FitnessLevel a = level(1L, "A", 1, 3, "ACTIVE");
        lenient().when(fitnessLevels.findByNameIgnoreCase("A")).thenReturn(Optional.of(a));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.updateLevelStatus("A", "REMOVED", EMAIL));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Doi trang thai level: khong tim thay level -> 404")
    void updateLevelStatusRejectsUnknownLevel() {
        stubActor();
        lenient().when(fitnessLevels.findByNameIgnoreCase("X")).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.updateLevelStatus("X", "ACTIVE", EMAIL));
        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
    }

    @Test
    @DisplayName("Doi trang thai level: hạ level cho member dang o level bi vo hieu hoa")
    void updateLevelStatusDowngradesMembers() {
        stubActor();
        FitnessLevel beginner = level(1L, "Beginner", 1, 3, "ACTIVE");
        FitnessLevel intermediate = level(2L, "Intermediate", 4, 6, "ACTIVE");
        FitnessLevel advanced = level(3L, "Advanced", 7, 9, "ACTIVE");

        MemberProfile profile = new MemberProfile();
        profile.setId(10L);
        profile.setFitnessLevel(advanced);

        lenient().when(fitnessLevels.findByNameIgnoreCase("Advanced")).thenReturn(Optional.of(advanced));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(beginner, intermediate, advanced));
        lenient().when(memberProfiles.findAll()).thenReturn(List.of(profile));
        stubEmptyConfig();

        service.updateLevelStatus("Advanced", "INACTIVE", EMAIL);

        verify(fitnessLevelsService).changeLevel(profile, intermediate);
        assertEquals("INACTIVE", advanced.getStatus());
    }

    @Test
    @DisplayName("Doi trang thai level: level thap nhat thi khong ha duoc ai")
    void updateLevelStatusDoesNotDowngradeLowestLevel() {
        stubActor();
        FitnessLevel beginner = level(1L, "Beginner", 1, 3, "ACTIVE");
        FitnessLevel intermediate = level(2L, "Intermediate", 4, 6, "ACTIVE");

        MemberProfile profile = new MemberProfile();
        profile.setId(10L);
        profile.setFitnessLevel(beginner);

        lenient().when(fitnessLevels.findByNameIgnoreCase("Beginner")).thenReturn(Optional.of(beginner));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(beginner, intermediate));
        stubEmptyConfig();

        service.updateLevelStatus("Beginner", "INACTIVE", EMAIL);

        verify(fitnessLevelsService, never()).changeLevel(any(), any());
    }

    @Test
    @DisplayName("Doi trang thai level: khong tim thay level active de ha -> khong ha ai")
    void updateLevelStatusDoesNotDowngradeWithoutActiveTarget() {
        stubActor();
        FitnessLevel beginner = level(1L, "Beginner", 1, 3, "INACTIVE");
        FitnessLevel intermediate = level(2L, "Intermediate", 4, 6, "ACTIVE");

        MemberProfile profile = new MemberProfile();
        profile.setId(10L);
        profile.setFitnessLevel(intermediate);

        lenient().when(fitnessLevels.findByNameIgnoreCase("Intermediate")).thenReturn(Optional.of(intermediate));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(beginner, intermediate));
        stubEmptyConfig();

        service.updateLevelStatus("Intermediate", "INACTIVE", EMAIL);

        verify(fitnessLevelsService, never()).changeLevel(any(), any());
    }

    @Test
    @DisplayName("Doi trang thai level: profile khong co level thi bo qua")
    void updateLevelStatusSkipsProfilesWithoutLevel() {
        stubActor();
        FitnessLevel beginner = level(1L, "Beginner", 1, 3, "ACTIVE");
        FitnessLevel intermediate = level(2L, "Intermediate", 4, 6, "ACTIVE");

        MemberProfile profile = new MemberProfile();
        profile.setId(10L);

        lenient().when(fitnessLevels.findByNameIgnoreCase("Intermediate")).thenReturn(Optional.of(intermediate));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(beginner, intermediate));
        lenient().when(memberProfiles.findAll()).thenReturn(List.of(profile));
        stubEmptyConfig();

        service.updateLevelStatus("Intermediate", "INACTIVE", EMAIL);

        verify(fitnessLevelsService, never()).changeLevel(any(), any());
    }

    @Test
    @DisplayName("Doi trang thai level: level da INACTIVE thi khong ha member")
    void updateLevelStatusDoesNotDowngradeAlreadyInactive() {
        stubActor();
        FitnessLevel beginner = level(1L, "Beginner", 1, 3, "ACTIVE");
        FitnessLevel intermediate = level(2L, "Intermediate", 4, 6, "INACTIVE");

        lenient().when(fitnessLevels.findByNameIgnoreCase("Intermediate")).thenReturn(Optional.of(intermediate));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(beginner, intermediate));
        stubEmptyConfig();

        service.updateLevelStatus("Intermediate", "INACTIVE", EMAIL);

        verify(fitnessLevelsService, never()).changeLevel(any(), any());
    }

    @Test
    @DisplayName("Doi trang thai level: khong tim thay user -> 401")
    void updateLevelStatusRejectsUnknownActor() {
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.updateLevelStatus("A", "ACTIVE", EMAIL));
        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
    }

    // ------------------------------------------------------------ createLevel

    @Test
    @DisplayName("Tao level moi: them level vao tren cung")
    void createLevelAddsLevelOnTop() {
        stubActor();
        FitnessLevel beginner = level(1L, "Beginner", 1, 3, "ACTIVE");
        FitnessLevel intermediate = level(2L, "Intermediate", 4, 6, "ACTIVE");

        lenient().when(fitnessLevels.existsByNameIgnoreCase("Advanced")).thenReturn(false);
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(beginner, intermediate));
        stubEmptyConfig();

        service.createLevel(new CreateLevelRequest("Advanced", "ACTIVE"), EMAIL);

        ArgumentCaptor<FitnessLevel> captor = ArgumentCaptor.forClass(FitnessLevel.class);
        verify(fitnessLevels).saveAndFlush(captor.capture());
        FitnessLevel created = captor.getValue();
        assertEquals("Advanced", created.getName());
        assertEquals(3, created.getScoreMin());
        assertEquals(3, created.getScoreMax());
    }

    @Test
    @DisplayName("Tao level moi: ten da ton tai -> 409")
    void createLevelRejectsDuplicateName() {
        stubActor();
        lenient().when(fitnessLevels.existsByNameIgnoreCase("Beginner")).thenReturn(true);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.createLevel(new CreateLevelRequest("Beginner", "ACTIVE"), EMAIL));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    @DisplayName("Tao level moi: ten hoac trang thai khong hop le -> 400")
    void createLevelRejectsInvalidInput() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.createLevel(new CreateLevelRequest(" ", "ACTIVE"), EMAIL));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());

        ResponseStatusException error2 = assertThrows(ResponseStatusException.class,
                () -> service.createLevel(new CreateLevelRequest("X", "PENDING"), EMAIL));
        assertEquals(HttpStatus.BAD_REQUEST, error2.getStatusCode());
    }

    @Test
    @DisplayName("Tao level moi: het diem de chia -> 409")
    void createLevelRejectsWhenNoScorePointsLeft() {
        stubActor();
        FitnessLevel a = level(1L, "A", 1, 3, "ACTIVE");
        FitnessLevel b = level(2L, "B", 4, 6, "ACTIVE");
        FitnessLevel c = level(3L, "C", 7, 9, "ACTIVE");
        lenient().when(fitnessLevels.existsByNameIgnoreCase("D")).thenReturn(false);
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(a, b, c));
        stubEmptyConfig();

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.createLevel(new CreateLevelRequest("D", "ACTIVE"), EMAIL));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    @DisplayName("Tao level moi: khong tim thay user -> 401")
    void createLevelRejectsUnknownActor() {
        lenient().when(fitnessLevels.existsByNameIgnoreCase("X")).thenReturn(false);
        lenient().when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.createLevel(new CreateLevelRequest("X", "ACTIVE"), EMAIL));
        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
    }

    // -------------------------------------------------------- benchmarkSlots

    @Test
    @DisplayName("benchmarkSlots: tra ve danh sach slot theo thu tu cau hinhinh")
    void benchmarkSlotsReturnsConfiguredSlots() {
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        Exercise plank = exercise("PLANK", "Plank", "HOLD", true);
        FitnessLevel holder = level(1L, "Beginner", 1, 3, "ACTIVE");

        lenient().when(criteria.findAll()).thenReturn(List.of(
                criterion(1L, "PUSH_UP_MAX_REPS", pushUp, holder, BigDecimal.ONE, BigDecimal.valueOf(19)),
                criterion(2L, "PLANK_MAX_SECONDS", plank, holder, BigDecimal.ONE, BigDecimal.valueOf(44))));

        assertEquals(List.of("PUSH_UP_MAX_REPS", "PLANK_MAX_SECONDS"), service.benchmarkSlots());
    }

    // ------------------------------------------------------ assessFromOnboarding

    @Test
    @DisplayName("Cham diem: tra ve tong diem, level va bang diem chi tiet")
    void assessFromOnboardingScoresBenchmark() {
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        FitnessLevel beginner = level(1L, "Beginner", 1, 3, "ACTIVE");
        FitnessLevel advanced = level(2L, "Advanced", 4, 9, "ACTIVE");

        lenient().when(criteria.findAll()).thenReturn(List.of(
                criterion(1L, "PUSH_UP_MAX_REPS", pushUp, beginner, BigDecimal.ONE, BigDecimal.valueOf(19)),
                criterion(2L, "PUSH_UP_MAX_REPS", pushUp, beginner, BigDecimal.valueOf(20), BigDecimal.valueOf(40))));
        lenient().when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of());
        lenient().when(exercises.findAll()).thenReturn(List.of(pushUp));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(beginner, advanced));

        Optional<BenchmarkAssessment> result = service.assessFromOnboarding(Map.of("PUSH_UP_MAX_REPS", 45));

        assertTrue(result.isPresent());
        BenchmarkAssessment assessment = result.get();
        assertEquals(3, assessment.totalScore());
        assertEquals("Beginner", assessment.level().getName());
        assertEquals(2, assessment.ladder().size());
        assertEquals(1, assessment.scores().size());
        assertEquals(3, assessment.scores().get(0).points());
        assertTrue(assessment.scores().get(0).bandLabel().contains("More than 40"));
    }

    @Test
    @DisplayName("Cham diem: khong co bai benchmark nao -> rong")
    void assessFromOnboardingReturnsEmptyWithoutConfiguration() {
        stubEmptyConfig();

        assertTrue(service.assessFromOnboarding(Map.of("PUSH_UP_MAX_REPS", 10)).isEmpty());
    }

    @Test
    @DisplayName("Cham diem: thieu cau tra loi cua mot bai -> rong")
    void assessFromOnboardingReturnsEmptyWhenAnswerMissing() {
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        FitnessLevel holder = level(1L, "Beginner", 1, 3, "ACTIVE");
        lenient().when(criteria.findAll()).thenReturn(List.of(
                criterion(1L, "PUSH_UP_MAX_REPS", pushUp, holder, BigDecimal.ONE, BigDecimal.valueOf(19))));
        lenient().when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of());
        lenient().when(exercises.findAll()).thenReturn(List.of(pushUp));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(holder));

        assertTrue(service.assessFromOnboarding(Map.of()).isEmpty());
    }

    @Test
    @DisplayName("Cham diem: khong co level active -> rong")
    void assessFromOnboardingReturnsEmptyWithoutActiveLevels() {
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        FitnessLevel holder = level(1L, "Beginner", 1, 3, "INACTIVE");
        lenient().when(criteria.findAll()).thenReturn(List.of(
                criterion(1L, "PUSH_UP_MAX_REPS", pushUp, holder, BigDecimal.ONE, BigDecimal.valueOf(19))));
        lenient().when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of());
        lenient().when(exercises.findAll()).thenReturn(List.of(pushUp));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(holder));

        assertTrue(service.assessFromOnboarding(Map.of("PUSH_UP_MAX_REPS", 5)).isEmpty());
    }

    @Test
    @DisplayName("Cham diem: 0 rep -> luon o bac thap nhat")
    void assessFromOnboardingZeroResultGoesToLowestLevel() {
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        FitnessLevel beginner = level(1L, "Beginner", 1, 3, "ACTIVE");
        FitnessLevel advanced = level(2L, "Advanced", 4, 9, "ACTIVE");

        lenient().when(criteria.findAll()).thenReturn(List.of(
                criterion(1L, "PUSH_UP_MAX_REPS", pushUp, beginner, BigDecimal.ONE, BigDecimal.valueOf(19))));
        lenient().when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of());
        lenient().when(exercises.findAll()).thenReturn(List.of(pushUp));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(beginner, advanced));

        Optional<BenchmarkAssessment> result = service.assessFromOnboarding(Map.of("PUSH_UP_MAX_REPS", 0));

        assertTrue(result.isPresent());
        assertTrue(result.get().zeroResult());
        assertEquals("Beginner", result.get().level().getName());
    }

    @Test
    @DisplayName("Cham diem: diem lech nhau >= 2 -> mat mot bac")
    void assessFromOnboardingUnbalancedLosesOneLevel() {
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        Exercise plank = exercise("PLANK", "Plank", "HOLD", true);
        FitnessLevel beginner = level(1L, "Beginner", 1, 3, "ACTIVE");
        FitnessLevel intermediate = level(2L, "Intermediate", 4, 6, "ACTIVE");
        FitnessLevel advanced = level(3L, "Advanced", 7, 9, "ACTIVE");

        lenient().when(criteria.findAll()).thenReturn(List.of(
                criterion(1L, "PUSH_UP_MAX_REPS", pushUp, beginner, BigDecimal.ONE, BigDecimal.valueOf(19)),
                criterion(2L, "PLANK_MAX_SECONDS", plank, beginner, BigDecimal.ONE, BigDecimal.valueOf(44))));
        lenient().when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of());
        lenient().when(exercises.findAll()).thenReturn(List.of(pushUp, plank));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(beginner, intermediate, advanced));

        Optional<BenchmarkAssessment> result = service.assessFromOnboarding(Map.of(
                "PUSH_UP_MAX_REPS", 100,
                "PLANK_MAX_SECONDS", 10));

        assertTrue(result.isPresent());
        assertTrue(result.get().unbalanced());
        assertEquals("Beginner", result.get().level().getName());
    }

    // --------------------------------------------------- assignLevelFromOnboarding

    @Test
    @DisplayName("Gan level: luu level tuong ung vao profile")
    void assignLevelFromOnboardingStoresLevel() {
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        FitnessLevel beginner = level(1L, "Beginner", 1, 3, "ACTIVE");
        FitnessLevel advanced = level(2L, "Advanced", 4, 9, "ACTIVE");

        MemberProfile profile = new MemberProfile();
        profile.setId(10L);

        lenient().when(criteria.findAll()).thenReturn(List.of(
                criterion(1L, "PUSH_UP_MAX_REPS", pushUp, beginner, BigDecimal.ONE, BigDecimal.valueOf(19))));
        lenient().when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of());
        lenient().when(exercises.findAll()).thenReturn(List.of(pushUp));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(beginner, advanced));
        lenient().when(memberProfiles.findByUser_Id(5L)).thenReturn(Optional.of(profile));

        Optional<String> name = service.assignLevelFromOnboarding(5L, Map.of("PUSH_UP_MAX_REPS", 30));

        assertTrue(name.isPresent());
        assertEquals("Beginner", name.get());
        verify(fitnessLevelsService).changeLevel(profile, beginner);
    }

    @Test
    @DisplayName("Gan level: chua co profile -> tao profile moi")
    void assignLevelFromOnboardingCreatesProfile() {
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        FitnessLevel beginner = level(1L, "Beginner", 1, 3, "ACTIVE");

        lenient().when(criteria.findAll()).thenReturn(List.of(
                criterion(1L, "PUSH_UP_MAX_REPS", pushUp, beginner, BigDecimal.ONE, BigDecimal.valueOf(19))));
        lenient().when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of());
        lenient().when(exercises.findAll()).thenReturn(List.of(pushUp));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(beginner));
        lenient().when(memberProfiles.findByUser_Id(5L)).thenReturn(Optional.empty());
        lenient().when(users.getReferenceById(5L)).thenReturn(actor());

        Optional<String> name = service.assignLevelFromOnboarding(5L, Map.of("PUSH_UP_MAX_REPS", 5));

        assertTrue(name.isPresent());
        verify(fitnessLevelsService).changeLevel(any(MemberProfile.class), eq(beginner));
    }

    @Test
    @DisplayName("Gan level: khong co cau hinh -> rong, khong doi gi")
    void assignLevelFromOnboardingReturnsEmptyWithoutConfiguration() {
        stubEmptyConfig();

        assertTrue(service.assignLevelFromOnboarding(5L, Map.of("X", 1)).isEmpty());
        verify(fitnessLevelsService, never()).changeLevel(any(), any());
    }

    @Test
    @DisplayName("Gan level: thieu cau tra loi -> rong, khong doi gi")
    void assignLevelFromOnboardingReturnsEmptyWhenAnswerMissing() {
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        FitnessLevel holder = level(1L, "Beginner", 1, 3, "ACTIVE");
        lenient().when(criteria.findAll()).thenReturn(List.of(
                criterion(1L, "PUSH_UP_MAX_REPS", pushUp, holder, BigDecimal.ONE, BigDecimal.valueOf(19))));
        lenient().when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of());
        lenient().when(exercises.findAll()).thenReturn(List.of(pushUp));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(holder));

        assertTrue(service.assignLevelFromOnboarding(5L, Map.of()).isEmpty());
        verify(fitnessLevelsService, never()).changeLevel(any(), any());
    }

    // --------------------------------------------------------------- helpers

    @Test
    @DisplayName("Diem bai: 1 diem khi <= nguong, 2 diem khi <= nguong trung, 3 diem con lai")
    void pointsForScoresBands() {
        assertEquals(1, LevelBenchmarkService.pointsFor(10, 19, 40));
        assertEquals(2, LevelBenchmarkService.pointsFor(30, 19, 40));
        assertEquals(3, LevelBenchmarkService.pointsFor(50, 19, 40));
    }

    @Test
    @DisplayName("Khoang diem: 1 bai -> san 1..3; 2 bai -> san 2..6")
    void scoreFloorAndCeiling() {
        assertEquals(1, LevelBenchmarkService.scoreFloor(1));
        assertEquals(3, LevelBenchmarkService.scoreCeiling(1));
        assertEquals(2, LevelBenchmarkService.scoreFloor(2));
        assertEquals(6, LevelBenchmarkService.scoreCeiling(2));
    }

    @Test
    @DisplayName("Lech diem: 2 bai lech nhau >= 2 diem -> mat 1 bac")
    void unbalancedDetection() {
        assertFalse(LevelBenchmarkService.isUnbalanced(List.of(1, 2)));
        assertTrue(LevelBenchmarkService.isUnbalanced(List.of(1, 3)));
        assertFalse(LevelBenchmarkService.isUnbalanced(List.of(3)));
    }

    @Test
    @DisplayName("That bai: gia tri <= 0 la that bai")
    void criticalFailureDetection() {
        assertTrue(LevelBenchmarkService.isCriticalFailure(0));
        assertTrue(LevelBenchmarkService.isCriticalFailure(-1));
        assertFalse(LevelBenchmarkService.isCriticalFailure(1));
    }

    @Test
    @DisplayName("Ha bac: di chuyen xuong bac duoi va khong xuong duoi bac thap nhat")
    void levelsBelowMovesDown() {
        FitnessLevel a = level(1L, "A", 1, 3, "ACTIVE");
        FitnessLevel b = level(2L, "B", 4, 6, "ACTIVE");
        FitnessLevel c = level(3L, "C", 7, 9, "ACTIVE");
        List<FitnessLevel> levels = List.of(a, b, c);

        assertEquals(b, LevelBenchmarkService.levelsBelow(levels, c, 1));
        assertEquals(a, LevelBenchmarkService.levelsBelow(levels, b, 5));
    }

    @Test
    @DisplayName("Xac dinh level: diem nam trong khoang -> level tuong ung")
    void resolveLevelPicksMatchingRange() {
        FitnessLevel a = level(1L, "A", 1, 3, "ACTIVE");
        FitnessLevel b = level(2L, "B", 4, 6, "ACTIVE");
        List<FitnessLevel> levels = List.of(a, b);

        assertEquals(a, LevelBenchmarkService.resolveLevel(levels, 2, false, false));
        assertEquals(b, LevelBenchmarkService.resolveLevel(levels, 5, false, false));
    }

    @Test
    @DisplayName("Xac dinh level: diem ngoai khoang -> gan level gan nhat")
    void resolveLevelPicksNearestWhenOutOfRange() {
        FitnessLevel a = level(1L, "A", 1, 3, "ACTIVE");
        FitnessLevel b = level(2L, "B", 4, 6, "ACTIVE");
        List<FitnessLevel> levels = List.of(a, b);

        assertEquals(b, LevelBenchmarkService.resolveLevel(levels, 99, false, false));
        assertEquals(a, LevelBenchmarkService.resolveLevel(levels, 0, false, false));
    }

    @Test
    @DisplayName("Xac dinh level: khong co level active -> loi 500")
    void resolveLevelFailsWithoutActiveLevels() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> LevelBenchmarkService.resolveLevel(List.of(), 3, false, false));
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, error.getStatusCode());
    }

    @Test
    @DisplayName("Xac dinh level: diem lech -> ha mot bac")
    void resolveLevelDropsOneLevelWhenUnbalanced() {
        FitnessLevel a = level(1L, "A", 1, 3, "ACTIVE");
        FitnessLevel b = level(2L, "B", 4, 6, "ACTIVE");
        FitnessLevel c = level(3L, "C", 7, 9, "ACTIVE");
        List<FitnessLevel> levels = List.of(a, b, c);

        assertEquals(b, LevelBenchmarkService.resolveLevel(levels, 9, false, true));
    }

    @Test
    @DisplayName("Xac dinh level: ket qua 0 rep -> bac thap nhat")
    void resolveLevelReturnsLowestForZeroResult() {
        FitnessLevel a = level(1L, "A", 1, 3, "ACTIVE");
        FitnessLevel b = level(2L, "B", 4, 6, "ACTIVE");
        List<FitnessLevel> levels = List.of(a, b);

        assertEquals(a, LevelBenchmarkService.resolveLevel(levels, 9, true, false));
    }

    @Test
    @DisplayName("Xac dinh level: level khong trong danh sach -> giu nguyen")
    void levelsBelowKeepsUnknownLevel() {
        FitnessLevel a = level(1L, "A", 1, 3, "ACTIVE");
        FitnessLevel other = level(9L, "Other", 1, 3, "ACTIVE");
        List<FitnessLevel> levels = List.of(a);

        assertEquals(other, LevelBenchmarkService.levelsBelow(levels, other, 1));
    }

    // ------------------------------------------ updateConfiguration: nhanh bo sung

    @Test
    @DisplayName("Cau hinh: bai HOLD duoc gan slot _MAX_SECONDS")
    void updateConfigurationDerivesHoldSlot() {
        stubActor();
        Exercise plank = exercise("PLANK", "Plank", "HOLD", true);
        FitnessLevel beginner = level(1L, "Beginner", 1, 3, "ACTIVE");

        lenient().when(exercises.findByCode("PLANK")).thenReturn(Optional.of(plank));
        lenient().when(exercises.findAll()).thenReturn(List.of(plank));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(beginner));
        lenient().when(fitnessLevels.findById(1L)).thenReturn(Optional.of(beginner));
        lenient().when(fitnessLevels.existsById(anyLong())).thenReturn(true);
        lenient().when(criteria.save(any(BenchmarkCriterion.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.updateConfiguration(new UpdateBenchmarkConfiguration(
                List.of(new BenchmarkExerciseUpdate("PLANK", "HOLD", 44, 90)),
                List.of(new LevelUpdate(1L, "Beginner", 1, 3, "ACTIVE"))), EMAIL);

        ArgumentCaptor<BenchmarkCriterion> captor = ArgumentCaptor.forClass(BenchmarkCriterion.class);
        verify(criteria, org.mockito.Mockito.atLeast(3)).save(captor.capture());
        assertEquals("PLANK_MAX_SECONDS", captor.getAllValues().get(0).getBenchmarkSlot());
    }

    @Test
    @DisplayName("Cau hinh: level moi duoc them va level bi xoa")
    void updateConfigurationAddsAndRemovesLevels() {
        stubActor();
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        Exercise plank = exercise("PLANK", "Plank", "HOLD", true);
        FitnessLevel beginner = level(1L, "Beginner", 2, 4, "ACTIVE");
        FitnessLevel advanced = level(2L, "Advanced", 7, 9, "ACTIVE");

        lenient().when(criteria.findAll()).thenReturn(List.of());
        lenient().when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of());
        lenient().when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(pushUp));
        lenient().when(exercises.findByCode("PLANK")).thenReturn(Optional.of(plank));
        lenient().when(exercises.findAll()).thenReturn(List.of(pushUp, plank));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(beginner, advanced));
        lenient().when(fitnessLevels.findById(1L)).thenReturn(Optional.of(beginner));
        lenient().when(fitnessLevels.existsById(anyLong())).thenReturn(true);
        lenient().when(memberProfiles.countByFitnessLevel_Id(2L)).thenReturn(0L);
        lenient().when(exercises.existsInUseByDifficultyLevel("Advanced")).thenReturn(false);
        lenient().when(workouts.existsByLevelIgnoreCase("Advanced")).thenReturn(false);
        lenient().when(criteria.save(any(BenchmarkCriterion.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.updateConfiguration(new UpdateBenchmarkConfiguration(
                List.of(new BenchmarkExerciseUpdate("PUSH_UP", "REPS", 19, 40),
                        new BenchmarkExerciseUpdate("PLANK", "HOLD", 44, 90)),
                List.of(new LevelUpdate(1L, "Beginner", 2, 4, "ACTIVE"),
                        new LevelUpdate(null, "Intermediate", 5, 6, "ACTIVE"))), EMAIL);

        verify(fitnessLevels).deleteAll(List.of(advanced));
        verify(fitnessLevels, org.mockito.Mockito.atLeast(2)).save(any(FitnessLevel.class));
    }

    @Test
    @DisplayName("Cau hinh: level bi xoa nhung con member -> 409")
    void updateConfigurationRejectsRemovingUsedLevel() {
        stubActor();
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        FitnessLevel beginner = level(1L, "Beginner", 1, 3, "ACTIVE");
        FitnessLevel advanced = level(2L, "Advanced", 7, 9, "ACTIVE");

        lenient().when(criteria.findAll()).thenReturn(List.of());
        lenient().when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(pushUp));
        lenient().when(exercises.findAll()).thenReturn(List.of(pushUp));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(beginner, advanced));
        lenient().when(fitnessLevels.existsById(anyLong())).thenReturn(true);
        lenient().when(memberProfiles.countByFitnessLevel_Id(2L)).thenReturn(2L);

        assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(new BenchmarkExerciseUpdate("PUSH_UP", "REPS", 19, 40)),
                        List.of(new LevelUpdate(1L, "Beginner", 1, 3, "ACTIVE"))), EMAIL));
    }

    @Test
    @DisplayName("Cau hinh: hai bai suy ra cung mot slot -> 400")
    void updateConfigurationRejectsSameSlotCollision() {
        stubActor();
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        Exercise sameSlot = exercise("PUSH-UP", "Push-up", "REPS", true);
        FitnessLevel beginner = level(1L, "Beginner", 2, 6, "ACTIVE");

        lenient().when(criteria.findAll()).thenReturn(List.of(
                criterion(1L, "PUSH_UP_MAX_REPS", pushUp, beginner, BigDecimal.ONE, BigDecimal.valueOf(19))));
        lenient().when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(pushUp));
        lenient().when(exercises.findByCode("PUSH-UP")).thenReturn(Optional.of(sameSlot));
        lenient().when(fitnessLevels.findAll()).thenReturn(List.of(beginner));
        lenient().when(fitnessLevels.findById(1L)).thenReturn(Optional.of(beginner));
        lenient().when(fitnessLevels.existsById(anyLong())).thenReturn(true);

        assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(new BenchmarkExerciseUpdate("PUSH_UP", "REPS", 19, 40),
                                new BenchmarkExerciseUpdate("PUSH-UP", "REPS", 21, 42)),
                        List.of(new LevelUpdate(1L, "Beginner", 2, 6, "ACTIVE"))), EMAIL));
    }

    @Test
    @DisplayName("Cau hinh: khoang diem bat dau sai -> 400")
    void updateConfigurationRejectsRangeNotStartingAtFloor() {
        lenient().when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(exercise("PUSH_UP", "Push-up", "REPS", true)));
        lenient().when(fitnessLevels.existsById(anyLong())).thenReturn(true);

        assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(new BenchmarkExerciseUpdate("PUSH_UP", "REPS", 19, 40)),
                        List.of(new LevelUpdate(1L, "Beginner", 2, 3, "ACTIVE"))), EMAIL));
    }

    @Test
    @DisplayName("Cau hinh: khoang diem ket thuc sai -> 400")
    void updateConfigurationRejectsRangeNotEndingAtCeiling() {
        lenient().when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(exercise("PUSH_UP", "Push-up", "REPS", true)));
        lenient().when(fitnessLevels.existsById(anyLong())).thenReturn(true);

        assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(new BenchmarkExerciseUpdate("PUSH_UP", "REPS", 19, 40)),
                        List.of(new LevelUpdate(1L, "Beginner", 1, 2, "ACTIVE"))), EMAIL));
    }

    @Test
    @DisplayName("Cau hinh: ten level qua 50 ky tu -> 400")
    void updateConfigurationRejectsTooLongLevelName() {
        lenient().when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(exercise("PUSH_UP", "Push-up", "REPS", true)));
        lenient().when(fitnessLevels.existsById(anyLong())).thenReturn(true);

        assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(new BenchmarkExerciseUpdate("PUSH_UP", "REPS", 19, 40)),
                        List.of(new LevelUpdate(1L, "x".repeat(60), 1, 3, "ACTIVE"))), EMAIL));
    }

    @Test
    @DisplayName("Cau hinh: khoang diem am -> 400")
    void updateConfigurationRejectsNegativeScore() {
        lenient().when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(exercise("PUSH_UP", "Push-up", "REPS", true)));
        lenient().when(fitnessLevels.existsById(anyLong())).thenReturn(true);

        assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(new BenchmarkExerciseUpdate("PUSH_UP", "REPS", 19, 40)),
                        List.of(new LevelUpdate(1L, "Beginner", -1, 3, "ACTIVE"))), EMAIL));
    }

    @Test
    @DisplayName("Cau hinh: trang thai level khong hop le -> 400")
    void updateConfigurationRejectsInvalidLevelStatus() {
        lenient().when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(exercise("PUSH_UP", "Push-up", "REPS", true)));
        lenient().when(fitnessLevels.existsById(anyLong())).thenReturn(true);

        assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(new BenchmarkExerciseUpdate("PUSH_UP", "REPS", 19, 40)),
                        List.of(new LevelUpdate(1L, "Beginner", 1, 3, "PENDING"))), EMAIL));
    }

    @Test
    @DisplayName("Cau hinh: bai tap khong phai REPS/HOLD -> 400")
    void updateConfigurationRejectsNonBenchmarkCategory() {
        lenient().when(exercises.findByCode("TIMED")).thenReturn(Optional.of(exercise("TIMED", "Timed Run", "TIMED", true)));

        assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(new BenchmarkExerciseUpdate("TIMED", "TIMED", 19, 40)),
                        List.of(new LevelUpdate(1L, "Beginner", 1, 3, "ACTIVE"))), EMAIL));
    }

    @Test
    @DisplayName("Cau hinh: khong co bai benchmark -> 400")
    void updateConfigurationRejectsEmptyExercises() {
        assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(), List.of(new LevelUpdate(1L, "Beginner", 1, 3, "ACTIVE"))), EMAIL));
    }

    @Test
    @DisplayName("Cau hinh: bai khong he thong va khong co nguon -> 400")
    void updateConfigurationRejectsExerciseWithoutSystemSource() {
        Exercise custom = new Exercise();
        custom.setCode("CUSTOM_EX");
        custom.setName("Custom Ex");
        custom.setCategory("REPS");
        custom.setCreatedBy(null);
        lenient().when(exercises.findByCode("CUSTOM_EX")).thenReturn(Optional.of(custom));

        assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(new BenchmarkExerciseUpdate("CUSTOM_EX", "REPS", 19, 40)),
                        List.of(new LevelUpdate(1L, "Beginner", 1, 3, "ACTIVE"))), EMAIL));
    }

    @Test
    @DisplayName("Cau hinh: level id trung nhau -> 400")
    void updateConfigurationRejectsDuplicateLevelIds() {
        lenient().when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(exercise("PUSH_UP", "Push-up", "REPS", true)));
        lenient().when(fitnessLevels.existsById(anyLong())).thenReturn(true);

        assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(new BenchmarkExerciseUpdate("PUSH_UP", "REPS", 19, 40)),
                        List.of(new LevelUpdate(1L, "A", 1, 3, "ACTIVE"),
                                new LevelUpdate(1L, "B", 4, 6, "ACTIVE"))), EMAIL));
    }
}
