import { useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
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
import NorthEastRoundedIcon from "@mui/icons-material/NorthEastRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import { contentManagerApi } from "../api/contentManager";
import { useApiMutation, useApiQuery } from "../hooks";
import { CONTENT_PATHS, ContentPageHeader, DarkPill } from "../components/ContentShared";
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
  PENDING: "PENDING",
  IN_REVIEW: "IN_REVIEW",
  ESCALATED: "ESCALATED",
  RESOLVED: "RESOLVED",
  REJECTED: "REJECTED",
};

/** Hành động Content Manager có thể thực hiện. */
const ACTIONS = {
  APPROVE: "APPROVE",
  ESCALATE: "ESCALATE",
  REJECT: "REJECT",
};

/** Nhãn + màu của từng trạng thái. */
const STATUS_META = {
  [STATUS.PENDING]: { labelKey: "contentManager.feedback.statusPending", tone: "warning" },
  [STATUS.IN_REVIEW]: { labelKey: "contentManager.feedback.statusInReview", tone: "sky" },
  [STATUS.ESCALATED]: { labelKey: "contentManager.feedback.statusEscalated", tone: "pink" },
  [STATUS.RESOLVED]: { labelKey: "contentManager.feedback.statusResolved", tone: "success" },
  [STATUS.REJECTED]: { labelKey: "contentManager.feedback.statusRejected", tone: "danger" },
};

/** Nhãn của từng nhóm nội dung. */
const CATEGORY_LABEL = {
  GENERAL: "contentManager.feedback.categoryGeneral",
  EXERCISE_CONTENT: "contentManager.feedback.categoryExercise",
  WORKOUT_CONTENT: "contentManager.feedback.categoryWorkout",
  TECHNICAL: "contentManager.feedback.categoryTechnical",
  OTHER: "contentManager.feedback.categoryOther",
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
 * Màn chi tiết một đơn góp ý của Content Manager.
 *
 * Toàn bộ thao tác xử lý (nhận việc, đã xử lý, chuyển quản trị, từ chối)
 * nằm trong màn này; bảng danh sách chỉ còn nút xem chi tiết.
 */
export default function ContentFeedbackDetailPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const query = useApiQuery(() => contentManagerApi.feedbackDetail(id), {
    enabled: Boolean(id),
    deps: [id],
  });
  const [dialog, setDialog] = useState(null);
  const [note, setNote] = useState("");
  const [actionError, setActionError] = useState("");

  const feedback = query.data;
  const meta = feedback ? STATUS_META[feedback.status] ?? STATUS_META[STATUS.PENDING] : null;
  const isClosed =
    feedback?.status === STATUS.RESOLVED || feedback?.status === STATUS.REJECTED;
  const isEscalated = feedback?.status === STATUS.ESCALATED;
  const canHandle = Boolean(feedback) && !isClosed && !isEscalated;

  const take = useApiMutation(() => contentManagerApi.takeFeedback(id), {
    onSuccess: () => query.refetch(),
    onError: (error) => setActionError(error.message),
  });

  const handle = useApiMutation(
    (action, resolutionNote) => contentManagerApi.handleFeedback(id, action, resolutionNote),
    {
      onSuccess: () => {
        setDialog(null);
        query.refetch();
      },
      onError: (error) => setActionError(error.message),
    }
  );

  const openDialog = (action) => {
    setNote("");
    setActionError("");
    setDialog({ action });
  };

  const closeDialog = () => setDialog(null);

  const confirmAction = async () => {
    if (!dialog) return;
    await handle.mutate(dialog.action, note.trim());
  };

  const dialogTitle =
    dialog?.action === ACTIONS.ESCALATE
      ? t("contentManager.feedback.escalateTitle")
      : dialog?.action === ACTIONS.REJECT
        ? t("contentManager.feedback.rejectTitle")
        : t("contentManager.feedback.approveTitle");

  const breadcrumb = [
    { labelKey: "nav.contentManagerRole", to: CONTENT_PATHS.dashboard },
    { labelKey: "contentManager.feedback.crumb", to: CONTENT_PATHS.feedback },
    { labelKey: "contentManager.feedback.detailCrumb" },
  ];

  if (query.isLoading) {
    return (
      <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 2, sm: 3 }, py: 4 }}>
        <ContentPageHeader breadcrumb={breadcrumb} title={t("contentManager.feedback.detailLoading")} />
        <Box sx={{ py: 8, display: "grid", placeItems: "center" }}>
          <CircularProgress size={24} />
        </Box>
      </Box>
    );
  }

  if (query.error || !feedback) {
    return (
      <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 2, sm: 3 }, py: 4 }}>
        <ContentPageHeader breadcrumb={breadcrumb} title={t("contentManager.feedback.detailNotFound")} />
        <Alert
          severity="warning"
          sx={{ mt: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => query.refetch()}>
              {t("common.apiError.retry")}
            </Button>
          }
        >
          {query.error?.message || t("contentManager.feedback.detailNotFoundMessage")}
        </Alert>
        <Button
          component={RouterLink}
          to={CONTENT_PATHS.feedback}
          sx={{ mt: 2 }}
          startIcon={<ArrowBackRoundedIcon />}
        >
          {t("contentManager.feedback.backToList")}
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2.5, sm: 3 } }}>
      <ContentPageHeader
        breadcrumb={breadcrumb}
        title={feedback.title}
        description={t("contentManager.feedback.detailMeta", {
          member: feedback.memberName || feedback.memberEmail || t("contentManager.feedback.unknown"),
        })}
        action={
          <Button
            component={RouterLink}
            to={CONTENT_PATHS.feedback}
            variant="outlined"
            startIcon={<ArrowBackRoundedIcon />}
          >
            {t("contentManager.feedback.backToList")}
          </Button>
        }
      />

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
        <DarkPill tone={meta.tone}>{t(meta.labelKey)}</DarkPill>
        <DarkPill tone="neutral">
          {t(CATEGORY_LABEL[feedback.category] || CATEGORY_LABEL.OTHER)}
        </DarkPill>
      </Stack>

      {actionError ? (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setActionError("")}>
          {actionError}
        </Alert>
      ) : null}

      <Card sx={{ mt: 2.5, overflow: "hidden", ...enter(120) }}>
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
                {t("contentManager.feedback.detailContent")}
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
              label={t("contentManager.feedback.colMember")}
              value={
                feedback.memberName
                  ? `${feedback.memberName}\n${feedback.memberEmail || ""}`
                  : feedback.memberEmail
              }
            />
            <DetailField
              label={t("contentManager.feedback.colSubmitted")}
              value={formatDateTime(feedback.createdAt)}
            />
            <DetailField
              label={t("contentManager.feedback.detailLastUpdated")}
              value={formatDateTime(feedback.updatedAt)}
            />
            <DetailField
              label={t("contentManager.feedback.detailEscalatedAt")}
              value={formatDateTime(feedback.escalatedAt)}
            />
            <DetailField
              label={t("contentManager.feedback.detailResolvedAt")}
              value={formatDateTime(feedback.resolvedAt)}
            />
          </Grid>

          {feedback.resolutionNote ? (
            <>
              <Divider sx={{ my: 2.5 }} />
              <Typography
                variant="caption"
                sx={{ color: CM.green, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 10, fontWeight: 700 }}
              >
                {t("contentManager.feedback.resolutionLabel")}
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

      {/* ── Thao tác xử lý ─────────────────────────────────────── */}
      <Card sx={{ mt: 2.5, overflow: "hidden", ...enter(200) }}>
        <CardContent sx={{ p: { xs: 2.25, sm: 3 } }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#fff" }}>
            {t("contentManager.feedback.detailActions")}
          </Typography>
          <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: CM.textDim }}>
            {t("contentManager.feedback.detailActionsHint")}
          </Typography>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              disabled={feedback.status !== STATUS.PENDING || take.isPending}
              onClick={() => take.mutate()}
            >
              {take.isPending
                ? t("contentManager.feedback.taking")
                : t("contentManager.feedback.take")}
            </Button>
            <Button
              variant="contained"
              disabled={!canHandle || handle.isPending}
              startIcon={<CheckRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={() => openDialog(ACTIONS.APPROVE)}
            >
              {t("contentManager.feedback.approve")}
            </Button>
            <Button
              variant="outlined"
              color="warning"
              disabled={!canHandle || handle.isPending}
              startIcon={<NorthEastRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={() => openDialog(ACTIONS.ESCALATE)}
            >
              {t("contentManager.feedback.escalate")}
            </Button>
            <Button
              variant="outlined"
              color="error"
              disabled={!canHandle || handle.isPending}
              startIcon={<BlockRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={() => openDialog(ACTIONS.REJECT)}
            >
              {t("contentManager.feedback.reject")}
            </Button>
          </Stack>

          {isEscalated ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              {t("contentManager.feedback.detailEscalatedNotice")}
            </Alert>
          ) : null}
          {isClosed ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              {t("contentManager.feedback.detailClosedNotice")}
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={Boolean(dialog)} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: CM.textMuted, mb: 2 }}>
            {t("contentManager.feedback.dialogIntro")}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label={t("contentManager.feedback.noteLabel")}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            helperText={t("contentManager.feedback.noteHint")}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={closeDialog}>{t("common.ui.cancel")}</Button>
          <Button
            variant="contained"
            onClick={confirmAction}
            disabled={handle.isPending}
            color={dialog?.action === ACTIONS.REJECT ? "error" : "primary"}
          >
            {t("contentManager.feedback.confirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
