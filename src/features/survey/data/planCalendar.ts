import type { Plan, SessionSlot } from './recommendation';

/* ═══════════════════════════════════════════════════════════════════════
Lịch tháng cho popup "Preview training plan" (Figma frame 261:698).

Chương trình luôn bắt đầu từ ngày 1 của tháng đang xem và kéo dài
`weeks × 7` ngày; phần còn lại của tháng là ngày recovery. Mọi ngày có
buổi tập đều suy ra từ `plan.rhythm` — cùng nguồn với màn "Result and
recommended plan" nên hai màn không thể lệch nhau.
═════════════════════════════════════════════════════════════════════════ */

/** "MON" → 0 (thứ hai) … "SUN" → 6. */
const DAY_INDEX: Record<string, number> = {
  MON: 0,
  TUE: 1,
  WED: 2,
  THU: 3,
  FRI: 4,
  SAT: 5,
  SUN: 6,
};

/** Header "M T W T F S S" của lịch (Figma 261:714). */
export const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

/** Tên đầy đủ cho dòng "Wednesday, April 15 • Full body A". */
export const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export interface CalendarDay {
  /** 1..31 */
  day: number;
  /** 0 = thứ hai … 6 = chủ nhật */
  weekday: number;
  /** Có buổi tập theo `plan.rhythm` và còn nằm trong chương trình. */
  hasSession: boolean;
  /** Nằm sau `planLength` — ngày recovery. */
  isRecovery: boolean;
}

export interface MonthCalendar {
  /** "April 2026" */
  label: string;
  /** "April" */
  monthName: string;
  daysInMonth: number;
  /** Số ngày của chương trình (`weeks × 7`, không vượt quá độ dài tháng). */
  planLength: number;
  /** Lịch theo tuần; các ô đầu tuần đầu có thể `null`. */
  weeks: (CalendarDay | null)[][];
  /** Các ngày có buổi tập, tăng dần. */
  sessionDays: number[];
}

const FALLBACK_PLAN_DAYS = 28;

/** "4 weeks" → 4. */
function weeksOf(plan: Plan): number {
  const parsed = Number.parseInt(plan.meta.weeks, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : FALLBACK_PLAN_DAYS / 7;
}

/** Dựng lịch tháng chứa toàn bộ chương trình, tính từ ngày 1 của tháng. */
export function buildMonthCalendar(plan: Plan, today: Date = new Date()): MonthCalendar {
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // `Date.getDay()` trả 0 = chủ nhật, còn lịch dùng 0 = thứ hai.
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const planLength = Math.min(weeksOf(plan) * 7, daysInMonth);

  const sessionWeekdays = new Set<number>();
  for (const slot of plan.rhythm) {
    const index = DAY_INDEX[slot.day];
    if (index !== undefined) sessionWeekdays.add(index);
  }

  const sessionDays: number[] = [];
  const cells: (CalendarDay | null)[] = Array.from({ length: firstWeekday }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const weekday = (firstWeekday + day - 1) % 7;
    const withinPlan = day <= planLength;
    const hasSession = withinPlan && sessionWeekdays.has(weekday);
    if (hasSession) sessionDays.push(day);
    cells.push({ day, weekday, hasSession, isRecovery: !withinPlan });
  }

  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (CalendarDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const firstOfMonth = new Date(year, month, 1);
  return {
    label: firstOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    monthName: firstOfMonth.toLocaleDateString('en-US', { month: 'long' }),
    daysInMonth,
    planLength,
    weeks,
    sessionDays,
  };
}

/** Slot tập ứng với thứ trong tuần, lấy từ `plan.rhythm`. */
export function sessionForWeekday(plan: Plan, weekday: number): SessionSlot | undefined {
  return plan.rhythm.find((slot) => DAY_INDEX[slot.day] === weekday);
}

/** Ô chứa ngày `day`, dùng để tra cứu khi render. */
export function findDay(calendar: MonthCalendar, day: number): CalendarDay | undefined {
  return calendar.weeks
    .flat()
    .find((cell): cell is CalendarDay => cell !== null && cell.day === day);
}

/** Ngày mở mặc định: buổi tập đầu tiên từ giữa tháng trở đi. */
export function defaultSelectedDay(calendar: MonthCalendar): number {
  const { sessionDays } = calendar;
  if (sessionDays.length === 0) return 1;
  return sessionDays.find((day) => day >= 15) ?? sessionDays[sessionDays.length - 1];
}

/**
 * "Training runs April 1–28 (12 sessions); April 29–30 are recovery days."
 * Dùng chung số liệu với lịch đang hiển thị nên không bao giờ sai lệch.
 */
export function scheduleNote(calendar: MonthCalendar): string {
  const { monthName, planLength, daysInMonth, sessionDays } = calendar;
  const scope = `Training runs ${monthName} 1–${planLength} (${sessionDays.length} sessions)`;
  const recovery =
    daysInMonth > planLength
      ? `${monthName} ${planLength + 1}–${daysInMonth} are recovery days.`
      : 'there are no recovery days left this month.';
  return `${scope}; ${recovery}`;
}