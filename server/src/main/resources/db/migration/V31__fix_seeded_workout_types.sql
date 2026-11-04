-- V28: Give the seeded workouts a real workout type (HEALTH / SKILL) instead of the legacy 'WORKOUT'.
--
-- The workout seeds in V21 / V24 wrote type = 'WORKOUT', which is a leftover default from V5.
-- Everywhere else in the app a workout is either HEALTH or SKILL (see WorkoutService), so those
-- rows were listed as "Flex" and could not be edited without changing the type by hand.
--
-- V24 is already applied, so the fix lives here instead of being edited into that migration.
-- 1. Explicit HEALTH / SKILL type for every workout seeded by V24.
-- 2. Safety net: any other row still on the legacy 'WORKOUT' default takes the type implied by
--    its exercises (a session containing a SKILL exercise is a SKILL session, otherwise HEALTH).
-- Rows that already carry a real type are never touched.

-- 1. Seeded workouts (V24 block "1. Workouts").
UPDATE workout_entries
SET type = CASE code
                -- Beginner: bodyweight health patterns.
                WHEN 'SYS_BEG_PUSH'        THEN 'HEALTH'
                WHEN 'SYS_BEG_PULL'        THEN 'HEALTH'
                WHEN 'SYS_BEG_LOWER'       THEN 'HEALTH'
                -- Intermediate: conditioning stays health, statics/holds are skill work.
                WHEN 'SYS_INT_UPPER'       THEN 'HEALTH'
                WHEN 'SYS_INT_CONDITIONING' THEN 'HEALTH'
                WHEN 'SYS_INT_SKILLS'      THEN 'SKILL'
                -- Advanced / Elite: gymnastics strength and statics.
                WHEN 'SYS_ADV_STRENGTH'    THEN 'SKILL'
                WHEN 'SYS_ADV_SKILLS'      THEN 'SKILL'
                WHEN 'SYS_ADV_POWER'       THEN 'SKILL'
                WHEN 'SYS_ADV_LEGACY'      THEN 'SKILL'
                WHEN 'SYS_ELITE_STRENGTH'  THEN 'SKILL'
                WHEN 'SYS_ELITE_STATICS'   THEN 'SKILL'
                WHEN 'SYS_ELITE_MIXED'     THEN 'SKILL'
                -- Member-built demo workouts.
                WHEN 'CUS_MORNING_WAKEUP'  THEN 'HEALTH'
                WHEN 'CUS_HOME_PUSH_PULL'  THEN 'HEALTH'
                WHEN 'CUS_PARK_SESSION'    THEN 'HEALTH'
                WHEN 'CUS_HANDSTAND_DAY'   THEN 'SKILL'
                WHEN 'CUS_LEVER_GRIND'     THEN 'SKILL'
                WHEN 'CUS_OLD_ROUTINE'     THEN 'HEALTH'
           END
WHERE code IN (
    'SYS_BEG_PUSH', 'SYS_BEG_PULL', 'SYS_BEG_LOWER',
    'SYS_INT_UPPER', 'SYS_INT_CONDITIONING', 'SYS_INT_SKILLS',
    'SYS_ADV_STRENGTH', 'SYS_ADV_SKILLS', 'SYS_ADV_POWER', 'SYS_ADV_LEGACY',
    'SYS_ELITE_STRENGTH', 'SYS_ELITE_STATICS', 'SYS_ELITE_MIXED',
    'CUS_MORNING_WAKEUP', 'CUS_HOME_PUSH_PULL', 'CUS_PARK_SESSION',
    'CUS_HANDSTAND_DAY', 'CUS_LEVER_GRIND', 'CUS_OLD_ROUTINE'
)
-- Never overwrite a type that is already set (a Content Manager may have changed it).
AND (type IS NULL OR UPPER(type) = 'WORKOUT');

-- 2. Any remaining workout still on the legacy 'WORKOUT' value (or NULL) takes the type of its
--    exercises: a session containing a SKILL exercise is a SKILL session, otherwise HEALTH.
UPDATE workout_entries w
SET w.type = CASE WHEN EXISTS (
        SELECT 1
        FROM workout_exercises we
        JOIN exercises e ON e.id = we.exercise_id
        WHERE we.workout_id = w.id
          AND UPPER(e.type) = 'SKILL'
    ) THEN 'SKILL' ELSE 'HEALTH' END
WHERE w.type IS NULL
   OR UPPER(w.type) = 'WORKOUT';
