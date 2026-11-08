-- Dọn dẹp schema: xóa cột chết + 3 bảng không còn được code sử dụng.
--
-- 1) Cột chết (không có code nào đọc/ghi):
--    - member_profiles.avatar_url      : avatar thật nằm ở users.avatar_url
--    - member_profiles.avatar_media_id : FK tới media_files, không service nào dùng
--    - surveys.active_marker           : 0 reference trong toàn bộ codebase
--
-- 2) Bảng thừa (0 dòng, không service/repository nào gọi tới):
--    content_scans, exercise_variations, plan_exercises
--
-- Ghi chú: media_files KHÔNG được drop ở đây. Từ V64 (media storage management)
-- bảng này là registry của mọi video/ảnh giải phẫu và có service riêng
-- (MediaRegistryService, MediaCleanupService, AdminStorageService).
--
-- Ghi chú: session_set_results VẪN dùng (ProgressionRuleService ghi set-level
-- results) nên không nằm trong migration này.
--
-- Thứ tự: phải drop FK trước rồi mới drop bảng/đổi tên cột.

-- ============================================================
-- 1. Bỏ FK avatar_media_id (trỏ tới media_files) trước khi xóa cột
-- ============================================================
ALTER TABLE member_profiles
    DROP FOREIGN KEY fk_member_profiles_avatar_media;

-- ============================================================
-- 2. Drop các bảng không còn dùng
-- ============================================================
DROP TABLE IF EXISTS content_scans;
DROP TABLE IF EXISTS exercise_variations;
DROP TABLE IF EXISTS plan_exercises;

-- ============================================================
-- 3. Xóa các cột chết
-- ============================================================
ALTER TABLE member_profiles
    DROP COLUMN avatar_url,
    DROP COLUMN avatar_media_id;

ALTER TABLE surveys
    DROP COLUMN active_marker;
