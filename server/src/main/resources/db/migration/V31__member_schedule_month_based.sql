-- V31: Member workout schedule (lịch tháng).
-- Member tự xếp các workout (lấy từ Daily Training Plan Template của Content Manager)
-- vào từng ngày cụ thể trong tháng — màn "Workout schedule" (Figma 1015:5).
--
--  member_schedules        : 1 dòng / member / tháng (plan_month = ngày 1 của tháng)
--  member_schedule_entries : workout được thả vào 1 ngày cụ thể trong tháng
--
-- Ghi chú lịch sử: module này từng được viết dưới dạng "lịch tuần"
-- (member_weekly_schedules + member_weekly_schedule_days) rồi chuyển sang lịch
-- tháng. Hai bảng tuần đã bị bỏ nên migration chỉ tạo schema cuối cùng.

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
    -- order_in_day chỉ là thứ tự hiển thị nên để index thường, không UNIQUE:
    -- khi member lưu lại lịch, Hibernate INSERT dòng mới trước khi DELETE dòng cũ.
    KEY idx_member_schedule_entries_day (schedule_id, schedule_date, order_in_day),
    KEY idx_member_schedule_entries_workout (workout_id),
    KEY idx_member_schedule_entries_date (schedule_date),
    CONSTRAINT fk_member_schedule_entries_schedule
        FOREIGN KEY (schedule_id) REFERENCES member_schedules (id) ON DELETE CASCADE,
    CONSTRAINT fk_member_schedule_entries_workout
        FOREIGN KEY (workout_id) REFERENCES workout_entries (id),
    CONSTRAINT ck_member_schedule_entries_status
        CHECK (status IN ('PENDING','COMPLETED','SKIPPED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
