import { z } from 'zod';

/**
 * Matches backend RegisterRequest:
 *   @NotBlank fullName
 *   @ValidEmail email
 *   @StrongPassword password
 *   @AssertTrue confirmPassword == password
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least 1 lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least 1 number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least 1 special character');

export const registerSchema = z
  .object({
    fullName: z.string().min(1, 'Please enter your full name').max(100, 'Full name is too long'),
    email: z
      .string()
      .min(1, 'Please enter your email')
      .email('Invalid email address'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
