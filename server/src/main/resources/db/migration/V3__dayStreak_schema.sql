-- V3: Day Streak + Workout Tracking (Member).
-- Màn "Day Streak" (client/src/pages/DayStreak.jsx) và popup "Day Report"
-- (client/src/components/DayReportModal.jsx) đọc dữ liệu từ 2 bảng ở đây:
--   workout_sessions          -> 1 dòng = 1 buổi tập trong ngày, có ngày (session_date)
--   session_exercise_results  -> 1 dòng = 1 bài tập trong buổi, có sets/reps/accuracy
-- accuracy (form accuracy %) chính là thanh hồng trong Day Report.
--
-- Lưu ý: file này TRÙNG NỘI DUNG với V2__survey_schema.sql (đã sửa lại).
-- Flyway tính checksum theo nội dung file, nên nếu V3 đã từng được apply ở DB local
-- thì cần `flyway repair` (hoặc xoá dòng V3 trong bảng flyway_schema_history)
-- trước khi migrate lại. Nếu chưa từng apply thì không cần làm gì.
--
-- Tên cột khớp 1-1 với @Column(name=...) trong các entity:
--   MemberProfile.java (streak_count, longest_streak)
--   SessionExerciseResult.java (sets_completed, valid_reps, invalid_reps, accuracy,
--                              active_seconds, workout_session_id, exercise_id)
--   FormErrorLog.java (rep_number, joint_angle, occurred_at,
--                       session_exercise_result_id, form_rule_id)

-- ============================================================
-- 1. FITNESS_LEVELS  (Beginner / Intermediate / Advanced…)
-- ============================================================
CREATE TABLE IF NOT EXISTS fitness_levels (
    id   BIGINT       NOT NULL AUTO_INCREMENT,
    name VARCHAR(50)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_fitness_levels_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 2. MEDIA_FILES  (video demo bài tập, ảnh giải phẫu, avatar)
-- ============================================================
CREATE TABLE IF NOT EXISTS media_files (
    id               BIGINT          NOT NULL AUTO_INCREMENT,
    file_url         VARCHAR(1000)   NOT NULL,
    file_type        VARCHAR(50)     DEFAULT NULL,
    format           VARCHAR(50)     DEFAULT NULL,
    size_mb          DECIMAL(10, 2)  DEFAULT NULL,
    duration_seconds INT             DEFAULT NULL,
    purpose          VARCHAR(100)    DEFAULT NULL,
    status           VARCHAR(50)     DEFAULT NULL,
    uploaded_at      DATETIME(6)     DEFAULT NULL,
    uploaded_by      BIGINT          DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_media_files_uploaded_by (uploaded_by),
    CONSTRAINT fk_media_files_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 3. EXERCISES  (bài tập calisthenics — nguồn cho SessionExerciseResult)
-- ============================================================
CREATE TABLE IF NOT EXISTS exercises (
    id               BIGINT        NOT NULL AUTO_INCREMENT,
    name             VARCHAR(150)  NOT NULL,
    type             VARCHAR(40)   NOT NULL,
    category         VARCHAR(80)   DEFAULT NULL,
    difficulty_level VARCHAR(40)   DEFAULT NULL,
    instructions     TEXT          DEFAULT NULL,
    execution_steps  TEXT          DEFAULT NULL,
    video_url        VARCHAR(1000) DEFAULT NULL,
    default_sets     INT           DEFAULT NULL,
    default_reps     INT           DEFAULT NULL,
    duration         INT           DEFAULT NULL,
    source           VARCHAR(60)   DEFAULT NULL,
    status           VARCHAR(40)   DEFAULT NULL,
    updated_at       DATETIME(6)   NOT NULL,
    created_by       BIGINT        DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_exercises_created_by (created_by),
    CONSTRAINT fk_exercises_created_by FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 4. FORM_RULES  (ngưỡng góc khớp để AI chấm dáng)
-- ============================================================
CREATE TABLE IF NOT EXISTS form_rules (
    id               BIGINT        NOT NULL AUTO_INCREMENT,
    joint            VARCHAR(80)   DEFAULT NULL,
    angle_threshold  DECIMAL(7, 3) DEFAULT NULL,
    rom_depth        DECIMAL(7, 3) DEFAULT NULL,
    feedback_message TEXT          DEFAULT NULL,
    exercise_id      BIGINT        NOT NULL,
    PRIMARY KEY (id),
    KEY idx_form_rules_exercise (exercise_id),
    CONSTRAINT fk_form_rules_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 5. MEMBER_PROFILES  (hồ sơ + streak_count / longest_streak cache)
-- ============================================================
CREATE TABLE IF NOT EXISTS member_profiles (
    id                 BIGINT        NOT NULL AUTO_INCREMENT,
    gender             VARCHAR(20)   DEFAULT NULL,
    date_of_birth      DATE          DEFAULT NULL,
    weight             DECIMAL(6, 2) DEFAULT NULL,
    height             DECIMAL(6, 2) DEFAULT NULL,
    goals              TEXT          DEFAULT NULL,
    streak_count       INT           NOT NULL DEFAULT 0,
    longest_streak     INT           NOT NULL DEFAULT 0,
    bio                TEXT          DEFAULT NULL,
    avatar_url         VARCHAR(1000) DEFAULT NULL,
    user_id            BIGINT        NOT NULL,
    fitness_level_id   BIGINT        DEFAULT NULL,
    avatar_media_id    BIGINT        DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_member_profiles_user (user_id),
    KEY idx_member_profiles_fitness_level (fitness_level_id),
    KEY idx_member_profiles_avatar_media (avatar_media_id),
    CONSTRAINT fk_member_profiles_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_member_profiles_fitness_level FOREIGN KEY (fitness_level_id) REFERENCES fitness_levels (id),
    CONSTRAINT fk_member_profiles_avatar_media FOREIGN KEY (avatar_media_id) REFERENCES media_files (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Backfill profiles for member accounts that predate workout tracking.
INSERT INTO member_profiles (user_id)
SELECT u.id
FROM users u
WHERE u.role = 'MEMBER'
  AND NOT EXISTS (
      SELECT 1
      FROM member_profiles mp
      WHERE mp.user_id = u.id
  );

-- ============================================================
-- 6. WORKOUT_SESSIONS  (1 dòng = 1 buổi tập)
-- ============================================================
-- session_date là ngày LOCAL của người tập (không quy đổi sang UTC): chuỗi
-- streak tính theo lịch ngày nên phải neo theo múi giờ của app.
-- UNIQUE (member_profile_id, session_date, workout_id) chặn tạo trùng khi app
-- retry. finished_at NULL nghĩa là buổi tập đang chạy -> chưa tính vào streak.
CREATE TABLE IF NOT EXISTS workout_sessions (
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    member_profile_id BIGINT       NOT NULL,
    -- Cố ý KHÔNG khai báo FK tới workout_entries: bảng đó thuộc module
    -- Library/Content và được tạo ở V4 (mục 5, WORKOUT TEMPLATES). Thêm FK ở
    -- đây sẽ làm V3 fail ngay vì workout_entries chưa tồn tại. FK được gắn
    -- bằng ALTER TABLE ở cuối V4.
    workout_id        BIGINT       DEFAULT NULL,
    session_date      DATE         NOT NULL,
    status            VARCHAR(20)  NOT NULL DEFAULT 'IN_PROGRESS',  -- IN_PROGRESS | COMPLETED | ABANDONED
    started_at        DATETIME(6)  NOT NULL,
    finished_at       DATETIME(6)  DEFAULT NULL,
    active_seconds    INT          NOT NULL DEFAULT 0,
    total_reps        INT          NOT NULL DEFAULT 0,
    notes             TEXT         DEFAULT NULL,
    created_at        DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at        DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_workout_sessions_member_date_workout (member_profile_id, session_date, workout_id),
    KEY idx_workout_sessions_date (member_profile_id, session_date),
    KEY idx_workout_sessions_workout (workout_id),
    CONSTRAINT fk_workout_sessions_member FOREIGN KEY (member_profile_id) REFERENCES member_profiles (id),
    CONSTRAINT ck_workout_sessions_status CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'ABANDONED')),
    CONSTRAINT ck_workout_sessions_time CHECK (finished_at IS NULL OR finished_at >= started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 7. SESSION_EXERCISE_RESULTS  (1 dòng = 1 bài tập trong buổi)
-- ============================================================
-- accuracy = form accuracy (%) của AI -> hiển thị trực tiếp trong Day Report.
-- valid_reps = số rep đạt chuẩn, invalid_reps = số rep sai dáng (tổng = tổng rep).
CREATE TABLE IF NOT EXISTS session_exercise_results (
    id                  BIGINT        NOT NULL AUTO_INCREMENT,
    sets_completed      INT           NOT NULL DEFAULT 0,
    valid_reps          INT           NOT NULL DEFAULT 0,
    invalid_reps        INT           NOT NULL DEFAULT 0,
    accuracy            DECIMAL(6, 3) DEFAULT NULL,
    active_seconds      INT           NOT NULL DEFAULT 0,
    sort_order          INT           NOT NULL DEFAULT 0,
    workout_session_id  BIGINT        NOT NULL,
    exercise_id         BIGINT        NOT NULL,
    PRIMARY KEY (id),
    KEY idx_session_exercise_results_session (workout_session_id, sort_order),
    KEY idx_session_exercise_results_exercise (exercise_id),
    CONSTRAINT fk_session_exercise_results_session FOREIGN KEY (workout_session_id) REFERENCES workout_sessions (id),
    CONSTRAINT fk_session_exercise_results_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id),
    CONSTRAINT ck_session_exercise_results_accuracy CHECK (accuracy IS NULL OR (accuracy >= 0 AND accuracy <= 100)),
    CONSTRAINT ck_session_exercise_results_counts CHECK (
        sets_completed >= 0 AND valid_reps >= 0 AND invalid_reps >= 0 AND active_seconds >= 0
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 8. FORM_ERROR_LOGS  (chi tiết lỗi dáng theo từng rep)
-- ============================================================
-- Bảng này phồng to theo số rep -> chỉ ghi lỗi AI thực sự phát hiện.
CREATE TABLE IF NOT EXISTS form_error_logs (
    id                          BIGINT        NOT NULL AUTO_INCREMENT,
    rep_number                  INT           NOT NULL,
    joint_angle                 DECIMAL(7, 3) DEFAULT NULL,
    occurred_at                 DATETIME(6)   NOT NULL,
    session_exercise_result_id  BIGINT        NOT NULL,
    form_rule_id                BIGINT        NOT NULL,
    PRIMARY KEY (id),
    KEY idx_form_error_logs_result (session_exercise_result_id, rep_number),
    KEY idx_form_error_logs_rule (form_rule_id),
    CONSTRAINT fk_form_error_logs_result FOREIGN KEY (session_exercise_result_id) REFERENCES session_exercise_results (id),
    CONSTRAINT fk_form_error_logs_rule FOREIGN KEY (form_rule_id) REFERENCES form_rules (id),
    CONSTRAINT ck_form_error_logs_rep CHECK (rep_number > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 9. MEMBER_SKILL_PROGRESS  (tiến độ mở khoá skill cho member)
-- ============================================================
CREATE TABLE IF NOT EXISTS member_skill_progress (
    id                 BIGINT        NOT NULL AUTO_INCREMENT,
    status             VARCHAR(40)   DEFAULT NULL,
    best_reps          INT           DEFAULT NULL,
    best_accuracy      DECIMAL(6, 3) DEFAULT NULL,
    unlocked_at        DATETIME(6)   DEFAULT NULL,
    exercise_id        BIGINT        NOT NULL,
    member_profile_id  BIGINT        NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_member_skill_progress (member_profile_id, exercise_id),
    KEY idx_member_skill_progress_exercise (exercise_id),
    CONSTRAINT fk_member_skill_progress_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id),
    CONSTRAINT fk_member_skill_progress_member FOREIGN KEY (member_profile_id) REFERENCES member_profiles (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;