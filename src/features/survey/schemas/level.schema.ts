import { z } from 'zod';

/* ─── Level test fields ─────────────────────────────────────────────────
Labels, sub-labels and units read off the Figma frame
  371:3 "Survey - Level test" (800 x 900)
Three movement cards, each holding a single numeric input:
    371:37 Push-up  / 371:38 Max reps in a row  / 371:41 reps
    371:46 Squat    / 371:47 Max reps in a row  / 371:50 reps
    371:56 Plank    / 371:57 Max hold time     / 371:60 sec
───────────────────────────────────────────────────────────────────────── */

export interface LevelField {
  key: 'pushUp' | 'squat' | 'plank';
  label: string;
  description: string;
  unit: string;
  min: number;
  max: number;
}

/**
 * The three movements, in the order they appear in the frame.
 * `min` is always 0 — someone who cannot do a single rep simply enters 0.
 */
export const LEVEL_FIELDS: readonly LevelField[] = [
  { key: 'pushUp', label: 'Push-up', description: 'Max reps in a row', unit: 'reps', min: 0, max: 500 },
  { key: 'squat', label: 'Squat', description: 'Max reps in a row', unit: 'reps', min: 0, max: 500 },
  { key: 'plank', label: 'Plank', description: 'Max hold time', unit: 'sec', min: 0, max: 3600 },
];

/* ─── Schema ─────────────────────────────────────────────────────────────
Step 4 of the survey. Three required integers, each bounded by the
movement's realistic ceiling. Every field starts on NaN so zod reports
`invalid_type` until the user has typed something.
───────────────────────────────────────────────────────────────────────── */

function levelNumber(label: string, max: number) {
  return z
    .number({ invalid_type_error: `Please enter your ${label} result` })
    .int('Please use whole numbers only')
    .min(0, 'This cannot be negative')
    .max(max, `That looks too high — the maximum is ${max}`);
}

export const levelTestSchema = z.object({
  pushUp: levelNumber('push-up', 500),
  squat: levelNumber('squat', 500),
  plank: levelNumber('plank', 3600),
});

export type LevelTestFormValues = z.infer<typeof levelTestSchema>;