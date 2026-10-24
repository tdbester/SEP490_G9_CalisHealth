// Mock data cho màn Day Streak (Member) — chỉ dùng ở frontend, backend giữ nguyên.
// Khi nối API, thay WORKOUT_DAYS bằng dữ liệu từ server và bỏ các hàm tính toán bên dưới.

/** Ngày "hôm nay" của màn hình — neo để streak luôn ở trạng thái ACTIVE. */
export const REFERENCE_TODAY = "2026-10-08";

/** Danh sách ngày đã hoàn thành workout, định dạng YYYY-MM-DD. */
export const WORKOUT_DAYS = [
  // Tháng 9 — chuỗi 5 ngày liên tiếp (21 → 25), thành tích tốt nhất
  "2026-09-21",
  "2026-09-22",
  "2026-09-23",
  "2026-09-24",
  "2026-09-25",
  // Tháng 10 — 1, 2 đã tập nhưng ngày 3 nghỉ nên chuỗi bị đứt
  "2026-10-01",
  "2026-10-02",
  // Tháng 10 — chuỗi hiện tại 4 → 8, ngày 8 là current active day
  "2026-10-04",
  "2026-10-05",
  "2026-10-06",
  "2026-10-07",
  "2026-10-08",
];

export const WEEKLY_GOAL = {
  percent: 85,
  sessionsDone: 5,
  targetSessions: 6,
};

export const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export const WEEKDAY_FULL_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/* ── Helpers ─────────────────────────────────────────────────── */

/** Chuyển ngày thành key YYYY-MM-DD để so sánh. */
export function toDayKey(year, month, day) {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/** Tách key thành { year, month, day } — month là 0-indexed. */
export function parseDayKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month: month - 1, day };
}

/** Trừ số ngày khỏi một key, trả về key mới. */
function shiftDayKey(key, offsetDays) {
  const { year, month, day } = parseDayKey(key);
  const date = new Date(year, month, day + offsetDays);
  return toDayKey(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Số ngày giữa hai key (b - a). */
function diffInDays(a, b) {
  const start = parseDayKey(a);
  const end = parseDayKey(b);
  return Math.round(
    (new Date(end.year, end.month, end.day) -
      new Date(start.year, start.month, start.day)) /
      86400000,
  );
}

/* ── Tính toán ───────────────────────────────────────────────── */

/**
 * Chuỗi hiện tại: các ngày liên tiếp tính lùi từ `today`.
 * Ngày hôm nay chưa tập thì chuỗi kết thúc ở ngày gần nhất trước đó.
 */
export function getCurrentStreak(workoutDays, today = REFERENCE_TODAY) {
  const done = new Set(workoutDays);
  if (!done.has(today)) {
    const yesterday = shiftDayKey(today, -1);
    if (!done.has(yesterday)) return [];
  }

  const streak = [];
  let cursor = done.has(today) ? today : shiftDayKey(today, -1);
  while (done.has(cursor)) {
    streak.push(cursor);
    cursor = shiftDayKey(cursor, -1);
  }
  return streak.reverse();
}

/** Chuỗi dài nhất trong toàn bộ lịch sử. */
export function getLongestStreak(workoutDays) {
  const sorted = [...workoutDays].sort();
  let longest = 0;
  let run = 0;
  let previous = null;

  for (const key of sorted) {
    run = previous && diffInDays(previous, key) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = key;
  }
  return longest;
}

/** Chuỗi hiện tại có rơi vào tháng đang xem hay không. */
export function isStreakActive(streakDays, today = REFERENCE_TODAY) {
  return streakDays.includes(today) || streakDays.includes(shiftDayKey(today, -1));
}

/** Danh sách ngày trong tháng đang xem đã có workout. */
export function getLoggedDaysInMonth(workoutDays, year, month) {
  return workoutDays
    .filter((key) => {
      const parsed = parseDayKey(key);
      return parsed.year === year && parsed.month === month;
    })
    .map((key) => parseDayKey(key).day)
    .sort((a, b) => a - b);
}

/** Dựng lưới lịch: ô trống đệm + các ngày trong tháng (bắt đầu từ Chủ nhật). */
export function buildMonthGrid(year, month, workoutDays, streakDays, today) {
  const loggedDays = getLoggedDaysInMonth(workoutDays, year, month);
  const streakSet = new Set(streakDays);
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayParsed = parseDayKey(today);

  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ key: `empty-${year}-${month}-${i}`, empty: true });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = toDayKey(year, month, day);
    const isCurrentMonthDay = todayParsed.year === year && todayParsed.month === month;
    cells.push({
      key,
      day,
      empty: false,
      logged: loggedDays.includes(day),
      streak: streakSet.has(key),
      isToday: isCurrentMonthDay && todayParsed.day === day,
      isUpcoming: isCurrentMonthDay && todayParsed.day < day,
    });
  }

  return cells;
}

/** Chuỗi hiện tại hiển thị dạng "Oct 4 – Oct 8". */
export function formatStreakRange(streakDays) {
  if (streakDays.length === 0) return "No active streak";
  const format = (key) => {
    const { month, day } = parseDayKey(key);
    return `${MONTH_LABELS[month].slice(0, 3)} ${day}`;
  };
  return `${format(streakDays[0])} – ${format(streakDays[streakDays.length - 1])}`;
}

/** Ngày đầy đủ cho Day Report: "Thursday, Oct 08, 2026". */
export function formatFullDate(dayKey) {
  const { year, month, day } = parseDayKey(dayKey);
  const weekday = WEEKDAY_FULL_LABELS[new Date(year, month, day).getDay()];
  const monthLabel = MONTH_LABELS[month].slice(0, 3);
  return `${weekday}, ${monthLabel} ${String(day).padStart(2, "0")}, ${year}`;
}