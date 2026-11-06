-- V39: AI Support — bộ đếm lượt theo phiên chat.
--
-- Bảng ai_support_sessions giữ 1 dòng cho mỗi (user, session id) với số câu
-- đã hỏi trong phiên đó. Server khóa dòng này (SELECT ... FOR UPDATE) trước
-- khi đếm lượt -> các request song song xếp hàng lại nhau, không vượt quá giới
-- hạn 5 câu/phiên.
--
-- Đếm trực tiếp trên ai_support_messages không an toàn: SELECT COUNT(*) là
-- consistent read theo snapshot của transaction nên không nhìn thấy các dòng
-- mà request song song vừa insert.

CREATE TABLE IF NOT EXISTS ai_support_sessions (
    id             BIGINT      NOT NULL AUTO_INCREMENT,
    user_id        BIGINT      NOT NULL,
    session_id     VARCHAR(64) NOT NULL,
    question_count INT         NOT NULL DEFAULT 0,
    created_at     DATETIME(6) NOT NULL,
    updated_at     DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_ai_support_sessions_user_session UNIQUE (user_id, session_id),
    CONSTRAINT fk_ai_support_sessions_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE = InnoDB;

CREATE INDEX idx_ai_support_sessions_user
    ON ai_support_sessions (user_id, created_at);
