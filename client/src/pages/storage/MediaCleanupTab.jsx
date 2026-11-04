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
import { adminStorageApi } from "../../api/adminStorage";
import { apiErrorMessage } from "../../api/adminUsers";
import { mediaUrl } from "../../api/contentManager";
import { useApiQuery } from "../../hooks";
import { CM } from "../../theme-content";
import MediaWithFallback from "../../components/common/MediaWithFallback";
import { fmtDate, fmtDateTime, formatBytes, formatDuration, IconBox, Pill, STORAGE_PATHS, StatTile, TONE } from "./StorageShared";

const PAGE_SIZE = 5;
const DAY = 24 * 3600 * 1000;

const STATUS = { ORPHANED: { label: "Orphaned", tone: "amber" }, REJECTED: { label: "Rejected", tone: "pink" } };
const SOURCE_LABEL = { MEMBER: "Member upload", SYSTEM: "System" };
const TYPE_LABEL = { VIDEO: "Video", IMAGE: "Image" };
const SORTS = {
  inactive: [
    { value: "size_desc", label: "Largest first" },
    { value: "size_asc", label: "Smallest first" },
    { value: "oldest", label: "Inactive longest" },
    { value: "newest", label: "Recently inactive" },
  ],
  trash: [
    { value: "purge_soon", label: "Deleted soonest" },
    { value: "trashed_recent", label: "Recently moved" },
    { value: "size_desc", label: "Largest first" },
    { value: "size_asc", label: "Smallest first" },
  ],
};
const EXTEND_OPTIONS = [7, 14, 30];

const isTrashed = (m) => m.status === "TRASHED";
const statusOf = (m) => STATUS[isTrashed(m) ? m.previousStatus : m.status];
const isDeletable = (m) => isTrashed(m) || new Date(m.deletableAt) <= new Date();
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

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

function FilterSelect({ label, value, onChange, options, allLabel, width = 190 }) {
  return (
    <TextField
      select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputProps={{ "aria-label": `Filter by ${label.toLowerCase()}` }}
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

function PreviewDialog({ media, onClose }) {
  const src = media ? mediaUrl(media.url) : null;
  return (
    <Dialog open={Boolean(media)} onClose={onClose} maxWidth="md" fullWidth aria-labelledby="media-preview-title">
      <DialogTitle id="media-preview-title">{media?.fileName}</DialogTitle>
      <DialogContent>
        {!src ? (
          <Box sx={{ py: 8, textAlign: "center", color: CM.textMuted, borderRadius: 2, bgcolor: CM.surfaceSoft }}>
            Preview is not available for this file.
          </Box>
        ) : media.fileType === "VIDEO" ? (
          <MediaWithFallback kind="video" src={src} alt={media.fileName} sx={{ width: "100%", maxHeight: 460, borderRadius: 2, bgcolor: "#000", display: "block" }} />
        ) : (
          <MediaWithFallback src={src} alt={media.fileName} sx={{ width: "100%", maxHeight: 460, objectFit: "contain", borderRadius: 2, bgcolor: CM.surfaceSoft, display: "block" }} />
        )}
        {media && (
          <Typography sx={{ mt: 1.5, fontSize: 13, color: CM.textMuted }}>
            {isTrashed(media) ? "In trash · was " : ""}
            {statusOf(media).label} · {media.reason} · {SOURCE_LABEL[media.source]} ({media.sourceLabel}) · {formatBytes(media.sizeBytes)}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

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

/**
 * Confirmation for "move to trash" (soft) and "delete permanently" (hard).
 * `files` lists the selection; "Empty trash" passes only count + bytes because the trash may span many pages.
 */
function ConfirmDialog({ request, busy, trashDays, onCancel, onConfirm }) {
  if (!request) return null;
  const { kind, files = [] } = request;
  const count = request.count ?? files.length;
  const bytes = request.bytes ?? files.reduce((sum, m) => sum + m.sizeBytes, 0);
  const soft = kind === "trash" && trashDays > 0;
  const rejected = files.filter((m) => (isTrashed(m) ? m.previousStatus : m.status) === "REJECTED").length;
  const purgeDate = new Date(Date.now() + trashDays * DAY).toISOString();

  const title = soft
    ? `Move ${plural(count, "file")} to trash?`
    : kind === "empty"
      ? "Empty the trash?"
      : `Delete ${plural(count, "file")} permanently?`;
  const confirmLabel = soft ? "Move to trash" : `Delete ${plural(count, "file")}`;

  return (
    <Dialog open onClose={busy ? undefined : onCancel} maxWidth="xs" fullWidth aria-labelledby="confirm-media-title">
      <DialogTitle id="confirm-media-title" sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <IconBox icon={soft ? DeleteOutlineRoundedIcon : DeleteForeverOutlinedIcon} tone={soft ? "amber" : "pink"} size={40} />
        {title}
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 14, color: CM.textMuted }}>
          {soft
            ? `They can be restored until ${fmtDate(purgeDate)}, then they are deleted permanently. ${formatBytes(bytes)} is freed only at that point.`
            : `${formatBytes(bytes)} will be freed. Files are removed from storage and cannot be restored.`}
        </Typography>
        {files.length > 0 && <FileList files={files} />}
        {rejected > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {rejected} file{rejected === 1 ? " belongs" : "s belong"} to a rejected exercise.{" "}
            {soft ? "The member will no longer see it." : 'The approval history will show "Media removed".'}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="outlined" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color={soft ? "warning" : "error"}
          onClick={onConfirm}
          disabled={busy}
          sx={{ backgroundImage: "none" }}
        >
          {busy ? "Working…" : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ExtendDialog({ media, busy, onCancel, onConfirm }) {
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
        Extend retention
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 14, color: CM.textMuted }}>
          Keep <Box component="strong" sx={{ color: CM.text }}>{media.fileName}</Box> longer, e.g. when the member asked for more time
          to resubmit. Auto-cleanup skips it until the new date.
        </Typography>
        <TextField
          select
          fullWidth
          label="Extend by"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          sx={{ mt: 2.5 }}
        >
          {EXTEND_OPTIONS.map((d) => (
            <MenuItem key={d} value={d}>
              {d} days
            </MenuItem>
          ))}
        </TextField>
        <Typography sx={{ mt: 1.5, fontSize: 13, color: CM.textDim }}>
          Currently cleaned up on {fmtDate(media.deletableAt)} → new date {fmtDate(new Date(from + days * DAY).toISOString())}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="outlined" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => onConfirm(days)} disabled={busy}>
          {busy ? "Saving…" : "Extend"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function FileCell({ m }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <IconBox icon={m.fileType === "VIDEO" ? VideocamOutlinedIcon : ImageOutlinedIcon} tone={m.fileType === "VIDEO" ? "violet" : "pink"} size={38} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600 }} noWrap>
          {m.fileName}
        </Typography>
        <Typography sx={{ fontSize: 12, color: CM.textDim }}>
          {TYPE_LABEL[m.fileType]} · uploaded {fmtDate(m.uploadedAt)}
        </Typography>
      </Box>
    </Box>
  );
}

/** Tab 2: review inactive media, move it to the trash, restore or delete it permanently. */
export default function MediaCleanupTab() {
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
    document.title = trashView ? "Trash | CalisHealth" : "Media cleanup | CalisHealth";
  }, [trashView]);

  // After removing every file on the last page, step back to the new last page.
  useEffect(() => {
    if (data && data.totalPages > 0 && page > data.totalPages - 1) setPage(data.totalPages - 1);
  }, [data, page]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const summary = data?.summary;
  const trashDays = summary?.trashRetentionDays ?? 7;
  const selectableOnPage = items.filter(isDeletable);
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
        const skipped = res.skipped ? ` ${res.skipped} skipped (still in their grace period).` : "";
        return res.purged
          ? `${res.purged} file(s) deleted · ${formatBytes(res.freedBytes)} freed.${skipped}`
          : `${res.trashed} file(s) moved to trash · deleted permanently on ${fmtDate(res.purgeAt)}.${skipped}`;
      }, "Could not move the selected files to the trash.");
    }
    if (confirm.kind === "empty") {
      return run(async () => {
        const res = await adminStorageApi.emptyTrash();
        return `Trash emptied · ${res.deleted} file(s) deleted · ${formatBytes(res.freedBytes)} freed.`;
      }, "Could not empty the trash.");
    }
    return run(async () => {
      const res = await adminStorageApi.deleteMedia(ids);
      return `${res.deleted} file(s) deleted permanently · ${formatBytes(res.freedBytes)} freed.`;
    }, "Could not delete the selected files.");
  };

  const restore = (files) =>
    run(async () => {
      const res = await adminStorageApi.restoreMedia(files.map((m) => m.id));
      return `${res.restored} file(s) restored · auto-cleanup skips them for ${res.graceDays} days.`;
    }, "Could not restore the selected files.");

  const extend = (days) =>
    run(async () => {
      const res = await adminStorageApi.extendRetention(extending.id, days);
      return `${res.fileName} is kept until ${fmtDate(res.deletableAt)}.`;
    }, "Could not extend the retention.");

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
          Every day at 03:00 expired files are moved to the trash, and trash older than {plural(trashDays, "day")} is deleted
          permanently. Storage is freed only when a file is deleted permanently.
        </Typography>
        <Link component={RouterLink} to={STORAGE_PATHS.settings} underline="hover" sx={{ fontSize: 13, fontWeight: 600, color: CM.violetBright }}>
          Retention settings →
        </Link>
      </Box>

      <Box sx={{ p: 2, display: "flex", gap: 1.5, borderRadius: "12px", bgcolor: CM.surface, border: `1px solid ${CM.border}` }}>
        <InfoOutlinedIcon sx={{ fontSize: 20, color: CM.textMuted, mt: 0.25 }} />
        <Box sx={{ display: "grid", gap: 0.75, fontSize: 13, color: CM.textMuted }}>
          <Typography sx={{ fontSize: 13, color: "inherit" }}>
            <Box component="strong" sx={{ color: CM.text }}>Orphaned:</Box> file no longer linked to any exercise, skill or
            profile. It can be cleaned up once its grace period has passed.
          </Typography>
          <Typography sx={{ fontSize: 13, color: "inherit" }}>
            <Box component="strong" sx={{ color: CM.text }}>Rejected:</Box> media of a member exercise rejected by
            moderation. It is kept for the retention period so the member can read the reason and resubmit.
          </Typography>
          <Typography sx={{ fontSize: 13, color: "inherit" }}>
            <Box component="strong" sx={{ color: CM.text }}>Trash:</Box> soft-deleted files. They still use storage and can
            be restored for {plural(trashDays, "day")}; then they are deleted permanently.
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <StatTile label="Orphaned media" value={summary ? plural(summary.orphanedFiles, "file") : "-"} caption={summary && formatBytes(summary.orphanedBytes)} />
        <StatTile label="Rejected media" value={summary ? plural(summary.rejectedFiles, "file") : "-"} caption={summary && formatBytes(summary.rejectedBytes)} />
        <StatTile
          label="Ready for cleanup"
          value={summary ? formatBytes(summary.reclaimableBytes) : "-"}
          caption={summary && `${summary.reclaimableFiles} of ${summary.total} files past grace period`}
        />
        <StatTile
          label="In trash"
          value={summary ? formatBytes(summary.trashBytes) : "-"}
          caption={
            summary &&
            `${plural(summary.trashFiles, "file")} · ${summary.purgeSoonBytes > 0 ? `${formatBytes(summary.purgeSoonBytes)} freed in the next 24h` : "nothing due in the next 24h"}`
          }
          tone={CM.green}
        />
      </Box>

      <Tabs value={view} onChange={changeView} aria-label="Cleanup views" sx={{ borderBottom: `1px solid ${CM.border}`, minHeight: 40 }}>
        <Tab value="inactive" label={`Inactive media${summary ? ` (${summary.total})` : ""}`} sx={{ minHeight: 40 }} />
        <Tab
          value="trash"
          icon={<RestoreFromTrashOutlinedIcon sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label={`Trash${summary ? ` (${summary.trashFiles})` : ""}`}
          sx={{ minHeight: 40 }}
        />
      </Tabs>

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        <FilterSelect
          label={trashView ? "Was" : "Status"}
          value={status}
          onChange={changeFilter(setStatus)}
          allLabel="All"
          options={{ ORPHANED: "Orphaned", REJECTED: "Rejected" }}
        />
        <FilterSelect label="Source" value={source} onChange={changeFilter(setSource)} allLabel="All sources" options={{ MEMBER: "Member uploads", SYSTEM: "System" }} width={230} />
        <FilterSelect label="Type" value={type} onChange={changeFilter(setType)} allLabel="All types" options={TYPE_LABEL} />
        <Box sx={{ flex: 1 }} />
        {trashView && summary?.trashFiles > 0 && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteForeverOutlinedIcon />}
            onClick={() => setConfirm({ kind: "empty", count: summary.trashFiles, bytes: summary.trashBytes })}
          >
            Empty trash
          </Button>
        )}
        <TextField select value={sort} onChange={(e) => changeFilter(setSort)(e.target.value)} inputProps={{ "aria-label": "Sort files" }} sx={{ width: 210 }}>
          {sortOptions.map((s) => (
            <MenuItem key={s.value} value={s.value}>
              {s.label}
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
            {selected.size} selected · {formatBytes(selectedBytes)}
            {trashView ? " will be freed if deleted" : ""}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button color="inherit" size="small" onClick={() => setSelected(new Map())}>
            Clear selection
          </Button>
          {trashView ? (
            <>
              <Button variant="outlined" size="small" startIcon={<RestoreFromTrashOutlinedIcon />} onClick={() => restore(selectedFiles)} disabled={busy}>
                Restore {selected.size}
              </Button>
              <Button variant="contained" color="error" size="small" onClick={() => setConfirm({ kind: "purge", files: selectedFiles })} sx={{ backgroundImage: "none" }}>
                Delete permanently
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
              Move {plural(selected.size, "file")} to trash
            </Button>
          )}
        </Box>
      )}

      {(error || actionError) && (
        <Alert severity="error" onClose={actionError ? () => setActionError("") : undefined}>
          {actionError || apiErrorMessage(error, "Could not load media.")}
        </Alert>
      )}

      <TableContainer sx={{ borderRadius: "16px", bgcolor: CM.surface, border: `1px solid ${CM.border}` }}>
        <Table aria-label={trashView ? "Trash" : "Inactive media"} sx={{ minWidth: 960 }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" sx={headCellSx}>
                <Checkbox
                  checked={allOnPageSelected}
                  indeterminate={selectedOnPage > 0 && !allOnPageSelected}
                  disabled={selectableOnPage.length === 0}
                  onChange={toggleAllOnPage}
                  inputProps={{ "aria-label": "Select all selectable files on this page" }}
                />
              </TableCell>
              <TableCell sx={{ ...headCellSx, textAlign: "left" }}>FILE</TableCell>
              <TableCell sx={headCellSx}>{trashView ? "WAS" : "STATUS"}</TableCell>
              <TableCell sx={headCellSx}>SOURCE</TableCell>
              <TableCell sx={headCellSx}>{trashView ? "MOVED TO TRASH" : "INACTIVE FOR"}</TableCell>
              <TableCell sx={headCellSx}>SIZE</TableCell>
              <TableCell sx={headCellSx}>ACTIONS</TableCell>
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
                  const selectable = isDeletable(m);
                  const st = statusOf(m);
                  const purgeSoon = trashView && new Date(m.purgeAt) - Date.now() <= DAY;
                  return (
                    <TableRow key={m.id} hover selected={selected.has(m.id)} sx={{ opacity: isFetching ? 0.6 : 1, transition: "opacity .15s" }}>
                      <TableCell padding="checkbox" sx={bodyCellSx}>
                        <Tooltip title={selectable ? "" : `In grace period · can be cleaned up in ${formatDuration(m.deletableAt)}`}>
                          <span>
                            <Checkbox
                              checked={selected.has(m.id)}
                              disabled={!selectable}
                              onChange={() => toggleOne(m)}
                              inputProps={{ "aria-label": `Select ${m.fileName}` }}
                            />
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={leftCellSx}>
                        <FileCell m={m} />
                      </TableCell>
                      <TableCell sx={bodyCellSx}>
                        <Pill tone={st.tone}>● {st.label}</Pill>
                        <Typography sx={{ mt: 0.5, fontSize: 12, color: CM.textDim }}>{m.reason}</Typography>
                      </TableCell>
                      <TableCell sx={bodyCellSx}>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 500 }}>{SOURCE_LABEL[m.source]}</Typography>
                        <Typography sx={{ fontSize: 12, color: CM.textDim }}>{m.sourceLabel}</Typography>
                      </TableCell>
                      <TableCell sx={bodyCellSx}>
                        {trashView ? (
                          <>
                            <Tooltip title={fmtDateTime(m.trashedAt)}>
                              <Typography sx={{ fontSize: 13.5 }}>{formatDuration(m.trashedAt)} ago</Typography>
                            </Tooltip>
                            <Typography sx={{ fontSize: 12, color: CM.textDim }}>by {m.trashedBy}</Typography>
                            <Typography
                              sx={{ mt: 0.25, fontSize: 12, fontWeight: 600, color: purgeSoon ? CM.pink : CM.amber, display: "inline-flex", alignItems: "center", gap: 0.5 }}
                            >
                              <ScheduleRoundedIcon sx={{ fontSize: 13 }} /> Deleted permanently in {formatDuration(m.purgeAt)}
                            </Typography>
                          </>
                        ) : (
                          <>
                            <Typography sx={{ fontSize: 13.5, color: selectable ? CM.text : CM.textMuted }}>{formatDuration(m.inactiveSince)}</Typography>
                            {!selectable && (
                              <Typography sx={{ mt: 0.25, fontSize: 12, fontWeight: 600, color: CM.amber, display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                                <ScheduleRoundedIcon sx={{ fontSize: 13 }} /> Kept for {formatDuration(m.deletableAt)} more
                              </Typography>
                            )}
                          </>
                        )}
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, fontWeight: 700, whiteSpace: "nowrap" }}>{formatBytes(m.sizeBytes)}</TableCell>
                      <TableCell sx={{ ...bodyCellSx, whiteSpace: "nowrap" }}>
                        <Tooltip title="Preview">
                          <IconButton aria-label={`Preview ${m.fileName}`} onClick={() => setPreview(m)} size="small" sx={{ color: CM.textMuted }}>
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {trashView && (
                          <Tooltip title="Restore">
                            <IconButton aria-label={`Restore ${m.fileName}`} onClick={() => restore([m])} disabled={busy} size="small" sx={{ color: CM.violetBright }}>
                              <RestoreFromTrashOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {!trashView && m.status === "REJECTED" && (
                          <Tooltip title="Extend retention">
                            <IconButton aria-label={`Extend retention of ${m.fileName}`} onClick={() => setExtending(m)} size="small" sx={{ color: CM.textMuted }}>
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
                  {trashView ? "The trash is empty." : "No inactive media matches these filters."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Typography sx={{ fontSize: 13, color: CM.textMuted }}>
          {data && data.totalElements > 0 ? `Showing ${from}–${to} of ${data.totalElements} ${trashView ? "files in trash" : "inactive files"}` : ""}
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
        {trashView
          ? "Permanently deleted files are removed from storage and cannot be restored. Each action is written to the admin activity log."
          : "Files moved to the trash still use storage until they are deleted permanently. Each action is written to the admin activity log."}
      </Typography>

      <PreviewDialog media={preview} onClose={() => setPreview(null)} />
      <ConfirmDialog request={confirm} busy={busy} trashDays={trashDays} onCancel={() => setConfirm(null)} onConfirm={confirmAction} />
      <ExtendDialog media={extending} busy={busy} onCancel={() => setExtending(null)} onConfirm={extend} />
      <Snackbar open={Boolean(toast)} autoHideDuration={5000} onClose={() => setToast("")} message={toast} />
    </Box>
  );
}
