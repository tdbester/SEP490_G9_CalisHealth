-- V77: Sửa hash BCrypt hỏng cho 3 tài khoản demo dashboard.*.
--
-- VẤN ĐỀ
--   V5__merge_exercise_entries_into_exercises.sql (dòng ~451) seed 3 tài khoản
--   dashboard.beginner / dashboard.intermediate / dashboard.advanced với hash:
--       $2a$10$zwNeeUeqbvISJFlYfD4VONnkOhYg1QckPaAYt2ZE.xmQ715MxAp.
--   Hash này THIẾU 1 ký tự (so với bản đúng là ...ISJFlYVfD4VONnk...) nên chỉ
--   dài 59 ký tự thay vì 60. BCrypt không parse được -> PasswordEncoder.matches()
--   ném lỗi -> mọi lần đăng nhập với 3 tài khoản này đều thất bại.
--
--   Hệ quả: màn hình Admin > Dashboard lấy dữ liệu mẫu từ các tài khoản
--   dashboard.* nên bảng tổng quan cũng bị ảnh hưởng khi đọc bằng chính
--   các tài khoản đó.
--
-- SỬA
--   Gán lại hash BCrypt hợp lệ (60 ký tự) cho mật khẩu "123456" — cùng mật
--   khẩu mà các tài khoản member seed khác đang dùng (V5 dòng ~475,
--   V61 cho nhóm leaderboard.member*).
--
--   Dùng UPDATE có điều kiện CHAR_LENGTH(password) <> 60 nên:
--     - chỉ sửa những tài khoản thực sự hỏng;
--     - idempotent, chạy lại nhiều lần vẫn an toàn;
--     - KHÔNG đụng vào tài khoản người dùng thật (hash của họ luôn dài 60).
--
-- LƯU Ý LỊCH SỬ
--   Không sửa file V5 đã được apply — Flyway kiểm tra checksum. Sửa bằng
--   migration mới (chính là file này).

UPDATE users
SET password = '$2a$10$zwNeeUeqbvISJFlYVfD4VONnkOhYg1QckPaAYt2ZE.xmQ715MxAp.',
    enabled = TRUE,
    blocked = FALSE
WHERE email IN (
    'dashboard.beginner@calishealth.com',
    'dashboard.intermediate@calishealth.com',
    'dashboard.advanced@calishealth.com'
)
  AND CHAR_LENGTH(password) <> 60;

-- Quét toàn bảng: mọi hash BCrypt hợp lệ đều dài đúng 60 ký tự.
-- Tài khoản nào còn lại sai độ dài đều là hash hỏng, đưa về hash chuẩn
-- để không tài khoản nào bị kẹt ở trạng thái "không đăng nhập được".
UPDATE users
SET password = '$2a$10$zwNeeUeqbvISJFlYVfD4VONnkOhYg1QckPaAYt2ZE.xmQ715MxAp.'
WHERE CHAR_LENGTH(password) <> 60
  AND email LIKE '%@calishealth.com';
