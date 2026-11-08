import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import { useTranslation } from "react-i18next";
import api from "../api/client";
import notificationToast from "../utils/notificationToast";
import { apiErrorMessage } from "../utils/apiError";

const AREA_LABEL_KEYS = {
  MEMBER_APP_ACCESS: "admin.maintenance.detail.areaMemberApp",
  MEMBER_VIDEO_UPLOADS: "admin.maintenance.detail.areaVideoUploads",
  AI_POSE_ASSESSMENT: "admin.maintenance.detail.areaAiPose",
  SYSTEM_STORAGE_CDN: "admin.maintenance.detail.areaStorage",
  ADMIN_MANAGEMENT_PORTAL: "admin.maintenance.detail.areaAdminPortal",
};

const STATUS_STYLES = {
  PENDING: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  READY: "border-rose-400/40 bg-rose-500/15 text-rose-200",
  IN_PROGRESS: "border-rose-400/40 bg-rose-500/15 text-rose-200",
  UPCOMING: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  ONGOING: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  COMPLETED: "border-slate-400/30 bg-slate-400/10 text-slate-300",
  CANCELLED: "border-rose-400/30 bg-rose-400/10 text-rose-200",
};

const STATUS_LABEL_KEYS = {
  PENDING: "admin.maintenance.detail.statusPending",
  READY: "admin.maintenance.detail.statusReady",
  IN_PROGRESS: "admin.maintenance.detail.statusInProgress",
  COMPLETED: "admin.maintenance.detail.statusCompleted",
  CANCELLED: "admin.maintenance.detail.statusCancelled",
  UPCOMING: "admin.maintenance.detail.statusUpcoming",
  ONGOING: "admin.maintenance.detail.statusOngoing",
};

function formatDate(value, locale, options = {}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale || "en-US", {
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
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api.get(`/admin/maintenance-schedules/${id}`)
      .then(({ data }) => {
        if (active) setSchedule(data);
      })
      .catch((requestError) => {
        if (active) {
          setError(apiErrorMessage(requestError, "admin.maintenance.detail.loadFailed"));
        }
      });
    return () => { active = false; };
  }, [id, t]);

  const handleStart = async () => {
    setBusy(true);
    try {
      const { data } = await api.patch(`/admin/maintenance/${id}/start`);
      setSchedule(data);
      notificationToast.success(t("admin.maintenance.startSuccess"));
    } catch (requestError) {
      notificationToast.error(
        apiErrorMessage(requestError, "admin.maintenance.startFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async () => {
    setBusy(true);
    try {
      const { data } = await api.patch(`/admin/maintenance/${id}/complete`);
      setSchedule(data);
      notificationToast.success(t("admin.maintenance.completeSuccess"));
    } catch (requestError) {
      notificationToast.error(
        apiErrorMessage(requestError, "admin.maintenance.completeFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

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
            <ArrowBackRoundedIcon sx={{ fontSize: 17 }} /> {t("admin.maintenance.detail.backToSchedules")}
          </button>
        </div>
      </section>
    );
  }

  if (!schedule) {
    return (
      <div className="mx-auto flex min-h-64 max-w-[980px] items-center justify-center px-6 font-[Arial,sans-serif] text-sm text-[#a89bd0]" role="status">
        {t("admin.maintenance.detail.loading")}
      </div>
    );
  }

  const affectedAreas = schedule.affectedAreas || [];
  const notificationPublished = Boolean(schedule.notificationSent);
  const statusClass = STATUS_STYLES[schedule.status] || STATUS_STYLES.PENDING;
  const statusLabel = STATUS_LABEL_KEYS[schedule.status]
    ? t(STATUS_LABEL_KEYS[schedule.status])
    : schedule.status;
  const isRunning = schedule.status === "IN_PROGRESS";
  const canAct = schedule.status !== "CANCELLED" && schedule.status !== "COMPLETED";

  return (
    <section className="mx-auto w-full max-w-[980px] px-4 py-5 font-[Arial,sans-serif] text-slate-100 sm:px-7 sm:py-7">
      <button
        type="button"
        onClick={() => navigate("/admin/maintenance")}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-[#342a55] bg-[#15112f] px-3 py-2 text-xs font-medium text-[#c5bdd7] transition hover:border-[#514579] hover:text-white"
      >
        <ArrowBackRoundedIcon sx={{ fontSize: 16 }} /> {t("admin.maintenance.detail.backLabel")}
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
                {statusLabel}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#a89bd0]">
              {t("admin.maintenance.detail.headerDescription")}
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#b8b0cf]">
              <span className="inline-flex items-center gap-1.5">
                <CalendarMonthRoundedIcon sx={{ fontSize: 15, color: "#9b87f5" }} />
                {formatDate(schedule.startsAt, i18n.language, { month: "long" })}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ScheduleRoundedIcon sx={{ fontSize: 15, color: "#9b87f5" }} />
                {t("admin.maintenance.detail.duration", { duration: formatDuration(schedule.startsAt, schedule.endsAt) })}
              </span>
            </div>
            {schedule.dueForExecution ? (
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-xs font-bold text-rose-200">
                {t("admin.maintenance.dueBadge")}
              </p>
            ) : null}
            {canAct ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {isRunning ? (
                  <button
                    type="button"
                    onClick={handleComplete}
                    disabled={busy}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-400/30 px-3.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/10 disabled:opacity-60"
                    style={{ backgroundColor: "#10241d" }}
                  >
                    <TaskAltRoundedIcon sx={{ fontSize: 15 }} />
                    {t("admin.maintenance.completeAction")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStart}
                    disabled={busy}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-400/30 px-3.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/10 disabled:opacity-60"
                    style={{ backgroundColor: "#241c0d" }}
                  >
                    <PlayArrowRoundedIcon sx={{ fontSize: 15 }} />
                    {t("admin.maintenance.startAction")}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(260px,0.85fr)]">
        <section className="rounded-2xl border border-[#342a55] bg-[#15112f] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <CalendarMonthRoundedIcon sx={{ fontSize: 18, color: "#a995ff" }} />
            <h2 className="text-sm font-bold text-white">{t("admin.maintenance.detail.scheduleWindow")}</h2>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#302650] bg-[#100d26] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#857ba3]">{t("admin.maintenance.detail.starts")}</p>
              <p className="mt-2 text-sm font-semibold text-[#eeeaf7]">
                {formatDate(schedule.startsAt, i18n.language, { month: "long" })}
              </p>
            </div>
            <div className="rounded-xl border border-[#302650] bg-[#100d26] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#857ba3]">{t("admin.maintenance.detail.ends")}</p>
              <p className="mt-2 text-sm font-semibold text-[#eeeaf7]">
                {formatDate(schedule.endsAt, i18n.language, { month: "long" })}
              </p>
            </div>
          </div>

          <div className="mt-5 border-t border-[#302650] pt-4">
            <h3 className="text-xs font-semibold text-[#d8d1e8]">{t("admin.maintenance.detail.affectedAreas")}</h3>
            {affectedAreas.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {affectedAreas.map((area) => (
                  <span
                    key={area}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#44366f] bg-[#211941] px-3 py-1.5 text-xs font-medium text-[#ddd5f1]"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />
                    {AREA_LABEL_KEYS[area] ? t(AREA_LABEL_KEYS[area]) : area}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-[#857ba3]">{t("admin.maintenance.detail.noAffectedAreas")}</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[#342a55] bg-[#15112f] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <NotificationsActiveRoundedIcon sx={{ fontSize: 18, color: "#a995ff" }} />
            <h2 className="text-sm font-bold text-white">{t("admin.maintenance.detail.memberNotification")}</h2>
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
                  {notificationPublished ? t("admin.maintenance.detail.publishedToMembers") : t("admin.maintenance.detail.notSent")}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-[#a89bd0]">
                  {notificationPublished
                    ? t("admin.maintenance.detail.publishedHint")
                    : t("admin.maintenance.detail.notSentHint")}
                </p>
              </div>
            </div>
            {schedule.notificationId && (
              <p className="mt-3 border-t border-white/[0.06] pt-3 text-[10px] text-[#857ba3]">
                {t("admin.maintenance.detail.notificationId")} <span className="font-semibold text-[#c5bdd7]">#{schedule.notificationId}</span>
              </p>
            )}
          </div>
          <div className="mt-4 rounded-xl border border-[#302650] bg-[#100d26] px-4 py-3">
            <p className="text-[11px] text-[#857ba3]">{t("admin.maintenance.detail.reminder")}</p>
            <p className="mt-1 text-xs font-medium text-[#d8d1e8]">
              {schedule.notifyMembers
                ? t("admin.maintenance.detail.hoursBefore", { hours: schedule.reminderHours })
                : t("admin.maintenance.detail.remindersDisabled")}
            </p>
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-2xl border border-[#342a55] bg-[#15112f] p-5 sm:p-6">
        <h2 className="text-sm font-bold text-white">{t("admin.maintenance.detail.messageToUsers")}</h2>
        {schedule.message ? (
          <p className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-[#302650] bg-[#100d26] p-4 text-sm leading-6 text-[#c5bdd7]">
            {schedule.message}
          </p>
        ) : (
          <p className="mt-2 text-xs text-[#857ba3]">{t("admin.maintenance.detail.noMessage")}</p>
        )}
      </section>
    </section>
  );
}
