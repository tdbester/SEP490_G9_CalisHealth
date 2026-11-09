import { Alert, Box, Button, Link, Skeleton, Typography } from "@mui/material";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { useTranslation } from "react-i18next";
import { adminStorageApi } from "../../api/adminStorage";
import { apiErrorMessage } from "../../api/adminUsers";
import { useApiQuery } from "../../hooks";
import { CM } from "../../theme-content";
import { IconBox, Panel, Pill } from "./StorageShared";

/** One rule of the app, with the transformation it uses. */
function RuleRow({ icon, tone, label, rule, hint }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.75,
        p: 1.75,
        borderRadius: "10px",
        bgcolor: CM.surfaceSoft,
        border: `1px solid ${CM.border}`,
      }}
    >
      <IconBox icon={icon} tone={tone} size={38} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{label}</Typography>
        <Typography sx={{ fontSize: 12, color: CM.textDim }}>{hint}</Typography>
      </Box>
      <Typography
        sx={{
          fontSize: 12.5,
          fontFamily: "monospace",
          color: CM.textMuted,
          px: 1.25,
          py: 0.5,
          borderRadius: "6px",
          bgcolor: "rgba(139,92,246,0.10)",
          whiteSpace: "nowrap",
        }}
      >
        {rule}
      </Typography>
    </Box>
  );
}

/**
 * The rules that shrink the media before it is stored on the CDN.
 *
 * The admin sees what happens to an upload: Cloudinary applies the rule while the file goes up and
 * keeps the small version, so the account only pays for that one. The rules come from the
 * configuration of the app, so a deployment can change or turn them off.
 */
export default function CloudinaryOptimizationPanel() {
  const { t } = useTranslation("storage");
  const { data, isLoading, error } = useApiQuery(() => adminStorageApi.optimization());

  if (error) return <Alert severity="error">{apiErrorMessage(error, t("folders.errorLoad"))}</Alert>;
  if (isLoading || !data) return <Skeleton variant="rounded" height={220} />;

  return (
    <Panel
      title={t("optimization.title")}
      action={<Pill tone={data.enabled ? "green" : "amber"}>{data.enabled ? t("optimization.enabled") : t("optimization.disabled")}</Pill>}
    >
      <Typography sx={{ fontSize: 12.5, color: CM.textMuted, mb: 2 }}>{t("optimization.hint")}</Typography>

      {!data.enabled ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t("optimization.disabledHint")}
        </Alert>
      ) : (
        <Box sx={{ display: "grid", gap: 1.25 }}>
          <RuleRow
            icon={ImageOutlinedIcon}
            tone="pink"
            label={t("optimization.imageRule")}
            hint={t("optimization.imageWidth", { width: data.imageMaxWidth })}
            rule={data.imageRule}
          />
          <RuleRow
            icon={VideocamOutlinedIcon}
            tone="violet"
            label={t("optimization.videoRule")}
            hint={t("optimization.videoWidth", { width: data.videoMaxWidth })}
            rule={data.videoRule}
          />
          <RuleRow
            icon={AutoAwesomeOutlinedIcon}
            tone="cyan"
            label={t("optimization.deliveryRule")}
            hint={t("optimization.note")}
            rule={data.deliveryRule}
          />
        </Box>
      )}

      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
        <Link
          href="https://cloudinary.com/console/settings/upload"
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: 13, fontWeight: 600, color: CM.violetBright }}
        >
          {t("optimization.consoleHint")} <OpenInNewRoundedIcon sx={{ fontSize: 15 }} />
        </Link>
      </Box>
    </Panel>
  );
}
