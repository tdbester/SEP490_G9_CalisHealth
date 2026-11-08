-- V38: AI Support — gắn session id cho từng câu hỏi.
--
-- Mỗi lần member mở popup AI Support, client sinh một session id (UUID) và
-- gửi kèm câu hỏi. Server đếm số câu theo (user, session id) để áp dụng giới
-- hạn 5 câu/phiên chat — đúng ý nghĩa "một phiên popup" thay vì đoán theo
-- khoảng cách thời gian.
--
-- Câu hỏi cũ (trước V38) có session_id NULL -> không tính vào phiên nào.

ALTER TABLE ai_support_messages
    ADD COLUMN session_id VARCHAR(64) NULL AFTER exercise_id;

CREATE INDEX idx_ai_support_messages_user_session
    ON ai_support_messages (user_id, session_id, created_at);
