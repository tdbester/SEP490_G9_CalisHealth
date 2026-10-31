import { useMemo, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Alert, Box, Button, Card, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Divider, FormControlLabel, IconButton, InputAdornment, Menu, MenuItem, Stack, Switch, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import { keyframes } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";
import FitnessCenterRoundedIcon from "@mui/icons-material/FitnessCenterRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import LockOpenRoundedIcon from "@mui/icons-material/LockOpenRounded";
import RepeatRoundedIcon from "@mui/icons-material/RepeatRounded";
import SpeedRoundedIcon from "@mui/icons-material/SpeedRounded";
import TimerRoundedIcon from "@mui/icons-material/TimerRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { contentManagerApi } from "../api/contentManager";
import { useApiMutation, useApiQuery } from "../hooks";
import { CONTENT_PATHS, ContentPageHeader, DarkPill, SummaryCard, formatDate } from "../components/ContentShared";
import { CM } from "../theme-content";

const PAGE_SIZE = 8;
const BREADCRUMB = [
  { label: "Content manager", to: CONTENT_PATHS.dashboard },
  { label: "Progression Rules" },
];
const LIST_BREADCRUMB = [BREADCRUMB[0], { label: "Progression Rules", to: CONTENT_PATHS.progressionRules }];

const isActive = (rule) => rule.status === "ACTIVE";
const statusText = (rule) => (isActive(rule) ? "Active" : "Inactive");
const statusTone = (rule) => (isActive(rule) ? "success" : "neutral");
const percent = (value) => `${Number(value ?? 0).toFixed(0)}%`;
const isHold = (rule) => rule.measureType === "HOLD";
// What the member must do on the prerequisite exercise, per set.
const perSet = (rule) => (isHold(rule) ? `${rule.requiredSeconds} s` : `${rule.requiredReps} reps`);
const requirementText = (rule) => `${rule.requiredSets} × ${perSet(rule)}`;

function Heading({ title, description, action, breadcrumb = BREADCRUMB }) {
  return <ContentPageHeader breadcrumb={breadcrumb} title={title} description={description} action={action} />;
}

function Loading() {
  return <Box sx={{ py: 10, display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
}

const nudge = keyframes`
  0%, 100% { transform: translateX(-2px); opacity: 0.65; }
  50% { transform: translateX(3px); opacity: 1; }
`;
const rise = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;
const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(139,92,246,0.4); }
  50% { box-shadow: 0 0 0 8px rgba(139,92,246,0); }
`;
const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;
// Entrance animation, switched off for members who prefer reduced motion.
const enter = (delay = 0) => ({
  animation: `${rise} .45s ease-out ${delay}ms both`,
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
});

/** Round gradient badge holding an arrow; points down on small screens where the cards stack. */
function FlowArrow({ sx, label }) {
  return <Box aria-hidden sx={{
    display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: "50%", justifySelf: "center",
    background: `linear-gradient(135deg, ${CM.surfaceAlt} 0%, ${CM.surface} 100%)`,
    border: `1px solid ${CM.borderStrong}`,
    transform: { xs: "rotate(90deg)", md: "none" }, ...sx,
  }}>
    <ArrowForwardRoundedIcon sx={{
      color: CM.violetBright, fontSize: 22,
    }} />
  </Box>;
}

/** Rounded gradient tile with an icon, used beside titles and exercise names. */
function IconBadge({ icon: Icon, size = 36, accent = false }) {
  return <Box aria-hidden sx={{
    width: size, height: size, borderRadius: "10px", display: "grid", placeItems: "center", flexShrink: 0,
    background: accent ? CM.buttonGradient : CM.gradientSoft,
    border: `1px solid ${CM.border}`,
  }}><Icon sx={{ fontSize: size * 0.52, color: "#fff" }} /></Box>;
}

/** Title row for a card: icon, heading and a one-line caption. */
function SectionTitle({ icon, title, caption, accent }) {
  return <Stack direction="row" spacing={1.5} alignItems="center">
    <IconBadge icon={icon} accent={accent} />
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ color: "#fff", fontWeight: 700, lineHeight: 1.3, letterSpacing: "-0.01em" }}>{title}</Typography>
      {caption && <Typography variant="caption" sx={{ color: CM.textMuted, lineHeight: 1.4 }}>{caption}</Typography>}
    </Box>
  </Stack>;
}

function Detail({ label, value, hint, icon: Icon }) {
  return <Box sx={{
    position: "relative", overflow: "hidden", p: 1.75, height: "100%", minHeight: 104, border: `1px solid ${CM.border}`, borderRadius: "14px", bgcolor: CM.surface,
    textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
  }}>
    <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center" sx={{ mb: 0.5 }}>
      {Icon && <Icon sx={{ fontSize: 15, color: CM.violetBright }} aria-hidden />}
      <Typography variant="caption" sx={{ color: CM.textDim, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 10.5 }}>{label}</Typography>
    </Stack>
    <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 24, lineHeight: 1.25 }}>{value}</Typography>
    <Typography variant="caption" sx={{ color: CM.textMuted, display: "block", minHeight: 20 }}>{hint || "\u00A0"}</Typography>
  </Box>;
}

/** Exercise name with an icon (stopwatch for holds, repeat for reps) and its type tags. */
function ExerciseChip({ exercise, accent, align = "center" }) {
  return <Stack direction="row" spacing={1.25} alignItems="center" justifyContent={align === "start" ? "flex-start" : "center"}>
    <IconBadge icon={exercise.category === "HOLD" ? TimerRoundedIcon : RepeatRoundedIcon} accent={accent} />
    <Stack spacing={0.4} alignItems="flex-start" sx={{ minWidth: 0, textAlign: "left" }}>
      <Typography sx={{ color: "#fff", fontWeight: 600, lineHeight: 1.25 }}>{exercise.name}</Typography>
      <Stack direction="row" spacing={0.5}>
        <DarkPill tone={exercise.type === "SKILL" ? "primary" : "teal"}>{exercise.type === "SKILL" ? "Skill" : "Health"}</DarkPill>
        <DarkPill tone="neutral">{exercise.category === "HOLD" ? "Hold" : "Reps"}</DarkPill>
      </Stack>
    </Stack>
  </Stack>;
}

/** Status pill with a coloured dot in front of the label. */
function StatusPill({ rule }) {
  return <DarkPill tone={statusTone(rule)} icon={<FiberManualRecordRoundedIcon />}>{statusText(rule)}</DarkPill>;
}

/** Big number with a small unit underneath, for the thresholds columns. */
function BigStat({ value, unit }) {
  return <Box>
    <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 22, lineHeight: 1.15 }}>{value}</Typography>
    {unit && <Typography variant="caption" sx={{ color: CM.textDim, fontWeight: 600 }}>{unit}</Typography>}
  </Box>;
}

/** Clean-form threshold as a number plus a thin bar, so strict rules are easy to spot. */
function AccuracyMeter({ value }) {
  const pct = Math.max(0, Math.min(100, Number(value ?? 0)));
  const color = pct >= 90 ? CM.pink : pct >= 75 ? CM.amber : CM.green;
  return <Box sx={{ minWidth: 92, mx: "auto" }}>
    <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 22, lineHeight: 1.15 }}>{percent(pct)}</Typography>
    <Box sx={{ position: "relative", mt: 0.5, height: 6, borderRadius: 3, bgcolor: "rgba(139,92,246,0.12)", overflow: "hidden" }}>
      <Box sx={{
        position: "absolute", top: 0, left: 0, height: "100%", width: `${pct}%`, borderRadius: 3,
        backgroundColor: color,
        transition: "width .4s ease",
      }} />
    </Box>
    <Typography variant="caption" sx={{ color: CM.textDim, fontSize: 10, mt: 0.25, display: "block" }}>min clean form</Typography>
  </Box>;
}

/** Screen 1: Progression rule configurations (list). */
export default function ProgressionRulesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const query = useApiQuery(() => contentManagerApi.progressionRules());
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [menu, setMenu] = useState({ anchor: null, entry: null });
  const [deleting, setDeleting] = useState(null);
  const [notice, setNotice] = useState("");
  const statusMutation = useApiMutation(({ id, next }) => contentManagerApi.updateProgressionRuleStatus(id, next), {
    onSuccess: () => { setNotice("Rule status updated."); query.refetch(); },
  });
  const deleteMutation = useApiMutation((id) => contentManagerApi.deleteProgressionRule(id), {
    onSuccess: () => { setDeleting(null); setNotice("Progression rule deleted."); query.refetch(); },
  });
  const rules = query.data?.rules || [];
  const filtered = useMemo(() => rules.filter((rule) => {
    const term = search.trim().toLowerCase();
    return (!term || rule.exercise.name.toLowerCase().includes(term) || rule.prerequisite.name.toLowerCase().includes(term))
      && (status === "all" || rule.status.toLowerCase() === status);
  }), [rules, search, status]);
  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(0, pages - 1));
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const closeMenu = () => setMenu({ anchor: null, entry: null });

  if (query.isLoading) return <Loading />;
  if (query.error) return <Box sx={{ p: 3 }}><Heading title="Progression rules unavailable" description={query.error.message} /><Button onClick={query.refetch} sx={{ mt: 2 }} variant="outlined">Retry</Button></Box>;

  return <Box sx={{ maxWidth: 1440, mx: "auto", px: { xs: 2, sm: 3, xl: 4 }, py: 2.5 }}>
    <Heading
      title="Progression Rules"
      description="Set what a member must achieve on one exercise to unlock the next one."
      action={<Button component={RouterLink} to={`${CONTENT_PATHS.progressionRules}/new`} variant="contained" startIcon={<AddRoundedIcon />}>Create progression rule</Button>}
    />
    <Box sx={{ mt: 2.5, display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" } }}>
      <Box sx={enter(0)}><SummaryCard label="Total Rules" count={rules.length} detail="configured rules" /></Box>
      <Box sx={enter(80)}><SummaryCard label="Active" count={query.data.activeCount} detail="used to unlock exercises" tone="success" /></Box>
      <Box sx={enter(160)}><SummaryCard label="Inactive" count={query.data.inactiveCount} detail="ignored for now" tone="warning" /></Box>
    </Box>
    {location.state?.successMessage && <Alert sx={{ mt: 2 }} severity="success" onClose={() => navigate(location.pathname, { replace: true, state: null })}>{location.state.successMessage}</Alert>}
    {notice && <Alert sx={{ mt: 2 }} severity="success" onClose={() => setNotice("")}>{notice}</Alert>}
    {statusMutation.error && <Alert sx={{ mt: 2 }} severity="error" onClose={statusMutation.reset}>{statusMutation.error.message}</Alert>}
    <Card sx={{ mt: 2.25, overflow: "hidden", ...enter(220) }}>
      <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "stretch", lg: "center" }} sx={{ p: 2, borderBottom: `1px solid ${CM.border}` }}>
        <SectionTitle icon={AccountTreeRoundedIcon} accent title="Rule configurations" caption="Each rule links a prerequisite exercise to the exercise it unlocks." />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
          <TextField size="small" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search exercise or prerequisite" sx={{ width: { xs: "100%", sm: 360, lg: 420 } }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }} />
          <TextField select size="small" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} sx={{ minWidth: 145 }}>
            <MenuItem value="all">All Status</MenuItem><MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem>
          </TextField>
          <Tooltip title="Refresh"><span><IconButton onClick={query.refetch} disabled={query.isFetching} aria-label="Refresh" sx={{ border: `1px solid ${CM.border}`, borderRadius: 1.25, transition: "all .2s ease", "&:hover": { borderColor: CM.violetBright, bgcolor: "rgba(139,92,246,0.1)" } }}>{query.isFetching ? <CircularProgress size={17} /> : <RefreshRoundedIcon />}</IconButton></span></Tooltip>
        </Stack>
      </Stack>
      <TableContainer>
        <Table size="small" sx={{ minWidth: 980 }}>
          <TableHead><TableRow>
            <TableCell><Box sx={{ width: 220, mx: "auto", textAlign: "left" }}>Prerequisite</Box></TableCell><TableCell><Box sx={{ width: 220, mx: "auto", textAlign: "left" }}>Unlocks</Box></TableCell><TableCell>Requirement per set</TableCell>
            <TableCell>Sets</TableCell><TableCell>Min clean</TableCell><TableCell>Status</TableCell><TableCell>Updated</TableCell><TableCell align="center">Action</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {visible.map((rule, idx) => <TableRow hover key={rule.id} sx={{
              opacity: isActive(rule) ? 1 : 0.55,
              transition: "all .2s ease",
              "&:hover": { opacity: 1, bgcolor: "rgba(139,92,246,0.06)" },
              ...enter(260 + idx * 40),
            }}>
              <TableCell><Box sx={{ width: 220, mx: "auto" }}><ExerciseChip exercise={rule.prerequisite} align="start" /></Box></TableCell>
              <TableCell><Box sx={{ width: 220, mx: "auto" }}><ExerciseChip exercise={rule.exercise} accent align="start" /></Box></TableCell>
              <TableCell><BigStat value={isHold(rule) ? rule.requiredSeconds : rule.requiredReps} unit={isHold(rule) ? "seconds" : "reps"} /></TableCell>
              <TableCell><BigStat value={rule.requiredSets} unit={rule.requiredSets === 1 ? "set" : "sets"} /></TableCell>
              <TableCell><AccuracyMeter value={rule.minAccuracy} /></TableCell>
              <TableCell><StatusPill rule={rule} /></TableCell>
              <TableCell><Typography variant="caption" sx={{ color: CM.textMuted }}>{formatDate(rule.updatedAt)}</Typography></TableCell>
              <TableCell align="center"><Stack direction="row" justifyContent="center" alignItems="center" spacing={0.5}>
                <Button component={RouterLink} to={`${CONTENT_PATHS.progressionRules}/${rule.id}`} size="small" variant="outlined">View</Button>
                <IconButton size="small" aria-label={`Actions for ${rule.exercise.name}`} onClick={(e) => setMenu({ anchor: e.currentTarget, entry: rule })}><MoreVertRoundedIcon fontSize="small" /></IconButton>
              </Stack></TableCell>
            </TableRow>)}
            {!visible.length && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6 }}>
              <Stack alignItems="center" spacing={1}>
                <AccountTreeRoundedIcon sx={{ fontSize: 48, color: CM.textDim, opacity: 0.4 }} />
                <Typography sx={{ color: CM.textMuted }}>{rules.length ? "No progression rules match the current filters." : "No progression rules yet. Create the first one."}</Typography>
              </Stack>
            </TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1.5, borderTop: `1px solid ${CM.border}` }}>
        <Typography variant="caption" sx={{ color: CM.textMuted }}>Showing {filtered.length ? currentPage * PAGE_SIZE + 1 : 0}-{Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</Typography>
        <Stack direction="row" spacing={0.5}>
          <IconButton aria-label="Previous page" disabled={currentPage === 0} onClick={() => setPage((x) => x - 1)} sx={{ transition: "all .15s ease" }}><ChevronLeftRoundedIcon /></IconButton>
          <IconButton aria-label="Next page" disabled={!pages || currentPage >= pages - 1} onClick={() => setPage((x) => x + 1)} sx={{ transition: "all .15s ease" }}><ChevronRightRoundedIcon /></IconButton>
        </Stack>
      </Stack>
    </Card>
    <Menu anchorEl={menu.anchor} open={Boolean(menu.anchor)} onClose={closeMenu}>
      <MenuItem component={RouterLink} to={`${CONTENT_PATHS.progressionRules}/${menu.entry?.id}/edit`}>Edit</MenuItem>
      <MenuItem onClick={() => { if (menu.entry) statusMutation.mutate({ id: menu.entry.id, next: isActive(menu.entry) ? "INACTIVE" : "ACTIVE" }); closeMenu(); }}>{menu.entry && isActive(menu.entry) ? "Deactivate" : "Activate"}</MenuItem>
      <Divider />
      <MenuItem sx={{ color: "error.main" }} onClick={() => { deleteMutation.reset(); setDeleting(menu.entry); closeMenu(); }}>Delete</MenuItem>
    </Menu>
    <Dialog open={Boolean(deleting)} onClose={() => !deleteMutation.isPending && setDeleting(null)}>
      <DialogTitle>Delete progression rule?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          "{deleting?.prerequisite.name}" will no longer unlock "{deleting?.exercise.name}". Members who already unlocked it keep their progress. To pause the rule without losing it, deactivate it instead.
        </DialogContentText>
        {deleteMutation.error && <Alert severity="error" sx={{ mt: 2 }}>{deleteMutation.error.message}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDeleting(null)} disabled={deleteMutation.isPending}>Cancel</Button>
        <Button color="error" variant="contained" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleting.id)}>{deleteMutation.isPending ? "Deleting…" : "Delete"}</Button>
      </DialogActions>
    </Dialog>
  </Box>;
}

function RuleTable({ title, caption, rules }) {
  if (!rules.length) return null;
  return <Card sx={{ mt: 2.25, overflow: "hidden", ...enter(300) }}>
    <Box sx={{ p: 2, borderBottom: `1px solid ${CM.border}` }}>
      <SectionTitle icon={AccountTreeRoundedIcon} title={title} caption={caption} />
    </Box>
    <TableContainer>
      <Table size="small" sx={{ minWidth: 640 }}>
        <TableHead><TableRow><TableCell>Prerequisite</TableCell><TableCell>Unlocks</TableCell><TableCell>Requirement</TableCell><TableCell>Min clean</TableCell><TableCell>Status</TableCell><TableCell align="center">Action</TableCell></TableRow></TableHead>
        <TableBody>{rules.map((rule) => <TableRow hover key={rule.id}>
          <TableCell><Typography sx={{ color: "#fff", fontWeight: 600 }}>{rule.prerequisite.name}</Typography></TableCell>
          <TableCell><Typography sx={{ color: "#fff", fontWeight: 600 }}>{rule.exercise.name}</Typography></TableCell>
          <TableCell><Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>{requirementText(rule)}</Typography></TableCell>
          <TableCell><Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>{percent(rule.minAccuracy)}</Typography></TableCell>
          <TableCell><StatusPill rule={rule} /></TableCell>
          <TableCell align="center"><Button component={RouterLink} to={`${CONTENT_PATHS.progressionRules}/${rule.id}`} size="small" variant="outlined">View</Button></TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </TableContainer>
  </Card>;
}

/** Screen 2: Progression rule detail. */
export function ProgressionRuleDetailPage() {
  const { id } = useParams();
  const query = useApiQuery(() => contentManagerApi.progressionRule(id), { deps: [id] });
  if (query.isLoading) return <Loading />;
  if (query.error || !query.data) {
    return <Box sx={{ p: 3 }}>
      <Heading breadcrumb={LIST_BREADCRUMB} title="Progression rule not found" description={query.error?.message || ""} />
      <Button component={RouterLink} to={CONTENT_PATHS.progressionRules} variant="outlined" startIcon={<ArrowBackRoundedIcon />} sx={{ mt: 2 }}>Back</Button>
    </Box>;
  }
  const { rule, unlockedMembers, sameTargetRules, nextRules } = query.data;
  const actions = <Stack direction="row" spacing={1}>
    <Button component={RouterLink} to={CONTENT_PATHS.progressionRules} variant="outlined" startIcon={<ArrowBackRoundedIcon />}>Back</Button>
    <Button component={RouterLink} to={`${CONTENT_PATHS.progressionRules}/${rule.id}/edit`} variant="contained">Update</Button>
  </Stack>;
  return <Box sx={{ maxWidth: 1100, mx: "auto", px: 3, py: 2.5 }}>
    <Heading breadcrumb={[...LIST_BREADCRUMB, { label: rule.exercise.name }]} title={`${rule.prerequisite.name} → ${rule.exercise.name}`} description="Progression rule details" action={actions} />
    <Box sx={{ mt: 2.5, display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" } }}>
      <Box sx={{ height: "100%", ...enter(0) }}><Detail icon={FiberManualRecordRoundedIcon} label="Status" value={statusText(rule)} hint={isActive(rule) ? "Currently enforced" : "Paused"} /></Box>
      <Box sx={{ height: "100%", ...enter(70) }}><Detail icon={isHold(rule) ? TimerRoundedIcon : RepeatRoundedIcon} label="Measured in" value={isHold(rule) ? "Hold (seconds)" : "Reps"} /></Box>
      <Box sx={{ height: "100%", ...enter(140) }}><Detail icon={LockOpenRoundedIcon} label="Members unlocked" value={unlockedMembers.toLocaleString()} hint={`${rule.exercise.name}`} /></Box>
    </Box>
    <Card sx={{ mt: 2.25, overflow: "hidden", ...enter(260) }}>
      <Box sx={{ p: 2.5, borderBottom: `1px solid ${CM.border}` }}>
        <SectionTitle icon={LockOpenRoundedIcon} accent title={`How a member unlocks ${rule.exercise.name}`} />
        <Typography variant="body2" sx={{ color: CM.textMuted, mt: 1.25, maxWidth: 680 }}>
          Train {rule.prerequisite.name} and finish at least {rule.requiredSets} set{rule.requiredSets === 1 ? "" : "s"} of {perSet(rule)} each,
          with at least {percent(rule.minAccuracy)} of the {isHold(rule) ? "time" : "reps"} done with clean form. The server works the percentage out from the counted numbers.
        </Typography>
      </Box>
      <Box sx={{ p: 2.5, display: "grid", gap: 2, alignItems: "center", gridTemplateColumns: { xs: "1fr", md: "1fr auto 1fr" } }}>
        <Box sx={{
          p: 2.5, border: `1px solid ${CM.border}`, borderRadius: "16px", bgcolor: CM.surfaceSoft, textAlign: "center",
        }}>
          <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center" sx={{ mb: 1.25 }}>
            <LinkRoundedIcon sx={{ fontSize: 14, color: CM.textDim }} />
            <Typography variant="caption" sx={{ color: CM.textDim, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 10.5 }}>PREREQUISITE</Typography>
          </Stack>
          <Box sx={{ mt: 1 }}><ExerciseChip exercise={rule.prerequisite} /></Box>
        </Box>
        <FlowArrow />
        <Box sx={{
          p: 2.5, border: `1px solid ${CM.violetBright}`, borderRadius: "16px", textAlign: "center", bgcolor: CM.surfaceSoft,
        }}>
          <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center" sx={{ mb: 1.25 }}>
            <LockOpenRoundedIcon sx={{ fontSize: 14, color: CM.violetBright }} />
            <Typography variant="caption" sx={{ color: CM.violetBright, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 10.5 }}>UNLOCKS</Typography>
          </Stack>
          <Box sx={{ mt: 1 }}><ExerciseChip exercise={rule.exercise} accent /></Box>
        </Box>
      </Box>
      <Box sx={{ px: 2.5, pb: 2.5, display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(3, 1fr)" } }}>
        <Detail icon={FitnessCenterRoundedIcon} label="Sets required" value={String(rule.requiredSets)} hint={rule.requiredSets === 1 ? "single set" : "consecutive sets"} />
        <Detail icon={isHold(rule) ? TimerRoundedIcon : RepeatRoundedIcon} label={isHold(rule) ? "Seconds per set" : "Reps per set"} value={isHold(rule) ? `${rule.requiredSeconds} s` : String(rule.requiredReps)} />
        <Detail icon={VerifiedRoundedIcon} label="Minimum clean form" value={percent(rule.minAccuracy)} hint={Number(rule.minAccuracy) >= 90 ? "Very strict" : Number(rule.minAccuracy) >= 75 ? "Moderately strict" : "Lenient"} />
      </Box>
    </Card>
    <RuleTable title="Other ways to unlock this exercise" caption={`Other rules that also unlock ${rule.exercise.name}.`} rules={sameTargetRules} />
    <RuleTable title="What comes next" caption={`Rules that use ${rule.exercise.name} as their prerequisite.`} rules={nextRules} />
  </Box>;
}

const wholeNumber = (value) => value !== "" && Number.isInteger(Number(value));

function validateForm(form, hold, exercisesMissing) {
  const errors = [];
  if (exercisesMissing) {
    if (!form.prerequisiteCode) errors.push("Choose the prerequisite exercise.");
    if (!form.exerciseCode) errors.push("Choose the exercise to unlock.");
    if (form.exerciseCode && form.exerciseCode === form.prerequisiteCode) errors.push("An exercise cannot be its own prerequisite.");
  }
  if (!wholeNumber(form.requiredSets) || Number(form.requiredSets) < 1 || Number(form.requiredSets) > 20) errors.push("Sets must be a whole number from 1 to 20.");
  if (hold) {
    if (!wholeNumber(form.requiredSeconds) || Number(form.requiredSeconds) < 1) errors.push("Seconds per set must be a whole number of at least 1.");
  } else if (!wholeNumber(form.requiredReps) || Number(form.requiredReps) < 1) errors.push("Reps per set must be a whole number of at least 1.");
  const accuracy = Number(form.minAccuracy);
  if (form.minAccuracy === "" || !Number.isFinite(accuracy) || accuracy < 1 || accuracy > 100) errors.push("Minimum clean form must be between 1 and 100 percent.");
  return errors;
}

/** Screen 3: Create / edit a progression rule. Editing keeps the exercise pair fixed. */
export function ProgressionRuleFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const list = useApiQuery(() => contentManagerApi.progressionRules());
  const detail = useApiQuery(() => contentManagerApi.progressionRule(id), { enabled: editing, deps: [id] });
  const [draft, setDraft] = useState(null);
  const [touched, setTouched] = useState(false);
  const save = useApiMutation(
    (payload) => (editing ? contentManagerApi.updateProgressionRule(id, payload) : contentManagerApi.createProgressionRule(payload)),
    { onSuccess: (saved) => navigate(editing ? `${CONTENT_PATHS.progressionRules}/${id}` : CONTENT_PATHS.progressionRules, {
      state: { successMessage: editing ? "Progression rule updated." : `Rule created: ${saved?.rule?.prerequisite.name} unlocks ${saved?.rule?.exercise.name}.` },
    }) },
  );

  if (list.isLoading || (editing && detail.isLoading)) return <Loading />;
  const loadError = list.error || (editing && detail.error);
  if (loadError) return <Box sx={{ p: 3 }}><Heading breadcrumb={LIST_BREADCRUMB} title="Progression rule unavailable" description={loadError.message} /><Button component={RouterLink} to={CONTENT_PATHS.progressionRules} sx={{ mt: 2 }} variant="outlined">Back</Button></Box>;

  const options = list.data?.availableExercises || [];
  const existing = editing ? detail.data?.rule : null;
  const form = draft || {
    exerciseCode: existing?.exercise.code || "",
    prerequisiteCode: existing?.prerequisite.code || "",
    requiredSets: existing ? String(existing.requiredSets) : "3",
    requiredReps: existing?.requiredReps != null ? String(existing.requiredReps) : "10",
    requiredSeconds: existing?.requiredSeconds != null ? String(existing.requiredSeconds) : "30",
    minAccuracy: existing ? String(Number(existing.minAccuracy)) : "80",
    status: existing?.status || "ACTIVE",
  };
  const set = (patch) => setDraft({ ...form, ...patch });
  const prerequisite = existing?.prerequisite || options.find((x) => x.code === form.prerequisiteCode);
  const exercise = existing?.exercise || options.find((x) => x.code === form.exerciseCode);
  const hold = prerequisite?.category === "HOLD";
  const errors = validateForm(form, hold, !editing);
  const duplicate = !editing && form.exerciseCode && form.prerequisiteCode
    && (list.data?.rules || []).some((rule) => rule.exercise.code === form.exerciseCode && rule.prerequisite.code === form.prerequisiteCode);
  const blockers = duplicate ? [...errors, "A rule for this pair of exercises already exists."] : errors;

  const submit = (event) => {
    event.preventDefault();
    setTouched(true);
    if (blockers.length) return;
    const thresholds = {
      requiredSets: Number(form.requiredSets),
      requiredReps: hold ? null : Number(form.requiredReps),
      requiredSeconds: hold ? Number(form.requiredSeconds) : null,
      minAccuracy: Number(form.minAccuracy),
      status: form.status,
    };
    save.mutate(editing ? thresholds : { exerciseCode: form.exerciseCode, prerequisiteCode: form.prerequisiteCode, ...thresholds });
  };
  const backTo = editing ? `${CONTENT_PATHS.progressionRules}/${id}` : CONTENT_PATHS.progressionRules;
  const title = editing ? "Update progression rule" : "Create progression rule";

  return <Box sx={{ maxWidth: 960, mx: "auto", px: 3, py: 2.5 }}>
    <Heading
      breadcrumb={[...LIST_BREADCRUMB, { label: editing ? "Update" : "Create" }]}
      title={title}
      description={editing ? "Change the thresholds. The exercise pair cannot change; create a new rule for a different pair." : "Pick the prerequisite and the exercise it unlocks, then set what the member must achieve."}
    />
    <Card component="form" onSubmit={submit} noValidate sx={{ mt: 2.5, overflow: "hidden" }}>
      {/* Gradient banner top */}
      <Box sx={{ p: 2.5 }}>
        {save.error && <Alert severity="error" sx={{ mb: 2 }}>{save.error.message}</Alert>}
        {touched && blockers.map((error) => <Alert key={error} severity="error" sx={{ mb: 1.5 }}>{error}</Alert>)}

        {/* ─── Exercise Selection Section ─── */}
        <Box sx={{ mb: 3 }}>
          <SectionTitle icon={LinkRoundedIcon} accent title="Exercises" caption="Only active system exercises can be part of a progression chain." />
          <Box sx={{ mt: 2, display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "1fr auto 1fr" }, alignItems: "start" }}>
            <Box sx={{
              p: 2, border: `1px solid ${CM.border}`, borderRadius: "14px", bgcolor: CM.surfaceSoft,
              transition: "border-color .2s ease", "&:focus-within": { borderColor: CM.violetBright },
            }}>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.25 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: CM.textDim }} />
                <Typography variant="caption" sx={{ color: CM.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 10.5 }}>Prerequisite</Typography>
              </Stack>
              <TextField select fullWidth label="Member trains this exercise" value={form.prerequisiteCode} disabled={editing} onChange={(e) => set({ prerequisiteCode: e.target.value })} size="small">
                {(editing ? [existing.prerequisite] : options).map((x) => <MenuItem key={x.code} value={x.code}>{x.name} · {x.type === "SKILL" ? "Skill" : "Health"} · {x.category === "HOLD" ? "Hold" : "Reps"}</MenuItem>)}
              </TextField>
              {prerequisite && <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                <DarkPill tone={prerequisite.type === "SKILL" ? "primary" : "teal"}>{prerequisite.type === "SKILL" ? "Skill" : "Health"}</DarkPill>
                <DarkPill tone="neutral">{prerequisite.category === "HOLD" ? "Hold" : "Reps"}</DarkPill>
              </Stack>}
            </Box>
            <Box sx={{ display: "grid", placeItems: "center", py: { xs: 1, md: 3 } }}>
              <FlowArrow />
            </Box>
            <Box sx={{
              p: 2, border: `1px solid ${form.exerciseCode ? CM.violetBright : CM.border}`, borderRadius: "14px", bgcolor: CM.surfaceSoft,
              transition: "border-color .2s ease", "&:focus-within": { borderColor: CM.violetBright },
            }}>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.25 }}>
                <LockOpenRoundedIcon sx={{ fontSize: 12, color: CM.violetBright }} />
                <Typography variant="caption" sx={{ color: CM.violetBright, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 10.5 }}>Unlocks</Typography>
              </Stack>
              <TextField select fullWidth label="Exercise to unlock" value={form.exerciseCode} disabled={editing} onChange={(e) => set({ exerciseCode: e.target.value })} size="small">
                {(editing ? [existing.exercise] : options.filter((x) => x.code !== form.prerequisiteCode)).map((x) => <MenuItem key={x.code} value={x.code}>{x.name} · {x.type === "SKILL" ? "Skill" : "Health"} · {x.category === "HOLD" ? "Hold" : "Reps"}</MenuItem>)}
              </TextField>
              {exercise && <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                <DarkPill tone={exercise.type === "SKILL" ? "primary" : "teal"}>{exercise.type === "SKILL" ? "Skill" : "Health"}</DarkPill>
                <DarkPill tone="neutral">{exercise.category === "HOLD" ? "Hold" : "Reps"}</DarkPill>
              </Stack>}
            </Box>
          </Box>
        </Box>

        <Divider sx={{ borderColor: CM.border, my: 1 }} />

        {/* ─── Requirement Section ─── */}
        <Box sx={{ my: 3 }}>
          <SectionTitle icon={TuneRoundedIcon} title="Requirement thresholds" caption={prerequisite ? `${prerequisite.name} is measured in ${hold ? "seconds held" : "reps"}. Every set must reach the minimum.` : "Choose the prerequisite exercise to see how it is measured."} />
          <Box sx={{ mt: 2, display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" } }}>
            <Box sx={{ p: 2, border: `1px solid ${CM.border}`, borderRadius: "14px", bgcolor: CM.surfaceSoft, transition: "border-color .2s ease", "&:focus-within": { borderColor: CM.violetBright } }}>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
                <FitnessCenterRoundedIcon sx={{ fontSize: 14, color: CM.green }} />
                <Typography variant="caption" sx={{ color: CM.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 10.5 }}>Sets</Typography>
              </Stack>
              <TextField type="number" fullWidth label="Sets required" value={form.requiredSets} onChange={(e) => set({ requiredSets: e.target.value })} inputProps={{ min: 1, max: 20 }} size="small" />
            </Box>
            <Box sx={{ p: 2, border: `1px solid ${CM.border}`, borderRadius: "14px", bgcolor: CM.surfaceSoft, transition: "border-color .2s ease", "&:focus-within": { borderColor: CM.violetBright } }}>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
                {hold
                  ? <TimerRoundedIcon sx={{ fontSize: 14, color: CM.amber }} />
                  : <RepeatRoundedIcon sx={{ fontSize: 14, color: CM.amber }} />}
                <Typography variant="caption" sx={{ color: CM.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 10.5 }}>{hold ? "Duration" : "Repetitions"}</Typography>
              </Stack>
              {hold
                ? <TextField type="number" fullWidth label="Seconds per set" value={form.requiredSeconds} onChange={(e) => set({ requiredSeconds: e.target.value })} inputProps={{ min: 1 }} InputProps={{ endAdornment: <InputAdornment position="end">s</InputAdornment> }} size="small" />
                : <TextField type="number" fullWidth label="Reps per set" value={form.requiredReps} onChange={(e) => set({ requiredReps: e.target.value })} inputProps={{ min: 1 }} size="small" />}
            </Box>
            <Box sx={{ p: 2, border: `1px solid ${CM.border}`, borderRadius: "14px", bgcolor: CM.surfaceSoft, transition: "border-color .2s ease", "&:focus-within": { borderColor: CM.violetBright } }}>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
                <SpeedRoundedIcon sx={{ fontSize: 14, color: CM.pink }} />
                <Typography variant="caption" sx={{ color: CM.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 10.5 }}>Accuracy</Typography>
              </Stack>
              <TextField type="number" fullWidth label="Minimum clean form" value={form.minAccuracy} onChange={(e) => set({ minAccuracy: e.target.value })} inputProps={{ min: 1, max: 100 }} InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} helperText={hold ? "Share of held time with correct form" : "Share of reps with correct form"} size="small" />
            </Box>
          </Box>
        </Box>

        {/* ─── Live Preview ─── */}
        {prerequisite && exercise && <Box sx={{
          p: 2, mt: 1, mb: 2, border: `1px dashed ${CM.borderStrong}`, borderRadius: "14px",
          bgcolor: "rgba(139,92,246,0.04)",
        }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
            <TrendingUpRoundedIcon sx={{ fontSize: 16, color: CM.violetBright }} />
            <Typography variant="caption" sx={{ color: CM.violetBright, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 10.5 }}>Live Preview</Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: CM.textMuted, lineHeight: 1.7 }}>
            A member trains <Typography component="span" sx={{ color: "#fff", fontWeight: 700 }}>{prerequisite.name}</Typography> and completes{" "}
            <Typography component="span" sx={{ color: CM.green, fontWeight: 800 }}>{form.requiredSets || "?"}</Typography>{" "}
            set{Number(form.requiredSets) !== 1 ? "s" : ""} of{" "}
            <Typography component="span" sx={{ color: CM.amber, fontWeight: 800 }}>
              {hold ? `${form.requiredSeconds || "?"} seconds` : `${form.requiredReps || "?"} reps`}
            </Typography>{" "}
            each, with at least{" "}
            <Typography component="span" sx={{ color: CM.pink, fontWeight: 800 }}>{form.minAccuracy || "?"}%</Typography>{" "}
            clean form → unlocks{" "}
            <Typography component="span" sx={{ color: CM.violetBright, fontWeight: 700 }}>{exercise.name}</Typography>.
          </Typography>
        </Box>}

        <Divider sx={{ borderColor: CM.border, my: 1 }} />

        {/* ─── Status Toggle ─── */}
        <Box sx={{ mt: 2, p: 1.5, border: `1px solid ${CM.border}`, borderRadius: "12px", bgcolor: CM.surfaceSoft }}>
          <FormControlLabel
            control={<Switch checked={form.status === "ACTIVE"} onChange={(e) => set({ status: e.target.checked ? "ACTIVE" : "INACTIVE" })} />}
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircleOutlineRoundedIcon sx={{ fontSize: 18, color: form.status === "ACTIVE" ? CM.green : CM.textDim }} />
                <Typography variant="body2" sx={{ color: form.status === "ACTIVE" ? "#fff" : CM.textMuted, fontWeight: 600 }}>
                  {form.status === "ACTIVE" ? "Active: members can unlock with this rule" : "Inactive: the rule is ignored"}
                </Typography>
              </Stack>
            }
          />
        </Box>

        {/* ─── Actions ─── */}
        <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 3 }}>
          <Button component={RouterLink} to={backTo} variant="outlined">Cancel</Button>
          <Button type="submit" variant="contained" disabled={save.isPending} sx={{ minWidth: 140 }}>
            {save.isPending ? "Saving…" : editing ? "Save changes" : "Create rule"}
          </Button>
        </Stack>
      </Box>
    </Card>
  </Box>;
}
