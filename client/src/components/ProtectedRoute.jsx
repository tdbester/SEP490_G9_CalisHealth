import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import api from "../api/client";
import { getMaintenanceServiceStatus } from "../api/library";
import MaintenanceModePage from "../pages/MaintenanceModePage";

function clearAuthState() {
  localStorage.removeItem("token");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("jwt");
  localStorage.removeItem("user");
}

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const token = localStorage.getItem("token")?.trim();
  const [status, setStatus] = useState("loading"); // loading | authed | guest
  const [role, setRole] = useState(null);
  const [maintenanceActive, setMaintenanceActive] = useState(false);

  useEffect(() => {
    setStatus("loading");
    setRole(null);
    setMaintenanceActive(false);
    if (!token) {
      clearAuthState();
      setStatus("guest");
      return undefined;
    }

    let cancelled = false;
    api.get("/auth/me")
      .then(async ({ data }) => {
        if (cancelled) return;
        if (
          typeof data?.email !== "string" ||
          !data.email.trim() ||
          typeof data?.role !== "string" ||
          !data.role.trim()
        ) {
          clearAuthState();
          setStatus("guest");
          return;
        }
        localStorage.setItem(
          "user",
          JSON.stringify({ email: data.email, fullName: data.fullName, role: data.role }),
        );
        setRole(data.role);
        if (data.role === "MEMBER") {
          try {
            const maintenance = await getMaintenanceServiceStatus("MEMBER_APP_ACCESS");
            if (!cancelled) {
              setMaintenanceActive(maintenance?.isUnderMaintenance === true);
            }
          } catch {
            // Continue to the app if the optional maintenance status endpoint is unavailable.
          }
        }
        setStatus("authed");
      })
      .catch(() => {
        if (cancelled) return;
        clearAuthState();
        setStatus("guest");
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname, token]);

  useEffect(() => {
    const handleMaintenance = (event) => {
      if (role === "MEMBER" && event.detail?.serviceKey === "MEMBER_APP_ACCESS") {
        setMaintenanceActive(true);
      }
    };
    window.addEventListener("calishealth:maintenance", handleMaintenance);
    return () => window.removeEventListener("calishealth:maintenance", handleMaintenance);
  }, [role]);

  if (!token) return <Navigate to="/login" replace />;
  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#100923", color: "#fff" }}>
        Loading…
      </div>
    );
  }
  if (status === "guest") return <Navigate to="/login" replace />;
  if (role === "MEMBER" && maintenanceActive) return <MaintenanceModePage />;
  return children;
}
