-- V17: Move the seeded ADMIN account (admin@calishealth.com) to id = 1.
-- Every user whose id is lower than the admin's id is shifted up by 1 (keeping their relative order),
-- so nobody is swapped and no account is deleted. Users above the admin's id are untouched.
-- V16 is left untouched (it is already applied; editing it would break Flyway checksum validation).
--
-- Example: admin 13, others 1,2,3,4,5,11,12  ->  admin 1, others 2,3,4,5,6,12,13.
--
-- Safe on every database state:
--   * admin missing or already id 1  -> no-op
--   * otherwise                      -> admin moves to 1, lower ids shift +1
--
-- Every column that references users.id is updated together with users:
--   auth_tokens.user_id, exercises.created_by, media_files.uploaded_by,
--   member_profiles.user_id, survey_sessions.user_id, workout_entries.created_by,
--   survey_steps.updated_by, fitness_levels.updated_by
-- If a new table gets a foreign key to users, handle it in a NEW migration.

SET @admin_id = COALESCE((SELECT id FROM users WHERE email = 'admin@calishealth.com'), 0);
SET @tmp_id = (SELECT MAX(id) FROM users) + 1;

SET FOREIGN_KEY_CHECKS = 0;

-- Step 1: park admin on a free temporary id.
UPDATE auth_tokens      SET user_id     = @tmp_id WHERE user_id     = @admin_id;
UPDATE exercises        SET created_by  = @tmp_id WHERE created_by  = @admin_id;
UPDATE media_files      SET uploaded_by = @tmp_id WHERE uploaded_by = @admin_id;
UPDATE member_profiles  SET user_id     = @tmp_id WHERE user_id     = @admin_id;
UPDATE survey_sessions  SET user_id     = @tmp_id WHERE user_id     = @admin_id;
UPDATE workout_entries  SET created_by  = @tmp_id WHERE created_by  = @admin_id;
UPDATE survey_steps     SET updated_by  = @tmp_id WHERE updated_by  = @admin_id;
UPDATE fitness_levels   SET updated_by  = @tmp_id WHERE updated_by  = @admin_id;
UPDATE users            SET id          = @tmp_id WHERE id          = @admin_id;

-- Step 2: shift every lower id up by 1. Highest id first so a unique key never collides.
UPDATE auth_tokens      SET user_id     = user_id + 1     WHERE user_id     < @admin_id ORDER BY user_id     DESC;
UPDATE exercises        SET created_by  = created_by + 1  WHERE created_by  < @admin_id ORDER BY created_by  DESC;
UPDATE media_files      SET uploaded_by = uploaded_by + 1 WHERE uploaded_by < @admin_id ORDER BY uploaded_by DESC;
UPDATE member_profiles  SET user_id     = user_id + 1     WHERE user_id     < @admin_id ORDER BY user_id     DESC;
UPDATE survey_sessions  SET user_id     = user_id + 1     WHERE user_id     < @admin_id ORDER BY user_id     DESC;
UPDATE workout_entries  SET created_by  = created_by + 1  WHERE created_by  < @admin_id ORDER BY created_by  DESC;
UPDATE survey_steps     SET updated_by  = updated_by + 1  WHERE updated_by  < @admin_id ORDER BY updated_by  DESC;
UPDATE fitness_levels   SET updated_by  = updated_by + 1  WHERE updated_by  < @admin_id ORDER BY updated_by  DESC;
UPDATE users            SET id          = id + 1          WHERE id          < @admin_id ORDER BY id          DESC;

-- Step 3: admin takes id 1.
UPDATE auth_tokens      SET user_id     = 1 WHERE user_id     = @tmp_id AND @admin_id > 0;
UPDATE exercises        SET created_by  = 1 WHERE created_by  = @tmp_id AND @admin_id > 0;
UPDATE media_files      SET uploaded_by = 1 WHERE uploaded_by = @tmp_id AND @admin_id > 0;
UPDATE member_profiles  SET user_id     = 1 WHERE user_id     = @tmp_id AND @admin_id > 0;
UPDATE survey_sessions  SET user_id     = 1 WHERE user_id     = @tmp_id AND @admin_id > 0;
UPDATE workout_entries  SET created_by  = 1 WHERE created_by  = @tmp_id AND @admin_id > 0;
UPDATE survey_steps     SET updated_by  = 1 WHERE updated_by  = @tmp_id AND @admin_id > 0;
UPDATE fitness_levels   SET updated_by  = 1 WHERE updated_by  = @tmp_id AND @admin_id > 0;
UPDATE users            SET id          = 1 WHERE id          = @tmp_id AND @admin_id > 0;

SET FOREIGN_KEY_CHECKS = 1;
