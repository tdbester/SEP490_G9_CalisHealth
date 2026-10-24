import { z } from 'zod';

/* ─── Option catalogues ────────────────────────────────────────────────
All values come from the Figma frame:
  246:317 "Survey - Current training routine" (800 x 900)
─────────────────────────────────────────────────────────────────────── */

export const EXPERIENCE_VALUES = ['never', 'under_6_months', 'months_6_12', 'over_1_year'] as const;
export type TrainingExperience = (typeof EXPERIENCE_VALUES)[number];

/**
 * Label + pixel size of every experience tile, read off the Figma frame
 * (246:349, 246:351, 246:353, 246:355). The last tile wraps onto its own row.
 */
export const EXPERIENCE_META: Record<
  TrainingExperience,
  { label: string; width: number; height: number }
> = {
  never: { label: 'Never', width: 76, height: 38 },
  under_6_months: { label: 'Under 6 months', width: 130, height: 38 },
  months_6_12: { label: '6-12 months', width: 110, height: 38 },
  over_1_year: { label: 'Over 1 year', width: 100, height: 38 },
};

export const DAYS_PER_WEEK_VALUES = [1, 2, 3, 4, 5, 6, 7] as const;
export type DaysPerWeek = (typeof DAYS_PER_WEEK_VALUES)[number];

/** The days row is a run of uniform 48 x 48 squares (Figma 246:359–246:371). */
export const DAY_TILE_SIZE = 48;

export const SESSION_MINUTES_VALUES = [15, 30, 45, 60] as const;
export type SessionMinutes = (typeof SESSION_MINUTES_VALUES)[number];

/**
 * Label + pixel size of every minutes tile, read off the Figma frame
 * (246:375, 246:377, 246:379, 246:381). The last tile reads "60+".
 */
export const SESSION_MINUTES_META: Record<
  SessionMinutes,
  { label: string; width: number; height: number }
> = {
  15: { label: '15', width: 52, height: 42 },
  30: { label: '30', width: 52, height: 42 },
  45: { label: '45', width: 52, height: 42 },
  60: { label: '60+', width: 60, height: 42 },
};

/* ─── Schema ────────────────────────────────────────────────────────────
Step 3 of the survey. Three single-select questions:
  experience     — how long the user has trained
  daysPerWeek    — 1…7 tiles
  sessionMinutes — 15 / 30 / 45 / 60+
─────────────────────────────────────────────────────────────────────── */

export const trainingSchema = z.object({
  // Starts as '' so the field renders unselected; refined below to a real
  // catalogue entry once the user has picked a tile.
  experience: z
    .string()
    .min(1, 'Please pick your training experience')
    .refine((val) => (EXPERIENCE_VALUES as readonly string[]).includes(val), {
      message: 'Please pick your training experience',
    }),

  // Both start on NaN so zod reports `invalid_type` until a tile is picked.
  daysPerWeek: z
    .number({ invalid_type_error: 'Please pick how many days per week' })
    .refine((val) => (DAYS_PER_WEEK_VALUES as readonly number[]).includes(val), {
      message: 'Please pick how many days per week',
    }),

  sessionMinutes: z
    .number({ invalid_type_error: 'Please pick how long a session lasts' })
    .refine((val) => (SESSION_MINUTES_VALUES as readonly number[]).includes(val), {
      message: 'Please pick how long a session lasts',
    }),
});

export type TrainingFormValues = z.infer<typeof trainingSchema>;