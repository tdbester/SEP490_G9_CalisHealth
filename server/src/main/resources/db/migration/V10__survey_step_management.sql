-- V4: Survey management (Content Manager) - màn "Survey management".
-- Content manager quản lý các BƯỚC của khảo sát đăng ký: tạo, sửa, đổi trạng thái, sắp xếp,
-- xem trước, xóa, và cấu hình bước kết quả. Không tạo bảng mới, chỉ mở rộng survey_steps:
--
--   step_type      QUESTIONS = bước có câu hỏi (member trả lời)
--                  RESULT    = bước "Result and recommended plan": hệ thống tự sinh từ level criteria,
--                              không có câu hỏi, được "configure" thay vì "edit". Tối đa 1 bước / survey
--                              và luôn đứng cuối (kiểm tra ở SurveyStepManagementService).
--   result_config  JSON cấu hình bước RESULT, NULL với bước QUESTIONS.
--   status         thêm DRAFT: bước mới tạo ở DRAFT, member không thấy cho tới khi được kích hoạt.
--   created_at / updated_at / updated_by
--                  updated_at do service tự đặt khi NỘI DUNG bước đổi (tạo, sửa, đổi trạng thái,
--                  cấu hình) - KHÔNG có ON UPDATE để việc kéo thả đổi thứ tự không làm "Updated ..."
--                  của mọi bước nhảy về "vừa xong".
--
-- Dữ liệu cũ: mọi bước hiện có thành QUESTIONS, giữ nguyên status; updated_at = thời điểm migrate.

ALTER TABLE survey_steps
    ADD COLUMN step_type     VARCHAR(16) NOT NULL DEFAULT 'QUESTIONS' AFTER description,
    ADD COLUMN result_config JSON        DEFAULT NULL AFTER step_type,
    ADD COLUMN created_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    ADD COLUMN updated_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    ADD COLUMN updated_by    BIGINT      DEFAULT NULL,
    -- 1 khi là bước RESULT, NULL khi khác -> UNIQUE bên dưới đảm bảo mỗi survey có tối đa 1 bước RESULT
    ADD COLUMN result_marker TINYINT GENERATED ALWAYS AS (CASE WHEN step_type = 'RESULT' THEN 1 ELSE NULL END) STORED;

ALTER TABLE survey_steps DROP CHECK ck_survey_steps_status;

ALTER TABLE survey_steps
    ALTER COLUMN status SET DEFAULT 'DRAFT',
    ADD CONSTRAINT ck_survey_steps_status CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE')),
    ADD CONSTRAINT ck_survey_steps_type CHECK (step_type IN ('QUESTIONS', 'RESULT')),
    ADD CONSTRAINT ck_survey_steps_result_config CHECK (step_type = 'RESULT' OR result_config IS NULL),
    ADD UNIQUE KEY uk_survey_steps_one_result (survey_id, result_marker),
    ADD KEY idx_survey_steps_updated_by (updated_by),
    ADD CONSTRAINT fk_survey_steps_updated_by FOREIGN KEY (updated_by) REFERENCES users (id);
