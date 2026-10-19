/**
 * Type khớp 1:1 với backend DTO (AuthDtos.java + User entity).
 * Khi backend đổi tên field → sửa ở đây trước, TS sẽ báo lỗi chỗ dùng.
 */

export interface User {
  email: string;
  fullName: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  email: string;
  fullName: string;
}

export interface ForgotRequest {
  email: string;
}

export interface ResetRequest {
  token: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface MessageResponse {
  message: string;
}
