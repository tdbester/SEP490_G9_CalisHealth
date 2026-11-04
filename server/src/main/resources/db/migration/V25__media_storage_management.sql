-- V25: Admin > Media storage & infrastructure (SGC-186).
--
-- media_files becomes the registry of every uploaded exercise video / anatomy image, so the admin
-- can see what uses the storage and clean it up. Lifecycle of a file (status):
--   ACTIVE   -> still linked to an exercise
--   ORPHANED -> no longer linked (replaced, exercise deleted, upload not saved); kept for a grace period
--   REJECTED -> belongs to a member exercise rejected by moderation; kept so the member can resubmit
--   TRASHED  -> soft-deleted: the file is still on disk and can be restored until purge_at
--   PURGED   -> the file was removed from disk; the row stays for history and storage statistics
-- Rows with category NULL (e.g. avatars) are not managed by the storage screen.

ALTER TABLE media_files
    ADD COLUMN original_name   VARCHAR(255) DEFAULT NULL AFTER file_url,
    ADD COLUMN size_bytes      BIGINT       NOT NULL DEFAULT 0 AFTER size_mb,
    ADD COLUMN category        VARCHAR(30)  DEFAULT NULL AFTER purpose,   -- DEMO_VIDEO | FORM_CHECK_VIDEO | ANATOMY_IMAGE
    ADD COLUMN source          VARCHAR(20)  DEFAULT NULL AFTER category,  -- SYSTEM | MEMBER
    ADD COLUMN content_hash    CHAR(64)     DEFAULT NULL,                 -- SHA-256, identical uploads share one file
    ADD COLUMN previous_status VARCHAR(20)  DEFAULT NULL,                 -- status before TRASHED, used by restore
    ADD COLUMN reason          VARCHAR(255) DEFAULT NULL,                 -- why the file became ORPHANED / REJECTED
    ADD COLUMN inactive_since  DATETIME(6)  DEFAULT NULL,
    ADD COLUMN deletable_at    DATETIME(6)  DEFAULT NULL,                 -- end of the grace / retention period
    ADD COLUMN expires_at      DATETIME(6)  DEFAULT NULL,                 -- form-check videos only
    ADD COLUMN trashed_at      DATETIME(6)  DEFAULT NULL,
    ADD COLUMN trashed_by      BIGINT       DEFAULT NULL,                 -- NULL = moved by the daily auto-cleanup
    ADD COLUMN purge_at        DATETIME(6)  DEFAULT NULL,
    ADD COLUMN purged_at       DATETIME(6)  DEFAULT NULL,
    ADD KEY idx_media_files_status (status, deletable_at),
    ADD KEY idx_media_files_hash (content_hash),
    ADD KEY idx_media_files_uploader_status (uploaded_by, status),
    ADD CONSTRAINT fk_media_files_trashed_by FOREIGN KEY (trashed_by) REFERENCES users (id);

-- Single-row configuration edited on the "Upload limits" tab (id is always 1).
CREATE TABLE IF NOT EXISTS storage_settings (
    id                        INT          NOT NULL,
    max_video_mb              INT          NOT NULL DEFAULT 100,
    max_image_mb              INT          NOT NULL DEFAULT 10,
    video_formats             VARCHAR(100) NOT NULL DEFAULT 'MP4,MOV,WEBM',
    image_formats             VARCHAR(100) NOT NULL DEFAULT 'JPG,PNG,WEBP',
    form_check_max_seconds    INT          NOT NULL DEFAULT 60,
    demo_max_seconds          INT          NOT NULL DEFAULT 180,
    member_quota_mb           INT          NOT NULL DEFAULT 300,
    uploads_per_day           INT          NOT NULL DEFAULT 10,
    form_check_retention_days INT          NOT NULL DEFAULT 7,
    rejected_retention_days   INT          NOT NULL DEFAULT 30,
    orphan_grace_hours        INT          NOT NULL DEFAULT 24,
    trash_retention_days      INT          NOT NULL DEFAULT 7,
    auto_cleanup_enabled      BOOLEAN      NOT NULL DEFAULT TRUE,
    quota_gb                  INT          NOT NULL DEFAULT 5,
    warning_percent           INT          NOT NULL DEFAULT 80,
    critical_percent          INT          NOT NULL DEFAULT 90,
    last_cleanup_at           DATETIME(6)  DEFAULT NULL,
    last_cleanup_freed_bytes  BIGINT       NOT NULL DEFAULT 0,
    updated_by                BIGINT       DEFAULT NULL,
    updated_at                DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT fk_storage_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users (id),
    CONSTRAINT ck_storage_settings_single_row CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO storage_settings (id) VALUES (1);
