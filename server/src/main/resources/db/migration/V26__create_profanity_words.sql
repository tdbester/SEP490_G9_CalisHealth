-- V26: Store database-managed profanity words for content moderation.
CREATE TABLE IF NOT EXISTS profanity_words (
    id         BIGINT NOT NULL AUTO_INCREMENT,
    word       VARCHAR(120) NOT NULL,
    language   VARCHAR(10) NOT NULL DEFAULT 'en',
    severity   VARCHAR(20) NOT NULL DEFAULT 'HIGH',
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_profanity_words_word_language (word, language),
    KEY idx_profanity_words_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO profanity_words (word, language, severity, is_active) VALUES
    ('ass', 'en', 'HIGH', TRUE),
    ('arse', 'en', 'HIGH', TRUE),
    ('fuck', 'en', 'HIGH', TRUE),
    ('shit', 'en', 'HIGH', TRUE),
    ('bitch', 'en', 'HIGH', TRUE),
    ('asshole', 'en', 'HIGH', TRUE),
    ('bastard', 'en', 'HIGH', TRUE),
    ('motherfucker', 'en', 'HIGH', TRUE),
    ('stupid', 'en', 'MEDIUM', TRUE),
    ('kill yourself', 'en', 'HIGH', TRUE),
    ('kill him', 'en', 'HIGH', TRUE),
    ('kill her', 'en', 'HIGH', TRUE),
    ('murder', 'en', 'HIGH', TRUE),
    ('rape', 'en', 'HIGH', TRUE),
    ('stab someone', 'en', 'HIGH', TRUE),
    ('địt', 'vi', 'HIGH', TRUE),
    ('đụ', 'vi', 'HIGH', TRUE),
    ('đéo', 'vi', 'HIGH', TRUE),
    ('lồn', 'vi', 'HIGH', TRUE),
    ('cặc', 'vi', 'HIGH', TRUE),
    ('đĩ', 'vi', 'HIGH', TRUE),
    ('đồ chó', 'vi', 'HIGH', TRUE),
    ('đồ khốn', 'vi', 'HIGH', TRUE),
    ('giết người', 'vi', 'HIGH', TRUE),
    ('giết chết', 'vi', 'HIGH', TRUE),
    ('đâm chết', 'vi', 'HIGH', TRUE),
    ('bắn chết', 'vi', 'HIGH', TRUE),
    ('tự sát', 'vi', 'HIGH', TRUE)
ON DUPLICATE KEY UPDATE word = VALUES(word);
