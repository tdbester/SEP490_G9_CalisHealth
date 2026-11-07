import { useState } from "react";
import { useTranslation } from "react-i18next";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import api from "../api/client";
import UnsavedNotificationModal from "../components/notifications/UnsavedNotificationModal";
import notificationToast from "../utils/notificationToast";
import useUnsavedNotificationNavigation from "../hooks/useUnsavedNotificationNavigation";
import "../styles/notification.css";

const TYPE_OPTIONS = [
  {
    value: "ANNOUNCEMENT",
    labelKey: "admin.notifications.filterAnnouncement",
    descriptionKey: "admin.notifications.typeAnnouncementDesc",
  },
  {
    value: "UPDATE",
    labelKey: "admin.notifications.filterUpdate",
    descriptionKey: "admin.notifications.typeUpdateDesc",
  },
];
const AUDIENCE_OPTIONS = [
  {
    value: "MEMBER",
    labelKey: "admin.notifications.audienceMembers",
    descriptionKey: "admin.notifications.audienceMembersDesc",
  },
  {
    value: "CONTENT_MANAGER",
    labelKey: "admin.notifications.audienceContentManager",
    descriptionKey: "admin.notifications.audienceContentManagerDesc",
  },
  {
    value: "SYSTEM_WIDE",
    labelKey: "admin.notifications.audienceSystem",
    descriptionKey: "admin.notifications.audienceSystemDesc",
  },
];

const inputClass =
  "mt-2 w-full rounded-xl border border-[#51456f] bg-[#17112d] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-[#81769d] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20";
const sectionClass = "rounded-2xl border border-[#35275e] bg-[#21183c] p-5 sm:p-6";

export default function CreateNotificationPage() {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("ANNOUNCEMENT");
  const [targetAudience, setTargetAudience] = useState("MEMBER");
  const [fieldErrors, setFieldErrors] = useState({});
  const [requestError, setRequestError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isDirty = Boolean(title || message)
    || type !== "ANNOUNCEMENT"
    || targetAudience !== "MEMBER";
  const {
    isLeaveConfirmationOpen,
    requestLeave,
    cancelLeave,
    discardChanges,
    completeSave,
  } = useUnsavedNotificationNavigation(isDirty);

  const saveDraftAndLeave = async () => {
    const errors = {};
    if (!title.trim()) errors.title = t("admin.notifications.titleRequired");
    if (!message.trim()) errors.message = t("admin.notifications.messageRequired");
    if (title.trim().length > 255) errors.title = t("admin.notifications.titleTooLong");
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await api.post("/admin/notifications", {
        title: title.trim(),
        message: message.trim(),
        type,
        status: "DRAFT",
        targetAudience,
      });
      notificationToast.success(t("admin.notifications.draftSaved"));
      completeSave();
    } catch (error) {
      const errorMessage = error.response?.data?.message || t("admin.notifications.draftSaveFailed");
      setRequestError(errorMessage);
      notificationToast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const submitStatus = event.nativeEvent.submitter?.value || "PUBLISHED";
    const errors = {};
    if (!title.trim()) errors.title = t("admin.notifications.titleRequired");
    if (!message.trim()) errors.message = t("admin.notifications.messageRequired");
    if (title.trim().length > 255) errors.title = t("admin.notifications.titleTooLong");
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
        targetAudience,
      });
      notificationToast.success(
        submitStatus === "PUBLISHED"
          ? t("admin.notifications.published")
          : t("admin.notifications.draftSaved"),
      );
      if (submitStatus === "PUBLISHED") {
        window.dispatchEvent(new Event("member-notifications-updated"));
      }
      completeSave();
    } catch (error) {
      const validationErrors = error.response?.data?.errors;
      if (validationErrors && typeof validationErrors === "object") {
        setFieldErrors((current) => ({
          ...current,
          title: validationErrors.title || current.title,
          message: validationErrors.message || current.message,
        }));
      }
      const errorMessage = error.response?.data?.message || t("admin.notifications.createFailed");
      setRequestError(errorMessage);
      notificationToast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const previewTitle = title.trim() || t("admin.notifications.previewTitlePlaceholder");
  const previewMessage = message.trim() || t("admin.notifications.previewMessagePlaceholder");

  return (
    <section className="notification-module mx-auto w-full max-w-[1080px] text-slate-100">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-white">{t("admin.notifications.create")}</h1>
          <p className="mt-1.5 text-sm text-[#a89bd0]">
            {t("admin.notifications.createHeaderDescription")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => requestLeave()}
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#51456f] bg-[#17112d] px-3.5 text-sm font-medium text-white transition hover:bg-[#2b2049] disabled:opacity-50"
          >
            <ArrowBackRoundedIcon sx={{ fontSize: 18 }} />
            {t("common.back")}
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
            {t("admin.notifications.saveDraft")}
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
            {t("admin.notifications.publish")}
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
            <h2 className="text-sm font-semibold text-white">{t("admin.notifications.details")}</h2>
            <div className="mt-4">
              <label htmlFor="notification-title" className="text-xs font-medium text-[#d2ccdf]">
                {t("admin.notifications.title_label")} <span className="text-violet-300">*</span>
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
                placeholder={t("admin.notifications.titlePlaceholder")}
              />
              {fieldErrors.title && (
                <p id="notification-title-error" className="mt-1.5 text-xs text-rose-300">{fieldErrors.title}</p>
              )}
            </div>
            <div className="mt-4">
              <label htmlFor="notification-message" className="text-xs font-medium text-[#d2ccdf]">
                {t("admin.notifications.message")} <span className="text-violet-300">*</span>
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
                placeholder={t("admin.notifications.messagePlaceholder")}
              />
              {fieldErrors.message && (
                <p id="notification-message-error" className="mt-1.5 text-xs text-rose-300">{fieldErrors.message}</p>
              )}
            </div>
            <p className="mt-3 text-[11px] text-[#a89bd0]">
              {t("admin.notifications.shownHint")}
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className="text-sm font-semibold text-white">{t("admin.notifications.typeSection")}</h2>
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
                      {t(option.labelKey)}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[#a89bd0]">{t(option.descriptionKey)}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-[#c4b5fd]">
              <span aria-hidden="true">🔑 </span>
              {t("admin.notifications.maintenanceAutoHint")}
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className="text-sm font-semibold text-white">{t("admin.notifications.targetAudience")}</h2>
            <p className="mt-1 text-xs leading-5 text-[#a89bd0]">
              {t("admin.notifications.targetAudienceHint")}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {AUDIENCE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  onClick={() => setTargetAudience(option.value)}
                  className={`relative flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                    targetAudience === option.value
                      ? "border-violet-500 bg-[#30215f]/60"
                      : "border-[#51456f] bg-[#17112d] hover:border-violet-400/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="notification-audience"
                    value={option.value}
                    checked={targetAudience === option.value}
                    onChange={(event) => setTargetAudience(event.target.value)}
                    className="mt-0.5 h-4 w-4 accent-[#7c5dfa]"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">{t(option.labelKey)}</span>
                    <span className="mt-1 block text-xs leading-5 text-[#a89bd0]">{t(option.descriptionKey)}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

        </div>

        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-white">{t("admin.notifications.preview")}</h2>
          <div className="mt-4 rounded-xl border border-[#51456f] bg-[#17112d] p-4">
            <div className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-violet-400/30 bg-violet-500/15 text-violet-300">
                <span className="text-sm" aria-hidden="true">i</span>
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="break-words text-sm font-semibold text-white">{previewTitle}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                    targetAudience === "MEMBER"
                      ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                      : targetAudience === "CONTENT_MANAGER"
                        ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  }`}>
                    {t(AUDIENCE_OPTIONS.find((option) => option.value === targetAudience)?.labelKey
                      || AUDIENCE_OPTIONS[0].labelKey)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-[#a89bd0]">{previewMessage}</p>
                <p className="mt-2 text-[10px] text-[#81769d]">{t("admin.notifications.justNow")}</p>
              </div>
            </div>
          </div>
        </section>
      </form>
      {isLeaveConfirmationOpen && (
        <UnsavedNotificationModal
          saving={submitting}
          onCancel={cancelLeave}
          onDiscard={discardChanges}
          onSaveDraft={saveDraftAndLeave}
        />
      )}
    </section>
  );
}
