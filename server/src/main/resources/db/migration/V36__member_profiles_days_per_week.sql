-- V36: member_profiles.days_per_week — target training days per week.
--
-- MemberProfile (Java entity) gained a `daysPerWeek` field: the onboarding survey
-- writes it and the "Recommended plan" screen reads it to pick how many training
-- days a week the member can commit to.
--
-- The column was missing from the schema, so every read of member_profiles failed
-- with "Unknown column 'mp1_0.days_per_week' in 'field list'".
--
-- Added here (instead of editing an already applied migration) so existing databases
-- pick it up through a normal Flyway run.
--
-- Default 3 matches the entity default and the "3 days/week" plan templates seeded
-- in V24, so members who have not answered the survey yet keep a sensible value.

SET @db := DATABASE();

SET @has_days_per_week := (SELECT COUNT(*) FROM information_schema.COLUMNS
                            WHERE TABLE_SCHEMA = @db
                              AND TABLE_NAME = 'member_profiles'
                              AND COLUMN_NAME = 'days_per_week');
SET @sql := IF(@has_days_per_week = 0,
               'ALTER TABLE member_profiles
                   ADD COLUMN days_per_week INT NOT NULL DEFAULT 3 AFTER fitness_level_id',
               'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
