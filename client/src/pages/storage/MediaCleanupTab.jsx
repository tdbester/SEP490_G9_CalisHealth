import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  MenuItem,
  Pagination,
  Skeleton,
  Snackbar,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import AutoDeleteOutlinedIcon from "@mui/icons-material/AutoDeleteOutlined";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DeleteForeverOutlinedIcon from "@mui/icons-material/DeleteForeverOutlined";
import RestoreFromTrashOutlinedIcon from "@mui/icons-material/RestoreFromTrashOutlined";
import MoreTimeRoundedIcon from "@mui/icons-material/MoreTimeRounded";
import { useTranslation } from "react-i18next";
import { adminStorageApi } from "../../api/adminStorage";
import { apiErrorMessage } from "../../api/adminUsers";
import { mediaUrl } from "../../api/contentManager";
import { useApiQuery } from "../../hooks";
import { CM } from "../../theme-content";
import MediaWithFallback from "../../components/common/MediaWithFallback";
import { fmtDate, fmtDateTime, formatBytes, formatDuration, IconBox, Pill, STORAGE_PATHS, StatTile, TONE } from "./StorageShared";

const PAGE_SIZE = 5;
const DAY = 24 * 3600 * 1000;

/** The statuses of the cleanup view, with the tone of the pill that shows them. */
const STATUS = {
  ORPHANED: { key: "statusOrphaned", tone: "amber" },
  REJECTED: { key: "statusRejected", tone: "pink" },
};
/** The sources of the media, with the key of the translation of each one. */
const SOURCE_LABEL = { MEMBER: "sourceMember", SYSTEM: "sourceSystem" };
const TYPE_LABEL = { VIDEO: "typeVideo", IMAGE: "typeImage" };
/** The sort options of each view. */
const SORTS = {
  inactive: [
    { value: "size_desc", key: "sortSizeDesc" },
    { value: "size_asc", key: "sortSizeAsc" },
    { value: "oldest", key: "sortOldest" },
    { value: "newest", key: "sortNewest" },
  ],
  trash: [
    { value: "purge_soon", key: "sortPurgeSoon" },
    { value: "trashed_recent", key: "sortTrashedRecent" },
    { value: "size_desc", key: "sortSizeDesc" },
    { value: "size_asc", key: "sortSizeAsc" },
  ],
};
const EXTEND_OPTIONS = [7, 14, 30];

const isTrashed = (m) => m.status === "TRASHED";
/** Still protected from the daily auto-cleanup; an admin can clean it up anyway after a warning. */
const inGrace = (m) => !isTrashed(m) && m.deletableAt != null && new Date(m.deletableAt) > new Date();

const headCellSx = {
  color: CM.textDim,
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: "0.08em",
  borderBottom: `1px solid ${CM.border}`,
  bgcolor: CM.surfaceSoft,
  whiteSpace: "nowrap",
};
const bodyCellSx = { borderBottom: `1px solid ${CM.border}`, fontSize: 13.5 };
const leftCellSx = { ...bodyCellSx, textAlign: "left" };

function FilterSelect({ label, value, onChange, options, allLabel, width = 190, t }) {
  return (
    <TextField
      select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputProps={{ "aria-label": t("cleanup.filterAria", { label: label.toLowerCase() }) }}
      SelectProps={{
        displayEmpty: true,
        renderValue: (v) => `${label}: ${v ? options[v] : allLabel}`,
      }}
      sx={{ width }}
    >
      <MenuItem value="">{allLabel}</MenuItem>
      {Object.entries(options).map(([key, text]) => (
        <MenuItem key={key} value={key}>
          {text}
        </MenuItem>
      ))}
    </TextField>
  );
}

function PreviewDialog({ media, onClose, t }) {
  const src = media ? mediaUrl(media.url) : null;
  const statusKey = media ? (isTrashed(media) ? media.previousStatus : media.status) : null;
  const statusLabel = statusKey ? t(`cleanup.${STATUS[statusKey]?.key ?? "statusOrphaned"}`) : "";
  return (
    <Dialog open={Boolean(media)} onClose={onClose} maxWidth="md" fullWidth aria-labelledby="media-preview-title">
      <DialogTitle id="media-preview-title">{media?.fileName}</DialogTitle>
      <DialogContent>
        {!src ? (
          <Box sx={{ py: 8, textAlign: "center", color: CM.textMuted, borderRadius: 2, bgcolor: CM.surfaceSoft }}>
            {t("cleanup.previewUnavailable")}
          </Box>
        ) : media.fileType === "VIDEO" ? (
          <MediaWithFallback kind="video" src={src} alt={media.fileName} sx={{ width: "100%", maxHeight: 460, borderRadius: 2, bgcolor: "#000", display: "block" }} />
        ) : (
          <MediaWithFallback src={src} alt={media.fileName} sx={{ width: "100%", maxHeight: 460, objectFit: "contain", borderRadius: 2, bgcolor: CM.surfaceSoft, display: "block" }} />
        )}
        {media && (
          <Typography sx={{ mt: 1.5, fontSize: 13, color: CM.textMuted }}>
            {isTrashed(media) ? t("cleanup.previewInTrash", { status: statusLabel }) : statusLabel}
            {" · "}
            {media.reason}
            {" · "}
            {t(`cleanup.${SOURCE_LABEL[media.source]}`)}
            {" ("}
            {media.sourceLabel})
            {" · "}
            {formatBytes(media.sizeBytes)}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{t("cleanup.previewClose")}</Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Confirmation for "move to trash" (soft) and "delete permanently" (hard).
 * `files` lists the selection; "Empty trash" passes only count + bytes because the trash may span many pages.
 */
function ConfirmDialog({ request, busy, trashDays, onCancel, onConfirm, t }) {
  if (!request) return null;
  const { kind, files = [] } = request;
  const count = request.count ?? files.length;
  const bytes = request.bytes ?? files.reduce((sum, m) => sum + m.sizeBytes, 0);
  const soft = kind === "trash" && trashDays > 0;
  const rejected = files.filter((m) => (isTrashed(m) ? m.previousStatus : m.status) === "REJECTED").length;
  const graced = files.filter(inGrace);
  const purgeDate = new Date(Date.now() + trashDays * DAY).toISOString();

  const title = soft
    ? t("cleanup.confirmTrashTitle", { count })
    : kind === "empty"
      ? t("cleanup.confirmEmptyTitle")
      : t("cleanup.confirmDeleteTitle", { count });
  const confirmLabel = soft ? t("cleanup.confirmTrashLabel") : t("cleanup.confirmDeleteLabel", { count });

  return (
    <Dialog open onClose={busy ? undefined : onCancel} maxWidth="xs" fullWidth aria-labelledby="confirm-media-title">
      <DialogTitle id="confirm-media-title" sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <IconBox icon={soft ? DeleteOutlineRoundedIcon : DeleteForeverOutlinedIcon} tone={soft ? "amber" : "pink"} size={40} />
        {title}
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 14, color: CM.textMuted }}>
          {soft
            ? t("cleanup.confirmTrashMessage", { date: fmtDate(purgeDate), bytes: formatBytes(bytes) })
            : t("cleanup.confirmDeleteMessage", { bytes: formatBytes(bytes) })}
        </Typography>
        {files.length > 0 && <FileList files={files} />}
        {graced.length > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {graced.length === 1
              ? t("cleanup.confirmGraceOne", {
                  file: graced[0].fileName,
                  status: t(`cleanup.${STATUS[graced[0].status]?.key ?? "statusOrphaned"}`).toLowerCase(),
                  duration: formatDuration(graced[0].inactiveSince, Date.now(), t),
                })
              : t("cleanup.confirmGraceMany", {
                  count: graced.length,
                  duration: formatDuration(
                    graced.reduce((latest, m) => (new Date(m.inactiveSince) > new Date(latest.inactiveSince) ? m : latest)).inactiveSince,
                    Date.now(),
                    t,
                  ),
                })}{" "}
            {t("cleanup.confirmGraceTail")}
          </Alert>
        )}
        {rejected > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {rejected === 1 ? t("cleanup.confirmRejectedOne", { count: rejected }) : t("cleanup.confirmRejectedMany", { count: rejected })}{" "}
            {soft ? t("cleanup.confirmRejectedSoft") : t("cleanup.confirmRejectedHard")}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="outlined" onClick={onCancel} disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button
          variant="contained"
          color={soft ? "warning" : "error"}
          onClick={onConfirm}
          disabled={busy}
          sx={{ backgroundImage: "none" }}
        >
          {busy ? t("common.working") : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** The files of the selection, listed above the confirmation buttons. */
function FileList({ files }) {
  return (
    <Box sx={{ mt: 2, maxHeight: 220, overflowY: "auto", borderRadius: "10px", border: `1px solid ${CM.border}`, bgcolor: CM.surfaceSoft }}>
      {files.map((m) => (
        <Box key={m.id} sx={{ px: 1.75, py: 1, display: "flex", alignItems: "center", gap: 1.25, "& + &": { borderTop: `1px solid ${CM.border}` } }}>
          {m.fileType === "VIDEO" ? (
            <VideocamOutlinedIcon sx={{ fontSize: 17, color: TONE.violet.fg }} />
          ) : (
            <ImageOutlinedIcon sx={{ fontSize: 17, color: TONE.pink.fg }} />
          )}
          <Typography sx={{ flex: 1, minWidth: 0, fontSize: 13 }} noWrap>
            {m.fileName}
          </Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: CM.textMuted }}>{formatBytes(m.sizeBytes)}</Typography>
        </Box>
      ))}
    </Box>
  );
}

function ExtendDialog({ media, busy, onCancel, onConfirm, t }) {
  const [days, setDays] = useState(EXTEND_OPTIONS[0]);
  useEffect(() => {
    if (media) setDays(EXTEND_OPTIONS[0]);
  }, [media]);
  if (!media) return null;
  const from = Math.max(new Date(media.deletableAt).getTime(), Date.now());
  return (
    <Dialog open onClose={busy ? undefined : onCancel} maxWidth="xs" fullWidth aria-labelledby="extend-media-title">
      <DialogTitle id="extend-media-title" sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <IconBox icon={MoreTimeRoundedIcon} tone="violet" size={40} />
        {t("cleanup.extendTitle")}
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 14, color: CM.textMuted }}>
          {t("cleanup.extendDesc", { file: media.fileName })}
        </Typography>
        <TextField
          select
          fullWidth
          label={t("cleanup.extendBy")}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          sx={{ mt: 2.5 }}
        >
          {EXTEND_OPTIONS.map((d) => (
            <MenuItem key={d} value={d}>
              {t("cleanup.extendDays", { count: d })}
            </MenuItem>
          ))}
        </TextField>
        <Typography sx={{ mt: 1.5, fontSize: 13, color: CM.textDim }}>
          {t("cleanup.extendCurrent", {
            date: fmtDate(media.deletableAt),
            dateNew: fmtDate(new Date(from + days * DAY).toISOString()),
          })}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="outlined" onClick={onCancel} disabled={busy}>
          {t("cleanup.extendCancel")}
        </Button>
        <Button variant="contained" onClick={() => onConfirm(days)} disabled={busy}>
          {busy ? t("cleanup.extendSaving") : t("cleanup.extendSave")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function FileCell({ m, t }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <IconBox icon={m.fileType === "VIDEO" ? VideocamOutlinedIcon : ImageOutlinedIcon} tone={m.fileType === "VIDEO" ? "violet" : "pink"} size={38} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600 }} noWrap>
          {m.fileName}
        </Typography>
        <Typography sx={{ fontSize: 12, color: CM.textDim }}>
          {t(`cleanup.${TYPE_LABEL[m.fileType]}`)} · {t("cleanup.uploadedOn", { date: fmtDate(m.uploadedAt) })}
        </Typography>
      </Box>
    </Box>
  );
}

/** Tab 2: review inactive media, move it to the trash, restore or delete it permanently. */
export default function MediaCleanupTab() {
  const { t } = useTranslation("storage");
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") === "trash" ? "trash" : "inactive";
  const trashView = view === "trash";

  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState(SORTS[view][0].value);
  const [page, setPage] = useState(0);
  // id -> media, so the confirm dialog can list files selected on other pages
  const [selected, setSelected] = useState(() => new Map());
  const [preview, setPreview] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind: "trash" | "purge" | "empty", files?, count?, bytes? }
  const [extending, setExtending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [actionError, setActionError] = useState("");

  const { data, isLoading, isFetching, error, refetch } = useApiQuery(
    () => adminStorageApi.media({ view, status, source, type, sort, page, size: PAGE_SIZE }),
    { deps: [view, status, source, type, sort, page] },
  );

  useEffect(() => {
    document.title = trashView ? t("cleanup.documentTitleTrash") : t("cleanup.documentTitleInactive");
  }, [trashView, t]);

  // After removing every file on the last page, step back to the new last page.
  useEffect(() => {
    if (data && data.totalPages > 0 && page > data.totalPages - 1) setPage(data.totalPages - 1);
  }, [data, page]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const summary = data?.summary;
  const trashDays = summary?.trashRetentionDays ?? 7;
  const selectableOnPage = items;
  const selectedOnPage = selectableOnPage.filter((m) => selected.has(m.id)).length;
  const allOnPageSelected = selectableOnPage.length > 0 && selectedOnPage === selectableOnPage.length;
  const selectedFiles = [...selected.values()];
  const selectedBytes = selectedFiles.reduce((sum, m) => sum + m.sizeBytes, 0);
  const sortOptions = SORTS[view];

  const changeFilter = (setter) => (value) => {
    setter(value);
    setPage(0);
  };

  // Switching view starts from a clean state (the sort options differ per view).
  const changeView = (_, next) => {
    setSort(SORTS[next][0].value);
    setStatus("");
    setPage(0);
    setSelected(new Map());
    setSearchParams(next === "trash" ? { view: "trash" } : {});
  };

  const toggleOne = (media) =>
    setSelected((prev) => {
      const next = new Map(prev);
      next.has(media.id) ? next.delete(media.id) : next.set(media.id, media);
      return next;
    });

  const toggleAllOnPage = () =>
    setSelected((prev) => {
      const next = new Map(prev);
      selectableOnPage.forEach((m) => (allOnPageSelected ? next.delete(m.id) : next.set(m.id, m)));
      return next;
    });

  /** Runs an action, shows its message, then reloads the list. */
  const run = async (action, fallbackError) => {
    setBusy(true);
    setActionError("");
    try {
      const message = await action();
      setToast(message);
      setSelected(new Map());
      setConfirm(null);
      setExtending(null);
      refetch();
    } catch (err) {
      setActionError(apiErrorMessage(err, fallbackError));
      setConfirm(null);
      setExtending(null);
    } finally {
      setBusy(false);
    }
  };

  const confirmAction = () => {
    const ids = (confirm.files ?? []).map((m) => m.id);
    if (confirm.kind === "trash") {
      return run(async () => {
        const res = await adminStorageApi.trashMedia(ids);
        const skipped = res.skipped ? t("cleanup.msgTrashedSkipped", { count: res.skipped }) : "";
        return res.purged
          ? t("cleanup.msgPurged", { count: res.purged, bytes: formatBytes(res.freedBytes) }) + skipped
          : t("cleanup.msgTrashed", { count: res.trashed, date: fmtDate(res.purgeAt) }) + skipped;
      }, t("cleanup.errorTrash"));
    }
    if (confirm.kind === "empty") {
      return run(async () => {
        const res = await adminStorageApi.emptyTrash();
        return t("cleanup.msgEmptyTrash", { count: res.deleted, bytes: formatBytes(res.freedBytes) });
      }, t("cleanup.errorEmpty"));
    }
    return run(async () => {
      const res = await adminStorageApi.deleteMedia(ids);
      return t("cleanup.msgDeleted", { count: res.deleted, bytes: formatBytes(res.freedBytes) });
    }, t("cleanup.errorDelete"));
  };

  const restore = (files) =>
    run(async () => {
      const res = await adminStorageApi.restoreMedia(files.map((m) => m.id));
      return res.graceDays > 0
        ? t("cleanup.msgRestoredGrace", { count: res.restored, days: res.graceDays })
        : t("cleanup.msgRestored", { count: res.restored });
    }, t("cleanup.errorRestore"));

  const extend = (days) =>
    run(async () => {
      const res = await adminStorageApi.extendRetention(extending.id, days);
      return t("cleanup.msgExtended", { file: res.fileName, date: fmtDate(res.deletableAt) });
    }, t("cleanup.errorExtend"));

  const from = data && data.totalElements > 0 ? data.page * data.size + 1 : 0;
  const to = data ? Math.min((data.page + 1) * data.size, data.totalElements) : 0;
  const colCount = 7;

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Box
        sx={{
          px: 2,
          py: 1.25,
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          flexWrap: "wrap",
          borderRadius: "10px",
          bgcolor: TONE.green.bg,
          border: "1px solid rgba(120,232,136,0.35)",
        }}
      >
        <AutoDeleteOutlinedIcon sx={{ fontSize: 18, color: CM.green }} />
        <Typography sx={{ flex: 1, minWidth: 240, fontSize: 13 }}>
          {t("cleanup.autoCleanupBanner", { count: trashDays })}
        </Typography>
        <Link component={RouterLink} to={STORAGE_PATHS.settings} underline="hover" sx={{ fontSize: 13, fontWeight: 600, color: CM.violetBright }}>
          {t("cleanup.retentionLink")}
        </Link>
      </Box>

      <Box sx={{ p: 2, display: "flex", gap: 1.5, borderRadius: "12px", bgcolor: CM.surface, border: `1px solid ${CM.border}` }}>
        <InfoOutlinedIcon sx={{ fontSize: 20, color: CM.textMuted, mt: 0.25 }} />
        <Box sx={{ display: "grid", gap: 0.75, fontSize: 13, color: CM.textMuted }}>
          <Typography sx={{ fontSize: 13, color: "inherit" }}>
            <Box component="strong" sx={{ color: CM.text }}>{t("cleanup.helpOrphanedTitle")}</Box> {t("cleanup.helpOrphaned")}
          </Typography>
          <Typography sx={{ fontSize: 13, color: "inherit" }}>
            <Box component="strong" sx={{ color: CM.text }}>{t("cleanup.helpRejectedTitle")}</Box> {t("cleanup.helpRejected")}
          </Typography>
          <Typography sx={{ fontSize: 13, color: "inherit" }}>
            <Box component="strong" sx={{ color: CM.text }}>{t("cleanup.helpTrashTitle")}</Box> {t("cleanup.helpTrash", { count: trashDays })}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <StatTile
          label={t("cleanup.statOrphaned")}
          value={summary ? t("cleanup.filesCount", { count: summary.orphanedFiles }) : "-"}
          caption={summary && formatBytes(summary.orphanedBytes)}
        />
        <StatTile
          label={t("cleanup.statRejected")}
          value={summary ? t("cleanup.filesCount", { count: summary.rejectedFiles }) : "-"}
          caption={summary && formatBytes(summary.rejectedBytes)}
        />
        <StatTile
          label={t("cleanup.statReady")}
          value={summary ? formatBytes(summary.reclaimableBytes) : "-"}
          caption={summary && t("cleanup.statReadyCaption", { count: summary.reclaimableFiles, total: summary.total })}
        />
        <StatTile
          label={t("cleanup.statTrash")}
          value={summary ? formatBytes(summary.trashBytes) : "-"}
          caption={
            summary &&
            t("cleanup.statTrashCaption", {
              count: summary.trashFiles,
              soon:
                summary.purgeSoonBytes > 0
                  ? t("cleanup.statTrashSoon", { bytes: formatBytes(summary.purgeSoonBytes) })
                  : t("cleanup.statTrashNothingDue"),
            })
          }
          tone={CM.green}
        />
      </Box>

      <Tabs value={view} onChange={changeView} aria-label="Cleanup views" sx={{ borderBottom: `1px solid ${CM.border}`, minHeight: 40 }}>
        <Tab value="inactive" label={`${t("cleanup.tabInactive")}${summary ? ` (${summary.total})` : ""}`} sx={{ minHeight: 40 }} />
        <Tab
          value="trash"
          icon={<RestoreFromTrashOutlinedIcon sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label={`${t("cleanup.tabTrash")}${summary ? ` (${summary.trashFiles})` : ""}`}
          sx={{ minHeight: 40 }}
        />
      </Tabs>

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        <FilterSelect
          label={trashView ? t("cleanup.filterWas") : t("cleanup.filterStatus")}
          value={status}
          onChange={changeFilter(setStatus)}
          allLabel={t("cleanup.filterAll")}
          options={{ ORPHANED: t("cleanup.statusOrphaned"), REJECTED: t("cleanup.statusRejected") }}
          t={t}
        />
        <FilterSelect
          label={t("cleanup.filterSource")}
          value={source}
          onChange={changeFilter(setSource)}
          allLabel={t("cleanup.filterAllSources")}
          options={{ MEMBER: t("cleanup.sourceMember"), SYSTEM: t("cleanup.sourceSystem") }}
          width={230}
          t={t}
        />
        <FilterSelect
          label={t("cleanup.filterType")}
          value={type}
          onChange={changeFilter(setType)}
          allLabel={t("cleanup.filterAllTypes")}
          options={{ VIDEO: t("cleanup.typeVideo"), IMAGE: t("cleanup.typeImage") }}
          t={t}
        />
        <Box sx={{ flex: 1 }} />
        {trashView && summary?.trashFiles > 0 && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteForeverOutlinedIcon />}
            onClick={() => setConfirm({ kind: "empty", count: summary.trashFiles, bytes: summary.trashBytes })}
          >
            {t("cleanup.emptyTrash")}
          </Button>
        )}
        <TextField select value={sort} onChange={(e) => changeFilter(setSort)(e.target.value)} inputProps={{ "aria-label": t("cleanup.sortAria") }} sx={{ width: 210 }}>
          {sortOptions.map((s) => (
            <MenuItem key={s.value} value={s.value}>
              {t(`cleanup.${s.key}`)}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {selected.size > 0 && (
        <Box
          role="region"
          aria-label="Bulk actions"
          sx={{
            px: 2,
            py: 1.25,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flexWrap: "wrap",
            borderRadius: "12px",
            bgcolor: "rgba(139,92,246,0.14)",
            border: `1px solid ${CM.borderStrong}`,
          }}
        >
          <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>
            {t("cleanup.bulkSelected", { count: selected.size, bytes: formatBytes(selectedBytes) })}
            {trashView ? t("cleanup.bulkWillBeFreed") : ""}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button color="inherit" size="small" onClick={() => setSelected(new Map())}>
            {t("cleanup.bulkClear")}
          </Button>
          {trashView ? (
            <>
              <Button variant="outlined" size="small" startIcon={<RestoreFromTrashOutlinedIcon />} onClick={() => restore(selectedFiles)} disabled={busy}>
                {t("cleanup.bulkRestore", { count: selected.size })}
              </Button>
              <Button variant="contained" color="error" size="small" onClick={() => setConfirm({ kind: "purge", files: selectedFiles })} sx={{ backgroundImage: "none" }}>
                {t("cleanup.bulkDeletePermanently")}
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              color="warning"
              size="small"
              startIcon={<DeleteOutlineRoundedIcon />}
              onClick={() => setConfirm({ kind: "trash", files: selectedFiles })}
              sx={{ backgroundImage: "none" }}
            >
              {t("cleanup.bulkMoveToTrash", { count: selected.size })}
            </Button>
          )}
        </Box>
      )}

      {(error || actionError) && (
        <Alert severity="error" onClose={actionError ? () => setActionError("") : undefined}>
          {actionError || apiErrorMessage(error, t("cleanup.errorLoad"))}
        </Alert>
      )}

      <TableContainer sx={{ borderRadius: "16px", bgcolor: CM.surface, border: `1px solid ${CM.border}` }}>
        <Table aria-label={trashView ? t("cleanup.tabTrash") : t("cleanup.tabInactive")} sx={{ minWidth: 960 }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" sx={headCellSx}>
                <Checkbox
                  checked={allOnPageSelected}
                  indeterminate={selectedOnPage > 0 && !allOnPageSelected}
                  disabled={selectableOnPage.length === 0}
                  onChange={toggleAllOnPage}
                  inputProps={{ "aria-label": t("cleanup.selectAll") }}
                />
              </TableCell>
              <TableCell sx={{ ...headCellSx, textAlign: "left" }}>{t("cleanup.colFile")}</TableCell>
              <TableCell sx={headCellSx}>{trashView ? t("cleanup.colWas") : t("cleanup.colStatus")}</TableCell>
              <TableCell sx={headCellSx}>{t("cleanup.colSource")}</TableCell>
              <TableCell sx={headCellSx}>{trashView ? t("cleanup.colMovedToTrash") : t("cleanup.colInactiveFor")}</TableCell>
              <TableCell sx={headCellSx}>{t("cleanup.colSize")}</TableCell>
              <TableCell sx={headCellSx}>{t("cleanup.colActions")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading
              ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={colCount} sx={bodyCellSx}>
                      <Skeleton height={40} />
                    </TableCell>
                  </TableRow>
                ))
              : items.map((m) => {
                  const graced = inGrace(m);
                  const statusKey = isTrashed(m) ? m.previousStatus : m.status;
                  const st = STATUS[statusKey] ?? STATUS.ORPHANED;
                  const purgeSoon = trashView && new Date(m.purgeAt) - Date.now() <= DAY;
                  return (
                    <TableRow key={m.id} hover selected={selected.has(m.id)} sx={{ opacity: isFetching ? 0.6 : 1, transition: "opacity .15s" }}>
                      <TableCell padding="checkbox" sx={bodyCellSx}>
                        <Checkbox
                          checked={selected.has(m.id)}
                          onChange={() => toggleOne(m)}
                          inputProps={{ "aria-label": t("cleanup.selectFile", { name: m.fileName }) }}
                        />
                      </TableCell>
                      <TableCell sx={leftCellSx}>
                        <FileCell m={m} t={t} />
                      </TableCell>
                      <TableCell sx={bodyCellSx}>
                        <Pill tone={st.tone}>● {t(`cleanup.${st.key}`)}</Pill>
                        <Typography sx={{ mt: 0.5, fontSize: 12, color: CM.textDim }}>{m.reason}</Typography>
                      </TableCell>
                      <TableCell sx={bodyCellSx}>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 500 }}>{t(`cleanup.${SOURCE_LABEL[m.source]}`)}</Typography>
                        <Typography sx={{ fontSize: 12, color: CM.textDim }}>{m.sourceLabel}</Typography>
                      </TableCell>
                      <TableCell sx={bodyCellSx}>
                        {trashView ? (
                          <>
                            <Tooltip title={fmtDateTime(m.trashedAt)}>
                              <Typography sx={{ fontSize: 13.5 }}>
                                {t("cleanup.trashedAgo", { duration: formatDuration(m.trashedAt, Date.now(), t) })}
                              </Typography>
                            </Tooltip>
                            <Typography sx={{ fontSize: 12, color: CM.textDim }}>{t("cleanup.trashedBy", { name: m.trashedBy })}</Typography>
                            <Typography
                              sx={{ mt: 0.25, fontSize: 12, fontWeight: 600, color: purgeSoon ? CM.pink : CM.amber, display: "inline-flex", alignItems: "center", gap: 0.5 }}
                            >
                              <ScheduleRoundedIcon sx={{ fontSize: 13 }} /> {t("cleanup.deletedPermanentlyIn", { duration: formatDuration(m.purgeAt, Date.now(), t) })}
                            </Typography>
                          </>
                        ) : (
                          <>
                            <Typography sx={{ fontSize: 13.5, color: graced ? CM.textMuted : CM.text }}>
                              {formatDuration(m.inactiveSince, Date.now(), t)}
                            </Typography>
                            {graced && (
                              <Tooltip title={t("cleanup.graceTooltip", { date: fmtDateTime(m.deletableAt) })}>
                                <Typography sx={{ mt: 0.25, fontSize: 12, fontWeight: 600, color: CM.amber, display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                                  <ScheduleRoundedIcon sx={{ fontSize: 13 }} /> {t("cleanup.autoCleanupIn", { duration: formatDuration(m.deletableAt, Date.now(), t) })}
                                </Typography>
                              </Tooltip>
                            )}
                          </>
                        )}
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, fontWeight: 700, whiteSpace: "nowrap" }}>{formatBytes(m.sizeBytes)}</TableCell>
                      <TableCell sx={{ ...bodyCellSx, whiteSpace: "nowrap" }}>
                        <Tooltip title={t("cleanup.actionPreview")}>
                          <IconButton aria-label={t("cleanup.actionPreviewAria", { name: m.fileName })} onClick={() => setPreview(m)} size="small" sx={{ color: CM.textMuted }}>
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {trashView && (
                          <Tooltip title={t("cleanup.actionRestore")}>
                            <IconButton aria-label={t("cleanup.actionRestoreAria", { name: m.fileName })} onClick={() => restore([m])} disabled={busy} size="small" sx={{ color: CM.violetBright }}>
                              <RestoreFromTrashOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {!trashView && m.status === "REJECTED" && (
                          <Tooltip title={t("cleanup.actionExtend")}>
                            <IconButton aria-label={t("cleanup.actionExtendAria", { name: m.fileName })} onClick={() => setExtending(m)} size="small" sx={{ color: CM.textMuted }}>
                              <MoreTimeRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
            {!isLoading && !error && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={colCount} sx={{ ...bodyCellSx, py: 6, color: CM.textMuted }}>
                  {trashView ? t("cleanup.emptyTrashState") : t("cleanup.noMatch")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Typography sx={{ fontSize: 13, color: CM.textMuted }}>
          {data && data.totalElements > 0
            ? t("cleanup.showing", {
                from,
                to,
                total: data.totalElements,
                items: trashView ? t("cleanup.showingTrash") : t("cleanup.showingInactive"),
              })
            : ""}
        </Typography>
        {data && data.totalPages > 1 && (
          <Pagination
            count={data.totalPages}
            page={data.page + 1}
            onChange={(_, p) => setPage(p - 1)}
            shape="rounded"
            color="primary"
            siblingCount={1}
            showFirstButton
            showLastButton
          />
        )}
      </Box>

      <Typography sx={{ fontSize: 12, color: trashView ? CM.pink : CM.textDim, display: "flex", alignItems: "center", gap: 0.75 }}>
        <WarningAmberRoundedIcon sx={{ fontSize: 16 }} />
        {trashView ? t("cleanup.footerTrash") : t("cleanup.footerInactive")}
      </Typography>

      <PreviewDialog media={preview} onClose={() => setPreview(null)} t={t} />
      <ConfirmDialog request={confirm} busy={busy} trashDays={trashDays} onCancel={() => setConfirm(null)} onConfirm={confirmAction} t={t} />
      <ExtendDialog media={extending} busy={busy} onCancel={() => setExtending(null)} onConfirm={extend} t={t} />
      <Snackbar open={Boolean(toast)} autoHideDuration={5000} onClose={() => setToast("")} message={toast} />
    </Box>
  );
}
