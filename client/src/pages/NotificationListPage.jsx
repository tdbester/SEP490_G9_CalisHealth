import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import api from "../api/client";
import useUndoDelete from "../hooks/useUndoDelete";
import NotificationDetailModal from "../components/notifications/NotificationDetailModal";
import "../styles/notification.css";

const FILTERS = [
  { key: "ALL", labelKey: "admin.notifications.filterAll", count: "allCount" },
  { key: "MAINTENANCE", labelKey: "admin.notifications.filterMaintenance", count: "maintenanceCount" },
  { key: "ANNOUNCEMENT", labelKey: "admin.notifications.filterAnnouncement", count: "announcementCount" },
  { key: "UPDATE", labelKey: "admin.notifications.filterUpdate", count: "updateCount" },
];

const TYPE_STYLES = {
  MAINTENANCE: "border-amber-500/30 bg-amber-500/10 text-[#D97706]",
  ANNOUNCEMENT: "border-cyan-500/30 bg-cyan-500/10 text-[#06B6D4]",
  UPDATE: "border-violet-500/30 bg-violet-500/10 text-[#8B5CF6]",
  SYSTEM: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
};
const AUDIENCE_STYLES = {
  MEMBER: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  ALL_MEMBERS: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  CONTENT_MANAGER: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  SYSTEM_WIDE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  ALL_USERS: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  GLOBAL: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  SPECIFIC_USER: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};
const PAGE_SIZE = 5;

function PaginationBar({ currentPage, totalPages, onPageChange }) {
  const { t } = useTranslation();
  const firstPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const visiblePages = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => firstPage + index,
  );

  if (totalPages <= 1) return null;

  return (
    <nav className="mt-4 flex items-center justify-center gap-2" aria-label={t("admin.notifications.pagesAria")}>
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded-md border border-[#22184c] bg-[#130d2e] text-[#8a82af] transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        aria-label={t("admin.notifications.previousPage")}
      >
        <ChevronLeftRoundedIcon sx={{ fontSize: 16 }} />
      </button>
      {visiblePages.map((page) => (
        <button
          key={page}
          type="button"
          aria-current={currentPage === page ? "page" : undefined}
          className={`h-7 w-7 rounded-md text-xs transition ${
            currentPage === page
              ? "bg-[#6340f1] font-bold text-white shadow-sm"
              : "border border-[#22184c] bg-[#130d2e] text-[#8a82af] hover:border-[#382672] hover:text-white"
          }`}
          onClick={() => onPageChange(page)}
        >
          {page}
        </button>
      ))}
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded-md border border-[#22184c] bg-[#130d2e] text-[#8a82af] transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        aria-label={t("admin.notifications.nextPage")}
      >
        <ChevronRightRoundedIcon sx={{ fontSize: 16 }} />
      </button>
    </nav>
  );
}

function formatCreatedAt(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getNotificationAudience(notification) {
  const value = notification.targetAudience ?? notification.target_audience ?? notification.audience;
  return typeof value === "string" && value.trim()
    ? value.trim().toUpperCase()
    : notification.userId
      ? "SPECIFIC_USER"
      : "ALL_MEMBERS";
}

export default function NotificationListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeType, setActiveType] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [notifications, setNotifications] = useState([]);
  const [counts, setCounts] = useState({
    allCount: 0,
    maintenanceCount: 0,
    announcementCount: 0,
    updateCount: 0,
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { requestDelete, confirmationModal } = useUndoDelete();

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/notifications", {
        params: { type: activeType },
      });
      setNotifications(data.notifications || []);
      setCounts(data.counts || {
        allCount: 0,
        maintenanceCount: 0,
        announcementCount: 0,
        updateCount: 0,
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          t("admin.notifications.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [activeType, t]);

  useEffect(() => {
    setSelectedIds([]);
    setCurrentPage(1);
    loadNotifications();
  }, [loadNotifications]);

  const totalPages = Math.max(1, Math.ceil(notifications.length / PAGE_SIZE));
  const pageToDisplay = Math.min(currentPage, totalPages);
  const visibleNotifications = notifications.slice(
    (pageToDisplay - 1) * PAGE_SIZE,
    pageToDisplay * PAGE_SIZE,
  );
  const allVisibleSelected =
    visibleNotifications.length > 0 &&
    visibleNotifications.every((notification) => selectedIds.includes(notification.id));

  const toggleAll = () => {
    const visibleIds = visibleNotifications.map((notification) => notification.id);
    setSelectedIds((current) => {
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => current.includes(id));
      return allSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : [...new Set([...current, ...visibleIds])];
    });
  };

  const toggleOne = (id) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id],
    );
  };

  const confirmDeleteSelected = () => {
    const idsToDelete = [...selectedIds];
    if (idsToDelete.length === 0) return;
    requestDelete({
      toastOptions: {
        className: "notification-toast",
        style: { fontFamily: "Arial, sans-serif" },
      },
      toastMessage: idsToDelete.length === 1
        ? t("admin.notifications.deletedOne")
        : t("admin.notifications.deletedMany", { count: idsToDelete.length }),
      successMessage: idsToDelete.length === 1
        ? t("admin.notifications.permanentlyDeletedOne")
        : t("admin.notifications.permanentlyDeletedMany"),
      onOptimisticDelete: () => {
        const removed = notifications.filter((item) => idsToDelete.includes(item.id));
        setNotifications((current) => current.filter((item) => !idsToDelete.includes(item.id)));
        setCounts((current) => {
          const next = { ...current };
          for (const item of removed) {
            next.allCount = Math.max(0, next.allCount - 1);
            const countKey = `${item.type.toLowerCase()}Count`;
            if (countKey in next) next[countKey] = Math.max(0, next[countKey] - 1);
          }
          return next;
        });
        setSelectedIds([]);
      },
      onUndo: () => {
        void loadNotifications();
      },
      onDelete: async () => {
        await api.delete("/admin/notifications/batch", {
          data: { ids: idsToDelete },
        });
        await loadNotifications();
      },
    });
  };

  return (
    <section className="notification-module mx-auto w-full max-w-[1440px] text-slate-100">
      <header className="mb-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[22px] font-bold tracking-tight text-white">{t("admin.notifications.title")}</h1>
          <button
            type="button"
            onClick={() => navigate("/admin/notifications/new")}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-violet-400/40 bg-violet-600 px-4 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(124,58,237,0.28)] transition hover:bg-violet-500"
          >
            <AddRoundedIcon fontSize="small" />
            {t("admin.notifications.create")}
          </button>
        </div>
        <p className="mt-2 max-w-3xl text-xs leading-5 text-[#a89bd0]">
          {t("admin.notifications.headerDescription")}
        </p>
      </header>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-[#35275e] bg-[#21183c] p-1"
          role="tablist"
          aria-label={t("admin.notifications.filterAria")}
        >
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              role="tab"
              aria-selected={activeType === filter.key}
              onClick={() => setActiveType(filter.key)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                activeType === filter.key
                  ? "border border-violet-500/60 bg-[#30215f] font-semibold text-white"
                  : "bg-transparent font-medium text-[#a89bd0] hover:text-white"
              }`}
            >
              {t(filter.labelKey)}
              <span className="ml-1.5 text-[11px] opacity-80">{counts[filter.count]}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={selectedIds.length === 0}
          onClick={confirmDeleteSelected}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#463b61] bg-[#17112d] px-3 text-xs font-medium text-[#d3cce4] transition hover:border-rose-400/50 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <DeleteOutlineRoundedIcon fontSize="small" />
          {t("admin.notifications.deleteSelected")}
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-[#35275e] bg-[#21183c]">
        <table className="w-full min-w-[1020px] border-collapse text-left">
          <thead className="bg-[#1a1430] text-xs font-semibold uppercase tracking-wider text-[#a89bd0]">
            <tr>
              <th className="w-11 px-4 py-3">
                <label className="relative inline-flex h-4 w-4 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    aria-label={t("admin.notifications.selectAll")}
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    disabled={loading || visibleNotifications.length === 0}
                    className="block h-[18px] w-[18px] shrink-0 cursor-pointer appearance-none rounded-[4px] border-2 border-[#c4b5fd] bg-[#17112d] shadow-[0_0_0_1px_rgba(167,139,250,0.2)] transition checked:border-violet-400 checked:bg-violet-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  {allVisibleSelected && (
                    <svg className="pointer-events-none absolute h-3 w-3 text-white" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="m3.5 8 3 3 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </label>
              </th>
              <th className="px-3 py-3">{t("admin.notifications.colNotification")}</th>
              <th className="w-36 px-3 py-3 text-center">{t("admin.notifications.colType")}</th>
              <th className="w-40 px-3 py-3 text-center">{t("admin.notifications.colAudience")}</th>
              <th className="w-32 px-3 py-3 text-center">{t("admin.notifications.colStatus")}</th>
              <th className="w-32 px-3 py-3">{t("admin.notifications.colCreated")}</th>
              <th className="w-24 px-3 py-3 text-right">{t("admin.notifications.colActions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#35275e]">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-[#aaa0c5]">
                  {t("admin.notifications.loading")}
                </td>
              </tr>
            ) : visibleNotifications.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-[#aaa0c5]">
                  {t("admin.notifications.empty")}
                </td>
              </tr>
            ) : (
              visibleNotifications.map((notification) => {
                const normalizedType = String(notification.type || "").toUpperCase();
                const audience = getNotificationAudience(notification);
                const isPublished = String(notification.status || "").toUpperCase() === "PUBLISHED";
                return (
                  <tr key={notification.id} className="transition hover:bg-white/[0.025]">
                    <td className="px-4 py-3.5 align-middle">
                      <label className="relative inline-flex h-4 w-4 cursor-pointer items-center justify-center">
                        <input
                          type="checkbox"
                          aria-label={t("admin.notifications.selectOne", { title: notification.title })}
                          checked={selectedIds.includes(notification.id)}
                          onChange={() => toggleOne(notification.id)}
                          className="block h-[18px] w-[18px] shrink-0 cursor-pointer appearance-none rounded-[4px] border-2 border-[#c4b5fd] bg-[#17112d] shadow-[0_0_0_1px_rgba(167,139,250,0.2)] transition checked:border-violet-400 checked:bg-violet-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
                        />
                        {selectedIds.includes(notification.id) && (
                          <svg className="pointer-events-none absolute h-3 w-3 text-white" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="m3.5 8 3 3 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </label>
                    </td>
                    <td className="max-w-0 px-3 py-3.5">
                      <p className="mb-0.5 truncate text-base font-semibold text-white" title={notification.title}>
                        {notification.title}
                      </p>
                      <p className="line-clamp-1 text-sm text-slate-400" title={notification.message}>
                        {notification.message}
                      </p>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                        TYPE_STYLES[normalizedType] || "border-slate-500/30 bg-slate-500/10 text-slate-300"
                      }`}>
                        {t(`admin.notifications.type${normalizedType.charAt(0) + normalizedType.slice(1).toLowerCase()}`, normalizedType)}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                        AUDIENCE_STYLES[audience] || "border-slate-500/30 bg-slate-500/10 text-slate-300"
                      }`}>
                        {audience === "CONTENT_MANAGER"
                          ? t("admin.notifications.audienceContentManager")
                          : audience === "SYSTEM_WIDE" || audience === "ALL_USERS" || audience === "GLOBAL"
                            ? t("admin.notifications.audienceSystem")
                            : audience === "MEMBER" || audience === "ALL_MEMBERS"
                              ? t("admin.notifications.audienceMembers")
                              : audience === "SPECIFIC_USER"
                                ? t("admin.notifications.audienceDirect")
                                : audience}
                        {audience === "SPECIFIC_USER" && notification.userId ? ` #${notification.userId}` : ""}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                        isPublished
                          ? "border-emerald-500/40 bg-emerald-500/10 text-[#10B981]"
                          : "border-slate-500/40 bg-slate-500/10 text-[#9CA3AF]"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${isPublished ? "bg-[#10B981]" : "bg-[#9CA3AF]"}`} />
                        {isPublished ? t("admin.notifications.published") : t("admin.notifications.draft")}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-xs text-[#d2ccdf]">
                      {formatCreatedAt(notification.createdAt)}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedNotification(notification)}
                        aria-label={t("admin.notifications.viewAria", { title: notification.title })}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-[#1e202e] px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:bg-[#282a3d]"
                      >
                        <VisibilityOutlinedIcon sx={{ fontSize: 15 }} />
                        {t("admin.notifications.view")}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <PaginationBar
        currentPage={pageToDisplay}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      <footer className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#aaa0c5]">
        <span>
          {t("admin.notifications.showingOf", {
            range: loading ? "…" : notifications.length === 0
              ? 0
              : `${(pageToDisplay - 1) * PAGE_SIZE + 1}–${Math.min(pageToDisplay * PAGE_SIZE, notifications.length)}`,
            total: counts.allCount,
          })}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[#c5b88a]">
          <WarningAmberRoundedIcon sx={{ fontSize: 14 }} />
          {t("admin.notifications.deletedHint")}
        </span>
      </footer>

      {confirmationModal}
      <NotificationDetailModal
        notification={selectedNotification}
        onClose={() => setSelectedNotification(null)}
      />
    </section>
  );
}
