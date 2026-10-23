package com.calishealth.service.survey;

import com.calishealth.service.survey.condition.ConditionParser;
import com.calishealth.service.survey.definition.OptionDefinition;
import com.calishealth.service.survey.definition.QuestionDefinition;
import com.calishealth.service.survey.definition.StepDefinition;
import com.calishealth.service.survey.definition.StepQuestion;
import com.calishealth.service.survey.definition.SurveyDefinition;
import com.calishealth.service.survey.questiontype.BooleanQuestionType;
import com.calishealth.service.survey.questiontype.MultipleSelectQuestionType;
import com.calishealth.service.survey.questiontype.NumberQuestionType;
import com.calishealth.service.survey.questiontype.QuestionTypeRegistry;
import com.calishealth.service.survey.questiontype.SingleSelectQuestionType;
import com.calishealth.service.survey.questiontype.TextQuestionType;
import com.calishealth.service.survey.questiontype.TextareaQuestionType;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;

/** Dựng cấu hình khảo sát trong bộ nhớ cho unit test (không cần DB). */
public final class SurveyFixtures {
    private static long nextId = 1;

    private SurveyFixtures() {
    }

    public static JsonNode json(String raw) {
        return SurveyJson.parse(raw);
    }

    public static QuestionTypeRegistry registry() {
        return new QuestionTypeRegistry(List.of(new NumberQuestionType(), new TextQuestionType(),
                new TextareaQuestionType(), new SingleSelectQuestionType(), new MultipleSelectQuestionType(),
                new BooleanQuestionType()));
    }

    public static QuestionDefinition question(String code, String type, boolean required, String rules, String... optionCodes) {
        List<OptionDefinition> options = new ArrayList<>();
        for (int i = 0; i < optionCodes.length; i++) {
            options.add(new OptionDefinition(optionCodes[i], optionCodes[i], null, i + 1, true));
        }
        return new QuestionDefinition(nextId++, code, code, null, type, required, json(rules), null, null, null,
                true, options);
    }

    public static StepQuestion link(QuestionDefinition question, String condition) {
        JsonNode conditionJson = json(condition);
        return new StepQuestion(question, 1, true, conditionJson, ConditionParser.parse(conditionJson));
    }

    public static StepDefinition step(String code, StepQuestion... questions) {
        return new StepDefinition(code, code, null, 1, true, List.of(questions));
    }

    public static SurveyDefinition survey(StepDefinition... steps) {
        return new SurveyDefinition(1L, "TEST_SURVEY", "Test", null, 1, List.of(steps));
    }

    /** Bản thu nhỏ của khảo sát onboarding thật: đủ NUMBER, SINGLE/MULTIPLE_SELECT và điều kiện. */
    public static SurveyDefinition onboarding() {
        return survey(
                step("BODY_INFORMATION",
                        link(question("GENDER", "SINGLE_SELECT", true, null, "MALE", "FEMALE"), null),
                        link(question("AGE", "NUMBER", true, "{\"integerOnly\":true,\"min\":13,\"max\":100}"), null),
                        link(question("HEIGHT", "NUMBER", true, "{\"min\":100,\"max\":250,\"maxDecimals\":1}"), null)),
                step("GOALS_AND_MOTIVATION",
                        link(question("GOAL_TYPE", "SINGLE_SELECT", true, null, "HEALTH", "SKILLS"), null),
                        link(question("HEALTH_GOAL", "SINGLE_SELECT", true, null, "LOSE_WEIGHT", "STAY_FIT"),
                                "{\"operator\":\"EQ\",\"questionCode\":\"GOAL_TYPE\",\"value\":\"HEALTH\"}"),
                        link(question("TRAINING_SKILLS", "MULTIPLE_SELECT", true, "{\"minSelections\":1}",
                                        "MUSCLE_UP", "HANDSTAND", "PLANCHE"),
                                "{\"operator\":\"EQ\",\"questionCode\":\"GOAL_TYPE\",\"value\":\"SKILLS\"}"),
                        link(question("NOTE", "TEXT", false, "{\"maxLength\":20}"), null)));
    }
}
