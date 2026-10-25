import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AdminLayout from "./components/layout/AdminLayout";
import Dashboard from "./pages/Dashboard";
import DayStreak from "./pages/DayStreak";
import Library from "./pages/Library";
import ExerciseListPage from "./pages/ExerciseListPage";
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
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPassword from "./pages/ResetPassword";

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
          <Route path="/library" element={memberPage(<Library />)} />
          <Route path="/library/exercises" element={memberPage(<ExerciseListPage />)} />
          <Route path="/library/exercises/:tab" element={memberPage(<ExerciseListPage />)} />
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
          <Route path="/library/workouts/new" element={memberPage(<CreatePersonalWorkoutPage />)} />
          <Route path="/library/workouts/:id/edit" element={memberPage(<UpdateMyCustomWorkoutPage />)} />
          <Route path="/library/custom" element={memberPage(<CustomWorkoutListPage />)} />
          <Route path="/library/custom/new" element={memberPage(<CreatePersonalWorkoutPage />)} />
          <Route path="/library/custom/my" element={memberPage(<MyCustomWorkoutListPage />)} />
          <Route path="/library/custom/:id" element={memberPage(<CustomWorkoutDetailPage />)} />
          <Route path="/library/custom-workouts" element={<Navigate to="/library/custom" replace />} />
          <Route path="/library/custom-workouts/:id" element={memberPage(<CustomWorkoutDetailPage />)} />
          <Route path="/explore" element={memberPage(<CalisthenicsExerciseTreePage />)} />
          <Route path="/tracking" element={memberPage(<DayStreak />)} />
          <Route path="/profile" element={<Navigate to="/dashboard" replace />} />
          <Route path="/settings" element={<Navigate to="/dashboard" replace />} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}