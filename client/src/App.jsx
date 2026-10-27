import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "./components/layout/AdminLayout";
import Dashboard from "./pages/Dashboard";
import HealthTracking from "./pages/HealthTracking";
import WorkoutHistory from "./pages/WorkoutHistory";
import PerformanceAnalytics from "./pages/PerformanceAnalytics";
import DayStreak from "./pages/DayStreak";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPassword from "./pages/ResetPassword";
import ProtectedRoute from "./components/ProtectedRoute";
import SurveyFlow, { SurveyEntry } from "./pages/survey/SurveyFlow";
import SurveyStepPage from "./pages/survey/SurveyStepPage";
import SurveyResult from "./pages/survey/SurveyResult";
import SurveyManagement from "./pages/content/SurveyManagement";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Onboarding survey của member (sau khi đăng nhập); URL theo Figma: /survey/body-information … */}
        <Route
          path="/survey"
          element={
            <ProtectedRoute>
              <SurveyFlow />
            </ProtectedRoute>
          }
        >
          <Route index element={<SurveyEntry />} />
          <Route path=":stepSlug" element={<SurveyStepPage />} />
        </Route>
        <Route
          path="/survey/result"
          element={
            <ProtectedRoute>
              <SurveyResult />
            </ProtectedRoute>
          }
        />

        <Route
          path="/"
          element={
            <AdminLayout>
              <Dashboard />
            </AdminLayout>
          }
        />
        <Route
          path="/dashboard"
          element={
            <AdminLayout>
              <Dashboard />
            </AdminLayout>
          }
        />
        <Route path="/library" element={<Navigate to="/" replace />} />
        <Route
          path="/tracking"
          element={
            <AdminLayout>
              <HealthTracking />
            </AdminLayout>
          }
        />
        <Route
          path="/tracking/workout-history"
          element={
            <AdminLayout>
              <WorkoutHistory />
            </AdminLayout>
          }
        />
        <Route
          path="/tracking/assessment"
          element={
            <AdminLayout>
              <PerformanceAnalytics />
            </AdminLayout>
          }
        />
        {/* Content Manager (BE chặn /api/content/** theo role CONTENT_MANAGER) */}
        <Route
          path="/content/survey"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <SurveyManagement />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route path="/day-streak" element={<Navigate to="/" replace />} />
        <Route path="/profile" element={<Navigate to="/" replace />} />
        <Route path="/settings" element={<Navigate to="/" replace />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}