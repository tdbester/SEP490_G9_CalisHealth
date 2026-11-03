package com.calishealth.service;

import com.calishealth.models.Exercise;
import com.calishealth.models.MuscleGroup;
import com.calishealth.repository.MuscleGroupRepository;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ExerciseMuscleGroupCatalogTest {
    private final MuscleGroupRepository muscleGroups = mock(MuscleGroupRepository.class);
    private final ExerciseMuscleGroupCatalog catalog = new ExerciseMuscleGroupCatalog(muscleGroups);

    @Test
    void mapsCombinedLabelsToExistingCatalogGroups() {
        MuscleGroup arms = group(1L, "Arms");
        MuscleGroup shoulders = group(2L, "Shoulders");
        when(muscleGroups.findByNameIgnoreCase("Arms")).thenReturn(Optional.of(arms));
        when(muscleGroups.findByNameIgnoreCase("Shoulders")).thenReturn(Optional.of(shoulders));

        Exercise exercise = new Exercise();
        catalog.assign(exercise, "Arm/Shoulders");

        assertThat(exercise.getMuscleGroups())
                .extracting(link -> link.getMuscleGroup().getName())
                .containsExactly("Arms", "Shoulders");
        assertThat(exercise.getMuscleGroup()).isEqualTo("Arms, Shoulders");
        verify(muscleGroups, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void mapsAliasesAndDeduplicatesGroups() {
        MuscleGroup arms = group(1L, "Arms");
        MuscleGroup chest = group(2L, "Chest");
        when(muscleGroups.findByNameIgnoreCase("Arms")).thenReturn(Optional.of(arms));
        when(muscleGroups.findByNameIgnoreCase("Chest")).thenReturn(Optional.of(chest));

        catalog.assign(new Exercise(), "Chest, triceps, biceps");

        verify(muscleGroups).findByNameIgnoreCase("Chest");
        verify(muscleGroups).findByNameIgnoreCase("Arms");
    }

    @Test
    void rejectsMuscleGroupsOutsideTheExistingCatalog() {
        when(muscleGroups.findByNameIgnoreCase("New Group")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> catalog.validate("New Group"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Unknown muscle group: New Group");
        verify(muscleGroups, never()).save(org.mockito.ArgumentMatchers.any());
    }

    private MuscleGroup group(Long id, String name) {
        MuscleGroup group = new MuscleGroup();
        group.setId(id);
        group.setName(name);
        return group;
    }
}
