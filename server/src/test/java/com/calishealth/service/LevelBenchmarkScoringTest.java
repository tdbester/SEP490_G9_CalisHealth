package com.calishealth.service;

import com.calishealth.models.FitnessLevel;
import org.junit.jupiter.api.Test;

import java.util.List;

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
    void aThreePointAndAOnePointExerciseMakeTheResultUnbalanced() {
        assertThat(LevelBenchmarkService.isUnbalanced(List.of(3, 2, 1))).isTrue();
        assertThat(LevelBenchmarkService.isUnbalanced(List.of(3, 3, 1))).isTrue();
        assertThat(LevelBenchmarkService.isUnbalanced(List.of(1, 3))).isTrue();
        assertThat(LevelBenchmarkService.isUnbalanced(List.of(3, 2, 2))).isFalse();
        assertThat(LevelBenchmarkService.isUnbalanced(List.of(2, 1, 1))).isFalse();
        assertThat(LevelBenchmarkService.isUnbalanced(List.of(2, 2, 2))).isFalse();
        assertThat(LevelBenchmarkService.isUnbalanced(List.of(3))).isFalse();
        assertThat(LevelBenchmarkService.isUnbalanced(List.of())).isFalse();
    }

    @Test
    void zeroRepsOrSecondsIsACriticalFailure() {
        assertThat(LevelBenchmarkService.isCriticalFailure(0)).isTrue();
        assertThat(LevelBenchmarkService.isCriticalFailure(-1)).isTrue();
        assertThat(LevelBenchmarkService.isCriticalFailure(1)).isFalse();
        // It still scores the minimum 1 point; the level drop is applied on top of that.
        assertThat(LevelBenchmarkService.pointsFor(0, 19, 40)).isEqualTo(1);
    }

    @Test
    void thePenaltiesAddUp() {
        assertThat(LevelBenchmarkService.levelsToDrop(false, false)).isZero();
        assertThat(LevelBenchmarkService.levelsToDrop(true, false)).isEqualTo(1);
        assertThat(LevelBenchmarkService.levelsToDrop(false, true)).isEqualTo(1);
        assertThat(LevelBenchmarkService.levelsToDrop(true, true)).isEqualTo(2);
    }

    @Test
    void theLevelDropsByTheNumberOfPenaltiesButNeverBelowTheLowest() {
        FitnessLevel beginner = level("Beginner");
        FitnessLevel intermediate = level("Intermediate");
        FitnessLevel advanced = level("Advanced");
        FitnessLevel elite = level("Elite");
        List<FitnessLevel> active = List.of(beginner, intermediate, advanced, elite);

        assertThat(LevelBenchmarkService.levelsBelow(active, elite, 0)).isSameAs(elite);
        assertThat(LevelBenchmarkService.levelsBelow(active, elite, 1)).isSameAs(advanced);
        assertThat(LevelBenchmarkService.levelsBelow(active, elite, 2)).isSameAs(intermediate);
        assertThat(LevelBenchmarkService.levelsBelow(active, intermediate, 2)).isSameAs(beginner);
        assertThat(LevelBenchmarkService.levelsBelow(active, beginner, 2)).isSameAs(beginner);
        assertThat(LevelBenchmarkService.levelsBelow(List.of(), beginner, 2)).isSameAs(beginner);
    }

    private static FitnessLevel level(String name) {
        FitnessLevel level = new FitnessLevel();
        level.setName(name);
        return level;
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
