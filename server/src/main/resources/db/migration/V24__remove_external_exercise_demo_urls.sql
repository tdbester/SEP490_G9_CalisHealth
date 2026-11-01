-- Keep the pre-library exercises (EX_<id>) as the canonical rows. V22 seeded
-- a second copy of some exercises with EX-### codes, so move their references
-- and uploaded media to the older rows before removing the copies.
CREATE TEMPORARY TABLE exercise_id_merge_map (
    duplicate_id BIGINT NOT NULL PRIMARY KEY,
    canonical_id BIGINT NOT NULL
) ENGINE=MEMORY;

INSERT INTO exercise_id_merge_map (duplicate_id, canonical_id)
SELECT duplicate.id, canonical.id
FROM exercises duplicate
JOIN exercises canonical
  ON LOWER(TRIM(canonical.name)) = LOWER(TRIM(duplicate.name))
 AND UPPER(canonical.type) = UPPER(duplicate.type)
 AND canonical.code REGEXP '^EX_[0-9]+$'
 AND canonical.is_system = TRUE
JOIN (
    SELECT LOWER(TRIM(name)) AS normalized_name, UPPER(type) AS normalized_type, MIN(id) AS id
    FROM exercises
    WHERE code REGEXP '^EX_[0-9]+$'
      AND is_system = TRUE
    GROUP BY LOWER(TRIM(name)), UPPER(type)
) oldest
  ON oldest.id = canonical.id
WHERE duplicate.code REGEXP '^EX-[0-9]{3}$'
  AND duplicate.is_system = TRUE;

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
SET canonical.video_url = CASE
        WHEN duplicate.video_url LIKE '/media/exercise-demos/%'
             AND (canonical.video_url IS NULL
                  OR LOWER(canonical.video_url) LIKE '%youtube.com/%'
                  OR LOWER(canonical.video_url) LIKE '%youtube-nocookie.com/%'
                  OR LOWER(canonical.video_url) LIKE '%youtu.be/%')
            THEN duplicate.video_url
        ELSE canonical.video_url
    END,
    canonical.anatomy_image_url = COALESCE(canonical.anatomy_image_url, duplicate.anatomy_image_url),
    canonical.updated_at = GREATEST(canonical.updated_at, duplicate.updated_at);

DELETE duplicate
FROM exercise_muscle_groups duplicate
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = duplicate.exercise_id
JOIN exercise_muscle_groups canonical
  ON canonical.exercise_id = mapping.canonical_id
 AND canonical.muscle_group_id = duplicate.muscle_group_id;

UPDATE exercise_muscle_groups relation
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = relation.exercise_id
SET relation.exercise_id = mapping.canonical_id;

DELETE duplicate
FROM benchmark_criteria duplicate
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = duplicate.exercise_id
JOIN benchmark_criteria canonical
  ON canonical.exercise_id = mapping.canonical_id
 AND canonical.fitness_level_id = duplicate.fitness_level_id
 AND canonical.benchmark_slot = duplicate.benchmark_slot
 AND canonical.min_value = duplicate.min_value;

UPDATE benchmark_criteria relation
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = relation.exercise_id
SET relation.exercise_id = mapping.canonical_id;

DELETE duplicate
FROM progression_rules duplicate
LEFT JOIN exercise_id_merge_map exercise_mapping
  ON exercise_mapping.duplicate_id = duplicate.exercise_id
LEFT JOIN exercise_id_merge_map_second prerequisite_mapping
  ON prerequisite_mapping.duplicate_id = duplicate.prerequisite_exercise_id
LEFT JOIN progression_rules canonical
  ON canonical.exercise_id = COALESCE(exercise_mapping.canonical_id, duplicate.exercise_id)
 AND canonical.prerequisite_exercise_id =
     COALESCE(prerequisite_mapping.canonical_id, duplicate.prerequisite_exercise_id)
 AND canonical.id < duplicate.id
WHERE (exercise_mapping.duplicate_id IS NOT NULL
       OR prerequisite_mapping.duplicate_id IS NOT NULL)
  AND (canonical.id IS NOT NULL
       OR COALESCE(exercise_mapping.canonical_id, duplicate.exercise_id) =
          COALESCE(prerequisite_mapping.canonical_id, duplicate.prerequisite_exercise_id));

UPDATE progression_rules relation
LEFT JOIN exercise_id_merge_map exercise_mapping
  ON exercise_mapping.duplicate_id = relation.exercise_id
LEFT JOIN exercise_id_merge_map_second prerequisite_mapping
  ON prerequisite_mapping.duplicate_id = relation.prerequisite_exercise_id
SET relation.exercise_id = COALESCE(exercise_mapping.canonical_id, relation.exercise_id),
    relation.prerequisite_exercise_id =
        COALESCE(prerequisite_mapping.canonical_id, relation.prerequisite_exercise_id)
WHERE exercise_mapping.duplicate_id IS NOT NULL
   OR prerequisite_mapping.duplicate_id IS NOT NULL;

DELETE duplicate
FROM exercise_tree_edges duplicate
LEFT JOIN exercise_id_merge_map parent_mapping
  ON parent_mapping.duplicate_id = duplicate.parent_exercise_id
LEFT JOIN exercise_id_merge_map_second child_mapping
  ON child_mapping.duplicate_id = duplicate.child_exercise_id
LEFT JOIN exercise_tree_edges canonical
  ON canonical.parent_exercise_id = COALESCE(parent_mapping.canonical_id, duplicate.parent_exercise_id)
 AND canonical.child_exercise_id = COALESCE(child_mapping.canonical_id, duplicate.child_exercise_id)
 AND canonical.id < duplicate.id
WHERE (parent_mapping.duplicate_id IS NOT NULL OR child_mapping.duplicate_id IS NOT NULL)
  AND (canonical.id IS NOT NULL
       OR COALESCE(parent_mapping.canonical_id, duplicate.parent_exercise_id) =
          COALESCE(child_mapping.canonical_id, duplicate.child_exercise_id));

UPDATE exercise_tree_edges relation
LEFT JOIN exercise_id_merge_map parent_mapping
  ON parent_mapping.duplicate_id = relation.parent_exercise_id
LEFT JOIN exercise_id_merge_map_second child_mapping
  ON child_mapping.duplicate_id = relation.child_exercise_id
SET relation.parent_exercise_id = COALESCE(parent_mapping.canonical_id, relation.parent_exercise_id),
    relation.child_exercise_id = COALESCE(child_mapping.canonical_id, relation.child_exercise_id)
WHERE parent_mapping.duplicate_id IS NOT NULL
   OR child_mapping.duplicate_id IS NOT NULL;

UPDATE member_saved_exercises canonical
JOIN exercise_id_merge_map mapping ON mapping.canonical_id = canonical.exercise_id
JOIN member_saved_exercises duplicate
  ON duplicate.member_id = canonical.member_id
 AND duplicate.exercise_id = mapping.duplicate_id
SET canonical.saved_at = LEAST(canonical.saved_at, duplicate.saved_at);

DELETE duplicate
FROM member_saved_exercises duplicate
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = duplicate.exercise_id
JOIN member_saved_exercises canonical
  ON canonical.member_id = duplicate.member_id
 AND canonical.exercise_id = mapping.canonical_id;

UPDATE member_saved_exercises relation
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = relation.exercise_id
SET relation.exercise_id = mapping.canonical_id;

DELETE duplicate
FROM member_exercise_progress duplicate
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = duplicate.exercise_id
JOIN member_exercise_progress canonical
  ON canonical.member_id = duplicate.member_id
 AND canonical.exercise_id = mapping.canonical_id;

UPDATE member_exercise_progress relation
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = relation.exercise_id
SET relation.exercise_id = mapping.canonical_id;

UPDATE member_skill_progress canonical
JOIN exercise_id_merge_map mapping ON mapping.canonical_id = canonical.exercise_id
JOIN member_skill_progress duplicate
  ON duplicate.member_profile_id = canonical.member_profile_id
 AND duplicate.exercise_id = mapping.duplicate_id
SET canonical.status = CASE
        WHEN UPPER(canonical.status) = 'UNLOCKED' OR UPPER(duplicate.status) = 'UNLOCKED'
            THEN 'UNLOCKED'
        ELSE COALESCE(canonical.status, duplicate.status)
    END,
    canonical.best_reps = CASE
        WHEN canonical.best_reps IS NULL THEN duplicate.best_reps
        WHEN duplicate.best_reps IS NULL THEN canonical.best_reps
        ELSE GREATEST(canonical.best_reps, duplicate.best_reps)
    END,
    canonical.best_accuracy = CASE
        WHEN canonical.best_accuracy IS NULL THEN duplicate.best_accuracy
        WHEN duplicate.best_accuracy IS NULL THEN canonical.best_accuracy
        ELSE GREATEST(canonical.best_accuracy, duplicate.best_accuracy)
    END,
    canonical.unlocked_at = CASE
        WHEN canonical.unlocked_at IS NULL THEN duplicate.unlocked_at
        WHEN duplicate.unlocked_at IS NULL THEN canonical.unlocked_at
        ELSE LEAST(canonical.unlocked_at, duplicate.unlocked_at)
    END;

DELETE duplicate
FROM member_skill_progress duplicate
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = duplicate.exercise_id
JOIN member_skill_progress canonical
  ON canonical.member_profile_id = duplicate.member_profile_id
 AND canonical.exercise_id = mapping.canonical_id;

UPDATE member_skill_progress relation
JOIN exercise_id_merge_map mapping ON mapping.duplicate_id = relation.exercise_id
SET relation.exercise_id = mapping.canonical_id;

DELETE duplicate
FROM exercise_variations duplicate
LEFT JOIN exercise_id_merge_map exercise_mapping
  ON exercise_mapping.duplicate_id = duplicate.exercise_id
LEFT JOIN exercise_id_merge_map_second variant_mapping
  ON variant_mapping.duplicate_id = duplicate.variant_exercise_id
WHERE (exercise_mapping.duplicate_id IS NOT NULL OR variant_mapping.duplicate_id IS NOT NULL)
  AND COALESCE(exercise_mapping.canonical_id, duplicate.exercise_id) =
      COALESCE(variant_mapping.canonical_id, duplicate.variant_exercise_id);

UPDATE exercise_variations relation
LEFT JOIN exercise_id_merge_map exercise_mapping
  ON exercise_mapping.duplicate_id = relation.exercise_id
LEFT JOIN exercise_id_merge_map_second variant_mapping
  ON variant_mapping.duplicate_id = relation.variant_exercise_id
SET relation.exercise_id = COALESCE(exercise_mapping.canonical_id, relation.exercise_id),
    relation.variant_exercise_id = COALESCE(variant_mapping.canonical_id, relation.variant_exercise_id)
WHERE exercise_mapping.duplicate_id IS NOT NULL
   OR variant_mapping.duplicate_id IS NOT NULL;

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

-- Uploaded demos are local files only. Remove legacy YouTube URLs after
-- transferring any uploaded demo from a duplicate row to its canonical row.
UPDATE exercises
SET video_url = NULL
WHERE video_url IS NOT NULL
  AND (
      LOWER(TRIM(video_url)) LIKE '%youtube.com/%'
      OR LOWER(TRIM(video_url)) LIKE '%youtube-nocookie.com/%'
      OR LOWER(TRIM(video_url)) LIKE '%youtu.be/%'
  );
