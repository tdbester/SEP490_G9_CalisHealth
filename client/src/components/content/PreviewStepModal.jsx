import { useCallback, useEffect, useMemo, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ModalShell from "../common/ModalShell";
import QuestionField from "../survey/QuestionField";
import SurveyProgress from "../survey/SurveyProgress";
import { ArrowRight } from "../survey/SurveyIcons";
import { contentSurveyApi } from "../../api/contentSurvey";
import { surveyErrorMessage } from "../../api/survey";
import { answerValues, prepareStep, stepCopy, testCondition, toFormValue } from "../../utils/survey";
import { STATUS_LABELS } from "../../utils/contentSurvey";
import "../../pages/survey/Survey.css";
import "./ContentSurvey.css";

/** "Between 100 and 250 cm" dưới mỗi ô số (Figma: survey-preview-step). */
function rangeHint(question) {
  if (question.questionType !== "NUMBER") return null;
  const { min, max } = question.validationRules ?? {};
  const unit = question.unit ? ` ${question.unit}` : "";
  if (min != null && max != null) return `Between ${min} and ${max}${unit}`;
  if (min != null) return `At least ${min}${unit}`;
  if (max != null) return `At most ${max}${unit}`;
  return null;
}

/**
 * Giống BE (F5a): điều kiện trỏ tới câu hỏi ở bước khác được coi là thỏa,
 * vì Preview không có câu trả lời của các bước trước.
 */
function previewApplicable(question, values, codesInStep) {
  const rules = question.conditionalRules;
  if (!rules) return true;
  const sources = [];
  const collect = (c) => (c.conditions ? c.conditions.forEach(collect) : sources.push(c.questionCode));
  collect(rules);
  if (sources.some((code) => !codesInStep.has(code))) return true;
  return testCondition(rules, values);
}

/** Bước Result không có câu hỏi: tóm tắt cấu hình kế hoạch gợi ý. */
function ResultSummary({ config }) {
  if (!config) return null;
  const rows = [
    ["Level breakdown", config.showLevelBreakdown ? "Shown" : "Hidden"],
    ["Training plan preview", config.showPlanPreview ? "Shown" : "Hidden"],
    ["Plan length", `${config.planDurationWeeks} weeks`],
    ["Sessions", `${config.sessionsPerWeek} per week · ${config.minutesPerSession} min each`],
  ];
  return (
    <dl className="cs-summary">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Popup Preview step: bước như member thấy, nhập thử được; Continue kiểm tra bằng luật của member
 * (trên form trước, rồi POST .../preview/check) và không lưu gì.
 */
export default function PreviewStepModal({ open, stepId, onClose, onEdit }) {
  const [state, setState] = useState({ status: "idle" });
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [check, setCheck] = useState(null); // { status: "checking" | "valid" | "invalid" | "error", text }

  const load = useCallback(() => {
    setState({ status: "loading" });
    setErrors({});
    setCheck(null);
    contentSurveyApi
      .preview(stepId)
      .then((preview) => {
        const questions = [...preview.questions].sort((a, b) => a.sortOrder - b.sortOrder);
        setValues(Object.fromEntries(questions.map((q) => [q.questionCode, toFormValue(q, q.defaultValue)])));
        setState({ status: "ready", preview: { ...preview, questions } });
      })
      .catch((err) => setState({ status: "error", message: surveyErrorMessage(err, "We could not load the preview.") }));
  }, [stepId]);

  useEffect(() => {
    if (open && stepId) load();
  }, [open, stepId, load]);

  const preview = state.preview;
  // prepareStep / answerValues làm việc trên "definition" -> dựng 1 definition chỉ có bước này
  const definition = useMemo(
    () => (preview ? { steps: [{ stepCode: preview.step.stepCode, questions: preview.questions }] } : null),
    [preview],
  );
  const codesInStep = useMemo(() => new Set(preview?.questions.map((q) => q.questionCode)), [preview]);

  const setValue = (code, value) => {
    setValues((v) => ({ ...v, [code]: value }));
    setErrors((e) => {
      if (!e[code]) return e;
      const next = { ...e };
      delete next[code];
      return next;
    });
    setCheck(null);
  };

  const handleContinue = async () => {
    const step = {
      ...definition.steps[0],
      questions: preview.questions.map((q) => ({
        ...q,
        // câu có điều kiện trỏ sang bước khác: luôn hiện (xem previewApplicable)
        conditionalRules: previewApplicable(q, answerValues(definition, values), codesInStep) ? null : q.conditionalRules,
      })),
    };
    const { errors: fieldErrors, answers } = prepareStep({ steps: [step] }, step, values);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      setCheck({ status: "invalid", text: "Some answers would be rejected. Fix the highlighted fields." });
      return;
    }
    setCheck({ status: "checking" });
    try {
      const res = await contentSurveyApi.previewCheck(
        stepId,
        answers.filter((a) => a.value !== null),
      );
      if (res.valid) {
        setCheck({ status: "valid", text: "These answers are valid. Nothing was saved." });
      } else {
        setErrors(Object.fromEntries(res.errors.filter((e) => e.questionCode).map((e) => [e.questionCode, e.message])));
        const general = res.errors.filter((e) => !e.questionCode).map((e) => e.message);
        setCheck({ status: "invalid", text: general[0] ?? "Some answers would be rejected." });
      }
    } catch (err) {
      setCheck({ status: "error", text: surveyErrorMessage(err, "We could not check these answers.") });
    }
  };

  const isResult = preview?.step.stepType === "RESULT";
  const copy = preview ? stepCopy(preview.step) : null;
  const answerMap = definition ? answerValues(definition, values) : {};

  return (
    <ModalShell open={open} onClose={onClose} labelledBy="preview-step-title" className="cs-modal cs-modal--preview">
      <div className="cs-modal-head">
        <div>
          <h2 id="preview-step-title">Preview step</h2>
          {preview && (
            <p className="cs-muted">
              Step {preview.step.position} · {preview.step.stepName} · This is how members see it. Nothing is saved.
            </p>
          )}
        </div>
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
          <CloseRoundedIcon />
        </button>
      </div>

      {state.status === "loading" && <p className="cs-muted cs-pad">Loading preview…</p>}
      {state.status === "error" && (
        <div className="cs-alert error" role="alert">
          <p>{state.message}</p>
          <button type="button" className="cs-text-btn" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {preview && state.status === "ready" && (
        <>
          {!preview.visibleToMembers && (
            <p className="cs-alert warning">
              This step is {STATUS_LABELS[preview.step.status].toLowerCase()}, so members do not see it yet.
            </p>
          )}

          <div className="cs-preview-frame">
            <div className="cs-preview-column">
              {!isResult && preview.memberStepNumber && (
                <SurveyProgress current={preview.memberStepNumber} total={preview.memberStepCount} />
              )}
              <header className="survey-header">
                <p className="survey-header-label">{copy.label}</p>
                <h3 className="survey-header-title">{isResult ? preview.step.stepName : copy.title}</h3>
                {(isResult ? preview.step.description : copy.subtitle) && (
                  <p className="survey-header-subtitle">{isResult ? preview.step.description : copy.subtitle}</p>
                )}
              </header>

              {isResult ? (
                <ResultSummary config={preview.resultConfig} />
              ) : preview.questions.length === 0 ? (
                <p className="cs-muted cs-pad">This step has no active questions yet.</p>
              ) : (
                <div className="survey-questions">
                  {preview.questions
                    .filter((q) => previewApplicable(q, answerMap, codesInStep))
                    .map((q) => (
                      <div key={q.questionCode} className="cs-preview-question">
                        <QuestionField
                          question={q}
                          value={values[q.questionCode]}
                          error={errors[q.questionCode]}
                          onChange={(v) => setValue(q.questionCode, v)}
                        />
                        {!errors[q.questionCode] && rangeHint(q) && <p className="cs-preview-hint">{rangeHint(q)}</p>}
                      </div>
                    ))}
                </div>
              )}

              {!isResult && preview.questions.length > 0 && (
                <>
                  {check?.text && (
                    <p className={`cs-check ${check.status}`} role={check.status === "valid" ? "status" : "alert"}>
                      {check.text}
                    </p>
                  )}
                  <button
                    type="button"
                    className="survey-btn survey-btn--primary cs-preview-continue"
                    onClick={handleContinue}
                    disabled={check?.status === "checking"}
                  >
                    <span>{check?.status === "checking" ? "Checking…" : "Continue"}</span>
                    <ArrowRight />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="cs-modal-actions">
            <button type="button" className="cs-ghost-btn" onClick={onClose}>
              Close
            </button>
            <button type="button" className="cs-primary-btn" onClick={() => onEdit(preview.step)}>
              {isResult ? "Configure" : "Edit step"}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
