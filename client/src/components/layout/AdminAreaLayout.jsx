import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  ThemeProvider,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import api from "../../api/client";
import contentTheme, { CM } from "../../theme-content";
import {
  AccountMenu,
  DRAWER_WIDTH,
  LogoutButton,
  SidebarBrand,
  drawerPaperSx,
  navItemSx,
  topbarSx,
} from "./ContentManagerLayout";

export const ADMIN_PATHS = {
  dashboard: "/admin/dashboard",
  users: "/admin/users",
  notifications: "/admin/notifications",
  storage: "/admin/storage",
  maintenance: "/admin/maintenance",
};

/** Main navigation of the Admin area (same sidebar look as the Content Manager). */
export const ADMIN_LINKS = [
  { to: ADMIN_PATHS.dashboard, label: "Dashboard", icon: DashboardRoundedIcon },
  { to: ADMIN_PATHS.users, label: "Users", icon: PeopleAltRoundedIcon },
  { to: ADMIN_PATHS.notifications, label: "Notifications", icon: NotificationsNoneRoundedIcon },
  { to: ADMIN_PATHS.storage, label: "Media storage & infrastructure", icon: StorageRoundedIcon },
  { to: ADMIN_PATHS.maintenance, label: "Create maintenance schedule", icon: EventAvailableRoundedIcon },
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
        localStorage.setItem(
          "user",
          JSON.stringify({ email: data.email, fullName: data.fullName, role: data.role }),
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

function SidebarContent({ onNavigate }) {
  const { pathname } = useLocation();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <SidebarBrand />
      <List sx={{ pt: 1.5, pb: 1 }} aria-label="Admin menu">
        {ADMIN_LINKS.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <ListItemButton
              key={to}
              component={NavLink}
              to={to}
              onClick={onNavigate}
              selected={active}
              aria-current={active ? "page" : undefined}
              sx={navItemSx(active)}
            >
              <ListItemIcon>
                <Icon sx={{ fontSize: 18 }} />
              </ListItemIcon>
              <ListItemText primary={label} />
            </ListItemButton>
          );
        })}
      </List>
      <Box sx={{ flex: 1 }} />
    </Box>
  );
}

function AdminShell({ user, logout, children }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: CM.bg }}>
      <Box
        component="nav"
        aria-label="Admin menu"
        sx={{ width: { md: DRAWER_WIDTH }, flexShrink: 0 }}
      >
        {isDesktop ? (
          <Drawer variant="permanent" open sx={{ "& .MuiDrawer-paper": drawerPaperSx }}>
            <SidebarContent />
          </Drawer>
        ) : (
          <Drawer
            variant="temporary"
            open={open}
            onClose={() => setOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{ "& .MuiDrawer-paper": drawerPaperSx }}
          >
            <SidebarContent onNavigate={() => setOpen(false)} />
          </Drawer>
        )}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Stack component="header" direction="row" alignItems="center" spacing={1.5} sx={topbarSx}>
          {!isDesktop && (
            <IconButton
              size="small"
              aria-label="Open admin menu"
              onClick={() => setOpen(true)}
              sx={{ border: `1px solid ${CM.border}` }}
            >
              <MenuRoundedIcon sx={{ fontSize: 19 }} />
            </IconButton>
          )}
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Notifications">
            <IconButton
              aria-label="Open notifications"
              onClick={() => navigate(ADMIN_PATHS.notifications)}
              sx={{
                position: "relative",
                width: 34,
                height: 34,
                border: `1px solid ${CM.border}`,
                color: CM.textMuted,
                "&:hover": { color: CM.text, borderColor: CM.borderStrong },
              }}
            >
              <NotificationsNoneRoundedIcon sx={{ fontSize: 19 }} />
              <Box
                sx={{
                  position: "absolute",
                  top: 7,
                  right: 8,
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  bgcolor: CM.pink,
                }}
              />
            </IconButton>
          </Tooltip>
          <AccountMenu user={user} logout={logout} fallbackName="Admin" />
          <LogoutButton logout={logout} />
        </Stack>

        <Box component="main" sx={{ flex: 1, pb: 5 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

export default function AdminAreaLayout() {
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
    <ThemeProvider theme={contentTheme}>
      <CssBaseline />
      {status === "loading" || status === "guest" ? (
        <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: CM.bg }}>
          <CircularProgress size={28} aria-label="Loading" />
        </Box>
      ) : status === "forbidden" ? (
        <ForbiddenState user={user} logout={logout} navigate={navigate} />
      ) : (
        <AdminShell user={user} logout={logout}>
          <Outlet />
        </AdminShell>
      )}
    </ThemeProvider>
  );
}

function ForbiddenState({ user, logout, navigate }) {
  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", px: 3, bgcolor: CM.bg }}>
      <Stack
        spacing={2}
        alignItems="center"
        textAlign="center"
        maxWidth={440}
        sx={{ p: 4, borderRadius: 3, bgcolor: CM.surface, border: `1px solid ${CM.border}` }}
      >
        <ShieldRoundedIcon sx={{ color: CM.pink }} />
        <Typography variant="h5" fontWeight={700}>
          You do not have access
        </Typography>
        <Typography variant="body2" sx={{ color: CM.textMuted }}>
          This area is limited to accounts with the ADMIN role.
          {user?.email ? ` Account ${user.email} is not allowed.` : ""}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={() => navigate("/")}>
            Back to home
          </Button>
          <Button variant="outlined" onClick={logout}>
            Logout
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
