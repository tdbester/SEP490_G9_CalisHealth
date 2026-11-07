import { useEffect, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { Alert, Box, Button, Card, CircularProgress, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import EventNoteRoundedIcon from "@mui/icons-material/EventNoteRounded";
import FitnessCenterRoundedIcon from "@mui/icons-material/FitnessCenterRounded";
import SignalCellularAltRoundedIcon from "@mui/icons-material/SignalCellularAltRounded";
import { contentManagerApi } from "../api/contentManager";
import { useApiQuery } from "../hooks";
import { useLevelNames } from "../useLevelNames";
import { CONTENT_PATHS, ContentPageHeader, DarkPill, formatDateTime } from "../components/ContentShared";
import { StatusDot } from "./DailyPlanTemplateListPage";
import { CM } from "../theme-content";

function InfoCard({ icon: Icon, label, children }) {
  return (
    <Box sx={{ p: 1.75, minHeight: 96, border: `1px solid ${CM.border}`, borderRadius: "14px", bgcolor: CM.surface, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0.75, textAlign: "center" }}>
      <Stack direction="row" spacing={0.75} alignItems="center">
        <Icon sx={{ fontSize: 15, color: CM.violetBright }} aria-hidden />
        <Typography variant="caption" sx={{ color: CM.textDim, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 10.5 }}>{label}</Typography>
      </Stack>
      {children}
    </Box>
  );
}

export default function DailyPlanTemplateDetailPage() {
  const { t } = useTranslation();
  const { code } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const routedSuccess = location.state?.successMessage;
  const [successMessage, setSuccessMessage] = useState(routedSuccess || null);
  const { levelTone } = useLevelNames();
  const { data: plan, isLoading, error, refetch } = useApiQuery(() => contentManagerApi.dailyPlanTemplate(code), { deps: [code] });

  useEffect(() => {
    if (!routedSuccess) return;
    navigate(location.pathname, { replace: true, state: null });
  }, [routedSuccess, navigate, location.pathname]);

  const crumb = [
    { labelKey: "nav.contentManagerRole", to: CONTENT_PATHS.dashboard },
    { labelKey: "nav.dailyTrainingPlans", to: CONTENT_PATHS.templates },
    { labelKey: "nav.planDetails" },
  ];

  if (isLoading) {
    return <Box sx={{ py: 10, display: "grid", placeItems: "center" }}><CircularProgress size={26} /></Box>;
  }
  if (error || !plan) {
    return (
      <Box sx={{ maxWidth: 1080, mx: "auto", px: { xs: 2, sm: 3 }, py: 3 }}>
        <ContentPageHeader breadcrumb={crumb} title={t("contentManager.templates.notFound")} />
        <Alert severity="warning" sx={{ mt: 2 }} action={<Button color="inherit" size="small" onClick={() => refetch()}>{t("contentManager.templates.tryAgain")}</Button>}>
          {error?.message || t("contentManager.templates.notFoundMessage")}
        </Alert>
        <Button component={RouterLink} to={CONTENT_PATHS.templates} sx={{ mt: 2 }} startIcon={<ArrowBackRoundedIcon />}>{t("contentManager.templates.backToPlanList")}</Button>
      </Box>
    );
  }

  const days = plan.days || [];
  const totalExercises = days.reduce((sum, day) => sum + (day.exerciseCount || 0), 0);

  return (
    <Box sx={{ maxWidth: 1080, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2.5, sm: 3 } }}>
      {successMessage && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>{successMessage}</Alert>}
      <ContentPageHeader
        breadcrumb={crumb}
        title={plan.name}
        description={plan.description
          || t("contentManager.templates.updatedMeta", { code: plan.code, date: formatDateTime(plan.updatedAt) })
          + (plan.createdByName ? t("contentManager.templates.updatedBy", { name: plan.createdByName }) : "")}
        action={(
          <Stack direction="row" spacing={1} alignItems="center">
            <Button component={RouterLink} to={`${CONTENT_PATHS.templates}/${encodeURIComponent(plan.code)}/edit`} variant="contained" startIcon={<EditRoundedIcon />}>
              {t("contentManager.templates.editPlan")}
            </Button>
            <Button component={RouterLink} to={CONTENT_PATHS.templates} variant="outlined" startIcon={<ArrowBackRoundedIcon />}>
              {t("contentManager.templates.back")}
            </Button>
          </Stack>
        )}
      />

      <Box sx={{ mt: 2.5, display: "grid", gap: 1.5, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(2, minmax(0, 1fr))" } }}>
        <InfoCard icon={SignalCellularAltRoundedIcon} label={t("contentManager.templates.infoLevel")}><DarkPill tone={levelTone(plan.level)}>{plan.level}</DarkPill></InfoCard>
        <InfoCard icon={EventNoteRoundedIcon} label={t("contentManager.templates.infoDaysPerWeek")}><Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 22 }}>{plan.daysPerWeek}</Typography></InfoCard>
      </Box>

      <Card sx={{ mt: 2.5, overflow: "hidden" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${CM.border}` }}>
          <Box>
            <Typography sx={{ color: "#fff", fontWeight: 700 }}>{t("contentManager.templates.weeklySchedule")}</Typography>
            <Typography variant="caption" sx={{ color: CM.textMuted }}>{t("contentManager.templates.weeklyScheduleMeta", { days: days.length, exercises: totalExercises })}</Typography>
          </Box>
        </Stack>
        <Stack divider={<Box sx={{ borderTop: `1px solid ${CM.border}` }} />}>
          {days.map((day) => (
            <Box key={day.dayNumber} sx={{ display: "grid", gridTemplateColumns: { xs: "72px 1fr", sm: "88px minmax(0, 1fr) minmax(150px, 1fr) 120px 110px 90px" }, alignItems: "center", columnGap: 2, rowGap: 1, px: 2.5, py: 1.5 }}>
              <Typography sx={{ color: CM.violetBright, fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("contentManager.templates.dayLabel", { count: day.dayNumber })}</Typography>
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                <Box className="workout-row-mark" aria-hidden="true" sx={{ width: 32, height: 32, borderRadius: "9px", display: "grid", placeItems: "center", flexShrink: 0, color: "#c4b5fd", bgcolor: "rgba(139,92,246,0.2)", border: "1px solid rgba(167,139,250,0.3)" }}>
                  <FitnessCenterRoundedIcon sx={{ fontSize: 16 }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ color: "#fff", fontWeight: 600 }}>{day.workoutName}</Typography>
                  <Typography variant="caption" sx={{ color: CM.textDim }}>{day.workoutCode}</Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ display: "flex", minWidth: 0, gridColumn: { xs: "2", sm: "auto" }, mt: { xs: 0.5, sm: 0 } }}>
                {(day.targetMuscles || []).length
                  ? day.targetMuscles.map((muscle) => <DarkPill key={muscle} tone="primary">{muscle}</DarkPill>)
                  : <Typography variant="caption" sx={{ color: CM.textDim }}>{t("contentManager.templates.noTargetMuscle")}</Typography>}
              </Stack>
              <Typography variant="body2" sx={{ color: CM.textMuted, textAlign: { sm: "center" }, display: { xs: "none", sm: "block" } }}>{t("contentManager.templates.exercisesCount", { count: day.exerciseCount })}</Typography>
              <Box sx={{ display: { xs: "none", sm: "flex" }, justifyContent: "center" }}><StatusDot active={day.workoutActive} /></Box>
              <Box sx={{ display: { xs: "none", sm: "flex" }, justifyContent: "flex-end" }}>
                <Button
                  component={RouterLink}
                  to={`${CONTENT_PATHS.workouts}/${encodeURIComponent(day.workoutCode)}`}
                  state={{ returnTo: `${CONTENT_PATHS.templates}/${encodeURIComponent(plan.code)}`, returnLabel: t("contentManager.templates.backToDetailsLabel") }}
                  size="small"
                  variant="outlined"
                  sx={{ py: 0.25, px: 1.25, fontSize: 11.5, minWidth: 0, borderRadius: "8px" }}
                >
                  {t("contentManager.templates.view")}
                </Button>
              </Box>
            </Box>
          ))}
          {days.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ py: 5, textAlign: "center" }}>{t("contentManager.templates.noWorkoutsScheduled")}</Typography>}
        </Stack>
      </Card>

      <Button component={RouterLink} to={CONTENT_PATHS.templates} sx={{ mt: 2 }} startIcon={<ArrowBackRoundedIcon />}>{t("contentManager.templates.backToPlanList")}</Button>
    </Box>
  );
}
