import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { aiSupportApi } from "../../api/aiSupport";
import { useTranslation } from "react-i18next";
import "./AiSupportModal.css";
/** Hạn mức câu hỏi trong một phiên chat (badge "n/5" ở header). */
const SESSION_LIMIT = 5;

/**
 * Key lưu id phiên chat trong sessionStorage.
 *
 * Giữ lại id khi member đóng rồi mở lại popup -> hội thoại và lượt/phiên
 * được khôi phục đúng. Bấm "New chat" sẽ xoá id này để bắt đầu phiên mới.
 */
const SESSION_KEY = "calishealth.aiSupport.sessionId";

/** Nhãn nguồn buổi tập hiển thị trong chip ngữ cảnh. */
const SOURCE_KEYS = {
  camera: "sourceCamera",
  video: "sourceVideo",
};

/**
 * Sinh id phiên chat mới.
 *
 * Mỗi phiên chat là một nhóm câu hỏi riêng -> server đếm lượt theo phiên
 * (giới hạn 5 câu/phiên), còn quota 15 câu/ngày vẫn tính chung.
 *
 * @returns {string}
 */
function createSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Đọc id phiên chat đang lưu (đóng/mở popup vẫn giữ phiên cũ).
 *
 * @returns {string}
 */
function readSessionId() {
  try {
    return sessionStorage.getItem(SESSION_KEY) || createSessionId();
  } catch {
    return createSessionId();
  }
}

/**
 * Lưu id phiên chat.
 *
 * @param {string} value
 */
function writeSessionId(value) {
  try {
    sessionStorage.setItem(SESSION_KEY, value);
  } catch {
    // Bộ nhớ đầy -> vẫn dùng được trong phiên hiện tại.
  }
}

/**
 * Đọc câu trả lời đã lưu (JSON) để khôi phục lại hội thoại.
 *
 * @param {string} json
 * @returns {{causes: {title: string, detail: string}[], tip: string, followUps: string[]}|null}
 */
function parseAnswer(json, t) {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return {
      causes: Array.isArray(parsed.causes) ? parsed.causes : [],
      tip: parsed.tip || "",
      followUps: Array.isArray(parsed.followUps) ? parsed.followUps : [],
    };
  } catch {
    // Câu trả lời cũ lưu dạng text -> hiển thị luôn là một nguyên nhân.
    return { causes: [{ title: t("member:aiSupport.aiCoachFeedback"), detail: json }], tip: "", followUps: [] };
  }
}

/**
 * Popup "AI Support" (Figma 549:1238).
 *
 * Member hỏi AI về lỗi form vừa gặp trong buổi tập. AI trả lời theo cấu trúc:
 * 3 nguyên nhân có thể + 1 mẹp sửa + câu hỏi gợi ý.
 *
 * Hạn mức: 15 câu/ngày mỗi member (hiển thị ở placeholder), 5 câu mỗi phiên
 * chat (hiển thị ở badge header).
 */
export default function AiSupportModal({
  open,
  onClose,
  exerciseCode,
  exerciseName,
  formIssues = [],
  accuracy = null,
  source = "camera",
  sessionDate = null,
}) {
  /** Lịch sử chat của phiên này: { role, text, causes, tip, followUps }. */
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [quota, setQuota] = useState(null);
  /** Id phiên chat — sinh mỗi lần mở popup, dùng để server đếm lượt/phiên. */
  const [sessionId, setSessionId] = useState("");
  /** Server đã cấu hình API AI thật (gpt-4o-mini) hay chưa. */
  const [aiEnabled, setAiEnabled] = useState(true);
  /** Model AI đang dùng — hiển thị trong header. */
  const [aiModel, setAiModel] = useState(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const { t } = useTranslation(["member", "common"]);

  /** Số câu đã hỏi trong phiên chat hiện tại. */
  const sessionIndex = quota?.sessionUsed ?? messages.filter((item) => item.role === "user").length;

  /** Số câu còn lại hôm nay (null = chưa lấy được quota). */
  const remaining = quota ? quota.remaining : null;

  /** Đã hết lượt hôm nay chưa. */
  const exhausted = remaining !== null && remaining <= 0;

  /** Đã hết lượt của phiên chat này chưa. */
  const sessionExhausted = sessionIndex >= SESSION_LIMIT;

  /** Chuỗi mô tả ngữ cảnh buổi tập hiển thị trong chip. */
  const contextLabel = useMemo(() => {
    const date = sessionDate
      ? new Intl.DateTimeFormat("en", { day: "2-digit", month: "short" }).format(
          new Date(sessionDate),
        )
      : new Intl.DateTimeFormat("en", { day: "2-digit", month: "short" }).format(new Date());
    const sourceLabel = t(`member:aiSupport.${SOURCE_KEYS[source] ?? SOURCE_KEYS.camera}`);
    return [exerciseName, sourceLabel, date].filter(Boolean).join(" · ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseName, sessionDate, source, t]);

  // Mở popup -> dùng lại phiên chat đang lưu (đóng rồi mở lại vẫn giữ hội
  // thoại và lượt/phiên), rồi lấy quota + lịch sử của phiên đó.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const currentSessionId = readSessionId();
    writeSessionId(currentSessionId);
    setSessionId(currentSessionId);
    setMessages([]);

    aiSupportApi
      .getQuota(currentSessionId)
      .then((data) => {
        if (cancelled) return;
        setQuota(data);
        setAiEnabled(data?.aiEnabled !== false);
        setAiModel(data?.model ?? null);
      })
      .catch(() => {
        // Không lấy được quota thì vẫn cho member chat, chỉ mất badge số lượt.
      });

    aiSupportApi
      .getHistory(currentSessionId)
      .then((items) => {
        if (cancelled) return;
        const restored = [];
        // API trả về cũ nhất trước -> giữ nguyên thứ tự hội thoại.
        for (const item of items) {
          restored.push({ role: "user", text: item.question });
          const parsed = parseAnswer(item.answerJson, t);
          if (parsed) {
            restored.push({ role: "ai", ...parsed });
          }
        }
        setMessages(restored);
      })
      .catch(() => {
        // Không có lịch sử cũng không sao.
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  /** Bắt đầu phiên chat mới (xoá lượt/phiên cũ, vẫn giữ quota ngày). */
  const startNewChat = useCallback(() => {
    const newSessionId = createSessionId();
    writeSessionId(newSessionId);
    setSessionId(newSessionId);
    setMessages([]);
    setQuestion("");
    aiSupportApi.getQuota(newSessionId).then(setQuota).catch(() => {});
    inputRef.current?.focus();
  }, []);

  // Reset ô nhập mỗi lần mở popup (giữ nguyên lịch sử hội thoại).
  useEffect(() => {
    if (open) {
      setQuestion("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Cuộn xuống cuối danh sách khi có tin nhắn mới.
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Đóng bằng phím Esc.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const sendQuestion = useCallback(
    async (rawQuestion) => {
      const text = (rawQuestion ?? question).trim();
      if (!text || loading) return;
      if (exhausted) {
        toast.error(t("member:aiSupport.toastDailyExhausted"));
        return;
      }
      if (sessionExhausted) {
        toast.error(t("member:aiSupport.toastSessionLimit", { count: SESSION_LIMIT }));
        return;
      }
      if (!exerciseCode) {
        toast.error(t("member:aiSupport.toastNoExercise"));
        return;
      }

      setQuestion("");
      setMessages((current) => [...current, { role: "user", text }]);
      setLoading(true);

      try {
        const data = await aiSupportApi.ask({
          exerciseCode,
          question: text,
          sessionId,
          formIssues,
          accuracy,
        });
        setMessages((current) => [
          ...current,
          {
            role: "ai",
            causes: data.answer?.causes ?? [],
            tip: data.answer?.tip ?? "",
            followUps: data.answer?.followUps ?? [],
            // Cờ báo câu trả lời đến từ rule nội bộ (chế độ demo) thay vì AI thật.
            demo: data.provider === "local-rules",
            notice: data.notice ?? null,
            // Câu hỏi chứa triệu chứng cần bác sĩ đánh giá -> server không gọi AI.
            medicalRedFlag: data.provider === "safety-guard",
            // Luật cảnh báo sinh lý của bài tập (V76).
            alerts: Array.isArray(data.alerts) ? data.alerts : [],
          },
        ]);
        setQuota({
          questionCount: data.questionCount,
          dailyLimit: data.dailyLimit,
          remaining: data.remaining,
          sessionLimit: data.sessionLimit,
        });
      } catch (error) {
        const status = error?.response?.status;
        const serverMessage = error?.response?.data?.message;
        const errorCode = error?.response?.data?.code;
        if (status === 429) {
          // Server trả 429 cho cả hết quota ngày lẫn hết lượt phiên chat.
          toast.error(serverMessage || t("member:aiSupport.toastDailyExhausted"));
          if (serverMessage?.includes("chat")) {
            setQuota((current) => ({ ...(current || {}), sessionUsed: SESSION_LIMIT }));
          } else {
            setQuota((current) => ({ ...(current || {}), remaining: 0 }));
          }
        } else if (status === 400) {
          toast.error(serverMessage || t("member:aiSupport.toastRephrase"));
        } else if (status === 503) {
          // Lỗi phía OpenAI (hết credit, rate limit, sai key) -> báo đúng lý do.
          if (errorCode === "AI_RATE_LIMITED") {
            toast.error(t("member:aiSupport.toastRateLimited"));
          } else if (errorCode === "AI_INVALID_KEY") {
            toast.error(t("member:aiSupport.toastInvalidKey"));
          } else if (errorCode === "AI_OUT_OF_CREDITS") {
            toast.error(t("member:aiSupport.toastOutOfCredits"));
          } else {
            toast.error(serverMessage || t("member:aiSupport.toastUnavailable"));
          }
        } else {
          toast.error(t("member:aiSupport.toastUnavailable"));
        }
        // Bỏ tin nhắn của user để không mất câu hỏi.
        setMessages((current) => current.slice(0, -1));
      } finally {
        setLoading(false);
      }
    },
    [
      accuracy,
      exhausted,
      exerciseCode,
      formIssues,
      loading,
      question,
      sessionExhausted,
      sessionId,
    ],
  );

  if (!open) return null;

  return (
    <div
      className="ais-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        className="ais-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t("member:aiSupport.title")}
      >
        {/* ------------------------------------------------------- header */}
        <header className="ais-head">
          <div className="ais-head-text">
            <h2 className="ais-title">{t("member:aiSupport.title")}</h2>
            <p className="ais-subtitle">{t("member:aiSupport.subtitle")}</p>
            {/* Badge model AI đang dùng (gpt-4o-mini) hoặc cảnh báo offline. */}
            {aiEnabled && aiModel ? (
              <p className="ais-model">{t("member:aiSupport.poweredBy", { model: aiModel })}</p>
            ) : null}
          </div>

          <div className="ais-head-right">
            <span
              className="ais-steps"
              aria-label={t("member:aiSupport.questionOf", {
                current: sessionIndex,
                total: SESSION_LIMIT,
              })}
            >
              <span className="ais-step-dots" aria-hidden="true">
                {Array.from({ length: SESSION_LIMIT }, (_, index) => (
                  <span
                    key={index}
                    className={`ais-step-dot${index < sessionIndex ? " is-done" : ""}`}
                  />
                ))}
              </span>
              <span className="ais-step-text">
                {sessionIndex}/{SESSION_LIMIT}
              </span>
            </span>

            {/* Hết lượt phiên -> cho member mở phiên chat mới (quota ngày vẫn còn). */}
            {sessionExhausted && !exhausted ? (
              <button type="button" className="ais-newchat" onClick={startNewChat}>
                {t("member:aiSupport.newChat")}
              </button>
            ) : null}

            <button
              type="button"
              className="ais-close"
              aria-label={t("member:aiSupport.closeAria")}
              onClick={() => onClose?.()}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </header>

        {/* ------------------------------------------------- context chip */}
        <div className="ais-context">
          <span className="ais-context-dot" aria-hidden="true" />
          <span className="ais-context-text">{contextLabel}</span>
        </div>

        {/* Server chưa cấu hình API thật -> báo rõ cho member biết đang offline. */}
        {!aiEnabled ? (
          <p className="ais-offline">{t("member:aiSupport.offlineNotice")}</p>
        ) : null}

        {/* ------------------------------------------------------ messages */}
        <div className="ais-list" ref={listRef}>
          {messages.length === 0 && (
            <div className="ais-empty">
              <span className="ais-empty-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3l1.9 4.4L18.5 9l-4.6 1.6L12 15l-1.9-4.4L5.5 9l4.6-1.6L12 3Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <p className="ais-empty-title">{t("member:aiSupport.emptyTitle")}</p>
              <p className="ais-empty-text">{t("member:aiSupport.emptyText")}</p>
            </div>
          )}

          {messages.map((item, index) =>
            item.role === "user" ? (
              <div key={index} className="ais-msg ais-msg--user">
                <p className="ais-bubble">{item.text}</p>
              </div>
            ) : (
              <div key={index} className="ais-msg ais-msg--ai">
                <div className="ais-answer">
                  <header className="ais-answer-head">
                    <span className="ais-answer-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path
                          d="M12 3l1.9 4.4L18.5 9l-4.6 1.6L12 15l-1.9-4.4L5.5 9l4.6-1.6L12 3Z"
                          fill="currentColor"
                        />
                      </svg>
                    </span>
                    <p className="ais-answer-title">
                      {item.medicalRedFlag
                        ? t("member:aiSupport.medicalRedFlagTitle")
                        : t("member:aiSupport.likelyCauses", { count: item.causes.length })}
                    </p>
                    {/* Cờ báo câu trả lời đến từ rule nội bộ (chế độ demo). */}
                    {item.demo ? (
                      <span className="ais-demo-badge" title={item.notice ?? ""}>
                        {t("member:aiSupport.demoBadge")}
                      </span>
                    ) : null}
                    {/* Cờ báo câu hỏi có triệu chứng cần bác sĩ đánh giá. */}
                    {item.medicalRedFlag ? (
                      <span className="ais-medical-badge">
                        {t("member:aiSupport.medicalRedFlagBadge")}
                      </span>
                    ) : null}
                  </header>

                  <ul className="ais-causes">
                    {item.causes.map((cause, causeIndex) => (
                      <li key={causeIndex} className="ais-cause">
                        <span className="ais-cause-num">{causeIndex + 1}</span>
                        <div className="ais-cause-body">
                          <p className="ais-cause-title">{cause.title}</p>
                          <p className="ais-cause-detail">{cause.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {item.tip ? (
                    <>
                      <div className="ais-divider" />
                      <p className="ais-tip">{item.tip}</p>
                    </>
                  ) : null}

                  {/* Luật cảnh báo sinh lý (V76) của bài tập. */}
                  {Array.isArray(item.alerts) && item.alerts.length > 0 ? (
                    <div className="ais-alerts">
                      <p className="ais-alerts-title">
                        {t("member:aiSupport.physiologyAlertsTitle")}
                      </p>
                      {item.alerts.map((alert) => (
                        <div
                          key={alert.ruleCode}
                          className={`ais-alert ais-alert--${String(alert.severity || "INFO").toLowerCase()}`}
                        >
                          <span className="ais-alert-sev">
                            {alert.severity === "DANGER"
                              ? t("member:aiSupport.physiologyAlertDanger")
                              : alert.severity === "WARN"
                                ? t("member:aiSupport.physiologyAlertWarn")
                                : t("member:aiSupport.physiologyAlertInfo")}
                          </span>
                          <span className="ais-alert-text">{alert.messageTemplate}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ),
          )}

          {loading ? (
            <div className="ais-msg ais-msg--ai">
              <div className="ais-typing" aria-live="polite">
                <span />
                <span />
                <span />
              </div>
            </div>
          ) : null}

          {/* Gợi ý câu hỏi — chỉ hiện khi chưa hỏi câu nào. */}
          {!loading && sessionIndex === 0 && exerciseName && !sessionExhausted ? (
            <div className="ais-suggestions">
              {[
                t("member:aiSupport.suggestionWhy", { name: exerciseName }),
                t("member:aiSupport.suggestionFix"),
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="ais-chip"
                  onClick={() => sendQuestion(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}

          {messages.length > 1 &&
            messages[messages.length - 1]?.role === "ai" &&
            (messages[messages.length - 1].followUps || []).length > 0 &&
            !sessionExhausted ? (
              <div className="ais-suggestions">
                {messages[messages.length - 1].followUps.map((followUp) => (
                  <button
                    key={followUp}
                    type="button"
                    className="ais-chip"
                    onClick={() => sendQuestion(followUp)}
                  >
                    {followUp}
                  </button>
                ))}
              </div>
            ) : null}
        </div>

        {/* ------------------------------------------------------- input */}
        <footer className="ais-inputbar">
          <input
            ref={inputRef}
            type="text"
            className="ais-input"
            value={question}
            maxLength={1000}
            disabled={loading || exhausted || sessionExhausted}
            placeholder={
              exhausted
                ? t("member:aiSupport.placeholderDailyLimit")
                : sessionExhausted
                  ? t("member:aiSupport.placeholderSessionLimit")
                  : remaining !== null
                    ? t("member:aiSupport.placeholderRemaining", { remaining })
                    : t("member:aiSupport.placeholderDefault")
            }
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                sendQuestion();
              }
            }}
          />
          <button
            type="button"
            className="ais-send"
            aria-label={t("member:aiSupport.sendQuestionAria")}
            disabled={loading || exhausted || sessionExhausted || !question.trim()}
            onClick={() => sendQuestion()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 12h13M12 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </footer>

        {/* Gợi ý mở phiên chat mới khi đã dùng hết lượt của phiên này. */}
        {sessionExhausted && !exhausted ? (
          <div className="ais-sessionhint">
            <p className="ais-sessionhint-text">
              {t("member:aiSupport.sessionHint", { count: SESSION_LIMIT })}
            </p>
            <button type="button" className="ais-sessionhint-btn" onClick={startNewChat}>
              {t("member:aiSupport.startNewChat")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
