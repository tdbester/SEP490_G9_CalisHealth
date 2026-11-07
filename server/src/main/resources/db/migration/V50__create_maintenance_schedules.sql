CREATE TABLE maintenance_schedules (
    id BIGINT NOT NULL AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    message TEXT NULL,
    starts_at DATETIME(6) NOT NULL,
    ends_at DATETIME(6) NOT NULL,
    notify_members BIT(1) NOT NULL DEFAULT b'1',
    reminder_hours INT NOT NULL DEFAULT 24,
    cancelled BIT(1) NOT NULL DEFAULT b'0',
    reminder_sent BIT(1) NOT NULL DEFAULT b'0',
    created_by BIGINT NULL,
    notification_id BIGINT NULL,
    reminder_notification_id BIGINT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_maintenance_schedules_notification (notification_id),
    UNIQUE KEY uk_maintenance_schedules_reminder_notification (reminder_notification_id),
    KEY idx_maintenance_schedules_window (starts_at, ends_at),
    CONSTRAINT fk_maintenance_schedules_created_by FOREIGN KEY (created_by)
        REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_maintenance_schedules_notification FOREIGN KEY (notification_id)
        REFERENCES notifications (id) ON DELETE SET NULL,
    CONSTRAINT fk_maintenance_schedules_reminder_notification FOREIGN KEY (reminder_notification_id)
        REFERENCES notifications (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE maintenance_schedule_areas (
    schedule_id BIGINT NOT NULL,
    area VARCHAR(40) NOT NULL,
    PRIMARY KEY (schedule_id, area),
    CONSTRAINT fk_maintenance_schedule_areas_schedule FOREIGN KEY (schedule_id)
        REFERENCES maintenance_schedules (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
