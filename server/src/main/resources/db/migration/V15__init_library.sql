-- V15: Init Library & Exercise schema for CalisHealth
-- Hỗ trợ chức năng Library & Exercise cho Member và Content Manager
-- Chiến lược cuốn gói: Kế thừa V1 (users, auth_tokens), tạo các bảng phục vụ bài tập, nhóm cơ, video và kế hoạch tập.

-- ============================================================
-- 1. MUSCLE_GROUPS
-- ============================================================
CREATE TABLE IF NOT EXISTS muscle_groups (
    id   BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_muscle_groups_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. MEDIA_FILES
-- ============================================================
CREATE TABLE IF NOT EXISTS media_files (
    id               BIGINT NOT NULL AUTO_INCREMENT,
    uploader_id      BIGINT DEFAULT NULL,
    file_url         VARCHAR(255) NOT NULL,
    file_type        VARCHAR(50) DEFAULT NULL,
    format           VARCHAR(50) DEFAULT NULL,
    size_mb          DECIMAL(10,2) DEFAULT NULL,
    duration_seconds INT DEFAULT NULL,
    purpose          VARCHAR(100) DEFAULT NULL,
    status           VARCHAR(50) DEFAULT NULL,
    uploaded_at      DATETIME(6) DEFAULT NULL,
    deleted_at       DATETIME DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_media_files_url (file_url),
    KEY idx_media_files_uploader (uploader_id),
    KEY idx_media_files_status (status, uploaded_at),
    CONSTRAINT fk_media_files_uploader FOREIGN KEY (uploader_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- V3 used uploaded_by; keep existing rows and expose the Entity's uploader_id.
SET @has_media_uploader_id := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'media_files'
      AND COLUMN_NAME = 'uploader_id'
);
SET @sql := IF(@has_media_uploader_id = 0,
    'ALTER TABLE media_files ADD COLUMN uploader_id BIGINT NULL',
    'DO 0');
PREPARE add_media_uploader_id FROM @sql;
EXECUTE add_media_uploader_id;
DEALLOCATE PREPARE add_media_uploader_id;

ALTER TABLE media_files MODIFY COLUMN uploader_id BIGINT NULL;

SET @has_media_uploaded_by := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'media_files'
      AND COLUMN_NAME = 'uploaded_by'
);
SET @sql := IF(@has_media_uploaded_by > 0,
    'UPDATE media_files SET uploader_id = uploaded_by WHERE uploader_id IS NULL',
    'DO 0');
PREPARE copy_media_uploader FROM @sql;
EXECUTE copy_media_uploader;
DEALLOCATE PREPARE copy_media_uploader;

SET @has_media_uploader_index := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'media_files'
      AND INDEX_NAME = 'idx_media_files_uploader'
);
SET @sql := IF(@has_media_uploader_index = 0,
    'CREATE INDEX idx_media_files_uploader ON media_files (uploader_id)',
    'DO 0');
PREPARE add_media_uploader_index FROM @sql;
EXECUTE add_media_uploader_index;
DEALLOCATE PREPARE add_media_uploader_index;

SET @has_media_uploader_fk := (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'media_files'
      AND CONSTRAINT_NAME = 'fk_media_files_uploader'
);
SET @sql := IF(@has_media_uploader_fk = 0,
    'ALTER TABLE media_files ADD CONSTRAINT fk_media_files_uploader FOREIGN KEY (uploader_id) REFERENCES users (id)',
    'DO 0');
PREPARE add_media_uploader_fk FROM @sql;
EXECUTE add_media_uploader_fk;
DEALLOCATE PREPARE add_media_uploader_fk;

-- ============================================================
-- 3. EXERCISES (ERD Exercise Model & Member-created Exercises)
-- ============================================================
CREATE TABLE IF NOT EXISTS exercises (
    id               BIGINT NOT NULL AUTO_INCREMENT,
    name             VARCHAR(100) NOT NULL,
    code             VARCHAR(50) DEFAULT NULL,
    type             VARCHAR(20) NOT NULL DEFAULT 'EXERCISE',
    category         VARCHAR(20) NOT NULL DEFAULT 'STRENGTH',
    difficulty_level TINYINT UNSIGNED DEFAULT NULL,
    instructions     TEXT DEFAULT NULL,
    execution_steps  TEXT DEFAULT NULL,
    safety_tips      TEXT DEFAULT NULL,
    anatomy_theory   TEXT DEFAULT NULL,
    video_url        VARCHAR(255) DEFAULT NULL,
    demo_media_id    BIGINT DEFAULT NULL,
    default_sets     TINYINT UNSIGNED DEFAULT NULL,
    default_reps     SMALLINT UNSIGNED DEFAULT NULL,
    default_rest     SMALLINT UNSIGNED DEFAULT NULL,
    source           VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
    created_by       BIGINT NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_exercises_name (name),
    KEY fk_exercises_demo_media (demo_media_id),
    KEY fk_exercises_creator (created_by),
    CONSTRAINT fk_exercises_creator FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT fk_exercises_demo_media FOREIGN KEY (demo_media_id) REFERENCES media_files (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- V5 merged exercises into the canonical exercises table. Add only the
-- Library-specific attributes to that shared table.
SET @exercise_columns := (
    SELECT GROUP_CONCAT(
        CONCAT('ADD COLUMN `', required.column_name, '` ', required.column_definition)
        ORDER BY required.position SEPARATOR ', '
    )
    FROM (
        SELECT 'description' AS column_name, 'TEXT NULL' AS column_definition, 1 AS position
        UNION ALL SELECT 'muscle_group', 'VARCHAR(120) NULL', 2
        UNION ALL SELECT 'level', 'VARCHAR(30) NULL', 3
        UNION ALL SELECT 'guide', 'TEXT NULL', 4
        UNION ALL SELECT 'guide_steps', 'TEXT NULL', 5
        UNION ALL SELECT 'is_system', 'BOOLEAN NOT NULL DEFAULT TRUE', 6
        UNION ALL SELECT 'status', 'VARCHAR(20) NOT NULL DEFAULT ''ACCEPTED''', 7
        UNION ALL SELECT 'default_duration', 'INT NULL', 8
        UNION ALL SELECT 'goal', 'VARCHAR(30) NULL', 9
        UNION ALL SELECT 'target_skill', 'VARCHAR(30) NULL', 10
        UNION ALL SELECT 'icon', 'VARCHAR(255) NULL', 11
        UNION ALL SELECT 'equipment', 'VARCHAR(60) NULL', 12
        UNION ALL SELECT 'exercise_tree_id', 'BIGINT NULL', 13
        UNION ALL SELECT 'movement_group', 'VARCHAR(20) NULL', 14
        UNION ALL SELECT 'tree_level', 'INT NULL', 15
        UNION ALL SELECT 'difficulty', 'VARCHAR(20) NULL', 16
        UNION ALL SELECT 'author_id', 'BIGINT NULL', 17
        UNION ALL SELECT 'created_at', 'DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)', 18
        UNION ALL SELECT 'save_count', 'INT NOT NULL DEFAULT 0', 19
        UNION ALL SELECT 'rejection_reason', 'TEXT NULL', 20
        UNION ALL SELECT 'share_with_community', 'BOOLEAN NOT NULL DEFAULT FALSE', 21
    ) required
    LEFT JOIN information_schema.COLUMNS existing
      ON existing.TABLE_SCHEMA = DATABASE()
     AND existing.TABLE_NAME = 'exercises'
     AND existing.COLUMN_NAME = required.column_name
    WHERE existing.COLUMN_NAME IS NULL
);
SET @sql := IF(@exercise_columns IS NOT NULL,
    CONCAT('ALTER TABLE exercises ', @exercise_columns), 'DO 0');
PREPARE add_library_exercise_columns FROM @sql;
EXECUTE add_library_exercise_columns;
DEALLOCATE PREPARE add_library_exercise_columns;

-- Tables used by existing JPA entities/repositories.
CREATE TABLE IF NOT EXISTS content_scans (
    id                BIGINT NOT NULL AUTO_INCREMENT,
    scan_type         VARCHAR(60) DEFAULT NULL,
    status            VARCHAR(40) DEFAULT NULL,
    score             DECIMAL(7,3) DEFAULT NULL,
    flagged_terms     TEXT DEFAULT NULL,
    details           TEXT DEFAULT NULL,
    scanned_at        DATETIME(6) NOT NULL,
    content_review_id BIGINT NOT NULL,
    media_file_id     BIGINT DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_content_scans_media_file (media_file_id),
    CONSTRAINT fk_content_scans_media_file FOREIGN KEY (media_file_id)
        REFERENCES media_files (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exercise_variations (
    id                  BIGINT NOT NULL AUTO_INCREMENT,
    type                VARCHAR(60) DEFAULT NULL,
    exercise_id         BIGINT NOT NULL,
    variant_exercise_id BIGINT NOT NULL,
    PRIMARY KEY (id),
    KEY idx_exercise_variations_exercise (exercise_id),
    KEY idx_exercise_variations_variant (variant_exercise_id),
    CONSTRAINT fk_exercise_variations_exercise FOREIGN KEY (exercise_id)
        REFERENCES exercises (id),
    CONSTRAINT fk_exercise_variations_variant FOREIGN KEY (variant_exercise_id)
        REFERENCES exercises (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS plan_exercises (
    id               BIGINT NOT NULL AUTO_INCREMENT,
    `sequence`       INT NOT NULL,
    sets             INT NOT NULL,
    reps             INT NOT NULL,
    rest_seconds     INT NOT NULL,
    training_plan_id BIGINT NOT NULL,
    exercise_id      BIGINT NOT NULL,
    PRIMARY KEY (id),
    KEY idx_plan_exercises_training_plan (training_plan_id),
    KEY idx_plan_exercises_exercise (exercise_id),
    CONSTRAINT fk_plan_exercises_exercise FOREIGN KEY (exercise_id)
        REFERENCES exercises (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @exercise_indexes := (
    SELECT GROUP_CONCAT(statement ORDER BY position SEPARATOR ', ')
    FROM (
        SELECT 'ADD INDEX idx_exercises_system_type_status (is_system, type, status)' AS statement, 1 AS position, 'idx_exercises_system_type_status' AS index_name
        UNION ALL SELECT 'ADD INDEX idx_exercises_source_type_status (source, type, status)', 2, 'idx_exercises_source_type_status'
        UNION ALL SELECT 'ADD INDEX idx_exercises_author_source_status (created_by, source, status)', 3, 'idx_exercises_author_source_status'
        UNION ALL SELECT 'ADD INDEX idx_exercises_filters (is_system, status, type, level, goal, target_skill, id)', 4, 'idx_exercises_filters'
        UNION ALL SELECT 'ADD INDEX idx_exercises_tree (movement_group, is_system, status, tree_level)', 5, 'idx_exercises_tree'
        UNION ALL SELECT 'ADD INDEX idx_member_exercises_author_created (author_id, created_at)', 6, 'idx_member_exercises_author_created'
        UNION ALL SELECT 'ADD INDEX idx_member_exercises_community (is_system, status, created_at)', 7, 'idx_member_exercises_community'
        UNION ALL SELECT 'ADD INDEX idx_member_exercises_saves (is_system, status, save_count)', 8, 'idx_member_exercises_saves'
    ) required
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS existing
        WHERE existing.TABLE_SCHEMA = DATABASE()
          AND existing.TABLE_NAME = 'exercises'
          AND existing.INDEX_NAME = required.index_name
    )
);
SET @sql := IF(@exercise_indexes IS NOT NULL,
    CONCAT('ALTER TABLE exercises ', @exercise_indexes), 'DO 0');
PREPARE add_library_exercise_indexes FROM @sql;
EXECUTE add_library_exercise_indexes;
DEALLOCATE PREPARE add_library_exercise_indexes;

SET @has_exercise_author_fk := (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'exercises'
      AND CONSTRAINT_NAME = 'fk_exercises_author'
);
SET @sql := IF(@has_exercise_author_fk = 0,
    'ALTER TABLE exercises ADD CONSTRAINT fk_exercises_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE SET NULL',
    'DO 0');
PREPARE add_exercise_author_fk FROM @sql;
EXECUTE add_exercise_author_fk;
DEALLOCATE PREPARE add_exercise_author_fk;

-- ============================================================
-- 5. WORKOUT_ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS workout_entries (
    id          BIGINT NOT NULL AUTO_INCREMENT,
    code        VARCHAR(30) NOT NULL,
    name        VARCHAR(120) NOT NULL,
    description TEXT DEFAULT NULL,
    type        VARCHAR(40) DEFAULT 'WORKOUT',
    level       VARCHAR(30) NOT NULL,
    active      BIT(1) NOT NULL DEFAULT 1,
    source      VARCHAR(60) DEFAULT NULL,
    created_by  BIGINT DEFAULT NULL,
    updated_at  DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_workout_entries_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. WORKOUT_EXERCISES (Join Table)
-- ============================================================
CREATE TABLE IF NOT EXISTS workout_exercises (
    workout_id    BIGINT NOT NULL,
    exercise_id   BIGINT NOT NULL,
    display_order INT NOT NULL,
    PRIMARY KEY (workout_id, display_order),
    KEY fk_we_exercise (exercise_id),
    CONSTRAINT fk_we_workout FOREIGN KEY (workout_id) REFERENCES workout_entries (id) ON DELETE CASCADE,
    CONSTRAINT fk_we_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. WORKOUT_PLAN_ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS workout_plan_items (
    id                BIGINT NOT NULL AUTO_INCREMENT,
    workout_id        BIGINT NOT NULL,
    exercise_id       BIGINT NOT NULL,
    day_of_week       INT NOT NULL,
    beginner_sets     INT NOT NULL DEFAULT 3,
    beginner_reps     INT NOT NULL DEFAULT 10,
    intermediate_sets INT NOT NULL DEFAULT 3,
    intermediate_reps INT NOT NULL DEFAULT 12,
    advanced_sets     INT NOT NULL DEFAULT 4,
    advanced_reps     INT NOT NULL DEFAULT 15,
    PRIMARY KEY (id),
    KEY fk_wpi_workout (workout_id),
    KEY fk_wpi_exercise (exercise_id),
    CONSTRAINT fk_wpi_workout FOREIGN KEY (workout_id) REFERENCES workout_entries (id) ON DELETE CASCADE,
    CONSTRAINT fk_wpi_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. SEED DATA FOR LIBRARY
-- ============================================================

-- Seed Muscle Groups
INSERT IGNORE INTO muscle_groups (name, dashboard_code, icon_key, tone) VALUES
('Chest', 'chest', 'fitness', 'purple'),
('Back', 'back', 'accessibility', 'blue'),
('Legs', 'legs', 'walk', 'green'),
('Core', 'core', 'adjust', 'orange'),
('Arm/Shoulders', 'arm-shoulders', 'martial', 'pink'),
('Full body', 'full-body', 'self', 'cyan');

-- Seed System Exercises for Library (Health & Skills)
INSERT IGNORE INTO exercises (id, code, name, description, type, category, muscle_group, level, active, guide, video_url, anatomy_image_url, updated_at) VALUES
(101, 'EX-001', 'Standard Push-up', 'The standard push-up is the foundational upper-body horizontal pressing movement targeting the pectoralis major, anterior deltoids, and triceps.', 'HEALTH', 'Strength', 'Chest', 'BEGINNER', 1, 'Keep elbows at a 45-degree angle, maintain a straight rigid line from shoulders to heels, engage the core and depress scapulae.', NULL, NULL, NOW(6)),
(102, 'EX-002', 'Diamond Push-up', 'Narrow grip variation heavily emphasizing the triceps lateral and medial heads as well as inner pectoral activation.', 'HEALTH', 'Strength', 'Chest', 'INTERMEDIATE', 1, 'Form a triangle/diamond with index fingers and thumbs directly under the sternum.', NULL, NULL, NOW(6)),
(103, 'EX-003', 'Decline Push-up', 'Elevated feet push-up increasing angle to shift load specifically onto the clavicular head (upper chest) and shoulders.', 'HEALTH', 'Strength', 'Chest', 'INTERMEDIATE', 1, 'Place feet onto an elevated surface or bench while maintaining strict neutral spinal posture.', NULL, NULL, NOW(6)),
(104, 'EX-004', 'Wide Grip Push-up', 'Broad hand placement isolating the pectoralis major with increased horizontal adduction stretch.', 'HEALTH', 'Hypertrophy', 'Chest', 'BEGINNER', 1, 'Place hands 1.5x shoulder width apart without letting lower back sag.', NULL, NULL, NOW(6)),
(105, 'EX-005', 'Dips', 'Compound vertical pressing movement working lower chest, anterior deltoid, and triceps.', 'HEALTH', 'Strength', 'Chest', 'INTERMEDIATE', 1, 'Lean torso slightly forward to focus on chest; lower until elbows reach 90 degrees.', NULL, NULL, NOW(6)),
(106, 'EX-006', 'Incline Push-up', 'Hands elevated on bench reducing bodyweight percentage for high repetition endurance and beginner mastery.', 'HEALTH', 'Endurance', 'Chest', 'BEGINNER', 1, 'Hands on stable surface; focus on full protraction at the top of the repetition.', NULL, NULL, NOW(6)),
(107, 'EX-007', 'Pull-up', 'The king of bodyweight vertical pulling movements targeting the latissimus dorsi, teres major, and biceps.', 'HEALTH', 'Strength', 'Back', 'INTERMEDIATE', 1, 'Dead hang grip slightly wider than shoulders, pull chin clear over the bar while keeping core tight.', NULL, NULL, NOW(6)),
(108, 'EX-008', 'Australian Pull-up', 'Horizontal row on a low bar, building scapular retraction and foundational back thickness.', 'HEALTH', 'Strength', 'Back', 'BEGINNER', 1, 'Hold bar with overhand grip, heels on the floor, pull chest to touch the bar.', NULL, NULL, NOW(6)),
(109, 'EX-009', 'Chin-up', 'Supinated grip pull-up focusing on biceps brachii and lower lat engagement.', 'HEALTH', 'Strength', 'Back', 'INTERMEDIATE', 1, 'Palms facing you, pull up until chin passes the bar without swinging or kipping.', NULL, NULL, NOW(6)),
(110, 'EX-010', 'Bodyweight Squat', 'Primary lower-body movement for developing knee flexion, quad endurance, and glute activation.', 'HEALTH', 'Strength', 'Legs', 'BEGINNER', 1, 'Feet shoulder-width, break at the hips and knees simultaneously, descend until thighs are parallel to ground.', NULL, NULL, NOW(6)),
(111, 'EX-011', 'Bulgarian Split Squat', 'Unilateral leg exercise strengthening quads, glutes, and fixing leg strength imbalances.', 'HEALTH', 'Strength', 'Legs', 'INTERMEDIATE', 1, 'Rear foot elevated on a bench, descend vertically until rear knee nearly touches floor.', NULL, NULL, NOW(6)),
(112, 'EX-012', 'Walking Lunges', 'Great lower body cardio and stabilizer builder for hip flexors, quads, and hamstrings.', 'HEALTH', 'Endurance', 'Legs', 'BEGINNER', 1, 'Step forward under control, maintain upright chest, drive through the front heel.', NULL, NULL, NOW(6)),
(113, 'EX-013', 'Plank', 'Isometric core exercise holding rigid hollow body alignment to protect the lower spine.', 'HEALTH', 'Stability', 'Core', 'BEGINNER', 1, 'Forearms on the ground, squeeze glutes and thighs, pull belly button towards spine.', NULL, NULL, NOW(6)),
(114, 'EX-014', 'Hanging Knee Raise', 'Bar-hanging abdominal drill targeting the lower rectus abdominis and hip flexors.', 'HEALTH', 'Strength', 'Core', 'INTERMEDIATE', 1, 'Hang from pull-up bar, raise knees towards chest without relying on body momentum.', NULL, NULL, NOW(6)),
(115, 'EX-015', 'Hollow Body Hold', 'Gymnastic staple holding posterior pelvic tilt to solidify bodyweight stability.', 'HEALTH', 'Stability', 'Core', 'INTERMEDIATE', 1, 'Lie on back, press lumbar spine flat against the ground, raise legs and shoulders slightly.', NULL, NULL, NOW(6)),
(116, 'EX-016', 'Pike Push-up', 'Vertical pushing angle transitioning chest drive directly into the anterior deltoids.', 'HEALTH', 'Strength', 'Arm/Shoulders', 'INTERMEDIATE', 1, 'Elevate hips into inverted V-shape, lower head diagonally forward towards the hands.', NULL, NULL, NOW(6)),
(117, 'EX-017', 'Parallel Bar Dips', 'High-load bodyweight dip targeting lateral triceps and lower chest fibers.', 'HEALTH', 'Strength', 'Arm/Shoulders', 'INTERMEDIATE', 1, 'Support yourself on parallel bars, lower torso under control, lock out elbows at peak.', NULL, NULL, NOW(6)),
(118, 'EX-018', 'Bench Dips', 'Accessible tricep flexion drill for building pushing lock-out strength.', 'HEALTH', 'Strength', 'Arm/Shoulders', 'BEGINNER', 1, 'Hands on bench edge behind you, legs extended, lower hips towards floor and push up.', NULL, NULL, NOW(6)),

-- Skill Exercises (Chuẩn 100% theo Mockup Figma)
(201, 'SK-001', 'Wall handstand hold', 'Balance drill on hands demanding wrist mobility, shoulder flexion, and overhead stability.', 'SKILL', 'Skill', 'Shoulders', 'BEGINNER', 1, 'Kick up against wall or freestanding, push actively through the shoulders.', NULL, NULL, NOW(6)),
(202, 'SK-002', 'Handstand push-up', 'Elite vertical pressing calisthenic skill lifting 100% of body mass overhead.', 'SKILL', 'Skill', 'Shoulders', 'ADVANCED', 1, 'From handstand against wall or freestanding, lower head to touch floor, press upward forcefully.', NULL, NULL, NOW(6)),
(203, 'SK-003', 'Explosive pull-up', 'Explosive transition building power for muscle-up transitions.', 'SKILL', 'Skill', 'Back', 'INTERMEDIATE', 1, 'Pull explosively to chest level, lean chest over bar.', NULL, NULL, NOW(6)),
(204, 'SK-004', 'Straight bar dip', 'Bar dip drill developing pressing strength above the bar for the final phase of a muscle-up.', 'SKILL', 'Skill', 'Chest', 'INTERMEDIATE', 1, 'Lower torso under control, lock out elbows over straight bar.', NULL, NULL, NOW(6)),
(205, 'SK-005', 'Tuck front lever', 'Horizontal straight-arm isometric pull engaging extreme latissimus activation.', 'SKILL', 'Skill', 'Back', 'INTERMEDIATE', 1, 'Hold bar with arms straight, pull body horizontal while keeping knees tucked into chest.', NULL, NULL, NOW(6)),
(206, 'SK-006', 'Advanced tuck front lever', 'Progressive straight-arm static hold extending knees further from the chest.', 'SKILL', 'Skill', 'Back', 'ADVANCED', 1, 'Straight arms, open hip angle extending knees away from torso.', NULL, NULL, NOW(6));

-- ============================================================
-- LIBRARY OVERVIEW AND SYSTEM EXERCISE FILTERS
-- ============================================================
SET @workout_columns := (
    SELECT GROUP_CONCAT(
        CONCAT('ADD COLUMN `', required.column_name, '` ', required.column_definition)
        ORDER BY required.position SEPARATOR ', '
    )
    FROM (
        SELECT 'is_system' AS column_name, 'BOOLEAN NOT NULL DEFAULT TRUE' AS column_definition, 1 AS position
        UNION ALL SELECT 'author_id', 'BIGINT NULL', 2
        UNION ALL SELECT 'is_shared_with_community', 'BOOLEAN NOT NULL DEFAULT FALSE', 3
        UNION ALL SELECT 'status', 'VARCHAR(20) NOT NULL DEFAULT ''ACCEPTED''', 4
        UNION ALL SELECT 'save_count', 'INT NOT NULL DEFAULT 0', 5
        UNION ALL SELECT 'total_sets', 'INT NOT NULL DEFAULT 0', 6
        UNION ALL SELECT 'estimated_duration', 'INT NOT NULL DEFAULT 0', 7
        UNION ALL SELECT 'created_at', 'DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)', 8
        UNION ALL SELECT 'created_by', 'BIGINT NULL', 9
        UNION ALL SELECT 'source', 'VARCHAR(60) NULL', 10
    ) required
    LEFT JOIN information_schema.COLUMNS existing
      ON existing.TABLE_SCHEMA = DATABASE()
     AND existing.TABLE_NAME = 'workout_entries'
     AND existing.COLUMN_NAME = required.column_name
    WHERE existing.COLUMN_NAME IS NULL
);
SET @sql := IF(@workout_columns IS NOT NULL,
    CONCAT('ALTER TABLE workout_entries ', @workout_columns), 'DO 0');
PREPARE add_library_workout_columns FROM @sql;
EXECUTE add_library_workout_columns;
DEALLOCATE PREPARE add_library_workout_columns;

-- Seed sample workouts after adding their compatibility columns.
INSERT IGNORE INTO workout_entries (
    code, name, description, type, level, active, created_by, updated_at, source,
    is_system, author_id, is_shared_with_community, status, save_count,
    total_sets, estimated_duration, created_at
)
VALUES
('WO-001', 'Upper Body Calisthenics Mastery', 'Intense upper body hypertrophy and strength routine targeting chest, back, and shoulders.', 'HEALTH', 'INTERMEDIATE', TRUE, NULL, NOW(6), 'SYSTEM', TRUE, NULL, FALSE, 'ACCEPTED', 0, 9, 25, NOW(6)),
('WO-002', 'Foundation Core & Balance', 'Strengthen your core foundation and develop baseline isometric endurance.', 'SKILL', 'BEGINNER', TRUE, NULL, NOW(6), 'SYSTEM', TRUE, NULL, FALSE, 'ACCEPTED', 0, 6, 20, NOW(6));

INSERT IGNORE INTO workout_entries (
    code, name, description, type, level, active, created_by, updated_at, source,
    is_system, author_id, is_shared_with_community, status, save_count,
    total_sets, estimated_duration, created_at
)
VALUES
('WO-003', 'Full Body Health Maintenance', 'A balanced full-body routine for strength, mobility, and everyday wellness.', 'HEALTH', 'BEGINNER', TRUE, NULL, NOW(6), 'SYSTEM', TRUE, NULL, FALSE, 'ACCEPTED', 0, 9, 20, NOW(6)),
('WO-004', 'Core & Posture Booster', 'Build core stability and reinforce healthy posture with controlled movements.', 'HEALTH', 'INTERMEDIATE', TRUE, NULL, NOW(6), 'SYSTEM', TRUE, NULL, FALSE, 'ACCEPTED', 0, 9, 18, NOW(6)),
('WO-005', 'Push-up Skill Progression', 'Progress from foundational push-ups to stronger controlled variations.', 'SKILL', 'BEGINNER', TRUE, NULL, NOW(6), 'SYSTEM', TRUE, NULL, FALSE, 'ACCEPTED', 0, 9, 20, NOW(6)),
('WO-006', 'Front Lever Foundations', 'Develop straight-arm pulling strength and bodyline control for front lever work.', 'SKILL', 'INTERMEDIATE', TRUE, NULL, NOW(6), 'SYSTEM', TRUE, NULL, FALSE, 'ACCEPTED', 0, 9, 25, NOW(6));

SET @workout_exercise_columns := (
    SELECT GROUP_CONCAT(
        CONCAT('ADD COLUMN `', required.column_name, '` ', required.column_definition)
        ORDER BY required.position SEPARATOR ', '
    )
    FROM (
        SELECT 'id' AS column_name, 'BIGINT NOT NULL AUTO_INCREMENT UNIQUE' AS column_definition, 1 AS position
        UNION ALL SELECT 'order_index', 'INT NOT NULL DEFAULT 0', 2
        UNION ALL SELECT 'sets', 'INT NOT NULL DEFAULT 3', 3
        UNION ALL SELECT 'reps', 'INT NULL', 4
        UNION ALL SELECT 'duration', 'INT NULL', 5
        UNION ALL SELECT 'count_by', 'VARCHAR(20) NOT NULL DEFAULT ''REPS''', 6
        UNION ALL SELECT 'rest_seconds', 'INT NOT NULL DEFAULT 60', 7
    ) required
    LEFT JOIN information_schema.COLUMNS existing
      ON existing.TABLE_SCHEMA = DATABASE()
     AND existing.TABLE_NAME = 'workout_exercises'
     AND existing.COLUMN_NAME = required.column_name
    WHERE existing.COLUMN_NAME IS NULL
);
SET @sql := IF(@workout_exercise_columns IS NOT NULL,
    CONCAT('ALTER TABLE workout_exercises ', @workout_exercise_columns), 'DO 0');
PREPARE add_workout_exercise_columns FROM @sql;
EXECUTE add_workout_exercise_columns;
DEALLOCATE PREPARE add_workout_exercise_columns;

UPDATE workout_exercises
SET order_index = display_order;

UPDATE exercises
SET status = 'ACCEPTED'
WHERE status = 'ACTIVE';

SET @has_workout_author_fk := (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'workout_entries'
      AND CONSTRAINT_NAME = 'fk_workout_entries_author'
);
SET @sql := IF(@has_workout_author_fk = 0,
    'ALTER TABLE workout_entries ADD CONSTRAINT fk_workout_entries_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE SET NULL',
    'DO 0');
PREPARE add_workout_author_fk FROM @sql;
EXECUTE add_workout_author_fk;
DEALLOCATE PREPARE add_workout_author_fk;

SET @workout_indexes := (
    SELECT GROUP_CONCAT(statement ORDER BY position SEPARATOR ', ')
    FROM (
        SELECT 'ADD INDEX idx_workout_entries_system_type (is_system, type)' AS statement, 1 AS position, 'idx_workout_entries_system_type' AS index_name
        UNION ALL SELECT 'ADD INDEX idx_workout_entries_author_system_type (author_id, is_system, type)', 2, 'idx_workout_entries_author_system_type'
        UNION ALL SELECT 'ADD INDEX idx_workout_entries_created_by_active (created_by, active)', 3, 'idx_workout_entries_created_by_active'
        UNION ALL SELECT 'ADD INDEX idx_workouts_community (is_system, is_shared_with_community, status, created_at)', 4, 'idx_workouts_community'
        UNION ALL SELECT 'ADD INDEX idx_workouts_author (author_id, is_system, created_at)', 5, 'idx_workouts_author'
    ) required
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.STATISTICS existing
        WHERE existing.TABLE_SCHEMA = DATABASE()
          AND existing.TABLE_NAME = 'workout_entries'
          AND existing.INDEX_NAME = required.index_name
    )
);
SET @sql := IF(@workout_indexes IS NOT NULL,
    CONCAT('ALTER TABLE workout_entries ', @workout_indexes), 'DO 0');
PREPARE add_workout_indexes FROM @sql;
EXECUTE add_workout_indexes;
DEALLOCATE PREPARE add_workout_indexes;

SET @has_workout_exercise_order_index := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'workout_exercises'
      AND INDEX_NAME = 'idx_workout_exercises_order'
);
SET @sql := IF(@has_workout_exercise_order_index = 0,
    'CREATE INDEX idx_workout_exercises_order ON workout_exercises (workout_id, order_index)',
    'DO 0');
PREPARE add_workout_exercise_order_index FROM @sql;
EXECUTE add_workout_exercise_order_index;
DEALLOCATE PREPARE add_workout_exercise_order_index;

UPDATE exercises
SET target_skill = CASE
        WHEN LOWER(name) LIKE '%handstand%' THEN 'HANDSTAND'
        WHEN LOWER(name) LIKE '%muscle-up%' OR LOWER(description) LIKE '%muscle-up%' THEN 'MUSCLE_UP'
        WHEN LOWER(name) LIKE '%front lever%' THEN 'FRONT_LEVER'
        WHEN LOWER(name) LIKE '%planche%' THEN 'PLANCHE'
        ELSE target_skill
    END,
    goal = CASE
        WHEN type = 'HEALTH' AND UPPER(category) IN ('CARDIO', 'ENDURANCE') THEN 'LOSE_WEIGHT'
        WHEN type = 'HEALTH' AND UPPER(category) IN ('STRENGTH', 'HYPERTROPHY') THEN 'BUILD_MUSCLE'
        WHEN type = 'HEALTH' THEN 'STAY_FIT'
        ELSE goal
    END,
    icon = CASE
        WHEN type = 'SKILL' THEN 'skill'
        ELSE 'health'
    END;

UPDATE exercises
SET level = UPPER(level);

UPDATE exercises
SET default_sets = COALESCE(default_sets, 3),
    default_duration = CASE
        WHEN LOWER(name) LIKE '%hold%' OR LOWER(name) LIKE '%lever%' THEN COALESCE(default_duration, 30)
        ELSE default_duration
    END,
    default_reps = CASE
        WHEN LOWER(name) LIKE '%hold%' OR LOWER(name) LIKE '%lever%' THEN default_reps
        ELSE COALESCE(default_reps, 12)
    END,
    equipment = CASE
        WHEN LOWER(name) LIKE '%dip%' THEN 'Parallel bars'
        WHEN LOWER(muscle_group) LIKE '%back%' THEN 'Pull-up bar'
        ELSE 'Bodyweight'
    END;

CREATE TABLE IF NOT EXISTS exercise_tree_edges (
    id BIGINT NOT NULL AUTO_INCREMENT,
    parent_exercise_id BIGINT NOT NULL,
    child_exercise_id BIGINT NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_exercise_tree_edge (parent_exercise_id, child_exercise_id),
    KEY idx_exercise_tree_child (child_exercise_id),
    CONSTRAINT fk_exercise_tree_parent FOREIGN KEY (parent_exercise_id)
        REFERENCES exercises (id) ON DELETE CASCADE,
    CONSTRAINT fk_exercise_tree_child FOREIGN KEY (child_exercise_id)
        REFERENCES exercises (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS member_exercise_progress (
    id BIGINT NOT NULL AUTO_INCREMENT,
    member_id BIGINT NOT NULL,
    exercise_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_member_exercise_progress (member_id, exercise_id),
    KEY idx_member_progress_exercise (exercise_id),
    CONSTRAINT fk_member_progress_member FOREIGN KEY (member_id)
        REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_member_progress_exercise FOREIGN KEY (exercise_id)
        REFERENCES exercises (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE exercises
SET movement_group = CASE
        WHEN id IN (101, 102, 103, 104, 105, 106, 116, 117, 118, 201, 202, 204) THEN 'PUSH'
        WHEN id IN (107, 108, 109, 203, 205, 206) THEN 'PULL'
        WHEN id IN (110, 111, 112) THEN 'LEGS'
        WHEN id IN (113, 114, 115) THEN 'CORE'
        ELSE movement_group
    END,
    tree_level = CASE id
        WHEN 106 THEN 1
        WHEN 101 THEN 2
        WHEN 102 THEN 3
        WHEN 103 THEN 3
        WHEN 104 THEN 3
        WHEN 116 THEN 3
        WHEN 105 THEN 4
        WHEN 117 THEN 4
        WHEN 118 THEN 1
        WHEN 201 THEN 4
        WHEN 204 THEN 4
        WHEN 202 THEN 5
        WHEN 108 THEN 1
        WHEN 107 THEN 2
        WHEN 109 THEN 2
        WHEN 203 THEN 4
        WHEN 205 THEN 3
        WHEN 206 THEN 4
        WHEN 110 THEN 2
        WHEN 112 THEN 2
        WHEN 111 THEN 3
        WHEN 113 THEN 3
        WHEN 115 THEN 2
        WHEN 114 THEN 3
        ELSE tree_level
    END,
    difficulty = CASE
        WHEN id IN (106, 108, 110, 113, 118) THEN 'BEGINNER'
        WHEN id IN (101, 104, 109, 112, 115, 116, 204) THEN 'INTERMEDIATE'
        WHEN id IN (102, 103, 105, 107, 111, 114, 117, 201, 203, 206) THEN 'ADVANCED'
        WHEN id = 202 THEN 'EXPERT'
        WHEN id IN (205) THEN 'INTERMEDIATE'
        ELSE difficulty
    END,
    exercise_tree_id = CASE
        WHEN id IN (101, 102, 103, 104, 105, 106, 116, 117, 118, 201, 202, 204,
                    107, 108, 109, 203, 205, 206, 110, 111, 112, 113, 114, 115)
            THEN id
        ELSE exercise_tree_id
    END
WHERE id BETWEEN 101 AND 206;

INSERT IGNORE INTO exercise_tree_edges (parent_exercise_id, child_exercise_id) VALUES
(106, 101),
(101, 102),
(101, 103),
(101, 104),
(101, 116),
(116, 201),
(201, 202),
(101, 105),
(118, 105),
(105, 117),
(105, 204),
(108, 107),
(108, 109),
(107, 203),
(107, 205),
(205, 206),
(110, 112),
(112, 111),
(113, 115),
(115, 114);

UPDATE exercises
SET guide = CASE id
    WHEN 101 THEN CONCAT('Start in a high plank with hands under shoulders.', CHAR(10), 'Brace your core and keep your head, hips, and heels aligned.', CHAR(10), 'Lower your chest with elbows angled about 45 degrees from your body.', CHAR(10), 'Press the floor away until your arms straighten without locking hard.')
    WHEN 102 THEN CONCAT('Begin in a high plank and place thumbs and index fingers close together under your chest.', CHAR(10), 'Keep your body in one straight line and brace your abdomen.', CHAR(10), 'Bend your elbows close to your ribs and lower under control.', CHAR(10), 'Press through both hands to return to the top position.')
    WHEN 103 THEN CONCAT('Place your feet on a stable low bench and hands on the floor slightly wider than shoulders.', CHAR(10), 'Brace your trunk and keep a straight line from shoulders to heels.', CHAR(10), 'Lower your chest toward the floor while keeping elbows controlled.', CHAR(10), 'Push through your palms to return to the start.')
    WHEN 104 THEN CONCAT('Set your hands wider than shoulder width with fingers pointing forward.', CHAR(10), 'Extend your legs and brace your core to prevent your hips from sagging.', CHAR(10), 'Lower your chest between your hands with a steady tempo.', CHAR(10), 'Press evenly through both palms to straighten your arms.')
    WHEN 105 THEN CONCAT('Grip parallel bars and support your body with elbows extended.', CHAR(10), 'Lean slightly forward and keep shoulders down away from your ears.', CHAR(10), 'Bend your elbows and lower until you feel a comfortable chest stretch.', CHAR(10), 'Drive through the bars to return to the supported position.')
    WHEN 106 THEN CONCAT('Place your hands on a stable elevated surface at shoulder width.', CHAR(10), 'Walk your feet back until your body forms a straight incline.', CHAR(10), 'Lower your chest toward the edge while keeping elbows controlled.', CHAR(10), 'Push the surface away and finish with your arms extended.')
    WHEN 107 THEN CONCAT('Hang from a secure bar with hands just outside shoulder width.', CHAR(10), 'Brace your core and draw your shoulder blades down.', CHAR(10), 'Pull your elbows toward your ribs until your chin clears the bar.', CHAR(10), 'Lower smoothly to a full hang without swinging.')
    WHEN 108 THEN CONCAT('Position yourself under a low bar and hold it with an overhand grip.', CHAR(10), 'Straighten your legs and keep your body aligned from head to heels.', CHAR(10), 'Pull your chest toward the bar by drawing your shoulder blades together.', CHAR(10), 'Lower under control until your arms are straight.')
    WHEN 109 THEN CONCAT('Hang from the bar with palms facing toward you at about shoulder width.', CHAR(10), 'Brace your abdomen and keep your legs still.', CHAR(10), 'Pull until your chin reaches above the bar without shrugging.', CHAR(10), 'Lower slowly to the starting hang.')
    WHEN 110 THEN CONCAT('Stand with feet about shoulder width and toes turned slightly outward.', CHAR(10), 'Brace your abdomen and begin sitting your hips back.', CHAR(10), 'Bend your knees and lower while keeping your heels grounded.', CHAR(10), 'Drive through the whole foot to stand tall again.')
    WHEN 111 THEN CONCAT('Stand a stride in front of a stable bench and place one foot behind you on it.', CHAR(10), 'Set your stance so the front foot remains flat and stable.', CHAR(10), 'Lower your hips under control until the front thigh approaches parallel.', CHAR(10), 'Push through the front foot to return to standing.')
    WHEN 112 THEN CONCAT('Stand tall with feet hip-width apart and brace your trunk.', CHAR(10), 'Step forward far enough to keep the front heel planted.', CHAR(10), 'Lower until both knees bend comfortably without the rear knee striking the floor.', CHAR(10), 'Push through the front foot and step through into the next repetition.')
    WHEN 113 THEN CONCAT('Place your forearms on the floor with elbows below your shoulders.', CHAR(10), 'Extend your legs and balance on your toes.', CHAR(10), 'Squeeze your glutes and brace your abdomen to keep a straight body line.', CHAR(10), 'Breathe steadily and end the hold before your hips sag.')
    WHEN 114 THEN CONCAT('Hang from a secure bar with shoulders active and legs together.', CHAR(10), 'Brace your abdomen and avoid swinging your body.', CHAR(10), 'Lift your knees toward your chest by curling your pelvis upward.', CHAR(10), 'Lower your legs slowly to the starting position.')
    WHEN 115 THEN CONCAT('Lie on your back and gently press your lower back into the floor.', CHAR(10), 'Lift your shoulders and legs slightly while keeping your knees softly bent.', CHAR(10), 'Reach your arms forward and brace your abdomen to hold the hollow shape.', CHAR(10), 'Keep breathing, then lower with control when your back begins to arch.')
    WHEN 116 THEN CONCAT('Start in a pike position with hands on the floor and hips raised.', CHAR(10), 'Set hands slightly wider than shoulders and keep your neck neutral.', CHAR(10), 'Bend your elbows and lower the crown of your head toward the floor.', CHAR(10), 'Press through your palms to return to the pike position.')
    WHEN 117 THEN CONCAT('Support yourself on parallel bars with elbows straight and shoulders stable.', CHAR(10), 'Keep your torso upright and legs together.', CHAR(10), 'Bend your elbows and lower only through a comfortable range.', CHAR(10), 'Press down on the bars until your arms are extended again.')
    WHEN 118 THEN CONCAT('Sit on a stable bench and place your hands beside your hips.', CHAR(10), 'Move your hips just in front of the bench and keep shoulders relaxed.', CHAR(10), 'Bend your elbows to lower your body a comfortable distance.', CHAR(10), 'Press through your palms to return to the top.')
    WHEN 201 THEN CONCAT('Place your hands shoulder-width apart a short distance from a clear wall.', CHAR(10), 'Spread your fingers and press firmly through the whole hand.', CHAR(10), 'Kick one leg upward and bring the second leg to the wall with control.', CHAR(10), 'Push tall through your shoulders, brace your core, and hold while breathing.')
    WHEN 202 THEN CONCAT('Kick into a stable wall handstand with hands slightly wider than shoulders.', CHAR(10), 'Brace your core and keep your body aligned against the wall.', CHAR(10), 'Bend your elbows and lower your head toward a pad between your hands.', CHAR(10), 'Press strongly through your palms to return to the handstand.')
    WHEN 203 THEN CONCAT('Hang from a secure bar with an overhand grip and active shoulders.', CHAR(10), 'Brace your core and build a small controlled hollow position.', CHAR(10), 'Pull explosively while driving your elbows down and back.', CHAR(10), 'Lower under control and reset without uncontrolled swinging.')
    WHEN 204 THEN CONCAT('Grip a stable straight bar and support yourself above it.', CHAR(10), 'Lean your chest slightly forward while keeping wrists secure.', CHAR(10), 'Bend your elbows and lower your chest toward the bar.', CHAR(10), 'Press down through the bar until you regain straight-arm support.')
    WHEN 205 THEN CONCAT('Hang from a secure bar with arms straight and shoulders engaged.', CHAR(10), 'Tuck your knees toward your chest and brace your trunk.', CHAR(10), 'Pull the bar toward your hips while lifting your body toward horizontal.', CHAR(10), 'Hold the tucked position briefly, then lower with control.')
    WHEN 206 THEN CONCAT('Take an overhand grip on a secure bar and engage your shoulders.', CHAR(10), 'Raise your body into a tucked front lever position.', CHAR(10), 'Open your hips and extend your knees slightly while keeping arms straight.', CHAR(10), 'Hold a strong horizontal line briefly, then return to the tuck.')
    ELSE guide
END
WHERE id BETWEEN 101 AND 206;

CREATE TABLE IF NOT EXISTS member_saved_exercises (
    id BIGINT NOT NULL AUTO_INCREMENT,
    member_id BIGINT NOT NULL,
    exercise_id BIGINT NOT NULL,
    saved_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_member_saved_exercise (member_id, exercise_id),
    KEY idx_member_saved_exercise (exercise_id),
    CONSTRAINT fk_saved_exercise_member FOREIGN KEY (member_id)
        REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_saved_exercise_entry FOREIGN KEY (exercise_id)
        REFERENCES exercises (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Local development only: never deploy the shared demo credential to a production database.
-- Create the demo account if that email is not already present.
INSERT INTO users (email, password, full_name, role, enabled, created_at)
SELECT 'demo@calishealth.com',
       '$2a$10$P3bf6Kza8/UJGv0fKTCgye6IO77E95sO2QY0uvIWfPv88fJu0Cqxe',
       'CalisHealth Demo', 'MEMBER', TRUE, NOW(6)
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'demo@calishealth.com'
);

-- Complete the progression data using the normalized exercise_tree_edges table.
-- That table supports branching paths without duplicating parent links on exercises.
INSERT IGNORE INTO exercises (
    code, name, description, type, category, muscle_group, level, active, guide,
    updated_at, is_system, status, default_sets, default_reps, default_duration,
    share_with_community, equipment, created_at, save_count, created_by, source,
    movement_group, tree_level, difficulty
)
SELECT seed.code, seed.name, seed.description, seed.type, 'Strength', seed.muscle_group,
       seed.level, 1, seed.guide, NOW(6), TRUE, 'ACCEPTED', 3, seed.default_reps,
       seed.default_duration, FALSE, seed.equipment, NOW(6), 0, u.id, 'SYSTEM',
       seed.movement_group, seed.tree_level, seed.difficulty
FROM (
    SELECT 'TREE-PULL-001' AS code, 'Dead Hang' AS name,
           'An active hanging foundation for calisthenics pulling skills.' AS description,
           'HEALTH' AS type, 'Back, shoulders, forearms' AS muscle_group,
           'BEGINNER' AS level, 'Hang from a secure bar, keep shoulders active, and breathe steadily.' AS guide,
           0 AS default_reps, 20 AS default_duration, 'Pull-up bar' AS equipment,
           'PULL' AS movement_group, 2 AS tree_level, 'BEGINNER' AS difficulty
    UNION ALL SELECT 'TREE-PULL-002', 'L-sit Pull-up',
           'A strict pull-up performed while holding the legs in an L-sit.',
           'SKILL', 'Back, biceps, core', 'ADVANCED',
           'Hold an L-sit and pull your chest toward the bar without swinging.',
           NULL, NULL, 'Pull-up bar', 'PULL', 4, 'ADVANCED'
    UNION ALL SELECT 'TREE-PULL-003', 'Muscle-up',
           'A pull and transition over the bar into straight-arm support.',
           'SKILL', 'Back, chest, triceps', 'ADVANCED',
           'Pull explosively, transition your chest over the bar, and press to support.',
           NULL, NULL, 'Pull-up bar', 'PULL', 5, 'EXPERT'
    UNION ALL SELECT 'TREE-CORE-001', 'Knee Tucks',
           'A beginner core movement that builds controlled abdominal flexion.',
           'HEALTH', 'Core, hip flexors', 'BEGINNER',
           'Brace your abdomen and draw your knees toward your chest with control.',
           12, NULL, 'Bodyweight', 'CORE', 1, 'BEGINNER'
    UNION ALL SELECT 'TREE-CORE-002', 'Lying Leg Raises',
           'A controlled floor exercise for progressive lower-abdominal strength.',
           'HEALTH', 'Core, hip flexors', 'INTERMEDIATE',
           'Keep your lower back supported as you raise and lower straight legs.',
           10, NULL, 'Bodyweight', 'CORE', 2, 'INTERMEDIATE'
    UNION ALL SELECT 'TREE-CORE-003', 'Hanging Leg Raises',
           'A hanging core progression raising straight legs without momentum.',
           'HEALTH', 'Core, hip flexors', 'ADVANCED',
           'Hang with active shoulders, brace, and raise straight legs under control.',
           8, NULL, 'Pull-up bar', 'CORE', 3, 'ADVANCED'
    UNION ALL SELECT 'TREE-CORE-004', 'L-sit',
           'An isometric support skill with both legs extended in front of the body.',
           'SKILL', 'Core, shoulders, hip flexors', 'ADVANCED',
           'Press down through stable supports and hold both legs straight and elevated.',
           NULL, 10, 'Parallel bars', 'CORE', 4, 'ADVANCED'
    UNION ALL SELECT 'TREE-CORE-005', 'Dragon Flag',
           'An advanced full-body lever requiring exceptional core control.',
           'SKILL', 'Core, lats, glutes', 'ADVANCED',
           'Anchor your shoulders, keep a straight body line, and lower slowly.',
           NULL, NULL, 'Bench', 'CORE', 5, 'EXPERT'
    UNION ALL SELECT 'TREE-LEGS-001', 'Assisted Squat',
           'A supported squat variation for learning balanced lower-body movement.',
           'HEALTH', 'Quadriceps, glutes', 'BEGINNER',
           'Hold a stable support and squat to a comfortable depth with heels grounded.',
           12, NULL, 'Stable support', 'LEGS', 1, 'BEGINNER'
    UNION ALL SELECT 'TREE-LEGS-002', 'Archer Squat',
           'A unilateral squat progression shifting most of the load to one leg.',
           'SKILL', 'Quadriceps, glutes', 'ADVANCED',
           'Shift toward one bent leg while keeping the opposite leg extended.',
           NULL, NULL, 'Bodyweight', 'LEGS', 4, 'ADVANCED'
    UNION ALL SELECT 'TREE-LEGS-003', 'Pistol Squat',
           'A single-leg squat performed with the non-working leg extended forward.',
           'SKILL', 'Quadriceps, glutes', 'ADVANCED',
           'Balance on one foot, extend the other leg forward, and squat under control.',
           NULL, NULL, 'Bodyweight', 'LEGS', 5, 'EXPERT'
) seed
JOIN users u ON u.email = 'demo@calishealth.com';

INSERT IGNORE INTO exercises (
    code, name, description, type, category, muscle_group, level, active, guide,
    updated_at, is_system, status, default_sets, default_reps, default_duration,
    share_with_community, equipment, created_at, save_count, created_by, source,
    movement_group, tree_level, difficulty
)
SELECT seed.code, seed.name, seed.description, 'SKILL', 'Strength', seed.muscle_group,
       seed.level, TRUE, seed.guide, NOW(6), TRUE, 'ACCEPTED', 3, 8, NULL,
       FALSE, seed.equipment, NOW(6), 0, u.id, 'SYSTEM',
       seed.movement_group, seed.tree_level, seed.difficulty
FROM (
    SELECT 'TREE-PUSH-001' AS code, 'Pseudo Planche Push-up' AS name,
           'A forward-leaning push-up variation that develops advanced shoulder and chest strength.' AS description,
           'Chest, shoulders, triceps' AS muscle_group, 'ADVANCED' AS level,
           'Lean forward in a strong plank, lower under control, and press back while keeping the shoulders engaged.' AS guide,
           'Bodyweight' AS equipment, 'PUSH' AS movement_group, 4 AS tree_level,
           'ADVANCED' AS difficulty
    UNION ALL SELECT 'TREE-PULL-004', 'Ring Row',
           'A horizontal pulling exercise using stable gymnastic rings to build foundational back strength.',
           'Back, biceps, forearms', 'BEGINNER',
           'Keep your body straight, pull your chest between the rings, then lower with control.',
           'Gymnastic rings', 'PULL', 1, 'BEGINNER'
) seed
JOIN users u ON u.email = 'demo@calishealth.com';

UPDATE exercises
SET name = 'Australian Row'
WHERE code = 'EX-008' AND name = 'Australian Pull-up';

UPDATE exercises
SET tree_level = CASE id
        WHEN 107 THEN 3
        WHEN 109 THEN 3
        WHEN 203 THEN 4
        WHEN 110 THEN 2
        WHEN 113 THEN 3
        WHEN 118 THEN 3
        ELSE tree_level
    END,
    difficulty = CASE id
        WHEN 107 THEN 'INTERMEDIATE'
        WHEN 109 THEN 'INTERMEDIATE'
        WHEN 203 THEN 'ADVANCED'
        WHEN 110 THEN 'BEGINNER'
        WHEN 113 THEN 'INTERMEDIATE'
        WHEN 118 THEN 'INTERMEDIATE'
        ELSE difficulty
    END
WHERE id IN (107, 109, 110, 113, 118, 203);

DELETE FROM exercise_tree_edges
WHERE parent_exercise_id IN (107, 108, 109, 113, 114, 115, 110, 111, 112, 203, 205, 206)
   OR child_exercise_id IN (107, 108, 109, 113, 114, 115, 110, 111, 112, 203, 205, 206);

INSERT IGNORE INTO exercise_tree_edges (parent_exercise_id, child_exercise_id)
SELECT parent.id, child.id
FROM exercises parent
JOIN exercises child
  ON (parent.code = 'EX-008' AND child.code = 'TREE-PULL-001')
  OR (parent.code = 'TREE-PULL-001' AND child.code IN ('EX-007', 'EX-009'))
  OR (parent.code IN ('EX-007', 'EX-009') AND child.code IN ('TREE-PULL-002', 'SK-003'))
  OR (parent.code IN ('TREE-PULL-002', 'SK-003') AND child.code = 'TREE-PULL-003')
  OR (parent.code = 'EX-008' AND child.code = 'SK-005')
  OR (parent.code = 'SK-005' AND child.code = 'SK-006')
  OR (parent.code = 'TREE-CORE-001' AND child.code = 'TREE-CORE-002')
  OR (parent.code = 'TREE-CORE-002' AND child.code IN ('EX-013', 'TREE-CORE-003', 'EX-015'))
  OR (parent.code IN ('EX-013', 'TREE-CORE-003') AND child.code = 'TREE-CORE-004')
  OR (parent.code = 'EX-015' AND child.code = 'EX-014')
  OR (parent.code = 'TREE-CORE-004' AND child.code = 'TREE-CORE-005')
  OR (parent.code = 'TREE-LEGS-001' AND child.code IN ('EX-010', 'EX-012'))
  OR (parent.code = 'EX-010' AND child.code IN ('EX-011', 'EX-012'))
  OR (parent.code = 'EX-011' AND child.code = 'TREE-LEGS-002')
  OR (parent.code = 'TREE-LEGS-002' AND child.code = 'TREE-LEGS-003');

UPDATE exercises
SET movement_group = 'PUSH',
    tree_level = CASE code
        WHEN 'EX-006' THEN 1
        WHEN 'EX-018' THEN 1
        WHEN 'EX-001' THEN 2
        WHEN 'EX-002' THEN 3
        WHEN 'EX-003' THEN 3
        WHEN 'EX-004' THEN 3
        WHEN 'EX-016' THEN 3
        WHEN 'EX-005' THEN 4
        WHEN 'EX-017' THEN 4
        WHEN 'SK-001' THEN 4
        WHEN 'SK-004' THEN 4
        WHEN 'SK-002' THEN 5
        ELSE tree_level
    END,
    difficulty = CASE
        WHEN code IN ('EX-006', 'EX-018') THEN 'BEGINNER'
        WHEN code = 'EX-001' THEN 'BEGINNER'
        WHEN code IN ('EX-002', 'EX-003', 'EX-004', 'EX-016') THEN 'INTERMEDIATE'
        WHEN code IN ('EX-005', 'EX-017', 'SK-001', 'SK-004') THEN 'ADVANCED'
        WHEN code = 'SK-002' THEN 'EXPERT'
        ELSE difficulty
    END,
    muscle_group = CASE
        WHEN code IN ('EX-016', 'SK-001', 'SK-002') THEN 'Shoulders, Triceps, Core'
        WHEN code IN ('EX-005', 'EX-017', 'EX-018', 'SK-004') THEN 'Chest, Triceps, Shoulders'
        ELSE 'Chest, Triceps, Shoulders'
    END
WHERE code IN (
    'EX-001', 'EX-002', 'EX-003', 'EX-004', 'EX-005', 'EX-006',
    'EX-016', 'EX-017', 'EX-018', 'SK-001', 'SK-002', 'SK-004'
);

DELETE edge
FROM exercise_tree_edges edge
JOIN exercises parent ON parent.id = edge.parent_exercise_id
JOIN exercises child ON child.id = edge.child_exercise_id
WHERE parent.movement_group = 'PUSH' OR child.movement_group = 'PUSH';

INSERT IGNORE INTO exercise_tree_edges (parent_exercise_id, child_exercise_id)
SELECT parent.id, child.id
FROM exercises parent
JOIN exercises child
  ON (parent.code = 'EX-006' AND child.code = 'EX-001')
  OR (parent.code = 'EX-018' AND child.code = 'EX-001')
  OR (parent.code = 'EX-001' AND child.code IN ('EX-002', 'EX-003', 'EX-004', 'EX-016'))
  OR (parent.code = 'EX-002' AND child.code = 'EX-005')
  OR (parent.code = 'EX-003' AND child.code = 'EX-017')
  OR (parent.code = 'EX-004' AND child.code = 'SK-004')
  OR (parent.code = 'EX-016' AND child.code = 'SK-001')
  OR (parent.code IN ('EX-005', 'EX-017', 'SK-001', 'SK-004') AND child.code = 'SK-002');

INSERT INTO member_profiles (user_id)
SELECT u.id
FROM users u
WHERE u.email = 'demo@calishealth.com'
  AND NOT EXISTS (
      SELECT 1 FROM member_profiles mp WHERE mp.user_id = u.id
  );

INSERT INTO body_measurements (member_profile_id, weight, height, measured_at)
SELECT mp.id, 68.50, 172.00, NOW(6)
FROM member_profiles mp
JOIN users u ON u.id = mp.user_id
WHERE u.email = 'demo@calishealth.com'
  AND NOT EXISTS (
      SELECT 1 FROM body_measurements bm WHERE bm.member_profile_id = mp.id
  );

INSERT IGNORE INTO exercises (
    code, name, description, type, category, muscle_group, level, active, guide,
    updated_at, is_system, status, default_sets, default_reps, default_duration, share_with_community,
    equipment, goal, target_skill, created_at, save_count
) VALUES
(
    'MEMBER-DEMO-001', 'Tempo Push-up', 'A community push-up variation with a controlled lowering phase.',
    'HEALTH', 'Strength', 'Chest, triceps', 'INTERMEDIATE', 1,
    CONCAT('Start in a high plank with hands under your shoulders.', CHAR(10), 'Brace your core and keep a straight line from head to heels.', CHAR(10), 'Lower your chest slowly for a three-count.', CHAR(10), 'Press the floor away to return to the start.'),
    NOW(6), FALSE, 'ACCEPTED', 3, 10, NULL, TRUE, 'Bodyweight', 'BUILD_MUSCLE', NULL,
    DATE_SUB(NOW(6), INTERVAL 2 DAY), 18
),
(
    'MEMBER-DEMO-002', 'Pause Squat', 'A community squat variation that builds control and lower-body strength.',
    'HEALTH', 'Strength', 'Quadriceps, glutes', 'BEGINNER', 1,
    CONCAT('Stand with feet about shoulder-width apart.', CHAR(10), 'Brace your abdomen and sit your hips back.', CHAR(10), 'Lower until your thighs are near parallel, keeping your heels down.', CHAR(10), 'Pause briefly, then drive through your feet to stand.'),
    NOW(6), FALSE, 'ACCEPTED', 3, 12, NULL, TRUE, 'Bodyweight', 'STAY_FIT', NULL,
    DATE_SUB(NOW(6), INTERVAL 5 DAY), 9
),
(
    'MEMBER-DEMO-003', 'Close-Grip Incline Push-up', 'An accessible community variation emphasizing the triceps.',
    'HEALTH', 'Strength', 'Chest, triceps', 'BEGINNER', 1,
    CONCAT('Place your hands close together on a stable elevated surface.', CHAR(10), 'Step your feet back and brace your body in a straight line.', CHAR(10), 'Bend your elbows close to your sides and lower your chest.', CHAR(10), 'Push through your palms to return to the starting position.'),
    NOW(6), FALSE, 'ACCEPTED', 3, 12, NULL, TRUE, 'Bench', 'BUILD_MUSCLE', NULL,
    DATE_SUB(NOW(6), INTERVAL 8 DAY), 5
),
(
    'MEMBER-DEMO-004', 'Wall Handstand Hold', 'A community skill exercise for practicing an aligned handstand.',
    'SKILL', 'Skill', 'Shoulders, core', 'INTERMEDIATE', 1,
    CONCAT('Place your hands shoulder-width apart near a clear wall.', CHAR(10), 'Kick up carefully until your heels rest lightly against the wall.', CHAR(10), 'Push tall through your shoulders and brace your abdomen.', CHAR(10), 'Breathe steadily, then step down with control.'),
    NOW(6), FALSE, 'ACCEPTED', 3, NULL, 20, TRUE, 'Wall', NULL, 'HANDSTAND',
    DATE_SUB(NOW(6), INTERVAL 12 DAY), 13
);

INSERT IGNORE INTO exercises (
    code, name, description, type, category, muscle_group, level, active, guide, guide_steps,
    updated_at, video_url, is_system, status, rejection_reason, default_sets, default_reps,
    default_duration, share_with_community, equipment, author_id, created_at, save_count
) VALUES
(
    'PERSONAL-DEMO-PENDING-001', 'Handstand Push-up Progression',
    'A progression for building shoulder strength and controlled handstand pressing.',
    'HEALTH', 'Strength', 'Shoulders, triceps', 'ADVANCED', 1,
    CONCAT('Face a clear wall and place your hands shoulder-width apart.', CHAR(10), 'Kick into a stable wall handstand with your body braced.', CHAR(10), 'Bend your elbows slowly and lower your head toward a padded surface.', CHAR(10), 'Press through your palms to return to the start.'),
    CONCAT('Face a clear wall and place your hands shoulder-width apart.', CHAR(10), 'Kick into a stable wall handstand with your body braced.', CHAR(10), 'Bend your elbows slowly and lower your head toward a padded surface.', CHAR(10), 'Press through your palms to return to the start.'),
    NOW(6), NULL, FALSE, 'PENDING', NULL, 3, 5, NULL, TRUE, 'Wall', (SELECT id FROM users WHERE email = 'demo@calishealth.com' LIMIT 1),
    DATE_SUB(NOW(6), INTERVAL 1 DAY), 0
),
(
    'PERSONAL-DEMO-REJECTED-001', 'Wall sit challenge',
    'A stupid simple wall sit to build leg endurance.',
    'HEALTH', 'Strength', 'Legs, glutes', 'BEGINNER', 1,
    CONCAT('Stand with your back against a clear wall.', CHAR(10), 'Walk your feet forward and slide down the wall.', CHAR(10), 'Stop when your knees are comfortably bent.', CHAR(10), 'Hold the position while breathing steadily.'),
    CONCAT('Stand with your back against a clear wall.', CHAR(10), 'Walk your feet forward and slide down the wall.', CHAR(10), 'Stop when your knees are comfortably bent.', CHAR(10), 'Hold the position while breathing steadily.'),
    NOW(6), '/media/exercise-demos/demo-wall-sit.mp4', FALSE, 'REJECTED',
    'Reason: Text check: the description contains inappropriate wording. Edit the description and save again.',
    3, NULL, 60, TRUE, 'Wall', (SELECT id FROM users WHERE email = 'demo@calishealth.com' LIMIT 1),
    DATE_SUB(NOW(6), INTERVAL 8 DAY), 0
),
(
    'PERSONAL-DEMO-REJECTED-002', 'L-sit on parallettes',
    'A core and triceps exercise performed while supporting the body on parallettes.',
    'HEALTH', 'Strength', 'Core, triceps', 'INTERMEDIATE', 1,
    CONCAT('Place the parallettes on a stable, non-slip surface.', CHAR(10), 'Grip the bars and press down to lift your body.', CHAR(10), 'Keep your shoulders depressed and raise your legs in front.', CHAR(10), 'Hold with control, then lower your feet gently.'),
    CONCAT('Place the parallettes on a stable, non-slip surface.', CHAR(10), 'Grip the bars and press down to lift your body.', CHAR(10), 'Keep your shoulders depressed and raise your legs in front.', CHAR(10), 'Hold with control, then lower your feet gently.'),
    NOW(6), NULL, FALSE, 'REJECTED',
    'Reason: Video check: we could not detect a full body in most frames. Re-record in better light with your whole body in frame.',
    4, NULL, 15, TRUE, 'Parallettes', (SELECT id FROM users WHERE email = 'demo@calishealth.com' LIMIT 1),
    DATE_SUB(NOW(6), INTERVAL 11 DAY), 0
),
(
    'PERSONAL-DEMO-ACCEPTED-001', 'Pike push-up',
    'A bodyweight pressing exercise that emphasizes the shoulders and triceps.',
    'HEALTH', 'Strength', 'Shoulders', 'INTERMEDIATE', 1,
    CONCAT('Start in a pike position with hands shoulder-width apart.', CHAR(10), 'Brace your core and keep your hips raised.', CHAR(10), 'Bend your elbows and lower your head toward the floor.', CHAR(10), 'Press through your hands to return to the pike position.'),
    CONCAT('Start in a pike position with hands shoulder-width apart.', CHAR(10), 'Brace your core and keep your hips raised.', CHAR(10), 'Bend your elbows and lower your head toward the floor.', CHAR(10), 'Press through your hands to return to the pike position.'),
    NOW(6), NULL, FALSE, 'ACCEPTED', NULL, 3, 8, NULL, TRUE, 'Bodyweight', (SELECT id FROM users WHERE email = 'demo@calishealth.com' LIMIT 1),
    DATE_SUB(NOW(6), INTERVAL 9 DAY), 0
),
(
    'PERSONAL-DEMO-ACCEPTED-002', 'Australian row',
    'A horizontal pulling exercise using a low, secure bar.',
    'HEALTH', 'Strength', 'Back', 'BEGINNER', 1,
    CONCAT('Position yourself under a secure low bar and grip it firmly.', CHAR(10), 'Straighten your body and brace your abdomen.', CHAR(10), 'Pull your chest toward the bar by driving your elbows back.', CHAR(10), 'Lower under control until your arms are extended.'),
    CONCAT('Position yourself under a secure low bar and grip it firmly.', CHAR(10), 'Straighten your body and brace your abdomen.', CHAR(10), 'Pull your chest toward the bar by driving your elbows back.', CHAR(10), 'Lower under control until your arms are extended.'),
    NOW(6), NULL, FALSE, 'ACCEPTED', NULL, 3, 10, NULL, TRUE, 'Low bar', (SELECT id FROM users WHERE email = 'demo@calishealth.com' LIMIT 1),
    DATE_SUB(NOW(6), INTERVAL 13 DAY), 0
),
(
    'PERSONAL-DEMO-ACCEPTED-003', 'Pseudo planche push-up',
    'A demanding push-up variation that develops forward-leaning shoulder strength.',
    'HEALTH', 'Strength', 'Shoulders', 'ADVANCED', 1,
    CONCAT('Begin in a high plank and turn your hands slightly outward if comfortable.', CHAR(10), 'Lean your shoulders forward beyond your wrists while bracing your core.', CHAR(10), 'Bend your elbows and lower your chest with control.', CHAR(10), 'Press the floor away while maintaining the forward lean.'),
    CONCAT('Begin in a high plank and turn your hands slightly outward if comfortable.', CHAR(10), 'Lean your shoulders forward beyond your wrists while bracing your core.', CHAR(10), 'Bend your elbows and lower your chest with control.', CHAR(10), 'Press the floor away while maintaining the forward lean.'),
    NOW(6), NULL, FALSE, 'ACCEPTED', NULL, 4, 6, NULL, TRUE, 'Bodyweight', (SELECT id FROM users WHERE email = 'demo@calishealth.com' LIMIT 1),
    DATE_SUB(NOW(6), INTERVAL 18 DAY), 0
);

-- ============================================================
-- SAMPLE COMMUNITY AND MEMBER WORKOUTS
-- ============================================================
INSERT IGNORE INTO exercises (
    code, name, description, type, category, muscle_group, level, active,
    guide, guide_steps, updated_at, video_url, is_system, status, rejection_reason,
    default_sets, default_reps, default_duration, share_with_community,
    equipment, author_id, created_at, save_count
) VALUES (
    'PERSONAL-DEMO-ACCEPTED-004', 'Bodyweight squat',
    'A foundational squat variation for building lower-body strength.',
    'HEALTH', 'Strength', 'Legs', 'BEGINNER', TRUE,
    CONCAT('Stand with your feet about shoulder-width apart.', CHAR(10),
           'Brace your core and sit your hips back while bending your knees.', CHAR(10),
           'Lower with control while keeping your heels on the floor.', CHAR(10),
           'Drive through your feet to stand tall.'),
    CONCAT('Stand with your feet about shoulder-width apart.', CHAR(10),
           'Brace your core and sit your hips back while bending your knees.', CHAR(10),
           'Lower with control while keeping your heels on the floor.', CHAR(10),
           'Drive through your feet to stand tall.'),
    NOW(6), NULL, FALSE, 'ACCEPTED', NULL, 3, 12, NULL, TRUE,
    'Bodyweight', (SELECT id FROM users WHERE email = 'demo@calishealth.com' LIMIT 1),
    DATE_SUB(NOW(6), INTERVAL 3 DAY), 0
);

INSERT IGNORE INTO workout_entries (
    code, name, description, type, level, active, updated_at, source,
    is_system, author_id, created_by, is_shared_with_community, status, save_count,
    total_sets, estimated_duration, created_at
)
SELECT seed.code, seed.name, seed.description, 'CUSTOM', seed.level, TRUE, NOW(6), 'CUSTOM',
       FALSE, (SELECT id FROM users WHERE email = 'demo@calishealth.com' LIMIT 1),
       (SELECT id FROM users WHERE email = 'demo@calishealth.com' LIMIT 1),
       seed.is_shared, 'ACCEPTED',
       0, seed.total_sets, seed.estimated_duration,
       DATE_SUB(NOW(6), INTERVAL seed.age_days DAY)
FROM (
    SELECT 'LIB-DEMO-COMM-01' code, 'Upper body push day' name,
           'Shoulder and tricep focus with controlled pushing exercises.' description,
           'INTERMEDIATE' level, TRUE is_shared, 2 age_days, 9 total_sets, 20 estimated_duration
    UNION ALL SELECT 'LIB-DEMO-COMM-02', 'Beginner full body',
           'A balanced beginner routine using accessible bodyweight movements.',
           'BEGINNER', TRUE, 4, 9, 20
    UNION ALL SELECT 'LIB-DEMO-COMM-03', 'Planche progression',
           'Progressive shoulder and core work for planche strength.',
           'ADVANCED', TRUE, 7, 10, 25
    UNION ALL SELECT 'LIB-DEMO-PERSONAL-01', 'Morning mobility',
           'A personal routine for gentle upper-body and lower-body movement.',
           'BEGINNER', FALSE, 1, 9, 15
) seed
WHERE (SELECT id FROM users WHERE email = 'demo@calishealth.com' LIMIT 1) IS NOT NULL;

INSERT IGNORE INTO workout_exercises (
    workout_id, exercise_id, display_order, order_index, sets, reps, duration, count_by, rest_seconds
)
SELECT (SELECT id FROM workout_entries WHERE code = item.workout_code LIMIT 1),
       (SELECT id FROM exercises WHERE code = item.exercise_code LIMIT 1),
       item.display_order, item.order_index, item.sets, item.reps, NULL,
       item.count_by, item.rest_seconds
FROM (
    SELECT 'LIB-DEMO-COMM-01' workout_code, 'PERSONAL-DEMO-ACCEPTED-001' exercise_code, 0 display_order, 1 order_index, 3 sets, 8 reps, 'REPS' count_by, 60 rest_seconds
    UNION ALL SELECT 'LIB-DEMO-COMM-01', 'PERSONAL-DEMO-ACCEPTED-003', 1, 2, 3, 8, 'REPS', 60
    UNION ALL SELECT 'LIB-DEMO-COMM-01', 'PERSONAL-DEMO-ACCEPTED-002', 2, 3, 3, 10, 'REPS', 45
    UNION ALL SELECT 'LIB-DEMO-COMM-02', 'PERSONAL-DEMO-ACCEPTED-002', 0, 1, 3, 10, 'REPS', 60
    UNION ALL SELECT 'LIB-DEMO-COMM-02', 'PERSONAL-DEMO-ACCEPTED-004', 1, 2, 3, 10, 'REPS', 45
    UNION ALL SELECT 'LIB-DEMO-COMM-02', 'PERSONAL-DEMO-ACCEPTED-001', 2, 3, 3, 8, 'REPS', 60
    UNION ALL SELECT 'LIB-DEMO-COMM-03', 'PERSONAL-DEMO-ACCEPTED-003', 0, 1, 4, 8, 'REPS', 60
    UNION ALL SELECT 'LIB-DEMO-COMM-03', 'PERSONAL-DEMO-ACCEPTED-001', 1, 2, 3, 8, 'REPS', 60
    UNION ALL SELECT 'LIB-DEMO-COMM-03', 'PERSONAL-DEMO-ACCEPTED-004', 2, 3, 3, 10, 'REPS', 45
    UNION ALL SELECT 'LIB-DEMO-PERSONAL-01', 'PERSONAL-DEMO-ACCEPTED-001', 0, 1, 3, 10, 'REPS', 45
    UNION ALL SELECT 'LIB-DEMO-PERSONAL-01', 'PERSONAL-DEMO-ACCEPTED-002', 1, 2, 3, 10, 'REPS', 45
    UNION ALL SELECT 'LIB-DEMO-PERSONAL-01', 'PERSONAL-DEMO-ACCEPTED-004', 2, 3, 3, 12, 'REPS', 45
) item
WHERE EXISTS (
    SELECT 1
    FROM workout_entries w
    JOIN exercises e ON e.code = item.exercise_code
    WHERE w.code = item.workout_code
      AND e.status = 'ACCEPTED'
      AND e.active = TRUE
);

-- Keep the Content Manager and Member Library views aligned on the shared row.
UPDATE exercises
SET source = CASE
        WHEN is_system THEN COALESCE(NULLIF(source, ''), 'SYSTEM')
        ELSE COALESCE(NULLIF(source, ''), 'CUSTOM')
    END,
    created_by = COALESCE(created_by, author_id),
    moderation_status = CASE status
        WHEN 'ACCEPTED' THEN 'ACTIVE'
        WHEN 'PENDING' THEN 'PENDING'
        WHEN 'REJECTED' THEN 'REJECTED'
        ELSE COALESCE(moderation_status, status)
    END,
    active = CASE
        WHEN status = 'PENDING' OR status = 'REJECTED' THEN FALSE
        ELSE active
    END;

INSERT IGNORE INTO workout_exercises (
    workout_id, exercise_id, display_order, order_index, sets, reps, count_by, rest_seconds
)
SELECT w.id, e.id, seed.display_order, seed.display_order + 1, seed.sets, seed.reps, 'REPS', 60
FROM (
    SELECT 'WO-001' AS workout_code, 'EX-001' AS exercise_code, 0 AS display_order, 3 AS sets, 12 AS reps
    UNION ALL SELECT 'WO-001', 'EX-005', 1, 3, 8
    UNION ALL SELECT 'WO-001', 'EX-016', 2, 3, 10
    UNION ALL SELECT 'WO-002', 'SK-001', 0, 3, 1
    UNION ALL SELECT 'WO-002', 'SK-005', 1, 3, 1
    UNION ALL SELECT 'WO-003', 'EX-001', 0, 3, 12
    UNION ALL SELECT 'WO-003', 'EX-010', 1, 3, 12
    UNION ALL SELECT 'WO-003', 'EX-013', 2, 3, 1
    UNION ALL SELECT 'WO-004', 'EX-013', 0, 3, 1
    UNION ALL SELECT 'WO-004', 'EX-014', 1, 3, 10
    UNION ALL SELECT 'WO-004', 'EX-015', 2, 3, 1
    UNION ALL SELECT 'WO-005', 'EX-006', 0, 3, 12
    UNION ALL SELECT 'WO-005', 'EX-001', 1, 3, 10
    UNION ALL SELECT 'WO-005', 'EX-002', 2, 3, 8
    UNION ALL SELECT 'WO-006', 'SK-005', 0, 3, 1
    UNION ALL SELECT 'WO-006', 'SK-006', 1, 3, 1
    UNION ALL SELECT 'WO-006', 'EX-007', 2, 3, 8
) seed
JOIN workout_entries w ON w.code = seed.workout_code
JOIN exercises e ON e.code = seed.exercise_code
WHERE e.active = TRUE;

UPDATE exercises
SET muscle_group = CASE
    WHEN LOWER(name) LIKE '%push%' OR LOWER(name) LIKE '%dip%'
        OR LOWER(name) LIKE '%press%' OR LOWER(name) LIKE '%planche%'
        THEN 'Chest, Triceps, Shoulders'
    WHEN LOWER(name) LIKE '%pull%' OR LOWER(name) LIKE '%row%'
        OR LOWER(name) LIKE '%chin%' OR LOWER(name) LIKE '%hang%'
        OR LOWER(name) LIKE '%muscle-up%' OR LOWER(name) LIKE '%lever%'
        THEN 'Back, Biceps'
    WHEN LOWER(name) LIKE '%squat%' OR LOWER(name) LIKE '%lunge%'
        OR LOWER(name) LIKE '%pistol%' OR LOWER(name) LIKE '%leg%'
        OR LOWER(name) LIKE '%calf%'
        THEN 'Legs, Glutes'
    WHEN LOWER(name) LIKE '%plank%' OR LOWER(name) LIKE '%hollow%'
        OR LOWER(name) LIKE '%sit%' OR LOWER(name) LIKE '%flag%'
        OR LOWER(name) LIKE '%tuck%' OR LOWER(name) LIKE '%core%'
        THEN 'Core'
    ELSE 'Full Body'
END
WHERE muscle_group IS NULL OR TRIM(muscle_group) = '';

-- Ensure every accepted system exercise participates in one of the four trees.
UPDATE exercises
SET movement_group = CASE
        WHEN LOWER(name) LIKE '%l-sit pull-up%' OR LOWER(name) LIKE '%pull-up%'
            OR LOWER(name) LIKE '%pull up%' OR LOWER(name) LIKE '%row%'
            OR LOWER(name) LIKE '%chin-up%' OR LOWER(name) LIKE '%chin up%'
            OR LOWER(name) LIKE '%front lever%' OR LOWER(name) LIKE '%muscle-up%'
            THEN 'PULL'
        WHEN LOWER(name) LIKE '%plank%' OR LOWER(name) LIKE '%hollow%'
            OR LOWER(name) LIKE '%sit%' OR LOWER(name) LIKE '%flag%'
            OR LOWER(name) LIKE '%abs%' OR LOWER(name) LIKE '%core%'
            OR LOWER(name) LIKE '%knee tuck%' OR LOWER(name) LIKE '%leg raise%'
            OR LOWER(name) LIKE '%knee raise%' THEN 'CORE'
        WHEN LOWER(name) LIKE '%squat%' OR LOWER(name) LIKE '%lunge%'
            OR LOWER(name) LIKE '%pistol%' OR LOWER(name) LIKE '%calf%'
            OR LOWER(name) LIKE '%leg%' OR LOWER(name) LIKE '%nordic%'
            THEN 'LEGS'
        WHEN LOWER(name) LIKE '%hang%'
            THEN 'PULL'
        WHEN LOWER(name) LIKE '%push%' OR LOWER(name) LIKE '%dip%'
            OR LOWER(name) LIKE '%press%' OR LOWER(name) LIKE '%planche%'
            OR LOWER(name) LIKE '%handstand%'
            THEN 'PUSH'
        WHEN LOWER(muscle_group) LIKE '%core%' OR LOWER(muscle_group) LIKE '%ab%'
            THEN 'CORE'
        WHEN LOWER(muscle_group) LIKE '%leg%' OR LOWER(muscle_group) LIKE '%quad%'
            OR LOWER(muscle_group) LIKE '%glute%' OR LOWER(muscle_group) LIKE '%hamstring%'
            THEN 'LEGS'
        WHEN LOWER(muscle_group) LIKE '%back%' OR LOWER(muscle_group) LIKE '%lat%'
            OR LOWER(muscle_group) LIKE '%bicep%' OR LOWER(muscle_group) LIKE '%forearm%'
            THEN 'PULL'
        ELSE 'PUSH'
    END,
    tree_level = CASE
        WHEN tree_level BETWEEN 1 AND 5 THEN tree_level
        WHEN UPPER(level) = 'BEGINNER' THEN 1
        WHEN UPPER(level) = 'INTERMEDIATE' THEN 3
        WHEN UPPER(level) = 'ADVANCED' THEN 4
        ELSE 5
    END,
    difficulty = CASE
        WHEN UPPER(level) IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT') THEN UPPER(level)
        ELSE 'INTERMEDIATE'
    END
WHERE is_system = TRUE AND status = 'ACCEPTED';

-- Normalize any pre-existing system skill rows in the 201-235 range without
-- inventing records for IDs that are not present in the database.
UPDATE exercises
SET movement_group = CASE
        WHEN LOWER(name) LIKE '%pull%' OR LOWER(name) LIKE '%row%'
            OR LOWER(name) LIKE '%chin%' OR LOWER(name) LIKE '%lever%'
            OR LOWER(name) LIKE '%muscle-up%' OR LOWER(name) LIKE '%muscle up%'
            THEN 'PULL'
        WHEN LOWER(name) LIKE '%plank%' OR LOWER(name) LIKE '%hollow%'
            OR LOWER(name) LIKE '%l-sit%' OR LOWER(name) LIKE '%l sit%'
            OR LOWER(name) LIKE '%flag%' OR LOWER(name) LIKE '%leg raise%'
            OR LOWER(name) LIKE '%knee raise%' OR LOWER(name) LIKE '%knee tuck%'
            THEN 'CORE'
        WHEN LOWER(name) LIKE '%squat%' OR LOWER(name) LIKE '%lunge%'
            OR LOWER(name) LIKE '%calf%' OR LOWER(name) LIKE '%nordic%'
            OR LOWER(name) LIKE '%leg%'
            THEN 'LEGS'
        WHEN LOWER(name) LIKE '%push%' OR LOWER(name) LIKE '%dip%'
            OR LOWER(name) LIKE '%press%' OR LOWER(name) LIKE '%planche%'
            OR LOWER(name) LIKE '%handstand%'
            THEN 'PUSH'
        WHEN LOWER(muscle_group) LIKE '%back%' OR LOWER(muscle_group) LIKE '%lat%'
            THEN 'PULL'
        WHEN LOWER(muscle_group) LIKE '%leg%' OR LOWER(muscle_group) LIKE '%glute%'
            THEN 'LEGS'
        WHEN LOWER(muscle_group) LIKE '%core%' OR LOWER(muscle_group) LIKE '%ab%'
            THEN 'CORE'
        ELSE 'PUSH'
    END,
    tree_level = CASE
        WHEN tree_level BETWEEN 1 AND 5 THEN tree_level
        WHEN UPPER(level) = 'BEGINNER' THEN 1
        WHEN UPPER(level) = 'INTERMEDIATE' THEN 3
        WHEN UPPER(level) = 'ADVANCED' THEN 4
        ELSE 5
    END
WHERE id BETWEEN 201 AND 235
  AND is_system = TRUE
  AND status = 'ACCEPTED';

UPDATE exercises
SET video_url = CASE
        WHEN code = 'EX-006' OR LOWER(name) LIKE '%incline push-up%' OR LOWER(name) LIKE '%incline push up%'
            THEN 'https://www.youtube.com/embed/3WJS1E2v930'
        WHEN code = 'EX-002' OR LOWER(name) LIKE '%diamond push-up%' OR LOWER(name) LIKE '%diamond push up%'
            THEN 'https://www.youtube.com/embed/J0DnG1_S92I'
        WHEN code = 'EX-016' OR code = 'SK-002'
            OR LOWER(name) LIKE '%pike push-up%' OR LOWER(name) LIKE '%pike push up%'
            OR LOWER(name) LIKE '%handstand push-up%' OR LOWER(name) LIKE '%handstand push up%'
            OR LOWER(name) LIKE '%pseudo planche%'
            THEN 'https://www.youtube.com/embed/sposDXIE0zc'
        WHEN LOWER(name) LIKE '%front lever%' OR LOWER(name) LIKE '%muscle-up%'
            OR LOWER(name) LIKE '%muscle up%' OR LOWER(name) LIKE '%pulling skill%'
            THEN 'https://www.youtube.com/embed/eGo4IYlbE5g'
        WHEN LOWER(name) LIKE '%wall handstand%'
            THEN 'https://www.youtube.com/embed/sposDXIE0zc'
        WHEN code IN ('EX-005', 'EX-017', 'EX-018', 'SK-004')
            OR LOWER(name) LIKE '%dip%'
            THEN 'https://www.youtube.com/embed/2z8JmcrW-As'
        WHEN code IN ('EX-007', 'EX-009', 'SK-003')
            OR LOWER(name) LIKE '%pull-up%' OR LOWER(name) LIKE '%pull up%'
            OR LOWER(name) LIKE '%chin-up%' OR LOWER(name) LIKE '%chin up%'
            OR LOWER(name) LIKE '%dead hang%'
            THEN 'https://www.youtube.com/embed/eGo4IYlbE5g'
        WHEN code = 'EX-008' OR LOWER(name) LIKE '%australian row%'
            OR LOWER(name) LIKE '%ring row%'
            THEN 'https://www.youtube.com/embed/G2B13P6PAn8'
        WHEN code IN ('EX-010', 'EX-011', 'EX-012')
            OR LOWER(name) LIKE '%squat%' OR LOWER(name) LIKE '%lunge%'
            THEN 'https://www.youtube.com/embed/aclHkVaku9U'
        WHEN code IN ('EX-013', 'EX-014', 'EX-015')
            OR LOWER(name) LIKE '%plank%' OR LOWER(name) LIKE '%l-sit%'
            OR LOWER(name) LIKE '%l sit%' OR LOWER(name) LIKE '%knee tuck%'
            OR LOWER(name) LIKE '%leg raise%' OR LOWER(name) LIKE '%dragon flag%'
            OR LOWER(name) LIKE '%hollow body%'
            THEN 'https://www.youtube.com/embed/pSHjTRCQxIw'
        WHEN code IN ('EX-001', 'EX-003', 'EX-004')
            OR LOWER(name) LIKE '%push-up%' OR LOWER(name) LIKE '%push up%'
            THEN 'https://www.youtube.com/embed/IODxDxX7oi4'
        WHEN TRIM(COALESCE(video_url, '')) REGEXP '^https://www\\.youtube\\.com/embed/[^[:space:]]+$'
            THEN TRIM(video_url)
        WHEN movement_group = 'PULL' OR LOWER(muscle_group) LIKE '%back%'
            THEN 'https://www.youtube.com/embed/eGo4IYlbE5g'
        WHEN movement_group = 'LEGS' OR LOWER(muscle_group) LIKE '%leg%'
            OR LOWER(muscle_group) LIKE '%glute%'
            THEN 'https://www.youtube.com/embed/aclHkVaku9U'
        WHEN movement_group = 'CORE' OR LOWER(muscle_group) LIKE '%core%'
            OR LOWER(muscle_group) LIKE '%ab%'
            THEN 'https://www.youtube.com/embed/pSHjTRCQxIw'
        ELSE 'https://www.youtube.com/embed/IODxDxX7oi4'
    END
WHERE is_system = TRUE;

-- Give any otherwise disconnected node a parent in the nearest easier level.
INSERT IGNORE INTO exercise_tree_edges (parent_exercise_id, child_exercise_id)
SELECT parent.id, child.id
FROM exercises child
JOIN exercises parent
  ON parent.movement_group = child.movement_group
 AND parent.tree_level = (
     SELECT MAX(previous.tree_level)
     FROM exercises previous
     WHERE previous.is_system = TRUE
       AND previous.status = 'ACCEPTED'
       AND previous.movement_group = child.movement_group
       AND previous.tree_level < child.tree_level
 )
WHERE child.is_system = TRUE
  AND child.status = 'ACCEPTED'
  AND child.tree_level BETWEEN 2 AND 5
  AND NOT EXISTS (
      SELECT 1
      FROM exercise_tree_edges existing
      WHERE existing.child_exercise_id = child.id
  );

-- difficulty_level is an ordinal TINYINT in this schema; normalize its
-- string counterparts instead of applying UPPER() to a numeric column.
UPDATE exercises
SET level = UPPER(TRIM(level))
WHERE level IS NOT NULL;

UPDATE exercises
SET difficulty = UPPER(TRIM(difficulty))
WHERE difficulty IS NOT NULL;
