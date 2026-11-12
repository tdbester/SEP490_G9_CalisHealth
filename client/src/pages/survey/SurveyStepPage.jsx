import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { surveyApi, surveyErrorMessage } from "../../api/survey";
import QuestionField from "../../components/survey/QuestionField";
import SurveyProgress from "../../components/survey/SurveyProgress";
import SurveyTopBar from "../../components/survey/SurveyTopBar";
import { ArrowLeft, ArrowRight, ArrowRightLarge } from "../../components/survey/SurveyIcons";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("member");
  const { step, index, steps } = useCurrentStep();
  const { definition, session, setSession, formValues, setValue, errors, setErrors } = useSurveyFlow();
  const [busy, setBusy] = useState(null); // null | "save" | "skip"
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const stepTitle = step ? t(`survey.stepTitles.${step.stepCode}.title`) : "";
    if (step) {
      document.title = stepTitle
        ? `${t("survey.documentTitlePrefix")} ${stepTitle}`
        : t("survey.documentTitlePrefix");
    }
    setFormError("");
  }, [step, t]);

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
        setFormError(surveyErrorMessage(err, t("survey.saveFailed")));
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
      setFormError(surveyErrorMessage(err, t("survey.skipFailed")));
      setBusy(null);
    }
  };

  // Bước Level test là bước cuối trước màn Result -> nút là "Finish" (không phải "See my result").
  const continueLabel =
    busy === "save"
      ? t("survey.saving")
      : step.stepCode === "LEVEL_TEST"
        ? t("survey.finish")
        : isLast
          ? t("survey.seeResult")
          : t("survey.continue");

  return (
    <div className="survey-page">
      <SurveyTopBar />
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

        {/* Mọi bước dùng chung một bố cục: hàng nút Back (nếu có) + Continue.
            Bước đầu không có Back nên nút Continue chiếm hết bề rộng. */}
        <div key="step-actions" className={`survey-actions${isFirst ? " survey-actions--first" : ""}`}>
          {!isFirst && (
            <button
              type="button"
              className="survey-btn survey-btn--ghost"
              onClick={() => navigate(`/survey/${stepSlug(steps[index - 1].stepCode)}`)}
              disabled={Boolean(busy)}
            >
              <ArrowLeft />
              <span>{t("survey.back")}</span>
            </button>
          )}
          <button
            type="submit"
            className={`survey-btn ${isFirst ? "survey-btn--gradient" : "survey-btn--primary"}`}
            disabled={Boolean(busy)}
          >
            <span>{continueLabel}</span>
            {isFirst ? <ArrowRightLarge /> : <ArrowRight />}
          </button>
        </div>

        <button type="button" className="survey-skip" onClick={handleSkip} disabled={Boolean(busy)}>
          {busy === "skip" ? t("survey.skipping") : isFirst ? t("survey.skipSurvey") : t("survey.skipForNow")}
        </button>
      </form>
    </div>
  );
}
