import { useState } from "react";
import { Alert, Box, Button, Skeleton, Typography } from "@mui/material";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import CleaningServicesOutlinedIcon from "@mui/icons-material/CleaningServicesOutlined";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import { useTranslation } from "react-i18next";
import { adminStorageApi } from "../../api/adminStorage";
import { apiErrorMessage } from "../../api/adminUsers";
import { useApiQuery } from "../../hooks";
import { CM } from "../../theme-content";
import { formatBytes, IconBox, Panel, Pill } from "./StorageShared";

/**
 * The credit guard: the part of the app that frees space when the account is close to its limit.
 *
 * The plan of this app counts credits instead of bytes, so the account can run out of credits long
 * before it runs out of space. The thresholds of the Storage screen only tell the admins; the guard
 * acts as well: it deletes the media that is already deleted (the trash) and moves the media that
 * no exercise uses any more to the trash.
 *
 * The admin can also press the button to free the space right away, whatever the usage is.
 */
export default function CreditGuardPanel() {
  const { t } = useTranslation("storage");
  const { data, isLoading, error, refetch } = useApiQuery(() => adminStorageApi.creditGuard());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [actionError, setActionError] = useState(null);

  if (error) return <Alert severity="error">{apiErrorMessage(error, t("guard.errorLoad"))}</Alert>;
  if (isLoading || !data) return <Skeleton variant="rounded" height={200} />;

  const freeSpace = async () => {
    setBusy(true);
    setActionError(null);
    setResult(null);
    try {
      const outcome = await adminStorageApi.freeSpace();
      setResult(outcome);
      await refetch();
    } catch (err) {
      setActionError(apiErrorMessage(err, t("guard.errorFree")));
    } finally {
      setBusy(false);
    }
  };

  const tone = !data.enabled ? "muted" : data.active ? "pink" : "green";
  const label = !data.enabled ? t("guard.disabled") : data.active ? t("guard.active") : t("guard.ready");

  return (
    <Panel
      title={t("guard.title")}
      action={<Pill tone={tone}>{label}</Pill>}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.75, flexWrap: "wrap", mb: 2 }}>
        <IconBox icon={data.active ? WarningAmberRoundedIcon : CheckCircleOutlineRoundedIcon} tone={data.active ? "pink" : "green"} size={42} />
        <Box sx={{ flex: 1, minWidth: 260 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{t("guard.stateTitle")}</Typography>
          <Typography sx={{ mt: 0.25, fontSize: 12.5, color: CM.textMuted }}>{t("guard.hint")}</Typography>
        </Box>
        <Box sx={{ textAlign: "right" }}>
          <Typography sx={{ fontSize: 12, color: CM.textDim }}>{t("guard.usedPercent")}</Typography>
          <Typography sx={{ fontSize: 20, fontWeight: 700 }}>{data.usedPercent.toFixed(1)}%</Typography>
        </Box>
      </Box>

      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" } }}>
        <Box sx={{ p: 1.75, borderRadius: "10px", bgcolor: CM.surfaceSoft, border: `1px solid ${CM.border}` }}>
          <Typography sx={{ fontSize: 12, color: CM.textDim }}>{t("guard.statThreshold")}</Typography>
          <Typography sx={{ fontSize: 19, fontWeight: 700 }}>{data.threshold}%</Typography>
        </Box>
        <Box sx={{ p: 1.75, borderRadius: "10px", bgcolor: CM.surfaceSoft, border: `1px solid ${CM.border}` }}>
          <Typography sx={{ fontSize: 12, color: CM.textDim }}>{t("guard.statReclaimable")}</Typography>
          <Typography sx={{ fontSize: 19, fontWeight: 700 }}>{formatBytes(data.reclaimableBytes)}</Typography>
        </Box>
        <Box sx={{ p: 1.75, borderRadius: "10px", bgcolor: CM.surfaceSoft, border: `1px solid ${CM.border}` }}>
          <Typography sx={{ fontSize: 12, color: CM.textDim }}>{t("guard.statMode")}</Typography>
          <Typography sx={{ fontSize: 19, fontWeight: 700 }}>{data.enabled ? t("guard.statModeAuto") : t("guard.statModeManual")}</Typography>
        </Box>
      </Box>

      {data.reclaimableBytes > 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {t("guard.reclaimableHint", { bytes: formatBytes(data.reclaimableBytes) })}
        </Alert>
      )}

      {result && (
        <Alert severity={result.freedBytes > 0 ? "success" : "info"} sx={{ mt: 2 }}>
          {t("guard.result", {
            bytes: formatBytes(result.freedBytes),
            purged: result.purged,
            trashed: result.trashed,
          })}
        </Alert>
      )}
      {actionError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {actionError}
        </Alert>
      )}

      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end", gap: 1.5, flexWrap: "wrap" }}>
        <Button variant="outlined" onClick={freeSpace} disabled={busy || data.reclaimableBytes === 0} startIcon={<CleaningServicesOutlinedIcon />}>
          {busy ? t("guard.freeing") : t("guard.freeNow")}
        </Button>
        <Button variant="text" startIcon={<ShieldOutlinedIcon />} sx={{ color: CM.textMuted }}>
          {t("guard.configureHint")}
        </Button>
      </Box>
    </Panel>
  );
}
