import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  buildMonthGrid,
  currentWeekRange,
  firstOfMonth,
  memberScheduleApi,
  monthLabel,
  toIsoDate,
  weekRangeFromStart,
  WEEKDAY_LABELS,
} from "../api/memberSchedule";
import "./MemberSchedulePage.css";

/** Số chip tối đa vẽ trong một ô ngày (ô chỉ cao 72px như Figma). */
const MAX_CHIPS_PER_CELL = 2;

/** Số ngày tập tối đa mỗi tuần khi backend chưa trả về template. */
const FALLBACK_MAX_DAYS_PER_WEEK = 3;

/** Nhãn danh mục lấy từ i18n theo mã category của backend. */
const CATEGORY_LABEL_KEY = {
  HEALTH: "member.schedule.categoryHealth",
  SKILL: "member.schedule.categorySkill",
};

/** Các bộ lọc danh mục — nhãn lấy từ i18n. */
const FILTERS = [
  { id: "ALL", labelKey: "member.schedule.filterAll" },
  { id: "HEALTH", labelKey: "member.schedule.filterHealth" },
  { id: "SKILL", labelKey: "member.schedule.filterSkill" },
];

function categoryClass(category) {
  return category === "SKILL" ? "skill" : "health";
}

/** Icon đồng hồ nhỏ trong card / chip. */
function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 5v4.3l2.6 1.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="8.6" cy="8.6" r="6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Thứ trong tuần, thứ hai trước — cùng quy ước với backend
 * (`RecommendedPlanService`) để nhịp tuần hiển thị giống nhau ở màn Result
 * và màn lịch.
 */
const TEMPLATE_WEEK_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/**
 * Ngày trong tuần (Thứ 2 -> Chủ nhật) mà một "ngày tập" của template rơi vào.
 *
 * Template chỉ quy định "Day 1..N" chứ không phải thứ cụ thể, nên ta trải
 * đều các ngày tập trong tuần: 3 ngày/tuần -> MON, WED, FRI;
 * 4 ngày/tuần -> MON, TUE, THU, SAT.
 */
function templateWeekdayIndex(index, totalDays) {
  const slot = Math.floor((index * TEMPLATE_WEEK_DAYS.length) / Math.max(totalDays, 1));
  return Math.min(slot, TEMPLATE_WEEK_DAYS.length - 1);
}

/**
 * Xếp sẵn lịch tuần từ Daily Training Plan Template của Content Manager.
 *
 * Template quy định: Day 1..N và workout tương ứng. Ta trải các ngày tập đều
 * trong tuần theo nhịp chuẩn, bỏ qua ngày đã trôi qua, và nếu ngày tập rơi
 * vào quá khứ thì dồn sang ngày trống gần nhất — để member vẫn nhận đủ N buổi
 * trong tuần như kế hoạch đã được duyệt.
 *
 * @param {Array} planDays - `planInfo.days` từ backend
 * @param {Array} weekDates - 7 ngày của tuần (Thứ 2 → Chủ nhật)
 * @param {Array} workouts - danh sách workout khả dụng để lấy metadata
 * @param {string} todayIso - hôm nay (YYYY-MM-DD)
 * @returns {Object} map { isoDate: [entry, ...] }
 */
export function buildPlannedFromTemplate(planDays, weekDates, workouts, todayIso) {
  const result = {};
  if (!Array.isArray(planDays) || planDays.length === 0) return result;
  if (!Array.isArray(weekDates) || weekDates.length === 0) return result;

  const totalDays = planDays.length;

  // Thứ trong tuần của mỗi ngày tập (0 = Thứ 2) -> ngày cụ thể trong tuần.
  const slots = planDays.map((day, index) => ({
    day,
    weekdayIndex: templateWeekdayIndex(index, totalDays),
  }));

  // Đi theo thứ tự trong tuần để các ngày tập không bị lộn xộn.
  slots.sort((a, b) => a.weekdayIndex - b.weekdayIndex);

  const taken = new Set();
  const usedCodes = new Set();

  slots.forEach(({ day, weekdayIndex }) => {
    const code = day?.workoutCode;
    if (!code) return;
    // Mỗi workout chỉ xuất hiện một lần trong tuần.
    if (usedCodes.has(code)) return;

    const workout = workouts.find((item) => item.code === code);
    if (!workout) return;

    // Ưu tiên đúng ngày theo nhịp; nếu ngày đó đã trôi qua hoặc đã có buổi
    // tập khác thì dồn sang ngày trống gần nhất phía sau.
    let slot = weekDates[weekdayIndex];
    if (!slot || slot < todayIso || taken.has(slot)) {
      slot = weekDates.find((iso) => iso >= todayIso && !taken.has(iso));
    }
    if (!slot) return;

    taken.add(slot);
    usedCodes.add(code);
    result[slot] = [
      {
        key: `${code}-${slot}-template-${day.dayNumber ?? 0}`,
        workoutCode: code,
        workoutName: workout.name,
        category: workout.category,
        durationMinutes: workout.durationMinutes,
        exerciseCount: workout.exerciseCount,
      },
    ];
  });

  return result;
}

/** Card workout kéo được ở sidebar trái. */
function WorkoutCard({ workout, dragging, used, onDragStart, onDragEnd, t }) {
  return (
    <div
      className={`workout-chipcard${dragging ? " is-dragging" : ""}${
        used ? " is-used" : ""
      }`}
      draggable={!used}
      onDragStart={(event) => {
        if (used) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = "copy";
        // Firefox/Safari chỉ cho drop khi dataTransfer có dữ liệu.
        event.dataTransfer.setData("text/plain", workout.code);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      title={
        used
          ? t("member.schedule.alreadyPlannedTitle", { name: workout.name })
          : t("member.schedule.workoutDuration", {
              duration: workout.durationMinutes,
              count: workout.exerciseCount,
            })
      }
    >
      <span className="workout-chipcard__grip" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index} />
        ))}
      </span>

      <p className="workout-chipcard__name">{workout.name}</p>

      <div className="workout-chipcard__meta">
        <span className={`workout-badge workout-badge--${categoryClass(workout.category)}`}>
          {t(CATEGORY_LABEL_KEY[workout.category] ?? "member.schedule.categoryHealth")}
        </span>
        <span className="workout-chipcard__level">{workout.level}</span>
        {used && <span className="workout-chipcard__used">{t("member.schedule.planned")}</span>}
      </div>

      <div className="workout-chipcard__foot">
        <ClockIcon />
        <span>
          {t("member.schedule.workoutDuration", {
            duration: workout.durationMinutes,
            count: workout.exerciseCount,
          })}
        </span>
      </div>
    </div>
  );
}

/** Chip workout đã xếp trong một ô ngày. */
function EventChip({ entry, dragging, locked, onDragStart, onDragEnd, onRemove, t }) {
  return (
    <div
      className={`event-chip event-chip--${categoryClass(entry.category)}${
        dragging ? " is-dragging" : ""
      }${locked ? " is-locked" : ""}`}
      draggable={!locked}
      onDragStart={(event) => {
        if (locked) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", entry.workoutCode);
        event.dataTransfer.setData("application/x-schedule-key", entry.key);
        // Ghi kèm ngày nguồn để thao tác "di chuyển" không phụ thuộc state React
        // (state có thể chưa kịp cập nhật khi drop rơi vào cùng một tick).
        event.dataTransfer.setData(
          "application/x-schedule-entry",
          JSON.stringify({
            key: entry.key,
            fromIso: entry.iso,
            code: entry.workoutCode,
            name: entry.workoutName,
          }),
        );
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      title={`${entry.workoutName} · ${entry.durationMinutes} min`}
    >
      <span className="event-chip__name">{entry.workoutName}</span>
      <span className="event-chip__time">{entry.durationMinutes} min</span>
      {locked ? null : (
        <button
          type="button"
          className="event-chip__remove"
          aria-label={t("member.schedule.removeWorkout", { name: entry.workoutName })}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      )}

    </div>
  );
}

export default function MemberSchedulePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [workouts, setWorkouts] = useState([]);
  /** { [isoDate]: [{ key, workoutCode, workoutName, category, durationMinutes, exerciseCount }] } */
  const [planned, setPlanned] = useState({});
  const [planInfo, setPlanInfo] = useState(null);
  const [viewMonth, setViewMonth] = useState(() => firstOfMonth(new Date()));
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(null); // { type: "library" | "entry", code, key?, fromIso? }
  const [overDate, setOverDate] = useState(null);
  const [overLibrary, setOverLibrary] = useState(false);
  /**
   * Ràng buộc tuần hiện tại từ backend:
   * { weekStart, weekEnd, maxDaysPerWeek, usedDays, usedWorkouts, daysLimitReached }
   */
  const [weekRule, setWeekRule] = useState(null);
  // Bản đồng bộ của `dragging`: dragover/drop phải biết ngay lập tức có đang kéo
  // hay không, không thể chờ React commit state (chậm 1 frame → drop bị nuốt).
  const dragSession = useRef(null);
  // Bản đồng bộ của `planned`: các handler drop chạy trong cùng tick với
  // state update nên đọc `planned` từ closure có thể đọc giá trị cũ.
  const plannedRef = useRef(planned);

  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const entrySeq = useRef(0);

  const monthKey = useMemo(() => toIsoDate(viewMonth), [viewMonth]);

  // Đồng bộ ref mỗi lần `planned` đổi.
  useEffect(() => {
    plannedRef.current = planned;
  }, [planned]);

  // Tuần hiện tại (Thứ 2 → Chủ nhật): chỉ khu vực này được điều chỉnh.
  // Ưu tiên weekStart từ backend để FE và BE luôn tính cùng một tuần.
  const currentWeek = useMemo(
    () => (weekRule?.weekStart ? weekRangeFromStart(weekRule.weekStart) : currentWeekRange(new Date())),
    [weekRule?.weekStart],
  );
  const weekDaySet = useMemo(() => new Set(currentWeek.dates), [currentWeek]);
  const maxDaysPerWeek = weekRule?.maxDaysPerWeek ?? FALLBACK_MAX_DAYS_PER_WEEK;

  // ------------------------------------------------------------------ load
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [available, plan, rule] = await Promise.all([
          memberScheduleApi.getAvailableWorkouts(),
          memberScheduleApi.getPlanInfo().catch(() => null),
          // Không nuốt lỗi: nếu week-rule fail thì lịch sẽ hiện trống và member
          // tưởng mất dữ liệu. Báo lỗi rõ ràng thay vì hiển thị sai.
          memberScheduleApi.getWeekRule(),
        ]);
        if (cancelled) return;

        setWorkouts(available || []);
        setPlanInfo(plan || null);
        setWeekRule(rule || null);
        // Lịch hiển thị chỉ gồm tuần hiện tại — backend đã gộp cả 2 tháng nếu
        // tuần trải qua ranh giới tháng.
        const savedEntries = groupEntries(rule?.entries || []);

        // Member chưa có lịch trong tuần này -> xếp sẵn theo Daily Training
        // Plan Template mà Content Manager đã dựng (Day 1..N). Đây là nơi
        // "kế hoạch của CM" thực sự đến với member.
        if (savedEntries.length === 0 && plan?.days?.length) {
          const dates = rule?.weekStart
            ? weekRangeFromStart(rule.weekStart).dates
            : currentWeekRange(new Date()).dates;
          setPlanned(
            buildPlannedFromTemplate(plan.days, dates, available || [], todayIso),
          );
        } else {
          setPlanned(savedEntries);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(readApiError(loadError,
            t("member.schedule.loadFailed")));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const grid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);

  // Tuần hiện tại = tuần (Mon–Sun) chứa hôm nay. Chỉ tô khi hôm nay nằm trong
  // tháng đang xem — nếu không, khi xem tháng trước thì hàng cuối (gồm cả ngày
  // tháng trước lẫn tháng này) sẽ bị tô sáng, trông rất khó hiểu.
  const currentWeekIndex = useMemo(() => {
    const todayCell = grid.find((cell) => cell.iso === todayIso);
    return todayCell?.inMonth ? todayCell.weekIndex : null;
  }, [grid, todayIso]);

  /**
   * Ngày đã có workout trong tuần hiện tại (tính từ state đang chỉnh, không
   * phải dữ liệu server) — dùng để chặn vượt giới hạn "N ngày/tuần".
   */
  const weekUsedDays = useMemo(() => {
    let count = 0;
    weekDaySet.forEach((iso) => {
      if (planned[iso]?.length) count += 1;
    });
    return count;
  }, [planned, weekDaySet]);

  /**
   * Mã các workout đã xếp trong tuần hiện tại. Workout này bị làm mờ ở sidebar
   * và không kéo thêm được nữa — chỉ kéo lại từ ô ngày để đổi ngày.
   */
  const weekUsedCodes = useMemo(() => {
    const codes = new Set();
    weekDaySet.forEach((iso) => {
      (planned[iso] || []).forEach((entry) => codes.add(entry.workoutCode));
    });
    return codes;
  }, [planned, weekDaySet]);

  /** Đã đủ số ngày tập cho phép trong tuần chưa. */
  const daysLimitReached = weekUsedDays >= maxDaysPerWeek;

  /** Tuần hiện tại có ngày đã trôi qua không (những ngày này bị khoá). */
  const hasPastDays = useMemo(
    () => currentWeek.dates.some((iso) => isPastDay(iso)),
    [currentWeek],
  );

  /** Tháng đang xem có chứa tuần hiện tại không. */
  const isViewingCurrentMonth = useMemo(
    () => currentWeek.dates.some((iso) => iso.startsWith(toIsoDate(viewMonth))),
    [currentWeek, viewMonth],
  );

  const visibleWorkouts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return workouts.filter((workout) => {
      const matchesTerm =
        !term ||
        workout.name.toLowerCase().includes(term) ||
        String(workout.level).toLowerCase().includes(term);
      const matchesFilter = filter === "ALL" || workout.category === filter;
      return matchesTerm && matchesFilter;
    });
  }, [workouts, search, filter]);

  // ------------------------------------------------------------------ dnd

  /** Ô ngày nằm trong tuần hiện tại mới được tương tác. */
  function isWeekCell(iso) {
    return weekDaySet.has(iso);
  }

  /**
   * Ngày đã trôi qua (so với hôm nay) — lịch sử, không được thay đổi.
   * Chuỗi ISO YYYY-MM-DD so sánh lexicographic cũng đúng thứ tự ngày.
   */
  function isPastDay(iso) {
    return iso < todayIso;
  }

  /** Ô ngày vẫn chỉnh sửa được: trong tuần hiện tại và chưa qua. */
  function isEditableDay(iso) {
    return isWeekCell(iso) && !isPastDay(iso);
  }

  /**
   * Số ngày đang có workout trong tuần hiện tại, tính từ một snapshot của
   * {@code planned}. Dùng snapshot (không phải state trong closure) vì các
   * handler drop chạy cùng tick với state update.
   */
  function countUsedDays(snapshot) {
    let count = 0;
    weekDaySet.forEach((iso) => {
      if ((snapshot[iso] || []).length) count += 1;
    });
    return count;
  }

  /**
   * Thêm workout từ sidebar vào một ngày. Trả về lý do nếu bị chặn:
   * - ngoài tuần hiện tại → không cho xếp.
   * - ngày đã trôi qua → không cho xếp (lịch quá khứ là bất biến).
   * - workout đã có trong tuần → không cho xếp lần hai.
   * - đã đủ số ngày tập → không cho thêm ngày mới.
   */
  function addToDay(iso, workout) {
    if (!isWeekCell(iso)) {
      return t("member.schedule.outOfRange");
    }
    if (isPastDay(iso)) {
      return t("member.schedule.pastDayBlocked");
    }
    const snapshot = plannedRef.current;

    // Workout này đã có trong tuần chưa? (đọc từ snapshot, không phải closure)
    const alreadyInWeek = currentWeek.dates.some((day) =>
      (snapshot[day] || []).some((entry) => entry.workoutCode === workout.code),
    );
    if (alreadyInWeek) {
      return t("member.schedule.alreadyPlanned", { name: workout.name });
    }

    // Ngày đích đã có workout chưa → nếu rỗng thì đây là ngày tập mới.
    const targetIsEmpty = !(snapshot[iso] || []).length;
    if (targetIsEmpty && countUsedDays(snapshot) >= maxDaysPerWeek) {
      return t("member.schedule.atMostDays", { max: maxDaysPerWeek });
    }

    setPlanned((previous) => {
      const list = previous[iso] || [];
      // Kéo cùng một workout hai lần vào một ngày là thao tác trùng — bỏ qua.
      if (list.some((entry) => entry.workoutCode === workout.code)) {
        return previous;
      }
      return {
        ...previous,
        [iso]: [
          ...list,
          {
            key: `${workout.code}-${iso}-${entrySeq.current++}`,
            workoutCode: workout.code,
            workoutName: workout.name,
            category: workout.category,
            durationMinutes: workout.durationMinutes,
            exerciseCount: workout.exerciseCount,
          },
        ],
      };
    });
    return null;
  }

  const removeFromDay = useCallback((iso, key) => {
    setPlanned((previous) => {
      const list = (previous[iso] || []).filter((entry) => entry.key !== key);
      const next = { ...previous };
      if (list.length === 0) {
        delete next[iso];
      } else {
        next[iso] = list;
      }
      return next;
    });
  }, []);

  /**
   * Đổi ngày cho một workout đã xếp. Chỉ được đổi trong tuần hiện tại, sang
   * một ngày chưa trôi qua, và không được vượt số ngày tập cho phép.
   *
   * Ràng buộc "N ngày/tuần" được tính trên SỐ NGÀY SAU KHI thao tác, chứ
   * không phải số ngày hiện tại. Nhờ vậy khi đã đủ hạn mức, member vẫn có thể
   * sắp xếp lại (đổi chỗ giữa các ngày, hoặc chuyển sang ngày trống trong
   * tuần) — những thao tác đó không làm tăng số ngày tập.
   *
   * - Thả vào ngày TRỐNG → chuyển (move).
   * - Thả vào ngày ĐÃ CÓ bài → đổi chỗ (swap): bài ở ngày đích lấy chỗ của
   *   bài đang kéo. Số ngày tập không đổi.
   */
  function moveEntry(fromIso, key, toIso) {
    if (!isWeekCell(toIso)) {
      setError(t("member.schedule.moveOutOfRange"));
      return;
    }
    if (isPastDay(toIso)) {
      setError(t("member.schedule.moveToPastDay"));
      return;
    }
    if (isPastDay(fromIso)) {
      setError(t("member.schedule.moveFromPastDay"));
      return;
    }

    const snapshot = plannedRef.current;
    const source = snapshot[fromIso] || [];
    const entry = source.find((item) => item.key === key);
    if (!entry || fromIso === toIso) return;

    const target = snapshot[toIso] || [];

    // Đích đã có workout này rồi thì chỉ cần bỏ ở nguồn.
    if (target.some((item) => item.workoutCode === entry.workoutCode)) {
      removeFromDay(fromIso, key);
      return;
    }

    const sourceHasOthers = source.some((item) => item.key !== key);
    const targetIsEmpty = target.length === 0;
    // Bài sẽ đổi chỗ với bài đầu tiên của ngày đích.
    const swapped = targetIsEmpty ? null : target[0];

    // Số ngày tập sau khi thao tác:
    //  - ngày nguồn còn workout không (đã có bài khác, hoặc nhận bài đổi chỗ),
    //  - ngày đích có rỗng không (rỗng thì đây là ngày tập mới).
    const currentDays = countUsedDays(snapshot);
    const sourceStillActive = sourceHasOthers || Boolean(swapped);
    const resultingDays =
      currentDays - 1 + (sourceStillActive ? 1 : 0) + (targetIsEmpty ? 1 : 0);

    if (resultingDays > maxDaysPerWeek) {
      setError(t("member.schedule.atMostDays", { max: maxDaysPerWeek }));
      return;
    }

    setPlanned((previous) => {
      const sourceList = previous[fromIso] || [];
      const sourceIndex = sourceList.findIndex((item) => item.key === key);
      if (sourceIndex < 0) return previous;
      const moved = sourceList[sourceIndex];

      const targetList = previous[toIso] || [];
      // Bài ở ngày đích đổi chỗ với bài đang kéo (nếu ngày đích không rỗng).
      const swapIndex = swapped
        ? targetList.findIndex((item) => item.key === swapped.key)
        : -1;
      const nextTarget = [...targetList];
      const nextSource = sourceList.filter((item) => item.key !== key);

      if (swapIndex >= 0) {
        // Bài đổi chỗ lấp đúng vị trí của bài vừa kéo ở ngày đích,
        // và bài vừa kéo lấp chỗ của nó ở ngày nguồn.
        nextTarget[swapIndex] = moved;
        nextSource.splice(sourceIndex, 0, targetList[swapIndex]);
      } else {
        nextTarget.push(moved);
      }

      const next = { ...previous };
      if (nextSource.length === 0) delete next[fromIso];
      else next[fromIso] = nextSource;
      next[toIso] = nextTarget;
      return next;
    });
  }

  function beginDrag(payload) {
    dragSession.current = payload;
    setDragging(payload);
    setOverDate(null);
    setOverLibrary(false);
  }

  function resetDrag() {
    dragSession.current = null;
    setDragging(null);
    setOverDate(null);
    setOverLibrary(false);
  }

  /** Đọc nguồn kéo: ưu tiên dataTransfer, rồi ref đồng bộ, cuối cùng là state. */
  function readDragged(event, kind) {
    const raw = event.dataTransfer?.getData("application/x-schedule-entry");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.key && parsed?.fromIso) return parsed;
      } catch {
        // dataTransfer không đọc được thì rơi xuống ref.
      }
    }
    const session = dragSession.current;
    if (kind === "entry" && session?.type === "entry") {
      return { key: session.key, fromIso: session.fromIso, code: session.code };
    }
    return session;
  }

  function handleDropOnDay(event, iso) {
    event.preventDefault();
    const dragged = readDragged(event, "entry");
    const code = event.dataTransfer.getData("text/plain");

    if (dragged?.type === "entry" || dragged?.fromIso) {
      moveEntry(dragged.fromIso, dragged.key, iso);
    } else {
      const workoutCode = dragged?.code || code;
      const workout = workouts.find((item) => item.code === workoutCode);
      if (workout) {
        const blocked = addToDay(iso, workout);
        if (blocked) setError(blocked);
      }
    }
    resetDrag();
  }

  function handleDropOnLibrary(event) {
    event.preventDefault();
    const dragged = readDragged(event, "entry");
    if (dragged?.type === "entry" || dragged?.fromIso) {
      // Không cho gỡ bài của ngày đã trôi qua (lịch quá khứ là bất biến).
      if (!isPastDay(dragged.fromIso)) {
        removeFromDay(dragged.fromIso, dragged.key);
      }
    }
    resetDrag();
  }

  // ------------------------------------------------------------------ save
  async function handleSave() {
    // Chỉ tuần hiện tại được gửi lên — backend giữ nguyên các tuần khác.
    const weekEntries = currentWeek.dates.flatMap((iso) =>
      (planned[iso] || []).map((entry, index) => ({
        date: iso,
        workoutCode: entry.workoutCode,
        orderInDay: index,
      })),
    );

    if (weekEntries.length === 0) {
      setError(t("member.schedule.pickAtLeastOne"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await memberScheduleApi.saveWeek({
        templateCode: planInfo?.templateCode ?? null,
        entries: weekEntries,
      });
      navigate("/schedule/review");
    } catch (saveError) {
      setError(readApiError(saveError, t("member.schedule.saveFailed")));
      return;
    } finally {
      setSaving(false);
    }
  }

  function shiftMonth(step) {
    setViewMonth((previous) => {
      const next = new Date(previous);
      next.setMonth(previous.getMonth() + step);
      return firstOfMonth(next);
    });
  }

  if (loading) {
    return <div className="schedule-loading">{t("member.schedule.loading")}</div>;
  }

  return (
    <div className="schedule-page">
      <header className="schedule-head">
        <div className="schedule-head__left">
          <button type="button" className="schedule-back" onClick={() => navigate("/")}>
            ← {t("common.back")}
          </button>
          <h1 className="schedule-title">{t("member.schedule.title")}</h1>
        </div>
        <button
          type="button"
          className="schedule-save"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? t("member.schedule.savingSchedule") : t("member.schedule.saveSchedule")}
        </button>
      </header>

      {error && <div className="schedule-alert">{error}</div>}

      {/* Kế hoạch do Content Manager dựng: Day 1..N và workout tương ứng.
          Lịch của tuần đã được xếp sẵn theo kế hoạch này. */}
      {planInfo?.days?.length > 0 && (
        <section className="schedule-plan">
          <div className="schedule-plan__head">
            <span className="schedule-plan__label">{t("member.schedule.yourTrainingPlan")}</span>
            <span className="schedule-plan__name">{planInfo.templateName}</span>
            <span className="schedule-plan__meta">
              {t("member.schedule.planMeta", {
                level: planInfo.level,
                days: planInfo.daysPerWeek,
              })}
            </span>
          </div>
          <ol className="schedule-plan__days">
            {planInfo.days.map((day) => (
              <li key={day.dayNumber} className="schedule-plan__day">
                <span className="schedule-plan__daynum">
                  {t("member.schedule.planDay", { number: day.dayNumber })}
                </span>
                <span className="schedule-plan__workout">{day.workoutName}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="schedule-week-banner">
        <span className="schedule-week-banner__label">{t("member.schedule.thisWeek")}</span>
        <span className="schedule-week-banner__range">
          {weekLabel(currentWeek.startIso)} – {weekLabel(currentWeek.endIso)}
        </span>
        <span
          className={`schedule-week-banner__count${
            daysLimitReached ? " is-full" : ""
          }`}
        >
          {t("member.schedule.trainingDaysLeft", {
            used: weekUsedDays,
            max: maxDaysPerWeek,
          })}
        </span>
        {!isViewingCurrentMonth && (
          <button
            type="button"
            className="schedule-week-banner__jump"
            onClick={() => setViewMonth(firstOfMonth(new Date()))}
          >
            {t("member.schedule.backToThisMonth")}
          </button>
        )}
      </div>

      {!isViewingCurrentMonth && (
        <div className="schedule-notice">
          {t("member.schedule.otherWeeksLocked")}
        </div>
      )}

      {/* Ngày đã trôi qua trong tuần hiện tại: xem được nhưng không sửa được. */}
      {isViewingCurrentMonth && hasPastDays && (
        <div className="schedule-notice">
          {t("member.schedule.pastDaysLocked")}
        </div>
      )}

      {/* Lịch sẵn có nhiều ngày hơn hạn mức của template (dữ liệu cũ). Cho member
          biết để họ tự bỏ bớt thay vì bất ngờ khi bấm Save. */}
      {weekUsedDays > maxDaysPerWeek && (
        <div className="schedule-notice is-warning">
          {t("member.schedule.tooManyDays", {
            used: weekUsedDays,
            max: maxDaysPerWeek,
          })}
        </div>
      )}

      <div className="schedule-body">
        {/* ---------------------------------------------------- sidebar */}
        <aside
          className={`schedule-panel schedule-library${
            overLibrary ? " is-drop-remove" : ""
          }`}
          onDragOver={(event) => {
            if (dragSession.current?.type !== "entry") return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setOverLibrary(true);
          }}
          onDragLeave={(event) => {
            const next = event.relatedTarget;
            if (next instanceof Node && event.currentTarget.contains(next)) return;
            setOverLibrary(false);
          }}
          onDrop={handleDropOnLibrary}
        >
          <h2 className="schedule-library__title">{t("member.schedule.workoutLibrary")}</h2>
          <p className="schedule-library__subtitle">{t("member.schedule.fromContentManager")}</p>

          <div className="schedule-search">
            <SearchIcon />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("member.schedule.searchWorkout")}
              aria-label={t("member.schedule.searchWorkout")}
            />
          </div>

          <div className="schedule-filters">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`schedule-filter${filter === item.id ? " is-active" : ""}`}
                onClick={() => setFilter(item.id)}
              >
                {t(item.labelKey)}
              </button>
            ))}
          </div>

          <div className="schedule-library__list">
            {visibleWorkouts.length === 0 ? (
              <p className="schedule-library__empty">
                {t("member.schedule.libraryEmpty")}
              </p>
            ) : (
              visibleWorkouts.map((workout) => (
                <WorkoutCard
                  key={workout.code}
                  workout={workout}
                  t={t}
                  dragging={dragging?.type === "library" && dragging.code === workout.code}
                  used={weekUsedCodes.has(workout.code)}
                  onDragStart={() =>
                    beginDrag({ type: "library", code: workout.code })
                  }
                  onDragEnd={resetDrag}
                />
              ))
            )}
          </div>
        </aside>

        {/* ---------------------------------------------------- calendar */}
        <section className="schedule-panel schedule-calendar">
          <div className="calendar-head">
            <h2 className="calendar-title">{monthLabel(viewMonth)}</h2>

            <span className="calendar-legend">
              <i className="calendar-legend__dot calendar-legend__dot--health" />
              {t("member.schedule.categoryHealth")}
            </span>
            <span className="calendar-legend">
              <i className="calendar-legend__dot calendar-legend__dot--skill" />
              {t("member.schedule.categorySkill")}
            </span>

            <div className="calendar-nav">
              <button
                type="button"
                className="calendar-nav__btn calendar-nav__btn--today"
                onClick={() => setViewMonth(firstOfMonth(new Date()))}
              >
                {t("member.schedule.today")}
              </button>
              <button
                type="button"
                className="calendar-nav__btn calendar-nav__btn--arrow"
                aria-label={t("member.schedule.previousMonth")}
                onClick={() => shiftMonth(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                className="calendar-nav__btn calendar-nav__btn--arrow"
                aria-label={t("member.schedule.nextMonth")}
                onClick={() => shiftMonth(1)}
              >
                ›
              </button>
            </div>
          </div>

          <div className="calendar-weekdays">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div
            className="calendar-grid"
            onDragOver={(event) => {
              // Ref đồng bộ: luôn biết đang kéo hay không, không phụ thuộc state.
              if (!dragSession.current) return;
              const host = event.target.closest?.("[data-iso]");
              const nextIso = host?.getAttribute("data-iso") ?? null;
              // Chỉ ô trong tuần hiện tại VÀ chưa trôi qua mới nhận drop —
              // ô khác (ngoài tuần / ngày đã qua) bị khoá.
              if (!nextIso || !isEditableDay(nextIso)) return;
              event.preventDefault();
              event.dataTransfer.dropEffect =
                dragSession.current.type === "entry" ? "move" : "copy";
              // setState với cùng giá trị thì React bỏ qua → không re-render lưới.
              setOverDate(nextIso);
            }}
            onDragLeave={(event) => {
              // Chỉ xoá highlight khi con trỏ thực sự rời khỏi lưới. Khi "Drop here"
              // vừa render dưới con trỏ, dragleave vẫn fire trên ô — nếu không
              // kiểm tra relatedTarget thì dropzone nhấp nháy liên tục.
              const next = event.relatedTarget;
              if (next instanceof Node && event.currentTarget.contains(next)) return;
              setOverDate(null);
            }}
            onDrop={(event) => {
              const host = event.target.closest?.("[data-iso]");
              const iso = host?.getAttribute("data-iso");
              if (!iso) {
                resetDrag();
                return;
              }
              // Chặn ở tầng drop: ô ngoài tuần / ngày đã qua không nhận thao tác.
              if (!isEditableDay(iso)) {
                resetDrag();
                return;
              }
              handleDropOnDay(event, iso);
            }}
          >
            {grid.map((cell) => {
              const entries = planned[cell.iso] || [];
              const isToday = cell.iso === todayIso;
              const isCurrentWeek =
                currentWeekIndex !== null &&
                cell.weekIndex === currentWeekIndex &&
                cell.inMonth;
              // Ô nằm trong tuần hiện tại (kể cả khi rơi sang tháng kề) thì vẫn
              // được tô sáng và cho phép kéo thả.
              const isWeekCellNow = isWeekCell(cell.iso);
              // Ngày đã trôi qua trong tuần hiện tại: xem lịch được nhưng không
              // thay đổi được (không kéo ra, không kéo vào, không xoá).
              const isPast = isWeekCellNow && isPastDay(cell.iso);
              const isEditable = isWeekCellNow && !isPast;
              const isOver =
                isEditable && overDate === cell.iso && Boolean(dragging);
              const shown = entries.slice(0, MAX_CHIPS_PER_CELL);
              const hidden = entries.length - shown.length;
              // Không gợi ý thả vào chính ô đang chứa chip được kéo.
              const isNoopTarget =
                dragging?.type === "entry" && dragging.fromIso === cell.iso;

              return (
                <div
                  key={cell.iso}
                  data-iso={cell.iso}
                  className={[
                    "calendar-cell",
                    cell.inMonth ? "" : "is-outside-month",
                    isCurrentWeek ? "is-current-week" : "",
                    isWeekCellNow ? "is-week-cell" : "",
                    isToday ? "is-today" : "",
                    // Ô ngoài tuần hiện tại → khoá hoàn toàn (mờ, không tương tác).
                    // Ô ngày đã qua → vẫn đọc được, chỉ không sửa được.
                    isEditable || isPast ? "" : "is-locked",
                    isPast ? "is-past" : "",
                    isOver ? "is-drop-target" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="calendar-cell__date">
                    {cell.dayOfMonth}
                    {isToday && <span className="calendar-cell__today-tag">{t("member.schedule.today")}</span>}
                    {isPast && <span className="calendar-cell__past-tag">{t("member.schedule.past")}</span>}
                  </span>

                  <div
                    className={`calendar-cell__chips${
                      shown.length > 1 ? " is-compact" : ""
                    }`}
                  >
                    {shown.map((entry) => (
                      <EventChip
                        key={entry.key}
                        entry={{ ...entry, iso: cell.iso }}
                        t={t}
                        dragging={dragging?.type === "entry" && dragging.key === entry.key}
                        locked={!isEditable}
                        onDragStart={() =>
                          beginDrag({
                            type: "entry",
                            key: entry.key,
                            code: entry.workoutCode,
                            name: entry.workoutName,
                            fromIso: cell.iso,
                          })
                        }
                        onDragEnd={resetDrag}
                        onRemove={() => removeFromDay(cell.iso, entry.key)}
                      />
                    ))}

                    {hidden > 0 && (
                      <span className="calendar-cell__more">
                        {t("member.schedule.moreItems", { count: hidden })}
                      </span>
                    )}

                    {isOver && !isNoopTarget && (
                      <div className="calendar-dropzone">{t("member.schedule.dropHere")}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <footer className="schedule-foot">
        <p className="schedule-foot__tip">{tipText(dragging, overLibrary, t)}</p>
        <p className="schedule-foot__count">
          {t("member.schedule.footCount", {
            used: weekUsedDays,
            max: maxDaysPerWeek,
            plural: maxDaysPerWeek === 1 ? "" : "s",
          })}
        </p>
      </footer>
    </div>
  );
}

/**
 * Đọc message lỗi từ response của backend.
 *
 * GlobalExceptionHandler trả về 2 shape khác nhau:
 *  - `{ message, errors: { request: "..." } }`  → lỗi nghiệp vụ (ResponseStatusException)
 *  - `{ code, message }`                        → lỗi cấu trúc request
 * Nếu chỉ đọc `data.message` thì sẽ hiện "Dữ liệu không hợp lệ" thay vì
 * câu giải thích cụ thể, nên phải ưu tiên `errors.request` trước.
 */
export function readApiError(error, fallback) {
  const data = error?.response?.data;
  const detailed = data?.errors?.request || data?.errors?.entries || data?.errors?.date;
  if (typeof detailed === "string" && detailed.trim()) return detailed;
  if (typeof data?.message === "string" && data.message.trim() && data.message !== "Dữ liệu không hợp lệ") {
    return data.message;
  }
  return fallback;
}

/** Chuyển entries của API thành map theo ngày để render nhanh. */
function groupEntries(entries) {
  return entries.reduce((acc, entry, index) => {
    const iso = entry.date;
    const list = acc[iso] || [];
    list.push({
      key: `saved-${entry.id ?? index}`,
      workoutCode: entry.workoutCode,
      workoutName: entry.workoutName,
      category: entry.category,
      durationMinutes: entry.durationMinutes,
      exerciseCount: entry.exerciseCount,
    });
    acc[iso] = list;
    return acc;
  }, {});
}

function tipText(dragging, overLibrary, t) {
  if (dragging?.type === "entry") {
    return overLibrary
      ? t("member.schedule.tipMoveToLibrary")
      : t("member.schedule.tipMoveToDay");
  }
  if (dragging) {
    return t("member.schedule.tipDropToSchedule");
  }
  return t("member.schedule.tipDefault");
}

/** "03 Nov" từ chuỗi YYYY-MM-DD. */
function weekLabel(iso) {
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}
