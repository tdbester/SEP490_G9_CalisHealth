import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import LocalFireDepartmentRoundedIcon from "@mui/icons-material/LocalFireDepartmentRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import {
  MONTH_LABELS,
  REFERENCE_TODAY,
  WEEKDAY_LABELS,
  WEEKLY_GOAL,
  WORKOUT_DAYS,
  buildMonthGrid,
  formatStreakRange,
  getCurrentStreak,
  getLongestStreak,
  isStreakActive,
  parseDayKey,
} from "../data/dayStreak";
import { getDayReport } from "../data/dayReport";
import DayReportModal from "../components/DayReportModal";
import "./DayStreak.css";

const today = parseDayKey(REFERENCE_TODAY);

/** Một ô ngày trong lịch: trống, đã tập, thuộc chuỗi streak, hoặc ngày nghỉ. */
function CalendarCell({ cell, onSelect }) {
  if (cell.empty) {
    return <div className="streak-cell streak-cell-empty" aria-hidden="true" />;
  }

  const classes = [
    "streak-cell",
    "streak-cell-day",
    cell.logged ? "is-logged" : "",
    cell.streak ? "is-streak" : "",
    cell.isToday ? "is-today" : "",
    cell.isUpcoming ? "is-upcoming" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const label = [
    `October ${cell.day}`,
    cell.logged ? "workout logged" : "rest day",
    cell.streak ? "streak day" : "",
    cell.isToday ? "current active day" : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button type="button" className={classes} onClick={onSelect} aria-label={label}>
      {cell.streak && <LocalFireDepartmentRoundedIcon className="streak-cell-flame" />}
      <span className="streak-cell-number">{cell.day}</span>
      {cell.logged && !cell.streak && <span className="streak-cell-dot" />}
    </button>
  );
}

/** Chú giải các ký hiệu trên lịch. */
function CalendarLegend() {
  return (
    <ul className="streak-legend">
      <li>
        <span className="streak-legend-mark streak-legend-dot" />
        Logged Workout
      </li>
      <li>
        <span className="streak-legend-mark streak-legend-block" />
        Streak Day
      </li>
      <li>
        <LocalFireDepartmentRoundedIcon className="streak-legend-flame" />
        Current Active Day
      </li>
    </ul>
  );
}

/** Thẻ chỉ số dùng chung cho cả ba thẻ tóm tắt. */
function StreakStatCard({ icon, label, value, unit, caption }) {
  return (
    <article className="streak-stat-card">
      <span className="streak-stat-icon">{icon}</span>
      <span className="streak-stat-label">{label}</span>
      <p className="streak-stat-value">
        {value}
        {unit ? <span className="streak-stat-unit">{unit}</span> : null}
      </p>
      <span className="streak-stat-caption">{caption}</span>
    </article>
  );
}

export default function DayStreak() {
  const navigate = useNavigate();
  const [viewYear, setViewYear] = useState(today.year);
  const [viewMonth, setViewMonth] = useState(today.month);
  const [reportDayKey, setReportDayKey] = useState(null);

  const streakDays = useMemo(() => getCurrentStreak(WORKOUT_DAYS), []);
  const longestStreak = useMemo(() => getLongestStreak(WORKOUT_DAYS), []);
  const streakActive = useMemo(() => isStreakActive(streakDays), [streakDays]);
  const streakRange = useMemo(() => formatStreakRange(streakDays), [streakDays]);

  const grid = useMemo(
    () => buildMonthGrid(viewYear, viewMonth, WORKOUT_DAYS, streakDays, REFERENCE_TODAY),
    [viewYear, viewMonth, streakDays],
  );

  const monthWorkouts = grid.filter((cell) => cell.logged).length;
  const monthStreakDays = grid.filter((cell) => cell.streak).length;
  const goalRemaining = Math.max(
    WEEKLY_GOAL.targetSessions - WEEKLY_GOAL.sessionsDone,
    0,
  );

  const goToPreviousMonth = () => {
    setViewMonth((month) => {
      if (month === 0) {
        setViewYear((year) => year - 1);
        return 11;
      }
      return month - 1;
    });
  };

  const goToNextMonth = () => {
    setViewMonth((month) => {
      if (month === 11) {
        setViewYear((year) => year + 1);
        return 0;
      }
      return month + 1;
    });
  };

  return (
    <div className="day-streak">
      {/* ── Page header ─────────────────────────────────────────── */}
      <header className="streak-page-head">
        <button
          type="button"
          className="streak-back"
          onClick={() => navigate(-1)}
        >
          <ArrowBackRoundedIcon />
          Back
        </button>

        <div className="streak-page-title">
          <div>
            <h1 className="streak-page-heading">Day Streak</h1>
            <p className="streak-page-caption">
              Highlighted days are part of your active streak.
            </p>
          </div>
        </div>

        {streakActive && (
          <span className="streak-active-badge">
            <LocalFireDepartmentRoundedIcon />
            ACTIVE STREAK
          </span>
        )}
      </header>

      <div className="streak-layout">
        {/* ── Calendar ─────────────────────────────────────────── */}
        <section className="streak-panel streak-calendar-panel">
          <header className="streak-calendar-head">
            <h2 className="streak-calendar-title">
              {MONTH_LABELS[viewMonth]} {viewYear}
            </h2>
            <div className="streak-calendar-nav">
              <button
                type="button"
                className="streak-nav-btn"
                onClick={goToPreviousMonth}
                aria-label="Previous month"
              >
                <ChevronLeftRoundedIcon />
              </button>
              <button
                type="button"
                className="streak-nav-btn"
                onClick={goToNextMonth}
                aria-label="Next month"
              >
                <ChevronRightRoundedIcon />
              </button>
            </div>
          </header>

          <div className="streak-weekdays" role="row">
            {WEEKDAY_LABELS.map((label, index) => (
              <span key={`${label}-${index}`} className="streak-weekday" role="columnheader">
                {label}
              </span>
            ))}
          </div>

          <div className="streak-grid" role="grid" aria-label="Monthly workout streak calendar">
            {grid.map((cell) => (
              <CalendarCell
                key={cell.key}
                cell={cell}
                onSelect={() => {
                  if (cell.logged) setReportDayKey(cell.key);
                }}
              />
            ))}
          </div>

          <CalendarLegend />
        </section>

        {/* ── Summary cards ─────────────────────────────────────── */}
        <aside className="streak-summary">
          <StreakStatCard
            icon={<TrendingUpRoundedIcon />}
            label="Current Streak"
            value={streakDays.length}
            unit=" days"
            caption={streakRange}
          />
          <StreakStatCard
            icon={<EmojiEventsRoundedIcon />}
            label="Longest Streak"
            value={longestStreak}
            unit=" days"
            caption="Personal best"
          />
          <StreakStatCard
            icon={<CalendarMonthRoundedIcon />}
            label="Workouts This Month"
            value={monthWorkouts}
            caption={`across ${monthStreakDays} days`}
          />

          <article className="streak-goal-card">
            <header className="streak-goal-head">
              <span className="streak-goal-icon">
                <FlagRoundedIcon />
              </span>
              <h3 className="streak-goal-title">Weekly Goal</h3>
              <span className="streak-goal-percent">{WEEKLY_GOAL.percent}%</span>
            </header>

            <div
              className="streak-goal-bar"
              role="progressbar"
              aria-valuenow={WEEKLY_GOAL.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Weekly goal progress"
            >
              <div
                className="streak-goal-fill"
                style={{ width: `${WEEKLY_GOAL.percent}%` }}
              />
            </div>

            <p className="streak-goal-note">
              Keep going — {goalRemaining} more session
              {goalRemaining === 1 ? "" : "s"} to hit your goal
            </p>

            <button
              type="button"
              className="streak-start-btn"
              onClick={() => navigate("/tracking")}
            >
              Start Workout
              <PlayArrowRoundedIcon />
            </button>
          </article>
        </aside>
      </div>

      {/* ── Day Report popup ───────────────────────────────────── */}
      {reportDayKey && (
        <DayReportModal
          dayKey={reportDayKey}
          report={getDayReport(reportDayKey)}
          onClose={() => setReportDayKey(null)}
        />
      )}
    </div>
  );
}