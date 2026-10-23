import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AdminLayout from "./components/layout/AdminLayout";
import Dashboard from "./pages/Dashboard";
import Library from "./pages/Library";
import ExerciseListPage from "./pages/ExerciseListPage";
import MemberExerciseListPage from "./pages/MemberExerciseListPage";
import ExerciseDetailPage from "./pages/ExerciseDetailPage";
import CommunityExerciseListPage from "./pages/CommunityExerciseListPage";
import CreatePersonalExercisePage from "./pages/CreatePersonalExercisePage";
import UpdatePersonalExercisePage from "./pages/UpdatePersonalExercisePage";
import MyExerciseListPage from "./pages/MyExerciseListPage";
import CalisthenicsExerciseTreePage from "./pages/CalisthenicsExerciseTreePage";
import LibraryDetailPlaceholder from "./pages/LibraryDetailPlaceholder";
import CustomWorkoutListPage from "./pages/CustomWorkoutListPage";
import CreatePersonalWorkoutPage from "./pages/CreatePersonalWorkoutPage";
import MyCustomWorkoutListPage from "./pages/MyCustomWorkoutListPage";
import UpdateMyCustomWorkoutPage from "./pages/UpdateMyCustomWorkoutPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPassword from "./pages/ResetPassword";
import ProtectedRoute from "./components/ProtectedRoute";

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

        {/* Member App Routes */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Dashboard />
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
          path="/library/exercises/:tab"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <ExerciseListPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/library/exercise/:id"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <ExerciseDetailPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/library/community"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <CommunityExerciseListPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/library/exercises/member"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <CommunityExerciseListPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/library/community/:id"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <ExerciseDetailPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/library/member/:id"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <ExerciseDetailPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/library/personal"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <MyExerciseListPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/library/personal/new"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <CreatePersonalExercisePage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/library/personal/:id/edit"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <UpdatePersonalExercisePage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/library/member-exercises"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <CommunityExerciseListPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/library/workouts"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <MyCustomWorkoutListPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/library/custom"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <CustomWorkoutListPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/library/custom/my"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <LibraryDetailPlaceholder title="My Custom Workouts" type="custom-workouts" />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/library/custom/new"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <CreatePersonalWorkoutPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/library/workouts/new"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <CreatePersonalWorkoutPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/library/workouts/:id/edit"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <UpdateMyCustomWorkoutPage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/library/custom/:id"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <LibraryDetailPlaceholder title="Custom Workout Detail" type="custom-workouts" />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/explore"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <CalisthenicsExerciseTreePage />
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
    </>
  );
}