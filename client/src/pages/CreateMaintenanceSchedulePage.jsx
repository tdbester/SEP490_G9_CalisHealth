import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import api from "../api/client";
import ConfirmDialog from "../components/common/ConfirmDialog";
import notificationToast from "../utils/notificationToast";

const AREAS = [
  { value: "MEMBER_APP_ACCESS", label: "Member App Access" },
  { value: "MEMBER_VIDEO_UPLOADS", label: "Member Video Uploads" },
  { value: "AI_POSE_ASSESSMENT", label: "AI Pose Assessment" },
  { value: "SYSTEM_STORAGE_CDN", label: "System Storage & CDN" },
  { value: "ADMIN_MANAGEMENT_PORTAL", label: "Admin Management Portal" },
];
const REMINDERS = [
  { value: 1, label: "1 hour before" },
  { value: 12, label: "12 hours before" },
  { value: 24, label: "24 hours before" },
  { value: 48, label: "48 hours before" },
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

function formatPreviewDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
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

  const startTimeError = startsAt && new Date(startsAt) <= clock
    ? "Start time must be in the future."
    : "";
  const endTimeError = startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)
    ? "End time must be after start time."
    : "";
  const isTimeInvalid = Boolean(startTimeError || endTimeError);

  const duration = formatDuration(startsAt, endsAt);
  const previewAreas = AREAS.filter((area) => affectedAreas.includes(area.value))
    .map((area) => area.label);
  const availabilityText = previewAreas.length
    ? `${previewAreas.join(", ")} will be unavailable from ${formatPreviewDate(startsAt)} to ${formatPreviewDate(endsAt)}.`
    : `Services will be unavailable from ${formatPreviewDate(startsAt)} to ${formatPreviewDate(endsAt)}.`;
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
    if (!title.trim()) nextErrors.title = "Title is required.";
    if (startTimeError) nextErrors.startsAt = startTimeError;
    if (endTimeError) nextErrors.endsAt = endTimeError;
    if (!startsAt || !endsAt) nextErrors.endsAt = "Start and end times are required.";
    if (affectedAreas.length === 0) nextErrors.affectedAreas = "Select at least one affected area.";
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
        ? "Maintenance schedule created and global notification published successfully!"
        : "Maintenance schedule created successfully!");
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
        "Could not create the maintenance schedule. Please try again.",
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
    <section className="mx-auto w-full max-w-[1080px] px-4 py-5 font-[Arial,sans-serif] text-slate-100 sm:px-7 sm:py-6">
      <header className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight text-white">
          Create maintenance schedule
        </h1>
        <p className="mt-1 text-xs leading-5 text-[#a89bd0] sm:text-sm">
          Plan a maintenance window and tell users in advance. Affected areas are unavailable during the window.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3">
        <section className={sectionClass}>
          <h2 className="text-sm font-bold text-white">Details</h2>
          <div className="mt-3">
            <label htmlFor="maintenance-title" className="text-xs font-semibold text-[#e2ddef]">Title</label>
            <input
              id="maintenance-title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setErrors((current) => ({ ...current, title: "" }));
              }}
              maxLength={255}
              placeholder="Database upgrade"
              className={fieldClass}
              aria-invalid={Boolean(errors.title)}
            />
            {errors.title && <p className="mt-1 text-xs text-rose-300">{errors.title}</p>}
          </div>
          <div className="mt-2">
            <label htmlFor="maintenance-message" className="text-xs font-semibold text-[#e2ddef]">Message to users</label>
            <textarea
              id="maintenance-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={2}
              placeholder="We’re improving performance. Your data is safe and training history won’t be affected."
              className={`${fieldClass} min-h-[58px] resize-y`}
            />
            <p className="mt-1 text-[11px] text-[#857ba3]">Shown in the notification. Optional.</p>
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className="text-sm font-bold text-white">Schedule</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="maintenance-start" className="text-xs font-semibold text-[#e2ddef]">Start</label>
              <input
                id="maintenance-start"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => {
                  setStartsAt(event.target.value);
                  setErrors((current) => ({ ...current, startsAt: "" }));
                }}
                className={`${fieldClass} [color-scheme:dark]`}
                aria-invalid={Boolean(startTimeError || errors.startsAt)}
              />
              {(startTimeError || errors.startsAt) && (
                <p className="mt-1 text-xs text-rose-300">{startTimeError || errors.startsAt}</p>
              )}
            </div>
            <div>
              <label htmlFor="maintenance-end" className="text-xs font-semibold text-[#e2ddef]">End</label>
              <input
                id="maintenance-end"
                type="datetime-local"
                value={endsAt}
                onChange={(event) => {
                  setEndsAt(event.target.value);
                  setErrors((current) => ({ ...current, endsAt: "" }));
                }}
                className={`${fieldClass} [color-scheme:dark]`}
                aria-invalid={Boolean(endTimeError || errors.endsAt)}
              />
              {(endTimeError || errors.endsAt) && (
                <p className="mt-1 text-xs text-rose-300">{endTimeError || errors.endsAt}</p>
              )}
            </div>
          </div>
          <span className="mt-2 inline-flex rounded-full border border-[#4c3888] bg-[#241950] px-3 py-1 text-[11px] font-semibold text-[#e2d6ff]">
            {duration ? `Duration: ${duration}` : "End must be after start"}
          </span>
        </section>

        <section className={sectionClass}>
          <h2 className="text-sm font-bold text-white">Affected areas</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {AREAS.map((area) => {
              const checked = affectedAreas.includes(area.value);
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
                  <span className={`min-w-0 text-sm font-semibold ${checked ? "text-white" : "text-[#eee9f7]"}`}>{area.label}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleArea(area.value)}
                    aria-label={area.label}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0 focus-visible:rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
                  />
                </label>
              );
            })}
          </div>
          {errors.affectedAreas && <p className="mt-2 text-xs text-rose-300">{errors.affectedAreas}</p>}
        </section>

        <section className={sectionClass}>
          <h2 className="text-sm font-bold text-white">Notify users</h2>
          <div className="mt-3">
            <div className="flex items-center justify-between gap-4">
              <span id="notify-members-label" className="text-xs font-semibold text-[#e2ddef]">
                Send notification to members
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
              Appears in the notification bell and on the Notifications page. You can edit or delete it later in Notifications.
            </p>
          </div>
          <div className="mt-3 max-w-[360px]">
            <label htmlFor="reminder-hours" className="text-xs font-semibold text-[#e2ddef]">Remind users</label>
            <select
              id="reminder-hours"
              value={reminderHours}
              onChange={(event) => setReminderHours(Number(event.target.value))}
              className={fieldClass}
              disabled={!notifyMembers}
            >
              {REMINDERS.map((reminder) => (
                <option key={reminder.value} value={reminder.value} className="bg-[#17112d] text-white">
                  {reminder.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className="text-sm font-bold text-white">Notification preview</h2>
          <div className="mt-3 rounded-xl border border-[#302650] bg-[#0f0b22] px-3.5 py-3">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400">
                <BuildRoundedIcon sx={{ fontSize: 14 }} />
              </span>
              <h3 className="text-xs font-bold leading-4 text-white">Scheduled maintenance</h3>
            </div>
            <div className="mt-1">
              <p className="mt-0.5 text-[11px] leading-4 text-[#a89dbd]">{previewMessage}</p>
              <p className="text-[10px] font-medium text-[#d3c7ef]">Just now</p>
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
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              saving || isTimeInvalid || errors.startsAt || errors.endsAt
              || !title.trim() || affectedAreas.length === 0
            }
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[#7c5dfa] px-5 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition hover:bg-[#6c4dce] disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create schedule"}
          </button>
        </div>
      </form>
      <ConfirmDialog
        open={cancelDialogOpen}
        title="Cancel schedule creation?"
        message="Are you sure you want to leave? The maintenance schedule has not been created."
        confirmLabel="Leave page"
        cancelLabel="Continue creating"
        onConfirm={leaveForm}
        onCancel={() => setCancelDialogOpen(false)}
      />
    </section>
  );
}
