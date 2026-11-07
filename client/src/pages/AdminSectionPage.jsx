import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { AD } from "../theme-admin";

/** Placeholder for admin sections that have no design yet. */
export default function AdminSectionPage({ title }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ p: { xs: 2, md: 3.5 } }}>
      <Typography component="h1" sx={{ fontSize: 34, fontWeight: 700, color: "#fff" }}>
        {title}
      </Typography>
      <Typography sx={{ mt: 0.5, fontSize: 14, color: AD.muted }}>
        {t("common.comingSoon")}
      </Typography>
    </Box>
  );
}
