import i18n from "../i18n";

/*
 * Lịch tháng cho popup "Preview training plan".
 * Chương trình bắt đầu từ ngày 1 của tháng đang xem và kéo dài `plan.weeks × 7` ngày; phần còn lại của
 * tháng là ngày recovery. Ngày có buổi tập suy ra từ `plan.rhythm` (backend) — cùng nguồn với màn
 * Result nên hai màn không thể lệch nhau.
 */

/** "MON" -> 0 (thứ hai) … "SUN" -> 6. */
const DAY_INDEX = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 };

/** Key của các thứ trong tuần -> dùng để tra cụm từ đã dịch. */
export const WEEKDAY_KEYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/** Chữ cái đầu của thứ trong tuần, theo ngôn ngữ đang dùng (lịch tháng). */
export function weekdayInitials() {
  const locale = i18n.language === "vi" ? "vi-VN" : "en-US";
  return WEEKDAY_KEYS.map((key) =>
    new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(new Date(2024, 0, 7 + DAY_INDEX[key])),
  );
}

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
  const locale = i18n.language === "vi" ? "vi-VN" : "en-US";
  return {
    label: firstOfMonth.toLocaleDateString(locale, { month: "long", year: "numeric" }),
    monthName: firstOfMonth.toLocaleDateString(locale, { month: "long" }),
    daysInMonth,
    planLength,
    weeks,
    sessionDays,
    weekdayKeys: WEEKDAY_KEYS,
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
  const scope = i18n.t("member:survey.planPreview.noteScope", {
    month: monthName,
    planLength,
    sessions: sessionDays.length,
  });
  const recovery =
    daysInMonth > planLength
      ? i18n.t("member:survey.planPreview.recoveryLeft", {
          month: monthName,
          from: planLength + 1,
          to: daysInMonth,
        })
      : i18n.t("member:survey.planPreview.recoveryNone");
  return `${scope}; ${recovery}`;
}

/** 30 -> "25–30 min" (chip thời lượng), 30 -> "25-30 min / session" (màn Result). */
export const durationRange = (minutes) =>
  i18n.t("member:survey.planPreview.durationRange", {
    min: Math.max(10, minutes - 5),
    max: minutes,
  });
