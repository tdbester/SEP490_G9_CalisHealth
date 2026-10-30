import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "./components/layout/AdminLayout";
import RoleHomeRoute from "./components/RoleHomeRoute";
import ContentManagerLayout from "./components/layout/ContentManagerLayout";
import Dashboard from "./pages/Dashboard";
import HealthTracking from "./pages/HealthTracking";
import WorkoutHistory from "./pages/WorkoutHistory";
import PerformanceAnalytics from "./pages/PerformanceAnalytics";
import DayStreak from "./pages/DayStreak";
import ContentManagerDashboard from "./pages/ContentManagerDashboard";
import ProgressionRulesPage, {
  ProgressionRuleDetailPage,
  ProgressionRuleFormPage,
} from "./pages/ProgressionRulesPage";
import ExerciseListPage from "./pages/ExerciseListPage";
import SystemExerciseDetailPage from "./pages/SystemExerciseDetailPage";
import ExerciseFormPage from "./pages/ExerciseFormPage";
import WorkoutListPage from "./pages/WorkoutListPage";
import WorkoutDetailPage from "./pages/WorkoutDetailPage";
import PendingModerationPage from "./pages/PendingModerationPage";
import ExerciseModerationDetailPage from "./pages/ExerciseModerationDetailPage";
import ExerciseApprovalHistoryPage from "./pages/ExerciseApprovalHistoryPage";
import LevelBenchmarkCriteriaPage, {
  LevelBenchmarkDetailPage,
  LevelBenchmarkFormPage,
} from "./pages/LevelBenchmarkCriteriaPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyEmail from "./pages/VerifyEmail";
import VerifyResetPassword from "./pages/VerifyResetPassword";
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
        <Route path="/verify-reset-password" element={<VerifyResetPassword />} />
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

        {/*
          Content Manager area (role CONTENT_MANAGER) - the guard reads /auth/me and
          redirects to /login or shows a "no access" screen.
        */}
        <Route path="/content" element={<ContentManagerLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ContentManagerDashboard />} />
          <Route path="surveys" element={<SurveyManagement />} />
          {/* URL cũ của màn Survey management */}
          <Route path="survey" element={<Navigate to="/content/surveys" replace />} />
          <Route path="exercises" element={<ExerciseListPage />} />
          <Route path="progression-rules" element={<ProgressionRulesPage />} />
          <Route path="progression-rules/new" element={<ProgressionRuleFormPage />} />
          <Route path="progression-rules/:id/edit" element={<ProgressionRuleFormPage />} />
          <Route path="progression-rules/:id" element={<ProgressionRuleDetailPage />} />
          <Route path="benchmark-criteria" element={<LevelBenchmarkCriteriaPage />} />
          <Route path="benchmark-criteria/edit" element={<LevelBenchmarkFormPage />} />
          <Route path="benchmark-criteria/:id/edit" element={<LevelBenchmarkFormPage />} />
          <Route path="benchmark-criteria/:id" element={<LevelBenchmarkDetailPage />} />
          <Route path="exercises/pending-moderation" element={<PendingModerationPage />} />
          <Route path="exercises/approval-history" element={<ExerciseApprovalHistoryPage />} />
          <Route path="exercises/moderation/:code" element={<ExerciseModerationDetailPage />} />
          <Route path="exercises/:code" element={<SystemExerciseDetailPage />} />
          <Route path="workouts" element={<WorkoutListPage />} />
          <Route path="workouts/:code" element={<WorkoutDetailPage />} />
          <Route path="create" element={<ExerciseFormPage />} />
          <Route path="library" element={<Navigate to="/content/exercises" replace />} />
          <Route path="*" element={<Navigate to="/content/dashboard" replace />} />
        </Route>

        <Route path="/" element={<RoleHomeRoute />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route
          path="/day-streak"
          element={
            <AdminLayout>
              <DayStreak />
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
        <Route path="/day-streak" element={<Navigate to="/" replace />} />
        <Route path="/profile" element={<Navigate to="/" replace />} />
        <Route path="/settings" element={<Navigate to="/" replace />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
