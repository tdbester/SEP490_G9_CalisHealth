-- =====================================================================================
-- SEED DỮ LIỆU DEMO - Tracking của 1 member (Workout history, Performance analytics, Health tracking,
-- Day streak). Sinh tự động bởi script; ngày tính tương đối theo CURDATE() nên chạy lại lúc nào cũng
-- ra dữ liệu "12 tuần gần nhất". Chạy THỦ CÔNG trên MySQL 8, chạy lại nhiều lần được (xóa dữ liệu
-- tracking cũ của member này trước khi nạp).
--
-- Điều kiện: member đã đăng nhập / hoàn thành survey ít nhất 1 lần (đã có dòng member_profiles),
-- DB đã có exercises id 5-19 và form_rules id 1-5 (seed của màn Exercise library), đã chạy migration V12.
--
-- Nội dung: 43 buổi tập COMPLETED trong 12 tuần (5 loại buổi, reps tăng dần, lỗi form giảm dần),
--   chuỗi hiện tại 6 ngày (tới hôm nay), chuỗi dài nhất 9 ngày, lỗi form gắn với form_rules,
--   6 lần đo cơ thể theo tháng (cân nặng giảm dần 69.8 -> 66.5 kg).
--   Mỗi buổi có ít nhất 1 bài HOLD, thời gian giữ mỗi set tăng dần (Plank 45 -> 75s, Handstand 15 -> 35s,
--   Front lever 8 -> 18s, Planche 6 -> 15s).
-- =====================================================================================
USE calishealth;
SET NAMES utf8mb4;

-- >>> ĐỔI EMAIL NẾU MUỐN NẠP CHO TÀI KHOẢN KHÁC <<<
SET @member_email = 'demo.member@example.com';

SET @pid = (SELECT mp.id FROM member_profiles mp JOIN users u ON u.id = mp.user_id
            WHERE u.email COLLATE utf8mb4_bin = @member_email COLLATE utf8mb4_bin);
-- @pid NULL = member chưa có hồ sơ -> các INSERT bên dưới lỗi NOT NULL, không ghi gì
SELECT @pid AS member_profile_id;

SET @old_safe_updates = @@SQL_SAFE_UPDATES;
SET SQL_SAFE_UPDATES = 0;
START TRANSACTION;

-- Xóa dữ liệu tracking cũ của member này
DELETE fel FROM form_error_logs fel
  JOIN session_exercise_results ser ON ser.id = fel.session_exercise_result_id
  JOIN workout_sessions ws ON ws.id = ser.workout_session_id
  WHERE ws.member_profile_id = @pid;
DELETE ser FROM session_exercise_results ser
  JOIN workout_sessions ws ON ws.id = ser.workout_session_id
  WHERE ws.member_profile_id = @pid;
DELETE FROM workout_sessions WHERE member_profile_id = @pid;
DELETE FROM member_body_metrics WHERE member_profile_id = @pid;

-- Hồ sơ: số đo hiện tại (khớp lần đo mới nhất bên dưới)
UPDATE member_profiles
SET gender = 'MALE', date_of_birth = '2000-03-14', weight = 66.5, height = 172,
    goals = 'Build muscle, stay consistent 4 days per week'
WHERE id = @pid;

-- Số đo cơ thể: cuối mỗi tháng trong 5 tháng trước + hôm nay
INSERT INTO member_body_metrics (member_profile_id, weight_kg, height_cm, bmi, recorded_at, note) VALUES (@pid, 69.8, 172, 23.6, LAST_DAY(CURDATE() - INTERVAL 5 MONTH) + INTERVAL 23 HOUR + INTERVAL 59 MINUTE, 'End of month check-in');
INSERT INTO member_body_metrics (member_profile_id, weight_kg, height_cm, bmi, recorded_at, note) VALUES (@pid, 69.1, 172, 23.4, LAST_DAY(CURDATE() - INTERVAL 4 MONTH) + INTERVAL 23 HOUR + INTERVAL 59 MINUTE, 'End of month check-in');
INSERT INTO member_body_metrics (member_profile_id, weight_kg, height_cm, bmi, recorded_at, note) VALUES (@pid, 68.4, 172, 23.1, LAST_DAY(CURDATE() - INTERVAL 3 MONTH) + INTERVAL 23 HOUR + INTERVAL 59 MINUTE, 'End of month check-in');
INSERT INTO member_body_metrics (member_profile_id, weight_kg, height_cm, bmi, recorded_at, note) VALUES (@pid, 67.9, 172, 23, LAST_DAY(CURDATE() - INTERVAL 2 MONTH) + INTERVAL 23 HOUR + INTERVAL 59 MINUTE, 'End of month check-in');
INSERT INTO member_body_metrics (member_profile_id, weight_kg, height_cm, bmi, recorded_at, note) VALUES (@pid, 67.2, 172, 22.7, LAST_DAY(CURDATE() - INTERVAL 1 MONTH) + INTERVAL 23 HOUR + INTERVAL 59 MINUTE, 'End of month check-in');
INSERT INTO member_body_metrics (member_profile_id, weight_kg, height_cm, bmi, recorded_at, note) VALUES (@pid, 66.5, 172, 22.5, CURDATE() + INTERVAL 8 HOUR, 'Morning check-in');

-- Buổi tập (cũ -> mới)
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Upper Body Strength', 'strength', CURDATE() - INTERVAL 81 DAY, 'COMPLETED', CURDATE() - INTERVAL 81 DAY + INTERVAL 420 MINUTE, CURDATE() - INTERVAL 81 DAY + INTERVAL 420 MINUTE + INTERVAL 2520 SECOND, 1831, 93, CURDATE() - INTERVAL 81 DAY + INTERVAL 420 MINUTE, CURDATE() - INTERVAL 81 DAY + INTERVAL 420 MINUTE + INTERVAL 2520 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 41, 8, 83.7, 723, 1, @s, 17);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 15.000, CURDATE() - INTERVAL 81 DAY + INTERVAL 420 MINUTE + INTERVAL 60 SECOND, @r, 1), (5, 16.300, CURDATE() - INTERVAL 81 DAY + INTERVAL 420 MINUTE + INTERVAL 105 SECOND, @r, 2), (8, 17.600, CURDATE() - INTERVAL 81 DAY + INTERVAL 420 MINUTE + INTERVAL 150 SECOND, @r, 1), (11, 18.900, CURDATE() - INTERVAL 81 DAY + INTERVAL 420 MINUTE + INTERVAL 195 SECOND, @r, 2);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 17, 3, 85, 674, 2, @s, 16);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 15.000, CURDATE() - INTERVAL 81 DAY + INTERVAL 420 MINUTE + INTERVAL 60 SECOND, @r, 4), (5, 16.300, CURDATE() - INTERVAL 81 DAY + INTERVAL 420 MINUTE + INTERVAL 105 SECOND, @r, 4), (8, 17.600, CURDATE() - INTERVAL 81 DAY + INTERVAL 420 MINUTE + INTERVAL 150 SECOND, @r, 4);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 22, 2, 91.7, 434, 3, @s, 18);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Lower Body Power', 'strength', CURDATE() - INTERVAL 79 DAY, 'COMPLETED', CURDATE() - INTERVAL 79 DAY + INTERVAL 1095 MINUTE, CURDATE() - INTERVAL 79 DAY + INTERVAL 1095 MINUTE + INTERVAL 2189 SECOND, 1593, 89, CURDATE() - INTERVAL 79 DAY + INTERVAL 1095 MINUTE, CURDATE() - INTERVAL 79 DAY + INTERVAL 1095 MINUTE + INTERVAL 2189 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 10, 2, 83.3, 579, 1, @s, 9);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 16.300, CURDATE() - INTERVAL 79 DAY + INTERVAL 1095 MINUTE + INTERVAL 60 SECOND, @r, 3), (5, 17.600, CURDATE() - INTERVAL 79 DAY + INTERVAL 1095 MINUTE + INTERVAL 105 SECOND, @r, 3);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 28, 3, 90.3, 652, 2, @s, 10);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 42, 4, 91.3, 362, 3, @s, 12);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'HIIT Cardio Blast', 'cardio', CURDATE() - INTERVAL 77 DAY, 'COMPLETED', CURDATE() - INTERVAL 77 DAY + INTERVAL 450 MINUTE, CURDATE() - INTERVAL 77 DAY + INTERVAL 450 MINUTE + INTERVAL 2059 SECOND, 1501, 237, CURDATE() - INTERVAL 77 DAY + INTERVAL 450 MINUTE, CURDATE() - INTERVAL 77 DAY + INTERVAL 450 MINUTE + INTERVAL 2059 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 45, 5, 90, 581, 1, @s, 5);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 114, 11, 91.2, 436, 2, @s, 6);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 56, 6, 90.3, 484, 3, @s, 7);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Mobility & Core', 'mobility', CURDATE() - INTERVAL 74 DAY, 'COMPLETED', CURDATE() - INTERVAL 74 DAY + INTERVAL 465 MINUTE, CURDATE() - INTERVAL 74 DAY + INTERVAL 465 MINUTE + INTERVAL 1594 SECOND, 1165, 8, CURDATE() - INTERVAL 74 DAY + INTERVAL 465 MINUTE, CURDATE() - INTERVAL 74 DAY + INTERVAL 465 MINUTE + INTERVAL 1594 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 3, 0, 100, 437, 1, @s, 19);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 3, 0, 100, 291, 2, @s, 13);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (2, 2, 0, 100, 437, 3, @s, 15);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Full Body Calisthenics', 'strength', CURDATE() - INTERVAL 72 DAY, 'COMPLETED', CURDATE() - INTERVAL 72 DAY + INTERVAL 1080 MINUTE, CURDATE() - INTERVAL 72 DAY + INTERVAL 1080 MINUTE + INTERVAL 2193 SECOND, 1606, 83, CURDATE() - INTERVAL 72 DAY + INTERVAL 1080 MINUTE, CURDATE() - INTERVAL 72 DAY + INTERVAL 1080 MINUTE + INTERVAL 2193 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 16, 3, 84.2, 511, 1, @s, 16);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 20.200, CURDATE() - INTERVAL 72 DAY + INTERVAL 1080 MINUTE + INTERVAL 60 SECOND, @r, 4), (5, 21.500, CURDATE() - INTERVAL 72 DAY + INTERVAL 1080 MINUTE + INTERVAL 105 SECOND, @r, 4), (8, 22.800, CURDATE() - INTERVAL 72 DAY + INTERVAL 1080 MINUTE + INTERVAL 150 SECOND, @r, 4);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 41, 7, 85.4, 511, 2, @s, 17);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 20.200, CURDATE() - INTERVAL 72 DAY + INTERVAL 1080 MINUTE + INTERVAL 60 SECOND, @r, 1), (5, 21.500, CURDATE() - INTERVAL 72 DAY + INTERVAL 1080 MINUTE + INTERVAL 105 SECOND, @r, 2), (8, 22.800, CURDATE() - INTERVAL 72 DAY + INTERVAL 1080 MINUTE + INTERVAL 150 SECOND, @r, 1), (11, 24.100, CURDATE() - INTERVAL 72 DAY + INTERVAL 1080 MINUTE + INTERVAL 195 SECOND, @r, 2);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 14, 2, 87.5, 584, 3, @s, 9);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 20.200, CURDATE() - INTERVAL 72 DAY + INTERVAL 1080 MINUTE + INTERVAL 60 SECOND, @r, 3), (5, 21.500, CURDATE() - INTERVAL 72 DAY + INTERVAL 1080 MINUTE + INTERVAL 105 SECOND, @r, 3);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Upper Body Strength', 'strength', CURDATE() - INTERVAL 70 DAY, 'COMPLETED', CURDATE() - INTERVAL 70 DAY + INTERVAL 435 MINUTE, CURDATE() - INTERVAL 70 DAY + INTERVAL 435 MINUTE + INTERVAL 2528 SECOND, 1854, 100, CURDATE() - INTERVAL 70 DAY + INTERVAL 435 MINUTE, CURDATE() - INTERVAL 70 DAY + INTERVAL 435 MINUTE + INTERVAL 2528 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 45, 7, 86.5, 732, 1, @s, 17);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 21.500, CURDATE() - INTERVAL 70 DAY + INTERVAL 435 MINUTE + INTERVAL 60 SECOND, @r, 1), (5, 22.800, CURDATE() - INTERVAL 70 DAY + INTERVAL 435 MINUTE + INTERVAL 105 SECOND, @r, 2), (8, 24.100, CURDATE() - INTERVAL 70 DAY + INTERVAL 435 MINUTE + INTERVAL 150 SECOND, @r, 1), (11, 25.400, CURDATE() - INTERVAL 70 DAY + INTERVAL 435 MINUTE + INTERVAL 195 SECOND, @r, 2);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 19, 3, 86.4, 683, 2, @s, 16);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 21.500, CURDATE() - INTERVAL 70 DAY + INTERVAL 435 MINUTE + INTERVAL 60 SECOND, @r, 4), (5, 22.800, CURDATE() - INTERVAL 70 DAY + INTERVAL 435 MINUTE + INTERVAL 105 SECOND, @r, 4), (8, 24.100, CURDATE() - INTERVAL 70 DAY + INTERVAL 435 MINUTE + INTERVAL 150 SECOND, @r, 4);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 24, 2, 92.3, 439, 3, @s, 18);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Lower Body Power', 'strength', CURDATE() - INTERVAL 67 DAY, 'COMPLETED', CURDATE() - INTERVAL 67 DAY + INTERVAL 450 MINUTE, CURDATE() - INTERVAL 67 DAY + INTERVAL 450 MINUTE + INTERVAL 2197 SECOND, 1616, 95, CURDATE() - INTERVAL 67 DAY + INTERVAL 450 MINUTE, CURDATE() - INTERVAL 67 DAY + INTERVAL 450 MINUTE + INTERVAL 2197 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 11, 2, 84.6, 588, 1, @s, 9);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 22.800, CURDATE() - INTERVAL 67 DAY + INTERVAL 450 MINUTE + INTERVAL 60 SECOND, @r, 3), (5, 24.100, CURDATE() - INTERVAL 67 DAY + INTERVAL 450 MINUTE + INTERVAL 105 SECOND, @r, 3);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 30, 3, 90.9, 661, 2, @s, 10);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 45, 4, 91.8, 367, 3, @s, 12);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'HIIT Cardio Blast', 'cardio', CURDATE() - INTERVAL 65 DAY, 'COMPLETED', CURDATE() - INTERVAL 65 DAY + INTERVAL 1125 MINUTE, CURDATE() - INTERVAL 65 DAY + INTERVAL 1125 MINUTE + INTERVAL 2066 SECOND, 1522, 251, CURDATE() - INTERVAL 65 DAY + INTERVAL 1125 MINUTE, CURDATE() - INTERVAL 65 DAY + INTERVAL 1125 MINUTE + INTERVAL 2066 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 49, 4, 92.5, 589, 1, @s, 5);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 121, 11, 91.7, 442, 2, @s, 6);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 61, 5, 92.4, 491, 3, @s, 7);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Mobility & Core', 'mobility', CURDATE() - INTERVAL 63 DAY, 'COMPLETED', CURDATE() - INTERVAL 63 DAY + INTERVAL 420 MINUTE, CURDATE() - INTERVAL 63 DAY + INTERVAL 420 MINUTE + INTERVAL 1600 SECOND, 1181, 8, CURDATE() - INTERVAL 63 DAY + INTERVAL 420 MINUTE, CURDATE() - INTERVAL 63 DAY + INTERVAL 420 MINUTE + INTERVAL 1600 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 3, 0, 100, 443, 1, @s, 19);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 3, 0, 100, 295, 2, @s, 13);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (2, 2, 0, 100, 443, 3, @s, 15);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Full Body Calisthenics', 'strength', CURDATE() - INTERVAL 60 DAY, 'COMPLETED', CURDATE() - INTERVAL 60 DAY + INTERVAL 435 MINUTE, CURDATE() - INTERVAL 60 DAY + INTERVAL 435 MINUTE + INTERVAL 2200 SECOND, 1628, 88, CURDATE() - INTERVAL 60 DAY + INTERVAL 435 MINUTE, CURDATE() - INTERVAL 60 DAY + INTERVAL 435 MINUTE + INTERVAL 2200 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 17, 3, 85, 518, 1, @s, 16);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 15.000, CURDATE() - INTERVAL 60 DAY + INTERVAL 435 MINUTE + INTERVAL 60 SECOND, @r, 4), (5, 16.300, CURDATE() - INTERVAL 60 DAY + INTERVAL 435 MINUTE + INTERVAL 105 SECOND, @r, 4), (8, 17.600, CURDATE() - INTERVAL 60 DAY + INTERVAL 435 MINUTE + INTERVAL 150 SECOND, @r, 4);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 44, 7, 86.3, 518, 2, @s, 17);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 15.000, CURDATE() - INTERVAL 60 DAY + INTERVAL 435 MINUTE + INTERVAL 60 SECOND, @r, 1), (5, 16.300, CURDATE() - INTERVAL 60 DAY + INTERVAL 435 MINUTE + INTERVAL 105 SECOND, @r, 2), (8, 17.600, CURDATE() - INTERVAL 60 DAY + INTERVAL 435 MINUTE + INTERVAL 150 SECOND, @r, 1), (11, 18.900, CURDATE() - INTERVAL 60 DAY + INTERVAL 435 MINUTE + INTERVAL 195 SECOND, @r, 2);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 15, 2, 88.2, 592, 3, @s, 9);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 15.000, CURDATE() - INTERVAL 60 DAY + INTERVAL 435 MINUTE + INTERVAL 60 SECOND, @r, 3), (5, 16.300, CURDATE() - INTERVAL 60 DAY + INTERVAL 435 MINUTE + INTERVAL 105 SECOND, @r, 3);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Upper Body Strength', 'strength', CURDATE() - INTERVAL 58 DAY, 'COMPLETED', CURDATE() - INTERVAL 58 DAY + INTERVAL 1110 MINUTE, CURDATE() - INTERVAL 58 DAY + INTERVAL 1110 MINUTE + INTERVAL 2536 SECOND, 1880, 105, CURDATE() - INTERVAL 58 DAY + INTERVAL 1110 MINUTE, CURDATE() - INTERVAL 58 DAY + INTERVAL 1110 MINUTE + INTERVAL 2536 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 48, 7, 87.3, 742, 1, @s, 17);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 16.300, CURDATE() - INTERVAL 58 DAY + INTERVAL 1110 MINUTE + INTERVAL 60 SECOND, @r, 1), (5, 17.600, CURDATE() - INTERVAL 58 DAY + INTERVAL 1110 MINUTE + INTERVAL 105 SECOND, @r, 2), (8, 18.900, CURDATE() - INTERVAL 58 DAY + INTERVAL 1110 MINUTE + INTERVAL 150 SECOND, @r, 1), (11, 20.200, CURDATE() - INTERVAL 58 DAY + INTERVAL 1110 MINUTE + INTERVAL 195 SECOND, @r, 2);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 20, 3, 87, 693, 2, @s, 16);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 16.300, CURDATE() - INTERVAL 58 DAY + INTERVAL 1110 MINUTE + INTERVAL 60 SECOND, @r, 4), (5, 17.600, CURDATE() - INTERVAL 58 DAY + INTERVAL 1110 MINUTE + INTERVAL 105 SECOND, @r, 4), (8, 18.900, CURDATE() - INTERVAL 58 DAY + INTERVAL 1110 MINUTE + INTERVAL 150 SECOND, @r, 4);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 25, 2, 92.6, 445, 3, @s, 18);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Lower Body Power', 'strength', CURDATE() - INTERVAL 56 DAY, 'COMPLETED', CURDATE() - INTERVAL 56 DAY + INTERVAL 465 MINUTE, CURDATE() - INTERVAL 56 DAY + INTERVAL 465 MINUTE + INTERVAL 2204 SECOND, 1637, 101, CURDATE() - INTERVAL 56 DAY + INTERVAL 465 MINUTE, CURDATE() - INTERVAL 56 DAY + INTERVAL 465 MINUTE + INTERVAL 2204 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 12, 2, 85.7, 595, 1, @s, 9);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 17.600, CURDATE() - INTERVAL 56 DAY + INTERVAL 465 MINUTE + INTERVAL 60 SECOND, @r, 3), (5, 18.900, CURDATE() - INTERVAL 56 DAY + INTERVAL 465 MINUTE + INTERVAL 105 SECOND, @r, 3);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 32, 3, 91.4, 670, 2, @s, 10);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 48, 4, 92.3, 372, 3, @s, 12);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'HIIT Cardio Blast', 'cardio', CURDATE() - INTERVAL 53 DAY, 'COMPLETED', CURDATE() - INTERVAL 53 DAY + INTERVAL 420 MINUTE, CURDATE() - INTERVAL 53 DAY + INTERVAL 420 MINUTE + INTERVAL 2072 SECOND, 1543, 266, CURDATE() - INTERVAL 53 DAY + INTERVAL 420 MINUTE, CURDATE() - INTERVAL 53 DAY + INTERVAL 420 MINUTE + INTERVAL 2072 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 52, 4, 92.9, 597, 1, @s, 5);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 130, 10, 92.9, 448, 2, @s, 6);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 65, 5, 92.9, 498, 3, @s, 7);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Mobility & Core', 'mobility', CURDATE() - INTERVAL 51 DAY, 'COMPLETED', CURDATE() - INTERVAL 51 DAY + INTERVAL 1095 MINUTE, CURDATE() - INTERVAL 51 DAY + INTERVAL 1095 MINUTE + INTERVAL 1605 SECOND, 1197, 10, CURDATE() - INTERVAL 51 DAY + INTERVAL 1095 MINUTE, CURDATE() - INTERVAL 51 DAY + INTERVAL 1095 MINUTE + INTERVAL 1605 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 4, 0, 100, 449, 1, @s, 19);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 4, 0, 100, 299, 2, @s, 13);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (2, 2, 0, 100, 449, 3, @s, 15);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Full Body Calisthenics', 'strength', CURDATE() - INTERVAL 48 DAY, 'COMPLETED', CURDATE() - INTERVAL 48 DAY + INTERVAL 450 MINUTE, CURDATE() - INTERVAL 48 DAY + INTERVAL 450 MINUTE + INTERVAL 2210 SECOND, 1653, 93, CURDATE() - INTERVAL 48 DAY + INTERVAL 450 MINUTE, CURDATE() - INTERVAL 48 DAY + INTERVAL 450 MINUTE + INTERVAL 2210 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 19, 2, 90.5, 526, 1, @s, 16);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 21.500, CURDATE() - INTERVAL 48 DAY + INTERVAL 450 MINUTE + INTERVAL 60 SECOND, @r, 4), (5, 22.800, CURDATE() - INTERVAL 48 DAY + INTERVAL 450 MINUTE + INTERVAL 105 SECOND, @r, 4);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 48, 6, 88.9, 526, 2, @s, 17);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 21.500, CURDATE() - INTERVAL 48 DAY + INTERVAL 450 MINUTE + INTERVAL 60 SECOND, @r, 1), (5, 22.800, CURDATE() - INTERVAL 48 DAY + INTERVAL 450 MINUTE + INTERVAL 105 SECOND, @r, 2), (8, 24.100, CURDATE() - INTERVAL 48 DAY + INTERVAL 450 MINUTE + INTERVAL 150 SECOND, @r, 1), (11, 25.400, CURDATE() - INTERVAL 48 DAY + INTERVAL 450 MINUTE + INTERVAL 195 SECOND, @r, 2);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 16, 2, 88.9, 601, 3, @s, 9);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 21.500, CURDATE() - INTERVAL 48 DAY + INTERVAL 450 MINUTE + INTERVAL 60 SECOND, @r, 3), (5, 22.800, CURDATE() - INTERVAL 48 DAY + INTERVAL 450 MINUTE + INTERVAL 105 SECOND, @r, 3);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Upper Body Strength', 'strength', CURDATE() - INTERVAL 47 DAY, 'COMPLETED', CURDATE() - INTERVAL 47 DAY + INTERVAL 465 MINUTE, CURDATE() - INTERVAL 47 DAY + INTERVAL 465 MINUTE + INTERVAL 2545 SECOND, 1905, 111, CURDATE() - INTERVAL 47 DAY + INTERVAL 465 MINUTE, CURDATE() - INTERVAL 47 DAY + INTERVAL 465 MINUTE + INTERVAL 2545 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 51, 7, 87.9, 752, 1, @s, 17);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 22.800, CURDATE() - INTERVAL 47 DAY + INTERVAL 465 MINUTE + INTERVAL 60 SECOND, @r, 1), (5, 24.100, CURDATE() - INTERVAL 47 DAY + INTERVAL 465 MINUTE + INTERVAL 105 SECOND, @r, 2), (8, 25.400, CURDATE() - INTERVAL 47 DAY + INTERVAL 465 MINUTE + INTERVAL 150 SECOND, @r, 1), (11, 15.000, CURDATE() - INTERVAL 47 DAY + INTERVAL 465 MINUTE + INTERVAL 195 SECOND, @r, 2);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 21, 3, 87.5, 702, 2, @s, 16);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 22.800, CURDATE() - INTERVAL 47 DAY + INTERVAL 465 MINUTE + INTERVAL 60 SECOND, @r, 4), (5, 24.100, CURDATE() - INTERVAL 47 DAY + INTERVAL 465 MINUTE + INTERVAL 105 SECOND, @r, 4), (8, 25.400, CURDATE() - INTERVAL 47 DAY + INTERVAL 465 MINUTE + INTERVAL 150 SECOND, @r, 4);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 27, 2, 93.1, 451, 3, @s, 18);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Lower Body Power', 'strength', CURDATE() - INTERVAL 46 DAY, 'COMPLETED', CURDATE() - INTERVAL 46 DAY + INTERVAL 1080 MINUTE, CURDATE() - INTERVAL 46 DAY + INTERVAL 1080 MINUTE + INTERVAL 2209 SECOND, 1655, 104, CURDATE() - INTERVAL 46 DAY + INTERVAL 1080 MINUTE, CURDATE() - INTERVAL 46 DAY + INTERVAL 1080 MINUTE + INTERVAL 2209 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 12, 2, 85.7, 602, 1, @s, 9);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 24.100, CURDATE() - INTERVAL 46 DAY + INTERVAL 1080 MINUTE + INTERVAL 60 SECOND, @r, 3), (5, 25.400, CURDATE() - INTERVAL 46 DAY + INTERVAL 1080 MINUTE + INTERVAL 105 SECOND, @r, 3);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 34, 2, 94.4, 677, 2, @s, 10);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 50, 4, 92.6, 376, 3, @s, 12);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'HIIT Cardio Blast', 'cardio', CURDATE() - INTERVAL 45 DAY, 'COMPLETED', CURDATE() - INTERVAL 45 DAY + INTERVAL 435 MINUTE, CURDATE() - INTERVAL 45 DAY + INTERVAL 435 MINUTE + INTERVAL 2076 SECOND, 1557, 276, CURDATE() - INTERVAL 45 DAY + INTERVAL 435 MINUTE, CURDATE() - INTERVAL 45 DAY + INTERVAL 435 MINUTE + INTERVAL 2076 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 54, 4, 93.1, 603, 1, @s, 5);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 135, 10, 93.1, 452, 2, @s, 6);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 68, 5, 93.2, 502, 3, @s, 7);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Mobility & Core', 'mobility', CURDATE() - INTERVAL 44 DAY, 'COMPLETED', CURDATE() - INTERVAL 44 DAY + INTERVAL 450 MINUTE, CURDATE() - INTERVAL 44 DAY + INTERVAL 450 MINUTE + INTERVAL 1610 SECOND, 1208, 10, CURDATE() - INTERVAL 44 DAY + INTERVAL 450 MINUTE, CURDATE() - INTERVAL 44 DAY + INTERVAL 450 MINUTE + INTERVAL 1610 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 4, 0, 100, 453, 1, @s, 19);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 4, 0, 100, 302, 2, @s, 13);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (2, 2, 0, 100, 453, 3, @s, 15);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Full Body Calisthenics', 'strength', CURDATE() - INTERVAL 43 DAY, 'COMPLETED', CURDATE() - INTERVAL 43 DAY + INTERVAL 1125 MINUTE, CURDATE() - INTERVAL 43 DAY + INTERVAL 1125 MINUTE + INTERVAL 2212 SECOND, 1662, 95, CURDATE() - INTERVAL 43 DAY + INTERVAL 1125 MINUTE, CURDATE() - INTERVAL 43 DAY + INTERVAL 1125 MINUTE + INTERVAL 2212 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 20, 2, 90.9, 529, 1, @s, 16);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 16.300, CURDATE() - INTERVAL 43 DAY + INTERVAL 1125 MINUTE + INTERVAL 60 SECOND, @r, 4), (5, 17.600, CURDATE() - INTERVAL 43 DAY + INTERVAL 1125 MINUTE + INTERVAL 105 SECOND, @r, 4);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 49, 6, 89.1, 529, 2, @s, 17);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 16.300, CURDATE() - INTERVAL 43 DAY + INTERVAL 1125 MINUTE + INTERVAL 60 SECOND, @r, 1), (5, 17.600, CURDATE() - INTERVAL 43 DAY + INTERVAL 1125 MINUTE + INTERVAL 105 SECOND, @r, 2), (8, 18.900, CURDATE() - INTERVAL 43 DAY + INTERVAL 1125 MINUTE + INTERVAL 150 SECOND, @r, 1), (11, 20.200, CURDATE() - INTERVAL 43 DAY + INTERVAL 1125 MINUTE + INTERVAL 195 SECOND, @r, 2);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 16, 2, 88.9, 604, 3, @s, 9);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 16.300, CURDATE() - INTERVAL 43 DAY + INTERVAL 1125 MINUTE + INTERVAL 60 SECOND, @r, 3), (5, 17.600, CURDATE() - INTERVAL 43 DAY + INTERVAL 1125 MINUTE + INTERVAL 105 SECOND, @r, 3);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Upper Body Strength', 'strength', CURDATE() - INTERVAL 42 DAY, 'COMPLETED', CURDATE() - INTERVAL 42 DAY + INTERVAL 420 MINUTE, CURDATE() - INTERVAL 42 DAY + INTERVAL 420 MINUTE + INTERVAL 2548 SECOND, 1916, 113, CURDATE() - INTERVAL 42 DAY + INTERVAL 420 MINUTE, CURDATE() - INTERVAL 42 DAY + INTERVAL 420 MINUTE + INTERVAL 2548 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 53, 6, 89.8, 756, 1, @s, 17);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 17.600, CURDATE() - INTERVAL 42 DAY + INTERVAL 420 MINUTE + INTERVAL 60 SECOND, @r, 1), (5, 18.900, CURDATE() - INTERVAL 42 DAY + INTERVAL 420 MINUTE + INTERVAL 105 SECOND, @r, 2), (8, 20.200, CURDATE() - INTERVAL 42 DAY + INTERVAL 420 MINUTE + INTERVAL 150 SECOND, @r, 1), (11, 21.500, CURDATE() - INTERVAL 42 DAY + INTERVAL 420 MINUTE + INTERVAL 195 SECOND, @r, 2);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 22, 3, 88, 706, 2, @s, 16);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 17.600, CURDATE() - INTERVAL 42 DAY + INTERVAL 420 MINUTE + INTERVAL 60 SECOND, @r, 4), (5, 18.900, CURDATE() - INTERVAL 42 DAY + INTERVAL 420 MINUTE + INTERVAL 105 SECOND, @r, 4), (8, 20.200, CURDATE() - INTERVAL 42 DAY + INTERVAL 420 MINUTE + INTERVAL 150 SECOND, @r, 4);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 27, 2, 93.1, 454, 3, @s, 18);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Lower Body Power', 'strength', CURDATE() - INTERVAL 41 DAY, 'COMPLETED', CURDATE() - INTERVAL 41 DAY + INTERVAL 435 MINUTE, CURDATE() - INTERVAL 41 DAY + INTERVAL 435 MINUTE + INTERVAL 2211 SECOND, 1664, 107, CURDATE() - INTERVAL 41 DAY + INTERVAL 435 MINUTE, CURDATE() - INTERVAL 41 DAY + INTERVAL 435 MINUTE + INTERVAL 2211 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 13, 2, 86.7, 605, 1, @s, 9);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 18.900, CURDATE() - INTERVAL 41 DAY + INTERVAL 435 MINUTE + INTERVAL 60 SECOND, @r, 3), (5, 20.200, CURDATE() - INTERVAL 41 DAY + INTERVAL 435 MINUTE + INTERVAL 105 SECOND, @r, 3);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 35, 2, 94.6, 681, 2, @s, 10);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 51, 4, 92.7, 378, 3, @s, 12);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'HIIT Cardio Blast', 'cardio', CURDATE() - INTERVAL 40 DAY, 'COMPLETED', CURDATE() - INTERVAL 40 DAY + INTERVAL 1110 MINUTE, CURDATE() - INTERVAL 40 DAY + INTERVAL 1110 MINUTE + INTERVAL 2079 SECOND, 1566, 281, CURDATE() - INTERVAL 40 DAY + INTERVAL 1110 MINUTE, CURDATE() - INTERVAL 40 DAY + INTERVAL 1110 MINUTE + INTERVAL 2079 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 55, 4, 93.2, 606, 1, @s, 5);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 138, 10, 93.2, 455, 2, @s, 6);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 69, 5, 93.2, 505, 3, @s, 7);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Mobility & Core', 'mobility', CURDATE() - INTERVAL 37 DAY, 'COMPLETED', CURDATE() - INTERVAL 37 DAY + INTERVAL 465 MINUTE, CURDATE() - INTERVAL 37 DAY + INTERVAL 465 MINUTE + INTERVAL 1610 SECOND, 1216, 11, CURDATE() - INTERVAL 37 DAY + INTERVAL 465 MINUTE, CURDATE() - INTERVAL 37 DAY + INTERVAL 465 MINUTE + INTERVAL 1610 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 4, 0, 100, 456, 1, @s, 19);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 4, 0, 100, 304, 2, @s, 13);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (2, 3, 0, 100, 456, 3, @s, 15);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Full Body Calisthenics', 'strength', CURDATE() - INTERVAL 35 DAY, 'COMPLETED', CURDATE() - INTERVAL 35 DAY + INTERVAL 420 MINUTE, CURDATE() - INTERVAL 35 DAY + INTERVAL 420 MINUTE + INTERVAL 2215 SECOND, 1676, 99, CURDATE() - INTERVAL 35 DAY + INTERVAL 420 MINUTE, CURDATE() - INTERVAL 35 DAY + INTERVAL 420 MINUTE + INTERVAL 2215 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 21, 2, 91.3, 533, 1, @s, 16);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 22.800, CURDATE() - INTERVAL 35 DAY + INTERVAL 420 MINUTE + INTERVAL 60 SECOND, @r, 4), (5, 24.100, CURDATE() - INTERVAL 35 DAY + INTERVAL 420 MINUTE + INTERVAL 105 SECOND, @r, 4);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 51, 6, 89.5, 533, 2, @s, 17);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 22.800, CURDATE() - INTERVAL 35 DAY + INTERVAL 420 MINUTE + INTERVAL 60 SECOND, @r, 1), (5, 24.100, CURDATE() - INTERVAL 35 DAY + INTERVAL 420 MINUTE + INTERVAL 105 SECOND, @r, 2), (8, 25.400, CURDATE() - INTERVAL 35 DAY + INTERVAL 420 MINUTE + INTERVAL 150 SECOND, @r, 1), (11, 15.000, CURDATE() - INTERVAL 35 DAY + INTERVAL 420 MINUTE + INTERVAL 195 SECOND, @r, 2);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 17, 2, 89.5, 610, 3, @s, 9);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 22.800, CURDATE() - INTERVAL 35 DAY + INTERVAL 420 MINUTE + INTERVAL 60 SECOND, @r, 3), (5, 24.100, CURDATE() - INTERVAL 35 DAY + INTERVAL 420 MINUTE + INTERVAL 105 SECOND, @r, 3);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Upper Body Strength', 'strength', CURDATE() - INTERVAL 32 DAY, 'COMPLETED', CURDATE() - INTERVAL 32 DAY + INTERVAL 1095 MINUTE, CURDATE() - INTERVAL 32 DAY + INTERVAL 1095 MINUTE + INTERVAL 2554 SECOND, 1938, 118, CURDATE() - INTERVAL 32 DAY + INTERVAL 1095 MINUTE, CURDATE() - INTERVAL 32 DAY + INTERVAL 1095 MINUTE + INTERVAL 2554 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 55, 6, 90.2, 765, 1, @s, 17);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 24.100, CURDATE() - INTERVAL 32 DAY + INTERVAL 1095 MINUTE + INTERVAL 60 SECOND, @r, 1), (5, 25.400, CURDATE() - INTERVAL 32 DAY + INTERVAL 1095 MINUTE + INTERVAL 105 SECOND, @r, 2), (8, 15.000, CURDATE() - INTERVAL 32 DAY + INTERVAL 1095 MINUTE + INTERVAL 150 SECOND, @r, 1), (11, 16.300, CURDATE() - INTERVAL 32 DAY + INTERVAL 1095 MINUTE + INTERVAL 195 SECOND, @r, 2);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 23, 3, 88.5, 714, 2, @s, 16);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 24.100, CURDATE() - INTERVAL 32 DAY + INTERVAL 1095 MINUTE + INTERVAL 60 SECOND, @r, 4), (5, 25.400, CURDATE() - INTERVAL 32 DAY + INTERVAL 1095 MINUTE + INTERVAL 105 SECOND, @r, 4), (8, 15.000, CURDATE() - INTERVAL 32 DAY + INTERVAL 1095 MINUTE + INTERVAL 150 SECOND, @r, 4);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 29, 2, 93.5, 459, 3, @s, 18);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Lower Body Power', 'strength', CURDATE() - INTERVAL 30 DAY, 'COMPLETED', CURDATE() - INTERVAL 30 DAY + INTERVAL 450 MINUTE, CURDATE() - INTERVAL 30 DAY + INTERVAL 450 MINUTE + INTERVAL 2218 SECOND, 1686, 112, CURDATE() - INTERVAL 30 DAY + INTERVAL 450 MINUTE, CURDATE() - INTERVAL 30 DAY + INTERVAL 450 MINUTE + INTERVAL 2218 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 14, 1, 93.3, 613, 1, @s, 9);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 25.400, CURDATE() - INTERVAL 30 DAY + INTERVAL 450 MINUTE + INTERVAL 60 SECOND, @r, 3);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 37, 2, 94.9, 690, 2, @s, 10);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 55, 3, 94.8, 383, 3, @s, 12);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'HIIT Cardio Blast', 'cardio', CURDATE() - INTERVAL 28 DAY, 'COMPLETED', CURDATE() - INTERVAL 28 DAY + INTERVAL 465 MINUTE, CURDATE() - INTERVAL 28 DAY + INTERVAL 465 MINUTE + INTERVAL 2084 SECOND, 1587, 296, CURDATE() - INTERVAL 28 DAY + INTERVAL 465 MINUTE, CURDATE() - INTERVAL 28 DAY + INTERVAL 465 MINUTE + INTERVAL 2084 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 59, 3, 95.2, 614, 1, @s, 5);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 147, 9, 94.2, 461, 2, @s, 6);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 74, 4, 94.9, 512, 3, @s, 7);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Mobility & Core', 'mobility', CURDATE() - INTERVAL 25 DAY, 'COMPLETED', CURDATE() - INTERVAL 25 DAY + INTERVAL 1080 MINUTE, CURDATE() - INTERVAL 25 DAY + INTERVAL 1080 MINUTE + INTERVAL 1614 SECOND, 1232, 11, CURDATE() - INTERVAL 25 DAY + INTERVAL 1080 MINUTE, CURDATE() - INTERVAL 25 DAY + INTERVAL 1080 MINUTE + INTERVAL 1614 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 4, 0, 100, 462, 1, @s, 19);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 4, 0, 100, 308, 2, @s, 13);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (2, 3, 0, 100, 462, 3, @s, 15);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Full Body Calisthenics', 'strength', CURDATE() - INTERVAL 23 DAY, 'COMPLETED', CURDATE() - INTERVAL 23 DAY + INTERVAL 435 MINUTE, CURDATE() - INTERVAL 23 DAY + INTERVAL 435 MINUTE + INTERVAL 2223 SECOND, 1700, 104, CURDATE() - INTERVAL 23 DAY + INTERVAL 435 MINUTE, CURDATE() - INTERVAL 23 DAY + INTERVAL 435 MINUTE + INTERVAL 2223 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 22, 2, 91.7, 541, 1, @s, 16);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 17.600, CURDATE() - INTERVAL 23 DAY + INTERVAL 435 MINUTE + INTERVAL 60 SECOND, @r, 4), (5, 18.900, CURDATE() - INTERVAL 23 DAY + INTERVAL 435 MINUTE + INTERVAL 105 SECOND, @r, 4);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 55, 5, 91.7, 541, 2, @s, 17);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 17.600, CURDATE() - INTERVAL 23 DAY + INTERVAL 435 MINUTE + INTERVAL 60 SECOND, @r, 1), (5, 18.900, CURDATE() - INTERVAL 23 DAY + INTERVAL 435 MINUTE + INTERVAL 105 SECOND, @r, 2), (8, 20.200, CURDATE() - INTERVAL 23 DAY + INTERVAL 435 MINUTE + INTERVAL 150 SECOND, @r, 1), (11, 21.500, CURDATE() - INTERVAL 23 DAY + INTERVAL 435 MINUTE + INTERVAL 195 SECOND, @r, 2);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 18, 2, 90, 618, 3, @s, 9);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 17.600, CURDATE() - INTERVAL 23 DAY + INTERVAL 435 MINUTE + INTERVAL 60 SECOND, @r, 3), (5, 18.900, CURDATE() - INTERVAL 23 DAY + INTERVAL 435 MINUTE + INTERVAL 105 SECOND, @r, 3);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Upper Body Strength', 'strength', CURDATE() - INTERVAL 21 DAY, 'COMPLETED', CURDATE() - INTERVAL 21 DAY + INTERVAL 450 MINUTE, CURDATE() - INTERVAL 21 DAY + INTERVAL 450 MINUTE + INTERVAL 2558 SECOND, 1960, 123, CURDATE() - INTERVAL 21 DAY + INTERVAL 450 MINUTE, CURDATE() - INTERVAL 21 DAY + INTERVAL 450 MINUTE + INTERVAL 2558 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 59, 5, 92.2, 774, 1, @s, 17);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 18.900, CURDATE() - INTERVAL 21 DAY + INTERVAL 450 MINUTE + INTERVAL 60 SECOND, @r, 1), (5, 20.200, CURDATE() - INTERVAL 21 DAY + INTERVAL 450 MINUTE + INTERVAL 105 SECOND, @r, 2), (8, 21.500, CURDATE() - INTERVAL 21 DAY + INTERVAL 450 MINUTE + INTERVAL 150 SECOND, @r, 1), (11, 22.800, CURDATE() - INTERVAL 21 DAY + INTERVAL 450 MINUTE + INTERVAL 195 SECOND, @r, 2);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 25, 2, 92.6, 722, 2, @s, 16);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 18.900, CURDATE() - INTERVAL 21 DAY + INTERVAL 450 MINUTE + INTERVAL 60 SECOND, @r, 4), (5, 20.200, CURDATE() - INTERVAL 21 DAY + INTERVAL 450 MINUTE + INTERVAL 105 SECOND, @r, 4);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 30, 2, 93.8, 464, 3, @s, 18);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Lower Body Power', 'strength', CURDATE() - INTERVAL 18 DAY, 'COMPLETED', CURDATE() - INTERVAL 18 DAY + INTERVAL 1125 MINUTE, CURDATE() - INTERVAL 18 DAY + INTERVAL 1125 MINUTE + INTERVAL 2223 SECOND, 1708, 118, CURDATE() - INTERVAL 18 DAY + INTERVAL 1125 MINUTE, CURDATE() - INTERVAL 18 DAY + INTERVAL 1125 MINUTE + INTERVAL 2223 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 15, 1, 93.8, 621, 1, @s, 9);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 20.200, CURDATE() - INTERVAL 18 DAY + INTERVAL 1125 MINUTE + INTERVAL 60 SECOND, @r, 3);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 39, 2, 95.1, 699, 2, @s, 10);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 58, 3, 95.1, 388, 3, @s, 12);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'HIIT Cardio Blast', 'cardio', CURDATE() - INTERVAL 16 DAY, 'COMPLETED', CURDATE() - INTERVAL 16 DAY + INTERVAL 420 MINUTE, CURDATE() - INTERVAL 16 DAY + INTERVAL 420 MINUTE + INTERVAL 2090 SECOND, 1609, 311, CURDATE() - INTERVAL 16 DAY + INTERVAL 420 MINUTE, CURDATE() - INTERVAL 16 DAY + INTERVAL 420 MINUTE + INTERVAL 2090 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 62, 3, 95.4, 623, 1, @s, 5);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 156, 8, 95.1, 467, 2, @s, 6);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 78, 4, 95.1, 519, 3, @s, 7);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Mobility & Core', 'mobility', CURDATE() - INTERVAL 14 DAY, 'COMPLETED', CURDATE() - INTERVAL 14 DAY + INTERVAL 435 MINUTE, CURDATE() - INTERVAL 14 DAY + INTERVAL 435 MINUTE + INTERVAL 1618 SECOND, 1248, 11, CURDATE() - INTERVAL 14 DAY + INTERVAL 435 MINUTE, CURDATE() - INTERVAL 14 DAY + INTERVAL 435 MINUTE + INTERVAL 1618 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 4, 0, 100, 468, 1, @s, 19);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 4, 0, 100, 312, 2, @s, 13);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (2, 3, 0, 100, 468, 3, @s, 15);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Full Body Calisthenics', 'strength', CURDATE() - INTERVAL 11 DAY, 'COMPLETED', CURDATE() - INTERVAL 11 DAY + INTERVAL 1110 MINUTE, CURDATE() - INTERVAL 11 DAY + INTERVAL 1110 MINUTE + INTERVAL 2227 SECOND, 1722, 109, CURDATE() - INTERVAL 11 DAY + INTERVAL 1110 MINUTE, CURDATE() - INTERVAL 11 DAY + INTERVAL 1110 MINUTE + INTERVAL 2227 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 23, 2, 92, 548, 1, @s, 16);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 24.100, CURDATE() - INTERVAL 11 DAY + INTERVAL 1110 MINUTE + INTERVAL 60 SECOND, @r, 4), (5, 25.400, CURDATE() - INTERVAL 11 DAY + INTERVAL 1110 MINUTE + INTERVAL 105 SECOND, @r, 4);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 58, 5, 92.1, 548, 2, @s, 17);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 24.100, CURDATE() - INTERVAL 11 DAY + INTERVAL 1110 MINUTE + INTERVAL 60 SECOND, @r, 1), (5, 25.400, CURDATE() - INTERVAL 11 DAY + INTERVAL 1110 MINUTE + INTERVAL 105 SECOND, @r, 2), (8, 15.000, CURDATE() - INTERVAL 11 DAY + INTERVAL 1110 MINUTE + INTERVAL 150 SECOND, @r, 1), (11, 16.300, CURDATE() - INTERVAL 11 DAY + INTERVAL 1110 MINUTE + INTERVAL 195 SECOND, @r, 2);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 19, 2, 90.5, 626, 3, @s, 9);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 24.100, CURDATE() - INTERVAL 11 DAY + INTERVAL 1110 MINUTE + INTERVAL 60 SECOND, @r, 3), (5, 25.400, CURDATE() - INTERVAL 11 DAY + INTERVAL 1110 MINUTE + INTERVAL 105 SECOND, @r, 3);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Upper Body Strength', 'strength', CURDATE() - INTERVAL 9 DAY, 'COMPLETED', CURDATE() - INTERVAL 9 DAY + INTERVAL 465 MINUTE, CURDATE() - INTERVAL 9 DAY + INTERVAL 465 MINUTE + INTERVAL 2565 SECOND, 1987, 129, CURDATE() - INTERVAL 9 DAY + INTERVAL 465 MINUTE, CURDATE() - INTERVAL 9 DAY + INTERVAL 465 MINUTE + INTERVAL 2565 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 62, 5, 92.5, 784, 1, @s, 17);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 25.400, CURDATE() - INTERVAL 9 DAY + INTERVAL 465 MINUTE + INTERVAL 60 SECOND, @r, 1), (5, 15.000, CURDATE() - INTERVAL 9 DAY + INTERVAL 465 MINUTE + INTERVAL 105 SECOND, @r, 2), (8, 16.300, CURDATE() - INTERVAL 9 DAY + INTERVAL 465 MINUTE + INTERVAL 150 SECOND, @r, 1), (11, 17.600, CURDATE() - INTERVAL 9 DAY + INTERVAL 465 MINUTE + INTERVAL 195 SECOND, @r, 2);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 26, 2, 92.9, 732, 2, @s, 16);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 25.400, CURDATE() - INTERVAL 9 DAY + INTERVAL 465 MINUTE + INTERVAL 60 SECOND, @r, 4), (5, 15.000, CURDATE() - INTERVAL 9 DAY + INTERVAL 465 MINUTE + INTERVAL 105 SECOND, @r, 4);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 33, 1, 97.1, 471, 3, @s, 18);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Lower Body Power', 'strength', CURDATE() - INTERVAL 7 DAY, 'COMPLETED', CURDATE() - INTERVAL 7 DAY + INTERVAL 420 MINUTE, CURDATE() - INTERVAL 7 DAY + INTERVAL 420 MINUTE + INTERVAL 2228 SECOND, 1729, 123, CURDATE() - INTERVAL 7 DAY + INTERVAL 420 MINUTE, CURDATE() - INTERVAL 7 DAY + INTERVAL 420 MINUTE + INTERVAL 2228 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 16, 1, 94.1, 629, 1, @s, 9);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 15.000, CURDATE() - INTERVAL 7 DAY + INTERVAL 420 MINUTE + INTERVAL 60 SECOND, @r, 3);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 40, 2, 95.2, 707, 2, @s, 10);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 61, 3, 95.3, 393, 3, @s, 12);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'HIIT Cardio Blast', 'cardio', CURDATE() - INTERVAL 5 DAY, 'COMPLETED', CURDATE() - INTERVAL 5 DAY + INTERVAL 1095 MINUTE, CURDATE() - INTERVAL 5 DAY + INTERVAL 1095 MINUTE + INTERVAL 2094 SECOND, 1628, 324, CURDATE() - INTERVAL 5 DAY + INTERVAL 1095 MINUTE, CURDATE() - INTERVAL 5 DAY + INTERVAL 1095 MINUTE + INTERVAL 2094 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 65, 3, 95.6, 630, 1, @s, 5);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 164, 7, 95.9, 473, 2, @s, 6);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 82, 3, 96.5, 525, 3, @s, 7);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Mobility & Core', 'mobility', CURDATE() - INTERVAL 4 DAY, 'COMPLETED', CURDATE() - INTERVAL 4 DAY + INTERVAL 450 MINUTE, CURDATE() - INTERVAL 4 DAY + INTERVAL 450 MINUTE + INTERVAL 1620 SECOND, 1261, 11, CURDATE() - INTERVAL 4 DAY + INTERVAL 450 MINUTE, CURDATE() - INTERVAL 4 DAY + INTERVAL 450 MINUTE + INTERVAL 1620 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 4, 0, 100, 473, 1, @s, 19);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 4, 0, 100, 315, 2, @s, 13);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (2, 3, 0, 100, 473, 3, @s, 15);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Full Body Calisthenics', 'strength', CURDATE() - INTERVAL 3 DAY, 'COMPLETED', CURDATE() - INTERVAL 3 DAY + INTERVAL 465 MINUTE, CURDATE() - INTERVAL 3 DAY + INTERVAL 465 MINUTE + INTERVAL 2231 SECOND, 1738, 113, CURDATE() - INTERVAL 3 DAY + INTERVAL 465 MINUTE, CURDATE() - INTERVAL 3 DAY + INTERVAL 465 MINUTE + INTERVAL 2231 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 24, 2, 92.3, 553, 1, @s, 16);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 18.900, CURDATE() - INTERVAL 3 DAY + INTERVAL 465 MINUTE + INTERVAL 60 SECOND, @r, 4), (5, 20.200, CURDATE() - INTERVAL 3 DAY + INTERVAL 465 MINUTE + INTERVAL 105 SECOND, @r, 4);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 61, 4, 93.8, 553, 2, @s, 17);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 18.900, CURDATE() - INTERVAL 3 DAY + INTERVAL 465 MINUTE + INTERVAL 60 SECOND, @r, 1), (5, 20.200, CURDATE() - INTERVAL 3 DAY + INTERVAL 465 MINUTE + INTERVAL 105 SECOND, @r, 2), (8, 21.500, CURDATE() - INTERVAL 3 DAY + INTERVAL 465 MINUTE + INTERVAL 150 SECOND, @r, 1), (11, 22.800, CURDATE() - INTERVAL 3 DAY + INTERVAL 465 MINUTE + INTERVAL 195 SECOND, @r, 2);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 21, 1, 95.5, 632, 3, @s, 9);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 18.900, CURDATE() - INTERVAL 3 DAY + INTERVAL 465 MINUTE + INTERVAL 60 SECOND, @r, 3);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Upper Body Strength', 'strength', CURDATE() - INTERVAL 2 DAY, 'COMPLETED', CURDATE() - INTERVAL 2 DAY + INTERVAL 1080 MINUTE, CURDATE() - INTERVAL 2 DAY + INTERVAL 1080 MINUTE + INTERVAL 2567 SECOND, 2002, 133, CURDATE() - INTERVAL 2 DAY + INTERVAL 1080 MINUTE, CURDATE() - INTERVAL 2 DAY + INTERVAL 1080 MINUTE + INTERVAL 2567 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 65, 4, 94.2, 790, 1, @s, 17);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 20.200, CURDATE() - INTERVAL 2 DAY + INTERVAL 1080 MINUTE + INTERVAL 60 SECOND, @r, 1), (5, 21.500, CURDATE() - INTERVAL 2 DAY + INTERVAL 1080 MINUTE + INTERVAL 105 SECOND, @r, 2), (8, 22.800, CURDATE() - INTERVAL 2 DAY + INTERVAL 1080 MINUTE + INTERVAL 150 SECOND, @r, 1), (11, 24.100, CURDATE() - INTERVAL 2 DAY + INTERVAL 1080 MINUTE + INTERVAL 195 SECOND, @r, 2);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 27, 2, 93.1, 738, 2, @s, 16);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 20.200, CURDATE() - INTERVAL 2 DAY + INTERVAL 1080 MINUTE + INTERVAL 60 SECOND, @r, 4), (5, 21.500, CURDATE() - INTERVAL 2 DAY + INTERVAL 1080 MINUTE + INTERVAL 105 SECOND, @r, 4);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 34, 1, 97.1, 474, 3, @s, 18);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'Lower Body Power', 'strength', CURDATE() - INTERVAL 1 DAY, 'COMPLETED', CURDATE() - INTERVAL 1 DAY + INTERVAL 435 MINUTE, CURDATE() - INTERVAL 1 DAY + INTERVAL 435 MINUTE + INTERVAL 2231 SECOND, 1741, 125, CURDATE() - INTERVAL 1 DAY + INTERVAL 435 MINUTE, CURDATE() - INTERVAL 1 DAY + INTERVAL 435 MINUTE + INTERVAL 2231 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 16, 1, 94.1, 633, 1, @s, 9);
SET @r = LAST_INSERT_ID();
INSERT INTO form_error_logs (rep_number, joint_angle, occurred_at, session_exercise_result_id, form_rule_id) VALUES (2, 21.500, CURDATE() - INTERVAL 1 DAY + INTERVAL 435 MINUTE + INTERVAL 60 SECOND, @r, 3);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 41, 2, 95.3, 712, 2, @s, 10);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (3, 63, 2, 96.9, 396, 3, @s, 12);
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status, started_at, finished_at, active_seconds, total_reps, created_at, updated_at)
VALUES (@pid, NULL, 'HIIT Cardio Blast', 'cardio', CURDATE() - INTERVAL 0 DAY, 'COMPLETED', CURDATE() - INTERVAL 0 DAY + INTERVAL 450 MINUTE, CURDATE() - INTERVAL 0 DAY + INTERVAL 450 MINUTE + INTERVAL 2095 SECOND, 1637, 331, CURDATE() - INTERVAL 0 DAY + INTERVAL 450 MINUTE, CURDATE() - INTERVAL 0 DAY + INTERVAL 450 MINUTE + INTERVAL 2095 SECOND);
SET @s = LAST_INSERT_ID();
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 67, 3, 95.7, 634, 1, @s, 5);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 168, 6, 96.6, 475, 2, @s, 6);
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id) VALUES (4, 84, 3, 96.6, 528, 3, @s, 7);

-- Bài HOLD (exercises.category = 'HOLD', từ V12) đo bằng thời gian giữ ở active_seconds, không có rep
UPDATE session_exercise_results ser
  JOIN exercises e ON e.id = ser.exercise_id AND e.category = 'HOLD'
  JOIN workout_sessions ws ON ws.id = ser.workout_session_id
SET ser.valid_reps = 0, ser.invalid_reps = 0
WHERE ws.member_profile_id = @pid;
UPDATE workout_sessions ws
SET ws.total_reps = (SELECT COALESCE(SUM(ser.valid_reps + ser.invalid_reps), 0)
                     FROM session_exercise_results ser WHERE ser.workout_session_id = ws.id)
WHERE ws.member_profile_id = @pid;

-- Buổi chưa có bài HOLD nào -> thêm Plank 3 set ở cuối buổi (chạy lại không thêm nữa)
INSERT INTO session_exercise_results (sets_completed, valid_reps, invalid_reps, accuracy, active_seconds, sort_order, workout_session_id, exercise_id)
SELECT 3, 0, 0, 90.5 + MOD(ws.id * 7, 8),
       0,
       (SELECT COALESCE(MAX(x.sort_order), 0) + 1 FROM session_exercise_results x WHERE x.workout_session_id = ws.id),
       ws.id,
       (SELECT id FROM exercises WHERE name = 'Plank' AND category = 'HOLD' ORDER BY id LIMIT 1)
FROM workout_sessions ws
WHERE ws.member_profile_id = @pid
  AND ws.status = 'COMPLETED'
  AND NOT EXISTS (SELECT 1 FROM session_exercise_results s
                  JOIN exercises e ON e.id = s.exercise_id AND e.category = 'HOLD'
                  WHERE s.workout_session_id = ws.id);

-- Thời gian giữ thực tế mỗi set, tăng dần từ buổi đầu (t = 0) tới buổi cuối (t = 1)
SET @hold_first = (SELECT MIN(session_date) FROM workout_sessions WHERE member_profile_id = @pid);
SET @hold_span = GREATEST(1, DATEDIFF((SELECT MAX(session_date) FROM workout_sessions WHERE member_profile_id = @pid), @hold_first));
UPDATE session_exercise_results ser
  JOIN exercises e ON e.id = ser.exercise_id AND e.category = 'HOLD'
  JOIN workout_sessions ws ON ws.id = ser.workout_session_id
SET ser.active_seconds = ser.sets_completed * ROUND(
        CASE e.name
            WHEN 'Plank'       THEN 45 + 30 * DATEDIFF(ws.session_date, @hold_first) / @hold_span
            WHEN 'Handstand'   THEN 15 + 20 * DATEDIFF(ws.session_date, @hold_first) / @hold_span
            WHEN 'Front lever' THEN 8 + 10 * DATEDIFF(ws.session_date, @hold_first) / @hold_span
            WHEN 'Planche'     THEN 6 + 9 * DATEDIFF(ws.session_date, @hold_first) / @hold_span
            ELSE 20 + 10 * DATEDIFF(ws.session_date, @hold_first) / @hold_span
        END + MOD(ser.id, 3) - 1)
WHERE ws.member_profile_id = @pid;

-- active_seconds của buổi = tổng các bài; dời finished_at theo phần chênh để thời gian nghỉ giữ nguyên
DROP TEMPORARY TABLE IF EXISTS tmp_session_active;
CREATE TEMPORARY TABLE tmp_session_active AS
SELECT ws.id, SUM(ser.active_seconds) AS active_sec, SUM(ser.active_seconds) - ws.active_seconds AS delta_sec
FROM workout_sessions ws
JOIN session_exercise_results ser ON ser.workout_session_id = ws.id
WHERE ws.member_profile_id = @pid
GROUP BY ws.id, ws.active_seconds;
UPDATE workout_sessions ws
  JOIN tmp_session_active t ON t.id = ws.id
SET ws.finished_at = ws.finished_at + INTERVAL t.delta_sec SECOND,
    ws.updated_at = ws.updated_at + INTERVAL t.delta_sec SECOND,
    ws.active_seconds = t.active_sec;
DROP TEMPORARY TABLE tmp_session_active;

COMMIT;
SET SQL_SAFE_UPDATES = @old_safe_updates;

-- Kiểm tra nhanh
SELECT COUNT(*) AS sessions, MIN(session_date) AS first_day, MAX(session_date) AS last_day, SUM(total_reps) AS reps
FROM workout_sessions WHERE member_profile_id = @pid;
SELECT COUNT(*) AS body_metrics FROM member_body_metrics WHERE member_profile_id = @pid;
SELECT COUNT(*) AS form_errors FROM form_error_logs fel
  JOIN session_exercise_results ser ON ser.id = fel.session_exercise_result_id
  JOIN workout_sessions ws ON ws.id = ser.workout_session_id WHERE ws.member_profile_id = @pid;

