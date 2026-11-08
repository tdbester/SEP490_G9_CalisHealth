UPDATE notifications
SET target_audience = CASE
    WHEN target_audience = 'ALL_MEMBERS' THEN 'MEMBER'
    WHEN target_audience IN ('ALL_USERS', 'GLOBAL', 'ALL_ROLES') THEN 'SYSTEM_WIDE'
    ELSE target_audience
END;

ALTER TABLE notifications
    MODIFY COLUMN target_audience VARCHAR(32) NOT NULL DEFAULT 'MEMBER';
