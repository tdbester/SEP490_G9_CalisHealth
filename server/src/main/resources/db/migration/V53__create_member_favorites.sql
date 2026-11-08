-- V57: Favorite (bookmark) cho Member trên cả Exercise lẫn Workout.
--
-- Mục đích
-- ------
-- Member đánh dấu sao (⭐) trong thư viện và gom các mục đã lưu vào một màn
-- "Favorites" để tập lại. Cần phân biệt rõ 4 nhóm nội dung:
--   - Exercise của hệ thống (Content Manager quản lý)
--   - Exercise do Member cung cấp (community / personal)
--   - Workout của hệ thống
--   - Workout do Member cung cấp
--
-- Vì sao tạo bảng mới thay vì dùng `member_saved_exercises`
-- -------------------------------------------------------
-- `member_saved_exercises` đã có sẵn (V25) và gắn FK tới `exercises`, nên về lý thuyết
-- có thể dùng lại cho Exercise. Tuy nhiên bảng đó chỉ được dùng để đếm "saveCount"
-- của bài community, chưa có API toggle cho Member và chưa có cơ chế phân biệt
-- System / Member provided. Để hồ sơ migration không bị rối (V1-V56 là lịch sử bất biến,
-- không sửa), migration này tạo bảng `member_favorites` riêng cho cả Exercise lẫn Workout
-- với `item_type` phân loại. Bảng cũ giữ nguyên vẫn dùng cho saveCount.
--
-- `item_type`:
--   SYSTEM_EXERCISE    — bài tập do Content Manager tạo, nằm trong cây progression
--   MEMBER_EXERCISE    — bài tập do Member tự tạo / cộng đồng chia sẻ
--   SYSTEM_WORKOUT     — workout do Content Manager tạo (health / skill)
--   MEMBER_WORKOUT     — workout do Member tự tạo / cộng đồng chia sẻ
--
-- Ghi chú: `item_type` được xác định khi toggle và lưu lại cùng lúc, nên khi đọc
-- danh sách Favorites không cần suy ra lại từ bảng `exercises` / `workout_entries`.

CREATE TABLE IF NOT EXISTS member_favorites (
    id BIGINT NOT NULL AUTO_INCREMENT,
    member_id BIGINT NOT NULL,
    item_type VARCHAR(30) NOT NULL,
    item_id BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_member_favorite (member_id, item_type, item_id),
    KEY idx_member_favorites_member (member_id, item_type, created_at),
    CONSTRAINT fk_member_favorite_member FOREIGN KEY (member_id)
        REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
