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

  if (!title.trim()) errors.title = "Title is required";
  else if (title.length > 50) errors.title = "Title cannot exceed 50 characters";

  if (!description.trim()) errors.description = "Description is required";
  else if (description.length > 300) {
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
    const extension = videoFile.name.split(".").pop()?.toLowerCase();
    if (!extension || !VIDEO_EXTENSIONS.has(extension)) {
      errors.video = "Video must be an MP4, MOV, or WebM file";
    } else if (videoFile.size > VIDEO_MAX_SIZE) {
      errors.video = "Video file size cannot exceed 50 MB";
    }
  }

  return errors;
}

export function validateWorkoutName(name) {
  if (!name.trim()) return "Workout name is required";
  if (name.length > 60) return "Workout name cannot exceed 60 characters";
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
    if (!isValidInteger(exercise.sets, 1, 50)) {
      errors[`sets-${index}`] = "Sets must be an integer from 1 to 50";
    }
    if (!isValidInteger(exercise.reps, 1, 999)) {
      errors[`reps-${index}`] = "Value must be an integer from 1 to 999";
    }
    if (!isValidInteger(exercise.restSec, 0, 600)) {
      errors[`rest-${index}`] = "Rest must be an integer from 0 to 600";
    }
  });

  return errors;
}
