-- V25: Member weekly workout schedule.
-- Member tự xếp các workout (lấy từ Daily Training Plan Template của Content Manager)
-- vào các ngày trong tuần. Mỗi member chỉ có 1 schedule cho mỗi tuần (tuần bắt đầu Thứ 2).

CREATE TABLE IF NOT EXISTS member_weekly_schedules (
    id              BIGINT      NOT NULL AUTO_INCREMENT,
    user_id         BIGINT      NOT NULL,
    template_id     BIGINT      DEFAULT NULL,
    week_start_date DATE        NOT NULL,
    created_at      DATETIME(6) NOT NULL,
    updated_at      DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_member_weekly_schedules_user_week (user_id, week_start_date),
    KEY idx_member_weekly_schedules_template (template_id),
    CONSTRAINT fk_member_weekly_schedules_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_member_weekly_schedules_template
        FOREIGN KEY (template_id) REFERENCES daily_plan_templates (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS member_weekly_schedule_days (
    id           BIGINT      NOT NULL AUTO_INCREMENT,
    schedule_id  BIGINT      NOT NULL,
    day_of_week  VARCHAR(20) NOT NULL,
    workout_id   BIGINT      NOT NULL,
    order_in_day INT         NOT NULL DEFAULT 0,
    status       VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    PRIMARY KEY (id),
    KEY idx_member_schedule_days_schedule (schedule_id, day_of_week, order_in_day),
    KEY idx_member_schedule_days_workout (workout_id),
    CONSTRAINT fk_member_schedule_days_schedule
        FOREIGN KEY (schedule_id) REFERENCES member_weekly_schedules (id) ON DELETE CASCADE,
    CONSTRAINT fk_member_schedule_days_workout
        FOREIGN KEY (workout_id) REFERENCES workout_entries (id),
    CONSTRAINT ck_member_schedule_days_day
        CHECK (day_of_week IN ('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY')),
    CONSTRAINT ck_member_schedule_days_status
        CHECK (status IN ('PENDING','COMPLETED','SKIPPED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
