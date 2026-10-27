import { useState } from "react";
import { Link as RouterLink, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogContentText, DialogTitle, Divider, Grid, Stack, Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { contentManagerApi, mediaUrl } from "../api/contentManager";
import { useApiMutation, useApiQuery } from "../hooks";
import { CONTENT_PATHS, ContentPageHeader, DarkPill } from "../components/ContentShared";
import { CM } from "../theme-content";
import { GuideSteps } from "./SystemExerciseDetailPage";

function DetailField({ label, value, full = false, sx }) {
  return (
    <Grid item xs={12} sm={full ? 12 : 4} sx={sx}>
      <Box sx={{ border: `1px solid ${CM.border}`, bgcolor: "rgba(19,10,39,0.6)", borderRadius: 1.5, p: { xs: 1.5, sm: 1.25 }, height: "100%" }}>
        <Typography variant="caption" sx={{ color: CM.textDim, textTransform: "uppercase", letterSpacing: "0.07em", fontSize: 10, fontWeight: 700 }}>{label}</Typography>
        <Typography variant="body2" fontWeight={600} sx={{ mt: 0.5, whiteSpace: "pre-line", color: "#fff", overflowWrap: "anywhere" }}>{value || "—"}</Typography>
      </Box>
    </Grid>
  );
}

export default function ExerciseModerationDetailPage() {
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

  const approve = useApiMutation(() => contentManagerApi.updateExerciseStatus(code, true), {
    onSuccess: () => navigate(CONTENT_PATHS.pendingExerciseModeration, { state: { successMessage: `“${entry?.name || "Exercise"}” approved successfully.` } }),
    onError: (error) => setActionError(error.message),
  });
  const reject = useApiMutation(() => contentManagerApi.updateExerciseStatus(code, false), {
    onSuccess: () => navigate(CONTENT_PATHS.pendingExerciseModeration),
    onError: (error) => setActionError(error.message),
  });
  const busy = approve.isPending || reject.isPending;
  const breadcrumb = [
    { label: "Content manager", to: CONTENT_PATHS.dashboard },
    { label: "Exercise & Workout Management", to: CONTENT_PATHS.exercises },
    { label: isHistoryView ? "Approval history" : "Pending moderation", to: isHistoryView ? CONTENT_PATHS.exerciseApprovalHistory : CONTENT_PATHS.pendingExerciseModeration },
    { label: "Exercise details" },
  ];

  if (query.isLoading) {
    return <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 2, sm: 3 }, py: 4 }}><ContentPageHeader breadcrumb={breadcrumb} title="Loading exercise…" /><Box sx={{ py: 8, display: "grid", placeItems: "center" }}><CircularProgress size={24} /></Box></Box>;
  }

  if ((query.error && !isHistoryOnly) || !entry) {
    return <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 2, sm: 3 }, py: 4 }}><ContentPageHeader breadcrumb={breadcrumb} title="Exercise not found" /><Alert severity="warning" sx={{ mt: 2 }} action={<Button color="inherit" size="small" onClick={() => query.refetch()}>Try again</Button>}>{query.error?.message || "This exercise may have been deleted or the link is invalid."}</Alert><Button component={RouterLink} to={CONTENT_PATHS.exerciseApprovalHistory} sx={{ mt: 2 }} startIcon={<ArrowBackRoundedIcon />}>Back to approval history</Button></Box>;
  }

  return (
    <Box sx={{ maxWidth: 960, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2.5, sm: 3 } }}>
      <ContentPageHeader
        breadcrumb={breadcrumb}
        title={entry.name}
        description={`Exercise / skill details · ${entry.code}`}
        action={<Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {!isHistoryView && <>
            <Button variant="outlined" color="error" disabled={busy} onClick={() => setConfirmAction("reject")}>{reject.isPending ? "Rejecting…" : "Reject"}</Button>
            <Button variant="contained" disabled={busy} onClick={() => setConfirmAction("approve")}>{approve.isPending ? "Approving…" : "Approve"}</Button>
          </>}
          <Button component={RouterLink} to={isHistoryView ? CONTENT_PATHS.exerciseApprovalHistory : CONTENT_PATHS.pendingExerciseModeration} variant="outlined" startIcon={<ArrowBackRoundedIcon />}>{isHistoryView ? "Back to approval history" : "Back to pending"}</Button>
        </Stack>}
      />

      {isHistoryView && <Box sx={{ mt: 1.5 }}><DarkPill tone={historyRow.decision === "APPROVED" ? "success" : "danger"}>{historyRow.decision === "APPROVED" ? "Approved" : "Rejected"}</DarkPill></Box>}
      {isHistoryOnly && <Alert severity="info" sx={{ mt: 2 }}>This exercise was deleted before its status could be updated. The details below are the information retained in the moderation history.</Alert>}
      {actionError && <Alert severity="error" sx={{ mt: 2 }}>{actionError}</Alert>}
      <Card sx={{ mt: 2.5 }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#fff" }}>Demo video</Typography>
          {entry.demoVideoUrl ? (
            <Box component="video" src={mediaUrl(entry.demoVideoUrl)} controls aria-label={`${entry.name} demo video`} sx={{ mt: 1.5, width: "100%", maxHeight: 420, borderRadius: 2, bgcolor: "#000", display: "block" }} />
          ) : <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>No demo video uploaded.</Typography>}

          <Divider sx={{ my: 2.5 }} />
          <Grid container spacing={2} alignItems="stretch">
            <Grid item xs={12} md={9} sx={{ display: "flex" }}>
              <Box sx={{ width: "100%", border: `1px solid ${CM.border}`, borderRadius: 1.5, p: { xs: 1.5, sm: 1.75 } }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#fff" }}>Muscle anatomy</Typography>
                {entry.anatomyImageUrl ? (
                  <Box component="img" src={mediaUrl(entry.anatomyImageUrl)} alt={`${entry.name} muscle anatomy`} sx={{ mt: 1.5, width: "100%", height: { xs: 280, sm: 340, md: 380 }, objectFit: "contain", borderRadius: 1, bgcolor: "rgba(19,10,39,0.7)", display: "block" }} />
                ) : <Box sx={{ minHeight: { xs: 280, sm: 340, md: 380 }, display: "grid", placeItems: "center" }}><Typography variant="body2" color="text.secondary">No anatomy image uploaded.</Typography></Box>}
              </Box>
            </Grid>
            <Grid item xs={12} md={3} sx={{ alignSelf: "flex-start", mt: { xs: 0, md: 8.75 } }}>
              <Grid container direction="column" spacing={1}>
                <DetailField label="Muscle group" value={entry.muscleGroup} full />
                <DetailField label="Type" value={entry.type} full />
                <DetailField label="Level" value={entry.level} full />
                <DetailField label="Default sets" value={entry.defaultSets} full />
                <DetailField label="Default reps" value={entry.defaultReps} full />
              </Grid>
            </Grid>
          </Grid>

          <Divider sx={{ my: 2.5 }} />
          <Grid container spacing={1.5}>
            <DetailField label="Description" value={entry.description} full />
            <Grid item xs={12}><Box sx={{ border: `1px solid ${CM.border}`, bgcolor: "rgba(19,10,39,0.6)", borderRadius: 1.5, p: 1.75 }}><Typography variant="caption" sx={{ color: CM.textDim, textTransform: "uppercase", fontSize: 10, fontWeight: 700 }}>Guide</Typography><Box sx={{ mt: 1.5 }}><GuideSteps guide={entry.guide} /></Box></Box></Grid>
            <DetailField label="Source" value="Custom" />
            <DetailField label="Created by" value={entry.createdByName || entry.createdBy} />
          </Grid>
        </CardContent>
      </Card>

      <Dialog open={Boolean(confirmAction)} onClose={() => setConfirmAction(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{confirmAction === "approve" ? "Approve exercise?" : "Reject exercise?"}</DialogTitle>
        <DialogContent><DialogContentText>{confirmAction === "approve" ? `Approve “${entry.name}” and add it to the active exercise list?` : `Reject “${entry.name}”? You will have 10 seconds to undo before its status is changed to rejected.`}</DialogContentText></DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAction(null)}>Cancel</Button>
          <Button color={confirmAction === "reject" ? "error" : "primary"} variant="contained" onClick={() => {
            const action = confirmAction;
            setConfirmAction(null);
            setActionError("");
            if (action === "approve") { approve.mutate(); return; }
            navigate(CONTENT_PATHS.pendingExerciseModeration, { state: { pendingReject: entry } });
          }}>{confirmAction === "reject" ? "Reject" : "Approve"}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
