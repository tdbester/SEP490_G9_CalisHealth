package com.calishealth.service.survey.questiontype;

import tools.jackson.databind.JsonNode;

/** Kết quả kiểm tra 1 câu trả lời: hoặc giá trị đã chuẩn hóa, hoặc mã lỗi + thông báo. */
public record AnswerCheck(JsonNode normalized, String errorCode, String message) {
    public static final String TYPE_MISMATCH = "TYPE_MISMATCH";
    public static final String VALUE_OUT_OF_RANGE = "VALUE_OUT_OF_RANGE";
    public static final String NOT_AN_INTEGER = "NOT_AN_INTEGER";
    public static final String TOO_MANY_DECIMALS = "TOO_MANY_DECIMALS";
    public static final String EMPTY_VALUE = "EMPTY_VALUE";
    public static final String TOO_SHORT = "TOO_SHORT";
    public static final String TOO_LONG = "TOO_LONG";
    public static final String PATTERN_MISMATCH = "PATTERN_MISMATCH";
    public static final String INVALID_OPTION = "INVALID_OPTION";
    public static final String DUPLICATE_OPTION = "DUPLICATE_OPTION";
    public static final String TOO_FEW_SELECTIONS = "TOO_FEW_SELECTIONS";
    public static final String TOO_MANY_SELECTIONS = "TOO_MANY_SELECTIONS";

    public static AnswerCheck ok(JsonNode normalized) {
        return new AnswerCheck(normalized, null, null);
    }

    public static AnswerCheck fail(String errorCode, String message) {
        return new AnswerCheck(null, errorCode, message);
    }

    public boolean valid() {
        return errorCode == null;
    }
}
