CREATE TABLE IF NOT EXISTS muscle_groups (
                                             id BIGINT NOT NULL AUTO_INCREMENT,
                                             name VARCHAR(80) NOT NULL,
    dashboard_code VARCHAR(40) NOT NULL,
    icon_key VARCHAR(40) NOT NULL,
    tone VARCHAR(20) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_muscle_groups_name (name),
    UNIQUE KEY uk_muscle_groups_dashboard_code (dashboard_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS exercise_muscle_groups (
                                                      exercise_id BIGINT NOT NULL,
                                                      muscle_group_id BIGINT NOT NULL,
                                                      PRIMARY KEY (exercise_id, muscle_group_id),
    KEY idx_exercise_muscle_groups_group (muscle_group_id),
    CONSTRAINT fk_exercise_muscle_groups_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id),
    CONSTRAINT fk_exercise_muscle_groups_group FOREIGN KEY (muscle_group_id) REFERENCES muscle_groups (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS progression_rules (
                                                 id BIGINT NOT NULL AUTO_INCREMENT,
                                                 rule_name VARCHAR(150) NOT NULL,
    relationship VARCHAR(100) DEFAULT NULL,
    required_reps INT DEFAULT NULL,
    min_accuracy DECIMAL(6, 3) DEFAULT NULL,
    status VARCHAR(40) DEFAULT 'ACTIVE',
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    exercise_id BIGINT NOT NULL,
    prerequisite_exercise_id BIGINT NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_progression_rule (exercise_id, prerequisite_exercise_id),
    CONSTRAINT fk_progression_rule_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id),
    CONSTRAINT fk_progression_rule_prerequisite FOREIGN KEY (prerequisite_exercise_id) REFERENCES exercises (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS body_measurements (
                                                 id BIGINT NOT NULL AUTO_INCREMENT,
                                                 member_profile_id BIGINT NOT NULL,
                                                 weight DECIMAL(6, 2) DEFAULT NULL,
    height DECIMAL(6, 2) DEFAULT NULL,
    measured_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_body_measurements_member_date (member_profile_id, measured_at),
    CONSTRAINT fk_body_measurements_member FOREIGN KEY (member_profile_id) REFERENCES member_profiles (id),
    CONSTRAINT ck_body_measurements_weight CHECK (weight IS NULL OR weight > 0),
    CONSTRAINT ck_body_measurements_height CHECK (height IS NULL OR height > 0)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Ensure the requested demo member exists and is enabled for login.
INSERT INTO users (email, password, full_name, role, enabled, created_at)
SELECT 'halevinh1000@gmail.com', '${'$'}2a${'$'}10${'$'}zwNeeUeqbvISJFlYVfD4VONnkOhYg1QckPaAYt2ZE.xmQ715MxAp.', 'Hale Vinh', 'MEMBER', TRUE, CURRENT_TIMESTAMP(6)
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'halevinh1000@gmail.com');
UPDATE users SET enabled = TRUE WHERE email = 'halevinh1000@gmail.com';

INSERT INTO member_profiles (user_id)
SELECT u.id FROM users u
WHERE u.email = 'halevinh1000@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM member_profiles mp WHERE mp.user_id = u.id);

-- Seed representative measurements only for the requested account.
INSERT INTO body_measurements (member_profile_id, weight, height, measured_at)
SELECT mp.id, 68.50, 172.00, CURRENT_TIMESTAMP(6)
FROM member_profiles mp
         JOIN users u ON u.id = mp.user_id
WHERE u.email = 'halevinh1000@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM body_measurements existing
    WHERE existing.member_profile_id = mp.id
);
INSERT IGNORE INTO muscle_groups (name, dashboard_code, icon_key, tone) VALUES
('Chest', 'chest', 'fitness', 'purple'),
('Back', 'back', 'accessibility', 'blue'),
('Legs', 'legs', 'walk', 'green'),
('Core', 'core', 'adjust', 'orange'),
('Arms', 'arms', 'martial', 'pink'),
('Full body', 'full-body', 'self', 'cyan');

INSERT INTO exercises (name, type, category, difficulty_level, default_sets, default_reps, source, status, updated_at)
SELECT seed.name, seed.type, seed.category, seed.difficulty_level, seed.default_sets, seed.default_reps, 'SYSTEM', 'ACTIVE', CURRENT_TIMESTAMP(6)
FROM (
         SELECT 'Push-up' AS name, 'HEALTH' AS type, 'Chest' AS category, 'Beginner' AS difficulty_level, 3 AS default_sets, 12 AS default_reps
         UNION ALL SELECT 'Pull-up', 'HEALTH', 'Back', 'Intermediate', 3, 8
         UNION ALL SELECT 'Bodyweight Squat', 'HEALTH', 'Legs', 'Beginner', 3, 15
         UNION ALL SELECT 'Plank', 'HEALTH', 'Core', 'Beginner', 3, 45
         UNION ALL SELECT 'Dips', 'HEALTH', 'Arms', 'Intermediate', 3, 10
         UNION ALL SELECT 'Burpee', 'HEALTH', 'Full body', 'Intermediate', 3, 12
         UNION ALL SELECT 'Handstand', 'SKILL', 'Balance', 'Intermediate', NULL, NULL
         UNION ALL SELECT 'Muscle-up', 'SKILL', 'Pull', 'Advanced', NULL, NULL
         UNION ALL SELECT 'Front lever', 'SKILL', 'Pull', 'Advanced', NULL, NULL
         UNION ALL SELECT 'Planche', 'SKILL', 'Push', 'Expert', NULL, NULL
         UNION ALL SELECT 'Strict pull-up', 'SKILL', 'Pull', 'Beginner', NULL, NULL
     ) seed
WHERE NOT EXISTS (SELECT 1 FROM exercises existing WHERE existing.name = seed.name AND existing.type = seed.type);

INSERT IGNORE INTO exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, mg.id
FROM exercises e
         JOIN muscle_groups mg ON mg.dashboard_code = CASE e.name
                                                          WHEN 'Push-up' THEN 'chest'
                                                          WHEN 'Pull-up' THEN 'back'
                                                          WHEN 'Bodyweight Squat' THEN 'legs'
                                                          WHEN 'Plank' THEN 'core'
                                                          WHEN 'Dips' THEN 'arms'
                                                          WHEN 'Burpee' THEN 'full-body'
    END
WHERE e.name IN ('Push-up', 'Pull-up', 'Bodyweight Squat', 'Plank', 'Dips', 'Burpee');

INSERT IGNORE INTO progression_rules (rule_name, relationship, required_reps, min_accuracy, status, exercise_id, prerequisite_exercise_id)
SELECT CONCAT(skill.name, ' progression ', prerequisite.name), 'PREREQUISITE', 5, 80, 'ACTIVE', skill.id, prerequisite.id
FROM exercises skill
         JOIN exercises prerequisite ON prerequisite.name = CASE skill.name
                                                                WHEN 'Handstand' THEN 'Plank'
                                                                WHEN 'Muscle-up' THEN 'Pull-up'
                                                                WHEN 'Front lever' THEN 'Pull-up'
                                                                WHEN 'Planche' THEN 'Push-up'
                                                                WHEN 'Strict pull-up' THEN 'Pull-up'
    END
WHERE skill.type = 'SKILL'
  AND skill.name IN ('Handstand', 'Muscle-up', 'Front lever', 'Planche', 'Strict pull-up');