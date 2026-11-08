/**
 * Tích lũy kết quả của từng bài tập trong một buổi tập.
 *
 * Member có thể tập bài bằng 2 cách:
 *  - Camera thật (màn AI Pose Tracking) -> đếm trực tiếp.
 *  - Upload file video (màn Video scan) -> hệ thống quét video rồi chấm điểm.
 *
 * Cả 2 luồng đều ghi kết quả vào đây để màn kết quả cuối cùng tổng hợp
 * được toàn bộ buổi tập.
 */

/** Key lưu phiên buổi tập (id + danh sách kết quả). */
const WORKOUT_KEY = "calishealth.workout.session";
/** Key lưu nơi member bắt đầu buổi tập — màn kết quả dùng để quay lại đúng chỗ. */
const WORKOUT_ORIGIN_KEY = "calishealth.workout.origin";

/**
 * @typedef {object} ExerciseResult
 * @property {string} exerciseCode
 * @property {string} exerciseName
 * @property {boolean} isHold
 * @property {number} accuracy - % clean (0-100)
 * @property {number} validCount - rep hợp lệ (bài REPS) hoặc giây giữ đúng tư thế (bài HOLD)
 * @property {number} invalidCount - rep không hợp lệ (bài REPS) hoặc giây giữ sai tư thế (bài HOLD)
 * @property {number} totalCount - tổng số (rep hoặc giây)
 * @property {string[]} formIssues - các lỗi form AI phát hiện
 * @property {FormIssueStat[]} issueStats - số liệu đo chi tiết của lỗi form
 * @property {string} source - "camera" | "video"
 */

/** Đọc phiên buổi tập hiện tại (id + kết quả). */
function readSession() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(WORKOUT_KEY) || "null");
    if (raw && typeof raw === "object" && Array.isArray(raw.results)) return raw;
  } catch {
    // Bộ nhớ đầy / private mode -> tạo phiên mới.
  }
  return { id: "", results: [] };
}

/** Lưu phiên buổi tập. */
function writeSession(session) {
  try {
    sessionStorage.setItem(WORKOUT_KEY, JSON.stringify(session));
  } catch {
    // Bộ nhớ đầy / private mode -> bỏ qua, vẫn chạy được.
  }
}

/**
 * Bắt đầu buổi tập mới -> xoá toàn bộ kết quả đã tích lũy.
 *
 * Gọi khi member bấm "Start workout" trên màn "Today's plan".
 */
export function startWorkoutSession() {
  writeSession({ id: `w-${Date.now()}`, results: [] });
}

/**
 * Ghi nhớ member bắt đầu buổi tập từ đâu (kế hoạch ngày hay thư viện).
 *
 * Màn kết quả cuối buổi dùng để quay lại đúng chỗ đó, thay vì luôn về "/plan".
 *
 * @param {string} path - ví dụ "/library" hoặc "/plan"
 */
export function setWorkoutOrigin(path) {
  try {
    sessionStorage.setItem(WORKOUT_ORIGIN_KEY, path || "");
  } catch {
    // Bộ nhớ đầy / private mode -> bỏ qua, vẫn chạy được.
  }
}

/** Đọc nơi member bắt đầu buổi tập (mặc định "/plan"). */
export function readWorkoutOrigin() {
  try {
    return sessionStorage.getItem(WORKOUT_ORIGIN_KEY) || "/plan";
  } catch {
    return "/plan";
  }
}

/** Xoá ghi nhớ nơi bắt đầu buổi tập (sau khi đã dùng xong). */
export function clearWorkoutOrigin() {
  try {
    sessionStorage.removeItem(WORKOUT_ORIGIN_KEY);
  } catch {
    // Không quan trọng.
  }
}

/**
 * Đảm bảo đang có một phiên buổi tập (member tập bài lẻ, không bấm
 * "Start workout" thì tự tạo).
 */
export function ensureWorkoutSession() {
  const session = readSession();
  if (!session.id) {
    writeSession({ id: `w-${Date.now()}`, results: [] });
  }
}

/** Đọc toàn bộ kết quả đã tích lũy trong buổi tập. */
export function readWorkoutResults() {
  return readSession().results;
}

/**
 * Thêm (hoặc ghi đè) kết quả của một bài tập.
 *
 * @param {ExerciseResult} result
 */
export function addWorkoutResult(result) {
  if (!result?.exerciseCode) return;
  ensureWorkoutSession();
  const session = readSession();
  const results = session.results.filter(
    (item) => item.exerciseCode !== result.exerciseCode,
  );
  results.push(result);
  writeSession({ ...session, results });
}

/**
 * Tổng hợp kết quả của cả buổi tập để màn kết quả hiển thị.
 *
 * @returns {{
 *   accuracy: number,
 *   validCount: number,
 *   invalidCount: number,
 *   totalCount: number,
 *   formIssues: string[],
 *   exerciseCount: number,
 * }}
 */
export function aggregateWorkoutResults() {
  const results = readWorkoutResults();

  const validCount = results.reduce((sum, item) => sum + (item.validCount || 0), 0);
  const invalidCount = results.reduce((sum, item) => sum + (item.invalidCount || 0), 0);
  const totalCount = validCount + invalidCount;

  // % clean của cả buổi = tổng phần đúng / tổng phần đếm.
  const counted = validCount + invalidCount;
  const accuracy = counted > 0 ? Math.round((validCount / counted) * 100) : 0;

  // Lỗi form gộp theo tên, không trùng lặp.
  const formIssues = Array.from(
    new Set(results.flatMap((item) => item.formIssues || [])),
  );

  return {
    accuracy,
    validCount,
    invalidCount,
    totalCount,
    formIssues,
    exerciseCount: results.length,
  };
}
