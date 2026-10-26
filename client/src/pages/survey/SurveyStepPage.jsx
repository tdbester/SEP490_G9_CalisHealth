import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { surveyApi, surveyErrorMessage } from "../../api/survey";
import QuestionField from "../../components/survey/QuestionField";
import SurveyProgress from "../../components/survey/SurveyProgress";
import { ArrowLeft, ArrowRight, ArrowRightLarge } from "../../components/survey/SurveyIcons";
import { answerValues, isApplicable, prepareStep, serverFieldErrors, stepCopy, stepSlug } from "../../utils/survey";
import { useCurrentStep, useSurveyFlow } from "./SurveyFlow";

/**
 * 1 bước khảo sát (Figma: Body information / Goals and motivation / Current training routine / Level test).
 * Câu hỏi hiển thị theo định nghĩa từ backend; câu có điều kiện chỉ hiện khi điều kiện thỏa.
 * Continue: validate -> lưu bước -> sang bước sau; bước cuối thì hoàn thành và sang màn Result.
 * Bước đầu dùng bố cục Figma "Body information" (nút gradient + Skip survey), các bước sau dùng
 * thanh Back / Continue; mọi bước đều có Skip để member vào dashboard trước.
 */
export default function SurveyStepPage() {
  const navigate = useNavigate();
  const { step, index, steps } = useCurrentStep();
  const { definition, session, setSession, formValues, setValue, errors, setErrors } = useSurveyFlow();
  const [busy, setBusy] = useState(null); // null | "save" | "skip"
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (step) document.title = `CalisHealth · Survey – ${step.stepName}`;
    setFormError("");
  }, [step]);

  const values = useMemo(() => answerValues(definition, formValues), [definition, formValues]);

  if (!step) {
    return <Navigate to="/survey" replace />;
  }

  const isFirst = index === 0;
  const isLast = index === steps.length - 1;
  const copy = stepCopy(step);
  const visibleQuestions = step.questions.filter((q) => isApplicable(q, values));

  const focusFirstError = (fieldErrors) => {
    const first = step.questions.find((q) => fieldErrors[q.questionCode]);
    if (first) document.getElementById(`q-${first.questionCode}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleContinue = async (event) => {
    event.preventDefault();
    if (busy) return;
    const { errors: fieldErrors, answers } = prepareStep(definition, step, formValues);
    setErrors(fieldErrors);
    setFormError("");
    if (Object.keys(fieldErrors).length > 0) {
      requestAnimationFrame(() => focusFirstError(fieldErrors));
      return;
    }

    setBusy("save");
    try {
      if (answers.length > 0) {
        setSession(await surveyApi.saveStep(session.sessionId, step.stepCode, session.surveyVersion, answers));
      }
      if (isLast) {
        await surveyApi.complete(session.sessionId);
        navigate("/survey/result", { replace: true });
        return;
      }
      navigate(`/survey/${stepSlug(steps[index + 1].stepCode)}`);
    } catch (err) {
      const serverErrors = serverFieldErrors(err);
      const items = err.response?.data?.errors ?? [];
      // khi hoàn thành, backend có thể báo câu ở bước khác -> đưa member về đúng bước đó
      const otherStep = items.find((e) => e.stepCode && e.stepCode !== step.stepCode)?.stepCode;
      setErrors(serverErrors);
      if (otherStep) {
        navigate(`/survey/${stepSlug(otherStep)}`);
      } else {
        setFormError(surveyErrorMessage(err, "We could not save your answers. Please try again."));
        requestAnimationFrame(() => focusFirstError(serverErrors));
      }
    } finally {
      setBusy(null);
    }
  };

  const handleSkip = async () => {
    if (busy) return;
    setBusy("skip");
    try {
      await surveyApi.skip(session.sessionId);
      navigate("/", { replace: true });
    } catch (err) {
      setFormError(surveyErrorMessage(err, "We could not skip the survey. Please try again."));
      setBusy(null);
    }
  };

  const continueLabel = busy === "save" ? "Saving…" : isLast ? "See my result" : "Continue";

  return (
    <div className={`survey-page${isFirst ? " survey-page--intro" : ""}`}>
      <form className="survey-column" onSubmit={handleContinue} noValidate>
        <SurveyProgress current={index + 1} total={steps.length} />

        <header className="survey-header">
          <p className="survey-header-label">{copy.label}</p>
          <h1 className="survey-header-title">{copy.title}</h1>
          {copy.subtitle && <p className="survey-header-subtitle">{copy.subtitle}</p>}
        </header>

        <div className="survey-questions">
          {visibleQuestions.map((question) => (
            <QuestionField
              key={question.questionCode}
              question={question}
              value={formValues[question.questionCode]}
              error={errors[question.questionCode]}
              onChange={(value) => setValue(question.questionCode, value)}
            />
          ))}
        </div>

        {formError && (
          <p className="survey-form-error" role="alert">
            {formError}
          </p>
        )}

        {isFirst ? (
          <div className="survey-intro-actions">
            <button type="submit" className="survey-btn survey-btn--gradient" disabled={Boolean(busy)}>
              <span>{continueLabel}</span>
              <ArrowRightLarge />
            </button>
          </div>
        ) : (
          <div className="survey-actions">
            <button
              type="button"
              className="survey-btn survey-btn--ghost"
              onClick={() => navigate(`/survey/${stepSlug(steps[index - 1].stepCode)}`)}
              disabled={Boolean(busy)}
            >
              <ArrowLeft />
              <span>Back</span>
            </button>
            <button type="submit" className="survey-btn survey-btn--primary" disabled={Boolean(busy)}>
              <span>{continueLabel}</span>
              <ArrowRight />
            </button>
          </div>
        )}

        <button type="button" className="survey-skip" onClick={handleSkip} disabled={Boolean(busy)}>
          {busy === "skip" ? "Skipping…" : isFirst ? "Skip survey" : "Skip for now"}
        </button>
      </form>
    </div>
  );
}
