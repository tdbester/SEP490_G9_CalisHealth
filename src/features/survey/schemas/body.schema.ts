import { z } from 'zod';

export const bodySchema = z.object({
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
