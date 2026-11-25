package com.calishealth.service;

import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkAssessment;
import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkConfiguration;
import com.calishealth.dtos.LevelBenchmarkDtos.BenchmarkExercise;
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

@ExtendWith(MockitoExtension.class)
class LevelBenchmarkServiceTest {
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
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(actor()));
    }

    // ------------------------------------------------------------ getConfiguration

    @Test
    @DisplayName("Cấu hình: nhóm các dòng benchmark theo slot và tính ngưỡng 1 điểm / 2 điểm")
    void getConfigurationGroupsRowsBySlot() {
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        FitnessLevel holder = level(1L, "Beginner", 1, 3, "ACTIVE");

        when(criteria.findAll()).thenReturn(List.of(
                criterion(1L, "PUSH_UP_MAX_REPS", pushUp, holder, BigDecimal.ONE, BigDecimal.valueOf(19)),
                criterion(2L, "PUSH_UP_MAX_REPS", pushUp, holder, BigDecimal.valueOf(20), BigDecimal.valueOf(40))));
        when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of());
        when(exercises.findAll()).thenReturn(List.of(pushUp));
        when(fitnessLevels.findAll()).thenReturn(List.of(holder));

        BenchmarkConfiguration config = service.getConfiguration();

        assertEquals(1, config.exercises().size());
        BenchmarkExercise row = config.exercises().get(0);
        assertEquals("PUSH_UP_MAX_REPS", row.slot());
        assertEquals("Push-up", row.name());
        assertEquals("reps", row.unit());
        assertEquals(19, row.beginnerMax());
        assertEquals(40, row.intermediateMax());
        assertFalse(row.surveyQuestionReady());
        assertEquals(1, config.availableExercises().size());
        assertEquals("REPS", config.availableExercises().get(0).category());
        assertEquals(1, config.levels().size());
        assertEquals("System", config.levels().get(0).updatedBy());
    }

    @Test
    @DisplayName("Cấu hình: bài HOLD dùng đơn vị seconds")
    void getConfigurationUsesSecondsForHoldExercises() {
        Exercise plank = exercise("PLANK", "Plank", "HOLD", true);
        FitnessLevel holder = level(1L, "Beginner", 1, 3, "ACTIVE");

        when(criteria.findAll()).thenReturn(List.of(
                criterion(1L, "PLANK_MAX_SECONDS", plank, holder, BigDecimal.ONE, BigDecimal.valueOf(44)),
                criterion(2L, "PLANK_MAX_SECONDS", plank, holder, BigDecimal.valueOf(45), BigDecimal.valueOf(90))));
        when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of());
        when(exercises.findAll()).thenReturn(List.of(plank));
        when(fitnessLevels.findAll()).thenReturn(List.of(holder));

        assertEquals("seconds", service.getConfiguration().exercises().get(0).unit());
    }

    @Test
    @DisplayName("Cấu hình: bài đã có câu hỏi NUMBER active -> surveyQuestionReady = true")
    void getConfigurationFlagsReadySurveyQuestion() {
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        FitnessLevel holder = level(1L, "Beginner", 1, 3, "ACTIVE");
        AssessmentQuestion question = new AssessmentQuestion();
        question.setQuestionCode("PUSH_UP_MAX_REPS");

        when(criteria.findAll()).thenReturn(List.of(
                criterion(1L, "PUSH_UP_MAX_REPS", pushUp, holder, BigDecimal.ONE, BigDecimal.valueOf(19))));
        when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of(question));
        when(exercises.findAll()).thenReturn(List.of(pushUp));
        when(fitnessLevels.findAll()).thenReturn(List.of(holder));

        assertTrue(service.getConfiguration().exercises().get(0).surveyQuestionReady());
    }

    @Test
    @DisplayName("Cấu hình: bài của member không nằm trong danh sách chọn được")
    void getConfigurationExcludesMemberExercises() {
        Exercise memberExercise = exercise("MY_EX", "My Exercise", "REPS", false);
        when(criteria.findAll()).thenReturn(List.of());
        when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of());
        when(exercises.findAll()).thenReturn(List.of(memberExercise));
        when(fitnessLevels.findAll()).thenReturn(List.of());

        assertTrue(service.getConfiguration().availableExercises().isEmpty());
    }

    @Test
    @DisplayName("Cấu hình: bài có category khác REPS/HOLD không được chọn")
    void getConfigurationExcludesNonBenchmarkCategories() {
        Exercise timed = exercise("TIMED", "Timed Run", "TIMED", true);
        when(criteria.findAll()).thenReturn(List.of());
        when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of());
        when(exercises.findAll()).thenReturn(List.of(timed));
        when(fitnessLevels.findAll()).thenReturn(List.of());

        assertTrue(service.getConfiguration().availableExercises().isEmpty());
    }

    @Test
    @DisplayName("Cấu hình: dòng legacy (LEGACY-) bị bỏ qua")
    void getConfigurationIgnoresLegacyRows() {
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        FitnessLevel holder = level(1L, "Beginner", 1, 3, "ACTIVE");
        when(criteria.findAll()).thenReturn(List.of(
                criterion(1L, "LEGACY-PUSH_UP", pushUp, holder, BigDecimal.ONE, BigDecimal.valueOf(19))));
        when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of());
        when(exercises.findAll()).thenReturn(List.of());
        when(fitnessLevels.findAll()).thenReturn(List.of());

        assertTrue(service.getConfiguration().exercises().isEmpty());
    }

    // ---------------------------------------------------------- updateConfiguration

    @Test
    @DisplayName("Cập nhật cấu hình: lưu ngưỡng và đồng bộ survey")
    void updateConfigurationSavesThresholdsAndSyncsSurvey() {
        stubActor();
        Exercise pushUp = exercise("PUSH_UP", "Push-up", "REPS", true);
        FitnessLevel beginner = level(1L, "Beginner", 1, 3, "ACTIVE");

        when(criteria.findAll()).thenReturn(List.of());
        when(assessmentQuestions.findAllByQuestionTypeIgnoreCaseAndStatus("NUMBER", ConfigStatus.ACTIVE))
                .thenReturn(List.of());
        when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(pushUp));
        when(exercises.findAll()).thenReturn(List.of(pushUp));
        when(fitnessLevels.findAll()).thenReturn(List.of(beginner));
        when(fitnessLevels.findById(1L)).thenReturn(Optional.of(beginner));
        when(fitnessLevels.existsById(anyLong())).thenReturn(true);
        lenient().when(criteria.save(any(BenchmarkCriterion.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        UpdateBenchmarkConfiguration request = new UpdateBenchmarkConfiguration(
                List.of(new BenchmarkExerciseUpdate("PUSH_UP", "REPS", 19, 40)),
                List.of(new LevelUpdate(1L, "Beginner", 1, 3, "ACTIVE")));

        service.updateConfiguration(request, EMAIL);

        ArgumentCaptor<BenchmarkCriterion> captor = ArgumentCaptor.forClass(BenchmarkCriterion.class);
        verify(criteria, org.mockito.Mockito.atLeast(3)).save(captor.capture());
        assertEquals(3, captor.getAllValues().size());
        verify(surveySync).sync(any(), any(), any());
    }

    @Test
    @DisplayName("Cập nhật cấu hình: request null -> 400")
    void updateConfigurationRejectsNullRequest() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(null, EMAIL));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Cập nhật cấu hình: không có level nào -> 400")
    void updateConfigurationRejectsEmptyLevels() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(new BenchmarkExerciseUpdate("PUSH_UP", "REPS", 19, 40)), List.of()), EMAIL));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    @DisplayName("Cập nhật cấu hình: số bài benchmark ngoài khoảng 1..8 -> 400")
    void updateConfigurationRejectsTooManyExercises() {
        List<BenchmarkExerciseUpdate> exercises = java.util.stream.IntStream.range(0, 9)
                .mapToObj(i -> new BenchmarkExerciseUpdate("E" + i, "REPS", 19, 40))
                .toList();

        assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        exercises, List.of(new LevelUpdate(1L, "Beginner", 1, 27, "ACTIVE"))), EMAIL));
    }

    @Test
    @DisplayName("Cập nhật cấu hình: trùng mã bài tập -> 400")
    void updateConfigurationRejectsDuplicateExercise() {
        assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(new BenchmarkExerciseUpdate("PUSH_UP", "REPS", 19, 40),
                                new BenchmarkExerciseUpdate("PUSH_UP", "REPS", 19, 40)),
                        List.of(new LevelUpdate(1L, "Beginner", 1, 6, "ACTIVE"))), EMAIL));
    }

    @Test
    @DisplayName("Cập nhật cấu hình: ngưỡng không hợp lệ -> 400")
    void updateConfigurationRejectsInvalidThresholds() {
        assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(new BenchmarkExerciseUpdate("PUSH_UP", "REPS", 40, 19)),
                        List.of(new LevelUpdate(1L, "Beginner", 1, 3, "ACTIVE"))), EMAIL));
    }

    @Test
    @DisplayName("Cập nhật cấu hình: bài tập không tồn tại -> 400")
    void updateConfigurationRejectsUnknownExercise() {
        when(exercises.findByCode("NOPE")).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(new BenchmarkExerciseUpdate("NOPE", "REPS", 19, 40)),
                        List.of(new LevelUpdate(1L, "Beginner", 1, 3, "ACTIVE"))), EMAIL));
    }

    @Test
    @DisplayName("Cập nhật cấu hình: bài tập không phải của hệ thống -> 400")
    void updateConfigurationRejectsMemberExercise() {
        when(exercises.findByCode("MY_EX")).thenReturn(Optional.of(exercise("MY_EX", "Mine", "REPS", false)));

        assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(new BenchmarkExerciseUpdate("MY_EX", "REPS", 19, 40)),
                        List.of(new LevelUpdate(1L, "Beginner", 1, 3, "ACTIVE"))), EMAIL));
    }

    @Test
    @DisplayName("Cập nhật cấu hình: category của bài tập không khớp -> 400")
    void updateConfigurationRejectsCategoryMismatch() {
        when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(exercise("PUSH_UP", "Push-up", "REPS", true)));

        assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(new BenchmarkExerciseUpdate("PUSH_UP", "HOLD", 19, 40)),
                        List.of(new LevelUpdate(1L, "Beginner", 1, 3, "ACTIVE"))), EMAIL));
    }

    @Test
    @DisplayName("Cập nhật cấu hình: tên level trùng nhau -> 409")
    void updateConfigurationRejectsDuplicateLevelNames() {
        when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(exercise("PUSH_UP", "Push-up", "REPS", true)));
        when(fitnessLevels.existsById(anyLong())).thenReturn(true);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(new BenchmarkExerciseUpdate("PUSH_UP", "REPS", 19, 40)),
                        List.of(new LevelUpdate(1L, "Beginner", 1, 3, "ACTIVE"),
                                new LevelUpdate(2L, "beginner", 4, 6, "ACTIVE"))), EMAIL));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    @DisplayName("Cập nhật cấu hình: không còn level active nào -> 400")
    void updateConfigurationRejectsAllInactiveLevels() {
        when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(exercise("PUSH_UP", "Push-up", "REPS", true)));
        when(fitnessLevels.existsById(anyLong())).thenReturn(true);

        assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(new BenchmarkExerciseUpdate("PUSH_UP", "REPS", 19, 40)),
                        List.of(new LevelUpdate(1L, "Beginner", 1, 3, "INACTIVE"))), EMAIL));
    }

    @Test
    @DisplayName("Cập nhật cấu hình: khoảng điểm không liền mạch -> 400")
    void updateConfigurationRejectsNonContiguousRanges() {
        when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(exercise("PUSH_UP", "Push-up", "REPS", true)));
        when(fitnessLevels.existsById(anyLong())).thenReturn(true);

        assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(new BenchmarkExerciseUpdate("PUSH_UP", "REPS", 19, 40)),
                        List.of(new LevelUpdate(1L, "Beginner", 1, 2, "ACTIVE"),
                                new LevelUpdate(2L, "Intermediate", 4, 6, "ACTIVE"))), EMAIL));
    }

    @Test
    @DisplayName("Cập nhật cấu hình: id level không tồn tại -> 400")
    void updateConfigurationRejectsUnknownLevelId() {
        when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(exercise("PUSH_UP", "Push-up", "REPS", true)));
        when(fitnessLevels.existsById(99L)).thenReturn(false);

        assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(new BenchmarkExerciseUpdate("PUSH_UP", "REPS", 19, 40)),
                        List.of(new LevelUpdate(99L, "Beginner", 1, 3, "ACTIVE"))), EMAIL));
    }

    @Test
    @DisplayName("Cập nhật cấu hình: người dùng không còn tồn tại -> 401")
    void updateConfigurationRejectsUnknownActor() {
        when(exercises.findByCode("PUSH_UP")).thenReturn(Optional.of(exercise("PUSH_UP", "Push-up", "REPS", true)));
        when(fitnessLevels.existsById(anyLong())).thenReturn(true);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThrows(ResponseStatusException.class,
                () -> service.updateConfiguration(new UpdateBenchmarkConfiguration(
                        List.of(new BenchmarkExerciseUpdate("PUSH_UP", "REPS", 19, 40)),
                        List.of(new LevelUpdate(1L, "Beginner", 1, 3, "ACTIVE"))), EMAIL));
    }
}
