import { useState } from "react";
import { useLevelNames } from "../useLevelNames";
import { Link as RouterLink, useLocation, useParams } from "react-router-dom";
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
import { useTranslation } from "react-i18next";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import FitnessCenterRoundedIcon from "@mui/icons-material/FitnessCenterRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import { contentManagerApi } from "../api/contentManager";
import { useApiMutation, useApiQuery } from "../hooks";
import {
  CONTENT_PATHS,
  ContentPageHeader,
  DarkPill,
} from "../components/ContentShared";
import { CM } from "../theme-content";
import ConfirmDialog from "../components/common/ConfirmDialog";
import {
  WorkoutFields,
  defaultWorkoutItem,
  toWorkoutItemRequests,
  workoutItemErrors,
} from "./ExerciseFormPage";

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
  const { t } = useTranslation();
  const { code = "" } = useParams();
  const location = useLocation();
  const returnTo = location.state?.returnTo || CONTENT_PATHS.workouts;
  const returnLabel = location.state?.returnLabel || t("contentManager.detail.backToList");
  const { levels: levelNames } = useLevelNames();
  const { data: workout, isLoading, error, refetch } = useApiQuery(
    () => contentManagerApi.workout(code),
    { enabled: Boolean(code), deps: [code] },
  );
  const [editing, setEditing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
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
    { labelKey: "nav.contentManagerRole", to: CONTENT_PATHS.dashboard },
    { labelKey: "nav.exerciseAndWorkout", to: CONTENT_PATHS.exercises },
    { labelKey: "nav.workoutDetails" },
  ];

  if (isLoading) {
    return (
      <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 2, sm: 3 }, py: 4 }}>
        <ContentPageHeader breadcrumb={crumb} title={t("contentManager.detail.loadingWorkout")} />
        <Box sx={{ py: 8, display: "grid", placeItems: "center" }}>
          <CircularProgress size={24} />
        </Box>
      </Box>
    );
  }

  if (error || !workout) {
    return (
      <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 2, sm: 3 }, py: 4 }}>
        <ContentPageHeader breadcrumb={crumb} title={t("contentManager.detail.workoutNotFound")} />
        <Alert
          severity="warning"
          sx={{ mt: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              {t("contentManager.detail.tryAgain")}
            </Button>
          }
        >
          {error?.message || t("contentManager.detail.workoutDeleted")}
        </Alert>
        <Button
          component={RouterLink}
          to={returnTo}
          sx={{ mt: 2 }}
          startIcon={<ArrowBackRoundedIcon />}
        >
          {returnLabel}
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
      type: ["HEALTH", "SKILL", "FLEX"].includes(workout.type) ? workout.type : "FLEX",
      level: workout.level || "",
      items: exercises.map((exercise) => ({
        ...defaultWorkoutItem(exercise),
        // Giữ cấu hình đã lưu; bài chưa có cấu hình thì dùng mặc định ở trên.
        ...(exercise.countBy
          ? {
              sets: exercise.sets ?? 3,
              reps: exercise.reps ?? 10,
              durationSeconds: exercise.durationSeconds ?? 30,
              restSeconds: exercise.restSeconds ?? 60,
            }
          : {}),
      })),
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
      || form.description.length > 300
      || !["HEALTH", "SKILL", "FLEX"].includes(form.type)
      || !levelNames.includes(form.level)
      || form.items.length === 0
      || form.items.some((item) => Object.keys(workoutItemErrors(item)).length > 0)) return;
    saveMutation.mutate({
      name: form.name.trim(),
      description: form.description.trim(),
      type: form.type,
      level: form.level,
      exerciseCodes: form.items.map((item) => item.exerciseCode),
      items: toWorkoutItemRequests(form.items),
    });
  };

  return (
    <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2.5, sm: 3 } }}>
      <ContentPageHeader
        breadcrumb={crumb}
        title={workout.name}
        description={t("contentManager.detail.workoutDetailsMeta", { code: workout.code })}
        action={
          <Stack direction="row" spacing={1}>
            {!isDailyPlan && !editing && (
              <Button variant="contained" startIcon={<EditRoundedIcon />} onClick={startEditing}>
                {t("contentManager.detail.edit")}
              </Button>
            )}
            <Button
              component={RouterLink}
              to={returnTo}
              variant="outlined"
              startIcon={<ArrowBackRoundedIcon />}
            >
              {returnLabel}
            </Button>
          </Stack>
        }
      />

      <Card sx={{ mt: 2.5, overflow: "hidden", ...enter(150) }}>
        <CardContent sx={{ p: { xs: 2.25, sm: 3 } }}>
          {editing && form ? (
            <Stack spacing={2}>
              {exerciseLoadError && <Alert severity="error">{t("contentManager.detail.couldNotLoadExercises", { message: exerciseLoadError.message })}</Alert>}
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
              <Divider sx={{ mt: 1, borderColor: CM.border }} />
              <Stack
                direction="row"
                spacing={1.5}
                justifyContent="flex-end"
                sx={{
                  position: "sticky",
                  bottom: 0,
                  py: 1.5,
                  bgcolor: "background.default",
                  zIndex: 5,
                }}
              >
                <Button startIcon={<CloseRoundedIcon />} onClick={() => setConfirmCancel(true)} disabled={saveMutation.isPending}>
                  {t("contentManager.form.cancel")}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SaveRoundedIcon />}
                  onClick={submitEdit}
                  disabled={saveMutation.isPending || isLoadingExercises || Boolean(exerciseLoadError)}
                >
                  {saveMutation.isPending ? t("contentManager.detail.saving") : t("contentManager.detail.saveChanges")}
                </Button>
              </Stack>
            </Stack>
          ) : (
            <>
              <Detail label={t("contentManager.detail.description")} value={workout.description} full />

              <Divider sx={{ my: 2.5 }} />

              {isDailyPlan ? (
            <>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#fff" }}>
                {t("contentManager.detail.sevenDaySchedule")}
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
                            {t("contentManager.detail.restDay")}
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
                {t("contentManager.detail.workoutExercises")}
              </Typography>
              {exercises.length === 0 ? (
                <Typography variant="body2" sx={{ mt: 1, color: CM.textMuted }}>
                  {t("contentManager.detail.noExercisesLinked")}
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
                          {exercise.countBy
                            ? t("contentManager.detail.setsRepsRest", {
                                sets: exercise.sets,
                                dosage: exercise.countBy === "DURATION"
                                  ? `${exercise.durationSeconds} sec`
                                  : `${exercise.reps} reps`,
                                rest: exercise.restSeconds,
                              })
                            : String(exercise.category || "").toUpperCase() === "HOLD"
                              ? t("contentManager.detail.setsNotSet", {
                                  sets: exercise.defaultSets ?? t("contentManager.detail.notSet"),
                                  value: exercise.duration == null
                                    ? t("contentManager.detail.notSet")
                                    : `${exercise.duration} sec`,
                                })
                              : t("contentManager.detail.setsNotSet", {
                                  sets: exercise.defaultSets ?? t("contentManager.detail.notSet"),
                                  value: exercise.defaultReps ?? t("contentManager.detail.notSet"),
                                })}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              )}
              <Divider sx={{ my: 2.5 }} />
              <Grid container spacing={1.5}>
                <Detail icon={LayersRoundedIcon} label={t("contentManager.detail.level")} value={workout.level} />
                <Detail icon={FitnessCenterRoundedIcon} label={t("contentManager.detail.type")} value={workout.type} />
              </Grid>
            </>
          )}
            </>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={confirmCancel}
        title={t("contentManager.detail.discardWorkoutTitle")}
        message={t("contentManager.detail.discardWorkoutMessage")}
        confirmLabel={t("contentManager.detail.discard")}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          cancelEditing();
        }}
      />
    </Box>
  );
}
