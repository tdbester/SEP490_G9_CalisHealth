const VIDEO_MAX_SIZE = 50 * 1024 * 1024;
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm"]);
const WORKOUT_LEVELS = new Set(["Beginner", "Intermediate", "Advanced"]);

export function validatePersonalExercise({
  title,
  description,
  level,
  steps,
  videoFile,
  requireVideo = false,
}) {
  const errors = {};
  const normalizedTitle = title.trim();
  const normalizedDescription = description.trim();

  if (!normalizedTitle) errors.title = "Title is required";
  else if (normalizedTitle.length > 50) errors.title = "Title cannot exceed 50 characters";

  if (normalizedDescription.length > 300) {
    errors.description = "Description cannot exceed 300 characters";
  }

  if (!WORKOUT_LEVELS.has(level)) errors.level = "Please select a valid level";
  if (steps.length === 0) errors.steps = "Add at least one guide step";
  steps.forEach((step, index) => {
    if (!step.trim()) errors[`step-${index}`] = "This step cannot be empty";
  });

  if (requireVideo && !videoFile) {
    errors.video = "A demo video is required";
  } else if (videoFile) {
    const videoError = validateVideoFile(videoFile);
    if (videoError) errors.video = videoError;
  }

  return errors;
}

export function validateWorkoutName(name) {
  const normalizedName = name.trim();
  if (!normalizedName) return "Workout name is required";
  if (normalizedName.length > 60) return "Workout name cannot exceed 60 characters";
  return "";
}

export function validateWorkoutDescription(description) {
  return description.trim().length > 200
    ? "Description cannot exceed 200 characters"
    : "";
}

export function validateVideoFile(file) {
  if (!file) return "";
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !VIDEO_EXTENSIONS.has(extension)) {
    return "Video must be an MP4, MOV, or WebM file";
  }
  if (file.type && !file.type.toLowerCase().startsWith("video/")) {
    return "The selected file must be a video";
  }
  if (file.size > VIDEO_MAX_SIZE) {
    return "Video file size cannot exceed 50 MB";
  }
  return "";
}

export function validateWorkoutExercises(exercises) {
  const errors = {};
  if (exercises.length === 0) {
    errors.list = "Please add at least one exercise to your workout";
  }

  exercises.forEach((exercise, index) => {
    const isValidInteger = (value, min, max) =>
      value !== "" &&
      value !== null &&
      !(typeof value === "string" && value.trim() === "") &&
      Number.isInteger(Number(value)) &&
      Number(value) >= min &&
      Number(value) <= max;
    if (!isValidInteger(exercise.sets, 1, 100)) {
      errors[`sets-${index}`] = "Sets must be an integer from 1 to 100";
    }
    if (!isValidInteger(exercise.reps, 1, 2147483647)) {
      errors[`reps-${index}`] = "Value must be an integer greater than 0";
    }
    if (!isValidInteger(exercise.restSec, 10, 180)) {
      errors[`rest-${index}`] = "Rest must be an integer from 10 to 180 seconds";
    }
  });

  return errors;
}

export function getApiErrorMessage(error, fallback) {
  const responseData = error?.response?.data;
  const fieldErrors = responseData?.errors;
  if (fieldErrors && typeof fieldErrors === "object") {
    const messages = Object.values(fieldErrors).filter(
      (message) => typeof message === "string" && message.trim()
    );
    if (messages.length) return messages.join("; ");
  }
  return responseData?.message || fallback;
}
