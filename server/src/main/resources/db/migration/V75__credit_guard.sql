-- V75: credit guard.
--
-- The free plan of Cloudinary counts credits instead of bytes, so the account can run out of credits
-- long before it runs out of space. The existing thresholds (warning / critical) only tell the
-- admins; the guard also acts: when the account is critical, the media that is already deleted
-- (the trash) is purged right away instead of waiting for the retention period.
--
-- The guard is off by default: an admin turns it on when the account is close to its limit.

ALTER TABLE storage_settings
    ADD COLUMN credit_guard_enabled BOOLEAN NOT NULL DEFAULT FALSE AFTER auto_cleanup_enabled,
    ADD COLUMN credit_guard_threshold INT NOT NULL DEFAULT 90 AFTER credit_guard_enabled;
