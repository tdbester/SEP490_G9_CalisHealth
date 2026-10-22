package com.calishealth.service.survey.questiontype;

import com.calishealth.service.survey.definition.QuestionDefinition;
import tools.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Phần dùng chung: từ chối rule không được hỗ trợ (tránh gõ sai tên rule mà bị bỏ qua âm thầm)
 * và các hàm đọc rule có kiểm tra kiểu.
 */
public abstract class AbstractQuestionTypeHandler implements QuestionTypeHandler {

    /** Các key hợp lệ trong validation_rules cho loại câu hỏi này. */
    protected abstract Set<String> ruleKeys();

    /** Kiểm tra thêm theo loại câu hỏi; ghi lỗi vào problems. */
    protected void validateRules(QuestionDefinition question, List<String> problems) {
    }

    @Override
    public final List<String> validateConfig(QuestionDefinition question) {
        List<String> problems = new ArrayList<>();
        if (!question.validationRules().isObject()) {
            problems.add("validationRules must be a JSON object");
            return problems;
        }
        for (Map.Entry<String, JsonNode> rule : question.validationRules().properties()) {
            if (!ruleKeys().contains(rule.getKey())) {
                problems.add("Unsupported validation rule '" + rule.getKey() + "' for type " + type());
            }
        }
        if (problems.isEmpty()) {
            validateRules(question, problems);
        }
        return problems;
    }

    protected static BigDecimal decimalRule(QuestionDefinition question, String key, List<String> problems) {
        JsonNode node = question.rule(key);
        if (node == null) {
            return null;
        }
        if (!node.isNumber()) {
            problems.add("Rule '" + key + "' must be a number");
            return null;
        }
        return node.decimalValue();
    }

    protected static Integer intRule(QuestionDefinition question, String key, int minAllowed, List<String> problems) {
        JsonNode node = question.rule(key);
        if (node == null) {
            return null;
        }
        if (!node.isIntegralNumber() || !node.canConvertToInt() || node.intValue() < minAllowed) {
            problems.add("Rule '" + key + "' must be an integer >= " + minAllowed);
            return null;
        }
        return node.intValue();
    }

    protected static boolean booleanRule(QuestionDefinition question, String key, List<String> problems) {
        JsonNode node = question.rule(key);
        if (node == null) {
            return false;
        }
        if (!node.isBoolean()) {
            problems.add("Rule '" + key + "' must be true or false");
            return false;
        }
        return node.booleanValue();
    }

    /** Dùng lúc trả lời: cấu hình đã được SurveyConfigValidator kiểm tra nên không cần gom lỗi. */
    protected static List<String> ignoredProblems() {
        return new ArrayList<>();
    }
}
