package com.calishealth.service.survey;

import org.junit.jupiter.api.Test;

import static com.calishealth.service.survey.SurveyFixtures.link;
import static com.calishealth.service.survey.SurveyFixtures.question;
import static com.calishealth.service.survey.SurveyFixtures.step;
import static com.calishealth.service.survey.SurveyFixtures.survey;
import static org.assertj.core.api.Assertions.assertThat;

class SurveyConfigValidatorTest {
    private final SurveyConfigValidator validator = new SurveyConfigValidator(SurveyFixtures.registry());

    @Test
    void onboardingFixtureIsValid() {
        assertThat(validator.validate(SurveyFixtures.onboarding())).isEmpty();
    }

    @Test
    void conditionMustReferenceEarlierQuestion() {
        var definition = survey(step("S1",
                link(question("A", "BOOLEAN", true, null),
                        "{\"operator\":\"EQ\",\"questionCode\":\"B\",\"value\":true}"),
                link(question("B", "BOOLEAN", true, null), null)));
        assertThat(validator.validate(definition)).singleElement().asString()
                .contains("condition references 'B'");
    }

    @Test
    void conditionMustNotReferenceItself() {
        var definition = survey(step("S1", link(question("A", "BOOLEAN", true, null),
                "{\"operator\":\"EQ\",\"questionCode\":\"A\",\"value\":true}")));
        assertThat(validator.validate(definition)).isNotEmpty();
    }

    @Test
    void questionMayAppearOnlyOnce() {
        var age = question("AGE", "NUMBER", true, null);
        var definition = survey(step("S1", link(age, null)), step("S2", link(age, null)));
        assertThat(validator.validate(definition)).singleElement().asString().contains("more than once");
    }

    @Test
    void handlerConfigProblemsAreReported() {
        var definition = survey(step("S1", link(question("AGE", "NUMBER", true, "{\"min\":10,\"max\":1}"), null)));
        assertThat(validator.validate(definition)).singleElement().asString().contains("Question AGE");
    }
}
