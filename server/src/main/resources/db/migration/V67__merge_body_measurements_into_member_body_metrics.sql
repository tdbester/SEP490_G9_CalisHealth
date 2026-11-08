-- Gộp bảng `body_measurements` vào `member_body_metrics`.
--
-- Lý do: hai bảng lưu cùng một dữ liệu (cân nặng + chiều cao của member)
-- nhưng khác tên cột và khác đơn vị:
--   body_measurements   : weight, height,  measured_at   (dùng ở DashboardService)
--   member_body_metrics : weight_kg, height_cm, bmi, recorded_at (dùng ở MemberTrackingRepository)
--
-- Giữ `member_body_metrics` làm bảng chuẩn vì:
--   - có sẵn cột `bmi` được tính sẵn và có CHECK constraint
--   - đã có ON DELETE CASCADE
--   - đang được dùng ở nhiều nơi hơn
--
-- Sau migration này, DashboardService đọc thẳng từ `member_body_metrics`.

-- ============================================================
-- 1. Chuyển dữ liệu từ body_measurements sang member_body_metrics
-- ============================================================
-- member_body_metrics yêu cầu weight_kg/height_cm NOT NULL và có CHECK:
--   weight 20..300, height 100..250, bmi 5..100
-- body_measurements cho phép NULL nên phải lọc bỏ các dòng không hợp lệ
-- (thiếu cân nặng, thiếu chiều cao, hoặc ngoài khoảng CHECK).
INSERT INTO member_body_metrics (
    member_profile_id, weight_kg, height_cm, bmi, recorded_at, note
)
SELECT
    bm.member_profile_id,
    bm.weight,
    bm.height,
    ROUND(
        bm.weight / POWER(bm.height / 100, 2),
        1
    ),
    bm.measured_at,
    'Migrated from body_measurements'
FROM body_measurements bm
WHERE bm.weight IS NOT NULL
  AND bm.height IS NOT NULL
  AND bm.weight BETWEEN 20 AND 300
  AND bm.height BETWEEN 100 AND 250;

-- ============================================================
-- 2. Xóa bảng body_measurements
-- ============================================================
DROP TABLE IF EXISTS body_measurements;
