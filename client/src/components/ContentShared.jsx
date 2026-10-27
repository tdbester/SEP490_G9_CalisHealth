import { Link as RouterLink } from "react-router-dom";
import { Box, Breadcrumbs, Link, Stack, Typography, Chip } from "@mui/material";
import NavigateNextRoundedIcon from "@mui/icons-material/NavigateNextRounded";
import { CM } from "../theme-content";

export function PageBreadcrumb({ items }) {
  return (
    <Breadcrumbs
      separator={<NavigateNextRoundedIcon sx={{ fontSize: 13, color: CM.textDim }} />}
      aria-label="breadcrumb"
      sx={{ "& .MuiBreadcrumbs-separator": { mx: 0.6 } }}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return isLast || !item.to ? (
          <Typography
            key={item.label}
            variant="caption"
            sx={{
              color: isLast ? CM.violetBright : CM.textDim,
              fontWeight: isLast ? 600 : 500,
              letterSpacing: "0.01em",
            }}
          >
            {item.label}
          </Typography>
        ) : (
          <Link
            key={item.label}
            component={RouterLink}
            to={item.to}
            variant="caption"
            underline="none"
            sx={{ color: CM.textDim, "&:hover": { color: CM.violetBright } }}
          >
            {item.label}
          </Link>
        );
      })}
    </Breadcrumbs>
  );
}

export function ContentPageHeader({ breadcrumb, title, description, action }) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      alignItems={{ xs: "flex-start", sm: "flex-end" }}
      justifyContent="space-between"
    >
      <Box sx={{ minWidth: 0 }}>
        {breadcrumb && <PageBreadcrumb items={breadcrumb} />}
        <Typography
          variant="h3"
          component="h1"
          sx={{
            mt: 1,
            fontSize: { xs: "1.45rem", sm: "1.6rem" },
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "#fff",
          }}
        >
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" sx={{ mt: 0.5, color: CM.textMuted }}>
            {description}
          </Typography>
        )}
      </Box>
      {action}
    </Stack>
  );
}

const TONE = {
  primary: { dot: CM.violetBright, glow: "rgba(139,92,246,0.28)" },
  success: { dot: CM.green, glow: "rgba(120,232,136,0.22)" },
  error: { dot: CM.pink, glow: "rgba(255,119,153,0.22)" },
  warning: { dot: CM.amber, glow: "rgba(248,200,88,0.22)" },
};

/** Summary count card used at the top of exercise and workout lists. */
export function SummaryCard({ label, count, detail, tone = "primary" }) {
  const colors = TONE[tone] ?? TONE.primary;
  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        border: `1px solid ${CM.border}`,
        borderRadius: "14px",
        bgcolor: CM.surface,
        backgroundImage: `radial-gradient(120px 80px at 100% 0%, ${colors.glow}, transparent 70%)`,
        px: 2,
        py: 1.75,
        transition: "border-color .16s ease, transform .16s ease",
        "&:hover": { borderColor: CM.borderStrong, transform: "translateY(-1px)" },
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            bgcolor: colors.dot,
            flexShrink: 0,
            boxShadow: `0 0 12px ${colors.dot}`,
          }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{ color: CM.textDim, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, fontSize: 10 }}
          >
            {label}
          </Typography>
          <Typography variant="body2" fontWeight={700} noWrap sx={{ color: "#fff", fontSize: 14.5 }}>
            {count} {detail}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}

/** Pill dùng cho các nhãn nhỏ (type, level...) trong bảng tối. */
export function DarkPill({ children, tone = "primary", icon, sx }) {
  const map = {
    primary: { color: "#C4B5FD", bg: "rgba(139,92,246,0.18)", border: "rgba(167,139,250,0.38)" },
    success: { color: "#86EFAC", bg: "rgba(120,232,136,0.14)", border: "rgba(120,232,136,0.34)" },
    warning: { color: "#FCD34D", bg: "rgba(248,200,88,0.14)", border: "rgba(248,200,88,0.34)" },
    danger: { color: "#FDA4AF", bg: "rgba(255,119,153,0.14)", border: "rgba(255,119,153,0.34)" },
    neutral: { color: CM.textMuted, bg: "rgba(168,155,208,0.12)", border: "rgba(168,155,208,0.26)" },
  };
  const c = map[tone] ?? map.primary;
  return (
    <Chip
      size="small"
      label={children}
      icon={icon}
      sx={{
        height: 22,
        fontSize: 11,
        fontWeight: 600,
        color: c.color,
        bgcolor: c.bg,
        border: `1px solid ${c.border}`,
        "& .MuiChip-icon": { color: c.color, fontSize: 13, ml: 0.75 },
        ...sx,
      }}
    />
  );
}

export function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

export const CONTENT_PATHS = {
  dashboard: "/content/dashboard",
  surveys: "/content/surveys",
  exercises: "/content/exercises",
  progressionRules: "/content/progression-rules",
  levelCriteria: "/content/level-criteria",
  pendingExerciseModeration: "/content/exercises/pending-moderation",
  exerciseApprovalHistory: "/content/exercises/approval-history",
  workouts: "/content/workouts",
  create: "/content/create",
};
