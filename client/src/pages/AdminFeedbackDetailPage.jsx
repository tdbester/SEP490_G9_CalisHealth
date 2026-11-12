import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { keyframes } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import { adminUsersApi, apiErrorMessage } from "../api/adminUsers";
import { DarkPill } from "../components/ContentShared";
import { CM } from "../theme-content";

const rise = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;
const enter = (delay = 0) => ({
  animation: `${rise} .45s ease-out ${delay}ms both`,
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
});

/** Trạng thái một đơn góp ý. */
const STATUS = {
  ESCALATED: "ESCALATED",
  RESOLVED: "RESOLVED",
  REJECTED: "REJECTED",
};

/** Hành động Admin có thể thực hiện. */
const ACTIONS = {
  RESOLVE: "RESOLVE",
  REJECT: "REJECT",
};

/** Nhãn + màu của từng trạng thái. */
const STATUS_META = {
  [STATUS.ESCALATED]: { labelKey: "admin.feedback.statusEscalated", tone: "pink" },
  [STATUS.RESOLVED]: { labelKey: "admin.feedback.statusResolved", tone: "success" },
  [STATUS.REJECTED]: { labelKey: "admin.feedback.statusRejected", tone: "danger" },
};

/** Nhãn của từng nhóm nội dung. */
const CATEGORY_LABEL = {
  GENERAL: "admin.feedback.categoryGeneral",
  EXERCISE_CONTENT: "admin.feedback.categoryExercise",
  WORKOUT_CONTENT: "admin.feedback.categoryWorkout",
  TECHNICAL: "admin.feedback.categoryTechnical",
  OTHER: "admin.feedback.categoryOther",
};

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function DetailField({ label, value, full = false }) {
  return (
    <Grid item xs={12} sm={full ? 12 : 6}>
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          border: `1px solid ${CM.border}`,
          bgcolor: CM.surfaceSoft,
          borderRadius: "14px",
          p: 1.5,
          height: "100%",
          transition: "all .2s ease",
          "&:hover": { borderColor: CM.borderStrong },
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: CM.textDim,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          {label}
        </Typography>
        <Typography
          variant="body2"
          fontWeight={600}
          sx={{ mt: 0.5, color: "#fff", whiteSpace: "pre-line", overflowWrap: "anywhere" }}
        >
          {value || "—"}
        </Typography>
      </Box>
    </Grid>
  );
}

/**
 * Màn chi tiết một đơn góp ý của Admin.
 *
 * Toàn bộ thao tác quyết định cuối cùng (giải quyết / không chấp nhận) nằm
 * trong màn này; bảng danh sách chỉ còn nút xem chi tiết.
 */
export default function AdminFeedbackDetailPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await adminUsersApi.feedbackDetail(id);
      setFeedback(res);
    } catch (err) {
      setLoadError(apiErrorMessage(err, t("admin.feedback.loadFailed")));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const meta = feedback ? STATUS_META[feedback.status] ?? STATUS_META[STATUS.ESCALATED] : null;
  const isClosed =
    feedback?.status === STATUS.RESOLVED || feedback?.status === STATUS.REJECTED;
  const canHandle = feedback?.status === STATUS.ESCALATED;

  const openDialog = (action) => {
    setNote("");
    setActionError("");
    setDialog({ action });
  };

  const closeDialog = () => setDialog(null);

  const confirmAction = async () => {
    if (!dialog) return;
    setBusy(true);
    setActionError("");
    try {
      await adminUsersApi.handleFeedback(id, dialog.action, note.trim());
      closeDialog();
      await load();
    } catch (err) {
      setActionError(apiErrorMessage(err, t("admin.feedback.actionFailed")));
    } finally {
      setBusy(false);
    }
  };

  const dialogTitle =
    dialog?.action === ACTIONS.REJECT
      ? t("admin.feedback.rejectTitle")
      : t("admin.feedback.resolveTitle");

  if (loading) {
    return (
      <Box sx={{ p: { xs: 2, md: 3.5 } }}>
        <Typography sx={{ fontSize: 13, color: CM.textMuted }}>
          {t("admin.feedback.breadcrumb")}
        </Typography>
        <Typography component="h1" sx={{ mt: 1, fontSize: 34, fontWeight: 700 }}>
          {t("admin.feedback.detailLoading")}
        </Typography>
        <Box sx={{ py: 8, display: "grid", placeItems: "center" }}>
          <CircularProgress size={24} />
        </Box>
      </Box>
    );
  }

  if (loadError || !feedback) {
    return (
      <Box sx={{ p: { xs: 2, md: 3.5 } }}>
        <Typography sx={{ fontSize: 13, color: CM.textMuted }}>
          {t("admin.feedback.breadcrumb")}
        </Typography>
        <Typography component="h1" sx={{ mt: 1, fontSize: 34, fontWeight: 700 }}>
          {t("admin.feedback.detailNotFound")}
        </Typography>
        <Alert
          severity="warning"
          sx={{ mt: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => void load()}>
              {t("common.ui.retry")}
            </Button>
          }
        >
          {loadError || t("admin.feedback.detailNotFoundMessage")}
        </Alert>
        <Button
          component={RouterLink}
          to="/admin/feedback"
          sx={{ mt: 2 }}
          startIcon={<ArrowBackRoundedIcon />}
        >
          {t("admin.feedback.backToList")}
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3.5 } }}>
      <Typography sx={{ fontSize: 13, color: CM.textMuted }}>
        {t("admin.feedback.breadcrumb")}
      </Typography>

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
        <Box sx={{ maxWidth: 680 }}>
          <Typography component="h1" sx={{ fontSize: 30, fontWeight: 700, lineHeight: 1.2 }}>
            {feedback.title}
          </Typography>
          <Typography sx={{ mt: 0.75, fontSize: 14, color: CM.textMuted }}>
            {t("admin.feedback.detailMeta", {
              member: feedback.memberEmail || t("admin.feedback.unknown"),
            })}
          </Typography>
        </Box>
        <Button
          component={RouterLink}
          to="/admin/feedback"
          variant="outlined"
          startIcon={<ArrowBackRoundedIcon />}
        >
          {t("admin.feedback.backToList")}
        </Button>
      </Box>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <DarkPill tone={meta.tone}>{t(meta.labelKey)}</DarkPill>
        <DarkPill tone="neutral">
          {t(CATEGORY_LABEL[feedback.category] || CATEGORY_LABEL.OTHER)}
        </DarkPill>
      </Stack>

      {actionError ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError("")}>
          {actionError}
        </Alert>
      ) : null}

      <Card sx={{ overflow: "hidden", ...enter(120) }}>
        <CardContent sx={{ p: { xs: 2.25, sm: 3 } }}>
          <Stack direction="row" spacing={1.25} alignItems="flex-start">
            <Box
              aria-hidden
              sx={{
                width: 34,
                height: 34,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                borderRadius: "10px",
                bgcolor: "rgba(139,92,246,0.16)",
                color: CM.violetBright,
              }}
            >
              <ChatBubbleOutlineRoundedIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#fff" }}>
                {t("admin.feedback.detailContent")}
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 0.75, color: CM.textMuted, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
              >
                {feedback.content}
              </Typography>
            </Box>
          </Stack>

          <Divider sx={{ my: 2.5 }} />

          <Grid container spacing={1.5}>
            <DetailField
              label={t("admin.feedback.colMember")}
              value={feedback.memberEmail}
            />
            <DetailField
              label={t("admin.feedback.detailSubmitted")}
              value={formatDateTime(feedback.createdAt)}
            />
            <DetailField
              label={t("admin.feedback.detailEscalatedAt")}
              value={formatDateTime(feedback.escalatedAt)}
            />
          </Grid>

          {feedback.resolutionNote ? (
            <>
              <Divider sx={{ my: 2.5 }} />
              <Typography
                variant="caption"
                sx={{
                  color: CM.green,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {t("admin.feedback.resolutionLabel")}
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 0.75, color: "#fff", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
              >
                {feedback.resolutionNote}
              </Typography>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* ── Quyết định cuối cùng ──────────────────────────────── */}
      <Card sx={{ mt: 2.5, overflow: "hidden", ...enter(200) }}>
        <CardContent sx={{ p: { xs: 2.25, sm: 3 } }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#fff" }}>
            {t("admin.feedback.detailActions")}
          </Typography>
          <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: CM.textDim }}>
            {t("admin.feedback.detailActionsHint")}
          </Typography>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
            <Button
              variant="contained"
              disabled={!canHandle || busy}
              startIcon={<CheckRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={() => openDialog(ACTIONS.RESOLVE)}
            >
              {t("admin.feedback.resolve")}
            </Button>
            <Button
              variant="outlined"
              color="error"
              disabled={!canHandle || busy}
              startIcon={<BlockRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={() => openDialog(ACTIONS.REJECT)}
            >
              {t("admin.feedback.reject")}
            </Button>
          </Stack>

          {isClosed ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              {t("admin.feedback.detailClosedNotice")}
            </Alert>
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              {t("admin.feedback.detailPendingNotice")}
            </Alert>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(dialog)} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: CM.textMuted, mb: 2 }}>
            {t("admin.feedback.dialogIntro")}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label={t("admin.feedback.noteLabel")}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            helperText={t("admin.feedback.noteHint")}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={closeDialog}>{t("common.ui.cancel")}</Button>
          <Button
            variant="contained"
            onClick={confirmAction}
            disabled={busy}
            color={dialog?.action === ACTIONS.REJECT ? "error" : "primary"}
          >
            {t("admin.feedback.confirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
