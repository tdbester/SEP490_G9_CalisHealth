import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { useTranslation } from "react-i18next";
import api from "../api/client";
import ConfirmDialog from "../components/common/ConfirmDialog";
import notificationToast from "../utils/notificationToast";
import "./CreateMaintenanceSchedulePage.css";

const AREAS = [
  { value: "MEMBER_APP_ACCESS", labelKey: "admin.maintenance.createForm.areaMemberApp" },
  { value: "MEMBER_VIDEO_UPLOADS", labelKey: "admin.maintenance.createForm.areaVideoUploads" },
  { value: "AI_POSE_ASSESSMENT", labelKey: "admin.maintenance.createForm.areaAiPose" },
  { value: "SYSTEM_STORAGE_CDN", labelKey: "admin.maintenance.createForm.areaStorage" },
  { value: "ADMIN_MANAGEMENT_PORTAL", labelKey: "admin.maintenance.createForm.areaAdminPortal" },
];
const REMINDERS = [
  { value: 1, labelKey: "admin.maintenance.createForm.reminderOne" },
  { value: 12, labelKey: "admin.maintenance.createForm.reminderTwelve" },
  { value: 24, labelKey: "admin.maintenance.createForm.reminderTwentyFour" },
  { value: 48, labelKey: "admin.maintenance.createForm.reminderFortyEight" },
];
const sectionClass = "rounded-2xl border border-[#29204d] bg-[#15112f] p-4 sm:p-5";
const fieldClass =
  "mt-2 w-full rounded-lg border border-[#51456f] bg-[#17112d] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-[#81769d] focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20";

function toLocalDateTimeValue(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toApiDateTimeValue(value) {
  return value.length === 16 ? `${value}:00` : value;
}

function getDefaultWindow() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(2, 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 2);
  return { startsAt: toLocalDateTimeValue(start), endsAt: toLocalDateTimeValue(end) };
}

function formatPreviewDate(value, locale) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale || "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(start, end) {
  const minutes = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  if (hours && remainingMinutes) return `${hours} h ${remainingMinutes} min`;
  if (hours) return `${hours} h`;
  return `${remainingMinutes} min`;
}

export default function CreateMaintenanceSchedulePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const defaultWindow = useMemo(getDefaultWindow, []);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [startsAt, setStartsAt] = useState(defaultWindow.startsAt);
  const [endsAt, setEndsAt] = useState(defaultWindow.endsAt);
  const [affectedAreas, setAffectedAreas] = useState(["MEMBER_APP_ACCESS"]);
  const [notifyMembers, setNotifyMembers] = useState(true);
  const [reminderHours, setReminderHours] = useState(24);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const timerId = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  const minimumStartTime = new Date(clock.getTime() + 3 * 60 * 60 * 1000);
  const minimumEndTime = startsAt
    ? new Date(new Date(startsAt).getTime() + 2 * 60 * 60 * 1000)
    : null;
  const startTimeError = startsAt && new Date(startsAt) < minimumStartTime
    ? t("admin.maintenance.createForm.errStartTime")
    : "";
  const endTimeError = startsAt && endsAt && minimumEndTime
    && new Date(endsAt) < minimumEndTime
    ? t("admin.maintenance.createForm.errDuration")
    : "";
  const isTimeInvalid = Boolean(startTimeError || endTimeError);

  const duration = formatDuration(startsAt, endsAt);
  const previewAreas = AREAS.filter((area) => affectedAreas.includes(area.value))
    .map((area) => t(area.labelKey));
  const availabilityText = previewAreas.length
    ? t("admin.maintenance.createForm.availabilityWithAreas", {
      areas: previewAreas.join(", "),
      start: formatPreviewDate(startsAt, i18n.language),
      end: formatPreviewDate(endsAt, i18n.language),
    })
    : t("admin.maintenance.createForm.availabilityNoAreas", {
      start: formatPreviewDate(startsAt, i18n.language),
      end: formatPreviewDate(endsAt, i18n.language),
    });
  const previewMessage = message.trim()
    ? `${message.trim()} ${availabilityText}`
    : availabilityText;

  const toggleArea = (value) => {
    setAffectedAreas((current) =>
      current.includes(value)
        ? current.filter((area) => area !== value)
        : [...current, value],
    );
    setErrors((current) => ({ ...current, affectedAreas: "" }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!title.trim()) nextErrors.title = t("admin.maintenance.createForm.errTitleRequired");
    if (startTimeError) nextErrors.startsAt = startTimeError;
    if (endTimeError) nextErrors.endsAt = endTimeError;
    if (!startsAt || !endsAt) nextErrors.endsAt = t("admin.maintenance.createForm.errTimesRequired");
    if (affectedAreas.length === 0) nextErrors.affectedAreas = t("admin.maintenance.createForm.errNoArea");
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        message: message.trim() || null,
        startsAt: toApiDateTimeValue(startsAt),
        endsAt: toApiDateTimeValue(endsAt),
        affectedAreas: AREAS
          .filter((area) => affectedAreas.includes(area.value))
          .map((area) => area.value),
        notifyMembers,
        reminderHours,
      };
      if (import.meta.env.DEV) {
        console.log("Submitting Payload:", payload);
      }
      await api.post("/admin/maintenance-schedules", payload);
      notificationToast.success(notifyMembers
        ? t("admin.maintenance.createForm.createdWithNotification")
        : t("admin.maintenance.createForm.created"));
      window.dispatchEvent(new Event("member-notifications-updated"));
      navigate("/admin/maintenance");
    } catch (error) {
      const validationErrors = error.response?.data?.errors;
      const startError = validationErrors?.startsAt || validationErrors?.startTime;
      const endError = validationErrors?.endsAt || validationErrors?.endTime;
      if (startError || endError) {
        setErrors((current) => ({
          ...current,
          ...(startError ? { startsAt: startError } : {}),
          ...(endError ? { endsAt: endError } : {}),
        }));
      }
      notificationToast.error(
        startError || endError ||
        Object.values(validationErrors || {}).find((value) => typeof value === "string") ||
        error.response?.data?.message ||
        t("admin.maintenance.createForm.createFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  const leaveForm = () => {
    setCancelDialogOpen(false);
    navigate("/admin/maintenance");
  };

  return (
    <section className="maintenance-create-form mx-auto w-full max-w-[1080px] px-4 py-5 font-[Arial,sans-serif] text-slate-100 sm:px-7 sm:py-6">
      <header className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight text-white">
          {t("admin.maintenance.createForm.title")}
        </h1>
        <p className="mt-1 text-xs leading-5 text-[#a89bd0] sm:text-sm">
          {t("admin.maintenance.createForm.description")}
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3">
        <section className={sectionClass}>
          <h2 className="text-sm font-bold text-white">{t("admin.maintenance.createForm.detailsSection")}</h2>
          <div className="mt-3">
            <label htmlFor="maintenance-title" className="text-xs font-semibold text-[#e2ddef]">{t("admin.maintenance.createForm.titleLabel")}</label>
            <input
              id="maintenance-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setErrors((current) => ({ ...current, title: "" }));
              }}
              maxLength={255}
              placeholder={t("admin.maintenance.createForm.titlePlaceholder")}
              className={fieldClass}
              aria-invalid={Boolean(errors.title)}
            />
            {errors.title && <p className="mt-1 text-xs text-rose-300">{errors.title}</p>}
          </div>
          <div className="mt-2">
            <label htmlFor="maintenance-message" className="text-xs font-semibold text-[#e2ddef]">{t("admin.maintenance.createForm.messageLabel")}</label>
            <textarea
              id="maintenance-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={2}
              placeholder={t("admin.maintenance.createForm.messagePlaceholder")}
              className={`${fieldClass} min-h-[58px] resize-y`}
            />
            <p className="mt-1 text-[11px] text-[#857ba3]">{t("admin.maintenance.createForm.messageHint")}</p>
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className="text-sm font-bold text-white">{t("admin.maintenance.createForm.scheduleSection")}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="maintenance-start" className="text-xs font-semibold text-[#e2ddef]">{t("admin.maintenance.createForm.startLabel")}</label>
              <input
                id="maintenance-start"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => {
                  setStartsAt(event.target.value);
                  setErrors((current) => ({ ...current, startsAt: "" }));
                }}
                min={toLocalDateTimeValue(minimumStartTime)}
                className={`${fieldClass} [color-scheme:dark]`}
                aria-invalid={Boolean(startTimeError || errors.startsAt)}
              />
              {(startTimeError || errors.startsAt) && (
                <p className="mt-1 text-xs text-rose-300">{startTimeError || errors.startsAt}</p>
              )}
            </div>
            <div>
              <label htmlFor="maintenance-end" className="text-xs font-semibold text-[#e2ddef]">{t("admin.maintenance.createForm.endLabel")}</label>
              <input
                id="maintenance-end"
                type="datetime-local"
                value={endsAt}
                onChange={(event) => {
                  setEndsAt(event.target.value);
                  setErrors((current) => ({ ...current, endsAt: "" }));
                }}
                min={minimumEndTime ? toLocalDateTimeValue(minimumEndTime) : undefined}
                className={`${fieldClass} [color-scheme:dark]`}
                aria-invalid={Boolean(endTimeError || errors.endsAt)}
              />
              {(endTimeError || errors.endsAt) && (
                <p className="mt-1 text-xs text-rose-300">{endTimeError || errors.endsAt}</p>
              )}
            </div>
          </div>
          <span className="mt-2 inline-flex rounded-full border border-[#4c3888] bg-[#241950] px-3 py-1 text-[11px] font-semibold text-[#e2d6ff]">
            {duration
              ? t("admin.maintenance.createForm.duration", { duration })
              : t("admin.maintenance.createForm.durationTooShort")}
          </span>
        </section>

        <section className={sectionClass}>
          <h2 className="text-sm font-bold text-white">{t("admin.maintenance.createForm.affectedSection")}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {AREAS.map((area) => {
              const checked = affectedAreas.includes(area.value);
              const areaLabel = t(area.labelKey);
              return (
                <label
                  key={area.value}
                  className={`relative flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
                    checked
                      ? "border-[#b49aff] bg-[#5331c7] shadow-[0_0_0_1px_rgba(180,154,255,0.3)]"
                      : "border-[#81769d] bg-[#211a38] hover:border-[#b49aff] hover:bg-[#2b2049]"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      checked
                        ? "border-white bg-[#8b5cf6] text-white"
                        : "border-[#b8acd0] bg-[#120d22] text-transparent"
                    }`}
                  >
                    {checked && <CheckRoundedIcon sx={{ fontSize: 15 }} />}
                  </span>
                  <span className={`min-w-0 text-sm font-semibold ${checked ? "text-white" : "text-[#eee9f7]"}`}>{areaLabel}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleArea(area.value)}
                    aria-label={areaLabel}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0 focus-visible:rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
                  />
                </label>
              );
            })}
          </div>
          {errors.affectedAreas && <p className="mt-2 text-xs text-rose-300">{errors.affectedAreas}</p>}
        </section>

        <section className={sectionClass}>
          <h2 className="text-sm font-bold text-white">{t("admin.maintenance.createForm.notifySection")}</h2>
          <div className="mt-3">
            <div className="flex items-center justify-between gap-4">
              <span id="notify-members-label" className="text-xs font-semibold text-[#e2ddef]">
                {t("admin.maintenance.createForm.notifyLabel")}
              </span>
              <button
                id="notify-members"
                type="button"
                role="switch"
                aria-labelledby="notify-members-label"
                aria-checked={notifyMembers}
                onClick={() => setNotifyMembers((current) => !current)}
                className="relative block h-6 w-11 shrink-0 appearance-none rounded-full border-0 p-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#15112f]"
                style={{
                  width: 44,
                  height: 24,
                  padding: 0,
                  display: "block",
                  overflow: "hidden",
                  lineHeight: 0,
                  verticalAlign: "middle",
                  backgroundColor: notifyMembers ? "#8b5cf6" : "#514579",
                }}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute block rounded-full bg-white shadow-sm transition-[left] duration-200"
                  style={{
                    width: 20,
                    height: 20,
                    top: 2,
                    left: notifyMembers ? 22 : 2,
                    display: "block",
                  }}
                />
              </button>
            </div>
            <p className="mt-1 max-w-[680px] text-[11px] leading-4 text-[#a89dbd]">
              {t("admin.maintenance.createForm.notifyHint")}
            </p>
          </div>
          <div className="mt-3 max-w-[360px]">
            <label htmlFor="reminder-hours" className="text-xs font-semibold text-[#e2ddef]">{t("admin.maintenance.createForm.remindLabel")}</label>
            <select
              id="reminder-hours"
              value={reminderHours}
              onChange={(event) => setReminderHours(Number(event.target.value))}
              className={fieldClass}
              disabled={!notifyMembers}
            >
              {REMINDERS.map((reminder) => (
                <option key={reminder.value} value={reminder.value} className="bg-[#17112d] text-white">
                  {t(reminder.labelKey)}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className="text-sm font-bold text-white">{t("admin.maintenance.createForm.previewSection")}</h2>
          <div className="mt-3 rounded-xl border border-[#302650] bg-[#0f0b22] px-3.5 py-3">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400">
                <BuildRoundedIcon sx={{ fontSize: 14 }} />
              </span>
              <h3 className="text-xs font-bold leading-4 text-white">{t("admin.maintenance.createForm.previewTitle")}</h3>
              <span className="ml-auto inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                {t("admin.maintenance.createForm.notifyAudienceAllUsers")}
              </span>
            </div>
            <div className="mt-1">
              <p className="mt-0.5 text-[11px] leading-4 text-[#a89dbd]">{previewMessage}</p>
              <p className="text-[10px] font-medium text-[#d3c7ef]">{t("admin.maintenance.createForm.justNow")}</p>
            </div>
          </div>
        </section>

        <div className="flex justify-end pb-2">
          <button
            type="button"
            onClick={() => setCancelDialogOpen(true)}
            disabled={saving}
            className="mr-2 inline-flex h-10 items-center justify-center rounded-xl border border-[#51456f] bg-transparent px-4 text-sm font-medium transition hover:bg-[#231b40] disabled:opacity-50"
            style={{ backgroundColor: "transparent", color: "#d8d1e8" }}
          >
            {t("admin.maintenance.createForm.cancel")}
          </button>
          <button
            type="submit"
            disabled={
              saving || isTimeInvalid || errors.startsAt || errors.endsAt
              || !title.trim() || affectedAreas.length === 0
            }
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[#7c5dfa] px-5 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition hover:bg-[#6c4dce] disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? t("admin.maintenance.createForm.submitting") : t("admin.maintenance.createForm.submit")}
          </button>
        </div>
      </form>
      <ConfirmDialog
        open={cancelDialogOpen}
        title={t("admin.maintenance.createForm.cancelDialogTitle")}
        message={t("admin.maintenance.createForm.cancelDialogMessage")}
        confirmLabel={t("admin.maintenance.createForm.cancelDialogConfirm")}
        cancelLabel={t("admin.maintenance.createForm.cancelDialogCancel")}
        onConfirm={leaveForm}
        onCancel={() => setCancelDialogOpen(false)}
      />
    </section>
  );
}
