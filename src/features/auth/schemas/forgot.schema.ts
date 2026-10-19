import { z } from 'zod';

export const forgotSchema = z.object({
  email: z
    .string()
    .min(1, 'Vui lòng nhập email')
    .email('Email không đúng định dạng'),
});

export type ForgotFormValues = z.infer<typeof forgotSchema>;
