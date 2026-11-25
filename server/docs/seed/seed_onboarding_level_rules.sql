-- =====================================================================================
-- SEED DỮ LIỆU - Onboarding survey (member) + Rule phân loại level
-- =====================================================================================
-- Chạy THỦ CÔNG trên MySQL 8 (Workbench / CLI), KHÔNG phải migration Flyway. Chạy lại nhiều lần được.
--
-- Điều kiện trước khi chạy:
--   1. Backend đã khởi động ít nhất 1 lần sau khi pull code này -> Flyway đã chạy tới V6
--      (có các bảng level_rule_sets, level_rule_criteria, level_rule_bands, level_rule_outcomes,
--      survey_level_results).
--   2. Đã chạy seed_survey_management.sql (survey CALISHEALTH_ONBOARDING v1 ACTIVE + 14 câu hỏi).
--
-- File này làm 2 việc:
--   PHẦN A. Cấu hình hiển thị cho màn onboarding của member theo Figma (display_config, nhãn lựa chọn,
--           thêm skill L-sit, đơn vị "sec" cho plank). Bước "Current training routine": thêm câu
--           GOAL_DAYS_PER_WEEK (số buổi muốn tập); "Days per week" và "Minutes per session" (thói quen hiện tại)
--           chỉ hiện khi Training experience KHÁC "Never". Không đổi mã câu hỏi / lựa chọn cũ.
--   PHẦN B. Bộ luật phân loại level ONBOARDING_LEVEL (version mới, ACTIVE; version cũ -> ARCHIVED)
--           dựa trên 3 bài mặc định Push-up / Squat / Plank:
--
--           Bài       | Beginner (1đ)                          | Intermediate (2đ) | Advanced (3đ)
--           ----------+----------------------------------------+-------------------+--------------
--           Push-up   | 0 - 17 reps                            | 18 - 40           | >= 41
--           Squat     | 0 - 20 reps                            | 21 - 54           | >= 55
--           Plank     | < 30s: Limited (0.5đ) / 30 - 59s (1đ)  | 60 - 119s         | >= 120s
--
--           Nguồn tham khảo có thêm mức Elite; ở đây Elite được gộp vào Advanced (3 level).
--           Khoảng là [min, max): tính cả biên dưới, không tính biên trên (vd push-up 18 -> Intermediate).
--           Điểm tổng = trung bình có trọng số (trọng số 1 / bài) -> level:
--             < 1.5 Beginner | >= 1.5 Intermediate | >= 2.5 Advanced
--           Ngưỡng là chuẩn tham khảo cho người trưởng thành ~20-29 tuổi. Muốn tách theo giới tính / tuổi:
--           thêm khoảng có applies_when, đặt sort_order NHỎ HƠN khoảng chung, vd
--             applies_when = '{"operator":"EQ","questionCode":"GENDER","value":"FEMALE"}'
--             applies_when = '{"operator":"GTE","questionCode":"AGE","value":40}'
--
-- Ví dụ kết quả mong đợi (dùng để test trên FE):
--   Push-up 8,  Squat 20,  Plank 35   -> (1+1+1)/3   = 1.000 -> Beginner      (số mẫu trên Figma)
--   Push-up 20, Squat 25,  Plank 10   -> (2+2+0.5)/3 = 1.500 -> Intermediate
--   Push-up 45, Squat 30,  Plank 90   -> (3+2+2)/3   = 2.333 -> Intermediate
--   Push-up 30, Squat 60,  Plank 150  -> (2+3+3)/3   = 2.667 -> Advanced
--   Push-up 80, Squat 120, Plank 300  -> (3+3+3)/3   = 3.000 -> Advanced
--
-- Kiểm tra sau khi chạy: khởi động lại backend, log phải có
--   "Survey CALISHEALTH_ONBOARDING v1 configuration OK"
--   "Level rule set ONBOARDING_LEVEL v<n> configuration OK"
-- =====================================================================================

-- Đổi tên DB nếu spring.datasource.url của bạn trỏ tới DB khác
USE calishealth;
SET NAMES utf8mb4;
-- Các UPDATE bên dưới lọc theo mã (không theo khóa chính) -> tắt Safe Updates của Workbench (lỗi 1175)
SET @old_safe_updates = @@SQL_SAFE_UPDATES;
SET SQL_SAFE_UPDATES = 0;

START TRANSACTION;

SET @survey_id = (SELECT id FROM surveys WHERE survey_code = 'CALISHEALTH_ONBOARDING' AND status = 'ACTIVE');

-- =====================================================================================
-- PHẦN A. Hiển thị màn onboarding (display_config đọc bởi client/src/features/survey)
-- =====================================================================================
-- Khóa của display_config:
--   widget       select | cards | list | chips | tiles | scale | number (mặc định theo loại câu hỏi)
--   label        tiêu đề ngắn trên màn hình (mặc định = question_text)
--   hint         dòng phụ dưới tiêu đề
--   icon         person | calendar | ruler | weight | arrowUp | arrowDown | clock
--   optionIcons  {"OPTION_CODE": "heart" | "trophy" | "target" | "muscle" | "pulse"}
--   placeholder  chữ mờ trong ô nhập
--   min / max    (widget scale) dải số hiển thị thành các ô bấm

-- ----- Step 1: Body information -----
UPDATE assessment_questions SET display_config = '{"widget": "select", "label": "Gender", "icon": "person", "placeholder": "Select gender"}'
WHERE question_code = 'GENDER';
UPDATE assessment_questions SET display_config = '{"label": "Age", "icon": "calendar", "placeholder": "22"}'
WHERE question_code = 'AGE';
UPDATE assessment_questions SET display_config = '{"label": "Height", "icon": "ruler", "placeholder": "170"}'
WHERE question_code = 'HEIGHT';
UPDATE assessment_questions SET display_config = '{"label": "Weight", "icon": "weight", "placeholder": "65"}'
WHERE question_code = 'WEIGHT';

UPDATE assessment_options o JOIN assessment_questions q ON q.id = o.question_id
SET o.option_label = 'Other'
WHERE q.question_code = 'GENDER' AND o.option_code = 'OTHER';

-- ----- Step 2: Goals and motivation -----
UPDATE assessment_questions
SET display_config = '{"widget": "cards", "label": "Why do you train?", "optionIcons": {"HEALTH": "heart", "SKILLS": "trophy"}}'
WHERE question_code = 'GOAL_TYPE';
UPDATE assessment_options o JOIN assessment_questions q ON q.id = o.question_id
SET o.option_label = CASE o.option_code WHEN 'HEALTH' THEN 'For health' WHEN 'SKILLS' THEN 'For skills' ELSE o.option_label END
WHERE q.question_code = 'GOAL_TYPE';

UPDATE assessment_questions
SET display_config = '{"widget": "list", "label": "What''s your health goal?", "optionIcons": {"LOSE_WEIGHT": "target", "BUILD_MUSCLE": "muscle", "STAY_FIT": "pulse"}}'
WHERE question_code = 'HEALTH_GOAL';

UPDATE assessment_questions SET display_config = '{"widget": "chips", "label": "Which skills do you want to learn?"}'
WHERE question_code = 'TRAINING_SKILLS';
-- Figma có thêm L-sit
INSERT IGNORE INTO assessment_options (question_id, option_code, option_label, option_value, sort_order)
SELECT id, 'L_SIT', 'L-sit', NULL, 6 FROM assessment_questions WHERE question_code = 'TRAINING_SKILLS';

UPDATE assessment_questions SET display_config = '{"widget": "chips", "label": "What motivates you?"}'
WHERE question_code = 'MOTIVATIONS';
-- Nhãn + thứ tự theo Figma: Health, Appearance, Energy, Stress relief, Confidence
UPDATE assessment_options o JOIN assessment_questions q ON q.id = o.question_id
SET o.option_label = CASE o.option_code
        WHEN 'HEALTH' THEN 'Health' WHEN 'APPEARANCE' THEN 'Appearance' WHEN 'ENERGY' THEN 'Energy'
        WHEN 'STRESS_RELIEF' THEN 'Stress relief' WHEN 'CONFIDENCE' THEN 'Confidence' ELSE o.option_label END,
    o.sort_order = CASE o.option_code
        WHEN 'HEALTH' THEN 1 WHEN 'APPEARANCE' THEN 2 WHEN 'ENERGY' THEN 3
        WHEN 'STRESS_RELIEF' THEN 4 WHEN 'CONFIDENCE' THEN 5 ELSE o.sort_order END
WHERE q.question_code = 'MOTIVATIONS';

-- ----- Step 3: Current training routine -----
UPDATE assessment_questions SET display_config = '{"widget": "tiles", "label": "Training experience"}'
WHERE question_code = 'TRAINING_EXPERIENCE';
UPDATE assessment_options o JOIN assessment_questions q ON q.id = o.question_id
SET o.option_label = CASE o.option_code
        WHEN 'NONE' THEN 'Never' WHEN 'NEVER' THEN 'Never' WHEN 'UNDER_6_MONTHS' THEN 'Under 6 months'
        WHEN 'MONTHS_6_TO_12' THEN '6-12 months' WHEN 'OVER_1_YEAR' THEN 'Over 1 year' ELSE o.option_label END
WHERE q.question_code = 'TRAINING_EXPERIENCE';

UPDATE assessment_questions SET display_config = '{"widget": "scale", "label": "Days per week", "min": 1, "max": 7}'
WHERE question_code = 'TRAINING_DAYS_PER_WEEK';

UPDATE assessment_questions SET display_config = '{"widget": "tiles", "label": "Minutes per session"}'
WHERE question_code = 'TRAINING_MINUTES_PER_SESSION';

-- Số buổi / tuần member MUỐN tập (luôn hiện, kể cả người chưa từng tập)
INSERT IGNORE INTO assessment_questions (question_code, question_text, description, question_type, required,
                                         validation_rules, display_config, unit)
VALUES ('GOAL_DAYS_PER_WEEK', 'How many days per week do you want to train?', NULL, 'NUMBER', 1,
        '{"integerOnly": true, "min": 1, "max": 7}',
        '{"widget": "scale", "label": "Goal days per week", "min": 1, "max": 7}', 'days');
SET @step_routine = (SELECT id FROM survey_steps WHERE survey_id = @survey_id AND step_code = 'CURRENT_TRAINING_ROUTINE');
INSERT IGNORE INTO survey_step_questions (step_id, question_id, sort_order)
SELECT @step_routine, id, 3 FROM assessment_questions WHERE question_code = 'GOAL_DAYS_PER_WEEK';

-- Thứ tự: Training experience, Days per week, Goal days per week, Minutes per session.
-- "Never" -> ẩn 2 câu về thói quen hiện tại (tránh khai không logic: chưa tập nhưng vẫn chọn số buổi / phút).
-- NE với câu chưa trả lời luôn sai -> 2 câu này chỉ hiện sau khi đã chọn experience.
-- Mã của lựa chọn "Never" khác nhau giữa các DB (NONE trong seed_survey_management.sql, NEVER nếu tạo qua màn
-- quản lý) -> đọc mã thật thay vì viết cứng, nếu không điều kiện luôn đúng và không bao giờ ẩn.
SET @never_code = (SELECT o.option_code FROM assessment_options o
                   JOIN assessment_questions q ON q.id = o.question_id
                   WHERE q.question_code = 'TRAINING_EXPERIENCE' AND o.option_code IN ('NONE', 'NEVER')
                   ORDER BY o.sort_order LIMIT 1);
UPDATE survey_step_questions l JOIN assessment_questions q ON q.id = l.question_id
SET l.sort_order = CASE q.question_code
        WHEN 'TRAINING_EXPERIENCE' THEN 1 WHEN 'TRAINING_DAYS_PER_WEEK' THEN 2
        WHEN 'GOAL_DAYS_PER_WEEK' THEN 3 WHEN 'TRAINING_MINUTES_PER_SESSION' THEN 4 END,
    l.conditional_rules = CASE WHEN q.question_code IN ('TRAINING_DAYS_PER_WEEK', 'TRAINING_MINUTES_PER_SESSION')
        THEN JSON_OBJECT('operator', 'NE', 'questionCode', 'TRAINING_EXPERIENCE', 'value', @never_code) ELSE NULL END
WHERE l.step_id = @step_routine
  AND q.question_code IN ('TRAINING_EXPERIENCE', 'TRAINING_DAYS_PER_WEEK', 'GOAL_DAYS_PER_WEEK',
                          'TRAINING_MINUTES_PER_SESSION');
UPDATE assessment_options o JOIN assessment_questions q ON q.id = o.question_id
SET o.option_label = CASE o.option_code
        WHEN 'MIN_15' THEN '15' WHEN 'MIN_30' THEN '30' WHEN 'MIN_45' THEN '45' WHEN 'MIN_60_PLUS' THEN '60+'
        ELSE o.option_label END
WHERE q.question_code = 'TRAINING_MINUTES_PER_SESSION';

-- ----- Step 4: Level test -----
UPDATE assessment_questions
SET display_config = '{"label": "Push-up", "hint": "Max reps in a row", "icon": "arrowUp", "placeholder": "0"}'
WHERE question_code = 'PUSH_UP_MAX_REPS';
UPDATE assessment_questions
SET display_config = '{"label": "Squat", "hint": "Max reps in a row", "icon": "arrowDown", "placeholder": "0"}'
WHERE question_code = 'SQUAT_MAX_REPS';
UPDATE assessment_questions
SET display_config = '{"label": "Plank", "hint": "Max hold time", "icon": "clock", "placeholder": "0"}', unit = 'sec'
WHERE question_code = 'PLANK_MAX_SECONDS';

-- =====================================================================================
-- PHẦN B. Rule phân loại level
-- =====================================================================================
-- 3 level (Elite gộp vào Advanced). Đã có từ seed trước, INSERT IGNORE cho DB chưa có.
INSERT IGNORE INTO fitness_levels (name) VALUES ('Beginner'), ('Intermediate'), ('Advanced');
SET @lv_beginner     = (SELECT id FROM fitness_levels WHERE name = 'Beginner');
SET @lv_intermediate = (SELECT id FROM fitness_levels WHERE name = 'Intermediate');
SET @lv_advanced     = (SELECT id FROM fitness_levels WHERE name = 'Advanced');

-- Bộ luật cũ (nếu có) -> ARCHIVED; kết quả đã chấm vẫn trỏ về nó nên không xóa
UPDATE level_rule_sets SET status = 'ARCHIVED'
WHERE survey_code = 'CALISHEALTH_ONBOARDING' AND status = 'ACTIVE';

SET @rule_version = (SELECT COALESCE(MAX(version), 0) + 1 FROM level_rule_sets WHERE rule_set_code = 'ONBOARDING_LEVEL');
INSERT INTO level_rule_sets (rule_set_code, name, description, survey_code, version, status, scoring_method)
VALUES ('ONBOARDING_LEVEL', 'Onboarding level classification',
        'Classifies a member from the max push-ups, max bodyweight squats and longest plank in the level test.',
        'CALISHEALTH_ONBOARDING', @rule_version, 'ACTIVE', 'WEIGHTED_AVERAGE');
SET @rule_set = LAST_INSERT_ID();

-- ----- Tiêu chí 1: Push-up -----
INSERT INTO level_rule_criteria (rule_set_id, criterion_code, label, question_code, weight, required, sort_order)
VALUES (@rule_set, 'PUSH_UP', 'Push-up', 'PUSH_UP_MAX_REPS', 1, 1, 1);
SET @c = LAST_INSERT_ID();
INSERT INTO level_rule_bands (criterion_id, min_value, max_value, score, fitness_level_id, band_label, applies_when, sort_order) VALUES
    (@c, 0,  18,   1, @lv_beginner,     NULL, NULL, 1),
    (@c, 18, 41,   2, @lv_intermediate, NULL, NULL, 2),
    (@c, 41, NULL, 3, @lv_advanced,     NULL, NULL, 3);

-- ----- Tiêu chí 2: Squat -----
INSERT INTO level_rule_criteria (rule_set_id, criterion_code, label, question_code, weight, required, sort_order)
VALUES (@rule_set, 'SQUAT', 'Squat', 'SQUAT_MAX_REPS', 1, 1, 2);
SET @c = LAST_INSERT_ID();
INSERT INTO level_rule_bands (criterion_id, min_value, max_value, score, fitness_level_id, band_label, applies_when, sort_order) VALUES
    (@c, 0,  21,   1, @lv_beginner,     NULL, NULL, 1),
    (@c, 21, 55,   2, @lv_intermediate, NULL, NULL, 2),
    (@c, 55, NULL, 3, @lv_advanced,     NULL, NULL, 3);

-- ----- Tiêu chí 3: Plank (giây) -----
INSERT INTO level_rule_criteria (rule_set_id, criterion_code, label, question_code, weight, required, sort_order)
VALUES (@rule_set, 'PLANK', 'Plank', 'PLANK_MAX_SECONDS', 1, 1, 3);
SET @c = LAST_INSERT_ID();
INSERT INTO level_rule_bands (criterion_id, min_value, max_value, score, fitness_level_id, band_label, applies_when, sort_order) VALUES
    (@c, 0,   30,   0.5, @lv_beginner,     'Limited', NULL, 1),
    (@c, 30,  60,   1,   @lv_beginner,     NULL,      NULL, 2),
    (@c, 60,  120,  2,   @lv_intermediate, NULL,      NULL, 3),
    (@c, 120, NULL, 3,   @lv_advanced,     NULL,      NULL, 4);

-- ----- Điểm tổng -> level + kế hoạch gợi ý -----
-- Số tuần / buổi mỗi tuần / phút mỗi buổi lấy từ cấu hình bước Result (Content Manager > Configure result);
-- ở đây chỉ là nội dung kế hoạch theo level. Các buổi lặp vòng theo thứ tự trong "sessions".
INSERT INTO level_rule_outcomes (rule_set_id, fitness_level_id, min_score, sort_order, summary, recommendation) VALUES
(@rule_set, @lv_beginner, 0, 1,
 'You''re ready to build your foundation. Focus on controlled reps, full-body strength and a consistent routine.',
 '{"planName": "Foundation Builder",
   "description": "Build the basics with approachable progressions for your push-ups, squats and core strength.",
   "note": "Rest between sessions. Start with easier variations and progress at your pace.",
   "sessions": [
     {"name": "Full body A", "exercises": [
       {"name": "Push-up", "detail": "3 sets • 5–6 reps • controlled tempo"},
       {"name": "Squat", "detail": "3 sets • 12 reps • full range of motion"},
       {"name": "Plank", "detail": "3 sets • 20–25 sec • stable core hold"}]},
     {"name": "Full body B", "exercises": [
       {"name": "Incline push-up", "detail": "3 sets • 8–10 reps • controlled tempo"},
       {"name": "Squat", "detail": "3 sets • 15 reps • full range of motion"},
       {"name": "Plank", "detail": "3 sets • 30 sec • stable core hold"}]}]}'),
(@rule_set, @lv_intermediate, 1.5, 2,
 'You have a solid base. Time to add progressive overload and train your weaker patterns with intent.',
 '{"planName": "Strength Progression",
   "description": "Add volume across your main movements while keeping your squat and push-up patterns sharp.",
   "note": "Add a few reps each week. Keep two reps in reserve on every set.",
   "sessions": [
     {"name": "Push focus", "exercises": [
       {"name": "Push-up", "detail": "4 sets • 12–15 reps • controlled tempo"},
       {"name": "Pike push-up", "detail": "3 sets • 8 reps • full range of motion"},
       {"name": "Plank", "detail": "3 sets • 45 sec • stable core hold"}]},
     {"name": "Leg focus", "exercises": [
       {"name": "Squat", "detail": "4 sets • 25 reps • full range of motion"},
       {"name": "Lunge", "detail": "3 sets • 12 reps / leg • controlled tempo"},
       {"name": "Calf raise", "detail": "3 sets • 20 reps • controlled tempo"}]},
     {"name": "Pull focus", "exercises": [
       {"name": "Australian row", "detail": "4 sets • 10 reps • controlled tempo"},
       {"name": "Dead hang", "detail": "3 sets • 30 sec • active shoulders"},
       {"name": "Hollow hold", "detail": "3 sets • 25 sec • stable core hold"}]}]}'),
(@rule_set, @lv_advanced, 2.5, 3,
 'You train with confidence. Push intensity, structure your volume and keep advancing your numbers.',
 '{"planName": "Performance Peak",
   "description": "Train for strength and power with harder variations, denser work and deliberate accessory work.",
   "note": "Prioritise quality reps. Deload in the final week of each block.",
   "sessions": [
     {"name": "Push heavy", "exercises": [
       {"name": "Archer push-up", "detail": "4 sets • 6 reps / side • controlled tempo"},
       {"name": "Dip", "detail": "4 sets • 10 reps • full range of motion"},
       {"name": "Plank", "detail": "3 sets • 90 sec • stable core hold"}]},
     {"name": "Legs heavy", "exercises": [
       {"name": "Bulgarian split squat", "detail": "4 sets • 10 reps / leg • controlled tempo"},
       {"name": "Jump squat", "detail": "4 sets • 12 reps • explosive tempo"},
       {"name": "Single-leg calf raise", "detail": "3 sets • 15 reps / leg"}]},
     {"name": "Pull heavy", "exercises": [
       {"name": "Pull-up", "detail": "5 sets • 6–8 reps • controlled tempo"},
       {"name": "Chin-up", "detail": "3 sets • 8 reps • full range of motion"},
       {"name": "Hanging knee raise", "detail": "3 sets • 12 reps"}]}]}');

COMMIT;

SET SQL_SAFE_UPDATES = @old_safe_updates;

-- -------------------------------------------------------------------------------------
-- Kiểm tra nhanh
-- -------------------------------------------------------------------------------------
-- survey_id NULL = chưa chạy seed_survey_management.sql
SELECT @survey_id AS onboarding_survey_id, @rule_set AS rule_set_id, @rule_version AS rule_set_version;

-- 3 tiêu chí, 10 khoảng
SELECT c.sort_order, c.criterion_code, c.question_code, c.weight,
       b.min_value, b.max_value, b.score, fl.name AS level_name, b.band_label
FROM level_rule_criteria c
JOIN level_rule_bands b ON b.criterion_id = c.id
LEFT JOIN fitness_levels fl ON fl.id = b.fitness_level_id
WHERE c.rule_set_id = @rule_set
ORDER BY c.sort_order, b.sort_order;

-- 3 mốc level
SELECT o.sort_order AS level_rank, fl.name AS level_name, o.min_score,
       JSON_UNQUOTE(JSON_EXTRACT(o.recommendation, '$.planName')) AS plan_name
FROM level_rule_outcomes o
JOIN fitness_levels fl ON fl.id = o.fitness_level_id
WHERE o.rule_set_id = @rule_set
ORDER BY o.sort_order;

-- Kết quả đã chấm (sau khi member hoàn thành khảo sát trên FE)
-- SELECT r.session_id, u.email, r.method, fl.name AS level_name, r.total_score, r.evaluated_at
-- FROM survey_level_results r
-- JOIN survey_sessions s ON s.id = r.session_id
-- JOIN users u ON u.id = s.user_id
-- LEFT JOIN fitness_levels fl ON fl.id = r.fitness_level_id
-- ORDER BY r.evaluated_at DESC;

-- =====================================================================================
-- RESET (tùy chọn) - để một member làm lại onboarding từ đầu khi test. Chỉ dùng trên DB local/dev.
-- Xóa mọi phiên khảo sát onboarding + câu trả lời + kết quả level của 1 email.
-- =====================================================================================
-- SET @member_email = 'member@example.com';
-- SET @member_id = (SELECT id FROM users WHERE email COLLATE utf8mb4_bin = @member_email COLLATE utf8mb4_bin);
-- SET SQL_SAFE_UPDATES = 0;
-- START TRANSACTION;
-- DELETE r FROM survey_level_results r JOIN survey_sessions s ON s.id = r.session_id WHERE s.user_id = @member_id;
-- DELETE a FROM assessment_answers a JOIN survey_sessions s ON s.id = a.session_id WHERE s.user_id = @member_id;
-- DELETE FROM survey_sessions WHERE user_id = @member_id;
-- UPDATE member_profiles SET fitness_level_id = NULL WHERE user_id = @member_id;
-- COMMIT;
