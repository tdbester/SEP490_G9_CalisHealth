import { useMemo, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Alert, Box, Button, Card, CircularProgress, IconButton, InputAdornment, Menu, MenuItem,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { contentManagerApi } from "../api/contentManager";
import { useApiMutation, useApiQuery } from "../hooks";
import { CONTENT_PATHS, ContentPageHeader, DarkPill, formatDate } from "../components/ContentShared";
import { CM } from "../theme-content";

const SLOTS = [
  { slot: "PUSH_UP", label: "Push-up", category: "REPS", unit: "reps" },
  { slot: "SQUAT", label: "Bodyweight Squat", category: "REPS", unit: "reps" },
  { slot: "PLANK", label: "Plank", category: "HOLD", unit: "seconds" },
];
const PAGE_SIZE = 5;
const BREADCRUMB = [
  { label: "Admin", to: CONTENT_PATHS.dashboard },
  { label: "Assessment System", to: CONTENT_PATHS.dashboard },
  { label: "Level & Benchmark Criteria" },
];

const statusText = (value) => value === "ACTIVE" ? "Active" : "Inactive";
const statusTone = (value) => value === "ACTIVE" ? "success" : "neutral";
const levelTone = (name) => /advanced/i.test(name) ? "danger" : /beginner/i.test(name) ? "success" : "warning";
const scoreRange = (row) => `${row.scoreMin} - ${row.scoreMax} pts`;
const rangeText = (rule, level) => {
  if (!rule) return "Not configured";
  const unit = rule.category === "HOLD" ? "sec" : "reps";
  if (/beginner/i.test(level)) return `< ${rule.beginnerMax} ${unit}`;
  if (/advanced/i.test(level)) return `> ${rule.intermediateMax} ${unit}`;
  return `${rule.beginnerMax}–${rule.intermediateMax} ${unit}`;
};

function Heading({ title, description, action, breadcrumb = BREADCRUMB }) {
  return <ContentPageHeader breadcrumb={breadcrumb} title={title} description={description} action={action} />;
}

function SummaryMetric({ label, count, caption, tone }) {
  const color = tone === "success" ? CM.green : tone === "warning" ? CM.amber : CM.violetBright;
  return <Box sx={{ px: 2, py: 1.6, border: `1px solid ${CM.border}`, borderRadius: 1.5, bgcolor: CM.surface }}><Typography variant="caption" sx={{ color: CM.textMuted, fontWeight: 600 }}>{label}</Typography><Typography sx={{ color: "#fff", fontSize: 25, fontWeight: 700 }}>{count}</Typography><Typography variant="caption" sx={{ color: CM.textDim }}>{caption}</Typography><Box sx={{ width: 9, height: 9, mt: 0.7, borderRadius: "50%", bgcolor: color }} /></Box>;
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
  const filtered = useMemo(() => levels.filter((row) => {
    const term = search.trim().toLowerCase();
    return (!term || row.name?.toLowerCase().includes(term) || row.level?.toLowerCase().includes(term))
      && (status === "all" || row.status.toLowerCase() === status);
  }), [levels, search, status]);
  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(0, pages - 1));
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const closeMenu = () => setMenu({ anchor: null, entry: null });

  if (query.isLoading) return <Box sx={{ py: 10, display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
  if (query.error) return <Box sx={{ p: 3 }}><Heading title="Benchmark criteria unavailable" description={query.error.message} /><Button onClick={query.refetch} sx={{ mt: 2 }} variant="outlined">Retry</Button></Box>;

  return <Box sx={{ maxWidth: 1440, mx: "auto", px: { xs: 2, sm: 3, xl: 4 }, py: 2.5 }}>
    <Heading title="Calisthenics Level Benchmark Criteria" description="Manage levels and the Push-up, Squat, and Plank thresholds used by the Onboarding Level Test." action={<Button component={RouterLink} to={`${CONTENT_PATHS.levelCriteria}/create`} variant="contained" startIcon={<AddRoundedIcon />}>Create Level &amp; Benchmark</Button>} />
    <Box sx={{ mt: 2.5, display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" } }}><SummaryMetric label="Total Levels" count={levels.length} caption="configured levels" /><SummaryMetric label="Active" count={levels.filter((x) => x.status === "ACTIVE").length} caption="live levels" tone="success" /><SummaryMetric label="Inactive" count={levels.filter((x) => x.status === "INACTIVE").length} caption="hidden levels" tone="warning" /></Box>
    {location.state?.successMessage && <Alert sx={{ mt: 2 }} severity="success" onClose={() => navigate(location.pathname, { replace: true, state: null })}>{location.state.successMessage}</Alert>}
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
      <TableContainer><Table size="small" sx={{ minWidth: 1180 }}><TableHead><TableRow><TableCell>Level / Tier</TableCell><TableCell>Score Range</TableCell><TableCell>Scoring Formula</TableCell><TableCell>Threshold Metrics</TableCell><TableCell>Status</TableCell><TableCell>Updated</TableCell><TableCell align="right">Action</TableCell></TableRow></TableHead><TableBody>{visible.map((row, index) => <TableRow hover key={row.id}><TableCell><Stack spacing={0.5} alignItems="flex-start"><DarkPill tone={levelTone(row.name || row.level)}>{row.name || row.level}</DarkPill><Typography variant="caption" sx={{ color: CM.textDim }}>TIER {currentPage * PAGE_SIZE + index + 1}</Typography></Stack></TableCell><TableCell><Typography sx={{ color: "#fff", fontWeight: 700 }}>{scoreRange(row)}</Typography><Typography variant="caption" sx={{ color: CM.textDim }}>Total score</Typography></TableCell><TableCell><Typography variant="body2" sx={{ color: "#fff" }}>Exercise points sum</Typography><Typography variant="caption" sx={{ color: CM.textMuted, fontFamily: "monospace" }}>Push-up + Squat + Plank</Typography></TableCell><TableCell><Stack direction="row" gap={0.5} flexWrap="wrap">{SLOTS.map((slot) => { const rule = rules.find((x) => x.slot === slot.slot); return <DarkPill key={slot.slot} tone="neutral">{rule?.name || slot.label}: {rangeText(rule, row.name || row.level)}</DarkPill>; })}</Stack></TableCell><TableCell><DarkPill tone={statusTone(row.status)}>{statusText(row.status)}</DarkPill></TableCell><TableCell><Typography variant="caption" display="block" sx={{ color: CM.textMuted }}>{formatDate(row.updatedAt)}</Typography><Typography variant="caption" sx={{ color: CM.textDim }}>by {row.updatedBy || "System"}</Typography></TableCell><TableCell align="right"><Stack direction="row" justifyContent="flex-end"><Button component={RouterLink} to={`${CONTENT_PATHS.levelCriteria}/${row.id}`} size="small" variant="outlined">View</Button><IconButton size="small" onClick={(e) => setMenu({ anchor: e.currentTarget, entry: row })}><MoreVertRoundedIcon fontSize="small" /></IconButton></Stack></TableCell></TableRow>)}{!visible.length && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6 }}>No benchmark levels match the current filters.</TableCell></TableRow>}</TableBody></Table></TableContainer>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1.5, borderTop: `1px solid ${CM.border}` }}><Typography variant="caption" sx={{ color: CM.textMuted }}>Showing {filtered.length ? currentPage * PAGE_SIZE + 1 : 0}-{Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</Typography><Stack direction="row"><IconButton disabled={currentPage === 0} onClick={() => setPage((x) => x - 1)}><ChevronLeftRoundedIcon /></IconButton><IconButton disabled={!pages || currentPage >= pages - 1} onClick={() => setPage((x) => x + 1)}><ChevronRightRoundedIcon /></IconButton></Stack></Stack>
    </Card>
    <Menu anchorEl={menu.anchor} open={Boolean(menu.anchor)} onClose={closeMenu}><MenuItem onClick={() => { if (menu.entry) statusMutation.mutate({ level: menu.entry.name || menu.entry.level, nextStatus: menu.entry.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }); closeMenu(); }}>{menu.entry?.status === "ACTIVE" ? "Deactivate" : "Activate"}</MenuItem></Menu>
  </Box>;
}

export function LevelBenchmarkDetailPage() {
  const { id } = useParams();
  const query = useApiQuery(() => contentManagerApi.levelBenchmarkConfiguration());
  const row = query.data?.levels?.find((x) => String(x.id) === String(id));
  const rules = query.data?.exercises || [];
  if (!row) return <Box sx={{ p: 3 }}><Heading title={query.isLoading ? "Loading…" : "Benchmark not found"} description="" /><Button component={RouterLink} to={CONTENT_PATHS.levelCriteria} variant="outlined">Back</Button></Box>;
  return <Box sx={{ maxWidth: 1100, mx: "auto", px: 3, py: 2.5 }}><Heading breadcrumb={[...BREADCRUMB.slice(0, -1), { label: "Level & Benchmark Criteria", to: CONTENT_PATHS.levelCriteria }, { label: row.name || row.level }]} title={row.name || row.level} description="Benchmark level details" /><Card sx={{ mt: 2.5, p: 3 }}><Stack spacing={2}><Detail label="Score Range" value={scoreRange(row)} /><Detail label="Status" value={statusText(row.status)} />{SLOTS.map((slot) => { const rule = rules.find((x) => x.slot === slot.slot); return <Detail key={slot.slot} label={`${rule?.name || slot.label} (${slot.category})`} value={rangeText(rule, row.name || row.level)} />; })}<Typography variant="caption" sx={{ color: CM.textMuted }}>Classification is based on the sum of the three exercise points.</Typography></Stack></Card></Box>;
}
function Detail({ label, value }) { return <Box sx={{ p: 1.5, border: `1px solid ${CM.border}`, borderRadius: 1, bgcolor: CM.surfaceSoft }}><Typography variant="caption" sx={{ color: CM.textDim, fontWeight: 700 }}>{label}</Typography><Typography sx={{ color: "#fff", fontWeight: 700 }}>{value}</Typography></Box>; }

export function LevelBenchmarkFormPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isCreate = !id && !location.pathname.endsWith("/edit");
  const query = useApiQuery(() => contentManagerApi.levelBenchmarkConfiguration());
  const save = useApiMutation((payload) => isCreate ? contentManagerApi.createLevelBenchmark(payload) : contentManagerApi.updateLevelBenchmarkConfiguration(payload), { onSuccess: () => navigate(CONTENT_PATHS.levelCriteria, { state: { successMessage: isCreate ? "Level created." : "All benchmark levels updated." } }) });
  const [editing, setEditing] = useState(isCreate);
  const [levels, setLevels] = useState(null);
  const [rules, setRules] = useState(null);
  const data = query.data;
  if (query.isLoading || !data) return <Box sx={{ py: 10, display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
  const currentLevels = levels || (isCreate
    ? [{ id: "new", name: "", scoreMin: 0, scoreMax: 0, status: "ACTIVE" }]
    : data.levels.map((x) => ({ ...x, name: x.name || x.level })));
  const currentRules = rules || data.exercises.map((x) => ({ ...x }));
  const options = (category) => (data.availableExercises || []).filter((x) => x.category === category);
  const setLevel = (idValue, field, value) => setLevels(currentLevels.map((x) => x.id === idValue ? { ...x, [field]: value } : x));
  const setRule = (slot, field, value) => setRules(currentRules.map((x) => x.slot === slot ? { ...x, [field]: value } : x));
  const submit = (event) => {
    event.preventDefault();
    if (isCreate) {
      const level = currentLevels[0];
      save.mutate({
        name: level.name,
        scoreMin: Number(level.scoreMin),
        scoreMax: Number(level.scoreMax),
        status: level.status,
      });
      return;
    }
    save.mutate({
      exercises: currentRules.map((x) => ({ slot: x.slot, code: x.code, category: x.category, beginnerMax: Number(x.beginnerMax), intermediateMax: Number(x.intermediateMax) })),
      levels: currentLevels.map((x) => ({ id: x.id, name: x.name, scoreMin: Number(x.scoreMin), scoreMax: Number(x.scoreMax), status: x.status })),
    });
  };
  return <Box sx={{ maxWidth: 1120, mx: "auto", px: 3, py: 2.5 }}><Heading breadcrumb={[...BREADCRUMB.slice(0, -1), { label: "Level & Benchmark Criteria", to: CONTENT_PATHS.levelCriteria }, { label: isCreate ? "Create" : "Update" }]} title={isCreate ? "Create Level & Benchmark" : "Update All Benchmark Levels"} description={isCreate ? "Create a new level with its score range and exercise thresholds." : "Click Update to unlock editing for every level and shared exercise threshold."} action={!isCreate && !editing ? <Button variant="contained" onClick={() => setEditing(true)}>Update</Button> : null} /><Card component="form" onSubmit={submit} sx={{ mt: 2.5, p: 2.5 }}>{save.error && <Alert severity="error" sx={{ mb: 2 }}>{save.error.message}</Alert>}<Typography sx={{ color: "#fff", fontWeight: 700 }}>Levels</Typography><Stack spacing={1.5} sx={{ mt: 1.5 }}>{currentLevels.map((level) => <Box key={level.id} sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "1.4fr 1fr 1fr 1fr" }, p: 1.5, border: `1px solid ${CM.border}`, borderRadius: 1 }}><TextField disabled={!editing} label="Level name" value={level.name} onChange={(e) => setLevel(level.id, "name", e.target.value)} /><TextField disabled={!editing} type="number" label="Minimum score" value={level.scoreMin} onChange={(e) => setLevel(level.id, "scoreMin", e.target.value)} /><TextField disabled={!editing} type="number" label="Maximum score" value={level.scoreMax} onChange={(e) => setLevel(level.id, "scoreMax", e.target.value)} /><TextField disabled={!editing} select label="Status" value={level.status} onChange={(e) => setLevel(level.id, "status", e.target.value)}><MenuItem value="ACTIVE">Active</MenuItem><MenuItem value="INACTIVE">Inactive</MenuItem></TextField></Box>)}</Stack><Typography sx={{ color: "#fff", fontWeight: 700, mt: 3 }}>Exercises and thresholds</Typography><Stack spacing={1.5} sx={{ mt: 1.5 }}>{SLOTS.map((slot, index) => { const rule = currentRules.find((x) => x.slot === slot.slot); return <Box key={slot.slot} sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, p: 1.5, border: `1px solid ${CM.border}`, borderRadius: 1 }}><TextField disabled={!editing} select label={`Condition ${index + 1} - Exercise`} value={rule?.code || ""} onChange={(e) => setRule(slot.slot, "code", e.target.value)}>{options(slot.category).map((x) => <MenuItem key={x.code} value={x.code}>{x.name}</MenuItem>)}</TextField><TextField disabled={!editing} type="number" label={`Condition ${index + 1} - Beginner max (${slot.unit})`} value={rule?.beginnerMax ?? ""} onChange={(e) => setRule(slot.slot, "beginnerMax", e.target.value)} /><TextField disabled={!editing} type="number" label={`Condition ${index + 1} - Intermediate max (${slot.unit})`} value={rule?.intermediateMax ?? ""} onChange={(e) => setRule(slot.slot, "intermediateMax", e.target.value)} /></Box>; })}</Stack><Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 3 }}><Button component={RouterLink} to={CONTENT_PATHS.levelCriteria} variant="outlined">Cancel</Button>{editing && <Button type="submit" variant="contained" disabled={save.isPending}>{save.isPending ? "Saving…" : isCreate ? "Create Level" : "Save All Changes"}</Button>}</Stack></Card></Box>;
}
