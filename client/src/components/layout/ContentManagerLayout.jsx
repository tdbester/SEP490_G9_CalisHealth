import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  ThemeProvider,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import FitnessCenterRoundedIcon from "@mui/icons-material/FitnessCenterRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import RuleRoundedIcon from "@mui/icons-material/RuleRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import contentApi from "../../api/contentManager";
import { CONTENT_PATHS } from "../ContentShared";
import contentTheme, { CM } from "../../theme-content";

export const DRAWER_WIDTH = 248;

/** Main navigation of the Content Manager area. */
export const CONTENT_LINKS = [
  { to: CONTENT_PATHS.dashboard, label: "Dashboard", icon: DashboardRoundedIcon },
  { to: CONTENT_PATHS.surveys, label: "Survey Management", icon: MenuBookRoundedIcon },
  { to: CONTENT_PATHS.exercises, label: "Exercise & Workout", icon: FitnessCenterRoundedIcon },
  { to: CONTENT_PATHS.progressionRules, label: "Progression Rules", icon: TrendingUpRoundedIcon },
  { to: CONTENT_PATHS.levelCriteria, label: "Level Criteria", icon: RuleRoundedIcon },
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
        localStorage.setItem(
          "user",
          JSON.stringify({ email: data.email, fullName: data.fullName, role: data.role }),
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

export const drawerPaperSx = {
  width: DRAWER_WIDTH,
  bgcolor: CM.sidebar,
  backgroundImage: "linear-gradient(180deg, #170D31 0%, #130A27 45%, #120823 100%)",
  color: CM.text,
  borderRight: `1px solid ${CM.sidebarBorder}`,
  "& .MuiDivider-root": { borderColor: CM.sidebarBorder },
};

export function navItemSx(active) {
  return {
    borderRadius: 10,
    mx: 1.5,
    mb: 0.5,
    py: 1,
    px: 1.5,
    color: active ? CM.text : CM.textMuted,
    bgcolor: active ? "rgba(139,92,246,0.18)" : "transparent",
    boxShadow: active ? "inset 0 0 0 1px rgba(167,139,250,0.35)" : "none",
    "& .MuiListItemIcon-root": { color: active ? CM.violetBright : CM.textDim, minWidth: 34 },
    "& .MuiListItemText-primary": {
      color: "inherit",
      fontSize: 13.5,
      fontWeight: active ? 600 : 500,
    },
    "&:hover": { bgcolor: "rgba(139,92,246,0.12)", color: CM.text },
    "&:hover .MuiListItemIcon-root": { color: CM.violetBright },
    "&.Mui-selected": { bgcolor: "rgba(139,92,246,0.18)", color: CM.text },
    "&.Mui-selected:hover": { bgcolor: "rgba(139,92,246,0.24)" },
  };
}

function BrandMark() {
  return (
    <Box sx={{ width: 32, height: 32, display: "grid", placeItems: "center", flexShrink: 0 }}>
      <svg width="12" height="18" viewBox="0 0 12 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5.6316 0C6.7146 4.332 11.0466 6.498 11.0466 11.913C11.0466 13.3491 10.4761 14.7265 9.46058 15.742C8.44507 16.7575 7.06775 17.328 5.6316 17.328C4.19545 17.328 2.81812 16.7575 1.80262 15.742C0.787106 14.7265 0.216599 13.3491 0.216599 11.913C0.216599 9.747 1.2996 8.664 2.3826 7.581C2.3826 9.747 3.4656 10.83 4.5486 10.83C4.5486 6.498 3.4656 4.332 5.6316 0Z" fill="url(#content-logo-gradient)" />
        <path d="M0.758101 12.996H3.4656L4.8735 10.2885L6.9312 15.7035L8.3391 12.996H10.5051" strokeWidth="1.5162" strokeLinecap="round" strokeLinejoin="round" stroke="white" />
        <defs>
          <linearGradient id="content-logo-gradient" x1="2.3826" y1="0" x2="14.1558" y2="12.2638" gradientUnits="userSpaceOnUse">
            <stop stopColor="#B44CFF" />
            <stop offset="1" stopColor="#FF77A8" />
          </linearGradient>
        </defs>
      </svg>
    </Box>
  );
}

/** Logo + "CalisHealth" header of the sidebar, shared by Content Manager and Admin. */
export function SidebarBrand() {
  return (
    <>
      <Toolbar sx={{ px: 2.5, gap: 1.25, minHeight: "66px !important" }}>
        <BrandMark />
        <Typography variant="subtitle1" fontWeight={800} letterSpacing={-0.4} color="#fff">
          Calis
          <Box
            component="span"
            sx={{
              backgroundImage: CM.gradient,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Health
          </Box>
        </Typography>
      </Toolbar>
      <Divider />
    </>
  );
}

function SidebarContent({ onNavigate }) {
  const { pathname } = useLocation();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <SidebarBrand />

      <List sx={{ pt: 1.5, pb: 1 }} aria-label="Content manager menu">
        {CONTENT_LINKS.map(({ to, label, icon: Icon }) => {
          const active =
            to === CONTENT_PATHS.dashboard ? pathname === to : pathname.startsWith(to);
          return (
            <ListItemButton
              key={to}
              component={NavLink}
              to={to}
              onClick={onNavigate}
              selected={active}
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

/** Same avatar treatment as the member top bar: gradient circle with initials. */
export function AccountMenu({ user, logout, fallbackName = "Content Manager" }) {
  const [anchor, setAnchor] = useState(null);
  const initials =
    user?.fullName
      ?.split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "HV";

  return (
    <>
      <Tooltip title={user?.fullName || "Account"}>
        <button
          type="button"
          aria-label="Open account menu"
          aria-expanded={Boolean(anchor)}
          onClick={(event) => setAnchor(event.currentTarget)}
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%)",
            border: "1px solid #3B2A6B",
            color: "#FFFFFF",
            fontSize: 12.5,
            fontWeight: 700,
            letterSpacing: "0.02em",
            cursor: "pointer",
            userSelect: "none",
            padding: 0,
            flexShrink: 0,
          }}
        >
          {initials}
        </button>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ px: 2, py: 1, minWidth: 200 }}>
          <Typography variant="body2" fontWeight={700} sx={{ color: "#fff" }} noWrap>
            {user?.fullName || fallbackName}
          </Typography>
          <Typography variant="caption" sx={{ color: CM.textDim }} noWrap display="block">
            {user?.email || ""}
          </Typography>
        </Box>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={() => setAnchor(null)}>
          <PersonOutlineRoundedIcon sx={{ fontSize: 17, mr: 1.25, color: CM.textDim }} />
          Profile
        </MenuItem>
        <MenuItem onClick={logout}>
          <LogoutRoundedIcon sx={{ fontSize: 17, mr: 1.25, color: CM.textDim }} />
          Logout
        </MenuItem>
      </Menu>
    </>
  );
}

/** Sticky top bar style shared by Content Manager and Admin. */
export const topbarSx = {
  minHeight: 66,
  px: { xs: 1.5, sm: 3 },
  borderBottom: `1px solid ${CM.border}`,
  backgroundColor: "rgba(21,12,43,0.86)",
  backdropFilter: "blur(14px)",
  position: "sticky",
  top: 0,
  zIndex: 10,
};

export function LogoutButton({ logout }) {
  return (
    <Button
      size="small"
      variant="outlined"
      startIcon={<LogoutRoundedIcon sx={{ fontSize: 16 }} />}
      onClick={logout}
      sx={{ py: 0.5, px: 1.5, fontSize: 12.5, borderRadius: "12px" }}
    >
      Logout
    </Button>
  );
}

function ContentShell({ user, logout, children }) {
  const theme = useTheme();
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
        aria-label="Content manager menu"
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
        <Stack
          component="header"
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={topbarSx}
        >
          {!isDesktop && (
            <IconButton
              size="small"
              aria-label="Open Content Manager menu"
              onClick={() => setOpen(true)}
              sx={{ border: `1px solid ${CM.border}` }}
            >
              <MenuRoundedIcon sx={{ fontSize: 19 }} />
            </IconButton>
          )}

          <Box sx={{ flex: 1 }} />

          <Tooltip title="Notifications">
            <Box
              sx={{
                position: "relative",
                width: 34,
                height: 34,
                display: "grid",
                placeItems: "center",
                borderRadius: "50%",
                border: `1px solid ${CM.border}`,
                color: CM.textMuted,
                cursor: "pointer",
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
            </Box>
          </Tooltip>

          <AccountMenu user={user} logout={logout} />

          <LogoutButton logout={logout} />
        </Stack>

        <Box component="main" sx={{ flex: 1, pb: 5 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

export default function ContentManagerLayout() {
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
          <CircularProgress size={28} aria-label="Loading" />
        </Box>
      ) : status === "forbidden" ? (
        <ForbiddenState user={user} logout={logout} navigate={navigate} />
      ) : (
        <ContentShell user={user} logout={logout}>
          <Outlet />
        </ContentShell>
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
