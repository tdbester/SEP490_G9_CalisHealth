package com.calishealth.service.survey.questiontype;

import com.calishealth.service.survey.SurveyJson;
import com.calishealth.service.survey.definition.QuestionDefinition;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.Set;

/** SINGLE_SELECT: giá trị là 1 optionCode (string) thuộc các lựa chọn ACTIVE trong DB. */
@Component
public class SingleSelectQuestionType extends AbstractQuestionTypeHandler {
    @Override
    public String type() {
        return "SINGLE_SELECT";
    }

    @Override
    protected Set<String> ruleKeys() {
        return Set.of();
    }

    @Override
    protected void validateRules(QuestionDefinition question, List<String> problems) {
        if (question.activeOptions().isEmpty()) {
            problems.add("SINGLE_SELECT requires at least one active option");
        }
    }

    @Override
    public AnswerCheck check(QuestionDefinition question, JsonNode value) {
        if (!value.isString()) {
            return AnswerCheck.fail(AnswerCheck.TYPE_MISMATCH, "Value must be a single option code (string)");
        }
        String code = value.stringValue();
        if (question.activeOption(code).isEmpty()) {
            return AnswerCheck.fail(AnswerCheck.INVALID_OPTION, "'" + code + "' is not a valid option");
        }
        return AnswerCheck.ok(SurveyJson.nodes().stringNode(code));
    }
}
