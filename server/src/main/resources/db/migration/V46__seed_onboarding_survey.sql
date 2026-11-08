-- V46: Seed the onboarding survey exactly as it is configured in the reference database.
--
-- Why this migration exists
-- -------------------------
-- The survey definition used to live only in server/docs/survey-management/seed_survey_management.sql,
-- a script someone runs by hand. A machine that never ran it has an empty /api/surveys/active, so the
-- member sign-up flow has nothing to show. This migration moves that configuration into the schema
-- history so every environment starts with the same survey.
--
-- What is reproduced from the reference database
-- ----------------------------------------------
--   CALISHEALTH_ONBOARDING v1 (ACTIVE) - 5 steps, 16 question links, 18 questions, 30 options
--
--   1. Body information            GENDER, AGE, HEIGHT, WEIGHT
--   2. Goals and motivation        GOAL_TYPE, HEALTH_GOAL*, TRAINING_SKILLS*, MOTIVATIONS
--   3. Current training routine    TRAINING_EXPERIENCE, TRAINING_DAYS_PER_WEEK*,
--                                  HOW_MANY_DAYS_PER_WEEK_DO_YOU_WANT_TO_TRAIN_WITH_CALISHE,
--                                  TRAINING_MINUTES_PER_SESSION
--   4. Level test                  PUSH_UP_MAX_REPS, SQUAT_MAX_REPS, PLANK_MAX_SECONDS,
--                                  BURPEE_MAX_REPS (sort_order 5, the gap is kept on purpose)
--   5. Result and recommended plan RESULT step with result_config, no questions
--      (*) conditional questions, see section 7.
--
--   Question texts, descriptions, validation rules, units, display config, option labels, order and
--   conditional rules are byte-for-byte what the reference database holds. Timestamps, ids and the
--   `updated_by` audit column are deliberately not part of the seed.
--
-- Idempotent: every INSERT is guarded by NOT EXISTS and every UPDATE only fills an empty value, so a
-- database that already has this survey (from the manual script or from the Content Manager screens)
-- keeps its own rows and its own edits.

-- -------------------------------------------------------------------------------------
-- 1. Survey
-- -------------------------------------------------------------------------------------
INSERT INTO surveys (survey_code, survey_name, description, version, status)
SELECT 'CALISHEALTH_ONBOARDING', 'CalisHealth onboarding survey',
       'Questions members answer when they sign up, used to build their first training plan.',
       1, 'ACTIVE'
WHERE NOT EXISTS (
    SELECT 1 FROM surveys s WHERE s.survey_code = 'CALISHEALTH_ONBOARDING' AND s.version = 1
);

SET @survey_id := (SELECT id FROM surveys WHERE survey_code = 'CALISHEALTH_ONBOARDING' AND version = 1);

-- The result step points at a fallback level; the lowest active level takes that role.
SET @fallback_level := (
    SELECT id FROM fitness_levels WHERE status = 'ACTIVE' ORDER BY score_min, id LIMIT 1
);

-- -------------------------------------------------------------------------------------
-- 2. Steps
-- -------------------------------------------------------------------------------------
INSERT INTO survey_steps (survey_id, step_code, step_name, description, step_type, result_config,
                          sort_order, status, revision)
SELECT @survey_id, 'BODY_INFORMATION', 'Body information',
       'Collect height, weight and other basic body measurements.',
       'QUESTIONS', NULL, 1, 'ACTIVE', 0
WHERE NOT EXISTS (
    SELECT 1 FROM survey_steps s WHERE s.survey_id = @survey_id AND s.step_code = 'BODY_INFORMATION'
);

INSERT INTO survey_steps (survey_id, step_code, step_name, description, step_type, result_config,
                          sort_order, status, revision)
SELECT @survey_id, 'GOALS_AND_MOTIVATION', 'Goals and motivation',
       'Identify health or skill goals, target skills and motivation.',
       'QUESTIONS', NULL, 2, 'ACTIVE', 0
WHERE NOT EXISTS (
    SELECT 1 FROM survey_steps s WHERE s.survey_id = @survey_id AND s.step_code = 'GOALS_AND_MOTIVATION'
);

INSERT INTO survey_steps (survey_id, step_code, step_name, description, step_type, result_config,
                          sort_order, status, revision)
SELECT @survey_id, 'CURRENT_TRAINING_ROUTINE', 'Current training routine',
       'Evaluate training frequency, duration and current skills.',
       'QUESTIONS', NULL, 3, 'ACTIVE', 0
WHERE NOT EXISTS (
    SELECT 1 FROM survey_steps s WHERE s.survey_id = @survey_id AND s.step_code = 'CURRENT_TRAINING_ROUTINE'
);

INSERT INTO survey_steps (survey_id, step_code, step_name, description, step_type, result_config,
                          sort_order, status, revision)
SELECT @survey_id, 'LEVEL_TEST', 'Level test',
       'Assess current ability with max reps and isometric holds.',
       'QUESTIONS', NULL, 4, 'ACTIVE', 0
WHERE NOT EXISTS (
    SELECT 1 FROM survey_steps s WHERE s.survey_id = @survey_id AND s.step_code = 'LEVEL_TEST'
);

INSERT INTO survey_steps (survey_id, step_code, step_name, description, step_type, result_config,
                          sort_order, status, revision)
SELECT @survey_id, 'RESULT_AND_RECOMMENDED_PLAN', 'Result and recommended plan',
       'Classify the member''s level and build the recommended plan.',
       'RESULT',
       JSON_OBJECT('sessionsPerWeek', 3, 'showPlanPreview', TRUE, 'minutesPerSession', 30,
                   'planDurationWeeks', 4, 'showLevelBreakdown', TRUE,
                   'fallbackFitnessLevelId', @fallback_level),
       5, 'ACTIVE', 0
WHERE NOT EXISTS (
    SELECT 1 FROM survey_steps s
    WHERE s.survey_id = @survey_id AND s.step_code = 'RESULT_AND_RECOMMENDED_PLAN'
);

SET @step_body    := (SELECT id FROM survey_steps WHERE survey_id = @survey_id AND step_code = 'BODY_INFORMATION');
SET @step_goals   := (SELECT id FROM survey_steps WHERE survey_id = @survey_id AND step_code = 'GOALS_AND_MOTIVATION');
SET @step_routine := (SELECT id FROM survey_steps WHERE survey_id = @survey_id AND step_code = 'CURRENT_TRAINING_ROUTINE');
SET @step_level   := (SELECT id FROM survey_steps WHERE survey_id = @survey_id AND step_code = 'LEVEL_TEST');

-- -------------------------------------------------------------------------------------
-- 3. Question bank
--    question_code is unique, so an existing question keeps whatever the Content Manager wrote.
--    JSON literals are written the way the reference database stores them; MySQL normalises key
--    order inside a JSON column, so JSON_OBJECT and a text literal end up identical.
-- -------------------------------------------------------------------------------------
INSERT INTO assessment_questions (question_code, question_text, description, question_type, required,
                                  validation_rules, unit, display_config, status)
SELECT 'GENDER', 'What is your gender?', NULL, 'SINGLE_SELECT', 1, NULL, NULL, NULL, 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM assessment_questions q WHERE q.question_code = 'GENDER');

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required,
                                  validation_rules, unit, display_config, status)
SELECT 'AGE', 'How old are you?', NULL, 'NUMBER', 1,
       '{"max": 100, "min": 13, "integerOnly": true}', 'years', NULL, 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM assessment_questions q WHERE q.question_code = 'AGE');

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required,
                                  validation_rules, unit, display_config, status)
SELECT 'HEIGHT', 'What is your height?', NULL, 'NUMBER', 1,
       '{"max": 250, "min": 100, "maxDecimals": 1}', 'cm', NULL, 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM assessment_questions q WHERE q.question_code = 'HEIGHT');

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required,
                                  validation_rules, unit, display_config, status)
SELECT 'WEIGHT', 'What is your weight?', NULL, 'NUMBER', 1,
       '{"max": 300, "min": 30, "maxDecimals": 1}', 'kg', NULL, 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM assessment_questions q WHERE q.question_code = 'WEIGHT');

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required,
                                  validation_rules, unit, display_config, status)
SELECT 'GOAL_TYPE', 'What is your main goal?', NULL, 'SINGLE_SELECT', 1, NULL, NULL, NULL, 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM assessment_questions q WHERE q.question_code = 'GOAL_TYPE');

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required,
                                  validation_rules, unit, display_config, status)
SELECT 'HEALTH_GOAL', 'Which health goal fits you best?', NULL, 'SINGLE_SELECT', 1, NULL, NULL, NULL, 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM assessment_questions q WHERE q.question_code = 'HEALTH_GOAL');

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required,
                                  validation_rules, unit, display_config, status)
SELECT 'TRAINING_SKILLS', 'Which skills do you want to learn?', 'Pick up to 3 skills.', 'MULTIPLE_SELECT', 1,
       '{"maxSelections": 3, "minSelections": 1}', NULL, NULL, 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM assessment_questions q WHERE q.question_code = 'TRAINING_SKILLS');

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required,
                                  validation_rules, unit, display_config, status)
SELECT 'MOTIVATIONS', 'What motivates you to train?', 'Pick up to 3 answers.', 'MULTIPLE_SELECT', 1,
       '{"maxSelections": 3, "minSelections": 1}', NULL, NULL, 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM assessment_questions q WHERE q.question_code = 'MOTIVATIONS');

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required,
                                  validation_rules, unit, display_config, status)
SELECT 'TRAINING_EXPERIENCE', 'How long have you been training?', NULL, 'SINGLE_SELECT', 1, NULL, NULL, NULL, 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM assessment_questions q WHERE q.question_code = 'TRAINING_EXPERIENCE');

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required,
                                  validation_rules, unit, display_config, status)
SELECT 'TRAINING_DAYS_PER_WEEK', 'How many days per week have you trained?', NULL, 'NUMBER', 1,
       '{"max": 7, "min": 0, "integerOnly": true}', 'days', NULL, 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM assessment_questions q WHERE q.question_code = 'TRAINING_DAYS_PER_WEEK');

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required,
                                  validation_rules, unit, display_config, status)
SELECT 'HOW_MANY_DAYS_PER_WEEK_DO_YOU_WANT_TO_TRAIN_WITH_CALISHE',
       'How many days per week do you want to train with Calishealth', NULL, 'NUMBER', 1,
       '{"max": 7, "min": 1, "integerOnly": true}', 'days', NULL, 'ACTIVE'
WHERE NOT EXISTS (
    SELECT 1 FROM assessment_questions q
    WHERE q.question_code = 'HOW_MANY_DAYS_PER_WEEK_DO_YOU_WANT_TO_TRAIN_WITH_CALISHE'
);

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required,
                                  validation_rules, unit, display_config, status)
SELECT 'TRAINING_MINUTES_PER_SESSION', 'How long is each training session?', NULL, 'SINGLE_SELECT', 1,
       NULL, NULL, NULL, 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM assessment_questions q WHERE q.question_code = 'TRAINING_MINUTES_PER_SESSION');

-- Level test slots. BenchmarkSurveySync also maintains these at startup (it adds the slots the
-- Level Benchmark Criteria table lists and hides the ones it dropped); seeding them here means a fresh
-- database already has a working Level test step before the first boot.
INSERT INTO assessment_questions (question_code, question_text, description, question_type, required,
                                  validation_rules, unit, display_config, status)
SELECT 'PUSH_UP_MAX_REPS', 'Max push-ups in one set',
       'Do as many clean push-ups as you can without stopping.', 'NUMBER', 1,
       '{"max": 200, "min": 0, "integerOnly": true}', 'reps',
       '{"hint": "Max reps in a row", "icon": "arrowUp", "label": "Push-up", "placeholder": "0"}', 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM assessment_questions q WHERE q.question_code = 'PUSH_UP_MAX_REPS');

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required,
                                  validation_rules, unit, display_config, status)
SELECT 'SQUAT_MAX_REPS', 'Max bodyweight squats in one set',
       'Full depth, without resting.', 'NUMBER', 1,
       '{"max": 500, "min": 0, "integerOnly": true}', 'reps',
       '{"hint": "Max reps in a row", "icon": "arrowUp", "label": "Bodyweight Squat", "placeholder": "0"}', 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM assessment_questions q WHERE q.question_code = 'SQUAT_MAX_REPS');

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required,
                                  validation_rules, unit, display_config, status)
SELECT 'PLANK_MAX_SECONDS', 'Longest plank hold',
       'Hold a straight-body forearm plank as long as you can.', 'NUMBER', 1,
       '{"max": 1800, "min": 0, "integerOnly": true}', 'seconds',
       '{"hint": "Max hold time", "icon": "clock", "label": "Plank", "placeholder": "0"}', 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM assessment_questions q WHERE q.question_code = 'PLANK_MAX_SECONDS');

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required,
                                  validation_rules, unit, display_config, status)
SELECT 'BURPEE_MAX_REPS', 'Max Burpee reps in one set',
       'Do as many clean reps as you can without stopping.', 'NUMBER', 1,
       '{"max": 500, "min": 0, "integerOnly": true}', 'reps',
       '{"hint": "Max reps in a row", "icon": "arrowUp", "label": "Burpee", "placeholder": "0"}', 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM assessment_questions q WHERE q.question_code = 'BURPEE_MAX_REPS');

-- Dips and pull-ups are in the reference question bank but not linked to a step right now. They are
-- seeded so that re-adding them in Level Benchmark Criteria reuses the same wording instead of
-- creating near-duplicates.
INSERT INTO assessment_questions (question_code, question_text, description, question_type, required,
                                  validation_rules, unit, display_config, status)
SELECT 'DIPS_MAX_REPS', 'Max Dips reps in one set',
       'Do as many clean reps as you can without stopping.', 'NUMBER', 1,
       '{"max": 500, "min": 0, "integerOnly": true}', 'reps',
       '{"hint": "Max reps in a row", "icon": "arrowUp", "label": "Dips", "placeholder": "0"}', 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM assessment_questions q WHERE q.question_code = 'DIPS_MAX_REPS');

INSERT INTO assessment_questions (question_code, question_text, description, question_type, required,
                                  validation_rules, unit, display_config, status)
SELECT 'PULL_UP_MAX_REPS', 'Max Pull-up reps in one set',
       'Do as many clean reps as you can without stopping.', 'NUMBER', 1,
       '{"max": 500, "min": 0, "integerOnly": true}', 'reps',
       '{"hint": "Max reps in a row", "icon": "arrowUp", "label": "Pull-up", "placeholder": "0"}', 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM assessment_questions q WHERE q.question_code = 'PULL_UP_MAX_REPS');

-- -------------------------------------------------------------------------------------
-- 4. Options
--    uk_assessment_options_code is (question_id, option_code): re-running never duplicates a row and
--    never rewrites a label the Content Manager has changed.
-- -------------------------------------------------------------------------------------
INSERT INTO assessment_options (question_id, option_code, option_label, option_value, sort_order, status)
SELECT q.id, seed.option_code, seed.option_label, seed.option_value, seed.sort_order, 'ACTIVE'
FROM assessment_questions q
JOIN (
    SELECT 'MALE'   AS option_code, 'Male'                AS option_label, CAST(NULL AS CHAR(255)) AS option_value, 1 AS sort_order
    UNION ALL SELECT 'FEMALE', 'Female',                    NULL, 2
    UNION ALL SELECT 'OTHER',  'Other / prefer not to say', NULL, 3
) seed
WHERE q.question_code = 'GENDER'
  AND NOT EXISTS (SELECT 1 FROM assessment_options o
                  WHERE o.question_id = q.id AND o.option_code = seed.option_code);

INSERT INTO assessment_options (question_id, option_code, option_label, option_value, sort_order, status)
SELECT q.id, seed.option_code, seed.option_label, seed.option_value, seed.sort_order, 'ACTIVE'
FROM assessment_questions q
JOIN (
    SELECT 'HEALTH' AS option_code, 'Improve my health and fitness' AS option_label, CAST(NULL AS CHAR(255)) AS option_value, 1 AS sort_order
    UNION ALL SELECT 'SKILLS', 'Learn calisthenics skills', NULL, 2
) seed
WHERE q.question_code = 'GOAL_TYPE'
  AND NOT EXISTS (SELECT 1 FROM assessment_options o
                  WHERE o.question_id = q.id AND o.option_code = seed.option_code);

INSERT INTO assessment_options (question_id, option_code, option_label, option_value, sort_order, status)
SELECT q.id, seed.option_code, seed.option_label, seed.option_value, seed.sort_order, 'ACTIVE'
FROM assessment_questions q
JOIN (
    SELECT 'LOSE_WEIGHT'  AS option_code, 'Lose weight'  AS option_label, CAST(NULL AS CHAR(255)) AS option_value, 1 AS sort_order
    UNION ALL SELECT 'BUILD_MUSCLE', 'Build muscle', NULL, 2
    UNION ALL SELECT 'STAY_FIT',     'Stay fit',     NULL, 3
) seed
WHERE q.question_code = 'HEALTH_GOAL'
  AND NOT EXISTS (SELECT 1 FROM assessment_options o
                  WHERE o.question_id = q.id AND o.option_code = seed.option_code);

INSERT INTO assessment_options (question_id, option_code, option_label, option_value, sort_order, status)
SELECT q.id, seed.option_code, seed.option_label, seed.option_value, seed.sort_order, 'ACTIVE'
FROM assessment_questions q
JOIN (
    SELECT 'MUSCLE_UP'   AS option_code, 'Muscle-up'   AS option_label, CAST(NULL AS CHAR(255)) AS option_value, 1 AS sort_order
    UNION ALL SELECT 'HANDSTAND',   'Handstand',   NULL, 2
    UNION ALL SELECT 'PLANCHE',     'Planche',     NULL, 3
    UNION ALL SELECT 'FRONT_LEVER', 'Front lever', NULL, 4
    UNION ALL SELECT 'HUMAN_FLAG',  'Human flag',  NULL, 5
) seed
WHERE q.question_code = 'TRAINING_SKILLS'
  AND NOT EXISTS (SELECT 1 FROM assessment_options o
                  WHERE o.question_id = q.id AND o.option_code = seed.option_code);

INSERT INTO assessment_options (question_id, option_code, option_label, option_value, sort_order, status)
SELECT q.id, seed.option_code, seed.option_label, seed.option_value, seed.sort_order, 'ACTIVE'
FROM assessment_questions q
JOIN (
    SELECT 'HEALTH'        AS option_code, 'Better health'   AS option_label, CAST(NULL AS CHAR(255)) AS option_value, 1 AS sort_order
    UNION ALL SELECT 'ENERGY',        'More energy',     NULL, 2
    UNION ALL SELECT 'CONFIDENCE',    'More confidence', NULL, 3
    UNION ALL SELECT 'APPEARANCE',    'Look better',     NULL, 4
    UNION ALL SELECT 'STRESS_RELIEF', 'Stress relief',   NULL, 5
) seed
WHERE q.question_code = 'MOTIVATIONS'
  AND NOT EXISTS (SELECT 1 FROM assessment_options o
                  WHERE o.question_id = q.id AND o.option_code = seed.option_code);

-- NONE is the option the CURRENT_TRAINING_ROUTINE step keys off to hide
-- "How many days per week have you trained?", so its label must stay recognisable.
INSERT INTO assessment_options (question_id, option_code, option_label, option_value, sort_order, status)
SELECT q.id, seed.option_code, seed.option_label, seed.option_value, seed.sort_order, 'ACTIVE'
FROM assessment_questions q
JOIN (
    SELECT 'NONE'             AS option_code, 'I have not trained before' AS option_label, CAST(NULL AS CHAR(255)) AS option_value, 1 AS sort_order
    UNION ALL SELECT 'UNDER_6_MONTHS', 'Less than 6 months', NULL, 2
    UNION ALL SELECT 'MONTHS_6_TO_12', '6 to 12 months',     NULL, 3
    UNION ALL SELECT 'OVER_1_YEAR',    'More than 1 year',   NULL, 4
) seed
WHERE q.question_code = 'TRAINING_EXPERIENCE'
  AND NOT EXISTS (SELECT 1 FROM assessment_options o
                  WHERE o.question_id = q.id AND o.option_code = seed.option_code);

INSERT INTO assessment_options (question_id, option_code, option_label, option_value, sort_order, status)
SELECT q.id, seed.option_code, seed.option_label, seed.option_value, seed.sort_order, 'ACTIVE'
FROM assessment_questions q
JOIN (
    SELECT 'MIN_15'      AS option_code, 'About 15 minutes'   AS option_label, '15' AS option_value, 1 AS sort_order
    UNION ALL SELECT 'MIN_30',      'About 30 minutes',   '30', 2
    UNION ALL SELECT 'MIN_45',      'About 45 minutes',   '45', 3
    UNION ALL SELECT 'MIN_60_PLUS', '60 minutes or more', '60', 4
) seed
WHERE q.question_code = 'TRAINING_MINUTES_PER_SESSION'
  AND NOT EXISTS (SELECT 1 FROM assessment_options o
                  WHERE o.question_id = q.id AND o.option_code = seed.option_code);

-- -------------------------------------------------------------------------------------
-- 5. Step -> question links
--    uk_survey_step_questions is (step_id, question_id). `required` and `conditional_rules` are left
--    untouched (the reference database holds NULL for both) so a step the Content Manager has edited
--    keeps its settings.
-- -------------------------------------------------------------------------------------
INSERT INTO survey_step_questions (step_id, question_id, sort_order, is_active)
SELECT step_link.step_id, q.id, step_link.sort_order, 1
FROM assessment_questions q
JOIN (
    SELECT @step_body    AS step_id, 'GENDER'                    AS question_code, 1 AS sort_order
    UNION ALL SELECT @step_body,    'AGE',                        2
    UNION ALL SELECT @step_body,    'HEIGHT',                     3
    UNION ALL SELECT @step_body,    'WEIGHT',                     4
    UNION ALL SELECT @step_goals,   'GOAL_TYPE',                  1
    UNION ALL SELECT @step_goals,   'HEALTH_GOAL',                2
    UNION ALL SELECT @step_goals,   'TRAINING_SKILLS',            3
    UNION ALL SELECT @step_goals,   'MOTIVATIONS',                4
    UNION ALL SELECT @step_routine, 'TRAINING_EXPERIENCE',        1
    UNION ALL SELECT @step_routine, 'TRAINING_DAYS_PER_WEEK',     2
    UNION ALL SELECT @step_routine, 'HOW_MANY_DAYS_PER_WEEK_DO_YOU_WANT_TO_TRAIN_WITH_CALISHE', 3
    UNION ALL SELECT @step_routine, 'TRAINING_MINUTES_PER_SESSION', 4
    UNION ALL SELECT @step_level,   'PUSH_UP_MAX_REPS',           1
    UNION ALL SELECT @step_level,   'SQUAT_MAX_REPS',             2
    UNION ALL SELECT @step_level,   'PLANK_MAX_SECONDS',          3
    UNION ALL SELECT @step_level,   'BURPEE_MAX_REPS',            5
) step_link ON step_link.question_code = q.question_code
WHERE step_link.step_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM survey_step_questions l
      WHERE l.step_id = step_link.step_id AND l.question_id = q.id
  );

-- -------------------------------------------------------------------------------------
-- 6. Conditional questions
--    Only filled where the rule is still empty, so a rule the Content Manager wrote is kept as-is.
-- -------------------------------------------------------------------------------------
UPDATE survey_step_questions l
JOIN assessment_questions q ON q.id = l.question_id
SET l.conditional_rules = JSON_OBJECT('operator', 'EQ', 'questionCode', 'GOAL_TYPE', 'value', 'HEALTH')
WHERE l.step_id = @step_goals
  AND q.question_code = 'HEALTH_GOAL'
  AND (l.conditional_rules IS NULL OR JSON_LENGTH(l.conditional_rules) = 0);

UPDATE survey_step_questions l
JOIN assessment_questions q ON q.id = l.question_id
SET l.conditional_rules = JSON_OBJECT('operator', 'EQ', 'questionCode', 'GOAL_TYPE', 'value', 'SKILLS')
WHERE l.step_id = @step_goals
  AND q.question_code = 'TRAINING_SKILLS'
  AND (l.conditional_rules IS NULL OR JSON_LENGTH(l.conditional_rules) = 0);

-- Members who have never trained skip the question about how many days they used to train.
UPDATE survey_step_questions l
JOIN assessment_questions q ON q.id = l.question_id
SET l.conditional_rules = JSON_OBJECT('operator', 'NE', 'questionCode', 'TRAINING_EXPERIENCE', 'value', 'NONE')
WHERE l.step_id = @step_routine
  AND q.question_code = 'TRAINING_DAYS_PER_WEEK'
  AND (l.conditional_rules IS NULL OR JSON_LENGTH(l.conditional_rules) = 0);
