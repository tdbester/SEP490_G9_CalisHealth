import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  CircularProgress,
  CssBaseline,
  ThemeProvider,
  Typography,
} from "@mui/material";
import { createTheme } from "@mui/material/styles";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import SupportAgentRoundedIcon from "@mui/icons-material/SupportAgentRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";import api from "../../api/client";
import NotificationBell from "../notifications/NotificationBell";
import StaffTopbar from "./StaffTopbar";
import StaffSidebar from "./StaffSidebar";
import contentTheme, { CM } from "../../theme-content";
import "../../styles/notification.css";

const adminTheme = createTheme(contentTheme, {
  typography: { fontFamily: "Arial, sans-serif" },
});

export const ADMIN_PATHS = {
  dashboard: "/admin/dashboard",
  users: "/admin/users",
  surveys: "/admin/surveys",
  notifications: "/admin/notifications",
  storage: "/admin/storage",
  maintenance: "/admin/maintenance",
  profile: "/admin/profile",
  feedback: "/admin/feedback",
};

/** Main navigation of the Admin area. */
export const ADMIN_LINKS = [
  { to: ADMIN_PATHS.dashboard, label: "Dashboard", labelKey: "nav.dashboard", icon: DashboardRoundedIcon },
  { to: ADMIN_PATHS.users, label: "Users", labelKey: "nav.users", icon: PeopleAltRoundedIcon },
  { to: ADMIN_PATHS.surveys, label: "Survey Management", labelKey: "nav.survey", icon: MenuBookRoundedIcon },
  { to: ADMIN_PATHS.notifications, label: "Notifications", labelKey: "nav.notifications_admin", icon: NotificationsNoneRoundedIcon },
  { to: ADMIN_PATHS.storage, label: "Storage", labelKey: "admin.maintenance.storage", icon: StorageRoundedIcon },
  { to: ADMIN_PATHS.maintenance, label: "Maintenance schedules", labelKey: "nav.maintenance", icon: BuildRoundedIcon },
  { to: ADMIN_PATHS.feedback, label: "Feedback", labelKey: "admin.feedback.navLabel", icon: SupportAgentRoundedIcon },
];

/**
 * Reads /auth/me to validate the token and the role.
 * - guest: no token / broken token -> redirect to /login?returnTo=...
 * - forbidden: signed in but not an ADMIN
 */
function useAdminGuard() {
  const [status, setStatus] = useState("loading");
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      setStatus("guest");
      return undefined;
    }

    let cancelled = false;
    api
      .get("/auth/me")
      .then(({ data }) => {
        if (cancelled) return;
        setUser(data);
        let cachedAvatar = null;
        try {
          cachedAvatar = JSON.parse(localStorage.getItem("user") || "null")?.avatarUrl || null;
        } catch {
          // Ignore malformed cached account data.
        }
        localStorage.setItem(
          "user",
          JSON.stringify({
            email: data.email,
            fullName: data.fullName,
            role: data.role,
            avatarUrl: data.avatarUrl || cachedAvatar,
          }),
        );
        setStatus(data?.role === "ADMIN" ? "allowed" : "forbidden");
      })
      .catch(() => {
        if (!cancelled) setStatus("guest");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { status, user };
}

function AdminShell({ user, children }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminMaintenanceActive, setAdminMaintenanceActive] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;
    const loadMaintenanceStatus = async () => {
      try {
        const { data } = await api.get("/admin/maintenance-schedules/service-status", {
          params: { serviceKey: "ADMIN_MANAGEMENT_PORTAL" },
        });
        if (!cancelled) {
          setAdminMaintenanceActive(data?.ADMIN_MANAGEMENT_PORTAL === true);
        }
      } catch {
        // The maintenance banner is optional; a status API failure must not interrupt Admin navigation.
      }
    };

    loadMaintenanceStatus();
    const intervalId = window.setInterval(loadMaintenanceStatus, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="staff-layout">
      <StaffTopbar
        roleLabel={t("common.ui.adminLabel")}
        roleIcon={<ShieldRoundedIcon sx={{ fontSize: "15px !important" }} />}
        user={user}
        showDate
        onOpenMenu={() => setMenuOpen(true)}
        profilePath={ADMIN_PATHS.profile}
        bell={
          <NotificationBell apiClient={api} ariaLabel={t("common.ui.openNotifications")} />
        }
      />

      {menuOpen ? (
        <button
          type="button"
          className="staff-scrim"
          aria-label={t("common.ui.close")}
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <StaffSidebar
        links={ADMIN_LINKS}
        open={menuOpen}
        onNavigate={() => setMenuOpen(false)}
      />

      <main className="staff-content">
        {adminMaintenanceActive ? (
          <Alert
            icon={<WarningAmberRoundedIcon fontSize="inherit" />}
            severity="warning"
            sx={{
              mb: 2,
              bgcolor: "rgba(245, 158, 11, 0.14)",
              color: "#fde68a",
              border: "1px solid rgba(245, 158, 11, 0.4)",
              "& .MuiAlert-icon": { color: "#fbbf24" },
            }}
          >
            {t("admin.maintenance.adminPortalMaintenanceBanner")}
          </Alert>
        ) : null}

        {children}
      </main>
    </div>
  );
}

export default function AdminAreaLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { status, user } = useAdminGuard();

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  useEffect(() => {
    if (status !== "guest") return;
    const returnTo = `${location.pathname}${location.search}`;
    navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
  }, [status, navigate, location.pathname, location.search]);

  return (
    <ThemeProvider theme={adminTheme}>
      <CssBaseline />
      {status === "loading" || status === "guest" ? (
        <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: CM.bg }}>
          <CircularProgress size={28} aria-label={t("common.ui.loadingAria")} />
        </Box>
      ) : status === "forbidden" ? (
        <ForbiddenState user={user} logout={logout} navigate={navigate} />
      ) : (
        <AdminShell user={user}>
          <Outlet />
        </AdminShell>
      )}
    </ThemeProvider>
  );
}

function ForbiddenState({ user, logout, navigate }) {
  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", px: 3, bgcolor: CM.bg }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          alignItems: "center",
          textAlign: "center",
          maxWidth: 440,
          p: 4,
          borderRadius: 3,
          bgcolor: CM.surface,
          border: `1px solid ${CM.border}`,
        }}
      >
        <ShieldRoundedIcon sx={{ color: CM.pink }} />
        <Typography variant="h5" fontWeight={700}>
          You do not have access
        </Typography>
        <Typography variant="body2" sx={{ color: CM.textMuted }}>
          This area is limited to accounts with the ADMIN role.
          {user?.email ? ` Account ${user.email} is not allowed.` : ""}
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <button type="button" className="staff-logout-btn" onClick={() => navigate("/")}>
            Back to home
          </button>
          <button type="button" className="staff-logout-btn" onClick={logout}>
            Logout
          </button>
        </Box>
      </Box>
    </Box>
  );
}
