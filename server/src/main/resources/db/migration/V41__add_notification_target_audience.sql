ALTER TABLE notifications
    ADD COLUMN target_audience VARCHAR(32) NOT NULL DEFAULT 'ALL_MEMBERS';

UPDATE notifications
SET target_audience = CASE
    WHEN user_id IS NULL THEN 'ALL_MEMBERS'
    ELSE 'SPECIFIC_USER'
END;

CREATE INDEX idx_notifications_audience_status_created
    ON notifications (target_audience, status, created_at);
