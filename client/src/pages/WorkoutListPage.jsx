import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
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
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import FitnessCenterRoundedIcon from "@mui/icons-material/FitnessCenterRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
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
import { getLevelBadgeStyle } from "../utils/levelBadge";
import "./WorkoutListPage.css";

const rise = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;
const enter = (delay = 0) => ({
  animation: `${rise} .45s ease-out ${delay}ms both`,
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
});

const BREADCRUMB = [
  { label: "Content manager", to: CONTENT_PATHS.dashboard },
  { label: "Exercise & Workout Management", to: CONTENT_PATHS.exercises },
  { label: "Workout list" },
];

function LevelChip({ level, toneOf }) {
  const displayLevel = level || "Intermediate";
  const isStandardLevel = ["BEGINNER", "INTERMEDIATE", "ADVANCED"]
    .includes(String(displayLevel).trim().toUpperCase());
  if (!isStandardLevel) {
    return <DarkPill tone={toneOf(level)}>{level || "—"}</DarkPill>;
  }
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${getLevelBadgeStyle(displayLevel)}`}>
      {displayLevel}
    </span>
  );
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
        }}
      />
      <Typography variant="caption" sx={{ color: active ? CM.green : CM.pink, fontWeight: 600 }}>
        {active ? "Active" : "Inactive"}
      </Typography>
    </Stack>
  );
}

export default function WorkoutListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const routedSuccess = location.state?.successMessage;
  const [successMessage, setSuccessMessage] = useState(routedSuccess || null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [level, setLevel] = useState("all");
  const { levels: levelNames, levelTone } = useLevelNames();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [menu, setMenu] = useState({ anchor: null, workout: null });

  const { data, isLoading, error, isFetching, refetch, setData } = useApiQuery(() =>
    contentManagerApi.workouts(),
  );
  const statusMutation = useApiMutation(
    ({ code, active }) => contentManagerApi.updateWorkoutStatus(code, active),
    {
      onSuccess: (updated) => {
        setData((current) => Array.isArray(current)
          ? current.map((workout) => workout.code === updated.code ? updated : workout)
          : current);
        refetch();
      },
    },
  );
  const deleteMutation = useApiMutation(
    (code) => contentManagerApi.deleteWorkout(code),
    {
      onSuccess: (_, code) => {
        setData((current) => Array.isArray(current)
          ? current.filter((workout) => workout.code !== code)
          : current);
        refetch();
      },
    },
  );

  useEffect(() => {
    if (!routedSuccess) return;
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [routedSuccess, navigate, location.pathname, location.search]);

  const workouts = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const activeCount = workouts.filter((workout) => workout.active).length;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return workouts.filter((workout) => {
      const matchesSearch =
        !term ||
        workout.name?.toLowerCase().includes(term) ||
        workout.code?.toLowerCase().includes(term);
      const matchesStatus =
        status === "all" || (status === "active" ? workout.active : !workout.active);
      const workoutSource = String(workout.source || "").toLowerCase();
      const matchesSource =
        source === "all" || workoutSource === source;
      const matchesLevel =
        level === "all" || String(workout.level || "").toLowerCase() === level;
      return matchesSearch && matchesStatus && matchesSource && matchesLevel;
    });
  }, [workouts, search, status, source, level]);

  const rows = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const closeMenu = () => setMenu({ anchor: null, workout: null });

  return (
    <Box className="workout-list-page" sx={{ maxWidth: 1280, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2.5, sm: 3 } }}>
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      <ContentPageHeader
        breadcrumb={BREADCRUMB}
        title="Exercise & workout management"
        description="Manage workouts members can follow and complete."
        action={
          <Button
            component={RouterLink}
            to={`${CONTENT_PATHS.create}?type=workout`}
            variant="contained"
            startIcon={<AddRoundedIcon />}
          >
            Create content
          </Button>
        }
      />

      <Box
        component="section"
        aria-label="Workout summary"
        sx={{
          mt: 2.5,
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
        }}
      >
        <Box sx={enter(0)}><SummaryCard label="All workouts" count={workouts.length} detail="workouts" /></Box>
        <Box sx={enter(80)}><SummaryCard
          label="Active"
          tone="success"
          count={activeCount}
          detail="workouts"
        /></Box>
        <Box sx={enter(160)}><SummaryCard
          label="Inactive"
          tone="error"
          count={workouts.length - activeCount}
          detail="workouts"
        /></Box>
      </Box>

      <Card className="workout-list-table-card" sx={{ mt: 2.5, overflow: "hidden", ...enter(220) }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", md: "center" }}
          sx={{ p: 1.5, borderBottom: `1px solid ${CM.border}` }}
        >
          <ContentListToolbar active="workouts" />
          <TextField
            size="small"
            fullWidth
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder="Search workout"
            inputProps={{ "aria-label": "Search workout" }}
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
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(0);
            }}
            SelectProps={{ SelectDisplayProps: { "aria-label": "Filter by status" } }}
            sx={{ minWidth: 125 }}
          >
            <MenuItem value="all">All status</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            value={level}
            onChange={(event) => {
              setLevel(event.target.value);
              setPage(0);
            }}
            SelectProps={{ SelectDisplayProps: { "aria-label": "Filter by level" } }}
            sx={{ minWidth: 125 }}
          >
            <MenuItem value="all">All levels</MenuItem>
            {levelNames.map((name) => (
              <MenuItem key={name} value={name.toLowerCase()}>{name}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            value={source}
            onChange={(event) => {
              setSource(event.target.value);
              setPage(0);
            }}
            SelectProps={{ SelectDisplayProps: { "aria-label": "Filter by type" } }}
            sx={{ minWidth: 125 }}
          >
            <MenuItem value="all">All types</MenuItem>
            <MenuItem value="system">System</MenuItem>
            <MenuItem value="custom">Custom</MenuItem>
          </TextField>
          <Tooltip title="Refresh">
            <span>
              <IconButton
                onClick={() => refetch()}
                disabled={isFetching}
                aria-label="Refresh workout list"
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
              ? `Could not delete the workout. ${deleteMutation.error.message}`
              : `Could not update the status. ${statusMutation.error.message}`}
          </Alert>
        )}

        {isLoading ? (
          <Box sx={{ py: 8, display: "grid", placeItems: "center" }}>
            <Stack spacing={1.5} alignItems="center">
              <CircularProgress size={24} />
              <Typography variant="body2" color="text.secondary">
                Loading workouts…
              </Typography>
            </Stack>
          </Box>
        ) : error ? (
          <Box sx={{ py: 6, px: 2 }}>
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={() => refetch()}>
                  Try again
                </Button>
              }
            >
              Could not load the workout list. {error.message}
            </Alert>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small" sx={{ minWidth: { xs: 760, md: 900 }, "& th, & td": { textAlign: "center" } }}>
                <TableHead>
                  <TableRow sx={{ "& th": { bgcolor: "rgba(19,10,39,0.85)", color: CM.textMuted, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap", py: 1.5 } }}>
                    <TableCell sx={{ textAlign: "left !important", pl: 3 }}>Workout</TableCell>
                    <TableCell align="center">Source</TableCell>
                    <TableCell align="center">Level</TableCell>
                    <TableCell align="center">Exercises</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">Updated</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((workout, idx) => (
                    <TableRow key={workout.code} hover sx={{
                      "& td": { borderColor: CM.border, py: 1.5 },
                      transition: "all .2s ease",
                      "&:hover": { bgcolor: "rgba(139,92,246,0.06)" },
                      ...enter(240 + idx * 25),
                    }}>
                      <TableCell sx={{ width: 300, textAlign: "left !important", pl: 3, "& > .MuiStack-root": { justifyContent: "flex-start" } }}>
                        <Stack direction="row" spacing={1.25} alignItems="center" justifyContent="flex-start" sx={{ width: "100%" }}>
                          <Box className="workout-row-mark" aria-hidden="true">
                            <FitnessCenterRoundedIcon />
                          </Box>
                          <Box sx={{ minWidth: 0, textAlign: "left" }}>
                            <Typography variant="body2" fontWeight={600} noWrap sx={{ color: "#fff" }}>
                              {workout.name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: CM.textDim }}>
                              {workout.code}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell align="center">
                        <DarkPill tone={String(workout.source).toLowerCase() === "system" ? "info" : "warning"}>
                          {String(workout.source || "unknown").toLowerCase() === "system" ? "System" : String(workout.source || "Unknown").toLowerCase() === "custom" ? "Custom" : "Unknown source"}
                        </DarkPill>
                      </TableCell>
                      <TableCell align="center">
                        <LevelChip level={workout.level} toneOf={levelTone} />
                      </TableCell>
                      <TableCell align="center">
                        <Typography sx={{ color: "#fff", fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>
                          {Array.isArray(workout.exercises) ? workout.exercises.length : 0}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: "flex", justifyContent: "center" }}>
                          <StatusDot active={workout.active} />
                        </Box>
                      </TableCell>
                      <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                        <Typography variant="caption" sx={{ color: CM.textDim }}>
                          {formatDate(workout.updatedAt)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          <Button
                            component={RouterLink}
                            to={`${CONTENT_PATHS.workouts}/${encodeURIComponent(workout.code)}`}
                            size="small"
                            variant="outlined"
                            sx={{ py: 0.25, px: 1.25, fontSize: 11.5, minWidth: 0, borderRadius: "8px" }}
                          >
                            View
                          </Button>
                          <IconButton
                            size="small"
                            aria-label={`More actions for ${workout.name}`}
                            aria-expanded={Boolean(menu.anchor) && menu.workout?.code === workout.code}
                            onClick={(event) => setMenu({ anchor: event.currentTarget, workout })}
                          >
                            <MoreVertRoundedIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ py: 6, textAlign: "center" }}>
                        <Stack alignItems="center" spacing={1}>
                          <FitnessCenterRoundedIcon sx={{ fontSize: 44, color: CM.textDim, opacity: 0.4 }} />
                          <Typography variant="body2" color="text.secondary">
                            {workouts.length
                              ? "No workouts match this search."
                              : "No workouts yet. Create your first workout to get started."}
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
              onRowsPerPageChange={(event) => {
                setRowsPerPage(parseInt(event.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 20, 50]}
              labelDisplayedRows={({ from, to, count }) => `Showing ${from}-${to} of ${count} workouts`}
            />
          </>
        )}
      </Card>

      <Menu anchorEl={menu.anchor} open={Boolean(menu.anchor)} onClose={closeMenu}>
        <MenuItem
          component={RouterLink}
          to={menu.workout ? `${CONTENT_PATHS.workouts}/${encodeURIComponent(menu.workout.code)}` : "#"}
          onClick={closeMenu}
        >
          View details
        </MenuItem>
        <MenuItem
          disabled={statusMutation.isPending}
          onClick={() => {
            const workout = menu.workout;
            closeMenu();
            if (workout) statusMutation.mutate({ code: workout.code, active: !workout.active });
          }}
        >
          {menu.workout?.active ? "Set inactive" : "Set active"}
        </MenuItem>
        <MenuItem
          disabled={deleteMutation.isPending}
          sx={{ color: "error.main" }}
          onClick={() => {
            const workout = menu.workout;
            closeMenu();
            if (workout && window.confirm(`Delete "${workout.name}"? This cannot be undone.`)) {
              deleteMutation.mutate(workout.code);
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
