import { api } from '@/lib/axios';
import { getToken } from '@/lib/storage';
import axios from 'axios';
import type {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  ForgotRequest,
  ResetRequest,
  ChangePasswordRequest,
  MemberLevelStat,
  User,
  ExerciseEntry,
  CreateExerciseRequest,
  WorkoutEntry,
  CreateWorkoutRequest,
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

  memberLevels: () =>
    api.get<MemberLevelStat[]>('/content/dashboard/member-levels').then((r) => r.data),

  exercises: () =>
    api.get<ExerciseEntry[]>('/content/exercises').then((r) => r.data),

  exercise: (code: string) =>
    api.get<ExerciseEntry>(`/content/exercises/${encodeURIComponent(code)}`).then((r) => r.data),

  createExercise: (data: CreateExerciseRequest, demoVideo: File | null, anatomyImage: File | null) => {
    const form = new FormData();
    form.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }));
    if (demoVideo) form.append('demoVideo', demoVideo);
    if (anatomyImage) form.append('anatomyImage', anatomyImage);
    const token = getToken();
    if (!token) {
      throw new Error('Your login session is missing. Sign in again, then retry creating the exercise.');
    }

    return api.post<ExerciseEntry>('/content/exercises', form, {
      headers: { 'Content-Type': undefined },
    })
      .then((response) => response.data).catch((error: unknown) => {
      if (axios.isAxiosError(error)) {
        throw new ApiRequestError(
          getApiErrorMessage(error.response?.data, error.response?.status),
          error.response?.status,
        );
      }
      throw error;
    });
  },

  updateExerciseStatus: (code: string, active: boolean) =>
    api.patch<ExerciseEntry>(`/content/exercises/${encodeURIComponent(code)}/status`, { active }).then((r) => r.data),

  workouts: () =>
    api.get<WorkoutEntry[]>('/content/workouts').then((r) => r.data),

  workout: (code: string) =>
    api.get<WorkoutEntry>(`/content/workouts/${encodeURIComponent(code)}`).then((r) => r.data),

  createWorkout: (data: CreateWorkoutRequest) =>
    api.post<WorkoutEntry>('/content/workouts', data).then((r) => r.data),
};

export class ApiRequestError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

function getApiErrorMessage(payload: unknown, status?: number): string {
  if (payload && typeof payload === 'object' && 'message' in payload
      && typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message;
  }
  if (status === 401) return 'The server rejected the saved login token. It has been kept; check the Spring Boot log for the JWT rejection reason.';
  if (status === 403) return 'This account is not allowed to create exercises. Sign in as a Content Manager.';
  if (status) return `The server rejected the request (HTTP ${status}).`;
  return 'Could not reach the server. Check that Spring Boot is running and try again.';
}
