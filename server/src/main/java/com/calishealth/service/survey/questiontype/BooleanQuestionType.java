package com.calishealth.service.survey.questiontype;

import com.calishealth.service.survey.SurveyJson;
import com.calishealth.service.survey.definition.QuestionDefinition;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.util.Set;

/** BOOLEAN: chỉ nhận JSON true/false; không đổi "yes", "1", "true" (chuỗi) thành boolean. */
@Component
public class BooleanQuestionType extends AbstractQuestionTypeHandler {
    @Override
    public String type() {
        return "BOOLEAN";
    }

    @Override
    protected Set<String> ruleKeys() {
        return Set.of();
    }

    @Override
    public AnswerCheck check(QuestionDefinition question, JsonNode value) {
        if (!value.isBoolean()) {
            return AnswerCheck.fail(AnswerCheck.TYPE_MISMATCH, "Value must be true or false");
        }
        return AnswerCheck.ok(SurveyJson.nodes().booleanNode(value.booleanValue()));
    }
}
