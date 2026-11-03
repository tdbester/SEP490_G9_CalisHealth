-- V27: nới unique key của member_schedule_entries.
-- V26 đặt UNIQUE (schedule_id, schedule_date, order_in_day) để chống trùng, nhưng
-- khi member lưu lại lịch, Hibernate INSERT dòng mới trước khi DELETE dòng cũ nên
-- lần lưu thứ hai bị "Duplicate entry". order_in_day chỉ là thứ tự hiển thị nên
-- đổi thành index thường; dữ liệu trùng vẫn bị chặn ở tầng service.

ALTER TABLE member_schedule_entries
    DROP INDEX uk_member_schedule_entries_day,
    ADD KEY idx_member_schedule_entries_day (schedule_id, schedule_date, order_in_day);
