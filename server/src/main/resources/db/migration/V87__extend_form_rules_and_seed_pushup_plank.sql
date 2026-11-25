-- V87: Mở rộng cấu hình chấm form (AI Pose Tracking) cho push-up & plank.
--
-- 1) Mở rộng bảng `form_rules` để biểu diễn được đầy đủ 5 thành phần chấm điểm:
--      - min_angle / max_angle : dải góc "đạt" cho thân thẳng (plank, hip line)
--      - weight                : trọng số thành phần trong tổng điểm rep
--      - tolerance             : dung sai cho phép (độ) -> vùng dung quanh ngưỡng
--      - source                : nguồn gốc rule (DEFAULT | CONTENT_MANAGER | MEMBER)
--
-- 2) Bảng `form_rule_presets` : bộ ngưỡng mẫu dùng để GỢI Ý cho member khi tạo
--    bài tập custom. Gợi ý được tính từ trung bình các rule đang tồn tại của các bài
--    cùng `movement_group` (PUSH/PULL/LEGS/CORE).
--
-- 3) Thêm `movement_group` cho bài tập do member tạo (trước đây chỉ bài hệ thống
--    mới có) -> cần để gợi ý ngưỡng và phân nhóm bài trong Exercise Tree.
--
-- 4) Seed lại ngưỡng chấm form cho push-up (EX_1) và plank (EX_4) theo số đo
--    thực tế: góc khuỷu 164.99° -> 96.91° (standard push-up), 154.45° -> 96.91°
--    (diamond), 154.45° -> 118.23° (archer).
--
-- Lưu ý tương thích ngược: rule cũ chỉ có angle_threshold/rom_depth vẫn đọc
-- được như cũ (client tự fallback về cột cũ khi min_angle/max_angle rỗng).

-- ============================================================
-- 1) MỞ RỘNG form_rules
-- ============================================================
ALTER TABLE form_rules
    ADD COLUMN min_angle  DECIMAL(7, 3) DEFAULT NULL,
    ADD COLUMN max_angle  DECIMAL(7, 3) DEFAULT NULL,
    ADD COLUMN weight     DECIMAL(5, 2) DEFAULT NULL,
    ADD COLUMN tolerance  DECIMAL(7, 3) DEFAULT NULL,
    ADD COLUMN source     VARCHAR(20)  DEFAULT NULL;

-- Rule cũ chưa có trọng số / nguồn -> gán mặc định để không có dòng nào null.
UPDATE form_rules SET weight = 0.30 WHERE weight IS NULL;
UPDATE form_rules SET source = 'DEFAULT' WHERE source IS NULL;

-- Cột `source` chỉ nhận 3 giá trị này.
ALTER TABLE form_rules
    ADD CONSTRAINT ck_form_rules_source CHECK (source IS NULL OR source IN ('DEFAULT', 'CONTENT_MANAGER', 'MEMBER'));

-- ============================================================
-- 2) BẢNG form_rule_presets  (bộ ngưỡng mẫu cho member chọn/gợi ý)
-- ============================================================
-- Mỗi preset thuộc 1 nhóm chuyển động + 1 loại bài (REPS/HOLD).
-- `rules_json` lưu danh sách ngưỡng dạng JSON để không cần bảng con.
CREATE TABLE IF NOT EXISTS form_rule_presets (
    id              BIGINT        NOT NULL AUTO_INCREMENT,
    code            VARCHAR(60)   NOT NULL,
    name            VARCHAR(120)  NOT NULL,
    category        VARCHAR(40)   NOT NULL,
    movement_group  VARCHAR(20)   NOT NULL,
    rules_json      TEXT          NOT NULL,
    description     TEXT          DEFAULT NULL,
    active          TINYINT(1)    NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uk_form_rule_presets_code (code),
    KEY idx_form_rule_presets_group (movement_group, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bộ ngưỡng mẫu. Số liệu góc lấy từ phép đo thực tế trên bài push-up.
INSERT INTO form_rule_presets (code, name, category, movement_group, rules_json, description)
VALUES
  ('PUSHUP_STANDARD', 'Push-up (standard)', 'REPS', 'PUSH',
   '[{"joint":"ELBOW","angleThreshold":165.0,"romDepth":97.0,"weight":0.30,"tolerance":20.0,"feedbackMessage":"Tuck your elbows closer to your ribs."},{"joint":"HIP","minAngle":165.0,"maxAngle":180.0,"weight":0.25,"tolerance":15.0,"feedbackMessage":"Keep your hips level and brace your core."}]',
   'Standard push-up: elbow angle goes from 165° at the top down to 97° at the bottom.'),
  ('PUSHUP_DIAMOND', 'Push-up (diamond)', 'REPS', 'PUSH',
   '[{"joint":"ELBOW","angleThreshold":158.0,"romDepth":97.0,"weight":0.30,"tolerance":20.0,"feedbackMessage":"Keep your hands under your chest and elbows close."},{"joint":"HIP","minAngle":165.0,"maxAngle":180.0,"weight":0.25,"tolerance":15.0,"feedbackMessage":"Keep your hips level and brace your core."}]',
   'Diamond push-up: hands close together under the chest.'),
  ('PUSHUP_ARCHER', 'Push-up (archer)', 'REPS', 'PUSH',
   '[{"joint":"ELBOW","angleThreshold":155.0,"romDepth":118.0,"weight":0.30,"tolerance":20.0,"feedbackMessage":"Lower the working arm slowly and keep the torso steady."},{"joint":"HIP","minAngle":165.0,"maxAngle":180.0,"weight":0.25,"tolerance":15.0,"feedbackMessage":"Keep your hips level and brace your core."}]',
   'Archer push-up: one arm reaches out to the side, so the range of motion is narrower.'),
  ('PLANK_STANDARD', 'Plank', 'HOLD', 'CORE',
   '[{"joint":"HIP","minAngle":165.0,"maxAngle":180.0,"weight":0.60,"tolerance":15.0,"feedbackMessage":"Keep your body in one straight line from head to heels."}]',
   'Plank: body angle between shoulders, hips and knees must stay between 165° and 180°.'),
  ('WALL_SIT', 'Wall sit', 'HOLD', 'LEGS',
   '[{"joint":"KNEE","angleThreshold":90.0,"romDepth":100.0,"weight":0.60,"tolerance":15.0,"feedbackMessage":"Keep your knees bent at a right angle."}]',
   'Wall sit: thighs stay roughly parallel to the floor.');

-- ============================================================
-- 3) movement_group cho bài tập do member tạo
-- ============================================================
-- Cột `movement_group` ĐÃ TỒN TẠI từ V25__init_library_module.sql (VARCHAR(20) NULL)
-- và V83 đã gán cho 11 bài CUSTOM còn thiếu. Ở đây chỉ bổ sung cho các bài hệ
-- thống còn NULL (do tên bài không khớp từ khóa nào) để mọi bài đều thuộc 1 nhóm
-- -> gợi ý ngưỡng cho member luôn có dữ liệu để so sánh.
--
-- Không thêm CHECK constraint vì V25 đã để cột VARCHAR(20) tự do và các bài
-- cũ có thể đang chứa giá trị ngoài enum -> thêm ràng buộc sẽ fail migrate.

-- Gán nhóm cho các bài hệ thống sẵn có theo tên (bài do member tạo sẽ được
-- gán khi họ khai báo ở form tạo bài).
UPDATE exercises
SET movement_group = 'CORE'
WHERE movement_group IS NULL
  AND (LOWER(name) LIKE '%plank%' OR LOWER(name) LIKE '%hollow%' OR LOWER(name) LIKE '%sit%'
       OR LOWER(name) LIKE '%flag%' OR LOWER(name) LIKE '%abs%' OR LOWER(name) LIKE '%core%');

UPDATE exercises
SET movement_group = 'LEGS'
WHERE movement_group IS NULL
  AND (LOWER(name) LIKE '%squat%' OR LOWER(name) LIKE '%lunge%' OR LOWER(name) LIKE '%calf%'
       OR LOWER(name) LIKE '%leg%' OR LOWER(name) LIKE '%nordic%' OR LOWER(name) LIKE '%pistol%');

UPDATE exercises
SET movement_group = 'PULL'
WHERE movement_group IS NULL
  AND (LOWER(name) LIKE '%pull%' OR LOWER(name) LIKE '%row%' OR LOWER(name) LIKE '%lever%'
       OR LOWER(name) LIKE '%muscle up%' OR LOWER(name) LIKE '%chin up%' OR LOWER(name) LIKE '%hang%');

UPDATE exercises
SET movement_group = 'PUSH'
WHERE movement_group IS NULL
  AND (LOWER(name) LIKE '%push%' OR LOWER(name) LIKE '%dip%' OR LOWER(name) LIKE '%press%'
       OR LOWER(name) LIKE '%planche%' OR LOWER(name) LIKE '%handstand%');

-- Bài còn NULL (không khớp từ khóa nào) -> xem nhóm PUSH làm mặc định an toàn,
-- đồng thời khớp với logic suy luận sẵn có ở client (utils/exerciseMedia.js).
UPDATE exercises
SET movement_group = 'PUSH'
WHERE movement_group IS NULL;

-- ============================================================
-- 4) SEED lại ngưỡng cho push-up (EX_1) và plank (EX_4)
-- ============================================================
-- Xoá rule ELBOW cũ của các biến thể push-up để seed lại theo số đo thực tế.
DELETE fr
FROM form_rules fr
JOIN exercises e ON e.id = fr.exercise_id
WHERE fr.joint = 'ELBOW'
  AND e.code IN ('EX_1', 'EX-001', 'EX_DIAMOND_PUSHUP', 'EX-002', 'EX_ARCHER_PUSHUP');

-- Push-up tiêu chuẩn (EX_1): khuỷu 165° (trên) -> 97° (đáy).
INSERT INTO form_rules (joint, angle_threshold, rom_depth, weight, tolerance, source, feedback_message, exercise_id)
SELECT 'ELBOW', 165.000, 97.000, 0.30, 20.000, 'DEFAULT',
       'Tuck your elbows closer to your ribs.',
       e.id
FROM exercises e
WHERE e.code IN ('EX_1', 'EX-001')
  AND NOT EXISTS (
      SELECT 1 FROM (SELECT * FROM form_rules) fr
      WHERE fr.exercise_id = e.id AND fr.joint = 'ELBOW'
  );

-- Push-up kim cương: khuỷu 158° (trên) -> 97° (đáy).
INSERT INTO form_rules (joint, angle_threshold, rom_depth, weight, tolerance, source, feedback_message, exercise_id)
SELECT 'ELBOW', 158.000, 97.000, 0.30, 20.000, 'DEFAULT',
       'Keep your hands under your chest and elbows close.',
       e.id
FROM exercises e
WHERE e.code IN ('EX_DIAMOND_PUSHUP')
  AND NOT EXISTS (
      SELECT 1 FROM (SELECT * FROM form_rules) fr
      WHERE fr.exercise_id = e.id AND fr.joint = 'ELBOW'
  );

-- Push-up archer: khuỷu 155° (trên) -> 118° (đáy) — ROM hẹp hơn.
INSERT INTO form_rules (joint, angle_threshold, rom_depth, weight, tolerance, source, feedback_message, exercise_id)
SELECT 'ELBOW', 155.000, 118.000, 0.30, 20.000, 'DEFAULT',
       'Lower the working arm slowly and keep the torso steady.',
       e.id
FROM exercises e
WHERE e.code IN ('EX_ARCHER_PUSHUP')
  AND NOT EXISTS (
      SELECT 1 FROM (SELECT * FROM form_rules) fr
      WHERE fr.exercise_id = e.id AND fr.joint = 'ELBOW'
  );

-- Thân thẳng (HIP) cho các biến thể push-up: dải 165°-180°.
INSERT INTO form_rules (joint, min_angle, max_angle, weight, tolerance, source, feedback_message, exercise_id)
SELECT 'HIP', 165.000, 180.000, 0.25, 15.000, 'DEFAULT',
       'Keep your hips level and brace your core.',
       e.id
FROM exercises e
WHERE e.code IN ('EX_1', 'EX-001', 'EX_DIAMOND_PUSHUP', 'EX_ARCHER_PUSHUP')
  AND NOT EXISTS (
      SELECT 1 FROM (SELECT * FROM form_rules) fr
      WHERE fr.exercise_id = e.id AND fr.joint = 'HIP'
  );

-- Plank (EX_4): thân thẳng tuyệt đối 165°-180°.
INSERT INTO form_rules (joint, min_angle, max_angle, weight, tolerance, source, feedback_message, exercise_id)
SELECT 'HIP', 165.000, 180.000, 0.60, 15.000, 'DEFAULT',
       'Keep your body in one straight line from head to heels.',
       e.id
FROM exercises e
WHERE e.code IN ('EX_4')
  AND NOT EXISTS (
      SELECT 1 FROM (SELECT * FROM form_rules) fr
      WHERE fr.exercise_id = e.id AND fr.joint = 'HIP'
  );

-- Ngưỡng HOLD theo từng bài (bỏ giá trị hardcode 150° ở client):
-- Wall sit / wall handstand hold cần thân thẳng hơn plank.
INSERT INTO form_rules (joint, min_angle, max_angle, weight, tolerance, source, feedback_message, exercise_id)
SELECT 'HIP', 160.000, 180.000, 0.60, 15.000, 'DEFAULT',
       'Keep your body stacked straight from head to heels.',
       e.id
FROM exercises e
WHERE e.code IN ('EX_HANDSTAND', 'EX_WALL_HANDSTAND_HOLD')
  AND NOT EXISTS (
      SELECT 1 FROM (SELECT * FROM form_rules) fr
      WHERE fr.exercise_id = e.id AND fr.joint = 'HIP'
  );
