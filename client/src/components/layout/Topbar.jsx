import { useLocation, matchPath } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Box,
  IconButton,
  Avatar,
  Typography,
  InputBase,
  alpha,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import NotificationsNoneRoundedIcon from "@mui/icons-material/NotificationsNoneRounded";

const ROUTE_TITLES = [
  { path: "/", title: "Dashboard" },
  { path: "/library", title: "Thư viện" },
  { path: "/tracking", title: "Theo dõi sức khỏe & tiến trình" },
];

function getPageTitle(pathname) {
  for (const r of ROUTE_TITLES) {
    if (r.path === "/" ? pathname === "/" : pathname.startsWith(r.path)) {
      return r.title;
    }
  }
  return "CalisHealth";
}

export default function Topbar() {
  const { pathname } = useLocation();
  const title = getPageTitle(pathname);

  return (
    <AppBar
      position="fixed"
      sx={{
        left: "var(--sidebar-width)",
        width: `calc(100% - var(--sidebar-width))`,
        height: "var(--header-height)",
      }}
    >
      <Toolbar sx={{ gap: 2 }}>
        {/* Page title */}
        <Typography
          variant="h6"
          sx={{ fontWeight: 600, color: "text.primary", flexShrink: 0 }}
        >
          {title}
        </Typography>

        {/* Search */}
        <Box
          sx={{
            ml: 2,
            display: "flex",
            alignItems: "center",
            backgroundColor: (t) => alpha(t.palette.text.primary, 0.04),
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            px: 1.5,
            py: 0.5,
            width: 320,
          }}
        >
          <SearchRoundedIcon sx={{ color: "text.secondary", mr: 1, fontSize: 20 }} />
          <InputBase
            placeholder="Tìm kiếm..."
            sx={{ flex: 1, fontSize: "0.875rem" }}
          />
        </Box>

        <Box sx={{ flex: 1 }} />

        <IconButton>
          <NotificationsNoneRoundedIcon />
        </IconButton>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar
            sx={{
              width: 36,
              height: 36,
              backgroundColor: "primary.main",
              fontSize: "0.85rem",
              fontWeight: 700,
            }}
          >
            AD
          </Avatar>
          <Box sx={{ display: { xs: "none", sm: "block" } }}>
            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              Admin
            </Typography>
            <Typography variant="caption" color="text.secondary">
              admin@calishealth.vn
            </Typography>
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
