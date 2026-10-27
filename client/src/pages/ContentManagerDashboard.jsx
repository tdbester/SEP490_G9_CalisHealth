import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Card, CardContent, LinearProgress, Stack, Typography } from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import FitnessCenterRoundedIcon from "@mui/icons-material/FitnessCenterRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import RuleRoundedIcon from "@mui/icons-material/RuleRounded";
import SelfImprovementRoundedIcon from "@mui/icons-material/SelfImprovementRounded";
import { CONTENT_PATHS, ContentPageHeader } from "../components/ContentShared";
import { CM } from "../theme-content";
import { contentManagerApi } from "../api/contentManager";
import { useApiQuery } from "../hooks";

const BREADCRUMB = [{ label: "Content manager" }, { label: "Dashboard" }];

const CARD_TONES = [
  { accent: CM.violetBright, wash: "rgba(167,139,250,0.12)" },
  { accent: CM.green, wash: "rgba(120,232,136,0.10)" },
  { accent: CM.amber, wash: "rgba(248,200,88,0.10)" },
  { accent: CM.pink, wash: "rgba(255,119,153,0.10)" },
];

function ManagementCard({ title, description, to, action, icon: Icon, preview, tone }) {
  return (
    <Card
      sx={{
        height: "100%",
        minHeight: 246,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "transform .18s ease, border-color .18s ease, box-shadow .18s ease",
        "&:hover": {
          transform: "translateY(-3px)",
          borderColor: tone.accent,
          boxShadow: `0 18px 38px rgba(8,3,22,0.42), 0 0 24px ${tone.wash}`,
        },
        "&:focus-within": { borderColor: tone.accent },
      }}
    >
      <CardContent sx={{ p: { xs: 1.75, sm: 2.25 }, display: "flex", flexDirection: "column", gap: 1.25, flex: 1, "&:last-child": { pb: { xs: 1.75, sm: 2.25 } } }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              color: tone.accent,
              bgcolor: tone.wash,
              border: `1px solid ${tone.accent}44`,
            }}
          >
            <Icon sx={{ fontSize: 20 }} />
          </Box>
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#fff", fontSize: 14.5, lineHeight: 1.35 }}>
            {title}
          </Typography>
        </Stack>
        <Box
          sx={{
            minHeight: 46,
            px: 1.25,
            py: 0.9,
            display: "flex",
            alignItems: "center",
            borderLeft: `2px solid ${tone.accent}`,
            borderRadius: "0 6px 6px 0",
            bgcolor: tone.wash,
          }}
        >
          <Typography variant="body2" sx={{ color: "#E4DDF2", lineHeight: 1.5, fontSize: 12.5 }}>
            {description}
          </Typography>
        </Box>
        <Box
          aria-hidden="true"
          sx={{
            minHeight: 76,
            p: 1.5,
            display: "flex",
            alignItems: "center",
            border: `1px solid ${CM.border}`,
            borderRadius: 1.5,
            bgcolor: "rgba(12,8,27,0.42)",
            backgroundImage: `linear-gradient(110deg, ${tone.wash}, transparent 75%)`,
          }}
        >
          {preview}
        </Box>
        <Box sx={{ flex: 1 }} />
        <Button
          component={RouterLink}
          to={to}
          size="small"
          variant="outlined"
          endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />}
          sx={{
            py: 0.75,
            px: 1.5,
            fontSize: 12.5,
            alignSelf: "flex-start",
            color: tone.accent,
            borderColor: `${tone.accent}66`,
            bgcolor: tone.wash,
            "&:hover": { borderColor: tone.accent, bgcolor: tone.wash },
          }}
        >
          {action}
        </Button>
      </CardContent>
    </Card>
  );
}

function PreviewList({ items, tone }) {
  return (
    <Stack spacing={0.75} sx={{ width: "100%" }}>
      {items.map(({ label, detail }) => (
        <Stack
          key={label}
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
          sx={{ minWidth: 0 }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            <Box sx={{ width: 6, height: 6, flexShrink: 0, borderRadius: "50%", bgcolor: tone.accent }} />
            <Typography variant="caption" noWrap sx={{ color: "#EDE8F8", fontWeight: 600, fontSize: 11.5 }}>
              {label}
            </Typography>
          </Stack>
          <Typography variant="caption" noWrap sx={{ color: CM.textDim, fontSize: 10.5, flexShrink: 0 }}>
            {detail}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

export default function ContentManagerDashboard() {
  const memberLevelsQuery = useApiQuery(() => contentManagerApi.memberLevels());
  const memberLevels = Array.isArray(memberLevelsQuery.data) ? memberLevelsQuery.data : [];
  const totalMembers = memberLevels.reduce((total, item) => total + Number(item.memberCount || 0), 0);
  const levelColors = [CM.green, CM.amber, CM.pink];

  return (
    <Box sx={{ maxWidth: 1240, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 2.5 } }}>
      <ContentPageHeader
        breadcrumb={BREADCRUMB}
        title="Content Manager Dashboard"
        description="Manage your content and member progression."
      />

      <Box
        component="section"
        aria-label="Management areas"
        sx={{
          mt: 2,
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        <ManagementCard
          title="Survey management"
          description="Questions and options members answer when they sign up."
          to={CONTENT_PATHS.surveys}
          action="Manage surveys"
          icon={MenuBookRoundedIcon}
          preview={<PreviewList items={[{ label: "Personal information", detail: "Sign-up" }, { label: "Fitness goals", detail: "Survey" }, { label: "Training experience", detail: "Survey" }]} tone={CARD_TONES[0]} />}
          tone={CARD_TONES[0]}
        />
        <ManagementCard
          title="Exercise & workout management"
          description="Manage exercises and workouts available to members."
          to={CONTENT_PATHS.exercises}
          action="Manage exercises"
          icon={SelfImprovementRoundedIcon}
          preview={<PreviewList items={[{ label: "Push-up", detail: "Exercise" }, { label: "Pull-up", detail: "Exercise" }, { label: "Upper body A", detail: "Workout" }]} tone={CARD_TONES[1]} />}
          tone={CARD_TONES[1]}
        />
        <ManagementCard
          title="Progression rules"
          description="Define how members advance through training milestones."
          to={CONTENT_PATHS.progressionRules}
          action="Manage rules"
          icon={FitnessCenterRoundedIcon}
          preview={<PreviewList items={[{ label: "Strength", detail: "Repetitions" }, { label: "Endurance", detail: "Duration" }, { label: "Mobility", detail: "Range" }]} tone={CARD_TONES[2]} />}
          tone={CARD_TONES[2]}
        />
        <ManagementCard
          title="Level criteria"
          description="Set measurable requirements for Beginner, Intermediate, and Advanced."
          to={CONTENT_PATHS.levelCriteria}
          action="Manage criteria"
          icon={RuleRoundedIcon}
          preview={<PreviewList items={[{ label: "Beginner", detail: "Foundation" }, { label: "Intermediate", detail: "Building" }, { label: "Advanced", detail: "Performance" }]} tone={CARD_TONES[3]} />}
          tone={CARD_TONES[3]}
        />
      </Box>

      <Card component="section" aria-labelledby="members-by-level-title" sx={{ mt: 2, p: { xs: 1.75, sm: 2.25 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1.5 }}>
          <Typography id="members-by-level-title" variant="subtitle1" fontWeight={700} sx={{ color: "#fff", fontSize: 15 }}>
            Members by level
          </Typography>
          <Typography variant="caption" sx={{ color: CM.textMuted }}>
            {memberLevelsQuery.isLoading ? "Loading…" : `${totalMembers.toLocaleString()} members`}
          </Typography>
        </Stack>
        {memberLevelsQuery.error ? (
          <Typography variant="body2" sx={{ color: CM.textMuted }}>
            Member level statistics are unavailable.
          </Typography>
        ) : memberLevelsQuery.isLoading ? (
          <LinearProgress sx={{ maxWidth: 360 }} />
        ) : memberLevels.length === 0 ? (
          <Typography variant="body2" sx={{ color: CM.textMuted }}>
            No member level data available.
          </Typography>
        ) : (
          <Box>
            <Box
            role="img"
            aria-label={`Member distribution by level: ${memberLevels.map((item) => `${item.level} ${totalMembers ? Math.round((Number(item.memberCount || 0) / totalMembers) * 100) : 0}%`).join(", ")}`}
            sx={{
              display: "flex",
              width: "100%",
              height: 24,
              overflow: "hidden",
              borderRadius: 1.5,
              bgcolor: "rgba(203,190,230,0.12)",
              border: "1px solid rgba(255,255,255,0.22)",
              boxShadow: "inset 0 1px 3px rgba(0,0,0,0.28)",
            }}
          >
            {memberLevels.map((item, index) => {
              const count = Number(item.memberCount || 0);
              const percent = totalMembers ? (count / totalMembers) * 100 : 0;
              return (
                <Box
                  key={item.level}
                  title={`${item.level}: ${percent.toFixed(1)}% (${count.toLocaleString()} members)`}
                  sx={{
                    width: `${percent}%`,
                    minWidth: count > 0 ? 2 : 0,
                    bgcolor: levelColors[index % levelColors.length],
                    borderRight: index < memberLevels.length - 1 ? "2px solid rgba(20,15,32,0.8)" : "none",
                    boxShadow: "inset -1px 0 rgba(255,255,255,0.3)",
                    transition: "width .3s ease",
                  }}
                />
              );
            })}
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1, mt: 1.25 }}>
              {memberLevels.map((item, index) => {
                const count = Number(item.memberCount || 0);
                const percent = totalMembers ? Math.round((count / totalMembers) * 100) : 0;
                return (
                  <Stack key={item.level} direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, p: 1, border: `1px solid ${CM.border}`, borderRadius: 1, bgcolor: "rgba(12,8,27,0.3)" }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: 0.5, flexShrink: 0, bgcolor: levelColors[index % levelColors.length], boxShadow: `0 0 0 2px ${levelColors[index % levelColors.length]}33` }} />
                    <Typography variant="caption" sx={{ color: CM.textMuted, flex: 1, minWidth: 0 }}>{item.level}</Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ color: "#fff", whiteSpace: "nowrap" }}>{percent}%</Typography>
                    <Typography variant="caption" sx={{ color: CM.textDim, whiteSpace: "nowrap" }}>{count.toLocaleString()} members</Typography>
                  </Stack>
                );
              })}
            </Box>
          </Box>
        )}
      </Card>
    </Box>
  );
}
