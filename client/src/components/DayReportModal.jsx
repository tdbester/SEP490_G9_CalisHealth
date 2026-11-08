import { useCallback, useEffect, useRef, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import FitnessCenterRoundedIcon from "@mui/icons-material/FitnessCenterRounded";
import AccessibilityNewRoundedIcon from "@mui/icons-material/AccessibilityNewRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import DirectionsWalkRoundedIcon from "@mui/icons-material/DirectionsWalkRounded";
import HorizontalRuleRoundedIcon from "@mui/icons-material/HorizontalRuleRounded";
import { useTranslation } from "react-i18next";
import "./DayReportModal.css";

function formatReportDate(dayKey) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

const EXERCISE_ICONS = {
  squat: DirectionsWalkRoundedIcon,
  pushup: FitnessCenterRoundedIcon,
  plank: HorizontalRuleRoundedIcon,
  lunge: AccessibilityNewRoundedIcon,
  pullup: AccessibilityNewRoundedIcon,
  dip: FitnessCenterRoundedIcon,
  muscleup: TrendingUpRoundedIcon,
};

/** Icon bài tập được suy ra từ type do API trả về. */
function ExerciseIcon({ icon }) {
  const Icon = EXERCISE_ICONS[icon] ?? FitnessCenterRoundedIcon;
  return (
    <span className="report-ex-icon">
      <Icon />
    </span>
  );
}

/** Ô số liệu: Sets / Reps / Form accuracy. */
function MetricBox({ label, value, caption, tone, progress }) {
  const { t } = useTranslation();
  return (
    <div className={`report-metric ${tone ? `is-${tone}` : ""}`}>
      <span className="report-metric-label">{label}</span>
      <p className="report-metric-value">{value}</p>
      {caption ? <span className="report-metric-caption">{caption}</span> : null}
      {progress !== undefined ? (
        <div
          className="report-metric-bar"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("member.report.metricProgressAria", { label, progress })}
        >
          <div className="report-metric-fill" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
    </div>
  );
}

/** Thẻ một bài tập: header gập/tháng + 3 ô số liệu khi mở rộng. */
function ExerciseCard({ exercise, expanded, onToggle }) {
  const { t } = useTranslation();
  return (
    <li className={`report-ex-card ${expanded ? "is-expanded" : ""}`}>
      <button
        type="button"
        className="report-ex-head"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <ExerciseIcon icon={exercise.icon} />
        <span className="report-ex-name">{exercise.name}</span>
        <span className="report-ex-chevron">
          <ExpandMoreRoundedIcon />
        </span>
      </button>

      {expanded && (
        <div className="report-ex-body">
          <MetricBox label={t("member.report.sets")} value={exercise.sets} caption={t("member.report.completed")} />
          <MetricBox label={t("member.report.reps")} value={exercise.reps} caption={t("member.report.perSet")} />
          <MetricBox
            label={t("member.report.formAccuracy")}
            value={`${exercise.formAccuracy}%`}
            tone="pink"
            progress={exercise.formAccuracy}
          />
        </div>
      )}
    </li>
  );
}

/**
 * Day Report — popup read-only hiển thị chi tiết một ngày đã tập.
 * Đóng bằng nút "Back to Day Streak", nút X, phím Esc hoặc bấm ra ngoài.
 */
export default function DayReportModal({ dayKey, report, loading, error, onClose }) {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState(null);
  const dialogRef = useRef(null);

  const toggleExercise = useCallback((id) => {
    setExpandedId((current) => (current === id ? null : id));
  }, []);

  useEffect(() => {
    setExpandedId(null);
  }, [dayKey, report]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    dialogRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="report-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="report-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        {/* ── Header & controls ─────────────────────────────────── */}
        <header className="report-head">
          <button type="button" className="report-back" onClick={onClose}>
            <ArrowBackRoundedIcon />
            {t("member.report.backToDayStreak")}
          </button>

          <button
            type="button"
            className="report-close"
            onClick={onClose}
            aria-label={t("member.report.closeDayReport")}
          >
            <CloseRoundedIcon />
          </button>
        </header>

        {/* ── Title & date ──────────────────────────────────────── */}
        <div className="report-title-block">
          <h2 className="report-title" id="report-title">
            {t("member.report.dayReport")}
          </h2>
          <p className="report-date">{formatReportDate(dayKey)}</p>
        </div>

        {/* ── Completed exercises ───────────────────────────────── */}
        <h3 className="report-section-title">{t("member.report.completedExercises")}</h3>

        {loading ? (
          <p role="status">{t("member.report.loadingReport")}</p>
        ) : error ? (
          <p role="alert">{t("member.report.noReport")}</p>
        ) : report ? (
          <>
            <ul className="report-ex-list">
              {report.exercises.map((exercise) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={{
                    ...exercise,
                    icon: exercise.type?.toLowerCase(),
                    formAccuracy: Math.round(exercise.formAccuracy),
                  }}
                  expanded={expandedId === exercise.id}
                  onToggle={() => toggleExercise(exercise.id)}
                />
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}