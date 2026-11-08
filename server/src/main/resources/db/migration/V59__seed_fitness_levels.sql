-- V59: Create fitness_levels table and seed initial data
-- These levels are used for the onboarding survey level assessment.

CREATE TABLE IF NOT EXISTS fitness_levels (
    id       BIGINT       NOT NULL AUTO_INCREMENT,
    name     VARCHAR(64)  NOT NULL UNIQUE,
    score_min DECIMAL(8, 3) NOT NULL,
    score_max DECIMAL(8, 3) NOT NULL,
    status   VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT ck_fitness_levels_status CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    CONSTRAINT ck_fitness_levels_range CHECK (score_min <= score_max)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO fitness_levels (
    name, 
    score_min, 
    score_max, 
    status
) VALUES
    ('Beginner', 1, 3, 'ACTIVE'),
    ('Intermediate', 4, 6, 'ACTIVE'),
    ('Advanced', 7, 9, 'ACTIVE'),
    ('Expert', 10, 12, 'ACTIVE')
ON DUPLICATE KEY UPDATE
    updated_at = NOW();
