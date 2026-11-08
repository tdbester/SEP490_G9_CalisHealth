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
import { useTranslation } from "react-i18next";
import { adminUsersApi, apiErrorMessage } from "../api/adminUsers";
import { useSystemLevels } from "../useSystemLevels";
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

const ROLE_LABEL = { MEMBER: "admin.userDetail.roleMember", CONTENT_MANAGER: "admin.userDetail.roleContentManager", ADMIN: "admin.userDetail.roleAdmin" };
const ROLE_TONE = { MEMBER: TONES.violet, CONTENT_MANAGER: TONES.amber, ADMIN: TONES.pink };
const SUBTITLE = {
  MEMBER: "admin.userDetail.subtitleMember",
  CONTENT_MANAGER: "admin.userDetail.subtitleContentManager",
  ADMIN: "admin.userDetail.subtitleAdmin",
};

// value -> [label, tone] for every status/type chip shown in the tables
const KIND = { WORKOUT: ["admin.userDetail.kindWorkout", TONES.violet], EXERCISE: ["admin.userDetail.kindExercise", TONES.blue] };
const ACTIVITY_STATUS = {
  COMPLETED: ["admin.userDetail.statusCompleted", TONES.green],
  CANCELLED: ["admin.userDetail.statusCancelled", TONES.pink],
  IN_PROGRESS: ["admin.userDetail.statusInProgress", TONES.amber],
};
const LOG_TYPE = {
  SKILL: ["admin.userDetail.logTypeSkill", TONES.green],
  LEVEL_CHANGE: ["admin.userDetail.logTypeLevelChange", TONES.blue],
  ASSESSMENT: ["admin.userDetail.logTypeAssessment", TONES.violet],
  ACCOUNT: ["admin.userDetail.logTypeAccount", TONES.muted],
  LOGIN: ["admin.userDetail.logTypeLogin", TONES.violet],
  MODERATION: ["admin.userDetail.logTypeModeration", TONES.amber],
  NOTIFICATION: ["admin.userDetail.logTypeNotification", TONES.blue],
  MAINTENANCE: ["admin.userDetail.logTypeMaintenance", TONES.amber],
  STORAGE: ["admin.userDetail.logTypeStorage", TONES.green],
};
const LOG_STATUS = {
  SUCCESS: ["admin.userDetail.logStatusSuccess", TONES.green],
  FAILED: ["admin.userDetail.logStatusFailed", TONES.pink],
  WARNING: ["admin.userDetail.logStatusWarning", TONES.amber],
  INFO: ["admin.userDetail.logStatusInfo", TONES.blue],
  SCHEDULED: ["admin.userDetail.logStatusScheduled", TONES.blue],
};
const ADMIN_ACTION = {
  CREATE_ACCOUNT: ["admin.userDetail.adminActionCreateAccount", TONES.violet],
  ACTIVATE: ["admin.userDetail.adminActionActivate", TONES.green],
  DEACTIVATE: ["admin.userDetail.adminActionDeactivate", TONES.pink],
};
const CONTENT_TYPE = { SKILL: ["admin.userDetail.contentTypeSkill", TONES.blue], EXERCISE: ["admin.userDetail.contentTypeExercise", TONES.violet], WORKOUT: ["admin.userDetail.contentTypeWorkout", TONES.amber] };
const CONTENT_ACTION = { UPDATED: "admin.userDetail.contentActionUpdated", DEACTIVATED: "admin.userDetail.contentActionDeactivated" };

// Event types offered per role (the design lists different ones for each screen).
const LOG_FILTERS = {
  MEMBER: ["SKILL", "LEVEL_CHANGE", "ASSESSMENT", "ACCOUNT"],
  CONTENT_MANAGER: ["LOGIN", "MODERATION", "ACCOUNT"],
  ADMIN: ["NOTIFICATION", "MAINTENANCE", "STORAGE", "LOGIN", "ACCOUNT"],
};

const fmtDate = (iso, locale) =>
  iso ? new Date(iso).toLocaleDateString(locale || "en-US", { month: "short", day: "2-digit", year: "numeric" }) : "-";
const fmtDateTime = (iso, locale) =>
  iso
    ? new Date(iso).toLocaleString(locale || "en-US", {
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

function SelectFilter({ label, value, onChange, options, width = 170, allLabel }) {
  const { t } = useTranslation();
  return (
    <TextField
      select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputProps={{ "aria-label": t("admin.userDetail.filterAria", { label }) }}
      SelectProps={{
        displayEmpty: true,
        renderValue: (v) => `${label}: ${v ? options.find((o) => o.value === v)?.label ?? v : allLabel || t("admin.userDetail.filterAll")}`,
      }}
      sx={{ ...fieldSx, width }}
    >
      <MenuItem value="">{allLabel}</MenuItem>
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

function DateFilter({ value, onChange, label }) {
  const { t } = useTranslation();
  const text = label || t("admin.userDetail.dateLabel");
  return (
    <TextField
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      InputLabelProps={{ shrink: true }}
      label={text}
      inputProps={{ "aria-label": t("admin.userDetail.filterByDate") }}
      sx={dateFieldSx}
    />
  );
}

/** Fetches one page of a table and refetches when filters change. Stale responses are dropped. */
function usePagedTable(fetchPage, deps, loadFailed = "admin.userDetail.tableLoadFailed") {
  const { t } = useTranslation();
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
      .catch((err) => !cancelled && setState((s) => ({ ...s, loading: false, error: apiErrorMessage(err, t(loadFailed)) })));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, depKey]);

  return { ...state, page, setPage };
}

function DataTable({ label, columns, rows, renderRow, table, emptyText, noun, filteredDate, dateLocale }) {
  const { t } = useTranslation();
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
            {filteredDate
              ? `Showing ${from}-${to} of ${total.toLocaleString("en-US")} ${noun} on ${fmtDate(filteredDate, dateLocale)}`
              : `Showing ${from}-${to} of ${total.toLocaleString("en-US")} ${noun}`}
          </Typography>
          <Pagination
            count={data.totalPages}
            page={page + 1}
            onChange={(_, p) => setPage(p - 1)}
            shape="rounded"
            color="primary"
            size="small"
            renderItem={(item) => (
              <PaginationItem {...item} slots={{ previous: () => <span>{t("admin.userDetail.previous")}</span>, next: () => <span>{t("admin.userDetail.next")}</span> }} />
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

const TimeCell = ({ iso, locale }) => <span style={{ whiteSpace: "nowrap" }}>{fmtDateTime(iso, locale)}</span>;

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
  const { t, i18n } = useTranslation();
  const { levels: systemLevels } = useSystemLevels();
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
  const levels = (levelOptions?.length ? levelOptions : systemLevels).map((l) => ({
    value: l,
    label: l,
  }));

  return (
    <Card title={t("admin.userDetail.workoutHistory")}>
      <Toolbar>
        <TextField
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t("admin.userDetail.workoutSearchPlaceholder")}
          inputProps={{ "aria-label": t("admin.userDetail.workoutSearchAria") }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ fontSize: 19, color: CM.textDim }} />
              </InputAdornment>
            ),
          }}
          sx={{ ...fieldSx, flex: "1 1 240px", maxWidth: 320 }}
        />
        <SelectFilter label={t("admin.userDetail.filterType")} value={type} onChange={setType} width={150}
          options={[{ value: "WORKOUT", label: t("admin.userDetail.kindWorkout") }, { value: "EXERCISE", label: t("admin.userDetail.kindExercise") }]} />
        <SelectFilter label={t("admin.userDetail.filterLevel")} value={level} onChange={setLevel} options={levels} width={190} />
        <SelectFilter label={t("admin.userDetail.filterStatus")} value={status} onChange={setStatus} width={170}
          options={[{ value: "COMPLETED", label: t("admin.userDetail.statusCompleted") }, { value: "CANCELLED", label: t("admin.userDetail.statusCancelled") }]} />
        <Box sx={{ flex: 1 }} />
        <DateFilter value={date} onChange={setDate} label={t("admin.userDetail.dateLabel")} />
      </Toolbar>
      <DataTable
        label={t("admin.userDetail.workoutHistory")}
        columns={[t("admin.userDetail.colDate"), t("admin.userDetail.colWorkoutExercise"), t("admin.userDetail.colType"), t("admin.userDetail.colLevel"), t("admin.userDetail.colStatus")]}
        rows={table.data?.items ?? []}
        table={table}
        noun={t("admin.userDetail.nounActivities")}
        filteredDate={date}
        dateLocale={i18n.language}
        emptyText={t("admin.userDetail.emptyWorkout")}
        renderRow={(r) => [
          fmtDate(r.occurredAt, i18n.language),
          <NameWithSub key="n" name={r.name} sub={r.detail} />,
          <Chip key="t" label={t(KIND[r.kind][0])} toneDef={KIND[r.kind][1]} />,
          r.level ?? "-",
          <Chip key="s" label={t(ACTIVITY_STATUS[r.status][0])} toneDef={ACTIVITY_STATUS[r.status][1]} />,
        ]}
      />
    </Card>
  );
}

function ContentHistory({ userId }) {
  const { t, i18n } = useTranslation();
  const [type, setType] = useState("");
  const [action, setAction] = useState("");
  const table = usePagedTable(
    (page) => adminUsersApi.contentActivity(userId, { type, action, page, size: PAGE_SIZE }),
    [userId, type, action],
  );
  return (
    <Card title={t("admin.userDetail.contentActivity")}>
      <Toolbar>
        <SelectFilter label={t("admin.userDetail.filterType")} value={type} onChange={setType} width={160}
          options={Object.entries(CONTENT_TYPE).map(([value, [label]]) => ({ value, label: t(label) }))} />
        <SelectFilter label={t("admin.userDetail.filterAction")} value={action} onChange={setAction} width={180}
          options={Object.entries(CONTENT_ACTION).map(([value, label]) => ({ value, label: t(label) }))} />
      </Toolbar>
      <DataTable
        label={t("admin.userDetail.contentActivity")}
        columns={[t("admin.userDetail.colDateTime"), t("admin.userDetail.colItem"), t("admin.userDetail.colType"), t("admin.userDetail.colAction"), t("admin.userDetail.colStatus")]}
        rows={table.data?.items ?? []}
        table={table}
        noun={t("admin.userDetail.nounContentItems")}
        dateLocale={i18n.language}
        emptyText={t("admin.userDetail.emptyContent")}
        renderRow={(r) => [
          <TimeCell key="d" iso={r.occurredAt} locale={i18n.language} />,
          <NameWithSub key="n" name={r.name} sub={r.code} />,
          <Chip key="t" label={t(CONTENT_TYPE[r.itemType][0])} toneDef={CONTENT_TYPE[r.itemType][1]} />,
          t(CONTENT_ACTION[r.action]),
          <Chip key="s" label={r.status} toneDef={r.status === "Active" ? TONES.green : TONES.muted} />,
        ]}
      />
    </Card>
  );
}

function AdminActions({ userId }) {
  const { t, i18n } = useTranslation();
  const [action, setAction] = useState("");
  const [date, setDate] = useState("");
  const table = usePagedTable(
    (page) => adminUsersApi.adminActions(userId, { action, date, page, size: PAGE_SIZE }),
    [userId, action, date],
  );
  return (
    <Card title={t("admin.userDetail.adminActions")}>
      <Toolbar>
        <SelectFilter label={t("admin.userDetail.filterAction")} value={action} onChange={setAction} width={210}
          options={Object.entries(ADMIN_ACTION).map(([value, [label]]) => ({ value, label: t(label) }))} />
        <Box sx={{ flex: 1 }} />
        <DateFilter value={date} onChange={setDate} label={t("admin.userDetail.dateLabel")} />
      </Toolbar>
      <DataTable
        label={t("admin.userDetail.adminActions")}
        columns={[t("admin.userDetail.colDateTime"), t("admin.userDetail.colAction"), t("admin.userDetail.colTarget"), t("admin.userDetail.colStatus")]}
        rows={table.data?.items ?? []}
        table={table}
        noun={t("admin.userDetail.nounAdminActions")}
        filteredDate={date}
        dateLocale={i18n.language}
        emptyText={t("admin.userDetail.emptyAdminActions")}
        renderRow={(r) => [
          <TimeCell key="d" iso={r.occurredAt} locale={i18n.language} />,
          <Chip key="a" label={t(ADMIN_ACTION[r.action][0])} toneDef={ADMIN_ACTION[r.action][1]} />,
          <NameWithSub key="t" name={r.targetName} sub={`${r.targetCode} \u00b7 ${ROLE_LABEL[r.targetRole] ? t(ROLE_LABEL[r.targetRole]) : r.targetRole}`} />,
          <Chip key="s" label={LOG_STATUS[r.status] ? t(LOG_STATUS[r.status][0]) : r.status} toneDef={LOG_STATUS[r.status]?.[1]} />,
        ]}
      />
    </Card>
  );
}

function SystemLogs({ userId, role }) {
  const { t, i18n } = useTranslation();
  const [type, setType] = useState("");
  const [date, setDate] = useState("");
  const table = usePagedTable(
    (page) => adminUsersApi.systemLogs(userId, { type, date, page, size: PAGE_SIZE }),
    [userId, type, date],
  );
  return (
    <Card title={t("admin.userDetail.systemLogs")}>
      <Toolbar>
        <SelectFilter label={t("admin.userDetail.filterEventType")} value={type} onChange={setType} width={220}
          options={(LOG_FILTERS[role] ?? []).map((value) => ({ value, label: t(LOG_TYPE[value][0]) }))} />
        <Box sx={{ flex: 1 }} />
        <DateFilter value={date} onChange={setDate} label={t("admin.userDetail.dateLabel")} />
      </Toolbar>
      <DataTable
        label={t("admin.userDetail.systemLogs")}
        columns={[t("admin.userDetail.colDateTime"), t("admin.userDetail.colEventType"), t("admin.userDetail.colDescription"), t("admin.userDetail.colStatus")]}
        rows={table.data?.items ?? []}
        table={table}
        noun={t("admin.userDetail.nounSystemEvents")}
        filteredDate={date}
        dateLocale={i18n.language}
        emptyText={t("admin.userDetail.emptySystemEvents")}
        renderRow={(r) => [
          <TimeCell key="d" iso={r.occurredAt} locale={i18n.language} />,
          <Chip key="e" label={LOG_TYPE[r.eventType] ? t(LOG_TYPE[r.eventType][0]) : r.eventType} toneDef={LOG_TYPE[r.eventType]?.[1]} />,
          r.description,
          <Chip key="s" label={LOG_STATUS[r.status] ? t(LOG_STATUS[r.status][0]) : r.status} toneDef={LOG_STATUS[r.status]?.[1]} />,
        ]}
      />
    </Card>
  );
}

function ProfileCard({ d }) {
  const { t, i18n } = useTranslation();
  const m = d.member;
  const staff = d.role !== "MEMBER";
  const status = d.active
    ? <Chip label={t("admin.users.active")} toneDef={TONES.green} />
    : <Chip label={t("admin.users.inactive")} toneDef={TONES.muted} />;
  const role = <Chip label={ROLE_LABEL[d.role] ? t(ROLE_LABEL[d.role]) : d.role} toneDef={ROLE_TONE[d.role]} />;
  const password = d.passwordState === "DEFAULT"
    ? <Chip label={t("admin.userDetail.defaultPassword")} toneDef={TONES.amber} />
    : <Chip label={t("admin.userDetail.changedPassword")} toneDef={TONES.green} />;

  return (
    <Card title={t("admin.userDetail.profileTitle")}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, columnGap: 3 }}>
        <Box>
          <Field label={t("admin.userDetail.fullName")}>{d.fullName}</Field>
          <Field label={t("admin.userDetail.userId")}>{d.userCode}</Field>
          <Field label={t("admin.userDetail.email")}>{d.email}</Field>
          {!staff && <Field label={t("admin.userDetail.age")}>{m?.age ?? "-"}</Field>}
          {!staff && <Field label={t("admin.userDetail.gender")}>{m?.gender ?? "-"}</Field>}
          {!staff && <Field label={t("admin.userDetail.goal")}>{m?.goal ?? "-"}</Field>}
          {staff && <Field label={t("admin.userDetail.role")}>{role}</Field>}
        </Box>
        <Box>
          {!staff && <Field label={t("admin.userDetail.height")}>{m?.heightCm != null ? `${Number(m.heightCm)} cm` : "-"}</Field>}
          {!staff && <Field label={t("admin.userDetail.weight")}>{m?.weightKg != null ? `${Number(m.weightKg)} kg` : "-"}</Field>}
          <Field label={t("admin.userDetail.accountStatus")}>{status}</Field>
          {staff ? <Field label={t("admin.userDetail.password")}>{password}</Field> : <Field label={t("admin.userDetail.role")}>{role}</Field>}
          <Field label={t("admin.userDetail.joinedDate")}>{fmtDate(d.createdAt, i18n.language)}</Field>
          <Field label={t("admin.userDetail.lastActive")}>{d.lastActiveAt ? fmtDateTime(d.lastActiveAt, i18n.language) : t("admin.userDetail.never")}</Field>
        </Box>
      </Box>
      {d.role === "ADMIN" && d.passwordState === "DEFAULT" && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <strong>{t("admin.userDetail.defaultPasswordWarning")}</strong>
        </Alert>
      )}
    </Card>
  );
}

function StatsCard({ d }) {
  const { t } = useTranslation();
  if (d.member) {
    const m = d.member;
    return (
      <Card title={t("admin.userDetail.progressStats")}>
        <StatGrid>
          <Stat label={t("admin.userDetail.currentLevel")} value={m.levelRank ? t("admin.userDetail.levelLabel", { rank: m.levelRank }) : "-"} hint={m.levelName ?? t("admin.userDetail.notAssessed")} />
          <Stat label={t("admin.userDetail.totalWorkouts")} value={m.totalWorkouts.toLocaleString("en-US")} hint={t("admin.userDetail.completedSessions")} />
          <Stat label={t("admin.userDetail.workoutStreak")} value={t("admin.userDetail.day", { count: m.streakDays })} hint={t("admin.userDetail.personalBest", { count: m.longestStreak })} />
        </StatGrid>
      </Card>
    );
  }
  if (d.content) {
    const c = d.content;
    return (
      <Card title={t("admin.userDetail.contentStats")}>
        <StatGrid>
          <Stat label={t("admin.userDetail.exercises")} value={c.exercises} hint={t("admin.userDetail.created")} />
          <Stat label={t("admin.userDetail.skills")} value={c.skills} hint={t("admin.userDetail.created")} />
          <Stat label={t("admin.userDetail.workouts")} value={c.workouts} hint={t("admin.userDetail.created")} />
          <Stat label={t("admin.userDetail.reviewed")} value={c.reviewed ?? "-"} hint={c.reviewed == null ? t("admin.userDetail.notTracked") : t("admin.userDetail.memberSubmissions")} />
        </StatGrid>
      </Card>
    );
  }
  const a = d.admin;
  return (
    <Card title={t("admin.userDetail.adminActivity")}>
      <StatGrid>
        <Stat label={t("admin.userDetail.accountsCreated")} value={a.accountsCreated} hint={t("admin.userDetail.adminAndCM")} />
        <Stat label={t("admin.userDetail.usersDeactivated")} value={a.usersDeactivated} hint={t("admin.userDetail.allTime")} />
        <Stat label={t("admin.userDetail.usersActivated")} value={a.usersActivated} hint={t("admin.userDetail.allTime")} />
        <Stat label={t("admin.userDetail.notificationsSent")} value={a.notificationsSent} hint={t("admin.userDetail.systemNotifications")} />
        <Stat label={t("admin.userDetail.maintenance")} value={a.maintenanceSchedules} hint={t("admin.userDetail.schedulesCreated")} />
        <Stat label={t("admin.userDetail.storageActions")} value={a.storageActions} hint={t("admin.userDetail.cleanups")} />
      </StatGrid>
    </Card>
  );
}

function DeactivateDialog({ user, busy, onCancel, onConfirm }) {
  const { t } = useTranslation();
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
                  {t("admin.userDetail.deactivateTitle")}
                </Typography>
                <Typography sx={{ fontSize: 13, color: CM.textMuted }}>{t("admin.userDetail.deactivateHint")}</Typography>
              </Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1.5, mb: 2, borderRadius: "12px", bgcolor: CM.surfaceSoft, border: `1px solid ${CM.border}` }}>
              <Box aria-hidden sx={{ width: 36, height: 36, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: "50%", fontSize: 12.5, fontWeight: 700, background: CM.gradientSoft, color: CM.violetBright }}>
                {initials(user.fullName)}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600 }} noWrap>{user.fullName}</Typography>
                <Typography sx={{ fontSize: 12, color: CM.textMuted }}>
                  {user.userCode} {"\u00b7"} {ROLE_LABEL[user.role] ? t(ROLE_LABEL[user.role]) : user.role}
                </Typography>
              </Box>
            </Box>
            <Typography id="deactivate-desc" sx={{ fontSize: 13, lineHeight: 1.7, color: CM.textMuted }}>
              {t("admin.userDetail.deactivateMessage")}
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button color="inherit" onClick={onCancel} disabled={busy} sx={{ borderRadius: "10px" }}>
              {t("admin.userDetail.cancel")}
            </Button>
            <Button
              variant="contained"
              onClick={onConfirm}
              disabled={busy}
              sx={{ borderRadius: "10px", bgcolor: CM.pink, color: "#2A0A14", "&:hover": { bgcolor: "#FF5C85" } }}
            >
              {busy ? t("admin.userDetail.deactivating") : t("admin.userDetail.deactivateConfirm")}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}

/** Admin user detail & activity log (design: user-detail-member / content-manager / admin / deactivate-warning). */
export default function AdminUserDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    document.title = `${t("admin.userDetail.pageTitle")} | CalisHealth`;
  }, [t]);

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
        setError(err?.response?.status === 404 ? t("admin.userDetail.notFound") : apiErrorMessage(err, t("admin.userDetail.loadFailed"))),
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
      setToast(t(active ? "admin.userDetail.activated" : "admin.userDetail.deactivated", { name: detail.fullName }));
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
      <Typography sx={{ fontSize: 13, color: CM.textMuted }}>{t("admin.userDetail.breadcrumb")}</Typography>

      <Box sx={{ mt: 1, mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
        <Box sx={{ maxWidth: 640 }}>
          <Typography component="h1" sx={{ fontSize: 30, fontWeight: 700, lineHeight: 1.2 }}>
            {t("admin.userDetail.pageTitle")}
          </Typography>
          <Typography sx={{ mt: 0.75, fontSize: 14, color: CM.textMuted }}>
            {SUBTITLE[role] ? t(SUBTITLE[role]) : t("admin.userDetail.subtitleFallback")}
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
                  {t("admin.userDetail.deactivate")}
                </Button>
              ) : (
                <Button variant="outlined" color="success" disabled={busy} onClick={() => changeStatus(true)} sx={{ borderRadius: "10px" }}>
                  {t("admin.userDetail.activate")}
                </Button>
              ))}
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<ArrowBackRoundedIcon />}
              onClick={() => navigate("/admin/users")}
              sx={{ borderRadius: "10px", borderColor: CM.borderStrong }}
            >
              {t("admin.userDetail.backToList")}
            </Button>
          </Box>
          {detail?.self && (
            <Typography sx={{ fontSize: 12, color: CM.textDim }}>{t("admin.userDetail.selfNote")}</Typography>
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
