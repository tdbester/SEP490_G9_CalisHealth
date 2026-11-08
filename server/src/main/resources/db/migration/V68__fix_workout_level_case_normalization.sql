-- V67 chuẩn hóa level của workout về tên trong fitness_levels, nhưng điều kiện JOIN
-- (fl.name = UPPER(w.level)) không khớp với level đã ở dạng title case ('Beginner').
-- V68 sửa lại: so sánh không phân biệt hoa thường giữa w.level và fl.name.

UPDATE workout_entries w
JOIN fitness_levels fl ON UPPER(fl.name) = UPPER(w.level)
SET w.level = fl.name
WHERE w.level <> fl.name;

UPDATE daily_plan_templates t
JOIN fitness_levels fl ON UPPER(fl.name) = UPPER(t.level)
SET t.level = fl.name
WHERE t.level <> fl.name;
