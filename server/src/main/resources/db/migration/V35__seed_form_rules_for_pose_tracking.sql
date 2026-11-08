-- V35: Form rules cho AI Pose Tracking.
--
-- Mỗi rule mô tả một khớp cần theo dõi khi member tập:
--   angle_threshold : góc (độ) coi là đạt khi đứng thẳng / đủ độ mở khớp
--   rom_depth       : góc (độ) coi là đã xuống đủ sâu
--   feedback_message: câu nhắc cho voice coach
--
-- Màn "Real-time AI Pose Tracking" (Figma 549:683) đọc các rule này qua
-- GET /api/member/form-rules?exerciseCode=... để sinh phản hồi khi form sai.

INSERT INTO form_rules (joint, angle_threshold, rom_depth, feedback_message, exercise_id)
SELECT 'KNEE', 165.000, 100.000,
       'Push your knees outward so they track over your toes.',
       e.id
FROM exercises e
WHERE e.code IN ('EX_3', 'EX_ASSISTED_SQUAT')
  AND NOT EXISTS (
      SELECT 1 FROM (SELECT * FROM form_rules) fr
      WHERE fr.exercise_id = e.id AND fr.joint = 'KNEE'
  );

INSERT INTO form_rules (joint, angle_threshold, rom_depth, feedback_message, exercise_id)
SELECT 'KNEE', 165.000, 95.000,
       'Go deeper — sink your hips below your knees.',
       e.id
FROM exercises e
WHERE e.code IN ('EX_011')
  AND NOT EXISTS (
      SELECT 1 FROM (SELECT * FROM form_rules) fr
      WHERE fr.exercise_id = e.id AND fr.joint = 'KNEE'
  );

INSERT INTO form_rules (joint, angle_threshold, rom_depth, feedback_message, exercise_id)
SELECT 'ELBOW', 160.000, 90.000,
       'Tuck your elbows closer to your ribs.',
       e.id
FROM exercises e
WHERE e.code IN ('EX_1', 'EX-001', 'EX_DIAMOND_PUSHUP', 'EX-002', 'EX_ARCHER_PUSHUP')
  AND NOT EXISTS (
      SELECT 1 FROM (SELECT * FROM form_rules) fr
      WHERE fr.exercise_id = e.id AND fr.joint = 'ELBOW'
  );

INSERT INTO form_rules (joint, angle_threshold, rom_depth, feedback_message, exercise_id)
SELECT 'ELBOW', 160.000, 45.000,
       'Pull all the way to your chest — chin over the bar.',
       e.id
FROM exercises e
WHERE e.code IN ('EX_2', 'EX_NEGATIVE_PULLUP')
  AND NOT EXISTS (
      SELECT 1 FROM (SELECT * FROM form_rules) fr
      WHERE fr.exercise_id = e.id AND fr.joint = 'ELBOW'
  );
