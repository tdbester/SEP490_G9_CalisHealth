-- V13: Level benchmark scoring uses three exercise bands and a summed 3..9 score.
-- The guarded drops make this migration recoverable if a previous run stopped after
-- MySQL committed an ALTER TABLE before Flyway recorded V13 as successful.
SET @drop_old_range_check = (
    SELECT IF(COUNT(*) > 0,
        'ALTER TABLE benchmark_criteria DROP CHECK ck_benchmark_criteria_range',
        'SELECT 1')
    FROM information_schema.CHECK_CONSTRAINTS cc
    JOIN information_schema.TABLE_CONSTRAINTS tc
      ON tc.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA
     AND tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
     AND tc.TABLE_NAME = 'benchmark_criteria'
    WHERE cc.CONSTRAINT_SCHEMA = DATABASE()
      AND cc.CONSTRAINT_NAME = 'ck_benchmark_criteria_range'
);
PREPARE drop_old_range_check FROM @drop_old_range_check;
EXECUTE drop_old_range_check;
DEALLOCATE PREPARE drop_old_range_check;

SET @drop_v8_range_check = (
    SELECT IF(COUNT(*) > 0,
        'ALTER TABLE benchmark_criteria DROP CHECK ck_benchmark_criteria_range_v8',
        'SELECT 1')
    FROM information_schema.CHECK_CONSTRAINTS cc
    JOIN information_schema.TABLE_CONSTRAINTS tc
      ON tc.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA
     AND tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
     AND tc.TABLE_NAME = 'benchmark_criteria'
    WHERE cc.CONSTRAINT_SCHEMA = DATABASE()
      AND cc.CONSTRAINT_NAME = 'ck_benchmark_criteria_range_v8'
);
PREPARE drop_v8_range_check FROM @drop_v8_range_check;
EXECUTE drop_v8_range_check;
DEALLOCATE PREPARE drop_v8_range_check;

SET @add_max_value = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE benchmark_criteria ADD COLUMN max_value DECIMAL(10,2) DEFAULT NULL AFTER min_value',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'benchmark_criteria' AND COLUMN_NAME = 'max_value'
);
PREPARE add_max_value FROM @add_max_value;
EXECUTE add_max_value;
DEALLOCATE PREPARE add_max_value;

SET @add_benchmark_slot = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE benchmark_criteria ADD COLUMN benchmark_slot VARCHAR(32) DEFAULT NULL AFTER fitness_level_id',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'benchmark_criteria' AND COLUMN_NAME = 'benchmark_slot'
);
PREPARE add_benchmark_slot FROM @add_benchmark_slot;
EXECUTE add_benchmark_slot;
DEALLOCATE PREPARE add_benchmark_slot;

SET @add_benchmark_range_check = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE benchmark_criteria ADD CONSTRAINT ck_benchmark_criteria_range_v8 CHECK (max_value IS NULL OR max_value >= min_value)',
        'SELECT 1')
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'benchmark_criteria' AND CONSTRAINT_NAME = 'ck_benchmark_criteria_range_v8'
);
PREPARE add_benchmark_range_check FROM @add_benchmark_range_check;
EXECUTE add_benchmark_range_check;
DEALLOCATE PREPARE add_benchmark_range_check;

UPDATE benchmark_criteria bc
JOIN exercises e ON e.id = bc.exercise_id
SET bc.benchmark_slot = CASE LOWER(TRIM(e.name))
    WHEN 'push-up' THEN 'PUSH_UP'
    WHEN 'bodyweight squat' THEN 'SQUAT'
    WHEN 'plank' THEN 'PLANK'
    ELSE CONCAT('LEGACY-', bc.id)
END;

ALTER TABLE benchmark_criteria
MODIFY COLUMN benchmark_slot VARCHAR(32) NOT NULL;

SET @add_benchmark_slot_level_index = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE benchmark_criteria ADD KEY idx_benchmark_criteria_slot_level (fitness_level_id, benchmark_slot)',
        'SELECT 1')
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'benchmark_criteria' AND INDEX_NAME = 'idx_benchmark_criteria_slot_level'
);
PREPARE add_benchmark_slot_level_index FROM @add_benchmark_slot_level_index;
EXECUTE add_benchmark_slot_level_index;
DEALLOCATE PREPARE add_benchmark_slot_level_index;

SET @add_score_min = (
    SELECT IF(COUNT(*) = 0, 'ALTER TABLE fitness_levels ADD COLUMN score_min INT NOT NULL DEFAULT 0 AFTER name', 'SELECT 1')
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fitness_levels' AND COLUMN_NAME = 'score_min'
);
PREPARE add_score_min FROM @add_score_min;
EXECUTE add_score_min;
DEALLOCATE PREPARE add_score_min;

SET @add_score_max = (
    SELECT IF(COUNT(*) = 0, 'ALTER TABLE fitness_levels ADD COLUMN score_max INT NOT NULL DEFAULT 0 AFTER score_min', 'SELECT 1')
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fitness_levels' AND COLUMN_NAME = 'score_max'
);
PREPARE add_score_max FROM @add_score_max;
EXECUTE add_score_max;
DEALLOCATE PREPARE add_score_max;

SET @add_fitness_level_status = (
    SELECT IF(COUNT(*) = 0, 'ALTER TABLE fitness_levels ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT ''ACTIVE'' AFTER score_max', 'SELECT 1')
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fitness_levels' AND COLUMN_NAME = 'status'
);
PREPARE add_fitness_level_status FROM @add_fitness_level_status;
EXECUTE add_fitness_level_status;
DEALLOCATE PREPARE add_fitness_level_status;

SET @add_fitness_level_updated_at = (
    SELECT IF(COUNT(*) = 0, 'ALTER TABLE fitness_levels ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)', 'SELECT 1')
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fitness_levels' AND COLUMN_NAME = 'updated_at'
);
PREPARE add_fitness_level_updated_at FROM @add_fitness_level_updated_at;
EXECUTE add_fitness_level_updated_at;
DEALLOCATE PREPARE add_fitness_level_updated_at;

SET @add_fitness_level_updated_by = (
    SELECT IF(COUNT(*) = 0, 'ALTER TABLE fitness_levels ADD COLUMN updated_by BIGINT DEFAULT NULL', 'SELECT 1')
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fitness_levels' AND COLUMN_NAME = 'updated_by'
);
PREPARE add_fitness_level_updated_by FROM @add_fitness_level_updated_by;
EXECUTE add_fitness_level_updated_by;
DEALLOCATE PREPARE add_fitness_level_updated_by;

SET @add_fitness_level_updated_by_index = (
    SELECT IF(COUNT(*) = 0, 'ALTER TABLE fitness_levels ADD KEY idx_fitness_levels_updated_by (updated_by)', 'SELECT 1')
    FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fitness_levels' AND INDEX_NAME = 'idx_fitness_levels_updated_by'
);
PREPARE add_fitness_level_updated_by_index FROM @add_fitness_level_updated_by_index;
EXECUTE add_fitness_level_updated_by_index;
DEALLOCATE PREPARE add_fitness_level_updated_by_index;

SET @add_fitness_level_updated_by_fk = (
    SELECT IF(COUNT(*) = 0, 'ALTER TABLE fitness_levels ADD CONSTRAINT fk_fitness_levels_updated_by FOREIGN KEY (updated_by) REFERENCES users (id)', 'SELECT 1')
    FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'fitness_levels' AND CONSTRAINT_NAME = 'fk_fitness_levels_updated_by'
);
PREPARE add_fitness_level_updated_by_fk FROM @add_fitness_level_updated_by_fk;
EXECUTE add_fitness_level_updated_by_fk;
DEALLOCATE PREPARE add_fitness_level_updated_by_fk;

SET @add_fitness_level_score_check = (
    SELECT IF(COUNT(*) = 0, 'ALTER TABLE fitness_levels ADD CONSTRAINT ck_fitness_levels_score_range CHECK (score_min <= score_max)', 'SELECT 1')
    FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'fitness_levels' AND CONSTRAINT_NAME = 'ck_fitness_levels_score_range'
);
PREPARE add_fitness_level_score_check FROM @add_fitness_level_score_check;
EXECUTE add_fitness_level_score_check;
DEALLOCATE PREPARE add_fitness_level_score_check;

SET @add_fitness_level_status_check = (
    SELECT IF(COUNT(*) = 0, 'ALTER TABLE fitness_levels ADD CONSTRAINT ck_fitness_levels_status CHECK (status IN (''ACTIVE'', ''INACTIVE''))', 'SELECT 1')
    FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'fitness_levels' AND CONSTRAINT_NAME = 'ck_fitness_levels_status'
);
PREPARE add_fitness_level_status_check FROM @add_fitness_level_status_check;
EXECUTE add_fitness_level_status_check;
DEALLOCATE PREPARE add_fitness_level_status_check;

UPDATE fitness_levels
SET score_min = CASE name
        WHEN 'Beginner' THEN 3
        WHEN 'Intermediate' THEN 5
        WHEN 'Advanced' THEN 8
        ELSE score_min
    END,
    score_max = CASE name
        WHEN 'Beginner' THEN 4
        WHEN 'Intermediate' THEN 7
        WHEN 'Advanced' THEN 9
        ELSE score_max
    END;

-- Normalize the three onboarding tests to the units used by the benchmark editor.
UPDATE exercises
SET category = CASE name
        WHEN 'Push-up' THEN 'REPS'
        WHEN 'Bodyweight Squat' THEN 'REPS'
        WHEN 'Plank' THEN 'HOLD'
        ELSE category
    END,
    duration = CASE
        WHEN name = 'Plank' THEN COALESCE(duration, default_reps, 45)
        ELSE duration
    END,
    default_reps = CASE WHEN name = 'Plank' THEN NULL ELSE default_reps END
WHERE name IN ('Push-up', 'Bodyweight Squat', 'Plank');

-- Replace the legacy threshold rows for these three exercises with non-overlapping bands.
DELETE bc FROM benchmark_criteria bc
JOIN exercises e ON e.id = bc.exercise_id
WHERE LOWER(TRIM(e.name)) IN ('push-up', 'bodyweight squat', 'plank');

INSERT INTO benchmark_criteria (min_value, max_value, criterion_weight, exercise_id, fitness_level_id, benchmark_slot)
SELECT seed.min_value, seed.max_value, 1.000, e.id, fl.id, seed.benchmark_slot
FROM (
    SELECT 'PUSH_UP' AS benchmark_slot, 'Push-up' AS exercise_name, 'Beginner' AS level_name, 1 AS min_value, 19 AS max_value
    UNION ALL SELECT 'PUSH_UP', 'Push-up', 'Intermediate', 20, 40
    UNION ALL SELECT 'PUSH_UP', 'Push-up', 'Advanced', 41, NULL
    UNION ALL SELECT 'SQUAT', 'Bodyweight Squat', 'Beginner', 1, 29
    UNION ALL SELECT 'SQUAT', 'Bodyweight Squat', 'Intermediate', 30, 60
    UNION ALL SELECT 'SQUAT', 'Bodyweight Squat', 'Advanced', 61, NULL
    UNION ALL SELECT 'PLANK', 'Plank', 'Beginner', 1, 44
    UNION ALL SELECT 'PLANK', 'Plank', 'Intermediate', 45, 90
    UNION ALL SELECT 'PLANK', 'Plank', 'Advanced', 91, NULL
) seed
JOIN exercises e ON LOWER(TRIM(e.name)) = LOWER(TRIM(seed.exercise_name))
JOIN fitness_levels fl ON fl.name = seed.level_name;

-- Preserve FK support on the legacy column pair before replacing its unique index.
SET @add_legacy_fk_support_index = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE benchmark_criteria ADD KEY idx_benchmark_criteria_exercise_level (exercise_id, fitness_level_id)',
        'SELECT 1')
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'benchmark_criteria'
      AND INDEX_NAME = 'idx_benchmark_criteria_exercise_level'
);
PREPARE add_legacy_fk_support_index FROM @add_legacy_fk_support_index;
EXECUTE add_legacy_fk_support_index;
DEALLOCATE PREPARE add_legacy_fk_support_index;

SET @drop_legacy_benchmark_unique = (
    SELECT IF(COUNT(*) > 0,
        'ALTER TABLE benchmark_criteria DROP INDEX uk_benchmark_criteria',
        'SELECT 1')
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'benchmark_criteria'
      AND INDEX_NAME = 'uk_benchmark_criteria'
);
PREPARE drop_legacy_benchmark_unique FROM @drop_legacy_benchmark_unique;
EXECUTE drop_legacy_benchmark_unique;
DEALLOCATE PREPARE drop_legacy_benchmark_unique;

SET @add_level_slot_min_unique = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE benchmark_criteria ADD UNIQUE KEY uk_benchmark_criteria_level_slot_min (fitness_level_id, benchmark_slot, min_value)',
        'SELECT 1')
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'benchmark_criteria'
      AND INDEX_NAME = 'uk_benchmark_criteria_level_slot_min'
);
PREPARE add_level_slot_min_unique FROM @add_level_slot_min_unique;
EXECUTE add_level_slot_min_unique;
DEALLOCATE PREPARE add_level_slot_min_unique;
