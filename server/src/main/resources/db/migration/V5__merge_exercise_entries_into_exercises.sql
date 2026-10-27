-- ============================================================
-- V5: MERGE exercise_entries INTO exercises
-- ------------------------------------------------------------
-- `exercises` (ERD) là bảng canonical: workout_exercises, workout_plan_items,
-- form_rules, progression_rules, benchmark_criteria, session_exercise_results…
-- đều FK tới nó. Bảng phụ `exercise_entries` trước đây chỉ lặp lại dữ liệu của
-- `exercises` cho khu Content Manager và gây lệch dữ liệu (workout trỏ sai bài),
-- nên migration này gộp hẳn nó vào `exercises`:
--
--   1. Bổ sung dữ liệu nền còn thiếu (muscle group, fitness level).
--   2. Thêm vào `exercises` những cột Content Manager cần mà bảng gốc chưa có:
--        code (mã hiển thị/định danh trên URL), active (publish),
--        anatomy_image_url.
--   3. Chuyển toàn bộ dữ liệu còn lại của `exercise_entries` sang `exercises`
--      (khớp theo tên, không phân biệt hoa/thường) rồi xoá bảng phụ.
--   4. Seed workout mẫu của khu Content Manager, trỏ ĐÚNG exercises.id.
--
-- Mọi bước đều idempotent để chạy lại an toàn trên DB đã có dữ liệu.
-- ============================================================

-- ============================================================
-- 1. DỮ LIỆU NỀN CÒN THIẾU
-- ============================================================
-- Muscle group mà form Create Exercise cho chọn nhưng V4 chưa seed
-- (V4 đang có: Chest, Back, Legs, Core, Arms, Full body).
INSERT IGNORE INTO muscle_groups (name, dashboard_code, icon_key, tone) VALUES
('Shoulders', 'shoulders', 'fitness', 'purple'),
('Glutes', 'glutes', 'walk', 'green');

INSERT IGNORE INTO fitness_levels (name) VALUES
('Beginner'),
('Intermediate'),
('Advanced');

-- ============================================================
-- 2. CỘT MỚI TRÊN EXERCISES
-- ============================================================
SET @has_code := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exercises' AND COLUMN_NAME = 'code'
);
SET @sql := IF(@has_code = 0,
    'ALTER TABLE exercises ADD COLUMN code VARCHAR(30) NULL AFTER id',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_active := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exercises' AND COLUMN_NAME = 'active'
);
SET @sql := IF(@has_active = 0,
    'ALTER TABLE exercises ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1 AFTER status',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_anatomy := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exercises' AND COLUMN_NAME = 'anatomy_image_url'
);
SET @sql := IF(@has_anatomy = 0,
    'ALTER TABLE exercises ADD COLUMN anatomy_image_url VARCHAR(1000) DEFAULT NULL AFTER video_url',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Schema cũ có thể đã tạo các cột không còn thuộc Exercise.
-- Dọn chúng tại migration hiện tại để DB cũ và DB mới cùng một cấu trúc.
SET @has_duration := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exercises' AND COLUMN_NAME = 'duration'
);
SET @sql := IF(@has_duration = 0,
    'ALTER TABLE exercises ADD COLUMN duration INT DEFAULT NULL AFTER default_reps',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_demo_fk := (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'exercises'
      AND CONSTRAINT_NAME = 'fk_exercises_demo_media'
);
SET @sql := IF(@has_demo_fk > 0,
    'ALTER TABLE exercises DROP FOREIGN KEY fk_exercises_demo_media',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_demo_idx := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exercises'
      AND INDEX_NAME = 'idx_exercises_demo_media'
);
SET @sql := IF(@has_demo_idx > 0,
    'ALTER TABLE exercises DROP INDEX idx_exercises_demo_media',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @drop_exercise_columns := (
    SELECT GROUP_CONCAT(CONCAT('DROP COLUMN `', COLUMN_NAME, '`') ORDER BY ORDINAL_POSITION SEPARATOR ', ')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exercises'
      AND COLUMN_NAME IN ('safety_tips', 'anatomy_theory', 'default_rest', 'demo_media_id')
);
SET @sql := IF(@drop_exercise_columns IS NOT NULL,
    CONCAT('ALTER TABLE exercises ', @drop_exercise_columns),
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- 2b. WORKOUT TEMPLATES (module Library/Content)
-- ------------------------------------------------------------
-- V1-V4 trên main chưa tạo các bảng này nên V5 tạo (idempotent).
--   workout_entries     -> 1 workout template / 7-day training plan
--   workout_exercises   -> join table workout <-> exercises, giữ thứ tự
--   workout_plan_items  -> bài tập theo từng thứ trong tuần
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

-- FK workout_sessions.workout_id -> workout_entries (V3 cố ý bỏ vì bảng chưa tồn tại).
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
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- 3. CHUYỂN DỮ LIỆU TỪ exercise_entries (nếu còn)
-- ============================================================
SET @has_entries := (
    SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exercise_entries'
);

-- 3a. Entry đã có bài tương ứng trong exercises: bổ sung các cột còn thiếu.
SET @sql := IF(@has_entries > 0,
    'UPDATE exercises e
     JOIN exercise_entries ee ON LOWER(TRIM(ee.name)) = LOWER(TRIM(e.name))
     SET e.code = COALESCE(NULLIF(e.code, ''''), ee.code),
         e.active = ee.active,
         e.anatomy_image_url = COALESCE(e.anatomy_image_url, ee.anatomy_image_url),
         e.status = CASE WHEN ee.active THEN ''ACTIVE'' ELSE ''INACTIVE'' END,
         e.instructions = COALESCE(e.instructions, ee.description),
         e.execution_steps = COALESCE(e.execution_steps, ee.guide),
         e.video_url = COALESCE(e.video_url, ee.demo_video_url),
         e.category = COALESCE(e.category, ee.category),
         e.difficulty_level = COALESCE(e.difficulty_level, ee.level)',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3b. Entry chưa có bài tương ứng -> tạo trong exercises.
SET @sql := IF(@has_entries > 0,
    'INSERT INTO exercises
         (code, name, type, category, difficulty_level, instructions, execution_steps,
          video_url, anatomy_image_url, source, status, active, updated_at, created_by)
     SELECT ee.code, ee.name, ee.type, ee.category, ee.level, ee.description, ee.guide,
            ee.demo_video_url, ee.anatomy_image_url, ''SYSTEM'',
            CASE WHEN ee.active THEN ''ACTIVE'' ELSE ''INACTIVE'' END, ee.active,
            ee.updated_at, NULL
     FROM exercise_entries ee
     WHERE NOT EXISTS (
         SELECT 1 FROM exercises e WHERE LOWER(TRIM(e.name)) = LOWER(TRIM(ee.name))
     )',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3c. Thư viện tối thiểu: 3 bài chỉ từng tồn tại trong bảng phụ (V4 chưa seed).
INSERT INTO exercises
    (code, name, type, category, difficulty_level, instructions, execution_steps,
     source, status, active, updated_at)
SELECT seed.code, seed.name, seed.type, seed.category, seed.level, seed.description, seed.guide,
       'SYSTEM', 'ACTIVE', TRUE, CURRENT_TIMESTAMP(6)
FROM (
    SELECT 'EX_STRICT_PULLUP' AS code, 'Strict pull-up' AS name, 'SKILL' AS type,
           'Strength' AS category, 'Advanced' AS level,
           'Pull-up with no kipping, used as a benchmark.' AS description,
           'Start from a dead hang.\nPull without swinging the hips.\nFinish with the chin over the bar.' AS guide
    UNION ALL SELECT 'EX_ARCHER_PUSHUP', 'Archer push-up', 'HEALTH', 'Strength', 'Intermediate',
           'Unilateral push-up variation that shifts load toward one arm.',
           'Set the hands wider than shoulder width.\nBend one arm and slide over that side.\nPress back to the centre and alternate.'
    UNION ALL SELECT 'EX_DIAMOND_PUSHUP', 'Diamond push-up', 'HEALTH', 'Strength', 'Advanced',
           'Close-grip push-up that overloads the triceps.',
           'Place the hands together under the sternum.\nKeep the elbows close to the ribs.\nLower the chest to the hands and press up.'
) seed
WHERE NOT EXISTS (SELECT 1 FROM exercises existing WHERE LOWER(TRIM(existing.name)) = LOWER(TRIM(seed.name)));

-- 3d. Bỏ bảng trùng lặp.
DROP TABLE IF EXISTS exercise_entries;

-- ============================================================
-- 4. CHUẨN HOÁ code / active / status
-- ============================================================
UPDATE exercises SET code = CONCAT('EX_', id) WHERE code IS NULL OR code = '';

UPDATE exercises
SET status = CASE WHEN active THEN 'ACTIVE' ELSE 'INACTIVE' END
WHERE status IS NULL OR status = '';

UPDATE exercises
SET active = CASE WHEN UPPER(status) = 'INACTIVE' THEN 0 ELSE 1 END;

SET @has_code_idx := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exercises' AND INDEX_NAME = 'uk_exercises_code'
);
SET @sql := IF(@has_code_idx = 0,
    'ALTER TABLE exercises ADD UNIQUE KEY uk_exercises_code (code)',
    'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================================
-- 5. GÁN MUSCLE GROUP (V4 mới map 6 bài, phần còn lại cần cho UI)
-- ============================================================
INSERT IGNORE INTO exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, mg.id
FROM exercises e
JOIN (
    SELECT 'Push-up' AS exercise_name, 'Chest' AS group_name
    UNION ALL SELECT 'Push-up', 'Arms'
    UNION ALL SELECT 'Push-up', 'Shoulders'
    UNION ALL SELECT 'Archer push-up', 'Chest'
    UNION ALL SELECT 'Archer push-up', 'Arms'
    UNION ALL SELECT 'Diamond push-up', 'Arms'
    UNION ALL SELECT 'Diamond push-up', 'Chest'
    UNION ALL SELECT 'Pull-up', 'Back'
    UNION ALL SELECT 'Pull-up', 'Arms'
    UNION ALL SELECT 'Strict pull-up', 'Back'
    UNION ALL SELECT 'Strict pull-up', 'Arms'
    UNION ALL SELECT 'Bodyweight Squat', 'Legs'
    UNION ALL SELECT 'Bodyweight Squat', 'Glutes'
    UNION ALL SELECT 'Squat', 'Legs'
    UNION ALL SELECT 'Squat', 'Glutes'
    UNION ALL SELECT 'Lunge', 'Legs'
    UNION ALL SELECT 'Lunge', 'Glutes'
    UNION ALL SELECT 'Plank', 'Core'
    UNION ALL SELECT 'Burpee', 'Full body'
    UNION ALL SELECT 'Burpee', 'Legs'
    UNION ALL SELECT 'Dips', 'Arms'
    UNION ALL SELECT 'Dips', 'Chest'
    UNION ALL SELECT 'Handstand', 'Shoulders'
    UNION ALL SELECT 'Handstand', 'Core'
    UNION ALL SELECT 'Muscle-up', 'Back'
    UNION ALL SELECT 'Muscle-up', 'Arms'
    UNION ALL SELECT 'Front lever', 'Core'
    UNION ALL SELECT 'Front lever', 'Back'
    UNION ALL SELECT 'Planche', 'Shoulders'
    UNION ALL SELECT 'Planche', 'Core'
) seed ON LOWER(TRIM(seed.exercise_name)) = LOWER(TRIM(e.name))
JOIN muscle_groups mg ON mg.name = seed.group_name
WHERE NOT EXISTS (
    SELECT 1 FROM exercise_muscle_groups existing
    WHERE existing.exercise_id = e.id AND existing.muscle_group_id = mg.id
);

-- ============================================================
-- 6. WORKOUT MẪU CỦA KHU CONTENT MANAGER
-- ============================================================
INSERT INTO workout_entries (code, name, description, content, type, level, active, created_by, updated_at)
SELECT seed.code, seed.name, seed.description, seed.content, seed.type, seed.level, TRUE,
       (SELECT u.id FROM users u WHERE u.email = 'admin@calishealth.com'),
       CURRENT_TIMESTAMP(6)
FROM (
    SELECT 'SYS_BEGINNER_FULL_BODY' AS code, 'Beginner full body' AS name,
           'Three-move circuit that teaches the basics.' AS description,
           'Repeat 3 rounds: Push-up × 8, Bodyweight Squat × 12, Plank 30 s.' AS content,
           'WORKOUT' AS type, 'Beginner' AS level
    UNION ALL SELECT 'SYS_CORE_15', 'Core 15',
           'Fifteen-minute core session for rest days.',
           'Plank 40 s, Burpee × 10, rest 60 s — 4 rounds.', 'WORKOUT', 'Intermediate'
    UNION ALL SELECT 'SYS_WEEK_PLAN_7', '7-day beginner plan',
           'One fixed week of training with automatic rest days.',
           'Follow each day; empty days are rest days.', 'DAILY_TRAINING_PLAN', 'Beginner'
) seed
WHERE NOT EXISTS (SELECT 1 FROM workout_entries existing WHERE existing.code = seed.code);

-- Dọn liên kết cũ (bản V5 cũ join nhầm id của exercise_entries trong khi FK trỏ
-- exercises.id) rồi seed lại theo tên bài.
DELETE we FROM workout_exercises we
JOIN workout_entries w ON w.id = we.workout_id
WHERE w.code IN ('SYS_BEGINNER_FULL_BODY', 'SYS_CORE_15');

DELETE wpi FROM workout_plan_items wpi
JOIN workout_entries w ON w.id = wpi.workout_id
WHERE w.code = 'SYS_WEEK_PLAN_7';

INSERT IGNORE INTO workout_exercises (workout_id, exercise_id, display_order)
SELECT w.id, e.id, seed.display_order
FROM (
    SELECT 'SYS_BEGINNER_FULL_BODY' AS code, 'Push-up' AS exercise_name, 0 AS display_order
    UNION ALL SELECT 'SYS_BEGINNER_FULL_BODY', 'Bodyweight Squat', 1
    UNION ALL SELECT 'SYS_BEGINNER_FULL_BODY', 'Plank', 2
    UNION ALL SELECT 'SYS_CORE_15', 'Plank', 0
    UNION ALL SELECT 'SYS_CORE_15', 'Burpee', 1
) seed
JOIN workout_entries w ON w.code = seed.code
JOIN exercises e ON LOWER(TRIM(e.name)) = LOWER(TRIM(seed.exercise_name));

-- Lịch tập 7 ngày cho SYS_WEEK_PLAN_7 (day_of_week 1 = Monday).
INSERT INTO workout_plan_items
    (workout_id, exercise_id, day_of_week,
     beginner_sets, beginner_reps, intermediate_sets, intermediate_reps,
     advanced_sets, advanced_reps)
SELECT w.id, e.id, seed.day_of_week,
       seed.beginner_sets, seed.beginner_reps, seed.intermediate_sets, seed.intermediate_reps,
       seed.advanced_sets, seed.advanced_reps
FROM (
    SELECT 'Push-up' AS exercise_name, 1 AS day_of_week,
           3 AS beginner_sets, 8 AS beginner_reps,
           3 AS intermediate_sets, 12 AS intermediate_reps,
           4 AS advanced_sets, 15 AS advanced_reps
    UNION ALL SELECT 'Bodyweight Squat', 1, 3, 12, 3, 15, 4, 20
    UNION ALL SELECT 'Plank', 2, 3, 1, 3, 1, 4, 1
    UNION ALL SELECT 'Pull-up', 3, 3, 4, 3, 6, 4, 8
    UNION ALL SELECT 'Burpee', 5, 3, 10, 4, 12, 4, 15
    UNION ALL SELECT 'Diamond push-up', 6, 3, 6, 3, 10, 4, 12
) seed
JOIN workout_entries w ON w.code = 'SYS_WEEK_PLAN_7'
JOIN exercises e ON LOWER(TRIM(e.name)) = LOWER(TRIM(seed.exercise_name))
WHERE NOT EXISTS (
    SELECT 1 FROM workout_plan_items existing
    WHERE existing.workout_id = w.id
      AND existing.exercise_id = e.id
      AND existing.day_of_week = seed.day_of_week
);

-- ============================================================
-- 7. BENCHMARK_CRITERIA  (màn hình "Level criteria")
-- ============================================================
-- BenchmarkCriterion.java đã map tới bảng này nhưng chưa migration nào tạo.
-- Mỗi dòng = 1 bài tập + ngưỡng tối thiểu (min_value) + trọng số.
CREATE TABLE IF NOT EXISTS benchmark_criteria (
    id               BIGINT        NOT NULL AUTO_INCREMENT,
    min_value        DECIMAL(10,2) NOT NULL,
    criterion_weight DECIMAL(8,3)  NOT NULL,
    exercise_id      BIGINT        NOT NULL,
    fitness_level_id BIGINT        NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_benchmark_criteria (exercise_id, fitness_level_id),
    KEY idx_benchmark_criteria_level (fitness_level_id),
    CONSTRAINT fk_benchmark_criteria_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id),
    CONSTRAINT fk_benchmark_criteria_level FOREIGN KEY (fitness_level_id) REFERENCES fitness_levels (id),
    CONSTRAINT ck_benchmark_criteria_min CHECK (min_value > 0),
    CONSTRAINT ck_benchmark_criteria_weight CHECK (criterion_weight > 0 AND criterion_weight <= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO benchmark_criteria (min_value, criterion_weight, exercise_id, fitness_level_id)
SELECT seed.min_value, seed.criterion_weight, e.id, fl.id
FROM (
    SELECT 'Push-up' AS exercise_name, 'Beginner' AS level_name, 10 AS min_value, 0.400 AS criterion_weight
    UNION ALL SELECT 'Push-up', 'Intermediate', 20, 0.400
    UNION ALL SELECT 'Push-up', 'Advanced', 35, 0.400
    UNION ALL SELECT 'Plank', 'Beginner', 30, 0.300
    UNION ALL SELECT 'Plank', 'Intermediate', 60, 0.300
    UNION ALL SELECT 'Plank', 'Advanced', 120, 0.300
    UNION ALL SELECT 'Bodyweight Squat', 'Beginner', 12, 0.300
    UNION ALL SELECT 'Bodyweight Squat', 'Intermediate', 20, 0.300
    UNION ALL SELECT 'Bodyweight Squat', 'Advanced', 30, 0.300
    UNION ALL SELECT 'Pull-up', 'Intermediate', 3, 0.300
    UNION ALL SELECT 'Pull-up', 'Advanced', 8, 0.300
) seed
JOIN exercises e ON LOWER(TRIM(e.name)) = LOWER(TRIM(seed.exercise_name))
JOIN fitness_levels fl ON fl.name = seed.level_name;

-- ============================================================
-- 8. TÀI KHOẢN CONTENT MANAGER
-- ------------------------------------------------------------
-- Email    : contentmanager@calishealth.com
-- Mật khẩu : Calis@123   (BCrypt, cost 10)
-- ============================================================
INSERT INTO users (email, password, full_name, role, enabled, created_at)
SELECT 'contentmanager@calishealth.com',
       '$2b$10$gZ2hIpWZ0IvwiTyQjU/AF.g1PzGoqnRVrzfcyzYQ/MHSyZH2FRF3i',
       'Content Manager',
       'CONTENT_MANAGER',
       TRUE,
       CURRENT_TIMESTAMP(6)
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM users existing WHERE existing.email = 'contentmanager@calishealth.com'
);

-- Tài khoản đã tồn tại (vd. seed tay trước đó) thì chỉ nâng quyền + kích hoạt,
-- KHÔNG ghi đè mật khẩu người dùng đã đổi.
UPDATE users SET role = 'CONTENT_MANAGER', enabled = TRUE
WHERE email = 'contentmanager@calishealth.com';

INSERT INTO member_profiles (user_id)
SELECT u.id FROM users u
WHERE u.email = 'contentmanager@calishealth.com'
  AND NOT EXISTS (SELECT 1 FROM member_profiles mp WHERE mp.user_id = u.id);

-- ============================================================
-- 9. SEED DASHBOARD MEMBERS AND MODERATION EXAMPLES
-- ============================================================
-- Seed one enabled demo member for each fitness level used by the dashboard.
-- Fixed emails keep this migration idempotent without changing existing members.
INSERT INTO users (email, password, full_name, role, enabled, created_at)
SELECT seed.email, '$2a$10$zwNeeUeqbvISJFlYfD4VONnkOhYg1QckPaAYt2ZE.xmQ715MxAp.', seed.full_name, 'MEMBER', TRUE, CURRENT_TIMESTAMP(6)
FROM (
    SELECT 'dashboard.beginner@calishealth.com' AS email, 'Dashboard Beginner' AS full_name
    UNION ALL SELECT 'dashboard.intermediate@calishealth.com', 'Dashboard Intermediate'
    UNION ALL SELECT 'dashboard.advanced@calishealth.com', 'Dashboard Advanced'
) seed
WHERE NOT EXISTS (SELECT 1 FROM users existing WHERE existing.email = seed.email);

INSERT INTO member_profiles (user_id, fitness_level_id)
SELECT u.id, fl.id
FROM users u
JOIN (
    SELECT 'dashboard.beginner@calishealth.com' AS email, 'Beginner' AS level_name
    UNION ALL SELECT 'dashboard.intermediate@calishealth.com', 'Intermediate'
    UNION ALL SELECT 'dashboard.advanced@calishealth.com', 'Advanced'
) seed ON seed.email = u.email
JOIN fitness_levels fl ON fl.name = seed.level_name
WHERE u.role = 'MEMBER'
  AND u.enabled = TRUE
  AND NOT EXISTS (SELECT 1 FROM member_profiles mp WHERE mp.user_id = u.id);

-- Ensure V4's demo member exists even when earlier versions wrote a literal
-- BCrypt hash that was expanded as a Flyway placeholder.
INSERT INTO users (email, password, full_name, role, enabled, created_at)
SELECT 'halevinh1000@gmail.com', '$2a$10$zwNeeUeqbvISJFlYVfD4VONnkOhYg1QckPaAYt2ZE.xmQ715MxAp.', 'Hale Vinh', 'MEMBER', TRUE, CURRENT_TIMESTAMP(6)
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'halevinh1000@gmail.com');
UPDATE users SET enabled = TRUE WHERE email = 'halevinh1000@gmail.com';

-- Older databases may have the moderation table without historical snapshots.
SET @history_columns := (
    SELECT GROUP_CONCAT(CONCAT('ADD COLUMN `', required_columns.column_name, '` ', required_columns.column_definition)
                        ORDER BY required_columns.position SEPARATOR ', ')
    FROM (
        SELECT 'exercise_name' AS column_name, 'VARCHAR(150) NOT NULL DEFAULT ''''' AS column_definition, 1 AS position
        UNION ALL SELECT 'type', 'VARCHAR(40) DEFAULT NULL', 2
        UNION ALL SELECT 'muscle_group', 'VARCHAR(500) DEFAULT NULL', 3
        UNION ALL SELECT 'level', 'VARCHAR(40) DEFAULT NULL', 4
        UNION ALL SELECT 'description', 'TEXT DEFAULT NULL', 5
        UNION ALL SELECT 'category', 'VARCHAR(120) DEFAULT NULL', 6
        UNION ALL SELECT 'guide', 'TEXT DEFAULT NULL', 7
        UNION ALL SELECT 'demo_video_url', 'VARCHAR(1000) DEFAULT NULL', 8
        UNION ALL SELECT 'anatomy_image_url', 'VARCHAR(1000) DEFAULT NULL', 9
        UNION ALL SELECT 'created_by_name', 'VARCHAR(150) DEFAULT NULL', 10
        UNION ALL SELECT 'decision', 'VARCHAR(20) NOT NULL DEFAULT ''APPROVED''', 11
        UNION ALL SELECT 'reviewed_at', 'DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)', 12
    ) required_columns
    LEFT JOIN information_schema.COLUMNS existing
      ON existing.TABLE_SCHEMA = DATABASE()
     AND existing.TABLE_NAME = 'exercise_moderation_history'
     AND existing.COLUMN_NAME = required_columns.column_name
    WHERE existing.COLUMN_NAME IS NULL
      AND EXISTS (SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exercise_moderation_history')
);
SET @sql := IF(@history_columns IS NOT NULL,
    CONCAT('ALTER TABLE exercise_moderation_history ', @history_columns), 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Pending moderation examples owned by a demo member. Their non-SYSTEM source
-- and inactive state make them appear in the Content Manager review queue.
INSERT INTO exercises
    (code, name, type, category, difficulty_level, instructions, execution_steps,
     source, status, active, updated_at, created_by)
SELECT seed.code, seed.name, seed.type, seed.category, seed.level, seed.instructions,
       seed.execution_steps, 'CUSTOM', 'INACTIVE', FALSE, CURRENT_TIMESTAMP(6), u.id
FROM (
    SELECT 'CM-PENDING-01' AS code, 'Tempo push-up submission' AS name, 'HEALTH' AS type,
           'Strength' AS category, 'Beginner' AS level,
           'A member-submitted push-up variation with a controlled lowering phase.' AS instructions,
           'Lower for three seconds. Pause briefly above the floor. Press back to the start.' AS execution_steps
    UNION ALL SELECT 'CM-PENDING-02', 'Offset pull-up submission', 'SKILL', 'Strength', 'Intermediate',
           'A member-submitted pull-up variation with one hand positioned lower on the bar.',
           'Grip the bar with one hand lower. Pull until the chin clears the bar. Lower with control.'
    UNION ALL SELECT 'CM-PENDING-03', 'Single-leg squat submission', 'HEALTH', 'Strength', 'Advanced',
           'A member-submitted unilateral squat exercise awaiting technique review.',
           'Balance on one leg. Sit the hips back while keeping the knee aligned. Stand without assistance.'
    UNION ALL SELECT 'CM-PENDING-04', 'Pike push-up submission', 'SKILL', 'Shoulders', 'Intermediate',
           'A member-submitted pike push-up variation awaiting review.',
           'Lift the hips high. Bend the elbows toward the floor. Press back up with control.'
    UNION ALL SELECT 'CM-PENDING-05', 'Assisted pistol squat submission', 'HEALTH', 'Legs', 'Beginner',
           'A member-submitted assisted single-leg squat awaiting review.',
           'Hold a stable support. Lower on one leg. Use the support only as needed to stand.'
    UNION ALL SELECT 'CM-PENDING-06', 'Hollow body hold submission', 'HEALTH', 'Core', 'Intermediate',
           'A member-submitted core exercise awaiting technique review.',
           'Press the lower back into the floor. Extend the arms and legs. Hold while breathing steadily.'
    UNION ALL SELECT 'CM-PENDING-07', 'Band face pull submission', 'HEALTH', 'Shoulders', 'Beginner',
           'A member-submitted shoulder exercise awaiting review.',
           'Pull the band toward the face. Rotate the hands back. Return slowly.'
    UNION ALL SELECT 'CM-PENDING-08', 'Tuck front lever submission', 'SKILL', 'Back', 'Advanced',
           'A member-submitted skill progression awaiting review.',
           'Brace the shoulders. Lift the knees toward the chest. Hold the body level.'
) seed
JOIN users u ON u.email = 'dashboard.beginner@calishealth.com'
WHERE NOT EXISTS (SELECT 1 FROM exercises existing WHERE existing.code = seed.code);

UPDATE member_profiles mp
JOIN users u ON u.id = mp.user_id
JOIN (
    SELECT 'dashboard.beginner@calishealth.com' AS email, 'Beginner' AS level_name
    UNION ALL SELECT 'dashboard.intermediate@calishealth.com', 'Intermediate'
    UNION ALL SELECT 'dashboard.advanced@calishealth.com', 'Advanced'
) seed ON seed.email = u.email
JOIN fitness_levels fl ON fl.name = seed.level_name
SET mp.fitness_level_id = fl.id
WHERE mp.fitness_level_id IS NULL;

-- Keep moderation demo submissions at deterministic ages for the review queue.
UPDATE exercises
SET updated_at = CASE code
    WHEN 'CM-PENDING-01' THEN CURRENT_TIMESTAMP(6) - INTERVAL 2 DAY
    WHEN 'CM-PENDING-02' THEN CURRENT_TIMESTAMP(6) - INTERVAL 7 HOUR
    WHEN 'CM-PENDING-03' THEN CURRENT_TIMESTAMP(6) - INTERVAL 3 DAY
    ELSE updated_at
END
WHERE code IN ('CM-PENDING-01', 'CM-PENDING-02', 'CM-PENDING-03', 'CM-PENDING-04', 'CM-PENDING-05', 'CM-PENDING-06', 'CM-PENDING-07', 'CM-PENDING-08')
  AND source = 'CUSTOM'
  AND active = FALSE;

-- Reviewed moderation example for the weekly summary card.
INSERT INTO exercises
    (code, name, type, category, difficulty_level, instructions, execution_steps,
     source, status, active, updated_at, created_by)
SELECT 'CM-REVIEWED-01', 'Reviewed ring row submission', 'SKILL', 'Back', 'Intermediate',
       'A reviewed community exercise for moderation history.',
       'Brace the core. Pull the rings toward the ribs. Lower with control.',
       'CUSTOM', 'ACTIVE', TRUE, CURRENT_TIMESTAMP(6), u.id
FROM users u
WHERE u.email = 'dashboard.beginner@calishealth.com'
  AND NOT EXISTS (SELECT 1 FROM exercises WHERE code = 'CM-REVIEWED-01');

-- Moderation decision history for the Content Manager approval history screen.
CREATE TABLE IF NOT EXISTS exercise_moderation_history (
    id              BIGINT        NOT NULL AUTO_INCREMENT,
    exercise_code   VARCHAR(30)   NOT NULL,
    exercise_name   VARCHAR(150)  NOT NULL,
    type            VARCHAR(40)   DEFAULT NULL,
    muscle_group    VARCHAR(500)  DEFAULT NULL,
    level           VARCHAR(40)   DEFAULT NULL,
    description     TEXT          DEFAULT NULL,
    category        VARCHAR(120)  DEFAULT NULL,
    guide           TEXT          DEFAULT NULL,
    demo_video_url  VARCHAR(1000) DEFAULT NULL,
    anatomy_image_url VARCHAR(1000) DEFAULT NULL,
    created_by_name VARCHAR(150)  DEFAULT NULL,
    decision        VARCHAR(20)   NOT NULL,
    reviewed_at     DATETIME(6)   NOT NULL,
    PRIMARY KEY (id),
    KEY idx_exercise_moderation_history_reviewed_at (reviewed_at),
    KEY idx_exercise_moderation_history_decision (decision)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO exercise_moderation_history
    (exercise_code, exercise_name, type, muscle_group, level, description, category, guide,
     demo_video_url, anatomy_image_url, created_by_name, decision, reviewed_at)
SELECT e.code, e.name, e.type,
       (SELECT GROUP_CONCAT(DISTINCT mg.name ORDER BY mg.name SEPARATOR ' · ')
        FROM exercise_muscle_groups emg JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
        WHERE emg.exercise_id = e.id),
       e.difficulty_level, e.instructions, e.category, e.execution_steps,
       e.video_url, e.anatomy_image_url, u.full_name, 'APPROVED', e.updated_at
FROM exercises e
LEFT JOIN users u ON u.id = e.created_by
WHERE e.active = TRUE
  AND UPPER(e.source) = 'CUSTOM'
  AND e.created_by IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM exercise_moderation_history h WHERE h.exercise_code = e.code
  );

-- Backfill snapshots for older history rows while their source exercise still exists.
UPDATE exercise_moderation_history h
JOIN exercises e ON e.code = h.exercise_code
LEFT JOIN users u ON u.id = e.created_by
SET h.exercise_name = e.name,
    h.type = e.type,
    h.muscle_group = COALESCE(
        (SELECT GROUP_CONCAT(DISTINCT mg.name ORDER BY mg.name SEPARATOR ' · ')
         FROM exercise_muscle_groups emg
         JOIN muscle_groups mg ON mg.id = emg.muscle_group_id
         WHERE emg.exercise_id = e.id),
        e.category
    ),
    h.level = e.difficulty_level,
    h.description = e.instructions,
    h.category = e.category,
    h.guide = e.execution_steps,
    h.demo_video_url = e.video_url,
    h.anatomy_image_url = e.anatomy_image_url,
    h.created_by_name = COALESCE(h.created_by_name, u.full_name)
WHERE h.description IS NULL
   OR h.category IS NULL
   OR h.guide IS NULL
   OR h.demo_video_url IS NULL
   OR h.anatomy_image_url IS NULL
   OR h.muscle_group IS NULL;

