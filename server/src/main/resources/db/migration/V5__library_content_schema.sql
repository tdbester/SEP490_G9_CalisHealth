-- V5: Library & Content schema cho module Member + fix schema cho module Library.
--
-- V3 đã tạo nền tảng (fitness_levels, media_files, exercises, form_rules,
-- member_profiles, workout_sessions, session_exercise_results, form_error_logs,
-- member_skill_progress) và V4 đã tạo dashboard domain (muscle_groups,
-- exercise_muscle_groups, progression_rules, body_measurements).
--
-- Còn THIẾU: các bảng Library/Content mà entity trong
-- server/src/main/java/com/calishealth/models đã map tới nhưng chưa migration
-- nào tạo. Trước đây chúng tồn tại trong DB local chỉ vì Hibernate
-- `ddl-auto: update` của nhánh khác tự sinh ra -- điều mà
-- `spring.jpa.hibernate.ddl-auto: none` (Flyway là nguồn sự thật duy nhất)
-- không cho phép. Thiếu chúng thì app fail lúc start với
-- "Table 'workout_entries' doesn't exist".
--
-- Bảng trong migration này:
--   exercise_entries      -> ExerciseEntry.java      (danh mục bài tập cho Library)
--   workout_entries       -> WorkoutEntry.java       (danh mục workout cho Library)
--   workout_exercises     -> WorkoutEntry.exercises  (@ManyToMany, @OrderColumn)
--   workout_plan_items    -> WorkoutPlanItem.java    (kế hoạch 7 ngày)
--   exercise_variations   -> ExerciseVariation.java  (bài tập biến thể)
--   plan_exercises        -> PlanExercise.java       (bài tập trong training plan)
--   benchmark_criteria    -> BenchmarkCriterion.java (tiêu chí đánh giá theo level)
--   content_scans         -> ContentScan.java        (kết quả quét nội dung)
--
-- Ghi chú về checksum: file này MỚI (V5) nên không đổi checksum của
-- V1..V4 đã apply. Đây là lý do các fix schema được đặt ở đây thay vì
-- sửa nội dung V3/V4 (sửa nội dung file đã apply sẽ làm Flyway validate
-- fail trên mọi máy của các thành viên khác trong nhóm).

-- ============================================================
-- 1. EXERCISE_ENTRIES  (danh mục bài tập cho Library, code unique)
-- ============================================================
-- type là enum HEALTH | SKILL (ExerciseEntry.EntryType).
-- active BIT(1) dùng để ẩn/hiện bài tập trong Library.
CREATE TABLE IF NOT EXISTS exercise_entries (
    id                BIGINT        NOT NULL AUTO_INCREMENT,
    code              VARCHAR(30)   NOT NULL,
    name              VARCHAR(120)  NOT NULL,
    description       TEXT          DEFAULT NULL,
    type              VARCHAR(20)   NOT NULL,
    category          VARCHAR(80)   DEFAULT NULL,
    muscle_group      VARCHAR(120)  NOT NULL,
    level             VARCHAR(30)   NOT NULL,
    active            BIT(1)        NOT NULL DEFAULT b'1',
    guide             TEXT          DEFAULT NULL,
    demo_video_url    VARCHAR(1000) DEFAULT NULL,
    anatomy_image_url VARCHAR(1000) DEFAULT NULL,
    updated_at        DATETIME(6)   NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_exercise_entries_code (code),
    KEY idx_exercise_entries_type_active (type, active),
    CONSTRAINT ck_exercise_entries_type CHECK (type IN ('HEALTH', 'SKILL'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 2. WORKOUT_ENTRIES  (danh mục workout cho Library, code unique)
-- ============================================================
-- type: WORKOUT | DAILY_TRAINING_PLAN (WorkoutService.ALLOWED_TYPES).
-- level: Beginner | Intermediate | Advanced | All levels.
-- created_by NULL = workout hệ thống (seed); không NULL = do member tự tạo.
--
-- QUAN TRỌNG: bảng này được DashboardService.community() đọc:
--   SELECT COUNT(*) FROM workout_entries WHERE active = TRUE AND created_by IS NOT NULL
-- Endpoint /api/dashboard là permitAll và mọi member đều mở app hằng ngày
-- -> thiếu bảng này là 500 cho toàn bộ user, không chỉ role CONTENT_MANAGER.
CREATE TABLE IF NOT EXISTS workout_entries (
    id          BIGINT        NOT NULL AUTO_INCREMENT,
    code        VARCHAR(30)   NOT NULL,
    name        VARCHAR(120)  NOT NULL,
    description TEXT          DEFAULT NULL,
    content     TEXT          DEFAULT NULL,
    type        VARCHAR(40)   DEFAULT 'WORKOUT',
    level       VARCHAR(30)   NOT NULL,
    active      BIT(1)        NOT NULL DEFAULT b'1',
    created_by  BIGINT        DEFAULT NULL,
    updated_at  DATETIME(6)   NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_workout_entries_code (code),
    KEY idx_workout_entries_created_by (created_by),
    KEY idx_workout_entries_type_active (type, active),
    CONSTRAINT fk_workout_entries_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT ck_workout_entries_type CHECK (type IN ('WORKOUT', 'DAILY_TRAINING_PLAN'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 3. WORKOUT_EXERCISES  (@ManyToMany + @OrderColumn display_order)
-- ============================================================
-- display_order là cột @OrderColumn nên Hibernate tự quản lý, khởi tạo từ 0.
CREATE TABLE IF NOT EXISTS workout_exercises (
    workout_id    BIGINT NOT NULL,
    exercise_id   BIGINT NOT NULL,
    display_order INT    NOT NULL,
    PRIMARY KEY (workout_id, display_order),
    KEY idx_workout_exercises_exercise (exercise_id),
    CONSTRAINT fk_workout_exercises_workout FOREIGN KEY (workout_id) REFERENCES workout_entries (id) ON DELETE CASCADE,
    CONSTRAINT fk_workout_exercises_exercise FOREIGN KEY (exercise_id) REFERENCES exercise_entries (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 4. WORKOUT_PLAN_ITEMS  (kế hoạch tập 7 ngày của DAILY_TRAINING_PLAN)
-- ============================================================
-- day_of_week: 1 = Thứ 2 ... 7 = Chủ nhật (WorkoutService.validatePlanItems).
CREATE TABLE IF NOT EXISTS workout_plan_items (
    id                BIGINT NOT NULL AUTO_INCREMENT,
    day_of_week       INT    NOT NULL,
    beginner_sets     INT    NOT NULL,
    beginner_reps     INT    NOT NULL,
    intermediate_sets INT    NOT NULL,
    intermediate_reps INT    NOT NULL,
    advanced_sets     INT    NOT NULL,
    advanced_reps     INT    NOT NULL,
    workout_id        BIGINT NOT NULL,
    exercise_id       BIGINT NOT NULL,
    PRIMARY KEY (id),
    KEY idx_workout_plan_items_workout (workout_id),
    KEY idx_workout_plan_items_exercise (exercise_id),
    CONSTRAINT fk_workout_plan_items_workout FOREIGN KEY (workout_id) REFERENCES workout_entries (id) ON DELETE CASCADE,
    CONSTRAINT fk_workout_plan_items_exercise FOREIGN KEY (exercise_id) REFERENCES exercise_entries (id) ON DELETE CASCADE,
    CONSTRAINT ck_workout_plan_items_day CHECK (day_of_week BETWEEN 1 AND 7)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 5. EXERCISE_VARIATIONS  (bài tập biến thể)
-- ============================================================
-- type mô tả kiểu biến thể, ví dụ 'EASIER' | 'HARDER' | 'EQUIVALENT'.
CREATE TABLE IF NOT EXISTS exercise_variations (
    id                  BIGINT      NOT NULL AUTO_INCREMENT,
    type                VARCHAR(60) DEFAULT NULL,
    exercise_id         BIGINT      NOT NULL,
    variant_exercise_id BIGINT      NOT NULL,
    PRIMARY KEY (id),
    KEY idx_exercise_variations_exercise (exercise_id),
    KEY idx_exercise_variations_variant (variant_exercise_id),
    CONSTRAINT fk_exercise_variations_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE,
    CONSTRAINT fk_exercise_variations_variant FOREIGN KEY (variant_exercise_id) REFERENCES exercises (id) ON DELETE CASCADE,
    CONSTRAINT ck_exercise_variations_distinct CHECK (exercise_id <> variant_exercise_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 6. PLAN_EXERCISES  (bài tập trong training plan)
-- ============================================================
-- training_plan_id là FK logic tới bảng training_plans của module khác;
-- module đó chưa có migration nên không khai báo FK thật.
CREATE TABLE IF NOT EXISTS plan_exercises (
    id               BIGINT NOT NULL AUTO_INCREMENT,
    sequence         INT    NOT NULL,
    sets             INT    NOT NULL,
    reps             INT    NOT NULL,
    rest_seconds     INT    NOT NULL,
    training_plan_id BIGINT NOT NULL,
    exercise_id      BIGINT NOT NULL,
    PRIMARY KEY (id),
    KEY idx_plan_exercises_exercise (exercise_id),
    KEY idx_plan_exercises_training_plan (training_plan_id),
    CONSTRAINT fk_plan_exercises_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE,
    CONSTRAINT ck_plan_exercises_sequence CHECK (sequence >= 0),
    CONSTRAINT ck_plan_exercises_sets CHECK (sets >= 0),
    CONSTRAINT ck_plan_exercises_reps CHECK (reps >= 0),
    CONSTRAINT ck_plan_exercises_rest CHECK (rest_seconds >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 7. BENCHMARK_CRITERIA  (tiêu chí đánh giá bài tập theo fitness level)
-- ============================================================
CREATE TABLE IF NOT EXISTS benchmark_criteria (
    id                BIGINT         NOT NULL AUTO_INCREMENT,
    min_value         DECIMAL(10, 2) NOT NULL,
    criterion_weight  DECIMAL(8, 3)  NOT NULL,
    exercise_id       BIGINT         NOT NULL,
    fitness_level_id  BIGINT         NOT NULL,
    PRIMARY KEY (id),
    KEY idx_benchmark_criteria_exercise (exercise_id),
    KEY idx_benchmark_criteria_fitness_level (fitness_level_id),
    CONSTRAINT fk_benchmark_criteria_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE,
    CONSTRAINT fk_benchmark_criteria_fitness_level FOREIGN KEY (fitness_level_id) REFERENCES fitness_levels (id) ON DELETE CASCADE,
    CONSTRAINT ck_benchmark_criteria_weight CHECK (criterion_weight >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 8. CONTENT_SCANS  (kết quả quét nội dung media)
-- ============================================================
-- content_review_id là FK logic tới bảng content_reviews của module khác;
-- module đó chưa có migration nên không khai báo FK thật.
CREATE TABLE IF NOT EXISTS content_scans (
    id                 BIGINT       NOT NULL AUTO_INCREMENT,
    scan_type          VARCHAR(60)  DEFAULT NULL,
    status             VARCHAR(40)  DEFAULT NULL,
    score              DECIMAL(7, 3) DEFAULT NULL,
    flagged_terms      TEXT         DEFAULT NULL,
    details            TEXT         DEFAULT NULL,
    scanned_at         DATETIME(6)  NOT NULL,
    content_review_id  BIGINT       NOT NULL,
    media_file_id      BIGINT       DEFAULT NULL,
    PRIMARY KEY (id),
    KEY idx_content_scans_media_file (media_file_id),
    KEY idx_content_scans_review (content_review_id),
    CONSTRAINT fk_content_scans_media_file FOREIGN KEY (media_file_id) REFERENCES media_files (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 9. FIX muscle_groups: cho phép INSERT chỉ với `name`
-- ============================================================
-- V4 tạo muscle_groups với dashboard_code / icon_key / tone đều NOT NULL
-- và không có default. Nhưng entity MuscleGroup.java chỉ có field `name`,
-- và ExerciseService.create() tạo nhóm cơ mới bằng đúng:
--     createdGroup.setName(muscleName);
--     muscleGroups.save(createdGroup);
-- -> Hibernate INSERT chỉ có cột name -> MySQL báo
--    "Field 'dashboard_code' doesn't have a default value" (ERROR 1364)
--    => API POST /api/content/exercises lỗi 500 khi tạo bài tập với nhóm cơ mới.
--
-- DashboardService đọc 3 cột này để vẽ card muscle group. Để cả 2 bên
-- đều hợp lệ: cho phép NULL (dashboard suy ra icon/tone mặc định) và bỏ
-- ràng buộc NOT NULL. UNIQUE trên dashboard_code vẫn giữ được vì MySQL
-- cho phép nhiều NULL trong cột UNIQUE.
--
-- LƯU Ý: trên máy đã từng chạy `ddl-auto: update`, bảng muscle_groups được
-- Hibernate tạo từ entity (chỉ có cột `name`) nên KHÔNG có 3 cột này.
-- DashboardService.muscleGroups() đọc dashboard_code/icon_key/tone -> thiếu
-- cột thì endpoint /api/dashboard lỗi "Unknown column".
-- Vì vậy: thêm cột nếu thiếu, rồi bỏ ràng buộc NOT NULL nếu có.
DROP PROCEDURE IF EXISTS sp_v5_fix_muscle_groups;
DELIMITER $$
CREATE PROCEDURE sp_v5_fix_muscle_groups()
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'muscle_groups'
          AND COLUMN_NAME = 'dashboard_code'
    ) THEN
        ALTER TABLE muscle_groups ADD COLUMN dashboard_code VARCHAR(40) DEFAULT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'muscle_groups'
          AND COLUMN_NAME = 'icon_key'
    ) THEN
        ALTER TABLE muscle_groups ADD COLUMN icon_key VARCHAR(40) DEFAULT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'muscle_groups'
          AND COLUMN_NAME = 'tone'
    ) THEN
        ALTER TABLE muscle_groups ADD COLUMN tone VARCHAR(20) DEFAULT NULL;
    END IF;

    -- Bỏ ràng buộc NOT NULL (nếu bảng do V4 tạo) để INSERT chỉ có `name` không lỗi.
    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'muscle_groups'
          AND COLUMN_NAME = 'dashboard_code'
          AND IS_NULLABLE = 'NO'
    ) THEN
        ALTER TABLE muscle_groups
            MODIFY COLUMN dashboard_code VARCHAR(40) DEFAULT NULL,
            MODIFY COLUMN icon_key      VARCHAR(40) DEFAULT NULL,
            MODIFY COLUMN tone          VARCHAR(20) DEFAULT NULL;
    END IF;
END$$
DELIMITER ;

CALL sp_v5_fix_muscle_groups();
DROP PROCEDURE sp_v5_fix_muscle_groups;

-- ============================================================
-- 10. Gắn FK workout_sessions.workout_id -> workout_entries.id
-- ============================================================
-- V3 không khai báo FK này vì workout_entries chưa tồn tại lúc V3 chạy
-- (xem comment trong V3__dayStreak_schema.sql). V5 đã tạo bảng đó nên
-- gắn FK bây giờ để dữ liệu toàn vẹn.
--
-- An toàn: chỉ gắn FK khi KHÔNG có dòng orphan (workout_id trỏ tới
-- workout_entries không tồn tại). Nếu có orphan thì bỏ qua FK thay vì
-- làm V5 fail -- dữ liệu cũ vẫn được giữ nguyên.
DROP PROCEDURE IF EXISTS sp_v5_add_workout_sessions_fk;
DELIMITER $$
CREATE PROCEDURE sp_v5_add_workout_sessions_fk()
BEGIN
    DECLARE orphan_count INT DEFAULT 0;

    SELECT COUNT(*) INTO orphan_count
    FROM workout_sessions ws
    WHERE ws.workout_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM workout_entries we WHERE we.id = ws.workout_id);

    IF orphan_count = 0
       AND NOT EXISTS (
            SELECT 1
            FROM information_schema.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND TABLE_NAME = 'workout_sessions'
              AND CONSTRAINT_NAME = 'fk_workout_sessions_workout'
       ) THEN
        ALTER TABLE workout_sessions
            ADD CONSTRAINT fk_workout_sessions_workout
            FOREIGN KEY (workout_id) REFERENCES workout_entries (id) ON DELETE SET NULL;
    END IF;
END$$
DELIMITER ;

CALL sp_v5_add_workout_sessions_fk();
DROP PROCEDURE sp_v5_add_workout_sessions_fk;

-- ============================================================
-- 11. Đồng bộ FK workout_exercises / workout_plan_items
-- ============================================================
-- Trên máy đã từng chạy nhánh dùng `ddl-auto: update`, hai bảng này được
-- Hibernate tự sinh ra và FK workout_id trỏ tới bảng `content_workouts`
-- (tên bảng cũ, trước khi commit 6b6aed8 đổi thành `workout_entries`).
-- Entity hiện tại map `workout_entries` -> FK cũ sẽ không khớp.
--
-- Vì `content_workouts` và `workout_entries` có cùng cấu trúc và cùng
-- tập id, ta chuyển FK sang `workout_entries` và copy dữ liệu qua lại
-- để không mất bản ghi nào đang tồn tại.
DROP PROCEDURE IF EXISTS sp_v5_align_workout_library_fk;
DELIMITER $$
CREATE PROCEDURE sp_v5_align_workout_library_fk()
BEGIN
    DECLARE has_content_workouts INT DEFAULT 0;

    SELECT COUNT(*) INTO has_content_workouts
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'content_workouts';

    -- Chỉ xử lý khi bảng cũ còn tồn tại (tức là DB có dấu vết ddl-auto).
    IF has_content_workouts > 0 THEN
        -- Bỏ FK cũ trỏ content_workouts (nếu đang có).
        IF EXISTS (
            SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND TABLE_NAME = 'workout_exercises'
              AND CONSTRAINT_NAME = 'fk_workout_exercises_workout'
        ) THEN
            ALTER TABLE workout_exercises
                DROP FOREIGN KEY fk_workout_exercises_workout;
        END IF;
        IF EXISTS (
            SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND TABLE_NAME = 'workout_plan_items'
              AND CONSTRAINT_NAME = 'fk_workout_plan_items_workout'
        ) THEN
            ALTER TABLE workout_plan_items
                DROP FOREIGN KEY fk_workout_plan_items_workout;
        END IF;

        -- Copy dữ liệu workout cũ sang bảng mới (bỏ qua bản ghi đã có).
        -- Bảng content_workouts cũ KHÔNG có cột created_by (cột này được
        -- thêm khi đổi tên bảng) -> created_by của bản ghi cũ là NULL.
        INSERT INTO workout_entries
            (id, code, name, description, content, type, level, active, created_by, updated_at)
        SELECT cw.id, cw.code, cw.name, cw.description, cw.content, cw.type,
               cw.level, cw.active, NULL, cw.updated_at
        FROM content_workouts cw
        WHERE NOT EXISTS (SELECT 1 FROM workout_entries we WHERE we.id = cw.id);

        -- Gắn lại FK trỏ workout_entries.
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND TABLE_NAME = 'workout_exercises'
              AND CONSTRAINT_NAME = 'fk_workout_exercises_workout'
        ) THEN
            ALTER TABLE workout_exercises
                ADD CONSTRAINT fk_workout_exercises_workout
                FOREIGN KEY (workout_id) REFERENCES workout_entries (id) ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND TABLE_NAME = 'workout_plan_items'
              AND CONSTRAINT_NAME = 'fk_workout_plan_items_workout'
        ) THEN
            ALTER TABLE workout_plan_items
                ADD CONSTRAINT fk_workout_plan_items_workout
                FOREIGN KEY (workout_id) REFERENCES workout_entries (id) ON DELETE CASCADE;
        END IF;
    END IF;
END$$
DELIMITER ;

CALL sp_v5_align_workout_library_fk();
DROP PROCEDURE sp_v5_align_workout_library_fk;
