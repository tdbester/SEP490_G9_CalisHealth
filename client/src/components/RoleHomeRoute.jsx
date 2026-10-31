import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import api, { getStoredAuthToken } from "../api/client";
import AdminLayout from "./layout/AdminLayout";
import Dashboard from "../pages/Dashboard";

function clearAuthState() {
  localStorage.removeItem("token");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("jwt");
  localStorage.removeItem("user");
}

/**
 * Trang chủ theo vai trò:
 * - CONTENT_MANAGER -> /content/dashboard (khu quản trị nội dung)
 * - ADMIN -> /admin/dashboard (khu quản trị hệ thống)
 * - còn lại (MEMBER) -> Dashboard của member
 *
 * Dùng /auth/me thay vì chỉ đọc localStorage vì cache "user" của phiên cũ
 * không có trường role.
 */
export default function RoleHomeRoute() {
  const [state, setState] = useState({ status: "loading", role: null });

  useEffect(() => {
    const { token } = getStoredAuthToken();
    if (!token) {
      clearAuthState();
      setState({ status: "guest", role: null });
      return undefined;
    }

    let cancelled = false;
    api
      .get("/auth/me")
      .then(({ data }) => {
        if (cancelled) return;
        if (
          typeof data?.email !== "string" ||
          !data.email.trim() ||
          typeof data?.role !== "string" ||
          !data.role.trim()
        ) {
          clearAuthState();
          setState({ status: "guest", role: null });
          return;
        }
        localStorage.setItem(
          "user",
          JSON.stringify({ email: data.email, fullName: data.fullName, role: data.role }),
        );
        setState({ status: "ready", role: data.role });
      })
      .catch(() => {
        if (!cancelled) {
          clearAuthState();
          setState({ status: "guest", role: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <CircularProgress size={28} aria-label="Loading" />
      </Box>
    );
  }

  // Guests get the public dashboard (Dashboard/Topbar already render a guest view with "Log in").
  if (state.role === "CONTENT_MANAGER") {
    return <Navigate to="/content/dashboard" replace />;
  }

  if (state.role === "ADMIN") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <AdminLayout>
      <Dashboard />
    </AdminLayout>
  );
}
