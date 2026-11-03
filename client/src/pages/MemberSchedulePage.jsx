import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  buildMonthGrid,
  firstOfMonth,
  memberScheduleApi,
  monthLabel,
  toIsoDate,
  WEEKDAY_LABELS,
} from "../api/memberSchedule";
import "./MemberSchedulePage.css";

/** Số chip tối đa vẽ trong một ô ngày (ô chỉ cao 72px như Figma). */
const MAX_CHIPS_PER_CELL = 2;

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
function WorkoutCard({ workout, dragging, onDragStart, onDragEnd }) {
  return (
    <div
      className={`workout-chipcard${dragging ? " is-dragging" : ""}`}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "copy";
        // Firefox/Safari chỉ cho drop khi dataTransfer có dữ liệu.
        event.dataTransfer.setData("text/plain", workout.code);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      title={`${workout.name} · ${workout.durationMinutes} min`}
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
function EventChip({ entry, dragging, onDragStart, onDragEnd, onRemove }) {
  return (
    <div
      className={`event-chip event-chip--${categoryClass(entry.category)}${
        dragging ? " is-dragging" : ""
      }`}
      draggable
      onDragStart={(event) => {
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
  // Bản đồng bộ của `dragging`: dragover/drop phải biết ngay lập tức có đang kéo
  // hay không, không thể chờ React commit state (chậm 1 frame → drop bị nuốt).
  const dragSession = useRef(null);

  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const entrySeq = useRef(0);

  const monthKey = useMemo(() => toIsoDate(viewMonth), [viewMonth]);

  // ------------------------------------------------------------------ load
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [available, existing, plan] = await Promise.all([
          memberScheduleApi.getAvailableWorkouts(),
          memberScheduleApi.getMonthSchedule(viewMonth).catch(() => null),
          memberScheduleApi.getPlanInfo().catch(() => null),
        ]);
        if (cancelled) return;

        setWorkouts(available || []);
        setPlanInfo(plan || null);
        setPlanned(groupEntries(existing?.entries || []));
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError?.response?.data?.message ||
              "Could not load your workouts. Check that the backend is running.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // Đổi tháng thì tải lại lịch của tháng đó.
  }, [viewMonth]);

  const grid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);

  // Tuần hiện tại = tuần (Mon–Sun) chứa hôm nay. Chỉ tô khi hôm nay nằm trong
  // tháng đang xem — nếu không, khi xem tháng trước thì hàng cuối (gồm cả ngày
  // tháng trước lẫn tháng này) sẽ bị tô sáng, trông rất khó hiểu.
  const currentWeekIndex = useMemo(() => {
    const todayCell = grid.find((cell) => cell.iso === todayIso);
    return todayCell?.inMonth ? todayCell.weekIndex : null;
  }, [grid, todayIso]);

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

  const totalWorkouts = useMemo(
    () => Object.values(planned).reduce((sum, list) => sum + list.length, 0),
    [planned],
  );
  const plannedDays = useMemo(() => Object.keys(planned).length, [planned]);
  // "3 days/week" như Figma: lấy tuần tập dày nhất trong tháng, không phải
  // trung bình cộng dồn (tháng 5 tuần sẽ luôn ra số lẻ vô nghĩa).
  const daysPerWeek = useMemo(() => {
    const perWeek = new Map();
    grid.forEach((cell) => {
      if (!cell.inMonth || !planned[cell.iso]?.length) return;
      perWeek.set(cell.weekIndex, (perWeek.get(cell.weekIndex) || 0) + 1);
    });
    return perWeek.size === 0 ? 0 : Math.max(...perWeek.values());
  }, [grid, planned]);

  // ------------------------------------------------------------------ dnd
  const addToDay = useCallback((iso, workout) => {
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
  }, []);

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

  const moveEntry = useCallback((fromIso, key, toIso) => {
    setPlanned((previous) => {
      const source = previous[fromIso] || [];
      const entry = source.find((item) => item.key === key);
      if (!entry || fromIso === toIso) return previous;

      const target = previous[toIso] || [];
      if (target.some((item) => item.workoutCode === entry.workoutCode)) {
        // Đích đã có workout này rồi thì chỉ cần bỏ ở nguồn.
        const trimmed = source.filter((item) => item.key !== key);
        const next = { ...previous };
        if (trimmed.length === 0) delete next[fromIso];
        else next[fromIso] = trimmed;
        return next;
      }

      const next = { ...previous };
      const trimmed = source.filter((item) => item.key !== key);
      if (trimmed.length === 0) delete next[fromIso];
      else next[fromIso] = trimmed;
      next[toIso] = [...target, entry];
      return next;
    });
  }, []);

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
      if (workout) addToDay(iso, workout);
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
    if (totalWorkouts === 0) {
      setError("Pick at least one workout for this month before saving.");
      return;
    }

    const entries = Object.entries(planned).flatMap(([iso, list]) =>
      list.map((entry, index) => ({
        date: iso,
        workoutCode: entry.workoutCode,
        orderInDay: index,
      })),
    );

    setSaving(true);
    setError(null);
    try {
      await memberScheduleApi.saveSchedule({
        month: viewMonth,
        templateCode: planInfo?.templateCode ?? null,
        entries,
      });
      navigate("/schedule/review");
    } catch (saveError) {
      setError(
        saveError?.response?.data?.message ||
          "Could not save the schedule. Please try again.",
      );
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
              event.preventDefault();
              event.dataTransfer.dropEffect =
                dragSession.current.type === "entry" ? "move" : "copy";
              const host = event.target.closest?.("[data-iso]");
              const nextIso = host?.getAttribute("data-iso") ?? null;
              // setState với cùng giá trị thì React bỏ qua → không re-render lưới.
              if (nextIso) setOverDate(nextIso);
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
              const isOver = overDate === cell.iso && Boolean(dragging);
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
                    isToday ? "is-today" : "",
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
          {totalWorkouts} workout{totalWorkouts === 1 ? "" : "s"} planned · {daysPerWeek}{" "}
          day{daysPerWeek === 1 ? "" : "s"}/week
        </p>
      </footer>
    </div>
  );
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
      : "Drop the workout on another day to move it.";
  }
  if (dragging) {
    return "Drop the workout on a day to schedule it.";
  }
  return "Tip: drag a scheduled workout to move it, or drop it back on the list to remove it.";
}
