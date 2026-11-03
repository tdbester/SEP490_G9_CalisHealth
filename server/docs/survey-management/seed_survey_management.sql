-- =====================================================================================
-- SEED DỮ LIỆU - Màn "Survey management" (Content Manager)
-- =====================================================================================
-- Chạy THỦ CÔNG trên MySQL 8 (Workbench / CLI), KHÔNG phải migration Flyway.
--
-- Điều kiện trước khi chạy:
--   1. Backend đã khởi động ít nhất 1 lần -> Flyway đã chạy V1..V4 (có cột step_type, result_config...).
--   2. Đã đăng ký sẵn 1 tài khoản sẽ làm Content Manager (qua POST /api/auth/register),
--      rồi sửa email ở biến @cm_email bên dưới.
--   3. DB chưa có survey CALISHEALTH_ONBOARDING version 1. Nếu đã có, chạy khối "RESET" ở cuối file
--      trước (đọc kỹ cảnh báo).
--
-- Kết quả:
--   - Tài khoản @cm_email -> role CONTENT_MANAGER, enabled = 1
--   - 3 fitness level: Beginner / Intermediate / Advanced (bỏ qua nếu đã có)
--   - Survey CALISHEALTH_ONBOARDING v1 (ACTIVE) gồm 5 bước như trên màn hình:
--       1. Body information             (QUESTIONS) GENDER, AGE, HEIGHT, WEIGHT
--       2. Goals and motivation         (QUESTIONS) GOAL_TYPE, HEALTH_GOAL*, TRAINING_SKILLS*, MOTIVATIONS
--       3. Current training routine     (QUESTIONS) TRAINING_EXPERIENCE, TRAINING_DAYS_PER_WEEK, TRAINING_MINUTES_PER_SESSION
--       4. Level test                   (QUESTIONS) PUSH_UP_MAX_REPS, SQUAT_MAX_REPS, PLANK_MAX_SECONDS
--       5. Result and recommended plan  (RESULT)    không có câu hỏi, có result_config
--     (*) câu hỏi có điều kiện hiển thị theo GOAL_TYPE.
--   Mã bước / câu hỏi / lựa chọn khớp với postman/CalisHealth-Survey.postman_collection.json,
--   nên collection Postman của Survey vẫn chạy được sau khi seed.
--
-- Kiểm tra sau khi chạy: khởi động lại backend, log phải có
--   "Survey CALISHEALTH_ONBOARDING v1 configuration OK"
-- =====================================================================================

-- Đổi tên DB nếu spring.datasource.url của bạn trỏ tới DB khác
USE calishealth;
SET NAMES utf8mb4;

-- >>> SỬA EMAIL NÀY (viết thường, đúng như lúc đăng ký) <<<
SET @cm_email = 'content.manager@example.com';

START TRANSACTION;

-- -------------------------------------------------------------------------------------
-- 1. Content Manager
-- -------------------------------------------------------------------------------------
-- COLLATE ở cả 2 vế: cột users.email và biến @cm_email có thể khác collation
-- (utf8mb4_unicode_ci vs utf8mb4_0900_ai_ci) -> tránh lỗi 1267 "Illegal mix of collations".
-- UPDATE theo khóa chính để chạy được khi Workbench bật "Safe Updates" (lỗi 1175).
SET @cm_id = (SELECT id FROM users WHERE email COLLATE utf8mb4_bin = @cm_email COLLATE utf8mb4_bin);
UPDATE users SET role = 'CONTENT_MANAGER', enabled = 1 WHERE id = @cm_id;

-- -------------------------------------------------------------------------------------
-- 2. Fitness levels (dùng cho cấu hình bước Result)
-- -------------------------------------------------------------------------------------
INSERT IGNORE INTO fitness_levels (name) VALUES ('Beginner'), ('Intermediate'), ('Advanced');
SET @level_beginner = (SELECT id FROM fitness_levels WHERE name = 'Beginner');

-- -------------------------------------------------------------------------------------
-- 3. Survey
-- -------------------------------------------------------------------------------------
INSERT INTO surveys (survey_code, survey_name, description, version, status)
VALUES ('CALISHEALTH_ONBOARDING', 'CalisHealth onboarding survey',
        'Questions members answer when they sign up, used to build their first training plan.', 1, 'ACTIVE');
SET @survey_id = LAST_INSERT_ID();

-- -------------------------------------------------------------------------------------
-- 4. Steps (updated_at lùi về quá khứ cho giống màn hình "Updated 2 days ago"...)
-- -------------------------------------------------------------------------------------
INSERT INTO survey_steps (survey_id, step_code, step_name, description, step_type, result_config, sort_order, status,
                          created_at, updated_at, updated_by)
VALUES (@survey_id, 'BODY_INFORMATION', 'Body information',
        'Collect height, weight and other basic body measurements.',
        'QUESTIONS', NULL, 1, 'ACTIVE', NOW(6) - INTERVAL 30 DAY, NOW(6) - INTERVAL 2 DAY, @cm_id);
SET @step_body = LAST_INSERT_ID();

INSERT INTO survey_steps (survey_id, step_code, step_name, description, step_type, result_config, sort_order, status,
                          created_at, updated_at, updated_by)
VALUES (@survey_id, 'GOALS_AND_MOTIVATION', 'Goals and motivation',
        'Identify health or skill goals, target skills and motivation.',
        'QUESTIONS', NULL, 2, 'ACTIVE', NOW(6) - INTERVAL 30 DAY, NOW(6) - INTERVAL 3 DAY, @cm_id);
SET @step_goals = LAST_INSERT_ID();

INSERT INTO survey_steps (survey_id, step_code, step_name, description, step_type, result_config, sort_order, status,
                          created_at, updated_at, updated_by)
VALUES (@survey_id, 'CURRENT_TRAINING_ROUTINE', 'Current training routine',
        'Evaluate training frequency, duration and current skills.',
        'QUESTIONS', NULL, 3, 'ACTIVE', NOW(6) - INTERVAL 30 DAY, NOW(6) - INTERVAL 7 DAY, @cm_id);
SET @step_routine = LAST_INSERT_ID();

INSERT INTO survey_steps (survey_id, step_code, step_name, description, step_type, result_config, sort_order, status,
                          created_at, updated_at, updated_by)
VALUES (@survey_id, 'LEVEL_TEST', 'Level test',
        'Assess current ability with max reps and isometric holds.',
        'QUESTIONS', NULL, 4, 'ACTIVE', NOW(6) - INTERVAL 30 DAY, NOW(6) - INTERVAL 4 DAY, @cm_id);
SET @step_level = LAST_INSERT_ID();

INSERT INTO survey_steps (survey_id, step_code, step_name, description, step_type, result_config, sort_order, status,
                          created_at, updated_at, updated_by)
VALUES (@survey_id, 'RESULT_AND_RECOMMENDED_PLAN', 'Result and recommended plan',
        'Classify the member''s level and build the recommended plan.',
        'RESULT',
        JSON_OBJECT('showLevelBreakdown', TRUE, 'showPlanPreview', TRUE, 'planDurationWeeks', 4,
                    'sessionsPerWeek', 3, 'minutesPerSession', 30, 'fallbackFitnessLevelId', @level_beginner),
        5, 'ACTIVE', NOW(6) - INTERVAL 30 DAY, NOW(6) - INTERVAL 3 DAY, @cm_id);

-- -------------------------------------------------------------------------------------
-- 5. Questions + options + gắn vào bước
--    updated_at của câu hỏi cũ hơn của bước, để "Updated ..." trên màn hình lấy theo bước.
-- -------------------------------------------------------------------------------------

-- ===== Step 1: Body information =====
INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit, created_at, updated_at)
VALUES ('GENDER', 'What is your gender?', NULL, 'SINGLE_SELECT', 1, NULL, NULL, NOW(6) - INTERVAL 30 DAY, NOW(6) - INTERVAL 30 DAY);
SET @q = LAST_INSERT_ID();
INSERT INTO assessment_options (question_id, option_code, option_label, option_value, sort_order) VALUES
    (@q, 'MALE', 'Male', NULL, 1),
    (@q, 'FEMALE', 'Female', NULL, 2),
    (@q, 'OTHER', 'Other / prefer not to say', NULL, 3);
INSERT INTO survey_step_questions (step_id, question_id, sort_order) VALUES (@step_body, @q, 1);

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit, created_at, updated_at)
VALUES ('AGE', 'How old are you?', NULL, 'NUMBER', 1, '{"integerOnly": true, "min": 13, "max": 100}', 'years',
        NOW(6) - INTERVAL 30 DAY, NOW(6) - INTERVAL 30 DAY);
INSERT INTO survey_step_questions (step_id, question_id, sort_order) VALUES (@step_body, LAST_INSERT_ID(), 2);

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit, created_at, updated_at)
VALUES ('HEIGHT', 'What is your height?', NULL, 'NUMBER', 1, '{"min": 100, "max": 250, "maxDecimals": 1}', 'cm',
        NOW(6) - INTERVAL 30 DAY, NOW(6) - INTERVAL 30 DAY);
INSERT INTO survey_step_questions (step_id, question_id, sort_order) VALUES (@step_body, LAST_INSERT_ID(), 3);

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit, created_at, updated_at)
VALUES ('WEIGHT', 'What is your weight?', NULL, 'NUMBER', 1, '{"min": 30, "max": 300, "maxDecimals": 1}', 'kg',
        NOW(6) - INTERVAL 30 DAY, NOW(6) - INTERVAL 30 DAY);
INSERT INTO survey_step_questions (step_id, question_id, sort_order) VALUES (@step_body, LAST_INSERT_ID(), 4);

-- ===== Step 2: Goals and motivation =====
INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit, created_at, updated_at)
VALUES ('GOAL_TYPE', 'What is your main goal?', NULL, 'SINGLE_SELECT', 1, NULL, NULL, NOW(6) - INTERVAL 30 DAY, NOW(6) - INTERVAL 30 DAY);
SET @q = LAST_INSERT_ID();
INSERT INTO assessment_options (question_id, option_code, option_label, option_value, sort_order) VALUES
    (@q, 'HEALTH', 'Improve my health and fitness', NULL, 1),
    (@q, 'SKILLS', 'Learn calisthenics skills', NULL, 2);
INSERT INTO survey_step_questions (step_id, question_id, sort_order) VALUES (@step_goals, @q, 1);

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit, created_at, updated_at)
VALUES ('HEALTH_GOAL', 'Which health goal fits you best?', NULL, 'SINGLE_SELECT', 1, NULL, NULL, NOW(6) - INTERVAL 30 DAY, NOW(6) - INTERVAL 30 DAY);
SET @q = LAST_INSERT_ID();
INSERT INTO assessment_options (question_id, option_code, option_label, option_value, sort_order) VALUES
    (@q, 'LOSE_WEIGHT', 'Lose weight', NULL, 1),
    (@q, 'BUILD_MUSCLE', 'Build muscle', NULL, 2),
    (@q, 'STAY_FIT', 'Stay fit', NULL, 3);
INSERT INTO survey_step_questions (step_id, question_id, sort_order, conditional_rules)
VALUES (@step_goals, @q, 2, '{"operator": "EQ", "questionCode": "GOAL_TYPE", "value": "HEALTH"}');

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit, created_at, updated_at)
VALUES ('TRAINING_SKILLS', 'Which skills do you want to learn?', 'Pick up to 3 skills.', 'MULTIPLE_SELECT', 1,
        '{"minSelections": 1, "maxSelections": 3}', NULL, NOW(6) - INTERVAL 30 DAY, NOW(6) - INTERVAL 30 DAY);
SET @q = LAST_INSERT_ID();
INSERT INTO assessment_options (question_id, option_code, option_label, option_value, sort_order) VALUES
    (@q, 'MUSCLE_UP', 'Muscle-up', NULL, 1),
    (@q, 'HANDSTAND', 'Handstand', NULL, 2),
    (@q, 'PLANCHE', 'Planche', NULL, 3),
    (@q, 'FRONT_LEVER', 'Front lever', NULL, 4),
    (@q, 'HUMAN_FLAG', 'Human flag', NULL, 5);
INSERT INTO survey_step_questions (step_id, question_id, sort_order, conditional_rules)
VALUES (@step_goals, @q, 3, '{"operator": "EQ", "questionCode": "GOAL_TYPE", "value": "SKILLS"}');

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit, created_at, updated_at)
VALUES ('MOTIVATIONS', 'What motivates you to train?', 'Pick up to 3 answers.', 'MULTIPLE_SELECT', 1,
        '{"minSelections": 1, "maxSelections": 3}', NULL, NOW(6) - INTERVAL 30 DAY, NOW(6) - INTERVAL 30 DAY);
SET @q = LAST_INSERT_ID();
INSERT INTO assessment_options (question_id, option_code, option_label, option_value, sort_order) VALUES
    (@q, 'HEALTH', 'Better health', NULL, 1),
    (@q, 'ENERGY', 'More energy', NULL, 2),
    (@q, 'CONFIDENCE', 'More confidence', NULL, 3),
    (@q, 'APPEARANCE', 'Look better', NULL, 4),
    (@q, 'STRESS_RELIEF', 'Stress relief', NULL, 5);
INSERT INTO survey_step_questions (step_id, question_id, sort_order) VALUES (@step_goals, @q, 4);

-- ===== Step 3: Current training routine =====
INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit, created_at, updated_at)
VALUES ('TRAINING_EXPERIENCE', 'How long have you been training?', NULL, 'SINGLE_SELECT', 1, NULL, NULL,
        NOW(6) - INTERVAL 30 DAY, NOW(6) - INTERVAL 30 DAY);
SET @q = LAST_INSERT_ID();
INSERT INTO assessment_options (question_id, option_code, option_label, option_value, sort_order) VALUES
    (@q, 'NONE', 'I have not trained before', NULL, 1),
    (@q, 'UNDER_6_MONTHS', 'Less than 6 months', NULL, 2),
    (@q, 'MONTHS_6_TO_12', '6 to 12 months', NULL, 3),
    (@q, 'OVER_1_YEAR', 'More than 1 year', NULL, 4);
INSERT INTO survey_step_questions (step_id, question_id, sort_order) VALUES (@step_routine, @q, 1);

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit, created_at, updated_at)
VALUES ('TRAINING_DAYS_PER_WEEK', 'How many days per week do you train?', NULL, 'NUMBER', 1,
        '{"integerOnly": true, "min": 0, "max": 7}', 'days', NOW(6) - INTERVAL 30 DAY, NOW(6) - INTERVAL 30 DAY);
INSERT INTO survey_step_questions (step_id, question_id, sort_order) VALUES (@step_routine, LAST_INSERT_ID(), 2);

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit, created_at, updated_at)
VALUES ('TRAINING_MINUTES_PER_SESSION', 'How long is each training session?', NULL, 'SINGLE_SELECT', 1, NULL, NULL,
        NOW(6) - INTERVAL 30 DAY, NOW(6) - INTERVAL 30 DAY);
SET @q = LAST_INSERT_ID();
INSERT INTO assessment_options (question_id, option_code, option_label, option_value, sort_order) VALUES
    (@q, 'MIN_15', 'About 15 minutes', '15', 1),
    (@q, 'MIN_30', 'About 30 minutes', '30', 2),
    (@q, 'MIN_45', 'About 45 minutes', '45', 3),
    (@q, 'MIN_60_PLUS', '60 minutes or more', '60', 4);
INSERT INTO survey_step_questions (step_id, question_id, sort_order) VALUES (@step_routine, @q, 3);

-- ===== Step 4: Level test =====
INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit, created_at, updated_at)
VALUES ('PUSH_UP_MAX_REPS', 'Max push-ups in one set', 'Do as many clean push-ups as you can without stopping.',
        'NUMBER', 1, '{"integerOnly": true, "min": 0, "max": 200}', 'reps', NOW(6) - INTERVAL 30 DAY, NOW(6) - INTERVAL 30 DAY);
INSERT INTO survey_step_questions (step_id, question_id, sort_order) VALUES (@step_level, LAST_INSERT_ID(), 1);

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit, created_at, updated_at)
VALUES ('SQUAT_MAX_REPS', 'Max bodyweight squats in one set', 'Full depth, without resting.',
        'NUMBER', 1, '{"integerOnly": true, "min": 0, "max": 500}', 'reps', NOW(6) - INTERVAL 30 DAY, NOW(6) - INTERVAL 30 DAY);
INSERT INTO survey_step_questions (step_id, question_id, sort_order) VALUES (@step_level, LAST_INSERT_ID(), 2);

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit, created_at, updated_at)
VALUES ('PLANK_MAX_SECONDS', 'Longest plank hold', 'Hold a straight-body forearm plank as long as you can.',
        'NUMBER', 1, '{"integerOnly": true, "min": 0, "max": 1800}', 'seconds', NOW(6) - INTERVAL 30 DAY, NOW(6) - INTERVAL 30 DAY);
INSERT INTO survey_step_questions (step_id, question_id, sort_order) VALUES (@step_level, LAST_INSERT_ID(), 3);

COMMIT;

-- -------------------------------------------------------------------------------------
-- Kiểm tra nhanh: 5 dòng, bước 5 là RESULT với 0 câu hỏi
-- -------------------------------------------------------------------------------------
-- cm_id NULL = email @cm_email chưa đăng ký -> đăng ký tài khoản rồi chạy lại 2 lệnh SET @cm_id / UPDATE ở mục 1
SELECT @cm_email AS cm_email, @cm_id AS cm_id,
       (SELECT role FROM users WHERE id = @cm_id) AS cm_role;

SELECT s.sort_order, s.step_code, s.step_type, s.status, COUNT(l.id) AS questions
FROM survey_steps s
LEFT JOIN survey_step_questions l ON l.step_id = s.id
WHERE s.survey_id = @survey_id
GROUP BY s.id
ORDER BY s.sort_order;


-- =====================================================================================
-- RESET (tùy chọn) - XÓA survey CALISHEALTH_ONBOARDING cùng MỌI phiên và câu trả lời của member,
-- và các câu hỏi/lựa chọn có mã ở trên. Chỉ dùng trên DB local/dev. Bỏ comment rồi chạy TRƯỚC phần seed.
-- =====================================================================================
-- START TRANSACTION;
-- DELETE a FROM assessment_answers a
--   JOIN survey_sessions ss ON ss.id = a.session_id
--   JOIN surveys sv ON sv.id = ss.survey_id
--   WHERE sv.survey_code = 'CALISHEALTH_ONBOARDING';
-- DELETE ss FROM survey_sessions ss JOIN surveys sv ON sv.id = ss.survey_id
--   WHERE sv.survey_code = 'CALISHEALTH_ONBOARDING';
-- DELETE l FROM survey_step_questions l
--   JOIN survey_steps st ON st.id = l.step_id
--   JOIN surveys sv ON sv.id = st.survey_id
--   WHERE sv.survey_code = 'CALISHEALTH_ONBOARDING';
-- DELETE st FROM survey_steps st JOIN surveys sv ON sv.id = st.survey_id
--   WHERE sv.survey_code = 'CALISHEALTH_ONBOARDING';
-- DELETE FROM surveys WHERE survey_code = 'CALISHEALTH_ONBOARDING';
-- DELETE o FROM assessment_options o JOIN assessment_questions q ON q.id = o.question_id
--   WHERE q.question_code IN ('GENDER','AGE','HEIGHT','WEIGHT','GOAL_TYPE','HEALTH_GOAL','TRAINING_SKILLS','MOTIVATIONS',
--                             'TRAINING_EXPERIENCE','TRAINING_DAYS_PER_WEEK','TRAINING_MINUTES_PER_SESSION',
--                             'PUSH_UP_MAX_REPS','SQUAT_MAX_REPS','PLANK_MAX_SECONDS');
-- DELETE a FROM assessment_answers a JOIN assessment_questions q ON q.id = a.question_id
--   WHERE q.question_code IN ('GENDER','AGE','HEIGHT','WEIGHT','GOAL_TYPE','HEALTH_GOAL','TRAINING_SKILLS','MOTIVATIONS',
--                             'TRAINING_EXPERIENCE','TRAINING_DAYS_PER_WEEK','TRAINING_MINUTES_PER_SESSION',
--                             'PUSH_UP_MAX_REPS','SQUAT_MAX_REPS','PLANK_MAX_SECONDS');
-- DELETE l FROM survey_step_questions l JOIN assessment_questions q ON q.id = l.question_id
--   WHERE q.question_code IN ('GENDER','AGE','HEIGHT','WEIGHT','GOAL_TYPE','HEALTH_GOAL','TRAINING_SKILLS','MOTIVATIONS',
--                             'TRAINING_EXPERIENCE','TRAINING_DAYS_PER_WEEK','TRAINING_MINUTES_PER_SESSION',
--                             'PUSH_UP_MAX_REPS','SQUAT_MAX_REPS','PLANK_MAX_SECONDS');
-- DELETE FROM assessment_questions
--   WHERE question_code IN ('GENDER','AGE','HEIGHT','WEIGHT','GOAL_TYPE','HEALTH_GOAL','TRAINING_SKILLS','MOTIVATIONS',
--                           'TRAINING_EXPERIENCE','TRAINING_DAYS_PER_WEEK','TRAINING_MINUTES_PER_SESSION',
--                           'PUSH_UP_MAX_REPS','SQUAT_MAX_REPS','PLANK_MAX_SECONDS');
-- COMMIT;
