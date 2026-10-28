package com.calishealth.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LevelBenchmarkScoringTest {
    @Test
    void eachExerciseThresholdIsInclusiveAtIntermediateBoundary() {
        assertThat(LevelBenchmarkService.pointsFor(19, 19, 40)).isEqualTo(1);
        assertThat(LevelBenchmarkService.pointsFor(20, 19, 40)).isEqualTo(2);
        assertThat(LevelBenchmarkService.pointsFor(40, 19, 40)).isEqualTo(2);
        assertThat(LevelBenchmarkService.pointsFor(41, 19, 40)).isEqualTo(3);

        assertThat(LevelBenchmarkService.pointsFor(29, 29, 60)).isEqualTo(1);
        assertThat(LevelBenchmarkService.pointsFor(30, 29, 60)).isEqualTo(2);
        assertThat(LevelBenchmarkService.pointsFor(60, 29, 60)).isEqualTo(2);
        assertThat(LevelBenchmarkService.pointsFor(61, 29, 60)).isEqualTo(3);

        assertThat(LevelBenchmarkService.pointsFor(44, 44, 90)).isEqualTo(1);
        assertThat(LevelBenchmarkService.pointsFor(45, 44, 90)).isEqualTo(2);
        assertThat(LevelBenchmarkService.pointsFor(90, 44, 90)).isEqualTo(2);
        assertThat(LevelBenchmarkService.pointsFor(91, 44, 90)).isEqualTo(3);
    }

    @Test
    void totalScoreMapsToConfiguredLevelBands() {
        assertThat(LevelBenchmarkService.levelForTotalScore(3)).isEqualTo("Beginner");
        assertThat(LevelBenchmarkService.levelForTotalScore(4)).isEqualTo("Beginner");
        assertThat(LevelBenchmarkService.levelForTotalScore(5)).isEqualTo("Intermediate");
        assertThat(LevelBenchmarkService.levelForTotalScore(7)).isEqualTo("Intermediate");
        assertThat(LevelBenchmarkService.levelForTotalScore(8)).isEqualTo("Advanced");
        assertThat(LevelBenchmarkService.levelForTotalScore(9)).isEqualTo("Advanced");
        assertThatThrownBy(() -> LevelBenchmarkService.levelForTotalScore(10))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
