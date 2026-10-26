import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AccessibilityNewRoundedIcon from "@mui/icons-material/AccessibilityNewRounded";
import MonitorHeartOutlinedIcon from "@mui/icons-material/MonitorHeartOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import BarChart from "../components/common/BarChart";
import UpdateStatsModal from "../components/tracking/UpdateStatsModal";
import { calculateBmi, classifyBmi } from "../utils/bmi";
import trackingApi from "../api/tracking";
import { isMemberSession } from "../api/survey";
import SurveyReminder from "../components/survey/SurveyReminder";
import "./HealthTracking.css";

// Seed data là tùy chọn: glob trả về {} khi file đã bị xóa, nên trang không bị lỗi build.
const seedModules = import.meta.glob("../data/healthTracking.seed.js", { eager: true });
const SEED = Object.values(seedModules)[0]?.default ?? null;

// Màn đích của các nút điều hướng (5.3, 5.5). Màn 5.2 là popup UpdateStatsModal.
const TRACKING_ROUTES = {
  workoutHistory: "/tracking/workout-history",
  assessment: "/tracking/assessment",
};

const GAUGE_SEGMENTS = 20;

function formatUpdatedAt(value) {
  const date = dayjs(value);
  return date.isSame(dayjs(), "day")
    ? `today at ${date.format("HH:mm")}`
    : date.format("DD MMM YYYY, HH:mm");
}

/** Vòng điểm sức khỏe dạng phân đoạn: phần đã đạt là cung gradient, phần còn lại là vạch mảnh. */
function ScoreGauge({ score }) {
  const filled = Math.round(((score ?? 0) / 100) * GAUGE_SEGMENTS);
  const step = 360 / GAUGE_SEGMENTS;

  return (
    <div className="ht-gauge">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <defs>
          <linearGradient id="ht-gauge-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
        </defs>
        {Array.from({ length: GAUGE_SEGMENTS }, (_, i) => {
          const isFilled = i < filled;
          return (
            <line
              key={i}
              x1="60"
              y1={isFilled ? 6 : 9}
              x2="60"
              y2={isFilled ? 20 : 17}
              transform={`rotate(${i * step} 60 60)`}
              stroke={isFilled ? "url(#ht-gauge-fill)" : "#4F6BF5"}
              strokeWidth={isFilled ? 9 : 2.5}
              strokeLinecap={isFilled ? "butt" : "round"}
            />
          );
        })}
      </svg>
      <div className="ht-gauge-center">
        <span className="ht-gauge-value">{score ?? "—"}</span>
        <span className="ht-gauge-label">Health score</span>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, unit, note, onEdit }) {
  return (
    <article className="ht-card ht-metric">
      <span className="ht-icon-box">
        <Icon />
      </span>
      <div className="ht-metric-body">
        <span className="ht-metric-label">{label}</span>
        <span className="ht-metric-value">
          {value ?? "—"}
          {value != null && <span className="ht-metric-unit">{unit}</span>}
        </span>
        {note && <span className="ht-metric-note">{note}</span>}
      </div>
      <button
        type="button"
        className="ht-icon-btn"
        aria-label={`Update ${label.toLowerCase()}`}
        onClick={onEdit}
      >
        <EditOutlinedIcon />
      </button>
    </article>
  );
}

function BmiChart({ records }) {
  const baseline = records.length > 0
    ? Math.floor(Math.min(...records.map((r) => Number(r.bmi)))) - 1
    : 18;

  return (
    <div className="ht-chart">
      <BarChart
        ariaLabel="Monthly BMI bar chart"
        baseline={baseline}
        data={records.map((record) => ({
          key: record.month,
          label: dayjs(record.month).format("MMM"),
          value: Number(record.bmi),
          display: Number(record.bmi).toFixed(1),
          title: `${dayjs(record.month).format("MMMM YYYY")}: ${Number(record.bmi).toFixed(1)}`,
        }))}
      />
    </div>
  );
}

export default function HealthTracking() {
  const navigate = useNavigate();
  const [healthScore, setHealthScore] = useState(SEED?.healthScore ?? null);
  const [metrics, setMetrics] = useState(SEED?.bodyMetrics ?? null);
  const [bmiRecords, setBmiRecords] = useState(SEED?.bmiByMonth ?? []);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);

  const openUpdate = () => setIsUpdateOpen(true);
  const closeUpdate = useCallback(() => setIsUpdateOpen(false), []);

  const loadData = useCallback(() => {
    trackingApi
      .getOverview()
      .then((res) => {
        if (res.healthScore) {
          setHealthScore(res.healthScore);
        }
        if (res.bodyMetrics && res.bodyMetrics.weightKg != null) {
          setMetrics(res.bodyMetrics);
        }
        if (res.bmiOverview?.records) {
          setBmiRecords(res.bmiOverview.records);
        }
      })
      .catch(() => {
        // Fallback dữ liệu tĩnh nếu API chưa online
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveMeasurements = async ({ weightKg, heightCm }) => {
    try {
      const res = await trackingApi.updateMeasurements({ weightKg, heightCm });
      setMetrics(res);
      loadData();
    } catch {
      // Fallback state
      setMetrics((prev) => ({
        ...prev,
        weightKg,
        heightCm,
        weightChangeKg:
          prev?.weightChangeKg != null
            ? Math.round((prev.weightChangeKg + weightKg - prev.weightKg) * 10) / 10
            : null,
        updatedAt: new Date().toISOString(),
      }));
    }
    setIsUpdateOpen(false);
  };

  const currentBmi = calculateBmi(metrics?.weightKg, metrics?.heightCm);
  const bmiClass = currentBmi != null ? classifyBmi(currentBmi) : null;
  const latestRecord = bmiRecords[bmiRecords.length - 1];

  const weightChange = metrics?.weightChangeKg;
  const weightNote =
    weightChange != null
      ? `${weightChange > 0 ? "+" : ""}${weightChange} kg this month`
      : null;

  const hasScore = healthScore?.score != null && healthScore.score > 0;

  return (
    <div className="health-tracking">
      {/* ── Nút làm survey cho member chưa hoàn thành (đã bỏ qua lần đầu) ── */}
      {isMemberSession() && <SurveyReminder />}

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="ht-header">
        <span className="ht-date">{dayjs().format("dddd, DD MMMM YYYY")}</span>
        <h1 className="ht-title">Your health, in motion.</h1>
        <p className="ht-subtitle">
          A clear view of your body, activity, and progress this week.
        </p>
      </header>

      {/* ── Health score ───────────────────────────────────────── */}
      <section className="ht-hero">
        <ScoreGauge score={hasScore ? healthScore.score : null} />
        <div className="ht-hero-info">
          {hasScore && healthScore.changePercent != null && (
            <span className="ht-pill">
              <TrendingUpRoundedIcon />
              {healthScore.changePercent}% this month
            </span>
          )}
          <h2 className="ht-hero-title">
            {hasScore
              ? (healthScore.statusHeadline || "Great momentum")
              : (healthScore?.statusHeadline || "No health score yet")}
          </h2>
          <p className="ht-hero-text">
            {hasScore
              ? (healthScore.statusDescription || `You are ahead of ${healthScore.peerPercentile}% of people with similar goals.`)
              : (healthScore?.statusDescription || "Log your body metrics and workouts to get your weekly score.")}
          </p>
          <button
            type="button"
            className="ht-link ht-link-lg"
            onClick={() => navigate(TRACKING_ROUTES.assessment)}
          >
            View performance analytics
            <ArrowForwardRoundedIcon />
          </button>
        </div>
      </section>

      {/* ── Body metrics ───────────────────────────────────────── */}
      <section>
        <header className="ht-section-head">
          <div>
            <h2 className="ht-section-title">Body metrics</h2>
            <p className="ht-section-subtitle">
              {metrics?.updatedAt
                ? `Last updated ${formatUpdatedAt(metrics.updatedAt)}`
                : "No measurements logged yet"}
            </p>
          </div>
          <button
            type="button"
            className="ht-link"
            onClick={openUpdate}
          >
            Update
          </button>
        </header>

        <div className="ht-metric-grid">
          <MetricCard
            icon={AccessibilityNewRoundedIcon}
            label="Weight"
            value={metrics?.weightKg}
            unit="kg"
            note={weightNote}
            onEdit={openUpdate}
          />
          <MetricCard
            icon={MonitorHeartOutlinedIcon}
            label="Height"
            value={metrics?.heightCm}
            unit="cm"
            note={metrics?.heightNote}
            onEdit={openUpdate}
          />
        </div>
      </section>

      {/* ── BMI by month ───────────────────────────────────────── */}
      <section className="ht-card ht-bmi">
        <header className="ht-bmi-head">
          <div>
            <h2 className="ht-section-title">BMI by month</h2>
            <p className="ht-section-subtitle">
              Final recorded value at 23:59 on each month&apos;s last day
            </p>
          </div>
          <div className="ht-bmi-current">
            <span className="ht-bmi-current-label">Current BMI</span>
            <span className="ht-bmi-current-value">
              {currentBmi != null ? currentBmi.toFixed(1) : "—"}
            </span>
            {bmiClass && (
              <span className={`ht-badge tone-${bmiClass.tone}`}>{bmiClass.label}</span>
            )}
          </div>
        </header>

        {bmiRecords.length > 0 ? (
          <BmiChart records={bmiRecords} />
        ) : (
          <p className="ht-empty">No monthly BMI records yet.</p>
        )}

        {latestRecord && (
          <p className="ht-bmi-foot">
            <AccessTimeRoundedIcon />
            Latest monthly reading:{" "}
            {dayjs(latestRecord.month).endOf("month").format("DD MMM YYYY, HH:mm")}
          </p>
        )}
      </section>

      {/* ── Workout history ────────────────────────────────────── */}
      <section className="ht-card ht-history">
        <span className="ht-icon-box">
          <HistoryRoundedIcon />
        </span>
        <div className="ht-history-info">
          <h2 className="ht-history-title">Workout history</h2>
          <p className="ht-section-subtitle">
            Review completed sessions and open detailed workout logs.
          </p>
        </div>
        <button
          type="button"
          className="ht-link"
          onClick={() => navigate(TRACKING_ROUTES.workoutHistory)}
        >
          Open history
          <ArrowForwardRoundedIcon />
        </button>
      </section>

      <UpdateStatsModal
        open={isUpdateOpen}
        initialWeightKg={metrics?.weightKg}
        initialHeightCm={metrics?.heightCm}
        onClose={closeUpdate}
        onSave={saveMeasurements}
      />
    </div>
  );
}
