import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import api from "../api/client";
import { getMaintenanceServiceStatus } from "../api/library";
import MaintenanceModePage from "../pages/MaintenanceModePage";
import { currentPath, isGuestSession, loginPath } from "../utils/authState";

function clearAuthState() {
  localStorage.removeItem("token");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("jwt");
  localStorage.removeItem("user");
}

/**
 * Guard cho các trang CHỈ MEMBER mới được xem (ví dụ chi tiết bài tập / workout).
 *
 * Khác với `ProtectedRoute`, guard này xử lý riêng trường hợp GUEST:
 * thay vì đẩy thẳng sang /login (mất ngữ cảnh), ta hiện thông báo
 * "vui lòng đăng nhập" rồi mới chuyển hướng, kèm `returnTo` để sau khi
 * đăng nhập người dùng quay lại đúng trang họ đang muốn xem.
 */
export default function GuestBlockedRoute({ children }) {
  const location = useLocation();
  const { t } = useTranslation();
  // GUEST thì biết ngay từ đầu (đọc localStorage) — không cần chờ /auth/me,
  // tránh nháy màn "Loading…" rồi mới chuyển hướng.
  const [status, setStatus] = useState(() => (isGuestSession() ? "guest" : "loading"));
  const [role, setRole] = useState(null);
  const [maintenanceActive, setMaintenanceActive] = useState(false);

  useEffect(() => {
    if (isGuestSession()) {
      // GUEST: báo lý do rồi mới đưa sang trang đăng nhập.
      toast.info(t("member.library.loginRequiredDetail"));
      setStatus("guest");
      return undefined;
    }

    setStatus("loading");
    setRole(null);
    setMaintenanceActive(false);

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
            // Bỏ qua nếu endpoint bảo trì không khả dụng.
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
  }, [location.pathname, t]);

  useEffect(() => {
    const handleMaintenance = (event) => {
      if (role === "MEMBER" && event.detail?.serviceKey === "MEMBER_APP_ACCESS") {
        setMaintenanceActive(true);
      }
    };
    window.addEventListener("calishealth:maintenance", handleMaintenance);
    return () => window.removeEventListener("calishealth:maintenance", handleMaintenance);
  }, [role]);

  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#100923", color: "#fff" }}>
        Loading…
      </div>
    );
  }
  if (status === "guest") {
    return <Navigate to={loginPath(currentPath(location))} replace />;
  }
  if (role === "MEMBER" && maintenanceActive) return <MaintenanceModePage />;
  return children;
}
