import { useState } from "react";
import { Link as RouterLink, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogContentText, DialogTitle, Divider, Grid, Stack, TextField, Typography,
} from "@mui/material";
import { keyframes } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { contentManagerApi, mediaUrl } from "../api/contentManager";
import { useApiMutation, useApiQuery } from "../hooks";
import { CONTENT_PATHS, ContentPageHeader, DarkPill, formatDateTime } from "../components/ContentShared";
import { CM } from "../theme-content";
import { GuideSteps } from "./SystemExerciseDetailPage";

const rise = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;
const enter = (delay = 0) => ({
  animation: `${rise} .45s ease-out ${delay}ms both`,
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
});

function DetailField({ label, value, full = false, sx }) {
  return (
    <Grid item xs={12} sm={full ? 12 : 4} sx={sx}>
      <Box sx={{
        position: "relative",
        overflow: "hidden",
        border: `1px solid ${CM.border}`,
        bgcolor: CM.surfaceSoft,
        borderRadius: "14px",
        p: { xs: 1.5, sm: 1.5 },
        height: "100%",
        transition: "all .2s ease",
        "&:hover": { borderColor: CM.borderStrong },
      }}>
        <Typography variant="caption" sx={{ color: CM.textDim, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 10, fontWeight: 700 }}>{label}</Typography>
        <Typography variant="body2" fontWeight={600} sx={{ mt: 0.5, whiteSpace: "pre-line", color: "#fff", overflowWrap: "anywhere" }}>{value || "—"}</Typography>
      </Box>
    </Grid>
  );
}

export default function ExerciseModerationDetailPage() {
  const { t } = useTranslation();
  const { code = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const query = useApiQuery(() => contentManagerApi.exercise(code), { enabled: Boolean(code), deps: [code] });
  const historyRow = location.state?.historyRow;
  const isHistoryView = Boolean(historyRow);
  const isHistoryOnly = Boolean(isHistoryView && query.error);
  const entry = query.data || (isHistoryOnly ? {
    code: historyRow.code,
    name: historyRow.name,
    type: historyRow.type,
    muscleGroup: historyRow.muscleGroup,
    level: historyRow.level,
    description: historyRow.description,
    category: historyRow.category,
    defaultSets: historyRow.defaultSets,
    defaultReps: historyRow.defaultReps,
    duration: historyRow.duration,
    guide: historyRow.guide,
    demoVideoUrl: historyRow.demoVideoUrl,
    anatomyImageUrl: historyRow.anatomyImageUrl,
    createdByName: historyRow.createdByName,
    active: false,
  } : null);
  const [actionError, setActionError] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reasonOpen, setReasonOpen] = useState(false);

  const handleReject = () => {
    setRejectionReason("");
    setConfirmAction("reject");
  };

  const approve = useApiMutation(() => contentManagerApi.updateExerciseStatus(code, true), {
    onSuccess: () => navigate(CONTENT_PATHS.pendingExerciseModeration, { state: { successMessage: t("admin.moderationDetail.approvedSuccess", { name: entry?.name || t("admin.moderation.exercise") }) } }),
    onError: (error) => setActionError(error.message),
  });
  const reject = useApiMutation((reason) => contentManagerApi.updateExerciseStatus(code, false, reason), {
    onSuccess: () => navigate(CONTENT_PATHS.pendingExerciseModeration, { state: { successMessage: t("admin.moderationDetail.rejectedSuccess", { name: entry?.name || t("admin.moderation.exercise") }) } }),
    onError: (error) => setActionError(error.message),
  });
  const busy = approve.isPending || reject.isPending;
  const breadcrumb = [
    { labelKey: "nav.contentManagerRole", to: CONTENT_PATHS.dashboard },
    { labelKey: "nav.exerciseAndWorkout", to: CONTENT_PATHS.exercises },
    { labelKey: isHistoryView ? "nav.approvalHistory" : "nav.pendingModerationCrumb", to: isHistoryView ? CONTENT_PATHS.exerciseApprovalHistory : CONTENT_PATHS.pendingExerciseModeration },
    { labelKey: "nav.exerciseDetails" },
  ];

  if (query.isLoading) {
    return <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 2, sm: 3 }, py: 4 }}><ContentPageHeader breadcrumb={breadcrumb} title={t("admin.moderationDetail.loading")} /><Box sx={{ py: 8, display: "grid", placeItems: "center" }}><CircularProgress size={24} /></Box></Box>;
  }

  if ((query.error && !isHistoryOnly) || !entry) {
    return <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 2, sm: 3 }, py: 4 }}><ContentPageHeader breadcrumb={breadcrumb} title={t("admin.moderationDetail.notFound")} /><Alert severity="warning" sx={{ mt: 2 }} action={<Button color="inherit" size="small" onClick={() => query.refetch()}>{t("admin.moderation.tryAgain")}</Button>}>{query.error?.message || t("admin.moderationDetail.notFoundMessage")}</Alert><Button component={RouterLink} to={CONTENT_PATHS.exerciseApprovalHistory} sx={{ mt: 2 }} startIcon={<ArrowBackRoundedIcon />}>{t("admin.moderationDetail.backToHistory")}</Button></Box>;
  }

  return (
    <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2.5, sm: 3 } }}>
      <ContentPageHeader
        breadcrumb={breadcrumb}
        title={entry.name}
        description={t("admin.moderationDetail.detailsMeta", { code: entry.code })}
        action={<Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {!isHistoryView && <>
            <Button variant="outlined" color="error" disabled={busy} onClick={handleReject}>{reject.isPending ? t("admin.moderationDetail.rejecting") : t("admin.moderationDetail.reject")}</Button>
            <Button variant="contained" disabled={busy} onClick={() => setConfirmAction("approve")}>{approve.isPending ? t("admin.moderationDetail.approving") : t("admin.moderationDetail.approve")}</Button>
          </>}
          <Button component={RouterLink} to={isHistoryView ? CONTENT_PATHS.exerciseApprovalHistory : CONTENT_PATHS.pendingExerciseModeration} variant="outlined" startIcon={<ArrowBackRoundedIcon />}>{isHistoryView ? t("admin.moderationDetail.backToHistory") : t("admin.moderationDetail.backToPending")}</Button>
        </Stack>}
      />

      {isHistoryView && <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}><DarkPill tone={historyRow.decision === "APPROVED" ? "success" : "danger"}>{historyRow.decision === "APPROVED" ? t("admin.moderationDetail.approved") : t("admin.moderationDetail.rejected")}</DarkPill>{historyRow.decision === "REJECTED" && <Button size="small" color="error" variant="text" onClick={() => setReasonOpen(true)} sx={{ py: 0.25, px: 1, fontSize: 11.5 }}>{t("admin.moderationDetail.viewReason")}</Button>}</Stack>}
      {isHistoryOnly && <Alert severity="info" sx={{ mt: 2 }}>{t("admin.moderationDetail.deletedNotice")}</Alert>}
      {actionError && <Alert severity="error" sx={{ mt: 2 }}>{actionError}</Alert>}
      <Card sx={{ mt: 2.5, overflow: "hidden", ...enter(150) }}>
        <CardContent sx={{ p: { xs: 2.25, sm: 3 } }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#fff" }}>{t("admin.moderationDetail.demoVideo")}</Typography>
          {entry.demoVideoUrl ? (
            <Box component="video" src={mediaUrl(entry.demoVideoUrl)} controls aria-label={t("admin.moderationDetail.demoVideoAria", { name: entry.name })} sx={{ mt: 1.5, width: "100%", maxHeight: 420, borderRadius: 2, bgcolor: "#000", display: "block" }} />
          ) : <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{t("admin.moderationDetail.noDemoVideo")}</Typography>}

          <Divider sx={{ my: 2.5 }} />
          <Grid container spacing={2} alignItems="stretch">
            <Grid item xs={12} md={9} sx={{ display: "flex" }}>
              <Box sx={{ width: "100%", border: `1px solid ${CM.border}`, borderRadius: 1.5, p: { xs: 1.5, sm: 1.75 } }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#fff" }}>{t("admin.moderationDetail.anatomy")}</Typography>
                {entry.anatomyImageUrl ? (
                  <Box component="img" src={mediaUrl(entry.anatomyImageUrl)} alt={t("admin.moderationDetail.anatomyAria", { name: entry.name })} sx={{ mt: 1.5, width: "100%", height: { xs: 280, sm: 340, md: 380 }, objectFit: "contain", borderRadius: 1, bgcolor: "rgba(19,10,39,0.7)", display: "block" }} />
                ) : <Box sx={{ minHeight: { xs: 280, sm: 340, md: 380 }, display: "grid", placeItems: "center" }}><Typography variant="body2" color="text.secondary">{t("admin.moderationDetail.noAnatomy")}</Typography></Box>}
              </Box>
            </Grid>
            <Grid item xs={12} md={3} sx={{ alignSelf: "flex-start", mt: { xs: 0, md: 8.75 } }}>
              <Grid container direction="column" spacing={1}>
                <DetailField label={t("admin.moderationDetail.muscleGroup")} value={entry.muscleGroup} full />
                <DetailField label={t("admin.moderationDetail.type")} value={entry.type} full />
                <DetailField label={t("admin.moderationDetail.level")} value={entry.level} full />
                <DetailField label={t("admin.moderationDetail.defaultSets")} value={entry.defaultSets} full />
                <DetailField label={t("admin.moderationDetail.defaultReps")} value={entry.defaultReps} full />
              </Grid>
            </Grid>
          </Grid>

          <Divider sx={{ my: 2.5 }} />
          <Grid container spacing={1.5}>
            <DetailField label={t("admin.moderationDetail.description")} value={entry.description} full />
            <Grid item xs={12}><Box sx={{ border: `1px solid ${CM.border}`, bgcolor: "rgba(19,10,39,0.6)", borderRadius: 1.5, p: 1.75 }}><Typography variant="caption" sx={{ color: CM.textDim, textTransform: "uppercase", fontSize: 10, fontWeight: 700 }}>{t("admin.moderationDetail.guide")}</Typography><Box sx={{ mt: 1.5 }}><GuideSteps guide={entry.guide} /></Box></Box></Grid>
            <DetailField label={t("admin.moderationDetail.source")} value={t("admin.moderationDetail.sourceCustom")} />
            <DetailField label={t("admin.moderationDetail.createdBy")} value={entry.createdByName || entry.createdBy} />
          </Grid>
        </CardContent>
      </Card>

      <Dialog
        open={reasonOpen}
        onClose={() => setReasonOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { fontFamily: "Arial, sans-serif", "& *": { fontFamily: "Arial, sans-serif" } } }}
      >
        <DialogTitle sx={{ pb: 1 }}>{t("admin.moderationDetail.rejectionDetails")}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" sx={{ color: CM.textDim, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>{t("admin.moderationDetail.exerciseLabel")}</Typography>
              <Typography variant="body1" fontWeight={700} sx={{ mt: 0.5, color: "#fff" }}>{entry.name}</Typography>
              <Typography variant="caption" sx={{ color: CM.textMuted }}>{entry.code}</Typography>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
              <Box><Typography variant="caption" sx={{ color: CM.textDim }}>{t("admin.moderationDetail.decision")}</Typography><Typography variant="body2" sx={{ mt: 0.25, color: "#fff" }}>{t("admin.moderationDetail.rejected")}</Typography></Box>
              <Box><Typography variant="caption" sx={{ color: CM.textDim }}>{t("admin.moderationDetail.reviewed")}</Typography><Typography variant="body2" sx={{ mt: 0.25, color: "#fff" }}>{formatDateTime(historyRow?.reviewedAt)}</Typography></Box>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: CM.textDim, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>{t("admin.moderationDetail.reason")}</Typography>
              <Box sx={{ mt: 0.75, p: 1.5, borderRadius: 1.5, border: `1px solid ${CM.border}`, bgcolor: "rgba(19,10,39,0.6)" }}>
                <Typography variant="body2" sx={{ color: "#fff", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{historyRow?.rejectionReason || t("admin.moderationDetail.noReason")}</Typography>
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setReasonOpen(false)}>{t("admin.moderationDetail.close")}</Button></DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { fontFamily: "Arial, sans-serif", "& *": { fontFamily: "Arial, sans-serif" } } }}
      >
        <DialogTitle>{confirmAction === "approve" ? t("admin.moderationDetail.approveTitle") : t("admin.moderationDetail.rejectTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirmAction === "approve" ? t("admin.moderationDetail.approveMessage", { name: entry.name }) : t("admin.moderationDetail.rejectMessage", { name: entry.name })}</DialogContentText>
          {confirmAction === "reject" && <TextField autoFocus required fullWidth multiline minRows={3} margin="dense" label={t("admin.moderationDetail.rejectionReason")} placeholder={t("admin.moderationDetail.rejectionReasonPlaceholder")} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} error={!rejectionReason.trim()} helperText={!rejectionReason.trim() ? t("admin.moderationDetail.rejectionReasonRequired") : ""} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAction(null)}>{t("admin.moderationDetail.cancel")}</Button>
          <Button color={confirmAction === "reject" ? "error" : "primary"} variant="contained" disabled={confirmAction === "reject" && !rejectionReason.trim()} onClick={() => {
            const action = confirmAction;
            setConfirmAction(null);
            setActionError("");
            if (action === "approve") { approve.mutate(); return; }
            reject.mutate(rejectionReason.trim());
          }}>{confirmAction === "reject" ? t("admin.moderationDetail.reject") : t("admin.moderationDetail.approve")}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
