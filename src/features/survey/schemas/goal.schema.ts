import { z } from 'zod';

/* ─── Option catalogues ────────────────────────────────────────────────
All values come from the Figma frames:
  246:2   "Survey - Goals and motivation - Health"  (health branch)
  246:162 "Survey - Goals and motivation - Skills"  (skills branch)
─────────────────────────────────────────────────────────────────────── */

export const PATH_VALUES = ['health', 'skills'] as const;
export type TrainPath = (typeof PATH_VALUES)[number];

export const HEALTH_GOAL_VALUES = ['lose_weight', 'build_muscle', 'stay_fit'] as const;
export type HealthGoal = (typeof HEALTH_GOAL_VALUES)[number];

export const SKILL_VALUES = [
  'muscle_up',
  'handstand',
  'front_lever',
  'planche',
  'human_flag',
  'l_sit',
] as const;
export type Skill = (typeof SKILL_VALUES)[number];

export const MOTIVATION_VALUES = [
  'health',
  'appearance',
  'energy',
  'stress_relief',
  'confidence',
] as const;
export type Motivation = (typeof MOTIVATION_VALUES)[number];

/* ─── Schema ────────────────────────────────────────────────────────────
Step 2 of the survey. One page, two branches:
  path = "health" → exactly one health goal
  path = "skills" → at least one skill
Both branches collect motivations.
─────────────────────────────────────────────────────────────────────── */

export const goalSchema = z
  .object({
    path: z
      .string()
      .min(1, 'Please choose what you train for')
      .refine((val) => (PATH_VALUES as readonly string[]).includes(val), {
        message: 'Please choose what you train for',
      }),

    // Kept as a union with '' so the branch can be empty until the user picks.
    healthGoal: z.union([z.enum(HEALTH_GOAL_VALUES), z.literal('')]),

    skills: z.array(z.enum(SKILL_VALUES)),

    motivations: z.array(z.enum(MOTIVATION_VALUES)),
  })
  .superRefine((values, ctx) => {
    if (values.path === 'health') {
      if (!values.healthGoal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['healthGoal'],
          message: 'Please pick one health goal',
        });
      }
    } else if (values.skills.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['skills'],
        message: 'Please pick at least one skill',
      });
    }

    if (values.motivations.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['motivations'],
        message: 'Please pick at least one motivation',
      });
    }
  });

export type GoalFormValues = z.infer<typeof goalSchema>;