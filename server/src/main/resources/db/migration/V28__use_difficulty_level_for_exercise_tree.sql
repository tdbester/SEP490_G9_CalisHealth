-- Consolidate Exercise Tree difficulty into the shared difficulty_level column.
UPDATE exercises
SET difficulty_level = `difficulty`
WHERE `difficulty` IS NOT NULL;

ALTER TABLE exercises
    DROP COLUMN `difficulty`;
