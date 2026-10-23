package com.calishealth.service.survey.definition;

import com.calishealth.service.survey.condition.Condition;
import tools.jackson.databind.JsonNode;

/** Câu hỏi đặt trong 1 bước: thứ tự, điều kiện hiển thị và trạng thái liên kết. */
public record StepQuestion(
        QuestionDefinition question,
        int sortOrder,
        boolean linkActive,
        JsonNode conditionJson,
        Condition condition
) {
    /** Câu hỏi chỉ được trả lời khi cả liên kết lẫn câu hỏi đều ACTIVE. */
    public boolean active() {
        return linkActive && question.active();
    }
}
