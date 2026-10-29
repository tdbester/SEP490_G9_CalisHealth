import { useMemo, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Alert, Box, Button, Card, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  IconButton, InputAdornment, Menu, MenuItem,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/KeyboardArrowUpRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { contentManagerApi } from "../api/contentManager";
import { useApiMutation, useApiQuery } from "../hooks";
import { buildLevelToneMap } from "../useLevelNames";
import { CONTENT_PATHS, ContentPageHeader, DarkPill, formatDate } from "../components/ContentShared";
import { CM } from "../theme-content";

const MAX_EXERCISES = 8;
const unitOf = (category) => category === "HOLD" ? "seconds" : "reps";
const PAGE_SIZE = 5;
const BREADCRUMB = [
  { label: "Admin", to: CONTENT_PATHS.dashboard },
  { label: "Assessment System", to: CONTENT_PATHS.dashboard },
  { label: "Level & Benchmark Criteria" },
];

const statusText = (value) => value === "ACTIVE" ? "Active" : "Inactive";
const statusTone = (value) => value === "ACTIVE" ? "success" : "neutral";
const scoreRange = (row) => `${row.scoreMin} - ${row.scoreMax} pts`;
// Every exercise is worth 1-3 points, so N exercises give a total score of N..3N.
const scoreFloor = (exerciseCount) => Math.max(exerciseCount, 1);
const scoreCeiling = (exerciseCount) => scoreFloor(exerciseCount) * 3;
// Levels are kept in display order (tier 1 first). Minimum score is derived from the previous level's
// maximum, the first level always starts at the floor and the last always ends at the ceiling.
const normalizeLevels = (levels, floor, ceiling) => {
  let nextMin = floor;
  return levels.map((level, index) => {
    const scoreMax = index === levels.length - 1 ? ceiling : level.scoreMax;
    const max = Number(scoreMax);
    const next = { ...level, scoreMin: nextMin, scoreMax };
    if (scoreMax !== "" && Number.isInteger(max)) nextMin = max + 1;
    return next;
  });
};
// Moves one level; every level keeps its own width, so the ranges are re-laid out back to back.
// Re-fits the levels after the number of exercises (and so the score range) changed: widths are kept where
// they fit, every level keeps at least one point and the last level absorbs the difference.
const refitLevels = (levels, floor, ceiling) => {
  let max = floor - 1;
  const fitted = levels.map((level, index) => {
    const size = Number(level.scoreMax) - Number(level.scoreMin) + 1;
    const width = Number.isInteger(size) && size > 0 ? size : 1;
    max = index === levels.length - 1 ? ceiling : Math.min(max + width, ceiling - (levels.length - 1 - index));
    return { ...level, scoreMax: max };
  });
  return normalizeLevels(fitted, floor, ceiling);
};
const moveLevel = (levels, from, to, floor) => {
  if (from === to || from < 0 || to < 0 || from >= levels.length || to >= levels.length) return levels;
  const sizes = levels.map((level) => {
    const size = Number(level.scoreMax) - Number(level.scoreMin) + 1;
    return Number.isInteger(size) && size > 0 ? size : 1;
  });
  const order = levels.map((_, index) => index);
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  let max = floor - 1;
  return order.map((index) => { max += sizes[index]; return { ...levels[index], scoreMax: max }; });
};
const widthOf = (level) => {
  const size = Number(level.scoreMax) - Number(level.scoreMin) + 1;
  return Number.isInteger(size) && size > 0 ? size : 1;
};
// Lays the levels out back to back from the floor using the given widths; the last one ends at the ceiling.
const layoutLevels = (levels, widths, floor, ceiling) => {
  let max = floor - 1;
  return normalizeLevels(levels.map((level, index) => { max += widths[index]; return { ...level, scoreMax: max }; }), floor, ceiling);
};
// Adds a level on top. Like the backend, the widest level (highest on ties) gives up one point to it.
const addLevelRow = (levels, rowKey, floor, ceiling) => {
  const widths = levels.map(widthOf);
  let widest = 0;
  widths.forEach((width, index) => { if (width >= widths[widest]) widest = index; });
  widths[widest] -= 1;
  return layoutLevels([...levels, { id: rowKey, name: "", status: "ACTIVE", isNew: true }], [...widths, 1], floor, ceiling);
};
// Removes a level; its points go to the level before it (or the next one when it was first).
const removeLevelRow = (levels, id, floor, ceiling) => {
  const index = levels.findIndex((level) => level.id === id);
  if (index < 0 || levels.length <= 1) return levels;
  const widths = levels.map(widthOf);
  widths[index > 0 ? index - 1 : 1] += widths[index];
  return layoutLevels(levels.filter((_, i) => i !== index), widths.filter((_, i) => i !== index), floor, ceiling);
};
const validateLevelNames = (levels) => {
  const names = levels.map((level) => String(level.name || "").trim().toLowerCase());
  return [
    ...(names.some((name) => !name) ? ["Every level needs a name."] : []),
    ...(new Set(names.filter(Boolean)).size !== names.filter(Boolean).length ? ["Level names must be unique."] : []),
    ...(levels.length && levels.every((level) => level.status !== "ACTIVE") ? ["At least one level must stay active."] : []),
  ];
};
const validateScoreRanges = (levels, ceiling) => levels.flatMap((level) => {
  const min = Number(level.scoreMin);
  const max = Number(level.scoreMax);
  if (level.scoreMax === "" || !Number.isInteger(max)) return [`${level.name || "Level"}: enter a whole number for the maximum score.`];
  if (max < min) return [`${level.name || "Level"}: maximum score must be at least ${min}.`];
  if (max > ceiling) return [`${level.name || "Level"}: maximum score cannot exceed ${ceiling}.`];
  return [];
});
const validateThresholds = (rules) => {
  const errors = rules.flatMap((rule, index) => {
    const label = `Exercise ${index + 1}`;
    const onePoint = Number(rule.beginnerMax);
    const twoPoints = Number(rule.intermediateMax);
    if (!rule.code) return [`${label}: choose an exercise.`];
    return !Number.isFinite(onePoint) || onePoint < 1 || !Number.isFinite(twoPoints) || twoPoints <= onePoint
      ? [`${label}: the 2-point limit must be greater than the 1-point limit.`]
      : [];
  });
  const duplicate = (field, message) => new Set(rules.map((rule) => rule[field]).filter(Boolean)).size !== rules.filter((rule) => rule[field]).length ? [message] : [];
  return [...errors, ...duplicate("code", "Each exercise can only be added once.")];
};
// Points are per exercise, not per level: the same two cut-offs apply whichever level the total lands in.
// Returns the text of the 1 / 2 / 3 point cells for one exercise.
const pointBands = (rule) => {
  const unit = rule.category === "HOLD" ? "sec" : "reps";
  const onePoint = Number(rule.beginnerMax);
  const twoPoints = Number(rule.intermediateMax);
  if (!Number.isFinite(onePoint) || !Number.isFinite(twoPoints)) return ["—", "—", "—"];
  return [`≤ ${onePoint} ${unit}`, `${onePoint + 1} – ${twoPoints} ${unit}`, `> ${twoPoints} ${unit}`];
};
const POINT_COLUMNS = [
  { label: "1 point", color: CM.amber },
  { label: "2 points", color: CM.violetBright },
  { label: "3 points", color: CM.green },
];

function PointRules({ rules }) {
  if (!rules.length) return <Typography variant="body2" sx={{ color: CM.textMuted, p: 2 }}>No benchmark exercise is configured yet.</Typography>;
  return <TableContainer>
    <Table size="small" sx={{ minWidth: 640 }}>
      <TableHead>
        <TableRow>
          <TableCell sx={{ width: 56 }}>#</TableCell>
          <TableCell>Exercise</TableCell>
          <TableCell>Measured in</TableCell>
          {POINT_COLUMNS.map((column) => <TableCell key={column.label}>{column.label}</TableCell>)}
        </TableRow>
      </TableHead>
      <TableBody>{rules.map((rule, index) => {
        const bands = pointBands(rule);
        return <TableRow hover key={rule.code}>
          <TableCell><Typography variant="caption" sx={{ color: CM.textDim, fontWeight: 700 }}>{index + 1}</Typography></TableCell>
          <TableCell><Typography sx={{ color: "#fff", fontWeight: 600 }}>{rule.name}</Typography></TableCell>
          <TableCell><DarkPill tone={rule.category === "HOLD" ? "primary" : "neutral"}>{rule.category === "HOLD" ? "Hold (seconds)" : "Reps"}</DarkPill></TableCell>
          {bands.map((text, bandIndex) => <TableCell key={POINT_COLUMNS[bandIndex].label}>
            <Stack direction="row" spacing={0.9} alignItems="center">
              <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: POINT_COLUMNS[bandIndex].color, flexShrink: 0 }} />
              <Typography variant="body2" sx={{ color: "#fff", whiteSpace: "nowrap" }}>{text}</Typography>
            </Stack>
          </TableCell>)}
        </TableRow>;
      })}</TableBody>
    </Table>
  </TableContainer>;
}

function Heading({ title, description, action, breadcrumb = BREADCRUMB }) {
  return <ContentPageHeader breadcrumb={breadcrumb} title={title} description={description} action={action} />;
}

function SummaryMetric({ label, count, caption, tone }) {
  const color = tone === "success" ? CM.green : tone === "warning" ? CM.amber : CM.violetBright;
  return <Box sx={{ px: 2, py: 1.6, border: `1px solid ${CM.border}`, borderRadius: 1.5, bgcolor: CM.surface, textAlign: "center" }}><Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center"><Box sx={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, bgcolor: color, boxShadow: `0 0 10px ${color}` }} /><Typography variant="caption" sx={{ color: CM.textMuted, fontWeight: 600 }}>{label}</Typography></Stack><Typography sx={{ color: "#fff", fontSize: 36, fontWeight: 800, lineHeight: 1.15 }}>{count}</Typography><Typography variant="caption" sx={{ color: CM.textDim }}>{caption}</Typography></Box>;
}

export default function LevelBenchmarkCriteriaPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const query = useApiQuery(() => contentManagerApi.levelBenchmarkConfiguration());
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [menu, setMenu] = useState({ anchor: null, entry: null });
  const statusMutation = useApiMutation(({ level, nextStatus }) => contentManagerApi.updateLevelBenchmarkStatus(level, nextStatus), { onSuccess: query.refetch });
  const levels = query.data?.levels || [];
  const rules = query.data?.exercises || [];
  // One colour per level, by position in the score order, so a newly created level never repeats an existing colour.
  const toneMap = useMemo(() => buildLevelToneMap([...levels].sort((a, b) => a.scoreMin - b.scoreMin).map((x) => x.name || x.level)), [levels]);
  const levelTone = (name) => toneMap.get(String(name || "").trim().toLowerCase()) ?? "neutral";
  const filtered = useMemo(() => levels.filter((row) => {
    const term = search.trim().toLowerCase();
    return (!term || row.name?.toLowerCase().includes(term) || row.level?.toLowerCase().includes(term))
      && (status === "all" || row.status.toLowerCase() === status);
  }), [levels, search, status]);
  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(0, pages - 1));
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const closeMenu = () => setMenu({ anchor: null, entry: null });
  const [deleting, setDeleting] = useState(null);
  const deleteMutation = useApiMutation((id) => contentManagerApi.deleteLevelBenchmark(id), {
    onSuccess: () => { setDeleting(null); setNotice("Level deleted."); query.refetch(); },
  });
  const [notice, setNotice] = useState("");

  if (query.isLoading) return <Box sx={{ py: 10, display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
  if (query.error) return <Box sx={{ p: 3 }}><Heading title="Benchmark criteria unavailable" description={query.error.message} /><Button onClick={query.refetch} sx={{ mt: 2 }} variant="outlined">Retry</Button></Box>;

  return <Box sx={{ maxWidth: 1440, mx: "auto", px: { xs: 2, sm: 3, xl: 4 }, py: 2.5 }}>
    <Heading title="Calisthenics Level Benchmark Criteria" description="Manage levels and the shared exercise thresholds used by the Onboarding Level Test." />
    <Box sx={{ mt: 2.5, display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" } }}><SummaryMetric label="Total Levels" count={levels.length} caption="configured levels" /><SummaryMetric label="Active" count={levels.filter((x) => x.status === "ACTIVE").length} caption="live levels" tone="success" /><SummaryMetric label="Inactive" count={levels.filter((x) => x.status === "INACTIVE").length} caption="hidden levels" tone="warning" /></Box>
    {location.state?.successMessage && <Alert sx={{ mt: 2 }} severity="success" onClose={() => navigate(location.pathname, { replace: true, state: null })}>{location.state.successMessage}</Alert>}
    {notice && <Alert sx={{ mt: 2 }} severity="success" onClose={() => setNotice("")}>{notice}</Alert>}
    <Card sx={{ mt: 2.25, overflow: "hidden" }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} sx={{ p: 2, borderBottom: `1px solid ${CM.border}` }}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "stretch", lg: "center" }} sx={{ width: "100%" }}>
          <Box><Typography sx={{ color: "#fff", fontWeight: 700 }}>Benchmark Criteria</Typography><Typography variant="caption" sx={{ color: CM.textMuted }}>Each exercise contributes 1, 2, or 3 points to the total score.</Typography></Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
            <TextField size="small" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search level or benchmark" sx={{ width: { xs: "100%", sm: 460, md: 560, lg: 640 } }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }} />
            <TextField select size="small" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} sx={{ minWidth: 145 }}><MenuItem value="all">All Status</MenuItem><MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem></TextField>
            <Button component={RouterLink} to={`${CONTENT_PATHS.levelCriteria}/edit`} variant="contained" size="small">Update</Button>
            <Tooltip title="Refresh"><span><IconButton onClick={query.refetch} disabled={query.isFetching} sx={{ border: `1px solid ${CM.border}`, borderRadius: 1.25 }}>{query.isFetching ? <CircularProgress size={17} /> : <RefreshRoundedIcon />}</IconButton></span></Tooltip>
          </Stack>
        </Stack>
      </Stack>
      <TableContainer><Table size="small" sx={{ minWidth: 900 }}><TableHead><TableRow><TableCell>Level / Tier</TableCell><TableCell>Score Range</TableCell><TableCell>Scoring Formula</TableCell><TableCell>Status</TableCell><TableCell>Updated</TableCell><TableCell align="center">Action</TableCell></TableRow></TableHead><TableBody>{visible.map((row, index) => <TableRow hover key={row.id}><TableCell><Stack spacing={0.5} alignItems="center"><DarkPill tone={levelTone(row.name || row.level)}>{row.name || row.level}</DarkPill><Typography variant="caption" sx={{ color: CM.textDim }}>TIER {currentPage * PAGE_SIZE + index + 1}</Typography></Stack></TableCell><TableCell><Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 20, lineHeight: 1.2 }}>{scoreRange(row)}</Typography><Typography variant="caption" sx={{ color: CM.textDim }}>Total score</Typography></TableCell><TableCell><Typography variant="body2" sx={{ color: "#fff" }}>Exercise points sum</Typography><Typography variant="caption" sx={{ color: CM.textMuted }}>{rules.length ? rules.map((rule) => rule.name).join(" + ") : "No exercise configured"}</Typography></TableCell><TableCell><DarkPill tone={statusTone(row.status)}>{statusText(row.status)}</DarkPill></TableCell><TableCell><Typography variant="caption" display="block" sx={{ color: CM.textMuted }}>{formatDate(row.updatedAt)}</Typography><Typography variant="caption" sx={{ color: CM.textDim }}>by {row.updatedBy || "System"}</Typography></TableCell><TableCell align="center"><Stack direction="row" justifyContent="center" alignItems="center"><Button component={RouterLink} to={`${CONTENT_PATHS.levelCriteria}/${row.id}`} size="small" variant="outlined">View</Button><IconButton size="small" onClick={(e) => setMenu({ anchor: e.currentTarget, entry: row })}><MoreVertRoundedIcon fontSize="small" /></IconButton></Stack></TableCell></TableRow>)}{!visible.length && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}>No benchmark levels match the current filters.</TableCell></TableRow>}</TableBody></Table></TableContainer>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1.5, borderTop: `1px solid ${CM.border}` }}><Typography variant="caption" sx={{ color: CM.textMuted }}>Showing {filtered.length ? currentPage * PAGE_SIZE + 1 : 0}-{Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</Typography><Stack direction="row"><IconButton disabled={currentPage === 0} onClick={() => setPage((x) => x - 1)}><ChevronLeftRoundedIcon /></IconButton><IconButton disabled={!pages || currentPage >= pages - 1} onClick={() => setPage((x) => x + 1)}><ChevronRightRoundedIcon /></IconButton></Stack></Stack>
    </Card>
    <Card sx={{ mt: 2.25, overflow: "hidden" }}>
      <Box sx={{ p: 2, borderBottom: `1px solid ${CM.border}` }}>
        <Typography sx={{ color: "#fff", fontWeight: 700 }}>Exercise point rules</Typography>
        <Typography variant="caption" sx={{ color: CM.textMuted }}>Every level is decided by the same {rules.length || ""} exercise{rules.length === 1 ? "" : "s"}. Each one scores 1, 2, or 3 points from the member's survey result; the total picks the level.</Typography>
      </Box>
      <PointRules rules={rules} />
    </Card>
    <Menu anchorEl={menu.anchor} open={Boolean(menu.anchor)} onClose={closeMenu}><MenuItem onClick={() => { if (menu.entry) statusMutation.mutate({ level: menu.entry.name || menu.entry.level, nextStatus: menu.entry.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }); closeMenu(); }}>{menu.entry?.status === "ACTIVE" ? "Deactivate" : "Activate"}</MenuItem><MenuItem disabled={levels.length <= 1} sx={{ color: "error.main" }} onClick={() => { deleteMutation.reset(); setDeleting(menu.entry); closeMenu(); }}>Delete</MenuItem></Menu>
    <Dialog open={Boolean(deleting)} onClose={() => !deleteMutation.isPending && setDeleting(null)}>
      <DialogTitle>Delete level?</DialogTitle>
      <DialogContent>
        <DialogContentText>"{deleting?.name || deleting?.level}" will be removed and its score range ({deleting ? scoreRange(deleting) : ""}) is given to the neighbouring level. Levels still used by members, exercises or workouts cannot be deleted; deactivate them instead.</DialogContentText>
        {deleteMutation.error && <Alert severity="error" sx={{ mt: 2 }}>{deleteMutation.error.message}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDeleting(null)} disabled={deleteMutation.isPending}>Cancel</Button>
        <Button color="error" variant="contained" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleting.id)}>{deleteMutation.isPending ? "Deleting…" : "Delete"}</Button>
      </DialogActions>
    </Dialog>
  </Box>;
}

export function LevelBenchmarkDetailPage() {
  const { id } = useParams();
  const query = useApiQuery(() => contentManagerApi.levelBenchmarkConfiguration());
  const row = query.data?.levels?.find((x) => String(x.id) === String(id));
  const rules = query.data?.exercises || [];
  const memberLevels = useApiQuery(() => contentManagerApi.memberLevels());
  if (!row) return <Box sx={{ p: 3 }}><Heading title={query.isLoading ? "Loading…" : "Benchmark not found"} description="" /><Button component={RouterLink} to={CONTENT_PATHS.levelCriteria} variant="outlined">Back</Button></Box>;
  const sorted = [...(query.data?.levels || [])].sort((a, b) => a.scoreMin - b.scoreMin);
  const tier = sorted.findIndex((x) => String(x.id) === String(id)) + 1;
  const name = row.name || row.level;
  const minTotal = rules.length;
  const maxTotal = rules.length * 3;
  const totals = Array.from({ length: Math.max(0, maxTotal - minTotal + 1) }, (_, i) => minTotal + i);
  const memberCount = Number((memberLevels.data || []).find((x) => String(x.level).toLowerCase() === String(name).toLowerCase())?.memberCount ?? 0);
  const allMembers = (memberLevels.data || []).reduce((sum, x) => sum + Number(x.memberCount || 0), 0);
  const memberShare = allMembers ? Math.round((memberCount / allMembers) * 100) : 0;
  const actions = <Stack direction="row" spacing={1}>
    <Button component={RouterLink} to={CONTENT_PATHS.levelCriteria} variant="outlined" startIcon={<ArrowBackRoundedIcon />}>Back</Button>
    <Button component={RouterLink} to={`${CONTENT_PATHS.levelCriteria}/edit`} variant="contained">Update</Button>
  </Stack>;
  return <Box sx={{ maxWidth: 1100, mx: "auto", px: 3, py: 2.5 }}>
    <Heading breadcrumb={[...BREADCRUMB.slice(0, -1), { label: "Level & Benchmark Criteria", to: CONTENT_PATHS.levelCriteria }, { label: name }]} title={name} description="Benchmark level details" action={actions} />
    <Box sx={{ mt: 2.5, display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" } }}>
      <Detail label="Tier" value={`Tier ${tier} of ${sorted.length}`} />
      <Detail label="Score range" value={scoreRange(row)} />
      <Detail label="Members" value={memberLevels.isLoading ? "…" : memberCount.toLocaleString()} hint={memberLevels.error ? "Unavailable" : `${memberShare}% of all members`} />
      <Detail label="Last updated" value={formatDate(row.updatedAt)} hint={`by ${row.updatedBy || "System"}`} />
    </Box>
    <Card sx={{ mt: 2.25, overflow: "hidden" }}>
      <Box sx={{ p: 2, borderBottom: `1px solid ${CM.border}` }}>
        <Typography sx={{ color: "#fff", fontWeight: 700 }}>How a member reaches {name}</Typography>
        {rules.length ? <>
          <Stack direction="row" spacing={1.25} alignItems="baseline" flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
            <Typography sx={{ color: CM.violetBright, fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{row.scoreMin} – {row.scoreMax} pts</Typography>
            <Typography variant="body2" sx={{ color: CM.textMuted }}>total score out of {maxTotal}</Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: CM.textMuted, mt: 0.75 }}>
            Each of the {rules.length} exercise{rules.length === 1 ? "" : "s"} below scores 1, 2, or 3 points. Add them up: a member whose total is {row.scoreMin}–{row.scoreMax} is placed in {name}.
          </Typography>
          <Box sx={{ mt: 1.5, display: "flex", gap: 0.5, flexWrap: "wrap" }} role="img" aria-label={`Total scores ${minTotal} to ${maxTotal}; ${name} covers ${row.scoreMin} to ${row.scoreMax}`}>
            {totals.map((total) => {
              const inLevel = total >= row.scoreMin && total <= row.scoreMax;
              return <Box key={total} sx={{ minWidth: 34, px: 0.75, py: 0.5, textAlign: "center", borderRadius: 1, fontSize: 13, fontWeight: 700, color: inLevel ? "#fff" : CM.textDim, bgcolor: inLevel ? CM.violetBright : "transparent", border: `1px solid ${inLevel ? CM.violetBright : CM.border}` }}>{total}</Box>;
            })}
          </Box>
        </> : <Typography variant="caption" sx={{ color: CM.textMuted }}>No benchmark exercise is configured yet.</Typography>}
      </Box>
      <PointRules rules={rules} />
    </Card>
  </Box>;
}
function LevelEditor({ levels, floor, ceiling, canRemove, removeHint, onChange, onMove, onRemove }) {
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const endDrag = () => { setDragIndex(null); setOverIndex(null); };
  return <Stack spacing={1.5} sx={{ mt: 1.5 }}>{levels.map((level, index) => {
    const isLast = index === levels.length - 1;
    return <Box
      key={level.id}
      data-level-row
      onDragOver={(e) => { if (dragIndex === null) return; e.preventDefault(); setOverIndex(index); }}
      onDrop={(e) => { e.preventDefault(); if (dragIndex !== null) onMove(dragIndex, index); endDrag(); }}
      sx={{ display: "grid", gap: 1, alignItems: "start", gridTemplateColumns: { xs: "1fr", md: "auto 1.4fr 1fr 1fr 1fr auto" }, p: 1.5, border: `1px solid ${overIndex === index && dragIndex !== null && dragIndex !== index ? CM.violetBright : CM.border}`, borderRadius: 1, opacity: dragIndex === index ? 0.5 : 1 }}
    >
      <Stack direction="row" alignItems="center" spacing={0.25} sx={{ pt: 0.75 }}>
        <Tooltip title="Drag to reorder"><Box
          component="span"
          draggable
          aria-label={`Drag ${level.name || "level"} to reorder`}
          onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(index)); const row = e.currentTarget.closest("[data-level-row]"); if (row) e.dataTransfer.setDragImage(row, 16, 16); setDragIndex(index); }}
          onDragEnd={endDrag}
          sx={{ display: "inline-flex", cursor: "grab", color: CM.textMuted, "&:active": { cursor: "grabbing" } }}
        ><DragIndicatorRoundedIcon /></Box></Tooltip>
        <Stack>
          <IconButton size="small" aria-label={`Move ${level.name || "level"} up`} disabled={index === 0} onClick={() => onMove(index, index - 1)} sx={{ p: 0 }}><KeyboardArrowUpRoundedIcon fontSize="small" /></IconButton>
          <IconButton size="small" aria-label={`Move ${level.name || "level"} down`} disabled={isLast} onClick={() => onMove(index, index + 1)} sx={{ p: 0 }}><KeyboardArrowDownRoundedIcon fontSize="small" /></IconButton>
        </Stack>
      </Stack>
      <TextField label="Level name" value={level.name} helperText=" " onChange={(e) => onChange(level.id, "name", e.target.value)} />
      <TextField disabled type="number" label="Minimum score" value={level.scoreMin} helperText={index === 0 ? `Always starts at ${floor}` : "Previous maximum + 1"} />
      <TextField disabled={isLast} type="number" label="Maximum score" value={level.scoreMax} onChange={(e) => onChange(level.id, "scoreMax", e.target.value)} helperText={isLast ? `Always ends at ${ceiling}` : " "} inputProps={{ min: level.scoreMin, max: ceiling }} />
      <TextField select label="Status" value={level.status} onChange={(e) => onChange(level.id, "status", e.target.value)}><MenuItem value="ACTIVE">Active</MenuItem><MenuItem value="INACTIVE">Inactive</MenuItem></TextField>
      <Tooltip title={canRemove ? "Remove level" : removeHint}><span><IconButton size="small" color="error" aria-label={`Remove level ${index + 1}`} disabled={!canRemove} onClick={() => onRemove(level.id)} sx={{ mt: 0.75 }}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
    </Box>;
  })}</Stack>;
}
// The same exercises and cut-offs score every member whichever level they end up in, so the fields are named
// by points (1 / 2 / 3), never by level.
function ExerciseEditor({ rules, exerciseOptions, canAdd, canRemove, minExercises, floor, ceiling, errors, onAdd, onRemove, onChooseExercise, onChange }) {
  return <Box sx={{ mt: 3 }}>
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={1}>
      <Box>
        <Typography sx={{ color: "#fff", fontWeight: 700 }}>Exercises and thresholds</Typography>
        <Typography variant="caption" sx={{ color: CM.textMuted }}>Shared by every level. Each exercise scores 1, 2, or 3 points from the member's survey result; {rules.length} exercise{rules.length === 1 ? "" : "s"} give a total of {floor}-{ceiling} points.</Typography>
      </Box>
      <Tooltip title={canAdd ? "" : `At most ${MAX_EXERCISES} exercises`}><span><Button variant="outlined" size="small" startIcon={<AddRoundedIcon />} disabled={!canAdd} onClick={onAdd}>Add exercise</Button></span></Tooltip>
    </Stack>
    {errors.map((error) => <Alert key={error} severity="error" sx={{ mt: 1.5 }}>{error}</Alert>)}
    {!rules.length && <Alert severity="info" sx={{ mt: 1.5 }}>No exercise yet. Add one to score members.</Alert>}
    <Stack spacing={1.5} sx={{ mt: 1.5 }}>{rules.map((rule, index) => {
      const unit = unitOf(rule.category);
      const onePoint = Number(rule.beginnerMax);
      const twoPointsFrom = Number.isFinite(onePoint) && onePoint >= 1 ? onePoint + 1 : "";
      const picked = exerciseOptions.find((x) => x.code === rule.code);
      const sameCategory = exerciseOptions.filter((x) => !rule.category || x.category === rule.category || x.code === rule.code);
      return <Box key={rule.rowKey} sx={{ p: 1.5, border: `1px solid ${CM.border}`, borderRadius: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="caption" sx={{ color: CM.textDim, fontWeight: 700 }}>EXERCISE {index + 1}{picked ? ` - ${picked.category === "HOLD" ? "HOLD (seconds)" : "REPS"}` : ""}</Typography>
          <Tooltip title={canRemove ? "Remove exercise" : `Keep at least ${minExercises} exercise${minExercises === 1 ? "" : "s"} so every level can keep a score`}><span><IconButton size="small" color="error" aria-label={`Remove exercise ${index + 1}`} disabled={!canRemove} onClick={() => onRemove(rule.rowKey)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
        </Stack>
        <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "1.6fr 1fr 1fr 1fr" } }}>
          <TextField select label="Exercise" value={rule.code || ""} onChange={(e) => onChooseExercise(rule.rowKey, e.target.value)}>{sameCategory.map((x) => <MenuItem key={x.code} value={x.code}>{x.name}</MenuItem>)}</TextField>
          <TextField type="number" label={`1 point up to (${unit})`} value={rule.beginnerMax ?? ""} onChange={(e) => onChange(rule.rowKey, { beginnerMax: e.target.value })} helperText="Inclusive" />
          <TextField type="number" label={`2 points up to (${unit})`} value={rule.intermediateMax ?? ""} onChange={(e) => onChange(rule.rowKey, { intermediateMax: e.target.value })} helperText={twoPointsFrom === "" ? "Inclusive" : `From ${twoPointsFrom}, inclusive`} />
          <TextField disabled label={`3 points above (${unit})`} value={rule.intermediateMax ?? ""} helperText="Automatic" />
        </Box>
      </Box>;
    })}</Stack>
  </Box>;
}
function Detail({ label, value, hint }) {
  return <Box sx={{ p: 1.5, border: `1px solid ${CM.border}`, borderRadius: 1.5, bgcolor: CM.surface, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
    <Typography variant="caption" sx={{ color: CM.textMuted, fontWeight: 600, display: "block", mb: 0.5 }}>{label}</Typography>
    {typeof value === "string" ? <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 22, lineHeight: 1.25 }}>{value}</Typography> : value}
    {hint && <Typography variant="caption" sx={{ color: CM.textDim, display: "block" }}>{hint}</Typography>}
  </Box>;
}

export function LevelBenchmarkFormPage() {
  const navigate = useNavigate();
  const query = useApiQuery(() => contentManagerApi.levelBenchmarkConfiguration());
  const save = useApiMutation((payload) => contentManagerApi.updateLevelBenchmarkConfiguration(payload), { onSuccess: () => navigate(CONTENT_PATHS.levelCriteria, { state: { successMessage: "All benchmark levels updated." } }) });
  const [levels, setLevels] = useState(null);
  const [rules, setRules] = useState(null);
  const data = query.data;
  if (query.isLoading || !data) return <Box sx={{ py: 10, display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
  const currentRules = rules || data.exercises.map((x) => ({ ...x, rowKey: x.code }));
  // N exercises give a total score of N..3N, so adding or removing an exercise moves the level ranges.
  const floor = scoreFloor(currentRules.length);
  const ceiling = scoreCeiling(currentRules.length);
  const currentLevels = levels || normalizeLevels([...data.levels].sort((a, b) => a.scoreMin - b.scoreMin).map((x) => ({ ...x, name: x.name || x.level })), floor, ceiling);
  const exerciseOptions = data.availableExercises || [];
  const setLevel = (idValue, field, value) => setLevels(normalizeLevels(currentLevels.map((x) => x.id === idValue ? { ...x, [field]: value } : x), floor, ceiling));
  const reorderLevel = (from, to) => setLevels(normalizeLevels(moveLevel(currentLevels, from, to, floor), floor, ceiling));
  // N exercises give 2N+1 distinct scores and every level needs at least one of them.
  const totalPoints = ceiling - floor + 1;
  const canAddLevel = currentLevels.length < totalPoints;
  const canRemoveLevel = currentLevels.length > 1;
  const addLevel = () => setLevels(addLevelRow(currentLevels, `new-level-${Date.now()}`, floor, ceiling));
  const removeLevel = (idValue) => setLevels(removeLevelRow(currentLevels, idValue, floor, ceiling));
  const setRule = (rowKey, patch) => setRules(currentRules.map((x) => x.rowKey === rowKey ? { ...x, ...patch } : x));
  const chooseExercise = (rowKey, code) => {
    const option = exerciseOptions.find((x) => x.code === code);
    setRule(rowKey, { code, name: option?.name, category: option?.category });
  };
  // Changes the exercise list and re-fits the level ranges to the new N..3N span.
  const changeRules = (next) => {
    setRules(next);
    setLevels(refitLevels(currentLevels, scoreFloor(next.length), scoreCeiling(next.length)));
  };
  const addRule = () => changeRules([...currentRules, { rowKey: `new-${Date.now()}`, code: "", name: "", category: "", beginnerMax: "", intermediateMax: "" }]);
  const removeRule = (rowKey) => changeRules(currentRules.filter((x) => x.rowKey !== rowKey));
  // N exercises give N..3N = 2N+1 distinct scores and every level needs at least one, so 2N+1 >= number of levels.
  const minExercises = Math.max(1, Math.ceil((currentLevels.length - 1) / 2));
  const canRemove = currentRules.length > minExercises;
  const canAdd = currentRules.length < MAX_EXERCISES;
  const scoreErrors = [...validateLevelNames(currentLevels), ...validateScoreRanges(currentLevels, ceiling)];
  const thresholdErrors = validateThresholds(currentRules);
  const validationErrors = [...scoreErrors, ...thresholdErrors];
  const submit = (event) => {
    event.preventDefault();
    if (validationErrors.length) return;
    save.mutate({
      exercises: currentRules.map((x) => ({ code: x.code, category: x.category, beginnerMax: Number(x.beginnerMax), intermediateMax: Number(x.intermediateMax) })),
      levels: currentLevels.map((x) => ({ id: x.isNew ? null : x.id, name: x.name, scoreMin: Number(x.scoreMin), scoreMax: Number(x.scoreMax), status: x.status })),
    });
  };
  return <Box sx={{ maxWidth: 1120, mx: "auto", px: 3, py: 2.5 }}><Heading breadcrumb={[...BREADCRUMB.slice(0, -1), { label: "Level & Benchmark Criteria", to: CONTENT_PATHS.levelCriteria }, { label: "Update" }]} title="Update All Benchmark Levels" description="Edit levels and the shared exercise thresholds. Drag levels (or use the arrows) to reorder them; each minimum score follows the previous maximum. Adding or removing an exercise changes the total score range." /><Card component="form" onSubmit={submit} sx={{ mt: 2.5, p: 2.5 }}>{save.error && <Alert severity="error" sx={{ mb: 2 }}>{save.error.message}</Alert>}<Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={1}>
    <Box>
      <Typography sx={{ color: "#fff", fontWeight: 700 }}>Levels</Typography>
      <Typography variant="caption" sx={{ color: CM.textMuted }}>{currentLevels.length} level{currentLevels.length === 1 ? "" : "s"} share the {floor}-{ceiling} point range. Adding or removing a level re-balances the ranges automatically; adjust them afterwards.</Typography>
    </Box>
    <Tooltip title={canAddLevel ? "" : `No score points left: at most ${totalPoints} levels fit in ${floor}-${ceiling}. Add an exercise to make room.`}><span><Button variant="outlined" size="small" startIcon={<AddRoundedIcon />} disabled={!canAddLevel} onClick={addLevel}>Add level</Button></span></Tooltip>
  </Stack>{scoreErrors.map((error) => <Alert key={error} severity="error" sx={{ mt: 1.5 }}>{error}</Alert>)}<LevelEditor levels={currentLevels} floor={floor} ceiling={ceiling} canRemove={canRemoveLevel} removeHint="Keep at least one level" onChange={setLevel} onMove={reorderLevel} onRemove={removeLevel} /><ExerciseEditor rules={currentRules} exerciseOptions={exerciseOptions} canAdd={canAdd} canRemove={canRemove} minExercises={minExercises} floor={floor} ceiling={ceiling} errors={thresholdErrors} onAdd={addRule} onRemove={removeRule} onChooseExercise={chooseExercise} onChange={setRule} /><Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 3 }}><Button component={RouterLink} to={CONTENT_PATHS.levelCriteria} variant="outlined">Cancel</Button><Button type="submit" variant="contained" disabled={save.isPending || validationErrors.length > 0}>{save.isPending ? "Saving…" : "Save All Changes"}</Button></Stack></Card></Box>;
}
