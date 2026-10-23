package com.calishealth.service.survey.questiontype;

import com.calishealth.service.survey.SurveyConfigValidator;
import com.calishealth.service.survey.SurveyFixtures;
import com.calishealth.service.survey.SurveyJson;
import com.calishealth.service.survey.definition.QuestionDefinition;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static com.calishealth.service.survey.SurveyFixtures.json;
import static com.calishealth.service.survey.SurveyFixtures.link;
import static com.calishealth.service.survey.SurveyFixtures.question;
import static com.calishealth.service.survey.SurveyFixtures.step;
import static com.calishealth.service.survey.SurveyFixtures.survey;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class QuestionTypeRegistryTest {

    /**
     * Ví dụ mở rộng: loại RATING mới chỉ là 1 class. Không sửa service, controller,
     * registry hay bất kỳ handler nào đã có.
     */
    static class RatingQuestionType extends AbstractQuestionTypeHandler {
        @Override
        public String type() {
            return "RATING";
        }

        @Override
        protected Set<String> ruleKeys() {
            return Set.of("maxStars");
        }

        @Override
        public AnswerCheck check(QuestionDefinition question, JsonNode value) {
            int maxStars = question.rule("maxStars") == null ? 5 : question.rule("maxStars").intValue();
            if (!value.isIntegralNumber()) {
                return AnswerCheck.fail(AnswerCheck.TYPE_MISMATCH, "Rating must be a whole number");
            }
            if (value.intValue() < 1 || value.intValue() > maxStars) {
                return AnswerCheck.fail(AnswerCheck.VALUE_OUT_OF_RANGE, "Rating must be 1.." + maxStars);
            }
            return AnswerCheck.ok(SurveyJson.nodes().numberNode(value.intValue()));
        }
    }

    @Test
    void resolvesRegisteredTypes() {
        QuestionTypeRegistry registry = SurveyFixtures.registry();
        assertThat(registry.supportedTypes())
                .containsExactlyInAnyOrder("NUMBER", "TEXT", "TEXTAREA", "SINGLE_SELECT", "MULTIPLE_SELECT", "BOOLEAN");
        assertThat(registry.find("NUMBER")).get().isInstanceOf(NumberQuestionType.class);
    }

    @Test
    void unknownTypeIsNotSupported() {
        QuestionTypeRegistry registry = SurveyFixtures.registry();
        assertThat(registry.find("FILE_UPLOAD")).isEmpty();
        assertThat(registry.find(null)).isEmpty();
        assertThat(registry.supports("RATING")).isFalse();
    }

    @Test
    void duplicateHandlersFailFast() {
        assertThatThrownBy(() -> new QuestionTypeRegistry(List.of(new TextQuestionType(), new TextQuestionType())))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Duplicate QuestionTypeHandler for type TEXT");
    }

    @Test
    void configWithUnregisteredTypeIsRejected() {
        SurveyConfigValidator validator = new SurveyConfigValidator(SurveyFixtures.registry());
        var definition = survey(step("S1", link(question("MOOD", "RATING", true, null), null)));
        assertThat(validator.validate(definition)).singleElement().asString()
                .contains("unsupported question type 'RATING'");
    }

    @Test
    void newTypeWorksJustByRegisteringAHandler() {
        List<QuestionTypeHandler> handlers = new ArrayList<>(SurveyFixtures.registry().supportedTypes().stream()
                .map(t -> SurveyFixtures.registry().find(t).orElseThrow()).toList());
        handlers.add(new RatingQuestionType());
        QuestionTypeRegistry extended = new QuestionTypeRegistry(handlers);

        QuestionDefinition mood = question("MOOD", "RATING", true, "{\"maxStars\":5}");
        var definition = survey(step("S1", link(mood, null)));
        assertThat(new SurveyConfigValidator(extended).validate(definition)).isEmpty();

        QuestionTypeHandler handler = extended.find("RATING").orElseThrow();
        assertThat(handler.check(mood, json("4")).valid()).isTrue();
        assertThat(handler.check(mood, json("6")).errorCode()).isEqualTo(AnswerCheck.VALUE_OUT_OF_RANGE);
        // rule gõ sai vẫn bị bắt nhờ AbstractQuestionTypeHandler
        assertThat(handler.validateConfig(question("M2", "RATING", true, "{\"stars\":5}"))).isNotEmpty();
        // các loại cũ không bị ảnh hưởng
        assertThat(extended.find("NUMBER")).get().isInstanceOf(NumberQuestionType.class);
    }
}
