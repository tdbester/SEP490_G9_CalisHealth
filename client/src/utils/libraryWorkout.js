/**
 * Tiện ích dùng chung cho luồng "member tập từ thư viện".
 *
 * Thư viện có 2 loại nội dung member có thể tập ngay:
 *  - Một bài tập đơn lẻ  -> mở màn chi tiết bài (`/exercises/:code`) rồi bấm
 *    "Start workout" để vào màn AI Pose Tracking, giống hệt luồng kế hoạch ngày.
 *  - Một workout (nhiều bài) -> xếp hàng toàn bộ bài, màn tracking tự chuyển bài
 *    kế tiếp và cuối buổi mở màn kết quả tổng hợp (`/session/result`).
 *
 * Dữ liệu bài tập trong workout từ API luôn có `exerciseCode` — đây là mã mà
 * màn tracking dùng để gửi kết quả lên server.
 */
import { startWorkoutSession, setWorkoutOrigin } from "./workoutResults";

/** Nghỉ mặc định giữa các set (giống luồng kế hoạch ngày). */
export const LIBRARY_DEFAULT_REST_SECONDS = 60;

/** Số set mặc định khi bài không khai báo. */
const DEFAULT_SETS = 3;
/** Số rep mặc định khi bài không khai báo. */
const DEFAULT_REPS = 8;
/** Số giây giữ mặc định cho bài HOLD. */
const DEFAULT_HOLD_SECONDS = 30;

/**
 * Chuẩn hoá 1 bài trong workout thành mục của hàng đợi tập.
 *
 * Chấp nhận cả 2 shape:
 *  - Shape gốc từ server: `exerciseCode`, `exerciseTitle`, `duration`, `restSeconds`.
 *  - Shape đã chuẩn hoá ở `api/library.js`: `name`, `durationSeconds`, `restSec`.
 *
 * @param {object} item
 * @returns {object|null} mục hàng đợi, hoặc null nếu bài thiếu mã (không tập được).
 */
export function toWorkoutQueueItem(item) {
  const exerciseCode = item?.exerciseCode ?? item?.code ?? null;
  if (!exerciseCode) return null;

  const isHold =
    String(item?.category ?? "").toUpperCase() === "HOLD" ||
    String(item?.countBy ?? "").toUpperCase() === "SECONDS" ||
    item?.countBy === "sec";

  const durationSeconds = item?.durationSeconds ?? item?.duration ?? null;
  const reps = item?.repsCount ?? item?.reps ?? null;

  return {
    exerciseCode,
    exerciseName:
      item?.exerciseTitle ?? item?.exerciseName ?? item?.name ?? item?.title ?? "",
    category: isHold ? "HOLD" : "REPS",
    sets: Number(item?.sets) > 0 ? Number(item.sets) : DEFAULT_SETS,
    reps: isHold ? null : reps ?? DEFAULT_REPS,
    durationSeconds: isHold ? durationSeconds ?? DEFAULT_HOLD_SECONDS : null,
    restSeconds: Number(item?.restSeconds ?? item?.restSec) > 0
      ? Number(item.restSeconds ?? item.restSec)
      : LIBRARY_DEFAULT_REST_SECONDS,
  };
}

/**
 * Đổi danh sách bài trong workout thành hàng đợi tập (bỏ các bài không tập được).
 * @param {Array<object>} exercises
 * @returns {Array<object>}
 */
export function toWorkoutQueue(exercises) {
  if (!Array.isArray(exercises)) return [];
  return exercises.map(toWorkoutQueueItem).filter(Boolean);
}

/**
 * Bắt đầu buổi tập từ một workout trong thư viện.
 *
 * Mở màn chi tiết của bài đầu tiên (giống hệt luồng kế hoạch ngày) kèm danh
 * sách bài còn lại; màn tracking sẽ tự chuyển bài và mở màn kết quả tổng hợp
 * khi bài cuối cùng hoàn tất.
 *
 * @param {Function} navigate - react-router `navigate`
 * @param {Array<object>} exercises - danh sách bài của workout
 * @returns {boolean} true nếu đã mở được buổi tập
 */
export function startLibraryWorkout(navigate, exercises) {
  const queue = toWorkoutQueue(exercises);
  if (!queue.length) return false;

  // Phiên tích lũy kết quả mới cho buổi tập này.
  startWorkoutSession();
  // Màn kết quả cuối buổi sẽ quay lại thư viện (thay vì "/plan").
  setWorkoutOrigin("/library");

  const [first, ...rest] = queue;
  navigate(`/exercises/${encodeURIComponent(first.exerciseCode)}`, {
    state: {
      sets: first.sets,
      reps: first.reps,
      durationSeconds: first.durationSeconds,
      restSeconds: first.restSeconds,
      category: first.category,
      index: 1,
      total: queue.length,
      nextExercises: rest,
    },
  });
  return true;
}

/**
 * Bắt đầu tập một bài đơn lẻ từ thư viện.
 *
 * Mở màn chi tiết bài (`/exercises/:code`) — nơi có nút "Start workout" và bước
 * kiểm tra camera — rồi màn tracking đếm reps theo AI.
 *
 * @param {Function} navigate
 * @param {object} exercise - bài tập (cần `code` hoặc `exerciseCode`)
 * @returns {boolean} true nếu bài tập tập được
 */
export function startLibraryExercise(navigate, exercise) {
  const code = exercise?.code ?? exercise?.exerciseCode ?? null;
  if (!code) return false;

  const category = resolveExerciseCategory(exercise);
  const sets = Number(exercise?.defaultSets ?? exercise?.sets) > 0
    ? Number(exercise.defaultSets ?? exercise.sets)
    : DEFAULT_SETS;
  const reps = exercise?.defaultReps ?? exercise?.reps ?? null;
  const duration = exercise?.defaultDuration ?? exercise?.duration ?? null;

  setWorkoutOrigin("/library");
  navigate(`/exercises/${encodeURIComponent(code)}`, {
    state: {
      sets,
      reps: category === "HOLD" ? null : reps ?? DEFAULT_REPS,
      durationSeconds: category === "HOLD" ? duration ?? DEFAULT_HOLD_SECONDS : null,
      restSeconds: LIBRARY_DEFAULT_REST_SECONDS,
      category,
    },
  });
  return true;
}

/**
 * Suy ra cách đo của bài tập: HOLD (đếm giây) hay REPS (đếm số lần).
 *
 * Bài tạo bởi member thường không khai báo `category` (chỉ có "Custom"), nên
 * fallback dựa vào cấu hình mặc định: có duration mà không có reps -> HOLD.
 *
 * @param {object} exercise
 * @returns {"HOLD"|"REPS"}
 */
export function resolveExerciseCategory(exercise) {
  const raw = String(exercise?.category ?? "").toUpperCase();
  if (raw === "HOLD") return "HOLD";
  if (raw === "REPS") return "REPS";

  const reps = exercise?.defaultReps ?? exercise?.reps ?? null;
  const duration = exercise?.defaultDuration ?? exercise?.duration ?? null;
  return reps == null && duration != null ? "HOLD" : "REPS";
}
