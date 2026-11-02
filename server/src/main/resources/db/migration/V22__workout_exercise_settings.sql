-- Mỗi bài trong workout có cấu hình riêng: số set, số rep hoặc số giây, và thời gian nghỉ giữa các hiệp.
-- Cách đếm (Sets & Reps / Duration) không lưu ở đây: nó suy ra từ exercises.category (REPS / HOLD).
-- Trước đây chỉ có rest chung ở workout_entries.

ALTER TABLE workout_exercises
    ADD COLUMN sets             INT NOT NULL DEFAULT 3,
    ADD COLUMN reps             INT NULL,
    ADD COLUMN duration_seconds INT NULL,
    ADD COLUMN rest_seconds     INT NOT NULL DEFAULT 60;

-- Điền giá trị cho các bài đã có: lấy mặc định của bài tập, rest lấy từ rest chung của workout.
UPDATE workout_exercises we
JOIN exercises e ON e.id = we.exercise_id
JOIN workout_entries w ON w.id = we.workout_id
SET we.sets             = LEAST(GREATEST(COALESCE(e.default_sets, 3), 1), 20),
    we.reps             = CASE WHEN e.category = 'HOLD' THEN NULL
                               ELSE LEAST(GREATEST(COALESCE(e.default_reps, 10), 1), 100) END,
    we.duration_seconds = CASE WHEN e.category = 'HOLD'
                               THEN LEAST(GREATEST(COALESCE(e.duration, 30), 1), 3600) ELSE NULL END,
    we.rest_seconds     = LEAST(GREATEST(w.rest_seconds, 0), 3600);

-- Bỏ "Default rest between sets" của workout: thời gian nghỉ giờ chỉ cấu hình riêng cho từng bài
-- (workout_exercises.rest_seconds vừa được điền từ giá trị này ở trên).
ALTER TABLE workout_entries DROP COLUMN rest_seconds;
