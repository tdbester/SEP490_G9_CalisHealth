package com.calishealth.dtos;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import tools.jackson.databind.JsonNode;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class SurveyDtos {

    // ---------- Definition (GET /api/surveys/{surveyCode}) ----------

    public record SurveyDefinitionResponse(
            String surveyCode,
            String surveyName,
            String description,
            int version,
            List<StepResponse> steps) {}

    public record StepResponse(
            String stepCode,
            String stepName,
            String description,
            int sortOrder,
            List<QuestionResponse> questions) {}

    public record QuestionResponse(
            String questionCode,
            String questionText,
            String description,
            String questionType,
            boolean required,
            JsonNode validationRules,
            JsonNode displayConfig,
            String unit,
            JsonNode defaultValue,
            int sortOrder,
            JsonNode conditionalRules,
            List<OptionResponse> options) {}

    public record OptionResponse(String optionCode, String label, String value, int sortOrder) {}

    // ---------- Sessions ----------

    public record StartSessionRequest(
            @NotBlank(message = "surveyCode is required")
            @Size(max = 64, message = "surveyCode must be at most 64 characters") String surveyCode) {}

    /**
     * surveyVersion (tùy chọn): version mà frontend đang hiển thị; khác version của phiên -> 409.
     */
    public record SaveAnswersRequest(
            Integer surveyVersion,
            @NotNull(message = "answers is required")
            @Size(min = 1, max = 100, message = "answers must contain 1 to 100 items")
            List<@Valid @NotNull(message = "answer item must not be null") AnswerItem> answers) {}

    /**
     * 1 câu trả lời: chỉ nhận questionCode + value. Phân biệt rõ:
     * - thiếu key "value"   -> lỗi VALUE_MISSING
     * - "value": null        -> xóa câu trả lời đã lưu
     * - field lạ (vd questionType, required) -> lỗi UNKNOWN_FIELD, backend không tin cấu hình từ client
     */
    public static class AnswerItem {
        @NotBlank(message = "questionCode is required")
        @Size(max = 64, message = "questionCode must be at most 64 characters")
        private String questionCode;

        private JsonNode value;
        private boolean valuePresent;
        private final Map<String, Object> unknownFields = new LinkedHashMap<>();

        public AnswerItem() {
        }

        public static AnswerItem of(String questionCode, JsonNode value) {
            AnswerItem item = new AnswerItem();
            item.setQuestionCode(questionCode);
            item.setValue(value);
            return item;
        }

        public String getQuestionCode() {
            return questionCode;
        }

        public void setQuestionCode(String questionCode) {
            this.questionCode = questionCode;
        }

        public JsonNode getValue() {
            return value;
        }

        /** Jackson gọi setter này cả khi JSON là null (-> NullNode), không gọi khi thiếu key. */
        public void setValue(JsonNode value) {
            this.value = value;
            this.valuePresent = true;
        }

        @JsonIgnore
        public boolean isValuePresent() {
            return valuePresent;
        }

        @JsonAnySetter
        public void addUnknownField(String name, Object fieldValue) {
            unknownFields.put(name, fieldValue);
        }

        @JsonIgnore
        public Map<String, Object> getUnknownFields() {
            return unknownFields;
        }
    }

    public record SessionResponse(
            Long sessionId,
            String surveyCode,
            int surveyVersion,
            String status,
            LocalDateTime startedAt,
            LocalDateTime completedAt,
            LocalDateTime skippedAt,
            LocalDateTime updatedAt,
            /** Bước đầu tiên còn thiếu câu bắt buộc (null nếu đã đủ) - để frontend tiếp tục đúng chỗ. */
            String currentStepCode,
            List<SessionStepResponse> steps) {}

    public record SessionStepResponse(
            String stepCode,
            int sortOrder,
            /** Đủ mọi câu bắt buộc đang áp dụng và không còn câu trả lời "không áp dụng". */
            boolean complete,
            List<SessionQuestionResponse> questions) {}

    public record SessionQuestionResponse(
            String questionCode,
            /** false = điều kiện hiển thị đang không thỏa với các câu trả lời hiện tại. */
            boolean applicable,
            boolean required,
            boolean answered,
            JsonNode value) {}

    public record SessionSummaryResponse(
            Long sessionId,
            String surveyCode,
            int surveyVersion,
            String status,
            LocalDateTime startedAt,
            LocalDateTime completedAt,
            LocalDateTime skippedAt) {}
}
