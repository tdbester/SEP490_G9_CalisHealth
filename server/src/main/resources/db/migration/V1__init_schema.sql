-- V1: Minimal init schema for CalisHealth.
-- Chỉ 2 bảng `users` và `auth_tokens` đủ cho chức năng auth hiện có.
-- Theo chiến lược "cuốn gói": mỗi chức năng sau sẽ thêm migration riêng (V2__, V3__...).
-- Tên cột khớp 1-1 với @Column(name=...) trong User.java và AuthToken.java.

-- ============================================================
-- 1. USERS
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

-- ============================================================
-- 2. AUTH_TOKENS
-- ============================================================
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
