-- Use moderation_status as the single source of truth and merge duplicate
-- system exercises into the earliest seeded record before removing copies.

SET @has_exercise_status := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'exercises'
      AND COLUMN_NAME = 'status'
);
SET @sql := IF(@has_exercise_status > 0,
    'UPDATE exercises
     SET moderation_status = CASE
         WHEN moderation_status IS NULL OR TRIM(moderation_status) = '''' THEN
             CASE UPPER(status)
                 WHEN ''ACCEPTED'' THEN ''ACTIVE''
                 WHEN ''PENDING'' THEN ''PENDING''
                 WHEN ''REJECTED'' THEN ''REJECTED''
                 ELSE UPPER(status)
             END
         ELSE moderation_status
     END',
    'DO 0');
PREPARE backfill_exercise_moderation_status FROM @sql;
EXECUTE backfill_exercise_moderation_status;
DEALLOCATE PREPARE backfill_exercise_moderation_status;

CREATE TEMPORARY TABLE exercise_id_merge_map (
    duplicate_id BIGINT NOT NULL PRIMARY KEY,
    canonical_id BIGINT NOT NULL
) ENGINE=MEMORY;

INSERT INTO exercise_id_merge_map (duplicate_id, canonical_id)
SELECT duplicate.id, MIN(canonical.id)
FROM exercises duplicate
JOIN exercises canonical
  ON canonical.source = 'SYSTEM'
 AND duplicate.source = 'SYSTEM'
 AND UPPER(canonical.type) = UPPER(duplicate.type)
 AND LOWER(TRIM(canonical.name)) = LOWER(TRIM(duplicate.name))
 AND canonical.id < duplicate.id
WHERE duplicate.code REGEXP '^EX-[0-9]{3}$'
   OR duplicate.code LIKE 'TREE-%'
   OR LEFT(duplicate.code, 3) = 'EX_'
GROUP BY duplicate.id;

CREATE TEMPORARY TABLE exercise_id_merge_map_second (
    duplicate_id BIGINT NOT NULL PRIMARY KEY,
    canonical_id BIGINT NOT NULL
) ENGINE=MEMORY;
INSERT INTO exercise_id_merge_map_second (duplicate_id, canonical_id)
SELECT duplicate_id, canonical_id
FROM exercise_id_merge_map;

UPDATE exercises canonical
JOIN exercise_id_merge_map mapping ON mapping.canonical_id = canonical.id
JOIN exercises duplicate ON duplicate.id = mapping.duplicate_id
SET canonical.instructions = COALESCE(NULLIF(canonical.instructions, ''), duplicate.instructions),
    canonical.execution_steps = COALESCE(NULLIF(canonical.execution_steps, ''), duplicate.execution_steps),
    canonical.difficulty_level = COALESCE(NULLIF(canonical.difficulty_level, ''), duplicate.difficulty_level),
    canonical.category = COALESCE(NULLIF(canonical.category, ''), duplicate.category),
    canonical.video_url = COALESCE(NULLIF(canonical.video_url, ''), duplicate.video_url),
    canonical.anatomy_image_url = COALESCE(NULLIF(canonical.anatomy_image_url, ''), duplicate.anatomy_image_url),
    canonical.default_sets = COALESCE(canonical.default_sets, duplicate.default_sets),
    canonical.default_reps = COALESCE(canonical.default_reps, duplicate.default_reps),
    canonical.duration = COALESCE(canonical.duration, duplicate.duration),
    canonical.equipment = COALESCE(NULLIF(canonical.equipment, ''), duplicate.equipment),
    canonical.updated_at = GREATEST(canonical.updated_at, duplicate.updated_at);

INSERT IGNORE INTO exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT mapping.canonical_id, relation.muscle_group_id
FROM exercise_muscle_groups relation
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = relation.exercise_id;

DELETE relation
FROM exercise_muscle_groups relation
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = relation.exercise_id;

INSERT IGNORE INTO benchmark_criteria (min_value, criterion_weight, exercise_id, fitness_level_id)
SELECT duplicate.min_value, duplicate.criterion_weight, mapping.canonical_id, duplicate.fitness_level_id
FROM benchmark_criteria duplicate
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = duplicate.exercise_id;

DELETE relation
FROM benchmark_criteria relation
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = relation.exercise_id;

INSERT IGNORE INTO progression_rules (
    rule_name, relationship, required_reps, min_accuracy, measure_type, required_sets,
    required_seconds, status, updated_at, exercise_id, prerequisite_exercise_id
)
SELECT rule.rule_name, rule.relationship, rule.required_reps, rule.min_accuracy, rule.measure_type,
       rule.required_sets, rule.required_seconds, rule.status, rule.updated_at,
       COALESCE(exercise_mapping.canonical_id, rule.exercise_id),
       COALESCE(prerequisite_mapping.canonical_id, rule.prerequisite_exercise_id)
FROM progression_rules rule
LEFT JOIN exercise_id_merge_map exercise_mapping
  ON exercise_mapping.duplicate_id = rule.exercise_id
LEFT JOIN exercise_id_merge_map_second prerequisite_mapping
  ON prerequisite_mapping.duplicate_id = rule.prerequisite_exercise_id
WHERE (exercise_mapping.duplicate_id IS NOT NULL
   OR prerequisite_mapping.duplicate_id IS NOT NULL)
  AND COALESCE(exercise_mapping.canonical_id, rule.exercise_id) <>
       COALESCE(prerequisite_mapping.canonical_id, rule.prerequisite_exercise_id);

DELETE rule
FROM progression_rules rule
LEFT JOIN exercise_id_merge_map exercise_mapping
  ON exercise_mapping.duplicate_id = rule.exercise_id
LEFT JOIN exercise_id_merge_map_second prerequisite_mapping
  ON prerequisite_mapping.duplicate_id = rule.prerequisite_exercise_id
WHERE exercise_mapping.duplicate_id IS NOT NULL
   OR prerequisite_mapping.duplicate_id IS NOT NULL;

INSERT IGNORE INTO exercise_tree_edges (parent_exercise_id, child_exercise_id)
SELECT COALESCE(parent_mapping.canonical_id, edge.parent_exercise_id),
       COALESCE(child_mapping.canonical_id, edge.child_exercise_id)
FROM exercise_tree_edges edge
LEFT JOIN exercise_id_merge_map parent_mapping
  ON parent_mapping.duplicate_id = edge.parent_exercise_id
LEFT JOIN exercise_id_merge_map_second child_mapping
  ON child_mapping.duplicate_id = edge.child_exercise_id
WHERE (parent_mapping.duplicate_id IS NOT NULL
   OR child_mapping.duplicate_id IS NOT NULL)
  AND COALESCE(parent_mapping.canonical_id, edge.parent_exercise_id) <>
       COALESCE(child_mapping.canonical_id, edge.child_exercise_id);

DELETE edge
FROM exercise_tree_edges edge
LEFT JOIN exercise_id_merge_map parent_mapping
  ON parent_mapping.duplicate_id = edge.parent_exercise_id
LEFT JOIN exercise_id_merge_map_second child_mapping
  ON child_mapping.duplicate_id = edge.child_exercise_id
WHERE parent_mapping.duplicate_id IS NOT NULL
   OR child_mapping.duplicate_id IS NOT NULL;

INSERT INTO member_exercise_progress (member_id, exercise_id, status)
SELECT progress.member_id, mapping.canonical_id, progress.status
FROM member_exercise_progress progress
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = progress.exercise_id
ON DUPLICATE KEY UPDATE status = CASE
    WHEN member_exercise_progress.status = 'MASTERED' OR VALUES(status) = 'MASTERED' THEN 'MASTERED'
    WHEN member_exercise_progress.status = 'CURRENT' OR VALUES(status) = 'CURRENT' THEN 'CURRENT'
    ELSE 'LOCKED'
END;

DELETE progress
FROM member_exercise_progress progress
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = progress.exercise_id;

INSERT INTO member_saved_exercises (member_id, exercise_id, saved_at)
SELECT saved.member_id, mapping.canonical_id, saved.saved_at
FROM member_saved_exercises saved
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = saved.exercise_id
ON DUPLICATE KEY UPDATE saved_at =
    LEAST(member_saved_exercises.saved_at, VALUES(saved_at));

DELETE saved
FROM member_saved_exercises saved
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = saved.exercise_id;

INSERT INTO member_skill_progress (
    status, best_reps, best_accuracy, unlocked_at, exercise_id, member_profile_id
)
SELECT progress.status, progress.best_reps, progress.best_accuracy, progress.unlocked_at,
       mapping.canonical_id, progress.member_profile_id
FROM member_skill_progress progress
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = progress.exercise_id
ON DUPLICATE KEY UPDATE
    status = CASE
        WHEN UPPER(member_skill_progress.status) = 'UNLOCKED'
             OR UPPER(VALUES(status)) = 'UNLOCKED' THEN 'UNLOCKED'
        ELSE COALESCE(member_skill_progress.status, VALUES(status))
    END,
    best_reps = CASE
        WHEN member_skill_progress.best_reps IS NULL THEN VALUES(best_reps)
        WHEN VALUES(best_reps) IS NULL THEN member_skill_progress.best_reps
        ELSE GREATEST(member_skill_progress.best_reps, VALUES(best_reps))
    END,
    best_accuracy = CASE
        WHEN member_skill_progress.best_accuracy IS NULL THEN VALUES(best_accuracy)
        WHEN VALUES(best_accuracy) IS NULL THEN member_skill_progress.best_accuracy
        ELSE GREATEST(member_skill_progress.best_accuracy, VALUES(best_accuracy))
    END,
    unlocked_at = CASE
        WHEN member_skill_progress.unlocked_at IS NULL THEN VALUES(unlocked_at)
        WHEN VALUES(unlocked_at) IS NULL THEN member_skill_progress.unlocked_at
        ELSE LEAST(member_skill_progress.unlocked_at, VALUES(unlocked_at))
    END;

DELETE progress
FROM member_skill_progress progress
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = progress.exercise_id;

CREATE TEMPORARY TABLE exercise_variation_merge AS
SELECT DISTINCT
       relation.type,
       COALESCE(exercise_mapping.canonical_id, relation.exercise_id) AS exercise_id,
       COALESCE(variant_mapping.canonical_id, relation.variant_exercise_id) AS variant_exercise_id
FROM exercise_variations relation
LEFT JOIN exercise_id_merge_map exercise_mapping
  ON exercise_mapping.duplicate_id = relation.exercise_id
LEFT JOIN exercise_id_merge_map_second variant_mapping
  ON variant_mapping.duplicate_id = relation.variant_exercise_id
WHERE exercise_mapping.duplicate_id IS NOT NULL
   OR variant_mapping.duplicate_id IS NOT NULL;

DELETE relation
FROM exercise_variations relation
LEFT JOIN exercise_id_merge_map exercise_mapping
  ON exercise_mapping.duplicate_id = relation.exercise_id
LEFT JOIN exercise_id_merge_map_second variant_mapping
  ON variant_mapping.duplicate_id = relation.variant_exercise_id
WHERE exercise_mapping.duplicate_id IS NOT NULL
   OR variant_mapping.duplicate_id IS NOT NULL;

INSERT INTO exercise_variations (type, exercise_id, variant_exercise_id)
SELECT variation.type, variation.exercise_id, variation.variant_exercise_id
FROM exercise_variation_merge variation
WHERE variation.exercise_id <> variation.variant_exercise_id
  AND NOT EXISTS (
      SELECT 1
      FROM exercise_variations existing
      WHERE existing.exercise_id = variation.exercise_id
        AND existing.variant_exercise_id = variation.variant_exercise_id
        AND existing.type <=> variation.type
  );
DROP TEMPORARY TABLE exercise_variation_merge;

UPDATE plan_exercises relation
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = relation.exercise_id
SET relation.exercise_id = mapping.canonical_id;

UPDATE workout_exercises relation
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = relation.exercise_id
SET relation.exercise_id = mapping.canonical_id;

UPDATE workout_plan_items relation
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = relation.exercise_id
SET relation.exercise_id = mapping.canonical_id;

UPDATE form_rules relation
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = relation.exercise_id
SET relation.exercise_id = mapping.canonical_id;

UPDATE session_exercise_results relation
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = relation.exercise_id
SET relation.exercise_id = mapping.canonical_id;

DELETE duplicate
FROM exercises duplicate
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = duplicate.id;

DROP TEMPORARY TABLE exercise_id_merge_map;
DROP TEMPORARY TABLE exercise_id_merge_map_second;

SET @has_exercise_index := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exercises'
      AND INDEX_NAME = 'idx_exercises_system_type_status'
);
SET @sql := IF(@has_exercise_index > 0,
    'ALTER TABLE exercises DROP INDEX idx_exercises_system_type_status', 'DO 0');
PREPARE drop_exercise_index FROM @sql; EXECUTE drop_exercise_index; DEALLOCATE PREPARE drop_exercise_index;

SET @has_exercise_index := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exercises'
      AND INDEX_NAME = 'idx_exercises_filters'
);
SET @sql := IF(@has_exercise_index > 0,
    'ALTER TABLE exercises DROP INDEX idx_exercises_filters', 'DO 0');
PREPARE drop_exercise_index FROM @sql; EXECUTE drop_exercise_index; DEALLOCATE PREPARE drop_exercise_index;

SET @has_exercise_index := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exercises'
      AND INDEX_NAME = 'idx_exercises_tree'
);
SET @sql := IF(@has_exercise_index > 0,
    'ALTER TABLE exercises DROP INDEX idx_exercises_tree', 'DO 0');
PREPARE drop_exercise_index FROM @sql; EXECUTE drop_exercise_index; DEALLOCATE PREPARE drop_exercise_index;

SET @has_exercise_index := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exercises'
      AND INDEX_NAME = 'idx_member_exercises_community'
);
SET @sql := IF(@has_exercise_index > 0,
    'ALTER TABLE exercises DROP INDEX idx_member_exercises_community', 'DO 0');
PREPARE drop_exercise_index FROM @sql; EXECUTE drop_exercise_index; DEALLOCATE PREPARE drop_exercise_index;

SET @has_exercise_index := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exercises'
      AND INDEX_NAME = 'idx_member_exercises_saves'
);
SET @sql := IF(@has_exercise_index > 0,
    'ALTER TABLE exercises DROP INDEX idx_member_exercises_saves', 'DO 0');
PREPARE drop_exercise_index FROM @sql; EXECUTE drop_exercise_index; DEALLOCATE PREPARE drop_exercise_index;

SET @has_exercise_status := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'exercises'
      AND COLUMN_NAME = 'status'
);
SET @sql := IF(@has_exercise_status > 0,
    'ALTER TABLE exercises DROP COLUMN status',
    'DO 0');
PREPARE drop_exercise_status FROM @sql;
EXECUTE drop_exercise_status;
DEALLOCATE PREPARE drop_exercise_status;

ALTER TABLE exercises
    ADD INDEX idx_exercises_system_type_status (source, type, moderation_status),
    ADD INDEX idx_exercises_filters (source, moderation_status, type, difficulty_level, goal, target_skill, id),
    ADD INDEX idx_exercises_tree (movement_group, source, moderation_status, tree_level),
    ADD INDEX idx_member_exercises_community (source, moderation_status, created_at),
    ADD INDEX idx_member_exercises_saves (source, moderation_status, save_count);
