-- Chuẩn hóa tên cột tham chiếu member.
--
-- Trước đây có 5 bảng đều dùng tên `member_id` nhưng trỏ tới 2 bảng khác nhau:
--   - member_favorites, member_feedback, member_saved_exercises,
--     member_exercise_progress  ->  users.id
--   - member_weekly_scores                          ->  member_profiles.id
--
-- Đặt tên lại cho đúng hệ:
--   - user_id          = users.id          (4 bảng nêu trên)
--   - member_profile_id = member_profiles.id (member_weekly_scores)
--
-- Cả 4 bảng kia đang có 0 dòng nên việc đổi tên không mất dữ liệu.
-- member_weekly_scores có dữ liệu nên đổi tên cột, không đổi giá trị.

-- ============================================================
-- 1. Đổi tên ở 4 bảng trỏ tới users
-- ============================================================
ALTER TABLE member_favorites
    CHANGE COLUMN member_id user_id BIGINT NOT NULL;

ALTER TABLE member_feedback
    CHANGE COLUMN member_id user_id BIGINT NOT NULL;

ALTER TABLE member_saved_exercises
    CHANGE COLUMN member_id user_id BIGINT NOT NULL;

ALTER TABLE member_exercise_progress
    CHANGE COLUMN member_id user_id BIGINT NOT NULL;

-- ============================================================
-- 2. Đổi tên ở bảng trỏ tới member_profiles
-- ============================================================
-- Đổi tên cả unique constraint cho khớp tên cột mới.
ALTER TABLE member_weekly_scores
    DROP INDEX uk_member_weekly_scores_member_week_level;

ALTER TABLE member_weekly_scores
    CHANGE COLUMN member_id member_profile_id BIGINT NOT NULL;

ALTER TABLE member_weekly_scores
    ADD CONSTRAINT uk_member_weekly_scores_member_week_level
        UNIQUE (member_profile_id, week_start, fitness_level_id);
