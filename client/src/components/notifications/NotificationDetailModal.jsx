import {
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
  Button,
} from "@mui/material";

const AUDIENCE_LABELS = {
  MEMBER: "All Members",
  ALL_MEMBERS: "All Members",
  CONTENT_MANAGER: "Content Manager",
  SYSTEM_WIDE: "System-wide",
  ALL_USERS: "System-wide",
  GLOBAL: "System-wide",
  ALL_ROLES: "System-wide",
  SPECIFIC_USER: "Direct User",
};

const TYPE_COLORS = {
  ANNOUNCEMENT: "#22d3ee",
  UPDATE: "#a78bfa",
  MAINTENANCE: "#fbbf24",
  SYSTEM: "#818cf8",
};

function formatCreatedAt(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
}

export default function NotificationDetailModal({ notification, onClose }) {
  if (!notification) return null;

  const type = String(notification.type || "ANNOUNCEMENT").toUpperCase();
  const audience = String(
    notification.targetAudience
      ?? notification.target_audience
      ?? notification.audience
      ?? (notification.userId ? "SPECIFIC_USER" : "MEMBER"),
  ).toUpperCase();
  const status = String(notification.status || (notification.read ? "READ" : "PUBLISHED")).toUpperCase();

  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="notification-detail-title"
      PaperProps={{
        sx: {
          border: "1px solid #493771",
          borderRadius: 3,
          bgcolor: "#21183c",
          color: "#f8fafc",
          backgroundImage: "none",
          fontFamily: "Arial, sans-serif",
        },
      }}
      sx={{ "& .MuiBackdrop-root": { backgroundColor: "rgba(8, 5, 18, 0.72)" } }}
    >
      <DialogTitle id="notification-detail-title" sx={{ pb: 1, fontFamily: "Arial, sans-serif" }}>
        <Typography component="h2" sx={{ fontSize: 20, fontWeight: 700, fontFamily: "inherit" }}>
          {notification.title}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
          <Chip
            size="small"
            label={type.charAt(0) + type.slice(1).toLowerCase()}
            sx={{
              color: TYPE_COLORS[type] || "#c4b5fd",
              bgcolor: "rgba(139,92,246,0.12)",
              fontFamily: "Arial, sans-serif",
            }}
          />
          <Chip
            size="small"
            label={AUDIENCE_LABELS[audience] || audience}
            sx={{
              color: "#c4b5fd",
              bgcolor: "rgba(139,92,246,0.12)",
              fontFamily: "Arial, sans-serif",
            }}
          />
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: "#3b2b5b" }}>
        <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.7, fontFamily: "Arial, sans-serif" }}>
          {notification.message}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "space-between", px: 3, py: 2, fontFamily: "Arial, sans-serif" }}>
        <Stack spacing={0.5}>
          <Typography variant="caption" sx={{ color: "#a89bd0", fontFamily: "Arial, sans-serif" }}>
            {formatCreatedAt(notification.createdAt)}
          </Typography>
          <Typography variant="caption" sx={{ color: "#a89bd0", fontFamily: "Arial, sans-serif" }}>
            {status.charAt(0) + status.slice(1).toLowerCase()}
          </Typography>
        </Stack>
        <Button onClick={onClose} variant="contained" sx={{ bgcolor: "#6d4aff", fontFamily: "Arial, sans-serif" }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
