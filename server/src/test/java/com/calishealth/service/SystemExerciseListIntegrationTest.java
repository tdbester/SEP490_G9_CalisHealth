package com.calishealth.service;

import com.calishealth.dtos.ExerciseFilterRequestDTO;
import com.calishealth.dtos.ExerciseFilterRequestDTO.ExerciseType;
import com.calishealth.dtos.ExerciseFilterRequestDTO.TargetSkill;
import com.calishealth.models.Exercise;
import com.calishealth.repository.ExerciseRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.HashSet;
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class SystemExerciseListIntegrationTest {
    @Autowired
    private ExerciseService exerciseService;

    @Autowired
    private ExerciseRepository exerciseRepository;

    @Test
    void exerciseCatalogUsesCanonicalTypesSourcesAndCountingCategories() {
        var exercises = exerciseRepository.findAll();

        assertThat(exercises).isNotEmpty().allSatisfy(exercise -> {
            assertThat(exercise.getType()).isIn("HEALTH", "SKILL");
            assertThat(exercise.getSource()).isIn("SYSTEM", "CUSTOM");
            assertThat(exercise.getCategory()).isIn("REPS", "HOLD");
            assertThat(exercise.getCode()).matches(
                    ("SYSTEM".equals(exercise.getSource()) ? "EX_" : "CU_") + exercise.getId());
        });

        var systemExerciseKeys = exercises.stream()
                .filter(Exercise::isSystem)
                .map(exercise -> exercise.getName().trim().toLowerCase(Locale.ROOT)
                        + "|" + exercise.getType().toUpperCase(Locale.ROOT))
                .toList();
        assertThat(new HashSet<>(systemExerciseKeys)).hasSameSizeAs(systemExerciseKeys);
    }

    @Test
    void filtersAndPaginatesAcceptedSystemSkillExercises() {
        ExerciseFilterRequestDTO filter = new ExerciseFilterRequestDTO();
        filter.setType(ExerciseType.SKILL);
        filter.setTargetSkill(TargetSkill.HANDSTAND);
        filter.setPage(0);
        filter.setSize(1);

        var page = exerciseService.getSystemExercises(filter);

        assertThat(page.content()).hasSize(1);
        assertThat(page.content().get(0).type()).isEqualTo(ExerciseType.SKILL);
        assertThat(page.content().get(0).targetSkill()).isEqualTo(TargetSkill.HANDSTAND);
        assertThat(page.totalElements()).isGreaterThanOrEqualTo(1);
        assertThat(page.pageSize()).isEqualTo(1);
    }

    @Test
    void searchesSystemExercisesByNameOrMuscleGroup() {
        ExerciseFilterRequestDTO filter = new ExerciseFilterRequestDTO();
        filter.setType(ExerciseType.HEALTH);
        filter.setSearch("chest");

        var page = exerciseService.getSystemExercises(filter);

        assertThat(page.content()).isNotEmpty();
        assertThat(page.content()).allMatch(exercise ->
                exercise.targetMuscle().toLowerCase().contains("chest"));
    }
}
