package com.calishealth.service.survey.questiontype;

import com.calishealth.service.survey.SurveyJson;
import com.calishealth.service.survey.definition.OptionDefinition;
import com.calishealth.service.survey.definition.QuestionDefinition;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * MULTIPLE_SELECT: mảng optionCode, không trùng, tất cả phải là lựa chọn ACTIVE.
 * Rules: minSelections (mặc định 1), maxSelections. Lưu theo thứ tự sortOrder của lựa chọn
 * để cùng một tập lựa chọn luôn cho cùng một giá trị lưu trữ.
 */
@Component
public class MultipleSelectQuestionType extends AbstractQuestionTypeHandler {
    private static final Set<String> RULES = Set.of("minSelections", "maxSelections");

    @Override
    public String type() {
        return "MULTIPLE_SELECT";
    }

    @Override
    protected Set<String> ruleKeys() {
        return RULES;
    }

    @Override
    protected void validateRules(QuestionDefinition question, List<String> problems) {
        if (question.activeOptions().isEmpty()) {
            problems.add("MULTIPLE_SELECT requires at least one active option");
        }
        Integer min = intRule(question, "minSelections", 0, problems);
        Integer max = intRule(question, "maxSelections", 1, problems);
        if (min != null && max != null && min > max) {
            problems.add("Rule 'minSelections' must be <= 'maxSelections'");
        }
    }

    @Override
    public AnswerCheck check(QuestionDefinition question, JsonNode value) {
        if (!value.isArray()) {
            return AnswerCheck.fail(AnswerCheck.TYPE_MISMATCH, "Value must be an array of option codes");
        }
        Set<String> selected = new HashSet<>();
        List<String> invalid = new ArrayList<>();
        for (int i = 0; i < value.size(); i++) {
            JsonNode item = value.get(i);
            if (!item.isString()) {
                return AnswerCheck.fail(AnswerCheck.TYPE_MISMATCH, "Every selected option must be an option code (string)");
            }
            String code = item.stringValue();
            if (!selected.add(code)) {
                return AnswerCheck.fail(AnswerCheck.DUPLICATE_OPTION, "Option '" + code + "' is selected more than once");
            }
            if (question.activeOption(code).isEmpty()) {
                invalid.add(code);
            }
        }
        if (!invalid.isEmpty()) {
            return AnswerCheck.fail(AnswerCheck.INVALID_OPTION, "Invalid option(s): " + String.join(", ", invalid));
        }

        List<String> ignored = ignoredProblems();
        Integer configuredMin = intRule(question, "minSelections", 0, ignored);
        int min = configuredMin == null ? 1 : configuredMin;
        Integer max = intRule(question, "maxSelections", 1, ignored);
        if (selected.size() < min) {
            return AnswerCheck.fail(AnswerCheck.TOO_FEW_SELECTIONS, "Select at least " + min + " option(s)");
        }
        if (max != null && selected.size() > max) {
            return AnswerCheck.fail(AnswerCheck.TOO_MANY_SELECTIONS, "Select at most " + max + " option(s)");
        }

        ArrayNode normalized = SurveyJson.nodes().arrayNode();
        for (OptionDefinition option : question.activeOptions()) {
            if (selected.contains(option.code())) {
                normalized.add(option.code());
            }
        }
        return AnswerCheck.ok(normalized);
    }
}
