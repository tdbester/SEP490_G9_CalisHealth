package com.calishealth.service.survey.condition;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

import java.util.Map;

import static com.calishealth.service.survey.SurveyFixtures.json;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ConditionTest {

    private static boolean eval(String condition, Map<String, JsonNode> answers) {
        return ConditionParser.parse(json(condition)).test(answers);
    }

    @Test
    void noConditionMeansNull() {
        assertThat(ConditionParser.parse(null)).isNull();
        assertThat(ConditionParser.parse(json("null"))).isNull();
    }

    @Test
    void equalityOnScalarAndArrayAnswers() {
        String eqSkills = "{\"operator\":\"EQ\",\"questionCode\":\"GOAL_TYPE\",\"value\":\"SKILLS\"}";
        assertThat(eval(eqSkills, Map.of("GOAL_TYPE", json("\"SKILLS\"")))).isTrue();
        assertThat(eval(eqSkills, Map.of("GOAL_TYPE", json("\"HEALTH\"")))).isFalse();
        // nguồn chưa trả lời -> false, kể cả với NE
        assertThat(eval(eqSkills, Map.of())).isFalse();
        assertThat(eval("{\"operator\":\"NE\",\"questionCode\":\"GOAL_TYPE\",\"value\":\"SKILLS\"}", Map.of())).isFalse();

        String containsHandstand = "{\"operator\":\"EQ\",\"questionCode\":\"SKILLS\",\"value\":\"HANDSTAND\"}";
        assertThat(eval(containsHandstand, Map.of("SKILLS", json("[\"MUSCLE_UP\",\"HANDSTAND\"]")))).isTrue();
    }

    @Test
    void inAndNotIn() {
        String in = "{\"operator\":\"IN\",\"questionCode\":\"EXP\",\"value\":[\"MONTHS_6_TO_12\",\"OVER_1_YEAR\"]}";
        assertThat(eval(in, Map.of("EXP", json("\"OVER_1_YEAR\"")))).isTrue();
        assertThat(eval(in, Map.of("EXP", json("\"NEVER\"")))).isFalse();
        String notIn = "{\"operator\":\"NOT_IN\",\"questionCode\":\"EXP\",\"value\":[\"NEVER\"]}";
        assertThat(eval(notIn, Map.of("EXP", json("\"OVER_1_YEAR\"")))).isTrue();
    }

    @Test
    void numericComparisons() {
        Map<String, JsonNode> answers = Map.of("AGE", json("40"));
        assertThat(eval("{\"operator\":\"GT\",\"questionCode\":\"AGE\",\"value\":39.5}", answers)).isTrue();
        assertThat(eval("{\"operator\":\"GTE\",\"questionCode\":\"AGE\",\"value\":40}", answers)).isTrue();
        assertThat(eval("{\"operator\":\"LT\",\"questionCode\":\"AGE\",\"value\":40}", answers)).isFalse();
        assertThat(eval("{\"operator\":\"LTE\",\"questionCode\":\"AGE\",\"value\":40.0}", answers)).isTrue();
        // không phải số -> false
        assertThat(eval("{\"operator\":\"LT\",\"questionCode\":\"AGE\",\"value\":50}", Map.of("AGE", json("\"x\"")))).isFalse();
    }

    @Test
    void groups() {
        String and = """
                {"operator":"AND","conditions":[
                  {"operator":"EQ","questionCode":"GOAL_TYPE","value":"HEALTH"},
                  {"operator":"OR","conditions":[
                    {"operator":"GTE","questionCode":"AGE","value":50},
                    {"operator":"EQ","questionCode":"HEALTH_GOAL","value":"LOSE_WEIGHT"}]}]}
                """;
        assertThat(eval(and, Map.of("GOAL_TYPE", json("\"HEALTH\""), "AGE", json("30"),
                "HEALTH_GOAL", json("\"LOSE_WEIGHT\"")))).isTrue();
        assertThat(eval(and, Map.of("GOAL_TYPE", json("\"HEALTH\""), "AGE", json("30")))).isFalse();
        assertThat(ConditionParser.parse(json(and)).referencedQuestions())
                .containsExactly("GOAL_TYPE", "AGE", "HEALTH_GOAL");
    }

    @Test
    void rejectsInvalidConfiguration() {
        assertThatThrownBy(() -> ConditionParser.parse(json("{\"operator\":\"EVAL\",\"questionCode\":\"A\",\"value\":1}")))
                .hasMessageContaining("Unsupported condition operator");
        assertThatThrownBy(() -> ConditionParser.parse(json("{\"operator\":\"IN\",\"questionCode\":\"A\",\"value\":\"x\"}")))
                .hasMessageContaining("array");
        assertThatThrownBy(() -> ConditionParser.parse(json("{\"operator\":\"GT\",\"questionCode\":\"A\",\"value\":\"x\"}")))
                .hasMessageContaining("numeric");
        assertThatThrownBy(() -> ConditionParser.parse(json("{\"operator\":\"AND\",\"conditions\":[]}")))
                .hasMessageContaining("non-empty");
        assertThatThrownBy(() -> ConditionParser.parse(json("{\"operator\":\"EQ\",\"value\":1}")))
                .hasMessageContaining("questionCode");
        assertThatThrownBy(() -> ConditionParser.parse(json("{\"operator\":\"EQ\",\"questionCode\":\"A\",\"value\":1,\"script\":\"x\"}")))
                .hasMessageContaining("Unknown condition key");
    }
}
