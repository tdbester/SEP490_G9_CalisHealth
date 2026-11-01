import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormHelperText,
  IconButton,
  InputAdornment,
  MenuItem,
  Pagination,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { keyframes } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import FitnessCenterRoundedIcon from "@mui/icons-material/FitnessCenterRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/KeyboardArrowUpRounded";
import KeyboardArrowLeftRoundedIcon from "@mui/icons-material/KeyboardArrowLeftRounded";
import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import VideoLibraryRoundedIcon from "@mui/icons-material/VideoLibraryRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import { contentManagerApi } from "../api/contentManager";
import { useLevelNames } from "../useLevelNames";
import { useApiMutation, useApiQuery } from "../hooks";
import { CONTENT_PATHS, ContentPageHeader, DarkPill, TONE_STYLES } from "../components/ContentShared";
import { CM } from "../theme-content";

const rise = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;
const enter = (delay = 0) => ({
  animation: `${rise} .45s ease-out ${delay}ms both`,
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
});

const SYSTEM_PAGE_SIZE = 6;
const ITEM_PAGE_SIZE = 2;
const MUSCLE_OPTIONS = ["Chest", "Back", "Shoulders", "Arms", "Core", "Legs", "Glutes"];
const CATEGORY_OPTIONS = ["REPS", "HOLD"];
const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

const BREADCRUMB = [
  { label: "Content manager", to: CONTENT_PATHS.dashboard },
  { label: "Exercise & Workout", to: CONTENT_PATHS.exercises },
  { label: "Create content" },
];

const EMPTY_EXERCISE = {
  name: "",
  type: "HEALTH",
  description: "",
  category: "REPS",
  value: 10,
  defaultSets: 3,
  // Filled with the first configured level once levels load (see ExerciseFormPage).
  level: "",
  guide: "",
};

const EMPTY_WORKOUT = {
  name: "",
  description: "",
  type: "FLEX",
  level: "",
  // Mỗi bài trong workout: { exerciseCode, countBy: "REPS" | "DURATION", sets, reps, durationSeconds, restSeconds }
  items: [],
  planItems: [],
};

/**
 * Cấu hình ban đầu của một bài khi thêm vào workout. countBy cố định theo exercises.category
 * (HOLD = Duration, REPS = Sets & Reps), người dùng không đổi được.
 */
export function defaultWorkoutItem(exercise) {
  const byDuration = String(exercise.category || "").toUpperCase() === "HOLD";
  return {
    exerciseCode: exercise.code,
    countBy: byDuration ? "DURATION" : "REPS",
    sets: exercise.defaultSets ?? 3,
    reps: exercise.defaultReps ?? 10,
    durationSeconds: exercise.duration ?? 30,
    restSeconds: 60,
  };
}

/** Lỗi của một dòng bài tập; trả về object rỗng nếu hợp lệ. */
export function workoutItemErrors(item) {
  const errors = {};
  if (!Number.isInteger(item.sets) || item.sets < 1 || item.sets > 20) errors.sets = "1–20";
  if (item.countBy === "DURATION") {
    if (!Number.isInteger(item.durationSeconds) || item.durationSeconds < 1 || item.durationSeconds > 3600) {
      errors.durationSeconds = "1–3600";
    }
  } else if (!Number.isInteger(item.reps) || item.reps < 1 || item.reps > 100) {
    errors.reps = "1–100";
  }
  if (!Number.isInteger(item.restSeconds) || item.restSeconds < 0 || item.restSeconds > 3600) {
    errors.restSeconds = "0–3600";
  }
  return errors;
}

/** Body gửi lên API: chỉ gửi trường phù hợp với cách đếm. */
export function toWorkoutItemRequests(items) {
  return items.map((item) => ({
    exerciseCode: item.exerciseCode,
    sets: item.sets,
    reps: item.countBy === "DURATION" ? null : item.reps,
    durationSeconds: item.countBy === "DURATION" ? item.durationSeconds : null,
    restSeconds: item.restSeconds,
  }));
}

/** Tổng kết ước tính: "3 exercises · 9 sets · About 11 min". */
export function summarizeWorkoutItems(items) {
  const totalSets = items.reduce((sum, item) => sum + (Number(item.sets) || 0), 0);
  const seconds = items.reduce((sum, item) => {
    const sets = Number(item.sets) || 0;
    const work = item.countBy === "DURATION" ? Number(item.durationSeconds) || 0 : (Number(item.reps) || 0) * 3;
    // Nghỉ sau mỗi hiệp, trừ hiệp cuối của bài.
    return sum + sets * work + Math.max(sets - 1, 0) * (Number(item.restSeconds) || 0);
  }, 0);
  const minutes = Math.max(Math.round(seconds / 60), items.length ? 1 : 0);
  return `${items.length} exercise${items.length === 1 ? "" : "s"} · ${totalSets} sets · About ${minutes} min`;
}

function extensionOf(file) {
  return file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
}

function fileSizeMb(file) {
  return (file.size / (1024 * 1024)).toFixed(1);
}

/** Validate file phía client trước khi gửi (BE cũng kiểm tra lại). */
function validateFile(file, { maxSize, allowedTypes, allowedExtensions, label }) {
  if (file.size > maxSize) {
    return `${label} must be ${Math.round(maxSize / (1024 * 1024))} MB or smaller.`;
  }
  if (
    !allowedExtensions.includes(extensionOf(file)) ||
    (file.type && !allowedTypes.includes(file.type))
  ) {
    return `${label}: choose ${allowedExtensions.join(", ")}.`;
  }
  return null;
}

/* ------------------------------- Guide editor ------------------------------ */

function GuideEditor({ value, onChange }) {
  const steps = value ? value.split("\n") : [""];

  const updateStep = (index, step) => {
    const next = [...steps];
    next[index] = step;
    onChange(next.join("\n"));
  };

  const removeStep = (index) => onChange(steps.filter((_, i) => i !== index).join("\n"));

  return (
    <Stack spacing={1} sx={{ mt: 1 }}>
      {steps.map((step, index) => (
        <Stack key={index} direction="row" spacing={1} alignItems="center">
          <Typography
            variant="caption"
            sx={{ width: 18, textAlign: "right", color: "primary.main", flexShrink: 0 }}
          >
            {index + 1}
          </Typography>
          <TextField
            size="small"
            fullWidth
            value={step}
            onChange={(event) => updateStep(index, event.target.value)}
            placeholder={
              index === 0 ? "e.g. Start in a plank with hands under shoulders" : "Next step"
            }
            inputProps={{ "aria-label": `Guide step ${index + 1}` }}
          />
          <Button
            type="button"
            color="error"
            aria-label={`Remove guide step ${index + 1}`}
            disabled={steps.length === 1}
            onClick={() => removeStep(index)}
            sx={{ minWidth: 0, px: 1 }}
          >
            <CloseRoundedIcon fontSize="small" />
          </Button>
        </Stack>
      ))}
      <Box>
        <Button
          type="button"
          size="small"
          variant="outlined"
          startIcon={<AddRoundedIcon />}
          onClick={() => onChange([...steps, ""].join("\n"))}
        >
          Add step
        </Button>
      </Box>
    </Stack>
  );
}

/* ------------------------------ Exercise form ------------------------------ */

function FileDropField({ label, hint, accept, file, error, onChange, preview }) {
  return (
    <Box
      sx={{
        border: "1px dashed",
        borderColor: error ? "error.main" : CM.borderStrong,
        borderRadius: "14px",
        p: 2.25,
        bgcolor: "rgba(139,92,246,0.03)",
        transition: "all .2s ease",
        "&:hover": { borderColor: CM.violetBright, bgcolor: "rgba(139,92,246,0.06)" },
      }}
    >
      <Typography variant="body2" fontWeight={700} sx={{ color: "#fff" }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ color: CM.textMuted }} display="block">
        {hint}
      </Typography>
      <Button
        component="label"
        variant="outlined"
        size="small"
        startIcon={<CloudUploadRoundedIcon />}
        sx={{ mt: 1.5, borderColor: CM.borderStrong, bgcolor: "rgba(139,92,246,0.1)", transition: "all .2s ease", "&:hover": { borderColor: CM.violetBright, bgcolor: "rgba(139,92,246,0.2)" } }}
      >
        Choose file
        <input
          hidden
          type="file"
          accept={accept}
          aria-invalid={Boolean(error)}
          aria-label={label}
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        />
      </Button>
      {file && (
        <Typography variant="caption" sx={{ color: CM.green, fontWeight: 600, mt: 1, display: "block" }}>
          Selected: {file.name} ({fileSizeMb(file)} MB)
        </Typography>
      )}
      {preview}
      {error && <FormHelperText error>{error}</FormHelperText>}
    </Box>
  );
}

function LocalImagePreview({ file }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!url) return null;
  return (
    <Box
      component="img"
      src={url}
      alt="Selected muscle anatomy preview"
      sx={{
        mt: 1.5,
        width: "100%",
        maxHeight: 260,
        objectFit: "contain",
        borderRadius: 1.5,
        bgcolor: "background.default",
      }}
    />
  );
}

export function validateExerciseUpload(file, kind) {
  if (!file) return null;
  const isVideo = kind === "video";
  return validateFile(file, {
    maxSize: isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE,
    allowedTypes: isVideo ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES,
    allowedExtensions: isVideo ? ALLOWED_VIDEO_EXTENSIONS : ALLOWED_IMAGE_EXTENSIONS,
    label: isVideo ? "Video" : "Image",
  });
}

export function ExerciseFields({
  value,
  onChange,
  selectedMuscles,
  onToggleMuscle,
  onClearField,
  invalid,
  demoVideo,
  demoVideoError,
  onDemoVideoChange,
  demoVideoPreview,
  anatomyImage,
  anatomyImageError,
  onAnatomyImageChange,
  anatomyImagePreview,
}) {
  const { levels: LEVELS, activeLevels } = useLevelNames();
  return (
    <Stack spacing={2.5}>
      <Card sx={{ overflow: "hidden", position: "relative" }}>
        <CardContent sx={{ p: { xs: 2.25, sm: 3 } }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
            <Box sx={{ width: 34, height: 34, borderRadius: "10px", display: "grid", placeItems: "center", bgcolor: "rgba(139,92,246,0.15)", border: `1px solid ${CM.border}` }}>
              <FitnessCenterRoundedIcon sx={{ color: CM.violetBright, fontSize: 18 }} />
            </Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#fff" }}>
              Exercise details
            </Typography>
          </Stack>
          <Stack spacing={2}>
            <TextField
              label="Title"
              required
              size="small"
              value={value.name}
              onChange={(event) => {
                onChange({ ...value, name: event.target.value });
                onClearField("title");
              }}
              placeholder="e.g. Archer push-up"
              inputProps={{ maxLength: 120 }}
              error={invalid.title}
              helperText={invalid.title ? "Enter a title of 1–120 characters." : ` ${value.name.length}/120`}
            />
            <TextField
              label="Description"
              size="small"
              multiline
              minRows={3}
              value={value.description}
              onChange={(event) => onChange({ ...value, description: event.target.value })}
              placeholder="What does this exercise train, and who is it for?"
              inputProps={{ maxLength: 300 }}
              helperText={`${value.description.length}/300`}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                select
                label="Type"
                size="small"
                fullWidth
                value={value.type}
                onChange={(event) => {
                  onChange({ ...value, type: event.target.value });
                  onClearField("type");
                }}
                error={invalid.type}
                helperText={invalid.type ? "Choose Health or Skill." : " "}
              >
                <MenuItem value="HEALTH">Health</MenuItem>
                <MenuItem value="SKILL">Skill</MenuItem>
              </TextField>
              <TextField
                select
                label="Category"
                size="small"
                fullWidth
                value={value.category}
                onChange={(event) => onChange({ ...value, category: event.target.value })}
                helperText=" "
              >
                <MenuItem value="">Select a category</MenuItem>
                {CATEGORY_OPTIONS.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category === "REPS" ? "Count reps" : "Hold (plank / timed)"}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label={value.category === "HOLD" ? "Hold duration" : "Number of reps"}
                type="number"
                size="small"
                fullWidth
                value={value.value}
                onChange={(event) => onChange({ ...value, value: event.target.value })}
                inputProps={{ min: 1, max: 3600, step: 1 }}
                InputProps={{ endAdornment: <InputAdornment position="end">{value.category === "HOLD" ? "sec" : "reps"}</InputAdornment> }}
                error={invalid.value}
                helperText={invalid.value ? "Enter a whole number from 1 to 3600." : " "}
              />
              <TextField
                label="Default Sets"
                type="number"
                size="small"
                fullWidth
                value={value.defaultSets}
                onChange={(event) => onChange({ ...value, defaultSets: event.target.value })}
                inputProps={{ min: 1, max: 20, step: 1 }}
                error={invalid.defaultSets}
                helperText={invalid.defaultSets ? "Enter a whole number from 1 to 20." : " "}
              />
            </Stack>

            <Box>
              <Typography variant="caption" color="text.secondary">
                Level
              </Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                value={value.level}
                onChange={(_, next) => {
                  if (!next) return;
                  onChange({ ...value, level: next });
                  onClearField("level");
                }}
                aria-label="Exercise level"
                sx={{
                  mt: 0.75,
                  "& .MuiToggleButton-root": invalid.level ? { borderColor: "error.main" } : undefined,
                }}
              >
                {LEVELS.map((level) => {
                  // An inactive level cannot receive exercises; an exercise already at one keeps showing it.
                  const unavailable = !activeLevels.includes(level) && value.level !== level;
                  return (
                    <ToggleButton key={level} value={level} disabled={unavailable} sx={{ fontSize: 12.5 }}>
                      {unavailable ? `${level} (inactive)` : level}
                    </ToggleButton>
                  );
                })}
              </ToggleButtonGroup>
            </Box>

            <Box
              sx={{
                border: 1,
                borderColor: invalid.muscles ? "error.main" : "transparent",
                borderRadius: 1,
                p: invalid.muscles ? 0.75 : 0,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Muscle groups
              </Typography>
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ mt: 0.75 }}>
                {MUSCLE_OPTIONS.map((muscle) => {
                  const selected = selectedMuscles.includes(muscle);
                  return (
                    <Chip
                      key={muscle}
                      label={muscle}
                      clickable
                      onClick={() => onToggleMuscle(muscle)}
                      color={selected ? "primary" : "default"}
                      variant={selected ? "filled" : "outlined"}
                      aria-pressed={selected}
                    />
                  );
                })}
              </Stack>
              {invalid.muscles && (
                <FormHelperText error>Select at least one muscle group.</FormHelperText>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ overflow: "hidden" }}>
        <CardContent sx={{ p: { xs: 2.25, sm: 3 } }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
            <Box sx={{ width: 34, height: 34, borderRadius: "10px", display: "grid", placeItems: "center", bgcolor: "rgba(139,92,246,0.15)", border: `1px solid ${CM.border}` }}>
              <MenuBookRoundedIcon sx={{ color: CM.violetBright, fontSize: 18 }} />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#fff" }}>
                Guide
              </Typography>
              <Typography variant="caption" sx={{ color: CM.textMuted }}>
                Add one action step at a time, in order.
              </Typography>
            </Box>
          </Stack>
          <GuideEditor value={value.guide} onChange={(guide) => onChange({ ...value, guide })} />
        </CardContent>
      </Card>

      <Card sx={{ overflow: "hidden" }}>
        <CardContent sx={{ p: { xs: 2.25, sm: 3 } }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}>
            <Box sx={{ width: 34, height: 34, borderRadius: "10px", display: "grid", placeItems: "center", bgcolor: "rgba(139,92,246,0.15)", border: `1px solid ${CM.border}` }}>
              <VideoLibraryRoundedIcon sx={{ color: CM.violetBright, fontSize: 18 }} />
            </Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#fff" }}>
              Demo video
            </Typography>
          </Stack>
          <FileDropField
            label="Upload video file"
            hint="MP4, MOV or WebM · up to 50 MB"
            accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
            file={demoVideo}
            error={demoVideoError}
            onChange={onDemoVideoChange}
          />
        </CardContent>
      </Card>

      <Card sx={{ overflow: "hidden" }}>
        <CardContent sx={{ p: { xs: 2.25, sm: 3 } }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}>
            <Box sx={{ width: 34, height: 34, borderRadius: "10px", display: "grid", placeItems: "center", bgcolor: "rgba(139,92,246,0.15)", border: `1px solid ${CM.border}` }}>
              <ImageRoundedIcon sx={{ color: CM.violetBright, fontSize: 18 }} />
            </Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#fff" }}>
              Muscle anatomy image
            </Typography>
          </Stack>
          <FileDropField
            label="Upload anatomy image"
            hint="JPG, PNG or WebP · up to 10 MB"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            file={anatomyImage}
            error={anatomyImageError}
            onChange={onAnatomyImageChange}
            preview={anatomyImagePreview || <LocalImagePreview file={anatomyImage} />}
          />
        </CardContent>
      </Card>
    </Stack>
  );
}

/* ------------------------------ Workout form ------------------------------- */

function PlanLevelInputs({ label, sets, reps, onSetsChange, onRepsChange }) {
  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1 }}>
      <Typography variant="caption" fontWeight={600} sx={{ fontSize: 10.5 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
        <TextField
          label="Sets"
          type="number"
          size="small"
          value={sets}
          onChange={(event) => onSetsChange(Number(event.target.value))}
          inputProps={{ min: 1, max: 20 }}
          InputLabelProps={{ shrink: true, sx: { fontSize: 11 } }}
          sx={{ "& input": { fontSize: 12, py: 0.75 } }}
        />
        <TextField
          label="Reps"
          type="number"
          size="small"
          value={reps}
          onChange={(event) => onRepsChange(Number(event.target.value))}
          inputProps={{ min: 1, max: 100 }}
          InputLabelProps={{ shrink: true, sx: { fontSize: 11 } }}
          sx={{ "& input": { fontSize: 12, py: 0.75 } }}
        />
      </Stack>
    </Box>
  );
}

function ItemNumberField({ label, value, onChange, min, max, error, unit }) {
  return (
    <TextField
      label={label}
      type="number"
      size="small"
      fullWidth
      value={Number.isFinite(value) ? value : ""}
      onChange={(event) => onChange(event.target.value === "" ? NaN : Number(event.target.value))}
      error={Boolean(error)}
      helperText={error || " "}
      inputProps={{ min, max, style: { textAlign: "center" } }}
      InputProps={unit ? { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> } : undefined}
      InputLabelProps={{ shrink: true }}
      FormHelperTextProps={{ sx: { mx: 0, minHeight: 16, fontSize: 10.5 } }}
    />
  );
}

/**
 * Chân phân trang: "Showing 1–6 of 63 exercises" bên trái, Previous · số trang · Next bên phải.
 * Nút chuyển trang ẩn khi chỉ có một trang.
 */
function ListPager({ page, count, total, pageSize, noun, onChange, label }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      flexWrap="wrap"
      sx={{ mt: 2, pt: 1.5, borderTop: 1, borderColor: "divider", columnGap: 1.5, rowGap: 1 }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
        Showing {from}–{to} of {total} {noun}
      </Typography>
      {count > 1 && (
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0, flexWrap: "nowrap", ml: "auto" }}>
          <Button
            type="button"
            size="small"
            variant="outlined"
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
            startIcon={<KeyboardArrowLeftRoundedIcon fontSize="small" />}
            sx={{ fontSize: 11, minWidth: 0 }}
            aria-label={`${label} previous page`}
          >
            Previous
          </Button>
          <Pagination
            size="small"
            shape="rounded"
            color="primary"
            page={page}
            count={count}
            siblingCount={0}
            boundaryCount={1}
            hidePrevButton
            hideNextButton
            sx={{ "& .MuiPagination-ul": { flexWrap: "nowrap" }, "& .MuiPaginationItem-root": { whiteSpace: "nowrap", flexShrink: 0 } }}
            onChange={(_, next) => onChange(next)}
            getItemAriaLabel={(type, itemPage) => `${label} page ${itemPage}`}
          />
          <Button
            type="button"
            size="small"
            variant="outlined"
            disabled={page >= count}
            onClick={() => onChange(page + 1)}
            endIcon={<KeyboardArrowRightRoundedIcon fontSize="small" />}
            sx={{ fontSize: 11, minWidth: 0 }}
            aria-label={`${label} next page`}
          >
            Next
          </Button>
        </Stack>
      )}
    </Stack>
  );
}

/** Thẻ một bài trong workout: count by, sets, reps / duration, rest, đổi thứ tự và xoá. */
function WorkoutItemCard({ item, index, total, entry, showErrors, onChange, onMove, onRemove }) {
  const errors = showErrors ? workoutItemErrors(item) : {};
  const byDuration = item.countBy === "DURATION";
  const name = entry?.name || item.exerciseCode;

  return (
    <Box component="li" sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, p: 1.5 }}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Box
          sx={{
            width: 24,
            height: 24,
            borderRadius: "7px",
            bgcolor: "rgba(139,92,246,0.18)",
            color: CM.violetBright,
            fontSize: 11,
            fontWeight: 700,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          {index + 1}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap display="block">
            {entry?.muscleGroup || " "}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
          <IconButton size="small" aria-label={`Move ${name} up`} disabled={index === 0} onClick={() => onMove(-1)}>
            <KeyboardArrowUpRoundedIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            aria-label={`Move ${name} down`}
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <KeyboardArrowDownRoundedIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" aria-label={`Remove ${name}`} onClick={onRemove}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      {/* Count by cố định theo category của bài tập, chỉ hiển thị. */}
      <Box sx={{ mt: 1.5 }}>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
          Count by
        </Typography>
        <Box
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            py: 0.75,
            textAlign: "center",
            fontSize: 13,
            fontWeight: 600,
            bgcolor: "rgba(255,255,255,0.03)",
          }}
        >
          {byDuration ? "Duration" : "Sets & Reps"}
        </Box>
      </Box>

      <Box sx={{ mt: 1.5, display: "grid", gap: 1, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <ItemNumberField
          label="Sets"
          value={item.sets}
          min={1}
          max={20}
          error={errors.sets}
          onChange={(sets) => onChange({ sets })}
        />
        {byDuration ? (
          <ItemNumberField
            label="Duration"
            unit="sec"
            value={item.durationSeconds}
            min={1}
            max={3600}
            error={errors.durationSeconds}
            onChange={(durationSeconds) => onChange({ durationSeconds })}
          />
        ) : (
          <ItemNumberField
            label="Reps"
            value={item.reps}
            min={1}
            max={100}
            error={errors.reps}
            onChange={(reps) => onChange({ reps })}
          />
        )}
        <ItemNumberField
          label="Rest"
          unit="sec"
          value={item.restSeconds}
          min={0}
          max={3600}
          error={errors.restSeconds}
          onChange={(restSeconds) => onChange({ restSeconds })}
        />
      </Box>
    </Box>
  );
}

/** Small dot in the level's own colour, shown next to level names in menus. */
function LevelDot({ tone }) {
  const color = (TONE_STYLES[tone] ?? TONE_STYLES.neutral).color;
  return <Box component="span" aria-hidden="true" sx={{ display: "inline-block", width: 8, height: 8, mr: 1, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />;
}

function ExercisePickerRow({ entry, onAdd, toneOf }) {
  return (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="center"
      sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, px: 1.25, py: 1, minHeight: 58 }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 32,
          height: 32,
          borderRadius: "9px",
          bgcolor: "rgba(139,92,246,0.15)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <FitnessCenterRoundedIcon sx={{ fontSize: 16, color: CM.violetBright }} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="body2" fontWeight={600} noWrap>
            {entry.name}
          </Typography>
          <Chip
            size="small"
            label={String(entry.type).toUpperCase() === "SKILL" ? "Skill" : "Health"}
            color={String(entry.type).toUpperCase() === "SKILL" ? "secondary" : "info"}
            sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
          />
          <DarkPill tone={toneOf(entry.level)} sx={{ height: 18, fontSize: 10 }}>{entry.level}</DarkPill>
        </Stack>
        <Typography variant="caption" color="text.secondary" noWrap display="block" sx={{ minHeight: 18 }}>
          {entry.muscleGroup || " "}
        </Typography>
      </Box>
      <Button
        type="button"
        size="small"
        variant="outlined"
        onClick={onAdd}
        sx={{ flexShrink: 0, fontSize: 11 }}
      >
        + Add
      </Button>
    </Stack>
  );
}

export function WorkoutFields({
  value,
  onChange,
  entries,
  allEntries,
  totalExerciseCount,
  isLoadingExercises,
  exerciseLoadError,
  search,
  onSearchChange,
  level,
  onLevelChange,
  hasSubmitted,
  selectedDay,
  onSelectedDayChange,
}) {
  const { levels: LEVELS, activeLevels, levelTone } = useLevelNames();
  const isDailyPlan = value.type === "DAILY_TRAINING_PLAN";
  const dayItems = value.planItems.filter((item) => item.dayOfWeek === selectedDay);
  const entryByCode = useMemo(() => {
    const map = new Map();
    allEntries.forEach((entry) => map.set(entry.code, entry));
    return map;
  }, [allEntries]);

  // Phân trang thay cho thanh trượt: "System exercises" và "Workout exercises" mỗi trang một số mục.
  const [systemPage, setSystemPage] = useState(1);
  const [itemPage, setItemPage] = useState(1);
  const systemPageCount = Math.max(1, Math.ceil(entries.length / SYSTEM_PAGE_SIZE));
  const itemPageCount = Math.max(1, Math.ceil(value.items.length / ITEM_PAGE_SIZE));
  const currentSystemPage = Math.min(systemPage, systemPageCount);
  const currentItemPage = Math.min(itemPage, itemPageCount);
  const pagedEntries = entries.slice((currentSystemPage - 1) * SYSTEM_PAGE_SIZE, currentSystemPage * SYSTEM_PAGE_SIZE);
  const itemOffset = (currentItemPage - 1) * ITEM_PAGE_SIZE;
  const pagedItems = value.items.slice(itemOffset, itemOffset + ITEM_PAGE_SIZE);
  // Đổi từ khoá hoặc level thì quay về trang đầu.
  useEffect(() => {
    setSystemPage(1);
  }, [search, level]);

  const addExercise = (exercise) => {
    if (isDailyPlan) {
      if (dayItems.some((item) => item.exerciseCode === exercise.code)) return;
      onChange({
        ...value,
        planItems: [
          ...value.planItems,
          {
            dayOfWeek: selectedDay,
            exerciseCode: exercise.code,
            beginnerSets: 3,
            beginnerReps: 10,
            intermediateSets: 3,
            intermediateReps: 12,
            advancedSets: 4,
            advancedReps: 12,
          },
        ],
      });
      return;
    }
    // Rest của bài mới mặc định là 60 giây, sửa được riêng từng bài.
    onChange({ ...value, items: [...value.items, defaultWorkoutItem(exercise)] });
    // Chuyển tới trang chứa bài vừa thêm.
    setItemPage(Math.floor(value.items.length / ITEM_PAGE_SIZE) + 1);
  };

  const updateItem = (index, patch) => {
    onChange({
      ...value,
      items: value.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    });
  };

  const moveItem = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= value.items.length) return;
    const next = [...value.items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ ...value, items: next });
  };

  const updatePlanItem = (code, field, nextValue) => {
    onChange({
      ...value,
      planItems: value.planItems.map((item) =>
        item.dayOfWeek === selectedDay && item.exerciseCode === code
          ? { ...item, [field]: nextValue }
          : item,
      ),
    });
  };

  const removeExercise = (code) => {
    if (isDailyPlan) {
      onChange({
        ...value,
        planItems: value.planItems.filter(
          (item) => !(item.dayOfWeek === selectedDay && item.exerciseCode === code),
        ),
      });
      return;
    }
    onChange({
      ...value,
      items: value.items.filter((_, index) => index !== code),
    });
  };

  const missingExercises =
    hasSubmitted &&
    ((isDailyPlan && value.planItems.length === 0) ||
      (!isDailyPlan && value.items.length === 0));

  return (
    <Stack spacing={2.5}>
      <Card sx={{ overflow: "hidden", position: "relative" }}>
        <CardContent sx={{ p: { xs: 2.25, sm: 3 } }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
            <Box sx={{ width: 34, height: 34, borderRadius: "10px", display: "grid", placeItems: "center", bgcolor: "rgba(139,92,246,0.15)", border: `1px solid ${CM.border}` }}>
              <FitnessCenterRoundedIcon sx={{ color: CM.violetBright, fontSize: 18 }} />
            </Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#fff" }}>
              Workout details
            </Typography>
          </Stack>
          <Stack spacing={2}>
            <TextField
              label="Title"
              required
              size="small"
              value={value.name}
              onChange={(event) => onChange({ ...value, name: event.target.value })}
              placeholder="e.g. Beginner full body"
              inputProps={{ maxLength: 60 }}
              error={hasSubmitted && !value.name.trim()}
              helperText={`${value.name.length}/60`}
            />
            <TextField
              label="Description"
              required
              size="small"
              multiline
              minRows={2}
              value={value.description}
              onChange={(event) => onChange({ ...value, description: event.target.value })}
              placeholder="A short summary shown in the workout list"
              inputProps={{ maxLength: 300 }}
              error={hasSubmitted && !value.description.trim()}
              helperText={`${value.description.length}/300`}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                select
                label="Type"
                size="small"
                fullWidth
                value={value.type}
                onChange={(event) => onChange({ ...value, type: event.target.value })}
              >
                <MenuItem value="HEALTH">Health</MenuItem>
                <MenuItem value="SKILL">Skill</MenuItem>
                <MenuItem value="FLEX">Flex</MenuItem>
              </TextField>
              <TextField
                select
                label="Level"
                size="small"
                fullWidth
                value={value.level}
                onChange={(event) => onChange({ ...value, level: event.target.value })}
              >
                {LEVELS.map((item) => {
                  // An inactive level cannot receive workouts; a workout already at one keeps showing it.
                  const unavailable = !activeLevels.includes(item) && value.level !== item;
                  return (
                    <MenuItem key={item} value={item} disabled={unavailable}>
                      <LevelDot tone={levelTone(item)} />
                      {unavailable ? `${item} (inactive)` : item}
                    </MenuItem>
                  );
                })}
              </TextField>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {isDailyPlan && (
        <Card>
          <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
              <Box>
                <Typography variant="subtitle2" fontWeight={700}>
                  7-day training schedule
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Select a day to add exercises. Leave it empty for a rest day.
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                {value.planItems.length} scheduled
              </Typography>
            </Stack>

            <Box
              sx={{
                mt: 2,
                display: "grid",
                gap: 1,
                gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)", lg: "repeat(7, 1fr)" },
              }}
            >
              {WEEK_DAYS.map((day, index) => {
                const number = index + 1;
                const count = value.planItems.filter((item) => item.dayOfWeek === number).length;
                const selected = selectedDay === number;
                return (
                  <Box
                    key={day}
                    component="button"
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelectedDayChange(number)}
                    sx={{
                      textAlign: "left",
                      cursor: "pointer",
                      borderRadius: 1.5,
                      border: 1,
                      borderColor: selected ? "primary.main" : "divider",
                      bgcolor: selected ? "primary.main" : "background.paper",
                      color: selected ? "#fff" : "text.primary",
                      p: 1,
                      font: "inherit",
                    }}
                  >
                    <Typography variant="caption" fontWeight={700} display="block">
                      {day}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ fontSize: 10.5, opacity: selected ? 0.85 : 0.7 }}
                    >
                      {count ? `${count} exercise${count === 1 ? "" : "s"}` : "Rest day"}
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            <Box
              sx={{
                mt: 2,
                border: 1,
                borderColor: hasSubmitted && value.planItems.length === 0 ? "error.main" : "divider",
                borderRadius: 2,
                p: 1.5,
              }}
            >
              <Typography variant="caption" fontWeight={700}>
                {WEEK_DAYS[selectedDay - 1]} exercises
              </Typography>
              {dayItems.length === 0 ? (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ py: 4, textAlign: "center" }}>
                  Rest day — add exercises below to make this a training day.
                </Typography>
              ) : (
                <Stack spacing={1.25} sx={{ mt: 1 }}>
                  {dayItems.map((item, index) => (
                    <Box key={`${item.dayOfWeek}-${item.exerciseCode}`} sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, p: 1.25 }}>
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ mt: 0.25 }}>
                          {index + 1}
                        </Typography>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {entryByCode.get(item.exerciseCode)?.name || item.exerciseCode}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap display="block">
                            {entryByCode.get(item.exerciseCode)?.muscleGroup}
                          </Typography>
                        </Box>
                        <Button
                          type="button"
                          color="error"
                          size="small"
                          aria-label={`Remove ${item.exerciseCode} from ${WEEK_DAYS[selectedDay - 1]}`}
                          onClick={() => removeExercise(item.exerciseCode)}
                          sx={{ minWidth: 0, px: 0.75, py: 0 }}
                        >
                          <CloseRoundedIcon fontSize="small" />
                        </Button>
                      </Stack>
                      <Box
                        sx={{
                          mt: 1,
                          display: "grid",
                          gap: 1,
                          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
                        }}
                      >
                        <PlanLevelInputs
                          label="Beginner"
                          sets={item.beginnerSets}
                          reps={item.beginnerReps}
                          onSetsChange={(n) => updatePlanItem(item.exerciseCode, "beginnerSets", n)}
                          onRepsChange={(n) => updatePlanItem(item.exerciseCode, "beginnerReps", n)}
                        />
                        <PlanLevelInputs
                          label="Intermediate"
                          sets={item.intermediateSets}
                          reps={item.intermediateReps}
                          onSetsChange={(n) => updatePlanItem(item.exerciseCode, "intermediateSets", n)}
                          onRepsChange={(n) => updatePlanItem(item.exerciseCode, "intermediateReps", n)}
                        />
                        <PlanLevelInputs
                          label="Advanced"
                          sets={item.advancedSets}
                          reps={item.advancedReps}
                          onSetsChange={(n) => updatePlanItem(item.exerciseCode, "advancedSets", n)}
                          onRepsChange={(n) => updatePlanItem(item.exerciseCode, "advancedReps", n)}
                        />
                      </Box>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: isDailyPlan ? "1fr" : "minmax(0, 1fr) minmax(0, 1fr)" }, gap: 2, alignItems: "stretch" }}>
      <Card variant="outlined" sx={{ display: "flex", flexDirection: "column" }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 }, flex: 1, display: "flex", flexDirection: "column", "&:last-child": { pb: { xs: 2, sm: 2.5 } } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
            <Typography variant="subtitle2" fontWeight={700}>
              {isDailyPlan ? `Add exercises to ${WEEK_DAYS[selectedDay - 1]}` : "System exercises"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {totalExerciseCount} available
            </Typography>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }}>
            <TextField
              size="small"
              fullWidth
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search by title"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" color="disabled" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              select
              size="small"
              value={level}
              onChange={(event) => onLevelChange(event.target.value)}
              SelectProps={{ SelectDisplayProps: { "aria-label": "Filter exercises by level" } }}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="all">All levels</MenuItem>
              {LEVELS.map((item) => (
                <MenuItem key={item} value={item.toLowerCase()}>
                  <LevelDot tone={levelTone(item)} />
                  {item}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <Stack spacing={1} sx={{ mt: 1.5 }}>
            {isLoadingExercises ? (
              [0, 1, 2, 3].map((row) => <Skeleton key={row} variant="rounded" height={48} />)
            ) : exerciseLoadError ? (
              <Alert severity="error">Could not load system exercises.</Alert>
            ) : entries.length === 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                No active exercises match this search.
              </Typography>
            ) : (
              pagedEntries.map((entry) => (
                <ExercisePickerRow
                  key={entry.code}
                  entry={entry}
                  toneOf={levelTone}
                  onAdd={() => addExercise(entry)}
                />
              ))
            )}
          </Stack>
          {!isLoadingExercises && !exerciseLoadError && (
            <Box sx={{ mt: "auto" }}>
              <ListPager
                page={currentSystemPage}
                count={systemPageCount}
                total={entries.length}
                pageSize={SYSTEM_PAGE_SIZE}
                noun="exercises"
                onChange={setSystemPage}
                label="System exercises"
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {!isDailyPlan && (
        <Card variant="outlined" sx={{ display: "flex", flexDirection: "column", borderColor: missingExercises ? "error.main" : "divider" }}>
          <CardContent sx={{ p: { xs: 2, sm: 2.5 }, flex: 1, display: "flex", flexDirection: "column", "&:last-child": { pb: { xs: 2, sm: 2.5 } } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
              <Typography variant="subtitle2" fontWeight={700}>
                Workout exercises
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {value.items.length} added
              </Typography>
            </Stack>
            {value.items.length === 0 ? (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ py: 6, textAlign: "center" }}>
                No exercises yet. Add some from the list.
              </Typography>
            ) : (
              <>
                <Stack
                  component="ol"
                  spacing={1.25}
                  sx={{ mt: 1.5, p: 0, listStyle: "none" }}
                >
                  {pagedItems.map((item, pageIndex) => {
                    // Chỉ số thật trong workout để đánh số, đổi thứ tự và xoá đúng bài.
                    const index = itemOffset + pageIndex;
                    return (
                      <WorkoutItemCard
                        key={`${item.exerciseCode}-${index}`}
                        item={item}
                        index={index}
                        total={value.items.length}
                        entry={entryByCode.get(item.exerciseCode)}
                        showErrors={hasSubmitted}
                        onChange={(patch) => updateItem(index, patch)}
                        onMove={(direction) => {
                          moveItem(index, direction);
                          // Bài chuyển sang trang khác thì đi theo nó.
                          const target = index + direction;
                          if (target >= 0 && target < value.items.length) {
                            setItemPage(Math.floor(target / ITEM_PAGE_SIZE) + 1);
                          }
                        }}
                        onRemove={() => removeExercise(index)}
                      />
                    );
                  })}
                </Stack>
                <Box sx={{ mt: "auto" }}>
                  <ListPager
                    page={currentItemPage}
                    count={itemPageCount}
                    total={value.items.length}
                    pageSize={ITEM_PAGE_SIZE}
                    noun="exercises"
                    onChange={setItemPage}
                    label="Workout exercises"
                  />
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    {summarizeWorkoutItems(value.items)}
                  </Typography>
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      )}
      </Box>
    </Stack>
  );
}

/* --------------------------------- Page ----------------------------------- */

function fieldErrorsFromMessage(message) {
  const normalized = String(message || "").toLowerCase();
  const fields = [];
  if (normalized.includes("title") || normalized.includes("name")) fields.push("title");
  if (normalized.includes("type")) fields.push("type");
  if (normalized.includes("level")) fields.push("level");
  if (normalized.includes("muscle")) fields.push("muscles");
  if (["video", "mp4", "mov", "webm"].some((token) => normalized.includes(token))) {
    fields.push("demoVideo");
  }
  if (["image", "jpg", "png"].some((token) => normalized.includes(token))) {
    fields.push("anatomyImage");
  }
  if (normalized.includes("exercise data")) fields.push("title", "type", "level", "muscles");
  return [...new Set(fields)];
}

export default function ExerciseFormPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const kind = searchParams.get("type") === "workout" ? "workout" : "exercise";

  const [exercise, setExercise] = useState(EMPTY_EXERCISE);
  const [selectedMuscles, setSelectedMuscles] = useState([]);
  const [demoVideo, setDemoVideo] = useState(null);
  const [demoVideoError, setDemoVideoError] = useState(null);
  const [anatomyImage, setAnatomyImage] = useState(null);
  const [anatomyImageError, setAnatomyImageError] = useState(null);
  const [workout, setWorkout] = useState(EMPTY_WORKOUT);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseLevel, setExerciseLevel] = useState("all");
  const [selectedDay, setSelectedDay] = useState(1);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [invalidFields, setInvalidFields] = useState([]);
  const { levels: LEVELS, activeLevels } = useLevelNames();

  // Default to the first configured level (lowest score range) until the user picks one. New exercises
  // can only use active levels.
  useEffect(() => {
    if (LEVELS.length === 0) return;
    if (activeLevels.length > 0) {
      setExercise((current) => (activeLevels.includes(current.level) ? current : { ...current, level: activeLevels[0] }));
    }
    setWorkout((current) => (LEVELS.includes(current.level) ? current : { ...current, level: LEVELS[0] }));
  }, [LEVELS, activeLevels]);

  const {
    data: systemExercises,
    isLoading: isLoadingExercises,
    error: exerciseLoadError,
  } = useApiQuery(() => contentManagerApi.exercises(), { enabled: kind === "workout" });

  // Workouts are built from the system library only; user-submitted (CUSTOM) exercises are excluded.
  const allExercises = useMemo(
    () => (Array.isArray(systemExercises) ? systemExercises : []).filter((entry) => entry.source === "SYSTEM"),
    [systemExercises],
  );

  const filteredExercises = useMemo(() => {
    const term = exerciseSearch.trim().toLowerCase();
    return allExercises.filter(
      (entry) =>
        entry.active &&
        (!term || entry.name?.toLowerCase().includes(term)) &&
        (exerciseLevel === "all" || String(entry.level).toLowerCase() === exerciseLevel),
    );
  }, [allExercises, exerciseSearch, exerciseLevel]);

  const exerciseMutation = useApiMutation(
    ({ data, video, image }) => contentManagerApi.createExercise(data, video, image),
    {
      onSuccess: (entry) =>
        navigate(`${CONTENT_PATHS.exercises}/${encodeURIComponent(entry.code)}`),
      onError: (requestError) => {
        setError(requestError.message);
        setInvalidFields(fieldErrorsFromMessage(requestError.message));
      },
    },
  );

  const workoutMutation = useApiMutation((data) => contentManagerApi.createWorkout(data), {
    onSuccess: (entry) =>
      navigate(CONTENT_PATHS.workouts, {
        replace: true,
        state: { successMessage: `Workout "${entry.name}" created successfully.` },
      }),
    onError: (requestError) => setError(requestError.message),
  });

  const isSaving = exerciseMutation.isPending || workoutMutation.isPending;

  const clearField = (field) =>
    setInvalidFields((current) => current.filter((item) => item !== field));

  const changeKind = (nextKind) => {
    setSearchParams({ type: nextKind });
    setError(null);
    setHasSubmitted(false);
    setInvalidFields([]);
  };

  const submit = (event) => {
    event.preventDefault();
    setError(null);
    setHasSubmitted(true);

    if (kind === "exercise") {
      const invalid = [];
      if (!exercise.name.trim() || exercise.name.length > 120) invalid.push("title");
      if (!["HEALTH", "SKILL"].includes(exercise.type)) invalid.push("type");
      if (!activeLevels.includes(exercise.level)) invalid.push("level");
      if (selectedMuscles.length === 0) invalid.push("muscles");
      const exerciseValue = exercise.value === "" ? NaN : Number(exercise.value);
      if (!Number.isInteger(exerciseValue) || exerciseValue < 1 || exerciseValue > 3600) invalid.push("value");
      const defaultSets = Number(exercise.defaultSets);
      if (!Number.isInteger(defaultSets) || defaultSets < 1 || defaultSets > 20) invalid.push("defaultSets");

      if (demoVideoError || anatomyImageError) {
        setInvalidFields([
          ...invalid,
          ...(demoVideoError ? ["demoVideo"] : []),
          ...(anatomyImageError ? ["anatomyImage"] : []),
        ]);
        setError(demoVideoError || anatomyImageError);
        return;
      }
      setInvalidFields(invalid);
      if (invalid.length > 0) {
        setError("Please correct the highlighted fields before creating this exercise.");
        return;
      }

      exerciseMutation.mutate({
        data: {
          name: exercise.name,
          type: exercise.type,
          description: exercise.description,
          category: exercise.category,
          defaultSets: Number(exercise.defaultSets),
          defaultReps: exercise.category === "REPS" ? Number(exercise.value) : null,
          duration: exercise.category === "HOLD" ? Number(exercise.value) : null,
          level: exercise.level,
          guide: exercise.guide,
          muscleGroup: selectedMuscles.join(" · "),
        },
        video: demoVideo,
        image: anatomyImage,
      });
      return;
    }

    if (!workout.name.trim() || !workout.description.trim()) {
      setError("Enter a workout title and description.");
      return;
    }
    if (!["HEALTH", "SKILL", "FLEX"].includes(workout.type)) {
      setError("Choose a workout type.");
      return;
    }
    if (!activeLevels.includes(workout.level)) {
      setError("Choose an active workout level.");
      return;
    }
    if (workout.items.length === 0) {
      setError("Add at least one system exercise to this workout.");
      return;
    }
    if (workout.items.some((item) => Object.keys(workoutItemErrors(item)).length > 0)) {
      setError("Check the sets, reps, duration and rest of the highlighted exercises.");
      return;
    }
    workoutMutation.mutate({
      name: workout.name,
      description: workout.description,
      type: workout.type,
      level: workout.level,
      exerciseCodes: workout.items.map((item) => item.exerciseCode),
      items: toWorkoutItemRequests(workout.items),
    });
  };

  const invalid = {
    title: invalidFields.includes("title"),
    type: invalidFields.includes("type"),
    level: invalidFields.includes("level"),
    muscles: invalidFields.includes("muscles"),
    value: invalidFields.includes("value"),
    defaultSets: invalidFields.includes("defaultSets"),
    demoVideo: invalidFields.includes("demoVideo"),
    anatomyImage: invalidFields.includes("anatomyImage"),
  };

  return (
    <Box sx={{ maxWidth: 1024, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2.5, sm: 3 } }}>
      <ContentPageHeader
        breadcrumb={BREADCRUMB}
        title="Create System Workout & Exercise"
        description={
          kind === "workout"
            ? "Build a workout for members by picking exercises that already exist in the system."
            : "Add a new exercise or skill to the system library."
        }
      />

      <ToggleButtonGroup
        exclusive
        size="small"
        value={kind}
        onChange={(_, next) => next && changeKind(next)}
        aria-label="Content type"
        sx={{
          mt: 2.5,
          p: 0.5,
          bgcolor: CM.surfaceSoft,
          borderRadius: "12px",
          border: `1px solid ${CM.border}`,
          "& .MuiToggleButton-root": {
            borderRadius: "8px !important",
            border: "none !important",
            px: 3,
            py: 0.75,
            fontSize: 13,
            fontWeight: 600,
            color: CM.textMuted,
            "&.Mui-selected": {
              background: CM.buttonGradient,
              color: "#fff",
            },
          },
        }}
      >
        <ToggleButton value="exercise">
          Exercise
        </ToggleButton>
        <ToggleButton value="workout">
          Workout
        </ToggleButton>
      </ToggleButtonGroup>

      <Box component="form" id="create-content-form" onSubmit={submit} sx={{ mt: 2.5, ...enter(100) }}>
        {kind === "exercise" ? (
          <ExerciseFields
            value={exercise}
            onChange={setExercise}
            selectedMuscles={selectedMuscles}
            invalid={invalid}
            onClearField={clearField}
            onToggleMuscle={(muscle) => {
              setSelectedMuscles((current) =>
                current.includes(muscle)
                  ? current.filter((item) => item !== muscle)
                  : [...current, muscle],
              );
              clearField("muscles");
            }}
            demoVideo={demoVideo}
            demoVideoError={demoVideoError}
            onDemoVideoChange={(file) => {
              clearField("demoVideo");
              setDemoVideoError(null);
              if (!file) {
                setDemoVideo(null);
                return;
              }
              const message = validateFile(file, {
                maxSize: MAX_VIDEO_SIZE,
                allowedTypes: ALLOWED_VIDEO_TYPES,
                allowedExtensions: ALLOWED_VIDEO_EXTENSIONS,
                label: "Video",
              });
              setDemoVideo(message ? null : file);
              setDemoVideoError(message);
            }}
            anatomyImage={anatomyImage}
            anatomyImageError={anatomyImageError}
            onAnatomyImageChange={(file) => {
              clearField("anatomyImage");
              setAnatomyImageError(null);
              if (!file) {
                setAnatomyImage(null);
                return;
              }
              const message = validateFile(file, {
                maxSize: MAX_IMAGE_SIZE,
                allowedTypes: ALLOWED_IMAGE_TYPES,
                allowedExtensions: ALLOWED_IMAGE_EXTENSIONS,
                label: "Image",
              });
              setAnatomyImage(message ? null : file);
              setAnatomyImageError(message);
            }}
          />
        ) : (
          <WorkoutFields
            value={workout}
            onChange={setWorkout}
            entries={filteredExercises}
            allEntries={allExercises}
            totalExerciseCount={allExercises.length}
            isLoadingExercises={isLoadingExercises}
            exerciseLoadError={exerciseLoadError}
            search={exerciseSearch}
            onSearchChange={setExerciseSearch}
            level={exerciseLevel}
            onLevelChange={setExerciseLevel}
            hasSubmitted={hasSubmitted}
            selectedDay={selectedDay}
            onSelectedDayChange={setSelectedDay}
          />
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        {!isLoadingExercises && kind === "workout" && allExercises.length === 0 && !exerciseLoadError && (
          <Alert severity="info" sx={{ mt: 2 }}>
            There are no exercises in the system yet. Create an exercise first, then come back to build a
            workout.
          </Alert>
        )}
      </Box>

      <Divider sx={{ mt: 3 }} />
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
        <Button
          component={RouterLink}
          to={kind === "exercise" ? CONTENT_PATHS.exercises : CONTENT_PATHS.workouts}
          variant="outlined"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="create-content-form"
          variant="contained"
          disabled={isSaving}
          sx={{ minWidth: 140 }}
        >
          {isSaving ? "Creating…" : `Create ${kind}`}
        </Button>
      </Stack>
    </Box>
  );
}
