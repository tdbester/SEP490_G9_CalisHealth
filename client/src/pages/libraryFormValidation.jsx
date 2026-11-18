import i18n from "../i18n";
import { isDuplicateNameMessage } from "../utils/apiError";

const t = (key, options) => i18n.t(key, options);

const VIDEO_MAX_SIZE = 50 * 1024 * 1024;
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm"]);

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

  // Level do Content Manager cấu hình động nên chỉ kiểm tra level đã được chọn; việc level có
  // tồn tại trong hệ thống hay không thuộc về server (đối chiếu bảng fitness_levels).
  if (!level || !String(level).trim()) errors.level = t("member.validation.invalidLevel");
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

/**
 * Lỗi 409 "trùng tên" từ server.
 *
 * Server trả 409 khi:
 * - tên workout trùng tuyệt đối với tên một bài tập (`ContentNameGuardService`),
 * - tên workout trùng với một workout khác của chính member đó,
 * - tên bài tập trùng với tên một bài tập đã có.
 *
 * Server trả thông báo tiếng Anh nên client tự dịch lại để nhất quán với ngôn ngữ đang dùng.
 */
export function isDuplicateNameError(error) {
  const status = error?.response?.status;
  if (status !== 409) return false;
  return isDuplicateNameMessage(error?.response?.data?.message);
}

/**
 * Loại xung đột tên mà server báo.
 *
 * - `workout`  : tên đã được dùng cho một WORKOUT (khi tạo/sửa bài tập).
 * - `exercise` : tên đã được dùng cho một BÀI TẬP (khi tạo/sửa workout).
 * - `own`      : member đã có nội dung cùng tên trong kho của chính họ.
 */
export function getDuplicateNameConflict(error) {
  const message = String(error?.response?.data?.message || "").toLowerCase();
  // "You already have a workout with this title" -> trùng trong kho của chính member.
  if (message.includes("already have")) return "own";
  // "already used by a workout" / "already used by another workout" -> trùng với workout.
  if (message.includes("already used by a workout") || message.includes("already used by another workout")) {
    return "workout";
  }
  // "already used by an exercise" -> trùng với bài tập.
  if (message.includes("already used by an exercise")) return "exercise";
  return "exercise";
}

/**
 * Thông báo đã dịch cho lỗi trùng tên.
 *
 * @param error lỗi axios từ server
 * @param keys  mapping theo loại xung đột, ví dụ
 *              `{ workout: "...", exercise: "...", own: "..." }`
 */
export function getDuplicateNameMessage(error, keys) {
  const conflict = getDuplicateNameConflict(error);
  const key = keys[conflict] || keys.exercise;
  return key ? t(key) : "";
}
