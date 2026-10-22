import { z } from 'zod';

export const GENDER_VALUES = ['male', 'female', 'other'] as const;
export type Gender = (typeof GENDER_VALUES)[number];

/**
 * Body information — step 1 of the 4-step survey.
 * Mirrors the Figma screen "CalisHealth_Body_Information_Survey 1":
 * Gender (select) · Age (years) · Height (cm) · Weight (kg).
 *
 * `gender` is kept as a plain string in the form so the select can start on the
 * "Select gender" placeholder; it is refined below to a known GENDER_VALUES entry.
 */
export const bodySchema = z.object({
  gender: z
    .string()
    .min(1, 'Please select your gender')
    .refine((val) => (GENDER_VALUES as readonly string[]).includes(val), {
      message: 'Please select a valid gender',
    }),  age: z
    .number({ invalid_type_error: 'Please enter a valid age' })
    .int('Age must be a whole number')
    .min(10, 'Age must be at least 10')
    .max(100, 'Age must be at most 100'),
  height: z
    .number({ invalid_type_error: 'Please enter a valid height' })
    .min(50, 'Height must be at least 50 cm')
    .max(300, 'Height must be at most 300 cm'),
  weight: z
    .number({ invalid_type_error: 'Please enter a valid weight' })
    .min(10, 'Weight must be at least 10 kg')
    .max(500, 'Weight must be at most 500 kg'),
});

export type BodyFormValues = z.infer<typeof bodySchema>;
