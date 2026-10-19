import { z } from 'zod';

/**
 * Khớp với backend RegisterRequest:
 *   @NotBlank fullName
 *   @ValidEmail email
 *   @StrongPassword password
 *   @AssertTrue confirmPassword == password
 */
const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
  .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất 1 chữ hoa')
  .regex(/[a-z]/, 'Mật khẩu phải có ít nhất 1 chữ thường')
  .regex(/[0-9]/, 'Mật khẩu phải có ít nhất 1 chữ số')
  .regex(/[^A-Za-z0-9]/, 'Mật khẩu phải có ít nhất 1 ký tự đặc biệt');

export const registerSchema = z
  .object({
    fullName: z.string().min(1, 'Vui lòng nhập họ tên').max(100, 'Họ tên quá dài'),
    email: z
      .string()
      .min(1, 'Vui lòng nhập email')
      .email('Email không đúng định dạng'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
