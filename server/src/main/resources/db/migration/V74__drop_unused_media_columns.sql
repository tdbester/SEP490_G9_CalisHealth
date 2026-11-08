-- V74: remove the columns that only the form-check flow used.
--
-- The form check runs in the browser (MediaPipe), so no form-check video was ever uploaded: the
-- category "FORM_CHECK_VIDEO", the settings for its length and its retention, and the column
-- "expires_at" it used were never filled. Keeping them made the admin screen promise settings
-- that had no effect. The "purpose" column was dropped as well: it always held the same value as
-- "category".

ALTER TABLE media_files DROP COLUMN purpose;
ALTER TABLE media_files DROP COLUMN expires_at;

ALTER TABLE storage_settings DROP COLUMN form_check_max_seconds;
ALTER TABLE storage_settings DROP COLUMN form_check_retention_days;

-- The files of the removed category, if there ever were any, are treated as normal media.
UPDATE media_files SET category = 'DEMO_VIDEO' WHERE category = 'FORM_CHECK_VIDEO';
