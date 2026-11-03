-- Keep the pre-V25 SYSTEM exercise as the canonical row when later seeds
-- introduced another row for the same normalized name and exercise type.

UPDATE exercises
SET name = TRIM(name),
    type = UPPER(TRIM(type)),
    source = CASE
        WHEN source IS NULL OR TRIM(source) = '' THEN
            CASE WHEN created_by IS NULL THEN 'SYSTEM' ELSE 'CUSTOM' END
        WHEN UPPER(TRIM(source)) IN ('MEMBER', 'CUSTOM') THEN 'CUSTOM'
        ELSE UPPER(TRIM(source))
    END;

-- category is the counting mode, not a training goal or muscle group.
-- Existing hold durations distinguish legacy holds; ambiguous legacy rows
-- without a duration remain repetition-based.
UPDATE exercises
SET category = CASE
        WHEN UPPER(TRIM(COALESCE(category, ''))) = 'HOLD' THEN 'HOLD'
        WHEN UPPER(TRIM(COALESCE(category, ''))) = 'REPS' THEN 'REPS'
        WHEN COALESCE(duration, 0) > 0 AND COALESCE(default_reps, 0) = 0 THEN 'HOLD'
        ELSE 'REPS'
    END;

UPDATE exercises
SET default_reps = NULL
WHERE category = 'HOLD';

UPDATE exercises
SET duration = NULL
WHERE category = 'REPS';

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
 AND canonical.type = duplicate.type
 AND LOWER(TRIM(canonical.name)) = LOWER(TRIM(duplicate.name))
 AND canonical.id < duplicate.id
WHERE duplicate.id <> canonical.id
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
DROP TEMPORARY TABLE exercise_id_merge_map_second;

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

ALTER TABLE exercises
    MODIFY COLUMN category VARCHAR(80) NOT NULL DEFAULT 'REPS',
    MODIFY COLUMN source VARCHAR(60) NOT NULL DEFAULT 'SYSTEM',
    ADD CONSTRAINT ck_exercises_category_measure CHECK (category IN ('REPS', 'HOLD')),
    ADD CONSTRAINT ck_exercises_type CHECK (type IN ('HEALTH', 'SKILL')),
    ADD CONSTRAINT ck_exercises_source CHECK (source IN ('SYSTEM', 'CUSTOM'));
