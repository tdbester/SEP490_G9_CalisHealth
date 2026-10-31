import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import api from "../api/client";

const FILTERS = [
  { key: "ALL", label: "All", count: "allCount" },
  { key: "MAINTENANCE", label: "Maintenance", count: "maintenanceCount" },
  { key: "ANNOUNCEMENT", label: "Announcement", count: "announcementCount" },
  { key: "UPDATE", label: "Update", count: "updateCount" },
];

const TYPE_STYLES = {
  MAINTENANCE: "border-amber-500/30 bg-amber-500/10 text-[#D97706]",
  ANNOUNCEMENT: "border-cyan-500/30 bg-cyan-500/10 text-[#06B6D4]",
  UPDATE: "border-violet-500/30 bg-violet-500/10 text-[#8B5CF6]",
};

function formatCreatedAt(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function NotificationListPage() {
  const navigate = useNavigate();
  const [activeType, setActiveType] = useState("ALL");
  const [notifications, setNotifications] = useState([]);
  const [counts, setCounts] = useState({
    allCount: 0,
    maintenanceCount: 0,
    announcementCount: 0,
    updateCount: 0,
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

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
          "Could not load notifications. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeType]);

  useEffect(() => {
    setSelectedIds([]);
    loadNotifications();
  }, [loadNotifications]);

  const allVisibleSelected =
    notifications.length > 0 &&
    notifications.every((notification) => selectedIds.includes(notification.id));

  const toggleAll = () => {
    setSelectedIds(allVisibleSelected ? [] : notifications.map((notification) => notification.id));
  };

  const toggleOne = (id) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id],
    );
  };

  const deleteSelected = async () => {
    setDeleting(true);
    setError("");
    try {
      await api.delete("/admin/notifications/batch", {
        data: { ids: selectedIds },
      });
      setSelectedIds([]);
      setConfirmDelete(false);
      await loadNotifications();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not delete the selected notifications. Please try again.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-[1440px] text-slate-100">
      <header className="mb-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[22px] font-bold tracking-tight text-white">Notifications</h1>
          <button
            type="button"
            onClick={() => navigate("/admin/notifications/new")}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-violet-400/40 bg-violet-600 px-4 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(124,58,237,0.28)] transition hover:bg-violet-500"
          >
            <AddRoundedIcon fontSize="small" />
            Create notification
          </button>
        </div>
        <p className="mt-2 max-w-3xl text-xs leading-5 text-[#a89bd0]">
          Notifications shown to members in the web notification bell. Maintenance schedules
          add their notification here automatically.
        </p>
      </header>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-[#35275e] bg-[#21183c] p-1"
          role="tablist"
          aria-label="Filter notifications by type"
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
              {filter.label}
              <span className="ml-1.5 text-[11px] opacity-80">{counts[filter.count]}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={selectedIds.length === 0 || deleting}
          onClick={() => setConfirmDelete(true)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#463b61] bg-[#17112d] px-3 text-xs font-medium text-[#d3cce4] transition hover:border-rose-400/50 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <DeleteOutlineRoundedIcon fontSize="small" />
          Delete selected
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-[#35275e] bg-[#21183c]">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead className="bg-[#1a1430] text-xs font-semibold uppercase tracking-wider text-[#a89bd0]">
            <tr>
              <th className="w-11 px-4 py-3">
                <label className="relative inline-flex h-4 w-4 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    aria-label="Select all notifications"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    disabled={loading || notifications.length === 0}
                    className="block h-[18px] w-[18px] shrink-0 cursor-pointer appearance-none rounded-[4px] border-2 border-[#c4b5fd] bg-[#17112d] shadow-[0_0_0_1px_rgba(167,139,250,0.2)] transition checked:border-violet-400 checked:bg-violet-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  {allVisibleSelected && (
                    <svg className="pointer-events-none absolute h-3 w-3 text-white" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="m3.5 8 3 3 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </label>
              </th>
              <th className="px-3 py-3">Notification</th>
              <th className="w-36 px-3 py-3 text-center">Type</th>
              <th className="w-32 px-3 py-3 text-center">Status</th>
              <th className="w-32 px-3 py-3">Created</th>
              <th className="w-24 px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#35275e]">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-[#aaa0c5]">
                  Loading notifications…
                </td>
              </tr>
            ) : notifications.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-[#aaa0c5]">
                  No notifications found.
                </td>
              </tr>
            ) : (
              notifications.map((notification) => {
                const normalizedType = String(notification.type || "").toUpperCase();
                const isPublished = String(notification.status || "").toUpperCase() === "PUBLISHED";
                return (
                  <tr key={notification.id} className="transition hover:bg-white/[0.025]">
                    <td className="px-4 py-3.5 align-middle">
                      <label className="relative inline-flex h-4 w-4 cursor-pointer items-center justify-center">
                        <input
                          type="checkbox"
                          aria-label={`Select ${notification.title}`}
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
                        {normalizedType.charAt(0) + normalizedType.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                        isPublished
                          ? "border-emerald-500/40 bg-emerald-500/10 text-[#10B981]"
                          : "border-slate-500/40 bg-slate-500/10 text-[#9CA3AF]"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${isPublished ? "bg-[#10B981]" : "bg-[#9CA3AF]"}`} />
                        {isPublished ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-xs text-[#d2ccdf]">
                      {formatCreatedAt(notification.createdAt)}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/notifications/${notification.id}`)}
                        aria-label={`Edit ${notification.title}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-[#1e202e] px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:bg-[#282a3d]"
                      >
                        <EditOutlinedIcon sx={{ fontSize: 15 }} />
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <footer className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#aaa0c5]">
        <span>
          Showing {loading ? "…" : notifications.length} of {counts.allCount} notifications
        </span>
        <span className="inline-flex items-center gap-1.5 text-[#c5b88a]">
          <WarningAmberRoundedIcon sx={{ fontSize: 14 }} />
          Deleted notifications disappear from every member’s notification bell.
        </span>
      </footer>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/70 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) setConfirmDelete(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-notifications-title"
            className="w-full max-w-md rounded-2xl border border-[#463b61] bg-[#17112d] p-6 shadow-2xl"
          >
            <h2 id="delete-notifications-title" className="text-lg font-bold text-white">
              Delete selected notifications?
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#b8afd0]">
              {selectedIds.length} notification{selectedIds.length === 1 ? "" : "s"} will be removed
              from every member’s notification bell. This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-[#51456f] px-4 py-2 text-sm text-[#d2ccdf] hover:bg-white/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={deleteSelected}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export function NotificationEditorPlaceholder() {
  const navigate = useNavigate();
  const { notificationId } = useParams();

  return (
    <section className="mx-auto w-full max-w-3xl rounded-2xl border border-[#382d5c] bg-[#17112d] p-7 text-slate-100">
      <h1 className="text-xl font-bold text-white">
        {notificationId ? "Edit notification" : "Create notification"}
      </h1>
      <p className="mt-2 text-sm text-[#b8afd0]">
        Notification editor will be available in the next screen.
      </p>
      <button
        type="button"
        onClick={() => navigate("/admin/notifications")}
        className="mt-5 rounded-lg border border-[#51456f] px-4 py-2 text-sm text-[#e1d9f4] hover:bg-white/5"
      >
        Back to notifications
      </button>
    </section>
  );
}
