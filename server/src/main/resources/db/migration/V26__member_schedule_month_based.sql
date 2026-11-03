-- V26: Member schedule chuyển sang LỊCH THÁNG.
-- Trước đây member xếp workout vào "thứ trong tuần" của một tuần (V25). Màn hình
-- member-schedule (Figma 1015:5) là lịch tháng nên mỗi workout phải gắn với một
-- ngày cụ thể (YYYY-MM-DD) và cả lịch thuộc về một tháng.
--
--  member_schedules        : 1 dòng / member / tháng (plan_month = ngày 1 của tháng)
--  member_schedule_entries : workout được thả vào 1 ngày cụ thể trong tháng

CREATE TABLE IF NOT EXISTS member_schedules (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    user_id     BIGINT      NOT NULL,
    plan_month  DATE        NOT NULL,
    template_id BIGINT      DEFAULT NULL,
    created_at  DATETIME(6) NOT NULL,
    updated_at  DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_member_schedules_user_month (user_id, plan_month),
    KEY idx_member_schedules_template (template_id),
    CONSTRAINT fk_member_schedules_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_member_schedules_template
        FOREIGN KEY (template_id) REFERENCES daily_plan_templates (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS member_schedule_entries (
    id            BIGINT      NOT NULL AUTO_INCREMENT,
    schedule_id   BIGINT      NOT NULL,
    schedule_date DATE        NOT NULL,
    workout_id    BIGINT      NOT NULL,
    order_in_day  INT         NOT NULL DEFAULT 0,
    status        VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    PRIMARY KEY (id),
    UNIQUE KEY uk_member_schedule_entries_day (schedule_id, schedule_date, order_in_day),
    KEY idx_member_schedule_entries_workout (workout_id),
    KEY idx_member_schedule_entries_date (schedule_date),
    CONSTRAINT fk_member_schedule_entries_schedule
        FOREIGN KEY (schedule_id) REFERENCES member_schedules (id) ON DELETE CASCADE,
    CONSTRAINT fk_member_schedule_entries_workout
        FOREIGN KEY (workout_id) REFERENCES workout_entries (id),
    CONSTRAINT ck_member_schedule_entries_status
        CHECK (status IN ('PENDING','COMPLETED','SKIPPED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------- migrate V25
-- Mỗi tháng của member thành 1 member_schedules; tuần bắt đầu Thứ 2 nên ngày của
-- từng dòng được tính bằng week_start_date + offset(day_of_week).

INSERT INTO member_schedules (user_id, plan_month, template_id, created_at, updated_at)
SELECT s.user_id,
       DATE_SUB(w.entry_date, INTERVAL DAYOFMONTH(w.entry_date) - 1 DAY) AS plan_month,
       MAX(s.template_id),
       MIN(s.created_at),
       MAX(s.updated_at)
FROM member_weekly_schedules s
JOIN member_weekly_schedule_days d ON d.schedule_id = s.id
JOIN (
    SELECT d2.id,
           DATE_ADD(s2.week_start_date,
                    INTERVAL FIELD(d2.day_of_week, 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY',
                                   'FRIDAY', 'SATURDAY', 'SUNDAY') - 1 DAY) AS entry_date
    FROM member_weekly_schedule_days d2
    JOIN member_weekly_schedules s2 ON s2.id = d2.schedule_id
) w ON w.id = d.id
GROUP BY s.user_id, plan_month;

-- Giữ lại các tuần đã lưu nhưng chưa có workout nào.
INSERT INTO member_schedules (user_id, plan_month, template_id, created_at, updated_at)
SELECT s.user_id,
       DATE_SUB(s.week_start_date, INTERVAL DAYOFMONTH(s.week_start_date) - 1 DAY),
       s.template_id, s.created_at, s.updated_at
FROM member_weekly_schedules s
WHERE NOT EXISTS (
        SELECT 1 FROM member_schedules m
        WHERE m.user_id = s.user_id
          AND m.plan_month = DATE_SUB(s.week_start_date, INTERVAL DAYOFMONTH(s.week_start_date) - 1 DAY)
    );

INSERT INTO member_schedule_entries (schedule_id, schedule_date, workout_id, order_in_day, status)
SELECT m.id, w.entry_date, w.workout_id, w.order_in_day, w.status
FROM (
    SELECT s.user_id,
           DATE_ADD(s.week_start_date,
                    INTERVAL FIELD(d.day_of_week, 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY',
                                   'FRIDAY', 'SATURDAY', 'SUNDAY') - 1 DAY) AS entry_date,
           d.workout_id, d.order_in_day, d.status
    FROM member_weekly_schedule_days d
    JOIN member_weekly_schedules s ON s.id = d.schedule_id
) w
JOIN member_schedules m
  ON m.user_id = w.user_id
 AND m.plan_month = DATE_SUB(w.entry_date, INTERVAL DAYOFMONTH(w.entry_date) - 1 DAY);

-- Bỏ schema cũ.
DROP TABLE IF EXISTS member_weekly_schedule_days;
DROP TABLE IF EXISTS member_weekly_schedules;
