-- V58: Phiếu góp ý & khiếu nại của Member.
--
-- Mục đích
-- ------
-- Member gửi ý kiến / khiếu nại (có tiêu đề + nội dung) từ thanh điều hướng.
-- Mọi đơn ban đầu đều do Content Manager tiếp nhận:
--   - Nếu Content Manager tự giải quyết được -> APPROVED/RESOLVED, trả trạng
--     thái lại cho Member kèm ghi chú xử lý.
--   - Nếu vấn đề thuộc về hệ thống -> ESCALATED, chuyển tiếp lên Admin.
-- Admin nhận các đơn đã chuyển tiếp và quyết định cuối cùng.
--
-- Vì sao tạo bảng mới
-- -------------------
-- `notifications` chỉ mang thông điệp một chiều, không lưu vòng đời của một
-- đơn (tiêu đề, nội dung, trạng thái, ghi chú xử lý, ai xử lý). Vì vậy cần một
-- bảng riêng cho đơn góp ý; việc gửi thông báo cho Member / Content Manager /
-- Admin vẫn dùng chung bảng `notifications` như các luồng khác.
--
-- `status`:
--   PENDING      — Member vừa gửi, chờ Content Manager tiếp nhận
--   IN_REVIEW    — Content Manager đã nhận việc và đang xử lý
--   ESCALATED    — Chuyển tiếp lên Admin (vấn đề thuộc về hệ thống)
--   RESOLVED     — Đã xử lý xong, trả trạng thái lại cho Member
--   REJECTED     — Không chấp nhận (Member gửi sai chỗ / không có cơ sở)
--
-- `category`:
--   GENERAL          — góp ý chung
--   EXERCISE_CONTENT — về bài tập trong thư viện
--   WORKOUT_CONTENT  — về workout trong thư viện
--   TECHNICAL        — lỗi kỹ thuật / hiệu năng của ứng dụng
--   OTHER            — khác

CREATE TABLE IF NOT EXISTS member_feedback (
    id BIGINT NOT NULL AUTO_INCREMENT,
    member_id BIGINT NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(32) NOT NULL DEFAULT 'GENERAL',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    resolution_note TEXT NULL,
    handled_by BIGINT NULL,
    escalated_at DATETIME(6) NULL,
    resolved_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_member_feedback_member (member_id, created_at),
    KEY idx_member_feedback_status (status, created_at),
    CONSTRAINT fk_member_feedback_member FOREIGN KEY (member_id)
        REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
