import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { surveyApi, surveyErrorMessage } from "../../api/survey";
import { findStepBySlug, stepSlug, toFormValue } from "../../utils/survey";
import "./Survey.css";

/**
 * Khung luồng onboarding (/survey/*): lấy phiên khảo sát của member rồi định nghĩa đúng version của phiên đó,
 * giữ câu trả lời đang nhập của mọi bước để Back / Continue không mất dữ liệu.
 *   - có phiên IN_PROGRESS -> làm tiếp
 *   - phiên gần nhất SKIPPED -> resume (giữ câu trả lời cũ)
 *   - đã COMPLETED -> sang màn Result, trừ khi bấm "Retake survey" (state.retake)
 *   - chưa có -> tạo phiên mới
 */
export default function SurveyFlow() {
  const navigate = useNavigate();
  const location = useLocation();
  const retake = Boolean(location.state?.retake);
  const [state, setState] = useState({ status: "loading" });
  const [formValues, setFormValues] = useState({});
  const [errors, setErrors] = useState({});
  const startedRef = useRef(false);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const sessions = await surveyApi.sessions();
      const inProgress = sessions.find((s) => s.status === "IN_PROGRESS");
      const latest = sessions[0];
      if (!inProgress && latest?.status === "COMPLETED" && !retake) {
        navigate("/survey/result", { replace: true });
        return;
      }

      let session;
      if (inProgress) {
        session = await surveyApi.session(inProgress.sessionId);
      } else if (latest?.status === "SKIPPED") {
        session = await surveyApi.resume(latest.sessionId);
      } else {
        session = await surveyApi.start().catch((err) => {
          // 409: 1 request khác vừa tạo phiên -> gọi lại để nhận đúng phiên đó
          if (err.response?.data?.code === "ACTIVE_SESSION_EXISTS") return surveyApi.start();
          throw err;
        });
      }
      const definition = await surveyApi.definition(session.surveyVersion);

      const answered = new Map(session.steps.flatMap((s) => s.questions).map((q) => [q.questionCode, q.value]));
      const values = {};
      for (const step of definition.steps) {
        for (const question of step.questions) {
          values[question.questionCode] = toFormValue(question, answered.get(question.questionCode));
        }
      }
      setFormValues(values);
      setErrors({});
      setState({ status: "ready", session, definition });
    } catch (err) {
      setState({ status: "error", message: surveyErrorMessage(err, "We could not load the survey.") });
    }
  }, [navigate, retake]);

  useEffect(() => {
    // StrictMode chạy effect 2 lần ở dev: chỉ tạo / lấy phiên 1 lần
    if (startedRef.current) return;
    startedRef.current = true;
    load();
  }, [load]);

  const setValue = useCallback((questionCode, value) => {
    setFormValues((prev) => ({ ...prev, [questionCode]: value }));
    setErrors((prev) => {
      if (!prev[questionCode]) return prev;
      const next = { ...prev };
      delete next[questionCode];
      return next;
    });
  }, []);

  const setSession = useCallback((session) => setState((prev) => ({ ...prev, session })), []);

  if (state.status === "loading") {
    return (
      <div className="survey-page survey-page--center">
        <p className="survey-status">Loading your survey…</p>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="survey-page survey-page--center">
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
      </div>
    );
  }

  return (
    <Outlet
      context={{
        definition: state.definition,
        session: state.session,
        setSession,
        formValues,
        setValue,
        errors,
        setErrors,
      }}
    />
  );
}

export const useSurveyFlow = () => useOutletContext();

/**
 * /survey -> bước đầu tiên còn thiếu câu trả lời bắt buộc (hoặc bước cuối nếu đã đủ).
 * Các bước trước đó vẫn được ghi vào lịch sử trình duyệt (bước 1 thay cho /survey, rồi lần lượt tới bước đang làm)
 * để nút Back của trình duyệt lùi từng bước như khi member đi tuần tự, thay vì thoát khỏi survey.
 */
export function SurveyEntry() {
  const navigate = useNavigate();
  const { definition, session } = useSurveyFlow();
  const redirectedRef = useRef(false);

  useEffect(() => {
    // StrictMode chạy effect 2 lần ở dev: chỉ ghi lịch sử 1 lần
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    const steps = definition.steps;
    if (steps.length === 0) {
      navigate("/", { replace: true });
      return;
    }
    const found = steps.findIndex((s) => s.stepCode === session.currentStepCode);
    const target = found === -1 ? steps.length - 1 : found;
    navigate(`/survey/${stepSlug(steps[0].stepCode)}`, { replace: true });
    for (let i = 1; i <= target; i++) navigate(`/survey/${stepSlug(steps[i].stepCode)}`);
  }, [definition, session, navigate]);

  return null;
}

/** Bước theo URL; không cho nhảy qua bước chưa làm. */
export function useCurrentStep() {
  const { stepSlug: slug } = useParams();
  const { definition, session } = useSurveyFlow();
  const steps = definition.steps;
  const step = findStepBySlug(steps, slug);
  const index = step ? steps.indexOf(step) : -1;
  const firstIncomplete = steps.findIndex((s) => s.stepCode === session.currentStepCode);
  const reachable = index >= 0 && (firstIncomplete === -1 || index <= firstIncomplete);
  return { step: reachable ? step : null, index, steps };
}
