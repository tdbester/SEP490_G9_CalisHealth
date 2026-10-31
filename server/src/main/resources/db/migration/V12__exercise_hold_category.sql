-- exercises.category là cách đo bài: REPS (đếm rep) hoặc HOLD (giữ tư thế, thời gian ở cột duration).
-- Bài nạp từ V4 lại lưu nhóm cơ vào đây (Core, Pull...) nên app coi mọi bài là REPS; nhóm cơ đã có ở
-- exercise_muscle_groups. Cập nhật theo tên để chạy được trên mọi DB, chạy lại không đổi gì.

UPDATE exercises
SET category = 'HOLD'
WHERE name IN ('Plank', 'Handstand', 'Front lever', 'Planche')
   OR LOWER(name) LIKE '%hold%'
   OR LOWER(name) LIKE '%front lever%';

-- Plank lưu 45 giây nhầm vào default_reps
UPDATE exercises
SET duration = COALESCE(duration, default_reps),
    default_reps = NULL
WHERE category = 'HOLD'
  AND default_reps IS NOT NULL;

UPDATE exercises
SET category = 'REPS'
WHERE category IS NULL
   OR category NOT IN ('REPS', 'HOLD');
