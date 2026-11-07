import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import LocalFireDepartmentRoundedIcon from "@mui/icons-material/LocalFireDepartmentRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import api from "../api/client";
import DayReportModal from "../components/DayReportModal";
import "./DayStreak.css";

function buildMonthGrid(year, month, workoutDays, streakDays, todayKey) {
  const loggedDays = new Set(workoutDays.map((key) => Number(key.slice(-2))));
  const streakSet = new Set(streakDays);
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const [todayYear, todayMonth, todayDay] = todayKey.split("-").map(Number);
  const cells = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ key: `empty-${year}-${month}-${index}`, empty: true });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isCurrentMonth = todayYear === year && todayMonth === month + 1;
    cells.push({
      key,
      year,
      month,
      day,
      empty: false,
      logged: loggedDays.has(day),
      streak: streakSet.has(key),
      isToday: isCurrentMonth && todayDay === day,
      isUpcoming: isCurrentMonth && todayDay < day,
    });
  }

  return cells;
}

function formatStreakRange(streakDays, monthLabels, noStreakLabel) {
  if (streakDays.length === 0) return noStreakLabel;
  const format = (key) => {
    const [, month, day] = key.split("-").map(Number);
    return `${monthLabels[month - 1].slice(0, 3)} ${day}`;
  };
  return `${format(streakDays[0])} – ${format(streakDays[streakDays.length - 1])}`;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Một ô ngày trong lịch: trống, đã tập, thuộc chuỗi streak, hoặc ngày nghỉ. */
function CalendarCell({ cell, onSelect, monthLabels, t }) {
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
    `${monthLabels[cell.month]} ${cell.day}`,
    cell.logged ? t("member.streak.loggedWorkout") : t("member.streak.restDay"),
    cell.streak ? t("member.streak.streakDay") : "",
    cell.isToday ? t("member.streak.currentActiveDay") : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button type="button" className={classes} onClick={onSelect} aria-label={label} disabled={!cell.logged}>
      {cell.streak && <LocalFireDepartmentRoundedIcon className="streak-cell-flame" />}
      <span className="streak-cell-number">{cell.day}</span>
      {cell.logged && !cell.streak && <span className="streak-cell-dot" />}
    </button>
  );
}

/** Chú giải các ký hiệu trên lịch. */
function CalendarLegend({ t }) {
  return (
    <ul className="streak-legend">
      <li>
        <span className="streak-legend-mark streak-legend-dot" />
        {t("member.streak.loggedWorkout")}
      </li>
      <li>
        <span className="streak-legend-mark streak-legend-block" />
        {t("member.streak.streakDay")}
      </li>
      <li>
        <LocalFireDepartmentRoundedIcon className="streak-legend-flame" />
        {t("member.streak.currentActiveDay")}
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
  const { t } = useTranslation();
  const monthLabels = t("date.months", { returnObjects: true });
  const weekdayLabels = t("date.weekdaysShort", { returnObjects: true });
  const todayKey = localDateKey();
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [streakData, setStreakData] = useState(null);
  const [streakLoading, setStreakLoading] = useState(true);
  const [streakError, setStreakError] = useState(false);
  const [reportDayKey, setReportDayKey] = useState(null);
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(false);
  const reportRequestId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setStreakLoading(true);
    setStreakError(false);
    setStreakData(null);
    api.get("/member/day-streak", { params: { year: viewYear, month: viewMonth + 1 } })
      .then(({ data }) => {
        if (!cancelled) setStreakData(data);
      })
      .catch(() => {
        if (!cancelled) setStreakError(true);
      })
      .finally(() => {
        if (!cancelled) setStreakLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewYear, viewMonth]);

  const streakDays = streakData?.currentStreakDays ?? [];
  const weeklyGoal = streakData?.weeklyGoal;
  const streakRange = useMemo(() => formatStreakRange(streakDays, monthLabels, t("member.streak.noActiveStreak")), [streakDays, monthLabels, t]);
  const grid = useMemo(
    () => buildMonthGrid(
      viewYear,
      viewMonth,
      streakData?.workoutDays ?? [],
      streakDays,
      todayKey,
    ),
    [viewYear, viewMonth, streakData, streakDays, todayKey],
  );
  const monthWorkouts = streakData?.workoutDays?.length ?? 0;
  const monthStreakDays = streakDays.filter((dayKey) =>
    dayKey.startsWith(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-`),
  ).length;
  const goalRemaining = Math.max((weeklyGoal?.targetSessions ?? 0) - (weeklyGoal?.sessionsDone ?? 0), 0);

  const loadDayReport = useCallback(async (dayKey) => {
    const requestId = reportRequestId.current + 1;
    reportRequestId.current = requestId;
    setReportDayKey(dayKey);
    setReport(null);
    setReportError(false);
    setReportLoading(true);
    try {
      const { data } = await api.get("/member/day-report", { params: { date: dayKey } });
      if (requestId === reportRequestId.current) setReport(data);
    } catch {
      if (requestId === reportRequestId.current) setReportError(true);
    } finally {
      if (requestId === reportRequestId.current) setReportLoading(false);
    }
  }, []);

  const closeReport = useCallback(() => {
    reportRequestId.current += 1;
    setReportDayKey(null);
    setReport(null);
    setReportError(false);
    setReportLoading(false);
  }, []);

  const goToPreviousMonth = () => {
    if (viewMonth === 0) {
      setViewYear((year) => year - 1);
      setViewMonth(11);
    } else {
      setViewMonth((month) => month - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((year) => year + 1);
      setViewMonth(0);
    } else {
      setViewMonth((month) => month + 1);
    }
  };

  return (
    <div className="day-streak">
      <header className="streak-page-head">
        <button type="button" className="streak-back" onClick={() => navigate(-1)}>
          <ArrowBackRoundedIcon />
          {t("common.back")}
        </button>

        <div className="streak-page-title">
          <div>
            <h1 className="streak-page-heading">{t("member.streak.title")}</h1>
            <p className="streak-page-caption">{t("member.streak.caption")}</p>
          </div>
        </div>

        {streakData?.active && (
          <span className="streak-active-badge">
            <LocalFireDepartmentRoundedIcon />
            {t("member.streak.activeBadge")}
          </span>
        )}
      </header>

      <div className="streak-layout">
        <section className="streak-panel streak-calendar-panel">
          <header className="streak-calendar-head">
            <h2 className="streak-calendar-title">
              {monthLabels[viewMonth]} {viewYear}
            </h2>
            <div className="streak-calendar-nav">
              <button type="button" className="streak-nav-btn" onClick={goToPreviousMonth} aria-label={t("member.schedule.previousMonth")}>
                <ChevronLeftRoundedIcon />
              </button>
              <button type="button" className="streak-nav-btn" onClick={goToNextMonth} aria-label={t("member.schedule.nextMonth")}>
                <ChevronRightRoundedIcon />
              </button>
            </div>
          </header>

          <div className="streak-weekdays" role="row">
            {weekdayLabels.map((label, index) => (
              <span key={`${label}-${index}`} className="streak-weekday" role="columnheader">
                {label}
              </span>
            ))}
          </div>

          <div className="streak-grid" role="grid" aria-label={t("member.streak.calendarLabel")} aria-busy={streakLoading}>
            {grid.map((cell) => (
              <CalendarCell
                key={cell.key}
                cell={cell}
                monthLabels={monthLabels}
                t={t}
                onSelect={() => loadDayReport(cell.key)}
              />
            ))}
          </div>
          {streakLoading && <p role="status">{t("member.streak.loadingHistory")}</p>}
          {streakError && <p role="alert">{t("member.streak.historyUnavailable")}</p>}
          <CalendarLegend t={t} />
        </section>

        <aside className="streak-summary">
          <StreakStatCard
            icon={<TrendingUpRoundedIcon />}
            label={t("member.streak.currentStreak")}
            value={streakData?.currentStreak ?? "-"}
            unit={t("member.streak.daysUnit")}
            caption={streakData ? streakRange : t("common.loading")}
          />
          <StreakStatCard
            icon={<EmojiEventsRoundedIcon />}
            label={t("member.streak.longestStreak")}
            value={streakData?.longestStreak ?? "-"}
            unit={t("member.streak.daysUnit")}
            caption={t("member.streak.personalBest")}
          />
          <StreakStatCard
            icon={<CalendarMonthRoundedIcon />}
            label={t("member.streak.workoutsThisMonth")}
            value={streakData ? monthWorkouts : "-"}
            caption={t("member.streak.acrossStreakDays", { count: monthStreakDays })}
          />

          <article className="streak-goal-card">
            <header className="streak-goal-head">
              <span className="streak-goal-icon"><FlagRoundedIcon /></span>
              <h3 className="streak-goal-title">{t("member.streak.weeklyGoal")}</h3>
              <span className="streak-goal-percent">{weeklyGoal?.percent ?? 0}%</span>
            </header>

            <div
              className="streak-goal-bar"
              role="progressbar"
              aria-valuenow={weeklyGoal?.percent ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("member.streak.goalProgressLabel")}
            >
              <div className="streak-goal-fill" style={{ width: `${weeklyGoal?.percent ?? 0}%` }} />
            </div>

            <p className="streak-goal-note">
              {weeklyGoal
                ? t("member.streak.keepGoing", {
                    count: goalRemaining,
                    plural: goalRemaining === 1 ? "" : "s",
                  })
                : streakLoading
                  ? t("member.streak.goalLoading")
                  : t("member.streak.goalUnavailable")}
            </p>

            <button type="button" className="streak-start-btn" onClick={() => navigate("/schedule")}>
              {t("member.streak.startWorkout")}
              <PlayArrowRoundedIcon />
            </button>
          </article>
        </aside>
      </div>

      {reportDayKey && (
        <DayReportModal
          dayKey={reportDayKey}
          report={report}
          loading={reportLoading}
          error={reportError}
          onClose={closeReport}
        />
      )}
    </div>
  );
}
