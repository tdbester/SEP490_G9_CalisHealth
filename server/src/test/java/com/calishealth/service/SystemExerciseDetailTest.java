package com.calishealth.service;

import com.calishealth.dtos.SystemExerciseDetailResponseDTO;
import com.calishealth.exception.ResourceNotFoundException;
import com.calishealth.models.Exercise;
import com.calishealth.repository.ExerciseModerationHistoryRepository;
import com.calishealth.repository.ExerciseRepository;
import com.calishealth.repository.ExerciseTreeEdgeRepository;
import com.calishealth.repository.MuscleGroupRepository;
import com.calishealth.repository.UserRepository;
import com.calishealth.service.ExerciseVideoStorageService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SystemExerciseDetailTest {
    private ExerciseRepository exerciseRepository;
    private ExerciseService exerciseService;

    @BeforeEach
    void setUp() {
        exerciseRepository = mock(ExerciseRepository.class);
        exerciseService = new ExerciseService(
                exerciseRepository,
                mock(ExerciseModerationHistoryRepository.class),
                mock(MuscleGroupRepository.class),
                mock(UserRepository.class),
                mock(JdbcTemplate.class),
                mock(ExerciseVideoStorageService.class),
                mock(ExerciseTreeEdgeRepository.class));
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
        exercise.setLevel(Exercise.EntryLevel.BEGINNER);
        exercise.setDefaultSets(3);
        exercise.setDefaultDuration(30);
        exercise.setEquipment("Wall");
        exercise.setType(Exercise.EntryType.SKILL);
        exercise.setTargetSkill(Exercise.EntryTargetSkill.HANDSTAND);
        exercise.setMovementGroup(Exercise.MovementGroup.PUSH);
        exercise.setExerciseTreeId(12L);
        when(exerciseRepository.findByIdAndSystemTrueAndStatus(
                17L, Exercise.EntryStatus.ACCEPTED.name())).thenReturn(Optional.of(exercise));

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
        assertThat(result.exerciseTreeId()).isEqualTo(12L);
        assertThat(result.hasExerciseTree()).isTrue();
    }

    @Test
    void throwsNotFoundWhenNoAcceptedSystemExerciseExists() {
        when(exerciseRepository.findByIdAndSystemTrueAndStatus(
                17L, Exercise.EntryStatus.ACCEPTED.name())).thenReturn(Optional.empty());

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
        when(exerciseRepository.findByIdAndSystemTrueAndStatus(
                18L, Exercise.EntryStatus.ACCEPTED.name())).thenReturn(Optional.of(exercise));

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
        exercise.setTreeLevel(1);
        exercise.setExerciseTreeId(118L);
        when(exerciseRepository.findByIdAndSystemTrueAndStatus(
                118L, Exercise.EntryStatus.ACCEPTED.name())).thenReturn(Optional.of(exercise));

        var result = exerciseService.getSystemExerciseDetail(118L);

        assertThat(result.movementGroup()).isEqualTo("PUSH");
        assertThat(result.exerciseTreeId()).isEqualTo(118L);
        assertThat(result.hasExerciseTree()).isTrue();
    }
}
