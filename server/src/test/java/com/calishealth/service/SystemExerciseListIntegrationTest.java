package com.calishealth.service;

import com.calishealth.dtos.ExerciseFilterRequestDTO;
import com.calishealth.dtos.ExerciseFilterRequestDTO.ExerciseType;
import com.calishealth.dtos.ExerciseFilterRequestDTO.TargetSkill;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class SystemExerciseListIntegrationTest {
    @Autowired
    private ExerciseService exerciseService;

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
