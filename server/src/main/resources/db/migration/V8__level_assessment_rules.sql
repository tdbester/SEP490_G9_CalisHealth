-- V6: Rule phân loại level từ kết quả khảo sát onboarding.
-- Mọi con số (ngưỡng reps/giây, trọng số, điểm, mốc level) là DỮ LIỆU cấu hình; Java chỉ chứa thuật toán
-- chấm điểm chung (LevelRuleEvaluator), không chứa ngưỡng của bài tập nào.
--
--   level_rule_sets       1 bộ luật cho 1 survey_code, có version như surveys (DRAFT -> ACTIVE -> ARCHIVED).
--                         Mỗi survey_code chỉ có tối đa 1 bộ luật ACTIVE.
--   level_rule_criteria   1 tiêu chí = 1 câu hỏi NUMBER của survey (vd PUSH_UP_MAX_REPS) + trọng số.
--   level_rule_bands      Khoảng giá trị [min_value, max_value) của 1 tiêu chí -> điểm + level của riêng bài đó.
--                         applies_when (tùy chọn) là điều kiện theo câu trả lời khác, cùng cú pháp với
--                         survey_step_questions.conditional_rules, vd tách ngưỡng theo GENDER / AGE.
--                         Khoảng đầu tiên (theo sort_order) có điều kiện thỏa và chứa giá trị sẽ được dùng.
--   level_rule_outcomes   Điểm tổng >= min_score -> fitness level (lấy mốc cao nhất đạt được),
--                         kèm lời nhận xét và kế hoạch gợi ý (recommendation JSON) cho màn Result.
--   survey_level_results  Kết quả chấm của 1 phiên khảo sát đã hoàn thành (lưu breakdown để hiển thị lại
--                         đúng như lúc chấm, kể cả khi bộ luật sau này đổi).

-- Level cần thứ tự để so sánh / hiển thị "Level 2 of 4"; thứ tự nằm ở level_rule_outcomes.sort_order
-- nên fitness_levels giữ nguyên.

-- ============================================================
-- 1. LEVEL_RULE_SETS
-- ============================================================
CREATE TABLE level_rule_sets (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    rule_set_code  VARCHAR(64)  NOT NULL,
    name           VARCHAR(255) NOT NULL,
    description    TEXT         DEFAULT NULL,
    survey_code    VARCHAR(64)  NOT NULL,
    version        INT          NOT NULL,
    status         VARCHAR(16)  NOT NULL DEFAULT 'DRAFT',          -- DRAFT | ACTIVE | ARCHIVED
    -- WEIGHTED_AVERAGE: điểm tổng = trung bình có trọng số điểm các tiêu chí
    -- MINIMUM:          điểm tổng = điểm thấp nhất (level bị giới hạn bởi bài yếu nhất)
    scoring_method VARCHAR(32)  NOT NULL DEFAULT 'WEIGHTED_AVERAGE',
    active_marker  TINYINT      GENERATED ALWAYS AS (CASE WHEN status = 'ACTIVE' THEN 1 ELSE NULL END) STORED,
    created_at     DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at     DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_level_rule_sets_code_version (rule_set_code, version),
    UNIQUE KEY uk_level_rule_sets_one_active (survey_code, active_marker),
    CONSTRAINT ck_level_rule_sets_status CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    CONSTRAINT ck_level_rule_sets_method CHECK (scoring_method IN ('WEIGHTED_AVERAGE', 'MINIMUM')),
    CONSTRAINT ck_level_rule_sets_version CHECK (version > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 2. LEVEL_RULE_CRITERIA
-- ============================================================
CREATE TABLE level_rule_criteria (
    id             BIGINT        NOT NULL AUTO_INCREMENT,
    rule_set_id    BIGINT        NOT NULL,
    criterion_code VARCHAR(64)   NOT NULL,
    label          VARCHAR(255)  NOT NULL,
    question_code  VARCHAR(64)   NOT NULL,                         -- câu hỏi NUMBER trong survey
    weight         DECIMAL(8, 3) NOT NULL DEFAULT 1,
    -- 1: thiếu câu trả lời (hoặc không khoảng nào khớp) -> không chấm được, dùng level dự phòng
    -- 0: thiếu thì bỏ tiêu chí này khỏi phép tính
    required       BIT(1)        NOT NULL DEFAULT 1,
    sort_order     INT           NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_level_rule_criteria_code (rule_set_id, criterion_code),
    UNIQUE KEY uk_level_rule_criteria_question (rule_set_id, question_code),
    CONSTRAINT fk_level_rule_criteria_set FOREIGN KEY (rule_set_id) REFERENCES level_rule_sets (id),
    CONSTRAINT ck_level_rule_criteria_weight CHECK (weight > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 3. LEVEL_RULE_BANDS
-- ============================================================
CREATE TABLE level_rule_bands (
    id               BIGINT         NOT NULL AUTO_INCREMENT,
    criterion_id     BIGINT         NOT NULL,
    min_value        DECIMAL(12, 3) DEFAULT NULL,                  -- NULL = không chặn dưới; tính cả biên
    max_value        DECIMAL(12, 3) DEFAULT NULL,                  -- NULL = không chặn trên; KHÔNG tính biên
    score            DECIMAL(8, 3)  NOT NULL,
    fitness_level_id BIGINT         DEFAULT NULL,                  -- level của riêng bài này (để hiển thị)
    band_label       VARCHAR(100)   DEFAULT NULL,                  -- nhãn riêng, vd "Limited"; NULL = tên level
    applies_when     JSON           DEFAULT NULL,
    sort_order       INT            NOT NULL,
    PRIMARY KEY (id),
    KEY idx_level_rule_bands_criterion (criterion_id, sort_order),
    CONSTRAINT fk_level_rule_bands_criterion FOREIGN KEY (criterion_id) REFERENCES level_rule_criteria (id),
    CONSTRAINT fk_level_rule_bands_level FOREIGN KEY (fitness_level_id) REFERENCES fitness_levels (id),
    CONSTRAINT ck_level_rule_bands_range CHECK (min_value IS NULL OR max_value IS NULL OR min_value < max_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 4. LEVEL_RULE_OUTCOMES
-- ============================================================
-- recommendation ví dụ:
-- {"planName": "Foundation Builder", "description": "...", "note": "...",
--  "sessions": [{"name": "Full body A", "exercises": [{"name": "Push-up", "detail": "3 sets • 5-6 reps"}]}]}
CREATE TABLE level_rule_outcomes (
    id               BIGINT        NOT NULL AUTO_INCREMENT,
    rule_set_id      BIGINT        NOT NULL,
    fitness_level_id BIGINT        NOT NULL,
    min_score        DECIMAL(8, 3) NOT NULL,
    sort_order       INT           NOT NULL,                       -- 1 = level thấp nhất
    summary          TEXT          DEFAULT NULL,
    recommendation   JSON          DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_level_rule_outcomes_level (rule_set_id, fitness_level_id),
    UNIQUE KEY uk_level_rule_outcomes_order (rule_set_id, sort_order),
    CONSTRAINT fk_level_rule_outcomes_set FOREIGN KEY (rule_set_id) REFERENCES level_rule_sets (id),
    CONSTRAINT fk_level_rule_outcomes_level FOREIGN KEY (fitness_level_id) REFERENCES fitness_levels (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 5. SURVEY_LEVEL_RESULTS
-- ============================================================
CREATE TABLE survey_level_results (
    id               BIGINT        NOT NULL AUTO_INCREMENT,
    session_id       BIGINT        NOT NULL,
    rule_set_id      BIGINT        DEFAULT NULL,
    fitness_level_id BIGINT        DEFAULT NULL,
    total_score      DECIMAL(8, 3) DEFAULT NULL,
    -- RULES: chấm theo bộ luật | FALLBACK: dùng level dự phòng của bước Result | NONE: không gán level
    method           VARCHAR(16)   NOT NULL,
    breakdown        JSON          NOT NULL,
    evaluated_at     DATETIME(6)   NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_survey_level_results_session (session_id),
    KEY idx_survey_level_results_level (fitness_level_id),
    CONSTRAINT fk_survey_level_results_session FOREIGN KEY (session_id) REFERENCES survey_sessions (id),
    CONSTRAINT fk_survey_level_results_set FOREIGN KEY (rule_set_id) REFERENCES level_rule_sets (id),
    CONSTRAINT fk_survey_level_results_level FOREIGN KEY (fitness_level_id) REFERENCES fitness_levels (id),
    CONSTRAINT ck_survey_level_results_method CHECK (method IN ('RULES', 'FALLBACK', 'NONE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
