import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import BackButton from "../components/common/BackButton";
import BarChart from "../components/common/BarChart";
import trackingApi from "../api/tracking";
import "./PerformanceAnalytics.css";

const RANGE_IDS = ["1M", "3M", "1Y"];

// Nhãn cột 1Y là "Q1 2026"... -> thêm các tháng của quý ở dòng chữ nhỏ bên dưới
const QUARTER_MONTHS = { Q1: "Jan – Mar", Q2: "Apr – Jun", Q3: "Jul – Sep", Q4: "Oct – Dec" };

const VOLUME_METRIC_IDS = ["reps", "hold"];

function formatDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}h ${minutes}m`;
}

/** Thời gian giữ của bài HOLD: 45s, 3m, 12m 05s, 2h 27m. */
function formatHold(totalSeconds) {
  if (totalSeconds >= 3600) return formatDuration(Math.round(totalSeconds / 60));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (!minutes) return `${seconds}s`;
  return seconds ? `${minutes}m ${String(seconds).padStart(2, "0")}s` : `${minutes}m`;
}

/** Vòng tiến độ theo phần trăm; percent = null thì hiện "—" (chưa đo). */
function RatioRing({ percent, label, colors = ["#6C8CFF", "#A855F7"] }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const gradientId = `pa-ring-${label.replace(/\s+/g, "-")}`;

  return (
    <div className="pa-donut">
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={colors[0]} />
            <stop offset="100%" stopColor={colors[1]} />
          </linearGradient>
        </defs>
        <circle cx="70" cy="70" r={radius} className="pa-donut-track" />
        {percent != null && (
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${(percent / 100) * circumference} ${circumference}`}
            transform="rotate(-90 70 70)"
          />
        )}
      </svg>
      <div className="pa-donut-center">
        <strong>{percent != null ? `${percent}%` : "—"}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function SectionLabel({ index, children }) {
  return (
    <h2 className="pa-section-label">
      <span>{index}</span>
      {children}
    </h2>
  );
}

export default function PerformanceAnalytics() {
  const { t } = useTranslation();
  const [range, setRange] = useState("1M");
  const [volumeMetric, setVolumeMetric] = useState("reps");
  // Số liệu luôn lấy từ tài khoản đang đăng nhập; không còn dữ liệu mẫu dự phòng
  const [state, setState] = useState({ status: "loading", data: null });
  const period = t(
    {
      "1M": "member.analytics.periodThisMonth",
      "3M": "member.analytics.periodLast3Months",
      "1Y": "member.analytics.periodThisYear",
    }[range],
  );

  useEffect(() => {
    let active = true;
    setState({ status: "loading", data: null });
    trackingApi
      .getAnalytics(range)
      .then((res) => active && setState({ status: "ready", data: res }))
      .catch(() => active && setState({ status: "error", data: null }));
    return () => {
      active = false;
    };
  }, [range]);

  const data = state.status === "ready" && state.data?.sessions > 0 ? state.data : null;

  const cleanRatio = data?.reps.total
    ? Math.round((data.reps.valid / data.reps.total) * 100)
    : null;
  // BE bản cũ chưa trả số liệu hold -> coi như không có bài hold thay vì làm vỡ trang
  const hold = data?.hold ?? { entries: 0, totalSeconds: 0, bestSetSeconds: 0, formScore: null };
  const showHold = volumeMetric === "hold";
  const volumeValue = (b) => (showHold ? b.holdSeconds ?? 0 : b.reps);
  const volumeTotal = data?.volume.reduce((sum, b) => sum + volumeValue(b), 0) ?? 0;
  const bucket = t(
    {
      "1M": "member.analytics.bucketWeek",
      "3M": "member.analytics.bucketMonth",
      "1Y": "member.analytics.bucketQuarter",
    }[range],
  );
  const totalMinutes = data ? data.duration.activeMin + data.duration.restMin : 0;
  const activePercent = totalMinutes
    ? Math.round((data.duration.activeMin / totalMinutes) * 100)
    : 0;

  return (
    <div className="performance-analytics">
      <BackButton to="/tracking">{t("member.analytics.backToOverview")}</BackButton>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="pa-header">
        <span className="pa-eyebrow">{t("member.analytics.eyebrow")}</span>
        <h1 className="pa-title">{t("member.analytics.title")}</h1>
        <p className="pa-subtitle">
          {t("member.analytics.subtitle")}
        </p>
      </header>

      <div className="pa-tabs" role="tablist" aria-label={t("member.analytics.timeRangeAria")}>
        {RANGE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={range === id}
            className={`pa-tab ${range === id ? "active" : ""}`}
            onClick={() => setRange(id)}
          >
            {id}
          </button>
        ))}
      </div>

      {!data ? (
        <p className="pa-card pa-empty" role={state.status === "error" ? "alert" : undefined}>
          {state.status === "loading"
            ? t("member.analytics.loading")
            : state.status === "error"
              ? t("member.analytics.loadFailed")
              : t("member.analytics.empty", { period })}
        </p>
      ) : (
        <>
          {/* ── 01 AI form & accuracy ─────────────────────────────── */}
          <section className="pa-section">
            <SectionLabel index="01">{t("member.analytics.sectionForm")}</SectionLabel>
            <div className="pa-grid">
              <article className="pa-card">
                <h3 className="pa-card-title">{t("member.analytics.cleanRepRatio")}</h3>
                <p className="pa-card-subtitle">{t("member.analytics.validVsTotal")}</p>
                <div className="pa-card-body">
                  <RatioRing percent={cleanRatio} label={t("member.analytics.cleanReps")} />
                  <div className="pa-reps">
                    <div>
                      <strong>{data.reps.valid.toLocaleString("en-US")}</strong>
                      <span>{t("member.analytics.validReps")}</span>
                    </div>
                    <div>
                      <strong>{data.reps.total.toLocaleString("en-US")}</strong>
                      <span>{t("member.analytics.totalReps")}</span>
                    </div>
                  </div>
                </div>
                <p className="pa-formula">{t("member.analytics.cleanRepFormula")}</p>
              </article>

              <article className="pa-card">
                <h3 className="pa-card-title">{t("member.analytics.cleanHoldRatio")}</h3>
                <p className="pa-card-subtitle">{t("member.analytics.holdScore")}</p>
                {hold.entries === 0 ? (
                  <p className="pa-card-subtitle pa-card-empty">
                    {t("member.analytics.noHoldExercises", { period })}
                  </p>
                ) : (
                  <div className="pa-card-body">
                    <RatioRing
                      percent={hold.formScore}
                      label={t("member.analytics.cleanHold")}
                      colors={["#EC4899", "#A855F7"]}
                    />
                    <div className="pa-reps">
                      <div>
                        <strong>{formatHold(hold.totalSeconds)}</strong>
                        <span>{t("member.analytics.totalHoldTime")}</span>
                      </div>
                      <div>
                        <strong>{formatHold(hold.bestSetSeconds)}</strong>
                        <span>{t("member.analytics.bestHoldSet")}</span>
                      </div>
                    </div>
                  </div>
                )}
                <p className="pa-formula">{t("member.analytics.cleanHoldFormula")}</p>
              </article>
            </div>
          </section>

          {/* ── 02 Training volume & load ─────────────────────────── */}
          <section className="pa-section">
            <SectionLabel index="02">{t("member.analytics.sectionVolume")}</SectionLabel>

            <article className={`pa-card pa-volume ${range === "1Y" ? "pa-volume-sublabels" : ""}`}>
              <header className="pa-volume-head">
                <div>
                  <h3 className="pa-card-title">{t("member.analytics.volumeProgression")}</h3>
                  <p className="pa-card-subtitle">
                    {showHold
                      ? t("member.analytics.volumeHoldSubtitle", { bucket })
                      : t("member.analytics.volumeRepsSubtitle", { bucket })}
                  </p>
                  <div className="pa-metric-tabs" role="tablist" aria-label={t("member.analytics.volumeMetricAria")}>
                    {VOLUME_METRIC_IDS.map((id) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={volumeMetric === id}
                        className={`pa-metric-tab ${volumeMetric === id ? "active" : ""}`}
                        onClick={() => setVolumeMetric(id)}
                      >
                        {t(id === "hold" ? "member.analytics.metricHold" : "member.analytics.metricReps")}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pa-volume-total">
                  <strong>
                    {showHold ? formatHold(volumeTotal) : volumeTotal.toLocaleString("en-US")}
                  </strong>
                  <span>
                    {showHold
                      ? t("member.analytics.holdTimeUnit")
                      : t("member.analytics.repsUnit")}{" "}
                    {period}
                  </span>
                </div>
              </header>
              <div className="pa-volume-chart">
                <BarChart
                  ariaLabel={showHold
                    ? t("member.analytics.holdChartAria")
                    : t("member.analytics.repsChartAria")}
                  height={150}
                  barWidth={80}
                  data={data.volume.map((b) => {
                    const value = volumeValue(b);
                    return {
                      label: b.label,
                      sublabel: QUARTER_MONTHS[b.label.split(" ")[0]],
                      value,
                      display: showHold ? formatHold(value) : value.toLocaleString("en-US"),
                    };
                  })}
                />
              </div>
            </article>

            <article className="pa-card pa-duration">
              <div className="pa-duration-head">
                <span className="pa-icon-box">
                  <AccessTimeRoundedIcon />
                </span>
                <div className="pa-duration-title">
                  <h3 className="pa-card-title">{t("member.analytics.durationTitle")}</h3>
                  <p className="pa-card-subtitle">{t("member.analytics.durationSubtitle", { period })}</p>
                </div>
                <dl className="pa-duration-stats">
                  <div>
                    <dt>{t("member.analytics.totalDuration")}</dt>
                    <dd>{formatDuration(totalMinutes)}</dd>
                  </div>
                  <div>
                    <dt>{t("member.analytics.activeTraining")}</dt>
                    <dd>{formatDuration(data.duration.activeMin)}</dd>
                  </div>
                  <div>
                    <dt>{t("member.analytics.restBetweenSets")}</dt>
                    <dd>{formatDuration(data.duration.restMin)}</dd>
                  </div>
                </dl>
              </div>
              <div
                className="pa-progress"
                role="progressbar"
                aria-valuenow={activePercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t("member.analytics.activeShareAria")}
              >
                <div className="pa-progress-fill" style={{ width: `${activePercent}%` }} />
              </div>
              <div className="pa-progress-legend">
                <span className="active">{t("member.analytics.percentActive", { count: activePercent })}</span>
                <span>{t("member.analytics.percentRest", { count: 100 - activePercent })}</span>
              </div>
            </article>
          </section>

          {/* ── AI insight ────────────────────────────────────────── */}
          {data.insight && (
            <aside className="pa-card pa-insight">
              <span className="pa-insight-icon">
                <AutoAwesomeRoundedIcon />
              </span>
              <div>
                <span className="pa-insight-label">{t("member.analytics.insight")}</span>
                <p className="pa-insight-title">{data.insight.title}</p>
                <p className="pa-insight-text">{data.insight.text}</p>
              </div>
            </aside>
          )}
        </>
      )}
    </div>
  );
}
