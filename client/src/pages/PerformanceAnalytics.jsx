import { useEffect, useState } from "react";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import BackButton from "../components/common/BackButton";
import BarChart from "../components/common/BarChart";
import trackingApi from "../api/tracking";
import "./PerformanceAnalytics.css";

const RANGES = [
  { id: "1M", period: "this month" },
  { id: "3M", period: "in the last 3 months" },
  { id: "1Y", period: "this year" },
];

const ERROR_COLORS = ["#EC4899", "#C084FC", "#6C8CFF", "#4A4466"];

function formatDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}h ${minutes}m`;
}

/** Vòng donut chia theo tỉ lệ các lỗi form. */
function ErrorDonut({ items, total }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const gap = 4;
  let offset = 0;

  return (
    <div className="pa-donut">
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <circle cx="70" cy="70" r={radius} className="pa-donut-track" />
        {items.map((item, i) => {
          const length = (item.percent / 100) * circumference;
          const segment = (
            <circle
              key={item.label}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={ERROR_COLORS[i % ERROR_COLORS.length]}
              strokeWidth="14"
              strokeDasharray={`${Math.max(length - gap, 0)} ${circumference}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            />
          );
          offset += length;
          return segment;
        })}
      </svg>
      <div className="pa-donut-center">
        <strong>{total}</strong>
        <span>Tags</span>
      </div>
    </div>
  );
}

/** Vòng tiến độ cho tỉ lệ rep sạch. */
function RatioRing({ percent }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="pa-donut">
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <defs>
          <linearGradient id="pa-ratio-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6C8CFF" />
            <stop offset="100%" stopColor="#A855F7" />
          </linearGradient>
        </defs>
        <circle cx="70" cy="70" r={radius} className="pa-donut-track" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="url(#pa-ratio-fill)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${(percent / 100) * circumference} ${circumference}`}
          transform="rotate(-90 70 70)"
        />
      </svg>
      <div className="pa-donut-center">
        <strong>{percent}%</strong>
        <span>clean reps</span>
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
  const [range, setRange] = useState("1M");
  // Số liệu luôn lấy từ tài khoản đang đăng nhập; không còn dữ liệu mẫu dự phòng
  const [state, setState] = useState({ status: "loading", data: null });
  const period = RANGES.find((r) => r.id === range).period;

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
  const totalReps = data?.volume.reduce((sum, b) => sum + b.reps, 0) ?? 0;
  const totalMinutes = data ? data.duration.activeMin + data.duration.restMin : 0;
  const activePercent = totalMinutes
    ? Math.round((data.duration.activeMin / totalMinutes) * 100)
    : 0;

  return (
    <div className="performance-analytics">
      <BackButton to="/tracking">Back to health overview</BackButton>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="pa-header">
        <span className="pa-eyebrow">Deep insights</span>
        <h1 className="pa-title">Performance analytics</h1>
        <p className="pa-subtitle">
          Understand your training trends and make every session count.
        </p>
      </header>

      <div className="pa-tabs" role="tablist" aria-label="Time range">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={range === r.id}
            className={`pa-tab ${range === r.id ? "active" : ""}`}
            onClick={() => setRange(r.id)}
          >
            {r.id}
          </button>
        ))}
      </div>

      {!data ? (
        <p className="pa-card pa-empty" role={state.status === "error" ? "alert" : undefined}>
          {state.status === "loading"
            ? "Loading your analytics…"
            : state.status === "error"
              ? "We could not load your analytics. Please try again later."
              : `No workouts recorded ${period}. Complete a few AI-tracked workouts to see your trends.`}
        </p>
      ) : (
        <>
          {/* ── 01 AI form & accuracy ─────────────────────────────── */}
          <section className="pa-section">
            <SectionLabel index="01">AI form &amp; accuracy metrics</SectionLabel>
            <div className="pa-grid">
              <article className="pa-card">
                <h3 className="pa-card-title">Common Form Errors</h3>
                <p className="pa-card-subtitle">Issues detected by AI coaching</p>
                <div className="pa-card-body">
                  <ErrorDonut items={data.formErrors.items} total={data.formErrors.totalTags} />
                  {data.formErrors.items.length === 0 && (
                    <p className="pa-card-subtitle">No form errors flagged {period}.</p>
                  )}
                  <ul className="pa-legend">
                    {data.formErrors.items.map((item, i) => (
                      <li key={item.label}>
                        <span
                          className="pa-legend-dot"
                          style={{ background: ERROR_COLORS[i % ERROR_COLORS.length] }}
                        />
                        <span className="pa-legend-label">{item.label}</span>
                        <strong>{item.percent}%</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>

              <article className="pa-card">
                <h3 className="pa-card-title">Clean Rep Ratio</h3>
                <p className="pa-card-subtitle">Valid reps vs. total reps</p>
                <div className="pa-card-body">
                  <RatioRing percent={cleanRatio ?? 0} />
                  <div className="pa-reps">
                    <div>
                      <strong>{data.reps.valid.toLocaleString("en-US")}</strong>
                      <span>Valid reps</span>
                    </div>
                    <div>
                      <strong>{data.reps.total.toLocaleString("en-US")}</strong>
                      <span>Total reps</span>
                    </div>
                  </div>
                </div>
                <p className="pa-formula">Clean reps ÷ Total reps × 100</p>
              </article>
            </div>
          </section>

          {/* ── 02 Training volume & load ─────────────────────────── */}
          <section className="pa-section">
            <SectionLabel index="02">Training volume &amp; load</SectionLabel>

            <article className="pa-card pa-volume">
              <header className="pa-volume-head">
                <div>
                  <h3 className="pa-card-title">Volume Load Progression</h3>
                  <p className="pa-card-subtitle">
                    Total completed reps per {range === "1M" ? "week" : "month"}
                  </p>
                </div>
                <div className="pa-volume-total">
                  <strong>{totalReps.toLocaleString("en-US")}</strong>
                  <span>reps {period}</span>
                </div>
              </header>
              <div className="pa-volume-chart">
                <BarChart
                  ariaLabel="Completed reps bar chart"
                  height={150}
                  barWidth={80}
                  data={data.volume.map((b) => ({
                    label: b.label,
                    value: b.reps,
                    display: b.reps.toLocaleString("en-US"),
                  }))}
                />
              </div>
            </article>

            <article className="pa-card pa-duration">
              <div className="pa-duration-head">
                <span className="pa-icon-box">
                  <AccessTimeRoundedIcon />
                </span>
                <div className="pa-duration-title">
                  <h3 className="pa-card-title">Workout Duration &amp; Active Time</h3>
                  <p className="pa-card-subtitle">Your time distribution {period}</p>
                </div>
                <dl className="pa-duration-stats">
                  <div>
                    <dt>Total workout duration</dt>
                    <dd>{formatDuration(totalMinutes)}</dd>
                  </div>
                  <div>
                    <dt>Active training</dt>
                    <dd>{formatDuration(data.duration.activeMin)}</dd>
                  </div>
                  <div>
                    <dt>Rest between sets</dt>
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
                aria-label="Active training share"
              >
                <div className="pa-progress-fill" style={{ width: `${activePercent}%` }} />
              </div>
              <div className="pa-progress-legend">
                <span className="active">{activePercent}% active</span>
                <span>{100 - activePercent}% rest</span>
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
                <span className="pa-insight-label">Insight</span>
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
