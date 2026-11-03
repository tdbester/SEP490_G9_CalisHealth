import api from "./client";

/**
 * Ngày gửi lên backend phải là LocalDate (YYYY-MM-DD) theo giờ local,
 * không dùng toISOString() vì sẽ bị lệch 1 ngày khi múi giờ > UTC.
 */
export function toIsoDate(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Ngày 1 của tháng chứa `date` — backend chuẩn hoá lịch theo tháng. */
export function firstOfMonth(date = new Date()) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  first.setHours(0, 0, 0, 0);
  return first;
}

/**
 * 42 ô của lịch tháng (6 hàng x 7 cột), bắt đầu từ Thứ 2 của tuần chứa ngày 1
 * — giống hệt Figma: hàng đầu và cuối có thể thuộc tháng trước/sau.
 */
export function buildMonthGrid(monthDate) {
  const first = firstOfMonth(monthDate);
  const offset = (first.getDay() + 6) % 7; // 0 = Thứ 2
  const start = new Date(first);
  start.setDate(first.getDate() - offset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    date.setHours(0, 0, 0, 0);
    return {
      date,
      iso: toIsoDate(date),
      dayOfMonth: date.getDate(),
      inMonth: date.getMonth() === first.getMonth(),
      /** Hàng của ô trong lưới 6 tuần (0-5), dùng để tính "days/week". */
      weekIndex: Math.floor(index / 7),
    };
  });
}

/** "November 2026" theo đúng Figma. */
export function monthLabel(date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const memberScheduleApi = {
  /** Sidebar trái: workout có thể kéo vào lịch. */
  getAvailableWorkouts: () =>
    api.get("/member/schedule/workouts").then((res) => res.data),

  /** Thẻ "Plan info" của màn Review; null khi member chưa có template phù hợp. */
  getPlanInfo: () =>
    api.get("/member/schedule/plan-info").then((res) => res.data),

  /** Upsert lịch của tháng chứa `month`. */
  saveSchedule: ({ month, templateCode = null, entries }) =>
    api
      .post("/member/schedule", {
        month: toIsoDate(firstOfMonth(month)),
        templateCode,
        entries: entries.map((entry) => ({
          date: toIsoDate(entry.date),
          workoutCode: entry.workoutCode,
          orderInDay: entry.orderInDay ?? 0,
        })),
      })
      .then((res) => res.data),

  /** Lịch tháng hiện tại; null khi chưa xếp. */
  getCurrentMonthSchedule: () =>
    api.get("/member/schedule/current").then((res) => res.data),

  /** Lịch của tháng chứa `date`; null khi chưa xếp. */
  getMonthSchedule: (date) =>
    api
      .get("/member/schedule", { params: { month: toIsoDate(date) } })
      .then((res) => res.data),

  getAllSchedules: () =>
    api.get("/member/schedule/all").then((res) => res.data),

  /** status: PENDING | COMPLETED | SKIPPED */
  updateDayStatus: ({ date, status }) =>
    api
      .patch("/member/schedule/status", null, {
        params: { date: toIsoDate(date), status },
      })
      .then((res) => res.data),

  /** Buổi tập đã xếp cho `date` (mặc định hôm nay); [] khi là Rest day. */
  getTodayWorkouts: (date) =>
    api
      .get("/member/schedule/today", { params: date ? { date: toIsoDate(date) } : {} })
      .then((res) => res.data),
};

export default memberScheduleApi;
