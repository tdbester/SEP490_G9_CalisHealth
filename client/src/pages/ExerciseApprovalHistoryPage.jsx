import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Avatar, Box, Button, Card, InputAdornment, MenuItem, Stack, Tab, Tabs, Table,
  TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow,
  TextField, Typography,
} from "@mui/material";
import { keyframes } from "@mui/material/styles";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { contentManagerApi } from "../api/contentManager";
import { useApiQuery } from "../hooks";
import { useLevelNames } from "../useLevelNames";
import { CONTENT_PATHS, ContentPageHeader, DarkPill, formatDateTime, SummaryCard } from "../components/ContentShared";
import ContentDataCard, { DbSourceNote, EmptyState, HEAD_ROW_SX } from "../components/ContentDataCard";
import { CM } from "../theme-content";
import { getLevelBadgeStyle } from "../utils/levelBadge";

const rise = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;
const enter = (delay = 0) => ({
  animation: `${rise} .45s ease-out ${delay}ms both`,
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
});

function initials(value) {
  return String(value || "Unknown").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function FitnessIconSmall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M3 9v6m3-9v12m12-12v12m3-9v6M6 12h12" />
    </svg>
  );
}

const dateFilterSx = {
  "& .MuiInputLabel-root": { color: "#c5cbd5" },
  "& .MuiInputLabel-root.Mui-focused": { color: "#8dd8c5" },
  "& .MuiOutlinedInput-root": {
    color: "#f4f6f8",
    bgcolor: "rgba(255,255,255,0.045)",
    "& fieldset": { borderColor: "rgba(203,213,225,0.42)" },
    "&:hover fieldset": { borderColor: "rgba(203,213,225,0.75)" },
    "&.Mui-focused fieldset": { borderColor: "#65c9ad", borderWidth: 1 },
  },
  "& input": { colorScheme: "dark", minHeight: 22 },
  "& input::-webkit-calendar-picker-indicator": {
    filter: "invert(0.9)",
    cursor: "pointer",
  },
};

const DECISION_TABS = [
  { value: "all", label: "All decisions" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

export default function ExerciseApprovalHistoryPage() {
  const query = useApiQuery(() => contentManagerApi.exerciseApprovalHistory());
  const { levelTone } = useLevelNames();
  const rows = Array.isArray(query.data)
    ? query.data.filter((row) => row.decision === "APPROVED" || row.decision === "REJECTED")
    : [];
  const [decision, setDecision] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const historyDetailPath = (row) => `${CONTENT_PATHS.exercises}/moderation/${encodeURIComponent(row.code)}`;

  const approvedCount = rows.filter((row) => row.decision === "APPROVED").length;
  const rejectedCount = rows.filter((row) => row.decision === "REJECTED").length;
  const totalDecisions = approvedCount + rejectedCount;
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const fromTimestamp = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toTimestamp = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;
    return rows
      .filter((row) => decision === "all" || row.decision === decision)
      .filter((row) => {
        const reviewedAt = new Date(row.reviewedAt || 0).getTime();
        return (!fromTimestamp || reviewedAt >= fromTimestamp) && (!toTimestamp || reviewedAt <= toTimestamp);
      })
      .filter((row) => !term || [row.name, row.code, row.createdByName, row.muscleGroup, row.level]
        .some((value) => String(value || "").toLowerCase().includes(term)))
      .sort((first, second) => {
        const delta = new Date(first.reviewedAt || 0).getTime() - new Date(second.reviewedAt || 0).getTime();
        return sort === "oldest" ? delta : -delta;
      });
  }, [rows, decision, search, sort, fromDate, toDate]);
  const visibleRows = filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const updateFilter = (setter) => (event) => { setter(event.target.value); setPage(0); };

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2.5, sm: 3 } }}>
      <ContentPageHeader
        breadcrumb={[
          { label: "Content manager", to: CONTENT_PATHS.dashboard },
          { label: "Exercise & workout management", to: CONTENT_PATHS.exercises },
          { label: "Approval history" },
        ]}
        title="Exercise approval history"
        description="Review approved and rejected custom exercises. Pending submissions remain in Pending moderation."
        action={<Button component={RouterLink} to={CONTENT_PATHS.pendingExerciseModeration} variant="outlined" startIcon={<ArrowBackRoundedIcon />}>Back to pending</Button>}
      />

      <Box component="section" aria-label="Approval history summary" sx={{ mt: 2.5, display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" } }}>
        <Box sx={enter(0)}><SummaryCard label="Total decisions" count={totalDecisions} detail="exercises" /></Box>
        <Box sx={enter(80)}><SummaryCard label="Approved" tone="success" count={approvedCount} detail="exercises" /></Box>
        <Box sx={enter(160)}><SummaryCard label="Rejected" tone="warning" count={rejectedCount} detail="exercises" /></Box>
      </Box>

      <Card sx={{ mt: 2.5, overflow: "hidden", ...enter(220) }}>
        <Tabs value={decision} onChange={(_, value) => { setDecision(value); setPage(0); }} variant="scrollable" scrollButtons="auto" sx={{ px: 1.5, borderBottom: `1px solid ${CM.border}`, "& .MuiTab-root": { minHeight: 48, textTransform: "none", fontWeight: 600 } }}>
          {DECISION_TABS.map((tab) => <Tab key={tab.value} value={tab.value} label={tab.label} />)}
        </Tabs>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }} sx={{ p: 1.5, borderBottom: `1px solid ${CM.border}` }}>
          <TextField size="small" fullWidth value={search} onChange={updateFilter(setSearch)} placeholder="Search exercise or submitter" inputProps={{ "aria-label": "Search approval history" }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" color="disabled" /></InputAdornment> }} sx={{ flex: 1, minWidth: 220 }} />
          <TextField size="small" type="date" label="From" value={fromDate} onChange={(event) => { const nextFromDate = event.target.value; setFromDate(nextFromDate); if (toDate && nextFromDate && toDate < nextFromDate) setToDate(nextFromDate); setPage(0); }} InputLabelProps={{ shrink: true }} inputProps={{ max: toDate || undefined, "aria-label": "Reviewed from date" }} sx={{ ...dateFilterSx, minWidth: { xs: "100%", md: 155 } }} />
          <TextField size="small" type="date" label="To" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(0); }} InputLabelProps={{ shrink: true }} inputProps={{ min: fromDate || undefined, "aria-label": "Reviewed to date" }} sx={{ ...dateFilterSx, minWidth: { xs: "100%", md: 155 } }} />
          <TextField select size="small" value={sort} onChange={updateFilter(setSort)} SelectProps={{ SelectDisplayProps: { "aria-label": "Sort approval history" } }} sx={{ minWidth: 150 }}>
            <MenuItem value="newest">Newest first</MenuItem><MenuItem value="oldest">Oldest first</MenuItem>
          </TextField>
        </Stack>

        <ContentDataCard query={query} title="approval history">
          {filteredRows.length === 0 ? <EmptyState message={rows.length ? "No decisions match these filters." : "No approval decisions found."} /> : (
            <>
              <TableContainer>
                <Table size="small" sx={{ minWidth: 980 }}>
                  <TableHead><TableRow sx={HEAD_ROW_SX}>
                    <TableCell sx={{ textAlign: "left !important", pl: 3 }}>Exercise</TableCell><TableCell>Uploaded by</TableCell><TableCell>Muscle group</TableCell><TableCell>Level</TableCell><TableCell>Decision</TableCell><TableCell>Reviewed</TableCell><TableCell align="center">Action</TableCell>
                  </TableRow></TableHead>
                  <TableBody>{visibleRows.map((row, idx) => (
                    <TableRow key={row.id} hover sx={{
                      transition: "all .2s ease",
                      "&:hover": { bgcolor: "rgba(139,92,246,0.06)" },
                      ...enter(240 + idx * 25),
                    }}>
                      <TableCell sx={{ textAlign: "left !important", pl: 3, "& > .MuiStack-root": { justifyContent: "flex-start" } }}><Stack direction="row" spacing={1.25} alignItems="center"><Box sx={{ width: 32, height: 32, borderRadius: 1.5, display: "grid", placeItems: "center", flexShrink: 0, bgcolor: "rgba(168,155,208,0.14)", color: CM.textMuted }}><FitnessIconSmall /></Box><Box sx={{ minWidth: 0, textAlign: "left" }}><Typography variant="body2" fontWeight={600} sx={{ color: "#fff" }}>{row.name}</Typography><Typography variant="caption" sx={{ color: CM.textDim }}>{row.code}</Typography></Box></Stack></TableCell>
                      <TableCell><Stack direction="row" spacing={1} alignItems="center"><Avatar sx={{ width: 28, height: 28, fontSize: 11, fontWeight: 700, bgcolor: "rgba(65,201,173,0.2)", color: "#8dd8c5" }}>{initials(row.createdByName)}</Avatar><Typography variant="caption" sx={{ color: CM.textMuted }}>{row.createdByName || "Unknown"}</Typography></Stack></TableCell>
                      <TableCell><Typography variant="caption" sx={{ color: CM.textMuted }}>{row.muscleGroup || "—"}</Typography></TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${getLevelBadgeStyle(row.level)}`}>
                          {row.level || "Intermediate"}
                        </span>
                      </TableCell>
                      <TableCell><DarkPill tone={row.decision === "APPROVED" ? "success" : "danger"}>{row.decision === "APPROVED" ? "Approved" : "Rejected"}</DarkPill></TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}><Typography variant="caption" sx={{ color: CM.textDim }}>{formatDateTime(row.reviewedAt)}</Typography></TableCell>
                      <TableCell align="center"><Button component={RouterLink} to={historyDetailPath(row)} state={{ historyRow: row }} size="small" variant="outlined" sx={{ py: 0.25, px: 1.25, fontSize: 11.5 }}>View</Button></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </TableContainer>
              <TablePagination component="div" count={filteredRows.length} page={page} onPageChange={(_, nextPage) => setPage(nextPage)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(event) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); }} rowsPerPageOptions={[10, 20, 50]} labelDisplayedRows={({ from, to, count }) => `Showing ${from}-${to} of ${count}`} />
              <Box sx={{ px: 2, py: 1.5 }}><DbSourceNote>{filteredRows.length} moderation decisions</DbSourceNote></Box>
            </>
          )}
        </ContentDataCard>
      </Card>
    </Box>
  );
}
