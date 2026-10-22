package com.calishealth.service.survey.questiontype;

import com.calishealth.service.survey.SurveyJson;
import com.calishealth.service.survey.definition.QuestionDefinition;
import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

/**
 * Văn bản: chỉ nhận JSON string, không nhận chuỗi rỗng/toàn khoảng trắng (muốn xóa thì gửi null).
 * Rules: minLength, maxLength, pattern (regex, phải khớp toàn chuỗi).
 */
public abstract class AbstractTextQuestionType extends AbstractQuestionTypeHandler {
    private static final Set<String> RULES = Set.of("minLength", "maxLength", "pattern");
    /** Giới hạn cứng, kể cả khi cấu hình maxLength lớn hơn. */
    static final int HARD_MAX_LENGTH = 10_000;

    protected abstract int defaultMaxLength();

    @Override
    protected Set<String> ruleKeys() {
        return RULES;
    }

    @Override
    protected void validateRules(QuestionDefinition question, List<String> problems) {
        Integer min = intRule(question, "minLength", 0, problems);
        Integer max = intRule(question, "maxLength", 1, problems);
        if (max != null && max > HARD_MAX_LENGTH) {
            problems.add("Rule 'maxLength' must be <= " + HARD_MAX_LENGTH);
        }
        if (min != null && min > (max == null ? defaultMaxLength() : max)) {
            problems.add("Rule 'minLength' must be <= maxLength");
        }
        JsonNode pattern = question.rule("pattern");
        if (pattern != null) {
            if (!pattern.isString()) {
                problems.add("Rule 'pattern' must be a string");
            } else {
                try {
                    Pattern.compile(pattern.stringValue());
                } catch (PatternSyntaxException exception) {
                    problems.add("Rule 'pattern' is not a valid regular expression");
                }
            }
        }
    }

    @Override
    public AnswerCheck check(QuestionDefinition question, JsonNode value) {
        if (!value.isString()) {
            return AnswerCheck.fail(AnswerCheck.TYPE_MISMATCH, "Value must be a text string");
        }
        String text = value.stringValue();
        if (text.isBlank()) {
            return AnswerCheck.fail(AnswerCheck.EMPTY_VALUE, "Value must not be empty; send null to clear the answer");
        }
        List<String> ignored = ignoredProblems();
        int length = text.codePointCount(0, text.length());
        Integer min = intRule(question, "minLength", 0, ignored);
        Integer configuredMax = intRule(question, "maxLength", 1, ignored);
        int max = Math.min(configuredMax == null ? defaultMaxLength() : configuredMax, HARD_MAX_LENGTH);
        if (min != null && length < min) {
            return AnswerCheck.fail(AnswerCheck.TOO_SHORT, "Value must be at least " + min + " characters");
        }
        if (length > max) {
            return AnswerCheck.fail(AnswerCheck.TOO_LONG, "Value must be at most " + max + " characters");
        }
        JsonNode pattern = question.rule("pattern");
        if (pattern != null && !Pattern.compile(pattern.stringValue()).matcher(text).matches()) {
            return AnswerCheck.fail(AnswerCheck.PATTERN_MISMATCH, "Value has an invalid format");
        }
        return AnswerCheck.ok(SurveyJson.nodes().stringNode(text));
    }
}
