import { Link as RouterLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Box, Tab, Tabs } from "@mui/material";
import { CONTENT_PATHS } from "./ContentShared";
import { CM } from "../theme-content";

/**
 * Tab "Exercise List | Workout List" dùng chung cho 2 màn hình danh sách.
 * active: 'exercises' | 'workouts'
 */
export default function ContentListToolbar({ active }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const value = active ?? (pathname.startsWith(CONTENT_PATHS.workouts) ? "workouts" : "exercises");

  return (
    <Box
      sx={{
        border: `1px solid ${CM.border}`,
        borderRadius: "10px",
        bgcolor: "rgba(19,10,39,0.75)",
        px: 0.5,
        minWidth: 0,
      }}
    >
      <Tabs
        value={value}
        aria-label={t("member.toolbar.listsAria")}
        sx={{ minHeight: 38, "& .MuiTab-root": { minHeight: 38, py: 0.5, px: 2, fontSize: 13 } }}
      >
        <Tab
          value="exercises"
          label={t("member.toolbar.exerciseList")}
          component={RouterLink}
          to={CONTENT_PATHS.exercises}
        />
        <Tab
          value="workouts"
          label={t("member.toolbar.workoutList")}
          component={RouterLink}
          to={CONTENT_PATHS.workouts}
        />
      </Tabs>
    </Box>
  );
}
