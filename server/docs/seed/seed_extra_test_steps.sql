-- =====================================================================================
-- SEED BỔ SUNG - thêm vài bước (step) để test màn "Survey management"
-- =====================================================================================
-- Chạy THỦ CÔNG trên MySQL 8, KHÔNG phải migration Flyway.
-- Chạy SAU seed_survey_management.sql (cần survey CALISHEALTH_ONBOARDING đang ACTIVE).
--
-- Thêm 5 bước, chèn TRƯỚC bước RESULT:
--   5. Health and injuries     ACTIVE    3 câu, có câu hiển thị theo điều kiện (INJURY_STATUS)
--   6. Equipment and space     ACTIVE    3 câu, có MULTIPLE_SELECT và BOOLEAN
--   7. Lifestyle and recovery  DRAFT     3 câu, member chưa thấy -> test nút Activate
--   8. Nutrition habits        INACTIVE  3 câu, test Activate / Deactivate lại
--   9. Coach notes             DRAFT     0 câu -> test lỗi khi kích hoạt bước không có câu hỏi
-- Bước RESULT được dời xuống cuối (sort_order 10).
--
-- Lưu ý:
--   - Bước 5 và 6 là ACTIVE nên member đăng ký mới sẽ thấy và phải trả lời các câu Required.
--   - Mã câu hỏi mới (INJURY_STATUS, EQUIPMENT, ...) không trùng seed gốc và không nằm trong
--     level criteria, nên không ảnh hưởng việc chấm level.
--   - Chạy lần 2 sẽ lỗi trùng step_code. Nếu script báo lỗi giữa chừng: chạy ROLLBACK;
--     rồi muốn chạy lại thì chạy khối "RESET" ở cuối file.
-- =====================================================================================

-- Đổi tên DB nếu spring.datasource.url của bạn trỏ tới DB khác
USE calishealth;
SET NAMES utf8mb4;

START TRANSACTION;

-- survey_id NULL (chưa seed survey gốc) -> INSERT bên dưới báo lỗi NOT NULL, hãy ROLLBACK;
SET @survey_id = (SELECT id FROM surveys WHERE survey_code = 'CALISHEALTH_ONBOARDING' AND status = 'ACTIVE');

-- Dời bước RESULT xuống cuối để chừa chỗ cho 5 bước mới (cập nhật theo khóa chính)
SET @result_step_id = (SELECT id FROM survey_steps WHERE survey_id = @survey_id AND step_type = 'RESULT');
UPDATE survey_steps SET sort_order = 10 WHERE id = @result_step_id;

-- -------------------------------------------------------------------------------------
-- Step 5: Health and injuries (ACTIVE)
-- -------------------------------------------------------------------------------------
INSERT INTO survey_steps (survey_id, step_code, step_name, description, step_type, result_config, sort_order, status)
VALUES (@survey_id, 'HEALTH_AND_INJURIES', 'Health and injuries',
        'Check current injuries so the plan avoids risky movements.', 'QUESTIONS', NULL, 5, 'ACTIVE');
SET @step_health = LAST_INSERT_ID();

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit)
VALUES ('INJURY_STATUS', 'Do you have any injury right now?', NULL, 'SINGLE_SELECT', 1, NULL, NULL);
SET @q = LAST_INSERT_ID();
INSERT INTO assessment_options (question_id, option_code, option_label, option_value, sort_order) VALUES
    (@q, 'NONE', 'No injury', NULL, 1),
    (@q, 'MINOR', 'Minor discomfort', NULL, 2),
    (@q, 'RECOVERING', 'Recovering from an injury', NULL, 3);
INSERT INTO survey_step_questions (step_id, question_id, sort_order) VALUES (@step_health, @q, 1);

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit)
VALUES ('INJURY_AREAS', 'Which areas are affected?', 'Pick up to 3 areas.', 'MULTIPLE_SELECT', 1,
        '{"minSelections": 1, "maxSelections": 3}', NULL);
SET @q = LAST_INSERT_ID();
INSERT INTO assessment_options (question_id, option_code, option_label, option_value, sort_order) VALUES
    (@q, 'SHOULDER', 'Shoulder', NULL, 1),
    (@q, 'ELBOW_WRIST', 'Elbow or wrist', NULL, 2),
    (@q, 'LOWER_BACK', 'Lower back', NULL, 3),
    (@q, 'KNEE', 'Knee', NULL, 4),
    (@q, 'ANKLE', 'Ankle', NULL, 5);
-- Chỉ hiện khi INJURY_STATUS là MINOR hoặc RECOVERING
INSERT INTO survey_step_questions (step_id, question_id, sort_order, conditional_rules)
VALUES (@step_health, @q, 2,
        '{"operator": "IN", "questionCode": "INJURY_STATUS", "value": ["MINOR", "RECOVERING"]}');

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit)
VALUES ('INJURY_NOTES', 'Anything else we should know?', 'Optional, up to 255 characters.', 'TEXT', 0,
        '{"maxLength": 255}', NULL);
INSERT INTO survey_step_questions (step_id, question_id, sort_order) VALUES (@step_health, LAST_INSERT_ID(), 3);

-- -------------------------------------------------------------------------------------
-- Step 6: Equipment and space (ACTIVE)
-- -------------------------------------------------------------------------------------
INSERT INTO survey_steps (survey_id, step_code, step_name, description, step_type, result_config, sort_order, status)
VALUES (@survey_id, 'EQUIPMENT_AND_SPACE', 'Equipment and space',
        'Know what equipment and room the member has for training.', 'QUESTIONS', NULL, 6, 'ACTIVE');
SET @step_equipment = LAST_INSERT_ID();

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit)
VALUES ('TRAINING_LOCATION', 'Where do you usually train?', NULL, 'SINGLE_SELECT', 1, NULL, NULL);
SET @q = LAST_INSERT_ID();
INSERT INTO assessment_options (question_id, option_code, option_label, option_value, sort_order) VALUES
    (@q, 'HOME', 'At home', NULL, 1),
    (@q, 'PARK', 'Outdoor park / calisthenics park', NULL, 2),
    (@q, 'GYM', 'Gym', NULL, 3);
INSERT INTO survey_step_questions (step_id, question_id, sort_order) VALUES (@step_equipment, @q, 1);

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit)
VALUES ('EQUIPMENT', 'Which equipment do you have access to?', 'Pick everything that applies.', 'MULTIPLE_SELECT', 1,
        '{"minSelections": 1, "maxSelections": 5}', NULL);
SET @q = LAST_INSERT_ID();
INSERT INTO assessment_options (question_id, option_code, option_label, option_value, sort_order) VALUES
    (@q, 'NO_EQUIPMENT', 'No equipment', NULL, 1),
    (@q, 'PULL_UP_BAR', 'Pull-up bar', NULL, 2),
    (@q, 'PARALLETTES', 'Parallettes or dip bars', NULL, 3),
    (@q, 'RINGS', 'Gymnastic rings', NULL, 4),
    (@q, 'RESISTANCE_BANDS', 'Resistance bands', NULL, 5);
INSERT INTO survey_step_questions (step_id, question_id, sort_order) VALUES (@step_equipment, @q, 2);

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit)
VALUES ('HAS_TRAINING_PARTNER', 'Do you train with a partner?', NULL, 'BOOLEAN', 0, NULL, NULL);
INSERT INTO survey_step_questions (step_id, question_id, sort_order) VALUES (@step_equipment, LAST_INSERT_ID(), 3);

-- -------------------------------------------------------------------------------------
-- Step 7: Lifestyle and recovery (DRAFT - member chưa thấy)
-- -------------------------------------------------------------------------------------
INSERT INTO survey_steps (survey_id, step_code, step_name, description, step_type, result_config, sort_order, status)
VALUES (@survey_id, 'LIFESTYLE_AND_RECOVERY', 'Lifestyle and recovery',
        'Sleep, stress and daily activity that affect recovery.', 'QUESTIONS', NULL, 7, 'DRAFT');
SET @step_lifestyle = LAST_INSERT_ID();

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit)
VALUES ('SLEEP_HOURS', 'How many hours do you sleep per night?', NULL, 'NUMBER', 1,
        '{"min": 0, "max": 14, "maxDecimals": 1}', 'hours');
INSERT INTO survey_step_questions (step_id, question_id, sort_order) VALUES (@step_lifestyle, LAST_INSERT_ID(), 1);

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit)
VALUES ('STRESS_LEVEL', 'How stressed do you feel on a normal day?', NULL, 'SINGLE_SELECT', 1, NULL, NULL);
SET @q = LAST_INSERT_ID();
INSERT INTO assessment_options (question_id, option_code, option_label, option_value, sort_order) VALUES
    (@q, 'LOW', 'Low', NULL, 1),
    (@q, 'MEDIUM', 'Medium', NULL, 2),
    (@q, 'HIGH', 'High', NULL, 3);
INSERT INTO survey_step_questions (step_id, question_id, sort_order) VALUES (@step_lifestyle, @q, 2);

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit)
VALUES ('DAILY_ACTIVITY', 'How active is your daily routine?', NULL, 'SINGLE_SELECT', 1, NULL, NULL);
SET @q = LAST_INSERT_ID();
INSERT INTO assessment_options (question_id, option_code, option_label, option_value, sort_order) VALUES
    (@q, 'SEDENTARY', 'Mostly sitting', NULL, 1),
    (@q, 'LIGHT', 'Light movement', NULL, 2),
    (@q, 'ACTIVE', 'On my feet most of the day', NULL, 3);
INSERT INTO survey_step_questions (step_id, question_id, sort_order) VALUES (@step_lifestyle, @q, 3);

-- -------------------------------------------------------------------------------------
-- Step 8: Nutrition habits (INACTIVE - đã từng dùng, đang tắt)
-- -------------------------------------------------------------------------------------
INSERT INTO survey_steps (survey_id, step_code, step_name, description, step_type, result_config, sort_order, status)
VALUES (@survey_id, 'NUTRITION_HABITS', 'Nutrition habits',
        'Eating pattern and water intake. Switched off for now.', 'QUESTIONS', NULL, 8, 'INACTIVE');
SET @step_nutrition = LAST_INSERT_ID();

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit)
VALUES ('MEALS_PER_DAY', 'How many meals do you eat per day?', NULL, 'NUMBER', 1,
        '{"integerOnly": true, "min": 1, "max": 8}', 'meals');
INSERT INTO survey_step_questions (step_id, question_id, sort_order) VALUES (@step_nutrition, LAST_INSERT_ID(), 1);

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit)
VALUES ('DIET_TYPE', 'Which describes your diet best?', NULL, 'SINGLE_SELECT', 1, NULL, NULL);
SET @q = LAST_INSERT_ID();
INSERT INTO assessment_options (question_id, option_code, option_label, option_value, sort_order) VALUES
    (@q, 'OMNIVORE', 'I eat everything', NULL, 1),
    (@q, 'VEGETARIAN', 'Vegetarian', NULL, 2),
    (@q, 'VEGAN', 'Vegan', NULL, 3),
    (@q, 'OTHER', 'Other', NULL, 4);
INSERT INTO survey_step_questions (step_id, question_id, sort_order) VALUES (@step_nutrition, @q, 2);

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required, validation_rules, unit)
VALUES ('WATER_LITERS', 'How much water do you drink per day?', NULL, 'NUMBER', 0,
        '{"min": 0, "max": 10, "maxDecimals": 1}', 'liters');
INSERT INTO survey_step_questions (step_id, question_id, sort_order) VALUES (@step_nutrition, LAST_INSERT_ID(), 3);

-- -------------------------------------------------------------------------------------
-- Step 9: Coach notes (DRAFT, KHÔNG có câu hỏi) - test lỗi khi Activate bước rỗng
-- -------------------------------------------------------------------------------------
INSERT INTO survey_steps (survey_id, step_code, step_name, description, step_type, result_config, sort_order, status)
VALUES (@survey_id, 'COACH_NOTES', 'Coach notes',
        'Empty draft step: add questions in Update step before activating.', 'QUESTIONS', NULL, 9, 'DRAFT');

COMMIT;

-- -------------------------------------------------------------------------------------
-- Kiểm tra nhanh: 10 dòng, RESULT ở cuối (sort_order 10); COACH_NOTES có 0 câu
-- -------------------------------------------------------------------------------------
SELECT s.sort_order, s.step_code, s.step_type, s.status, COUNT(l.id) AS questions
FROM survey_steps s
LEFT JOIN survey_step_questions l ON l.step_id = s.id
WHERE s.survey_id = @survey_id
GROUP BY s.id
ORDER BY s.sort_order;


-- =====================================================================================
-- RESET (tùy chọn) - gỡ đúng 5 bước và các câu hỏi vừa thêm, đưa RESULT về sort_order 5.
-- Chỉ dùng trên DB local/dev. Sẽ XÓA câu trả lời của member cho các câu hỏi này.
-- Bỏ comment rồi chạy.
-- =====================================================================================
-- START TRANSACTION;
-- SET @survey_id = (SELECT id FROM surveys WHERE survey_code = 'CALISHEALTH_ONBOARDING' AND status = 'ACTIVE');
-- DELETE a FROM assessment_answers a JOIN assessment_questions q ON q.id = a.question_id
--   WHERE q.question_code IN ('INJURY_STATUS','INJURY_AREAS','INJURY_NOTES','TRAINING_LOCATION','EQUIPMENT',
--                             'HAS_TRAINING_PARTNER','SLEEP_HOURS','STRESS_LEVEL','DAILY_ACTIVITY',
--                             'MEALS_PER_DAY','DIET_TYPE','WATER_LITERS');
-- DELETE l FROM survey_step_questions l JOIN survey_steps st ON st.id = l.step_id
--   WHERE st.survey_id = @survey_id
--     AND st.step_code IN ('HEALTH_AND_INJURIES','EQUIPMENT_AND_SPACE','LIFESTYLE_AND_RECOVERY','NUTRITION_HABITS','COACH_NOTES');
-- DELETE st FROM survey_steps st
--   WHERE st.survey_id = @survey_id
--     AND st.step_code IN ('HEALTH_AND_INJURIES','EQUIPMENT_AND_SPACE','LIFESTYLE_AND_RECOVERY','NUTRITION_HABITS','COACH_NOTES');
-- DELETE o FROM assessment_options o JOIN assessment_questions q ON q.id = o.question_id
--   WHERE q.question_code IN ('INJURY_STATUS','INJURY_AREAS','INJURY_NOTES','TRAINING_LOCATION','EQUIPMENT',
--                             'HAS_TRAINING_PARTNER','SLEEP_HOURS','STRESS_LEVEL','DAILY_ACTIVITY',
--                             'MEALS_PER_DAY','DIET_TYPE','WATER_LITERS');
-- DELETE FROM assessment_questions
--   WHERE question_code IN ('INJURY_STATUS','INJURY_AREAS','INJURY_NOTES','TRAINING_LOCATION','EQUIPMENT',
--                           'HAS_TRAINING_PARTNER','SLEEP_HOURS','STRESS_LEVEL','DAILY_ACTIVITY',
--                           'MEALS_PER_DAY','DIET_TYPE','WATER_LITERS');
-- UPDATE survey_steps SET sort_order = 5 WHERE survey_id = @survey_id AND step_type = 'RESULT';
-- COMMIT;
