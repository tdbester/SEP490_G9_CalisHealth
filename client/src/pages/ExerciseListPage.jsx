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
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { contentManagerApi } from "../api/contentManager";
import { useApiMutation, useApiQuery } from "../hooks";
import ContentListToolbar from "../components/ContentListToolbar";
import {
  CONTENT_PATHS,
  ContentPageHeader,
  DarkPill,
  SummaryCard,
  formatDate,
} from "../components/ContentShared";
import { CM } from "../theme-content";

const BREADCRUMB = [
  { label: "Content manager", to: CONTENT_PATHS.dashboard },
  { label: "Exercise & Workout Management", to: CONTENT_PATHS.exercises },
  { label: "Exercise list" },
];

function TypeChip({ type }) {
  const normalized = String(type || "").trim().toLowerCase();
  const isSkill = normalized === "skill";
  const label = isSkill ? "Skill" : normalized === "health" ? "Health" : "—";
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
  const isCustom = String(source || "").toLowerCase() === "custom";
  return (
    <DarkPill tone={isCustom ? "warning" : "neutral"}>
      {isCustom ? "Custom" : "System"}
    </DarkPill>
  );
}

function LevelChip({ level }) {
  const normalized = String(level).toLowerCase();
  const tone = normalized === "beginner" ? "success" : normalized === "advanced" ? "danger" : "warning";
  return <DarkPill tone={tone}>{level}</DarkPill>;
}

function StatusDot({ active }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Box
        sx={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          bgcolor: active ? CM.green : CM.pink,
          boxShadow: `0 0 9px ${active ? CM.green : CM.pink}`,
        }}
      />
      <Typography variant="caption" sx={{ color: active ? CM.green : CM.pink, fontWeight: 600 }}>
        {active ? "Active" : "Inactive"}
      </Typography>
    </Stack>
  );
}

export default function ExerciseListPage() {
  const { data, isLoading, error, isFetching, refetch, setData } = useApiQuery(() =>
    contentManagerApi.exercises(),
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
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
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [entries, search, status, type]);

  const pageEntries = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const resetPage = (setter) => (event) => {
    setter(event.target.value);
    setPage(0);
  };

  const closeMenu = () => setMenu({ anchor: null, entry: null });

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2.5, sm: 3 } }}>
      <ContentPageHeader
        breadcrumb={BREADCRUMB}
        title="Exercise & workout management"
        description="Manage system exercises and skills, and moderate exercises submitted by users."
        action={
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              component={RouterLink}
              to={CONTENT_PATHS.pendingExerciseModeration}
              variant="outlined"
              size="medium"
              sx={{ minHeight: 40, whiteSpace: "nowrap" }}
            >
              Pending exercise moderation
            </Button>
            <Button
              component={RouterLink}
              to={`${CONTENT_PATHS.create}?type=exercise`}
              variant="contained"
              size="medium"
              startIcon={<AddRoundedIcon />}
              sx={{ minHeight: 40, whiteSpace: "nowrap" }}
            >
              Create content
            </Button>
          </Stack>
        }
      />

      <Box
        component="section"
        aria-label="Exercise summary"
        sx={{
          mt: 2.5,
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
        }}
      >
        <SummaryCard label="All exercises" count={entries.length} detail="exercises" />
        <SummaryCard
          label="Active"
          tone="success"
          count={activeCount}
          detail="exercises"
        />
        <SummaryCard
          label="Inactive"
          tone="error"
          count={inactiveCount}
          detail="exercises"
        />
      </Box>

      <Card sx={{ mt: 2 }}>
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
            placeholder="Search exercise or skill"
            inputProps={{ "aria-label": "Search exercise or skill" }}
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
            SelectProps={{ SelectDisplayProps: { "aria-label": "Filter by status" } }}
            sx={{ minWidth: 130 }}
          >
            <MenuItem value="all">All status</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            value={type}
            onChange={resetPage(setType)}
            SelectProps={{ SelectDisplayProps: { "aria-label": "Filter by type" } }}
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="all">All types</MenuItem>
            <MenuItem value="health">Health</MenuItem>
            <MenuItem value="skill">Skill</MenuItem>
            <MenuItem value="custom">Custom</MenuItem>
          </TextField>
          <Tooltip title="Refresh">
            <span>
              <IconButton
                onClick={() => refetch()}
                disabled={isFetching}
                aria-label="Refresh exercise list"
                sx={{ border: 1, borderColor: "divider", borderRadius: 2 }}
              >
                {isFetching ? <CircularProgress size={18} /> : <RefreshRoundedIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
        {(statusMutation.error || deleteMutation.error) && (
          <Alert severity="error" sx={{ m: 2 }} onClose={() => { statusMutation.reset(); deleteMutation.reset(); }}>
            {deleteMutation.error
              ? `Could not delete the exercise. ${deleteMutation.error.message}`
              : `Could not update the status. ${statusMutation.error.message}`}
          </Alert>
        )}

        {isLoading ? (
          <Box sx={{ py: 8, display: "grid", placeItems: "center" }}>
            <Stack spacing={1.5} alignItems="center">
              <CircularProgress size={24} />
              <Typography variant="body2" color="text.secondary">
                Loading exercises…
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
                  Try again
                </Button>
              }
            >
              Could not load the exercise list. {error.message}
            </Alert>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small" sx={{ minWidth: 940, "& th, & td": { textAlign: "center" } }}>
                <TableHead>
                  <TableRow sx={{ "& th": { bgcolor: "rgba(19,10,39,0.85)", color: CM.textMuted, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap" } }}>
                    <TableCell align="center">Exercise / Skill</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Muscle group</TableCell>
                    <TableCell>Level</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Updated</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pageEntries.map((entry) => {
                    const isUpdating =
                      statusMutation.isPending && menu.entry?.code === entry.code;
                    return (
                      <TableRow key={entry.code} hover>
                        <TableCell align="center" sx={{ width: 280 }}>
                          <Stack direction="row" spacing={1.25} alignItems="center" justifyContent="flex-start" sx={{ width: "100%", textAlign: "left" }}>
                            <Box
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: 1.5,
                                display: "grid",
                                placeItems: "center",
                                flexShrink: 0,
                                bgcolor:
                                  String(entry.type).toLowerCase() === "skill"
                                    ? "rgba(139,92,246,0.22)"
                                    : "rgba(168,155,208,0.14)",
                                color:
                                  String(entry.type).toLowerCase() === "skill" ? CM.violetBright : CM.textMuted,
                              }}
                            >
                              {String(entry.type).toLowerCase() === "skill" ? (
                                <StarRoundedIcon sx={{ fontSize: 16 }} />
                              ) : (
                                <FitnessIconSmall />
                              )}
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
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
                          <LevelChip level={entry.level} />
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
                              View
                            </Button>
                            <IconButton
                              size="small"
                              aria-label={`More actions for ${entry.name}`}
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
                        <Typography variant="body2" color="text.secondary">
                          {entries.length
                            ? "No exercises match these filters."
                            : "No exercises or skills yet. Create your first entry to get started."}
                        </Typography>
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
              onRowsPerPageChange={(event) => {
                setRowsPerPage(parseInt(event.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 20, 50]}
              labelDisplayedRows={({ from, to, count }) => `Showing ${from}-${to} of ${count}`}
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
          View details
        </MenuItem>
        <MenuItem
          disabled={statusMutation.isPending}
          onClick={() => {
            const entry = menu.entry;
            closeMenu();
            if (entry) statusMutation.mutate({ code: entry.code, active: !entry.active });
          }}
        >
          {menu.entry?.active ? "Set inactive" : "Set active"}
        </MenuItem>
        <MenuItem
          disabled={deleteMutation.isPending}
          sx={{ color: "error.main" }}
          onClick={() => {
            const entry = menu.entry;
            closeMenu();
            if (entry && window.confirm(`Delete "${entry.name}"? This cannot be undone.`)) {
              deleteMutation.mutate(entry.code);
            }
          }}
        >
          <DeleteOutlineRoundedIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
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
