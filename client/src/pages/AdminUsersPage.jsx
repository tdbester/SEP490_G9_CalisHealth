import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  IconButton,
  InputAdornment,
  MenuItem,
  Pagination,
  PaginationItem,
  Skeleton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import { useLocation, useNavigate } from "react-router-dom";
import { adminUsersApi, apiErrorMessage } from "../api/adminUsers";
import { CM } from "../theme-content";

const PAGE_SIZE = 10;

const ROLE_LABEL = { MEMBER: "Member", CONTENT_MANAGER: "Content Manager", ADMIN: "Admin" };
const ROLE_TONE = {
  MEMBER: { fg: "#A78BFA", bg: "rgba(139,92,246,0.16)" },
  CONTENT_MANAGER: { fg: "#F8C858", bg: "rgba(248,200,88,0.14)" },
  ADMIN: { fg: "#FF7799", bg: "rgba(255,119,153,0.15)" },
};
const STATUS_LABEL = { ACTIVE: "Active", INACTIVE: "Inactive" };
const SORTS = [
  { value: "newest", label: "Joined: Newest first" },
  { value: "oldest", label: "Joined: Oldest first" },
  { value: "name_asc", label: "Name: A to Z" },
  { value: "name_desc", label: "Name: Z to A" },
];

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "-";

const initials = (name) =>
  (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

function Pill({ children, fg, bg, border }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: 1.25,
        py: 0.3,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
        color: fg,
        bgcolor: bg,
        border: border ? `1px solid ${border}` : "none",
      }}
    >
      {children}
    </Box>
  );
}

function StatCard({ label, value, tone }) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 180,
        p: 2.25,
        borderRadius: "16px",
        bgcolor: CM.surface,
        border: `1px solid ${CM.border}`,
      }}
    >
      <Typography sx={{ fontSize: 13, color: CM.textMuted }}>{label}</Typography>
      <Typography sx={{ mt: 0.5, fontSize: 28, fontWeight: 700, color: tone || CM.text }}>
        {value == null ? "-" : value.toLocaleString("en-US")}
      </Typography>
    </Box>
  );
}

const fieldSx = {
  "& .MuiOutlinedInput-root": { bgcolor: CM.surfaceSoft, borderRadius: "10px" },
};

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

/** Admin user management (Figma users-list 1, node 710:520). */
export default function AdminUsersPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [joinedOn, setJoinedOn] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(() => new Set());
  const navigate = useNavigate();
  const location = useLocation();
  // The create page navigates back here with a success message in the router state.
  const [toast, setToast] = useState(location.state?.toast ?? "");
  const requestId = useRef(0);

  useEffect(() => {
    if (location.state?.toast) navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.title = "User Management | CalisHealth";
  }, []);

  // Debounce the search box so we do not call the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const res = await adminUsersApi.list({ q, role, status, joinedOn, sort, page, size: PAGE_SIZE });
      if (id !== requestId.current) return; // a newer request superseded this one
      setData(res);
      if (res.totalPages > 0 && page >= res.totalPages) setPage(res.totalPages - 1);
    } catch (err) {
      if (id === requestId.current) setError(apiErrorMessage(err, "Could not load users."));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [q, role, status, joinedOn, sort, page]);

  useEffect(() => {
    load();
  }, [load]);

  const items = data?.items ?? [];
  const summary = data?.summary;
  const selectedOnPage = useMemo(() => items.filter((u) => selected.has(u.id)).length, [items, selected]);
  const allOnPageSelected = items.length > 0 && selectedOnPage === items.length;

  const toggleOne = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAllOnPage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      items.forEach((u) => (allOnPageSelected ? next.delete(u.id) : next.add(u.id)));
      return next;
    });

  const applyStatus = async (active) => {
    const ids = [...selected];
    if (!ids.length) return;
    try {
      const res = await adminUsersApi.setActive(ids, active);
      setToast(`${res.affected} user(s) ${active ? "activated" : "deactivated"}.`);
      setSelected(new Set());
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const rowToggleStatus = async (u) => {
    try {
      await adminUsersApi.setActive([u.id], !u.active);
      setToast(`${u.fullName} ${u.active ? "deactivated" : "activated"}.`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const from = data && data.totalElements > 0 ? data.page * data.size + 1 : 0;
  const to = data ? Math.min((data.page + 1) * data.size, data.totalElements) : 0;
  return (
    <Box sx={{ p: { xs: 2, md: 3.5 } }}>
      <Typography sx={{ fontSize: 13, color: CM.textMuted }}>Admin / Users</Typography>

      <Box
        sx={{
          mt: 1,
          mb: 3,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box sx={{ maxWidth: 640 }}>
          <Typography component="h1" sx={{ fontSize: 34, fontWeight: 700, lineHeight: 1.2 }}>
            User Management
          </Typography>
          <Typography sx={{ mt: 0.75, fontSize: 14, color: CM.textMuted }}>
            View and manage registered CalisHealth athletes, coaches, account access tiers, and security statuses.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => navigate("/admin/users/create")}
          sx={{ background: CM.buttonGradient, borderRadius: "10px", px: 2.25 }}>
          Add admin/content manager
        </Button>
      </Box>

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 3 }}>
        <StatCard label="All Users" value={summary?.total} />
        <StatCard label="Active" value={summary?.active} tone={CM.green} />
        <StatCard label="Inactive" value={summary?.inactive} tone={CM.pink} />
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 2 }}>
        <TextField
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by athlete name, email, or USR-ID..."
          inputProps={{ "aria-label": "Search users" }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ fontSize: 19, color: CM.textDim }} />
              </InputAdornment>
            ),
          }}
          sx={{ ...fieldSx, flex: "1 1 280px", maxWidth: 392 }}
        />
        <TextField
          select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(0);
          }}
          inputProps={{ "aria-label": "Filter by role" }}
          SelectProps={{
            displayEmpty: true,
            renderValue: (v) => (v ? `Role: ${ROLE_LABEL[v]}` : "Role: All Roles"),
          }}
          sx={{ ...fieldSx, width: 220 }}
        >
          <MenuItem value="">All Roles</MenuItem>
          {Object.keys(ROLE_LABEL).map((r) => (
            <MenuItem key={r} value={r}>
              {ROLE_LABEL[r]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
          inputProps={{ "aria-label": "Filter by status" }}
          SelectProps={{
            displayEmpty: true,
            renderValue: (v) => (v ? `Status: ${STATUS_LABEL[v]}` : "Status: All"),
          }}
          sx={{ ...fieldSx, width: 190 }}
        >
          <MenuItem value="">All Statuses</MenuItem>
          {Object.keys(STATUS_LABEL).map((s) => (
            <MenuItem key={s} value={s}>
              {STATUS_LABEL[s]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          type="date"
          label="Joined date"
          value={joinedOn}
          onChange={(e) => {
            setJoinedOn(e.target.value);
            setPage(0);
          }}
          InputLabelProps={{ shrink: true }}
          inputProps={{ "aria-label": "Filter by joined date" }}
          sx={{
            ...fieldSx,
            width: 190,
            // The native calendar icon is dark by default; invert it so it shows white on the dark theme.
            "& input::-webkit-calendar-picker-indicator": { filter: "invert(1)", cursor: "pointer" },
          }}
        />
        {(status || joinedOn) && (
          <Button
            color="inherit"
            onClick={() => {
              setStatus("");
              setJoinedOn("");
              setPage(0);
            }}
            sx={{ borderRadius: "10px" }}
          >
            Clear filters
          </Button>
        )}
        <TextField
          select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(0);
          }}
          inputProps={{ "aria-label": "Sort users" }}
          sx={{ ...fieldSx, width: 230 }}
        >
          {SORTS.map((s) => (
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
            mb: 2,
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
            {selected.size} Users selected across table
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Activate selected">
            <IconButton
              aria-label="Activate selected users"
              onClick={() => applyStatus(true)}
              sx={{
                color: CM.green,
                border: `1px solid rgba(120,232,136,0.35)`,
                "&:hover": { bgcolor: "rgba(120,232,136,0.12)" },
              }}
            >
              <PersonOutlineOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Deactivate selected">
            <IconButton
              aria-label="Deactivate selected users"
              onClick={() => applyStatus(false)}
              sx={{
                color: CM.pink,
                border: `1px solid rgba(255,119,153,0.35)`,
                "&:hover": { bgcolor: "rgba(255,119,153,0.12)" },
              }}
            >
              <PersonOffOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button color="inherit" size="small" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <TableContainer sx={{ borderRadius: "16px", bgcolor: CM.surface, border: `1px solid ${CM.border}` }}>
        <Table aria-label="Users" sx={{ minWidth: 860 }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" sx={headCellSx}>
                <Checkbox
                  checked={allOnPageSelected}
                  indeterminate={selectedOnPage > 0 && !allOnPageSelected}
                  onChange={toggleAllOnPage}
                  inputProps={{ "aria-label": "Select all users on this page" }}
                />
              </TableCell>
              <TableCell sx={headCellSx}>USER / ATHLETE</TableCell>
              <TableCell sx={headCellSx}>CONTACT EMAIL</TableCell>
              <TableCell sx={headCellSx}>ROLE</TableCell>
              <TableCell sx={headCellSx}>STATUS</TableCell>
              <TableCell sx={headCellSx}>JOINED DATE</TableCell>
              <TableCell sx={headCellSx} align="right">ACTIONS</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && !data
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7} sx={bodyCellSx}>
                      <Skeleton height={36} />
                    </TableCell>
                  </TableRow>
                ))
              : items.map((u) => {
                  const tone = ROLE_TONE[u.role] ?? ROLE_TONE.MEMBER;
                  return (
                    <TableRow key={u.id} hover selected={selected.has(u.id)}
                      sx={{ opacity: loading ? 0.6 : 1, transition: "opacity .15s" }}>
                      <TableCell padding="checkbox" sx={bodyCellSx}>
                        <Checkbox
                          checked={selected.has(u.id)}
                          onChange={() => toggleOne(u.id)}
                          inputProps={{ "aria-label": `Select ${u.fullName}` }}
                        />
                      </TableCell>
                      <TableCell sx={bodyCellSx}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Box
                            aria-hidden
                            sx={{
                              width: 38,
                              height: 38,
                              flexShrink: 0,
                              display: "grid",
                              placeItems: "center",
                              borderRadius: "50%",
                              fontSize: 13,
                              fontWeight: 700,
                              background: CM.gradientSoft,
                              color: CM.violetBright,
                            }}
                          >
                            {initials(u.fullName)}
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 600 }} noWrap>
                              {u.fullName}
                            </Typography>
                            <Box sx={{ mt: 0.25 }}>
                              <Pill fg={CM.textMuted} bg="rgba(150,124,255,0.1)">
                                {u.userCode}
                              </Pill>
                            </Box>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, color: CM.textMuted }}>{u.email}</TableCell>
                      <TableCell sx={bodyCellSx}>
                        <Pill fg={tone.fg} bg={tone.bg}>
                          {ROLE_LABEL[u.role] ?? u.role}
                        </Pill>
                      </TableCell>
                      <TableCell sx={bodyCellSx}>
                        {u.active ? (
                          <Pill fg={CM.green} bg="rgba(120,232,136,0.13)">Active</Pill>
                        ) : (
                          <Pill fg={CM.textMuted} bg="rgba(168,155,208,0.14)">Inactive</Pill>
                        )}
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, color: CM.textMuted }}>{fmtDate(u.createdAt)}</TableCell>
                      <TableCell sx={bodyCellSx} align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          color={u.active ? "secondary" : "primary"}
                          onClick={() => rowToggleStatus(u)}
                          sx={{ borderRadius: "8px" }}
                        >
                          {u.active ? "Deactivate" : "Activate"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
            {!loading && !error && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ ...bodyCellSx, py: 6, color: CM.textMuted }}>
                  No users match your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {data && data.totalElements > 0 && (
        <Box
          sx={{
            mt: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Typography sx={{ fontSize: 13, color: CM.textMuted }}>
            Showing {from}–{to} of {data.totalElements.toLocaleString("en-US")} athletes
          </Typography>
          <Pagination
            count={data.totalPages}
            page={data.page + 1}
            onChange={(_, p) => setPage(p - 1)}
            shape="rounded"
            color="primary"
            renderItem={(item) => (
              <PaginationItem
                {...item}
                slots={{ previous: () => <span>Previous</span>, next: () => <span>Next</span> }}
              />
            )}
          />
        </Box>
      )}

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast("")}
        message={toast}
      />
    </Box>
  );
}
