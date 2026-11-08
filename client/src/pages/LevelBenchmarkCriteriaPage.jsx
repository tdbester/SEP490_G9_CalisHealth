import { useMemo, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Alert, Box, Button, Card, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Divider, IconButton, InputAdornment, Menu, MenuItem,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import { keyframes } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import FitnessCenterRoundedIcon from "@mui/icons-material/FitnessCenterRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/KeyboardArrowUpRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import RuleRoundedIcon from "@mui/icons-material/RuleRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import TimerRoundedIcon from "@mui/icons-material/TimerRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import { contentManagerApi } from "../api/contentManager";
import { useApiMutation, useApiQuery } from "../hooks";
import { buildLevelToneMap } from "../useLevelNames";
import { CONTENT_PATHS, ContentPageHeader, DarkPill, SummaryCard, formatDate } from "../components/ContentShared";
import { CM } from "../theme-content";

const rise = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;
const enter = (delay = 0) => ({
  animation: `${rise} .45s ease-out ${delay}ms both`,
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
});

const MAX_EXERCISES = 8;
const PAGE_SIZE = 5;
const BREADCRUMB = [
  { labelKey: "nav.role.admin", to: CONTENT_PATHS.dashboard },
  { labelKey: "nav.assessmentSystem", to: CONTENT_PATHS.dashboard },
  { labelKey: "nav.levelBenchmarkCriteria" },
];

const statusText = (value, t) => (value === "ACTIVE" ? t("contentManager.levelBenchmark.active") : t("contentManager.levelBenchmark.inactive"));
const statusTone = (value) => value === "ACTIVE" ? "success" : "neutral";
const scoreRange = (row, t) => t("contentManager.levelBenchmark.scoreRange", { min: row.scoreMin, max: row.scoreMax });
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
const validateLevelNames = (levels, t) => {
  const names = levels.map((level) => String(level.name || "").trim().toLowerCase());
  return [
    ...(names.some((name) => !name) ? [t("contentManager.levelBenchmark.errNameRequired")] : []),
    ...(new Set(names.filter(Boolean)).size !== names.filter(Boolean).length ? [t("contentManager.levelBenchmark.errNameUnique")] : []),
    ...(levels.length && levels.every((level) => level.status !== "ACTIVE") ? [t("contentManager.levelBenchmark.errOneActive")] : []),
  ];
};
const validateScoreRanges = (levels, ceiling, t) => levels.flatMap((level) => {
  const min = Number(level.scoreMin);
  const max = Number(level.scoreMax);
  const name = level.name || t("contentManager.levelBenchmark.levelFallback");
  if (level.scoreMax === "" || !Number.isInteger(max)) return [t("contentManager.levelBenchmark.errMaxWholeNumber", { name })];
  if (max < min) return [t("contentManager.levelBenchmark.errMaxAtLeast", { name, min })];
  if (max > ceiling) return [t("contentManager.levelBenchmark.errMaxExceeds", { name, max: ceiling })];
  return [];
});
const validateThresholds = (rules, t) => {
  const errors = rules.flatMap((rule, index) => {
    const label = t("contentManager.levelBenchmark.exerciseLabelIndex", { count: index + 1 });
    const onePoint = Number(rule.beginnerMax);
    const twoPoints = Number(rule.intermediateMax);
    if (!rule.code) return [t("contentManager.levelBenchmark.errChooseExercise", { label })];
    return !Number.isFinite(onePoint) || onePoint < 1 || !Number.isFinite(twoPoints) || twoPoints <= onePoint
      ? [t("contentManager.levelBenchmark.errTwoPointsGreater", { label })]
      : [];
  });
  const duplicate = (field, message) => new Set(rules.map((rule) => rule[field]).filter(Boolean)).size !== rules.filter((rule) => rule[field]).length ? [message] : [];
  return [...errors, ...duplicate("code", t("contentManager.levelBenchmark.errDuplicateExercise"))];
};
// Points are per exercise, not per level: the same two cut-offs apply whichever level the total lands in.
// Returns the text of the 1 / 2 / 3 point cells for one exercise.
const pointBands = (rule, t) => {
  const unit = rule.category === "HOLD" ? t("contentManager.levelBenchmark.unitSeconds") : t("contentManager.levelBenchmark.unitReps");
  const onePoint = Number(rule.beginnerMax);
  const twoPoints = Number(rule.intermediateMax);
  if (!Number.isFinite(onePoint) || !Number.isFinite(twoPoints)) return ["—", "—", "—"];
  return [
    t("contentManager.levelBenchmark.bandOne", { value: onePoint, unit }),
    t("contentManager.levelBenchmark.bandTwo", { min: onePoint + 1, max: twoPoints, unit }),
    t("contentManager.levelBenchmark.bandThree", { value: twoPoints, unit }),
  ];
};
const POINT_COLUMNS = [
  { label: "contentManager.levelBenchmark.pointOne", color: CM.amber },
  { label: "contentManager.levelBenchmark.pointTwo", color: CM.violetBright },
  { label: "contentManager.levelBenchmark.pointThree", color: CM.green },
];

function PointRules({ rules }) {
  const { t } = useTranslation();
  if (!rules.length) return <Typography variant="body2" sx={{ color: CM.textMuted, p: 2 }}>{t("contentManager.levelBenchmark.noBenchmarkExercise")}</Typography>;
  return <TableContainer>
    <Table size="small" sx={{ minWidth: 640 }}>
      <TableHead>
        <TableRow>
          <TableCell sx={{ width: 56 }}>{t("contentManager.levelBenchmark.colIndex")}</TableCell>
          <TableCell>{t("contentManager.levelBenchmark.colExercise")}</TableCell>
          <TableCell>{t("contentManager.levelBenchmark.colMeasuredIn")}</TableCell>
          {POINT_COLUMNS.map((column) => <TableCell key={column.label}>{t(column.label)}</TableCell>)}
        </TableRow>
      </TableHead>
      <TableBody>{rules.map((rule, index) => {
        const bands = pointBands(rule, t);
        return <TableRow hover key={rule.code}>
          <TableCell><Typography variant="caption" sx={{ color: CM.textDim, fontWeight: 700 }}>{index + 1}</Typography></TableCell>
          <TableCell><Typography sx={{ color: "#fff", fontWeight: 600 }}>{rule.name}</Typography></TableCell>
          <TableCell><DarkPill tone={rule.category === "HOLD" ? "primary" : "neutral"}>{rule.category === "HOLD" ? t("contentManager.levelBenchmark.holdSeconds") : t("contentManager.levelBenchmark.reps")}</DarkPill></TableCell>
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
  const glow = tone === "success" ? "rgba(120,232,136,0.22)" : tone === "warning" ? "rgba(248,200,88,0.22)" : "rgba(139,92,246,0.25)";
  return (
    <Box sx={{
      position: "relative",
      overflow: "hidden",
      px: 2,
      py: 1.75,
      border: `1px solid ${CM.border}`,
      borderRadius: "14px",
      bgcolor: CM.surface,
      textAlign: "center",
      transition: "border-color .2s ease, transform .2s ease, box-shadow .2s ease",
      "&:hover": { borderColor: CM.borderStrong },
    }}>
      <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center">
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, bgcolor: color }} />
        <Typography variant="caption" sx={{ color: CM.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 10.5 }}>{label}</Typography>
      </Stack>
      <Typography sx={{ color: "#fff", fontSize: 36, fontWeight: 800, lineHeight: 1.15, mt: 0.5 }}>{count}</Typography>
      <Typography variant="caption" sx={{ color: CM.textMuted }}>{caption}</Typography>
    </Box>
  );
}

export default function LevelBenchmarkCriteriaPage() {
  const { t } = useTranslation();
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
    onSuccess: () => { setDeleting(null); setNotice(t("contentManager.levelBenchmark.levelDeleted")); query.refetch(); },
  });
  const [notice, setNotice] = useState("");

  if (query.isLoading) return <Box sx={{ py: 10, display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
  if (query.error) return <Box sx={{ p: 3 }}><Heading title={t("contentManager.levelBenchmark.unavailable")} description={query.error.message} /><Button onClick={query.refetch} sx={{ mt: 2 }} variant="outlined">{t("contentManager.levelBenchmark.retry")}</Button></Box>;

  return <Box sx={{ maxWidth: 1440, mx: "auto", px: { xs: 2, sm: 3, xl: 4 }, py: 2.5 }}>
    <Heading
      title={t("contentManager.levelBenchmark.title")}
      description={t("contentManager.levelBenchmark.description")}
      action={<Button component={RouterLink} to={`${CONTENT_PATHS.levelCriteria}/edit`} variant="contained" startIcon={<RuleRoundedIcon />}>{t("contentManager.levelBenchmark.updateCriteria")}</Button>}
    />
    <Box sx={{ mt: 2.5, display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" } }}>
      <Box sx={enter(0)}><SummaryMetric label={t("contentManager.levelBenchmark.totalLevels")} count={levels.length} caption={t("contentManager.levelBenchmark.configuredLevels")} /></Box>
      <Box sx={enter(80)}><SummaryMetric label={t("contentManager.levelBenchmark.active")} count={levels.filter((x) => x.status === "ACTIVE").length} caption={t("contentManager.levelBenchmark.liveLevels")} tone="success" /></Box>
      <Box sx={enter(160)}><SummaryMetric label={t("contentManager.levelBenchmark.inactive")} count={levels.filter((x) => x.status === "INACTIVE").length} caption={t("contentManager.levelBenchmark.hiddenLevels")} tone="warning" /></Box>
    </Box>
    {location.state?.successMessage && <Alert sx={{ mt: 2 }} severity="success" onClose={() => navigate(location.pathname, { replace: true, state: null })}>{location.state.successMessage}</Alert>}
    {notice && <Alert sx={{ mt: 2 }} severity="success" onClose={() => setNotice("")}>{notice}</Alert>}
    <Card sx={{ mt: 2.25, overflow: "hidden", ...enter(220) }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} sx={{ p: 2, borderBottom: `1px solid ${CM.border}` }}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "stretch", lg: "center" }} sx={{ width: "100%" }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box sx={{ width: 36, height: 36, borderRadius: "10px", display: "grid", placeItems: "center", bgcolor: "rgba(139,92,246,0.15)", border: `1px solid ${CM.border}` }}>
              <LayersRoundedIcon sx={{ color: CM.violetBright, fontSize: 20 }} />
            </Box>
            <Box>
              <Typography sx={{ color: "#fff", fontWeight: 700 }}>{t("contentManager.levelBenchmark.criteriaTitle")}</Typography>
              <Typography variant="caption" sx={{ color: CM.textMuted }}>{t("contentManager.levelBenchmark.criteriaSubtitle")}</Typography>
            </Box>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
            <TextField size="small" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder={t("contentManager.levelBenchmark.searchPlaceholder")} sx={{ width: { xs: "100%", sm: 360, lg: 460 } }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }} />
            <TextField select size="small" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} sx={{ minWidth: 145 }}>
              <MenuItem value="all">{t("contentManager.levelBenchmark.allStatus")}</MenuItem><MenuItem value="active">{t("contentManager.levelBenchmark.active")}</MenuItem><MenuItem value="inactive">{t("contentManager.levelBenchmark.inactive")}</MenuItem>
            </TextField>
            <Tooltip title={t("contentManager.levelBenchmark.refresh")}><span><IconButton onClick={query.refetch} disabled={query.isFetching} sx={{ border: `1px solid ${CM.border}`, borderRadius: 1.25, transition: "all .2s ease", "&:hover": { borderColor: CM.violetBright, bgcolor: "rgba(139,92,246,0.1)" } }}>{query.isFetching ? <CircularProgress size={17} /> : <RefreshRoundedIcon />}</IconButton></span></Tooltip>
          </Stack>
        </Stack>
      </Stack>
      <TableContainer><Table size="small" sx={{ minWidth: 900 }}><TableHead><TableRow><TableCell>{t("contentManager.levelBenchmark.colLevel")}</TableCell><TableCell>{t("contentManager.levelBenchmark.colScoreRange")}</TableCell><TableCell>{t("contentManager.levelBenchmark.colFormula")}</TableCell><TableCell>{t("contentManager.levelBenchmark.colStatus")}</TableCell><TableCell>{t("contentManager.levelBenchmark.colUpdated")}</TableCell><TableCell align="center">{t("contentManager.levelBenchmark.colAction")}</TableCell></TableRow></TableHead><TableBody>{visible.map((row, index) => <TableRow hover key={row.id} sx={{ transition: "all .2s ease", "&:hover": { bgcolor: "rgba(139,92,246,0.06)" }, ...enter(260 + index * 40) }}><TableCell><Stack spacing={0.5} alignItems="center"><DarkPill tone={levelTone(row.name || row.level)}>{row.name || row.level}</DarkPill><Typography variant="caption" sx={{ color: CM.textDim, fontWeight: 700 }}>{t("contentManager.levelBenchmark.tier", { count: currentPage * PAGE_SIZE + index + 1 })}</Typography></Stack></TableCell><TableCell><Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 20, lineHeight: 1.2 }}>{scoreRange(row, t)}</Typography><Typography variant="caption" sx={{ color: CM.textDim }}>{t("contentManager.levelBenchmark.totalScore")}</Typography></TableCell><TableCell><Typography variant="body2" sx={{ color: "#fff" }}>{t("contentManager.levelBenchmark.formulaSum")}</Typography><Typography variant="caption" sx={{ color: CM.textMuted }}>{rules.length ? rules.map((rule) => rule.name).join(" + ") : t("contentManager.levelBenchmark.noExerciseConfigured")}</Typography></TableCell><TableCell><DarkPill tone={statusTone(row.status)}>{statusText(row.status, t)}</DarkPill></TableCell><TableCell><Typography variant="caption" display="block" sx={{ color: CM.textMuted }}>{formatDate(row.updatedAt)}</Typography><Typography variant="caption" sx={{ color: CM.textDim }}>{t("contentManager.levelBenchmark.by", { name: row.updatedBy || t("contentManager.levelBenchmark.system") })}</Typography></TableCell><TableCell align="center"><Stack direction="row" justifyContent="center" alignItems="center" spacing={0.5}><Button component={RouterLink} to={`${CONTENT_PATHS.levelCriteria}/${row.id}`} size="small" variant="outlined">{t("contentManager.levelBenchmark.view")}</Button><IconButton size="small" onClick={(e) => setMenu({ anchor: e.currentTarget, entry: row })}><MoreVertRoundedIcon fontSize="small" /></IconButton></Stack></TableCell></TableRow>)}{!visible.length && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}><Stack alignItems="center" spacing={1}><RuleRoundedIcon sx={{ fontSize: 44, color: CM.textDim, opacity: 0.4 }} /><Typography sx={{ color: CM.textMuted }}>{t("contentManager.levelBenchmark.noMatch")}</Typography></Stack></TableCell></TableRow>}</TableBody></Table></TableContainer>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 1.5, borderTop: `1px solid ${CM.border}` }}><Typography variant="caption" sx={{ color: CM.textMuted }}>{t("contentManager.levelBenchmark.showingRows", { from: filtered.length ? currentPage * PAGE_SIZE + 1 : 0, to: Math.min((currentPage + 1) * PAGE_SIZE, filtered.length), count: filtered.length })}</Typography><Stack direction="row" spacing={0.5}><IconButton disabled={currentPage === 0} onClick={() => setPage((x) => x - 1)}><ChevronLeftRoundedIcon /></IconButton><IconButton disabled={!pages || currentPage >= pages - 1} onClick={() => setPage((x) => x + 1)}><ChevronRightRoundedIcon /></IconButton></Stack></Stack>
    </Card>
    <Card sx={{ mt: 2.25, overflow: "hidden", ...enter(300) }}>
      <Box sx={{ p: 2, borderBottom: `1px solid ${CM.border}`, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: "10px", display: "grid", placeItems: "center", bgcolor: "rgba(139,92,246,0.15)", border: `1px solid ${CM.border}` }}>
          <FitnessCenterRoundedIcon sx={{ color: CM.violetBright, fontSize: 20 }} />
        </Box>
        <Box>
          <Typography sx={{ color: "#fff", fontWeight: 700 }}>{t("contentManager.levelBenchmark.pointRulesTitle")}</Typography>
          <Typography variant="caption" sx={{ color: CM.textMuted }}>{t("contentManager.levelBenchmark.pointRulesSubtitle", { count: rules.length || 0 })}</Typography>
        </Box>
      </Box>
      <PointRules rules={rules} />
    </Card>
    <Menu anchorEl={menu.anchor} open={Boolean(menu.anchor)} onClose={closeMenu}>      <MenuItem onClick={() => { if (menu.entry) statusMutation.mutate({ level: menu.entry.name || menu.entry.level, nextStatus: menu.entry.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }); closeMenu(); }}>{menu.entry?.status === "ACTIVE" ? t("contentManager.levelBenchmark.deactivate") : t("contentManager.levelBenchmark.activate")}</MenuItem><MenuItem disabled={levels.length <= 1} sx={{ color: "error.main" }} onClick={() => { deleteMutation.reset(); setDeleting(menu.entry); closeMenu(); }}>{t("contentManager.levelBenchmark.delete")}</MenuItem></Menu>
    <Dialog open={Boolean(deleting)} onClose={() => !deleteMutation.isPending && setDeleting(null)}>
      <DialogTitle>{t("contentManager.levelBenchmark.deleteTitle")}</DialogTitle>
      <DialogContent>
        <DialogContentText>{t("contentManager.levelBenchmark.deleteMessage", { name: deleting?.name || deleting?.level, range: deleting ? scoreRange(deleting, t) : "" })}</DialogContentText>
        {deleteMutation.error && <Alert severity="error" sx={{ mt: 2 }}>{deleteMutation.error.message}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDeleting(null)} disabled={deleteMutation.isPending}>{t("contentManager.levelBenchmark.cancel")}</Button>
        <Button color="error" variant="contained" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleting.id)}>{deleteMutation.isPending ? t("contentManager.levelBenchmark.deleting") : t("contentManager.levelBenchmark.delete")}</Button>
      </DialogActions>
    </Dialog>
  </Box>;
}

export function LevelBenchmarkDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const query = useApiQuery(() => contentManagerApi.levelBenchmarkConfiguration());
  const row = query.data?.levels?.find((x) => String(x.id) === String(id));
  const rules = query.data?.exercises || [];
  const memberLevels = useApiQuery(() => contentManagerApi.memberLevels());
  if (!row) return <Box sx={{ p: 3 }}><Heading title={query.isLoading ? t("contentManager.levelBenchmark.loading") : t("contentManager.levelBenchmark.notFound")} description="" /><Button component={RouterLink} to={CONTENT_PATHS.levelCriteria} variant="outlined" startIcon={<ArrowBackRoundedIcon />}>{t("contentManager.levelBenchmark.back")}</Button></Box>;
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
    <Button component={RouterLink} to={CONTENT_PATHS.levelCriteria} variant="outlined" startIcon={<ArrowBackRoundedIcon />}>{t("contentManager.levelBenchmark.back")}</Button>
    <Button component={RouterLink} to={`${CONTENT_PATHS.levelCriteria}/edit`} variant="contained">{t("contentManager.levelBenchmark.update")}</Button>
  </Stack>;
  return <Box sx={{ maxWidth: 1100, mx: "auto", px: 3, py: 2.5 }}>
    <Heading breadcrumb={[...BREADCRUMB.slice(0, -1), { labelKey: "nav.levelBenchmarkCriteria", to: CONTENT_PATHS.levelCriteria }, { label: name }]} title={name} description={t("contentManager.levelBenchmark.detailDescription")} action={actions} />
    <Box sx={{ mt: 2.5, display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" } }}>
      <Box sx={enter(0)}><Detail icon={LayersRoundedIcon} label={t("contentManager.levelBenchmark.labelTier")} value={t("contentManager.levelBenchmark.tierOf", { tier, total: sorted.length })} /></Box>
      <Box sx={enter(70)}><Detail icon={StarRoundedIcon} label={t("contentManager.levelBenchmark.labelScoreRange")} value={scoreRange(row, t)} /></Box>
      <Box sx={enter(140)}><Detail icon={FitnessCenterRoundedIcon} label={t("contentManager.levelBenchmark.labelMembers")} value={memberLevels.isLoading ? "…" : memberCount.toLocaleString()} hint={memberLevels.error ? t("contentManager.levelBenchmark.unavailableShort") : t("contentManager.levelBenchmark.memberShare", { count: memberShare })} /></Box>
      <Box sx={enter(210)}><Detail icon={TimerRoundedIcon} label={t("contentManager.levelBenchmark.labelLastUpdated")} value={formatDate(row.updatedAt)} hint={t("contentManager.levelBenchmark.by", { name: row.updatedBy || t("contentManager.levelBenchmark.system") })} /></Box>
    </Box>
    <Card sx={{ mt: 2.25, overflow: "hidden", ...enter(260) }}>
      <Box sx={{ p: 2.5, borderBottom: `1px solid ${CM.border}`, }}>
        <Typography sx={{ color: "#fff", fontWeight: 700 }}>{t("contentManager.levelBenchmark.howToReach", { name })}</Typography>
        {rules.length ? <>
          <Stack direction="row" spacing={1.25} alignItems="baseline" flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
            <Typography sx={{ color: CM.violetBright, fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{row.scoreMin} – {row.scoreMax} {t("contentManager.levelBenchmark.unitPoints")}</Typography>
            <Typography variant="body2" sx={{ color: CM.textMuted }}>{t("contentManager.levelBenchmark.totalScoreOutOf", { max: maxTotal })}</Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: CM.textMuted, mt: 0.75 }}>
            {t("contentManager.levelBenchmark.reachExplanation", { count: rules.length, min: row.scoreMin, max: row.scoreMax, name })}
          </Typography>
          <Box sx={{ mt: 2, display: "flex", gap: 0.6, flexWrap: "wrap" }} role="img" aria-label={t("contentManager.levelBenchmark.totalsAria", { min: minTotal, max: maxTotal, name, from: row.scoreMin, to: row.scoreMax })}>
            {totals.map((total) => {
              const inLevel = total >= row.scoreMin && total <= row.scoreMax;
              return <Box key={total} sx={{
                minWidth: 36, px: 1, py: 0.6, textAlign: "center", borderRadius: "8px", fontSize: 13, fontWeight: 700,
                color: inLevel ? "#fff" : CM.textDim,
                bgcolor: inLevel ? CM.violet : "rgba(139,92,246,0.06)",
                border: `1px solid ${inLevel ? CM.violetBright : CM.border}`,
                transition: "all .2s ease",
              }}>{total}</Box>;
            })}
          </Box>
        </> : <Typography variant="caption" sx={{ color: CM.textMuted }}>{t("contentManager.levelBenchmark.noBenchmarkExercise")}</Typography>}
      </Box>
      <PointRules rules={rules} />
    </Card>
  </Box>;
}
function LevelEditor({ levels, floor, ceiling, canRemove, removeHint, onChange, onMove, onRemove }) {
  const { t } = useTranslation();
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
      sx={{
        display: "grid", gap: 1, alignItems: "start", gridTemplateColumns: { xs: "1fr", md: "auto 1.4fr 1fr 1fr 1fr auto" },
        p: 1.5, border: `1px solid ${overIndex === index && dragIndex !== null && dragIndex !== index ? CM.violetBright : CM.border}`,
        borderRadius: "12px", bgcolor: CM.surfaceSoft, opacity: dragIndex === index ? 0.5 : 1,
        transition: "all .2s ease", "&:hover": { borderColor: CM.borderStrong },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={0.25} sx={{ pt: 0.75 }}>
        <Tooltip title={t("contentManager.levelBenchmark.dragToReorder")}><Box
          component="span"
          draggable
          aria-label={t("contentManager.levelBenchmark.dragAria", { name: level.name || t("contentManager.levelBenchmark.thisLevel") })}
          onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(index)); const row = e.currentTarget.closest("[data-level-row]"); if (row) e.dataTransfer.setDragImage(row, 16, 16); setDragIndex(index); }}
          onDragEnd={endDrag}
          sx={{ display: "inline-flex", cursor: "grab", color: CM.textMuted, "&:active": { cursor: "grabbing" } }}
        ><DragIndicatorRoundedIcon /></Box></Tooltip>
        <Stack>
          <IconButton size="small" aria-label={t("contentManager.levelBenchmark.moveUpAria", { name: level.name || t("contentManager.levelBenchmark.thisLevel") })} disabled={index === 0} onClick={() => onMove(index, index - 1)} sx={{ p: 0 }}><KeyboardArrowUpRoundedIcon fontSize="small" /></IconButton>
          <IconButton size="small" aria-label={t("contentManager.levelBenchmark.moveDownAria", { name: level.name || t("contentManager.levelBenchmark.thisLevel") })} disabled={isLast} onClick={() => onMove(index, index + 1)} sx={{ p: 0 }}><KeyboardArrowDownRoundedIcon fontSize="small" /></IconButton>
        </Stack>
      </Stack>
      <TextField size="small" label={t("contentManager.levelBenchmark.labelLevelName")} value={level.name} helperText=" " onChange={(e) => onChange(level.id, "name", e.target.value)} />
      <TextField size="small" disabled type="number" label={t("contentManager.levelBenchmark.labelMinScore")} value={level.scoreMin} helperText={index === 0 ? t("contentManager.levelBenchmark.alwaysStartsAt", { value: floor }) : t("contentManager.levelBenchmark.previousMaxPlusOne")} />
      <TextField size="small" disabled={isLast} type="number" label={t("contentManager.levelBenchmark.labelMaxScore")} value={level.scoreMax} onChange={(e) => onChange(level.id, "scoreMax", e.target.value)} helperText={isLast ? t("contentManager.levelBenchmark.alwaysEndsAt", { value: ceiling }) : " "} inputProps={{ min: level.scoreMin, max: ceiling }} />
      <TextField size="small" select label={t("contentManager.levelBenchmark.labelStatus")} value={level.status} onChange={(e) => onChange(level.id, "status", e.target.value)}><MenuItem value="ACTIVE">{t("contentManager.levelBenchmark.active")}</MenuItem><MenuItem value="INACTIVE">{t("contentManager.levelBenchmark.inactive")}</MenuItem></TextField>
      <Tooltip title={canRemove ? t("contentManager.levelBenchmark.removeLevelTitle") : removeHint}><span><IconButton size="small" color="error" aria-label={t("contentManager.levelBenchmark.removeLevelAria", { count: index + 1 })} disabled={!canRemove} onClick={() => onRemove(level.id)} sx={{ mt: 0.5 }}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
    </Box>;
  })}</Stack>;
}

function ExerciseEditor({ rules, exerciseOptions, canAdd, canRemove, minExercises, floor, ceiling, errors, onAdd, onRemove, onChooseExercise, onChange }) {
  const { t } = useTranslation();
  return <Box sx={{ mt: 3 }}>
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={1}>
      <Box>
        <Typography sx={{ color: "#fff", fontWeight: 700 }}>{t("contentManager.levelBenchmark.exercisesTitle")}</Typography>
        <Typography variant="caption" sx={{ color: CM.textMuted }}>{t("contentManager.levelBenchmark.exercisesSubtitle", { count: rules.length, min: floor, max: ceiling })}</Typography>
      </Box>
      <Tooltip title={canAdd ? "" : t("contentManager.levelBenchmark.maxExercises", { count: MAX_EXERCISES })}><Box component="span" sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", sm: "center" } }}><Button variant="outlined" size="small" startIcon={<AddRoundedIcon fontSize="small" />} disabled={!canAdd} onClick={onAdd} sx={{ whiteSpace: "nowrap", py: 0.25, px: 1.25, minWidth: 0, fontSize: 13 }}>{t("contentManager.levelBenchmark.addExercise")}</Button></Box></Tooltip>
    </Stack>
    {errors.map((error) => <Alert key={error} severity="error" sx={{ mt: 1.5 }}>{error}</Alert>)}
    {!rules.length && <Alert severity="info" sx={{ mt: 1.5 }}>{t("contentManager.levelBenchmark.noExerciseYet")}</Alert>}
    <Stack spacing={1.5} sx={{ mt: 1.5 }}>{rules.map((rule, index) => {
      const unit = rule.category === "HOLD" ? t("contentManager.levelBenchmark.unitSeconds") : t("contentManager.levelBenchmark.unitReps");
      const onePoint = Number(rule.beginnerMax);
      const twoPoints = Number(rule.intermediateMax);
      const twoPointsFrom = rule.beginnerMax !== "" && rule.beginnerMax != null && Number.isFinite(onePoint) && onePoint >= 1 ? onePoint + 1 : "";
      const threePointsFrom = rule.intermediateMax !== "" && rule.intermediateMax != null && Number.isFinite(twoPoints) && twoPoints >= 1 ? twoPoints + 1 : "";
      const picked = exerciseOptions.find((x) => x.code === rule.code);
      const sameCategory = exerciseOptions.filter((x) => !rule.category || x.category === rule.category || x.code === rule.code);
      return <Box key={rule.rowKey} sx={{ p: 1.75, border: `1px solid ${CM.border}`, borderRadius: "14px", bgcolor: CM.surfaceSoft, transition: "all .2s ease", "&:hover": { borderColor: CM.borderStrong } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="caption" sx={{ color: CM.violetBright, fontWeight: 700, letterSpacing: "0.06em" }}>{t("contentManager.levelBenchmark.exerciseIndex", { count: index + 1 })}{picked ? ` · ${picked.category === "HOLD" ? "HOLD" : "REPS"}` : ""}</Typography>
          <Tooltip title={canRemove ? t("contentManager.levelBenchmark.removeExerciseTitle") : t("contentManager.levelBenchmark.removeExerciseHint", { count: minExercises })}><span><IconButton size="small" color="error" aria-label={t("contentManager.levelBenchmark.removeExerciseAria", { count: index + 1 })} disabled={!canRemove} onClick={() => onRemove(rule.rowKey)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
        </Stack>
        <TextField size="small" select fullWidth label={t("contentManager.levelBenchmark.exerciseLabel")} value={rule.code || ""} onChange={(e) => onChooseExercise(rule.rowKey, e.target.value)} sx={{ mb: 1.5 }}>{sameCategory.map((x) => <MenuItem key={x.code} value={x.code}>{x.name}</MenuItem>)}</TextField>
        <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" } }}>
          {POINT_COLUMNS.map((column, bandIndex) => {
            const from = bandIndex === 0 ? 1 : bandIndex === 1 ? twoPointsFrom : threePointsFrom;
            return <Box key={column.label} sx={{ p: 1.25, border: `1px solid ${CM.border}`, borderLeft: `3px solid ${column.color}`, borderRadius: "10px", bgcolor: "rgba(12,8,27,0.3)" }}>
              <Typography variant="caption" sx={{ color: column.color, fontWeight: 800 }}>{t(column.label).toUpperCase()}</Typography>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.75 }}>
                <Typography variant="body2" sx={{ color: "#fff", whiteSpace: "nowrap" }}>{bandIndex < 2 ? <>{t("contentManager.levelBenchmark.fromPrefix")} <b>{from === "" ? "…" : from}</b> {t("contentManager.levelBenchmark.toSuffix")}</> : <>{t("contentManager.levelBenchmark.fromPrefix")} <b>{from === "" ? "…" : from}</b> {unit} {t("contentManager.levelBenchmark.andAbove")}</>}</Typography>
                {bandIndex === 0 && <TextField size="small" type="number" aria-label={t("contentManager.levelBenchmark.onePointAria", { unit })} value={rule.beginnerMax ?? ""} onChange={(e) => onChange(rule.rowKey, { beginnerMax: e.target.value })} inputProps={{ min: 1 }} sx={{ flex: 1, minWidth: 80 }} />}
                {bandIndex === 1 && <TextField size="small" type="number" aria-label={t("contentManager.levelBenchmark.twoPointsAria", { unit })} value={rule.intermediateMax ?? ""} onChange={(e) => onChange(rule.rowKey, { intermediateMax: e.target.value })} inputProps={{ min: twoPointsFrom || 2 }} sx={{ flex: 1, minWidth: 80 }} />}
                {bandIndex === 0 || bandIndex === 1 ? <Typography variant="body2" sx={{ color: CM.textMuted }}>{unit}</Typography> : <Typography variant="body2" sx={{ color: CM.textMuted }}>{t("contentManager.levelBenchmark.andAbove")}</Typography>}
              </Stack>
            </Box>;
          })}
        </Box>
      </Box>;
    })}</Stack>
  </Box>;
}
function Detail({ label, value, hint, icon: Icon }) {
  return <Box sx={{
    position: "relative", overflow: "hidden", p: 1.75, border: `1px solid ${CM.border}`, borderRadius: "14px", bgcolor: CM.surface,
    textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    transition: "border-color .2s ease, transform .2s ease, box-shadow .2s ease",
    "&:hover": { borderColor: CM.borderStrong },
  }}>
    <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center" sx={{ mb: 0.5 }}>
      {Icon && <Icon sx={{ fontSize: 15, color: CM.violetBright }} aria-hidden />}
      <Typography variant="caption" sx={{ color: CM.textDim, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 10.5 }}>{label}</Typography>
    </Stack>
    {typeof value === "string" ? <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 24, lineHeight: 1.25 }}>{value}</Typography> : value}
    {hint && <Typography variant="caption" sx={{ color: CM.textMuted, display: "block", mt: 0.25 }}>{hint}</Typography>}
  </Box>;
}

export function LevelBenchmarkFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const query = useApiQuery(() => contentManagerApi.levelBenchmarkConfiguration());
  const save = useApiMutation((payload) => contentManagerApi.updateLevelBenchmarkConfiguration(payload), { onSuccess: () => navigate(CONTENT_PATHS.levelCriteria, { state: { successMessage: t("contentManager.levelBenchmark.allUpdated") } }) });
  const [levels, setLevels] = useState(null);
  const [rules, setRules] = useState(null);
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const data = query.data;
  if (query.isLoading || !data) return <Box sx={{ py: 10, display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
  const currentRules = rules || data.exercises.map((x) => ({ ...x, rowKey: x.code }));
  const floor = scoreFloor(currentRules.length);
  const ceiling = scoreCeiling(currentRules.length);
  const currentLevels = levels || normalizeLevels([...data.levels].sort((a, b) => a.scoreMin - b.scoreMin).map((x) => ({ ...x, name: x.name || x.level })), floor, ceiling);
  const exerciseOptions = data.availableExercises || [];
  const setLevel = (idValue, field, value) => setLevels(normalizeLevels(currentLevels.map((x) => x.id === idValue ? { ...x, [field]: value } : x), floor, ceiling));
  const reorderLevel = (from, to) => setLevels(normalizeLevels(moveLevel(currentLevels, from, to, floor), floor, ceiling));
  const totalPoints = ceiling - floor + 1;
  const canAddLevel = currentLevels.length < totalPoints;
  const canRemoveLevel = currentLevels.length > 1;
  const addLevel = () => setLevels(addLevelRow(currentLevels, `new-level-${Date.now()}`, floor, ceiling));
  const removeLevel = (idValue) => setLevels(removeLevelRow(currentLevels, idValue, floor, ceiling));
  const askRemoveLevel = (idValue) => {
    const level = currentLevels.find((x) => x.id === idValue);
    if (!level) return;
    if (level.isNew) { removeLevel(idValue); return; }
    setPendingRemoval({ kind: "level", id: idValue });
  };
  const setRule = (rowKey, patch) => setRules(currentRules.map((x) => x.rowKey === rowKey ? { ...x, ...patch } : x));
  const chooseExercise = (rowKey, code) => {
    const option = exerciseOptions.find((x) => x.code === code);
    setRule(rowKey, { code, name: option?.name, category: option?.category });
  };
  const changeRules = (next) => {
    setRules(next);
    setLevels(refitLevels(currentLevels, scoreFloor(next.length), scoreCeiling(next.length)));
  };
  const addRule = () => changeRules([...currentRules, { rowKey: `new-${Date.now()}`, code: "", name: "", category: "", beginnerMax: "", intermediateMax: "" }]);
  const removeRule = (rowKey) => changeRules(currentRules.filter((x) => x.rowKey !== rowKey));
  const askRemoveRule = (rowKey) => {
    if (!data.exercises.some((x) => x.code === rowKey)) { removeRule(rowKey); return; }
    setPendingRemoval({ kind: "exercise", id: rowKey });
  };
  const confirmRemoval = () => {
    if (pendingRemoval?.kind === "level") removeLevel(pendingRemoval.id);
    if (pendingRemoval?.kind === "exercise") removeRule(pendingRemoval.id);
    setPendingRemoval(null);
  };
  const removalDialog = (() => {
    if (!pendingRemoval) return { title: "", body: null };
    if (pendingRemoval.kind === "level") {
      const index = currentLevels.findIndex((x) => x.id === pendingRemoval.id);
      const level = currentLevels[index];
      const heir = currentLevels[index > 0 ? index - 1 : 1];
      return {
        title: t("contentManager.levelBenchmark.removeLevelDialogTitle"),
        body: <>
          <DialogContentText>{t("contentManager.levelBenchmark.removeLevelDialogBody", { name: level?.name || t("contentManager.levelBenchmark.thisLevel"), min: level?.scoreMin, max: level?.scoreMax })}</DialogContentText>
          {heir && <DialogContentText sx={{ mt: 1 }}>{t("contentManager.levelBenchmark.removeLevelDialogHeir", { name: heir.name || t("contentManager.levelBenchmark.neighbouringLevel") })}</DialogContentText>}
          <DialogContentText sx={{ mt: 1 }}>{t("contentManager.levelBenchmark.removeLevelDialogWarning")}</DialogContentText>
        </>,
      };
    }
    const rule = currentRules.find((x) => x.rowKey === pendingRemoval.id);
    const nextCount = currentRules.length - 1;
    return {
      title: t("contentManager.levelBenchmark.removeExerciseDialogTitle"),
      body: <>
        <DialogContentText>{t("contentManager.levelBenchmark.removeExerciseDialogBody", { name: rule?.name || t("contentManager.levelBenchmark.thisExercise") })}</DialogContentText>
        <DialogContentText sx={{ mt: 1 }}>{t("contentManager.levelBenchmark.removeExerciseDialogRange", { min: floor, max: ceiling, nextMin: scoreFloor(nextCount), nextMax: scoreCeiling(nextCount) })}</DialogContentText>
        <DialogContentText sx={{ mt: 1 }}>{t("contentManager.levelBenchmark.removeExerciseDialogSurvey")}</DialogContentText>
      </>,
    };
  })();
  const minExercises = Math.max(1, Math.ceil((currentLevels.length - 1) / 2));
  const canRemove = currentRules.length > minExercises;
  const canAdd = currentRules.length < MAX_EXERCISES;
  const scoreErrors = [...validateLevelNames(currentLevels, t), ...validateScoreRanges(currentLevels, ceiling, t)];
  const thresholdErrors = validateThresholds(currentRules, t);
  const validationErrors = [...scoreErrors, ...thresholdErrors];
  const submit = (event) => {
    event.preventDefault();
    if (validationErrors.length) return;
    save.mutate({
      exercises: currentRules.map((x) => ({ code: x.code, category: x.category, beginnerMax: Number(x.beginnerMax), intermediateMax: Number(x.intermediateMax) })),
      levels: currentLevels.map((x) => ({ id: x.isNew ? null : x.id, name: x.name, scoreMin: Number(x.scoreMin), scoreMax: Number(x.scoreMax), status: x.status })),
    });
  };
  return <Box sx={{ maxWidth: 1120, mx: "auto", px: 3, py: 2.5 }}>
    <Heading breadcrumb={[...BREADCRUMB.slice(0, -1), { labelKey: "nav.levelBenchmarkCriteria", to: CONTENT_PATHS.levelCriteria }, { labelKey: "nav.update" }]} title={t("contentManager.levelBenchmark.formTitle")} description={t("contentManager.levelBenchmark.formDescription")} />
    <Card component="form" onSubmit={submit} sx={{ mt: 2.5, overflow: "hidden" }}>
      <Box sx={{ p: 2.5 }}>
        {save.error && <Alert severity="error" sx={{ mb: 2 }}>{save.error.message}</Alert>}
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={1}>
          <Box>
            <Typography sx={{ color: "#fff", fontWeight: 700 }}>{t("contentManager.levelBenchmark.levelsTitle")}</Typography>
            <Typography variant="caption" sx={{ color: CM.textMuted }}>{t("contentManager.levelBenchmark.levelsSubtitle", { count: currentLevels.length, min: floor, max: ceiling })}</Typography>
          </Box>
          <Tooltip title={canAddLevel ? "" : t("contentManager.levelBenchmark.noScorePointsLeft", { max: totalPoints, min: floor, ceiling })}><Box component="span" sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", sm: "center" } }}><Button variant="outlined" size="small" startIcon={<AddRoundedIcon fontSize="small" />} disabled={!canAddLevel} onClick={addLevel} sx={{ whiteSpace: "nowrap", py: 0.25, px: 1.25, minWidth: 0, fontSize: 13 }}>{t("contentManager.levelBenchmark.addLevel")}</Button></Box></Tooltip>
        </Stack>
        {scoreErrors.map((error) => <Alert key={error} severity="error" sx={{ mt: 1.5 }}>{error}</Alert>)}
        <LevelEditor levels={currentLevels} floor={floor} ceiling={ceiling} canRemove={canRemoveLevel} removeHint={t("contentManager.levelBenchmark.removeLevelHint")} onChange={setLevel} onMove={reorderLevel} onRemove={askRemoveLevel} />
        <ExerciseEditor rules={currentRules} exerciseOptions={exerciseOptions} canAdd={canAdd} canRemove={canRemove} minExercises={minExercises} floor={floor} ceiling={ceiling} errors={thresholdErrors} onAdd={addRule} onRemove={askRemoveRule} onChooseExercise={chooseExercise} onChange={setRule} />
        <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 3 }}>
          <Button component={RouterLink} to={CONTENT_PATHS.levelCriteria} variant="outlined">{t("contentManager.levelBenchmark.cancelAction")}</Button>
          <Button type="submit" variant="contained" disabled={save.isPending || validationErrors.length > 0}>{save.isPending ? t("contentManager.levelBenchmark.saving") : t("contentManager.levelBenchmark.saveAll")}</Button>
        </Stack>
      </Box>
    </Card>
    <Dialog open={Boolean(pendingRemoval)} onClose={() => setPendingRemoval(null)}>
      <DialogTitle>{removalDialog.title}</DialogTitle>
      <DialogContent>{removalDialog.body}</DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={() => setPendingRemoval(null)}>{t("contentManager.levelBenchmark.keep")}</Button>
        <Button color="error" variant="contained" onClick={confirmRemoval}>{t("contentManager.levelBenchmark.remove")}</Button>
      </DialogActions>
    </Dialog>
  </Box>;
}
