import { useEffect, useMemo, useState } from "react";
import ModalShell from "../common/ModalShell";
import { DumbbellGlyph } from "./SurveyIcons";
import { useTranslation } from "react-i18next";
import {
  buildMonthCalendar,
  defaultSelectedDay,
  findDay,
  sessionForWeekday,
  weekdayInitials,
} from "../../utils/planCalendar";
import "./TrainingPlanPreviewModal.css";

/**
 * Popup "Preview training plan" (Figma: Survey - Preview training plan): lịch tháng + chi tiết ngày đang chọn.
 * Đóng (Close / Esc / bấm nền) chỉ quay về màn Result.
 */
export default function TrainingPlanPreviewModal({ open, onClose, plan }) {
  const { t } = useTranslation("member");
  const calendar = useMemo(() => buildMonthCalendar(plan), [plan]);
  const [selectedDay, setSelectedDay] = useState(() => defaultSelectedDay(calendar));

  // Mỗi lần mở lại popup thì quay về ngày mặc định
  useEffect(() => {
    if (open) setSelectedDay(defaultSelectedDay(calendar));
  }, [open, calendar]);

  const selected = findDay(calendar, selectedDay);
  const slot = selected?.hasSession ? sessionForWeekday(plan, selected.weekday) : undefined;

  return (
    <ModalShell open={open} onClose={onClose} labelledBy="plan-preview-title" className="plan-preview">
      <header className="plan-preview-head">
        <div>
          <h2 className="plan-preview-title" id="plan-preview-title">
            {t("survey.planPreview.title")}
          </h2>
          <p className="plan-preview-sub">
            {t("survey.planPreview.caption", { name: plan.name })}
          </p>
        </div>
        <button type="button" className="plan-preview-close" onClick={onClose}>
          {t("survey.planPreview.close")}
        </button>
      </header>

      <div className="plan-preview-body">
        <section className="plan-preview-calendar">
          <h3 className="plan-preview-heading">{t("survey.planPreview.monthCalendar")}</h3>
          <p className="plan-preview-sub">{calendar.label}</p>

          <div className="plan-preview-grid plan-preview-weekdays">
            {weekdayInitials().map((initial, i) => (
              <span key={`${initial}-${i}`}>{initial}</span>
            ))}
          </div>
          <div className="plan-preview-weeks">
            {calendar.weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="plan-preview-grid">
                {week.map((cell, dayIndex) =>
                  cell === null ? (
                    <span key={dayIndex} className="plan-preview-day plan-preview-day--empty" />
                  ) : (
                    <button
                      key={cell.day}
                      type="button"
                      className={[
                        "plan-preview-day",
                        cell.hasSession ? "has-session" : "",
                        cell.day === selectedDay ? "is-active" : "",
                      ].join(" ")}
                      aria-label={`${t("survey.planPreview.dayAria", { day: cell.day })}${cell.hasSession ? t("survey.planPreview.trainingDayAria") : ""}`}
                      aria-pressed={cell.day === selectedDay}
                      onClick={() => setSelectedDay(cell.day)}
                    >
                      {cell.day}
                    </button>
                  ),
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="plan-preview-detail">
          <h3 className="plan-preview-heading">{t("survey.planPreview.selectedDay")}</h3>
          <p className="plan-preview-sub">
            {selected
              ? `${t(`survey.weekdays.${calendar.weekdayKeys[selected.weekday]}`)}, ${calendar.monthName} ${selected.day} • ${slot?.name ?? t("survey.planPreview.recoveryDay")}`
              : " "}
          </p>

          {slot && (
            <p className="plan-preview-duration">
              {t("survey.planPreview.durationRange", {
                min: Math.max(10, plan.minutesPerSession - 5),
                max: plan.minutesPerSession,
              })}
            </p>
          )}

          <ul className="plan-preview-exercises">
            {(slot?.exercises ?? []).map((exercise) => (
              <li key={exercise.name}>
                <span className="plan-preview-exercise-icon">
                  <DumbbellGlyph />
                </span>
                <div>
                  <p className="plan-preview-exercise-name">{exercise.name}</p>
                  {exercise.detail && <p className="plan-preview-exercise-detail">{exercise.detail}</p>}
                </div>
              </li>
            ))}
          </ul>

          <p className="plan-preview-note">
            {t("survey.planPreview.note", {
              month: calendar.monthName,
              planLength: calendar.planLength,
              sessions: calendar.sessionDays.length,
              recovery:
                calendar.daysInMonth > calendar.planLength
                  ? t("survey.planPreview.recoveryLeft", {
                      month: calendar.monthName,
                      from: calendar.planLength + 1,
                      to: calendar.daysInMonth,
                    })
                  : t("survey.planPreview.recoveryNone"),
            })}
          </p>
        </section>
      </div>
    </ModalShell>
  );
}
