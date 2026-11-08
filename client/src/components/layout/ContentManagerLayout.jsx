import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  CircularProgress,
  CssBaseline,
  ThemeProvider,
  Typography,
} from "@mui/material";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import FitnessCenterRoundedIcon from "@mui/icons-material/FitnessCenterRounded";
import EventNoteRoundedIcon from "@mui/icons-material/EventNoteRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import RuleRoundedIcon from "@mui/icons-material/RuleRounded";
import SupportAgentRoundedIcon from "@mui/icons-material/SupportAgentRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import contentApi from "../../api/contentManager";
import NotificationBell from "../notifications/NotificationBell";
import StaffTopbar from "./StaffTopbar";
import StaffSidebar from "./StaffSidebar";
import { CONTENT_PATHS } from "../ContentShared";
import contentTheme, { CM } from "../../theme-content";

/** Main navigation of the Content Manager area. */
export const CONTENT_LINKS = [
  { to: CONTENT_PATHS.dashboard, label: "Dashboard", labelKey: "nav.dashboard", icon: DashboardRoundedIcon },
  { to: CONTENT_PATHS.exercises, label: "Exercise & Workout", labelKey: "nav.exercises", icon: FitnessCenterRoundedIcon },
  { to: CONTENT_PATHS.templates, label: "Daily Training Plans", labelKey: "nav.dailyTrainingPlans", icon: EventNoteRoundedIcon },
  { to: CONTENT_PATHS.progressionRules, label: "Progression Rules", labelKey: "nav.progressionRules", icon: TrendingUpRoundedIcon },
  { to: CONTENT_PATHS.levelCriteria, label: "Level Criteria", labelKey: "nav.levelCriteria", icon: RuleRoundedIcon },
  { to: CONTENT_PATHS.feedback, label: "Feedback & Complaints", labelKey: "nav.feedback", icon: SupportAgentRoundedIcon },
];

/**
 * Reads /auth/me to validate the token and the role.
 * - guest: no token / broken token -> redirect to /login?returnTo=...
 * - forbidden: signed in but not a CONTENT_MANAGER
 */
function useContentManagerGuard() {
  const [status, setStatus] = useState("loading");
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      setStatus("guest");
      return undefined;
    }

    const cached = localStorage.getItem("user");
    if (cached) {
      try {
        setUser(JSON.parse(cached));
      } catch {
        // ignore a broken cache entry
      }
    }

    let cancelled = false;
    contentApi
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
        setStatus(data?.role === "CONTENT_MANAGER" ? "allowed" : "forbidden");
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

function ContentShell({ user, children }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="staff-layout">
      <StaffTopbar
        roleLabel={t("common.ui.contentManagerLabel")}
        roleIcon={<ShieldRoundedIcon sx={{ fontSize: "15px !important" }} />}
        user={user}
        onOpenMenu={() => setMenuOpen(true)}
        profilePath={CONTENT_PATHS.profile}
        bell={<NotificationBell apiClient={contentApi} />}
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
        links={CONTENT_LINKS}
        open={menuOpen}
        onNavigate={() => setMenuOpen(false)}
      />

      <main className="staff-content">{children}</main>
    </div>
  );
}

export default function ContentManagerLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { status, user } = useContentManagerGuard();

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
    <ThemeProvider theme={contentTheme}>
      <CssBaseline />
      {status === "loading" || status === "guest" ? (
        <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: CM.bg }}>
          <CircularProgress size={28} aria-label={t("common.ui.loadingAria")} />
        </Box>
      ) : status === "forbidden" ? (
        <ForbiddenState user={user} logout={logout} navigate={navigate} />
      ) : (
        <ContentShell user={user}>
          <Outlet />
        </ContentShell>
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
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: 2,
            display: "grid",
            placeItems: "center",
            bgcolor: "rgba(255,119,153,0.14)",
            color: CM.pink,
          }}
        >
          <ShieldRoundedIcon />
        </Box>
        <Typography variant="h5" fontWeight={700}>
          You do not have access
        </Typography>
        <Typography variant="body2" sx={{ color: CM.textMuted }}>
          This area is limited to accounts with the CONTENT_MANAGER role.
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
