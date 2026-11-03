package com.calishealth.service.survey.level;

import com.calishealth.dtos.SurveyDtos.PlanResponse;
import com.calishealth.dtos.SurveyDtos.ResultConfig;
import com.calishealth.models.LevelRuleSet.ScoringMethod;
import com.calishealth.service.survey.SurveyFixtures;
import com.calishealth.service.survey.condition.ConditionParser;
import com.calishealth.service.survey.definition.SurveyDefinition;
import com.calishealth.service.survey.level.LevelRuleEvaluator.Evaluation;
import com.calishealth.service.survey.level.LevelRuleSetDefinition.Band;
import com.calishealth.service.survey.level.LevelRuleSetDefinition.Criterion;
import com.calishealth.service.survey.level.LevelRuleSetDefinition.LevelRef;
import com.calishealth.service.survey.level.LevelRuleSetDefinition.Outcome;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.calishealth.service.survey.SurveyFixtures.json;
import static com.calishealth.service.survey.SurveyFixtures.link;
import static com.calishealth.service.survey.SurveyFixtures.question;
import static com.calishealth.service.survey.SurveyFixtures.step;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bộ luật trong test dựng đúng như dữ liệu seed (bảng chuẩn push-up / plank / squat cho người trưởng thành):
 * mỗi bài 1 điểm (Beginner) .. 3 điểm (Advanced, đã gộp Elite), plank dưới 30 giây 0.5 điểm, mốc level 0 / 1.5 / 2.5.
 */
class LevelRuleEvaluatorTest {
    private static final LevelRef BEGINNER = new LevelRef(1L, "Beginner");
    private static final LevelRef INTERMEDIATE = new LevelRef(2L, "Intermediate");
    private static final LevelRef ADVANCED = new LevelRef(3L, "Advanced");

    private static LevelRuleSetDefinition rules(ScoringMethod method, Criterion... criteria) {
        return new LevelRuleSetDefinition(1L, "ONBOARDING_LEVEL", "Onboarding level", 1, method, List.of(criteria),
                List.of(outcome(BEGINNER, "0", 1), outcome(ADVANCED, "2.5", 3),
                        outcome(INTERMEDIATE, "1.5", 2)));
    }

    private static LevelRuleSetDefinition standardRules() {
        return rules(ScoringMethod.WEIGHTED_AVERAGE, pushUp(), squat(), plank());
    }

    private static Criterion pushUp() {
        return criterion("PUSH_UP", "PUSH_UP_MAX_REPS", "1", true,
                band(null, "18", "1", BEGINNER), band("18", "41", "2", INTERMEDIATE),
                band("41", null, "3", ADVANCED));
    }

    private static Criterion squat() {
        return criterion("SQUAT", "SQUAT_MAX_REPS", "1", true,
                band(null, "21", "1", BEGINNER), band("21", "55", "2", INTERMEDIATE),
                band("55", null, "3", ADVANCED));
    }

    private static Criterion plank() {
        return criterion("PLANK", "PLANK_MAX_SECONDS", "1", true,
                labelled(null, "30", "0.5", BEGINNER, "Limited"), band("30", "60", "1", BEGINNER),
                band("60", "120", "2", INTERMEDIATE), band("120", null, "3", ADVANCED));
    }

    private static Criterion criterion(String code, String questionCode, String weight, boolean required, Band... bands) {
        return new Criterion(code, code, questionCode, new BigDecimal(weight), required, List.of(bands));
    }

    private static Band band(String min, String max, String score, LevelRef level) {
        return labelled(min, max, score, level, null);
    }

    private static Band labelled(String min, String max, String score, LevelRef level, String label) {
        return new Band(min == null ? null : new BigDecimal(min), max == null ? null : new BigDecimal(max),
                new BigDecimal(score), level, label, null, null);
    }

    private static Outcome outcome(LevelRef level, String minScore, int rank) {
        return new Outcome(level, new BigDecimal(minScore), rank, level.name() + " summary",
                json("{\"planName\":\"" + level.name() + " plan\",\"sessions\":[{\"name\":\"Full body A\","
                        + "\"exercises\":[{\"name\":\"Push-up\",\"detail\":\"3 sets\"}]},{\"name\":\"Full body B\"}]}"));
    }

    private static Map<String, JsonNode> answers(Object... pairs) {
        Map<String, JsonNode> answers = new HashMap<>();
        for (int i = 0; i < pairs.length; i += 2) {
            answers.put((String) pairs[i], json(String.valueOf(pairs[i + 1])));
        }
        return answers;
    }

    private static Map<String, JsonNode> tests(int pushUps, int squats, int plankSeconds) {
        return answers("PUSH_UP_MAX_REPS", pushUps, "SQUAT_MAX_REPS", squats, "PLANK_MAX_SECONDS", plankSeconds);
    }

    @Test
    void figmaSampleResultsAreBeginner() {
        Evaluation evaluation = LevelRuleEvaluator.evaluate(standardRules(), tests(8, 20, 35));

        assertThat(evaluation.failureReason()).isNull();
        assertThat(evaluation.totalScore()).isEqualByComparingTo("1");
        assertThat(evaluation.outcome().level()).isEqualTo(BEGINNER);
    }

    @Test
    void weightedAverageDecidesTheOverallLevel() {
        // push-up 45 (3) + squat 30 (2) + plank 90s (2) = 7/3 = 2.333 -> Intermediate
        Evaluation mixed = LevelRuleEvaluator.evaluate(standardRules(), tests(45, 30, 90));
        assertThat(mixed.totalScore()).isEqualByComparingTo("2.333");
        assertThat(mixed.outcome().level()).isEqualTo(INTERMEDIATE);

        assertThat(LevelRuleEvaluator.evaluate(standardRules(), tests(50, 60, 150)).outcome().level()).isEqualTo(ADVANCED);
        assertThat(LevelRuleEvaluator.evaluate(standardRules(), tests(80, 120, 300)).outcome().level()).isEqualTo(ADVANCED);
    }

    @Test
    void bandsIncludeTheirLowerBoundAndExcludeTheUpperBound() {
        Evaluation atBoundary = LevelRuleEvaluator.evaluate(standardRules(), tests(18, 21, 60));
        assertThat(atBoundary.criteria()).allSatisfy(score -> assertThat(score.band().level()).isEqualTo(INTERMEDIATE));

        Evaluation belowBoundary = LevelRuleEvaluator.evaluate(standardRules(), tests(17, 20, 59));
        assertThat(belowBoundary.criteria()).allSatisfy(score -> assertThat(score.band().level()).isEqualTo(BEGINNER));
    }

    @Test
    void weakPlankIsLabelledLimitedAndPullsTheScoreDown() {
        Evaluation evaluation = LevelRuleEvaluator.evaluate(standardRules(), tests(20, 25, 10));

        assertThat(evaluation.criteria().get(2).band().displayLabel()).isEqualTo("Limited");
        assertThat(evaluation.criteria().get(2).band().level()).isEqualTo(BEGINNER);
        // (2 + 2 + 0.5) / 3 = 1.5 -> vừa chạm mốc Intermediate
        assertThat(evaluation.totalScore()).isEqualByComparingTo("1.5");
        assertThat(evaluation.outcome().level()).isEqualTo(INTERMEDIATE);
    }

    @Test
    void weightsChangeTheBalanceBetweenCriteria() {
        LevelRuleSetDefinition pushUpHeavy = rules(ScoringMethod.WEIGHTED_AVERAGE,
                criterion("PUSH_UP", "PUSH_UP_MAX_REPS", "3", true, pushUp().bands().toArray(Band[]::new)),
                squat(), plank());

        // (3 × 3 + 2 + 2) / 5 = 2.6 -> Advanced; cùng số liệu với trọng số bằng nhau (7/3 = 2.333) chỉ là Intermediate
        assertThat(LevelRuleEvaluator.evaluate(pushUpHeavy, tests(50, 25, 70)).outcome().level()).isEqualTo(ADVANCED);
        assertThat(LevelRuleEvaluator.evaluate(standardRules(), tests(50, 25, 70)).outcome().level()).isEqualTo(INTERMEDIATE);
    }

    @Test
    void minimumMethodIsLimitedByTheWeakestCriterion() {
        LevelRuleSetDefinition weakestLink = rules(ScoringMethod.MINIMUM, pushUp(), squat(), plank());

        Evaluation evaluation = LevelRuleEvaluator.evaluate(weakestLink, tests(70, 100, 45));
        assertThat(evaluation.totalScore()).isEqualByComparingTo("1");
        assertThat(evaluation.outcome().level()).isEqualTo(BEGINNER);
    }

    @Test
    void missingRequiredAnswerCannotBeScored() {
        Evaluation evaluation = LevelRuleEvaluator.evaluate(standardRules(),
                answers("PUSH_UP_MAX_REPS", 20, "SQUAT_MAX_REPS", 30));

        assertThat(evaluation.outcome()).isNull();
        assertThat(evaluation.failureReason()).isEqualTo(LevelRuleEvaluator.MISSING_REQUIRED_ANSWER);
        assertThat(evaluation.criteria().get(2).value()).isNull();
    }

    @Test
    void optionalCriterionIsLeftOutWhenNotAnswered() {
        LevelRuleSetDefinition plankOptional = rules(ScoringMethod.WEIGHTED_AVERAGE, pushUp(), squat(),
                criterion("PLANK", "PLANK_MAX_SECONDS", "1", false, plank().bands().toArray(Band[]::new)));

        Evaluation evaluation = LevelRuleEvaluator.evaluate(plankOptional,
                answers("PUSH_UP_MAX_REPS", 45, "SQUAT_MAX_REPS", 60));
        assertThat(evaluation.totalScore()).isEqualByComparingTo("3");
        assertThat(evaluation.outcome().level()).isEqualTo(ADVANCED);
    }

    @Test
    void valueOutsideEveryBandIsReported() {
        LevelRuleSetDefinition withGap = rules(ScoringMethod.WEIGHTED_AVERAGE,
                criterion("PUSH_UP", "PUSH_UP_MAX_REPS", "1", true, band("1", "18", "1", BEGINNER)));

        assertThat(LevelRuleEvaluator.evaluate(withGap, answers("PUSH_UP_MAX_REPS", 0)).failureReason())
                .isEqualTo(LevelRuleEvaluator.NO_MATCHING_BAND);
    }

    @Test
    void scoreBelowTheLowestOutcomeIsReported() {
        LevelRuleSetDefinition highFloor = new LevelRuleSetDefinition(1L, "R", "R", 1, ScoringMethod.WEIGHTED_AVERAGE,
                List.of(pushUp()), List.of(outcome(INTERMEDIATE, "2", 1)));

        Evaluation evaluation = LevelRuleEvaluator.evaluate(highFloor, answers("PUSH_UP_MAX_REPS", 5));
        assertThat(evaluation.outcome()).isNull();
        assertThat(evaluation.failureReason()).isEqualTo(LevelRuleEvaluator.BELOW_LOWEST_OUTCOME);
    }

    @Test
    void conditionalBandsSplitThresholdsByAnotherAnswer() {
        JsonNode female = json("{\"operator\":\"EQ\",\"questionCode\":\"GENDER\",\"value\":\"FEMALE\"}");
        Band femaleIntermediate = new Band(new BigDecimal("10"), null, new BigDecimal("2"), INTERMEDIATE, null,
                female, ConditionParser.parse(female));
        LevelRuleSetDefinition byGender = rules(ScoringMethod.WEIGHTED_AVERAGE,
                criterion("PUSH_UP", "PUSH_UP_MAX_REPS", "1", true, femaleIntermediate,
                        band(null, "18", "1", BEGINNER), band("18", null, "2", INTERMEDIATE)));

        assertThat(LevelRuleEvaluator.evaluate(byGender, answers("PUSH_UP_MAX_REPS", 12, "GENDER", "\"FEMALE\""))
                .outcome().level()).isEqualTo(INTERMEDIATE);
        assertThat(LevelRuleEvaluator.evaluate(byGender, answers("PUSH_UP_MAX_REPS", 12, "GENDER", "\"MALE\""))
                .outcome().level()).isEqualTo(BEGINNER);
    }

    @Test
    void planSpreadsSessionsAcrossTheWeekAndCyclesTemplates() {
        ResultConfig config = new ResultConfig(true, true, 4, 3, 30, null);
        PlanResponse plan = LevelAssessmentService.plan(standardRules().outcomes().get(0), config);

        assertThat(plan.name()).isEqualTo("Beginner plan");
        assertThat(plan.weeks()).isEqualTo(4);
        assertThat(plan.rhythm()).extracting(d -> d.day() + " " + d.name())
                .containsExactly("MON Full body A", "WED Full body B", "FRI Full body A");
        assertThat(plan.rhythm().get(1).exercises()).isEmpty();

        PlanResponse fiveDays = LevelAssessmentService.plan(standardRules().outcomes().get(0),
                new ResultConfig(true, true, 4, 5, 30, null));
        assertThat(fiveDays.rhythm()).extracting(d -> d.day()).containsExactly("MON", "TUE", "WED", "FRI", "SAT");
    }

    @Test
    void validatorRejectsCriteriaThatCannotBeScored() {
        SurveyDefinition survey = SurveyFixtures.survey(step("LEVEL_TEST",
                link(question("PUSH_UP_MAX_REPS", "NUMBER", true, null), null),
                link(question("GENDER", "SINGLE_SELECT", true, null, "MALE", "FEMALE"), null)));
        JsonNode unknown = json("{\"operator\":\"EQ\",\"questionCode\":\"SHOE_SIZE\",\"value\":40}");
        LevelRuleSetDefinition broken = new LevelRuleSetDefinition(1L, "R", "R", 1, ScoringMethod.WEIGHTED_AVERAGE,
                List.of(criterion("PUSH_UP", "PUSH_UP_MAX_REPS", "1", true,
                                new Band(null, null, BigDecimal.ONE, BEGINNER, null, unknown, ConditionParser.parse(unknown))),
                        criterion("GENDER", "GENDER", "1", true, band(null, null, "1", BEGINNER)),
                        criterion("SQUAT", "SQUAT_MAX_REPS", "1", true)),
                List.of(outcome(BEGINNER, "1", 1), outcome(INTERMEDIATE, "1", 2)));

        List<String> problems = new ArrayList<>(LevelRuleSetLoader.validate(broken, survey));
        assertThat(problems).anyMatch(p -> p.contains("SHOE_SIZE"))
                .anyMatch(p -> p.contains("GENDER") && p.contains("SINGLE_SELECT"))
                .anyMatch(p -> p.contains("SQUAT_MAX_REPS") && p.contains("not an active question"))
                .anyMatch(p -> p.contains("Criterion SQUAT has no bands"))
                .anyMatch(p -> p.contains("higher min_score"));

        SurveyDefinition onboarding = SurveyFixtures.survey(step("LEVEL_TEST",
                link(question("PUSH_UP_MAX_REPS", "NUMBER", true, null), null),
                link(question("SQUAT_MAX_REPS", "NUMBER", true, null), null),
                link(question("PLANK_MAX_SECONDS", "NUMBER", true, null), null)));
        assertThat(LevelRuleSetLoader.validate(standardRules(), onboarding)).isEmpty();
    }
}
