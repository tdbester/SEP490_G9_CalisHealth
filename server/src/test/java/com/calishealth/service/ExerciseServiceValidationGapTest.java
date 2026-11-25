package com.calishealth.service;

import com.calishealth.dtos.ExerciseDtos.CreateExerciseRequest;
import com.calishealth.models.Exercise;
import com.calishealth.models.FitnessLevel;
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

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bo sung coverage cho {@link ExerciseService}: bai chua co id, cap do khong hop le,
 * khong phai loai REPS/HOLD va cap do dang bi khoa.
 */
class ExerciseServiceValidationGapTest {

    private ExerciseRepository exercises;
    private FitnessLevelRepository fitnessLevels;
    private ContentNameGuardService contentNameGuard;
    private ExerciseService service;

    @BeforeEach
    void setUp() {
        exercises = mock(ExerciseRepository.class);
        fitnessLevels = mock(FitnessLevelRepository.class);
        contentNameGuard = mock(ContentNameGuardService.class);
        ExerciseMuscleGroupCatalog muscleGroupCatalog = mock(ExerciseMuscleGroupCatalog.class);
        service = new ExerciseService(
                exercises,
                mock(ExerciseModerationHistoryRepository.class),
                mock(UserRepository.class),
                mock(JdbcTemplate.class),
                mock(MediaRegistryService.class),
                mock(ProgressionRuleRepository.class),
                fitnessLevels,
                muscleGroupCatalog,
                mock(SystemNotificationService.class),
                mock(ExercisePhysiologyService.class),
                contentNameGuard,
                mock(ExerciseUnlockService.class),
                mock(FormRuleAdminService.class));
    }

    private static CreateExerciseRequest request(String category, String level, Integer sets) {
        return new CreateExerciseRequest("Squat", "HEALTH", "desc", category, "Legs", level,
                "step one", sets, 10, null, null);
    }

    private void activeLevel(String name) {
        FitnessLevel level = new FitnessLevel();
        level.setName(name);
        level.setStatus("ACTIVE");
        lenient().when(fitnessLevels.findByNameIgnoreCase(anyString())).thenReturn(Optional.of(level));
    }

    @Test
    @DisplayName("create: cap do rong -> 400")
    void createRejectsBlankLevel() {
        assertThatThrownBy(() -> service.create(request("REPS", "  ", 3), null, null, "cm@calishealth.vn"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST))
                .hasMessageContaining("Choose a valid exercise level");
    }

    @Test
    @DisplayName("create: cap do khong ton tai -> 400")
    void createRejectsUnknownLevel() {
        lenient().when(fitnessLevels.findByNameIgnoreCase(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(request("REPS", "Beginner", 3), null, null, "cm@calishealth.vn"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST))
                .hasMessageContaining("Choose a valid exercise level");
    }

    @Test
    @DisplayName("create: khong phai REPS/HOLD -> 400")
    void createRejectsUnsupportedCategory() {
        activeLevel("Beginner");

        assertThatThrownBy(() -> service.create(request("STRETCH", "Beginner", 3), null, null, "cm@calishealth.vn"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST))
                .hasMessageContaining("repetition-count or hold");
    }

    @Test
    @DisplayName("create: so sets ngoai pham vi -> 400")
    void createRejectsOutOfRangeSets() {
        activeLevel("Beginner");

        assertThatThrownBy(() -> service.create(request("REPS", "Beginner", 99), null, null, "cm@calishealth.vn"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST))
                .hasMessageContaining("Default sets");
    }

    @Test
    @DisplayName("create: so reps ngoai pham vi -> 400")
    void createRejectsOutOfRangeReps() {
        activeLevel("Beginner");
        CreateExerciseRequest bad = new CreateExerciseRequest("Squat", "HEALTH", "desc", "REPS", "Legs",
                "Beginner", "step one", 3, 0, null, null);

        assertThatThrownBy(() -> service.create(bad, null, null, "cm@calishealth.vn"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST))
                .hasMessageContaining("Number of reps");
    }

    @Test
    @DisplayName("create: khong co huong dan -> 400")
    void createRejectsMissingGuide() {
        activeLevel("Beginner");
        CreateExerciseRequest bad = new CreateExerciseRequest("Squat", "HEALTH", "desc", "REPS", "Legs",
                "Beginner", "  ", 3, 10, null, null);

        assertThatThrownBy(() -> service.create(bad, null, null, "cm@calishealth.vn"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST))
                .hasMessageContaining("Execution steps are required");
    }

    @Test
    @DisplayName("updateSystemExercise: doi cap do sang cap do dang khoa -> 400")
    void updateRejectsMovingToInactiveLevel() {
        Exercise exercise = new Exercise();
        exercise.setCode("EX001");
        exercise.setName("Squat");
        exercise.setSource("SYSTEM");
        exercise.setDifficultyLevel("Beginner");
        exercise.setActive(true);
        when(exercises.findByCode("EX001")).thenReturn(Optional.of(exercise));

        FitnessLevel inactive = new FitnessLevel();
        inactive.setName("Advanced");
        inactive.setStatus("INACTIVE");
        when(fitnessLevels.findByNameIgnoreCase("Advanced")).thenReturn(Optional.of(inactive));
        when(fitnessLevels.findAll()).thenReturn(List.of(inactive));

        assertThatThrownBy(() -> service.updateSystemExercise("EX001",
                new CreateExerciseRequest("Squat", "HEALTH", "desc", "REPS", "Legs", "Advanced",
                        "step one", 3, 10, null, null), null, null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("getSystemExerciseDetail: bai chua co id -> danh sach rong")
    void getDetailWithoutIdSkipsProgressionRules() {
        Exercise exercise = new Exercise();
        exercise.setCode("EX001");
        exercise.setName("Squat");
        exercise.setSource("SYSTEM");
        exercise.setActive(true);
        exercise.setGuide("Do it\n\nThen stop");
        when(exercises.findAcceptedByIdAndSource(any(), eq("SYSTEM"))).thenReturn(Optional.of(exercise));
        when(exercises.findAllById(any())).thenReturn(List.of());
        lenient().when(exercises.findAllById(any())).thenReturn(List.of());

        var detail = service.getSystemExerciseDetail(null, null);

        assertThat(detail).isNotNull();
        assertThat(detail.guideSteps()).containsExactly("Do it", "Then stop");
    }

    @Test
    @DisplayName("findAll: co bai trong DB -> tra ve danh sach")
    void findAllReturnsExercises() {
        Exercise exercise = new Exercise();
        exercise.setCode("EX001");
        exercise.setName("Squat");
        exercise.setSource("SYSTEM");
        exercise.setActive(true);
        exercise.setUpdatedAt(java.time.LocalDateTime.now());
        when(exercises.findAll()).thenReturn(List.of(exercise));

        assertThat(service.findAll()).hasSize(1);
    }
}
