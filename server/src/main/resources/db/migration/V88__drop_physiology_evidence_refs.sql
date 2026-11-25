-- V88: Bỏ lớp trích dẫn bằng chứng khỏi module Sinh lý.
--
-- LÝ DO
--   Lớp bằng chứng (thư viện nguồn học thuật + cột evidence_refs) không mang
--   lại giá trị giao diện: không còn màn hình nào cho người dùng cuối xem danh
--   mục nguồn, và các hồ sơ sinh lý vẫn dùng được bình thường khi không có
--   cột này. Giữ lại cột làm schema rồi (ERD phải giải thích JSON array mã
--   nguồn không có khóa ngoài) và kéo dài vòng đời bảo trì.
--
--   Bảng physiology_evidence đã bị bỏ ở V80; thư viện file tĩnh tương ứng
--   (physiology-evidence-library.json + PhysiologyEvidenceLibrary) cũng đã bị
--   gỡ khỏi mã nguồn. Migration này dọn nốt hai cột JSON còn sót lại.
--
-- GIỮ NGUYÊN
--   - Bảng exercise_physiology_profiles và physiology_alert_rules: hồ sơ sinh lý
--     và luật cảnh báo vẫn dùng để hiển thị cho member và grounding cho AI Support.
--   - Các cột vận động học (contraction_type, lever_grade, cardiovascular_load,
--     hr_zone_low/high, blood_pressure_effect, valsalva_risk, gi_risk,
--     tendon_load, primary_joint, breathing_cue, contraindications,
--     physiology_note) không đổi.

-- Xoá cột trích dẫn khỏi hồ sơ sinh lý.
-- MySQL 8 không có DROP COLUMN IF EXISTS nên dùng guard qua information_schema,
-- giống V32/V36/V81/V83/V84.
SET @has_profile_evidence := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exercise_physiology_profiles' AND COLUMN_NAME = 'evidence_refs');
SET @sql := IF(@has_profile_evidence > 0,
    'ALTER TABLE exercise_physiology_profiles DROP COLUMN evidence_refs', 'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Xoá cột trích dẫn khỏi luật cảnh báo.
SET @has_rule_evidence := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'physiology_alert_rules' AND COLUMN_NAME = 'evidence_refs');
SET @sql := IF(@has_rule_evidence > 0,
    'ALTER TABLE physiology_alert_rules DROP COLUMN evidence_refs', 'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
