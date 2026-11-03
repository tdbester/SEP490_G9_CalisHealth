import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import api from "../api/client";

const AREA_LABELS = {
  MEMBER_APP: "Member app",
  AI_CAMERA_TRAINING: "AI camera training",
  UPLOADS: "Uploads",
  ADMIN_AREA: "Admin area",
};

const STATUS_STYLES = {
  UPCOMING: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  ONGOING: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  COMPLETED: "border-slate-400/30 bg-slate-400/10 text-slate-300",
  CANCELLED: "border-rose-400/30 bg-rose-400/10 text-rose-200",
};

function formatDate(value, options = {}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: options.month || "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startValue, endValue) {
  const minutes = Math.max(0, Math.round((new Date(endValue) - new Date(startValue)) / 60000));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours && remainingMinutes) return `${hours}h ${remainingMinutes}m`;
  if (hours) return `${hours}h`;
  return `${remainingMinutes}m`;
}

export default function MaintenanceScheduleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.get(`/admin/maintenance-schedules/${id}`)
      .then(({ data }) => {
        if (active) setSchedule(data);
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.response?.data?.message || "Could not load this maintenance schedule.");
        }
      });
    return () => { active = false; };
  }, [id]);

  if (error) {
    return (
      <section className="mx-auto w-full max-w-[980px] px-4 py-8 font-[Arial,sans-serif] sm:px-7">
        <div className="rounded-2xl border border-rose-400/20 bg-[#15112f] p-6">
          <p role="alert" className="text-sm text-rose-300">{error}</p>
          <button
            type="button"
            onClick={() => navigate("/admin/maintenance")}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#51456f] px-3 py-2 text-sm text-[#d8d1e8] transition hover:bg-[#231b40]"
            style={{ backgroundColor: "#17112d" }}
          >
            <ArrowBackRoundedIcon sx={{ fontSize: 17 }} /> Back to schedules
          </button>
        </div>
      </section>
    );
  }

  if (!schedule) {
    return (
      <div className="mx-auto flex min-h-64 max-w-[980px] items-center justify-center px-6 font-[Arial,sans-serif] text-sm text-[#a89bd0]" role="status">
        Loading schedule…
      </div>
    );
  }

  const affectedAreas = schedule.affectedAreas || [];
  const notificationPublished = Boolean(schedule.notificationSent);
  const statusClass = STATUS_STYLES[schedule.status] || STATUS_STYLES.UPCOMING;

  return (
    <section className="mx-auto w-full max-w-[980px] px-4 py-5 font-[Arial,sans-serif] text-slate-100 sm:px-7 sm:py-7">
      <button
        type="button"
        onClick={() => navigate("/admin/maintenance")}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-[#342a55] bg-[#15112f] px-3 py-2 text-xs font-medium text-[#c5bdd7] transition hover:border-[#514579] hover:text-white"
      >
        <ArrowBackRoundedIcon sx={{ fontSize: 16 }} /> Maintenance schedules
      </button>

      <header className="relative overflow-hidden rounded-2xl border border-[#342a55] bg-[#15112f] p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
            <BuildRoundedIcon sx={{ fontSize: 24 }} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="break-words text-xl font-bold tracking-tight text-white sm:text-2xl">
                {schedule.title}
              </h1>
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide ${statusClass}`}>
                {schedule.status}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#a89bd0]">
              Maintenance window details and member notification status.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#b8b0cf]">
              <span className="inline-flex items-center gap-1.5">
                <CalendarMonthRoundedIcon sx={{ fontSize: 15, color: "#9b87f5" }} />
                {formatDate(schedule.startsAt, { month: "long" })}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ScheduleRoundedIcon sx={{ fontSize: 15, color: "#9b87f5" }} />
                Duration {formatDuration(schedule.startsAt, schedule.endsAt)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(260px,0.85fr)]">
        <section className="rounded-2xl border border-[#342a55] bg-[#15112f] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <CalendarMonthRoundedIcon sx={{ fontSize: 18, color: "#a995ff" }} />
            <h2 className="text-sm font-bold text-white">Schedule window</h2>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#302650] bg-[#100d26] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#857ba3]">Starts</p>
              <p className="mt-2 text-sm font-semibold text-[#eeeaf7]">
                {formatDate(schedule.startsAt, { month: "long" })}
              </p>
            </div>
            <div className="rounded-xl border border-[#302650] bg-[#100d26] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#857ba3]">Ends</p>
              <p className="mt-2 text-sm font-semibold text-[#eeeaf7]">
                {formatDate(schedule.endsAt, { month: "long" })}
              </p>
            </div>
          </div>

          <div className="mt-5 border-t border-[#302650] pt-4">
            <h3 className="text-xs font-semibold text-[#d8d1e8]">Affected areas</h3>
            {affectedAreas.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {affectedAreas.map((area) => (
                  <span
                    key={area}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#44366f] bg-[#211941] px-3 py-1.5 text-xs font-medium text-[#ddd5f1]"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />
                    {AREA_LABELS[area] || area}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-[#857ba3]">No affected areas specified.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[#342a55] bg-[#15112f] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <NotificationsActiveRoundedIcon sx={{ fontSize: 18, color: "#a995ff" }} />
            <h2 className="text-sm font-bold text-white">Member notification</h2>
          </div>
          <div className={`mt-4 rounded-xl border p-4 ${
            notificationPublished
              ? "border-emerald-400/20 bg-emerald-400/[0.06]"
              : "border-[#302650] bg-[#100d26]"
          }`}>
            <div className="flex items-start gap-3">
              <CheckCircleOutlineRoundedIcon
                sx={{
                  fontSize: 19,
                  color: notificationPublished ? "#6ee7b7" : "#857ba3",
                  mt: "1px",
                }}
              />
              <div>
                <p className="text-xs font-semibold text-[#eeeaf7]">
                  {notificationPublished ? "Published to members" : "Not sent"}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-[#a89bd0]">
                  {notificationPublished
                    ? "This maintenance notice is available in member notifications."
                    : "No notification was published for this schedule."}
                </p>
              </div>
            </div>
            {schedule.notificationId && (
              <p className="mt-3 border-t border-white/[0.06] pt-3 text-[10px] text-[#857ba3]">
                Notification ID <span className="font-semibold text-[#c5bdd7]">#{schedule.notificationId}</span>
              </p>
            )}
          </div>
          <div className="mt-4 rounded-xl border border-[#302650] bg-[#100d26] px-4 py-3">
            <p className="text-[11px] text-[#857ba3]">Reminder</p>
            <p className="mt-1 text-xs font-medium text-[#d8d1e8]">
              {schedule.notifyMembers ? `${schedule.reminderHours} hours before` : "Reminders disabled"}
            </p>
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-2xl border border-[#342a55] bg-[#15112f] p-5 sm:p-6">
        <h2 className="text-sm font-bold text-white">Message to users</h2>
        {schedule.message ? (
          <p className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-[#302650] bg-[#100d26] p-4 text-sm leading-6 text-[#c5bdd7]">
            {schedule.message}
          </p>
        ) : (
          <p className="mt-2 text-xs text-[#857ba3]">No additional message was provided.</p>
        )}
      </section>
    </section>
  );
}
