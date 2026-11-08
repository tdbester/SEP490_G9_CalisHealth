import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Link,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import FaceOutlinedIcon from "@mui/icons-material/FaceOutlined";
import LibraryBooksOutlinedIcon from "@mui/icons-material/LibraryBooksOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import AutoDeleteOutlinedIcon from "@mui/icons-material/AutoDeleteOutlined";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CloudDoneOutlinedIcon from "@mui/icons-material/CloudDoneOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import SpeedRoundedIcon from "@mui/icons-material/SpeedRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { adminStorageApi } from "../../api/adminStorage";
import { apiErrorMessage } from "../../api/adminUsers";
import { useApiQuery } from "../../hooks";
import { CM } from "../../theme-content";
import { formatBytes, IconBox, Panel, Pill, STORAGE_PATHS, StatTile, TONE } from "./StorageShared";

const CATEGORY = {
  DEMO_VIDEO: { label: "Exercise demo videos", sub: "System & personal exercises · kept permanently", tone: "violet", color: CM.violet, icon: VideocamOutlinedIcon },
  ANATOMY_IMAGE: { label: "Anatomy images", sub: "Exercise anatomy images · JPG/PNG/WEBP", tone: "pink", color: CM.pink, icon: ImageOutlinedIcon },
  PROFILE_AVATAR: { label: "Profile photos", sub: "Avatars of members, content managers and admins", tone: "cyan", color: "#22D3EE", icon: FaceOutlinedIcon },
};
const SOURCE = {
  SYSTEM: { label: "System library", sub: "Exercise & skill library managed by Content Managers", tone: "cyan", color: "#22D3EE", icon: LibraryBooksOutlinedIcon },
  MEMBER: { label: "Member uploads", sub: "Personal exercises & profile photos", tone: "violet", color: "#A855F7", icon: PersonOutlineOutlinedIcon },
};

const pct = (part, whole) => (whole > 0 ? (part / whole) * 100 : 0);

function usageStatus(percent, warning, critical) {
  if (percent >= critical) return { label: "Critical", tone: "pink" };
  if (percent >= warning) return { label: "Warning", tone: "amber" };
  return { label: "Healthy", tone: "green" };
}

/** Usage bar with the warning / critical thresholds marked on it. */
function UsageBar({ percent, warning, critical }) {
  const markers = [
    { at: warning, label: `${warning}% · warning`, color: CM.amber },
    { at: critical, label: `${critical}% · critical`, color: CM.pink },
  ];
  return (
    <Box sx={{ position: "relative", pt: 2.75 }}>
      {markers.map((m) => (
        <Typography
          key={m.label}
          sx={{ position: "absolute", top: 0, left: `${m.at}%`, transform: "translateX(-50%)", fontSize: 11, fontWeight: 600, color: m.color, whiteSpace: "nowrap" }}
        >
          {m.label}
        </Typography>
      ))}
      <Box
        role="progressbar"
        aria-label="Storage used"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        sx={{ position: "relative", height: 12, borderRadius: 999, bgcolor: "rgba(139,92,246,0.16)" }}
      >
        <Box sx={{ width: `${Math.min(percent, 100)}%`, height: "100%", borderRadius: 999, backgroundImage: CM.buttonGradient }} />
        {markers.map((m) => (
          <Box key={m.at} sx={{ position: "absolute", top: -4, left: `${m.at}%`, width: 2, height: 20, bgcolor: m.color }} />
        ))}
      </Box>
    </Box>
  );
}

/** Stacked bar + legend rows, used for "by category" and "by source". */
function Breakdown({ title, rows, total }) {
  return (
    <Panel title={title} sx={{ flex: "1 1 420px" }}>
      <Box sx={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", mb: 2 }}>
        {rows.map((r) => (
          <Box key={r.key} title={r.label} sx={{ width: `${pct(r.bytes, total)}%`, bgcolor: r.color }} />
        ))}
      </Box>
      <Box sx={{ display: "grid", gap: 1.5 }}>
        {rows.map((r) => (
          <Box key={r.key} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <IconBox icon={r.icon} tone={r.tone} size={34} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{r.label}</Typography>
                {r.tag && <Pill tone={r.tone}>{r.tag}</Pill>}
              </Box>
              <Typography sx={{ fontSize: 12, color: CM.textDim }}>{r.sub}</Typography>
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{formatBytes(r.bytes)}</Typography>
              <Typography sx={{ fontSize: 12, color: CM.textDim }}>{Math.round(pct(r.bytes, total))}%</Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Panel>
  );
}

// Wide viewBox so the SVG text stays close to its real font size on desktop widths.
const VB_W = 1100;
const VB_H = 260;
const PLOT = { left: 56, right: 1080, top: 20, bottom: 228 };
const gbLabel = (bytes) => `${(bytes / 1024 ** 3).toFixed(1)} GB`;

/** Monthly used storage with the quota and warning level drawn as dashed lines. */
function GrowthChart({ history, quotaBytes, warningPercent }) {
  if (!history.length) return <Typography sx={{ color: CM.textMuted, fontSize: 13 }}>No history yet.</Typography>;
  const xAt = (i) => (history.length === 1 ? (PLOT.left + PLOT.right) / 2 : PLOT.left + ((PLOT.right - PLOT.left) * i) / (history.length - 1));
  const yAt = (bytes) => (PLOT.bottom - (bytes / quotaBytes) * (PLOT.bottom - PLOT.top));
  const pts = history.map((h, i) => ({ x: xAt(i), y: yAt(h.usedBytes), ...h }));
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ");
  const area = `${line} L${pts[pts.length - 1].x} ${PLOT.bottom} L${pts[0].x} ${PLOT.bottom} Z`;
  const ticks = Array.from({ length: 6 }, (_, i) => (quotaBytes * i) / 5);
  const warningY = yAt((quotaBytes * warningPercent) / 100);
  const monthLabel = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-US", { month: "short" });
  const last = pts[pts.length - 1];

  return (
    <Box
      component="svg"
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      role="img"
      aria-label={`Storage used per month, now ${formatBytes(last.usedBytes)} of ${formatBytes(quotaBytes)}`}
      sx={{ width: "100%", height: "auto", display: "block" }}
    >
      <defs>
        <linearGradient id="storage-growth-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CM.violet} stopOpacity="0.35" />
          <stop offset="1" stopColor={CM.violet} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PLOT.left} x2={PLOT.right} y1={yAt(t)} y2={yAt(t)} stroke={CM.border} />
          <text x={PLOT.left - 10} y={yAt(t) + 4} textAnchor="end" fontSize="11" fill={CM.textDim}>
            {gbLabel(t)}
          </text>
        </g>
      ))}
      <line x1={PLOT.left} x2={PLOT.right} y1={PLOT.top} y2={PLOT.top} stroke={CM.pink} strokeDasharray="6 6" strokeWidth="1.5" />
      <text x={PLOT.right} y={PLOT.top - 5} textAnchor="end" fontSize="11" fontWeight="600" fill={CM.pink}>
        Quota {formatBytes(quotaBytes)}
      </text>
      <line x1={PLOT.left} x2={PLOT.right} y1={warningY} y2={warningY} stroke={CM.amber} strokeDasharray="6 6" strokeWidth="1.5" />
      <text x={PLOT.right} y={warningY - 5} textAnchor="end" fontSize="11" fontWeight="600" fill={CM.amber}>
        Warning {warningPercent}%
      </text>
      <path d={area} fill="url(#storage-growth-fill)" />
      <path d={line} fill="none" stroke="#A855F7" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p) => (
        <g key={p.month}>
          <circle cx={p.x} cy={p.y} r={p === last ? 6 : 4} fill={p === last ? "#fff" : "#A855F7"} stroke="#A855F7" strokeWidth={p === last ? 3 : 0}>
            <title>{`${monthLabel(p.month)}: ${formatBytes(p.usedBytes)}`}</title>
          </circle>
          <text x={p.x} y={VB_H - 8} textAnchor="middle" fontSize="12" fill={CM.textMuted}>
            {monthLabel(p.month)}
          </text>
        </g>
      ))}
      <text x={last.x - 10} y={last.y - 14} textAnchor="end" fontSize="13" fontWeight="700" fill="#fff">
        {formatBytes(last.usedBytes)}
      </text>
    </Box>
  );
}

/**
 * The last 30 days of the real usage of the provider. The storage line is the space used, the
 * bandwidth line is what the CDN delivered: both cost money on the Cloudinary plan.
 */
function DailyChart({ daily, quotaBytes, quotaLimited }) {
  if (!daily?.length) return <Typography sx={{ color: CM.textMuted, fontSize: 13 }}>No history yet.</Typography>;
  // The plan limit only enters the scale when the plan really caps the storage, otherwise the
  // line would flatten the curve against a number the provider does not use.
  const limit = quotaLimited ? quotaBytes : 0;
  const maxBytes = Math.max(
    limit,
    ...daily.map((d) => d.usedBytes),
    ...daily.map((d) => d.bandwidthBytes),
    1,
  );
  const xAt = (i) => (daily.length === 1 ? (PLOT.left + PLOT.right) / 2 : PLOT.left + ((PLOT.right - PLOT.left) * i) / (daily.length - 1));
  const yAt = (bytes) => PLOT.bottom - (bytes / maxBytes) * (PLOT.bottom - PLOT.top);
  const path = (key) => daily.map((d, i) => `${i ? "L" : "M"}${xAt(i)} ${yAt(d[key])}`).join(" ");
  const last = daily[daily.length - 1];
  const dayLabel = (day) => new Date(`${day}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  // The account can hold files that this app did not upload (the sample files of the provider, for
  // example). The second line shows how much of the account is really used by this app.
  const hasAppSeries = daily.some((d) => (d.appBytes ?? 0) > 0) && daily.some((d) => d.appBytes < d.usedBytes);

  return (
    <Box
      component="svg"
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      role="img"
      aria-label={`Storage and bandwidth of the last ${daily.length} days`}
      sx={{ width: "100%", height: "auto", display: "block" }}
    >
      {Array.from({ length: 6 }, (_, i) => (maxBytes * i) / 5).map((t) => (
        <g key={t}>
          <line x1={PLOT.left} x2={PLOT.right} y1={yAt(t)} y2={yAt(t)} stroke={CM.border} />
          <text x={PLOT.left - 10} y={yAt(t) + 4} textAnchor="end" fontSize="11" fill={CM.textDim}>
            {gbLabel(t)}
          </text>
        </g>
      ))}
      {limit > 0 && (
        <>
          <line x1={PLOT.left} x2={PLOT.right} y1={yAt(limit)} y2={yAt(limit)} stroke={CM.pink} strokeDasharray="6 6" strokeWidth="1.5" />
          <text x={PLOT.right} y={yAt(limit) - 5} textAnchor="end" fontSize="11" fontWeight="600" fill={CM.pink}>
            Plan limit {formatBytes(limit)}
          </text>
        </>
      )}
      <path d={path("bandwidthBytes")} fill="none" stroke="#22D3EE" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />
      {hasAppSeries && (
        <path d={path("appBytes")} fill="none" stroke="#F59E0B" strokeWidth="2" strokeDasharray="2 3" strokeLinecap="round" />
      )}
      <path d={path("usedBytes")} fill="none" stroke="#A855F7" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {daily.map((d, i) => (
        <g key={d.day}>
          <circle cx={xAt(i)} cy={yAt(d.usedBytes)} r={i === daily.length - 1 ? 6 : 3.5} fill={i === daily.length - 1 ? "#fff" : "#A855F7"} stroke="#A855F7" strokeWidth={i === daily.length - 1 ? 3 : 0}>
            <title>{`${dayLabel(d.day)}: ${formatBytes(d.usedBytes)} in the account${hasAppSeries ? ` · ${formatBytes(d.appBytes)} from this app` : ""}`}</title>
          </circle>
        </g>
      ))}
      {daily.map((d, i) =>
        i % Math.ceil(daily.length / 8) === 0 || i === daily.length - 1 ? (
          <text key={`label-${d.day}`} x={xAt(i)} y={VB_H - 8} textAnchor="middle" fontSize="11" fill={CM.textMuted}>
            {dayLabel(d.day)}
          </text>
        ) : null,
      )}
      <text x={PLOT.left + 8} y={PLOT.top + 14} fontSize="12" fontWeight="700" fill="#A855F7">
        Account
      </text>
      <text x={PLOT.left + 70} y={PLOT.top + 14} fontSize="12" fontWeight="700" fill="#22D3EE">
        Bandwidth
      </text>
      {hasAppSeries && (
        <text x={PLOT.left + 155} y={PLOT.top + 14} fontSize="12" fontWeight="700" fill="#F59E0B">
          This app
        </text>
      )}
      <text x={last.x - 10} y={yAt(last.usedBytes) - 14} textAnchor="end" fontSize="13" fontWeight="700" fill="#fff">
        {formatBytes(last.usedBytes)}
      </text>
    </Box>
  );
}

/** Where the media really lives: the CDN account and its plan. */
function ProviderPanel({ data }) {
  const cloud = data.provider === "CLOUDINARY";
  return (
    <Panel
      title="Where the media is stored"
      action={
        <Pill tone={cloud ? (data.cdnReachable ? "green" : "amber") : "muted"}>
          {cloud ? (data.cdnReachable ? "● CDN connected" : "● CDN unreachable") : "● Local disk"}
        </Pill>
      }
    >
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
        <IconBox icon={cloud ? CloudDoneOutlinedIcon : CloudOffOutlinedIcon} tone={cloud ? "cyan" : "muted"} size={44} />
        <Box sx={{ flex: 1, minWidth: 260 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700 }}>
            {cloud ? `Cloudinary${data.plan ? ` · ${data.plan} plan` : ""}` : "Local disk"}
          </Typography>
          <Typography sx={{ mt: 0.25, fontSize: 13, color: CM.textMuted }}>
            {cloud
              ? "Videos and images are served from the CDN. The numbers below come from the provider, not from the database."
              : "No Cloudinary account is configured, so the uploads are written to the server disk."}
          </Typography>
        </Box>
        <StatTile
          label="Files managed by the app"
          value={data.fileCount.toLocaleString("en-US")}
          caption={`${data.videoCount.toLocaleString("en-US")} videos · ${data.imageCount.toLocaleString("en-US")} images`}
        />
      </Box>
      {cloud && data.registryBytes < data.usedBytes && (
        <Alert severity="info" sx={{ mt: 2 }}>
          The account holds {formatBytes(data.usedBytes)}, but only {formatBytes(data.registryBytes)} come from this
          app. The rest was uploaded through other tools (the sample files of the provider, for example) and also
          counts against the plan.
        </Alert>
      )}
      <Box sx={{ mt: 2.5, display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" } }}>
        <Box sx={{ p: 1.75, borderRadius: "10px", bgcolor: CM.surfaceSoft, border: `1px solid ${CM.border}` }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
            <StorageRoundedIcon sx={{ fontSize: 17, color: CM.violet }} />
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: CM.textMuted }}>STORAGE USED</Typography>
          </Box>
          <Typography sx={{ fontSize: 20, fontWeight: 700 }}>{formatBytes(data.usedBytes)}</Typography>
          <Typography sx={{ fontSize: 12, color: CM.textDim }}>
            {data.provider === "CLOUDINARY"
              ? `in the account · ${formatBytes(data.registryBytes)} from this app`
              : "stored on the server disk"}
          </Typography>
        </Box>
        <Box sx={{ p: 1.75, borderRadius: "10px", bgcolor: CM.surfaceSoft, border: `1px solid ${CM.border}` }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
            <SpeedRoundedIcon sx={{ fontSize: 17, color: "#22D3EE" }} />
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: CM.textMuted }}>BANDWIDTH DELIVERED</Typography>
          </Box>
          <Typography sx={{ fontSize: 20, fontWeight: 700 }}>
            {data.provider === "CLOUDINARY" ? formatBytes(data.bandwidthUsedBytes) : "-"}
          </Typography>
          <Typography sx={{ fontSize: 12, color: CM.textDim }}>
            {data.bandwidthLimitBytes > 0
              ? `of ${formatBytes(data.bandwidthLimitBytes)} this period`
              : "delivered through the CDN this period"}
          </Typography>
        </Box>
        <Box sx={{ p: 1.75, borderRadius: "10px", bgcolor: CM.surfaceSoft, border: `1px solid ${CM.border}` }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
            <CloudDoneOutlinedIcon sx={{ fontSize: 17, color: CM.amber }} />
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: CM.textMuted }}>CREDITS LEFT</Typography>
          </Box>
          <Typography sx={{ fontSize: 20, fontWeight: 700 }}>
            {data.creditsLimit > 0
              ? (data.creditsLimit - (data.creditsUsed ?? 0)).toFixed(2)
              : data.provider === "CLOUDINARY"
                ? "-"
                : "n/a"}
          </Typography>
          <Typography sx={{ fontSize: 12, color: CM.textDim }}>
            {data.creditsLimit > 0
              ? `of ${data.creditsLimit.toFixed(2)} credits this period (${data.creditsUsedPercent.toFixed(1)}% used)`
              : "the plan does not meter credits"}
          </Typography>
        </Box>
      </Box>
      {data.provider === "CLOUDINARY" && !data.quotaLimited && (
        <Alert severity="info" sx={{ mt: 2 }}>
          The {data.plan} plan does not cap the storage in bytes: it counts credits instead. The limit on this screen is
          the one of the admin settings, the real usage is the one of the account.
        </Alert>
      )}
      {data.provider === "CLOUDINARY" && data.registryBytes !== data.usedBytes && (
        <Alert severity="info" sx={{ mt: 2 }}>
          The app manages {formatBytes(data.registryBytes)} of files, the account uses {formatBytes(data.usedBytes)}. The
          two numbers differ when media was uploaded straight to Cloudinary, outside the app, or when a file is still in
          the trash.
        </Alert>
      )}
    </Panel>
  );
}

const headCellSx = { color: CM.textDim, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", whiteSpace: "nowrap" };

/** Tab 1: read-only overview of storage usage (Figma "Admin / Storage capacity"). */
export default function StorageCapacityTab() {
  const { data, isLoading, error, refetch } = useApiQuery(() => adminStorageApi.overview());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    document.title = "Storage capacity | CalisHealth";
  }, []);

  // Asks the provider for fresh numbers and stores the snapshot of the day.
  const refreshUsage = async () => {
    setRefreshing(true);
    try {
      await adminStorageApi.refreshUsage();
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (error) return <Alert severity="error">{apiErrorMessage(error, "Could not load storage usage.")}</Alert>;
  if (isLoading || !data) return <Skeleton variant="rounded" height={420} />;

  const usedPercent = pct(data.usedBytes, data.quotaBytes);
  // The plan that counts credits instead of bytes shows how much of the credits is used.
  const creditPercent = data.creditsUsedPercent ?? 0;
  const status = usageStatus(data.quotaLimited ? usedPercent : creditPercent, data.warningPercent, data.criticalPercent);
  const cleanup = data.autoCleanup;
  const reclaimableBytes = cleanup.inactiveBytes + cleanup.trashBytes;
  const categoryRows = data.byCategory.map((c) => ({ ...c, ...CATEGORY[c.key] })).filter((c) => c.label);
  const sourceRows = data.bySource.map((s) => ({ ...s, ...SOURCE[s.key] })).filter((s) => s.label);

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, flexWrap: "wrap", mt: -1 }}>
        <Button variant="outlined" onClick={refreshUsage} disabled={refreshing} startIcon={<RefreshRoundedIcon />}>
          {refreshing ? "Refreshing..." : "Refresh from provider"}
        </Button>
        <Button variant="outlined" component={RouterLink} to={STORAGE_PATHS.cleanup}>
          Clean up media
        </Button>
        <Button variant="contained" component={RouterLink} to={STORAGE_PATHS.settings}>
          Edit quota & limits
        </Button>
      </Box>

      <ProviderPanel data={data} />

      <Panel title="Capacity" action={<Pill tone={status.tone}>● {status.label}</Pill>}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 1.5 }}>
          <Typography sx={{ fontSize: 28, fontWeight: 700 }}>{formatBytes(data.usedBytes)}</Typography>
          <Typography sx={{ fontSize: 14, color: CM.textMuted }}>
            {data.quotaLimited
              ? `of ${formatBytes(data.quotaBytes)} quota used · ${Math.round(usedPercent)}%`
              : `stored · ${creditPercent.toFixed(1)}% of the plan credits used`}
          </Typography>
        </Box>
        <UsageBar
          percent={data.quotaLimited ? usedPercent : creditPercent}
          warning={data.warningPercent}
          critical={data.criticalPercent}
        />
        {(data.quotaLimited ? usedPercent : creditPercent) >= data.criticalPercent && reclaimableBytes > 0 && (
          <Alert
            severity="error"
            sx={{ mt: 2.5, alignItems: "center" }}
            action={
              <Box sx={{ display: "flex", gap: 1 }}>
                {cleanup.inactiveFiles > 0 && (
                  <Button size="small" variant="contained" color="error" component={RouterLink} to={STORAGE_PATHS.cleanup} sx={{ backgroundImage: "none" }}>
                    Clean up now
                  </Button>
                )}
                {cleanup.trashFiles > 0 && (
                  <Button size="small" variant="outlined" color="error" component={RouterLink} to={`${STORAGE_PATHS.cleanup}?view=trash`}>
                    Open trash
                  </Button>
                )}
              </Box>
            }
          >
            {formatBytes(reclaimableBytes)} can be freed:{" "}
            {[
              cleanup.inactiveFiles > 0 && `${formatBytes(cleanup.inactiveBytes)} in ${cleanup.inactiveFiles} orphaned / rejected file(s)`,
              cleanup.trashFiles > 0 && `${formatBytes(cleanup.trashBytes)} in the trash`,
            ]
              .filter(Boolean)
              .join(" · ")}
            . Storage is freed only when files are deleted permanently.
          </Alert>
        )}
        <Box sx={{ mt: 2.5, display: "flex", gap: 2, flexWrap: "wrap" }}>
          <StatTile
            label={data.quotaLimited ? "Remaining" : "Credits left"}
            value={
              data.quotaLimited
                ? formatBytes(Math.max(data.quotaBytes - data.usedBytes, 0))
                : `${Math.max(0, (data.creditsLimit ?? 0) - (data.creditsUsed ?? 0)).toFixed(2)}`
            }
            caption={
              data.quotaLimited
                ? `${Math.max(100 - Math.round(usedPercent), 0)}% of quota left`
                : `${Math.max(100 - Math.round(creditPercent), 0)}% of the plan credits left`
            }
          />
          <StatTile label="Files stored" value={data.fileCount.toLocaleString("en-US")} caption={`${data.videoCount.toLocaleString("en-US")} videos · ${data.imageCount.toLocaleString("en-US")} images`} />
          <StatTile label="Growth per month" value={`+${formatBytes(data.growthPerMonthBytes)}`} caption="Net, after auto-cleanup" />
          <StatTile
            label="Estimated full"
            value={
              !data.quotaLimited
                ? "Not capped"
                : data.estimatedFullDate
                  ? new Date(data.estimatedFullDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                  : "Not soon"
            }
            caption={data.quotaLimited ? "At current net growth" : "The plan counts credits, not bytes"}
          />
        </Box>
        <Box
          sx={{
            mt: 2,
            px: 2,
            py: 1.25,
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            flexWrap: "wrap",
            borderRadius: "10px",
            bgcolor: cleanup.enabled ? TONE.green.bg : TONE.amber.bg,
            border: `1px solid ${cleanup.enabled ? "rgba(120,232,136,0.35)" : "rgba(248,200,88,0.35)"}`,
          }}
        >
          <AutoDeleteOutlinedIcon sx={{ fontSize: 18, color: cleanup.enabled ? CM.green : CM.amber }} />
          <Typography sx={{ flex: 1, minWidth: 240, fontSize: 13 }}>
            {cleanup.enabled
              ? `Auto-cleanup runs daily at ${cleanup.runAt} · tonight ~${formatBytes(cleanup.nextExpiringBytes)} of expired files move to the trash · last run freed ${formatBytes(cleanup.lastFreedBytes)}`
              : "Auto-cleanup is turned off. Expired files stay in storage until they are deleted manually."}
          </Typography>
          {cleanup.trashFiles > 0 && (
            <Link component={RouterLink} to={`${STORAGE_PATHS.cleanup}?view=trash`} underline="hover" sx={{ fontSize: 13, fontWeight: 600, color: CM.violetBright }}>
              {formatBytes(cleanup.trashBytes)} in trash ({cleanup.trashFiles} files)
            </Link>
          )}
          <Link component={RouterLink} to={STORAGE_PATHS.settings} underline="hover" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: 13, fontWeight: 600, color: CM.violetBright }}>
            Retention settings <ArrowForwardRoundedIcon sx={{ fontSize: 15 }} />
          </Link>
        </Box>
      </Panel>

      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        <Breakdown title="What takes the space" rows={categoryRows} total={data.registryBytes} />
        <Breakdown title="Who uploads it" rows={sourceRows} total={data.registryBytes} />
      </Box>

      <Panel
        title="Storage & bandwidth, last 30 days"
        action={<Typography sx={{ fontSize: 12, color: CM.textDim }}>Snapshots of the provider, one per day</Typography>}
      >
        <DailyChart daily={data.daily} quotaBytes={data.quotaBytes} quotaLimited={data.quotaLimited} />
      </Panel>

      <Panel
        title="Growth in the last 6 months"
        action={<Typography sx={{ fontSize: 12, color: CM.textDim }}>Dashed lines: quota and warning level</Typography>}
      >
        <GrowthChart history={data.history} quotaBytes={data.quotaBytes} warningPercent={data.warningPercent} />
      </Panel>

      <Panel
        title="Top members by storage"
        action={
          <Typography sx={{ fontSize: 12, color: CM.textDim }}>
            Usage of the {formatBytes(data.memberQuotaBytes)} member quota · system files are not counted
          </Typography>
        }
      >
        <Box sx={{ overflowX: "auto" }}>
          <Table aria-label="Top members by storage" sx={{ minWidth: 640 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...headCellSx, width: 40 }}>#</TableCell>
                <TableCell sx={{ ...headCellSx, textAlign: "left" }}>MEMBER</TableCell>
                <TableCell sx={{ ...headCellSx, width: "36%" }}>USAGE OF QUOTA</TableCell>
                <TableCell sx={headCellSx}>SIZE</TableCell>
                <TableCell sx={headCellSx}>FILES</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.topMembers.map((m, i) => {
                const share = pct(m.bytes, data.memberQuotaBytes);
                return (
                  <TableRow key={m.userId}>
                    <TableCell sx={{ color: CM.textDim }}>{i + 1}</TableCell>
                    <TableCell sx={{ textAlign: "left" }}>
                      <Link component={RouterLink} to={`/admin/users/${m.userId}`} underline="hover" sx={{ color: CM.text, fontWeight: 600, fontSize: 14 }}>
                        {m.email}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ height: 8, borderRadius: 999, bgcolor: "rgba(139,92,246,0.16)" }}>
                        <Box
                          sx={{ width: `${Math.min(share, 100)}%`, height: "100%", borderRadius: 999, bgcolor: share >= 80 ? CM.amber : CM.violet }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                      {formatBytes(m.bytes)} / {formatBytes(data.memberQuotaBytes)}
                    </TableCell>
                    <TableCell sx={{ color: CM.textMuted }}>{m.files}</TableCell>
                  </TableRow>
                );
              })}
              {data.topMembers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 4, color: CM.textMuted }}>
                    No member uploads yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      </Panel>
    </Box>
  );
}
