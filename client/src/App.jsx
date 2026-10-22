import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "./components/layout/AdminLayout";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPassword from "./pages/ResetPassword";
import ProtectedRoute from "./components/ProtectedRoute";
import PlaceholderPage from "./pages/PlaceholderPage";

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
        <Route
          path="/library"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <PlaceholderPage
                  title="Library"
                  subtitle="Personal and saved exercise collection, skill progressions and community workouts."
                />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tracking"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <PlaceholderPage
                  title="Health & Progress"
                  subtitle="Body metrics, training history and progress charts."
                />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/day-streak"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <PlaceholderPage
                  title="Day Streak"
                  subtitle="Track your training consistency and keep your workout streak going."
                />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <PlaceholderPage
                  title="Profile"
                  subtitle="View and manage your CalisHealth profile."
                />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <PlaceholderPage
                  title="Settings"
                  subtitle="Manage your account and application preferences."
                />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}