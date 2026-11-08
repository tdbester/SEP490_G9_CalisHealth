-- V62: Seed realistic weekly training activity for the leaderboard.
--
-- The leaderboard score is derived from real activity (workout_sessions +
-- session_exercise_results), so this migration creates 12 weeks of sessions for
-- every MEMBER account. WeeklyLeaderboardService then computes the actual
-- scores from this data on startup.
--
-- Activity is deterministic (CRC32 of member id / week / slot), so rebuilding
-- the database always produces the same leaderboard ordering.
--
-- Only accounts with users.role = 'MEMBER' get activity rows.

DELETE FROM member_weekly_scores;

-- ============================================================
-- 1. WEEKLY SESSIONS
-- ============================================================

INSERT IGNORE INTO workout_sessions (
    member_profile_id,
    workout_id,
    workout_name,
    category,
    session_date,
    status,
    started_at,
    finished_at,
    active_seconds,
    total_reps
)
WITH RECURSIVE week_list AS (
    -- Oldest seeded week (11 weeks before the current one) -> newest.
    SELECT 0 AS idx,
           DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) - INTERVAL 77 DAY AS week_start
    UNION ALL
    SELECT idx + 1, week_start + INTERVAL 7 DAY
    FROM week_list
    WHERE idx < 11
),
member_seed AS (
    SELECT mp.id            AS member_id,
           mp.days_per_week AS days_per_week,
           CASE WHEN fl.name = 'Expert' THEN 'Elite' ELSE COALESCE(fl.name, 'Beginner') END AS workout_level,
           w.idx       AS idx,
           w.week_start AS week_start
    FROM member_profiles mp
    JOIN users u ON u.id = mp.user_id AND u.role = 'MEMBER'
    LEFT JOIN fitness_levels fl ON fl.id = mp.fitness_level_id
    CROSS JOIN week_list w
    -- Member 6 already owns real demo sessions in the two most recent weeks;
    -- seeding them again would collide with the (member, date, workout) key.
    WHERE NOT (mp.id = 6 AND w.idx >= 10)
),
day_slots AS (
    -- Spread the training days across the week: day offsets 0 (Monday) .. 6 (Sunday).
    SELECT ms.member_id,
           ms.days_per_week,
           ms.workout_level,
           ms.idx,
           ms.week_start,
           slot.seq,
           (FLOOR(slot.seq * 7 / ms.days_per_week)
               + MOD(CRC32(CONCAT(ms.member_id, ':', ms.idx)), 7)) % 7 AS day_offset
    FROM member_seed ms
    JOIN (
        SELECT 0 AS seq UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
        UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6
    ) slot ON slot.seq < ms.days_per_week
),
level_workouts AS (
    SELECT we.level,
           we.id   AS workout_id,
           we.name AS workout_name,
           ROW_NUMBER() OVER (PARTITION BY we.level ORDER BY we.id) AS rn,
           COUNT(*) OVER (PARTITION BY we.level)                 AS total
    FROM workout_entries we
    WHERE we.active = TRUE
      AND we.source = 'SYSTEM'
      AND we.type <> 'DAILY_TRAINING_PLAN'
),
picked AS (
    SELECT ds.member_id,
           ds.idx,
           ds.seq,
           ds.week_start,
           ds.week_start + INTERVAL ds.day_offset DAY AS session_date,
           lw.workout_id,
           lw.workout_name,
           900 + MOD(CRC32(CONCAT(ds.member_id, ':', ds.idx, ':', ds.seq, ':t')), 1500) AS active_seconds
    FROM day_slots ds
    JOIN level_workouts lw
      ON lw.level = ds.workout_level
     AND lw.rn = MOD(CRC32(CONCAT(ds.member_id, ':', ds.idx, ':', ds.seq, ':w')), lw.total) + 1
)
SELECT
    p.member_id,
    p.workout_id,
    p.workout_name,
    'strength',
    p.session_date,
    'COMPLETED',
    TIMESTAMP(p.session_date) + INTERVAL (MOD(CRC32(CONCAT(p.member_id, ':', p.idx, ':', p.seq, ':h')), 14) + 6) HOUR,
    TIMESTAMP(p.session_date) + INTERVAL (MOD(CRC32(CONCAT(p.member_id, ':', p.idx, ':', p.seq, ':h')), 14) + 6) HOUR
        + INTERVAL p.active_seconds SECOND,
    p.active_seconds,
    (SELECT COALESCE(SUM(we2.reps), 0) FROM workout_exercises we2 WHERE we2.workout_id = p.workout_id)
FROM picked p;

-- ============================================================
-- 2. EXERCISE RESULTS PER SESSION
-- ============================================================

INSERT INTO session_exercise_results (
    sets_completed,
    valid_reps,
    invalid_reps,
    accuracy,
    active_seconds,
    sort_order,
    workout_session_id,
    exercise_id
)
SELECT
    we.sets,
    CASE
        WHEN e.category = 'HOLD' THEN 0
        ELSE GREATEST(0, COALESCE(we.reps, 0)
             - MOD(CRC32(CONCAT(ws.id, ':', we.exercise_id, ':i')), GREATEST(1, FLOOR(COALESCE(we.reps, 0) / 6))))
    END,
    CASE
        WHEN e.category = 'HOLD' THEN 0
        ELSE MOD(CRC32(CONCAT(ws.id, ':', we.exercise_id, ':i')), GREATEST(1, FLOOR(COALESCE(we.reps, 0) / 6)))
    END,
    70 + MOD(CRC32(CONCAT(ws.id, ':', we.exercise_id, ':a')), 31),
    CASE
        WHEN e.category = 'HOLD' THEN COALESCE(we.duration_seconds, 30) * we.sets
        ELSE COALESCE(we.reps, 0) * 3
    END,
    we.display_order,
    ws.id,
    we.exercise_id
FROM workout_sessions ws
JOIN workout_exercises we ON we.workout_id = ws.workout_id
JOIN exercises e ON e.id = we.exercise_id
WHERE ws.status = 'COMPLETED'
  AND ws.finished_at IS NOT NULL
  AND ws.member_profile_id IN (
      SELECT mp.id FROM member_profiles mp JOIN users u ON u.id = mp.user_id WHERE u.role = 'MEMBER'
  )
  AND NOT EXISTS (
      SELECT 1 FROM session_exercise_results existing
      WHERE existing.workout_session_id = ws.id AND existing.exercise_id = we.exercise_id
  );
