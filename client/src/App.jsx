import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AdminLayout from "./components/layout/AdminLayout";
import Library from "./pages/Library";
import ExerciseListPage from "./pages/ExerciseListPage";
import CommunityExerciseListPage from "./pages/CommunityExerciseListPage";
import CustomWorkoutListPage from "./pages/CustomWorkoutListPage";
import MyCustomWorkoutListPage from "./pages/MyCustomWorkoutListPage";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPassword from "./pages/ResetPassword";

export default function App() {
  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        theme="dark"
        toastStyle={{ backgroundColor: "#090616" }}
      />
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
            <AdminLayout>
              <Library />
            </AdminLayout>
          }
        />
        <Route
          path="/library/exercises"
          element={
            <AdminLayout>
              <ExerciseListPage />
            </AdminLayout>
          }
        />
        <Route
          path="/library/exercises/:tab"
          element={
            <AdminLayout>
              <ExerciseListPage />
            </AdminLayout>
          }
        />
        <Route
          path="/library/community"
          element={
            <AdminLayout>
              <CommunityExerciseListPage />
            </AdminLayout>
          }
        />
        <Route
          path="/library/workouts"
          element={
            <AdminLayout>
              <MyCustomWorkoutListPage />
            </AdminLayout>
          }
        />
        <Route
          path="/library/custom"
          element={
            <AdminLayout>
              <CustomWorkoutListPage />
            </AdminLayout>
          }
        />
        <Route path="/tracking" element={<Navigate to="/" replace />} />
        <Route path="/day-streak" element={<Navigate to="/" replace />} />
        <Route path="/profile" element={<Navigate to="/" replace />} />
        <Route path="/settings" element={<Navigate to="/" replace />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}