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
        <Route path="/" element={<HomePage />} />
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

      {/* 404 */}
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
