package com.calishealth.models;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ExerciseDescriptionCompatibilityTest {
    @Test
    void descriptionAccessorsUseCanonicalInstructionsField() {
        Exercise exercise = new Exercise();

        exercise.setDescription("Exercise instructions");

        assertThat(exercise.getInstructions()).isEqualTo("Exercise instructions");
        assertThat(exercise.getDescription()).isEqualTo("Exercise instructions");

        exercise.setInstructions("Updated instructions");

        assertThat(exercise.getDescription()).isEqualTo("Updated instructions");
    }
}
