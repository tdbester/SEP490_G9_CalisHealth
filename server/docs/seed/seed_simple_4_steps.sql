-- =====================================================================================
-- SEED ĐƠN GIẢN - Survey 4 bước theo màn hình Figma
-- =====================================================================================
-- Chạy THỦ CÔNG trên MySQL 8 (Workbench / CLI), KHÔNG phải migration Flyway.
--
-- Điều kiện trước khi chạy:
--   1. Đã chạy seed_survey_management.sql (survey CALISHEALTH_ONBOARDING v1 ACTIVE).
--   2. Đã chạy seed_onboarding_level_rules.sql (display_config, GOAL_DAYS_PER_WEEK, level rules).
--
-- File này đảm bảo survey chỉ có đúng 4 bước câu hỏi + 1 bước RESULT như trên Figma:
--   Step 1: Body information        ACTIVE
--   Step 2: Goals and motivation    ACTIVE
--   Step 3: Current training routine ACTIVE
--   Step 4: Level test              ACTIVE
--   Step 5: Result                  ACTIVE (RESULT type)
--
-- Xóa mọi bước không thuộc 4 step_code này (nếu có thêm từ seed_extra_test_steps.sql).
-- Chạy lại nhiều lần được, không gây lỗi.
-- =====================================================================================

USE calishealth;
SET NAMES utf8mb4;

START TRANSACTION;

SET @survey_id = (SELECT id FROM surveys WHERE survey_code = 'CALISHEALTH_ONBOARDING' AND status = 'ACTIVE');

-- Xóa các bước không phải 4 bước chính hoặc bước RESULT
DELETE FROM survey_step_questions WHERE step_id IN (
    SELECT id FROM survey_steps WHERE survey_id = @survey_id
    AND step_code NOT IN ('BODY_INFORMATION', 'GOALS_AND_MOTIVATION', 'CURRENT_TRAINING_ROUTINE', 'LEVEL_TEST')
    AND step_type != 'RESULT'
);

DELETE FROM survey_steps WHERE survey_id = @survey_id
    AND step_code NOT IN ('BODY_INFORMATION', 'GOALS_AND_MOTIVATION', 'CURRENT_TRAINING_ROUTINE', 'LEVEL_TEST')
    AND step_type != 'RESULT';

-- Sắp xếp lại sort_order cho 5 bước còn lại
UPDATE survey_steps SET sort_order = 1 WHERE survey_id = @survey_id AND step_code = 'BODY_INFORMATION';
UPDATE survey_steps SET sort_order = 2 WHERE survey_id = @survey_id AND step_code = 'GOALS_AND_MOTIVATION';
UPDATE survey_steps SET sort_order = 3 WHERE survey_id = @survey_id AND step_code = 'CURRENT_TRAINING_ROUTINE';
UPDATE survey_steps SET sort_order = 4 WHERE survey_id = @survey_id AND step_code = 'LEVEL_TEST';
UPDATE survey_steps SET sort_order = 5 WHERE survey_id = @survey_id AND step_type = 'RESULT';

-- Đảm bảo 4 bước chính đều ACTIVE
UPDATE survey_steps SET status = 'ACTIVE'
WHERE survey_id = @survey_id
  AND step_code IN ('BODY_INFORMATION', 'GOALS_AND_MOTIVATION', 'CURRENT_TRAINING_ROUTINE', 'LEVEL_TEST');

COMMIT;

-- Kiểm tra: phải có đúng 5 dòng
SELECT s.sort_order, s.step_code, s.step_name, s.step_type, s.status, COUNT(l.id) AS questions
FROM survey_steps s
LEFT JOIN survey_step_questions l ON l.step_id = s.id
WHERE s.survey_id = @survey_id
GROUP BY s.id
ORDER BY s.sort_order;
