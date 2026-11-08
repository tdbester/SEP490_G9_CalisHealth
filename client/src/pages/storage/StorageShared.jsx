import { Box, Typography } from "@mui/material";
import { CM } from "../../theme-content";

export const STORAGE_PATHS = {
  capacity: "/admin/storage",
  cleanup: "/admin/storage/cleanup",
  settings: "/admin/storage/settings",
};

const MB = 1024 ** 2;
const GB = 1024 ** 3;

/** 2147483648 -> "2.0 GB", 52428800 -> "50 MB", 419430 -> "0.4 MB". */
export function formatBytes(bytes) {
  if (bytes == null) return "-";
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  const mb = bytes / MB;
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

/** Duration between an ISO time and now, e.g. "5 minutes", "3 hours", "12 days". */
export function formatDuration(iso, now = Date.now()) {
  const ms = Math.abs(now - new Date(iso).getTime());
  const hours = Math.round(ms / 3600000);
  if (hours < 1) {
    const minutes = Math.round(ms / 60000);
    if (minutes < 1) return "less than a minute";
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";

export const fmtDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

export const TONE = {
  violet: { fg: CM.violetBright, bg: "rgba(139,92,246,0.16)" },
  cyan: { fg: "#67E8F9", bg: "rgba(34,211,238,0.14)" },
  pink: { fg: CM.pink, bg: "rgba(255,119,153,0.15)" },
  green: { fg: CM.green, bg: "rgba(120,232,136,0.13)" },
  amber: { fg: CM.amber, bg: "rgba(248,200,88,0.14)" },
  muted: { fg: CM.textMuted, bg: "rgba(168,155,208,0.14)" },
};

export function Pill({ tone = "muted", children }) {
  const { fg, bg } = TONE[tone];
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        px: 1.25,
        py: 0.3,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
        color: fg,
        bgcolor: bg,
      }}
    >
      {children}
    </Box>
  );
}

/** Rounded card with an optional header row (title on the left, `action` on the right). */
export function Panel({ title, action, children, sx }) {
  return (
    <Box
      component="section"
      sx={{ p: 2.5, borderRadius: "16px", bgcolor: CM.surface, border: `1px solid ${CM.border}`, ...sx }}
    >
      {(title || action) && (
        <Box
          sx={{ mb: 2, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5 }}
        >
          {title && (
            <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700 }}>
              {title}
            </Typography>
          )}
          {action}
        </Box>
      )}
      {children}
    </Box>
  );
}

export function StatTile({ label, value, caption, tone }) {
  return (
    <Box
      sx={{ flex: 1, minWidth: 180, p: 2, borderRadius: "12px", bgcolor: CM.surfaceSoft, border: `1px solid ${CM.border}` }}
    >
      <Typography sx={{ fontSize: 12.5, color: CM.textMuted }}>{label}</Typography>
      <Typography sx={{ mt: 0.25, fontSize: 24, fontWeight: 700, color: tone || CM.text }}>{value}</Typography>
      {caption && <Typography sx={{ fontSize: 12, color: CM.textDim }}>{caption}</Typography>}
    </Box>
  );
}

/** Square icon box used in legends, file cells and settings rows. */
export function IconBox({ icon: Icon, tone = "violet", size = 36 }) {
  const { fg, bg } = TONE[tone];
  return (
    <Box
      aria-hidden
      sx={{ width: size, height: size, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: "10px", bgcolor: bg, color: fg }}
    >
      <Icon sx={{ fontSize: size * 0.5 }} />
    </Box>
  );
}
