import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import trackingApi from "../api/tracking";
import "./WorkoutHistory.css";

const todayStr = () => dayjs().format("YYYY-MM-DD");

/** Tổng hợp từ danh sách khi backend chưa trả về summary. */
function summarize(workouts) {
  const totalMinutes = workouts.reduce((sum, w) => sum + w.durationMin, 0);
  const avgAccuracy = workouts.length
    ? Math.round(workouts.reduce((sum, w) => sum + w.accuracy, 0) / workouts.length)
    : null;
  return { totalWorkouts: workouts.length, totalMinutes, cleanRepRatio: avgAccuracy };
}

export default function WorkoutHistory() {
  const dateInputRef = useRef(null);
  // Ngày đang xem; không chọn ngày thì luôn là hôm nay
  const [date, setDate] = useState(todayStr);
  const isToday = date === todayStr();
  // { status: "loading" | "ready" | "error", workout } của buổi đang xem; null = popup đóng
  const [selected, setSelected] = useState(null);
  const [apiData, setApiData] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const closeLog = useCallback(() => setSelected(null), []);

  // Danh sách chỉ có thông tin tóm tắt; bài tập của buổi lấy từ API chi tiết khi mở popup
  const openLog = useCallback((workout) => {
    setSelected({ status: "loading", workout: { ...workout, exercises: [] } });
    trackingApi
      .getWorkoutSessionDetail(workout.id)
      .then((detail) =>
        setSelected((cur) => (cur?.workout.id === workout.id ? { status: "ready", workout: detail } : cur)),
      )
      .catch(() =>
        setSelected((cur) => (cur?.workout.id === workout.id ? { ...cur, status: "error" } : cur)),
      );
  }, []);

  useEffect(() => {
    trackingApi
      .getWorkoutHistory({ date })
      .then((res) => {
        setApiData(res);
        setLoadError(false);
      })
      .catch(() => setLoadError(true));
  }, [date]);

  const rawWorkouts = apiData?.workouts ?? [];
  const workouts = useMemo(
    () =>
      [...rawWorkouts].sort(
        (a, b) => dayjs(b.completedAt).valueOf() - dayjs(a.completedAt).valueOf(),
      ),
    [rawWorkouts],
  );
  const summary = apiData?.summary ?? summarize(workouts);
  const latestId = workouts[0]?.id;

  const visible = apiData
    ? workouts
    : workouts.filter((w) => dayjs(w.completedAt).format("YYYY-MM-DD") === date);

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

      {/* ── Date filter ────────────────────────────────────────── */}
      <div className="wh-toolbar">
        <h2 className="wh-day-title">
          {isToday ? "Today" : dayjs(date).format("dddd")}
          <span>{dayjs(date).format("DD MMM YYYY")}</span>
        </h2>

        <div className="wh-filters">
          {!isToday && (
            <span className="wh-date-chip">
              {dayjs(date).format("DD MMM YYYY")}
              <button type="button" aria-label="Back to today" onClick={() => setDate(todayStr())}>
                <CloseRoundedIcon />
              </button>
            </span>
          )}
          <div className="wh-date-picker">
            <button
              type="button"
              className={`wh-icon-btn ${!isToday ? "active" : ""}`}
              aria-label="Search by date"
              onClick={openDatePicker}
            >
              <CalendarTodayOutlinedIcon />
            </button>
            <input
              ref={dateInputRef}
              type="date"
              tabIndex={-1}
              aria-hidden="true"
              max={todayStr()}
              value={date}
              // Xóa ngày trong picker -> quay về hôm nay
              onChange={(e) => setDate(e.target.value || todayStr())}
            />
          </div>
        </div>
      </div>

      {/* ── List ───────────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <p className="wh-card wh-empty">
          {loadError
            ? "We could not load your workout history. Please try again later."
            : isToday
              ? "No workouts today yet. Completed sessions will show up here."
              : "No workouts on this day."}
        </p>
      ) : (
        <section className="wh-group">
          <ul className="wh-list">
            {visible.map((workout) => {
                const isLatest = workout.id === latestId;
                return (
                  <li key={workout.id}>
                    <button
                      type="button"
                      className="wh-card wh-row"
                      onClick={() => openLog(workout)}
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
      )}

      <WorkoutLogModal workout={selected?.workout ?? null} status={selected?.status} onClose={closeLog} />
    </div>
  );
}
