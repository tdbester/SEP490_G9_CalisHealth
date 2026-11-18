package com.calishealth.service;

import com.calishealth.dtos.SystemExerciseDetailResponseDTO;
import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.models.Exercise;
import com.calishealth.models.ProgressionRule;
import com.calishealth.repository.ExerciseModerationHistoryRepository;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.FitnessLevelRepository;
import com.calishealth.repository.ProgressionRuleRepository;
import com.calishealth.repository.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SystemExerciseDetailTest {
    private ExerciseRepository exerciseRepository;
    private ProgressionRuleRepository progressionRules;
    private ExerciseService exerciseService;

    @BeforeEach
    void setUp() {
        exerciseRepository = mock(ExerciseRepository.class);
        progressionRules = mock(ProgressionRuleRepository.class);
        exerciseService = new ExerciseService(
                exerciseRepository,
                mock(ExerciseModerationHistoryRepository.class),
                mock(UserRepository.class),
                mock(JdbcTemplate.class),
                mock(MediaRegistryService.class),
                progressionRules,
                mock(FitnessLevelRepository.class),
                mock(ExerciseMuscleGroupCatalog.class),
                mock(SystemNotificationService.class),
                mock(ExercisePhysiologyService.class),
                mock(ContentNameGuardService.class),
                mock(ExerciseUnlockService.class));
    }

    /**
     * Bài nằm trong cây tiến trình khi có progression rule liên quan.
     * V83 bỏ bảng `exercise_tree_edges` + cột `exercises.exercise_tree_id`, nên cây
     * bài tập giờ lấy từ `progression_rules` (nguồn duy nhất).
     */
    private ProgressionRule rule(Long exerciseId, Long prerequisiteId, String prerequisiteName) {
        Exercise prerequisite = new Exercise();
        prerequisite.setId(prerequisiteId);
        prerequisite.setName(prerequisiteName);
        ProgressionRule rule = new ProgressionRule();
        rule.setExercise(new Exercise());
        rule.getExercise().setId(exerciseId);
        rule.setPrerequisiteExercise(prerequisite);
        return rule;
    }

    @Test
    void mapsAcceptedSystemExerciseDetails() {
        Exercise exercise = new Exercise();
        exercise.setId(17L);
        exercise.setName("Wall handstand hold");
        exercise.setDescription("Build balance and shoulder strength.");
        exercise.setDemoVideoUrl("/media/exercise-demos/handstand.mp4");
        exercise.setGuide("Place hands on the floor.\nKick up against the wall.\nPush tall through the shoulders.\nBrace the core and hold.");
        exercise.setMuscleGroup("Shoulders, core");
        exercise.setLevel("Beginner");
        exercise.setDefaultSets(3);
        exercise.setDefaultDuration(30);
        exercise.setEquipment("Wall");
        exercise.setType(Exercise.EntryType.SKILL);
        exercise.setTargetSkill(Exercise.EntryTargetSkill.HANDSTAND);
        exercise.setMovementGroup(Exercise.MovementGroup.PUSH);
        when(exerciseRepository.findAcceptedByIdAndSource(17L, "SYSTEM")).thenReturn(Optional.of(exercise));
        when(progressionRules.findAllByExercise_IdOrPrerequisiteExercise_Id(17L, 17L))
                .thenReturn(List.of(rule(17L, 12L, "Incline Push-up")));
        when(exerciseRepository.findAllById(List.of(12L))).thenReturn(List.of(prerequisite(12L, "Incline Push-up")));

        SystemExerciseDetailResponseDTO result = exerciseService.getSystemExerciseDetail(17L);

        assertThat(result.id()).isEqualTo(17L);
        assertThat(result.title()).isEqualTo("Wall handstand hold");
        assertThat(result.videoUrl()).isEqualTo("/media/exercise-demos/handstand.mp4");
        assertThat(result.guideSteps()).containsExactly(
                "Place hands on the floor.",
                "Kick up against the wall.",
                "Push tall through the shoulders.",
                "Brace the core and hold.");
        assertThat(result.level()).isEqualTo("Beginner");
        assertThat(result.defaultSets()).isEqualTo(3);
        assertThat(result.defaultDuration()).isEqualTo(30);
        assertThat(result.targetSkill()).isEqualTo("HANDSTAND");
        assertThat(result.previousExercises()).containsExactly("Incline Push-up");
        assertThat(result.hasExerciseTree()).isTrue();
    }

    @Test
    void throwsNotFoundWhenNoAcceptedSystemExerciseExists() {
        when(exerciseRepository.findAcceptedByIdAndSource(17L, "SYSTEM")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> exerciseService.getSystemExerciseDetail(17L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("System exercise not found");
    }

    @Test
    void expandsLegacySingleParagraphGuideIntoFourExerciseSpecificSteps() {
        Exercise exercise = new Exercise();
        exercise.setId(18L);
        exercise.setName("Plank");
        exercise.setMuscleGroup("Core");
        exercise.setGuide("Keep your forearms grounded and avoid letting your hips sag.");
        when(exerciseRepository.findAcceptedByIdAndSource(18L, "SYSTEM")).thenReturn(Optional.of(exercise));

        var result = exerciseService.getSystemExerciseDetail(18L);

        assertThat(result.guideSteps()).hasSize(4);
        assertThat(result.guideSteps().get(0)).contains("Plank");
        assertThat(result.guideSteps().get(1)).contains("Core");
        assertThat(result.guideSteps().get(2)).contains("hips sag");
    }

    @Test
    void mapsBenchDipsToItsPushExerciseTreeNode() {
        Exercise exercise = new Exercise();
        exercise.setId(118L);
        exercise.setName("Bench Dips");
        exercise.setMuscleGroup("Arm/Shoulders");
        exercise.setMovementGroup(Exercise.MovementGroup.PUSH);
        when(exerciseRepository.findAcceptedByIdAndSource(118L, "SYSTEM")).thenReturn(Optional.of(exercise));
        when(progressionRules.findAllByExercise_IdOrPrerequisiteExercise_Id(118L, 118L))
                .thenReturn(List.of(rule(118L, 119L, "Push-up")));
        when(exerciseRepository.findAllById(List.of(119L))).thenReturn(List.of(prerequisite(119L, "Push-up")));

        var result = exerciseService.getSystemExerciseDetail(118L);

        assertThat(result.movementGroup()).isEqualTo("PUSH");
        assertThat(result.previousExercises()).containsExactly("Push-up");
        assertThat(result.hasExerciseTree()).isTrue();
    }

    private Exercise prerequisite(Long id, String name) {
        Exercise exercise = new Exercise();
        exercise.setId(id);
        exercise.setName(name);
        return exercise;
    }
}
