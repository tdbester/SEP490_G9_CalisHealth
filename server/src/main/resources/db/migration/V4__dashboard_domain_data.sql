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
-- Hash được viết dạng literal; Flyway được cấu hình placeholderReplacement=false
-- nên ký tự '$' của BCrypt không bị hiểu nhầm thành placeholder.
INSERT INTO users (email, password, full_name, role, enabled, created_at)
SELECT 'halevinh1000@gmail.com', '$2a$10$zwNeeUeqbvISJFlYVfD4VONnkOhYg1QckPaAYt2ZE.xmQ715MxAp.', 'Hale Vinh', 'MEMBER', TRUE, CURRENT_TIMESTAMP(6)
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

-- ============================================================
-- 5. WORKOUT TEMPLATES  (module Library/Content)
-- ------------------------------------------------------------
-- V3 đã ghi rõ: "Cố ý KHÔNG khai báo FK tới workout_entries: bảng đó thuộc module
-- Library/Content và chưa có migration nào tạo. Gắn FK sau khi có migration tạo
-- bảng đó." V4 bổ sung phần còn thiếu này, vì vậy phải đặt SAU khi users
-- (V1), exercises + workout_sessions (V3) đã tồn tại.
--
--   workout_entries     -> 1 workout template / 7-day training plan (WorkoutEntry)
--   workout_exercises   -> join table workout <-> exercises, giữ thứ tự (WorkoutEntry.exercises)
--   workout_plan_items  -> bài tập theo từng thứ trong tuần (WorkoutPlanItem)
-- ============================================================
CREATE TABLE IF NOT EXISTS workout_entries (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    code        VARCHAR(30)  NOT NULL,
    name        VARCHAR(120) NOT NULL,
    description TEXT         DEFAULT NULL,
    content     TEXT         DEFAULT NULL,
    type        VARCHAR(40)  DEFAULT 'WORKOUT',
    level       VARCHAR(30)  NOT NULL,
    active      TINYINT(1)   NOT NULL DEFAULT 1,
    created_by  BIGINT       DEFAULT NULL,
    updated_at  DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_workout_entries_code (code),
    KEY idx_workout_entries_created_by (created_by),
    KEY idx_workout_entries_active (active),
    CONSTRAINT fk_workout_entries_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workout_exercises (
    workout_id    BIGINT NOT NULL,
    exercise_id   BIGINT NOT NULL,
    display_order INT    NOT NULL DEFAULT 0,
    PRIMARY KEY (workout_id, display_order),
    KEY idx_workout_exercises_exercise (exercise_id),
    CONSTRAINT fk_workout_exercises_workout FOREIGN KEY (workout_id) REFERENCES workout_entries (id) ON DELETE CASCADE,
    CONSTRAINT fk_workout_exercises_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workout_plan_items (
    id                BIGINT NOT NULL AUTO_INCREMENT,
    workout_id        BIGINT NOT NULL,
    exercise_id       BIGINT NOT NULL,
    day_of_week       INT    NOT NULL,
    beginner_sets     INT    NOT NULL,
    beginner_reps     INT    NOT NULL,
    intermediate_sets INT    NOT NULL,
    intermediate_reps INT    NOT NULL,
    advanced_sets     INT    NOT NULL,
    advanced_reps     INT    NOT NULL,
    PRIMARY KEY (id),
    KEY idx_workout_plan_items_workout_day (workout_id, day_of_week),
    KEY idx_workout_plan_items_exercise (exercise_id),
    CONSTRAINT fk_workout_plan_items_workout FOREIGN KEY (workout_id) REFERENCES workout_entries (id) ON DELETE CASCADE,
    CONSTRAINT fk_workout_plan_items_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id),
    CONSTRAINT ck_workout_plan_items_day CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT ck_workout_plan_items_sets_reps CHECK (
        beginner_sets BETWEEN 1 AND 20 AND beginner_reps BETWEEN 1 AND 100
        AND intermediate_sets BETWEEN 1 AND 20 AND intermediate_reps BETWEEN 1 AND 100
        AND advanced_sets BETWEEN 1 AND 20 AND advanced_reps BETWEEN 1 AND 100
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Gắn FK còn thiếu cho workout_sessions.workout_id (dời lại từ V3).
-- Kiểm tra information_schema để chạy lại an toàn.
SET @fk_exists := (
    SELECT COUNT(*)
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'workout_sessions'
      AND CONSTRAINT_NAME = 'fk_workout_sessions_workout'
);
SET @sql := IF(@fk_exists = 0,
    'ALTER TABLE workout_sessions ADD CONSTRAINT fk_workout_sessions_workout FOREIGN KEY (workout_id) REFERENCES workout_entries (id)',
    'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- 6. DEMO DATA cho 2 khối "Health & Progress" và "Community" trên Dashboard
-- ============================================================
-- DashboardService.community() đếm workout_entries WHERE active = TRUE AND
-- created_by IS NOT NULL -> tạo sẵn vài template "community chia sẻ".
INSERT INTO workout_entries (code, name, description, content, type, level, active, created_by, updated_at)SELECT seed.code, seed.name, seed.description, seed.content, 'WORKOUT', seed.level, TRUE, u.id, CURRENT_TIMESTAMP(6)
FROM (
    SELECT 'COMM_FULL_BODY_30' AS code, 'Full Body 30' AS name,
           'A 30-minute full body circuit anyone can follow.' AS description,
           'Push-up / Bodyweight Squat / Plank — 3 rounds, 60s rest.' AS content,
           'Beginner' AS level, 'admin@calishealth.com' AS owner
    UNION ALL SELECT 'COMM_CORE_CRUSHER', 'Core Crusher', 'Short core finisher for busy days.',
           'Plank / Burpee — 3 rounds, 45s rest.', 'Intermediate', 'admin@calishealth.com'
    UNION ALL SELECT 'COMM_PULL_PROGRESS', 'Pull-up Progress', 'Progressive pull-up ladder toward your first rep.',
           'Pull-up / Strict pull-up — 5 rounds, 90s rest.', 'Advanced', 'halevinh1000@gmail.com'
) seed
JOIN users u ON u.email = seed.owner
WHERE NOT EXISTS (SELECT 1 FROM workout_entries existing WHERE existing.code = seed.code);

-- Bài tập của từng template, display_order giữ thứ tự.
INSERT IGNORE INTO workout_exercises (workout_id, exercise_id, display_order)
SELECT we.id, e.id, seed.display_order
FROM (
    SELECT 'COMM_FULL_BODY_30' AS code, 'Push-up' AS exercise_name, 0 AS display_order
    UNION ALL SELECT 'COMM_FULL_BODY_30', 'Bodyweight Squat', 1
    UNION ALL SELECT 'COMM_FULL_BODY_30', 'Plank', 2
    UNION ALL SELECT 'COMM_CORE_CRUSHER', 'Plank', 0
    UNION ALL SELECT 'COMM_CORE_CRUSHER', 'Burpee', 1
    UNION ALL SELECT 'COMM_PULL_PROGRESS', 'Pull-up', 0
    UNION ALL SELECT 'COMM_PULL_PROGRESS', 'Strict pull-up', 1
) seed
JOIN workout_entries we ON we.code = seed.code
JOIN exercises e ON e.name = seed.exercise_name;

-- Buổi tập đã hoàn thành của demo member trong TUẦN HIỆN TẠI (T2..CN) để thanh
-- weeklyGoal có số. DashboardService chỉ đếm session_date trong tuần hiện tại,
-- nên dùng offset động theo WEEKDAY(CURDATE()) thay vì ngày cố định.
-- Dùng NOT EXISTS thay vì dựa vào INSERT IGNORE: uk_workout_sessions_member_date_workout
-- có workout_id nullable, và unique index KHÔNG chặn trùng khi một cột là NULL,
-- trong khi dữ liệu cũ đang có workout_id = NULL -> INSERT IGNORE sẽ lọt/trùng sai.
-- Chỉ seed ngày ĐÃ TRÔI QUA trong tuần (days_ago <= WEEKDAY(CURDATE())), không
-- tạo buổi tập ở tương lai.
INSERT INTO workout_sessions
    (member_profile_id, workout_id, session_date, status, started_at, finished_at,
     active_seconds, total_reps, notes)
SELECT mp.id, we.id,
       NOW() - INTERVAL seed.days_ago DAY,
       'COMPLETED',
       NOW() - INTERVAL seed.days_ago DAY,
       NOW() - INTERVAL seed.days_ago DAY + INTERVAL seed.active_seconds SECOND,
       seed.active_seconds, seed.total_reps, 'Seeded demo session'
FROM (
    SELECT 'COMM_FULL_BODY_30' AS code, 0 AS days_ago, 1800 AS active_seconds, 60 AS total_reps
    UNION ALL SELECT 'COMM_CORE_CRUSHER', 1, 900, 40
    UNION ALL SELECT 'COMM_FULL_BODY_30', 2, 1500, 55
    UNION ALL SELECT 'COMM_PULL_PROGRESS', 3, 1200, 35
    UNION ALL SELECT 'COMM_FULL_BODY_30', 4, 1650, 58
    UNION ALL SELECT 'COMM_CORE_CRUSHER', 5, 900, 42
    UNION ALL SELECT 'COMM_PULL_PROGRESS', 6, 1350, 38
) seed
JOIN workout_entries we ON we.code = seed.code
JOIN member_profiles mp ON mp.user_id = (SELECT id FROM users WHERE email = 'halevinh1000@gmail.com')
WHERE seed.days_ago <= WEEKDAY(CURDATE())
  AND NOT EXISTS (
      SELECT 1 FROM workout_sessions existing
      WHERE existing.member_profile_id = mp.id
        AND existing.workout_id = we.id
        AND existing.session_date = (CURDATE() - INTERVAL seed.days_ago DAY)
  );

-- Đo lại cơ thể hôm nay để khối "Health & Progress" luôn có bản ghi mới nhất.
INSERT INTO body_measurements (member_profile_id, weight, height, measured_at)
SELECT mp.id, 68.50, 172.00, CURRENT_TIMESTAMP(6)
FROM member_profiles mp
JOIN users u ON u.id = mp.user_id
WHERE u.email = 'halevinh1000@gmail.com'
  AND NOT EXISTS (
      SELECT 1 FROM body_measurements existing
      WHERE existing.member_profile_id = mp.id
        AND DATE(existing.measured_at) = CURDATE()
  );
