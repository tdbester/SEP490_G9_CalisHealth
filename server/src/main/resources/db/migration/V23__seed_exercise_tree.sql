-- V23: dữ liệu mẫu cho màn Calisthenics Exercise Tree.
-- Thêm các bài hệ thống còn thiếu và các progression rule nối chúng thành 4 nhánh:
--   Push : Knee push-up -> Push-up -> Diamond -> Archer -> One arm; Push-up -> Pike -> Handstand push-up;
--          Push-up -> Tuck planche -> Planche
--   Pull : Australian row -> Negative pull-up -> Pull-up -> Strict -> Archer pull-up -> One arm pull-up;
--          Pull-up -> Tuck front lever -> Front lever; Dips -> Muscle-up
--   Core : Plank -> Hollow Body Hold -> L-sit -> V-sit
--   Legs : Assisted squat -> Bodyweight Squat -> Pistol Squat -> Shrimp squat; Bodyweight Squat -> Burpee (tắt)
-- Mọi câu lệnh đều kiểm tra tồn tại trước nên chạy lại không đổi gì.

-- 1. Bài tập mới (bài hệ thống, đang hoạt động)
INSERT INTO exercises (code, name, type, category, difficulty_level, instructions, execution_steps,
                       default_sets, default_reps, duration, source, moderation_status, active, updated_at, created_by)
SELECT s.code, s.name, s.type, s.category, s.lvl, s.instructions, s.steps,
       3, s.reps, s.secs, 'SYSTEM', 'ACTIVE', TRUE, CURRENT_TIMESTAMP(6), NULL
FROM (
    SELECT 'EX_KNEE_PUSHUP' AS code, 'Knee push-up' AS name, 'HEALTH' AS type, 'REPS' AS category,
           'Beginner' AS lvl, 'Push-up with the knees on the floor to learn the movement.' AS instructions,
           'Kneel with hands under the shoulders.\nLower the chest to the floor.\nPress back up.' AS steps,
           12 AS reps, NULL AS secs
    UNION ALL SELECT 'EX_ONE_ARM_PUSHUP', 'One arm push-up', 'SKILL', 'REPS', 'Advanced',
           'Full push-up on a single arm.', 'Spread the feet wide.\nPlace one hand under the chest.\nLower and press with one arm.', 5, NULL
    UNION ALL SELECT 'EX_HANDSTAND_PUSHUP', 'Handstand push-up', 'SKILL', 'REPS', 'Advanced',
           'Vertical press from a handstand against the wall.', 'Kick up to a wall handstand.\nLower the head to the floor.\nPress back to straight arms.', 5, NULL
    UNION ALL SELECT 'EX_TUCK_PLANCHE', 'Tuck planche', 'SKILL', 'HOLD', 'Advanced',
           'Planche hold with the knees tucked to the chest.', 'Lean forward over straight arms.\nLift the feet with knees tucked.\nHold.', NULL, 15
    UNION ALL SELECT 'EX_AUSTRALIAN_ROW', 'Australian row', 'HEALTH', 'REPS', 'Beginner',
           'Horizontal row under a low bar.', 'Hang under a low bar with straight body.\nPull the chest to the bar.\nLower with control.', 12, NULL
    UNION ALL SELECT 'EX_NEGATIVE_PULLUP', 'Negative pull-up', 'HEALTH', 'REPS', 'Beginner',
           'Slow lowering phase of the pull-up.', 'Jump to the top position.\nLower for 3-5 seconds.\nRepeat.', 6, NULL
    UNION ALL SELECT 'EX_ARCHER_PULLUP', 'Archer pull-up', 'SKILL', 'REPS', 'Advanced',
           'Pull-up shifting the load to one arm.', 'Take a wide grip.\nPull toward one hand keeping the other arm straight.\nAlternate sides.', 5, NULL
    UNION ALL SELECT 'EX_ONE_ARM_PULLUP', 'One arm pull-up', 'SKILL', 'REPS', 'Advanced',
           'Full pull-up on a single arm.', 'Hang from one arm.\nPull until the chin clears the bar.\nLower with control.', 2, NULL
    UNION ALL SELECT 'EX_TUCK_FRONT_LEVER', 'Tuck front lever', 'SKILL', 'HOLD', 'Intermediate',
           'Front lever hold with the knees tucked.', 'Hang from the bar.\nPull the hips up with knees tucked.\nHold the back parallel to the floor.', NULL, 15
    UNION ALL SELECT 'EX_V_SIT', 'V-sit', 'SKILL', 'HOLD', 'Advanced',
           'Hold with the legs raised above the L-sit line.', 'Start in an L-sit.\nPush the hips back and lift the legs higher.\nHold.', NULL, 10
    UNION ALL SELECT 'EX_ASSISTED_SQUAT', 'Assisted squat', 'HEALTH', 'REPS', 'Beginner',
           'Squat holding a support for balance.', 'Hold a door frame or pole.\nSit back to full depth.\nStand up.', 15, NULL
    UNION ALL SELECT 'EX_SHRIMP_SQUAT', 'Shrimp squat', 'SKILL', 'REPS', 'Advanced',
           'Single-leg squat with the back foot held behind.', 'Hold the back foot.\nLower until the knee touches the floor.\nStand up on one leg.', 5, NULL
) s
WHERE NOT EXISTS (SELECT 1 FROM exercises x WHERE x.code = s.code);

-- 2. Nhóm cơ cho bài mới
INSERT IGNORE INTO exercise_muscle_groups (exercise_id, muscle_group_id)
SELECT e.id, mg.id
FROM (
    SELECT 'EX_KNEE_PUSHUP' AS code, 'Chest' AS muscle
    UNION ALL SELECT 'EX_KNEE_PUSHUP', 'Arms'
    UNION ALL SELECT 'EX_ONE_ARM_PUSHUP', 'Chest'
    UNION ALL SELECT 'EX_ONE_ARM_PUSHUP', 'Arms'
    UNION ALL SELECT 'EX_ONE_ARM_PUSHUP', 'Core'
    UNION ALL SELECT 'EX_HANDSTAND_PUSHUP', 'Shoulders'
    UNION ALL SELECT 'EX_HANDSTAND_PUSHUP', 'Arms'
    UNION ALL SELECT 'EX_TUCK_PLANCHE', 'Shoulders'
    UNION ALL SELECT 'EX_TUCK_PLANCHE', 'Core'
    UNION ALL SELECT 'EX_AUSTRALIAN_ROW', 'Back'
    UNION ALL SELECT 'EX_AUSTRALIAN_ROW', 'Arms'
    UNION ALL SELECT 'EX_NEGATIVE_PULLUP', 'Back'
    UNION ALL SELECT 'EX_NEGATIVE_PULLUP', 'Arms'
    UNION ALL SELECT 'EX_ARCHER_PULLUP', 'Back'
    UNION ALL SELECT 'EX_ARCHER_PULLUP', 'Arms'
    UNION ALL SELECT 'EX_ONE_ARM_PULLUP', 'Back'
    UNION ALL SELECT 'EX_ONE_ARM_PULLUP', 'Arms'
    UNION ALL SELECT 'EX_TUCK_FRONT_LEVER', 'Back'
    UNION ALL SELECT 'EX_TUCK_FRONT_LEVER', 'Core'
    UNION ALL SELECT 'EX_V_SIT', 'Core'
    UNION ALL SELECT 'EX_ASSISTED_SQUAT', 'Legs'
    UNION ALL SELECT 'EX_ASSISTED_SQUAT', 'Glutes'
    UNION ALL SELECT 'EX_SHRIMP_SQUAT', 'Legs'
    UNION ALL SELECT 'EX_SHRIMP_SQUAT', 'Glutes'
    -- Các bài demo từ V21 chưa có nhóm cơ
    UNION ALL SELECT 'HE-DEMO0001', 'Shoulders'
    UNION ALL SELECT 'HE-DEMO0001', 'Arms'
    UNION ALL SELECT 'HE-DEMO0002', 'Core'
    UNION ALL SELECT 'SK-DEMO0001', 'Core'
    UNION ALL SELECT 'SK-DEMO0001', 'Arms'
    UNION ALL SELECT 'SK-DEMO0002', 'Legs'
    UNION ALL SELECT 'SK-DEMO0002', 'Glutes'
) s
JOIN exercises e ON e.code = s.code
JOIN muscle_groups mg ON mg.name = s.muscle;

-- 3. Progression rules. measure_type theo cách đo của bài prerequisite (REPS / HOLD).
INSERT INTO progression_rules (rule_name, relationship, status, measure_type, required_sets, required_reps,
                               required_seconds, min_accuracy, exercise_id, prerequisite_exercise_id)
SELECT CONCAT(target.name, ' progression ', pre.name), 'PREREQUISITE', s.status,
       CASE WHEN pre.category = 'HOLD' THEN 'HOLD' ELSE 'REPS' END,
       s.sets,
       CASE WHEN pre.category = 'HOLD' THEN NULL ELSE s.amount END,
       CASE WHEN pre.category = 'HOLD' THEN s.amount ELSE NULL END,
       s.accuracy, target.id, pre.id
FROM (
    -- Push
    SELECT 'EX_KNEE_PUSHUP' AS pre_code, 'EX_1' AS target_code, 3 AS sets, 15 AS amount, 80.000 AS accuracy, 'ACTIVE' AS status
    UNION ALL SELECT 'EX_1', 'HE-DEMO0001', 3, 12, 75.000, 'ACTIVE'
    UNION ALL SELECT 'EX_DIAMOND_PUSHUP', 'EX_ARCHER_PUSHUP', 3, 15, 80.000, 'ACTIVE'
    UNION ALL SELECT 'EX_ARCHER_PUSHUP', 'EX_ONE_ARM_PUSHUP', 3, 8, 85.000, 'ACTIVE'
    UNION ALL SELECT 'HE-DEMO0001', 'EX_HANDSTAND_PUSHUP', 3, 10, 80.000, 'ACTIVE'
    UNION ALL SELECT 'EX_1', 'EX_TUCK_PLANCHE', 3, 25, 85.000, 'ACTIVE'
    UNION ALL SELECT 'EX_TUCK_PLANCHE', 'EX_10', 3, 20, 85.000, 'ACTIVE'
    -- Pull
    UNION ALL SELECT 'EX_AUSTRALIAN_ROW', 'EX_NEGATIVE_PULLUP', 3, 12, 80.000, 'ACTIVE'
    UNION ALL SELECT 'EX_NEGATIVE_PULLUP', 'EX_2', 3, 8, 80.000, 'ACTIVE'
    UNION ALL SELECT 'EX_11', 'EX_ARCHER_PULLUP', 3, 10, 85.000, 'ACTIVE'
    UNION ALL SELECT 'EX_ARCHER_PULLUP', 'EX_ONE_ARM_PULLUP', 3, 5, 90.000, 'ACTIVE'
    UNION ALL SELECT 'EX_2', 'EX_TUCK_FRONT_LEVER', 3, 10, 80.000, 'ACTIVE'
    UNION ALL SELECT 'EX_TUCK_FRONT_LEVER', 'EX_9', 3, 20, 80.000, 'ACTIVE'
    UNION ALL SELECT 'EX_5', 'EX_8', 3, 15, 80.000, 'ACTIVE'
    -- Core
    UNION ALL SELECT 'EX_4', 'HE-DEMO0002', 3, 45, 80.000, 'ACTIVE'
    UNION ALL SELECT 'HE-DEMO0002', 'SK-DEMO0001', 3, 30, 80.000, 'ACTIVE'
    UNION ALL SELECT 'SK-DEMO0001', 'EX_V_SIT', 3, 20, 85.000, 'ACTIVE'
    -- Legs
    UNION ALL SELECT 'EX_ASSISTED_SQUAT', 'EX_3', 3, 15, 80.000, 'ACTIVE'
    UNION ALL SELECT 'EX_3', 'SK-DEMO0002', 3, 25, 80.000, 'ACTIVE'
    UNION ALL SELECT 'SK-DEMO0002', 'EX_SHRIMP_SQUAT', 3, 8, 85.000, 'ACTIVE'
    UNION ALL SELECT 'EX_3', 'EX_6', 3, 20, 75.000, 'INACTIVE'
) s
JOIN exercises pre ON pre.code = s.pre_code
JOIN exercises target ON target.code = s.target_code
WHERE NOT EXISTS (
    SELECT 1 FROM progression_rules x WHERE x.exercise_id = target.id AND x.prerequisite_exercise_id = pre.id
);
