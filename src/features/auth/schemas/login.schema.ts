import { z } from 'zod';

/**
 * Khớp với backend LoginRequest:
 *   @ValidEmail String email,
 *   @NotBlank String password
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Vui lòng nhập email')
    .email('Email không đúng định dạng'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
