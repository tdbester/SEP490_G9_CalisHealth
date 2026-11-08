-- V62: Seed current week leaderboard data
-- Seed a small, deterministic leaderboard for local/demo environments.
-- The guard keeps existing computed scores untouched.

SET @current_monday = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY);

INSERT INTO member_weekly_scores (
    member_id,
    week_start,
    fitness_level_id,
    sessions_score,
    time_score,
    accuracy_score,
    rest_day_bonus,
    streak_bonus,
    total_score
)
SELECT
    members.id,
    @current_monday,
    members.fitness_level_id,
    70 + MOD(members.id * 13, 31),
    25 + MOD(members.id * 7, 26),
    15 + MOD(members.id * 5, 16),
    8 + MOD(members.id * 3, 13),
    8 + MOD(members.id * 11, 13),
    0
FROM (
    SELECT mp.id, mp.fitness_level_id
    FROM member_profiles mp
    WHERE mp.fitness_level_id IS NOT NULL
    ORDER BY mp.id
    LIMIT 20
) members
WHERE NOT EXISTS (
    SELECT 1
    FROM member_weekly_scores existing
    WHERE existing.week_start = @current_monday
);

UPDATE member_weekly_scores
SET total_score = sessions_score + time_score + accuracy_score + rest_day_bonus + streak_bonus
WHERE week_start = @current_monday
  AND total_score = 0;

SET @rank = 0;
UPDATE member_weekly_scores
SET `rank` = (@rank := @rank + 1)
WHERE week_start = @current_monday
ORDER BY total_score DESC, id ASC;
