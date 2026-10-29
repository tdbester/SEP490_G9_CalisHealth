package com.calishealth.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LevelBenchmarkScoringTest {
    @Test
    void eachExerciseThresholdIsInclusiveAtIntermediateBoundary() {
        assertThat(LevelBenchmarkService.pointsFor(19, 19, 40)).isEqualTo(1);
        assertThat(LevelBenchmarkService.pointsFor(20, 19, 40)).isEqualTo(2);
        assertThat(LevelBenchmarkService.pointsFor(40, 19, 40)).isEqualTo(2);
        assertThat(LevelBenchmarkService.pointsFor(41, 19, 40)).isEqualTo(3);

        assertThat(LevelBenchmarkService.pointsFor(44, 44, 90)).isEqualTo(1);
        assertThat(LevelBenchmarkService.pointsFor(45, 44, 90)).isEqualTo(2);
        assertThat(LevelBenchmarkService.pointsFor(90, 44, 90)).isEqualTo(2);
        assertThat(LevelBenchmarkService.pointsFor(91, 44, 90)).isEqualTo(3);
    }

    @Test
    void scoreRangeFollowsTheNumberOfExercises() {
        // Each exercise is worth 1-3 points, so N exercises span N..3N.
        assertThat(LevelBenchmarkService.scoreFloor(3)).isEqualTo(3);
        assertThat(LevelBenchmarkService.scoreCeiling(3)).isEqualTo(9);
        assertThat(LevelBenchmarkService.scoreFloor(4)).isEqualTo(4);
        assertThat(LevelBenchmarkService.scoreCeiling(4)).isEqualTo(12);
        assertThat(LevelBenchmarkService.scoreFloor(1)).isEqualTo(1);
        assertThat(LevelBenchmarkService.scoreCeiling(1)).isEqualTo(3);
    }
}
