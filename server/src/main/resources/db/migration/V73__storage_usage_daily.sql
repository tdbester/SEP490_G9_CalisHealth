-- V73: real storage usage of the Cloudinary account.
--
-- media_files only knows the files this app manages, so it cannot answer how much space the
-- account really uses, how much bandwidth was delivered or how many credits are left. These
-- numbers come from the Cloudinary Admin API and are snapshotted here once a day, so the Storage
-- screen can draw a real history instead of a number it made up itself.

CREATE TABLE IF NOT EXISTS storage_usage_daily (
    day              DATE         NOT NULL,
    storage_used     BIGINT       NOT NULL DEFAULT 0,  -- bytes stored in the Cloudinary account
    storage_limit    BIGINT       NOT NULL DEFAULT 0,  -- bytes the plan allows (0 = unlimited)
    bandwidth_used   BIGINT       NOT NULL DEFAULT 0,  -- bytes delivered through the CDN this period
    bandwidth_limit  BIGINT       NOT NULL DEFAULT 0,
    credits_used     DECIMAL(10, 2) NOT NULL DEFAULT 0,
    credits_limit    DECIMAL(10, 2) NOT NULL DEFAULT 0,
    registry_bytes   BIGINT       NOT NULL DEFAULT 0,  -- sum(size_bytes) of media_files, for comparison
    plan_name        VARCHAR(100) DEFAULT NULL,
    alert_level      VARCHAR(20)  DEFAULT NULL,        -- WARNING | CRITICAL: the admins were already told
    synced_at        DATETIME(6)  NOT NULL,
    PRIMARY KEY (day)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- The daily snapshot may be written again for the same day (the job also runs on startup).
CREATE INDEX idx_storage_usage_daily_synced ON storage_usage_daily (synced_at);
