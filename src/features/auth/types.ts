/**
 * Type khớp 1:1 với backend DTO (AuthDtos.java + User entity).
 * Khi backend đổi tên field → sửa ở đây trước, TS sẽ báo lỗi chỗ dùng.
 */

export interface User {
  email: string;
  fullName: string;
  role: 'MEMBER' | 'CONTENT_MANAGER' | 'ADMIN';
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
  role: User['role'];
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

export interface MemberLevelStat {
  level: string;
  memberCount: number;
}

export interface ExerciseEntry {
  code: string;
  name: string;
  type: 'Health' | 'Skill';
  description: string | null;
  category: string | null;
  muscleGroup: string;
  level: string;
  guide: string | null;
  demoVideoUrl: string | null;
  anatomyImageUrl: string | null;
  active: boolean;
  updatedAt: string;
}

export interface CreateExerciseRequest {
  name: string;
  type: 'HEALTH' | 'SKILL';
  description: string;
  category: string;
  muscleGroup: string;
  level: string;
  guide: string;
}

export interface WorkoutEntry {
  code: string;
  name: string;
  description: string | null;
  content: string | null;
  type: 'WORKOUT' | 'DAILY_TRAINING_PLAN';
  level: string;
  active: boolean;
  updatedAt: string;
  exercises: WorkoutExercise[];
  planItems: WorkoutPlanItem[];
}

export interface CreateWorkoutRequest {
  name: string;
  description: string;
  content: string;
  type: 'WORKOUT' | 'DAILY_TRAINING_PLAN';
  level: string;
  exerciseCodes: string[];
  planItems: WorkoutPlanItem[];
}

export interface WorkoutExercise {
  code: string;
  name: string;
  level: string;
  muscleGroup: string;
}

export interface WorkoutPlanItem {
  dayOfWeek: number;
  exerciseCode: string;
  exerciseName?: string;
  muscleGroup?: string;
  beginnerSets: number;
  beginnerReps: number;
  intermediateSets: number;
  intermediateReps: number;
  advancedSets: number;
  advancedReps: number;
}
