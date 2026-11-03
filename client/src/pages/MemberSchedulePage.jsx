import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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

const CATEGORY_LABEL = {
  HEALTH: "Health",
  SKILL: "Skill",
};

const FILTERS = [
  { id: "ALL", label: "All" },
  { id: "HEALTH", label: "Health" },
  { id: "SKILL", label: "Skill" },
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

/** Card workout kéo được ở sidebar trái. */
function WorkoutCard({ workout, dragging, used, onDragStart, onDragEnd }) {
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
          ? `${workout.name} · already planned this week`
          : `${workout.name} · ${workout.durationMinutes} min`
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
          {CATEGORY_LABEL[workout.category] ?? "Health"}
        </span>
        <span className="workout-chipcard__level">{workout.level}</span>
        {used && <span className="workout-chipcard__used">Planned</span>}
      </div>

      <div className="workout-chipcard__foot">
        <ClockIcon />
        <span>
          {workout.durationMinutes} min · {workout.exerciseCount} exercises
        </span>
      </div>
    </div>
  );
}

/** Chip workout đã xếp trong một ô ngày. */
function EventChip({ entry, dragging, locked, onDragStart, onDragEnd, onRemove }) {
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
      <button
        type="button"
        className="event-chip__remove"
        aria-label={`Remove ${entry.workoutName}`}
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
      >
        ×
      </button>
    </div>
  );
}

export default function MemberSchedulePage() {
  const navigate = useNavigate();

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
        setPlanned(groupEntries(rule?.entries || []));
      } catch (loadError) {
        if (!cancelled) {
          setError(readApiError(loadError,
            "Could not load your workouts. Check that the backend is running."));
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
   * Thêm workout từ sidebar vào một ngày. Trả về lý do nếu bị chặn:
   * - ngoài tuần hiện tại → không cho xếp.
   * - workout đã có trong tuần → không cho xếp lần hai.
   * - đã đủ số ngày tập → không cho thêm ngày mới.
   */
  function addToDay(iso, workout) {
    if (!isWeekCell(iso)) {
      return "You can only plan workouts for the current week.";
    }
    const snapshot = plannedRef.current;

    // Workout này đã có trong tuần chưa? (đọc từ snapshot, không phải closure)
    const alreadyInWeek = currentWeek.dates.some((day) =>
      (snapshot[day] || []).some((entry) => entry.workoutCode === workout.code),
    );
    if (alreadyInWeek) {
      return `"${workout.name}" is already planned this week. Move it to another day instead.`;
    }

    // Ngày đích đã có workout chưa → nếu rỗng thì đây là ngày tập mới.
    const targetIsEmpty = !(snapshot[iso] || []).length;
    if (targetIsEmpty && daysLimitReached) {
      return `You can train on at most ${maxDaysPerWeek} days per week.`;
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
   * Đổi ngày cho một workout đã xếp. Chỉ được đổi trong tuần hiện tại và
   * không được vượt số ngày tập cho phép.
   */
  function moveEntry(fromIso, key, toIso) {
    if (!isWeekCell(toIso)) {
      setError("You can only move workouts within the current week.");
      return;
    }

    const snapshot = plannedRef.current;
    const source = snapshot[fromIso] || [];
    const entry = source.find((item) => item.key === key);
    if (!entry || fromIso === toIso) return;

    // Đích đã có workout này rồi thì chỉ cần bỏ ở nguồn.
    if ((snapshot[toIso] || []).some((item) => item.workoutCode === entry.workoutCode)) {
      removeFromDay(fromIso, key);
      return;
    }

    // Đổi sang ngày mới sẽ tăng số ngày tập trong tuần — check giới hạn.
    const sourceHasOthers = source.some((item) => item.key !== key);
    const targetIsEmpty = !(snapshot[toIso] || []).length;
    if (!sourceHasOthers && targetIsEmpty && daysLimitReached) {
      setError(`You can train on at most ${maxDaysPerWeek} days per week.`);
      return;
    }

    setPlanned((previous) => {
      const trimmed = (previous[fromIso] || []).filter((item) => item.key !== key);
      const next = { ...previous };
      if (trimmed.length === 0) delete next[fromIso];
      else next[fromIso] = trimmed;
      next[toIso] = [...(previous[toIso] || []), entry];
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
      removeFromDay(dragged.fromIso, dragged.key);
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
      setError("Pick at least one workout for this week before saving.");
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
      setError(readApiError(saveError, "Could not save the schedule. Please try again."));
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
    return <div className="schedule-loading">Loading your schedule…</div>;
  }

  return (
    <div className="schedule-page">
      <header className="schedule-head">
        <div className="schedule-head__left">
          <button type="button" className="schedule-back" onClick={() => navigate("/")}>
            ← Back
          </button>
          <h1 className="schedule-title">Workout schedule</h1>
        </div>
        <button
          type="button"
          className="schedule-save"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save schedule"}
        </button>
      </header>

      {error && <div className="schedule-alert">{error}</div>}

      <div className="schedule-week-banner">
        <span className="schedule-week-banner__label">This week</span>
        <span className="schedule-week-banner__range">
          {weekLabel(currentWeek.startIso)} – {weekLabel(currentWeek.endIso)}
        </span>
        <span
          className={`schedule-week-banner__count${
            daysLimitReached ? " is-full" : ""
          }`}
        >
          {weekUsedDays}/{maxDaysPerWeek} training days
        </span>
        {!isViewingCurrentMonth && (
          <button
            type="button"
            className="schedule-week-banner__jump"
            onClick={() => setViewMonth(firstOfMonth(new Date()))}
          >
            Back to this month
          </button>
        )}
      </div>

      {!isViewingCurrentMonth && (
        <div className="schedule-notice">
          You can only plan workouts for the current week. Other weeks are locked.
        </div>
      )}

      {/* Lịch sẵn có nhiều ngày hơn hạn mức của template (dữ liệu cũ). Cho member
          biết để họ tự bỏ bớt thay vì bất ngờ khi bấm Save. */}
      {weekUsedDays > maxDaysPerWeek && (
        <div className="schedule-notice is-warning">
          This week has {weekUsedDays} training days, more than the {maxDaysPerWeek} allowed
          by your plan. Remove a day to save.
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
          <h2 className="schedule-library__title">Workouts</h2>
          <p className="schedule-library__subtitle">From your content manager</p>

          <div className="schedule-search">
            <SearchIcon />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search workout"
              aria-label="Search workout"
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
                {item.label}
              </button>
            ))}
          </div>

          <div className="schedule-library__list">
            {visibleWorkouts.length === 0 ? (
              <p className="schedule-library__empty">
                No workout matches this filter yet.
              </p>
            ) : (
              visibleWorkouts.map((workout) => (
                <WorkoutCard
                  key={workout.code}
                  workout={workout}
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
              Health
            </span>
            <span className="calendar-legend">
              <i className="calendar-legend__dot calendar-legend__dot--skill" />
              Skill
            </span>

            <div className="calendar-nav">
              <button
                type="button"
                className="calendar-nav__btn calendar-nav__btn--today"
                onClick={() => setViewMonth(firstOfMonth(new Date()))}
              >
                Today
              </button>
              <button
                type="button"
                className="calendar-nav__btn calendar-nav__btn--arrow"
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                className="calendar-nav__btn calendar-nav__btn--arrow"
                aria-label="Next month"
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
              // Chỉ ô trong tuần hiện tại mới nhận drop — ô khác bị khoá.
              if (!nextIso || !isWeekCell(nextIso)) return;
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
              const isEditable = isWeekCellNow;
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
                    isEditable ? "" : "is-locked",
                    isOver ? "is-drop-target" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="calendar-cell__date">
                    {cell.dayOfMonth}
                    {isToday && <span className="calendar-cell__today-tag">Today</span>}
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
                      <span className="calendar-cell__more">+{hidden} more</span>
                    )}

                    {isOver && !isNoopTarget && (
                      <div className="calendar-dropzone">Drop here</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <footer className="schedule-foot">
        <p className="schedule-foot__tip">{tipText(dragging, overLibrary)}</p>
        <p className="schedule-foot__count">
          {weekUsedDays} of {maxDaysPerWeek} training day
          {maxDaysPerWeek === 1 ? "" : "s"} this week
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

function tipText(dragging, overLibrary) {
  if (dragging?.type === "entry") {
    return overLibrary
      ? "Drop here to remove the workout from your schedule."
      : "Drag the workout to another day of this week to move it.";
  }
  if (dragging) {
    return "Drop the workout on a day of this week to schedule it.";
  }
  return "Tip: drag a scheduled workout to move it, or drop it back on the list to remove it.";
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
