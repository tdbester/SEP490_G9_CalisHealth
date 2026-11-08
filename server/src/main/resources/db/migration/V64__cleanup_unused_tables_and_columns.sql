-- Dọn dẹp schema: xóa cột chết + 4 bảng không còn được code sử dụng.
--
-- 1) Cột chết (không có code nào đọc/ghi):
--    - member_profiles.avatar_url      : avatar thật nằm ở users.avatar_url
--    - member_profiles.avatar_media_id : FK tới media_files (bảng không có repository)
--    - surveys.active_marker           : 0 reference trong toàn bộ codebase
--
-- 2) Bảng thừa (0 dòng, không service/repository nào gọi tới):
--    content_scans, exercise_variations, plan_exercises, media_files
--
-- Ghi chú: session_set_results VẪN dùng (ProgressionRuleService ghi set-level
-- results) nên không nằm trong migration này.
--
-- Thứ tự: phải drop FK trước rồi mới drop bảng/đổi tên cột.

-- ============================================================
-- 1. Bỏ FK avatar_media_id (trỏ tới media_files) trước khi drop bảng
-- ============================================================
ALTER TABLE member_profiles
    DROP FOREIGN KEY fk_member_profiles_avatar_media;

-- ============================================================
-- 2. Drop các bảng không còn dùng
-- ============================================================
-- content_scans có FK tới media_files -> drop trước media_files
DROP TABLE IF EXISTS content_scans;
DROP TABLE IF EXISTS exercise_variations;
DROP TABLE IF EXISTS plan_exercises;
DROP TABLE IF EXISTS media_files;

-- ============================================================
-- 3. Xóa các cột chết
-- ============================================================
ALTER TABLE member_profiles
    DROP COLUMN avatar_url,
    DROP COLUMN avatar_media_id;

ALTER TABLE surveys
    DROP COLUMN active_marker;
