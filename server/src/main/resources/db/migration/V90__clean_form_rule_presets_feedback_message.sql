-- Dọn key "feedbackMessage" còn sót trong JSON của bảng form_rule_presets.
--
-- Lý do:
--   V89 đã gỡ cột `form_rules.feedback_message`. Trong `form_rule_presets.rules_json`
--   vẫn còn key "feedbackMessage" trong từng rule preset — dữ liệu chết, không còn
--   ý nghĩa. Xoá cho khớp với cấu trúc rule mới.
--
-- Cách làm:
--   Dùng JSON_TABLE để bung từng phần tử của mảng JSON thành các dòng,
--   bỏ key "feedbackMessage" bằng JSON_REMOVE rồi gộp lại bằng JSON_ARRAYAGG.

UPDATE form_rule_presets p
SET p.rules_json = (
        SELECT JSON_ARRAYAGG(JSON_REMOVE(j.rule_item, '$.feedbackMessage'))
        FROM JSON_TABLE(p.rules_json, '$[*]' COLUMNS (
                rule_item JSON PATH '$'
            )) AS j
    )
WHERE JSON_VALID(p.rules_json)
  AND JSON_LENGTH(p.rules_json) > 0
  AND p.rules_json LIKE '%feedbackMessage%';
