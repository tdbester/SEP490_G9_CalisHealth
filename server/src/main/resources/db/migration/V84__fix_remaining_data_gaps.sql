-- V84: xu ly 3 diem ton dong con lai sau V83.
--
-- V83 da don dep schema nhung bo sot 3 cho:
--   1. `exercises.tree_level` - V83 bo cot `exercise_tree_id` va bang
--      `exercise_tree_edges` nhung GIU LAI `tree_level`. Cot nay la mot ban sao
--      cua do sau cua cay, nhung du lieu cu no da hong: 40/73 bai tang = 5
--      (gia tri hang loat, khong phai do sau that) + 11 bai NULL. Code lai doc
--      dung cot nay de sap xep node trong cay (`ExerciseTreeService`).
--      Giai phap: BO COT. Do sau duoc tinh truc tiep tu do thi
--      `progression_rules` (nguon su that duy nhat) trong code Java, dung
--      thuat toan giong het frontend (`exerciseTreeLayout.js`). Het 2 nguon
--      su that -> khong con nguy co lech.
--
--   2. 36 dong `member_weekly_scores` co `fitness_level_id = NULL` -> 3
--      member bi bien mat khoi bang xep hang, vi query leaderboard JOIN FETCH
--      `fitnessLevel` bat buoc co level.
--      Nguyen do: 3 member (halevinh1000@gmail.com, demo@calishealth.com,
--      survey.test@calishealth.com) chua lam khao sat onboarding nen chua
--      bao gio co level, nhung lai co 96-106 buoi tap da ghi trong DB.
--      Giai phap: gan level fallback cho member chua co level (lay dung
--      `fallbackFitnessLevelId` cua buoc RESULT trong khao sat - dang
--      dung ID 1 = Beginner), roi backfill cho cac dong diem.
--
--   3. Thu hang (`member_rank`) cua cac dong diem tren duoc xep theo nhom
--      level, nen 3 member do dang xep hang trong nhom "NULL" - khong phai
--      nhom nao cua leaderboard that. Chuyen sang level thuoc nguoi that
--      thi phai xep lai hang cho TAT CA cac tuan, ca hang hien tai va hang
--      cua tuan truoc.
--
-- Nguyên tac: moi thay doi deu idempotent (chay lai khong hong) va co comment
-- giai thich ly do. MySQL 8 khong co "DROP COLUMN IF EXISTS" nen dung guard
-- qua information_schema, giong V32/V36/V81/V83.

-- ============================================================================
-- PHAN 1 - BO COT `exercises.tree_level`
-- ============================================================================
-- Do sau cua cay bay gio duoc tinh tu `progression_rules` trong Java
-- (`ExerciseTreeService`), nen cot nay khong con dung gi.
-- Khi drop 1 cot trong index nhieu cot, MySQL tu rut cot khoi index
-- (`idx_exercises_tree` con lai 3 cot: movement_group, source, moderation_status).
SET @db := DATABASE();

SET @has_tree_level := (SELECT COUNT(*) FROM information_schema.COLUMNS
                         WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'exercises' AND COLUMN_NAME = 'tree_level');
SET @sql := IF(@has_tree_level = 0, 'DO 0', 'ALTER TABLE exercises DROP COLUMN tree_level');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- PHAN 2 - GAN LEVEL FALLBACK CHO MEMBER CHUA CO LEVEL
-- ============================================================================
-- Chi MEMBER moi duoc xep hang (`computeScoresForWeek` loc role = MEMBER),
-- nen staff (ADMIN / CONTENT_MANAGER) giu fitness_level_id = NULL.
--
-- Level fallback lay tu `survey_steps.result_config.fallbackFitnessLevelId`
-- cua buoc RESULT dang ACTIVE - dung ID 1 (Beginner) cho khao sat onboarding.
-- Neu cau hinh khong con -> lay level ACTIVE co diem thap nhat.
SET @fallback_level_id := (
    SELECT COALESCE(
        (SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(result_config, '$.fallbackFitnessLevelId')) AS UNSIGNED)
         FROM survey_steps
         WHERE step_type = 'RESULT' AND status = 'ACTIVE' AND result_config IS NOT NULL
         ORDER BY sort_order
         LIMIT 1),
        (SELECT MIN(id) FROM fitness_levels WHERE status = 'ACTIVE')
    )
);

UPDATE member_profiles mp
JOIN users u ON u.id = mp.user_id
SET mp.fitness_level_id = @fallback_level_id
WHERE mp.fitness_level_id IS NULL
  AND u.role = 'MEMBER'
  AND @fallback_level_id IS NOT NULL;

-- ============================================================================
-- PHAN 3 - BACKFILL `member_weekly_scores.fitness_level_id`
-- ============================================================================
-- 3.1 Bon dong NULL trung nhau cho cung 1 member + 1 tuan.
--     MySQL coi NULL trong unique key la "khac nhau", nen 2 dong NULL cung
--     (member, tuan) van ton tai. Giu dong diem cao nhat, xoa dong con lai.
-- 3.2 Xoa dong NULL khi cung (member, tuan) da co dong co level that -
--     dong co level that da duoc hien tren leaderboard, dong NULL la du thua.
-- 3.3 Backfill dong con lai tu level cua profile.
--
-- MySQL khong cho UPDATE/DELETE tren bang ma dang trong FROM clause, nen tinh
-- danh sach id can xoa vao bang tam truoc roi moi chay lenh xoa.
DROP TEMPORARY TABLE IF EXISTS tmp_stale_weekly_scores;
CREATE TEMPORARY TABLE tmp_stale_weekly_scores AS
SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY member_profile_id, week_start
                              ORDER BY total_score DESC, id ASC) AS rn
    FROM member_weekly_scores
    WHERE fitness_level_id IS NULL
) duplicates WHERE duplicates.rn > 1;

DELETE mws FROM member_weekly_scores mws
JOIN tmp_stale_weekly_scores stale ON stale.id = mws.id;

DROP TEMPORARY TABLE IF EXISTS tmp_weekly_scores_with_level;
CREATE TEMPORARY TABLE tmp_weekly_scores_with_level AS
SELECT DISTINCT member_profile_id, week_start
FROM member_weekly_scores
WHERE fitness_level_id IS NOT NULL;

DELETE mws FROM member_weekly_scores mws
JOIN tmp_weekly_scores_with_level sibling
  ON sibling.member_profile_id = mws.member_profile_id
 AND sibling.week_start = mws.week_start
WHERE mws.fitness_level_id IS NULL;

DROP TEMPORARY TABLE IF EXISTS tmp_stale_weekly_scores;
DROP TEMPORARY TABLE IF EXISTS tmp_weekly_scores_with_level;

UPDATE member_weekly_scores mws
JOIN member_profiles mp ON mp.id = mws.member_profile_id
SET mws.fitness_level_id = mp.fitness_level_id
WHERE mws.fitness_level_id IS NULL
  AND mp.fitness_level_id IS NOT NULL;

-- ============================================================================
-- PHAN 4 - XEP LAI THU HANG THEO LEVEL
-- ============================================================================
-- 4.1 Hang trong tuan: xep theo `total_score` giam dan, `member_profile_id`
--     tang dan lam tieu chi phan biet - dung thu tu ma `reassignRanks` dung.
UPDATE member_weekly_scores mws
JOIN (
    SELECT id, ROW_NUMBER() OVER (
        PARTITION BY week_start, COALESCE(fitness_level_id, 0)
        ORDER BY total_score DESC, member_profile_id ASC
    ) AS new_rank
    FROM member_weekly_scores
) ranked ON ranked.id = mws.id
SET mws.member_rank = ranked.new_rank;

-- 4.2 Hang cua tuan truoc + muc thay doi.
--     Lay dong diem cung (member, tuan truoc); uu tien dong cung level, neu
--     khong co thi lay dong id nho nhat. `rank_change = hang cua tuan truoc -
--     hang hien tai` (giam hang -> so duong).
--     Bang tam de tranh MySQL cam UPDATE tren bang dang trong FROM clause.
DROP TEMPORARY TABLE IF EXISTS tmp_previous_weekly_rank;
CREATE TEMPORARY TABLE tmp_previous_weekly_rank AS
SELECT id AS current_id, previous_rank FROM (
    SELECT c.id AS id,
           p.member_rank AS previous_rank,
           ROW_NUMBER() OVER (
               PARTITION BY c.id
               ORDER BY (p.fitness_level_id <=> c.fitness_level_id) DESC, p.id ASC
           ) AS rn
    FROM member_weekly_scores c
    JOIN member_weekly_scores p
      ON p.member_profile_id = c.member_profile_id
     AND p.week_start = DATE_SUB(c.week_start, INTERVAL 7 DAY)
    WHERE p.member_rank IS NOT NULL
) previous_ranked WHERE previous_ranked.rn = 1;

UPDATE member_weekly_scores cur
LEFT JOIN tmp_previous_weekly_rank previous_score ON previous_score.current_id = cur.id
SET cur.previous_rank = previous_score.previous_rank,
    cur.rank_change = CASE
        WHEN previous_score.previous_rank IS NULL THEN NULL
        ELSE previous_score.previous_rank - cur.member_rank
    END;

DROP TEMPORARY TABLE IF EXISTS tmp_previous_weekly_rank;
