/**
 * Theo dõi tiến độ "kế hoạch tập hôm nay" của member trong phiên trình duyệt.
 *
 * Khi member bấm "Bắt đầu tập" trên màn Daily Workout Plan, màn kết quả cuối
 * buổi gọi {@link completeActiveDailyWorkout} để đánh dấu buổi tập đó đã xong.
 * Khi tất cả các buổi tập của hôm nay đã hoàn thành -> màn Daily Workout Plan
 * hiển thị màn chúc mừng.
 *
 * Dữ liệu chỉ sống trong sessionStorage: đóng tab là reset, đúng như trạng
 * thái "hôm nay đã tập chưa".
 */

/** Key lưu tiến độ kế hoạch ngày. */
const DAILY_PROGRESS_KEY = "calishealth.daily.plan.progress";

/** Khoá ngày theo giờ local (YYYY-MM-DD) — múi giờ khác UTC vẫn đúng ngày. */
export function dailyProgressDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Trạng thái rỗng cho một ngày. */
function emptyProgress(day) {
  return { date: day, total: [], completed: [], active: "", activeExercises: [] };
}

/** Đọc tiến độ của hôm nay (mất ngày -> trả về trạng thái rỗng). */
export function readDailyPlanProgress(date = new Date()) {
  const day = dailyProgressDayKey(date);
  try {
    const raw = JSON.parse(sessionStorage.getItem(DAILY_PROGRESS_KEY) || "null");
    if (!raw || raw.date !== day) return emptyProgress(day);
    return {
      date: day,
      total: Array.isArray(raw.total) ? raw.total : [],
      completed: Array.isArray(raw.completed) ? raw.completed : [],
      active: typeof raw.active === "string" ? raw.active : "",
      activeExercises: Array.isArray(raw.activeExercises) ? raw.activeExercises : [],
    };
  } catch {
    return emptyProgress(day);
  }
}

/** Ghi tiến độ xuống sessionStorage. */
function writeDailyPlanProgress(progress) {
  try {
    sessionStorage.setItem(DAILY_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Bộ nhớ đầy / private mode -> bỏ qua, màn vẫn chạy được.
  }
}

/**
 * Đồng bộ danh sách buổi tập của hôm nay với kế hoạch từ backend.
 *
 * Danh sách có thể thay đổi (member đổi lịch) nên các buổi đã hoàn thành
 * mà không còn trong kế hoạch sẽ bị loại bỏ.
 */
export function syncDailyPlanWorkouts(codes = [], date = new Date()) {
  const list = Array.from(new Set(codes.filter(Boolean)));
  const current = readDailyPlanProgress(date);
  const completed = current.completed.filter((code) => list.includes(code));
  writeDailyPlanProgress({
    date: current.date,
    total: list,
    completed,
    active: list.includes(current.active) ? current.active : "",
    activeExercises: list.includes(current.active) ? current.activeExercises : [],
  });
}

/**
 * Ghi nhớ buổi tập member đang tập — màn kết quả dùng để đánh dấu hoàn thành.
 *
 * @param {string} workoutCode
 * @param {string[]} exerciseCodes - các bài thuộc buổi tập (dùng để đối chiếu
 *   xem member đã tập đủ bài chưa mới tính là hoàn thành buổi tập).
 */
export function setActiveDailyWorkout(workoutCode, exerciseCodes = [], date = new Date()) {
  const current = readDailyPlanProgress(date);
  writeDailyPlanProgress({
    ...current,
    active: workoutCode || "",
    activeExercises: Array.isArray(exerciseCodes) ? exerciseCodes : [],
  });
}

/**
 * Đánh dấu buổi tập đang tập là đã hoàn thành.
 *
 * Chỉ đánh dấu khi member đã tập đủ tất cả bài của buổi tập — trường hợp
 * member bỏ dở thì vẫn coi như chưa hoàn thành.
 *
 * @param {string[]} doneExercises - mã các bài đã tập xong.
 * @returns {{date: string, total: string[], completed: string[], active: string}}
 */
export function completeActiveDailyWorkout(doneExercises = [], date = new Date()) {
  const current = readDailyPlanProgress(date);
  if (!current.active) return current;

  const required = current.activeExercises;
  const done = new Set(doneExercises);
  const finished = required.length > 0 && required.every((code) => done.has(code));

  const next = finished
    ? {
        ...current,
        completed: current.completed.includes(current.active)
          ? current.completed
          : [...current.completed, current.active],
        active: "",
        activeExercises: [],
      }
    : current;
  writeDailyPlanProgress(next);
  return next;
}

/**
 * Hôm nay đã hoàn thành hết kế hoạch chưa.
 *
 * @returns {boolean}
 */
export function isDailyPlanCompleted(date = new Date()) {
  const progress = readDailyPlanProgress(date);
  if (progress.total.length === 0) return false;
  return progress.total.every((code) => progress.completed.includes(code));
}
