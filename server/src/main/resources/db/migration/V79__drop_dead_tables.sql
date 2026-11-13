-- V79: Xoá 3 bảng đã chết (không còn đường ghi dữ liệu nào trong runtime).
--
--   form_error_logs        -> MediaPipe chỉ lưu issue trong sessionStorage, chưa bao giờ ghi xuống DB.
--                            Chỉ được đọc cho card "Lỗi form thường gặp" (đã gỡ khỏi PerformanceAnalytics).
--   member_saved_exercises -> bị member_favorites (ItemType MEMBER_EXERCISE/SYSTEM_EXERCISE) thay thế từ V57.
--   member_exercise_progress -> bị member_skill_progress thay thế (ProgressionRuleService cập nhật khi hoàn thành tập).
--
-- Cả 3 bảng đều có 0 dòng dữ liệu trên môi trường dev. FK tới chúng cũng đã được gỡ
-- trong các migration trước (V66/V67/V68), nên không cần tháo ràng buộc thủ công.

SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS form_error_logs;
DROP TABLE IF EXISTS member_saved_exercises;
DROP TABLE IF EXISTS member_exercise_progress;

SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;
