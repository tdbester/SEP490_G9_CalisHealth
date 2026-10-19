import { useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Chip,
  Divider,
} from "@mui/material";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import LocalLibraryRoundedIcon from "@mui/icons-material/LocalLibraryRounded";
import MonitorHeartRoundedIcon from "@mui/icons-material/MonitorHeartRounded";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/", icon: <DashboardRoundedIcon />, badge: null },
  { label: "Library", path: "/library", icon: <LocalLibraryRoundedIcon />, badge: null },
  {
    label: "Tracking health & progress",
    path: "/tracking",
    icon: <MonitorHeartRoundedIcon />,
    badge: 8,
  },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <Box
      component="aside"
      sx={{
        width: "var(--sidebar-width)",
        minHeight: "100vh",
        backgroundColor: "background.paper",
        borderRight: "1px solid",
        borderColor: "divider",
        position: "fixed",
        top: 0,
        left: 0,
        display: "flex",
        flexDirection: "column",
        zIndex: 1200,
      }}
    >
      {/* Brand */}
      <Box sx={{ px: 3, py: 3 }}>
        <Typography
          variant="h5"
          sx={{ fontWeight: 800, color: "primary.main", lineHeight: 1.1 }}
        >
          CalisHealth
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Quản lý nội dung hệ thống
        </Typography>
      </Box>

      <Divider />

      {/* Nav */}
      <List sx={{ flex: 1, py: 2 }}>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === "/"
              ? pathname === "/"
              : pathname.startsWith(item.path);
          return (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                selected={isActive}
                onClick={() => navigate(item.path)}
              >
                <ListItemIcon sx={{ minWidth: 36, color: "text.secondary" }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: "0.9rem",
                    fontWeight: isActive ? 600 : 500,
                  }}
                />
                {item.badge != null && (
                  <Chip
                    label={item.badge}
                    size="small"
                    color="primary"
                    sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700 }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* Footer hint */}
      <Box sx={{ p: 2, borderTop: "1px solid", borderColor: "divider" }}>
        <Typography variant="caption" color="text.secondary">
          v0.1.0 · CalisHealth
        </Typography>
      </Box>
    </Box>
  );
}
