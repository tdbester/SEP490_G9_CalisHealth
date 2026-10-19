import { api } from '@/lib/axios';
import type {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  ForgotRequest,
  ResetRequest,
  ChangePasswordRequest,
  User,
  MessageResponse,
} from '../types';

/**
 * Tất cả API gọi backend đều qua đây.
 * Backend mount ở /api/auth/*
 */
export const authApi = {
  register: (data: RegisterRequest) =>
    api.post<MessageResponse>('/auth/register', data).then((r) => r.data),

  verifyEmail: (token: string) =>
    api
      .get<MessageResponse>('/auth/verify', { params: { token } })
      .then((r) => r.data),

  login: (data: LoginRequest) =>
    api.post<AuthResponse>('/auth/login', data).then((r) => r.data),

  forgotPassword: (data: ForgotRequest) =>
    api.post<MessageResponse>('/auth/forgot-password', data).then((r) => r.data),

  resetPassword: (data: ResetRequest) =>
    api.post<MessageResponse>('/auth/reset-password', data).then((r) => r.data),

  changePassword: (data: ChangePasswordRequest) =>
    api.post<MessageResponse>('/auth/change-password', data).then((r) => r.data),

  me: () => api.get<User>('/auth/me').then((r) => r.data),
};
