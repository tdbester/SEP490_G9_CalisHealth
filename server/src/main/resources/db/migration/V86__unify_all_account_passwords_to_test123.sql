-- V86: đưa MỌI tài khoản trong `users` về mật khẩu chuẩn `Test@123`.
--
-- LÝ DO
--   Repo có nhiều mật khẩu seed khác nhau rải rác trong các migration cũ:
--     - `Test@123`  : admin, demo.member, demo.content, survey.test  (V16/V21/V54)
--     - `123456`    : leaderboard.member*, dashboard.*, halevinh1000, demo@  (V4/V5/V61)
--     - `Calis@123` : contentmanager                                       (V5)
--   Người demo phải nhớ mật khẩu khác nhau cho từng tài khoản -> rất dễ nhầm.
--   Migration này gán lại một mật khẩu chung cho toàn bộ bảng `users`.
--
-- AN TOÀN
--   - Chỉ đụng bảng `users`, không đụng dữ liệu nghiệp vụ (bài tập, workout, buổi tập...).
--   - Idempotent: chạy lại nhiều lần cho cùng kết quả.
--   - `must_change_password = FALSE` để không ai bị bắt đổi mật khẩu ngay khi demo
--     (trước đây content manager bị bắt đổi mật khẩu mặc định khi login).
--
-- LƯU Ý
--   Hash BCrypt của `Test@123` (cost 10, prefix $2a$) — đã được kiểm chứng bằng
--   endpoint /api/auth/login cho cả 4 nhóm tài khoản seed sẵn có.
--
--   File này CHỈ dùng cho môi trường demo/local. Khi triển khai thật, dùng
--   `AdminUserService` để tạo tài khoản (mật khẩu được hash bằng BCrypt từ
--   `PasswordEncoder` của Spring) thay vì hard-code hash như ở đây.

-- ============================================================
-- 1. Gán lại mật khẩu cho toàn bộ tài khoản
-- ============================================================
UPDATE users
SET password = '$2a$10$RdWDAbR1skkfFOExLF6LluIxK2H7EuNOGvqPnASpDJUSznJxfn2Gq',
    must_change_password = FALSE;

-- ============================================================
-- 2. Bảo đảm không tài khoản nào bị khoá / chưa xác minh email
--    (một tài khoản bị `blocked` hoặc `enabled = FALSE` thì không đăng nhập được
--    dù mật khẩu đúng).
-- ============================================================
UPDATE users
SET enabled = TRUE,
    blocked = FALSE
WHERE enabled = FALSE OR blocked = TRUE;
