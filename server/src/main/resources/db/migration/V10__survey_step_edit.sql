-- V5: Pop-up "Update step" (Content Manager).
--
--   survey_step_questions.required  Ghi đè cờ bắt buộc của câu hỏi TRONG bước này (nút "Required").
--                                   NULL = dùng assessment_questions.required. Tách ra đây vì 1 câu hỏi
--                                   trong ngân hàng có thể dùng lại ở nhiều survey version với yêu cầu khác nhau.
--   survey_steps.revision           Số phiên bản nội dung của bước, tăng mỗi lần nội dung đổi (không tăng khi
--                                   kéo thả thứ tự). Client gửi lại revision đã đọc khi "Save changes";
--                                   lệch -> 409 STEP_MODIFIED thay vì ghi đè thay đổi của người khác.

ALTER TABLE survey_step_questions
    ADD COLUMN required BIT(1) DEFAULT NULL AFTER sort_order;

ALTER TABLE survey_steps
    ADD COLUMN revision INT NOT NULL DEFAULT 0 AFTER status,
    ADD CONSTRAINT ck_survey_steps_revision CHECK (revision >= 0);
