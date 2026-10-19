import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "./components/layout/AdminLayout";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import PlaceholderPage from "./pages/PlaceholderPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
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
              <PlaceholderPage
                title="Thư viện"
                description="Quản lý bài tập, video và tài liệu tập luyện"
              />
            </AdminLayout>
          }
        />
        <Route
          path="/tracking"
          element={
            <AdminLayout>
              <PlaceholderPage
                title="Theo dõi sức khỏe & tiến trình"
                description="Theo dõi chỉ số sức khỏe và tiến trình luyện tập của người dùng"
              />
            </AdminLayout>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
