import { useTranslation } from "react-i18next";
import i18n from "../../i18n";
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

/** Key i18n của nhãn đối tượng nhận, theo mã audience từ backend. */
const AUDIENCE_LABEL_KEYS = {
  MEMBER: "admin.notifications.audienceMembers",
  ALL_MEMBERS: "admin.notifications.audienceMembers",
  CONTENT_MANAGER: "admin.notifications.audienceContentManager",
  SYSTEM_WIDE: "admin.notifications.audienceSystem",
  ALL_USERS: "admin.notifications.audienceSystem",
  GLOBAL: "admin.notifications.audienceSystem",
  ALL_ROLES: "admin.notifications.audienceSystem",
  SPECIFIC_USER: "admin.notifications.audienceDirect",
};

/** Key i18n của nhãn loại thông báo. */
const TYPE_LABEL_KEYS = {
  ANNOUNCEMENT: "admin.notifications.typeAnnouncement",
  UPDATE: "admin.notifications.typeUpdate",
  MAINTENANCE: "admin.notifications.typeMaintenance",
  SYSTEM: "admin.notifications.typeSystem",
};

/** Key i18n của nhãn trạng thái. */
const STATUS_LABEL_KEYS = {
  PUBLISHED: "admin.notifications.statusPublished",
  READ: "admin.notifications.statusRead",
  UNREAD: "admin.notifications.statusUnread",
};

const TYPE_COLORS = {
  ANNOUNCEMENT: {
    color: "#67e8f9",
    borderColor: "rgba(34, 211, 238, 0.35)",
    bgcolor: "rgba(34, 211, 238, 0.12)",
  },
  UPDATE: {
    color: "#c4b5fd",
    borderColor: "rgba(167, 139, 250, 0.35)",
    bgcolor: "rgba(167, 139, 250, 0.12)",
  },
  MAINTENANCE: {
    color: "#fcd34d",
    borderColor: "rgba(251, 191, 36, 0.35)",
    bgcolor: "rgba(251, 191, 36, 0.12)",
  },
  SYSTEM: {
    color: "#a5b4fc",
    borderColor: "rgba(129, 140, 248, 0.35)",
    bgcolor: "rgba(129, 140, 248, 0.12)",
  },
};

function formatCreatedAt(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const locale = i18n.language === "vi" ? "vi-VN" : "en-US";
  return date.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationDetailModal({ notification, onClose }) {
  const { t } = useTranslation();
  if (!notification) return null;

  const type = String(notification.type || "ANNOUNCEMENT").toUpperCase();
  const audience = String(
    notification.targetAudience
      ?? notification.target_audience
      ?? notification.audience
      ?? (notification.userId ? "SPECIFIC_USER" : "MEMBER"),
  ).toUpperCase();
  const status = String(notification.status || (notification.read ? "READ" : "PUBLISHED")).toUpperCase();
  const typeLabel = TYPE_LABEL_KEYS[type] ? t(TYPE_LABEL_KEYS[type]) : type.charAt(0) + type.slice(1).toLowerCase();
  const statusLabel = STATUS_LABEL_KEYS[status] ? t(STATUS_LABEL_KEYS[status]) : status.charAt(0) + status.slice(1).toLowerCase();
  const typeStyle = TYPE_COLORS[type] || {
    color: "#c4b5fd",
    borderColor: "rgba(196, 181, 253, 0.3)",
    bgcolor: "rgba(139, 92, 246, 0.12)",
  };
  const statusColor = status === "PUBLISHED" ? "#6ee7b7" : "#c4b5fd";

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
            label={typeLabel}
            sx={{
              color: typeStyle.color,
              border: "1px solid",
              borderColor: typeStyle.borderColor,
              bgcolor: typeStyle.bgcolor,
              fontWeight: 600,
              fontFamily: "Arial, sans-serif",
            }}
          />
          <Chip
            size="small"
            label={AUDIENCE_LABEL_KEYS[audience] ? t(AUDIENCE_LABEL_KEYS[audience]) : audience}
            sx={{
              color: "#c4b5fd",
              border: "1px solid rgba(196, 181, 253, 0.28)",
              bgcolor: "rgba(139,92,246,0.12)",
              fontWeight: 600,
              fontFamily: "Arial, sans-serif",
            }}
          />
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: "#3b2b5b" }}>
        <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.8, fontFamily: "Arial, sans-serif" }}>
          {notification.message}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "space-between", px: 3, py: 2, fontFamily: "Arial, sans-serif" }}>
        <Stack spacing={0.5}>
          <Typography variant="caption" sx={{ color: "#a89bd0", fontFamily: "Arial, sans-serif" }}>
            {formatCreatedAt(notification.createdAt)}
          </Typography>
          <Chip
            size="small"
            label={statusLabel}
            sx={{
              alignSelf: "flex-start",
              height: 22,
              color: statusColor,
              border: `1px solid ${statusColor}55`,
              bgcolor: `${statusColor}14`,
              fontSize: 11,
              fontFamily: "Arial, sans-serif",
            }}
          />
        </Stack>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            borderRadius: 2,
            px: 2.5,
            bgcolor: "#6d4aff",
            fontFamily: "Arial, sans-serif",
            "&:hover": { bgcolor: "#7c5dfa" },
          }}
        >
          {t("common.ui.close")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
