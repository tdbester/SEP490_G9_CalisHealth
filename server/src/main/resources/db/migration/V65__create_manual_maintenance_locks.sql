-- Manual maintenance locks.
-- The maintenance schedule only notifies users; an admin locks the affected
-- service areas by hand when the maintenance window actually starts.
ALTER TABLE maintenance_schedules
    ADD COLUMN started_at DATETIME(6) NULL,
    ADD COLUMN completed_at DATETIME(6) NULL,
    ADD COLUMN started_by BIGINT NULL,
    ADD COLUMN completed_by BIGINT NULL;

CREATE TABLE maintenance_area_locks (
    id BIGINT NOT NULL AUTO_INCREMENT,
    area VARCHAR(40) NOT NULL,
    locked BIT(1) NOT NULL DEFAULT b'0',
    reason VARCHAR(255) NULL,
    schedule_id BIGINT NULL,
    locked_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    unlocked_at DATETIME(6) NULL,
    locked_by BIGINT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_maintenance_area_locks_area (area),
    CONSTRAINT fk_maintenance_area_locks_schedule FOREIGN KEY (schedule_id)
        REFERENCES maintenance_schedules (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO maintenance_area_locks (area, locked)
SELECT 'MEMBER_APP_ACCESS', b'0'
WHERE NOT EXISTS (SELECT 1 FROM maintenance_area_locks WHERE area = 'MEMBER_APP_ACCESS');

INSERT INTO maintenance_area_locks (area, locked)
SELECT 'MEMBER_VIDEO_UPLOADS', b'0'
WHERE NOT EXISTS (SELECT 1 FROM maintenance_area_locks WHERE area = 'MEMBER_VIDEO_UPLOADS');

INSERT INTO maintenance_area_locks (area, locked)
SELECT 'AI_POSE_ASSESSMENT', b'0'
WHERE NOT EXISTS (SELECT 1 FROM maintenance_area_locks WHERE area = 'AI_POSE_ASSESSMENT');

INSERT INTO maintenance_area_locks (area, locked)
SELECT 'SYSTEM_STORAGE_CDN', b'0'
WHERE NOT EXISTS (SELECT 1 FROM maintenance_area_locks WHERE area = 'SYSTEM_STORAGE_CDN');

INSERT INTO maintenance_area_locks (area, locked)
SELECT 'ADMIN_MANAGEMENT_PORTAL', b'0'
WHERE NOT EXISTS (SELECT 1 FROM maintenance_area_locks WHERE area = 'ADMIN_MANAGEMENT_PORTAL');
