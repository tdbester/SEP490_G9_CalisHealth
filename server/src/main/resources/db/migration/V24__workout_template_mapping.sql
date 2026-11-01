-- V24: Workout Template scheduling metadata (Level + Month + Days/Week + Day Sequence) for the Content Manager.
ALTER TABLE workout_entries
    ADD COLUMN month_number INT NOT NULL DEFAULT 1,
    ADD COLUMN days_per_week INT NOT NULL DEFAULT 3,
    ADD COLUMN day_sequence INT NOT NULL DEFAULT 1,
    ADD COLUMN template_status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED';

-- Existing workouts were already available to members, so preserve that behavior.
UPDATE workout_entries
SET template_status = 'PUBLISHED'
WHERE template_status = 'DRAFT';

-- Keep exercise levels aligned with the Level & Benchmark Criteria configuration.
-- Legacy seeds may contain labels that do not exist in fitness_levels.
-- Resolve unknown values to the highest active benchmark level rather than persisting
-- a separate difficulty label outside the configured benchmark levels.
UPDATE exercises e
LEFT JOIN fitness_levels current_level
       ON LOWER(TRIM(current_level.name)) = LOWER(TRIM(e.difficulty_level))
SET e.difficulty_level = (
    SELECT benchmark_level.name
    FROM fitness_levels benchmark_level
    WHERE UPPER(COALESCE(benchmark_level.status, 'ACTIVE')) = 'ACTIVE'
    ORDER BY benchmark_level.score_max DESC, benchmark_level.score_min DESC, benchmark_level.id DESC
    LIMIT 1
)
WHERE e.difficulty_level IS NOT NULL
  AND current_level.id IS NULL
  AND EXISTS (
      SELECT 1
      FROM fitness_levels benchmark_level_exists
      WHERE UPPER(COALESCE(benchmark_level_exists.status, 'ACTIVE')) = 'ACTIVE'
  );


-- Daily Training Plan Templates: schedule existing workouts onto the training days of
-- (Level + Month + Days/Week). One workout per day; a day without a row is a rest day.
CREATE TABLE IF NOT EXISTS daily_plan_templates (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    code          VARCHAR(30)  NOT NULL,
    name          VARCHAR(120) NOT NULL,
    description   TEXT         DEFAULT NULL,
    level         VARCHAR(30)  NOT NULL,
    month_number  INT          NOT NULL DEFAULT 1,
    days_per_week INT          NOT NULL DEFAULT 3,
    active        TINYINT(1)   NOT NULL DEFAULT 1,
    created_by    BIGINT       DEFAULT NULL,
    updated_at    DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_daily_plan_templates_code (code),
    KEY idx_daily_plan_templates_match (level, month_number, days_per_week, active),
    CONSTRAINT fk_daily_plan_templates_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT ck_daily_plan_templates_month CHECK (month_number BETWEEN 1 AND 24),
    CONSTRAINT ck_daily_plan_templates_days CHECK (days_per_week BETWEEN 1 AND 7)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS daily_plan_template_days (
    template_id BIGINT NOT NULL,
    day_number  INT    NOT NULL,
    workout_id  BIGINT NOT NULL,
    PRIMARY KEY (template_id, day_number),
    KEY idx_daily_plan_template_days_workout (workout_id),
    CONSTRAINT fk_daily_plan_template_days_template FOREIGN KEY (template_id) REFERENCES daily_plan_templates (id) ON DELETE CASCADE,
    CONSTRAINT fk_daily_plan_template_days_workout FOREIGN KEY (workout_id) REFERENCES workout_entries (id),
    CONSTRAINT ck_daily_plan_template_days_day CHECK (day_number BETWEEN 1 AND 7)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- SEED: Workout list (SYSTEM + CUSTOM) and Daily Training Plan Templates.
-- Every block is guarded by code / NOT EXISTS, so re-running is a no-op.
-- Exercises are referenced by code (seeded in V5 / V21 / V23). HOLD exercises use
-- duration_seconds, REPS exercises use reps.
-- ============================================================

-- 1. Workouts. SYSTEM = content library (schedulable in daily plans), CUSTOM = member-built.
INSERT INTO workout_entries (code, name, description, type, level, source, active, created_by, updated_at)
SELECT s.code, s.name, s.description, 'WORKOUT', s.level, s.source, s.active, u.id,
       CURRENT_TIMESTAMP(6) - INTERVAL s.days_ago DAY
FROM (
              SELECT 'SYS_BEG_PUSH' AS code, 'Beginner Push Foundations' AS name,
                     'Knee and full push-ups with a plank finisher for chest, shoulders and triceps.' AS description,
                     'Beginner' AS level, 'SYSTEM' AS source, 1 AS active, 'contentmanager@calishealth.com' AS email, 9 AS days_ago
    UNION ALL SELECT 'SYS_BEG_PULL', 'Beginner Pull Foundations',
                     'Australian rows and negative pull-ups to build the first strict pull-up.',
                     'Beginner', 'SYSTEM', 1, 'contentmanager@calishealth.com', 9
    UNION ALL SELECT 'SYS_BEG_LOWER', 'Beginner Lower Body',
                     'Assisted and bodyweight squats with core bracing.',
                     'Beginner', 'SYSTEM', 1, 'contentmanager@calishealth.com', 8
    UNION ALL SELECT 'SYS_INT_UPPER', 'Intermediate Upper Strength',
                     'Pull-ups, dips and pike push-ups for vertical pulling and pushing.',
                     'Intermediate', 'SYSTEM', 1, 'contentmanager@calishealth.com', 7
    UNION ALL SELECT 'SYS_INT_CONDITIONING', 'Intermediate Conditioning',
                     'High-rep squats and burpees with long plank holds.',
                     'Intermediate', 'SYSTEM', 1, 'contentmanager@calishealth.com', 7
    UNION ALL SELECT 'SYS_INT_SKILLS', 'Intermediate Skill Practice',
                     'Handstand, L-sit and tuck front lever practice plus pull-up volume.',
                     'Intermediate', 'SYSTEM', 1, 'demo.content@calishealth.com', 6
    UNION ALL SELECT 'SYS_ADV_STRENGTH', 'Advanced Full Body Strength',
                     'Muscle-ups, archer pull-ups, diamond push-ups and pistol squats.',
                     'Advanced', 'SYSTEM', 1, 'demo.content@calishealth.com', 5
    UNION ALL SELECT 'SYS_ADV_SKILLS', 'Advanced Skill Session',
                     'Front lever, tuck planche and handstand push-up work.',
                     'Advanced', 'SYSTEM', 1, 'demo.content@calishealth.com', 5
    UNION ALL SELECT 'SYS_ADV_POWER', 'Advanced Power Circuit',
                     'Explosive burpees and archer variations finished with a V-sit hold.',
                     'Advanced', 'SYSTEM', 1, 'demo.content@calishealth.com', 4
    UNION ALL SELECT 'SYS_ADV_LEGACY', 'Advanced Legacy Circuit',
                     'Retired advanced routine kept for history.',
                     'Advanced', 'SYSTEM', 0, 'demo.content@calishealth.com', 40
    UNION ALL SELECT 'SYS_ELITE_STRENGTH', 'Elite One-Arm Strength',
                     'One-arm pull-ups, one-arm push-ups and shrimp squats.',
                     'Elite', 'SYSTEM', 1, 'demo.content@calishealth.com', 3
    UNION ALL SELECT 'SYS_ELITE_STATICS', 'Elite Statics',
                     'Full planche and front lever holds with archer push-ups.',
                     'Elite', 'SYSTEM', 1, 'demo.content@calishealth.com', 3
    UNION ALL SELECT 'SYS_ELITE_MIXED', 'Elite Mixed Mastery',
                     'Muscle-ups, one-arm push-ups and planche holds in one session.',
                     'Elite', 'SYSTEM', 1, 'demo.content@calishealth.com', 2
    UNION ALL SELECT 'CUS_MORNING_WAKEUP', 'Morning Wake-up',
                     'Short routine before work.',
                     'Beginner', 'CUSTOM', 1, 'demo.member@calishealth.com', 14
    UNION ALL SELECT 'CUS_HOME_PUSH_PULL', 'Home Push & Pull',
                     'Push-ups and rows I can do at home.',
                     'Beginner', 'CUSTOM', 1, 'dashboard.beginner@calishealth.com', 12
    UNION ALL SELECT 'CUS_PARK_SESSION', 'Park Bar Session',
                     'Pull-up bar and dip station circuit at the park.',
                     'Intermediate', 'CUSTOM', 1, 'dashboard.intermediate@calishealth.com', 10
    UNION ALL SELECT 'CUS_HANDSTAND_DAY', 'Handstand Day',
                     'Balance practice with core work.',
                     'Intermediate', 'CUSTOM', 1, 'halevinh1000@gmail.com', 6
    UNION ALL SELECT 'CUS_LEVER_GRIND', 'Lever Grind',
                     'Front lever focus with muscle-up volume.',
                     'Advanced', 'CUSTOM', 1, 'dashboard.advanced@calishealth.com', 3
    UNION ALL SELECT 'CUS_OLD_ROUTINE', 'Old Routine',
                     'No longer used.',
                     'Beginner', 'CUSTOM', 0, 'demo.member@calishealth.com', 35
) s
LEFT JOIN users u ON u.email = s.email
WHERE NOT EXISTS (SELECT 1 FROM workout_entries x WHERE x.code = s.code);

-- 2. Exercises inside each seeded workout (only filled when the workout has none yet).
INSERT INTO workout_exercises (workout_id, exercise_id, display_order, sets, reps, duration_seconds, rest_seconds)
SELECT w.id, e.id, s.ord, s.sets, s.reps, s.dur, s.rest
FROM (
              SELECT 'SYS_BEG_PUSH' AS wcode, 'EX_KNEE_PUSHUP' AS ex, 0 AS ord, 3 AS sets, 12 AS reps, NULL AS dur, 60 AS rest
    UNION ALL SELECT 'SYS_BEG_PUSH', 'EX_1', 1, 3, 8, NULL, 75
    UNION ALL SELECT 'SYS_BEG_PUSH', 'EX_4', 2, 3, NULL, 30, 45
    UNION ALL SELECT 'SYS_BEG_PULL', 'EX_AUSTRALIAN_ROW', 0, 3, 10, NULL, 75
    UNION ALL SELECT 'SYS_BEG_PULL', 'EX_NEGATIVE_PULLUP', 1, 3, 5, NULL, 90
    UNION ALL SELECT 'SYS_BEG_PULL', 'HE-DEMO0002', 2, 3, NULL, 20, 45
    UNION ALL SELECT 'SYS_BEG_LOWER', 'EX_ASSISTED_SQUAT', 0, 3, 12, NULL, 60
    UNION ALL SELECT 'SYS_BEG_LOWER', 'EX_3', 1, 4, 15, NULL, 60
    UNION ALL SELECT 'SYS_BEG_LOWER', 'EX_4', 2, 3, NULL, 40, 45
    UNION ALL SELECT 'SYS_INT_UPPER', 'EX_2', 0, 4, 8, NULL, 120
    UNION ALL SELECT 'SYS_INT_UPPER', 'EX_5', 1, 4, 10, NULL, 90
    UNION ALL SELECT 'SYS_INT_UPPER', 'HE-DEMO0001', 2, 3, 10, NULL, 90
    UNION ALL SELECT 'SYS_INT_UPPER', 'EX_11', 3, 3, 6, NULL, 120
    UNION ALL SELECT 'SYS_INT_CONDITIONING', 'EX_3', 0, 4, 25, NULL, 60
    UNION ALL SELECT 'SYS_INT_CONDITIONING', 'EX_6', 1, 4, 12, NULL, 75
    UNION ALL SELECT 'SYS_INT_CONDITIONING', 'EX_4', 2, 3, NULL, 60, 45
    UNION ALL SELECT 'SYS_INT_SKILLS', 'EX_7', 0, 5, NULL, 30, 90
    UNION ALL SELECT 'SYS_INT_SKILLS', 'SK-DEMO0001', 1, 4, NULL, 15, 90
    UNION ALL SELECT 'SYS_INT_SKILLS', 'EX_TUCK_FRONT_LEVER', 2, 4, NULL, 12, 120
    UNION ALL SELECT 'SYS_INT_SKILLS', 'EX_2', 3, 3, 8, NULL, 120
    UNION ALL SELECT 'SYS_ADV_STRENGTH', 'EX_8', 0, 4, 5, NULL, 180
    UNION ALL SELECT 'SYS_ADV_STRENGTH', 'EX_ARCHER_PULLUP', 1, 3, 6, NULL, 150
    UNION ALL SELECT 'SYS_ADV_STRENGTH', 'EX_DIAMOND_PUSHUP', 2, 3, 15, NULL, 90
    UNION ALL SELECT 'SYS_ADV_STRENGTH', 'SK-DEMO0002', 3, 3, 6, NULL, 120
    UNION ALL SELECT 'SYS_ADV_SKILLS', 'EX_9', 0, 5, NULL, 10, 150
    UNION ALL SELECT 'SYS_ADV_SKILLS', 'EX_TUCK_PLANCHE', 1, 5, NULL, 15, 150
    UNION ALL SELECT 'SYS_ADV_SKILLS', 'EX_HANDSTAND_PUSHUP', 2, 4, 5, NULL, 150
    UNION ALL SELECT 'SYS_ADV_POWER', 'EX_6', 0, 4, 15, NULL, 60
    UNION ALL SELECT 'SYS_ADV_POWER', 'EX_ARCHER_PULLUP', 1, 4, 5, NULL, 150
    UNION ALL SELECT 'SYS_ADV_POWER', 'EX_DIAMOND_PUSHUP', 2, 3, 12, NULL, 90
    UNION ALL SELECT 'SYS_ADV_POWER', 'EX_V_SIT', 3, 3, NULL, 15, 90
    UNION ALL SELECT 'SYS_ADV_LEGACY', 'EX_8', 0, 3, 4, NULL, 180
    UNION ALL SELECT 'SYS_ADV_LEGACY', 'EX_DIAMOND_PUSHUP', 1, 3, 12, NULL, 90
    UNION ALL SELECT 'SYS_ELITE_STRENGTH', 'EX_ONE_ARM_PULLUP', 0, 5, 2, NULL, 240
    UNION ALL SELECT 'SYS_ELITE_STRENGTH', 'EX_ONE_ARM_PUSHUP', 1, 4, 5, NULL, 180
    UNION ALL SELECT 'SYS_ELITE_STRENGTH', 'EX_SHRIMP_SQUAT', 2, 4, 6, NULL, 150
    UNION ALL SELECT 'SYS_ELITE_STATICS', 'EX_10', 0, 6, NULL, 8, 240
    UNION ALL SELECT 'SYS_ELITE_STATICS', 'EX_9', 1, 5, NULL, 15, 180
    UNION ALL SELECT 'SYS_ELITE_STATICS', 'EX_ARCHER_PUSHUP', 2, 4, 8, NULL, 120
    UNION ALL SELECT 'SYS_ELITE_MIXED', 'EX_8', 0, 5, 6, NULL, 180
    UNION ALL SELECT 'SYS_ELITE_MIXED', 'EX_ONE_ARM_PUSHUP', 1, 4, 4, NULL, 180
    UNION ALL SELECT 'SYS_ELITE_MIXED', 'EX_10', 2, 4, NULL, 6, 240
    UNION ALL SELECT 'CUS_MORNING_WAKEUP', 'EX_3', 0, 2, 15, NULL, 45
    UNION ALL SELECT 'CUS_MORNING_WAKEUP', 'EX_KNEE_PUSHUP', 1, 2, 10, NULL, 45
    UNION ALL SELECT 'CUS_MORNING_WAKEUP', 'EX_4', 2, 2, NULL, 30, 30
    UNION ALL SELECT 'CUS_HOME_PUSH_PULL', 'EX_1', 0, 3, 10, NULL, 60
    UNION ALL SELECT 'CUS_HOME_PUSH_PULL', 'EX_AUSTRALIAN_ROW', 1, 3, 10, NULL, 60
    UNION ALL SELECT 'CUS_PARK_SESSION', 'EX_2', 0, 4, 10, NULL, 90
    UNION ALL SELECT 'CUS_PARK_SESSION', 'EX_5', 1, 4, 12, NULL, 90
    UNION ALL SELECT 'CUS_PARK_SESSION', 'EX_6', 2, 3, 10, NULL, 60
    UNION ALL SELECT 'CUS_HANDSTAND_DAY', 'EX_7', 0, 6, NULL, 20, 60
    UNION ALL SELECT 'CUS_HANDSTAND_DAY', 'HE-DEMO0001', 1, 3, 12, NULL, 75
    UNION ALL SELECT 'CUS_HANDSTAND_DAY', 'SK-DEMO0001', 2, 3, NULL, 20, 60
    UNION ALL SELECT 'CUS_LEVER_GRIND', 'EX_9', 0, 6, NULL, 8, 150
    UNION ALL SELECT 'CUS_LEVER_GRIND', 'EX_8', 1, 4, 4, NULL, 180
    UNION ALL SELECT 'CUS_OLD_ROUTINE', 'EX_1', 0, 3, 10, NULL, 60
) s
JOIN workout_entries w ON w.code = s.wcode
JOIN exercises e ON e.code = s.ex
WHERE NOT EXISTS (SELECT 1 FROM workout_exercises x WHERE x.workout_id = w.id);

-- 3. Daily Training Plan Templates. Only one ACTIVE plan per (level, month, days/week):
--    a seeded plan whose combination is already active elsewhere is saved as Inactive.
INSERT INTO daily_plan_templates (code, name, description, level, month_number, days_per_week, active, created_by, updated_at)
SELECT s.code, s.name, s.description, s.level, s.month_number, s.days_per_week,
       CASE WHEN s.active = 1 AND NOT EXISTS (
                SELECT 1 FROM daily_plan_templates o
                WHERE o.active = 1 AND o.level = s.level
                  AND o.month_number = s.month_number AND o.days_per_week = s.days_per_week)
            THEN 1 ELSE 0 END,
       u.id, CURRENT_TIMESTAMP(6) - INTERVAL s.days_ago DAY
FROM (
              SELECT 'DP-SEED-BEG-M1-3D' AS code, 'Beginner Month 1 - 3 days/week' AS name,
                     'Full body, push and pull days to learn the basic patterns.' AS description,
                     'Beginner' AS level, 1 AS month_number, 3 AS days_per_week, 1 AS active,
                     'contentmanager@calishealth.com' AS email, 8 AS days_ago
    UNION ALL SELECT 'DP-SEED-BEG-M1-4D', 'Beginner Month 1 - 4 days/week',
                     'Push, pull, legs and a full body day each week.',
                     'Beginner', 1, 4, 1, 'contentmanager@calishealth.com', 8
    UNION ALL SELECT 'DP-SEED-BEG-M2-3D', 'Beginner Month 2 - 3 days/week',
                     'More volume on push, legs and pull.',
                     'Beginner', 2, 3, 1, 'contentmanager@calishealth.com', 7
    UNION ALL SELECT 'DP-SEED-INT-M1-3D', 'Intermediate Month 1 - 3 days/week',
                     'Upper strength, conditioning and skill practice.',
                     'Intermediate', 1, 3, 1, 'contentmanager@calishealth.com', 6
    UNION ALL SELECT 'DP-SEED-INT-M1-4D', 'Intermediate Month 1 - 4 days/week',
                     'Adds a dedicated push day and a core session.',
                     'Intermediate', 1, 4, 1, 'demo.content@calishealth.com', 6
    UNION ALL SELECT 'DP-SEED-INT-M2-5D', 'Intermediate Month 2 - 5 days/week',
                     'High-frequency block mixing strength, skill and core.',
                     'Intermediate', 2, 5, 1, 'demo.content@calishealth.com', 5
    UNION ALL SELECT 'DP-SEED-INT-M1-3D-V0', 'Intermediate Month 1 - 3 days (old)',
                     'Previous version kept inactive for reference.',
                     'Intermediate', 1, 3, 0, 'demo.content@calishealth.com', 30
    UNION ALL SELECT 'DP-SEED-ADV-M1-4D', 'Advanced Month 1 - 4 days/week',
                     'Strength, skill and power days with a second skill session.',
                     'Advanced', 1, 4, 1, 'demo.content@calishealth.com', 4
    UNION ALL SELECT 'DP-SEED-ADV-M2-5D', 'Advanced Month 2 - 5 days/week',
                     'Periodized advanced block alternating strength and power.',
                     'Advanced', 2, 5, 1, 'demo.content@calishealth.com', 4
    UNION ALL SELECT 'DP-SEED-ELITE-M1-3D', 'Elite Month 1 - 3 days/week',
                     'One-arm strength, statics and a mixed mastery day.',
                     'Elite', 1, 3, 1, 'demo.content@calishealth.com', 2
) s
LEFT JOIN users u ON u.email = s.email
WHERE NOT EXISTS (SELECT 1 FROM daily_plan_templates x WHERE x.code = s.code);

-- 4. One SYSTEM workout of the same level per training day (Day 1..days_per_week).
INSERT INTO daily_plan_template_days (template_id, day_number, workout_id)
SELECT t.id, s.day_number, w.id
FROM (
              SELECT 'DP-SEED-BEG-M1-3D' AS tcode, 1 AS day_number, 'SYS_BEGINNER_FULL_BODY' AS wcode
    UNION ALL SELECT 'DP-SEED-BEG-M1-3D', 2, 'SYS_BEG_PUSH'
    UNION ALL SELECT 'DP-SEED-BEG-M1-3D', 3, 'SYS_BEG_PULL'
    UNION ALL SELECT 'DP-SEED-BEG-M1-4D', 1, 'SYS_BEG_PUSH'
    UNION ALL SELECT 'DP-SEED-BEG-M1-4D', 2, 'SYS_BEG_PULL'
    UNION ALL SELECT 'DP-SEED-BEG-M1-4D', 3, 'SYS_BEG_LOWER'
    UNION ALL SELECT 'DP-SEED-BEG-M1-4D', 4, 'SYS_BEGINNER_FULL_BODY'
    UNION ALL SELECT 'DP-SEED-BEG-M2-3D', 1, 'SYS_BEG_PUSH'
    UNION ALL SELECT 'DP-SEED-BEG-M2-3D', 2, 'WO-DEMO0002'
    UNION ALL SELECT 'DP-SEED-BEG-M2-3D', 3, 'SYS_BEG_PULL'
    UNION ALL SELECT 'DP-SEED-INT-M1-3D', 1, 'SYS_INT_UPPER'
    UNION ALL SELECT 'DP-SEED-INT-M1-3D', 2, 'SYS_INT_CONDITIONING'
    UNION ALL SELECT 'DP-SEED-INT-M1-3D', 3, 'SYS_INT_SKILLS'
    UNION ALL SELECT 'DP-SEED-INT-M1-4D', 1, 'SYS_INT_UPPER'
    UNION ALL SELECT 'DP-SEED-INT-M1-4D', 2, 'SYS_INT_CONDITIONING'
    UNION ALL SELECT 'DP-SEED-INT-M1-4D', 3, 'WO-DEMO0001'
    UNION ALL SELECT 'DP-SEED-INT-M1-4D', 4, 'SYS_CORE_15'
    UNION ALL SELECT 'DP-SEED-INT-M2-5D', 1, 'SYS_INT_UPPER'
    UNION ALL SELECT 'DP-SEED-INT-M2-5D', 2, 'SYS_INT_SKILLS'
    UNION ALL SELECT 'DP-SEED-INT-M2-5D', 3, 'SYS_INT_CONDITIONING'
    UNION ALL SELECT 'DP-SEED-INT-M2-5D', 4, 'WO-DEMO0001'
    UNION ALL SELECT 'DP-SEED-INT-M2-5D', 5, 'SYS_CORE_15'
    UNION ALL SELECT 'DP-SEED-INT-M1-3D-V0', 1, 'SYS_INT_UPPER'
    UNION ALL SELECT 'DP-SEED-INT-M1-3D-V0', 2, 'SYS_CORE_15'
    UNION ALL SELECT 'DP-SEED-INT-M1-3D-V0', 3, 'SYS_INT_CONDITIONING'
    UNION ALL SELECT 'DP-SEED-ADV-M1-4D', 1, 'SYS_ADV_STRENGTH'
    UNION ALL SELECT 'DP-SEED-ADV-M1-4D', 2, 'SYS_ADV_SKILLS'
    UNION ALL SELECT 'DP-SEED-ADV-M1-4D', 3, 'SYS_ADV_POWER'
    UNION ALL SELECT 'DP-SEED-ADV-M1-4D', 4, 'SYS_ADV_SKILLS'
    UNION ALL SELECT 'DP-SEED-ADV-M2-5D', 1, 'SYS_ADV_STRENGTH'
    UNION ALL SELECT 'DP-SEED-ADV-M2-5D', 2, 'SYS_ADV_POWER'
    UNION ALL SELECT 'DP-SEED-ADV-M2-5D', 3, 'SYS_ADV_SKILLS'
    UNION ALL SELECT 'DP-SEED-ADV-M2-5D', 4, 'SYS_ADV_STRENGTH'
    UNION ALL SELECT 'DP-SEED-ADV-M2-5D', 5, 'SYS_ADV_POWER'
    UNION ALL SELECT 'DP-SEED-ELITE-M1-3D', 1, 'SYS_ELITE_STRENGTH'
    UNION ALL SELECT 'DP-SEED-ELITE-M1-3D', 2, 'SYS_ELITE_STATICS'
    UNION ALL SELECT 'DP-SEED-ELITE-M1-3D', 3, 'SYS_ELITE_MIXED'
) s
JOIN daily_plan_templates t ON t.code = s.tcode
JOIN workout_entries w ON w.code = s.wcode
WHERE NOT EXISTS (SELECT 1 FROM daily_plan_template_days x WHERE x.template_id = t.id);