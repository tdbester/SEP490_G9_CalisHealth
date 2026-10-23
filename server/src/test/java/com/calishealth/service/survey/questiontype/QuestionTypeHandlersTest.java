package com.calishealth.service.survey.questiontype;

import com.calishealth.service.survey.definition.QuestionDefinition;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

import static com.calishealth.service.survey.SurveyFixtures.json;
import static com.calishealth.service.survey.SurveyFixtures.question;
import static org.assertj.core.api.Assertions.assertThat;

class QuestionTypeHandlersTest {

    private static void assertFails(AnswerCheck check, String code) {
        assertThat(check.valid()).as("expected %s", code).isFalse();
        assertThat(check.errorCode()).isEqualTo(code);
    }

    private static JsonNode assertOk(AnswerCheck check) {
        assertThat(check.valid()).as("unexpected error %s: %s", check.errorCode(), check.message()).isTrue();
        return check.normalized();
    }

    @Nested
    class Number {
        final NumberQuestionType handler = new NumberQuestionType();
        final QuestionDefinition age = question("AGE", "NUMBER", true, "{\"integerOnly\":true,\"min\":13,\"max\":100}");
        final QuestionDefinition height = question("HEIGHT", "NUMBER", true, "{\"min\":100,\"max\":250,\"maxDecimals\":1}");

        @Test
        void acceptsIntegerAndDecimalWithinRules() {
            assertThat(assertOk(handler.check(age, json("22"))).asInt()).isEqualTo(22);
            assertThat(assertOk(handler.check(height, json("172.5"))).decimalValue()).isEqualByComparingTo("172.5");
            // 70.0 là số nguyên về mặt giá trị -> lưu thành 70
            assertThat(assertOk(handler.check(age, json("70.0"))).isIntegralNumber()).isTrue();
        }

        @Test
        void rejectsWrongTypes() {
            assertFails(handler.check(age, json("\"22\"")), AnswerCheck.TYPE_MISMATCH);
            assertFails(handler.check(age, json("true")), AnswerCheck.TYPE_MISMATCH);
            assertFails(handler.check(age, json("[22]")), AnswerCheck.TYPE_MISMATCH);
        }

        @Test
        void enforcesRangeIntegerAndDecimals() {
            assertFails(handler.check(age, json("12")), AnswerCheck.VALUE_OUT_OF_RANGE);
            assertFails(handler.check(age, json("101")), AnswerCheck.VALUE_OUT_OF_RANGE);
            assertFails(handler.check(age, json("22.5")), AnswerCheck.NOT_AN_INTEGER);
            assertFails(handler.check(height, json("172.55")), AnswerCheck.TOO_MANY_DECIMALS);
            assertFails(handler.check(height, json("1e400")), AnswerCheck.TYPE_MISMATCH);
        }

        @Test
        void validatesConfig() {
            assertThat(handler.validateConfig(age)).isEmpty();
            assertThat(handler.validateConfig(question("X", "NUMBER", true, "{\"min\":5,\"max\":1}")))
                    .anyMatch(p -> p.contains("min"));
            assertThat(handler.validateConfig(question("X", "NUMBER", true, "{\"minimum\":5}")))
                    .anyMatch(p -> p.contains("Unsupported validation rule 'minimum'"));
            assertThat(handler.validateConfig(question("X", "NUMBER", true, "{\"min\":\"5\"}")))
                    .anyMatch(p -> p.contains("must be a number"));
        }
    }

    @Nested
    class Text {
        final TextQuestionType handler = new TextQuestionType();
        final QuestionDefinition note = question("NOTE", "TEXT", false, "{\"minLength\":2,\"maxLength\":5,\"pattern\":\"[a-z]+\"}");

        @Test
        void acceptsValidText() {
            assertThat(assertOk(handler.check(note, json("\"abc\""))).stringValue()).isEqualTo("abc");
        }

        @Test
        void rejectsInvalidText() {
            assertFails(handler.check(note, json("12")), AnswerCheck.TYPE_MISMATCH);
            assertFails(handler.check(note, json("\"   \"")), AnswerCheck.EMPTY_VALUE);
            assertFails(handler.check(note, json("\"a\"")), AnswerCheck.TOO_SHORT);
            assertFails(handler.check(note, json("\"abcdef\"")), AnswerCheck.TOO_LONG);
            assertFails(handler.check(note, json("\"ABC\"")), AnswerCheck.PATTERN_MISMATCH);
        }

        @Test
        void appliesDefaultMaxLength() {
            QuestionDefinition plain = question("PLAIN", "TEXT", false, null);
            assertFails(handler.check(plain, json("\"" + "x".repeat(256) + "\"")), AnswerCheck.TOO_LONG);
            QuestionDefinition area = question("AREA", "TEXTAREA", false, null);
            assertOk(new TextareaQuestionType().check(area, json("\"" + "x".repeat(256) + "\"")));
        }

        @Test
        void rejectsBrokenPatternConfig() {
            assertThat(handler.validateConfig(question("X", "TEXT", false, "{\"pattern\":\"([a-z\"}")))
                    .anyMatch(p -> p.contains("pattern"));
        }
    }

    @Nested
    class Select {
        final SingleSelectQuestionType single = new SingleSelectQuestionType();
        final MultipleSelectQuestionType multiple = new MultipleSelectQuestionType();
        final QuestionDefinition gender = question("GENDER", "SINGLE_SELECT", true, null, "MALE", "FEMALE");
        final QuestionDefinition skills = question("SKILLS", "MULTIPLE_SELECT", true, "{\"maxSelections\":2}",
                "MUSCLE_UP", "HANDSTAND", "PLANCHE");

        @Test
        void singleSelect() {
            assertThat(assertOk(single.check(gender, json("\"MALE\""))).stringValue()).isEqualTo("MALE");
            assertFails(single.check(gender, json("\"ROBOT\"")), AnswerCheck.INVALID_OPTION);
            assertFails(single.check(gender, json("[\"MALE\"]")), AnswerCheck.TYPE_MISMATCH);
            assertThat(single.validateConfig(question("X", "SINGLE_SELECT", true, null)))
                    .anyMatch(p -> p.contains("at least one active option"));
        }

        @Test
        void multipleSelectNormalizesToOptionOrder() {
            JsonNode value = assertOk(multiple.check(skills, json("[\"PLANCHE\",\"MUSCLE_UP\"]")));
            assertThat(value.toString()).isEqualTo("[\"MUSCLE_UP\",\"PLANCHE\"]");
        }

        @Test
        void multipleSelectRejections() {
            assertFails(multiple.check(skills, json("\"MUSCLE_UP\"")), AnswerCheck.TYPE_MISMATCH);
            assertFails(multiple.check(skills, json("[\"MUSCLE_UP\",1]")), AnswerCheck.TYPE_MISMATCH);
            assertFails(multiple.check(skills, json("[\"MUSCLE_UP\",\"MUSCLE_UP\"]")), AnswerCheck.DUPLICATE_OPTION);
            assertFails(multiple.check(skills, json("[\"MUSCLE_UP\",\"FLYING\"]")), AnswerCheck.INVALID_OPTION);
            assertFails(multiple.check(skills, json("[]")), AnswerCheck.TOO_FEW_SELECTIONS);
            assertFails(multiple.check(skills, json("[\"MUSCLE_UP\",\"HANDSTAND\",\"PLANCHE\"]")),
                    AnswerCheck.TOO_MANY_SELECTIONS);
        }

        @Test
        void emptySelectionAllowedWhenConfigured() {
            QuestionDefinition optional = question("OPT", "MULTIPLE_SELECT", false, "{\"minSelections\":0}", "A");
            assertThat(assertOk(multiple.check(optional, json("[]"))).size()).isZero();
        }
    }

    @Nested
    class Bool {
        final BooleanQuestionType handler = new BooleanQuestionType();
        final QuestionDefinition flag = question("FLAG", "BOOLEAN", true, null);

        @Test
        void onlyRealBooleans() {
            assertThat(assertOk(handler.check(flag, json("false"))).booleanValue()).isFalse();
            assertFails(handler.check(flag, json("\"true\"")), AnswerCheck.TYPE_MISMATCH);
            assertFails(handler.check(flag, json("1")), AnswerCheck.TYPE_MISMATCH);
        }
    }
}
