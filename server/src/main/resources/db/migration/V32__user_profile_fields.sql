-- V29: Profile Information screen shared by MEMBER, CONTENT_MANAGER and ADMIN.
--
-- Until now only member_profiles carried "personal details", so a Content Manager or an Admin
-- had nowhere to store a phone number, a birthday or a bio. The editable profile fields therefore
-- live on `users` (one row per account) instead of duplicating a profile table per role:
--
--   phone        : free text, keeps the leading 0 / +84 the member typed
--   gender       : Male | Female | Other | Prefer not to say
--   date_of_birth: used to show the age
--   bio          : short self introduction
--   avatar_url   : /media/profile-avatars/<uuid>.<ext> served by the backend
--
-- password_changed_at backs the "Last changed" line of the Security & sign-in section.
--
-- member_profiles keeps the fitness data (weight, height, level, streak). When a MEMBER saves the
-- profile screen the two tables are kept in sync by ProfileService, and this migration copies the
-- values that already existed so nothing disappears from the member's screen.
--
-- Every column is added through an information_schema guard, the same way V25 does it: the
-- development databases already had these columns before this migration existed, and MySQL 8.0
-- has no ADD COLUMN IF NOT EXISTS.

SET @db := DATABASE();

-- 1. users.phone
SET @has_phone := (SELECT COUNT(*) FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'phone');
SET @sql := IF(@has_phone = 0,
               'ALTER TABLE users ADD COLUMN phone VARCHAR(30) DEFAULT NULL AFTER full_name',
               'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. users.gender
SET @has_gender := (SELECT COUNT(*) FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'gender');
SET @sql := IF(@has_gender = 0,
               'ALTER TABLE users ADD COLUMN gender VARCHAR(20) DEFAULT NULL AFTER phone',
               'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. users.date_of_birth
SET @has_dob := (SELECT COUNT(*) FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'date_of_birth');
SET @sql := IF(@has_dob = 0,
               'ALTER TABLE users ADD COLUMN date_of_birth DATE DEFAULT NULL AFTER gender',
               'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. users.bio
SET @has_bio := (SELECT COUNT(*) FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'bio');
SET @sql := IF(@has_bio = 0,
               'ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL AFTER date_of_birth',
               'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. users.avatar_url
SET @has_avatar := (SELECT COUNT(*) FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar_url');
SET @sql := IF(@has_avatar = 0,
               'ALTER TABLE users ADD COLUMN avatar_url VARCHAR(1000) DEFAULT NULL AFTER bio',
               'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6. users.password_changed_at
SET @has_pwd_changed := (SELECT COUNT(*) FROM information_schema.COLUMNS
                         WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_changed_at');
SET @sql := IF(@has_pwd_changed = 0,
               'ALTER TABLE users ADD COLUMN password_changed_at DATETIME(6) DEFAULT NULL AFTER must_change_password',
               'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Keep what members already filled in through the onboarding survey.
UPDATE users u
    JOIN member_profiles mp ON mp.user_id = u.id
SET u.gender        = COALESCE(u.gender, mp.gender),
    u.date_of_birth = COALESCE(u.date_of_birth, mp.date_of_birth),
    u.bio           = COALESCE(u.bio, mp.bio),
    u.avatar_url    = COALESCE(u.avatar_url, mp.avatar_url);

-- Existing accounts: the password was last set when the account was created.
UPDATE users
SET password_changed_at = COALESCE(created_at, CURRENT_TIMESTAMP(6))
WHERE password_changed_at IS NULL;
