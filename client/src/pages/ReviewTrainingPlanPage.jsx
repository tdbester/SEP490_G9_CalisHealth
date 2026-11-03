import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { memberScheduleApi } from "../api/memberSchedule";
import "./ReviewTrainingPlanPage.css";

const WEEK_DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CATEGORY_LABEL = { HEALTH: "Health", SKILL: "Skill" };

function parseIso(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function mondayOf(date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = (monday.getDay() + 6) % 7; // 0 = Thứ 2
  monday.setDate(monday.getDate() - weekday);
  return monday;
}

export default function ReviewTrainingPlanPage() {
  const navigate = useNavigate();
  const [weekRule, setWeekRule] = useState(null);
  const [planInfo, setPlanInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [rule, plan] = await Promise.all([
          // week-rule đã gộp lịch của cả hai tháng khi tuần qua ranh giới tháng.
          memberScheduleApi.getWeekRule().catch(() => null),
          memberScheduleApi.getPlanInfo().catch(() => null),
        ]);
        if (cancelled) return;
        setWeekRule(rule || null);
        setPlanInfo(plan || null);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError?.response?.data?.message ||
              "Could not load this week's workout plan.",
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
  }, []);

  // Tuần hiện tại, Thứ 2 -> Chủ nhật
  const week = useMemo(() => {
    const monday = mondayOf(new Date());
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate(),
      ).padStart(2, "0")}`;
      return {
        key: WEEK_DAYS[index],
        label: DAY_LABELS[index],
        iso,
        dateLabel: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        isToday: iso === todayIso(),
      };
    });
  }, []);

  /** Buổi tập của tuần hiện tại (backend đã gộp cả 2 tháng nếu tuần qua ranh giới). */
  const byDate = useMemo(() => {
    const map = {};
    (weekRule?.entries || []).forEach((entry) => {
      const list = map[entry.date] || [];
      list.push(entry);
      map[entry.date] = list;
    });
    return map;
  }, [weekRule]);

  const plannedCount = week.reduce((sum, day) => sum + (byDate[day.iso]?.length || 0), 0);
  const plannedDays = week.filter((day) => (byDate[day.iso]?.length || 0) > 0).length;

  if (loading) {
    return <div className="review-loading">Loading…</div>;
  }

  return (
    <div className="review-page">
      <header className="review-head">
        <h1 className="review-title">Review workout plan</h1>
        <p className="review-subtitle">
          {formatMonth(new Date())} · week of {week[0].dateLabel} – {week[6].dateLabel}
        </p>
      </header>

      {error && <div className="review-alert">{error}</div>}

      {/* Plan info: ẩn khi member chưa có template phù hợp */}
      {planInfo && (
        <section className="review-card">
          <h2 className="review-card__title">Plan info</h2>
          <div className="review-plan-grid">
            {[
              ["Name", planInfo.templateName],
              ["Year", planInfo.year],
              ["Level", planInfo.level],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="review-plan-grid__label">{label}</div>
                <div className="review-plan-grid__value">{value}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="review-week">
        <div className="review-week__head">
          {week.map((day) => (
            <div
              key={day.key}
              className={`review-day-head${day.isToday ? " is-today" : ""}`}
            >
              <span className="review-day-head__date">{day.dateLabel}</span>
              <span className="review-day-head__name">{day.label}</span>
            </div>
          ))}
        </div>

        <div className="review-week__body">
          {week.map((day) => {
            const entries = byDate[day.iso] || [];
            return (
              <div
                key={day.key}
                className={`review-day-cell${day.isToday ? " is-today" : ""}`}
              >
                {entries.length > 0 ? (
                  entries.map((entry) => (
                    <article
                      key={entry.id ?? `${day.iso}-${entry.workoutCode}`}
                      className={`review-workout review-workout--${
                        entry.category === "SKILL" ? "skill" : "health"
                      }`}
                    >
                      <span
                        className={`review-workout__badge review-workout__badge--${
                          entry.category === "SKILL" ? "skill" : "health"
                        }`}
                      >
                        {CATEGORY_LABEL[entry.category] ?? "Health"}
                      </span>
                      <h3 className="review-workout__name">{entry.workoutName}</h3>
                      <p className="review-workout__meta">
                        {entry.workoutLevel} · {entry.exerciseCount} exercises
                      </p>
                      <p className="review-workout__meta review-workout__meta--dim">
                        {entry.durationMinutes} min
                      </p>
                    </article>
                  ))
                ) : (
                  <div className="review-workout review-workout--empty">Rest day</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <p className="review-summary">
        {plannedCount > 0
          ? `${plannedCount} workout${plannedCount === 1 ? "" : "s"} planned · ${plannedDays} day${
              plannedDays === 1 ? "" : "s"
            } this week.`
          : "No workout planned for this week yet. Go back and pick your days."}
      </p>

      <div className="review-actions">
        <button type="button" className="review-back" onClick={() => navigate("/schedule")}>
          ← Back
        </button>
        <button
          type="button"
          className="review-go"
          onClick={() => navigate("/plan")}
          disabled={plannedCount === 0}
        >
          Let&apos;s go →
        </button>
      </div>
    </div>
  );
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

function formatMonth(value) {
  const date = typeof value === "string" ? parseIso(value) : value;
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
