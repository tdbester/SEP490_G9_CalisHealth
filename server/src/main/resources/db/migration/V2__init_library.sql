-- V2: Init Library & Exercise schema for CalisHealth
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
    uploader_id      BIGINT NOT NULL,
    file_url         VARCHAR(255) NOT NULL,
    file_type        VARCHAR(50) DEFAULT NULL,
    format           VARCHAR(10) DEFAULT NULL,
    size_mb          DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    duration_seconds INT DEFAULT NULL,
    purpose          VARCHAR(50) DEFAULT NULL,
    status           VARCHAR(50) NOT NULL DEFAULT 'PENDING_SCAN',
    uploaded_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at       DATETIME DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_media_files_url (file_url),
    KEY idx_media_files_uploader (uploader_id),
    KEY idx_media_files_status (status, uploaded_at),
    CONSTRAINT fk_media_files_uploader FOREIGN KEY (uploader_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

-- ============================================================
-- 4. EXERCISE_ENTRIES (Content Management & Library System List)
-- ============================================================
CREATE TABLE IF NOT EXISTS exercise_entries (
    id                BIGINT NOT NULL AUTO_INCREMENT,
    code              VARCHAR(30) NOT NULL,
    name              VARCHAR(120) NOT NULL,
    description       TEXT DEFAULT NULL,
    type              VARCHAR(20) NOT NULL,
    category          VARCHAR(80) DEFAULT NULL,
    muscle_group      VARCHAR(120) NOT NULL,
    level             VARCHAR(30) NOT NULL,
    active            BIT(1) NOT NULL DEFAULT 1,
    guide             TEXT DEFAULT NULL,
    demo_video_url    VARCHAR(1000) DEFAULT NULL,
    anatomy_image_url VARCHAR(1000) DEFAULT NULL,
    updated_at        DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_exercise_entries_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. CONTENT_WORKOUTS
-- ============================================================
CREATE TABLE IF NOT EXISTS content_workouts (
    id          BIGINT NOT NULL AUTO_INCREMENT,
    code        VARCHAR(30) NOT NULL,
    name        VARCHAR(120) NOT NULL,
    description TEXT DEFAULT NULL,
    content     TEXT DEFAULT NULL,
    type        VARCHAR(40) DEFAULT 'WORKOUT',
    level       VARCHAR(30) NOT NULL,
    active      BIT(1) NOT NULL DEFAULT 1,
    updated_at  DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_content_workouts_code (code)
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
    CONSTRAINT fk_we_workout FOREIGN KEY (workout_id) REFERENCES content_workouts (id) ON DELETE CASCADE,
    CONSTRAINT fk_we_exercise FOREIGN KEY (exercise_id) REFERENCES exercise_entries (id) ON DELETE CASCADE
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
    CONSTRAINT fk_wpi_workout FOREIGN KEY (workout_id) REFERENCES content_workouts (id) ON DELETE CASCADE,
    CONSTRAINT fk_wpi_exercise FOREIGN KEY (exercise_id) REFERENCES exercise_entries (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. SEED DATA FOR LIBRARY
-- ============================================================

-- Seed Muscle Groups
INSERT IGNORE INTO muscle_groups (id, name) VALUES
(1, 'Chest'),
(2, 'Back'),
(3, 'Legs'),
(4, 'Core'),
(5, 'Arm/Shoulders'),
(6, 'Full body');

-- Seed System Exercises for Library (Health & Skills)
INSERT IGNORE INTO exercise_entries (id, code, name, description, type, category, muscle_group, level, active, guide, demo_video_url, anatomy_image_url, updated_at) VALUES
(101, 'EX-001', 'Standard Push-up', 'The standard push-up is the foundational upper-body horizontal pressing movement targeting the pectoralis major, anterior deltoids, and triceps.', 'HEALTH', 'Strength', 'Chest', 'Beginner', 1, 'Keep elbows at a 45-degree angle, maintain a straight rigid line from shoulders to heels, engage the core and depress scapulae.', NULL, NULL, NOW(6)),
(102, 'EX-002', 'Diamond Push-up', 'Narrow grip variation heavily emphasizing the triceps lateral and medial heads as well as inner pectoral activation.', 'HEALTH', 'Strength', 'Chest', 'Intermediate', 1, 'Form a triangle/diamond with index fingers and thumbs directly under the sternum.', NULL, NULL, NOW(6)),
(103, 'EX-003', 'Decline Push-up', 'Elevated feet push-up increasing angle to shift load specifically onto the clavicular head (upper chest) and shoulders.', 'HEALTH', 'Strength', 'Chest', 'Intermediate', 1, 'Place feet onto an elevated surface or bench while maintaining strict neutral spinal posture.', NULL, NULL, NOW(6)),
(104, 'EX-004', 'Wide Grip Push-up', 'Broad hand placement isolating the pectoralis major with increased horizontal adduction stretch.', 'HEALTH', 'Hypertrophy', 'Chest', 'Beginner', 1, 'Place hands 1.5x shoulder width apart without letting lower back sag.', NULL, NULL, NOW(6)),
(105, 'EX-005', 'Dips', 'Compound vertical pressing movement working lower chest, anterior deltoid, and triceps.', 'HEALTH', 'Strength', 'Chest', 'Intermediate', 1, 'Lean torso slightly forward to focus on chest; lower until elbows reach 90 degrees.', NULL, NULL, NOW(6)),
(106, 'EX-006', 'Incline Push-up', 'Hands elevated on bench reducing bodyweight percentage for high repetition endurance and beginner mastery.', 'HEALTH', 'Endurance', 'Chest', 'Beginner', 1, 'Hands on stable surface; focus on full protraction at the top of the repetition.', NULL, NULL, NOW(6)),
(107, 'EX-007', 'Pull-up', 'The king of bodyweight vertical pulling movements targeting the latissimus dorsi, teres major, and biceps.', 'HEALTH', 'Strength', 'Back', 'Intermediate', 1, 'Dead hang grip slightly wider than shoulders, pull chin clear over the bar while keeping core tight.', NULL, NULL, NOW(6)),
(108, 'EX-008', 'Australian Pull-up', 'Horizontal row on a low bar, building scapular retraction and foundational back thickness.', 'HEALTH', 'Strength', 'Back', 'Beginner', 1, 'Hold bar with overhand grip, heels on the floor, pull chest to touch the bar.', NULL, NULL, NOW(6)),
(109, 'EX-009', 'Chin-up', 'Supinated grip pull-up focusing on biceps brachii and lower lat engagement.', 'HEALTH', 'Strength', 'Back', 'Intermediate', 1, 'Palms facing you, pull up until chin passes the bar without swinging or kipping.', NULL, NULL, NOW(6)),
(110, 'EX-010', 'Bodyweight Squat', 'Primary lower-body movement for developing knee flexion, quad endurance, and glute activation.', 'HEALTH', 'Strength', 'Legs', 'Beginner', 1, 'Feet shoulder-width, break at the hips and knees simultaneously, descend until thighs are parallel to ground.', NULL, NULL, NOW(6)),
(111, 'EX-011', 'Bulgarian Split Squat', 'Unilateral leg exercise strengthening quads, glutes, and fixing leg strength imbalances.', 'HEALTH', 'Strength', 'Legs', 'Intermediate', 1, 'Rear foot elevated on a bench, descend vertically until rear knee nearly touches floor.', NULL, NULL, NOW(6)),
(112, 'EX-012', 'Walking Lunges', 'Great lower body cardio and stabilizer builder for hip flexors, quads, and hamstrings.', 'HEALTH', 'Endurance', 'Legs', 'Beginner', 1, 'Step forward under control, maintain upright chest, drive through the front heel.', NULL, NULL, NOW(6)),
(113, 'EX-013', 'Plank', 'Isometric core exercise holding rigid hollow body alignment to protect the lower spine.', 'HEALTH', 'Stability', 'Core', 'Beginner', 1, 'Forearms on the ground, squeeze glutes and thighs, pull belly button towards spine.', NULL, NULL, NOW(6)),
(114, 'EX-014', 'Hanging Knee Raise', 'Bar-hanging abdominal drill targeting the lower rectus abdominis and hip flexors.', 'HEALTH', 'Strength', 'Core', 'Intermediate', 1, 'Hang from pull-up bar, raise knees towards chest without relying on body momentum.', NULL, NULL, NOW(6)),
(115, 'EX-015', 'Hollow Body Hold', 'Gymnastic staple holding posterior pelvic tilt to solidify bodyweight stability.', 'HEALTH', 'Stability', 'Core', 'Intermediate', 1, 'Lie on back, press lumbar spine flat against the ground, raise legs and shoulders slightly.', NULL, NULL, NOW(6)),
(116, 'EX-016', 'Pike Push-up', 'Vertical pushing angle transitioning chest drive directly into the anterior deltoids.', 'HEALTH', 'Strength', 'Arm/Shoulders', 'Intermediate', 1, 'Elevate hips into inverted V-shape, lower head diagonally forward towards the hands.', NULL, NULL, NOW(6)),
(117, 'EX-017', 'Parallel Bar Dips', 'High-load bodyweight dip targeting lateral triceps and lower chest fibers.', 'HEALTH', 'Strength', 'Arm/Shoulders', 'Intermediate', 1, 'Support yourself on parallel bars, lower torso under control, lock out elbows at peak.', NULL, NULL, NOW(6)),
(118, 'EX-018', 'Bench Dips', 'Accessible tricep flexion drill for building pushing lock-out strength.', 'HEALTH', 'Strength', 'Arm/Shoulders', 'Beginner', 1, 'Hands on bench edge behind you, legs extended, lower hips towards floor and push up.', NULL, NULL, NOW(6)),

-- Skill Exercises (Chuẩn 100% theo Mockup Figma)
(201, 'SK-001', 'Wall handstand hold', 'Balance drill on hands demanding wrist mobility, shoulder flexion, and overhead stability.', 'SKILL', 'Skill', 'Shoulders', 'Beginner', 1, 'Kick up against wall or freestanding, push actively through the shoulders.', NULL, NULL, NOW(6)),
(202, 'SK-002', 'Handstand push-up', 'Elite vertical pressing calisthenic skill lifting 100% of body mass overhead.', 'SKILL', 'Skill', 'Shoulders', 'Advanced', 1, 'From handstand against wall or freestanding, lower head to touch floor, press upward forcefully.', NULL, NULL, NOW(6)),
(203, 'SK-003', 'Explosive pull-up', 'Explosive transition building power for muscle-up transitions.', 'SKILL', 'Skill', 'Back', 'Intermediate', 1, 'Pull explosively to chest level, lean chest over bar.', NULL, NULL, NOW(6)),
(204, 'SK-004', 'Straight bar dip', 'Bar dip drill developing pressing strength above the bar for the final phase of a muscle-up.', 'SKILL', 'Skill', 'Chest', 'Intermediate', 1, 'Lower torso under control, lock out elbows over straight bar.', NULL, NULL, NOW(6)),
(205, 'SK-005', 'Tuck front lever', 'Horizontal straight-arm isometric pull engaging extreme latissimus activation.', 'SKILL', 'Skill', 'Back', 'Intermediate', 1, 'Hold bar with arms straight, pull body horizontal while keeping knees tucked into chest.', NULL, NULL, NOW(6)),
(206, 'SK-006', 'Advanced tuck front lever', 'Progressive straight-arm static hold extending knees further from the chest.', 'SKILL', 'Skill', 'Back', 'Advanced', 1, 'Straight arms, open hip angle extending knees away from torso.', NULL, NULL, NOW(6));

-- Seed sample workouts
INSERT IGNORE INTO content_workouts (id, code, name, description, content, type, level, active, updated_at) VALUES
(1, 'WO-001', 'Upper Body Calisthenics Mastery', 'Intense upper body hypertrophy and strength routine targeting chest, back, and shoulders.', 'Push-ups, Pull-ups, Dips and Pike Push-ups circuit.', 'WORKOUT', 'Intermediate', 1, NOW(6)),
(2, 'WO-002', 'Foundation Core & Balance', 'Strengthen your core foundation and develop baseline isometric endurance.', 'Plank, Hollow Body, L-Sit prep.', 'WORKOUT', 'Beginner', 1, NOW(6));
