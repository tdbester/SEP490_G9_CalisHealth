package com.calishealth.service;

import com.calishealth.dtos.ProgressionRuleDtos.SetResultInput;
import com.calishealth.service.ProgressionRuleService.Outcome;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ProgressionRuleEvaluationTest {
    private static SetResultInput reps(int total, int clean) {
        return new SetResultInput(total, clean, 0, 0);
    }

    private static SetResultInput hold(int total, int clean) {
        return new SetResultInput(0, 0, total, clean);
    }

    @Test
    void everySetMustReachTheRequiredRepsNotJustTheTotal() {
        // 4 sets x 12 reps required: one set of 48 clean reps must not pass.
        Outcome single = ProgressionRuleService.evaluate("REPS", 4, 12, null, new BigDecimal("80"), List.of(reps(48, 48)));
        assertThat(single.passed()).isFalse();
        assertThat(single.qualifyingSets()).isEqualTo(1);

        Outcome full = ProgressionRuleService.evaluate("REPS", 4, 12, null, new BigDecimal("80"),
                List.of(reps(12, 12), reps(12, 12), reps(13, 12), reps(12, 12)));
        assertThat(full.passed()).isTrue();
        assertThat(full.qualifyingSets()).isEqualTo(4);
    }

    @Test
    void cleanRateIsRecomputedFromCountsAndComparedToTheThreshold() {
        List<SetResultInput> sets = List.of(reps(10, 8), reps(10, 7)); // 15/20 = 75%
        assertThat(ProgressionRuleService.rate("REPS", sets)).isEqualByComparingTo("75");
        assertThat(ProgressionRuleService.evaluate("REPS", 2, 7, null, new BigDecimal("80"), sets).passed()).isFalse();
        assertThat(ProgressionRuleService.evaluate("REPS", 2, 7, null, new BigDecimal("75"), sets).passed()).isTrue();
    }

    @Test
    void holdExercisesAreMeasuredInSecondsPerSet() {
        List<SetResultInput> sets = List.of(hold(40, 36), hold(35, 30)); // 66/75 = 88%
        assertThat(ProgressionRuleService.evaluate("HOLD", 2, null, 30, new BigDecimal("80"), sets).passed()).isTrue();
        assertThat(ProgressionRuleService.evaluate("HOLD", 2, null, 38, new BigDecimal("80"), sets).passed()).isFalse();
    }

    @Test
    void noSamplesMeansNotJudgedRatherThanPassOrFail() {
        assertThat(ProgressionRuleService.rate("REPS", List.of(reps(0, 0)))).isNull();
        Outcome outcome = ProgressionRuleService.evaluate("REPS", 1, 5, null, new BigDecimal("80"), List.of(reps(0, 0)));
        assertThat(outcome.passed()).isFalse();
        assertThat(outcome.cleanRate()).isNull();
    }
}
