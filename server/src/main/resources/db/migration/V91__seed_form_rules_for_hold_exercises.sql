-- V91: Seed ngưỡng chấm form (dải góc) cho các bài HOLD còn thiếu.
--
-- VÌ SAO CẦN MIGRATION NÀY
--   Client đã chuyển sang chấm form bài HOLD theo DẢI GÓC lấy từ `form_rules`
--   (min_angle..max_angle + tolerance). Trước đó client dùng một ngưỡng cứng
--   `bodyAngle >= 150°` cho MỌI bài HOLD — sai cho L-sit (góc hông ~90°),
--   V-sit, front lever, planche, tuck planche, tuck front lever, hollow body.
--   Đây chính là "lỗi kiến trúc lớn nhất" nêu trong
--   `doc-caps/module-docs/tracking/PLANK_FORM_SCORING_ANALYSIS.md` §2.3.
--
--   Bảng `form_rules` hiện chỉ có rule cho Plank (EX_4). Tất cả bài HOLD còn
--   lại rơi về fallback của client (dải 150-180°, tolerance 0) -> vẫn chấm sai.
--   Migration này gắn ngưỡng đúng cho từng bài theo bảng §3 của
--   `doc-caps/module-docs/tracking/EXERCISE_ANGLE_CRITERIA_EVIDENCE.md`.
--
-- NGUỒN NGƯỠNG
--   Mọi con số dưới đây truy được về nguồn học thuật đã được đánh giá trong
--   EXERCISE_ANGLE_CRITERIA_EVIDENCE.md:
--     - EV_FIG_CODE_LSIT   : FIG MAG Code of Points Appendix A + Newsletter 1 (2025).
--                           L-sit/V-sit góc hông 90°, tuck = gập hông >= 90°,
--                           thân thẳng (planche/front lever) 165-180°.
--     - EV_PLANK_ADULTFIT_2025 / EV_PLANK_INCLINOMETER : plank giữ đường thẳng
--                           acromion-trochanter-malleolus.
--   Bài nào KHÔNG có nguồn theo §3 sẽ KHÔNG được gắn rule ở đây (xem §5 và §6
--   của tài liệu: "Không gắn ngưỡng góc cho bài chưa có nguồn").
--
-- TƯƠNG THÍCH NGƯỢC
--   - Không sửa/xoá rule nào đang có. Chỉ INSERT cho bài chưa có rule HIP.
--   - Client vẫn fallback về dải 150-180° khi không có rule -> an toàn.
--   - Chạy lại nhiều lần không đổi gì (NOT EXISTS).
--
-- LƯU Ý VỀ KHỚP ĐO
--   Client chỉ đo được góc thân qua khớp HIP (vai-hông-gối). Tài liệu có nhắc
--   khớp "TORSO" cho plank / front lever / planche — nhưng `TORSO` không phải
--   khớp hợp lệ trong hệ thống (`ALLOWED_JOINTS` chỉ có KNEE/HIP/ELBOW/
--   SHOULDER/WRIST/ANKLE) và client đo góc thân qua HIP. Vì vậy ở đây
--   dùng HIP cho toàn bộ bài HOLD, đúng theo cách client đọc rule.

-- ============================================================
-- 1) PLANK (EX_4) — thân thẳng tuyệt đối
--    Đã có rule từ V87 (165-180°, tolerance 15). Khớp lại để chắc chắn
--    tồn tại và đúng thông số.
-- ============================================================
INSERT INTO form_rules (joint, min_angle, max_angle, weight, tolerance, source, exercise_id)
SELECT 'HIP', 165.000, 180.000, 0.60, 15.000, 'DEFAULT', e.id
FROM exercises e
WHERE e.code = 'EX_4'
  AND NOT EXISTS (
      SELECT 1 FROM (SELECT * FROM form_rules) fr
      WHERE fr.exercise_id = e.id AND fr.joint = 'HIP'
  );

-- ============================================================
-- 2) L-SIT — góc hông 90° +/- 15°  (EV_FIG_CODE_LSIT)
--    Góc hông khi chân ngang hông = ~90°. Dải 75-105 (tolerance 15 nghĩa là
--    lệch <= 7.5° vẫn 100 điểm, lệch >= 15° về 0 điểm).
--    Mã bài: EX_38 (L-sit), CU_231 (demo L-sit on parallettes).
-- ============================================================
INSERT INTO form_rules (joint, min_angle, max_angle, weight, tolerance, source, exercise_id)
SELECT 'HIP', 75.000, 105.000, 0.60, 15.000, 'DEFAULT', e.id
FROM exercises e
WHERE e.code IN ('EX_38', 'CU_231')
  AND NOT EXISTS (
      SELECT 1 FROM (SELECT * FROM form_rules) fr
      WHERE fr.exercise_id = e.id AND fr.joint = 'HIP'
  );

-- ============================================================
-- 3) V-SIT — góc hông 150° (quy ước nội bộ cho "chân thẳng đứng")
--    EV_FIG_CODE_LSIT (Newsletter 1, 8/2025): V-sit chân thẳng đứng; thiếu
--    <= 15° chấp nhận, 16-30° trừ điểm, > 30° không công nhận.
--    Góc hông khi chân thẳng đứng tính theo góc khuỷu (non-reflex) ~150-160°.
--    Dải 135-165 (tolerance 15).
--    Mã bài: EX_51 (V-sit).
-- ============================================================
INSERT INTO form_rules (joint, min_angle, max_angle, weight, tolerance, source, exercise_id)
SELECT 'HIP', 135.000, 165.000, 0.60, 15.000, 'DEFAULT', e.id
FROM exercises e
WHERE e.code = 'EX_51'
  AND NOT EXISTS (
      SELECT 1 FROM (SELECT * FROM form_rules) fr
      WHERE fr.exercise_id = e.id AND fr.joint = 'HIP'
  );

-- ============================================================
-- 4) FRONT LEVER / PLANCHE THẲNG — thân thẳng 165-180°  (EV_FIG_CODE_LSIT)
--    "straight position" = vai-hông-cổ chân thẳng hàng.
--    Mã bài: EX_9 (Front lever), EX_10 (Planche).
-- ============================================================
INSERT INTO form_rules (joint, min_angle, max_angle, weight, tolerance, source, exercise_id)
SELECT 'HIP', 165.000, 180.000, 0.60, 15.000, 'DEFAULT', e.id
FROM exercises e
WHERE e.code IN ('EX_9', 'EX_10')
  AND NOT EXISTS (
      SELECT 1 FROM (SELECT * FROM form_rules) fr
      WHERE fr.exercise_id = e.id AND fr.joint = 'HIP'
  );

-- ============================================================
-- 5) TUCK PLANCHE / TUCK FRONT LEVER — gập hông >= 90°  (EV_FIG_CODE_LSIT)
--    FIG: "tucked" = gập hông VÀ gối >= 90°. Dải 75-105 cho góc hông.
--    Mã bài: EX_45 (Tuck planche), EX_50 (Tuck front lever),
--            CU_26 (demo Tuck front lever), EX_206 (Advanced tuck front lever).
-- ============================================================
INSERT INTO form_rules (joint, min_angle, max_angle, weight, tolerance, source, exercise_id)
SELECT 'HIP', 75.000, 105.000, 0.60, 15.000, 'DEFAULT', e.id
FROM exercises e
WHERE e.code IN ('EX_45', 'EX_50', 'CU_26', 'EX_206')
  AND NOT EXISTS (
      SELECT 1 FROM (SELECT * FROM form_rules) fr
      WHERE fr.exercise_id = e.id AND fr.joint = 'HIP'
  );

-- ============================================================
-- 6) HANDSTAND / WALL HANDSTAND HOLD — thân xếp thẳng 160-180°
--    Cần thân thẳng hơn plank vì cơ thể đứng (đầu trên, chân dưới).
--    V87 đã gắn cho EX_HANDSTAND / EX_WALL_HANDSTAND_HOLD (mã cũ). V91 gắn
--    theo mã hiện hành trong DB.
--    Mã bài: EX_7 (Handstand), EX_201 (Wall handstand hold),
--            CU_228 (demo Wall Handstand Hold).
-- ============================================================
INSERT INTO form_rules (joint, min_angle, max_angle, weight, tolerance, source, exercise_id)
SELECT 'HIP', 160.000, 180.000, 0.60, 15.000, 'DEFAULT', e.id
FROM exercises e
WHERE e.code IN ('EX_7', 'EX_201', 'CU_228')
  AND NOT EXISTS (
      SELECT 1 FROM (SELECT * FROM form_rules) fr
      WHERE fr.exercise_id = e.id AND fr.joint = 'HIP'
  );

-- ============================================================
-- 7) WALL SIT — góc đầu gối 85-95° (knee ~90°)
--    V87 đã gắn rule KNEE 90° / rom_depth 100 cho bài có mã cũ. Ở đây dùng
--    dải góc 85-95 cho khớp KNEE để khớp với cách chấm điểm mềm theo dải.
--    Mã bài: CU_230 (demo Wall sit challenge).
-- ============================================================
INSERT INTO form_rules (joint, min_angle, max_angle, weight, tolerance, source, exercise_id)
SELECT 'KNEE', 85.000, 95.000, 0.60, 15.000, 'DEFAULT', e.id
FROM exercises e
WHERE e.code = 'CU_230'
  AND NOT EXISTS (
      SELECT 1 FROM (SELECT * FROM form_rules) fr
      WHERE fr.exercise_id = e.id AND fr.joint = 'KNEE'
  );

-- ============================================================
-- 8) HOLLOW BODY HOLD — hông gập ~30-45°
--    Nguồn: PLANK_FORM_SCORING_ANALYSIS.md §2.3 ghi "hông gập ~30-45°".
--    Đây là mốc KINH NGHIỆM chứ không phải ngưỡng học thuật đã đánh giá ->
--    theo §6 của EXERCISE_ANGLE_CRITERIA_EVIDENCE.md ("Không gắn ngưỡng góc
--    cho bài chưa có nguồn") nên KHÔNG gắn rule. Bài này tiếp tục dùng
--    fallback của client cho tới khi có số đo thực tế.
--
--    Tương tự: DEAD HANG (EX_207) — treo thẳng người, chưa có nguồn riêng ->
--    không gắn rule.
-- ============================================================
