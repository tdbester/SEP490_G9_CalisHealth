import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { surveyApi, surveyErrorMessage } from "../../api/survey";
import SurveyProgress from "../../components/survey/SurveyProgress";
import SurveyTopBar from "../../components/survey/SurveyTopBar";
import TrainingPlanPreviewModal from "../../components/survey/TrainingPlanPreviewModal";
import { ArrowLeft, ArrowRight, MedalIcon, RefreshIcon, SparkleIcon } from "../../components/survey/SurveyIcons";
import { useTranslation } from "react-i18next";
import { unitText } from "../../utils/survey";
import "./Survey.css";

/** Số đẹp cho kết quả: 35 -> "35", 12.5 -> "12.5". */
const formatNumber = (value) => (value === null || value === undefined ? "–" : String(Number(value)));

/** "Level test" -> "level-test" (đúng slug dùng trong URL /survey/:stepSlug). */
const LEVEL_TEST_SLUG = "level-test";

/**
 * Màn "Result and recommended plan": level do backend chấm theo bảng Level Criteria
 * (GET /api/survey-sessions/{id}/result) và kế hoạch gợi ý theo level đó.
 *
 * Member đến màn này bằng nút "Finish" ở bước Level test, rồi có thể bắt đầu kế hoạch,
 * xem trước lịch đầy đủ, quay lại level test để sửa, hoặc làm lại toàn bộ khảo sát.
 */
export default function SurveyResult() {
  const navigate = useNavigate();
  const { t } = useTranslation("member");
  const [state, setState] = useState({ status: "loading" });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(null); // null | "start" | "back"

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const sessions = await surveyApi.sessions();
      const completed = sessions.find((s) => s.status === "COMPLETED");
      if (!completed) {
        navigate("/survey", { replace: true });
        return;
      }
      const [result, definition] = await Promise.all([
        surveyApi.result(completed.sessionId),
        surveyApi.definition(completed.surveyVersion),
      ]);
      setState({ status: "ready", result, sessionId: completed.sessionId, stepCount: definition.steps.length });
    } catch (err) {
      setState({ status: "error", message: surveyErrorMessage(err, t("survey.result.loadFailed")) });
    }
  }, [navigate]);

  useEffect(() => {
    document.title = t("survey.result.documentTitle");
    load();
  }, [load]);

  /** "Start my training plan": chốt kế hoạch rồi về dashboard để bắt đầu tập. */
  const handleStartPlan = async () => {
    if (busy) return;
    setBusy("start");
    try {
      await surveyApi.startPlan(state.sessionId);
      navigate("/", { replace: true });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        actionError: surveyErrorMessage(err, t("survey.result.startPlanFailed")),
      }));
      setBusy(null);
    }
  };

  /** "Back to level test": mở lại phiên để sửa số liệu level test. */
  const handleBackToLevelTest = async () => {
    if (busy) return;
    setBusy("back");
    try {
      await surveyApi.reopen(state.sessionId);
      navigate(`/survey/${LEVEL_TEST_SLUG}`, { replace: true });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        actionError: surveyErrorMessage(err, t("survey.result.reopenFailed")),
      }));
      setBusy(null);
    }
  };

  if (state.status !== "ready") {
    return (
      <div className="survey-page survey-page--center">
        {state.status === "loading" ? (
          <p className="survey-status">{t("survey.result.calculating")}</p>
        ) : (
          <div className="survey-status-box" role="alert">
            <p className="survey-status">{state.message}</p>
            <div className="survey-status-actions">
              <button type="button" className="survey-btn survey-btn--primary" onClick={load}>
                {t("survey.tryAgain")}
              </button>
              <button type="button" className="survey-link" onClick={() => navigate("/", { replace: true })}>
                {t("survey.goToDashboard")}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const { assessment } = state.result;
  const { level, levels, plan } = assessment;
  const totalSteps = Math.max(levels.length, 1);

  return (
    <div className="survey-page">
      <SurveyTopBar />
      <div className="survey-column survey-column--result">
        {/* mọi bước đã xong */}
        <SurveyProgress current={state.stepCount} total={state.stepCount} />

        <header className="survey-header">
          <p className="survey-header-label">{t("survey.result.eyebrow")}</p>
          <h1 className="survey-header-title">{t("survey.result.title")}</h1>
          <p className="survey-header-subtitle">{t("survey.result.subtitle")}</p>
        </header>

        {state.actionError && (
          <p className="survey-form-error" role="alert">
            {state.actionError}
          </p>
        )}

        {/* ── Level hiện tại ─────────────────────────────────────── */}
        <section className="result-card">
          <div className="result-level">
            <span className="result-icon-tile">
              <MedalIcon />
            </span>
            <div className="result-level-text">
              <p className="result-muted">{t("survey.result.currentLevel")}</p>
              <p className="result-level-name">{level?.name ?? t("survey.result.notAssessed")}</p>
            </div>
            {level?.rank && (
              <span className="result-badge">
                {t("survey.result.levelOf", { rank: level.rank, total: totalSteps })}
              </span>
            )}
          </div>

          {assessment.summary && <p className="result-body">{assessment.summary}</p>}
          {!level && <p className="result-body">{t("survey.result.couldNotAssess")}</p>}

          {levels.length > 0 && (
            <div className="result-ladder" aria-hidden="true">
              <div className="result-ladder-bars">
                {levels.map((item) => (
                  <span key={item.id} className={level?.rank && item.rank <= level.rank ? "is-reached" : ""} />
                ))}
              </div>
              <div className="result-ladder-labels">
                {levels.map((item) => (
                  <span key={item.id} className={level?.rank && item.rank <= level.rank ? "is-reached" : ""}>
                    {item.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Kết quả level test ──────────────────────────────────── */}
        {assessment.showLevelBreakdown && assessment.criteria.length > 0 && (
          <section className="result-section">
            <div className="result-section-head">
              <h2 className="result-section-title">{t("survey.result.testResults")}</h2>
              <p className="result-muted">{t("survey.result.startingBenchmark")}</p>
            </div>
            <div className={`result-scores result-scores--count-${Math.min(assessment.criteria.length, 7)}`}>
              {assessment.criteria.map((item) => (
                <div key={item.criterionCode} className="result-score">
                  <p className="result-score-label">{item.label}</p>
                  <p className="result-score-value">
                    <strong>{formatNumber(item.value)}</strong>
                    {item.unit && <span>{unitText(item.unit)}</span>}
                  </p>
                  {item.bandLabel && <p className="result-score-band">{item.bandLabel}</p>}
                  {item.score !== null && item.score !== undefined && (
                    <p className="result-score-points">
                      {t("survey.result.point", { count: Number(item.score) })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Kế hoạch gợi ý ──────────────────────────────────────── */}
        {plan && (
          <section className="result-card result-plan">
            <span className="result-plan-tag">
              <SparkleIcon />
              {t("survey.result.recommendedForYou")}
            </span>
            <h3 className="result-plan-name">{plan.name}</h3>
            {plan.description && <p className="result-body">{plan.description}</p>}

            <div className="result-chips">
              <span>{t("survey.result.weeks", { count: plan.weeks })}</span>
              <span>{t("survey.result.sessionsPerWeek", { count: plan.sessionsPerWeek })}</span>
              <span>
                {t("survey.result.perSession", {
                  duration: `${Math.max(10, plan.minutesPerSession - 5)}–${plan.minutesPerSession} min`,
                })}
              </span>
            </div>

            <div className="result-divider" />

            <p className="result-rhythm-title">{t("survey.result.weeklyRhythm")}</p>
            <ul className="result-rhythm">
              {plan.rhythm.map((slot) => (
                <li key={slot.day}>
                  <span>{slot.day}</span>
                  <p>{slot.name}</p>
                  {slot.exercises?.length > 0 && (
                    <ul className="result-rhythm-exercises">
                      {slot.exercises.map((exercise) => (
                        <li key={`${slot.day}-${exercise.name}`}>
                          {exercise.name}
                          {exercise.detail && <em>{exercise.detail}</em>}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
            {plan.note && <p className="result-note">{plan.note}</p>}
          </section>
        )}

        {/* ── Hành động ──────────────────────────────────────────── */}
        <div className="result-actions">
          <button
            type="button"
            className="survey-btn survey-btn--primary"
            onClick={handleStartPlan}
            disabled={Boolean(busy)}
          >
            <span>{busy === "start" ? t("survey.result.starting") : t("survey.result.startPlan")}</span>
            <ArrowRight />
          </button>
          {plan && assessment.showPlanPreview && (
            <button type="button" className="survey-btn survey-btn--ghost" onClick={() => setPreviewOpen(true)}>
              <span>{t("survey.result.previewPlan")}</span>
              <ArrowRight />
            </button>
          )}
          <button
            type="button"
            className="survey-btn survey-btn--ghost"
            onClick={handleBackToLevelTest}
            disabled={Boolean(busy)}
          >
            <ArrowLeft />
            <span>{busy === "back" ? t("survey.result.opening") : t("survey.result.backToLevelTest")}</span>
          </button>
        </div>

        <div className="result-retake">
          <button type="button" className="survey-link" onClick={() => navigate("/survey", { state: { retake: true } })}>
            <RefreshIcon />
            {t("survey.result.retake")}
          </button>
          <p className="result-muted">{t("survey.result.planEvolves")}</p>
        </div>
      </div>

      {plan && (
        <TrainingPlanPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} plan={plan} />
      )}
    </div>
  );
}
