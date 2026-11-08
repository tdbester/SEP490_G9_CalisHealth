-- V65: how long auto-cleanup leaves a file alone after an admin restores it from the trash
-- (was a fixed 7 days in code). Editable on the "Upload limits" tab; 0 = only until the next run.
ALTER TABLE storage_settings
    ADD COLUMN restore_grace_days INT NOT NULL DEFAULT 7 AFTER trash_retention_days;
