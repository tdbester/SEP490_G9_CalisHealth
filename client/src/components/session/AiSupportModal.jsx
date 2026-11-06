import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { aiSupportApi } from "../../api/aiSupport";
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
const SOURCE_LABELS = {
  camera: "AI camera session",
  video: "AI video scan session",
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
function parseAnswer(json) {
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
    return { causes: [{ title: "AI coach feedback", detail: json }], tip: "", followUps: [] };
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
  const listRef = useRef(null);
  const inputRef = useRef(null);

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
    const sourceLabel = SOURCE_LABELS[source] ?? SOURCE_LABELS.camera;
    return [exerciseName, sourceLabel, date].filter(Boolean).join(" · ");
  }, [exerciseName, sessionDate, source]);

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
        if (!cancelled) setQuota(data);
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
          const parsed = parseAnswer(item.answerJson);
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
        toast.error("You've used all your AI questions for today.");
        return;
      }
      if (sessionExhausted) {
        toast.error("This chat is limited to 5 questions. Close it and open a new chat.");
        return;
      }
      if (!exerciseCode) {
        toast.error("No exercise selected for AI support.");
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
        if (status === 429) {
          // Server trả 429 cho cả hết quota ngày lẫn hết lượt phiên chat.
          toast.error(serverMessage || "You've used all your AI questions for today.");
          if (serverMessage?.includes("chat")) {
            setQuota((current) => ({ ...(current || {}), sessionUsed: SESSION_LIMIT }));
          } else {
            setQuota((current) => ({ ...(current || {}), remaining: 0 }));
          }
        } else if (status === 400) {
          toast.error(serverMessage || "Please rephrase your question.");
        } else {
          toast.error("AI support is unavailable right now. Please try again.");
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
        aria-label="AI Support"
      >
        {/* ------------------------------------------------------- header */}
        <header className="ais-head">
          <div className="ais-head-text">
            <h2 className="ais-title">AI Support</h2>
            <p className="ais-subtitle">
              AI suggests likely causes of your form errors.
            </p>
          </div>

          <div className="ais-head-right">
            <span className="ais-steps" aria-label={`Question ${sessionIndex} of ${SESSION_LIMIT}`}>
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
                New chat
              </button>
            ) : null}

            <button
              type="button"
              className="ais-close"
              aria-label="Close AI support"
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
              <p className="ais-empty-title">Ask about any form error</p>
              <p className="ais-empty-text">
                AI reads the form rules and the issues detected in your session, then
                explains the likely causes.
              </p>
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
                      {item.causes.length} likely causes
                    </p>
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
                `Why do my form errors happen in ${exerciseName}?`,
                "How do I fix the form issue detected in my last set?",
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
                ? "Daily AI limit reached"
                : sessionExhausted
                  ? "Chat limit reached — reopen to continue"
                  : remaining !== null
                    ? `Ask about your form (${remaining} left)`
                    : "Ask about your form"
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
            aria-label="Send question"
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
              You&apos;ve used all {SESSION_LIMIT} questions in this chat.
            </p>
            <button type="button" className="ais-sessionhint-btn" onClick={startNewChat}>
              Start a new chat
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
