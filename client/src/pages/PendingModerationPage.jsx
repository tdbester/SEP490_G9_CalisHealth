import { useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import {
  Alert, Box, Button, Card, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, InputAdornment, MenuItem, Snackbar, Stack, Table,
  TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField,
  Tooltip, Typography,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { contentManagerApi } from "../api/contentManager";
import { useApiMutation, useApiQuery } from "../hooks";
import { CONTENT_PATHS, ContentPageHeader, SummaryCard } from "../components/ContentShared";
import ContentDataCard, { DbSourceNote, EmptyState, HEAD_ROW_SX } from "../components/ContentDataCard";
import { CM } from "../theme-content";

function relativeAge(value) {
  if (!value) return "—";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function PendingModerationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const query = useApiQuery(() => contentManagerApi.pendingExercises());
  const historyQuery = useApiQuery(() => contentManagerApi.exerciseApprovalHistory());
  const [busyCode, setBusyCode] = useState(null);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");
  const [sort, setSort] = useState("oldest");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [confirmAction, setConfirmAction] = useState(null);
  const [undoNotice, setUndoNotice] = useState(null);
  const [hiddenCodes, setHiddenCodes] = useState(() => new Set());
  const [successNotice, setSuccessNotice] = useState("");
  const rejectTimer = useRef(null);

  useEffect(() => () => clearTimeout(rejectTimer.current), []);

  useEffect(() => {
    const routedSuccess = location.state?.successMessage;
    if (routedSuccess) {
      setSuccessNotice(routedSuccess);
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    const routedReject = location.state?.pendingReject;
    if (!routedReject || undoNotice) return;
    setHiddenCodes((current) => new Set(current).add(routedReject.code));
    setUndoNotice({ row: routedReject, seconds: 10 });
    navigate(location.pathname, { replace: true, state: null });
    const startedAt = Date.now();
    const tick = () => {
      const seconds = Math.max(0, 10 - Math.floor((Date.now() - startedAt) / 1000));
      setUndoNotice((current) => current ? { ...current, seconds } : current);
      if (seconds > 0) rejectTimer.current = setTimeout(tick, 250);
      else {
        setUndoNotice(null);
        reject.mutate(routedReject.code);
      }
    };
    rejectTimer.current = setTimeout(tick, 250);
  }, [location, navigate]);

  const approve = useApiMutation(({ code }) => contentManagerApi.updateExerciseStatus(code, true), {
    onSuccess: () => { setBusyCode(null); query.refetch(); historyQuery.refetch(); },
    onError: () => setBusyCode(null),
  });
  const reject = useApiMutation((code) => contentManagerApi.updateExerciseStatus(code, false), {
    onSuccess: () => { setBusyCode(null); query.refetch(); historyQuery.refetch(); },
    onError: (_, code) => {
      setBusyCode(null);
      setHiddenCodes((current) => {
        const next = new Set(current);
        next.delete(code);
        return next;
      });
    },
  });

  const rows = (Array.isArray(query.data) ? query.data : []).filter((row) => !hiddenCodes.has(row.code));
  const waitingOverThreeDays = rows.filter((row) => row.submittedAt && Date.now() - new Date(row.submittedAt).getTime() > 3 * 86400000).length;
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const reviewedThisWeek = (Array.isArray(historyQuery.data) ? historyQuery.data : []).filter((row) => row.reviewedAt && new Date(row.reviewedAt) >= weekStart).length;
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows
      .filter((row) => (!term || [row.name, row.code, row.createdByName].some((value) => String(value || "").toLowerCase().includes(term))))
      .filter((row) => level === "all" || String(row.level || "").toLowerCase() === level)
      .sort((a, b) => {
        const delta = new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime();
        return sort === "newest" ? -delta : delta;
      });
  }, [rows, search, level, sort]);
  const visibleRows = filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const resetPage = (setter) => (event) => { setter(event.target.value); setPage(0); };
  const handleApprove = (row) => setConfirmAction({ type: "approve", row });
  const handleReject = (row) => setConfirmAction({ type: "reject", row });
  const closeConfirm = () => setConfirmAction(null);
  const confirmModerationAction = () => {
    const action = confirmAction;
    closeConfirm();
    if (!action) return;
    setBusyCode(action.row.code);
    if (action.type === "approve") {
      approve.mutate({ code: action.row.code });
      return;
    }
    setHiddenCodes((current) => new Set(current).add(action.row.code));
    setUndoNotice({ row: action.row, seconds: 10 });
    const startedAt = Date.now();
    const tick = () => {
      const seconds = Math.max(0, 10 - Math.floor((Date.now() - startedAt) / 1000));
      setUndoNotice((current) => current ? { ...current, seconds } : current);
      if (seconds > 0) rejectTimer.current = setTimeout(tick, 250);
      else {
        setUndoNotice(null);
        reject.mutate(action.row.code, {
          onError: () => setHiddenCodes((current) => {
            const next = new Set(current);
            next.delete(action.row.code);
            return next;
          }),
        });
      }
    };
    rejectTimer.current = setTimeout(tick, 250);
  };
  const undoReject = () => {
    clearTimeout(rejectTimer.current);
    setHiddenCodes((current) => {
      const next = new Set(current);
      next.delete(undoNotice.row.code);
      return next;
    });
    setUndoNotice(null);
    setBusyCode(null);
  };

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2.5, sm: 3 } }}>
      <ContentPageHeader
        breadcrumb={[
          { label: "Content manager", to: CONTENT_PATHS.dashboard },
          { label: "Exercise & workout management", to: CONTENT_PATHS.exercises },
          { label: "Pending moderation" },
        ]}
        title="Pending exercise moderation"
        description="Review custom exercises submitted by members. Approved exercises become active and appear in the exercise list."
        action={
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button component={RouterLink} to={CONTENT_PATHS.exerciseApprovalHistory} variant="outlined">Approval history</Button>
            <Button component={RouterLink} to={CONTENT_PATHS.exercises} variant="outlined" startIcon={<ArrowBackRoundedIcon />}>Back to exercise list</Button>
          </Stack>
        }
      />

      <Box component="section" aria-label="Moderation summary" sx={{ mt: 2.5, display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" } }}>
        <SummaryCard label="Pending review" count={rows.length} detail="exercises" />
        <SummaryCard label="Waiting over 3 days" tone="warning" count={waitingOverThreeDays} detail="exercises" />
        <SummaryCard label="Reviewed this week" tone="success" count={reviewedThisWeek} detail="exercises" />
      </Box>

      {successNotice && <Alert severity="success" sx={{ mt: 2 }} onClose={() => setSuccessNotice("")}>{successNotice}</Alert>}
      {(approve.error || reject.error) && <Alert severity="error" sx={{ mt: 2 }}>{reject.error ? `Could not reject this exercise. ${reject.error.message}` : `Could not approve this exercise. ${approve.error.message}`}</Alert>}

      <Card sx={{ mt: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }} sx={{ p: 1.5, borderBottom: `1px solid ${CM.border}` }}>
          <TextField size="small" fullWidth value={search} onChange={resetPage(setSearch)} placeholder="Search exercise or submitter" inputProps={{ "aria-label": "Search exercise or submitter" }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" color="disabled" /></InputAdornment> }} sx={{ flex: 1, minWidth: 200 }} />
          <TextField select size="small" value={level} onChange={resetPage(setLevel)} SelectProps={{ SelectDisplayProps: { "aria-label": "Filter by level" } }} sx={{ minWidth: 150 }}>
            <MenuItem value="all">All levels</MenuItem><MenuItem value="beginner">Beginner</MenuItem><MenuItem value="intermediate">Intermediate</MenuItem><MenuItem value="advanced">Advanced</MenuItem>
          </TextField>
          <TextField select size="small" value={sort} onChange={resetPage(setSort)} SelectProps={{ SelectDisplayProps: { "aria-label": "Sort submissions" } }} sx={{ minWidth: 145 }}>
            <MenuItem value="oldest">Oldest first</MenuItem><MenuItem value="newest">Newest first</MenuItem>
          </TextField>
          <Tooltip title="Refresh">
            <span>
              <Button onClick={() => query.refetch()} disabled={query.isFetching} variant="outlined" aria-label="Refresh pending exercises" sx={{ minWidth: 40, width: 40, px: 0 }}>
                {query.isFetching ? <CircularProgress size={18} /> : <RefreshRoundedIcon />}
              </Button>
            </span>
          </Tooltip>
        </Stack>

        {(query.isLoading || query.error) ? (
          <ContentDataCard query={query} title="pending exercises"><EmptyState message="Could not display pending submissions." /></ContentDataCard>
        ) : filteredRows.length === 0 ? (
          <EmptyState message={rows.length ? "No submissions match these filters." : "No custom exercises are waiting for review."} />
        ) : (
          <>
            <TableContainer>
              <Table size="small" sx={{ minWidth: 900 }}>
                <TableHead><TableRow sx={HEAD_ROW_SX}>
                  <TableCell>Exercise</TableCell><TableCell>Uploaded by</TableCell><TableCell>Muscle group</TableCell><TableCell>Level</TableCell><TableCell>Submitted</TableCell><TableCell align="center">Action</TableCell>
                </TableRow></TableHead>
                <TableBody>{visibleRows.map((row) => {
                  return (
                    <TableRow key={row.code} hover>
                      <TableCell><Typography variant="body2" fontWeight={600} sx={{ color: "#fff" }}>{row.name}</Typography><Typography variant="caption" sx={{ color: CM.textDim }}>{row.code}</Typography></TableCell>
                      <TableCell><Typography variant="caption" sx={{ color: CM.textMuted }}>{row.createdByName || "Unknown"}</Typography></TableCell>
                      <TableCell><Typography variant="caption" sx={{ color: CM.textMuted }}>{row.muscleGroup || "—"}</Typography></TableCell>
                      <TableCell><Typography variant="caption" sx={{ color: CM.textMuted }}>{row.level || "—"}</Typography></TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}><Typography variant="caption" sx={{ color: CM.textDim }}>{relativeAge(row.submittedAt)}</Typography></TableCell>
                      <TableCell align="center"><Stack direction="row" spacing={0.75} justifyContent="center" alignItems="center">
                        <Button size="small" variant="outlined" component={RouterLink} to={`${CONTENT_PATHS.exercises}/moderation/${encodeURIComponent(row.code)}`} sx={{ py: 0.25, px: 1.25, fontSize: 11.5, minWidth: 0 }}>Review</Button>
                        <Button size="small" variant="contained" disabled={busyCode === row.code} onClick={() => handleApprove(row)} sx={{ py: 0.25, px: 1.5, fontSize: 11.5, minWidth: 0 }}>{approve.isPending && busyCode === row.code ? "Approving…" : "Approve"}</Button>
                        <Button size="small" variant="contained" color="error" disabled={busyCode === row.code} onClick={() => handleReject(row)} sx={{ py: 0.25, px: 1.25, fontSize: 11.5, minWidth: 0 }}>{reject.isPending && busyCode === row.code ? "Rejecting…" : "Reject"}</Button>
                      </Stack></TableCell>
                    </TableRow>
                  );
                })}</TableBody>
              </Table>
            </TableContainer>
            <TablePagination component="div" count={filteredRows.length} page={page} onPageChange={(_, nextPage) => setPage(nextPage)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(event) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); }} rowsPerPageOptions={[10, 20, 50]} labelDisplayedRows={({ from, to, count }) => `Showing ${from}-${to} of ${count}`} />
            <Box sx={{ px: 2, py: 1.5 }}><DbSourceNote>{filteredRows.length} custom submissions awaiting approval</DbSourceNote></Box>
          </>
        )}
      </Card>

      <Dialog open={Boolean(confirmAction)} onClose={closeConfirm} maxWidth="xs" fullWidth>
        <DialogTitle>{confirmAction?.type === "approve" ? "Approve exercise?" : "Reject exercise?"}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmAction?.type === "approve"
              ? `Approve “${confirmAction?.row.name}” and add it to the active exercise list?`
              : `Reject “${confirmAction?.row.name}”? You will have 10 seconds to undo before its status is changed to rejected.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirm}>Cancel</Button>
          <Button color={confirmAction?.type === "reject" ? "error" : "primary"} variant="contained" onClick={confirmModerationAction}>
            {confirmAction?.type === "reject" ? "Reject" : "Approve"}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={Boolean(undoNotice)} message={`“${undoNotice?.row.name}” will be removed in ${undoNotice?.seconds}s`} action={<Button color="inherit" size="small" onClick={undoReject}>Undo</Button>} />
    </Box>
  );
}
