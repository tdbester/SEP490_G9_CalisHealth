import { Link as RouterLink, Outlet, useLocation } from "react-router-dom";
import { Box, Tab, Tabs, Typography } from "@mui/material";
import { CM } from "../theme-content";
import { STORAGE_PATHS } from "./storage/StorageShared";

const TABS = [
  { value: STORAGE_PATHS.capacity, label: "Capacity" },
  { value: STORAGE_PATHS.cleanup, label: "Cleanup" },
  { value: STORAGE_PATHS.settings, label: "Upload limits" },
];

/** Admin > Media storage & infrastructure: shared header + tab bar, each tab is a child route. */
export default function AdminStoragePage() {
  const { pathname } = useLocation();
  const current = TABS.find((t) => t.value !== STORAGE_PATHS.capacity && pathname.startsWith(t.value))?.value
    ?? STORAGE_PATHS.capacity;

  return (
    <Box sx={{ p: { xs: 2, md: 3.5 } }}>
      <Typography sx={{ fontSize: 13, color: CM.textMuted }}>Admin / Media storage</Typography>
      <Typography component="h1" sx={{ mt: 1, fontSize: 34, fontWeight: 700, lineHeight: 1.2 }}>
        Media storage & infrastructure
      </Typography>
      <Typography sx={{ mt: 0.75, fontSize: 14, color: CM.textMuted, maxWidth: 720 }}>
        Monitor storage usage, clean up inactive media and configure upload limits.
      </Typography>

      <Tabs
        value={current}
        aria-label="Media storage sections"
        variant="scrollable"
        scrollButtons={false}
        sx={{ mt: 2.5, mb: 3, borderBottom: `1px solid ${CM.border}` }}
      >
        {TABS.map((t) => (
          <Tab key={t.value} value={t.value} label={t.label} component={RouterLink} to={t.value} />
        ))}
      </Tabs>

      <Outlet />
    </Box>
  );
}
