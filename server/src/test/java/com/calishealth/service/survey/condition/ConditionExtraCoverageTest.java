package com.calishealth.service.survey.condition;

import com.calishealth.service.survey.condition.Condition.Operator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.Map;

import static com.calishealth.service.survey.SurveyFixtures.json;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Bo sung coverage cho {@link Condition} va {@link ConditionParser}. */
class ConditionExtraCoverageTest {

    @Test
    @DisplayName("Compare: NE tren mang -> true khi khong chua gia tri")
    void notEqualsOnArrayAnswers() {
        Condition condition = ConditionParser.parse(
                json("{\"operator\":\"NE\",\"questionCode\":\"SKILLS\",\"value\":\"HANDSTAND\"}"));

        assertThat(condition.test(Map.of("SKILLS", json("[\"MUSCLE_UP\"]")))).isTrue();
        assertThat(condition.test(Map.of("SKILLS", json("[\"MUSCLE_UP\",\"HANDSTAND\"]")))).isFalse();
    }

    @Test
    @DisplayName("Compare: NOT_IN tren mang -> true khi khong giao")
    void notInOnArrayAnswers() {
        Condition condition = ConditionParser.parse(
                json("{\"operator\":\"NOT_IN\",\"questionCode\":\"SKILLS\",\"value\":[\"HANDSTAND\"]}"));

        assertThat(condition.test(Map.of("SKILLS", json("[\"MUSCLE_UP\"]")))).isTrue();
        assertThat(condition.test(Map.of("SKILLS", json("[\"HANDSTAND\"]")))).isFalse();
    }

    @Test
    @DisplayName("Compare: so sanh hai so nguyen khac kieu -> bang nhau")
    void scalarEqualsComparesNumbersByValue() {
        Condition condition = ConditionParser.parse(
                json("{\"operator\":\"EQ\",\"questionCode\":\"AGE\",\"value\":40}"));

        assertThat(condition.test(Map.of("AGE", json("40.0")))).isTrue();
    }

    @Test
    @DisplayName("Compare: nguon chua tra loi -> false")
    void compareWithMissingAnswerIsFalse() {
        Condition condition = ConditionParser.parse(
                json("{\"operator\":\"EQ\",\"questionCode\":\"AGE\",\"value\":40}"));

        assertThat(condition.test(Map.of())).isFalse();
    }

    @Test
    @DisplayName("Compare: dung toan tu nhom -> IllegalStateException")
    void groupOperatorInCompareThrows() {
        Condition.Compare compare = new Condition.Compare(Operator.AND, "AGE", json("1"));

        assertThatThrownBy(() -> compare.test(Map.of("AGE", json("1"))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Group operator in Compare");
    }

    @Test
    @DisplayName("Compare: so sanh GT voi gia tri khong phai so -> false")
    void compareNumbersRequiresBothNumbers() {
        Condition.Compare compare = new Condition.Compare(Operator.GT, "AGE", json("40"));

        assertThat(compare.test(Map.of("AGE", json("\"50\"")))).isFalse();
    }

    @Test
    @DisplayName("Compare: so sanh LT voi gia tri khong phai so -> false")
    void compareNumbersRequiresNumericExpectedValue() {
        Condition.Compare compare = new Condition.Compare(Operator.LT, "AGE", json("\"40\""));

        assertThat(compare.test(Map.of("AGE", json("30")))).isFalse();
    }

    @Test
    @DisplayName("ConditionParser: dieu kien khong phai JSON object -> bao loi")
    void conditionMustBeAnObject() {
        assertThatThrownBy(() -> ConditionParser.parse(json("[1,2]")))
                .hasMessageContaining("Condition must be a JSON object");
    }

    @Test
    @DisplayName("ConditionParser: thieu operator -> bao loi")
    void conditionRequiresOperator() {
        assertThatThrownBy(() -> ConditionParser.parse(json("{\"questionCode\":\"A\",\"value\":1}")))
                .hasMessageContaining("requires a string 'operator'");
        assertThatThrownBy(() -> ConditionParser.parse(json("{\"operator\":1,\"questionCode\":\"A\",\"value\":1}")))
                .hasMessageContaining("requires a string 'operator'");
    }

    @Test
    @DisplayName("ConditionParser: thieu value -> bao loi")
    void conditionRequiresValue() {
        assertThatThrownBy(() -> ConditionParser.parse(json("{\"operator\":\"EQ\",\"questionCode\":\"A\"}")))
                .hasMessageContaining("requires a 'value'");
    }

    @Test
    @DisplayName("ConditionParser: value khong phai scalar -> bao loi")
    void conditionRequiresScalarValue() {
        assertThatThrownBy(() -> ConditionParser.parse(
                json("{\"operator\":\"EQ\",\"questionCode\":\"A\",\"value\":{\"x\":1}}")))
                .hasMessageContaining("requires a scalar 'value'");
    }

    @Test
    @DisplayName("ConditionParser: lien tuoc qua sau 8 cap -> bao loi")
    void conditionRejectsTooDeepNesting() {
        StringBuilder raw = new StringBuilder();
        int depth = 10;
        for (int i = 0; i < depth; i++) {
            raw.append("{\"operator\":\"AND\",\"conditions\":[");
        }
        raw.append("{\"operator\":\"EQ\",\"questionCode\":\"A\",\"value\":1}");
        for (int i = 0; i < depth; i++) {
            raw.append("]}");
        }

        assertThatThrownBy(() -> ConditionParser.parse(json(raw.toString())))
                .hasMessageContaining("Condition nesting is deeper than");
    }

    @Test
    @DisplayName("Condition.Group: OR -> true khi co it nhat mot nhanh dung")
    void groupOrMatchesAnyCondition() {
        Condition condition = ConditionParser.parse(json("""
                {"operator":"OR","conditions":[
                  {"operator":"EQ","questionCode":"GOAL_TYPE","value":"HEALTH"},
                  {"operator":"EQ","questionCode":"HEALTH_GOAL","value":"LOSE_WEIGHT"}]}
                """));

        Map<String, JsonNode> answers = Map.of("GOAL_TYPE", json("\"SKILLS\""));
        assertThat(condition.test(answers)).isFalse();

        Map<String, JsonNode> both = Map.of("GOAL_TYPE", json("\"HEALTH\""),
                "HEALTH_GOAL", json("\"LOSE_WEIGHT\""));
        assertThat(condition.test(both)).isTrue();
    }

    @Test
    @DisplayName("Condition.Group: danh sach dieu kien rong -> bao loi")
    void groupRejectsEmptyConditions() {
        assertThatThrownBy(() -> ConditionParser.parse(json("{\"operator\":\"OR\",\"conditions\":[]}")))
                .hasMessageContaining("non-empty");
    }

    @Test
    @DisplayName("ConditionParser: dieu kien lot khong phai mang -> bao loi")
    void groupRejectsNonArrayConditions() {
        assertThatThrownBy(() -> ConditionParser.parse(json("{\"operator\":\"AND\",\"conditions\":{}}")))
                .hasMessageContaining("non-empty");
    }

    @Test
    @DisplayName("ConditionParser: dieu kien lot thieu conditions -> bao loi")
    void groupRequiresConditionsKey() {
        assertThatThrownBy(() -> ConditionParser.parse(json("{\"operator\":\"AND\"}")))
                .hasMessageContaining("non-empty");
    }

    @Test
    @DisplayName("ConditionParser: bien khong xac dinh -> bao loi")
    void conditionRequiresQuestionCode() {
        assertThatThrownBy(() -> ConditionParser.parse(json("{\"operator\":\"EQ\",\"questionCode\":\"  \",\"value\":1}")))
                .hasMessageContaining("requires a 'questionCode'");
    }

    @Test
    @DisplayName("Condition.Compare: referencedQuestions -> chua ma cau hoi")
    void compareReferencedQuestions() {
        Condition condition = ConditionParser.parse(
                json("{\"operator\":\"EQ\",\"questionCode\":\"GOAL_TYPE\",\"value\":\"SKILLS\"}"));

        assertThat(condition.referencedQuestions()).containsExactly("GOAL_TYPE");
    }

    @Test
    @DisplayName("Condition.Group: danh sach dieu kien duoc copy, khong sua duoc")
    void groupCopiesConditionList() {
        Condition.Group group = new Condition.Group(Operator.AND, List.of(
                new Condition.Compare(Operator.EQ, "A", json("1"))));

        assertThat(group.referencedQuestions()).containsExactly("A");
    }
}
