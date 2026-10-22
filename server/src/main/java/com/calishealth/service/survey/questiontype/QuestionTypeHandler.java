package com.calishealth.service.survey.questiontype;

import com.calishealth.service.survey.definition.QuestionDefinition;
import tools.jackson.databind.JsonNode;

import java.util.List;

/**
 * Hợp đồng cho 1 loại câu hỏi. Thêm loại mới = thêm 1 @Component implement interface này;
 * QuestionTypeRegistry tự nhận, không phải sửa service/controller hay các handler khác.
 */
public interface QuestionTypeHandler {
    /** Giá trị khớp cột assessment_questions.question_type, ví dụ "NUMBER". */
    String type();

    /** Kiểm tra cấu hình câu hỏi (validation_rules, options...). Trả về danh sách lỗi, rỗng nếu hợp lệ. */
    List<String> validateConfig(QuestionDefinition question);

    /**
     * Kiểm tra 1 giá trị trả lời (đã chắc chắn khác JSON null) và trả về giá trị chuẩn hóa để lưu.
     */
    AnswerCheck check(QuestionDefinition question, JsonNode value);
}
