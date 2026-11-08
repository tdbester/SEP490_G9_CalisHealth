-- V37: AI Support — lượt dùng quota theo ngày + lịch sử hội thoại.
--
-- Mỗi member được hỏi tối đa 15 câu/ngày với AI Support (màn popup trong
-- /session/result). Quota reset mỗi ngày theo giờ server.
--
-- Bảng ai_support_usage: 1 dòng cho mỗi (user, ngày) — đếm số câu đã hỏi.
-- Bảng ai_support_messages: lưu từng cặp hỏi/đáp để member xem lại lịch sử
-- trong ngày và để admin thống kê câu hỏi phổ biến.

CREATE TABLE IF NOT EXISTS ai_support_usage (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    user_id       BIGINT       NOT NULL,
    usage_date    DATE         NOT NULL,
    question_count INT         NOT NULL DEFAULT 0,
    total_tokens  INT          NOT NULL DEFAULT 0,
    created_at    DATETIME(6)  NOT NULL,
    updated_at    DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_ai_support_usage_user_day UNIQUE (user_id, usage_date),
    CONSTRAINT fk_ai_support_usage_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS ai_support_messages (
    id           BIGINT      NOT NULL AUTO_INCREMENT,
    user_id      BIGINT      NOT NULL,
    exercise_id  BIGINT      NULL,
    question     TEXT        NOT NULL,
    answer       TEXT        NOT NULL,
    total_tokens INT         NOT NULL DEFAULT 0,
    created_at   DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_ai_support_message_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_ai_support_message_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id)
) ENGINE = InnoDB;

CREATE INDEX idx_ai_support_messages_user_created
    ON ai_support_messages (user_id, created_at);
