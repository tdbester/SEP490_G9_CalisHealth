package com.calishealth.service.survey;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.JsonNodeFactory;

/** Đọc/ghi các cột JSON của khảo sát (validation_rules, conditional_rules, answer_value...). */
public final class SurveyJson {
    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    private SurveyJson() {
    }

    public static JsonNodeFactory nodes() {
        return JsonNodeFactory.instance;
    }

    /** null/blank -> null; JSON hỏng -> IllegalArgumentException (do caller quyết định thông báo). */
    public static JsonNode parse(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return MAPPER.readTree(json);
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException("Invalid JSON: " + exception.getMessage(), exception);
        }
    }

    public static String write(JsonNode node) {
        return MAPPER.writeValueAsString(node);
    }

    /** Ghi 1 đối tượng (record cấu hình) thành chuỗi JSON để lưu vào cột JSON. */
    public static String writeValue(Object value) {
        return MAPPER.writeValueAsString(value);
    }

    /** null/blank -> null; JSON hỏng hoặc sai cấu trúc -> IllegalArgumentException. */
    public static <T> T read(String json, Class<T> type) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return MAPPER.readValue(json, type);
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException("Invalid JSON for " + type.getSimpleName() + ": "
                    + exception.getMessage(), exception);
        }
    }

    /** JSON null hoặc không có giá trị. */
    public static boolean isNull(JsonNode node) {
        return node == null || node.isNull() || node.isMissingNode();
    }
}
