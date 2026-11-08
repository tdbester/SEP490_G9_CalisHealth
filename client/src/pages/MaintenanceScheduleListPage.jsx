import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import api from "../api/client";
import useUndoDelete from "../hooks/useUndoDelete";
import notificationToast from "../utils/notificationToast";
import { apiErrorMessage } from "../utils/apiError";

const AREA_KEYS = {
  MEMBER_APP_ACCESS: "admin.maintenance.memberApp",
  MEMBER_VIDEO_UPLOADS: "admin.maintenance.videoUploads",
  AI_POSE_ASSESSMENT: "admin.maintenance.aiPose",
  SYSTEM_STORAGE_CDN: "admin.maintenance.storage",
  ADMIN_MANAGEMENT_PORTAL: "admin.maintenance.adminPortal",
};

const STATUS_KEYS = {
  PENDING: "admin.maintenance.statusPending",
  READY: "admin.maintenance.statusReady",
  IN_PROGRESS: "admin.maintenance.statusInProgress",
  COMPLETED: "admin.maintenance.statusCompleted",
  CANCELLED: "admin.maintenance.statusCancelled",
  UPCOMING: "admin.maintenance.statusUpcoming",
  ONGOING: "admin.maintenance.statusOngoing",
};

const STATUS_STYLES = {
  PENDING: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  READY: "border-rose-400/40 bg-rose-500/15 text-rose-200",
  IN_PROGRESS: "border-rose-400/40 bg-rose-500/15 text-rose-200",
  COMPLETED: "border-slate-400/30 bg-slate-400/10 text-slate-300",
  CANCELLED: "border-slate-400/30 bg-slate-400/10 text-slate-400",
  UPCOMING: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  ONGOING: "border-rose-400/40 bg-rose-500/15 text-rose-200",
};

const PAGE_SIZE = 5;

function formatDate(value, locale) {
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

function formatDuration(startValue, endValue) {
  const minutes = Math.max(0, Math.round((new Date(endValue) - new Date(startValue)) / 60000));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours && remainingMinutes) return `${hours}h ${remainingMinutes}m`;
  if (hours) return `${hours}h`;
  return `${remainingMinutes}m`;
}

/** Converts a date input (yyyy-mm-dd) into the API date-time format. */
function toApiDateTime(value, endOfDay = false) {
  if (!value) return null;
  return endOfDay ? `${value}T23:59:59` : `${value}T00:00:00`;
}

/**
 * The date filter matches the day the maintenance starts, so a window that
 * starts at 11pm on the 20th and ends at 2am on the 21st belongs to the 20th.
 */
function toStartDateRange(value) {
  if (!value) return { startsFrom: null, startsBefore: null };
  return {
    startsFrom: toApiDateTime(value),
    startsBefore: toApiDateTime(value, true),
  };
}

export default function MaintenanceScheduleListPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState([]);
  const [locks, setLocks] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchText, setSearchText] = useState("");
  const [titleFilter, setTitleFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [lockBusyArea, setLockBusyArea] = useState(null);
  const { requestDelete, confirmationModal } = useUndoDelete();

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page };
      if (titleFilter.trim()) params.title = titleFilter.trim();
      const { startsFrom, startsBefore } = toStartDateRange(startDate);
      if (startsFrom) params.startsFrom = startsFrom;
      if (startsBefore) params.startsBefore = startsBefore;

      const { data } = await api.get("/admin/maintenance", { params });
      setSchedules(Array.isArray(data.content) ? data.content : []);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);
    } catch (requestError) {
      const message = apiErrorMessage(requestError, "admin.maintenance.loadFailed");
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [page, titleFilter, startDate, t]);

  const loadLocks = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/maintenance/locks");
      setLocks(Array.isArray(data) ? data : []);
    } catch {
      setLocks([]);
    }
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  useEffect(() => {
    loadLocks();
  }, [loadLocks]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (titleFilter.trim()) count += 1;
    if (startDate) count += 1;
    return count;
  }, [titleFilter, startDate]);

  const handleSearch = (event) => {
    event.preventDefault();
    setPage(0);
    setTitleFilter(searchText);
  };

  const clearFilters = () => {
    setSearchText("");
    setTitleFilter("");
    setStartDate("");
    setPage(0);
  };

  const handleStart = async (schedule) => {
    setBusyId(schedule.id);
    try {
      const { data } = await api.patch(`/admin/maintenance/${schedule.id}/start`);
      setSchedules((current) =>
        current.map((item) => (item.id === data.id ? data : item)),
      );
      await loadLocks();
      notificationToast.success(t("admin.maintenance.startSuccess"));
    } catch (requestError) {
      notificationToast.error(
        apiErrorMessage(requestError, "admin.maintenance.startFailed"),
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleComplete = async (schedule) => {
    setBusyId(schedule.id);
    try {
      const { data } = await api.patch(`/admin/maintenance/${schedule.id}/complete`);
      setSchedules((current) =>
        current.map((item) => (item.id === data.id ? data : item)),
      );
      await loadLocks();
      notificationToast.success(t("admin.maintenance.completeSuccess"));
    } catch (requestError) {
      notificationToast.error(
        apiErrorMessage(requestError, "admin.maintenance.completeFailed"),
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleLock = async (lock) => {
    setLockBusyArea(lock.area);
    try {
      await api.patch("/admin/maintenance/locks", {
        area: lock.area,
        locked: lock.locked ? "UNLOCKED" : "LOCKED",
      });
      await loadLocks();
      notificationToast.success(t("admin.maintenance.lockUpdated"));
    } catch (requestError) {
      notificationToast.error(
        apiErrorMessage(requestError, "admin.maintenance.lockUpdateFailed"),
      );
    } finally {
      setLockBusyArea(null);
    }
  };

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
        await loadLocks();
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

      <section className="mb-4 rounded-2xl border border-[#29204d] bg-[#15112f] p-4">
        <form
          onSubmit={handleSearch}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="min-w-0 flex-1">
            <label htmlFor="maintenance-search" className="text-xs font-semibold text-[#e2ddef]">
              {t("admin.maintenance.searchPlaceholder")}
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-[#51456f] bg-[#17112d] px-3">
              <SearchRoundedIcon sx={{ fontSize: 17, color: "#857ba3" }} />
              <input
                id="maintenance-search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder={t("admin.maintenance.searchPlaceholder")}
                className="w-full bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-[#81769d]"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="h-10 rounded-xl bg-[#7c5dfa] px-4 text-sm font-semibold text-white transition hover:bg-[#6c4dce]"
              style={{ backgroundColor: "#7c5dfa", color: "#ffffff" }}
            >
              {t("admin.maintenance.applyFilters")}
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen((current) => !current)}
              className="h-10 rounded-xl border border-[#51456f] px-4 text-sm font-medium text-[#d8d1e8] transition hover:bg-[#231b40]"
              style={{ backgroundColor: "#17112d" }}
            >
              {t("admin.maintenance.filtersTitle")}
              {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>
          </div>
        </form>

        {filtersOpen ? (
          <div className="mt-4 grid gap-3 border-t border-[#29204d] pt-4 sm:grid-cols-2">
            <div>
              <label htmlFor="filter-start-date" className="text-xs font-semibold text-[#e2ddef]">
                {t("admin.maintenance.filterStartDate")}
              </label>
              <input
                id="filter-start-date"
                type="date"
                value={startDate}
                onChange={(event) => { setStartDate(event.target.value); setPage(0); }}
                className="mt-2 w-full rounded-lg border border-[#51456f] bg-[#17112d] px-3 py-2 text-sm text-white outline-none [color-scheme:dark]"
              />
              <p className="mt-1 text-[11px] text-[#857ba3]">{t("admin.maintenance.filterStartDateHint")}</p>
            </div>
            {activeFilterCount > 0 ? (
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="h-9 rounded-lg border border-[#51456f] px-3 text-sm text-[#d8d1e8] transition hover:bg-[#231b40]"
                  style={{ backgroundColor: "#17112d" }}
                >
                  {t("admin.maintenance.clearFilters")}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="mb-4 rounded-2xl border border-[#29204d] bg-[#15112f] p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-sm font-bold text-white">{t("admin.maintenance.lockTitle")}</h2>
          <p className="text-[11px] text-[#a89dbd]">{t("admin.maintenance.lockHint")}</p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {locks.length === 0 ? (
            <p className="text-xs text-[#857ba3] sm:col-span-2 lg:col-span-3">
              {t("admin.maintenance.locksLoadFailed")}
            </p>
          ) : locks.map((lock) => (
            <div
              key={lock.area}
              className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${
                lock.locked
                  ? "border-rose-400/30 bg-rose-500/10"
                  : "border-[#302650] bg-[#100d26]"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-[#eeeaf7]">
                  {t(AREA_KEYS[lock.area] || `admin.maintenance.${lock.area}`, lock.area)}
                </p>
                <p className={`text-[10px] ${lock.locked ? "text-rose-300" : "text-emerald-300"}`}>
                  {lock.locked ? t("admin.maintenance.locked") : t("admin.maintenance.available")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleLock(lock)}
                disabled={lockBusyArea === lock.area}
                className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border px-2 text-[11px] font-semibold transition disabled:opacity-60 ${
                  lock.locked
                    ? "border-rose-400/30 bg-[#23121e] text-rose-200"
                    : "border-emerald-400/30 bg-[#10241d] text-emerald-200"
                }`}
              >
                {lock.locked
                  ? <LockRoundedIcon sx={{ fontSize: 13 }} />
                  : <LockOpenRoundedIcon sx={{ fontSize: 13 }} />}
                {lock.locked
                  ? t("admin.maintenance.unlockAction")
                  : t("admin.maintenance.lockAction")}
              </button>
            </div>
          ))}
        </div>
      </section>

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
            <p className="mt-2 text-sm font-semibold text-white">
              {activeFilterCount > 0 ? t("admin.maintenance.noMatchTitle") : t("admin.maintenance.emptyTitle")}
            </p>
            <p className="mt-1 text-xs text-[#a89bd0]">
              {activeFilterCount > 0 ? t("admin.maintenance.noMatchHint") : t("admin.maintenance.emptyHint")}
            </p>
          </div>
        ) : (
          <div className="space-y-3 p-3 sm:p-4">
            {schedules.map((schedule) => {
              const status = schedule.status || "PENDING";
              const isDue = schedule.dueForExecution === true;
              const isRunning = status === "IN_PROGRESS";
              return (
                <article
                  key={schedule.id}
                  className={`flex flex-col gap-4 rounded-xl border px-4 py-4 transition-colors sm:flex-row sm:items-center sm:px-5 ${
                    isDue || isRunning
                      ? "border-rose-400/50 bg-[#2a1220] shadow-[0_0_0_1px_rgba(244,63,94,0.15)]"
                      : "border-[#342a55] bg-[#100d26] hover:border-[#514579]"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-bold text-white">{schedule.title}</h2>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.PENDING}`}>
                        {t(STATUS_KEYS[status] || "admin.maintenance.statusPending")}
                      </span>
                      {schedule.locked ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
                          <LockRoundedIcon sx={{ fontSize: 11 }} />
                          {t("admin.maintenance.locked")}
                        </span>
                      ) : null}
                    </div>
                    {isDue ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-500/15 px-2.5 py-1 text-[11px] font-bold text-rose-200">
                        {t("admin.maintenance.dueBadge")}
                      </p>
                    ) : null}
                    <p className={`mt-1.5 text-xs ${isDue || isRunning ? "text-[#e6b3c0]" : "text-[#b8b0cf]"}`}>
                      {formatDate(schedule.startsAt, i18n.language)} <span className="px-1 text-[#685e85]">→</span> {formatDate(schedule.endsAt, i18n.language)}
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
                    {isRunning ? (
                      <button
                        type="button"
                        onClick={() => handleComplete(schedule)}
                        disabled={busyId === schedule.id}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-400/30 px-2.5 text-xs text-emerald-200 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                        style={{ backgroundColor: "#10241d" }}
                      >
                        <TaskAltRoundedIcon sx={{ fontSize: 15 }} />
                        {t("admin.maintenance.completeAction")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStart(schedule)}
                        disabled={busyId === schedule.id || status === "CANCELLED" || status === "COMPLETED"}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-400/30 px-2.5 text-xs text-amber-200 transition hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                        style={{ backgroundColor: "#241c0d" }}
                      >
                        <PlayArrowRoundedIcon sx={{ fontSize: 15 }} />
                        {t("admin.maintenance.startAction")}
                      </button>
                    )}
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
