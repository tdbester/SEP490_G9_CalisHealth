-- V19: Activity logs behind the admin "User Detail & Activity Log" screen.
--   user_activity_logs : events of one account (sign-in, account changes, and later
--                        notification / maintenance / storage / moderation events).
--   admin_action_logs  : what an admin did to another account (create, activate, deactivate).
-- Member events that already live in other tables (skills, assessment, body metrics, workouts)
-- are read from those tables directly and are NOT copied here.
-- Rows are only ever appended; accounts are never hard-deleted.

CREATE TABLE IF NOT EXISTS user_activity_logs (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    user_id     BIGINT       NOT NULL,
    event_type  VARCHAR(30)  NOT NULL,  -- LOGIN | ACCOUNT | NOTIFICATION | MAINTENANCE | STORAGE | MODERATION
    description VARCHAR(500) NOT NULL,
    status      VARCHAR(20)  NOT NULL DEFAULT 'SUCCESS',  -- SUCCESS | FAILED | WARNING | INFO | SCHEDULED
    created_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_user_activity_logs_user_time (user_id, created_at),
    KEY idx_user_activity_logs_user_type (user_id, event_type),
    CONSTRAINT fk_user_activity_logs_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT ck_user_activity_logs_status CHECK (status IN ('SUCCESS', 'FAILED', 'WARNING', 'INFO', 'SCHEDULED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admin_action_logs (
    id             BIGINT      NOT NULL AUTO_INCREMENT,
    admin_id       BIGINT      NOT NULL,
    target_user_id BIGINT      NOT NULL,
    action         VARCHAR(30) NOT NULL,  -- CREATE_ACCOUNT | ACTIVATE | DEACTIVATE
    status         VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    created_at     DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_admin_action_logs_admin_time (admin_id, created_at),
    KEY idx_admin_action_logs_target (target_user_id),
    CONSTRAINT fk_admin_action_logs_admin FOREIGN KEY (admin_id) REFERENCES users (id),
    CONSTRAINT fk_admin_action_logs_target FOREIGN KEY (target_user_id) REFERENCES users (id),
    CONSTRAINT ck_admin_action_logs_action CHECK (action IN ('CREATE_ACCOUNT', 'ACTIVATE', 'DEACTIVATE')),
    CONSTRAINT ck_admin_action_logs_status CHECK (status IN ('SUCCESS', 'FAILED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
