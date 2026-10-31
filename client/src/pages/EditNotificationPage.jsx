import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
const typeBadgeClass = {
  ANNOUNCEMENT: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  UPDATE: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  MAINTENANCE: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

function formatCreatedAt(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function EditNotificationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [notification, setNotification] = useState(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    api.get(`/admin/notifications/${id}`)
      .then(({ data }) => {
        if (cancelled) return;
        setNotification(data);
        setTitle(data.title || "");
        setMessage(data.message || "");
        setType(data.type || "");
        setStatus(data.status || "DRAFT");
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(
          requestError.response?.data?.message ||
            "Could not load this notification. It may have been deleted.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const submitStatus = event.nativeEvent.submitter?.value || status;
    const validationErrors = {};
    if (!title.trim()) validationErrors.title = "Title is required.";
    if (!message.trim()) validationErrors.message = "Message is required.";
    if (title.trim().length > 255) validationErrors.title = "Title must not exceed 255 characters.";
    setFieldErrors(validationErrors);
    setError("");
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      await api.put(`/admin/notifications/${id}`, {
        title: title.trim(),
        message: message.trim(),
        type,
        status: submitStatus,
      });
      navigate("/admin/notifications", { replace: true });
    } catch (requestError) {
      const responseErrors = requestError.response?.data?.errors;
      if (responseErrors && typeof responseErrors === "object") {
        setFieldErrors((current) => ({
          ...current,
          title: responseErrors.title || current.title,
          message: responseErrors.message || current.message,
        }));
      }
      setError(
        requestError.response?.data?.message ||
          "Could not update the notification. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isMaintenance = notification?.type === "MAINTENANCE";
  const previewTitle = title.trim() || "Notification title";
  const previewMessage = message.trim() || "Your message will appear here.";
  const displayType = notification?.type || type;

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-[1080px] text-sm text-[#a89bd0]" role="status">
        Loading notification…
      </section>
    );
  }

  if (!notification) {
    return (
      <section className="mx-auto w-full max-w-[1080px] text-slate-100">
        <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
        <button
          type="button"
          onClick={() => navigate("/admin/notifications")}
          className="mt-4 rounded-xl border border-[#51456f] bg-[#17112d] px-4 py-2 text-sm text-white hover:bg-[#2b2049]"
        >
          Back to notifications
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-[1080px] text-slate-100">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-white">Edit notification</h1>
          <p className="mt-1.5 text-sm text-[#a89bd0]">
            View or modify notification settings for members.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className={`rounded-full border px-2.5 py-1 font-medium ${typeBadgeClass[displayType] || "border-slate-500/30 bg-slate-500/10 text-slate-300"}`}>
              {displayType.charAt(0) + displayType.slice(1).toLowerCase()}
            </span>
            <span className={`rounded-full border px-2.5 py-1 font-medium ${
              notification.status === "PUBLISHED"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-slate-500/30 bg-slate-500/10 text-slate-300"
            }`}>
              {notification.status.charAt(0) + notification.status.slice(1).toLowerCase()}
            </span>
            <span className="text-[#81769d]">Created {formatCreatedAt(notification.createdAt)}</span>
          </div>
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
            form="edit-notification-form"
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
            form="edit-notification-form"
            name="status"
            value="PUBLISHED"
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#7c5dfa] px-4 text-sm font-medium text-white shadow-lg shadow-purple-500/20 transition hover:bg-[#6c4dce] disabled:opacity-50"
          >
            <SendRoundedIcon sx={{ fontSize: 18 }} />
            {status === "PUBLISHED" ? "Save changes" : "Publish"}
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      <form id="edit-notification-form" onSubmit={handleSubmit} className="space-y-4">
        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-white">Details</h2>
          <div className="mt-4">
            <label htmlFor="edit-notification-title" className="text-xs font-medium text-[#d2ccdf]">
              Title <span className="text-violet-300">*</span>
            </label>
            <input
              id="edit-notification-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setFieldErrors((current) => ({ ...current, title: "" }));
              }}
              maxLength={255}
              aria-invalid={Boolean(fieldErrors.title)}
              className={`${inputClass} ${fieldErrors.title ? "border-rose-500" : ""}`}
              placeholder="Notification title"
            />
            {fieldErrors.title && <p className="mt-1.5 text-xs text-rose-300">{fieldErrors.title}</p>}
          </div>
          <div className="mt-4">
            <label htmlFor="edit-notification-message" className="text-xs font-medium text-[#d2ccdf]">
              Message <span className="text-violet-300">*</span>
            </label>
            <textarea
              id="edit-notification-message"
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                setFieldErrors((current) => ({ ...current, message: "" }));
              }}
              rows={4}
              aria-invalid={Boolean(fieldErrors.message)}
              className={`${inputClass} resize-y`}
              placeholder="Notification message"
            />
            {fieldErrors.message && <p className="mt-1.5 text-xs text-rose-300">{fieldErrors.message}</p>}
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
                className={`flex gap-3 rounded-xl border p-4 transition ${
                  isMaintenance
                    ? "cursor-not-allowed border-[#51456f] bg-[#17112d] opacity-50"
                    : type === option.value
                      ? "cursor-pointer border-violet-500 bg-[#30215f]/60"
                      : "cursor-pointer border-[#51456f] bg-[#17112d] hover:border-violet-400/60"
                }`}
              >
                <input
                  type="radio"
                  name="notification-type"
                  value={option.value}
                  checked={type === option.value}
                  disabled={isMaintenance}
                  onChange={() => setType(option.value)}
                  className="mt-0.5 h-4 w-4 accent-[#7c5dfa]"
                />
                <span>
                  <span className="text-sm font-semibold text-white">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-[#a89bd0]">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
          {isMaintenance && (
            <p className="mt-3 text-xs text-amber-300">
              <span aria-hidden="true">🔑 </span>
              Maintenance notifications are created automatically from Maintenance schedules.
            </p>
          )}
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
                  <span className="text-sm font-semibold text-white">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-[#a89bd0]">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </section>

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
