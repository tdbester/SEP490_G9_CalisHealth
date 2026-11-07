CREATE TABLE IF NOT EXISTS notification_reads (
    id              BIGINT NOT NULL AUTO_INCREMENT,
    user_id         BIGINT NOT NULL,
    notification_id BIGINT NOT NULL,
    read_at         DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_notification_reads_user_notification (user_id, notification_id),
    CONSTRAINT fk_notification_reads_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_notification_reads_notification FOREIGN KEY (notification_id)
        REFERENCES notifications (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
