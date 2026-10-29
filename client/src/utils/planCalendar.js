/*
 * Lịch tháng cho popup "Preview training plan".
 * Chương trình bắt đầu từ ngày 1 của tháng đang xem và kéo dài `plan.weeks × 7` ngày; phần còn lại của
 * tháng là ngày recovery. Ngày có buổi tập suy ra từ `plan.rhythm` (backend) — cùng nguồn với màn
 * Result nên hai màn không thể lệch nhau.
 */

/** "MON" -> 0 (thứ hai) … "SUN" -> 6. */
const DAY_INDEX = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 };

export const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Dựng lịch tháng chứa chương trình, tính từ ngày 1 của tháng. */
export function buildMonthCalendar(plan, today = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Date.getDay(): 0 = chủ nhật; lịch dùng 0 = thứ hai
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const planLength = Math.min(Math.max(plan.weeks, 1) * 7, daysInMonth);
  const sessionWeekdays = new Set(plan.rhythm.map((slot) => DAY_INDEX[slot.day]).filter((i) => i !== undefined));

  const sessionDays = [];
  const cells = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const weekday = (firstWeekday + day - 1) % 7;
    const withinPlan = day <= planLength;
    const hasSession = withinPlan && sessionWeekdays.has(weekday);
    if (hasSession) sessionDays.push(day);
    cells.push({ day, weekday, hasSession, isRecovery: !withinPlan });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const firstOfMonth = new Date(year, month, 1);
  return {
    label: firstOfMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    monthName: firstOfMonth.toLocaleDateString("en-US", { month: "long" }),
    daysInMonth,
    planLength,
    weeks,
    sessionDays,
  };
}

/** Buổi tập ứng với thứ trong tuần. */
export const sessionForWeekday = (plan, weekday) => plan.rhythm.find((slot) => DAY_INDEX[slot.day] === weekday);

export const findDay = (calendar, day) => calendar.weeks.flat().find((cell) => cell !== null && cell.day === day);

/** Ngày mở mặc định: buổi tập đầu tiên từ giữa tháng trở đi. */
export function defaultSelectedDay(calendar) {
  const { sessionDays } = calendar;
  if (sessionDays.length === 0) return 1;
  return sessionDays.find((day) => day >= 15) ?? sessionDays[sessionDays.length - 1];
}

/** "Training runs April 1–28 (12 sessions); April 29–30 are recovery days." */
export function scheduleNote(calendar) {
  const { monthName, planLength, daysInMonth, sessionDays } = calendar;
  const scope = `Training runs ${monthName} 1–${planLength} (${sessionDays.length} sessions)`;
  const recovery =
    daysInMonth > planLength
      ? `${monthName} ${planLength + 1}–${daysInMonth} are recovery days.`
      : "there are no recovery days left this month.";
  return `${scope}; ${recovery}`;
}

/** 30 -> "25–30 min" (chip thời lượng), 30 -> "25-30 min / session" (màn Result). */
export const durationRange = (minutes) => `${Math.max(10, minutes - 5)}–${minutes} min`;
