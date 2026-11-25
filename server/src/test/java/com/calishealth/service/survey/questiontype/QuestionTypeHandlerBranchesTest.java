package com.calishealth.service.survey.questiontype;

import com.calishealth.service.survey.definition.QuestionDefinition;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static com.calishealth.service.survey.SurveyFixtures.json;
import static com.calishealth.service.survey.SurveyFixtures.question;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bo sung coverage cho cac nhanh con lai cua question type handlers:
 * nhanh ruleKeys() rong, thong bao range chi co min/max, va regex hop le.
 */
class QuestionTypeHandlerBranchesTest {

    @Test
    @DisplayName("BOOLEAN: co rule -> bao unsupported va goi ruleKeys()")
    void booleanRejectsAnyRule() {
        QuestionDefinition broken = question("X", "BOOLEAN", true, "{\"min\":1}");

        List<String> problems = new BooleanQuestionType().validateConfig(broken);

        assertThat(problems).anyMatch(p -> p.contains("Unsupported validation rule 'min' for type BOOLEAN"));
    }

    @Test
    @DisplayName("SINGLE_SELECT: co rule -> bao unsupported va goi ruleKeys()")
    void singleSelectRejectsAnyRule() {
        QuestionDefinition broken = question("X", "SINGLE_SELECT", true, "{\"maxSelections\":2}", "A");

        List<String> problems = new SingleSelectQuestionType().validateConfig(broken);

        assertThat(problems).anyMatch(p -> p.contains("Unsupported validation rule 'maxSelections' for type SINGLE_SELECT"));
    }

    @Test
    @DisplayName("MULTIPLE_SELECT: khong co option active -> bao loi")
    void multipleSelectRequiresActiveOption() {
        QuestionDefinition broken = question("X", "MULTIPLE_SELECT", true, "{\"minSelections\":1}");

        List<String> problems = new MultipleSelectQuestionType().validateConfig(broken);

        assertThat(problems).anyMatch(p -> p.contains("MULTIPLE_SELECT requires at least one active option"));
    }

    @Test
    @DisplayName("NUMBER: chi co min -> thong bao 'at least'")
    void numberReportsMinimumOnly() {
        QuestionDefinition age = question("AGE", "NUMBER", true, "{\"min\":13}");

        var check = new NumberQuestionType().check(age, json("5"));

        assertThat(check.valid()).isFalse();
        assertThat(check.errorCode()).isEqualTo(AnswerCheck.VALUE_OUT_OF_RANGE);
        assertThat(check.message()).contains("at least").contains("13");
    }

    @Test
    @DisplayName("NUMBER: chi co max -> thong bao 'at most'")
    void numberReportsMaximumOnly() {
        QuestionDefinition age = question("AGE", "NUMBER", true, "{\"max\":100}");

        var check = new NumberQuestionType().check(age, json("500"));

        assertThat(check.valid()).isFalse();
        assertThat(check.errorCode()).isEqualTo(AnswerCheck.VALUE_OUT_OF_RANGE);
        assertThat(check.message()).contains("at most").contains("100");
    }

    @Test
    @DisplayName("TEXT: regex hop le -> khong bao loi")
    void textAcceptsValidPattern() {
        QuestionDefinition note = question("NOTE", "TEXT", false, "{\"pattern\":\"[a-z]+\"}");

        assertThat(new TextQuestionType().validateConfig(note)).isEmpty();
    }

    @Test
    @DisplayName("TEXT: regex khong hop le -> bao loi")
    void textRejectsInvalidPattern() {
        QuestionDefinition note = question("NOTE", "TEXT", false, "{\"pattern\":\"([a-z\"}");

        assertThat(new TextQuestionType().validateConfig(note))
                .anyMatch(p -> p.contains("'pattern' is not a valid regular expression"));
    }
}
