import { useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import {
  Alert, Box, Button, Card, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  FormControlLabel, InputAdornment, MenuItem,
  Pagination, Stack, Switch, TextField, Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import EventNoteRoundedIcon from "@mui/icons-material/EventNoteRounded";
import FitnessCenterRoundedIcon from "@mui/icons-material/FitnessCenterRounded";
import PreviewRoundedIcon from "@mui/icons-material/PreviewRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { contentManagerApi } from "../api/contentManager";
import { useApiMutation, useApiQuery } from "../hooks";
import { useLevelNames } from "../useLevelNames";
import { CONTENT_PATHS, ContentPageHeader, DarkPill } from "../components/ContentShared";
import { CM } from "../theme-content";

const WORKOUTS_PER_PAGE = 6;
const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];
const panelSx = { p: 2, border: `1px solid ${CM.border}`, borderRadius: "14px", bgcolor: CM.surfaceSoft };

function SectionTitle({ icon: Icon, title, caption }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Box aria-hidden sx={{ width: 36, height: 36, borderRadius: "10px", display: "grid", placeItems: "center", flexShrink: 0, background: CM.gradientSoft, border: `1px solid ${CM.border}` }}>
        <Icon sx={{ fontSize: 19, color: "#fff" }} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ color: "#fff", fontWeight: 700, lineHeight: 1.3 }}>{title}</Typography>
        {caption && <Typography variant="caption" sx={{ color: CM.textMuted }}>{caption}</Typography>}
      </Box>
    </Stack>
  );
}

/** Only regular, system-owned workouts can be scheduled into a daily plan. */
const isSystemWorkout = (workout) => workout.type !== "DAILY_TRAINING_PLAN" && String(workout.source || "").toUpperCase() === "SYSTEM";

function validate(form) {
  const errors = [];
  if (!form.name.trim()) errors.push("Enter a plan name.");
  if (!form.level) errors.push("Choose a level.");
  const month = Number(form.monthNumber);
  if (!Number.isInteger(month) || month < 1 || month > 24) errors.push("Training month must be between 1 and 24.");
  const missing = DAY_OPTIONS.slice(0, form.daysPerWeek).filter((day) => !form.days[day]);
  if (missing.length) errors.push(`Assign a workout to ${missing.map((day) => `Day ${day}`).join(", ")}.`);
  return errors;
}

function WorkoutPreviewDialog({ workout, onClose }) {
  const exercises = Array.isArray(workout?.exercises) ? workout.exercises : [];

  return (
    <Dialog open={Boolean(workout)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>{workout?.name || "Workout preview"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={0.5}>
          <Typography variant="caption" sx={{ color: CM.textDim }}>
            {workout?.code} · {workout?.level || "No level"} · {exercises.length} exercises
          </Typography>
          {workout?.description && (
            <Typography variant="body2" sx={{ color: CM.textMuted, whiteSpace: "pre-line", mb: 1 }}>
              {workout.description}
            </Typography>
          )}
        </Stack>

        {exercises.length > 0 ? (
          <Stack spacing={1} sx={{ mt: 2 }}>
            {exercises.map((exercise, index) => {
              const details = [
                exercise.sets != null ? `${exercise.sets} sets` : null,
                exercise.reps != null ? `${exercise.reps} reps` : null,
                exercise.durationSeconds != null ? `${exercise.durationSeconds}s` : null,
                exercise.restSeconds != null ? `Rest ${exercise.restSeconds}s` : null,
              ].filter(Boolean);
              return (
                <Box
                  key={exercise.code || `${exercise.name}-${index}`}
                  sx={{ display: "flex", alignItems: "center", gap: 1.25, p: 1.25, border: `1px solid ${CM.border}`, borderRadius: "10px", bgcolor: CM.surfaceSoft }}
                >
                  <Box sx={{ width: 28, height: 28, display: "grid", placeItems: "center", flexShrink: 0, borderRadius: "8px", color: CM.violetBright, bgcolor: "rgba(139,92,246,0.16)" }}>
                    <Typography variant="caption" sx={{ fontWeight: 800 }}>{index + 1}</Typography>
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ color: "#fff", fontWeight: 600 }}>
                      {exercise.name || exercise.code || "Unnamed exercise"}
                    </Typography>
                    <Typography variant="caption" sx={{ color: CM.textDim }}>
                      {details.join(" · ") || exercise.muscleGroup || exercise.code || "Exercise"}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Stack>
        ) : (
          <Typography variant="body2" sx={{ mt: 2, color: CM.textMuted }}>
            This workout has no exercises.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

const BREADCRUMB = [
  { label: "Content manager", to: CONTENT_PATHS.dashboard },
  { label: "Daily Training Plans", to: CONTENT_PATHS.templates },
];

export default function DailyPlanTemplateBuilderPage() {
  const { code } = useParams();
  const editing = Boolean(code);
  const detailPath = editing ? `${CONTENT_PATHS.templates}/${encodeURIComponent(code)}` : null;
  const navigate = useNavigate();
  const { activeLevels, levelTone } = useLevelNames();
  const workoutsQuery = useApiQuery(() => contentManagerApi.workouts());
  const detail = useApiQuery(() => contentManagerApi.dailyPlanTemplate(code), { enabled: editing, deps: [code] });
  const [draft, setDraft] = useState(null);
  const [touched, setTouched] = useState(false);
  const [activeDay, setActiveDay] = useState(1);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [previewWorkout, setPreviewWorkout] = useState(null);

  const existing = editing ? detail.data : null;
  const form = draft || {
    name: existing?.name || "",
    description: existing?.description || "",
    level: existing?.level || activeLevels[0] || "",
    monthNumber: existing?.monthNumber ?? 1,
    daysPerWeek: existing?.daysPerWeek ?? 3,
    active: existing ? existing.active : true,
    days: Object.fromEntries((existing?.days || []).map((day) => [day.dayNumber, day.workoutCode])),
  };
  const set = (patch) => setDraft({ ...form, ...patch });

  const save = useApiMutation(
    (payload) => (editing ? contentManagerApi.updateDailyPlanTemplate(code, payload) : contentManagerApi.createDailyPlanTemplate(payload)),
    { onSuccess: (saved) => navigate(editing ? detailPath : CONTENT_PATHS.templates, { state: { successMessage: editing ? "Daily training plan updated." : `Plan created: ${saved?.name}.` } }) },
  );

  const allWorkouts = useMemo(() => (workoutsQuery.data || []).filter(isSystemWorkout), [workoutsQuery.data]);
  const byCode = useMemo(() => new Map(allWorkouts.map((workout) => [workout.code, workout])), [allWorkouts]);
  const candidates = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allWorkouts.filter((workout) =>
      String(workout.level || "").toLowerCase() === String(form.level).toLowerCase()
      && (!form.active || workout.active)
      && (!term || workout.name?.toLowerCase().includes(term) || workout.code?.toLowerCase().includes(term)));
  }, [allWorkouts, form.level, form.active, search]);
  const pageCount = Math.max(1, Math.ceil(candidates.length / WORKOUTS_PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const visible = candidates.slice((safePage - 1) * WORKOUTS_PER_PAGE, safePage * WORKOUTS_PER_PAGE);
  const dayList = DAY_OPTIONS.slice(0, form.daysPerWeek);

  if (workoutsQuery.isLoading || (editing && detail.isLoading)) {
    return <Box sx={{ py: 10, display: "grid", placeItems: "center" }}><CircularProgress size={26} /></Box>;
  }
  const loadError = workoutsQuery.error || (editing && detail.error);
  if (loadError) {
    return (
      <Box sx={{ maxWidth: 960, mx: "auto", p: 3 }}>
        <ContentPageHeader breadcrumb={BREADCRUMB} title="Daily plan unavailable" description={loadError.message} />
        <Button component={RouterLink} to={CONTENT_PATHS.templates} variant="outlined" sx={{ mt: 2 }}>Back</Button>
      </Box>
    );
  }

  const errors = validate(form);
  const assign = (workoutCode) => {
    const next = { ...form.days, [activeDay]: workoutCode };
    const nextEmpty = dayList.find((day) => day > activeDay && !next[day]) ?? dayList.find((day) => !next[day]);
    setDraft({ ...form, days: next });
    if (nextEmpty) setActiveDay(nextEmpty);
  };
  const clearDay = (day) => { const next = { ...form.days }; delete next[day]; set({ days: next }); setActiveDay(day); };
  const changeLevel = (level) => { set({ level, days: {} }); setPage(1); setActiveDay(1); };
  const changeDays = (daysPerWeek) => {
    const days = Object.fromEntries(Object.entries(form.days).filter(([day]) => Number(day) <= daysPerWeek));
    set({ daysPerWeek, days });
    if (activeDay > daysPerWeek) setActiveDay(1);
  };

  const submit = (event) => {
    event.preventDefault();
    setTouched(true);
    if (errors.length) return;
    save.mutate({
      name: form.name.trim(),
      description: form.description.trim(),
      level: form.level,
      monthNumber: Number(form.monthNumber),
      daysPerWeek: Number(form.daysPerWeek),
      active: form.active,
      days: dayList.map((day) => ({ dayNumber: day, workoutCode: form.days[day] })),
    });
  };

  return (
    <Box sx={{ maxWidth: 1240, mx: "auto", px: { xs: 2, sm: 3 }, py: 2.5 }}>
      <ContentPageHeader
        breadcrumb={[...BREADCRUMB, ...(editing ? [{ label: "Plan details", to: detailPath }, { label: "Edit" }] : [{ label: "Create" }])]}
        title={editing ? "Update Daily Training Plan Template" : "Create Daily Training Plan Template"}
        description="Pick workouts that already exist in the system and schedule them onto each training day."
        action={(
          <Button
            component={RouterLink}
            to={editing ? detailPath : CONTENT_PATHS.templates}
            variant="outlined"
            startIcon={<ArrowBackRoundedIcon />}
          >
            Back
          </Button>
        )}
      />
      <Card component="form" onSubmit={submit} noValidate sx={{ mt: 2.5, overflow: "hidden" }}>
        <Box sx={{ p: 2.5 }}>
          {save.error && <Alert severity="error" sx={{ mb: 2 }}>{save.error.message}</Alert>}
          {touched && errors.map((message) => <Alert key={message} severity="error" sx={{ mb: 1.5 }}>{message}</Alert>)}

          <SectionTitle icon={TuneRoundedIcon} title="Plan information" caption="Members whose level, month, and training days match are given this plan." />
          <Box sx={{ mt: 2, display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr 1fr" } }}>
            <TextField size="small" label="Plan name" value={form.name} onChange={(e) => set({ name: e.target.value })} inputProps={{ maxLength: 60 }} />
            <TextField select size="small" label="Level" value={form.level} onChange={(e) => changeLevel(e.target.value)}>
              {(editing && form.level && !activeLevels.includes(form.level) ? [form.level, ...activeLevels] : activeLevels).map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
            </TextField>
            <TextField size="small" type="number" label="Training month" value={form.monthNumber} onChange={(e) => set({ monthNumber: e.target.value })} inputProps={{ min: 1, max: 24 }} />
            <TextField select size="small" label="Days per week" value={form.daysPerWeek} onChange={(e) => changeDays(Number(e.target.value))}>
              {DAY_OPTIONS.map((value) => <MenuItem key={value} value={value}>{value} {value === 1 ? "day" : "days"}</MenuItem>)}
            </TextField>
          </Box>
          <TextField size="small" fullWidth multiline minRows={2} label="Description (optional)" value={form.description} onChange={(e) => set({ description: e.target.value })} inputProps={{ maxLength: 300 }} sx={{ mt: 1.5 }} />

          <Divider sx={{ borderColor: CM.border, my: 3 }} />

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(0, 1fr)" }, alignItems: "stretch" }}>
            <Box sx={{ ...panelSx, display: "flex", flexDirection: "column" }}>
              <SectionTitle icon={EventNoteRoundedIcon} title="Training days" caption="Select a day, then choose its workout on the right." />
              <Stack spacing={1} sx={{ mt: 2 }}>
                {dayList.map((day) => {
                  const workout = byCode.get(form.days[day]);
                  const selected = activeDay === day;
                  return (
                    <Box
                      key={day} role="button" tabIndex={0} aria-pressed={selected}
                      onClick={() => setActiveDay(day)}
                      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActiveDay(day); } }}
                      sx={{
                        display: "flex", alignItems: "center", gap: 1.5, px: 1.5, py: 1.1, cursor: "pointer", borderRadius: "12px",
                        border: `1px solid ${selected ? CM.violetBright : CM.border}`, bgcolor: selected ? "rgba(139,92,246,0.1)" : CM.surface,
                        transition: "border-color .16s ease",
                      }}
                    >
                      <Typography sx={{ color: selected ? CM.violetBright : CM.textDim, fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", minWidth: 48 }}>Day {day}</Typography>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        {workout ? (
                          <>
                            <Typography variant="body2" noWrap sx={{ color: "#fff", fontWeight: 600 }}>{workout.name}</Typography>
                            <Typography variant="caption" sx={{ color: CM.textDim }}>{workout.code} · {workout.exercises?.length || 0} exercises</Typography>
                          </>
                        ) : (
                          <Typography variant="body2" sx={{ color: CM.textDim }}>No workout selected</Typography>
                        )}
                      </Box>
                      {workout && (
                        <Button size="small" aria-label={`Remove workout from Day ${day}`} onClick={(event) => { event.stopPropagation(); clearDay(day); }} sx={{ minWidth: 0, p: 0.5, color: CM.textMuted }}>
                          <CloseRoundedIcon fontSize="small" />
                        </Button>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            </Box>

            <Box sx={{ ...panelSx, display: "flex", flexDirection: "column" }}>
              <SectionTitle icon={FitnessCenterRoundedIcon} title={`System workouts for Day ${activeDay}`} caption={`Existing ${form.level || "level"} workouts. Create new ones under Exercise & Workout.`} />
              <TextField
                size="small" fullWidth value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search workout" inputProps={{ "aria-label": "Search workout" }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" color="disabled" /></InputAdornment> }}
                sx={{ mt: 2 }}
              />
              <Stack spacing={1} sx={{ mt: 1.5, flex: 1 }}>
                {visible.map((workout) => {
                  const chosenOn = dayList.filter((day) => form.days[day] === workout.code);
                  return (
                    <Box
                      key={workout.code} role="button" tabIndex={0}
                      onClick={() => assign(workout.code)}
                      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); assign(workout.code); } }}
                      sx={{
                        display: "flex", alignItems: "center", gap: 1.25, px: 1.5, py: 1, cursor: "pointer", borderRadius: "12px",
                        border: `1px solid ${form.days[activeDay] === workout.code ? CM.violetBright : CM.border}`, bgcolor: CM.surface,
                        "&:hover": { borderColor: CM.borderStrong },
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" noWrap sx={{ color: "#fff", fontWeight: 600 }}>{workout.name}</Typography>
                        <Typography variant="caption" sx={{ color: CM.textDim }}>{workout.code} · {workout.exercises?.length || 0} exercises</Typography>
                      </Box>
                      {chosenOn.length > 0 && <DarkPill tone="primary">{chosenOn.map((day) => `Day ${day}`).join(", ")}</DarkPill>}
                      <DarkPill tone={levelTone(workout.level)}>{workout.level}</DarkPill>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<PreviewRoundedIcon sx={{ fontSize: 15 }} />}
                        aria-label={`Preview ${workout.name}`}
                        onClick={(event) => { event.stopPropagation(); setPreviewWorkout(workout); }}
                        sx={{ minWidth: 0, px: 1, py: 0.35, borderRadius: "8px", fontSize: 11.5, flexShrink: 0 }}
                      >
                        Preview
                      </Button>
                    </Box>
                  );
                })}
                {visible.length === 0 && (
                  <Box sx={{ py: 5, textAlign: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                      {allWorkouts.length
                        ? `No ${form.active ? "active " : ""}${form.level || ""} workouts match. ${form.active ? "Switch the plan to Inactive to schedule inactive workouts." : ""}`
                        : "No system workouts exist yet. Create workouts first under Exercise & Workout."}
                    </Typography>
                  </Box>
                )}
              </Stack>
              {pageCount > 1 && (
                <Stack alignItems="center" sx={{ mt: 1.5 }}>
                  <Pagination size="small" count={pageCount} page={safePage} onChange={(_, next) => setPage(next)} />
                </Stack>
              )}
            </Box>
          </Box>

          <Box sx={{ mt: 3, p: 1.5, border: `1px solid ${CM.border}`, borderRadius: "12px", bgcolor: CM.surfaceSoft }}>
            <FormControlLabel
              control={<Switch checked={form.active} onChange={(e) => set({ active: e.target.checked })} />}
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <CheckCircleOutlineRoundedIcon sx={{ fontSize: 18, color: form.active ? CM.green : CM.textDim }} />
                  <Typography variant="body2" sx={{ color: form.active ? "#fff" : CM.textMuted, fontWeight: 600 }}>
                    {form.active ? "Active: members can be given this plan" : "Inactive: the plan is not used"}
                  </Typography>
                </Stack>
              }
            />
          </Box>

          <Divider sx={{ borderColor: CM.border, mt: 3 }} />
          <Stack
            direction="row"
            justifyContent="flex-end"
            spacing={1.5}
            sx={{
              position: "sticky",
              bottom: 0,
              py: 1.5,
              bgcolor: "background.default",
              zIndex: 5,
            }}
          >
            <Button component={RouterLink} to={editing ? detailPath : CONTENT_PATHS.templates} variant="outlined">Cancel</Button>
            <Button type="submit" variant="contained" disabled={save.isPending} sx={{ minWidth: 140 }}>
              {save.isPending ? "Saving…" : editing ? "Save changes" : "Create plan"}
            </Button>
          </Stack>
        </Box>
      </Card>
      <WorkoutPreviewDialog workout={previewWorkout} onClose={() => setPreviewWorkout(null)} />
    </Box>
  );
}
