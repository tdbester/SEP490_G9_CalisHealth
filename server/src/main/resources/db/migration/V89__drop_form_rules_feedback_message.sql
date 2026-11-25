-- Gỡ cột "feedback_message" khỏi bảng form_rules.
--
-- Lý do:
--   Cột này lưu câu nhắc tiếng Anh do Content Manager gõ tay cho từng ngưỡng
--   chấm form (voice coach). Cơ chế này không mang thông tin kỹ thuật nào:
--     - Chấm điểm vẫn chạy hoàn toàn bằng góc / dung sai / trọng số.
--     - Mẹo sửa form (Form correction) đã có bộ mẹo dựng sẵn theo từng khớp
--       (JOINT_TIPS trong FormCorrectionService) làm phương án dự phòng.
--     - Câu nhắc tiếng Anh không khớp ngôn ngữ đang dùng của member.
--   Vì vậy lớp "voice coach của form rules threshold" bị gỡ hoàn toàn.
--
-- Lưu ý:
--   - Không đụng tới cột "feedback_message" của bảng khác (nếu có) vì câu lệnh
--     có kiểm tra đúng tên bảng.
--   - Cột được sinh ra ở V3, dùng lại ở V35 và V87; các migration cũ giữ nguyên
--     để không phá checksum Flyway.

SET @has_feedback := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'form_rules' AND COLUMN_NAME = 'feedback_message');
SET @sql := IF(@has_feedback > 0,
    'ALTER TABLE form_rules DROP COLUMN feedback_message', 'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
