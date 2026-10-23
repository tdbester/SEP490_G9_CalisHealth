package com.calishealth.service.survey.condition;

import com.calishealth.service.survey.SurveyJson;
import com.calishealth.service.survey.condition.Condition.Operator;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Parse cột survey_step_questions.conditional_rules. Cú pháp:
 * <pre>
 * {"operator": "EQ", "questionCode": "GOAL_TYPE", "value": "SKILLS"}
 * {"operator": "IN", "questionCode": "TRAINING_EXPERIENCE", "value": ["MONTHS_6_TO_12", "OVER_1_YEAR"]}
 * {"operator": "AND", "conditions": [ {...}, {...} ]}
 * </pre>
 * Cấu hình sai -> IllegalArgumentException (SurveyConfigValidator đổi thành lỗi cấu hình).
 */
public final class ConditionParser {
    private static final int MAX_DEPTH = 8;
    private static final Set<String> COMPARE_KEYS = Set.of("operator", "questionCode", "value");
    private static final Set<String> GROUP_KEYS = Set.of("operator", "conditions");

    private ConditionParser() {
    }

    /** null/JSON null -> null (không có điều kiện = luôn hiển thị). */
    public static Condition parse(JsonNode json) {
        return SurveyJson.isNull(json) ? null : parse(json, 1);
    }

    private static Condition parse(JsonNode json, int depth) {
        if (depth > MAX_DEPTH) {
            throw new IllegalArgumentException("Condition nesting is deeper than " + MAX_DEPTH);
        }
        if (!json.isObject()) {
            throw new IllegalArgumentException("Condition must be a JSON object");
        }
        JsonNode operatorNode = json.get("operator");
        if (operatorNode == null || !operatorNode.isString()) {
            throw new IllegalArgumentException("Condition requires a string 'operator'");
        }
        Operator operator;
        try {
            operator = Operator.valueOf(operatorNode.stringValue().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Unsupported condition operator '" + operatorNode.stringValue() + "'");
        }
        rejectUnknownKeys(json, operator.isGroup() ? GROUP_KEYS : COMPARE_KEYS);

        if (operator.isGroup()) {
            JsonNode items = json.get("conditions");
            if (items == null || !items.isArray() || items.isEmpty()) {
                throw new IllegalArgumentException(operator + " requires a non-empty 'conditions' array");
            }
            List<Condition> children = new ArrayList<>();
            for (int i = 0; i < items.size(); i++) {
                children.add(parse(items.get(i), depth + 1));
            }
            return new Condition.Group(operator, children);
        }

        JsonNode questionCode = json.get("questionCode");
        if (questionCode == null || !questionCode.isString() || questionCode.stringValue().isBlank()) {
            throw new IllegalArgumentException(operator + " requires a 'questionCode'");
        }
        JsonNode value = json.get("value");
        if (SurveyJson.isNull(value)) {
            throw new IllegalArgumentException(operator + " requires a 'value'");
        }
        switch (operator) {
            case IN, NOT_IN -> {
                if (!value.isArray() || value.isEmpty()) {
                    throw new IllegalArgumentException(operator + " requires a non-empty array 'value'");
                }
            }
            case GT, GTE, LT, LTE -> {
                if (!value.isNumber()) {
                    throw new IllegalArgumentException(operator + " requires a numeric 'value'");
                }
            }
            default -> {
                if (!value.isValueNode()) {
                    throw new IllegalArgumentException(operator + " requires a scalar 'value'");
                }
            }
        }
        return new Condition.Compare(operator, questionCode.stringValue(), value);
    }

    private static void rejectUnknownKeys(JsonNode json, Set<String> allowed) {
        for (var entry : json.properties()) {
            if (!allowed.contains(entry.getKey())) {
                throw new IllegalArgumentException("Unknown condition key '" + entry.getKey() + "'");
            }
        }
    }
}
