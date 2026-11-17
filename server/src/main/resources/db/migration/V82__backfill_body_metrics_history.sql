-- V82: bảo đảm mọi số đo trên hồ sơ đều có dòng lịch sử trong member_body_metrics.
--
-- Vì sao cần:
--   Health Tracking đọc số đo mới nhất từ `member_body_metrics` (xem
--   MemberTrackingRepository.findLatestBodyMetrics) và chỉ fallback sang
--   `member_profiles` khi bảng lịch sử còn TRỐNG HOÀN TOÀN. Cột weight/height
--   của `member_profiles` là "giá trị hiện tại", còn `member_body_metrics` là
--   "lịch sử đo" — biểu đồ BMI theo tháng và biến thiên cân nặng đều đọc bảng
--   lịch sử.
--
--   Trước migration này có 13 tài khoản seed (leaderboard.*) đã có weight/height
--   trên `member_profiles` nhưng KHÔNG có dòng nào trong `member_body_metrics`
--   (V9 chỉ backfill 1 lần lúc seed, các tài khoản seed sau đó không được backfill).
--   Hệ quả: Health Tracking không có dòng lịch sử nào để vẽ biểu đồ BMI theo tháng
--   và không tính được biến thiên cân nặng trong tháng.
--
--   Migration này tạo dòng lịch sử đầu tiên cho những hồ sơ đó, đúng như cách
--   SurveyProfileSync ghi khi member hoàn thành khảo sát onboarding.

-- ============================================================
-- 1. Tạo bản ghi đo đầu tiên cho hồ sơ có số đo nhưng chưa có lịch sử.
--    BMI tính đúng theo công thức: weight / (height_m ^ 2), làm tròn 1 chữ số thập phân.
-- ============================================================
INSERT INTO member_body_metrics (member_profile_id, weight_kg, height_cm, bmi, recorded_at, note)
SELECT
    mp.id,
    mp.weight,
    mp.height,
    ROUND(mp.weight / POWER(mp.height / 100, 2), 1),
    NOW(6),
    'Initial profile metrics'
FROM member_profiles mp
WHERE mp.weight IS NOT NULL
  AND mp.height IS NOT NULL
  AND mp.height > 0
  AND mp.weight >= 20.0
  AND mp.weight <= 300.0
  AND mp.height >= 100.0
  AND mp.height <= 250.0
  AND NOT EXISTS (
      SELECT 1
      FROM member_body_metrics mbm
      WHERE mbm.member_profile_id = mp.id
  );

-- ============================================================
-- 2. Đồng bộ `member_profiles` với bản ghi lịch sử MỚI NHẤT.
--    Ý nghĩa: giá trị hiện tại trên hồ sơ và giá trị mà Health Tracking hiển thị
--    phải là một. Nếu member đã cập nhật số đo qua màn Health Tracking (ghi vào
--    member_body_metrics) nhưng hồ sơ lại lệch, màn hình sẽ hiển thị hai con số
--    khác nhau. Lệnh này đồng bộ chiều hồ sơ <- lịch sử (lịch sử là nguồn chuẩn
--    vì đó là nơi mọi lần đo được ghi).
-- ============================================================
UPDATE member_profiles mp
    JOIN (
        SELECT mbm.member_profile_id,
               mbm.weight_kg,
               mbm.height_cm
        FROM member_body_metrics mbm
        JOIN (
            SELECT member_profile_id,
                   MAX(recorded_at) AS latest_at
            FROM member_body_metrics
            GROUP BY member_profile_id
        ) newest
          ON newest.member_profile_id = mbm.member_profile_id
         AND newest.latest_at = mbm.recorded_at
    ) latest ON latest.member_profile_id = mp.id
SET mp.weight = latest.weight_kg,
    mp.height = latest.height_cm;
