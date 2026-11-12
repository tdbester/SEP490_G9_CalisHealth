import { Link as RouterLink, useParams } from "react-router-dom";
import { Component, useEffect, useState } from "react";
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
import { keyframes } from "@mui/material/styles";
import { useTranslation, withTranslation } from "react-i18next";
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
import MediaWithFallback from "../components/common/MediaWithFallback";
import ConfirmDialog from "../components/common/ConfirmDialog";
import PhysiologyPanel from "../components/exercise/PhysiologyPanel";
import {
  ExerciseFields,
  buildPhysiologyPayload,
  validateExerciseUpload,
  validatePhysiology,
} from "./ExerciseFormPage";
import { EMPTY_PHYSIOLOGY } from "../components/exercise/ExercisePhysiologyFields";

function getUploadedDemoVideoUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const apiUrl = new URL(import.meta.env.VITE_API_URL || "http://localhost:8080/api", window.location.origin);
    const videoUrl = new URL(value.trim(), apiUrl.origin);
    const isLocalUpload =
      videoUrl.origin === apiUrl.origin &&
      /^\/media\/exercise-demos\/[^/]+\.(mp4|mov|webm)$/i.test(videoUrl.pathname);
    const isCloudinaryUpload =
      videoUrl.origin === "https://res.cloudinary.com" &&
      /\/video\/upload\/.*\/exercise-demos\/[^/]+\.(mp4|mov|webm)$/i.test(videoUrl.pathname);
    if (!isLocalUpload && !isCloudinaryUpload) {
      return null;
    }
    return videoUrl.href;
  } catch {
    return null;
  }
}

const rise = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;
const enter = (delay = 0) => ({
  animation: `${rise} .45s ease-out ${delay}ms both`,
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
});

function DetailField({ label, value, full, sx }) {
  return (
    <Grid item xs={12} sm={full ? 12 : 4} sx={sx}>
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          border: `1px solid ${CM.border}`,
          bgcolor: CM.surfaceSoft,
          borderRadius: "14px",
          p: { xs: 1.5, sm: 1.5 },
          height: "100%",
          transition: "all .2s ease",
          "&:hover": { borderColor: CM.borderStrong },
        }}
      >
        <Typography
          variant="caption"
          sx={{ color: CM.textDim, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 10, fontWeight: 700 }}
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
  const { t } = useTranslation();
  const steps = String(guide || "")
    .split("\n")
    .map((step) => step.trim())
    .filter(Boolean);
  if (steps.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t("contentManager.detail.noGuideSteps")}
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

class ExerciseDetailErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Exercise detail page failed to render", error, info);
  }

  render() {
    const { t } = this.props;
    if (this.state.hasError) {
      return (
        <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 2, sm: 3 }, py: 4 }}>
          <ContentPageHeader
            breadcrumb={[
              { labelKey: "nav.contentManagerRole", to: CONTENT_PATHS.dashboard },
              { labelKey: "nav.exerciseAndWorkout", to: CONTENT_PATHS.exercises },
              { labelKey: "nav.exerciseDetails" },
            ]}
            title={t("contentManager.detail.exerciseUnavailable")}
          />
          <Alert
            severity="error"
            sx={{ mt: 2 }}
            action={
              <Button color="inherit" size="small" onClick={() => this.setState({ hasError: false })}>
                {t("contentManager.detail.tryAgain")}
              </Button>
            }
          >
            {t("contentManager.detail.unexpectedError")}
          </Alert>
          <Button
            component={RouterLink}
            to={CONTENT_PATHS.exercises}
            sx={{ mt: 2 }}
            startIcon={<ArrowBackRoundedIcon />}
          >
            {t("contentManager.detail.backToExerciseList")}
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

/**
 * Error boundary là class component nên không dùng được hook.
 * Bọc bằng withTranslation để nhận `t` từ props.
 */
const TranslatedErrorBoundary = withTranslation()(ExerciseDetailErrorBoundary);

function SystemExerciseDetailContent() {
  const { t } = useTranslation();
  const { code = "" } = useParams();
  const { levels: LEVEL_OPTIONS } = useLevelNames();
  const { data: entry, isLoading, error, refetch } = useApiQuery(
    () => contentManagerApi.exercise(code),
    { enabled: Boolean(code), deps: [code] },
  );
  const [editing, setEditing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [form, setForm] = useState(null);
  const [video, setVideo] = useState(null);
  const [image, setImage] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [videoError, setVideoError] = useState(null);
  const [imageError, setImageError] = useState(null);
  const [physiology, setPhysiology] = useState(EMPTY_PHYSIOLOGY);
  const [physiologyEnabled, setPhysiologyEnabled] = useState(false);
  const demoVideoUrl = entry
    ? getUploadedDemoVideoUrl(entry.videoUrl || entry.demoVideoUrl || entry.video_url)
    : null;

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
      muscleGroup: typeof entry.muscleGroup === "string"
        ? entry.muscleGroup.split(" · ").filter(Boolean)
        : [],
      guide: entry.guide || "",
    });
    // Nạp hồ sơ sinh lý sẵn có của bài tập hệ thống để CM chỉnh sửa tiếp.
    const current = entry.physiology || null;
    setPhysiologyEnabled(Boolean(current));
    setPhysiology({
      ...EMPTY_PHYSIOLOGY,
      ...(current || {}),
      contraindications: Array.isArray(current?.contraindications) ? current.contraindications : [],
      evidenceRefs: Array.isArray(current?.evidenceRefs) ? current.evidenceRefs : [],
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
      onError: (requestError) => {
        const message = requestError.message || "";
        setSaveError(/already exists|duplicate/i.test(message) ? t("contentManager.form.errDuplicateName") : message);
      },
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
        muscleGroup: typeof entry.muscleGroup === "string"
          ? entry.muscleGroup.split(" · ").filter(Boolean)
          : [],
        guide: entry.guide || "",
      });
      const current = entry.physiology || null;
      setPhysiologyEnabled(Boolean(current));
      setPhysiology({
        ...EMPTY_PHYSIOLOGY,
        ...(current || {}),
        contraindications: Array.isArray(current?.contraindications) ? current.contraindications : [],
        evidenceRefs: Array.isArray(current?.evidenceRefs) ? current.evidenceRefs : [],
      });
    }
  };

  const crumb = [
    { labelKey: "nav.contentManagerRole", to: CONTENT_PATHS.dashboard },
    { labelKey: "nav.exerciseAndWorkout", to: CONTENT_PATHS.exercises },
    { labelKey: "nav.exerciseDetails" },
  ];

  if (isLoading) {
    return (
      <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 2, sm: 3 }, py: 4 }}>
        <ContentPageHeader breadcrumb={crumb} title={t("contentManager.detail.loadingExercise")} />
        <Box sx={{ py: 8, display: "grid", placeItems: "center" }}>
          <CircularProgress size={24} />
        </Box>
      </Box>
    );
  }

  if (error || !entry) {
    return (
      <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 2, sm: 3 }, py: 4 }}>
        <ContentPageHeader breadcrumb={crumb} title={t("contentManager.detail.exerciseNotFound")} />
        <Alert
          severity="warning"
          sx={{ mt: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              {t("contentManager.detail.tryAgain")}
            </Button>
          }
        >
          {error?.message || t("contentManager.detail.entryDeleted")}
        </Alert>
        <Button
          component={RouterLink}
          to={CONTENT_PATHS.exercises}
          sx={{ mt: 2 }}
          startIcon={<ArrowBackRoundedIcon />}
        >
          {t("contentManager.detail.backToExerciseList")}
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2.5, sm: 3 } }}>
      <ContentPageHeader
        breadcrumb={crumb}
        title={entry.name}
        description={t("contentManager.detail.exerciseDetailsMeta", { code: entry.code })}
        action={
          <Stack direction="row" spacing={1}>
            {entry.source === "SYSTEM" && !editing && (
              <>
                <Button
                  component={RouterLink}
                  to={`${CONTENT_PATHS.progressionRules}/tree?highlight=${encodeURIComponent(entry.code || "")}`}
                  variant="contained"
                  sx={{
                    backgroundColor: "#7c5dfa",
                    "&:hover": { backgroundColor: "#6c47ff" },
                    color: "#fff",
                    minWidth: 180,
                    height: 42,
                    borderRadius: "16px",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    px: 2.5,
                    textTransform: "none",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.18)",
                    transition: "all 150ms ease",
                  }}
                >
                  {t("contentManager.detail.exerciseTree")}
                </Button>
                <Button variant="contained" startIcon={<EditRoundedIcon />} onClick={() => setEditing(true)}>
                  {t("contentManager.detail.edit")}
                </Button>
              </>
            )}
            <Button component={RouterLink} to={CONTENT_PATHS.exercises} variant="outlined" startIcon={<ArrowBackRoundedIcon />}>
              {t("contentManager.detail.backToList")}
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
              setSaveError(t("contentManager.detail.pleaseCorrectBeforeSaving"));
              return;
            }
            if (physiologyEnabled && !validatePhysiology(physiology)) {
              setSaveError(t("contentManager.form.physiology.errInvalidProfile"));
              return;
            }
            saveMutation.mutate({
              data: {
                ...form,
                defaultSets: Number(form.defaultSets),
                defaultReps: form.category === "REPS" ? Number(form.value) : null,
                duration: form.category === "HOLD" ? Number(form.value) : null,
                muscleGroup: form.muscleGroup.join(" · "),
                physiology: physiologyEnabled ? buildPhysiologyPayload(physiology) : null,
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
                {t("contentManager.detail.currentImageKept")}
              </Typography>
            ) : null}
            showPhysiology
            physiology={physiology}
            onPhysiologyChange={setPhysiology}
            physiologyEnabled={physiologyEnabled}
            onPhysiologyEnabledChange={(next) => {
              setPhysiologyEnabled(next);
              setSaveError("");
            }}
          />
          {saveError && <Alert severity="error" sx={{ mt: 2 }}>{saveError}</Alert>}
          <Divider sx={{ mt: 3 }} />
          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ pt: 1.5 }}>
            <Button startIcon={<CloseRoundedIcon />} onClick={() => setConfirmCancel(true)}>{t("contentManager.form.cancel")}</Button>
            <Button type="submit" form="edit-exercise-form" variant="contained" startIcon={<SaveRoundedIcon />} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? t("contentManager.detail.saving") : t("contentManager.detail.saveChanges")}
            </Button>
          </Stack>
        </Box>
      ) : (
      <Card sx={{ mt: 2.5, overflow: "hidden", ...enter(150) }}>
        <CardContent sx={{ p: { xs: 2.25, sm: 3 } }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#fff" }}>
            {t("contentManager.detail.demoVideo")}
          </Typography>
          {demoVideoUrl ? (
            <MediaWithFallback
              kind="video"
              src={demoVideoUrl}
              alt={`${entry.name} demo video`}
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
            <Stack spacing={1} alignItems="flex-start" sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {t("contentManager.detail.noUploadedDemo")}
              </Typography>
            </Stack>
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
                  {t("contentManager.detail.muscleAnatomy")}
                </Typography>
                {entry.anatomyImageUrl ? (
                  <MediaWithFallback
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
                      {t("contentManager.detail.noAnatomyImage")}
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
                <DetailField label={t("contentManager.detail.muscleGroup")} value={entry.muscleGroup} full />
                <DetailField label={t("contentManager.detail.type")} value={entry.type} full />
                <DetailField label={t("contentManager.detail.level")} value={entry.level} full />
                <DetailField label={t("contentManager.detail.defaultSets")} value={entry.defaultSets} full />
                <DetailField
                  label={entry.category === "HOLD" ? t("contentManager.detail.duration") : t("contentManager.detail.defaultReps")}
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
            <DetailField label={t("contentManager.detail.description")} value={entry.description} full />
            <Grid item xs={12}>
              <Box sx={{ border: `1px solid ${CM.border}`, bgcolor: "rgba(19,10,39,0.6)", borderRadius: 1.5, p: 1.75 }}>
                <Typography variant="caption" sx={{ color: CM.textDim, textTransform: "uppercase", fontSize: 10, fontWeight: 700 }}>
                  {t("contentManager.detail.guide")}
                </Typography>
                <Box sx={{ mt: 1.5 }}>
                  <GuideSteps guide={entry.guide} />
                </Box>
              </Box>
            </Grid>
            <DetailField label={t("contentManager.detail.source")} value={entry.source === "CUSTOM" ? t("contentManager.detail.sourceCustom") : t("contentManager.detail.sourceSystem")} />
            {entry.source === "SYSTEM" && (
              <Grid item xs={12} sm={4} sx={{ display: "flex", alignItems: "center" }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AccountTreeRoundedIcon />}
                >
                  {t("contentManager.detail.calisthenicsTree")}
                </Button>
              </Grid>
            )}
            {entry.source === "CUSTOM" && <DetailField label={t("contentManager.detail.createdBy")} value={entry.createdByName} />}
          </Grid>

          {/* Hồ sơ sinh lý (V76) chỉ có ở bài của hệ thống — bài Member tải lên không có nguồn học thuật. */}
          {entry.source === "SYSTEM" && (
            <Box sx={{ mt: 2.5 }}>
              <PhysiologyPanel physiology={entry.physiology} />
            </Box>
          )}
        </CardContent>
      </Card>
      )}
      <ConfirmDialog
        open={confirmCancel}
        title={t("contentManager.detail.discardTitle")}
        message={t("contentManager.detail.discardMessage")}
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

export default function SystemExerciseDetailPage() {
  const { code = "" } = useParams();

  return (
    <TranslatedErrorBoundary key={code}>
      <SystemExerciseDetailContent />
    </TranslatedErrorBoundary>
  );
}
