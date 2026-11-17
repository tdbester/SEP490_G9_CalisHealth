-- V83: don dep schema + chuan hoa du lieu mot lan, ve mot DB chuan chi nhat.
--
-- Migrations truoc day (V1..V82) giu lai nhieu thu song song: cot chet, cot trung
-- nghia, du lieu seed co tien to "DEMO_" va du lieu nhieu kieu hoa ("BEGINNER" vs
-- "Beginner"). Lan ra soat nay chot mot bo quyet dinh; V83 gop cac thay doi do
-- vao mot file duy nhat de DB cuoi cung chi co MOT hinh dang.
--
-- Nguyên tac: moi thay doi deu idempotent (chay lai khong hong) va co comment
-- giai thich ly do. MySQL 8 khong co "DROP COLUMN IF EXISTS" nen dung guard
-- qua information_schema, giong V32/V36/V81.
--
-- LUU Y QUAN TRONG VE COLLATION:
--   DB dung `utf8mb4_0900_ai_ci` - KHONG phan biet hoa thuong. Vi vay so sanh
--   chuoi voi `<>` hay `NOT LIKE` giua 2 bien the nao se cho ket qua sai
--   (vd 'BEGINNER' <> 'Beginner' -> FALSE). Cac lenh UPDATE ben duoi chi
--   so sanh bang UPPER()/CASE, khong so sanh truc tiep 2 bien chuoi.
--
-- ============================================================================
-- PHAN 1 - CHUAN HOA TEN VA TINH TRANG
-- ============================================================================

-- 1.1 Level dung Title Case de khop `fitness_levels.name` (Beginner/Intermediate/Advanced).
--     `exercises.difficulty_level` dang luu UPPERCASE, `workout_entries.level` va
--     `daily_plan_templates.level` luu Title Case -> 3 he ghi khac nhau cho
--     cung mot du lieu.
--
--     `CASE` da idempotent nen khong can so sanh de tranh lan chay lai.
UPDATE exercises
SET difficulty_level = CASE UPPER(difficulty_level)
        WHEN 'BEGINNER' THEN 'Beginner'
        WHEN 'INTERMEDIATE' THEN 'Intermediate'
        WHEN 'ADVANCED' THEN 'Advanced'
        ELSE difficulty_level
    END
WHERE difficulty_level IS NOT NULL
  AND UPPER(difficulty_level) IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

UPDATE workout_entries
SET level = CASE UPPER(level)
        WHEN 'BEGINNER' THEN 'Beginner'
        WHEN 'INTERMEDIATE' THEN 'Intermediate'
        WHEN 'ADVANCED' THEN 'Advanced'
        WHEN 'EXPERT' THEN 'Expert'
        ELSE level
    END
WHERE level IS NOT NULL
  AND UPPER(level) IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

UPDATE daily_plan_templates
SET level = CASE UPPER(level)
        WHEN 'BEGINNER' THEN 'Beginner'
        WHEN 'INTERMEDIATE' THEN 'Intermediate'
        WHEN 'ADVANCED' THEN 'Advanced'
        WHEN 'EXPERT' THEN 'Expert'
        ELSE level
    END
WHERE level IS NOT NULL
  AND UPPER(level) IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- 1.2 3 buoi tap Elite -> `Advanced` (truoc day la INTERMEDIATE nen workout
--     "Expert" chua toan bai "Intermediate" - mau thuan hien thi).
--     KHONG đụng 3 bai benchmark EX_2 (Pull-up) / EX_3 (Bodyweight Squat) /
--     EX_4 (Plank) - doi level cua chung se lam lech logic cham diem.
UPDATE exercises
SET difficulty_level = 'Advanced'
WHERE code IN ('EX_8', 'EX_9', 'EX_10', 'EX_16', 'EX_43', 'EX_49', 'EX_53')
  AND UPPER(COALESCE(difficulty_level, '')) <> 'ADVANCED';

-- 1.3 3 workout Elite + 1 daily plan template Elite -> `Advanced`.
--     Giu nguyen 3 ngay cua template Elite de no van khop 3 workout da ha.
UPDATE workout_entries
SET level = 'Advanced'
WHERE UPPER(level) = 'EXPERT';

UPDATE daily_plan_templates
SET level = 'Advanced'
WHERE UPPER(level) = 'EXPERT';

-- 1.4 Moi tham chieu toi level `Expert` (id = 4) -> `Advanced` (id = 3).
--     Trần diem cua bo 3 bai benchmark la 3 bai x 3 diem = 9, nen level cao nhat
--     chi co the la `Advanced` (8-9). `Expert` (10-12) khong co bai tap nao,
--     khong co benchmark nao -> 1 level "ma" gay mau thuan hien thi.
--
--     (Bang `fitness_levels` se bi xoa o PHAN 3, sau khi 4 bang `level_rule_*`
--     - dang giu FK toi no - da duoc xoa.)
UPDATE member_profiles
SET fitness_level_id = 3
WHERE fitness_level_id = 4;

UPDATE member_weekly_scores
SET fitness_level_id = 3
WHERE fitness_level_id = 4;

UPDATE survey_level_results
SET fitness_level_id = 3
WHERE fitness_level_id = 4;

-- 1.5 Xoa 2 dong `LEGACY-4` / `LEGACY-5` cua benchmark_criteria.
--     Code da bo qua qua `isBenchmarkRow()` (nhan dien moi dong tien to "LEGACY-"),
--     nen chung la rac ma khong duoc dung vao gi.
DELETE FROM benchmark_criteria
WHERE benchmark_slot LIKE 'LEGACY-%';

-- 1.6 Xoa 3 cau hoi benchmark mo coi (khong co criteria nao tham chieu):
--     BURPEE_MAX_REPS / DIPS_MAX_REPS / PULL_UP_MAX_REPS.
--     Neu Content Manager muon them sau, `BenchmarkSurveySync` se tu sinh lai
--     cau hoi + criteria tu slot benchmark.
DELETE FROM assessment_options WHERE question_id IN (
    SELECT id FROM assessment_questions WHERE question_code IN ('BURPEE_MAX_REPS', 'DIPS_MAX_REPS', 'PULL_UP_MAX_REPS')
);
DELETE FROM survey_step_questions WHERE question_id IN (
    SELECT id FROM assessment_questions WHERE question_code IN ('BURPEE_MAX_REPS', 'DIPS_MAX_REPS', 'PULL_UP_MAX_REPS')
);
DELETE FROM assessment_answers WHERE question_id IN (
    SELECT id FROM assessment_questions WHERE question_code IN ('BURPEE_MAX_REPS', 'DIPS_MAX_REPS', 'PULL_UP_MAX_REPS')
);
DELETE FROM assessment_questions WHERE question_code IN ('BURPEE_MAX_REPS', 'DIPS_MAX_REPS', 'PULL_UP_MAX_REPS');

-- 1.7 Backfill `member_weekly_scores.fitness_level_id` cho 26 dong NULL.
--     2 member bi bien mat khoi bang xep hang vi repository JOIN FETCH
--     `fitnessLevel` - NULL -> JOIN khong ra dong.
UPDATE member_weekly_scores mws
JOIN member_profiles mp ON mp.id = mws.member_profile_id
SET mws.fitness_level_id = mp.fitness_level_id
WHERE mws.fitness_level_id IS NULL
  AND mp.fitness_level_id IS NOT NULL;

-- 1.8 Backfill 7 dong `workout_exercises` cua bai HOLD bi sai.
--     `duration_seconds = NULL` + `reps = 1` khien UI hien "1 reps" thay vi
--     "30 giay". Lay duration cua bai tap lam chuan.
UPDATE workout_exercises we
JOIN exercises e ON e.id = we.exercise_id
SET we.duration_seconds = e.duration,
    we.reps = NULL
WHERE UPPER(e.category) = 'HOLD'
  AND (we.duration_seconds IS NULL OR we.reps IS NOT NULL);

-- 1.9 Gan `movement_group` cho 11 bai CUSTOM thieu (NULL).
--     Index `idx_exercises_tree` dung (movement_group, source, status, tree_level)
--     nen bai NULL bi bo qua khi loc theo nhom cu dong.
UPDATE exercises SET movement_group = 'PUSH'  WHERE code IN ('CU_225', 'CU_227', 'CU_228', 'CU_232', 'CU_234');
UPDATE exercises SET movement_group = 'LEGS'  WHERE code IN ('CU_226', 'CU_230', 'CU_235');
UPDATE exercises SET movement_group = 'CORE'  WHERE code IN ('CU_231');
UPDATE exercises SET movement_group = 'PULL'  WHERE code IN ('CU_233');

-- ============================================================================
-- PHAN 2 - TACH 852 BUOI TAP SEED THANH 2602 BUOI (1 BUOI = 1 BAI TAP)
-- ============================================================================
--
-- Luat runtime: moi lan member cham 1 bai tao ra DUNG 1 dong `workout_sessions`
-- (xem `ProgressionRuleService.submitResult`). Nhung 852 dong seed lai gom
-- 2-4 bai tap moi dong (moi dong = 1 buoi workout), khong khop luat runtime
-- va khong khop luot hien thi "ten buoi tap = ten bai tap".
--
-- V83 tach moi `session_exercise_results` thanh 1 buoi rieng:
--   - moi dong giu nguyen member_profile_id / workout_id / session_date
--   - `workout_name` = 'DEMO_' + ten bai tap (khop quyet dinh "ten buoi tap =
--     ten bai tap" + phan biet buoi seed voi buoi tap that cua member)
--   - `active_seconds` / `total_reps` lay tu chinh dong ket qua do
--   - `started_at` / `finished_at` giu nguyen moc thoi gian cua buoi goc
--
-- Luu y: `uk_workout_sessions_member_date_workout` (member + ngay + workout)
-- la UNIQUE. Sau khi tach, mot member tren mot ngay co the co nhieu dong
-- cung mot workout -> phai doi unique thanh index thuong truoc khi tach.

SET @db := DATABASE();

-- 2.1 Doi unique thanh index thuong.
SET @has_uk := (SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'workout_sessions'
                  AND INDEX_NAME = 'uk_workout_sessions_member_date_workout' AND NON_UNIQUE = 0);
SET @sql := IF(@has_uk > 0,
    'ALTER TABLE workout_sessions DROP INDEX uk_workout_sessions_member_date_workout',
    'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
                 WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'workout_sessions'
                   AND INDEX_NAME = 'idx_workout_sessions_member_date_workout');
SET @sql := IF(@has_idx = 0,
    'ALTER TABLE workout_sessions ADD INDEX idx_workout_sessions_member_date_workout (member_profile_id, session_date, workout_id)',
    'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2.2 Mapping: moi dong `session_exercise_results` se tro toi 1 buoi moi.
--     Id buoi moi = `@base + ROW_NUMBER() OVER (ORDER BY ser.id)` -> xac dinh 100%,
--     khong phu thuoc thu tu auto_increment.
SET @base := (SELECT COALESCE(MAX(id), 0) FROM workout_sessions);

DROP TEMPORARY TABLE IF EXISTS tmp_session_split;
CREATE TEMPORARY TABLE tmp_session_split (
    result_id BIGINT NOT NULL PRIMARY KEY,
    new_session_id BIGINT NOT NULL
);

INSERT INTO tmp_session_split (result_id, new_session_id)
SELECT ser.id,
       @base + ROW_NUMBER() OVER (ORDER BY ser.id)
FROM session_exercise_results ser;

-- 2.3 Sinh buoi moi cho tung bai tap.
--
--     `total_reps` lay tu chinh dong ket qua (valid + invalid) va
--     `active_seconds` lay tu dong ket qua do - nho vay moi buoi tap co dung
--     so lieu cua rieng bai tap no mang.
INSERT INTO workout_sessions (
    id, member_profile_id, workout_id, workout_name, session_date, status,
    started_at, finished_at, active_seconds, total_reps, created_at, updated_at
)
SELECT tmp.new_session_id,
       ws.member_profile_id,
       ws.workout_id,
       CONCAT('DEMO_', e.name),
       ws.session_date,
       ws.status,
       ws.started_at,
       ws.finished_at,
       ser.active_seconds,
       ser.valid_reps + ser.invalid_reps,
       ws.created_at,
       ws.updated_at
FROM tmp_session_split tmp
JOIN session_exercise_results ser ON ser.id = tmp.result_id
JOIN workout_sessions ws ON ws.id = ser.workout_session_id
JOIN exercises e ON e.id = ser.exercise_id;

-- 2.4 Tro lai chi so ket qua sang buoi moi.
UPDATE session_exercise_results ser
JOIN tmp_session_split tmp ON tmp.result_id = ser.id
SET ser.workout_session_id = tmp.new_session_id;

-- 2.5 Xoa 852 buoi goc (khong con ket qua nao tro toi).
--     Chi xoa buoi cu (id <= @base) de khong xoa nham buoi moi vua tao.
DELETE ws
FROM workout_sessions ws
LEFT JOIN session_exercise_results ser ON ser.workout_session_id = ws.id
WHERE ws.id <= @base
  AND ser.id IS NULL;

DROP TEMPORARY TABLE IF EXISTS tmp_session_split;

-- 2.6 Them cot `source` de phan biet 3 luong buoi tap:
--     `SYSTEM_SEED` = du lieu seed (khong phai member tap that)
--     `LIBRARY`    = member tap bai le / workout tu thu vien
--     `DAILY_PLAN` = member tap theo ke hoach ngay
SET @has_ws_source := (SELECT COUNT(*) FROM information_schema.COLUMNS
                        WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'workout_sessions' AND COLUMN_NAME = 'source');
SET @sql := IF(@has_ws_source = 0,
    'ALTER TABLE workout_sessions ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT ''SYSTEM_SEED''',
    'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE workout_sessions SET source = 'SYSTEM_SEED' WHERE source IS NULL OR UPPER(source) <> 'SYSTEM_SEED';

-- 2.7 Xoa cot `category` (ghi sai - 852/852 dong deu la 'strength') va `notes`
--     (chua bao gio duoc dung). The loai buoi tap gio duoc suy ra luc doc:
--     JOIN `session_exercise_results` -> `exercises.type` (HEALTH / SKILL).
SET @has_category := (SELECT COUNT(*) FROM information_schema.COLUMNS
                      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'workout_sessions' AND COLUMN_NAME = 'category');
SET @sql := IF(@has_category > 0, 'ALTER TABLE workout_sessions DROP COLUMN category', 'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_notes := (SELECT COUNT(*) FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'workout_sessions' AND COLUMN_NAME = 'notes');
SET @sql := IF(@has_notes > 0, 'ALTER TABLE workout_sessions DROP COLUMN notes', 'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- PHAN 3 - BO COT / BANG CHET
-- ============================================================================

-- 3.1 `exercises.exercise_tree_id` (14 dong, tat ca deu tu tham chieu chinh
--     no `= exercises.id`) - cot nay khong bao gio mang thong tin. Cay bai tap
--     duoc xac dinh bang `progression_rules` la nguon su that duy nhat.
SET @has_tree_id := (SELECT COUNT(*) FROM information_schema.COLUMNS
                     WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'exercises' AND COLUMN_NAME = 'exercise_tree_id');
SET @sql := IF(@has_tree_id > 0, 'ALTER TABLE exercises DROP COLUMN exercise_tree_id', 'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3.2 `workout_exercises.count_by` (95 dong) trung `exercises.category`
--     (HOLD / REPS) va khong co entity nao doc. Cach dem da duoc suy ra tu
--     `duration_seconds IS NOT NULL`.
SET @has_count_by := (SELECT COUNT(*) FROM information_schema.COLUMNS
                       WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'workout_exercises' AND COLUMN_NAME = 'count_by');
SET @sql := IF(@has_count_by > 0, 'ALTER TABLE workout_exercises DROP COLUMN count_by', 'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3.3 Dong bo 155 canh "cay bai tap" cua `exercise_tree_edges` vao
--     `progression_rules` truoc khi xoá bang (chot so 2a).
--
--     Ly do: `exercise_tree_edges` va `progression_rules` cung mo ta quan he
--     "bai A tien kien cho bai B" nhung la 2 nguon su that trung nhau. Chi
--     26 rule co san trong `progression_rules` trong khi cay bai tap co 155
--     canh -> bo bang `exercise_tree_edges` ma khong dong bo se lam mat ~80%
--     cay (man "Exercise Tree" va "Previous / Next exercises" se co).
--
--     Cach chon canh giu lai (mua thuoc tinh):
--       1. Huong chuan: prerequisite -> exercise (bai cap thap hon -> bai cap
--          cao hon). Dinh huong bang `(tree_level, id)`. 18 canh co hai chieu
--          (A->B va B->A) se tao vong lap, nen chi giu mot chieu.
--       2. Bo canh trung nguoc voi rule da co (dung nguoc nguoc lai) -
--          `progression_rules` la nguon uu tien.
--     Ket qua: 129 canh duoc giu, KHONG con vong lap nao trong do thi hop
--     nhat (da kiem bang CTE de quy so tren chinh DB).
--
--     Nguong mac dinh lay tu chinh bai tien kien:
--       - REPS  -> required_reps = `exercises.default_reps` (fallback 1)
--       - HOLD  -> required_seconds = `exercises.duration` (fallback 1)
--       - required_sets = `exercises.default_sets` (fallback 1)
--       - min_accuracy = 80% (gia tri chung cua 25 rule dang ACTIVE)
--     Rule moi gan status = 'ACTIVE' vi day la cay thien kien that su, khong
--     phai rule "tam ngung".
INSERT INTO progression_rules (
    rule_name, relationship, required_reps, required_seconds, required_sets,
    measure_type, min_accuracy, status, exercise_id, prerequisite_exercise_id, updated_at
)
SELECT CONCAT(c.name, ' progression ', p.name),
       'PREREQUISITE',
       CASE WHEN UPPER(p.category) = 'HOLD' THEN NULL ELSE GREATEST(COALESCE(p.default_reps, 0), 1) END,
       CASE WHEN UPPER(p.category) = 'HOLD' THEN GREATEST(COALESCE(p.duration, 0), 1) ELSE NULL END,
       GREATEST(COALESCE(p.default_sets, 0), 1),
       CASE WHEN UPPER(p.category) = 'HOLD' THEN 'HOLD' ELSE 'REPS' END,
       80.000,
       'ACTIVE',
       c.id,
       p.id,
       NOW(6)
FROM exercise_tree_edges ed
JOIN exercises p ON p.id = ed.parent_exercise_id
JOIN exercises c ON c.id = ed.child_exercise_id
WHERE (COALESCE(p.tree_level, 999), p.id) < (COALESCE(c.tree_level, 999), c.id)
  -- Bo canh vong 2 chiều: giu duoc huong nguoc lai cua canh dang xet.
  AND NOT EXISTS (
      SELECT 1 FROM exercise_tree_edges ed2
      WHERE ed2.parent_exercise_id = ed.child_exercise_id
        AND ed2.child_exercise_id = ed.parent_exercise_id
  )
  -- Bo canh trung nguoc voi rule da co: `progression_rules` la nguon uu tien.
  AND NOT EXISTS (
      SELECT 1 FROM progression_rules pr
      WHERE (pr.exercise_id = c.id AND pr.prerequisite_exercise_id = p.id)
         OR (pr.exercise_id = p.id AND pr.prerequisite_exercise_id = c.id)
  );

-- 3.4 Xoá bang `exercise_tree_edges` (155 dong) - sau khi da dong bo sang
--     `progression_rules` o 3.3, no khong con mang thong tin gi khac.
DROP TABLE IF EXISTS exercise_tree_edges;

-- 3.5 4 bang `level_rule_*` (deu rong) - thang tier-1 cua co che cham level.
--     Cap do nghiem thu la `benchmark_criteria`; 4 bang nay rong nen khong
--     bao gio chay. `survey_level_results.rule_set_id` cung bo theo.
--
--     Thu tu: bo FK truoc (MySQL khong cho DROP COLUMN khi con FK tro toi),
--     roi moi bo cot va cac bang.
SET @has_fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
                WHERE CONSTRAINT_SCHEMA = @db AND TABLE_NAME = 'survey_level_results'
                  AND CONSTRAINT_NAME = 'fk_survey_level_results_set' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @sql := IF(@has_fk > 0,
    'ALTER TABLE survey_level_results DROP FOREIGN KEY fk_survey_level_results_set',
    'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_rule_set_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
                           WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'survey_level_results' AND COLUMN_NAME = 'rule_set_id');
SET @sql := IF(@has_rule_set_col > 0, 'ALTER TABLE survey_level_results DROP COLUMN rule_set_id', 'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DROP TABLE IF EXISTS level_rule_outcomes;
DROP TABLE IF EXISTS level_rule_bands;
DROP TABLE IF EXISTS level_rule_criteria;
DROP TABLE IF EXISTS level_rule_sets;

-- 3.6 Xoa level `Expert` (sau khi moi tham chieu da duoc doi o 1.4 va 4 bang
--     `level_rule_*` - dang giu FK toi no - da duoc xoa o 3.5).
DELETE FROM fitness_levels WHERE name = 'Expert';

-- ============================================================================
-- PHAN 4 - BO DEMORMALIZED `save_count`
-- ============================================================================
--
-- `exercises.save_count` va `workout_entries.save_count` la so dem trung
-- (denormalized) cua `member_favorites`. Du lieu seed ghi gia (18/9/5/13)
-- trong khi `member_favorites` co 0 dong -> so lieu hien thi sai.
-- So dem nay duoc tinh DONG tu `member_favorites` o tang service
-- (Hibernate `@Formula`), nen cot vat ly khong can con.

-- 4.1 Xoa index duoc tao tren `save_count` truoc khi bo cot.
DROP INDEX idx_member_exercises_saves ON exercises;

SET @has_ex_sc := (SELECT COUNT(*) FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'exercises' AND COLUMN_NAME = 'save_count');
SET @sql := IF(@has_ex_sc > 0, 'ALTER TABLE exercises DROP COLUMN save_count', 'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_we_sc := (SELECT COUNT(*) FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'workout_entries' AND COLUMN_NAME = 'save_count');
SET @sql := IF(@has_we_sc > 0, 'ALTER TABLE workout_entries DROP COLUMN save_count', 'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4.2 Index phuc vu dem yeu thich theo item.
CREATE INDEX idx_member_favorites_item ON member_favorites (item_type, item_id);

-- ============================================================================
-- PHAN 5 - TEN DEMO_ CHO NOI DUNG SEED / CUSTOM
-- ============================================================================
--
-- Noi dung seed/demo phai nhin ra la "demo" chu khong phai san pham that, de
-- khi demo khong ai hieu nham. Tien to "DEMO_" ap dung cho:
--   - ten bai tap CUSTOM (20 bai)
--   - ten workout CUSTOM (10 bai)
--   - ten buoi tap trong `workout_sessions` (da gan o 2.3)
--
-- Chi them tien to khi chua co, de chay lai khong tao "DEMO_DEMO_...".
--
-- Luu y: lenh nay dat CUOI file (sau khi `progression_rules` da dong bo o 3.3)
-- de ten rule sinh ra khong bi "DEMO_" vo cua - ten rule la noi bo, khong
-- phai noi dung hien thi cho member.
UPDATE exercises
SET name = CONCAT('DEMO_', name)
WHERE source = 'CUSTOM'
  AND name NOT LIKE 'DEMO\_%';

UPDATE workout_entries
SET name = CONCAT('DEMO_', name)
WHERE source = 'CUSTOM'
  AND name NOT LIKE 'DEMO\_%';
