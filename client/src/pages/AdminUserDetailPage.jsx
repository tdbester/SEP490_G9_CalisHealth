import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
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
  Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { adminUsersApi, apiErrorMessage } from "../api/adminUsers";
import { CM } from "../theme-content";

const PAGE_SIZE = 5;

const tone = (fg) => ({ fg, bg: `${fg}24` });
const TONES = {
  green: tone(CM.green),
  pink: tone(CM.pink),
  amber: tone(CM.amber),
  violet: tone(CM.violetBright),
  blue: tone("#7AA2FF"),
  muted: tone(CM.textMuted),
};

const ROLE_LABEL = { MEMBER: "Member", CONTENT_MANAGER: "Content Manager", ADMIN: "Admin" };
const ROLE_TONE = { MEMBER: TONES.violet, CONTENT_MANAGER: TONES.amber, ADMIN: TONES.pink };
const SUBTITLE = {
  MEMBER: "View member profile, workout activity history and system logs.",
  CONTENT_MANAGER: "View content manager profile, content activity and system logs.",
  ADMIN: "View admin profile, management actions and system logs.",
};

// value -> [label, tone] for every status/type chip shown in the tables
const KIND = { WORKOUT: ["Workout", TONES.violet], EXERCISE: ["Exercise", TONES.blue] };
const ACTIVITY_STATUS = {
  COMPLETED: ["Completed", TONES.green],
  CANCELLED: ["Cancelled", TONES.pink],
  IN_PROGRESS: ["In progress", TONES.amber],
};
const LOG_TYPE = {
  SKILL: ["Skill", TONES.green],
  LEVEL_CHANGE: ["Level Change", TONES.blue],
  ASSESSMENT: ["Assessment", TONES.violet],
  ACCOUNT: ["Account", TONES.muted],
  LOGIN: ["Login", TONES.violet],
  MODERATION: ["Moderation", TONES.amber],
  NOTIFICATION: ["Notification", TONES.blue],
  MAINTENANCE: ["Maintenance", TONES.amber],
  STORAGE: ["Storage", TONES.green],
};
const LOG_STATUS = {
  SUCCESS: ["Success", TONES.green],
  FAILED: ["Failed", TONES.pink],
  WARNING: ["Warning", TONES.amber],
  INFO: ["Info", TONES.blue],
  SCHEDULED: ["Scheduled", TONES.blue],
};
const ADMIN_ACTION = {
  CREATE_ACCOUNT: ["Create account", TONES.violet],
  ACTIVATE: ["Activate", TONES.green],
  DEACTIVATE: ["Deactivate", TONES.pink],
};
const CONTENT_TYPE = { SKILL: ["Skill", TONES.blue], EXERCISE: ["Exercise", TONES.violet], WORKOUT: ["Workout", TONES.amber] };
const CONTENT_ACTION = { UPDATED: "Updated", DEACTIVATED: "Deactivated" };

// Event types offered per role (the design lists different ones for each screen).
const LOG_FILTERS = {
  MEMBER: ["SKILL", "LEVEL_CHANGE", "ASSESSMENT", "ACCOUNT"],
  CONTENT_MANAGER: ["LOGIN", "MODERATION", "ACCOUNT"],
  ADMIN: ["NOTIFICATION", "MAINTENANCE", "STORAGE", "LOGIN", "ACCOUNT"],
};

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "-";
const fmtDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

const fieldSx = { "& .MuiOutlinedInput-root": { bgcolor: CM.surfaceSoft, borderRadius: "10px" } };
const dateFieldSx = {
  ...fieldSx,
  width: 180,
  // The native calendar icon is dark by default; invert it so it shows white on the dark theme.
  "& input::-webkit-calendar-picker-indicator": { filter: "invert(1)", cursor: "pointer" },
};
const headCellSx = {
  color: CM.textDim,
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: "0.08em",
  borderBottom: `1px solid ${CM.border}`,
  bgcolor: CM.surfaceSoft,
  whiteSpace: "nowrap",
  textAlign: "left",
};
const bodyCellSx = { borderBottom: `1px solid ${CM.border}`, fontSize: 13.5, textAlign: "left" };

function Chip({ label, toneDef }) {
  const t = toneDef ?? TONES.muted;
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
        color: t.fg,
        bgcolor: t.bg,
      }}
    >
      {label}
    </Box>
  );
}

function Card({ title, children, sx }) {
  return (
    <Box
      component="section"
      sx={{ p: 2.5, borderRadius: "16px", bgcolor: CM.surface, border: `1px solid ${CM.border}`, ...sx }}
    >
      {title && (
        <Typography component="h2" sx={{ mb: 2, fontSize: 16, fontWeight: 700 }}>
          {title}
        </Typography>
      )}
      {children}
    </Box>
  );
}

function Field({ label, children }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2, minHeight: 34 }}>
      <Typography sx={{ width: 120, flexShrink: 0, fontSize: 12.5, color: CM.textMuted }}>{label}</Typography>
      <Box sx={{ fontSize: 13, minWidth: 0, overflowWrap: "anywhere" }}>{children ?? "-"}</Box>
    </Box>
  );
}

function Stat({ label, value, hint }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: "12px", bgcolor: CM.surfaceSoft, border: `1px solid ${CM.border}` }}>
      <Typography sx={{ fontSize: 12, color: CM.textMuted }}>{label}</Typography>
      <Typography sx={{ mt: 0.5, fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}>{value ?? "-"}</Typography>
      {hint && <Typography sx={{ mt: 0.25, fontSize: 11, color: CM.textDim }}>{hint}</Typography>}
    </Box>
  );
}

function StatGrid({ children }) {
  return <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.5 }}>{children}</Box>;
}

function SelectFilter({ label, value, onChange, options, width = 170 }) {
  return (
    <TextField
      select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputProps={{ "aria-label": `Filter by ${label.toLowerCase()}` }}
      SelectProps={{
        displayEmpty: true,
        renderValue: (v) => `${label}: ${v ? options.find((o) => o.value === v)?.label ?? v : "All"}`,
      }}
      sx={{ ...fieldSx, width }}
    >
      <MenuItem value="">All</MenuItem>
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

function DateFilter({ value, onChange, label = "Date" }) {
  return (
    <TextField
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      InputLabelProps={{ shrink: true }}
      label={label}
      inputProps={{ "aria-label": `Filter by ${label.toLowerCase()}` }}
      sx={dateFieldSx}
    />
  );
}

/** Fetches one page of a table and refetches when filters change. Stale responses are dropped. */
function usePagedTable(fetchPage, deps) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [page, setPage] = useState(0);
  const depKey = JSON.stringify(deps);

  // Any filter change goes back to the first page.
  useEffect(() => {
    setPage(0);
  }, [depKey]);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: "" }));
    fetchPage(page)
      .then((data) => !cancelled && setState({ loading: false, error: "", data }))
      .catch((err) => !cancelled && setState((s) => ({ ...s, loading: false, error: apiErrorMessage(err, "Could not load this table.") })));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, depKey]);

  return { ...state, page, setPage };
}

function DataTable({ label, columns, rows, renderRow, table, emptyText, noun, filteredDate }) {
  const { loading, error, data, page, setPage } = table;
  const total = data?.totalElements ?? 0;
  const from = total > 0 ? page * PAGE_SIZE + 1 : 0;
  const to = Math.min((page + 1) * PAGE_SIZE, total);
  return (
    <>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <TableContainer sx={{ borderRadius: "12px", border: `1px solid ${CM.border}` }}>
        <Table aria-label={label} sx={{ minWidth: 720 }}>
          <TableHead>
            <TableRow>
              {columns.map((c) => (
                <TableCell key={c} sx={headCellSx}>
                  {c}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && !data
              ? Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={columns.length} sx={bodyCellSx}>
                      <Skeleton height={32} />
                    </TableCell>
                  </TableRow>
                ))
              : rows.map((row, i) => (
                  <TableRow key={i} sx={{ opacity: loading ? 0.6 : 1, transition: "opacity .15s" }}>
                    {renderRow(row).map((cell, j) => (
                      <TableCell key={j} sx={bodyCellSx}>
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
            {!loading && !error && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ ...bodyCellSx, textAlign: "center", py: 5, color: CM.textMuted }}>
                  {emptyText}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {total > 0 && (
        <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5 }}>
          <Typography sx={{ fontSize: 12, color: CM.textMuted }}>
            Showing {from}-{to} of {total.toLocaleString("en-US")} {noun}
            {filteredDate ? ` on ${fmtDate(filteredDate)}` : ""}
          </Typography>
          <Pagination
            count={data.totalPages}
            page={page + 1}
            onChange={(_, p) => setPage(p - 1)}
            shape="rounded"
            color="primary"
            size="small"
            renderItem={(item) => (
              <PaginationItem {...item} slots={{ previous: () => <span>Previous</span>, next: () => <span>Next</span> }} />
            )}
          />
        </Box>
      )}
    </>
  );
}

function Toolbar({ children }) {
  return <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center", mb: 2 }}>{children}</Box>;
}

const TimeCell = ({ iso }) => <span style={{ whiteSpace: "nowrap" }}>{fmtDateTime(iso)}</span>;

function NameWithSub({ name, sub, subTone }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 13.5 }}>{name}</Typography>
      {sub && <Typography sx={{ fontSize: 11, color: subTone ?? CM.textMuted }}>{sub}</Typography>}
    </Box>
  );
}

const initials = (name) =>
  (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

// ---------------------------------------------------------------------------------
// Role specific sections
// ---------------------------------------------------------------------------------

function WorkoutHistory({ userId, levelOptions }) {
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [level, setLevel] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const table = usePagedTable(
    (page) => adminUsersApi.workoutActivity(userId, { q, type, level, status, date, page, size: PAGE_SIZE }),
    [userId, q, type, level, status, date],
  );
  const levels = (levelOptions?.length ? levelOptions : ["Beginner", "Intermediate", "Advanced"]).map((l) => ({
    value: l,
    label: l,
  }));

  return (
    <Card title="Workout Activity History">
      <Toolbar>
        <TextField
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search workout / exercise"
          inputProps={{ "aria-label": "Search workout or exercise" }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ fontSize: 19, color: CM.textDim }} />
              </InputAdornment>
            ),
          }}
          sx={{ ...fieldSx, flex: "1 1 240px", maxWidth: 320 }}
        />
        <SelectFilter label="Type" value={type} onChange={setType} width={150}
          options={[{ value: "WORKOUT", label: "Workout" }, { value: "EXERCISE", label: "Exercise" }]} />
        <SelectFilter label="Level" value={level} onChange={setLevel} options={levels} width={190} />
        <SelectFilter label="Status" value={status} onChange={setStatus} width={170}
          options={[{ value: "COMPLETED", label: "Completed" }, { value: "CANCELLED", label: "Cancelled" }]} />
        <Box sx={{ flex: 1 }} />
        <DateFilter value={date} onChange={setDate} />
      </Toolbar>
      <DataTable
        label="Workout activity history"
        columns={["DATE", "WORKOUT / EXERCISE", "TYPE", "LEVEL", "STATUS"]}
        rows={table.data?.items ?? []}
        table={table}
        noun="activities"
        filteredDate={date}
        emptyText="No workout activity matches your filters."
        renderRow={(r) => [
          fmtDate(r.occurredAt),
          <NameWithSub key="n" name={r.name} sub={r.detail} />,
          <Chip key="t" label={KIND[r.kind][0]} toneDef={KIND[r.kind][1]} />,
          r.level ?? "-",
          <Chip key="s" label={ACTIVITY_STATUS[r.status][0]} toneDef={ACTIVITY_STATUS[r.status][1]} />,
        ]}
      />
    </Card>
  );
}

function ContentHistory({ userId }) {
  const [type, setType] = useState("");
  const [action, setAction] = useState("");
  const table = usePagedTable(
    (page) => adminUsersApi.contentActivity(userId, { type, action, page, size: PAGE_SIZE }),
    [userId, type, action],
  );
  return (
    <Card title="Content Activity">
      <Toolbar>
        <SelectFilter label="Type" value={type} onChange={setType} width={160}
          options={Object.entries(CONTENT_TYPE).map(([value, [label]]) => ({ value, label }))} />
        <SelectFilter label="Action" value={action} onChange={setAction} width={180}
          options={Object.entries(CONTENT_ACTION).map(([value, label]) => ({ value, label }))} />
      </Toolbar>
      <DataTable
        label="Content activity"
        columns={["DATE & TIME", "ITEM", "TYPE", "ACTION", "STATUS"]}
        rows={table.data?.items ?? []}
        table={table}
        noun="content items"
        emptyText="This content manager has not created any content yet."
        renderRow={(r) => [
          <TimeCell key="d" iso={r.occurredAt} />,
          <NameWithSub key="n" name={r.name} sub={r.code} />,
          <Chip key="t" label={CONTENT_TYPE[r.itemType][0]} toneDef={CONTENT_TYPE[r.itemType][1]} />,
          CONTENT_ACTION[r.action],
          <Chip key="s" label={r.status} toneDef={r.status === "Active" ? TONES.green : TONES.muted} />,
        ]}
      />
    </Card>
  );
}

function AdminActions({ userId }) {
  const [action, setAction] = useState("");
  const [date, setDate] = useState("");
  const table = usePagedTable(
    (page) => adminUsersApi.adminActions(userId, { action, date, page, size: PAGE_SIZE }),
    [userId, action, date],
  );
  return (
    <Card title="Admin Actions">
      <Toolbar>
        <SelectFilter label="Action" value={action} onChange={setAction} width={210}
          options={Object.entries(ADMIN_ACTION).map(([value, [label]]) => ({ value, label }))} />
        <Box sx={{ flex: 1 }} />
        <DateFilter value={date} onChange={setDate} />
      </Toolbar>
      <DataTable
        label="Admin actions"
        columns={["DATE & TIME", "ACTION", "TARGET", "STATUS"]}
        rows={table.data?.items ?? []}
        table={table}
        noun="admin actions"
        filteredDate={date}
        emptyText="No admin actions match your filters."
        renderRow={(r) => [
          <TimeCell key="d" iso={r.occurredAt} />,
          <Chip key="a" label={ADMIN_ACTION[r.action][0]} toneDef={ADMIN_ACTION[r.action][1]} />,
          <NameWithSub key="t" name={r.targetName} sub={`${r.targetCode} \u00b7 ${ROLE_LABEL[r.targetRole] ?? r.targetRole}`} />,
          <Chip key="s" label={LOG_STATUS[r.status]?.[0] ?? r.status} toneDef={LOG_STATUS[r.status]?.[1]} />,
        ]}
      />
    </Card>
  );
}

function SystemLogs({ userId, role }) {
  const [type, setType] = useState("");
  const [date, setDate] = useState("");
  const table = usePagedTable(
    (page) => adminUsersApi.systemLogs(userId, { type, date, page, size: PAGE_SIZE }),
    [userId, type, date],
  );
  return (
    <Card title="System Logs">
      <Toolbar>
        <SelectFilter label="Event type" value={type} onChange={setType} width={220}
          options={(LOG_FILTERS[role] ?? []).map((value) => ({ value, label: LOG_TYPE[value][0] }))} />
        <Box sx={{ flex: 1 }} />
        <DateFilter value={date} onChange={setDate} />
      </Toolbar>
      <DataTable
        label="System logs"
        columns={["DATE & TIME", "EVENT TYPE", "DESCRIPTION", "STATUS"]}
        rows={table.data?.items ?? []}
        table={table}
        noun="system events"
        filteredDate={date}
        emptyText="No system events match your filters."
        renderRow={(r) => [
          <TimeCell key="d" iso={r.occurredAt} />,
          <Chip key="e" label={LOG_TYPE[r.eventType]?.[0] ?? r.eventType} toneDef={LOG_TYPE[r.eventType]?.[1]} />,
          r.description,
          <Chip key="s" label={LOG_STATUS[r.status]?.[0] ?? r.status} toneDef={LOG_STATUS[r.status]?.[1]} />,
        ]}
      />
    </Card>
  );
}

function ProfileCard({ d }) {
  const m = d.member;
  const staff = d.role !== "MEMBER";
  const status = d.active ? <Chip label="Active" toneDef={TONES.green} /> : <Chip label="Inactive" toneDef={TONES.muted} />;
  const role = <Chip label={ROLE_LABEL[d.role] ?? d.role} toneDef={ROLE_TONE[d.role]} />;
  const password = d.passwordState === "DEFAULT"
    ? <Chip label="Default" toneDef={TONES.amber} />
    : <Chip label="Changed" toneDef={TONES.green} />;

  return (
    <Card title="User Profile">
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, columnGap: 3 }}>
        <Box>
          <Field label="Full Name">{d.fullName}</Field>
          <Field label="User ID">{d.userCode}</Field>
          <Field label="Email">{d.email}</Field>
          {!staff && <Field label="Age">{m?.age ?? "-"}</Field>}
          {!staff && <Field label="Gender">{m?.gender ?? "-"}</Field>}
          {!staff && <Field label="Goal">{m?.goal ?? "-"}</Field>}
          {staff && <Field label="Role">{role}</Field>}
        </Box>
        <Box>
          {!staff && <Field label="Height">{m?.heightCm != null ? `${Number(m.heightCm)} cm` : "-"}</Field>}
          {!staff && <Field label="Weight">{m?.weightKg != null ? `${Number(m.weightKg)} kg` : "-"}</Field>}
          <Field label="Account Status">{status}</Field>
          {staff ? <Field label="Password">{password}</Field> : <Field label="Role">{role}</Field>}
          <Field label="Joined Date">{fmtDate(d.createdAt)}</Field>
          <Field label="Last Active">{d.lastActiveAt ? fmtDateTime(d.lastActiveAt) : "Never"}</Field>
        </Box>
      </Box>
      {d.role === "ADMIN" && d.passwordState === "DEFAULT" && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <strong>Default password still in use.</strong> Admin accounts are not forced to change it. Consider changing it
          from Profile &gt; Change password.
        </Alert>
      )}
    </Card>
  );
}

function StatsCard({ d }) {
  if (d.member) {
    const m = d.member;
    return (
      <Card title="Progress Statistics">
        <StatGrid>
          <Stat label="Current Level" value={m.levelRank ? `Level ${m.levelRank}` : "-"} hint={m.levelName ?? "Not assessed yet"} />
          <Stat label="Total Workouts" value={m.totalWorkouts.toLocaleString("en-US")} hint="Completed sessions" />
          <Stat label="Workout Streak" value={`${m.streakDays} ${m.streakDays === 1 ? "Day" : "Days"}`} hint={`Personal best: ${m.longestStreak}`} />
        </StatGrid>
      </Card>
    );
  }
  if (d.content) {
    const c = d.content;
    return (
      <Card title="Content Statistics">
        <StatGrid>
          <Stat label="Exercises" value={c.exercises} hint="Created" />
          <Stat label="Skills" value={c.skills} hint="Created" />
          <Stat label="Workouts" value={c.workouts} hint="Created" />
          <Stat label="Reviewed" value={c.reviewed ?? "-"} hint={c.reviewed == null ? "Not tracked yet" : "Member submissions"} />
        </StatGrid>
      </Card>
    );
  }
  const a = d.admin;
  return (
    <Card title="Admin Activity">
      <StatGrid>
        <Stat label="Accounts created" value={a.accountsCreated} hint="Admin + content manager" />
        <Stat label="Users deactivated" value={a.usersDeactivated} hint="All time" />
        <Stat label="Users activated" value={a.usersActivated} hint="All time" />
        <Stat label="Notifications sent" value={a.notificationsSent} hint="System notifications" />
        <Stat label="Maintenance" value={a.maintenanceSchedules} hint="Schedules created" />
        <Stat label="Storage actions" value={a.storageActions} hint="Cleanups and limit changes" />
      </StatGrid>
    </Card>
  );
}

function DeactivateDialog({ user, busy, onCancel, onConfirm }) {
  return (
    <Dialog
      open={Boolean(user)}
      onClose={busy ? undefined : onCancel}
      aria-labelledby="deactivate-title"
      aria-describedby="deactivate-desc"
      PaperProps={{ sx: { width: 440, maxWidth: "calc(100% - 32px)", p: 1, borderRadius: "16px", bgcolor: CM.surface, border: `1px solid ${CM.borderStrong}` } }}
    >
      {user && (
        <>
          <DialogContent>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
              <Box aria-hidden sx={{ width: 36, height: 36, display: "grid", placeItems: "center", borderRadius: "50%", fontWeight: 800, color: CM.pink, bgcolor: "rgba(255,119,153,0.16)" }}>
                !
              </Box>
              <Box>
                <Typography id="deactivate-title" component="h2" sx={{ fontSize: 17, fontWeight: 700 }}>
                  Deactivate this account?
                </Typography>
                <Typography sx={{ fontSize: 13, color: CM.textMuted }}>This takes effect immediately.</Typography>
              </Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1.5, mb: 2, borderRadius: "12px", bgcolor: CM.surfaceSoft, border: `1px solid ${CM.border}` }}>
              <Box aria-hidden sx={{ width: 36, height: 36, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: "50%", fontSize: 12.5, fontWeight: 700, background: CM.gradientSoft, color: CM.violetBright }}>
                {initials(user.fullName)}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600 }} noWrap>{user.fullName}</Typography>
                <Typography sx={{ fontSize: 12, color: CM.textMuted }}>
                  {user.userCode} {"\u00b7"} {ROLE_LABEL[user.role] ?? user.role}
                </Typography>
              </Box>
            </Box>
            <Typography id="deactivate-desc" sx={{ fontSize: 13, lineHeight: 1.7, color: CM.textMuted }}>
              They will be blocked right away and can&apos;t sign in. Sign-in will show &quot;Your account has been blocked&quot;.
              Their data and history are kept. You can activate the account again at any time.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button color="inherit" onClick={onCancel} disabled={busy} sx={{ borderRadius: "10px" }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={onConfirm}
              disabled={busy}
              sx={{ borderRadius: "10px", bgcolor: CM.pink, color: "#2A0A14", "&:hover": { bgcolor: "#FF5C85" } }}
            >
              {busy ? "Deactivating..." : "Deactivate"}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}

/** Admin user detail & activity log (design: user-detail-member / content-manager / admin / deactivate-warning). */
export default function AdminUserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    document.title = "User Detail | CalisHealth";
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setDetail(null);
    adminUsersApi
      .detail(id)
      .then((d) => !cancelled && setDetail(d))
      .catch((err) =>
        !cancelled &&
        setError(err?.response?.status === 404 ? "This user does not exist." : apiErrorMessage(err, "Could not load this user.")),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const changeStatus = async (active) => {
    setBusy(true);
    try {
      await adminUsersApi.setActive([detail.id], active);
      setDetail(await adminUsersApi.detail(detail.id));
      setToast(`${detail.fullName} ${active ? "activated" : "deactivated"}.`);
      setConfirmOpen(false);
    } catch (err) {
      setConfirmOpen(false);
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const role = detail?.role;

  return (
    <Box sx={{ p: { xs: 2, md: 3.5 } }}>
      <Typography sx={{ fontSize: 13, color: CM.textMuted }}>Admin / Users / User Detail</Typography>

      <Box sx={{ mt: 1, mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box sx={{ maxWidth: 640 }}>
          <Typography component="h1" sx={{ fontSize: 30, fontWeight: 700, lineHeight: 1.2 }}>
            User Detail &amp; Activity Log
          </Typography>
          <Typography sx={{ mt: 0.75, fontSize: 14, color: CM.textMuted }}>
            {SUBTITLE[role] ?? "View the profile, activity history and system logs of this account."}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.75 }}>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {detail &&
              (detail.active ? (
                <Button
                  variant="outlined"
                  color="secondary"
                  disabled={detail.self}
                  onClick={() => setConfirmOpen(true)}
                  sx={{ borderRadius: "10px" }}
                >
                  Deactivate
                </Button>
              ) : (
                <Button variant="outlined" color="success" disabled={busy} onClick={() => changeStatus(true)} sx={{ borderRadius: "10px" }}>
                  Activate
                </Button>
              ))}
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<ArrowBackRoundedIcon />}
              onClick={() => navigate("/admin/users")}
              sx={{ borderRadius: "10px", borderColor: CM.borderStrong }}
            >
              Back to User List
            </Button>
          </Box>
          {detail?.self && (
            <Typography sx={{ fontSize: 12, color: CM.textDim }}>You can&apos;t deactivate your own account</Typography>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={detail ? () => setError("") : undefined}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box sx={{ display: "grid", gap: 2 }}>
          <Skeleton variant="rounded" height={230} />
          <Skeleton variant="rounded" height={320} />
        </Box>
      )}

      {detail && (
        <Box sx={{ display: "grid", gap: 3 }}>
          <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.6fr) minmax(0, 1fr)" }, alignItems: "start" }}>
            <ProfileCard d={detail} />
            <StatsCard d={detail} />
          </Box>
          {role === "MEMBER" && <WorkoutHistory userId={detail.id} levelOptions={detail.member?.levelOptions} />}
          {role === "CONTENT_MANAGER" && <ContentHistory userId={detail.id} />}
          {role === "ADMIN" && <AdminActions userId={detail.id} />}
          <SystemLogs userId={detail.id} role={role} />
        </Box>
      )}

      <DeactivateDialog
        user={confirmOpen ? detail : null}
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => changeStatus(false)}
      />
      <Snackbar open={Boolean(toast)} autoHideDuration={4000} onClose={() => setToast("")} message={toast} />
    </Box>
  );
}
