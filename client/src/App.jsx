import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CssBaseline, ThemeProvider } from "@mui/material";
import theme from "./theme";
import AdminLayout from "./components/layout/AdminLayout";
import Dashboard from "./pages/Dashboard";
import PlaceholderPage from "./pages/PlaceholderPage";

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
