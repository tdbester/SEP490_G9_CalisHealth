package com.calishealth.service;

import com.calishealth.models.Exercise;
import com.calishealth.models.MuscleGroup;
import com.calishealth.repository.MuscleGroupRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Bo sung coverage cho cac alias chua duoc kiem tra cua {@link ExerciseMuscleGroupCatalog}. */
class ExerciseMuscleGroupCatalogExtraCoverageTest {
    private MuscleGroupRepository muscleGroups;
    private ExerciseMuscleGroupCatalog catalog;

    @BeforeEach
    void setUp() {
        muscleGroups = mock(MuscleGroupRepository.class);
        catalog = new ExerciseMuscleGroupCatalog(muscleGroups);
        when(muscleGroups.findByNameIgnoreCase(any())).thenAnswer(invocation -> {
            String name = invocation.getArgument(0);
            MuscleGroup group = new MuscleGroup();
            group.setId((long) name.hashCode());
            group.setName(name);
            return Optional.of(group);
        });
    }

    @Test
    @DisplayName("canonicalName: 'arms' -> Arms")
    void canonicalNameMapsArms() {
        catalog.validate("arms");

        verify(muscleGroups).findByNameIgnoreCase("Arms");
    }

    @Test
    @DisplayName("canonicalName: 'glutes' -> Glutes")
    void canonicalNameMapsGlutes() {
        catalog.validate("glutes");

        verify(muscleGroups).findByNameIgnoreCase("Glutes");
    }

    @Test
    @DisplayName("canonicalName: 'full body' -> Full body")
    void canonicalNameMapsFullBody() {
        catalog.validate("full body");

        verify(muscleGroups).findByNameIgnoreCase("Full body");
    }

    @Test
    @DisplayName("canonicalName: 'whole body' -> Full body")
    void canonicalNameMapsWholeBody() {
        catalog.validate("whole body");

        verify(muscleGroups).findByNameIgnoreCase("Full body");
    }

    @Test
    @DisplayName("canonicalName: 'lat' -> Back")
    void canonicalNameMapsLat() {
        catalog.validate("lat");

        verify(muscleGroups).findByNameIgnoreCase("Back");
    }

    @Test
    @DisplayName("canonicalName: 'pectoral' -> Chest")
    void canonicalNameMapsPectoral() {
        catalog.validate("pectoral");

        verify(muscleGroups).findByNameIgnoreCase("Chest");
    }

    @Test
    @DisplayName("resolve: danh sach chi chua dau phan cach -> nem 400")
    void onlySeparatorsIsRejected() {
        assertThatThrownBy(() -> catalog.validate(", ,"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("empty value");
    }

    @Test
    @DisplayName("assign: giu lien ket da co khi danh sach trung")
    void assignKeepsExistingLink() {
        Exercise exercise = new Exercise();
        MuscleGroup chest = new MuscleGroup();
        chest.setId(3L);
        chest.setName("Chest");
        when(muscleGroups.findByNameIgnoreCase("Chest")).thenReturn(Optional.of(chest));

        catalog.assign(exercise, "Chest, chest");

        assertThat(exercise.getMuscleGroups()).hasSize(1);
    }
}
