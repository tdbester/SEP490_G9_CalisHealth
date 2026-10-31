-- V15: ngưỡng thăng tiến đầy đủ cho progression_rules + dữ liệu theo từng set.
-- Mỗi dòng progression_rules là một cạnh "bài prerequisite -> bài exercise (đích)". Member làm bài prerequisite,
-- đạt ngưỡng thì mở khóa bài đích. Ngưỡng đo trên bài prerequisite:
--   REPS : mỗi set tối thiểu required_reps rep, đủ required_sets set như vậy
--   HOLD : mỗi set tối thiểu required_seconds giây, đủ required_sets set như vậy
-- min_accuracy (% clean) là trung bình % clean của các set (đã có từ V4).

ALTER TABLE progression_rules
    ADD COLUMN measure_type     VARCHAR(16) NOT NULL DEFAULT 'REPS',
    ADD COLUMN required_sets    INT         NOT NULL DEFAULT 1,
    ADD COLUMN required_seconds INT         DEFAULT NULL;

-- Các rule seed cũ chỉ có required_reps. Bài prerequisite đo bằng thời gian (vd Plank) chuyển sang HOLD, 30 giây.
UPDATE progression_rules pr
    JOIN exercises p ON p.id = pr.prerequisite_exercise_id
SET pr.measure_type = 'HOLD', pr.required_seconds = 30, pr.required_reps = NULL
WHERE p.category = 'HOLD';

ALTER TABLE progression_rules
    ADD CONSTRAINT ck_progression_rules_measure CHECK (measure_type IN ('REPS', 'HOLD')),
    ADD CONSTRAINT ck_progression_rules_sets CHECK (required_sets >= 1);

-- Số giây giữ đúng form của cả bài (tổng các set), dùng cho bài HOLD.
ALTER TABLE session_exercise_results
    ADD COLUMN clean_seconds INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS session_set_results (
    id                         BIGINT NOT NULL AUTO_INCREMENT,
    session_exercise_result_id BIGINT NOT NULL,
    set_number                 INT    NOT NULL,
    total_reps                 INT    NOT NULL DEFAULT 0,
    clean_reps                 INT    NOT NULL DEFAULT 0,
    total_seconds              INT    NOT NULL DEFAULT 0,
    clean_seconds              INT    NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_session_set_results (session_exercise_result_id, set_number),
    CONSTRAINT fk_session_set_results_result FOREIGN KEY (session_exercise_result_id) REFERENCES session_exercise_results (id),
    CONSTRAINT ck_session_set_results_counts CHECK (
        set_number >= 1 AND total_reps >= 0 AND clean_reps >= 0 AND clean_reps <= total_reps
        AND total_seconds >= 0 AND clean_seconds >= 0 AND clean_seconds <= total_seconds
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
