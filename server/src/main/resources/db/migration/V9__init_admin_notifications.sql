CREATE TABLE IF NOT EXISTS notifications (
    id         BIGINT NOT NULL AUTO_INCREMENT,
    title      VARCHAR(255) NOT NULL,
    message    TEXT NOT NULL,
    type       VARCHAR(50) NOT NULL,
    status     VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    created_by BIGINT DEFAULT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_notifications_type_created (type, created_at),
    KEY idx_notifications_status_created (status, created_at),
    CONSTRAINT fk_notifications_created_by FOREIGN KEY (created_by)
        REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO notifications (title, message, type, status, created_at, updated_at)
SELECT 'Scheduled maintenance: Database upgrade',
       'Member app will be unavailable from Oct 18, 02:00 to 03:00 UTC while we upgrade the database.',
       'MAINTENANCE', 'PUBLISHED', '2026-10-15 09:00:00', '2026-10-15 09:00:00'
WHERE NOT EXISTS (
    SELECT 1 FROM notifications WHERE title = 'Scheduled maintenance: Database upgrade'
);

INSERT INTO notifications (title, message, type, status, created_at, updated_at)
SELECT 'New skill roadmap: Front lever',
       'Follow the new Front lever roadmap to build straight-arm pulling strength step by step.',
       'UPDATE', 'PUBLISHED', '2026-10-10 09:00:00', '2026-10-10 09:00:00'
WHERE NOT EXISTS (
    SELECT 1 FROM notifications WHERE title = 'New skill roadmap: Front lever'
);

INSERT INTO notifications (title, message, type, status, created_at, updated_at)
SELECT 'Welcome to CalisHealth',
       'Your journey starts here. Explore exercises and create a training plan that works for you.',
       'ANNOUNCEMENT', 'PUBLISHED', '2026-09-20 09:00:00', '2026-09-20 09:00:00'
WHERE NOT EXISTS (
    SELECT 1 FROM notifications WHERE title = 'Welcome to CalisHealth'
);

INSERT INTO notifications (title, message, type, status, created_at, updated_at)
SELECT 'Holiday training challenge',
       'Train three days this week to earn a special badge and keep your streak going.',
       'ANNOUNCEMENT', 'DRAFT', '2026-10-14 09:00:00', '2026-10-14 09:00:00'
WHERE NOT EXISTS (
    SELECT 1 FROM notifications WHERE title = 'Holiday training challenge'
);
