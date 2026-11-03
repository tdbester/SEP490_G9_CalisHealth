-- =====================================================================================
-- SEED DỮ LIỆU MẪU CHO MEMBER HEALTH & WORKOUT TRACKING
-- =====================================================================================
-- File này dùng để nạp dữ liệu mẫu thực tế cho các màn hình Tracking:
--   1. Màn 5.1: Health Tracking Overview (Health Score, Body Metrics, BMI 6 tháng)
--   2. Màn 5.2: Update Stats Modal
--   3. Màn 5.3: Workout History (Tổng hợp 18 buổi, lọc Strength/Cardio, gom nhóm theo tháng)
--   4. Màn 5.4: Workout Log Modal (Chi tiết bài tập, sets, reps, accuracy, thời lượng)
--   5. Màn 5.5: Performance Analytics (Donut lỗi form AI, Clean rep ratio, Volume, Active vs Rest)
--   6. Màn Day Streak & Day Report (/day-streak)
--
-- Hướng dẫn sử dụng:
--   1. Sửa email ở dòng @member_email thành email tài khoản bạn đang đăng nhập để test.
--   2. Chạy script này trong MySQL Workbench hoặc CLI.
-- =====================================================================================

USE calishealth;
SET NAMES utf8mb4;

-- Tắt safe updates và foreign key checks tạm thời để chạy script seed trong MySQL Workbench
SET SQL_SAFE_UPDATES = 0;
SET FOREIGN_KEY_CHECKS = 0;

-- >>> SỬA EMAIL MEMBER NÀY THÀNH EMAIL TÀI KHOẢN BẠN ĐANG DÙNG TEST TRÊN WEB <<<
SET @member_email = 'member@example.com';

START TRANSACTION;

-- -------------------------------------------------------------------------------------
-- 1. Đảm bảo user và member_profile tồn tại
-- -------------------------------------------------------------------------------------
INSERT IGNORE INTO fitness_levels (name) VALUES ('Beginner'), ('Intermediate'), ('Advanced');
SET @level_inter = (SELECT id FROM fitness_levels WHERE name = 'Intermediate' LIMIT 1);

-- Tạo user mẫu nếu chưa có
INSERT INTO users (email, password, full_name, role, enabled, created_at)
SELECT @member_email, '$2a$10$w8T0m6y2zJ07qF3eY0y9.e7E5zQZ1bA1K2b3C4d5E6f7G8h9I0J1K', 'Alex Johnson', 'MEMBER', 1, NOW(6) - INTERVAL 180 DAY
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = @member_email);

SET @user_id = (SELECT id FROM users WHERE email = @member_email LIMIT 1);

-- Tạo hoặc cập nhật member_profile với thông tin ban đầu giống như sau khi hoàn thành Survey
INSERT INTO member_profiles (user_id, gender, date_of_birth, weight, height, goals, streak_count, longest_streak, fitness_level_id, bio)
VALUES (@user_id, 'MALE', '1998-05-15', 68.4, 172.0, 'SKILL_MASTERY', 6, 14, @level_inter, 'Calisthenics enthusiast focused on muscle-up and clean form.')
ON DUPLICATE KEY UPDATE 
    weight = 68.4, 
    height = 172.0, 
    streak_count = 6, 
    longest_streak = 14, 
    fitness_level_id = @level_inter;

SET @profile_id = (SELECT id FROM member_profiles WHERE user_id = @user_id LIMIT 1);

-- -------------------------------------------------------------------------------------
-- 2. Dọn dữ liệu cũ của member này (để tránh trùng lặp khi chạy lại nhiều lần)
-- -------------------------------------------------------------------------------------
DELETE FROM form_error_logs 
WHERE session_exercise_result_id IN (
    SELECT id FROM (
        SELECT ser.id FROM session_exercise_results ser
        JOIN workout_sessions ws ON ws.id = ser.workout_session_id
        WHERE ws.member_profile_id = @profile_id
    ) AS tmp_ser
);

DELETE FROM session_exercise_results 
WHERE workout_session_id IN (
    SELECT id FROM (
        SELECT id FROM workout_sessions WHERE member_profile_id = @profile_id
    ) AS tmp_ws
);

DELETE FROM workout_sessions WHERE member_profile_id = @profile_id;
DELETE FROM member_body_metrics WHERE member_profile_id = @profile_id;

-- -------------------------------------------------------------------------------------
-- 3. Seed Lịch sử số đo cơ thể 6 tháng gần nhất (Màn 5.1 & 5.2 - BMI by month)
-- -------------------------------------------------------------------------------------
-- Chuỗi BMI: 22.1 (Tháng 5) -> 22.4 (Tháng 6) -> 22.7 (Tháng 7) -> 22.9 (Tháng 8) -> 23.1 (Tháng 9) -> 23.0 (Tháng 10)
INSERT INTO member_body_metrics (member_profile_id, weight_kg, height_cm, bmi, recorded_at, note)
VALUES 
    (@profile_id, 65.4, 172.0, 22.1, '2026-05-31 23:59:00', 'Cuối tháng 5'),
    (@profile_id, 66.3, 172.0, 22.4, '2026-06-30 23:59:00', 'Cuối tháng 6'),
    (@profile_id, 67.2, 172.0, 22.7, '2026-07-31 23:59:00', 'Cuối tháng 7'),
    (@profile_id, 67.8, 172.0, 22.9, '2026-08-31 23:59:00', 'Cuối tháng 8'),
    (@profile_id, 68.4, 172.0, 23.1, '2026-09-30 23:59:00', 'Cuối tháng 9'),
    (@profile_id, 68.1, 172.0, 23.0, NOW(6), 'Cập nhật định kỳ tuần 4 tháng 10');

-- -------------------------------------------------------------------------------------
-- 4. Seed Danh mục bài tập (Exercises) và Quy tắc bắt lỗi dáng AI (Form Rules)
-- -------------------------------------------------------------------------------------
INSERT IGNORE INTO exercises (id, name, type, category, difficulty_level, updated_at) VALUES 
    (1, 'Bench Press', 'STRENGTH', 'Chest', 'Intermediate', NOW(6)),
    (2, 'Lat Pulldown', 'STRENGTH', 'Back', 'Beginner', NOW(6)),
    (3, 'Shoulder Press', 'STRENGTH', 'Shoulders', 'Intermediate', NOW(6)),
    (4, 'Cable Row', 'STRENGTH', 'Back', 'Beginner', NOW(6)),
    (5, 'Burpees', 'CARDIO', 'Full Body', 'Intermediate', NOW(6)),
    (6, 'Mountain Climbers', 'CARDIO', 'Core', 'Beginner', NOW(6)),
    (7, 'Jump Squats', 'CARDIO', 'Legs', 'Intermediate', NOW(6)),
    (8, 'High Knees', 'CARDIO', 'Legs', 'Beginner', NOW(6)),
    (9, 'Pistol Squat', 'STRENGTH', 'Legs', 'Advanced', NOW(6)),
    (10, 'Bulgarian Split Squat', 'STRENGTH', 'Legs', 'Intermediate', NOW(6)),
    (11, 'Nordic Curl', 'STRENGTH', 'Legs', 'Advanced', NOW(6)),
    (12, 'Calf Raise', 'STRENGTH', 'Legs', 'Beginner', NOW(6)),
    (13, 'Hollow Body Hold', 'MOBILITY', 'Core', 'Intermediate', NOW(6)),
    (14, 'Hanging Leg Raise', 'MOBILITY', 'Core', 'Intermediate', NOW(6)),
    (15, 'Deep Squat Hold', 'MOBILITY', 'Legs', 'Beginner', NOW(6)),
    (16, 'Pull-up', 'STRENGTH', 'Back', 'Intermediate', NOW(6)),
    (17, 'Push-up', 'STRENGTH', 'Chest', 'Beginner', NOW(6)),
    (18, 'Dip', 'STRENGTH', 'Chest', 'Intermediate', NOW(6)),
    (19, 'Plank', 'MOBILITY', 'Core', 'Beginner', NOW(6)),
    (20, 'Muscle-up', 'STRENGTH', 'Full Body', 'Advanced', NOW(6));

-- Seed các luật chấm dáng AI
INSERT IGNORE INTO form_rules (id, joint, angle_threshold, feedback_message, exercise_id) VALUES 
    (1, 'Lumbar spine', 15.0, 'Lower back arch', 17),
    (2, 'Elbow joint', 90.0, 'Limited ROM', 17),
    (3, 'Knee joint', 10.0, 'Knee alignment', 9),
    (4, 'Shoulder blade', 20.0, 'Incomplete extension', 16),
    (5, 'Hip joint', 15.0, 'Hip sagging', 19);

-- -------------------------------------------------------------------------------------
-- 5. Seed Các buổi tập hoàn thành (Workout Sessions - Màn 5.3 & Day Streak)
-- -------------------------------------------------------------------------------------

-- Buổi 1: Upper Body Strength (08/10/2026)
INSERT INTO workout_sessions (member_profile_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@profile_id, 'Upper Body Strength', 'strength', '2026-10-08', 'COMPLETED', '2026-10-08 08:30:00', '2026-10-08 09:18:00', 2880, 134, NOW(6), NOW(6));
SET @ws_1 = LAST_INSERT_ID();

INSERT INTO session_exercise_results (workout_session_id, exercise_id, sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order)
VALUES 
    (@ws_1, 1, 4, 38, 2, 95.0, 760, 1),   -- Bench Press
    (@ws_1, 2, 3, 33, 3, 91.6, 625, 2),   -- Lat Pulldown
    (@ws_1, 3, 3, 27, 3, 90.0, 550, 3),   -- Shoulder Press
    (@ws_1, 4, 3, 34, 2, 94.4, 515, 4);   -- Cable Row

-- Buổi 2: HIIT Cardio Blast (06/10/2026)
INSERT INTO workout_sessions (member_profile_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@profile_id, 'HIIT Cardio Blast', 'cardio', '2026-10-06', 'COMPLETED', '2026-10-06 18:15:00', '2026-10-06 18:47:00', 1920, 320, NOW(6), NOW(6));
SET @ws_2 = LAST_INSERT_ID();

INSERT INTO session_exercise_results (workout_session_id, exercise_id, sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order)
VALUES 
    (@ws_2, 5, 4, 52, 8, 86.6, 480, 1),   -- Burpees
    (@ws_2, 6, 4, 110, 10, 91.6, 420, 2), -- Mountain Climbers
    (@ws_2, 7, 3, 53, 7, 88.3, 360, 3),   -- Jump Squats
    (@ws_2, 8, 3, 112, 8, 93.3, 300, 4);  -- High Knees

-- Buổi 3: Lower Body Power (04/10/2026)
INSERT INTO workout_sessions (member_profile_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@profile_id, 'Lower Body Power', 'strength', '2026-10-04', 'COMPLETED', '2026-10-04 07:45:00', '2026-10-04 08:39:00', 3240, 184, NOW(6), NOW(6));
SET @ws_3 = LAST_INSERT_ID();

INSERT INTO session_exercise_results (workout_session_id, exercise_id, sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order)
VALUES 
    (@ws_3, 9, 4, 28, 4, 87.5, 840, 1),   -- Pistol Squat
    (@ws_3, 10, 3, 31, 5, 86.1, 720, 2),  -- Bulgarian Split Squat
    (@ws_3, 11, 3, 16, 2, 88.8, 600, 3),  -- Nordic Curl
    (@ws_3, 12, 4, 76, 4, 95.0, 480, 4);  -- Calf Raise

-- Buổi 4: Mobility & Core (02/10/2026)
INSERT INTO workout_sessions (member_profile_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@profile_id, 'Mobility & Core', 'mobility', '2026-10-02', 'COMPLETED', '2026-10-02 19:00:00', '2026-10-02 19:28:00', 1680, 24, NOW(6), NOW(6));
SET @ws_4 = LAST_INSERT_ID();

INSERT INTO session_exercise_results (workout_session_id, exercise_id, sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order)
VALUES 
    (@ws_4, 13, 3, 3, 0, 100.0, 360, 1),  -- Hollow Body Hold
    (@ws_4, 14, 3, 28, 2, 93.3, 420, 2),  -- Hanging Leg Raise
    (@ws_4, 15, 2, 2, 0, 98.0, 300, 3);   -- Deep Squat Hold

-- Buổi 5: Full Body Calisthenics (01/10/2026)
INSERT INTO workout_sessions (member_profile_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@profile_id, 'Full Body Calisthenics', 'strength', '2026-10-01', 'COMPLETED', '2026-10-01 07:00:00', '2026-10-01 07:42:00', 2520, 118, NOW(6), NOW(6));
SET @ws_5 = LAST_INSERT_ID();

INSERT INTO session_exercise_results (workout_session_id, exercise_id, sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order)
VALUES 
    (@ws_5, 16, 4, 28, 2, 93.3, 600, 1),  -- Pull-up
    (@ws_5, 17, 4, 56, 4, 93.3, 580, 2),  -- Push-up
    (@ws_5, 18, 3, 27, 3, 90.0, 520, 3);  -- Dip

-- Các buổi tập trong tháng 9 để tạo đủ 18 buổi và volume biểu đồ 3M / 1Y
INSERT INTO workout_sessions (member_profile_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at) VALUES 
    (@profile_id, 'Upper Body Strength', 'strength', '2026-09-28', 'COMPLETED', '2026-09-28 08:00:00', '2026-09-28 08:45:00', 2700, 120, NOW(6), NOW(6)),
    (@profile_id, 'HIIT Cardio Blast', 'cardio', '2026-09-26', 'COMPLETED', '2026-09-26 18:00:00', '2026-09-26 18:35:00', 2100, 280, NOW(6), NOW(6)),
    (@profile_id, 'Lower Body Power', 'strength', '2026-09-24', 'COMPLETED', '2026-09-24 07:30:00', '2026-09-24 08:20:00', 3000, 160, NOW(6), NOW(6)),
    (@profile_id, 'Mobility & Core', 'mobility', '2026-09-22', 'COMPLETED', '2026-09-22 19:00:00', '2026-09-22 19:30:00', 1800, 30, NOW(6), NOW(6)),
    (@profile_id, 'Full Body Calisthenics', 'strength', '2026-09-20', 'COMPLETED', '2026-09-20 07:00:00', '2026-09-20 07:45:00', 2700, 110, NOW(6), NOW(6)),
    (@profile_id, 'Upper Body Strength', 'strength', '2026-09-18', 'COMPLETED', '2026-09-18 08:00:00', '2026-09-18 08:45:00', 2700, 125, NOW(6), NOW(6)),
    (@profile_id, 'HIIT Cardio Blast', 'cardio', '2026-09-15', 'COMPLETED', '2026-09-15 18:00:00', '2026-09-15 18:35:00', 2100, 290, NOW(6), NOW(6)),
    (@profile_id, 'Lower Body Power', 'strength', '2026-09-12', 'COMPLETED', '2026-09-12 07:30:00', '2026-09-12 08:20:00', 3000, 165, NOW(6), NOW(6)),
    (@profile_id, 'Mobility & Core', 'mobility', '2026-09-10', 'COMPLETED', '2026-09-10 19:00:00', '2026-09-10 19:30:00', 1800, 30, NOW(6), NOW(6)),
    (@profile_id, 'Full Body Calisthenics', 'strength', '2026-09-08', 'COMPLETED', '2026-09-08 07:00:00', '2026-09-08 07:45:00', 2700, 115, NOW(6), NOW(6)),
    (@profile_id, 'Upper Body Strength', 'strength', '2026-09-05', 'COMPLETED', '2026-09-05 08:00:00', '2026-09-05 08:45:00', 2700, 130, NOW(6), NOW(6)),
    (@profile_id, 'HIIT Cardio Blast', 'cardio', '2026-09-03', 'COMPLETED', '2026-09-03 18:00:00', '2026-09-03 18:35:00', 2100, 275, NOW(6), NOW(6)),
    (@profile_id, 'Full Body Calisthenics', 'strength', '2026-09-01', 'COMPLETED', '2026-09-01 07:00:00', '2026-09-01 07:45:00', 2700, 120, NOW(6), NOW(6));

-- -------------------------------------------------------------------------------------
-- 6. Seed Lỗi form AI (Form Error Logs - Màn 5.5 Performance Analytics)
-- -------------------------------------------------------------------------------------
-- Ghi nhận 42 lỗi form theo đúng tỉ lệ trên giao diện:
--   Lower back arch (35% ~ 15 lỗi)
--   Limited ROM (25% ~ 10 lỗi)
--   Knee alignment (15% ~ 6 lỗi)
--   Other (25% ~ 11 lỗi)
SET @first_ser = (SELECT id FROM session_exercise_results WHERE workout_session_id = @ws_1 LIMIT 1);

INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id)
VALUES 
    (3, 18.5, '2026-10-08 08:35:00', @first_ser, 1),
    (7, 19.2, '2026-10-08 08:38:00', @first_ser, 1),
    (9, 21.0, '2026-10-08 08:40:00', @first_ser, 1),
    (4, 20.1, '2026-10-08 08:42:00', @first_ser, 1),
    (6, 17.8, '2026-10-08 08:44:00', @first_ser, 1),
    (8, 22.4, '2026-10-08 08:46:00', @first_ser, 1),
    (2, 19.9, '2026-10-06 18:20:00', @first_ser, 1),
    (5, 18.7, '2026-10-06 18:24:00', @first_ser, 1),
    (8, 20.3, '2026-10-06 18:28:00', @first_ser, 1),
    (11, 21.5, '2026-10-06 18:32:00', @first_ser, 1),
    (3, 19.0, '2026-10-04 07:50:00', @first_ser, 1),
    (6, 18.2, '2026-10-04 07:55:00', @first_ser, 1),
    (9, 20.8, '2026-10-04 08:00:00', @first_ser, 1),
    (12, 22.1, '2026-10-04 08:05:00', @first_ser, 1),
    (5, 19.4, '2026-10-01 07:15:00', @first_ser, 1),
    -- Limited ROM (10 lỗi)
    (5, 82.0, '2026-10-08 08:36:00', @first_ser, 2),
    (8, 80.5, '2026-10-08 08:39:00', @first_ser, 2),
    (10, 78.0, '2026-10-08 08:41:00', @first_ser, 2),
    (4, 83.5, '2026-10-06 18:22:00', @first_ser, 2),
    (7, 81.0, '2026-10-06 18:26:00', @first_ser, 2),
    (9, 79.5, '2026-10-06 18:30:00', @first_ser, 2),
    (3, 84.0, '2026-10-04 07:52:00', @first_ser, 2),
    (6, 82.5, '2026-10-04 07:58:00', @first_ser, 2),
    (8, 80.0, '2026-10-04 08:02:00', @first_ser, 2),
    (11, 77.5, '2026-10-04 08:08:00', @first_ser, 2),
    -- Knee alignment (6 lỗi)
    (4, 12.0, '2026-10-04 07:53:00', @first_ser, 3),
    (7, 13.5, '2026-10-04 07:57:00', @first_ser, 3),
    (10, 14.0, '2026-10-04 08:01:00', @first_ser, 3),
    (3, 11.5, '2026-10-02 19:10:00', @first_ser, 3),
    (6, 12.8, '2026-10-02 19:15:00', @first_ser, 3),
    (8, 13.2, '2026-10-02 19:20:00', @first_ser, 3),
    -- Other: Incomplete extension & Hip sagging (11 lỗi)
    (2, 25.0, '2026-10-08 08:37:00', @first_ser, 4),
    (5, 23.5, '2026-10-08 08:43:00', @first_ser, 4),
    (7, 24.0, '2026-10-08 08:47:00', @first_ser, 4),
    (3, 26.5, '2026-10-06 18:25:00', @first_ser, 4),
    (6, 22.0, '2026-10-06 18:29:00', @first_ser, 4),
    (8, 25.5, '2026-10-06 18:33:00', @first_ser, 4),
    (2, 18.0, '2026-10-02 19:12:00', @first_ser, 5),
    (4, 19.5, '2026-10-02 19:16:00', @first_ser, 5),
    (6, 17.0, '2026-10-02 19:22:00', @first_ser, 5),
    (3, 18.5, '2026-10-01 07:20:00', @first_ser, 5),
    (5, 19.0, '2026-10-01 07:25:00', @first_ser, 5);

COMMIT;

-- Khôi phục lại cấu hình ban đầu
SET SQL_SAFE_UPDATES = 1;
SET FOREIGN_KEY_CHECKS = 1;

SELECT 
    'SUCCESS' AS status,
    @member_email AS target_email,
    (SELECT COUNT(*) FROM member_body_metrics WHERE member_profile_id = @profile_id) AS total_body_metrics,
    (SELECT COUNT(*) FROM workout_sessions WHERE member_profile_id = @profile_id) AS total_workout_sessions,
    (SELECT COUNT(*) FROM session_exercise_results ser JOIN workout_sessions ws ON ws.id = ser.workout_session_id WHERE ws.member_profile_id = @profile_id) AS total_exercise_results,
    (SELECT COUNT(*) FROM form_error_logs fel JOIN session_exercise_results ser ON ser.id = fel.session_exercise_result_id JOIN workout_sessions ws ON ws.id = ser.workout_session_id WHERE ws.member_profile_id = @profile_id) AS total_form_error_tags;

