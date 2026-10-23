package com.calishealth.service.survey.questiontype;

import com.calishealth.service.survey.SurveyJson;
import com.calishealth.service.survey.definition.QuestionDefinition;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

/**
 * NUMBER: chỉ nhận JSON number (chuỗi "22" bị từ chối).
 * Rules: min, max, integerOnly (true/false), maxDecimals (số chữ số thập phân tối đa).
 */
@Component
public class NumberQuestionType extends AbstractQuestionTypeHandler {
    private static final Set<String> RULES = Set.of("min", "max", "integerOnly", "maxDecimals");

    @Override
    public String type() {
        return "NUMBER";
    }

    @Override
    protected Set<String> ruleKeys() {
        return RULES;
    }

    @Override
    protected void validateRules(QuestionDefinition question, List<String> problems) {
        BigDecimal min = decimalRule(question, "min", problems);
        BigDecimal max = decimalRule(question, "max", problems);
        booleanRule(question, "integerOnly", problems);
        intRule(question, "maxDecimals", 0, problems);
        if (min != null && max != null && min.compareTo(max) > 0) {
            problems.add("Rule 'min' must be <= 'max'");
        }
    }

    @Override
    public AnswerCheck check(QuestionDefinition question, JsonNode value) {
        if (!value.isNumber() || (value.isFloatingPointNumber() && !Double.isFinite(value.doubleValue()))) {
            return AnswerCheck.fail(AnswerCheck.TYPE_MISMATCH, "Value must be a number");
        }
        BigDecimal number = value.decimalValue().stripTrailingZeros();
        List<String> ignored = ignoredProblems();

        if (booleanRule(question, "integerOnly", ignored) && number.scale() > 0) {
            return AnswerCheck.fail(AnswerCheck.NOT_AN_INTEGER, "Value must be a whole number");
        }
        Integer maxDecimals = intRule(question, "maxDecimals", 0, ignored);
        if (maxDecimals != null && number.scale() > maxDecimals) {
            return AnswerCheck.fail(AnswerCheck.TOO_MANY_DECIMALS,
                    "Value must have at most " + maxDecimals + " decimal place(s)");
        }
        BigDecimal min = decimalRule(question, "min", ignored);
        BigDecimal max = decimalRule(question, "max", ignored);
        if ((min != null && number.compareTo(min) < 0) || (max != null && number.compareTo(max) > 0)) {
            return AnswerCheck.fail(AnswerCheck.VALUE_OUT_OF_RANGE, rangeMessage(min, max, question.unit()));
        }

        JsonNode normalized = number.scale() <= 0
                ? SurveyJson.nodes().numberNode(number.toBigIntegerExact())
                : SurveyJson.nodes().numberNode(number);
        return AnswerCheck.ok(normalized);
    }

    private static String rangeMessage(BigDecimal min, BigDecimal max, String unit) {
        String suffix = unit == null ? "" : " " + unit;
        if (min != null && max != null) {
            return "Value must be between " + min.toPlainString() + " and " + max.toPlainString() + suffix;
        }
        return min != null
                ? "Value must be at least " + min.toPlainString() + suffix
                : "Value must be at most " + max.toPlainString() + suffix;
    }
}
