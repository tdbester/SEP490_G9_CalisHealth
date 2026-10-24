import { useCallback, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import FitnessCenterRoundedIcon from "@mui/icons-material/FitnessCenterRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import TrackChangesRoundedIcon from "@mui/icons-material/TrackChangesRounded";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import MonitorHeartOutlinedIcon from "@mui/icons-material/MonitorHeartOutlined";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import BackButton from "../components/common/BackButton";
import WorkoutLogModal from "../components/tracking/WorkoutLogModal";
import "./WorkoutHistory.css";

// Seed data là tùy chọn: glob trả về {} khi file đã bị xóa, nên trang không bị lỗi build.
const seedModules = import.meta.glob("../data/workoutHistory.seed.js", { eager: true });
const SEED = Object.values(seedModules)[0]?.default ?? null;

const FILTERS = [
  { id: "all", label: "All" },
  { id: "strength", label: "Strength" },
  { id: "cardio", label: "Cardio" },
];

/** Tổng hợp từ danh sách khi backend chưa trả về summary. */
function summarize(workouts) {
  const totalMinutes = workouts.reduce((sum, w) => sum + w.durationMin, 0);
  const avgAccuracy = workouts.length
    ? Math.round(workouts.reduce((sum, w) => sum + w.accuracy, 0) / workouts.length)
    : null;
  return { totalWorkouts: workouts.length, totalMinutes, cleanRepRatio: avgAccuracy };
}

function groupByMonth(workouts) {
  const groups = [];
  workouts.forEach((workout) => {
    const key = dayjs(workout.completedAt).format("YYYY-MM");
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(workout);
    else groups.push({ key, label: dayjs(workout.completedAt).format("MMMM YYYY"), items: [workout] });
  });
  return groups;
}

export default function WorkoutHistory() {
  const dateInputRef = useRef(null);
  const [filter, setFilter] = useState("all");
  const [date, setDate] = useState("");
  const [selected, setSelected] = useState(null);
  const closeLog = useCallback(() => setSelected(null), []);

  const workouts = useMemo(
    () =>
      [...(SEED?.workouts ?? [])].sort(
        (a, b) => dayjs(b.completedAt).valueOf() - dayjs(a.completedAt).valueOf(),
      ),
    [],
  );
  const summary = SEED?.summary ?? summarize(workouts);
  const latestId = workouts[0]?.id;

  const visible = workouts.filter(
    (w) =>
      (filter === "all" || w.category === filter) &&
      (!date || dayjs(w.completedAt).format("YYYY-MM-DD") === date),
  );
  const groups = groupByMonth(visible);

  const stats = [
    { label: "Workouts", value: summary.totalWorkouts, icon: FitnessCenterRoundedIcon, tone: "purple" },
    {
      label: "Total workout time",
      value: `${Math.round((summary.totalMinutes / 60) * 10) / 10}h`,
      icon: AccessTimeRoundedIcon,
      tone: "blue",
    },
    {
      label: "Clean rep ratio",
      value: summary.cleanRepRatio != null ? `${summary.cleanRepRatio}%` : "—",
      icon: TrackChangesRoundedIcon,
      tone: "pink",
    },
  ];

  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") input.showPicker();
    else input.click();
  };

  return (
    <div className="workout-history">
      <BackButton to="/tracking">Back to health overview</BackButton>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="wh-header">
        <span className="wh-eyebrow">Training archive</span>
        <h1 className="wh-title">Workout history</h1>
        <p className="wh-subtitle">Every completed session, achievement, and personal best.</p>
      </header>

      {/* ── Summary ────────────────────────────────────────────── */}
      <section className="wh-stats">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className="wh-card wh-stat">
            <span className={`wh-stat-icon tone-${tone}`}>
              <Icon />
            </span>
            <strong className="wh-stat-value">{value}</strong>
            <span className="wh-stat-label">{label}</span>
          </article>
        ))}
      </section>

      {/* ── Filters ────────────────────────────────────────────── */}
      <div className="wh-toolbar">
        <div className="wh-filters" role="tablist" aria-label="Workout type">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`wh-filter ${filter === f.id ? "active" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
          {date && (
            <span className="wh-date-chip">
              {dayjs(date).format("DD MMM YYYY")}
              <button type="button" aria-label="Clear date filter" onClick={() => setDate("")}>
                <CloseRoundedIcon />
              </button>
            </span>
          )}
        </div>

        <div className="wh-date-picker">
          <button
            type="button"
            className={`wh-icon-btn ${date ? "active" : ""}`}
            aria-label="Filter by date"
            onClick={openDatePicker}
          >
            <CalendarTodayOutlinedIcon />
          </button>
          <input
            ref={dateInputRef}
            type="date"
            tabIndex={-1}
            aria-hidden="true"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {/* ── List ───────────────────────────────────────────────── */}
      {groups.length === 0 ? (
        <p className="wh-card wh-empty">
          {workouts.length === 0
            ? "No workouts yet. Completed sessions will show up here."
            : "No workouts match this filter."}
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="wh-group">
            <h2 className="wh-group-title">{group.label}</h2>
            <ul className="wh-list">
              {group.items.map((workout) => {
                const isLatest = workout.id === latestId;
                return (
                  <li key={workout.id}>
                    <button
                      type="button"
                      className="wh-card wh-row"
                      onClick={() => setSelected(workout)}
                    >
                      <span
                        className={`wh-row-icon ${isLatest ? "featured" : `tone-${workout.category}`}`}
                      >
                        {isLatest ? <FitnessCenterRoundedIcon /> : <MonitorHeartOutlinedIcon />}
                      </span>
                      <span className="wh-row-info">
                        <span className="wh-row-date">
                          {dayjs(workout.completedAt).format("DD MMM YYYY · HH:mm")}
                        </span>
                        <span className="wh-row-name">{workout.name}</span>
                        <span className="wh-row-duration">{workout.durationMin} min</span>
                      </span>
                      <span className="wh-row-accuracy">
                        <strong>{workout.accuracy}%</strong>
                        <span>accuracy</span>
                      </span>
                      <span className="wh-row-link">
                        View details
                        <ChevronRightRoundedIcon />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <WorkoutLogModal workout={selected} onClose={closeLog} />
    </div>
  );
}
