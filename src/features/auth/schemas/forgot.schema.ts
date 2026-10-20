import { z } from 'zod';

export const forgotSchema = z.object({
  email: z
    .string()
    .min(1, 'Please enter your email')
    .email('Invalid email address'),
});

export type ForgotFormValues = z.infer<typeof forgotSchema>;
