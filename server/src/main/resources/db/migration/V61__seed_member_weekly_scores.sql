-- V61: Seed weekly leaderboard scores for /api/leaderboard.
--
-- 1) Creates extra MEMBER accounts spread across all fitness levels so the
--    leaderboard has enough rows to be meaningful (rank 1..20).
-- 2) Creates 12 complete weeks of leaderboard rows (current week + 11 previous).
--
-- IMPORTANT: only accounts with users.role = 'MEMBER' are ranked. Content
-- managers and admins may still own a member_profiles row (legacy data), but
-- they must never appear on the leaderboard.
--
-- Scores are deterministic (CRC32 of member id + week start), so rebuilding the
-- database always produces the same leaderboard ordering.
--
-- Rank assignment mirrors WeeklyLeaderboardService.computeScoresForWeek:
--   total_score DESC, then member id ASC as tie-breaker.
-- previous_rank is the rank the member held in the week right before, and
-- rank_change = previous_rank - current_rank (positive = moved up).

-- ============================================================
-- 1. EXTRA MEMBER ACCOUNTS
-- ============================================================
-- Password : Test@123   (BCrypt, cost 10)

INSERT INTO users (email, password, full_name, role, enabled, blocked, must_change_password, created_at)
SELECT
    seed.email,
    '$2a$10$zwNeeUeqbvISJFlYVfD4VONnkOhYg1QckPaAYt2ZE.xmQ715MxAp.',
    seed.full_name,
    'MEMBER',
    TRUE,
    FALSE,
    FALSE,
    NOW(6)
FROM (
    SELECT 'leaderboard.member01@calishealth.com' AS email, 'Nguyen Van An'    AS full_name UNION ALL
    SELECT 'leaderboard.member02@calishealth.com', 'Tran Thi Bich'
    UNION ALL SELECT 'leaderboard.member03@calishealth.com', 'Le Hoang Chung'
    UNION ALL SELECT 'leaderboard.member04@calishealth.com', 'Pham Thi Dung'
    UNION ALL SELECT 'leaderboard.member05@calishealth.com', 'Hoang Van Em'
    UNION ALL SELECT 'leaderboard.member06@calishealth.com', 'Vu Thi Phuong'
    UNION ALL SELECT 'leaderboard.member07@calishealth.com', 'Dang Quang Huy'
    UNION ALL SELECT 'leaderboard.member08@calishealth.com', 'Bui Thi Lan'
    UNION ALL SELECT 'leaderboard.member09@calishealth.com', 'Do Manh Tuong'
    UNION ALL SELECT 'leaderboard.member10@calishealth.com', 'Ngo Quang Vinh'
    UNION ALL SELECT 'leaderboard.member11@calishealth.com', 'Duong Thi Mai'
    UNION ALL SELECT 'leaderboard.member12@calishealth.com', 'Ly Xuan Son'
    UNION ALL SELECT 'leaderboard.member13@calishealth.com', 'Truong Ngoc Anh'
) seed
WHERE NOT EXISTS (SELECT 1 FROM users existing WHERE existing.email = seed.email);

UPDATE users SET enabled = TRUE WHERE role = 'MEMBER' AND email LIKE 'leaderboard.member%';

-- Give the seeded members a fitness level (round-robin over the 4 levels).
INSERT INTO member_profiles (user_id, fitness_level_id, gender, weight, height, streak_count, longest_streak, days_per_week)
SELECT
    u.id,
    fl.id,
    seed.gender,
    seed.weight,
    seed.height,
    seed.streak,
    seed.streak + seed.seed_offset,
    seed.days_per_week
FROM (
    SELECT 'leaderboard.member01@calishealth.com' AS email, 'Male'   AS gender, 68.00 AS weight, 174.00 AS height, 12 AS streak, 4  AS seed_offset, 4 AS days_per_week UNION ALL
    SELECT 'leaderboard.member02@calishealth.com', 'Female', 58.50, 163.00, 8,  2, 3 UNION ALL
    SELECT 'leaderboard.member03@calishealth.com', 'Male',   72.00, 178.00, 21, 9, 5 UNION ALL
    SELECT 'leaderboard.member04@calishealth.com', 'Female', 61.00, 167.00, 5,  1, 3 UNION ALL
    SELECT 'leaderboard.member05@calishealth.com', 'Male',   65.50, 170.00, 3,  0, 3 UNION ALL
    SELECT 'leaderboard.member06@calishealth.com', 'Female', 55.00, 158.00, 15, 6, 4 UNION ALL
    SELECT 'leaderboard.member07@calishealth.com', 'Male',   80.00, 182.00, 30, 14, 6 UNION ALL
    SELECT 'leaderboard.member08@calishealth.com', 'Female', 59.50, 165.00, 7,  3, 3 UNION ALL
    SELECT 'leaderboard.member09@calishealth.com', 'Male',   75.00, 176.00, 18, 7, 4 UNION ALL
    SELECT 'leaderboard.member10@calishealth.com', 'Female', 54.00, 160.00, 2,  0, 3 UNION ALL
    SELECT 'leaderboard.member11@calishealth.com', 'Male',   70.00, 172.00, 10, 4, 4 UNION ALL
    SELECT 'leaderboard.member12@calishealth.com', 'Female', 62.00, 168.00, 6,  2, 3 UNION ALL
    SELECT 'leaderboard.member13@calishealth.com', 'Male',   77.50, 180.00, 25, 11, 5
) seed
JOIN users u ON u.email = seed.email
JOIN (
    SELECT 'Beginner'     AS name, 1 AS seq UNION ALL
    SELECT 'Intermediate', 2 UNION ALL
    SELECT 'Advanced',     3 UNION ALL
    SELECT 'Expert',       4
) lvl ON lvl.seq = (MOD(CRC32(seed.email), 4) + 1)
JOIN fitness_levels fl ON fl.name = lvl.name
WHERE u.role = 'MEMBER'
  AND NOT EXISTS (SELECT 1 FROM member_profiles mp WHERE mp.user_id = u.id);

-- ============================================================
-- 2. WEEKLY LEADERBOARD ROWS (12 weeks)
-- ============================================================

-- Clear the seeded window so the migration stays idempotent.
DELETE FROM member_weekly_scores
WHERE week_start >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 77 DAY);

INSERT INTO member_weekly_scores (
    member_id,
    week_start,
    fitness_level_id,
    sessions_score,
    time_score,
    accuracy_score,
    rest_day_bonus,
    streak_bonus,
    total_score,
    `rank`,
    previous_rank,
    rank_change,
    created_at,
    updated_at
)
WITH RECURSIVE weeks AS (
    -- Monday of the current week, then walk backwards 11 more weeks.
    SELECT DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AS week_start
    UNION ALL
    SELECT week_start - INTERVAL 7 DAY
    FROM weeks
    WHERE week_start > DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 77 DAY)
),
components AS (
    SELECT
        mp.id                AS member_id,
        mp.fitness_level_id  AS fitness_level_id,
        w.week_start         AS week_start,
        ROUND(20 + MOD(CRC32(CONCAT(mp.id, ':s:', w.week_start)), 80), 2) AS sessions_score,
        ROUND(5  + MOD(CRC32(CONCAT(mp.id, ':t:', w.week_start)), 45), 2) AS time_score,
        ROUND(10 + MOD(CRC32(CONCAT(mp.id, ':a:', w.week_start)), 25), 2) AS accuracy_score,
        ROUND(MOD(CRC32(CONCAT(mp.id, ':r:', w.week_start)), 15), 2)        AS rest_day_bonus,
        ROUND(MOD(CRC32(CONCAT(mp.id, ':k:', w.week_start)), 20), 2)        AS streak_bonus
    FROM member_profiles mp
    JOIN users u ON u.id = mp.user_id
    CROSS JOIN weeks w
    -- Only accounts with role = MEMBER belong on the leaderboard.
    WHERE u.role = 'MEMBER'
),
totals AS (
    SELECT
        c.*,
        c.sessions_score
            + c.time_score
            + c.accuracy_score
            + c.rest_day_bonus
            + c.streak_bonus AS total_score
    FROM components c
),
ranked AS (
    SELECT
        t.*,
        ROW_NUMBER() OVER (
            PARTITION BY t.week_start
            ORDER BY t.total_score DESC, t.member_id ASC
        ) AS member_rank
    FROM totals t
)
SELECT
    r.member_id,
    r.week_start,
    r.fitness_level_id,
    r.sessions_score,
    r.time_score,
    r.accuracy_score,
    r.rest_day_bonus,
    r.streak_bonus,
    r.total_score,
    r.member_rank,
    p.member_rank,
    CASE WHEN p.member_rank IS NULL THEN NULL
         ELSE CAST(p.member_rank AS SIGNED) - CAST(r.member_rank AS SIGNED) END,
    NOW(),
    NOW()
FROM ranked r
LEFT JOIN ranked p
       ON p.member_id = r.member_id
      AND p.week_start = r.week_start - INTERVAL 7 DAY;
