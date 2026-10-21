-- V1: Init schema CalisHealth (JPA-validated)
-- Order: base/lookup -> user/auth -> dependents with FKs
-- Convention: tên cột khớp 1-1 với @Column(name=...) trong entity.
-- Typos trong tên bảng/cột ('trainning_plans', 'anwer_type', 'create_at', 'content_workouts') được giữ nguyên cho khớp với entity.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 1. BASE / LOOKUP
-- ============================================================

CREATE TABLE fitness_levels (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    name        VARCHAR(50)  NOT NULL,
    description VARCHAR(500) DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_fitness_levels_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE muscle_groups (
    id   BIGINT       NOT NULL AUTO_INCREMENT,
    name VARCHAR(80)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_muscle_groups_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 2. MEDIA (cho Content Manager)
-- ============================================================

CREATE TABLE media_files (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    file_url         VARCHAR(1000) NOT NULL,
    file_type        VARCHAR(50)  DEFAULT NULL,
    format           VARCHAR(50)  DEFAULT NULL,
    size_mb          DECIMAL(10,2) DEFAULT NULL,
    duration_seconds INT          DEFAULT NULL,
    purpose          VARCHAR(100) DEFAULT NULL,
    status           VARCHAR(50)  DEFAULT NULL,
    uploaded_at      DATETIME(6)  DEFAULT NULL,
    uploaded_by      BIGINT       DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_media_files_uploaded_by (uploaded_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 3. USER / AUTH
-- ============================================================

CREATE TABLE users (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    email      VARCHAR(255) NOT NULL,
    password   VARCHAR(255) NOT NULL,
    full_name  VARCHAR(255) NOT NULL,
    role       VARCHAR(32)  NOT NULL DEFAULT 'MEMBER',
    enabled    BIT(1)       NOT NULL DEFAULT 0,
    created_at DATETIME(6)  DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE auth_tokens (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    token      VARCHAR(255) NOT NULL,
    type       VARCHAR(32)  DEFAULT NULL,
    expires_at DATETIME(6)  DEFAULT NULL,
    user_id    BIGINT       NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_auth_tokens_token (token),
    KEY idx_auth_tokens_user (user_id),
    CONSTRAINT fk_auth_tokens_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE activity_logs (
    id        BIGINT       NOT NULL AUTO_INCREMENT,
    action    VARCHAR(255) NOT NULL,
    create_at DATETIME(6)  DEFAULT NULL,    -- typo kept to match entity
    user_id   BIGINT       NOT NULL,
    PRIMARY KEY (id),
    KEY idx_activity_logs_user (user_id),
    CONSTRAINT fk_activity_logs_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 4. MEMBER PROFILE
-- ============================================================

CREATE TABLE member_profiles (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    gender           VARCHAR(20)  DEFAULT NULL,
    date_of_birth    DATE         DEFAULT NULL,
    weight           DECIMAL(6,2) DEFAULT NULL,
    height           DECIMAL(6,2) DEFAULT NULL,
    goals            TEXT         DEFAULT NULL,
    streak_count     INT          NOT NULL DEFAULT 0,
    longest_streak   INT          NOT NULL DEFAULT 0,
    bio              TEXT         DEFAULT NULL,
    avatar_url       VARCHAR(1000) DEFAULT NULL,
    user_id          BIGINT       NOT NULL,
    fitness_level_id BIGINT       DEFAULT NULL,
    avatar_media_id  BIGINT       DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_member_profiles_user (user_id),
    KEY idx_member_profiles_fitness_level (fitness_level_id),
    KEY idx_member_profiles_avatar_media (avatar_media_id),
    CONSTRAINT fk_mp_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_mp_fitness_level FOREIGN KEY (fitness_level_id) REFERENCES fitness_levels (id),
    CONSTRAINT fk_mp_avatar_media FOREIGN KEY (avatar_media_id) REFERENCES media_files (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 5. EXERCISES (catalog) + EXERCISE ENTRIES (Content Manager)
-- ============================================================

CREATE TABLE exercises (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    name             VARCHAR(150) NOT NULL,
    type             VARCHAR(40)  NOT NULL,
    category         VARCHAR(80)  DEFAULT NULL,
    difficulty_level VARCHAR(40)  DEFAULT NULL,
    instructions     TEXT         DEFAULT NULL,
    execution_steps  TEXT         DEFAULT NULL,
    safety_tips      TEXT         DEFAULT NULL,
    anatomy_theory   TEXT         DEFAULT NULL,
    video_url        VARCHAR(1000) DEFAULT NULL,
    default_sets     INT          DEFAULT NULL,
    default_reps     INT          DEFAULT NULL,
    default_rest     INT          DEFAULT NULL,
    source           VARCHAR(60)  DEFAULT NULL,
    status           VARCHAR(40)  DEFAULT NULL,
    updated_at       DATETIME(6)  NOT NULL,
    demo_media_id    BIGINT       DEFAULT NULL,
    created_by       BIGINT       DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_exercises_demo_media (demo_media_id),
    KEY idx_exercises_created_by (created_by),
    CONSTRAINT fk_exercises_demo_media FOREIGN KEY (demo_media_id) REFERENCES media_files (id),
    CONSTRAINT fk_exercises_created_by  FOREIGN KEY (created_by)      REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE exercise_entries (
    id                 BIGINT       NOT NULL AUTO_INCREMENT,
    code               VARCHAR(30)  NOT NULL,
    name               VARCHAR(120) NOT NULL,
    description        TEXT         DEFAULT NULL,
    type               VARCHAR(20)  NOT NULL,
    category           VARCHAR(80)  DEFAULT NULL,
    muscle_group       VARCHAR(120) NOT NULL,
    level              VARCHAR(30)  NOT NULL,
    active             BIT(1)       NOT NULL DEFAULT 1,
    guide              TEXT         DEFAULT NULL,
    demo_video_url     VARCHAR(1000) DEFAULT NULL,
    anatomy_image_url  VARCHAR(1000) DEFAULT NULL,
    updated_at         DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_exercise_entries_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE form_rules (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    joint            VARCHAR(80)  DEFAULT NULL,
    angle_threshold  DECIMAL(7,3) DEFAULT NULL,
    rom_depth        DECIMAL(7,3) DEFAULT NULL,
    feedback_message TEXT         DEFAULT NULL,
    exercise_id      BIGINT       NOT NULL,
    PRIMARY KEY (id),
    KEY idx_form_rules_exercise (exercise_id),
    CONSTRAINT fk_form_rules_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE exercise_variations (
    id                  BIGINT       NOT NULL AUTO_INCREMENT,
    type                VARCHAR(60)  DEFAULT NULL,
    exercise_id         BIGINT       NOT NULL,
    variant_exercise_id BIGINT       NOT NULL,
    PRIMARY KEY (id),
    KEY idx_ev_exercise (exercise_id),
    KEY idx_ev_variant  (variant_exercise_id),
    CONSTRAINT fk_ev_exercise FOREIGN KEY (exercise_id)         REFERENCES exercises (id),
    CONSTRAINT fk_ev_variant  FOREIGN KEY (variant_exercise_id) REFERENCES exercises (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE progression_rules (
    id                       BIGINT       NOT NULL AUTO_INCREMENT,
    rule_name                VARCHAR(150) NOT NULL,
    relationship VARCHAR(100) DEFAULT NULL,
    required_reps            INT          DEFAULT NULL,
    min_accuracy             DECIMAL(6,3) DEFAULT NULL,
    status                   VARCHAR(40)  DEFAULT NULL,
    updated_at               DATETIME(6)  NOT NULL,
    exercise_id              BIGINT       NOT NULL,
    prerequisite_exercise_id BIGINT       NOT NULL,
    PRIMARY KEY (id),
    KEY idx_pr_exercise      (exercise_id),
    KEY idx_pr_prerequisite  (prerequisite_exercise_id),
    CONSTRAINT fk_pr_exercise      FOREIGN KEY (exercise_id)              REFERENCES exercises (id),
    CONSTRAINT fk_pr_prerequisite  FOREIGN KEY (prerequisite_exercise_id) REFERENCES exercises (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE benchmark_criteria (
    id               BIGINT        NOT NULL AUTO_INCREMENT,
    min_value        DECIMAL(10,2) NOT NULL,
    criterion_weight DECIMAL(8,3)  NOT NULL,
    exercise_id      BIGINT        NOT NULL,
    fitness_level_id BIGINT        NOT NULL,
    PRIMARY KEY (id),
    KEY idx_bc_exercise      (exercise_id),
    KEY idx_bc_fitness_level (fitness_level_id),
    CONSTRAINT fk_bc_exercise      FOREIGN KEY (exercise_id)      REFERENCES exercises (id),
    CONSTRAINT fk_bc_fitness_level FOREIGN KEY (fitness_level_id) REFERENCES fitness_levels (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE exercise_muscle_groups (
    exercise_id    BIGINT NOT NULL,
    muscle_group_id BIGINT NOT NULL,
    PRIMARY KEY (exercise_id, muscle_group_id),
    KEY idx_emg_muscle (muscle_group_id),
    CONSTRAINT fk_emg_exercise FOREIGN KEY (exercise_id)     REFERENCES exercises (id),
    CONSTRAINT fk_emg_muscle   FOREIGN KEY (muscle_group_id) REFERENCES muscle_groups (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 6. TRAINING PLAN
-- ============================================================

CREATE TABLE trainning_plans (                          -- typo kept
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    name             VARCHAR(255) NOT NULL,
    goal             TEXT         DEFAULT NULL,
    plan_type        VARCHAR(100) DEFAULT NULL,
    status           VARCHAR(50)  DEFAULT NULL,
    fitness_level_id BIGINT       DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_trainning_plans_fitness_level (fitness_level_id),
    CONSTRAINT fk_tp_fitness_level FOREIGN KEY (fitness_level_id) REFERENCES fitness_levels (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE plan_exercises (
    id                BIGINT NOT NULL AUTO_INCREMENT,
    sequence          INT    NOT NULL,
    sets              INT    NOT NULL,
    reps              INT    NOT NULL,
    rest_seconds      INT    NOT NULL,
    training_plan_id  BIGINT NOT NULL,    -- 'training_plan_id' = map field `trainningPlan`
    exercise_id       BIGINT NOT NULL,
    PRIMARY KEY (id),
    KEY idx_plan_exercises_plan     (training_plan_id),
    KEY idx_plan_exercises_exercise (exercise_id),
    CONSTRAINT fk_pe_plan     FOREIGN KEY (training_plan_id) REFERENCES trainning_plans (id),
    CONSTRAINT fk_pe_exercise FOREIGN KEY (exercise_id)     REFERENCES exercises (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 7. SCHEDULED WORKOUTS / SESSIONS / VIDEOS / RESULTS
-- ============================================================

CREATE TABLE scheduled_workouts (
    id                 BIGINT      NOT NULL AUTO_INCREMENT,
    scheduled_date     DATE        DEFAULT NULL,
    status             VARCHAR(50) DEFAULT NULL,
    member_profile_id  BIGINT      DEFAULT NULL,
    trainning_plan_id  BIGINT      DEFAULT NULL,           -- typo kept
    PRIMARY KEY (id),
    KEY idx_sw_member (member_profile_id),
    KEY idx_sw_plan   (trainning_plan_id),
    CONSTRAINT fk_sw_member FOREIGN KEY (member_profile_id) REFERENCES member_profiles (id),
    CONSTRAINT fk_sw_plan   FOREIGN KEY (trainning_plan_id) REFERENCES trainning_plans (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE workout_sessions (
    id                   BIGINT       NOT NULL AUTO_INCREMENT,
    source               VARCHAR(100) DEFAULT NULL,
    started_at           DATETIME(6)  DEFAULT NULL,
    ended_at             DATETIME(6)  DEFAULT NULL,
    accuracy             DOUBLE       DEFAULT NULL,
    status               VARCHAR(50)  DEFAULT NULL,
    member_profile_id    BIGINT       DEFAULT NULL,
    scheduled_workout_id BIGINT       DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_ws_member    (member_profile_id),
    KEY idx_ws_scheduled (scheduled_workout_id),
    CONSTRAINT fk_ws_member    FOREIGN KEY (member_profile_id)    REFERENCES member_profiles (id),
    CONSTRAINT fk_ws_scheduled FOREIGN KEY (scheduled_workout_id) REFERENCES scheduled_workouts (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE uploaded_videos (
    id                 BIGINT       NOT NULL AUTO_INCREMENT,
    file_url           VARCHAR(255) NOT NULL,
    format             VARCHAR(255) DEFAULT NULL,
    size_mb            DOUBLE       DEFAULT NULL,
    duration_seconds   INT          DEFAULT NULL,
    workout_session_id BIGINT       DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_uv_session (workout_session_id),
    CONSTRAINT fk_uv_session FOREIGN KEY (workout_session_id) REFERENCES workout_sessions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE session_exercise_results (
    id                 BIGINT       NOT NULL AUTO_INCREMENT,
    sets_completed     INT          NOT NULL,
    valid_reps         INT          NOT NULL,
    invalid_reps       INT          NOT NULL,
    accuracy           DECIMAL(6,3) DEFAULT NULL,
    active_seconds     INT          NOT NULL,
    workout_session_id BIGINT       NOT NULL,
    exercise_id        BIGINT       NOT NULL,
    PRIMARY KEY (id),
    KEY idx_ser_session  (workout_session_id),
    KEY idx_ser_exercise (exercise_id),
    CONSTRAINT fk_ser_session  FOREIGN KEY (workout_session_id) REFERENCES workout_sessions (id),
    CONSTRAINT fk_ser_exercise FOREIGN KEY (exercise_id)        REFERENCES exercises (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE form_error_logs (
    id                         BIGINT       NOT NULL AUTO_INCREMENT,
    rep_number                 INT          NOT NULL,
    joint_angle                DECIMAL(7,3) DEFAULT NULL,
    occurred_at                DATETIME(6)  NOT NULL,
    session_exercise_result_id BIGINT       NOT NULL,
    form_rule_id               BIGINT       NOT NULL,
    PRIMARY KEY (id),
    KEY idx_fel_ser  (session_exercise_result_id),
    KEY idx_fel_rule (form_rule_id),
    CONSTRAINT fk_fel_ser  FOREIGN KEY (session_exercise_result_id) REFERENCES session_exercise_results (id),
    CONSTRAINT fk_fel_rule FOREIGN KEY (form_rule_id)               REFERENCES form_rules (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 8. CONTENT WORKOUTS + PLAN ITEMS + WORKOUT_EXERCISES (Content Manager)
-- ============================================================

CREATE TABLE content_workouts (                          -- tên 'content_workouts' (typo entity) kept
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    code        VARCHAR(30)  NOT NULL,
    name        VARCHAR(120) NOT NULL,
    description TEXT         DEFAULT NULL,
    content     TEXT         DEFAULT NULL,
    type        VARCHAR(40)  DEFAULT 'WORKOUT',
    level       VARCHAR(30)  NOT NULL,
    active      BIT(1)       NOT NULL DEFAULT 1,
    updated_at  DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_content_workouts_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE workout_exercises (
    workout_id   BIGINT NOT NULL,
    exercise_id  BIGINT NOT NULL,
    display_order INT   DEFAULT 0,
    PRIMARY KEY (workout_id, exercise_id),
    KEY idx_we_exercise (exercise_id),
    CONSTRAINT fk_we_workout  FOREIGN KEY (workout_id)  REFERENCES content_workouts (id),
    CONSTRAINT fk_we_exercise FOREIGN KEY (exercise_id) REFERENCES exercise_entries (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE workout_plan_items (
    id                 BIGINT NOT NULL AUTO_INCREMENT,
    workout_id         BIGINT NOT NULL,
    exercise_id        BIGINT NOT NULL,
    day_of_week        INT    NOT NULL,
    beginner_sets      INT    NOT NULL,
    beginner_reps      INT    NOT NULL,
    intermediate_sets  INT    NOT NULL,
    intermediate_reps  INT    NOT NULL,
    advanced_sets      INT    NOT NULL,
    advanced_reps      INT    NOT NULL,
    PRIMARY KEY (id),
    KEY idx_wpi_workout  (workout_id),
    KEY idx_wpi_exercise (exercise_id),
    CONSTRAINT fk_wpi_workout  FOREIGN KEY (workout_id)  REFERENCES content_workouts (id),
    CONSTRAINT fk_wpi_exercise FOREIGN KEY (exercise_id) REFERENCES exercise_entries (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE content_scans (
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    scan_type         VARCHAR(60)  DEFAULT NULL,
    status            VARCHAR(40)  DEFAULT NULL,
    score             DECIMAL(7,3) DEFAULT NULL,
    flagged_terms     TEXT         DEFAULT NULL,
    details           TEXT         DEFAULT NULL,
    scanned_at        DATETIME(6)  NOT NULL,
    content_review_id BIGINT       NOT NULL,
    media_file_id     BIGINT       DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_cs_media (media_file_id),
    CONSTRAINT fk_cs_media FOREIGN KEY (media_file_id) REFERENCES media_files (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 9. SKILL + BODY + MONTHLY
-- ============================================================

CREATE TABLE member_skill_progress (
    id                 BIGINT       NOT NULL AUTO_INCREMENT,
    status             VARCHAR(40)  DEFAULT NULL,
    best_reps          INT          DEFAULT NULL,
    best_accuracy      DECIMAL(6,3) DEFAULT NULL,
    unlocked_at        DATETIME(6)  DEFAULT NULL,
    exercise_id        BIGINT       NOT NULL,
    member_profile_id  BIGINT       NOT NULL,
    PRIMARY KEY (id),
    KEY idx_msp_exercise (exercise_id),
    KEY idx_msp_member   (member_profile_id),
    CONSTRAINT fk_msp_exercise FOREIGN KEY (exercise_id)       REFERENCES exercises (id),
    CONSTRAINT fk_msp_member   FOREIGN KEY (member_profile_id) REFERENCES member_profiles (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE body_measurements (
    id                BIGINT      NOT NULL AUTO_INCREMENT,
    weight            DOUBLE      DEFAULT NULL,
    height            DOUBLE      DEFAULT NULL,
    bmi               DOUBLE      DEFAULT NULL,
    measured_at       DATETIME(6) DEFAULT NULL,
    member_profile_id BIGINT      DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_bm_member (member_profile_id),
    CONSTRAINT fk_bm_member FOREIGN KEY (member_profile_id) REFERENCES member_profiles (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE monthly_performances (
    id                BIGINT      NOT NULL AUTO_INCREMENT,
    monthly_start     DATE        DEFAULT NULL,
    total_volume      DOUBLE      DEFAULT NULL,
    clean_reps        INT         DEFAULT NULL,
    health_score      DOUBLE      DEFAULT NULL,
    member_profile_id BIGINT      DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_mp_member (member_profile_id),
    CONSTRAINT fk_mp_member FOREIGN KEY (member_profile_id) REFERENCES member_profiles (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 10. SYSTEM SETTINGS
-- ============================================================

CREATE TABLE system_settings (
    id       BIGINT       NOT NULL AUTO_INCREMENT,
    name     VARCHAR(255) NOT NULL,
    type     VARCHAR(100) DEFAULT NULL,
    priority INT          DEFAULT NULL,
    setting_value TEXT         DEFAULT NULL,
    status   VARCHAR(50)  DEFAULT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 11. SURVEYS / SUBMISSIONS / ANSWERS
-- ============================================================

CREATE TABLE surveys (
    id     BIGINT       NOT NULL AUTO_INCREMENT,
    title  VARCHAR(255) NOT NULL,
    type   VARCHAR(100) DEFAULT NULL,
    status VARCHAR(50)  DEFAULT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE survey_question (                                    -- singular table name
    id            BIGINT NOT NULL AUTO_INCREMENT,
    display_order INT          DEFAULT NULL,
    question_text TEXT         NOT NULL,
    anwer_type    VARCHAR(50)  DEFAULT NULL,                     -- typo kept
    options       TEXT         DEFAULT NULL,
    survey_id     BIGINT       DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_survey_question_survey (survey_id),
    CONSTRAINT fk_sq_survey FOREIGN KEY (survey_id) REFERENCES surveys (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE survey_submissions (
    id                BIGINT      NOT NULL AUTO_INCREMENT,
    score             INT         DEFAULT NULL,
    submitted_at      DATETIME(6) DEFAULT NULL,
    member_profile_id BIGINT      DEFAULT NULL,
    survey_id         BIGINT      DEFAULT NULL,
    fitness_level_id  BIGINT      DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_ss_member        (member_profile_id),
    KEY idx_ss_survey        (survey_id),
    KEY idx_ss_fitness_level (fitness_level_id),
    CONSTRAINT fk_ss_member        FOREIGN KEY (member_profile_id) REFERENCES member_profiles (id),
    CONSTRAINT fk_ss_survey        FOREIGN KEY (survey_id)         REFERENCES surveys (id),
    CONSTRAINT fk_ss_fitness_level FOREIGN KEY (fitness_level_id)  REFERENCES fitness_levels (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE survey_answers (
    id                   BIGINT NOT NULL AUTO_INCREMENT,
    answer_value         TEXT        DEFAULT NULL,
    survey_submission_id BIGINT      DEFAULT NULL,
    survey_question_id   BIGINT      DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_sa_submission (survey_submission_id),
    KEY idx_sa_question   (survey_question_id),
    CONSTRAINT fk_sa_submission FOREIGN KEY (survey_submission_id) REFERENCES survey_submissions (id),
    CONSTRAINT fk_sa_question   FOREIGN KEY (survey_question_id)   REFERENCES survey_question (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
