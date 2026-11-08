import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import api from "../api/client";
import useUndoDelete from "../hooks/useUndoDelete";

const AREA_KEYS = {
  MEMBER_APP_ACCESS: "admin.maintenance.memberApp",
  MEMBER_VIDEO_UPLOADS: "admin.maintenance.videoUploads",
  AI_POSE_ASSESSMENT: "admin.maintenance.aiPose",
  SYSTEM_STORAGE_CDN: "admin.maintenance.storage",
  ADMIN_MANAGEMENT_PORTAL: "admin.maintenance.adminPortal",
};

const STATUS_KEYS = {
  UPCOMING: "admin.maintenance.statusUpcoming",
  ONGOING: "admin.maintenance.statusOngoing",
  COMPLETED: "admin.maintenance.statusCompleted",
  CANCELLED: "admin.maintenance.statusCancelled",
};

const STATUS_STYLES = {
  UPCOMING: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  ONGOING: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  COMPLETED: "border-slate-400/30 bg-slate-400/10 text-slate-300",
  CANCELLED: "border-rose-400/30 bg-rose-400/10 text-rose-200",
};
const PAGE_SIZE = 5;

function formatDate(value) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatus(schedule, now) {
  if (schedule.status === "CANCELLED") return "CANCELLED";
  const start = new Date(schedule.startsAt);
  const end = new Date(schedule.endsAt);
  if (now < start) return "UPCOMING";
  if (now <= end) return "ONGOING";
  return "COMPLETED";
}

function formatDuration(startValue, endValue) {
  const minutes = Math.max(0, Math.round((new Date(endValue) - new Date(startValue)) / 60000));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours && remainingMinutes) return `${hours} h ${remainingMinutes} min`;
  if (hours) return `${hours} h`;
  return `${remainingMinutes} min`;
}

export default function MaintenanceScheduleListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { requestDelete, confirmationModal } = useUndoDelete();

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/maintenance", { params: { page } });
      setSchedules(Array.isArray(data.content) ? data.content : []);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);
    } catch (requestError) {
      const message =
        requestError.response?.data?.message || t("admin.maintenance.loadFailed");
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [page, t]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timerId);
  }, []);

  const requestCancel = (schedule) => {
    requestDelete({
      confirmationTitle: t("admin.maintenance.cancelConfirmTitle"),
      confirmationMessage: t("admin.maintenance.cancelConfirmMessage", { title: schedule.title }),
      confirmLabel: t("admin.maintenance.cancel"),
      cancelLabel: t("admin.maintenance.keepSchedule"),
      toastMessage: t("admin.maintenance.cancelPending"),
      successMessage: t("admin.maintenance.cancelled_ok"),
      undoMessage: t("admin.maintenance.cancelUndone"),
      failureMessage: t("admin.maintenance.cancelFailed"),
      toastOptions: {
        className: "notification-toast",
        style: { fontFamily: "Arial, sans-serif" },
      },
      onOptimisticDelete: () => {
        setSchedules((current) =>
          current.map((item) => item.id === schedule.id
            ? { ...item, cancellationPending: true }
            : item),
        );
      },
      onUndo: () => {
        void loadSchedules();
      },
      onDelete: async () => {
        const { data } = await api.patch(`/admin/maintenance/${schedule.id}/cancel`);
        setSchedules((current) =>
          current.map((item) => item.id === data.id ? data : item),
        );
        if (data.notifyMembers) {
          window.dispatchEvent(new Event("member-notifications-updated"));
        }
      },
    });
  };

  return (
    <section className="mx-auto w-full max-w-[1080px] px-4 py-5 font-[Arial,sans-serif] text-slate-100 sm:px-7 sm:py-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-white">{t("admin.maintenance.title")}</h1>
          <p className="mt-1 text-sm text-[#a89bd0]">
            {t("admin.maintenance.headerDescription")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/admin/maintenance/create")}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#7c5dfa] px-4 text-sm font-semibold text-white transition hover:bg-[#6c4dce]"
          style={{ backgroundColor: "#7c5dfa", color: "#ffffff" }}
        >
          <AddRoundedIcon sx={{ fontSize: 18 }} />
          {t("admin.maintenance.create")}
        </button>
      </header>

      <div className="overflow-hidden rounded-2xl border border-[#29204d] bg-[#15112f]">
        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-[#a89bd0]" role="status">{t("admin.maintenance.loading")}</p>
        ) : error ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-rose-300" role="alert">{error}</p>
            <button
              type="button"
              onClick={loadSchedules}
              className="mt-3 rounded-lg border border-[#51456f] px-3 py-1.5 text-sm text-violet-300 hover:text-white"
              style={{ backgroundColor: "#17112d" }}
            >
              {t("admin.maintenance.retry")}
            </button>
          </div>
        ) : schedules.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <BuildRoundedIcon sx={{ fontSize: 30, color: "#857ba3" }} />
            <p className="mt-2 text-sm font-semibold text-white">{t("admin.maintenance.emptyTitle")}</p>
            <p className="mt-1 text-xs text-[#a89bd0]">{t("admin.maintenance.emptyHint")}</p>
          </div>
        ) : (
          <div className="space-y-3 p-3 sm:p-4">
            {schedules.map((schedule) => {
              const status = getStatus(schedule, now);
              return (
                <article
                  key={schedule.id}
                  className="flex flex-col gap-4 rounded-xl border border-[#342a55] bg-[#100d26] px-4 py-4 transition-colors hover:border-[#514579] sm:flex-row sm:items-center sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-bold text-white">{schedule.title}</h2>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.UPCOMING}`}>
                        {t(STATUS_KEYS[status])}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-[#b8b0cf]">
                      {formatDate(schedule.startsAt)} <span className="px-1 text-[#685e85]">→</span> {formatDate(schedule.endsAt)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-[10px] text-[#c5bdd7]">
                        {formatDuration(schedule.startsAt, schedule.endsAt)}
                      </span>
                      {schedule.affectedAreas?.map((area) => (
                        <span key={area} className="rounded-md border border-[#302650] bg-[#100d26] px-2 py-0.5 text-[10px] text-[#c5bdd7]">
                          {t(AREA_KEYS[area] || `admin.maintenance.${area}`, area)}
                        </span>
                      ))}
                      <span className={`ml-1 text-[10px] ${schedule.notificationSent ? "text-emerald-300" : "text-[#857ba3]"}`}>
                        {schedule.notificationSent ? t("admin.maintenance.notificationSent") : t("admin.maintenance.notificationNotSent")}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/maintenance/${schedule.id}`)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#51456f] px-2.5 text-xs text-[#d8d1e8] transition hover:bg-[#231b40]"
                      style={{ backgroundColor: "#17112d", color: "#d8d1e8" }}
                    >
                      <VisibilityOutlinedIcon sx={{ fontSize: 15 }} /> {t("admin.maintenance.viewAction")}
                    </button>
                    {status !== "CANCELLED" && status !== "COMPLETED" && (
                      <button
                        type="button"
                        onClick={() => requestCancel(schedule)}
                        disabled={schedule.cancellationPending}
                        className="inline-flex h-8 items-center rounded-lg border border-rose-400/30 px-2.5 text-xs text-rose-200 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                        style={{ backgroundColor: "#23121e", color: "#fecdd3" }}
                      >
                        {schedule.cancellationPending ? t("admin.maintenance.pending") : t("admin.maintenance.cancelAction")}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {!loading && !error && totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-2" aria-label={t("admin.maintenance.pagesAria")}>
          <button
            type="button"
            aria-label={t("admin.maintenance.previousPage")}
            disabled={page === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#302650] bg-[#100d26] text-[#c5bdd7] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeftRoundedIcon sx={{ fontSize: 18 }} />
          </button>
          <span className="px-2 text-xs text-[#a89bd0]">
            {t("admin.maintenance.pageOf", { page: page + 1, total: totalPages, size: PAGE_SIZE })}
          </span>
          <button
            type="button"
            aria-label={t("admin.maintenance.nextPage")}
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#302650] bg-[#100d26] text-[#c5bdd7] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRightRoundedIcon sx={{ fontSize: 18 }} />
          </button>
        </nav>
      )}
      {!loading && !error && totalElements > 0 && (
        <p className="mt-2 text-center text-[11px] text-[#857ba3]">
          {t("admin.maintenance.showingOf", {
            from: page * PAGE_SIZE + 1,
            to: Math.min((page + 1) * PAGE_SIZE, totalElements),
            total: totalElements,
          })}
        </p>
      )}

      {confirmationModal}
    </section>
  );
}
