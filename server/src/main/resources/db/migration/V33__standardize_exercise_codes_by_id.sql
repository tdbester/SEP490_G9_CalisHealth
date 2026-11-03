CREATE TEMPORARY TABLE exercise_code_migration_map (
    exercise_id BIGINT NOT NULL PRIMARY KEY,
    old_code VARCHAR(30) NOT NULL,
    new_code VARCHAR(30) NOT NULL,
    temporary_code VARCHAR(30) NOT NULL,
    UNIQUE KEY uk_exercise_code_migration_old (old_code),
    UNIQUE KEY uk_exercise_code_migration_temporary (temporary_code)
) ENGINE=MEMORY;

INSERT INTO exercise_code_migration_map (exercise_id, old_code, new_code, temporary_code)
SELECT id,
       code,
       CONCAT(CASE WHEN UPPER(source) = 'SYSTEM' THEN 'EX_' ELSE 'CU_' END, id),
       CONCAT('MIG_', LEFT(REPLACE(UUID(), '-', ''), 24))
FROM exercises;

UPDATE exercises e
JOIN exercise_code_migration_map m ON m.exercise_id = e.id
SET e.code = m.temporary_code;

UPDATE exercise_moderation_history h
JOIN exercise_code_migration_map m ON m.old_code = h.exercise_code
SET h.exercise_code = m.new_code;

UPDATE exercises e
JOIN exercise_code_migration_map m ON m.exercise_id = e.id
SET e.code = m.new_code;

DROP TEMPORARY TABLE exercise_code_migration_map;
