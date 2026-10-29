-- V14: a benchmark slot is now the code of the survey question that supplies the reps / seconds
-- value, so exercises can be added or removed without touching Java. Rename the three original slots
-- to the question codes the onboarding survey already uses. Data-only; no schema change.
UPDATE benchmark_criteria SET benchmark_slot = 'PUSH_UP_MAX_REPS' WHERE benchmark_slot = 'PUSH_UP';
UPDATE benchmark_criteria SET benchmark_slot = 'SQUAT_MAX_REPS'   WHERE benchmark_slot = 'SQUAT';
UPDATE benchmark_criteria SET benchmark_slot = 'PLANK_MAX_SECONDS' WHERE benchmark_slot = 'PLANK';
