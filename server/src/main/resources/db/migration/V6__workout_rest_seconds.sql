SET @column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'workout_entries'
      AND COLUMN_NAME = 'rest_seconds'
);

SET @ddl := IF(
    @column_exists = 0,
    'ALTER TABLE workout_entries ADD COLUMN rest_seconds INT NOT NULL DEFAULT 60',
    'SELECT 1'
);
PREPARE add_rest_seconds FROM @ddl;
EXECUTE add_rest_seconds;
DEALLOCATE PREPARE add_rest_seconds;

SET @column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'workout_entries'
      AND COLUMN_NAME = 'content'
);

SET @ddl := IF(
    @column_exists > 0,
    'ALTER TABLE workout_entries DROP COLUMN content',
    'SELECT 1'
);
PREPARE drop_workout_content FROM @ddl;
EXECUTE drop_workout_content;
DEALLOCATE PREPARE drop_workout_content;

SET @column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'exercises'
      AND COLUMN_NAME = 'moderation_status'
);

SET @ddl := IF(
    @column_exists = 0,
    'ALTER TABLE exercises CHANGE COLUMN status moderation_status VARCHAR(40)',
    'SELECT 1'
);
PREPARE rename_exercise_status FROM @ddl;
EXECUTE rename_exercise_status;
DEALLOCATE PREPARE rename_exercise_status;

SET @column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'workout_entries'
      AND COLUMN_NAME = 'source'
);

SET @ddl := IF(
    @column_exists = 0,
    'ALTER TABLE workout_entries ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT ''SYSTEM''',
    'SELECT 1'
);
PREPARE add_workout_source FROM @ddl;
EXECUTE add_workout_source;
DEALLOCATE PREPARE add_workout_source;

UPDATE workout_entries w
LEFT JOIN users u ON u.id = w.created_by
SET w.source = CASE
    WHEN LEFT(w.code, 4) = 'SYS_' THEN 'SYSTEM'
    WHEN u.role = 'MEMBER' THEN 'CUSTOM'
    ELSE 'SYSTEM'
END;
