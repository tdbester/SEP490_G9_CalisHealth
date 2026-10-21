import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';

import { LoginPage } from '@/features/auth/pages/LoginPage';
import { RegisterPage } from '@/features/auth/pages/RegisterPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';
import { VerifyEmailPage } from '@/features/auth/pages/VerifyEmailPage';
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage';
import { NotFoundPage } from '@/features/auth/pages/NotFoundPage';
import { HomePage } from '@/pages/HomePage';
import { SurveyLayout } from '@/features/survey/pages/SurveyLayout';
import { BodyInfoPage } from '@/features/survey/pages/BodyInfoPage';
import { ContentManagerLayout } from '@/features/content-manager/ContentManagerLayout';
import { ContentManagerDashboard } from '@/features/content-manager/pages/ContentManagerDashboard';
import { ContentManagementPage } from '@/features/content-manager/pages/ContentManagementPage';
import { ExerciseListPage } from '@/features/content-manager/pages/ExerciseListPage';
import { ExerciseFormPage } from '@/features/content-manager/pages/ExerciseFormPage';
import { ExerciseDetailPage } from '@/features/content-manager/pages/ExerciseDetailPage';
import { WorkoutListPage } from '@/features/content-manager/pages/WorkoutListPage';
import { WorkoutDetailPage } from '@/features/content-manager/pages/WorkoutDetailPage';
import { useAuthContext } from '@/contexts/AuthContext';

function RoleHomePage() {
  const { user } = useAuthContext();
  return user?.role === 'CONTENT_MANAGER'
    ? <Navigate to="/content/dashboard" replace />
    : <HomePage />;
}

/**
 * Định nghĩa tất cả routes của app.
 * - Public: ai cũng vào được (login, register...)
 * - Protected: phải đăng nhập
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* Public routes - đã login thì redirect về / */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      {/* Auth pages đặc biệt - cho phép cả khi đã login */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify" element={<VerifyEmailPage />} />

      {/* Protected - phải đăng nhập */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<RoleHomePage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/account/change-password" element={<ChangePasswordPage />} />

        {/* Survey flow */}
        <Route path="/survey" element={<SurveyLayout />}>
          <Route index element={<Navigate to="body-information" replace />} />
          <Route path="body-information" element={<BodyInfoPage />} />
          {/* Future steps:
          <Route path="goal" element={<GoalPage />} />
          <Route path="fitness-level" element={<FitnessLevelPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          */}
        </Route>
      </Route>

      {/* Content manager area - role check is enforced by ProtectedRoute and the backend API. */}
      <Route element={<ProtectedRoute allowedRole="CONTENT_MANAGER" />}>
        <Route path="/content" element={<ContentManagerLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ContentManagerDashboard />} />
          <Route path="library" element={<Navigate to="/content/exercises" replace />} />
          <Route path="exercises" element={<ExerciseListPage />} />
          <Route path="create" element={<ExerciseFormPage />} />
          <Route path="exercises/new" element={<Navigate to="/content/create?type=exercise" replace />} />
          <Route path="exercises/:code" element={<ExerciseDetailPage />} />
          <Route path="workouts" element={<WorkoutListPage />} />
          <Route path="workouts/:code" element={<WorkoutDetailPage />} />
          <Route path=":section" element={<ContentManagementPage />} />
        </Route>
      </Route>

      {/* 404 */}
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
