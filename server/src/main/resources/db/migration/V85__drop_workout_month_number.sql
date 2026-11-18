-- Bỏ cột tháng của workout template.
--
-- Bối cảnh:
--   - `daily_plan_templates` đã bỏ `month_number` từ V54: kế hoạch không còn
--     chia theo "tháng", mỗi template áp dụng chung cho mọi kỳ.
--   - `workout_entries.month_number` chỉ còn là metadata ghi vào, không có
--     lệnh SELECT/ORDER BY/WHERE nào đọc nó; toàn bộ dữ liệu đều = 1.
--   - Lịch tập của member được điều khiển bởi `daily_plan_templates` +
--     `daily_plan_template_days.day_number` (xếp theo lịch tuần), không phụ
--     thuộc tháng.
--
-- Giữ lại `day_sequence`: mô tả thứ tự ngày tập trong tuần của workout
-- (Day 1..N), vẫn là metadata hợp lệ cho template.
--
-- Còn giữ `member_schedules.plan_month`: đây là khoá nhóm lưu trữ lịch theo
-- tháng (khoá chính), không phải tham số điều khiển thứ tự tập.

ALTER TABLE workout_entries DROP COLUMN month_number;
