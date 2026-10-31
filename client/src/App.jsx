import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AdminLayout from "./components/layout/AdminLayout";
import RoleHomeRoute from "./components/RoleHomeRoute";
import ContentManagerLayout from "./components/layout/ContentManagerLayout";
import AdminAreaLayout from "./components/layout/AdminAreaLayout";
import AdminDashboard from "./pages/AdminDashboard";
import AdminSectionPage from "./pages/AdminSectionPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminCreateStaffPage from "./pages/AdminCreateStaffPage";
import AdminUserDetailPage from "./pages/AdminUserDetailPage";
import HealthTracking from "./pages/HealthTracking";
import WorkoutHistory from "./pages/WorkoutHistory";
import PerformanceAnalytics from "./pages/PerformanceAnalytics";
import DayStreak from "./pages/DayStreak";
import Library from "./pages/Library";
import LibraryExerciseListPage from "./pages/LibraryExerciseListPage";
import ExerciseDetailPage from "./pages/ExerciseDetailPage";
import CommunityExerciseListPage from "./pages/CommunityExerciseListPage";
import CreatePersonalExercisePage from "./pages/CreatePersonalExercisePage";
import UpdatePersonalExercisePage from "./pages/UpdatePersonalExercisePage";
import MyExerciseListPage from "./pages/MyExerciseListPage";
import CalisthenicsExerciseTreePage from "./pages/CalisthenicsExerciseTreePage";
import CustomWorkoutListPage from "./pages/CustomWorkoutListPage";
import CustomWorkoutDetailPage from "./pages/CustomWorkoutDetailPage";
import CreatePersonalWorkoutPage from "./pages/CreatePersonalWorkoutPage";
import MyCustomWorkoutListPage from "./pages/MyCustomWorkoutListPage";
import UpdateMyCustomWorkoutPage from "./pages/UpdateMyCustomWorkoutPage";
import WorkoutSystemListPage from "./pages/WorkoutSystemListPage";
import SystemWorkoutDetailPage from "./pages/SystemWorkoutDetailPage";
import ProtectedRoute from "./components/ProtectedRoute";
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
import ChangePassword from "./pages/ChangePassword";
import SurveyFlow, { SurveyEntry } from "./pages/survey/SurveyFlow";
import SurveyStepPage from "./pages/survey/SurveyStepPage";
import SurveyResult from "./pages/survey/SurveyResult";
import SurveyManagement from "./pages/content/SurveyManagement";

export default function App() {
  const memberPage = (page) => (
    <ProtectedRoute>
      <AdminLayout>{page}</AdminLayout>
    </ProtectedRoute>
  );

  return (
    <>
      <ToastContainer
        position="top-right"
        newestOnTop
        theme="dark"
        toastClassName="!rounded-xl !border !border-[#3c3063] !bg-[#1a1438] !text-slate-200 !shadow-2xl"
        className="!top-0 !right-0 !z-[9999]"
      />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/verify-reset-password" element={<VerifyResetPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/change-password" element={<ChangePassword />} />

          <Route path="/" element={<RoleHomeRoute />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/day-streak" element={memberPage(<DayStreak />)} />
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

        <Route path="/library" element={memberPage(<Library />)} />
        <Route path="/library/exercises" element={memberPage(<LibraryExerciseListPage />)} />
        <Route path="/library/exercises/system/:exerciseId" element={memberPage(<ExerciseDetailPage />)} />
        <Route path="/library/exercises/:tab" element={memberPage(<LibraryExerciseListPage />)} />
        <Route path="/library/exercises/member" element={memberPage(<CommunityExerciseListPage />)} />
        <Route path="/library/exercise/:id" element={memberPage(<ExerciseDetailPage />)} />
        <Route path="/library/community" element={memberPage(<CommunityExerciseListPage />)} />
        <Route path="/library/member-exercises" element={memberPage(<CommunityExerciseListPage />)} />
        <Route path="/library/community/:id" element={memberPage(<ExerciseDetailPage />)} />
        <Route path="/library/member/:id" element={memberPage(<ExerciseDetailPage />)} />
        <Route path="/library/personal" element={memberPage(<MyExerciseListPage />)} />
        <Route path="/library/personal/new" element={memberPage(<CreatePersonalExercisePage />)} />
        <Route path="/library/personal/:id/edit" element={memberPage(<UpdatePersonalExercisePage />)} />
        <Route path="/library/personal-exercises" element={memberPage(<MyExerciseListPage />)} />
        <Route path="/library/personal-exercises/new" element={memberPage(<CreatePersonalExercisePage />)} />
        <Route path="/library/personal-exercises/:id/edit" element={memberPage(<UpdatePersonalExercisePage />)} />
        <Route path="/library/workouts" element={memberPage(<MyCustomWorkoutListPage />)} />
        <Route path="/library/workouts/system" element={memberPage(<WorkoutSystemListPage />)} />
        <Route path="/library/workouts/system/:workoutId" element={memberPage(<SystemWorkoutDetailPage />)} />
        <Route path="/library/workouts/health" element={memberPage(<WorkoutSystemListPage />)} />
        <Route path="/library/workouts/skill" element={memberPage(<WorkoutSystemListPage />)} />
        <Route path="/library/system-workouts/:id" element={memberPage(<SystemWorkoutDetailPage />)} />
        <Route path="/library/workouts/new" element={memberPage(<CreatePersonalWorkoutPage />)} />
        <Route path="/library/workouts/:id/edit" element={memberPage(<UpdateMyCustomWorkoutPage />)} />
        <Route path="/library/custom" element={memberPage(<CustomWorkoutListPage />)} />
        <Route path="/library/custom/new" element={memberPage(<CreatePersonalWorkoutPage />)} />
        <Route path="/library/custom/my" element={memberPage(<MyCustomWorkoutListPage />)} />
        <Route path="/library/custom/:id" element={memberPage(<CustomWorkoutDetailPage />)} />
        <Route path="/library/custom-workouts" element={<Navigate to="/library/custom" replace />} />
        <Route path="/library/custom-workouts/:id" element={memberPage(<CustomWorkoutDetailPage />)} />
        <Route path="/library/skills/tree" element={memberPage(<CalisthenicsExerciseTreePage />)} />
        <Route path="/explore" element={memberPage(<CalisthenicsExerciseTreePage />)} />

        {/* Admin area (role ADMIN) - the guard reads /auth/me, same pattern as /content. */}
        <Route path="/admin" element={<AdminAreaLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="users/create" element={<AdminCreateStaffPage />} />
          <Route path="users/:id" element={<AdminUserDetailPage />} />
          <Route path="create" element={<Navigate to="/admin/users/create" replace />} />
          <Route path="notifications" element={<AdminSectionPage title="Notifications" />} />
          <Route path="storage" element={<AdminSectionPage title="Media storage & infrastructure" />} />
          <Route path="maintenance" element={<AdminSectionPage title="Create maintenance schedule" />} />
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Route>

        <Route
          path="/tracking"
          element={memberPage(<HealthTracking />)}
        />
        <Route
          path="/tracking/workout-history"
          element={memberPage(<WorkoutHistory />)}
        />
        <Route
          path="/tracking/assessment"
          element={memberPage(<PerformanceAnalytics />)}
        />
        <Route path="/profile" element={<Navigate to="/" replace />} />
        <Route path="/settings" element={<Navigate to="/" replace />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
