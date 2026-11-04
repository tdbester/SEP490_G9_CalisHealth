-- V33: Members who have never trained do not need to enter their current
-- training frequency.
SET @never_training_code = (
    SELECT o.option_code
    FROM assessment_options o
    JOIN assessment_questions q ON q.id = o.question_id
    WHERE q.question_code = 'TRAINING_EXPERIENCE'
      AND o.option_code IN ('NONE', 'NEVER')
    ORDER BY o.sort_order
    LIMIT 1
);

UPDATE survey_step_questions l
JOIN assessment_questions q ON q.id = l.question_id
SET l.conditional_rules = JSON_OBJECT(
        'operator', 'NE',
        'questionCode', 'TRAINING_EXPERIENCE',
        'value', @never_training_code
    )
WHERE q.question_code = 'TRAINING_DAYS_PER_WEEK'
  AND @never_training_code IS NOT NULL;
