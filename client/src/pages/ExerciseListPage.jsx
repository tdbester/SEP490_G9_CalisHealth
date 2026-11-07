import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { keyframes } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import FitnessCenterRoundedIcon from "@mui/icons-material/FitnessCenterRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { contentManagerApi } from "../api/contentManager";
import { useApiMutation, useApiQuery } from "../hooks";
import { useLevelNames } from "../useLevelNames";
import ContentListToolbar from "../components/ContentListToolbar";
import {
  CONTENT_PATHS,
  ContentPageHeader,
  DarkPill,
  SummaryCard,
  formatDate,
} from "../components/ContentShared";
import { CM } from "../theme-content";

const rise = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;
const enter = (delay = 0) => ({
  animation: `${rise} .45s ease-out ${delay}ms both`,
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
});

const BREADCRUMB = [
  { labelKey: "nav.contentManagerRole", to: CONTENT_PATHS.dashboard },
  { labelKey: "nav.exerciseAndWorkout", to: CONTENT_PATHS.exercises },
  { labelKey: "nav.exerciseList" },
];

function TypeChip({ type }) {
  const { t } = useTranslation();
  const normalized = String(type || "").trim().toLowerCase();
  const isSkill = normalized === "skill";
  const label = isSkill
    ? t("contentManager.exercises.typeSkill")
    : normalized === "health"
      ? t("contentManager.exercises.typeHealth")
      : "—";
  return (
    <DarkPill
      tone={isSkill ? "primary" : "neutral"}
      icon={isSkill ? <StarRoundedIcon /> : undefined}
      sx={{ width: 76, justifyContent: "center" }}
    >
      {label}
    </DarkPill>
  );
}

function SourceChip({ source }) {
  const { t } = useTranslation();
  const isCustom = String(source || "").toLowerCase() === "custom";
  return (
    <DarkPill tone={isCustom ? "warning" : "neutral"}>
      {isCustom ? t("contentManager.exercises.typeCustom") : t("contentManager.exercises.typeSystem")}
    </DarkPill>
  );
}

function LevelChip({ level, toneOf }) {
  return <DarkPill tone={toneOf(level)}>{level || "—"}</DarkPill>;
}

function StatusDot({ active }) {
  const { t } = useTranslation();
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Box
        sx={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          bgcolor: active ? CM.green : CM.pink,
        }}
      />
      <Typography variant="caption" sx={{ color: active ? CM.green : CM.pink, fontWeight: 600 }}>
        {active
          ? t("contentManager.exercises.active")
          : t("contentManager.exercises.inactive")}
      </Typography>
    </Stack>
  );
}

export default function ExerciseListPage() {
  const { t } = useTranslation();
  const { data, isLoading, error, isFetching, refetch, setData } = useApiQuery(() =>
    contentManagerApi.exercises(),
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [level, setLevel] = useState("all");
  const { levels: levelNames, levelTone } = useLevelNames();
  const [page, setPage] = useState(0);
  const rowsPerPage = 5;
  const [menu, setMenu] = useState({ anchor: null, entry: null });

  const statusMutation = useApiMutation(
    ({ code, active }) => contentManagerApi.updateExerciseStatus(code, active),
    {
      onSuccess: (updated) => {
        setData((current) => Array.isArray(current)
          ? current.map((entry) => entry.code === updated.code ? updated : entry)
          : current);
        refetch();
      },
    },
  );
  const deleteMutation = useApiMutation(
    (code) => contentManagerApi.deleteExercise(code),
    { onSuccess: () => refetch() },
  );

  const entries = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.filter(
      (entry) =>
        String(entry.source || "").toUpperCase() !== "CUSTOM" || entry.active,
    );
  }, [data]);
  const activeCount = entries.filter((entry) => entry.active).length;
  const inactiveCount = entries.length - activeCount;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((entry) => {
      const matchesSearch =
        !term ||
        entry.name?.toLowerCase().includes(term) ||
        entry.code?.toLowerCase().includes(term);
      const matchesStatus =
        status === "all" || (status === "active" ? entry.active : !entry.active);
      const isCustom =
        String(entry.source || "").toLowerCase() === "custom" ||
        String(entry.type || "").toLowerCase() === "custom";
      const matchesType =
        type === "all" ||
        (type === "custom" ? isCustom : String(entry.type).toLowerCase() === type);
      const matchesLevel =
        level === "all" || String(entry.level || "").toLowerCase() === level;
      return matchesSearch && matchesStatus && matchesType && matchesLevel;
    });
  }, [entries, search, status, type, level]);

  const pageEntries = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const resetPage = (setter) => (event) => {
    setter(event.target.value);
    setPage(0);
  };

  const closeMenu = () => setMenu({ anchor: null, entry: null });

  return (
    <Box
      sx={{
        maxWidth: 1280,
        mx: "auto",
        px: { xs: 2, sm: 3 },
        py: { xs: 2.5, sm: 3 },
        "&, & *": { fontFamily: "Arial, sans-serif !important" },
      }}
    >
      <ContentPageHeader
        breadcrumb={BREADCRUMB}
        title={t("contentManager.exercises.listTitle")}
        description={t("contentManager.exercises.listDescription")}
        action={
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              component={RouterLink}
              to={CONTENT_PATHS.pendingExerciseModeration}
              variant="outlined"
              size="medium"
              sx={{ minHeight: 40, whiteSpace: "nowrap" }}
            >
              {t("contentManager.exercises.pendingModeration")}
            </Button>
            <Button
              component={RouterLink}
              to={`${CONTENT_PATHS.create}?type=exercise`}
              variant="contained"
              size="medium"
              startIcon={<AddRoundedIcon />}
              sx={{ minHeight: 40, whiteSpace: "nowrap" }}
            >
              {t("contentManager.exercises.createContent")}
            </Button>
          </Stack>
        }
      />

      <Box
        component="section"
        aria-label={t("contentManager.exercises.summary")}
        sx={{
          mt: 2.5,
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
        }}
      >
        <Box sx={enter(0)}><SummaryCard label={t("contentManager.exercises.allExercises")} count={entries.length} detail={t("contentManager.exercises.exercisesUnit")} /></Box>
        <Box sx={enter(80)}><SummaryCard
          label={t("contentManager.exercises.active")}
          tone="success"
          count={activeCount}
          detail={t("contentManager.exercises.exercisesUnit")}
        /></Box>
        <Box sx={enter(160)}><SummaryCard
          label={t("contentManager.exercises.inactive")}
          tone="error"
          count={inactiveCount}
          detail={t("contentManager.exercises.exercisesUnit")}
        /></Box>
      </Box>

      <Card sx={{ mt: 2.5, overflow: "hidden", ...enter(220) }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", md: "center" }}
          sx={{ p: 1.5, borderBottom: `1px solid ${CM.border}` }}
        >
          <ContentListToolbar active="exercises" />
          <TextField
            size="small"
            fullWidth
            value={search}
            onChange={resetPage(setSearch)}
            placeholder={t("contentManager.exercises.searchPlaceholder")}
            inputProps={{ "aria-label": t("contentManager.exercises.searchAria") }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" color="disabled" />
                </InputAdornment>
              ),
            }}
            sx={{ flex: 1, minWidth: 200 }}
          />
          <TextField
            select
            size="small"
            value={status}
            onChange={resetPage(setStatus)}
            SelectProps={{ SelectDisplayProps: { "aria-label": t("contentManager.exercises.filterByStatus") } }}
            sx={{ minWidth: 130 }}
          >
            <MenuItem value="all">{t("contentManager.exercises.allStatus")}</MenuItem>
            <MenuItem value="active">{t("contentManager.exercises.active")}</MenuItem>
            <MenuItem value="inactive">{t("contentManager.exercises.inactive")}</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            value={level}
            onChange={resetPage(setLevel)}
            SelectProps={{ SelectDisplayProps: { "aria-label": t("contentManager.exercises.filterByLevel") } }}
            sx={{ minWidth: 130 }}
          >
            <MenuItem value="all">{t("contentManager.exercises.allLevels")}</MenuItem>
            {levelNames.map((name) => (
              <MenuItem key={name} value={name.toLowerCase()}>{name}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            value={type}
            onChange={resetPage(setType)}
            SelectProps={{ SelectDisplayProps: { "aria-label": t("contentManager.exercises.filterByType") } }}
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="all">{t("contentManager.exercises.allTypes")}</MenuItem>
            <MenuItem value="health">{t("contentManager.exercises.typeHealth")}</MenuItem>
            <MenuItem value="skill">{t("contentManager.exercises.typeSkill")}</MenuItem>
            <MenuItem value="custom">{t("contentManager.exercises.typeCustom")}</MenuItem>
          </TextField>
          <Tooltip title={t("contentManager.exercises.refresh")}>
            <span>
              <IconButton
                onClick={() => refetch()}
                disabled={isFetching}
                aria-label={t("contentManager.exercises.refreshAria")}
                sx={{ border: 1, borderColor: "divider", borderRadius: 2, transition: "all .2s ease", "&:hover": { borderColor: CM.violetBright, bgcolor: "rgba(139,92,246,0.1)" } }}
              >
                {isFetching ? <CircularProgress size={18} /> : <RefreshRoundedIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
        {(statusMutation.error || deleteMutation.error) && (
          <Alert severity="error" sx={{ m: 2 }} onClose={() => { statusMutation.reset(); deleteMutation.reset(); }}>
            {deleteMutation.error
              ? t("contentManager.exercises.deleteFailed", { message: deleteMutation.error.message })
              : t("contentManager.exercises.statusUpdateFailed", { message: statusMutation.error.message })}
          </Alert>
        )}

        {isLoading ? (
          <Box sx={{ py: 8, display: "grid", placeItems: "center" }}>
            <Stack spacing={1.5} alignItems="center">
              <CircularProgress size={24} />
              <Typography variant="body2" color="text.secondary">
                {t("contentManager.exercises.loading")}
              </Typography>
            </Stack>
          </Box>
        ) : error ? (
          <Box sx={{ py: 6, textAlign: "center", px: 2 }}>
            <Alert
              severity="error"
              sx={{ mb: 2, textAlign: "left" }}
              action={
                <Button color="inherit" size="small" onClick={() => refetch()}>
                  {t("contentManager.exercises.tryAgain")}
                </Button>
              }
            >
              {t("contentManager.exercises.loadFailed", { message: error.message })}
            </Alert>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small" sx={{ minWidth: 940, "& th, & td": { textAlign: "center" } }}>
                <TableHead>
                  <TableRow sx={{ "& th": { bgcolor: "rgba(19,10,39,0.85)", color: CM.textMuted, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap" } }}>
                    <TableCell sx={{ textAlign: "left !important", pl: 3 }}>{t("contentManager.exercises.colExercise")}</TableCell>
                    <TableCell>{t("contentManager.exercises.colType")}</TableCell>
                    <TableCell>{t("contentManager.exercises.colSource")}</TableCell>
                    <TableCell>{t("contentManager.exercises.colMuscleGroup")}</TableCell>
                    <TableCell>{t("contentManager.exercises.colLevel")}</TableCell>
                    <TableCell>{t("contentManager.exercises.colStatus")}</TableCell>
                    <TableCell>{t("contentManager.exercises.colUpdated")}</TableCell>
                    <TableCell align="center">{t("contentManager.exercises.colAction")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pageEntries.map((entry, idx) => {
                    const isUpdating =
                      statusMutation.isPending && menu.entry?.code === entry.code;
                    return (
                      <TableRow key={entry.code} hover sx={{
                        transition: "all .2s ease",
                        "&:hover": { bgcolor: "rgba(139,92,246,0.06)" },
                        ...enter(240 + idx * 25),
                      }}>
                        <TableCell sx={{ width: 300, textAlign: "left !important", pl: 3, "& > .MuiStack-root": { justifyContent: "flex-start" } }}>
                          <Stack direction="row" spacing={1.25} alignItems="center" justifyContent="flex-start" sx={{ width: "100%" }}>
                            <Box
                              sx={{
                                width: 34,
                                height: 34,
                                borderRadius: "10px",
                                display: "grid",
                                placeItems: "center",
                                flexShrink: 0,
                                bgcolor:
                                  String(entry.type).toLowerCase() === "skill"
                                    ? "rgba(139,92,246,0.22)"
                                    : "rgba(168,155,208,0.14)",
                                color:
                                  String(entry.type).toLowerCase() === "skill" ? CM.violetBright : CM.textMuted,
                                border: `1px solid ${String(entry.type).toLowerCase() === "skill" ? "rgba(167,139,250,0.3)" : CM.border}`,
                              }}
                            >
                              {String(entry.type).toLowerCase() === "skill" ? (
                                <StarRoundedIcon sx={{ fontSize: 16 }} />
                              ) : (
                                <FitnessIconSmall />
                              )}
                            </Box>
                            <Box sx={{ minWidth: 0, textAlign: "left" }}>
                              <Typography variant="body2" fontWeight={600} noWrap sx={{ color: "#fff" }}>
                                {entry.name}
                              </Typography>
                              <Typography variant="caption" sx={{ color: CM.textDim }}>
                                {entry.code}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <TypeChip type={entry.type} />
                        </TableCell>
                        <TableCell>
                          <SourceChip source={entry.source} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ color: CM.textMuted }}>
                            {entry.muscleGroup || "—"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <LevelChip level={entry.level} toneOf={levelTone} />
                        </TableCell>
                        <TableCell>
                          <StatusDot active={entry.active} />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          <Typography variant="caption" sx={{ color: CM.textDim }}>
                            {formatDate(entry.updatedAt)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center">
                            <Button
                              component={RouterLink}
                              to={`${CONTENT_PATHS.exercises}/${encodeURIComponent(entry.code)}`}
                              size="small"
                              variant="outlined"
                              sx={{ py: 0.25, px: 1.25, fontSize: 11.5, minWidth: 0, borderRadius: "8px" }}
                            >
                              {t("contentManager.exercises.view")}
                            </Button>
                            <IconButton
                              size="small"
                              aria-label={t("contentManager.exercises.moreActions", { name: entry.name })}
                              aria-expanded={Boolean(menu.anchor) && menu.entry?.code === entry.code}
                              onClick={(event) => setMenu({ anchor: event.currentTarget, entry })}
                            >
                              <MoreVertRoundedIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {pageEntries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} sx={{ py: 6, textAlign: "center" }}>
                        <Stack alignItems="center" spacing={1}>
                          <FitnessCenterRoundedIcon sx={{ fontSize: 44, color: CM.textDim, opacity: 0.4 }} />
                          <Typography variant="body2" color="text.secondary">
                            {entries.length
                              ? t("contentManager.exercises.noMatch")
                              : t("contentManager.exercises.empty")}
                          </Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={filtered.length}
              page={Math.min(page, Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1))}
              onPageChange={(_, nextPage) => setPage(nextPage)}
              rowsPerPage={rowsPerPage}
              rowsPerPageOptions={[]}
              labelDisplayedRows={({ from, to, count }) => t("contentManager.exercises.showingRows", { from, to, count })}
            />
          </>
        )}
      </Card>

      <Menu anchorEl={menu.anchor} open={Boolean(menu.anchor)} onClose={closeMenu}>
        <MenuItem
          component={RouterLink}
          to={menu.entry ? `${CONTENT_PATHS.exercises}/${encodeURIComponent(menu.entry.code)}` : "#"}
          onClick={closeMenu}
        >
          {t("contentManager.exercises.viewDetails")}
        </MenuItem>
        <MenuItem
          disabled={statusMutation.isPending}
          onClick={() => {
            const entry = menu.entry;
            closeMenu();
            if (entry) statusMutation.mutate({ code: entry.code, active: !entry.active });
          }}
        >
          {menu.entry?.active
            ? t("contentManager.exercises.setInactive")
            : t("contentManager.exercises.setActive")}
        </MenuItem>
        <MenuItem
          disabled={deleteMutation.isPending}
          sx={{ color: "error.main" }}
          onClick={() => {
            const entry = menu.entry;
            closeMenu();
            if (entry && window.confirm(t("contentManager.exercises.deleteConfirm", { name: entry.name }))) {
              deleteMutation.mutate(entry.code);
            }
          }}
        >
          <DeleteOutlineRoundedIcon fontSize="small" sx={{ mr: 1 }} />
          {t("contentManager.exercises.delete")}
        </MenuItem>
      </Menu>
    </Box>
  );
}

function FitnessIconSmall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M3 9v6m3-9v12m12-12v12m3-9v6M6 12h12" />
    </svg>
  );
}
