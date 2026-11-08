-- Chuẩn hóa trạng thái và tên level của workout.
--
-- 1) Level 'Elite' không tồn tại trong bảng fitness_levels (level cao nhất tên là 'Expert').
--    WorkoutService.resolveLevelName() và DailyPlanTemplateService.resolveLevelName() tra
--    fitness_levels nên workout/template level 'Elite' không map được sang level nào.
--    Đổi 'Elite' -> 'Expert'.
--
-- 2) workout_entries có 3 cột trạng thái chồng lấn:
--      status           (ACCEPTED)             -> trạng thái duyệt nội dung
--      template_status  (DRAFT/PUBLISHED/ARCHIVED) -> trạng thái publish của template
--      active           (tinyint)              -> trùng lặp hoàn toàn với template_status
--    Đổi tên status -> moderation_status cho khớp với exercises.moderation_status,
--    và chuẩn hóa giá trị 'ACCEPTED' -> 'ACTIVE' cho cùng từ vựng.
--
-- 3) Bỏ cột active: nó luôn bằng (template_status = 'PUBLISHED'). Trước khi bỏ, đồng bộ
--    những dòng đang lệch (active = 0 nhưng template_status = 'PUBLISHED') về 'DRAFT'.
--
-- 4) Chuẩn hóa level của workout về đúng tên trong fitness_levels. Hiện có cả 'Beginner'
--    (title case, do seed V24) và 'BEGINNER' (upper case, do code ghi) nên lọc theo level
--    không khớp giữa các nguồn. Chuẩn hóa về tên trong fitness_levels (title case).

-- ============================================================
-- 1) Level Elite -> Expert
-- ============================================================
UPDATE workout_entries SET level = 'Expert' WHERE level = 'Elite';
UPDATE daily_plan_templates SET level = 'Expert' WHERE level = 'Elite';

-- ============================================================
-- 2) status -> moderation_status, gia tri ACCEPTED -> ACTIVE
-- ============================================================
ALTER TABLE workout_entries
    CHANGE COLUMN status moderation_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

UPDATE workout_entries SET moderation_status = 'ACTIVE' WHERE moderation_status = 'ACCEPTED';

-- Index idx_workouts_community dùng cột status, cần dựng lại theo tên cột mới.
ALTER TABLE workout_entries DROP INDEX idx_workouts_community;

ALTER TABLE workout_entries
    ADD INDEX idx_workouts_community (source, is_shared_with_community, moderation_status, created_at);

-- ============================================================
-- 3) Bo cot active, dung template_status lam nguon suy ra
-- ============================================================
-- Dong bo truoc khi xoa: workout dang an (active = 0) o trang thai DRAFT.
UPDATE workout_entries
SET template_status = 'DRAFT'
WHERE active = FALSE
  AND template_status = 'PUBLISHED';

ALTER TABLE workout_entries DROP INDEX idx_workout_entries_active;
ALTER TABLE workout_entries DROP INDEX idx_workout_entries_created_by_active;

ALTER TABLE workout_entries DROP COLUMN active;

ALTER TABLE workout_entries
    ADD INDEX idx_workout_entries_template_status (template_status);

ALTER TABLE workout_entries
    ADD INDEX idx_workout_entries_created_by_template_status (created_by, template_status);

-- ============================================================
-- 4) Chuẩn hóa level về tên trong fitness_levels (title case)
-- ============================================================
UPDATE workout_entries w
JOIN fitness_levels fl ON fl.name = UPPER(w.level)
SET w.level = fl.name
WHERE w.level <> fl.name;

UPDATE daily_plan_templates t
JOIN fitness_levels fl ON fl.name = UPPER(t.level)
SET t.level = fl.name
WHERE t.level <> fl.name;
