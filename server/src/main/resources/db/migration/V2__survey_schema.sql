-- V2: Dynamic Survey Engine (onboarding survey).
-- Câu hỏi, bước, lựa chọn và điều kiện hiển thị đều là DỮ LIỆU cấu hình; Java chỉ chứa
-- bộ xử lý theo LOẠI câu hỏi (QuestionTypeRegistry), không chứa danh sách câu hỏi.
--
-- Versioning: mỗi (survey_code, version) là một bộ khảo sát bất biến sau khi ACTIVE.
-- Muốn đổi cấu trúc -> tạo version mới (DRAFT -> ACTIVE), version cũ chuyển ARCHIVED.
-- Phiên khảo sát trỏ tới đúng dòng surveys (survey_id) nên không bị đổi cấu trúc giữa chừng.
-- Không xóa câu hỏi/lựa chọn đã dùng: FK mặc định RESTRICT, vô hiệu hóa bằng cột status.

-- ============================================================
-- 1. SURVEYS
-- ============================================================
CREATE TABLE surveys (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    survey_code   VARCHAR(64)  NOT NULL,
    survey_name   VARCHAR(255) NOT NULL,
    description   TEXT         DEFAULT NULL,
    version       INT          NOT NULL,
    status        VARCHAR(16)  NOT NULL DEFAULT 'DRAFT',          -- DRAFT | ACTIVE | ARCHIVED
    -- 1 khi ACTIVE, NULL khi khác -> UNIQUE bên dưới đảm bảo mỗi survey_code chỉ có 1 version ACTIVE
    active_marker TINYINT      GENERATED ALWAYS AS (CASE WHEN status = 'ACTIVE' THEN 1 ELSE NULL END) STORED,
    created_at    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_surveys_code_version (survey_code, version),
    UNIQUE KEY uk_surveys_one_active (survey_code, active_marker),
    CONSTRAINT ck_surveys_status CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    CONSTRAINT ck_surveys_version CHECK (version > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 2. SURVEY_STEPS  (số bước không cố định)
-- ============================================================
CREATE TABLE survey_steps (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    survey_id   BIGINT       NOT NULL,
    step_code   VARCHAR(64)  NOT NULL,
    step_name   VARCHAR(255) NOT NULL,
    description TEXT         DEFAULT NULL,
    sort_order  INT          NOT NULL,
    status      VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',           -- ACTIVE | INACTIVE
    PRIMARY KEY (id),
    UNIQUE KEY uk_survey_steps_code (survey_id, step_code),
    KEY idx_survey_steps_order (survey_id, sort_order),
    CONSTRAINT fk_survey_steps_survey FOREIGN KEY (survey_id) REFERENCES surveys (id),
    CONSTRAINT ck_survey_steps_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 3. ASSESSMENT_QUESTIONS  (định nghĩa câu hỏi, dùng lại được giữa các version)
-- ============================================================
-- question_type là VARCHAR (không phải ENUM) để thêm loại mới không cần ALTER TABLE;
-- backend chỉ chấp nhận loại đã có handler trong QuestionTypeRegistry.
CREATE TABLE assessment_questions (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    question_code    VARCHAR(64)  NOT NULL,
    question_text    VARCHAR(500) NOT NULL,
    description      TEXT         DEFAULT NULL,
    question_type    VARCHAR(32)  NOT NULL,
    required         BIT(1)       NOT NULL DEFAULT 0,
    validation_rules JSON         DEFAULT NULL,
    display_config   JSON         DEFAULT NULL,
    unit             VARCHAR(32)  DEFAULT NULL,
    default_value    JSON         DEFAULT NULL,
    status           VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',      -- ACTIVE | INACTIVE
    created_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_assessment_questions_code (question_code),
    CONSTRAINT ck_assessment_questions_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 4. ASSESSMENT_OPTIONS  (lựa chọn của SINGLE_SELECT / MULTIPLE_SELECT)
-- ============================================================
CREATE TABLE assessment_options (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    question_id  BIGINT       NOT NULL,
    option_code  VARCHAR(64)  NOT NULL,
    option_label VARCHAR(255) NOT NULL,
    option_value VARCHAR(255) DEFAULT NULL,
    sort_order   INT          NOT NULL,
    status       VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',          -- ACTIVE | INACTIVE
    PRIMARY KEY (id),
    UNIQUE KEY uk_assessment_options_code (question_id, option_code),
    KEY idx_assessment_options_order (question_id, sort_order),
    CONSTRAINT fk_assessment_options_question FOREIGN KEY (question_id) REFERENCES assessment_questions (id),
    CONSTRAINT ck_assessment_options_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 5. SURVEY_STEP_QUESTIONS  (gắn câu hỏi vào bước + điều kiện hiển thị)
-- ============================================================
-- conditional_rules ví dụ: {"operator":"EQ","questionCode":"GOAL_TYPE","value":"HEALTH"}
-- Ràng buộc "mỗi câu hỏi chỉ xuất hiện 1 lần trong 1 survey" được kiểm tra ở SurveyConfigValidator
-- (vì answers là duy nhất theo (session, question)).
CREATE TABLE survey_step_questions (
    id                BIGINT  NOT NULL AUTO_INCREMENT,
    step_id           BIGINT  NOT NULL,
    question_id       BIGINT  NOT NULL,
    sort_order        INT     NOT NULL,
    conditional_rules JSON    DEFAULT NULL,
    is_active         BIT(1)  NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uk_survey_step_questions (step_id, question_id),
    KEY idx_survey_step_questions_question (question_id),
    CONSTRAINT fk_ssq_step FOREIGN KEY (step_id) REFERENCES survey_steps (id),
    CONSTRAINT fk_ssq_question FOREIGN KEY (question_id) REFERENCES assessment_questions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 6. SURVEY_SESSIONS
-- ============================================================
CREATE TABLE survey_sessions (
    id                 BIGINT      NOT NULL AUTO_INCREMENT,
    user_id            BIGINT      NOT NULL,
    survey_id          BIGINT      NOT NULL,
    survey_version     INT         NOT NULL,
    status             VARCHAR(16) NOT NULL,                       -- IN_PROGRESS | COMPLETED | SKIPPED
    -- 1 khi IN_PROGRESS -> UNIQUE bên dưới chặn 2 phiên đang làm cho cùng user + survey
    in_progress_marker TINYINT     GENERATED ALWAYS AS (CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE NULL END) STORED,
    started_at         DATETIME(6) NOT NULL,
    completed_at       DATETIME(6) DEFAULT NULL,
    skipped_at         DATETIME(6) DEFAULT NULL,
    updated_at         DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_survey_sessions_one_in_progress (user_id, survey_id, in_progress_marker),
    KEY idx_survey_sessions_user_status (user_id, status),
    KEY idx_survey_sessions_survey (survey_id),
    CONSTRAINT fk_survey_sessions_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_survey_sessions_survey FOREIGN KEY (survey_id) REFERENCES surveys (id),
    CONSTRAINT ck_survey_sessions_status CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'SKIPPED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 7. ASSESSMENT_ANSWERS
-- ============================================================
-- answer_value là JSON đã được handler chuẩn hóa: số -> number, SINGLE_SELECT -> "OPTION_CODE",
-- MULTIPLE_SELECT -> ["CODE_A","CODE_B"], BOOLEAN -> true/false, TEXT -> "chuỗi".
-- Truy vấn MULTIPLE_SELECT: JSON_CONTAINS(answer_value, '"HANDSTAND"').
CREATE TABLE assessment_answers (
    id           BIGINT      NOT NULL AUTO_INCREMENT,
    session_id   BIGINT      NOT NULL,
    question_id  BIGINT      NOT NULL,
    answer_value JSON        NOT NULL,
    created_at   DATETIME(6) NOT NULL,
    updated_at   DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_assessment_answers_session_question (session_id, question_id),
    KEY idx_assessment_answers_question (question_id),
    CONSTRAINT fk_assessment_answers_session FOREIGN KEY (session_id) REFERENCES survey_sessions (id),
    CONSTRAINT fk_assessment_answers_question FOREIGN KEY (question_id) REFERENCES assessment_questions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
