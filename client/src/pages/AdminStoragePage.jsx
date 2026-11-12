import { Link as RouterLink, Outlet, useLocation } from "react-router-dom";
import { Box, Tab, Tabs, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { CM } from "../theme-content";
import { STORAGE_PATHS } from "./storage/StorageShared";

const TABS = [
  { value: STORAGE_PATHS.capacity, labelKey: "tabs.capacity" },
  { value: STORAGE_PATHS.cleanup, labelKey: "tabs.cleanup" },
  { value: STORAGE_PATHS.settings, labelKey: "tabs.settings" },
];

/** Admin > Storage: shared header + tab bar, each tab is a child route. */
export default function AdminStoragePage() {
  const { t } = useTranslation("storage");
  const { pathname } = useLocation();
  const current = TABS.find((t2) => t2.value !== STORAGE_PATHS.capacity && pathname.startsWith(t2.value))?.value
    ?? STORAGE_PATHS.capacity;

  return (
    <Box sx={{ p: { xs: 2, md: 3.5 } }}>
      <Typography sx={{ fontSize: 13, color: CM.textMuted }}>{t("breadcrumb")}</Typography>
      <Typography component="h1" sx={{ mt: 1, fontSize: 34, fontWeight: 700, lineHeight: 1.2 }}>
        {t("title")}
      </Typography>
      <Typography sx={{ mt: 0.75, fontSize: 14, color: CM.textMuted, maxWidth: 720 }}>
        {t("subtitle")}
      </Typography>

      <Tabs
        value={current}
        aria-label="Media storage sections"
        variant="scrollable"
        scrollButtons={false}
        sx={{ mt: 2.5, mb: 3, borderBottom: `1px solid ${CM.border}` }}
      >
        {TABS.map((tab) => (
          <Tab key={tab.value} value={tab.value} label={t(tab.labelKey)} component={RouterLink} to={tab.value} />
        ))}
      </Tabs>

      <Outlet />
    </Box>
  );
}
