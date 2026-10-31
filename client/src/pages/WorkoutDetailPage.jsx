import { useState } from "react";
import { useLevelNames } from "../useLevelNames";
import { Link as RouterLink, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { keyframes } from "@mui/material/styles";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import FitnessCenterRoundedIcon from "@mui/icons-material/FitnessCenterRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import TimerRoundedIcon from "@mui/icons-material/TimerRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import { contentManagerApi } from "../api/contentManager";
import { useApiMutation, useApiQuery } from "../hooks";
import {
  CONTENT_PATHS,
  ContentPageHeader,
  DarkPill,
} from "../components/ContentShared";
import { CM } from "../theme-content";
import { WorkoutFields } from "./ExerciseFormPage";

const rise = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;
const enter = (delay = 0) => ({
  animation: `${rise} .45s ease-out ${delay}ms both`,
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
});

const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function Detail({ label, value, full, icon: Icon }) {
  return (
    <Grid item xs={12} sm={full ? 12 : 6}>
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          border: `1px solid ${CM.border}`,
          bgcolor: CM.surfaceSoft,
          borderRadius: "14px",
          p: 2,
          height: "100%",
          transition: "all .2s ease",
          "&:hover": { borderColor: CM.borderStrong },
        }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
          {Icon && <Icon sx={{ fontSize: 14, color: CM.violetBright }} />}
          <Typography
            variant="caption"
            sx={{ color: CM.textDim, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 10, fontWeight: 700 }}
          >
            {label}
          </Typography>
        </Stack>
        <Typography variant="body1" fontWeight={600} sx={{ whiteSpace: "pre-line", color: "#fff" }}>
          {value || "—"}
        </Typography>
      </Box>
    </Grid>
  );
}

export default function WorkoutDetailPage() {
  const { code = "" } = useParams();
  const { levels: levelNames } = useLevelNames();
  const { data: workout, isLoading, error, refetch } = useApiQuery(
    () => contentManagerApi.workout(code),
    { enabled: Boolean(code), deps: [code] },
  );
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseLevel, setExerciseLevel] = useState("all");
  const { data: availableExercises = [], isLoading: isLoadingExercises, error: exerciseLoadError } = useApiQuery(
    () => contentManagerApi.exercises(),
    { enabled: editing },
  );
  const saveMutation = useApiMutation(
    (data) => contentManagerApi.updateWorkout(code, data),
    { onSuccess: () => { setEditing(false); setHasSubmitted(false); refetch(); } },
  );
  const exerciseCodes = Array.isArray(workout?.exercises)
    ? workout.exercises.map((exercise) => exercise.code).filter(Boolean).sort().join(",")
    : "";
  const { data: exerciseDetails } = useApiQuery(
    () => contentManagerApi.exercisesByCodes(exerciseCodes.split(",")),
    { enabled: Boolean(workout && exerciseCodes), deps: [exerciseCodes] },
  );

  const crumb = [
    { label: "Content manager", to: CONTENT_PATHS.dashboard },
    { label: "Exercise & Workout Management", to: CONTENT_PATHS.exercises },
    { label: "Workout details" },
  ];

  if (isLoading) {
    return (
      <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 2, sm: 3 }, py: 4 }}>
        <ContentPageHeader breadcrumb={crumb} title="Loading workout…" />
        <Box sx={{ py: 8, display: "grid", placeItems: "center" }}>
          <CircularProgress size={24} />
        </Box>
      </Box>
    );
  }

  if (error || !workout) {
    return (
      <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 2, sm: 3 }, py: 4 }}>
        <ContentPageHeader breadcrumb={crumb} title="Workout not found" />
        <Alert
          severity="warning"
          sx={{ mt: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Try again
            </Button>
          }
        >
          {error?.message || "This workout may have been deleted or the link is invalid."}
        </Alert>
        <Button
          component={RouterLink}
          to={CONTENT_PATHS.workouts}
          sx={{ mt: 2 }}
          startIcon={<ArrowBackRoundedIcon />}
        >
          Back to workout list
        </Button>
      </Box>
    );
  }

  const isDailyPlan = workout.type === "DAILY_TRAINING_PLAN";
  const planItems = Array.isArray(workout.planItems) ? workout.planItems : [];
  const exerciseDetailsByCode = new Map(
    (exerciseDetails || []).filter(Boolean).map((exercise) => [exercise.code, exercise]),
  );
  const exercises = Array.isArray(workout.exercises)
    ? workout.exercises.map((exercise) => ({
        ...exercise,
        ...(exerciseDetailsByCode.get(exercise.code) || {}),
      }))
    : [];
  const startEditing = () => {
    setForm({
      name: workout.name || "",
      description: workout.description || "",
      restSeconds: workout.restSeconds ?? 60,
      type: "WORKOUT",
      level: workout.level || "",
      exerciseCodes: exercises.map((exercise) => exercise.code),
      planItems: [],
    });
    setHasSubmitted(false);
    setEditing(true);
  };
  const cancelEditing = () => {
    setEditing(false);
    setHasSubmitted(false);
    setExerciseSearch("");
    setExerciseLevel("all");
    saveMutation.reset();
  };
  const submitEdit = () => {
    setHasSubmitted(true);
    if (!form?.name.trim() || form.name.length > 60 || !form.description.trim()
      || form.description.length > 300 || !Number.isInteger(form.restSeconds)
      || form.restSeconds < 0 || form.restSeconds > 3600
      || !levelNames.includes(form.level)
      || form.exerciseCodes.length === 0) return;
    saveMutation.mutate({
      name: form.name.trim(),
      description: form.description.trim(),
      restSeconds: form.restSeconds,
      level: form.level,
      exerciseCodes: form.exerciseCodes,
    });
  };

  return (
    <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2.5, sm: 3 } }}>
      <ContentPageHeader
        breadcrumb={crumb}
        title={workout.name}
        description={`Workout details · ${workout.code}`}
        action={
          <Stack direction="row" spacing={1}>
            {!isDailyPlan && !editing && (
              <Button variant="contained" startIcon={<EditRoundedIcon />} onClick={startEditing}>
                Edit
              </Button>
            )}
            <Button
              component={RouterLink}
              to={CONTENT_PATHS.workouts}
              variant="outlined"
              startIcon={<ArrowBackRoundedIcon />}
            >
              Back to list
            </Button>
          </Stack>
        }
      />

      <Card sx={{ mt: 2.5, overflow: "hidden", ...enter(150) }}>
        <CardContent sx={{ p: { xs: 2.25, sm: 3 } }}>
          {editing && form ? (
            <Stack spacing={2}>
              {exerciseLoadError && <Alert severity="error">Could not load exercises: {exerciseLoadError.message}</Alert>}
              <WorkoutFields
                value={form}
                onChange={setForm}
                entries={availableExercises.filter((exercise) => exercise.active)}
                allEntries={availableExercises.filter((exercise) => exercise.active)}
                totalExerciseCount={availableExercises.filter((exercise) => exercise.active).length}
                isLoadingExercises={isLoadingExercises}
                exerciseLoadError={exerciseLoadError}
                search={exerciseSearch}
                onSearchChange={setExerciseSearch}
                level={exerciseLevel}
                onLevelChange={setExerciseLevel}
                hasSubmitted={hasSubmitted}
                selectedDay={1}
                onSelectedDayChange={() => {}}
              />
              {saveMutation.error && <Alert severity="error">{saveMutation.error.message}</Alert>}
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button startIcon={<CloseRoundedIcon />} onClick={cancelEditing} disabled={saveMutation.isPending}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SaveRoundedIcon />}
                  onClick={submitEdit}
                  disabled={saveMutation.isPending || isLoadingExercises || Boolean(exerciseLoadError)}
                >
                  {saveMutation.isPending ? "Saving…" : "Save changes"}
                </Button>
              </Stack>
            </Stack>
          ) : (
            <>
              <Detail label="Description" value={workout.description} full />

              <Divider sx={{ my: 2.5 }} />

              {isDailyPlan ? (
            <>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#fff" }}>
                7-day training schedule
              </Typography>
              <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                {WEEK_DAYS.map((day, index) => {
                  const dayItems = planItems.filter((item) => item.dayOfWeek === index + 1);
                  return (
                    <Grid item xs={12} sm={6} key={day}>
                      <Box
                        sx={{
                          border: `1px solid ${CM.border}`,
                          bgcolor: "rgba(19,10,39,0.6)",
                          borderRadius: 1.5,
                          p: 1.5,
                          height: "100%",
                        }}
                      >
                        <Typography variant="caption" fontWeight={700} sx={{ color: CM.violetBright }}>
                          {day}
                        </Typography>
                        {dayItems.length === 0 ? (
                          <Typography variant="caption" sx={{ display: "block", mt: 1, color: CM.textDim }}>
                            Rest day
                          </Typography>
                        ) : (
                          <Stack spacing={1} sx={{ mt: 1 }}>
                            {dayItems.map((item) => (
                              <Box
                                key={`${item.dayOfWeek}-${item.exerciseCode}`}
                                sx={{
                                  border: `1px solid ${CM.border}`,
                                  bgcolor: "rgba(36,23,72,0.85)",
                                  borderRadius: 1,
                                  p: 1.25,
                                }}
                              >
                                <Typography variant="body2" fontWeight={600} sx={{ color: "#fff" }}>
                                  {item.exerciseName || item.exerciseCode}
                                </Typography>
                                <Typography variant="caption" sx={{ color: CM.textDim }}>
                                  {item.muscleGroup}
                                </Typography>
                                <Stack
                                  direction="row"
                                  spacing={1.5}
                                  flexWrap="wrap"
                                  useFlexGap
                                  sx={{ mt: 0.75 }}
                                >
                                  {[
                                    ["Beginner", item.beginnerSets, item.beginnerReps],
                                    ["Intermediate", item.intermediateSets, item.intermediateReps],
                                    ["Advanced", item.advancedSets, item.advancedReps],
                                  ].map(([label, sets, reps]) => (
                                    <Typography
                                      key={label}
                                      variant="caption"
                                      sx={{ fontSize: 10.5, color: CM.textMuted }}
                                    >
                                      {label}: {sets} × {reps}
                                    </Typography>
                                  ))}
                                </Stack>
                              </Box>
                            ))}
                          </Stack>
                        )}
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </>
          ) : (
            <>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#fff" }}>
                Workout exercises
              </Typography>
              {exercises.length === 0 ? (
                <Typography variant="body2" sx={{ mt: 1, color: CM.textMuted }}>
                  No exercises are linked to this workout.
                </Typography>
              ) : (
                <Stack component="ol" spacing={1} sx={{ mt: 1.5, p: 0, m: 0, listStyle: "none" }}>
                  {exercises.map((exercise, index) => (
                    <Stack
                      component="li"
                      key={`${exercise.code}-${index}`}
                      direction="row"
                      spacing={1.5}
                      alignItems="center"
                      sx={{
                        border: `1px solid ${CM.border}`,
                        bgcolor: CM.surfaceSoft,
                        borderRadius: "14px",
                        px: 2,
                        py: 1.25,
                        transition: "all .2s ease",
                        "&:hover": { borderColor: CM.borderStrong, bgcolor: "rgba(139,92,246,0.06)", transform: "translateX(3px)" },
                      }}
                    >
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: "7px",
                          backgroundImage: CM.buttonGradient,
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: 700,
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        {index + 1}
                      </Box>
                      <Box
                        component={RouterLink}
                        to={`${CONTENT_PATHS.exercises}/${encodeURIComponent(exercise.code)}`}
                        sx={{
                          minWidth: 0,
                          flex: 1,
                          color: "inherit",
                          textDecoration: "none",
                          borderRadius: 1,
                          "&:hover .exercise-name, &:focus-visible .exercise-name": {
                            color: CM.violetBright,
                            textDecoration: "underline",
                          },
                        }}
                      >
                        <Typography className="exercise-name" variant="body2" fontWeight={600} noWrap sx={{ color: "#fff" }}>
                          {exercise.name}
                        </Typography>
                        <Typography variant="caption" noWrap display="block" sx={{ color: CM.textDim }}>
                          {exercise.muscleGroup || "—"}
                        </Typography>
                        <Typography variant="caption" display="block" sx={{ mt: 0.5, color: CM.textMuted }}>
                          {String(exercise.category || "").toUpperCase() === "HOLD"
                            ? `${exercise.defaultSets ?? "Not set"} sets · ${exercise.duration == null ? "Not set" : `${exercise.duration} sec`}`
                            : `${exercise.defaultSets ?? "Not set"} sets · ${exercise.defaultReps ?? "Not set"} reps`}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              )}
              <Divider sx={{ my: 2.5 }} />
              <Grid container spacing={1.5}>
                <Detail icon={LayersRoundedIcon} label="Level" value={workout.level} />
                <Detail icon={TimerRoundedIcon} label="Rest" value={`${workout.restSeconds ?? 60} seconds`} />
              </Grid>
            </>
          )}
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
