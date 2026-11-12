import { useEffect, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../components/common/ConfirmDialog";
import {
  FEEDBACK_CATEGORY,
  createFeedback,
} from "../api/feedback";

/** Nhãn hiển thị cho từng nhóm nội dung. */
const CATEGORY_LABEL = {
  [FEEDBACK_CATEGORY.GENERAL]: "member.feedback.categoryGeneral",
  [FEEDBACK_CATEGORY.EXERCISE_CONTENT]: "member.feedback.categoryExercise",
  [FEEDBACK_CATEGORY.WORKOUT_CONTENT]: "member.feedback.categoryWorkout",
  [FEEDBACK_CATEGORY.TECHNICAL]: "member.feedback.categoryTechnical",
  [FEEDBACK_CATEGORY.OTHER]: "member.feedback.categoryOther",
};

function ChatIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  );
}

function SendIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

function ArrowLeftIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

/**
 * Màn tạo phiếu góp ý / khiếu nại của Member.
 *
 * Member điền tiêu đề + nội dung + phân loại rồi gửi đơn. Mọi đơn đều do
 * Content Manager tiếp nhận; nếu thuộc về hệ thống sẽ được chuyển tiếp lên
 * Admin. Sau khi gửi thành công, member quay lại màn danh sách để theo dõi.
 */
export default function MemberFeedbackCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState(FEEDBACK_CATEGORY.GENERAL);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  /** Member đã nhập gì chưa — dùng để quyết định có cần hỏi lại hay không. */
  const hasChanges = Boolean(title.trim() || content.trim());

  useEffect(() => {
    document.title = `${t("member.feedback.createTitle")} | CalisHealth`;
  }, [t]);

  /**
   * Rời màn. Nếu member đã nhập nội dung thì hỏi lại trước khi bỏ, tránh
   * mất tiếu đề / nội dung đang soạn.
   */
  const requestLeave = () => {
    if (hasChanges) {
      setConfirmDiscard(true);
      return;
    }
    navigate("/library/feedback");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setSuccessMessage("");

    if (!title.trim()) {
      setSubmitError(t("member.feedback.errTitle"));
      return;
    }
    if (!content.trim()) {
      setSubmitError(t("member.feedback.errContent"));
      return;
    }

    setSubmitting(true);
    try {
      await createFeedback({ title: title.trim(), content: content.trim(), category });
      setSuccessMessage(t("member.feedback.submitSuccess"));
      // Chờ một nhịp để member thấy thông báo thành công rồi mới về danh sách.
      setTimeout(() => navigate("/library/feedback"), 900);
    } catch (error) {
      console.error("Could not submit member feedback:", error);
      setSubmitError(
        error?.response?.data?.message || t("member.feedback.submitFailed")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl pb-16 text-white">
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="mb-6">
        <button
          type="button"
          onClick={requestLeave}
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeftIcon />
          {t("member.feedback.backToList")}
        </button>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
            <ChatIcon className="h-5 w-5" />
          </span>
          {t("member.feedback.createTitle")}
        </h1>
        <p className="mt-1 text-xs text-slate-400">{t("member.feedback.formHint")}</p>
      </header>

      {/* ── FORM GỬI ĐƠN ───────────────────────────────────────── */}
      <section className="rounded-2xl border border-[#33285f] bg-[#15102e] p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="feedback-title"
              className="mb-1.5 block text-xs font-semibold text-slate-300"
            >
              {t("member.feedback.titleLabel")}
            </label>
            <input
              id="feedback-title"
              type="text"
              value={title}
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("member.feedback.titlePlaceholder")}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full rounded-xl border border-[#2f2557] bg-[#120d29] px-4 py-2.5 font-[inherit] text-sm text-white outline-none transition-colors placeholder:text-slate-600 placeholder:font-[inherit] focus:border-[#6f52c4]"
            />
          </div>

          <div>
            <label
              htmlFor="feedback-content"
              className="mb-1.5 block text-xs font-semibold text-slate-300"
            >
              {t("member.feedback.contentLabel")}
            </label>
            <textarea
              id="feedback-content"
              value={content}
              maxLength={5000}
              rows={8}
              onChange={(event) => setContent(event.target.value)}
              placeholder={t("member.feedback.contentPlaceholder")}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full resize-y rounded-xl border border-[#2f2557] bg-[#120d29] px-4 py-2.5 font-[inherit] text-sm text-white outline-none transition-colors placeholder:text-slate-600 placeholder:font-[inherit] focus:border-[#6f52c4]"
            />
          </div>

          <div>
            <label
              htmlFor="feedback-category"
              className="mb-1.5 block text-xs font-semibold text-slate-300"
            >
              {t("member.feedback.categoryLabel")}
            </label>
            <select
              id="feedback-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-xl border border-[#2f2557] bg-[#120d29] px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-[#6f52c4] sm:w-64"
            >
              {Object.values(FEEDBACK_CATEGORY).map((value) => (
                <option key={value} value={value} className="bg-[#120d29]">
                  {t(CATEGORY_LABEL[value])}
                </option>
              ))}
            </select>
          </div>

          {submitError ? (
            <div role="alert" className="rounded-xl border border-rose-900 bg-rose-950/40 p-3.5 text-sm text-rose-200">
              {submitError}
            </div>
          ) : null}
          {successMessage ? (
            <div role="status" className="rounded-xl border border-emerald-900 bg-emerald-950/40 p-3.5 text-sm text-emerald-200">
              {successMessage}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-[#643bf6] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#7554ff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SendIcon />
              {submitting ? t("member.feedback.submitting") : t("member.feedback.submit")}
            </button>
            <button
              type="button"
              onClick={requestLeave}
              className="inline-flex items-center gap-2 rounded-xl border border-[#2f2557] bg-[#120d29] px-5 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:border-[#3f3272] hover:text-white"
            >
              {t("member.feedback.cancel")}
            </button>
          </div>
        </form>
      </section>

      <ConfirmDialog
        open={confirmDiscard}
        title={t("member.feedback.discardTitle")}
        message={t("member.feedback.discardMessage")}
        confirmLabel={t("member.feedback.discard")}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => navigate("/library/feedback")}
      />
    </div>
  );
}
