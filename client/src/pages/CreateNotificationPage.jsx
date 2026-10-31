import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import api from "../api/client";

const TYPE_OPTIONS = [
  {
    value: "ANNOUNCEMENT",
    label: "Announcement",
    description: "General news for all members, such as a welcome message or a challenge.",
  },
  {
    value: "UPDATE",
    label: "Update",
    description: "New content or features, such as a new skill roadmap.",
  },
];

const STATUS_OPTIONS = [
  {
    value: "PUBLISHED",
    label: "Publish now",
    description: "Members see it in the notification bell right away.",
  },
  {
    value: "DRAFT",
    label: "Save as draft",
    description: "Only admins see it. You can publish it later from Notifications.",
  },
];

const inputClass =
  "mt-2 w-full rounded-xl border border-[#51456f] bg-[#17112d] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-[#81769d] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20";
const sectionClass = "rounded-2xl border border-[#35275e] bg-[#21183c] p-5 sm:p-6";

export default function CreateNotificationPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("ANNOUNCEMENT");
  const [status, setStatus] = useState("PUBLISHED");
  const [fieldErrors, setFieldErrors] = useState({});
  const [requestError, setRequestError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const submitStatus = event.nativeEvent.submitter?.value || status;
    const errors = {};
    if (!title.trim()) errors.title = "Title is required.";
    if (!message.trim()) errors.message = "Message is required.";
    if (title.trim().length > 255) errors.title = "Title must not exceed 255 characters.";
    setFieldErrors(errors);
    setRequestError("");
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await api.post("/admin/notifications", {
        title: title.trim(),
        message: message.trim(),
        type,
        status: submitStatus,
      });
      navigate("/admin/notifications", { replace: true });
    } catch (error) {
      const validationErrors = error.response?.data?.errors;
      if (validationErrors && typeof validationErrors === "object") {
        setFieldErrors((current) => ({
          ...current,
          title: validationErrors.title || current.title,
          message: validationErrors.message || current.message,
        }));
      }
      setRequestError(
        error.response?.data?.message || "Could not create the notification. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const previewTitle = title.trim() || "Notification title";
  const previewMessage = message.trim() || "Your message will appear here.";

  return (
    <section className="mx-auto w-full max-w-[1080px] text-slate-100">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-white">Create notification</h1>
          <p className="mt-1.5 text-sm text-[#a89bd0]">
            Write a notification that members see in the web notification bell.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/admin/notifications")}
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#51456f] bg-[#17112d] px-3.5 text-sm font-medium text-white transition hover:bg-[#2b2049] disabled:opacity-50"
          >
            <ArrowBackRoundedIcon sx={{ fontSize: 18 }} />
            Back
          </button>
          <button
            type="submit"
            form="create-notification-form"
            name="status"
            value="DRAFT"
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-violet-400/30 bg-violet-500/10 px-3.5 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20 disabled:opacity-50"
          >
            <SaveOutlinedIcon sx={{ fontSize: 18 }} />
            Save draft
          </button>
          <button
            type="submit"
            form="create-notification-form"
            name="status"
            value="PUBLISHED"
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#7c5dfa] px-4 text-sm font-medium text-white shadow-lg shadow-purple-500/20 transition hover:bg-[#6c4dce] disabled:opacity-50"
          >
            <SendRoundedIcon sx={{ fontSize: 18 }} />
            Publish
          </button>
        </div>
      </header>

      {requestError && (
        <p role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {requestError}
        </p>
      )}

      <form id="create-notification-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-4">
          <section className={sectionClass}>
            <h2 className="text-sm font-semibold text-white">Details</h2>
            <div className="mt-4">
              <label htmlFor="notification-title" className="text-xs font-medium text-[#d2ccdf]">
                Title <span className="text-violet-300">*</span>
              </label>
              <input
                id="notification-title"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setFieldErrors((current) => ({ ...current, title: "" }));
                }}
                maxLength={255}
                aria-invalid={Boolean(fieldErrors.title)}
                aria-describedby={fieldErrors.title ? "notification-title-error" : undefined}
                className={`${inputClass} ${fieldErrors.title ? "border-rose-500" : ""}`}
                placeholder="e.g. Holiday training challenge"
              />
              {fieldErrors.title && (
                <p id="notification-title-error" className="mt-1.5 text-xs text-rose-300">{fieldErrors.title}</p>
              )}
            </div>
            <div className="mt-4">
              <label htmlFor="notification-message" className="text-xs font-medium text-[#d2ccdf]">
                Message <span className="text-violet-300">*</span>
              </label>
              <textarea
                id="notification-message"
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value);
                  setFieldErrors((current) => ({ ...current, message: "" }));
                }}
                rows={4}
                aria-invalid={Boolean(fieldErrors.message)}
                aria-describedby={fieldErrors.message ? "notification-message-error" : undefined}
                className={`${inputClass} resize-y`}
                placeholder="e.g. Train 3 days a week this month to earn a badge."
              />
              {fieldErrors.message && (
                <p id="notification-message-error" className="mt-1.5 text-xs text-rose-300">{fieldErrors.message}</p>
              )}
            </div>
            <p className="mt-3 text-[11px] text-[#a89bd0]">
              Shown in the notification bell and on the Notifications page.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className="text-sm font-semibold text-white">Type</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {TYPE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`relative flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                    type === option.value
                      ? "border-violet-500 bg-[#30215f]/60"
                      : "border-[#51456f] bg-[#17112d] hover:border-violet-400/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="notification-type"
                    value={option.value}
                    checked={type === option.value}
                    onChange={() => setType(option.value)}
                    className="mt-0.5 h-4 w-4 accent-[#7c5dfa]"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center justify-between gap-2 text-sm font-semibold text-white">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[#a89bd0]">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-[#c4b5fd]">
              <span aria-hidden="true">🔑 </span>
              Maintenance notifications are created automatically from Maintenance schedules.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className="text-sm font-semibold text-white">Publishing</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {STATUS_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                    status === option.value
                      ? "border-violet-500 bg-[#30215f]/60"
                      : "border-[#51456f] bg-[#17112d] hover:border-violet-400/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="notification-status"
                    value={option.value}
                    checked={status === option.value}
                    onChange={() => setStatus(option.value)}
                    className="mt-0.5 h-4 w-4 accent-[#7c5dfa]"
                  />
                  <span>
                    <span className="flex items-center gap-2 text-sm font-semibold text-white">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[#a89bd0]">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        </div>

        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-white">Notification preview</h2>
          <div className="mt-4 rounded-xl border border-[#51456f] bg-[#17112d] p-4">
            <div className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-violet-400/30 bg-violet-500/15 text-violet-300">
                <span className="text-sm" aria-hidden="true">i</span>
              </span>
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-white">{previewTitle}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-[#a89bd0]">{previewMessage}</p>
                <p className="mt-2 text-[10px] text-[#81769d]">Just now</p>
              </div>
            </div>
          </div>
        </section>
      </form>
    </section>
  );
}
