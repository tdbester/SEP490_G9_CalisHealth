package com.calishealth.models;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ExerciseModerationStatusTest {
    @Test
    void mapsAcceptedStatusToActiveModerationStatus() {
        Exercise exercise = new Exercise();

        exercise.setStatus(Exercise.EntryStatus.ACCEPTED);

        assertThat(exercise.getModerationStatus()).isEqualTo("ACTIVE");
        assertThat(exercise.getStatus()).isEqualTo("ACCEPTED");
    }

    @Test
    void mapsPendingAndRejectedModerationStatesToLegacyApiStatuses() {
        Exercise exercise = new Exercise();

        exercise.setModerationStatus("PENDING");
        assertThat(exercise.getStatus()).isEqualTo("PENDING");

        exercise.setModerationStatus("REJECTED");
        assertThat(exercise.getStatus()).isEqualTo("REJECTED");
    }
}
