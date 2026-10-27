import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import api from "../api/client";
import AdminLayout from "./layout/AdminLayout";
import Dashboard from "../pages/Dashboard";

/**
 * Trang chủ theo vai trò:
 * - CONTENT_MANAGER -> /content/dashboard (khu quản trị nội dung)
 * - còn lại (MEMBER/ADMIN) -> Dashboard của member
 *
 * Dùng /auth/me thay vì chỉ đọc localStorage vì cache "user" của phiên cũ
 * không có trường role.
 */
export default function RoleHomeRoute() {
  const [state, setState] = useState({ status: "loading", role: null });

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      setState({ status: "guest", role: null });
      return undefined;
    }

    let cancelled = false;
    api
      .get("/auth/me")
      .then(({ data }) => {
        if (cancelled) return;
        localStorage.setItem(
          "user",
          JSON.stringify({ email: data.email, fullName: data.fullName, role: data.role }),
        );
        setState({ status: "ready", role: data.role });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "guest", role: null });
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

  if (state.status === "guest") {
    return <Navigate to="/login" replace />;
  }

  if (state.role === "CONTENT_MANAGER") {
    return <Navigate to="/content/dashboard" replace />;
  }

  return (
    <AdminLayout>
      <Dashboard />
    </AdminLayout>
  );
}
