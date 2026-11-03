import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { surveyApi, surveyErrorMessage } from "../../api/survey";
import SurveyProgress from "../../components/survey/SurveyProgress";
import TrainingPlanPreviewModal from "../../components/survey/TrainingPlanPreviewModal";
import { ArrowLeft, ArrowRight, MedalIcon, RefreshIcon, SparkleIcon } from "../../components/survey/SurveyIcons";
import { durationRange } from "../../utils/planCalendar";
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
      setState({ status: "error", message: surveyErrorMessage(err, "We could not load your result.") });
    }
  }, [navigate]);

  useEffect(() => {
    document.title = "CalisHealth · Survey – Result";
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
        actionError: surveyErrorMessage(err, "We could not start your training plan. Please try again."),
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
        actionError: surveyErrorMessage(err, "We could not reopen the level test. Please try again."),
      }));
      setBusy(null);
    }
  };

  if (state.status !== "ready") {
    return (
      <div className="survey-page survey-page--center">
        {state.status === "loading" ? (
          <p className="survey-status">Calculating your level…</p>
        ) : (
          <div className="survey-status-box" role="alert">
            <p className="survey-status">{state.message}</p>
            <div className="survey-status-actions">
              <button type="button" className="survey-btn survey-btn--primary" onClick={load}>
                Try again
              </button>
              <button type="button" className="survey-link" onClick={() => navigate("/", { replace: true })}>
                Go to dashboard
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
      <div className="survey-column survey-column--result">
        {/* mọi bước đã xong */}
        <SurveyProgress current={state.stepCount} total={state.stepCount} />

        <header className="survey-header">
          <p className="survey-header-label">Result &amp; recommended plan</p>
          <h1 className="survey-header-title">Your results are in</h1>
          <p className="survey-header-subtitle">
            A starting point that fits you. Let&apos;s build strength, one session at a time.
          </p>
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
              <p className="result-muted">Your current level</p>
              <p className="result-level-name">{level?.name ?? "Not assessed yet"}</p>
            </div>
            {level?.rank && (
              <span className="result-badge">
                Level {level.rank} of {totalSteps}
              </span>
            )}
          </div>

          {assessment.summary && <p className="result-body">{assessment.summary}</p>}
          {!level && (
            <p className="result-body">
              We could not assess your level from your answers. You can retake the survey any time.
            </p>
          )}

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
              <h2 className="result-section-title">Your test results</h2>
              <p className="result-muted">Your starting benchmark</p>
            </div>
            <div className={`result-scores result-scores--count-${Math.min(assessment.criteria.length, 7)}`}>
              {assessment.criteria.map((item) => (
                <div key={item.criterionCode} className="result-score">
                  <p className="result-score-label">{item.label}</p>
                  <p className="result-score-value">
                    <strong>{formatNumber(item.value)}</strong>
                    {item.unit && <span>{item.unit}</span>}
                  </p>
                  {item.bandLabel && <p className="result-score-band">{item.bandLabel}</p>}
                  {item.score !== null && item.score !== undefined && (
                    <p className="result-score-points">
                      {formatNumber(item.score)} {Number(item.score) === 1 ? "point" : "points"}
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
              Recommended for you
            </span>
            <h3 className="result-plan-name">{plan.name}</h3>
            {plan.description && <p className="result-body">{plan.description}</p>}

            <div className="result-chips">
              <span>{plan.weeks} weeks</span>
              <span>{plan.sessionsPerWeek} sessions / week</span>
              <span>{durationRange(plan.minutesPerSession)} / session</span>
            </div>

            <div className="result-divider" />

            <p className="result-rhythm-title">Your weekly rhythm</p>
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
            <span>{busy === "start" ? "Starting…" : "Start my training plan"}</span>
            <ArrowRight />
          </button>
          {plan && assessment.showPlanPreview && (
            <button type="button" className="survey-btn survey-btn--ghost" onClick={() => setPreviewOpen(true)}>
              <span>Preview training plan</span>
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
            <span>{busy === "back" ? "Opening…" : "Back to level test"}</span>
          </button>
        </div>

        <div className="result-retake">
          <button type="button" className="survey-link" onClick={() => navigate("/survey", { state: { retake: true } })}>
            <RefreshIcon />
            Retake survey
          </button>
          <p className="result-muted">Your plan can evolve as you get stronger.</p>
        </div>
      </div>

      {plan && (
        <TrainingPlanPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} plan={plan} />
      )}
    </div>
  );
}
