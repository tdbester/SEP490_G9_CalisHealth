SET @rejection_reason_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'exercise_moderation_history'
      AND column_name = 'rejection_reason'
);

SET @add_rejection_reason_sql := IF(
    @rejection_reason_exists = 0,
    'ALTER TABLE exercise_moderation_history ADD COLUMN rejection_reason TEXT DEFAULT NULL AFTER decision',
    'SELECT 1'
);

PREPARE add_rejection_reason_statement FROM @add_rejection_reason_sql;
EXECUTE add_rejection_reason_statement;
DEALLOCATE PREPARE add_rejection_reason_statement;
