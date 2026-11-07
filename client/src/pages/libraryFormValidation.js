import i18n from "../i18n";

const t = (key, options) => i18n.t(key, options);

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

  if (!normalizedTitle) errors.title = t("member.validation.titleRequired");
  else if (normalizedTitle.length > 50) errors.title = t("member.validation.titleTooLong");

  if (normalizedDescription.length > 300) {
    errors.description = t("member.validation.descriptionTooLong");
  }

  if (!WORKOUT_LEVELS.has(level)) errors.level = t("member.validation.invalidLevel");
  if (steps.length === 0) errors.steps = t("member.validation.stepsRequired");
  steps.forEach((step, index) => {
    if (!step.trim()) errors[`step-${index}`] = t("member.validation.stepEmpty");
  });

  if (requireVideo && !videoFile) {
    errors.video = t("member.validation.videoRequired");
  } else if (videoFile) {
    const videoError = validateVideoFile(videoFile);
    if (videoError) errors.video = videoError;
  }

  return errors;
}

export function validateWorkoutName(name) {
  const normalizedName = name.trim();
  if (!normalizedName) return t("member.validation.workoutNameRequired");
  if (normalizedName.length > 60) return t("member.validation.workoutNameTooLong");
  return "";
}

export function validateWorkoutDescription(description) {
  return description.trim().length > 200
    ? t("member.validation.description200TooLong")
    : "";
}

export function validateVideoFile(file) {
  if (!file) return "";
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !VIDEO_EXTENSIONS.has(extension)) {
    return t("member.validation.videoFormat");
  }
  if (file.type && !file.type.toLowerCase().startsWith("video/")) {
    return t("member.validation.videoMustBeVideo");
  }
  if (file.size > VIDEO_MAX_SIZE) {
    return t("member.validation.videoTooLarge");
  }
  return "";
}

export function validateWorkoutExercises(exercises) {
  const errors = {};
  if (exercises.length === 0) {
    errors.list = t("member.validation.workoutExercisesRequired");
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
      errors[`sets-${index}`] = t("member.validation.setsRange");
    }
    if (!isValidInteger(exercise.reps, 1, 2147483647)) {
      errors[`reps-${index}`] = t("member.validation.valuePositive");
    }
    if (!isValidInteger(exercise.restSec, 10, 180)) {
      errors[`rest-${index}`] = t("member.validation.restRange");
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
