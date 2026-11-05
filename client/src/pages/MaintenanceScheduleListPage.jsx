import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import api from "../api/client";
import useUndoDelete from "../hooks/useUndoDelete";

const AREA_LABELS = {
  MEMBER_APP_ACCESS: "Member App Access",
  MEMBER_VIDEO_UPLOADS: "Member Video Uploads",
  AI_POSE_ASSESSMENT: "AI Pose Assessment",
  SYSTEM_STORAGE_CDN: "System Storage & CDN",
  ADMIN_MANAGEMENT_PORTAL: "Admin Management Portal",
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
        requestError.response?.data?.message || "Could not load maintenance schedules.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timerId);
  }, []);

  const requestCancel = (schedule) => {
    requestDelete({
      confirmationTitle: "Cancel maintenance schedule?",
      confirmationMessage: `“${schedule.title}” will be marked cancelled and members will receive an update if they were notified. You will have 10 seconds to undo.`,
      confirmLabel: "Cancel schedule",
      cancelLabel: "Keep schedule",
      toastMessage: "Schedule cancellation pending.",
      successMessage: "Maintenance schedule cancelled.",
      undoMessage: "Schedule cancellation undone.",
      failureMessage: "Could not cancel the maintenance schedule.",
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
          <h1 className="text-[22px] font-bold tracking-tight text-white">Maintenance schedules</h1>
          <p className="mt-1 text-sm text-[#a89bd0]">
            View and manage planned maintenance windows and member notifications.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/admin/maintenance/create")}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#7c5dfa] px-4 text-sm font-semibold text-white transition hover:bg-[#6c4dce]"
          style={{ backgroundColor: "#7c5dfa", color: "#ffffff" }}
        >
          <AddRoundedIcon sx={{ fontSize: 18 }} />
          Create schedule
        </button>
      </header>

      <div className="overflow-hidden rounded-2xl border border-[#29204d] bg-[#15112f]">
        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-[#a89bd0]" role="status">Loading schedules…</p>
        ) : error ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-rose-300" role="alert">{error}</p>
            <button
              type="button"
              onClick={loadSchedules}
              className="mt-3 rounded-lg border border-[#51456f] px-3 py-1.5 text-sm text-violet-300 hover:text-white"
              style={{ backgroundColor: "#17112d" }}
            >
              Retry
            </button>
          </div>
        ) : schedules.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <BuildRoundedIcon sx={{ fontSize: 30, color: "#857ba3" }} />
            <p className="mt-2 text-sm font-semibold text-white">No maintenance schedules yet</p>
            <p className="mt-1 text-xs text-[#a89bd0]">Create a schedule to plan a maintenance window.</p>
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
                        {status}
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
                          {AREA_LABELS[area] || area}
                        </span>
                      ))}
                      <span className={`ml-1 text-[10px] ${schedule.notificationSent ? "text-emerald-300" : "text-[#857ba3]"}`}>
                        {schedule.notificationSent ? "Notification sent" : "Notification not sent"}
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
                      <VisibilityOutlinedIcon sx={{ fontSize: 15 }} /> View
                    </button>
                    {status !== "CANCELLED" && status !== "COMPLETED" && (
                      <button
                        type="button"
                        onClick={() => requestCancel(schedule)}
                        disabled={schedule.cancellationPending}
                        className="inline-flex h-8 items-center rounded-lg border border-rose-400/30 px-2.5 text-xs text-rose-200 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                        style={{ backgroundColor: "#23121e", color: "#fecdd3" }}
                      >
                        {schedule.cancellationPending ? "Pending…" : "Cancel"}
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
        <nav className="mt-4 flex items-center justify-center gap-2" aria-label="Maintenance schedule pages">
          <button
            type="button"
            aria-label="Previous page"
            disabled={page === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#302650] bg-[#100d26] text-[#c5bdd7] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeftRoundedIcon sx={{ fontSize: 18 }} />
          </button>
          <span className="px-2 text-xs text-[#a89bd0]">
            Page {page + 1} of {totalPages} · {PAGE_SIZE} per page
          </span>
          <button
            type="button"
            aria-label="Next page"
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
          Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalElements)} of {totalElements} schedules
        </p>
      )}

      {confirmationModal}
    </section>
  );
}
