package com.calishealth.service.survey.questiontype;

import com.calishealth.service.survey.definition.QuestionDefinition;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static com.calishealth.service.survey.SurveyFixtures.json;
import static com.calishealth.service.survey.SurveyFixtures.question;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bo sung coverage cho {@link AbstractQuestionTypeHandler} va cac lop con:
 * cac nhanh validate rule sai kieu duoc xu ly.
 */
class QuestionTypeHandlersExtraCoverageTest {

    @Test
    @DisplayName("validateConfig: validationRules khong phai JSON object -> bao loi")
    void validationRulesMustBeAnObject() {
        QuestionDefinition broken = question("X", "NUMBER", true, "[1,2]");
        List<String> problems = new NumberQuestionType().validateConfig(broken);

        assertThat(problems).anyMatch(p -> p.contains("validationRules must be a JSON object"));
    }

    @Test
    @DisplayName("validateConfig: minLength khong phai so nguyen -> bao loi")
    void intRuleRejectsNonInteger() {
        QuestionDefinition broken = question("X", "TEXT", false, "{\"minLength\":\"2\"}");
        List<String> problems = new TextQuestionType().validateConfig(broken);

        assertThat(problems).anyMatch(p -> p.contains("must be an integer >= 0"));
    }

    @Test
    @DisplayName("validateConfig: maxLength nho hon 1 -> bao loi")
    void intRuleRejectsValueBelowMinimum() {
        QuestionDefinition broken = question("X", "TEXT", false, "{\"maxLength\":0}");
        List<String> problems = new TextQuestionType().validateConfig(broken);

        assertThat(problems).anyMatch(p -> p.contains("must be an integer >= 1"));
    }

    @Test
    @DisplayName("validateConfig: integerOnly khong phai boolean -> bao loi")
    void booleanRuleRejectsNonBoolean() {
        QuestionDefinition broken = question("X", "NUMBER", true, "{\"integerOnly\":\"yes\"}");
        List<String> problems = new NumberQuestionType().validateConfig(broken);

        assertThat(problems).anyMatch(p -> p.contains("must be true or false"));
    }

    @Test
    @DisplayName("validateConfig: maxSelections nho hon minSelections -> bao loi")
    void multipleSelectRejectsInvertedSelectionRange() {
        QuestionDefinition broken = question("X", "MULTIPLE_SELECT", true,
                "{\"minSelections\":3,\"maxSelections\":1}", "A", "B");
        List<String> problems = new MultipleSelectQuestionType().validateConfig(broken);

        assertThat(problems).anyMatch(p -> p.contains("must be <= 'maxSelections'"));
    }

    @Test
    @DisplayName("validateConfig: maxLength vuot gioi han cung -> bao loi")
    void textRejectsMaxLengthAboveHardLimit() {
        QuestionDefinition broken = question("X", "TEXT", false, "{\"maxLength\":20000}");
        List<String> problems = new TextQuestionType().validateConfig(broken);

        assertThat(problems).anyMatch(p -> p.contains("must be <= 10000"));
    }

    @Test
    @DisplayName("validateConfig: minLength lon hon maxLength -> bao loi")
    void textRejectsMinAboveMax() {
        QuestionDefinition broken = question("X", "TEXT", false, "{\"minLength\":10,\"maxLength\":5}");
        List<String> problems = new TextQuestionType().validateConfig(broken);

        assertThat(problems).anyMatch(p -> p.contains("'minLength' must be <= maxLength"));
    }

    @Test
    @DisplayName("validateConfig: pattern khong phai chuoi -> bao loi")
    void textRejectsNonStringPattern() {
        QuestionDefinition broken = question("X", "TEXT", false, "{\"pattern\":123}");
        List<String> problems = new TextQuestionType().validateConfig(broken);

        assertThat(problems).anyMatch(p -> p.contains("'pattern' must be a string"));
    }

    @Test
    @DisplayName("validateConfig: khong co rule -> khong bao loi")
    void validConfigHasNoProblems() {
        assertThat(new BooleanQuestionType().validateConfig(question("X", "BOOLEAN", true, null))).isEmpty();
        assertThat(new NumberQuestionType().validateConfig(
                question("X", "NUMBER", true, "{\"min\":1,\"max\":10,\"integerOnly\":true,\"maxDecimals\":1}")))
                .isEmpty();
    }

    @Test
    @DisplayName("check: NUMBER gia tri khong phai so -> TYPE_MISMATCH")
    void numberRejectsNonNumeric() {
        QuestionDefinition age = question("AGE", "NUMBER", true, null);
        assertThat(new NumberQuestionType().check(age, json("\"22\"")).valid()).isFalse();
    }

    @Test
    @DisplayName("check: BOOLEAN chi nhan true/false")
    void booleanRejectsOtherTypes() {
        QuestionDefinition flag = question("FLAG", "BOOLEAN", true, null);
        assertThat(new BooleanQuestionType().check(flag, json("1")).valid()).isFalse();
    }
}
