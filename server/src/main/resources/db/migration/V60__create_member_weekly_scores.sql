-- Weekly leaderboard scores used by /api/leaderboard.
CREATE TABLE member_weekly_scores (
    id BIGINT NOT NULL AUTO_INCREMENT,
    member_id BIGINT NOT NULL,
    week_start DATE NOT NULL,
    fitness_level_id BIGINT NULL,
    sessions_score DECIMAL(10,2) NOT NULL DEFAULT 0,
    time_score DECIMAL(10,2) NOT NULL DEFAULT 0,
    accuracy_score DECIMAL(10,2) NOT NULL DEFAULT 0,
    rest_day_bonus DECIMAL(10,2) NOT NULL DEFAULT 0,
    streak_bonus DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_score DECIMAL(10,2) NOT NULL DEFAULT 0,
    `rank` INT NULL,
    `previous_rank` INT NULL,
    `rank_change` INT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_member_weekly_scores_member_week_level
        UNIQUE (member_id, week_start, fitness_level_id),
    CONSTRAINT fk_member_weekly_scores_member
        FOREIGN KEY (member_id) REFERENCES member_profiles (id),
    CONSTRAINT fk_member_weekly_scores_fitness_level
        FOREIGN KEY (fitness_level_id) REFERENCES fitness_levels (id),
    INDEX ix_member_weekly_scores_week_total (week_start, total_score),
    INDEX ix_member_weekly_scores_member_week (member_id, week_start)
);