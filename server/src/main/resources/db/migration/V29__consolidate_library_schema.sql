-- Consolidate Library columns into the canonical columns introduced by older migrations.

-- Normalize the Library-only text field into the existing muscle-group catalog.
-- Abort before changing the schema if any stored label cannot be mapped safely.
CREATE TEMPORARY TABLE tmp_exercise_muscle_group_tokens (
    exercise_id BIGINT NOT NULL,
    token VARCHAR(120) NOT NULL,
    canonical_name VARCHAR(80) NULL
);

INSERT INTO tmp_exercise_muscle_group_tokens (exercise_id, token, canonical_name)
WITH RECURSIVE muscle_tokens (exercise_id, remaining, token) AS (
    SELECT
        id,
        LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(muscle_group, '/', ','), ';', ','), ' and ', ','), '·', ','), '&', ',')),
        TRIM(SUBSTRING_INDEX(
            LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(muscle_group, '/', ','), ';', ','), ' and ', ','), '·', ','), '&', ',')),
            ',', 1))
    FROM exercises
    WHERE muscle_group IS NOT NULL AND TRIM(muscle_group) <> ''
    UNION ALL
    SELECT
        exercise_id,
        SUBSTRING(remaining, LOCATE(',', remaining) + 1),
        TRIM(SUBSTRING_INDEX(SUBSTRING(remaining, LOCATE(',', remaining) + 1), ',', 1))
    FROM muscle_tokens
    WHERE LOCATE(',', remaining) > 0
)
SELECT
    exercise_id,
    token,
    CASE token
        WHEN 'arm' THEN 'Arms'
        WHEN 'arms' THEN 'Arms'
        WHEN 'biceps' THEN 'Arms'
        WHEN 'triceps' THEN 'Arms'
        WHEN 'forearm' THEN 'Arms'
        WHEN 'forearms' THEN 'Arms'
        WHEN 'shoulder' THEN 'Shoulders'
        WHEN 'shoulders' THEN 'Shoulders'
        WHEN 'lat' THEN 'Back'
        WHEN 'lats' THEN 'Back'
        WHEN 'upper back' THEN 'Back'
        WHEN 'lower back' THEN 'Back'
        WHEN 'leg' THEN 'Legs'
        WHEN 'legs' THEN 'Legs'
        WHEN 'quadriceps' THEN 'Legs'
        WHEN 'quad' THEN 'Legs'
        WHEN 'quads' THEN 'Legs'
        WHEN 'hamstrings' THEN 'Legs'
        WHEN 'hip flexors' THEN 'Legs'
        WHEN 'glute' THEN 'Glutes'
        WHEN 'glutes' THEN 'Glutes'
        WHEN 'pectoral' THEN 'Chest'
        WHEN 'pectorals' THEN 'Chest'
        WHEN 'pecs' THEN 'Chest'
        WHEN 'abs' THEN 'Core'
        WHEN 'abdominal' THEN 'Core'
        WHEN 'abdominals' THEN 'Core'
        WHEN 'full-body' THEN 'Full body'
        WHEN 'whole body' THEN 'Full body'
        ELSE token
    END
FROM muscle_tokens;

INSERT INTO exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT DISTINCT token.exercise_id, catalog.id
FROM tmp_exercise_muscle_group_tokens token
LEFT JOIN muscle_groups catalog
    ON LOWER(catalog.name) = LOWER(token.canonical_name)
WHERE NOT EXISTS (
    SELECT 1
    FROM exercise_muscle_groups existing
    WHERE existing.exercise_id = token.exercise_id
      AND existing.muscle_group_id = catalog.id
);

DROP TEMPORARY TABLE tmp_exercise_muscle_group_tokens;

-- V25 seeded a combined catalog entry; map it to the two canonical groups.
INSERT IGNORE INTO exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT DISTINCT existing.exercise_id, canonical.id
FROM exercise_muscle_groups existing
JOIN muscle_groups legacy ON legacy.id = existing.muscle_group_id
JOIN muscle_groups canonical ON canonical.name IN ('Arms', 'Shoulders')
WHERE LOWER(legacy.name) = 'arm/shoulders';

DELETE existing
FROM exercise_muscle_groups existing
JOIN muscle_groups legacy ON legacy.id = existing.muscle_group_id
WHERE LOWER(legacy.name) = 'arm/shoulders';

DELETE legacy
FROM muscle_groups legacy
WHERE LOWER(legacy.name) = 'arm/shoulders'
  AND NOT EXISTS (
      SELECT 1
      FROM exercise_muscle_groups existing
      WHERE existing.muscle_group_id = legacy.id
  );

-- Preserve rejected submissions in the canonical moderation history before removing
-- the Library-only copy from exercises.
INSERT INTO exercise_moderation_history (
    exercise_code,
    exercise_name,
    type,
    muscle_group,
    level,
    description,
    category,
    guide,
    demo_video_url,
    anatomy_image_url,
    created_by_name,
    decision,
    rejection_reason,
    reviewed_at
)
SELECT
    e.code,
    e.name,
    e.type,
    COALESCE(e.muscle_group, e.category),
    COALESCE(NULLIF(e.difficulty_level, ''), NULLIF(e.level, '')),
    COALESCE(NULLIF(e.instructions, ''), e.description),
    e.category,
    COALESCE(NULLIF(e.execution_steps, ''), NULLIF(e.guide_steps, ''), e.guide),
    e.video_url,
    e.anatomy_image_url,
    u.full_name,
    'REJECTED',
    e.rejection_reason,
    CURRENT_TIMESTAMP(6)
FROM exercises e
LEFT JOIN users u ON u.id = COALESCE(e.created_by, e.author_id)
WHERE e.rejection_reason IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM exercise_moderation_history h
      WHERE h.exercise_code = e.code
        AND h.decision = 'REJECTED'
        AND h.rejection_reason = e.rejection_reason
  );

-- Older columns win when both hold data. Library columns only fill missing values.
UPDATE exercises
SET difficulty_level = COALESCE(NULLIF(difficulty_level, ''), NULLIF(level, '')),
    instructions = COALESCE(NULLIF(instructions, ''), description),
    execution_steps = COALESCE(
        NULLIF(execution_steps, ''),
        NULLIF(guide_steps, ''),
        NULLIF(guide, ''),
        NULLIF(instructions, ''),
        NULLIF(description, '')
    ),
    duration = COALESCE(duration, default_duration),
    created_by = COALESCE(created_by, author_id),
    source = CASE
        WHEN source IS NULL OR TRIM(source) = '' THEN
            CASE WHEN is_system THEN 'SYSTEM' ELSE 'CUSTOM' END
        WHEN UPPER(TRIM(source)) = 'MEMBER' THEN 'CUSTOM'
        ELSE UPPER(TRIM(source))
    END;

UPDATE workout_entries
SET created_by = COALESCE(created_by, author_id),
    source = CASE
        WHEN source IS NULL OR TRIM(source) = '' THEN
            CASE WHEN is_system THEN 'SYSTEM' ELSE 'CUSTOM' END
        WHEN UPPER(TRIM(source)) = 'MEMBER' THEN 'CUSTOM'
        ELSE UPPER(TRIM(source))
    END;

UPDATE media_files
SET uploaded_by = COALESCE(uploaded_by, uploader_id);

UPDATE workout_exercises
SET duration_seconds = COALESCE(duration_seconds, duration);

-- Remove indexes and foreign keys that depend on the duplicate Library columns.
ALTER TABLE exercises
    DROP FOREIGN KEY fk_exercises_author,
    DROP INDEX idx_exercises_system_type_status,
    DROP INDEX idx_exercises_filters,
    DROP INDEX idx_exercises_tree,
    DROP INDEX idx_member_exercises_author_created,
    DROP INDEX idx_member_exercises_community,
    DROP INDEX idx_member_exercises_saves;

ALTER TABLE workout_entries
    DROP FOREIGN KEY fk_workout_entries_author,
    DROP INDEX idx_workout_entries_system_type,
    DROP INDEX idx_workout_entries_author_system_type,
    DROP INDEX idx_workouts_community,
    DROP INDEX idx_workouts_author;

ALTER TABLE media_files
    DROP FOREIGN KEY fk_media_files_uploader,
    DROP INDEX idx_media_files_uploader;

ALTER TABLE workout_exercises
    DROP INDEX idx_workout_exercises_order;

-- Rebuild indexes against the retained canonical fields.
ALTER TABLE exercises
    ADD INDEX idx_exercises_system_type_status (source, type, status),
    ADD INDEX idx_exercises_filters (source, status, type, difficulty_level, goal, target_skill, id),
    ADD INDEX idx_exercises_tree (movement_group, source, status, tree_level),
    ADD INDEX idx_member_exercises_author_created (created_by, created_at),
    ADD INDEX idx_member_exercises_community (source, status, created_at),
    ADD INDEX idx_member_exercises_saves (source, status, save_count);

ALTER TABLE workout_entries
    ADD INDEX idx_workout_entries_system_type (source, type),
    ADD INDEX idx_workout_entries_author_system_type (created_by, source, type),
    ADD INDEX idx_workouts_community (source, is_shared_with_community, status, created_at),
    ADD INDEX idx_workouts_author (created_by, source, created_at);

ALTER TABLE exercises
    DROP COLUMN description,
    DROP COLUMN muscle_group,
    DROP COLUMN level,
    DROP COLUMN guide,
    DROP COLUMN guide_steps,
    DROP COLUMN is_system,
    DROP COLUMN default_duration,
    DROP COLUMN author_id,
    DROP COLUMN rejection_reason;

ALTER TABLE workout_entries
    DROP COLUMN is_system,
    DROP COLUMN author_id;

ALTER TABLE media_files
    DROP COLUMN uploader_id;

ALTER TABLE workout_exercises
    DROP COLUMN order_index,
    DROP COLUMN duration;
