ALTER TABLE notifications
    ADD COLUMN user_id BIGINT NULL,
    ADD KEY idx_notifications_user_status_created (user_id, status, created_at),
    ADD CONSTRAINT fk_notifications_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE;
