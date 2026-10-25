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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/reset-password" element={<ResetPassword />} />

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
        <Route path="/day-streak" element={<Navigate to="/" replace />} />
        <Route path="/profile" element={<Navigate to="/" replace />} />
        <Route path="/settings" element={<Navigate to="/" replace />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}