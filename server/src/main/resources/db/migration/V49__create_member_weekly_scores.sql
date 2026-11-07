-- Member Weekly Scores Leaderboard
-- 按周计算member分数，每周一0时重置

-- 删除旧表（如果存在）
DROP TABLE IF EXISTS member_weekly_scores;

CREATE TABLE member_weekly_scores (
    id BIGINT NOT NULL AUTO_INCREMENT,
    member_id BIGINT NOT NULL,
    week_start DATE NOT NULL,
    fitness_level_id BIGINT,
    
    -- Additive score breakdown; total_score has no business maximum
    sessions_score DECIMAL(10,2) DEFAULT 0,        -- 完成会话 (max 100)
    time_score DECIMAL(10,2) DEFAULT 0,            -- 运动时间 (max 50)
    accuracy_score DECIMAL(10,2) DEFAULT 0,        -- 动作准确性 (0-30)
    rest_day_bonus DECIMAL(10,2) DEFAULT 0,        -- 休息日奖励 (0-20)
    streak_bonus DECIMAL(10,2) DEFAULT 0,          -- 连续奖励 (0-20)
    
    total_score DECIMAL(10,2) DEFAULT 0,           -- 总分
    `rank` INT,                                        -- 排名
    previous_rank INT,                               -- 上周排名
    rank_change INT,                                 -- 排名变化
    
    created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    
    PRIMARY KEY (id),
    UNIQUE KEY uk_member_week_scores (member_id, week_start, fitness_level_id),
    KEY idx_week_start (week_start),
    KEY idx_fitness_level (fitness_level_id),
    KEY idx_total_score (total_score DESC),
    
    CONSTRAINT fk_member_weekly_member FOREIGN KEY (member_id) REFERENCES member_profiles (id),
    CONSTRAINT fk_member_weekly_level FOREIGN KEY (fitness_level_id) REFERENCES fitness_levels (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============ SEED DATA ============
SET @current_monday = '2026-11-03';  -- 本周周一 (Nov 3, 2026)
SET @last_monday = '2026-10-27';     -- 上周周一 (Oct 27, 2026)

-- 为活跃member生成本周数据 (top 20)
INSERT INTO member_weekly_scores (member_id, week_start, fitness_level_id, sessions_score, time_score, accuracy_score, rest_day_bonus, streak_bonus, total_score)
SELECT 
    mp.id,
    @current_monday as week_start,
    mp.fitness_level_id,
    ROUND(RAND() * 100, 2) as sessions_score,
    ROUND(RAND() * 50, 2) as time_score,
    ROUND(RAND() * 30, 2) as accuracy_score,
    ROUND(RAND() * 20, 2) as rest_day_bonus,
    ROUND(RAND() * 20, 2) as streak_bonus,
    0 as total_score
FROM member_profiles mp
WHERE mp.fitness_level_id IS NOT NULL
LIMIT 20;

-- 更新本周总分
UPDATE member_weekly_scores
SET total_score = sessions_score + time_score + accuracy_score + rest_day_bonus + streak_bonus
WHERE week_start = @current_monday;

-- 为本周设置排名
SET @rank = 0;
UPDATE member_weekly_scores
SET `rank` = (@rank := @rank + 1)
WHERE week_start = @current_monday
ORDER BY total_score DESC;

-- 生成上周对比数据 (部分member，用于展示排名变化)
INSERT INTO member_weekly_scores (member_id, week_start, fitness_level_id, sessions_score, time_score, accuracy_score, rest_day_bonus, streak_bonus, total_score, `rank`)
SELECT 
    mp.id,
    @last_monday,
    mp.fitness_level_id,
    ROUND(RAND() * 100, 2),
    ROUND(RAND() * 50, 2),
    ROUND(RAND() * 30, 2),
    ROUND(RAND() * 20, 2),
    ROUND(RAND() * 20, 2),
    0,
    NULL
FROM member_profiles mp
WHERE mp.fitness_level_id IS NOT NULL
  AND mp.id NOT IN (SELECT DISTINCT member_id FROM member_weekly_scores WHERE week_start = @last_monday)
LIMIT 15;

-- 更新上周总分
UPDATE member_weekly_scores
SET total_score = sessions_score + time_score + accuracy_score + rest_day_bonus + streak_bonus
WHERE week_start = @last_monday AND total_score = 0;

-- 为上周设置排名
SET @rank = 0;
UPDATE member_weekly_scores
SET `rank` = (@rank := @rank + 1)
WHERE week_start = @last_monday
ORDER BY total_score DESC;

-- 更新本周 rank_change 和 previous_rank
UPDATE member_weekly_scores current_week
JOIN member_weekly_scores previous_week ON 
  previous_week.member_id = current_week.member_id 
  AND previous_week.week_start = @last_monday
SET 
  current_week.rank_change = previous_week.`rank` - current_week.`rank`,
  current_week.previous_rank = previous_week.`rank`
WHERE current_week.week_start = @current_monday;
