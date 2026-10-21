import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "./components/layout/AdminLayout";
import Dashboard from "./pages/Dashboard";
import Library from "./pages/Library";
import ExerciseListPage from "./pages/ExerciseListPage";
import MemberExerciseListPage from "./pages/MemberExerciseListPage";
import LibraryDetailPlaceholder from "./pages/LibraryDetailPlaceholder";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPassword from "./pages/ResetPassword";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Member App Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Library />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/library"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Library />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/library/exercises"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <ExerciseListPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/library/member-exercises"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <MemberExerciseListPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/library/workouts"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <LibraryDetailPlaceholder title="Workouts" type="workouts" />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/explore"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Dashboard />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/report"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Dashboard />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tracking"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Dashboard />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}