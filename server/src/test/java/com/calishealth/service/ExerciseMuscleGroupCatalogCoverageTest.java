package com.calishealth.service;

import com.calishealth.models.Exercise;
import com.calishealth.models.ExerciseMuscleGroup;
import com.calishealth.models.MuscleGroup;
import com.calishealth.repository.MuscleGroupRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Bộ test bổ sung cho {@link ExerciseMuscleGroupCatalog}: alias tên nhóm cơ, gán link và
 * các nhánh validate lỗi.
 */
class ExerciseMuscleGroupCatalogCoverageTest {

    private MuscleGroupRepository muscleGroups;
    private ExerciseMuscleGroupCatalog catalog;

    @BeforeEach
    void setUp() {
        muscleGroups = mock(MuscleGroupRepository.class);
        catalog = new ExerciseMuscleGroupCatalog(muscleGroups);
        when(muscleGroups.findByNameIgnoreCase(any())).thenAnswer(invocation -> {
            String name = invocation.getArgument(0);
            return Optional.of(group((long) name.hashCode(), name));
        });
    }

    private MuscleGroup group(Long id, String name) {
        MuscleGroup group = new MuscleGroup();
        group.setId(id);
        group.setName(name);
        return group;
    }

    @Test
    @DisplayName("validate: labels hop le -> khong nem loi")
    void validateAcceptsKnownGroups() {
        catalog.validate("Chest, Back");

        assertThat(muscleGroups.findByNameIgnoreCase("Chest")).isPresent();
    }

    @Test
    @DisplayName("validate: labels rong -> nem 400")
    void validateRejectsBlankLabels() {
        assertThatThrownBy(() -> catalog.validate("  "))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Select at least one existing muscle group");
    }

    @Test
    @DisplayName("validate: labels null -> nem 400")
    void validateRejectsNullLabels() {
        assertThatThrownBy(() -> catalog.validate(null))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    @DisplayName("resolve: gia tri rong trong danh sach -> nem 400")
    void emptyTokenIsRejected() {
        assertThatThrownBy(() -> catalog.validate("Chest,,Back"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("empty value");
    }

    @Test
    @DisplayName("resolve: nhom la -> nem 400")
    void unknownGroupIsRejected() {
        when(muscleGroups.findByNameIgnoreCase("Nowhere")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> catalog.validate("Nowhere"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Unknown muscle group: Nowhere");
    }

    @Test
    @DisplayName("assign: giai quyet tach 1 nhom")
    void assignResolvesSingleGroup() {
        Exercise exercise = new Exercise();

        catalog.assign(exercise, "Chest");

        assertThat(exercise.getMuscleGroups()).hasSize(1);
        assertThat(exercise.getMuscleGroups().get(0).getMuscleGroup().getName()).isEqualTo("Chest");
    }

    @Test
    @DisplayName("assign: bo link cu khong con phu hop")
    void assignRemovesStaleLinks() {
        Exercise exercise = new Exercise();
        MuscleGroup legs = group(9L, "Legs");
        ExerciseMuscleGroup stale = new ExerciseMuscleGroup();
        stale.setMuscleGroup(legs);
        exercise.getMuscleGroups().add(stale);

        catalog.assign(exercise, "Chest");

        assertThat(exercise.getMuscleGroups())
                .extracting(link -> link.getMuscleGroup().getName())
                .containsExactly("Chest");
    }

    @Test
    @DisplayName("assign: bo link co nhom co null")
    void assignRemovesLinksWithoutMuscleGroup() {
        Exercise exercise = new Exercise();
        exercise.getMuscleGroups().add(new ExerciseMuscleGroup());

        catalog.assign(exercise, "Back");

        assertThat(exercise.getMuscleGroups())
                .extracting(link -> link.getMuscleGroup().getName())
                .containsExactly("Back");
    }

    @Test
    @DisplayName("assign: khong tao link trung cho nhom da gan")
    void assignDoesNotDuplicateExistingLinks() {
        Exercise exercise = new Exercise();
        MuscleGroup chest = group(3L, "Chest");
        ExerciseMuscleGroup existing = new ExerciseMuscleGroup();
        existing.setMuscleGroup(chest);
        exercise.getMuscleGroups().add(existing);
        when(muscleGroups.findByNameIgnoreCase("Chest")).thenReturn(Optional.of(chest));

        catalog.assign(exercise, "Chest");

        assertThat(exercise.getMuscleGroups()).hasSize(1);
    }

    @Test
    @DisplayName("assign: tach nhieu nhom theo nhieu dau phan cach")
    void assignSupportsMultipleSeparators() {
        Exercise exercise = new Exercise();

        catalog.assign(exercise, "Chest, Back; Core and Legs");

        assertThat(exercise.getMuscleGroups()).hasSize(4);
    }

    @Test
    @DisplayName("canonicalName: chuan hoa cac alias")
    void canonicalNameNormalizesAliases() {
        for (String alias : List.of("arm", "triceps", "biceps", "forearm", "forearms")) {
            catalog.validate(alias);
            org.mockito.Mockito.verify(muscleGroups).findByNameIgnoreCase("Arms");
            org.mockito.Mockito.clearInvocations(muscleGroups);
        }
    }

    @Test
    @DisplayName("canonicalName: chuan hoa lat/lats -> Back")
    void canonicalNameMapsLats() {
        catalog.validate("lats");

        org.mockito.Mockito.verify(muscleGroups).findByNameIgnoreCase("Back");
    }

    @Test
    @DisplayName("canonicalName: chuan hoa leg/quads -> Legs")
    void canonicalNameMapsLegs() {
        catalog.validate("quadriceps");

        org.mockito.Mockito.verify(muscleGroups).findByNameIgnoreCase("Legs");
    }

    @Test
    @DisplayName("canonicalName: chuan hoa glute -> Glutes")
    void canonicalNameMapsGlute() {
        catalog.validate("glute");

        org.mockito.Mockito.verify(muscleGroups).findByNameIgnoreCase("Glutes");
    }

    @Test
    @DisplayName("canonicalName: chuan hoa pecs -> Chest")
    void canonicalNameMapsPecs() {
        catalog.validate("pecs");

        org.mockito.Mockito.verify(muscleGroups).findByNameIgnoreCase("Chest");
    }

    @Test
    @DisplayName("canonicalName: chuan hoa abs -> Core")
    void canonicalNameMapsAbs() {
        catalog.validate("abs");

        org.mockito.Mockito.verify(muscleGroups).findByNameIgnoreCase("Core");
    }

    @Test
    @DisplayName("canonicalName: chuan hoa full-body -> Full body")
    void canonicalNameMapsFullBody() {
        catalog.validate("full-body");

        org.mockito.Mockito.verify(muscleGroups).findByNameIgnoreCase("Full body");
    }

    @Test
    @DisplayName("canonicalName: chuan hoa shoulders -> Shoulders")
    void canonicalNameMapsShoulders() {
        catalog.validate("shoulders");

        org.mockito.Mockito.verify(muscleGroups).findByNameIgnoreCase("Shoulders");
    }

    @Test
    @DisplayName("canonicalName: ten chua biet -> giu nguyen")
    void canonicalNameKeepsUnknownNames() {
        catalog.validate("Obliques");

        org.mockito.Mockito.verify(muscleGroups).findByNameIgnoreCase("Obliques");
    }

    @Test
    @DisplayName("resolve: token trung -> chi gan mot lan")
    void duplicateTokensAreDeduplicated() {
        Exercise exercise = new Exercise();

        catalog.assign(exercise, "Chest, chest, CHEST");

        assertThat(exercise.getMuscleGroups()).hasSize(1);
    }
}
