-- V21: Demo data for the admin "User Detail & Activity Log" screen, so every team member sees the
-- same three example accounts after pulling the branch and starting the backend.
--
--   ADMIN            admin@calishealth.com         Test@123  (account from V16, only gets log rows here)
--   CONTENT_MANAGER  demo.content@calishealth.com  Test@123  (still the default password -> "Default" chip)
--   MEMBER           demo.member@calishealth.com   Test@123
--
-- Every insert is guarded, so re-running against a database that already has the rows changes nothing.
-- Timestamps are relative to the moment the migration runs, so the demo always looks recent.
-- Never edit this file after it has been applied; add a new version instead.

SET @today := CURDATE();

-- ============================================================
-- 1. Accounts
-- ============================================================
INSERT INTO users (email, password, full_name, role, enabled, created_at)
SELECT s.email, '$2a$10$RdWDAbR1skkfFOExLF6LluIxK2H7EuNOGvqPnASpDJUSznJxfn2Gq', s.full_name, s.role, TRUE, s.created_at
FROM (
    SELECT 'demo.content@calishealth.com' AS email, 'Demo Content Manager' AS full_name,
           'CONTENT_MANAGER' AS role, CURRENT_TIMESTAMP(6) - INTERVAL 60 DAY AS created_at
    UNION ALL SELECT 'demo.member@calishealth.com', 'Demo Member', 'MEMBER', CURRENT_TIMESTAMP(6) - INTERVAL 45 DAY
) s
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.email = s.email);

SET @admin  := (SELECT id FROM users WHERE email = 'admin@calishealth.com');
SET @cm     := (SELECT id FROM users WHERE email = 'demo.content@calishealth.com');
SET @member := (SELECT id FROM users WHERE email = 'demo.member@calishealth.com');

INSERT INTO member_profiles (user_id, gender, date_of_birth, weight, height, goals,
                             streak_count, longest_streak, fitness_level_id)
SELECT @member, 'Male', '1999-05-14', 70.50, 175.00, 'Build strength and learn the muscle-up',
       5, 12, (SELECT id FROM fitness_levels WHERE name = 'Intermediate')
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM member_profiles mp WHERE mp.user_id = @member);

SET @mp := (SELECT id FROM member_profiles WHERE user_id = @member);

-- ============================================================
-- 2. Member: body metrics, workouts, exercise results, skills, assessment
-- ============================================================
INSERT INTO member_body_metrics (member_profile_id, weight_kg, height_cm, bmi, recorded_at, note)
SELECT @mp, s.weight_kg, 175.00, ROUND(s.weight_kg / (1.75 * 1.75), 1),
       CURRENT_TIMESTAMP(6) - INTERVAL s.days_ago DAY, s.note
FROM (
    SELECT 72.00 AS weight_kg, 40 AS days_ago, 'Initial profile metrics' AS note
    UNION ALL SELECT 71.20, 20, 'Monthly check-in'
    UNION ALL SELECT 70.50, 3, 'Monthly check-in'
) s
WHERE NOT EXISTS (SELECT 1 FROM member_body_metrics m WHERE m.member_profile_id = @mp);

-- One session per day (unique key: member, date, workout). Every start time is in the past.
INSERT INTO workout_sessions (member_profile_id, workout_id, workout_name, category, session_date, status,
                              started_at, finished_at, active_seconds, total_reps)
SELECT @mp, w.id, s.workout_name, 'strength', @today - INTERVAL s.d DAY, s.status,
       TIMESTAMP(@today - INTERVAL s.d DAY, s.start_time),
       TIMESTAMP(@today - INTERVAL s.d DAY, s.end_time),
       s.secs, s.reps
FROM (
    SELECT 1 AS d, 'SYS_BEGINNER_FULL_BODY' AS wcode, 'Beginner full body' AS workout_name,
           'COMPLETED' AS status, '07:10:00' AS start_time, '07:32:00' AS end_time, 1320 AS secs, 66 AS reps
    UNION ALL SELECT 2, 'SYS_CORE_15', 'Core 15', 'COMPLETED', '18:05:00', '18:21:00', 960, 40
    UNION ALL SELECT 3, NULL, 'Custom Workout', 'COMPLETED', '06:45:00', '07:05:00', 1200, 52
    UNION ALL SELECT 5, 'SYS_BEGINNER_FULL_BODY', 'Beginner full body', 'ABANDONED', '19:00:00', '19:06:00', 360, 14
    UNION ALL SELECT 6, 'SYS_CORE_15', 'Core 15', 'COMPLETED', '07:00:00', '07:17:00', 1020, 44
    UNION ALL SELECT 8, 'SYS_BEGINNER_FULL_BODY', 'Beginner full body', 'COMPLETED', '08:00:00', '08:25:00', 1500, 70
) s
LEFT JOIN workout_entries w ON w.code = s.wcode
WHERE NOT EXISTS (SELECT 1 FROM workout_sessions x WHERE x.member_profile_id = @mp);

INSERT INTO session_exercise_results (workout_session_id, exercise_id, sets_completed, valid_reps, invalid_reps,
                                      accuracy, active_seconds, sort_order)
SELECT ws.id, e.id, r.sets, r.valid, r.invalid, r.acc, r.secs, r.sort_order
FROM (
    SELECT 1 AS d, 'Push-up' AS ex, 3 AS sets, 30 AS valid, 2 AS invalid, 93.8 AS acc, 0 AS secs, 0 AS sort_order
    UNION ALL SELECT 1, 'Bodyweight Squat', 3, 42, 3, 93.3, 0, 1
    UNION ALL SELECT 1, 'Plank', 3, 0, 0, 100.0, 120, 2
    UNION ALL SELECT 2, 'Plank', 4, 0, 0, 100.0, 160, 0
    UNION ALL SELECT 2, 'Burpee', 4, 36, 4, 90.0, 0, 1
    UNION ALL SELECT 3, 'Pull-up', 3, 18, 2, 90.0, 0, 0
    UNION ALL SELECT 3, 'Dips', 3, 24, 1, 96.0, 0, 1
    UNION ALL SELECT 3, 'Push-up', 2, 20, 0, 100.0, 0, 2
    UNION ALL SELECT 5, 'Push-up', 1, 10, 1, 90.9, 0, 0
    UNION ALL SELECT 6, 'Plank', 3, 0, 0, 100.0, 120, 0
    UNION ALL SELECT 6, 'Burpee', 3, 30, 2, 93.8, 0, 1
    UNION ALL SELECT 8, 'Push-up', 3, 32, 2, 94.1, 0, 0
    UNION ALL SELECT 8, 'Bodyweight Squat', 3, 45, 3, 93.8, 0, 1
    UNION ALL SELECT 8, 'Plank', 3, 0, 0, 100.0, 150, 2
) r
JOIN workout_sessions ws ON ws.member_profile_id = @mp AND ws.session_date = @today - INTERVAL r.d DAY
JOIN exercises e ON e.name = r.ex
WHERE NOT EXISTS (
    SELECT 1 FROM session_exercise_results x
    JOIN workout_sessions w2 ON w2.id = x.workout_session_id
    WHERE w2.member_profile_id = @mp
);

INSERT INTO member_skill_progress (member_profile_id, exercise_id, status, best_reps, best_accuracy, unlocked_at)
SELECT @mp, e.id, 'UNLOCKED', s.best_reps, s.best_accuracy, CURRENT_TIMESTAMP(6) - INTERVAL s.days_ago DAY
FROM (
    SELECT 'Strict pull-up' AS ex, 8 AS best_reps, 91.500 AS best_accuracy, 20 AS days_ago
    UNION ALL SELECT 'Handstand', 1, 88.000, 9
) s
JOIN exercises e ON e.name = s.ex
WHERE NOT EXISTS (SELECT 1 FROM member_skill_progress x WHERE x.member_profile_id = @mp);

-- A completed level assessment. The demo survey is ARCHIVED, so it never shows up as the live survey.
INSERT INTO surveys (survey_code, survey_name, description, version, status)
SELECT 'DEMO_LEVEL_ASSESSMENT', 'Demo level assessment',
       'Archived sample survey that backs the demo member assessment history.', 1, 'ARCHIVED'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM surveys sv WHERE sv.survey_code = 'DEMO_LEVEL_ASSESSMENT');

SET @survey := (SELECT id FROM surveys WHERE survey_code = 'DEMO_LEVEL_ASSESSMENT' AND version = 1);

INSERT INTO survey_sessions (user_id, survey_id, survey_version, status, started_at, completed_at, updated_at)
SELECT @member, @survey, 1, 'COMPLETED',
       CURRENT_TIMESTAMP(6) - INTERVAL 44 DAY,
       CURRENT_TIMESTAMP(6) - INTERVAL 44 DAY + INTERVAL 7 MINUTE,
       CURRENT_TIMESTAMP(6) - INTERVAL 44 DAY + INTERVAL 7 MINUTE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM survey_sessions x WHERE x.user_id = @member AND x.survey_id = @survey);

INSERT INTO survey_level_results (session_id, rule_set_id, fitness_level_id, total_score, method, breakdown, evaluated_at)
SELECT ss.id, NULL, (SELECT id FROM fitness_levels WHERE name = 'Intermediate'), 62.500, 'FALLBACK', JSON_OBJECT(),
       ss.completed_at
FROM survey_sessions ss
WHERE ss.user_id = @member AND ss.survey_id = @survey
  AND NOT EXISTS (SELECT 1 FROM survey_level_results r WHERE r.session_id = ss.id);

-- ============================================================
-- 3. Content manager: exercises, skills and workouts it created
-- ============================================================
INSERT INTO exercises (code, name, type, category, difficulty_level, instructions, execution_steps,
                       default_sets, default_reps, duration, source, moderation_status, active, updated_at, created_by)
SELECT s.code, s.name, s.type, s.category, s.difficulty_level, s.instructions, s.execution_steps,
       s.default_sets, s.default_reps, s.duration, 'SYSTEM',
       CASE WHEN s.active = 1 THEN 'ACTIVE' ELSE 'INACTIVE' END, s.active,
       CURRENT_TIMESTAMP(6) - INTERVAL s.days_ago DAY, @cm
FROM (
    SELECT 'HE-DEMO0001' AS code, 'Pike Push-up' AS name, 'HEALTH' AS type, 'REPS' AS category,
           'Intermediate' AS difficulty_level, 'Shoulder-focused push-up with the hips piked high.' AS instructions,
           'Start in a downward dog.\nBend the elbows and lower the head between the hands.\nPress back up.' AS execution_steps,
           3 AS default_sets, 10 AS default_reps, NULL AS duration, 1 AS active, 2 AS days_ago
    UNION ALL SELECT 'HE-DEMO0002', 'Hollow Body Hold', 'HEALTH', 'HOLD', 'Beginner',
           'Core hold that teaches full-body tension.',
           'Lie on your back.\nLift shoulders and legs off the floor.\nHold without arching the lower back.',
           3, NULL, 30, 1, 9
    UNION ALL SELECT 'HE-DEMO0003', 'Jumping Lunge', 'HEALTH', 'REPS', 'Intermediate',
           'Explosive alternating lunge.',
           'Step into a lunge.\nJump and switch legs in the air.\nLand softly and repeat.',
           3, 12, NULL, 0, 12
    UNION ALL SELECT 'SK-DEMO0001', 'L-sit', 'SKILL', 'HOLD', 'Intermediate',
           'Hold the legs straight out in front while supported on the hands.',
           'Press the shoulders down.\nLift the legs until parallel to the floor.\nHold the position.',
           NULL, NULL, 15, 1, 15
    UNION ALL SELECT 'SK-DEMO0002', 'Pistol Squat', 'SKILL', 'REPS', 'Advanced',
           'Single-leg squat to full depth.',
           'Stand on one leg.\nLower under control with the other leg extended.\nStand back up without help.',
           NULL, 5, NULL, 1, 20
) s
WHERE NOT EXISTS (SELECT 1 FROM exercises x WHERE x.code = s.code);

INSERT INTO workout_entries (code, name, description, type, level, active, created_by, updated_at)
SELECT s.code, s.name, s.description, 'WORKOUT', s.level, s.active, @cm,
       CURRENT_TIMESTAMP(6) - INTERVAL s.days_ago DAY
FROM (
    SELECT 'WO-DEMO0001' AS code, 'Upper Body Push Day' AS name,
           'Pushing strength circuit for chest, shoulders and triceps.' AS description,
           'Intermediate' AS level, 1 AS active, 4 AS days_ago
    UNION ALL SELECT 'WO-DEMO0002', 'Leg Day Basics', 'Squat and lunge session for beginners.', 'Beginner', 1, 11
    UNION ALL SELECT 'WO-DEMO0003', 'Old Core Burner', 'Retired core routine.', 'Intermediate', 0, 25
) s
WHERE NOT EXISTS (SELECT 1 FROM workout_entries x WHERE x.code = s.code);

INSERT INTO workout_exercises (workout_id, exercise_id, display_order)
SELECT w.id, e.id, s.display_order
FROM (
    SELECT 'WO-DEMO0001' AS wcode, 'Push-up' AS ex, 0 AS display_order
    UNION ALL SELECT 'WO-DEMO0001', 'Dips', 1
    UNION ALL SELECT 'WO-DEMO0001', 'Pike Push-up', 2
    UNION ALL SELECT 'WO-DEMO0002', 'Bodyweight Squat', 0
    UNION ALL SELECT 'WO-DEMO0002', 'Jumping Lunge', 1
) s
JOIN workout_entries w ON w.code = s.wcode
JOIN exercises e ON e.name = s.ex
WHERE NOT EXISTS (SELECT 1 FROM workout_exercises x WHERE x.workout_id = w.id);

-- ============================================================
-- 4. System logs (user_activity_logs), one guard per row
-- ============================================================
INSERT INTO user_activity_logs (user_id, event_type, description, status, created_at)
SELECT u.id, s.event_type, s.description, s.status, CURRENT_TIMESTAMP(6) - INTERVAL s.mins MINUTE
FROM (
    SELECT 'demo.member@calishealth.com' AS email, 'LOGIN' AS event_type,
           'Signed in from Chrome on Windows' AS description, 'SUCCESS' AS status, 1500 AS mins
    UNION ALL SELECT 'demo.member@calishealth.com', 'LOGIN', 'Failed sign-in attempt (wrong password) from 192.168.1.20', 'FAILED', 4400
    UNION ALL SELECT 'demo.member@calishealth.com', 'ACCOUNT', 'Profile updated: goal changed to "Build strength and learn the muscle-up"', 'INFO', 14400
    UNION ALL SELECT 'demo.member@calishealth.com', 'ACCOUNT', 'Account reactivated by Admin', 'SUCCESS', 12960

    UNION ALL SELECT 'demo.content@calishealth.com', 'LOGIN', 'Signed in from Chrome on Windows', 'SUCCESS', 300
    UNION ALL SELECT 'demo.content@calishealth.com', 'LOGIN', 'Signed in from Firefox on Windows', 'SUCCESS', 2900
    UNION ALL SELECT 'demo.content@calishealth.com', 'MODERATION', 'Approved custom exercise "Archer Push-up"', 'SUCCESS', 1700
    UNION ALL SELECT 'demo.content@calishealth.com', 'MODERATION', 'Rejected custom exercise "Wall Walk": no demo video attached', 'WARNING', 5800
    UNION ALL SELECT 'demo.content@calishealth.com', 'ACCOUNT', 'Account created by Admin', 'SUCCESS', 86400

    UNION ALL SELECT 'admin@calishealth.com', 'LOGIN', 'Signed in from Chrome on Windows', 'SUCCESS', 120
    UNION ALL SELECT 'admin@calishealth.com', 'LOGIN', 'Signed in from Edge on Windows', 'SUCCESS', 3000
    UNION ALL SELECT 'admin@calishealth.com', 'NOTIFICATION', 'Broadcast sent to all members: "New level assessment is live"', 'SUCCESS', 2200
    UNION ALL SELECT 'admin@calishealth.com', 'MAINTENANCE', 'Maintenance window scheduled for Sunday 02:00 to 03:00', 'SCHEDULED', 1000
    UNION ALL SELECT 'admin@calishealth.com', 'STORAGE', 'Media storage usage reached 82 percent', 'WARNING', 4000
    UNION ALL SELECT 'admin@calishealth.com', 'STORAGE', 'Purged 143 orphaned media files', 'SUCCESS', 3900
    UNION ALL SELECT 'admin@calishealth.com', 'ACCOUNT', 'Admin account is still using the default password', 'WARNING', 5000
) s
JOIN users u ON u.email = s.email
WHERE NOT EXISTS (
    SELECT 1 FROM user_activity_logs l WHERE l.user_id = u.id AND l.description = s.description
);

-- ============================================================
-- 5. Admin actions on other accounts (admin_action_logs)
-- ============================================================
INSERT INTO admin_action_logs (admin_id, target_user_id, action, status, created_at)
SELECT @admin, t.id, s.action, 'SUCCESS', CURRENT_TIMESTAMP(6) - INTERVAL s.mins MINUTE
FROM (
    SELECT 'demo.content@calishealth.com' AS email, 'CREATE_ACCOUNT' AS action, 86400 AS mins
    UNION ALL SELECT 'demo.member@calishealth.com', 'DEACTIVATE', 14000
    UNION ALL SELECT 'demo.member@calishealth.com', 'ACTIVATE', 12960
    UNION ALL SELECT 'demo.content@calishealth.com', 'DEACTIVATE', 7200
    UNION ALL SELECT 'demo.content@calishealth.com', 'ACTIVATE', 7000
) s
JOIN users t ON t.email = s.email
WHERE @admin IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM admin_action_logs x
      WHERE x.admin_id = @admin AND x.target_user_id = t.id AND x.action = s.action
  );
