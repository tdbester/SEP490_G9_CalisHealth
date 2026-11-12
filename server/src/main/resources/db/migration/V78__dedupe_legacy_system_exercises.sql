-- V78: Dọn bài tập trùng tên trong nhóm SYSTEM (dữ liệu legacy).
--
-- VẤN ĐỀ
--   Trước đây nhiều lần seed/import tạo ra các bài SYSTEM trùng tên (VD: 2 bài
--   "Plank": EX_4 và EX_239). Hệ quả:
--     - Màn hình Content Manager hiển thị 2 dòng giống hệt nhau.
--     - Test SystemExerciseListIntegrationTest kiểm tra tên là duy nhất -> fail.
--     - Từ lần này, tạo bài mới đã bị chặn trùng tên (ExerciseService trả 409),
--       nhưng dữ liệu cũ vẫn còn trùng trong DB.
--
--   Bản ghi trùng là dữ liệu rác đã có sẵn, KHÔNG phải hành vi mới.
--
-- CÁCH SỬA
--   1. Với mỗi tên (không phân biệt hoa thường), GIỮ bản ghi có id nhỏ nhất —
--      bản ghi đó đã có form rules, hồ sơ sinh lý, cây bài tập và lịch sử tập.
--   2. Bản ghi dư thừa: soft-delete (moderation_status = 'DELETED', active = 0)
--      và đổi tên thành "<tên gốc> (bản ghi trùng #<id>)" để không còn trùng tên.
--   3. Dữ liệu tham chiếu được chuyển sang bản ghi giữ lại khi không gây xung
--      đột unique key; nếu xung đột thì bản ghi con đó bị xóa (dữ liệu của một
--      bài trùng là dữ liệu rác, không giữ được cũng không mất gì quan trọng).
--
--   Idempotent: sau khi chạy, không còn cặp SYSTEM trùng tên nào.

-- ============================================================
-- 1. Tạm lưu danh sách bản ghi trùng (id dư thừa -> id giữ lại)
-- ============================================================

DROP TEMPORARY TABLE IF EXISTS tmp_exercise_duplicate_map;

CREATE TEMPORARY TABLE tmp_exercise_duplicate_map (
    dup_id     BIGINT NOT NULL,
    keep_id    BIGINT NOT NULL,
    dup_name   VARCHAR(255) NOT NULL,
    PRIMARY KEY (dup_id)
);

-- Mỗi tên (không phân biệt hoa thường, đã trim) chỉ giữ bản ghi có id nhỏ nhất.
INSERT INTO tmp_exercise_duplicate_map (dup_id, keep_id, dup_name)
SELECT e.id,
       keep_row.keep_id,
       e.name
FROM exercises e
JOIN (
    SELECT LOWER(TRIM(name)) AS name_key,
           MIN(id)          AS keep_id
    FROM exercises
    WHERE source = 'SYSTEM'
      AND (moderation_status IS NULL OR UPPER(moderation_status) <> 'DELETED')
    GROUP BY LOWER(TRIM(name))
    HAVING COUNT(*) > 1
) keep_row ON keep_row.name_key = LOWER(TRIM(e.name))
WHERE e.source = 'SYSTEM'
  AND e.id <> keep_row.keep_id
  AND (e.moderation_status IS NULL OR UPPER(moderation_status) <> 'DELETED');

-- ============================================================
-- 2. Xử lý dữ liệu tham chiếu
-- ============================================================

-- 2a. Nhóm cơ: PK (exercise_id, muscle_group_id) -> xóa bản ghi trùng cơ.
DELETE g
FROM exercise_muscle_groups g
JOIN tmp_exercise_duplicate_map m ON g.exercise_id = m.dup_id
LEFT JOIN exercise_muscle_groups kept
  ON kept.exercise_id = m.keep_id AND kept.muscle_group_id = g.muscle_group_id
WHERE kept.exercise_id IS NOT NULL;

UPDATE exercise_muscle_groups g
JOIN tmp_exercise_duplicate_map m ON g.exercise_id = m.dup_id
SET g.exercise_id = m.keep_id;

-- 2b. Hồ sơ sinh lý: PK (exercise_id) -> giữ bản ghi của bài giữ lại nếu đã có.
DELETE p
FROM exercise_physiology_profiles p
JOIN tmp_exercise_duplicate_map m ON p.exercise_id = m.dup_id
LEFT JOIN exercise_physiology_profiles kept ON kept.exercise_id = m.keep_id
WHERE kept.exercise_id IS NOT NULL;

UPDATE exercise_physiology_profiles p
JOIN tmp_exercise_duplicate_map m ON p.exercise_id = m.dup_id
SET p.exercise_id = m.keep_id;

-- 2c. Form rules: mỗi bài có thể có nhiều rule cho cùng khớp -> bản ghi của bài
--     trùng bị xóa để không tạo rule trùng lặp ở bài giữ lại.
DELETE f
FROM form_rules f
JOIN tmp_exercise_duplicate_map m ON f.exercise_id = m.dup_id;

-- 2d. Cây bài tập: UNIQUE (parent_exercise_id, child_exercise_id).
DELETE t
FROM exercise_tree_edges t
JOIN tmp_exercise_duplicate_map m ON t.parent_exercise_id = m.dup_id
LEFT JOIN exercise_tree_edges kept
  ON kept.parent_exercise_id = m.keep_id AND kept.child_exercise_id = t.child_exercise_id
WHERE kept.id IS NOT NULL;

UPDATE exercise_tree_edges t
JOIN tmp_exercise_duplicate_map m ON t.parent_exercise_id = m.dup_id
SET t.parent_exercise_id = m.keep_id;

DELETE t
FROM exercise_tree_edges t
JOIN tmp_exercise_duplicate_map m ON t.child_exercise_id = m.dup_id
LEFT JOIN exercise_tree_edges kept
  ON kept.parent_exercise_id = t.parent_exercise_id AND kept.child_exercise_id = m.keep_id
WHERE kept.id IS NOT NULL;

UPDATE exercise_tree_edges t
JOIN tmp_exercise_duplicate_map m ON t.child_exercise_id = m.dup_id
SET t.child_exercise_id = m.keep_id;

-- 2e. Luật tiến trình: UNIQUE (exercise_id, prerequisite_exercise_id) -> xóa bản ghi
--     của bài trùng (luật của bài trùng không còn ý nghĩa).
DELETE r
FROM progression_rules r
JOIN tmp_exercise_duplicate_map m ON r.exercise_id = m.dup_id;

DELETE r
FROM progression_rules r
JOIN tmp_exercise_duplicate_map m ON r.prerequisite_exercise_id = m.dup_id;

-- 2f. Tiến trình member: UNIQUE (user_id, exercise_id).
DELETE p
FROM member_exercise_progress p
JOIN tmp_exercise_duplicate_map m ON p.exercise_id = m.dup_id
LEFT JOIN member_exercise_progress kept
  ON kept.user_id = p.user_id AND kept.exercise_id = m.keep_id
WHERE kept.id IS NOT NULL;

UPDATE member_exercise_progress p
JOIN tmp_exercise_duplicate_map m ON p.exercise_id = m.dup_id
SET p.exercise_id = m.keep_id;

-- 2g. Bài đã lưu: UNIQUE (user_id, exercise_id).
DELETE s
FROM member_saved_exercises s
JOIN tmp_exercise_duplicate_map m ON s.exercise_id = m.dup_id
LEFT JOIN member_saved_exercises kept
  ON kept.user_id = s.user_id AND kept.exercise_id = m.keep_id
WHERE kept.id IS NOT NULL;

UPDATE member_saved_exercises s
JOIN tmp_exercise_duplicate_map m ON s.exercise_id = m.dup_id
SET s.exercise_id = m.keep_id;

-- 2h. Tiến trình kỹ năng: UNIQUE (member_profile_id, exercise_id).
DELETE p
FROM member_skill_progress p
JOIN tmp_exercise_duplicate_map m ON p.exercise_id = m.dup_id
LEFT JOIN member_skill_progress kept
  ON kept.member_profile_id = p.member_profile_id AND kept.exercise_id = m.keep_id
WHERE kept.id IS NOT NULL;

UPDATE member_skill_progress p
JOIN tmp_exercise_duplicate_map m ON p.exercise_id = m.dup_id
SET p.exercise_id = m.keep_id;

-- 2i. Workout / kế hoạch / kết quả buổi tập / AI chat / tiêu chí benchmark:
--     không có unique key liên quan tới exercise_id -> chuyển thẳng.
UPDATE workout_exercises w
JOIN tmp_exercise_duplicate_map m ON w.exercise_id = m.dup_id
SET w.exercise_id = m.keep_id;

UPDATE workout_plan_items w
JOIN tmp_exercise_duplicate_map m ON w.exercise_id = m.dup_id
SET w.exercise_id = m.keep_id;

UPDATE session_exercise_results s
JOIN tmp_exercise_duplicate_map m ON s.exercise_id = m.dup_id
SET s.exercise_id = m.keep_id;

UPDATE ai_support_messages a
JOIN tmp_exercise_duplicate_map m ON a.exercise_id = m.dup_id
SET a.exercise_id = m.keep_id;

UPDATE benchmark_criteria b
JOIN tmp_exercise_duplicate_map m ON b.exercise_id = m.dup_id
SET b.exercise_id = m.keep_id;

-- ============================================================
-- 3. Soft-delete bản ghi dư thừa + đổi tên cho khỏi trùng
-- ============================================================

UPDATE exercises e
JOIN tmp_exercise_duplicate_map m ON e.id = m.dup_id
SET e.name = CONCAT(TRIM(m.dup_name), ' (bản ghi trùng #', e.id, ')'),
    e.moderation_status = 'DELETED',
    e.active = 0,
    e.updated_at = CURRENT_TIMESTAMP(6);

-- ============================================================
-- 4. Kiểm tra: không còn cặp SYSTEM trùng tên nào
-- ============================================================

DROP PROCEDURE IF EXISTS assert_no_duplicate_system_exercise;
DELIMITER $$
CREATE PROCEDURE assert_no_duplicate_system_exercise()
BEGIN
    IF (
        SELECT COUNT(*) FROM (
            SELECT LOWER(TRIM(name)) AS name_key
            FROM exercises
            WHERE source = 'SYSTEM'
              AND (moderation_status IS NULL OR UPPER(moderation_status) <> 'DELETED')
            GROUP BY LOWER(TRIM(name))
            HAVING COUNT(*) > 1
        ) x
    ) > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'van con bai tap SYSTEM trung ten';
    END IF;
END$$
DELIMITER ;

CALL assert_no_duplicate_system_exercise();
DROP PROCEDURE assert_no_duplicate_system_exercise;

DROP TEMPORARY TABLE IF EXISTS tmp_exercise_duplicate_map;
