-- V81: gộp gender / date_of_birth / bio vào member_profiles.
--
-- Trước đây 3 trường này nằm ở CẢ `users` và `member_profiles`, tức là một dữ liệu
-- được lưu 2 nơi và rất dễ lệch nhau (13 tài khoản seed có gender ở member_profiles
-- nhưng users lại NULL). Từ nay member_profiles là nơi DUY NHẤT quản lý:
--
--   users           : thông tin tài khoản (email, password, full_name, phone,
--                     avatar_url, role, enabled/blocked, must_change_password, ...)
--   member_profiles : thông tin cá nhân (gender, date_of_birth, bio) + dữ liệu
--                     fitness (height, weight, goals, level, streak, days_per_week)
--
-- Mọi tài khoản — kể cả Admin và Content Manager — đều có đúng 1 dòng
-- member_profiles, vì màn "Profile Information" dùng chung cho mọi vai trò nên
-- giới tính / ngày sinh / giới thiệu phải lưu được cho cả staff. Các cột fitness
-- của dòng đó vẫn để trống cho staff (leaderboard chỉ xếp hạng role = MEMBER).

-- ============================================================
-- 1. Bảo đảm mỗi tài khoản có một dòng member_profiles
-- ============================================================
INSERT INTO member_profiles (user_id)
SELECT u.id
FROM users u
WHERE NOT EXISTS (
    SELECT 1
    FROM member_profiles mp
    WHERE mp.user_id = u.id
);

-- ============================================================
-- 2. Chuyển dữ liệu còn nằm ở users sang member_profiles.
--    Bên nhận được giữ nguyên nếu đã có (đó là nơi khảo sát và các màn khác đọc),
--    chỉ điền vào chỗ còn trống.
-- ============================================================
UPDATE member_profiles mp
    JOIN users u ON u.id = mp.user_id
SET mp.gender        = COALESCE(mp.gender, u.gender),
    mp.date_of_birth = COALESCE(mp.date_of_birth, u.date_of_birth),
    mp.bio           = COALESCE(mp.bio, u.bio);

-- ============================================================
-- 3. Xóa 3 cột trùng lặp khỏi users.
--    Mỗi cột được xóa qua information_schema guard, giống cách V32/V36 thêm cột,
--    vì MySQL 8.0 không có DROP COLUMN IF EXISTS.
-- ============================================================
SET @db := DATABASE();

SET @has_gender := (SELECT COUNT(*) FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'gender');
SET @sql := IF(@has_gender = 0, 'DO 0', 'ALTER TABLE users DROP COLUMN gender');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_dob := (SELECT COUNT(*) FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'date_of_birth');
SET @sql := IF(@has_dob = 0, 'DO 0', 'ALTER TABLE users DROP COLUMN date_of_birth');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_bio := (SELECT COUNT(*) FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'bio');
SET @sql := IF(@has_bio = 0, 'DO 0', 'ALTER TABLE users DROP COLUMN bio');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
