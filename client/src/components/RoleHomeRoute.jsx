import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import api, { getStoredAuthToken } from "../api/client";
import AdminLayout from "./layout/AdminLayout";
import Dashboard from "../pages/Dashboard";
import MaintenanceModePage from "../pages/MaintenanceModePage";
import { getMaintenanceServiceStatus } from "../api/library";

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
  const [state, setState] = useState({ status: "loading", role: null, maintenanceActive: false });

  useEffect(() => {
    const { token } = getStoredAuthToken();
    if (!token) {
      clearAuthState();
      setState({ status: "guest", role: null, maintenanceActive: false });
      return undefined;
    }

    let cancelled = false;
    api
      .get("/auth/me")
      .then(async ({ data }) => {
        if (cancelled) return;
        if (
          typeof data?.email !== "string" ||
          !data.email.trim() ||
          typeof data?.role !== "string" ||
          !data.role.trim()
        ) {
          clearAuthState();
          setState({ status: "guest", role: null, maintenanceActive: false });
          return;
        }
        localStorage.setItem(
          "user",
          JSON.stringify({ email: data.email, fullName: data.fullName, role: data.role }),
        );
        const maintenance = data.role === "MEMBER"
          ? await getMaintenanceServiceStatus("MEMBER_APP_ACCESS").catch(() => null)
          : null;
        if (!cancelled) {
          setState({
            status: "ready",
            role: data.role,
            maintenanceActive: maintenance?.isUnderMaintenance === true,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearAuthState();
          setState({ status: "guest", role: null, maintenanceActive: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleMaintenance = (event) => {
      if (state.role === "MEMBER" && event.detail?.serviceKey === "MEMBER_APP_ACCESS") {
        setState((current) => ({ ...current, maintenanceActive: true }));
      }
    };
    window.addEventListener("calishealth:maintenance", handleMaintenance);
    return () => window.removeEventListener("calishealth:maintenance", handleMaintenance);
  }, [state.role]);

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
  if (state.role === "MEMBER" && state.maintenanceActive) {
    return <MaintenanceModePage />;
  }

  return (
    <AdminLayout>
      <Dashboard />
    </AdminLayout>
  );
}
