import { useEffect, useState } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import FitnessCenterRoundedIcon from "@mui/icons-material/FitnessCenterRounded";
import MonitorHeartOutlinedIcon from "@mui/icons-material/MonitorHeartOutlined";
import ActivityTrendChart from "../components/admin/ActivityTrendChart";
import { AD } from "../theme-admin";
import { TREND_DATA, TREND_RANGES } from "../data/adminDashboardMock";
import { adminDashboardApi } from "../api/adminDashboard";

const fmt = (n) => Number(n || 0).toLocaleString("en-US");

function StatCard({ label, value, icon: Icon }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2.5,
        p: 2.4,
        minHeight: 102,
        borderRadius: "20px",
        bgcolor: AD.card,
        border: `1px solid ${AD.cardBorder}`,
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          borderRadius: "16px",
          bgcolor: AD.iconBox,
          color: AD.navText,
        }}
      >
        <Icon sx={{ fontSize: 26 }} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 13.5, color: "#fff", fontWeight: 500 }} noWrap>
          {label}
        </Typography>
        <Typography sx={{ fontSize: 28, lineHeight: 1.25, color: "#fff", fontWeight: 700 }}>
          {fmt(value)}
        </Typography>
      </Box>
    </Box>
  );
}

function RangeToggle({ value, onChange }) {
  const { t } = useTranslation();
  return (
    <Box
      role="group"
      aria-label={t("admin.dashboard.timeRange")}
      sx={{
        display: "inline-flex",
        p: "4px",
        borderRadius: "12px",
        bgcolor: AD.toggleBg,
        border: `1px solid ${AD.toggleBorder}`,
      }}
    >
      {TREND_RANGES.map(({ key }) => {
        const active = key === value;
        return (
          <Box
            key={key}
            component="button"
            type="button"
            aria-pressed={active}
            onClick={() => onChange(key)}
            sx={{
              border: 0,
              cursor: "pointer",
              px: 1.75,
              py: 0.9,
              borderRadius: "9px",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "inherit",
              color: active ? "#fff" : AD.navText,
              bgcolor: active ? AD.toggleActive : "transparent",
              "&:hover": { color: "#fff" },
              "&:focus-visible": { outline: `2px solid ${AD.accent}`, outlineOffset: 1 },
            }}
          >
            {t(`admin.dashboard.range${key === "30d" ? "30d" : key === "6m" ? "6m" : "1y"}`)}
          </Box>
        );
      })}
    </Box>
  );
}

/** Admin dashboard: system overview cards + user activity trend (Figma 704:348). */
export default function AdminDashboard() {
  const { t } = useTranslation();
  const [range, setRange] = useState("30d");
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSkillExercises: 0,
    totalHealthExercises: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = `${t("admin.dashboard.pageTitle")} | CalisHealth`;
  }, [t]);

  // Số liệu thật từ API: User Management + System Exercise + System Workout.
  useEffect(() => {
    let cancelled = false;
    adminDashboardApi
      .overview()
      .then((data) => {
        if (cancelled) return;
        setStats({
          totalUsers: data?.totalUsers ?? 0,
          totalSkillExercises: data?.totalSkillExercises ?? 0,
          totalHealthExercises: data?.totalHealthExercises ?? 0,
        });
      })
      .catch(() => {
        // Giữ 0 khi API không sẵn sàng, tránh hiển thị số giả.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Box sx={{ p: { xs: 2, md: 3.5 } }}>
      <Typography component="h1" sx={{ fontSize: 34, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
        {t("admin.dashboard.title")}
      </Typography>
      <Typography sx={{ mt: 0.5, mb: 3.5, fontSize: 14, color: AD.muted }}>
        {t("admin.dashboard.systemOverview")}
      </Typography>

      <Box
        sx={{
          display: "grid",
          gap: 2.25,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
        }}
      >
        <StatCard label={t("admin.dashboard.totalUsers")} value={stats.totalUsers} icon={PeopleAltOutlinedIcon} />
        <StatCard label={t("admin.dashboard.totalSkillExercises")} value={stats.totalSkillExercises} icon={FitnessCenterRoundedIcon} />
        <StatCard label={t("admin.dashboard.totalHealthExercises")} value={stats.totalHealthExercises} icon={MonitorHeartOutlinedIcon} />

        {loading ? (
          <Box sx={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center", py: 1 }}>
            <CircularProgress size={20} aria-label={t("common.ui.loadingAria")} />
          </Box>
        ) : null}
      </Box>

      <Box
        component="section"
        aria-labelledby="activity-trend-title"
        sx={{
          mt: 3,
          p: 2.6,
          borderRadius: "20px",
          bgcolor: AD.chartCard,
          border: `1px solid ${AD.cardBorder}`,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
            mb: 2,
          }}
        >
          <Box>
            <Typography id="activity-trend-title" component="h2" sx={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
              {t("admin.dashboard.activityTrend")}
            </Typography>
            <Typography sx={{ mt: 0.5, fontSize: 13, color: AD.muted }}>
              {t(`admin.dashboard.subtitle${range === "30d" ? "30d" : range === "6m" ? "6m" : "1y"}`)}
            </Typography>
          </Box>
          <RangeToggle value={range} onChange={setRange} />
        </Box>

        <ActivityTrendChart points={TREND_DATA[range]} />
      </Box>
    </Box>
  );
}
