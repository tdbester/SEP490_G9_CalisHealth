-- ============================================================
-- V7: Member Health Tracking & Metric History
-- ============================================================

-- 1. Bảng lưu vết lịch sử số đo cơ thể (Cân nặng, Chiều cao, BMI)
CREATE TABLE IF NOT EXISTS member_body_metrics (
    id                BIGINT         NOT NULL AUTO_INCREMENT,
    member_profile_id BIGINT         NOT NULL,
    weight_kg         DECIMAL(5, 2)  NOT NULL,
    height_cm         DECIMAL(5, 2)  NOT NULL,
    bmi               DECIMAL(4, 1)  NOT NULL,
    recorded_at       DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    note              VARCHAR(255)   DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_mbm_member_date (member_profile_id, recorded_at),
    CONSTRAINT fk_mbm_member_profile FOREIGN KEY (member_profile_id) REFERENCES member_profiles (id) ON DELETE CASCADE,
    CONSTRAINT ck_mbm_weight CHECK (weight_kg >= 20.0 AND weight_kg <= 300.0),
    CONSTRAINT ck_mbm_height CHECK (height_cm >= 100.0 AND height_cm <= 250.0),
    CONSTRAINT ck_mbm_bmi CHECK (bmi >= 5.0 AND bmi <= 100.0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Thêm cột workout_name và category vào workout_sessions để hỗ trợ lọc và hiển thị
ALTER TABLE workout_sessions
    ADD COLUMN workout_name VARCHAR(150) DEFAULT NULL AFTER workout_id,
    ADD COLUMN category VARCHAR(40) NOT NULL DEFAULT 'strength' AFTER workout_name;

-- 3. Tạo chỉ mục tối ưu cho việc truy vấn lịch sử theo member, status và session_date
ALTER TABLE workout_sessions
    ADD INDEX idx_ws_member_status_date (member_profile_id, status, session_date);

-- 4. Khởi tạo dữ liệu đo đầu tiên từ member_profiles nếu đã có cân nặng và chiều cao
INSERT INTO member_body_metrics (member_profile_id, weight_kg, height_cm, bmi, recorded_at, note)
SELECT 
    mp.id,
    mp.weight,
    mp.height,
    ROUND(mp.weight / ((mp.height / 100) * (mp.height / 100)), 1),
    NOW(6),
    'Initial profile metrics'
FROM member_profiles mp
WHERE mp.weight IS NOT NULL 
  AND mp.height IS NOT NULL 
  AND mp.height > 0
  AND NOT EXISTS (
      SELECT 1 FROM member_body_metrics mbm WHERE mbm.member_profile_id = mp.id
  );
