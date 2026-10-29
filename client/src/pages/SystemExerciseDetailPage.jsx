import { Link as RouterLink, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { contentManagerApi, mediaUrl } from "../api/contentManager";
import { useApiMutation, useApiQuery } from "../hooks";
import { useLevelNames } from "../useLevelNames";
import { CONTENT_PATHS, ContentPageHeader } from "../components/ContentShared";
import { CM } from "../theme-content";
import {
  ExerciseFields,
  validateExerciseUpload,
} from "./ExerciseFormPage";

function DetailField({ label, value, full, sx }) {
  return (
    <Grid item xs={12} sm={full ? 12 : 4} sx={sx}>
      <Box
        sx={{
          border: `1px solid ${CM.border}`,
          bgcolor: "rgba(19,10,39,0.6)",
          borderRadius: 1.5,
          p: { xs: 1.5, sm: 1.25 },
          height: "100%",
        }}
      >
        <Typography
          variant="caption"
          sx={{ color: CM.textDim, textTransform: "uppercase", letterSpacing: "0.07em", fontSize: 10, fontWeight: 700 }}
        >
          {label}
        </Typography>
        <Typography variant="body2" fontWeight={600} sx={{ mt: 0.5, whiteSpace: "pre-line", color: "#fff" }}>
          {value || "—"}
        </Typography>
      </Box>
    </Grid>
  );
}

export function GuideSteps({ guide }) {
  const steps = String(guide || "")
    .split("\n")
    .map((step) => step.trim())
    .filter(Boolean);
  if (steps.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No guide steps yet.
      </Typography>
    );
  }
  return (
    <Stack component="ol" spacing={1} sx={{ m: 0, p: 0, listStyle: "none" }}>
      {steps.map((step, index) => (
        <Stack
          component="li"
          key={`${index}-${step.slice(0, 12)}`}
          direction="row"
          spacing={1.25}
          alignItems="flex-start"
        >
          <Box
            sx={{
              width: 22,
              height: 22,
              borderRadius: "6px",
              backgroundImage: CM.buttonGradient,
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              mt: 0.25,
            }}
          >
            {index + 1}
          </Box>
          <Typography variant="body2">{step}</Typography>
        </Stack>
      ))}
    </Stack>
  );
}

const MUSCLE_OPTIONS = ["Chest", "Back", "Shoulders", "Arms", "Core", "Legs", "Glutes"];
export default function SystemExerciseDetailPage() {
  const { code = "" } = useParams();
  const { levels: LEVEL_OPTIONS } = useLevelNames();
  const { data: entry, isLoading, error, refetch } = useApiQuery(
    () => contentManagerApi.exercise(code),
    { enabled: Boolean(code), deps: [code] },
  );
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [video, setVideo] = useState(null);
  const [image, setImage] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [videoError, setVideoError] = useState(null);
  const [imageError, setImageError] = useState(null);

  useEffect(() => {
    if (!entry) return;
    setForm({
      name: entry.name || "",
      type: String(entry.type || "HEALTH").toUpperCase() === "SKILL" ? "SKILL" : "HEALTH",
      description: entry.description || "",
      category: entry.category || "REPS",
      value: entry.category === "HOLD" ? (entry.duration ?? "") : (entry.defaultReps ?? ""),
      defaultSets: entry.defaultSets ?? 3,
      level: entry.level || "",
      muscleGroup: (entry.muscleGroup || "").split(" · ").filter(Boolean),
      guide: entry.guide || "",
    });
  }, [entry]);

  const saveMutation = useApiMutation(
    ({ data, demoVideo, anatomyImage }) => contentManagerApi.updateExercise(code, data, demoVideo, anatomyImage),
    {
      onSuccess: () => {
        setEditing(false);
        setVideo(null);
        setImage(null);
        setSaveError("");
        refetch();
      },
      onError: (requestError) => setSaveError(requestError.message),
    },
  );

  const chooseUpload = (kind, file) => {
    const message = validateExerciseUpload(file, kind);
    if (kind === "video") {
      setVideoError(message);
      if (!message) setVideo(file);
    } else {
      setImageError(message);
      if (!message) setImage(file);
    }
  };

  const cancelEditing = () => {
    setEditing(false);
    setVideo(null);
    setImage(null);
    setVideoError(null);
    setImageError(null);
    setSaveError("");
    if (entry) {
      setForm({
        name: entry.name || "",
        type: String(entry.type || "HEALTH").toUpperCase() === "SKILL" ? "SKILL" : "HEALTH",
        description: entry.description || "",
        category: entry.category || "REPS",
        value: entry.category === "HOLD" ? (entry.duration ?? "") : (entry.defaultReps ?? ""),
        defaultSets: entry.defaultSets ?? 3,
        level: entry.level || "",
        muscleGroup: (entry.muscleGroup || "").split(" · ").filter(Boolean),
        guide: entry.guide || "",
      });
    }
  };

  const crumb = [
    { label: "Content manager", to: CONTENT_PATHS.dashboard },
    { label: "Exercise & Workout Management", to: CONTENT_PATHS.exercises },
    { label: "Exercise details" },
  ];

  if (isLoading) {
    return (
      <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 2, sm: 3 }, py: 4 }}>
        <ContentPageHeader breadcrumb={crumb} title="Loading exercise…" />
        <Box sx={{ py: 8, display: "grid", placeItems: "center" }}>
          <CircularProgress size={24} />
        </Box>
      </Box>
    );
  }

  if (error || !entry) {
    return (
      <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 2, sm: 3 }, py: 4 }}>
        <ContentPageHeader breadcrumb={crumb} title="Exercise or skill not found" />
        <Alert
          severity="warning"
          sx={{ mt: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Try again
            </Button>
          }
        >
          {error?.message || "This entry may have been deleted or the link is invalid."}
        </Alert>
        <Button
          component={RouterLink}
          to={CONTENT_PATHS.exercises}
          sx={{ mt: 2 }}
          startIcon={<ArrowBackRoundedIcon />}
        >
          Back to exercise list
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2.5, sm: 3 } }}>
      <ContentPageHeader
        breadcrumb={crumb}
        title={entry.name}
        description={`Exercise / skill details · ${entry.code}`}
        action={
          <Stack direction="row" spacing={1}>
            {entry.source === "SYSTEM" && !editing && (
              <Button variant="contained" startIcon={<EditRoundedIcon />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            <Button component={RouterLink} to={CONTENT_PATHS.exercises} variant="outlined" startIcon={<ArrowBackRoundedIcon />}>
              Back to list
            </Button>
          </Stack>
        }
      />

      {editing && form ? (
        <Box
          component="form"
          id="edit-exercise-form"
          onSubmit={(event) => {
            event.preventDefault();
            const invalid = {
              title: !form.name.trim() || form.name.length > 120,
              type: !["HEALTH", "SKILL"].includes(form.type),
              level: !LEVEL_OPTIONS.includes(form.level),
              muscles: form.muscleGroup.length === 0,
              value: !Number.isInteger(Number(form.value)) || Number(form.value) < 1 || Number(form.value) > 3600,
              defaultSets: !Number.isInteger(Number(form.defaultSets)) || Number(form.defaultSets) < 1 || Number(form.defaultSets) > 20,
            };
            if (Object.values(invalid).some(Boolean) || videoError || imageError) {
              setSaveError("Please correct the highlighted fields before saving this exercise.");
              return;
            }
            saveMutation.mutate({
              data: {
                ...form,
                defaultSets: Number(form.defaultSets),
                defaultReps: form.category === "REPS" ? Number(form.value) : null,
                duration: form.category === "HOLD" ? Number(form.value) : null,
                muscleGroup: form.muscleGroup.join(" · "),
              },
              demoVideo: video,
              anatomyImage: image,
            });
          }}
          sx={{ mt: 2.5 }}
        >
          <ExerciseFields
            value={form}
            onChange={setForm}
            selectedMuscles={form.muscleGroup}
            onToggleMuscle={(muscle) => setForm((current) => ({
              ...current,
              muscleGroup: current.muscleGroup.includes(muscle)
                ? current.muscleGroup.filter((item) => item !== muscle)
                : [...current.muscleGroup, muscle],
            }))}
            onClearField={() => setSaveError("")}
            invalid={{
              title: !form.name.trim() || form.name.length > 120,
              type: !["HEALTH", "SKILL"].includes(form.type),
              level: !LEVEL_OPTIONS.includes(form.level),
              muscles: form.muscleGroup.length === 0,
            }}
            demoVideo={video}
            demoVideoError={videoError}
            onDemoVideoChange={(file) => chooseUpload("video", file)}
            anatomyImage={image}
            anatomyImageError={imageError}
            onAnatomyImageChange={(file) => chooseUpload("image", file)}
            anatomyImagePreview={entry.anatomyImageUrl && !image ? (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                Current image will be kept unless you choose a replacement.
              </Typography>
            ) : null}
          />
          {saveError && <Alert severity="error" sx={{ mt: 2 }}>{saveError}</Alert>}
          <Divider sx={{ mt: 3 }} />
          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ pt: 1.5 }}>
            <Button startIcon={<CloseRoundedIcon />} onClick={cancelEditing}>Cancel</Button>
            <Button type="submit" form="edit-exercise-form" variant="contained" startIcon={<SaveRoundedIcon />} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </Stack>
        </Box>
      ) : (
      <Card sx={{ mt: 2.5 }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#fff" }}>
            Demo video
          </Typography>
          {entry.demoVideoUrl ? (
            <Box
              component="video"
              src={mediaUrl(entry.demoVideoUrl)}
              controls
              aria-label={`${entry.name} demo video`}
              sx={{
                mt: 1.5,
                width: "100%",
                maxHeight: 420,
                borderRadius: 2,
                bgcolor: "#000",
                display: "block",
              }}
            />
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              No demo video uploaded.
            </Typography>
          )}

          <Divider sx={{ my: 2.5 }} />
          <Grid container spacing={2} alignItems="stretch">
            <Grid item xs={12} md={9} sx={{ display: "flex" }}>
              <Box
                sx={{
                  width: "100%",
                  border: `1px solid ${CM.border}`,
                  borderRadius: 1.5,
                  p: { xs: 1.5, sm: 1.75 },
                }}
              >
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#fff" }}>
                  Muscle anatomy
                </Typography>
                {entry.anatomyImageUrl ? (
                  <Box
                    component="img"
                    src={mediaUrl(entry.anatomyImageUrl)}
                    alt={`${entry.name} muscle anatomy`}
                    sx={{
                      mt: 1.5,
                      width: "100%",
                      height: { xs: 280, sm: 340, md: 380 },
                      objectFit: "contain",
                      borderRadius: 1,
                      bgcolor: "rgba(19,10,39,0.7)",
                      display: "block",
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      minHeight: { xs: 280, sm: 340, md: 380 },
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      No anatomy image uploaded.
                    </Typography>
                  </Box>
                )}
              </Box>
            </Grid>
            <Grid
              item
              xs={12}
              md={3}
              sx={{
                alignSelf: "flex-start",
                mt: { xs: 0, md: 8.75 },
              }}
            >
              <Grid
                container
                direction="column"
                wrap="nowrap"
                spacing={0.75}
              >
                <DetailField label="Muscle group" value={entry.muscleGroup} full />
                <DetailField label="Type" value={entry.type} full />
                <DetailField label="Level" value={entry.level} full />
                <DetailField label="Default sets" value={entry.defaultSets} full />
                <DetailField
                  label={entry.category === "HOLD" ? "Duration" : "Default reps"}
                  value={entry.category === "HOLD"
                    ? (entry.duration == null ? null : `${entry.duration} sec`)
                    : entry.defaultReps}
                  full
                />
              </Grid>
            </Grid>
          </Grid>

          <Divider sx={{ my: 2.5 }} />
          <Grid container spacing={1.5}>
            <DetailField label="Description" value={entry.description} full />
            <Grid item xs={12}>
              <Box sx={{ border: `1px solid ${CM.border}`, bgcolor: "rgba(19,10,39,0.6)", borderRadius: 1.5, p: 1.75 }}>
                <Typography variant="caption" sx={{ color: CM.textDim, textTransform: "uppercase", fontSize: 10, fontWeight: 700 }}>
                  Guide
                </Typography>
                <Box sx={{ mt: 1.5 }}>
                  <GuideSteps guide={entry.guide} />
                </Box>
              </Box>
            </Grid>
            <DetailField label="Source" value={entry.source === "CUSTOM" ? "Custom" : "System"} />
            {entry.source === "SYSTEM" && (
              <Grid item xs={12} sm={4} sx={{ display: "flex", alignItems: "center" }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AccountTreeRoundedIcon />}
                >
                  Calisthenics exercise tree
                </Button>
              </Grid>
            )}
            {entry.source === "CUSTOM" && <DetailField label="Created by" value={entry.createdByName} />}
          </Grid>
        </CardContent>
      </Card>
      )}
    </Box>
  );
}
