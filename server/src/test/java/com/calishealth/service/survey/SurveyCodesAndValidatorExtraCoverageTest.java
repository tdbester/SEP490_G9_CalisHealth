package com.calishealth.service.survey;

import com.calishealth.service.survey.definition.QuestionDefinition;
import com.calishealth.service.survey.definition.StepDefinition;
import com.calishealth.service.survey.definition.StepQuestion;
import com.calishealth.service.survey.definition.SurveyDefinition;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bo sung coverage cho {@link SurveyCodes} va nhanh "bo qua cau hoi khong active" cua
 * {@link SurveyConfigValidator}.
 */
class SurveyCodesAndValidatorExtraCoverageTest {

    @Test
    @DisplayName("SurveyCodes: ten qua dai -> cat con gioi han")
    void longNameIsTruncated() {
        String name = "A".repeat(80);

        String code = SurveyCodes.generate(name, "QUESTION", candidate -> false);

        assertThat(code).hasSizeLessThanOrEqualTo(56);
        assertThat(code).doesNotEndWith("_");
    }

    @Test
    @DisplayName("SurveyCodes: ten dai ket thuc bang dau gach -> cat dau gach")
    void longNameEndingWithUnderscoreIsTrimmed() {
        String name = "A".repeat(55) + "_BBBB";

        String code = SurveyCodes.generate(name, "QUESTION", candidate -> false);

        assertThat(code).doesNotEndWith("_");
        assertThat(code).hasSizeLessThanOrEqualTo(56);
    }

    @Test
    @DisplayName("SurveyCodes: ma da ton tai -> them hau to _2")
    void duplicateCodeGetsSuffix() {
        String code = SurveyCodes.generate("Age", "QUESTION", candidate -> candidate.equals("AGE"));

        assertThat(code).isEqualTo("AGE_2");
    }

    @Test
    @DisplayName("SurveyCodes: ten rong -> dung fallback")
    void blankNameFallsBack() {
        String code = SurveyCodes.generate("", "QUESTION", candidate -> false);

        assertThat(code).isEqualTo("QUESTION");
    }

    @Test
    @DisplayName("SurveyCodes: ten bat dau bang so -> them fallback")
    void nameStartingWithDigitGetsFallback() {
        String code = SurveyCodes.generate("1st place", "QUESTION", candidate -> false);

        assertThat(code).isEqualTo("QUESTION_1ST_PLACE");
    }

    // ------------------------------------------------------------ SurveyConfigValidator

    @Test
    @DisplayName("validator: cau hoi khong active -> bo qua, khong bao loi")
    void inactiveQuestionIsSkipped() {
        QuestionDefinition inactive = new QuestionDefinition(1L, "AGE", "Age", null, "NUMBER", true,
                null, null, null, null, false, List.of());
        StepQuestion link = new StepQuestion(inactive, 1, true, null, null);
        StepDefinition step = new StepDefinition("S1", "Step 1", null, 1, true, List.of(link));
        SurveyDefinition definition = new SurveyDefinition(1L, "TEST", "Test", null, 1, List.of(step));

        assertThat(new SurveyConfigValidator(SurveyFixtures.registry()).validate(definition)).isEmpty();
    }

    @Test
    @DisplayName("validator: lien ket khong active -> cau hoi bi bo qua")
    void inactiveLinkIsSkipped() {
        QuestionDefinition question = SurveyFixtures.question("AGE", "NUMBER", true, null);
        StepQuestion link = new StepQuestion(question, 1, false, null, null);
        StepDefinition step = new StepDefinition("S1", "Step 1", null, 1, true, List.of(link));
        SurveyDefinition definition = new SurveyDefinition(1L, "TEST", "Test", null, 1, List.of(step));

        assertThat(new SurveyConfigValidator(SurveyFixtures.registry()).validate(definition)).isEmpty();
    }

    @Test
    @DisplayName("validator: cau hoi lap lai -> bao loi va bo qua phan con lai")
    void duplicateQuestionIsReportedOnce() {
        QuestionDefinition age = SurveyFixtures.question("AGE", "NUMBER", true, null);
        StepDefinition step = new StepDefinition("S1", "Step 1", null, 1, true,
                List.of(SurveyFixtures.link(age, null), SurveyFixtures.link(age, null)));
        SurveyDefinition definition = new SurveyDefinition(1L, "TEST", "Test", null, 1, List.of(step));

        assertThat(new SurveyConfigValidator(SurveyFixtures.registry()).validate(definition))
                .hasSize(1)
                .anyMatch(p -> p.contains("appears more than once"));
    }

    @Test
    @DisplayName("validator: loai cau hoi khong ho tro -> bao loi")
    void unsupportedQuestionTypeIsReported() {
        QuestionDefinition weird = SurveyFixtures.question("X", "GEOSPATIAL", true, null);
        StepDefinition step = new StepDefinition("S1", "Step 1", null, 1, true,
                List.of(SurveyFixtures.link(weird, null)));
        SurveyDefinition definition = new SurveyDefinition(1L, "TEST", "Test", null, 1, List.of(step));

        assertThat(new SurveyConfigValidator(SurveyFixtures.registry()).validate(definition))
                .anyMatch(p -> p.contains("unsupported question type 'GEOSPATIAL'"));
    }

    @Test
    @DisplayName("validator: dieu kien tro toi cau hoi o buoc sau -> bao loi")
    void conditionReferencingLaterQuestionIsReported() {
        QuestionDefinition flag = SurveyFixtures.question("FLAG", "BOOLEAN", true, null);
        QuestionDefinition later = SurveyFixtures.question("LATER", "BOOLEAN", true, null);
        StepDefinition step = new StepDefinition("S1", "Step 1", null, 1, true,
                List.of(SurveyFixtures.link(flag,
                                "{\"operator\":\"EQ\",\"questionCode\":\"LATER\",\"value\":true}"),
                        SurveyFixtures.link(later, null)));
        SurveyDefinition definition = new SurveyDefinition(1L, "TEST", "Test", null, 1, List.of(step));

        assertThat(new SurveyConfigValidator(SurveyFixtures.registry()).validate(definition))
                .anyMatch(p -> p.contains("condition references 'LATER'"));
    }

    @Test
    @DisplayName("validator: dieu kien tro toi cau hoi khong ton tai -> bao loi")
    void conditionReferencingUnknownQuestionIsReported() {
        QuestionDefinition flag = SurveyFixtures.question("FLAG", "BOOLEAN", true, null);
        StepDefinition step = new StepDefinition("S1", "Step 1", null, 1, true,
                List.of(SurveyFixtures.link(flag,
                        "{\"operator\":\"EQ\",\"questionCode\":\"GHOST\",\"value\":true}")));
        SurveyDefinition definition = new SurveyDefinition(1L, "TEST", "Test", null, 1, List.of(step));

        assertThat(new SurveyConfigValidator(SurveyFixtures.registry()).validate(definition))
                .anyMatch(p -> p.contains("condition references 'GHOST'"));
    }

    @Test
    @DisplayName("validator: buoc khong active -> bo qua")
    void inactiveStepIsSkipped() {
        QuestionDefinition broken = SurveyFixtures.question("X", "GEOSPATIAL", true, null);
        StepDefinition step = new StepDefinition("S1", "Step 1", null, 1, false,
                List.of(SurveyFixtures.link(broken, null)));
        SurveyDefinition definition = new SurveyDefinition(1L, "TEST", "Test", null, 1, List.of(step));

        assertThat(new SurveyConfigValidator(SurveyFixtures.registry()).validate(definition)).isEmpty();
    }

    @Test
    @DisplayName("SurveyCodes: fallback khong rong va khong bat dau bang so -> giu nguyen")
    void fallbackIsUsedWhenBaseIsInvalid() {
        String code = SurveyCodes.generate("!!!", "QUESTION", candidate -> false);

        assertThat(code).startsWith("QUESTION");
        assertThat(Set.of(code)).doesNotContain("");
    }
}
