import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  InputAdornment,
  Link,
  Skeleton,
  Snackbar,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LinkOffRoundedIcon from "@mui/icons-material/LinkOffRounded";
import AutoDeleteOutlinedIcon from "@mui/icons-material/AutoDeleteOutlined";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import ReportGmailerrorredRoundedIcon from "@mui/icons-material/ReportGmailerrorredRounded";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import RestoreFromTrashOutlinedIcon from "@mui/icons-material/RestoreFromTrashOutlined";
import { useTranslation } from "react-i18next";
import { adminStorageApi } from "../../api/adminStorage";
import { apiErrorMessage } from "../../api/adminUsers";
import { useApiQuery } from "../../hooks";
import { CM } from "../../theme-content";
import { fmtDateTime, formatBytes, IconBox, Pill, STORAGE_PATHS } from "./StorageShared";

const GB = 1024 ** 3;
const VIDEO_FORMATS = ["MP4", "MOV", "WEBM"];
const IMAGE_FORMATS = ["JPG", "PNG", "WEBP"];

/**
 * Numeric settings grouped by card. min/max are the allowed ranges (the backend validates the same ranges).
 * formats: the key of the format list edited in the same row.
 *
 * The titles, the descriptions and the labels come from the `storage` namespace, so the key of the
 * translation of each one is written next to it.
 */
const SECTIONS = [
  {
    key: "fileSize",
    fields: [
      { key: "maxVideoMb", unit: "MB", min: 10, max: 500, icon: VideocamOutlinedIcon, tone: "violet", formats: ["videoFormats", VIDEO_FORMATS] },
      { key: "maxImageMb", unit: "MB", min: 1, max: 20, icon: ImageOutlinedIcon, tone: "pink", formats: ["imageFormats", IMAGE_FORMATS] },
    ],
  },
  {
    key: "duration",
    fields: [
      { key: "demoMaxSeconds", unit: "sec", min: 10, max: 600, icon: TimerOutlinedIcon, tone: "violet" },
      { key: "memberQuotaMb", unit: "MB", min: 50, max: 2000, icon: PersonOutlineOutlinedIcon, tone: "violet" },
      { key: "uploadsPerDay", unit: "files", min: 1, max: 50, icon: UploadFileOutlinedIcon, tone: "violet" },
    ],
  },
  {
    key: "retention",
    fields: [
      { key: "rejectedRetentionDays", unit: "days", min: 7, max: 90, icon: DeleteOutlineRoundedIcon, tone: "pink" },
      { key: "orphanGraceHours", unit: "hours", min: 1, max: 72, icon: LinkOffRoundedIcon, tone: "amber" },
      { key: "trashRetentionDays", unit: "days", min: 0, max: 30, icon: RestoreFromTrashOutlinedIcon, tone: "violet", tag: "softDelete" },
      { key: "restoreGraceDays", unit: "days", min: 0, max: 30, icon: HistoryRoundedIcon, tone: "green" },
    ],
    toggle: { key: "autoCleanupEnabled", icon: AutoDeleteOutlinedIcon, tone: "green" },
  },
  {
    key: "quota",
    fields: [
      { key: "quotaGb", unit: "GB", min: 1, max: 1000, icon: StorageRoundedIcon, tone: "cyan" },
      { key: "warningPercent", unit: "percent", min: 50, max: 95, icon: WarningAmberRoundedIcon, tone: "amber" },
      { key: "criticalPercent", unit: "percent", min: 51, max: 99, icon: ReportGmailerrorredRoundedIcon, tone: "pink" },
      { key: "creditGuardThreshold", unit: "percent", min: 50, max: 100, icon: ShieldOutlinedIcon, tone: "green" },
    ],
    toggles: [{ key: "creditGuardEnabled", icon: ShieldOutlinedIcon, tone: "green", i18n: "toggleCreditGuard" }],
  },
];

const FIELDS = SECTIONS.flatMap((s) => s.fields);
const EDITABLE_KEYS = [
  ...FIELDS.map((f) => f.key),
  "videoFormats",
  "imageFormats",
  ...SECTIONS.flatMap((s) => s.toggles ?? []).map((tg) => tg.key),
  ...SECTIONS.filter((s) => s.toggle).map((s) => s.toggle.key),
];
// Inputs hold strings ("100") while the API returns numbers (100), so scalars are compared as strings.
const same = (a, b) => (Array.isArray(a) ? [...a].sort().join() === [...b].sort().join() : String(a) === String(b));

function validate(form, usedBytes, quotaEditable, t) {
  const errors = {};
  FIELDS.forEach(({ key, min, max }) => {
    if (key === "quotaGb" && !quotaEditable) return;
    const raw = form[key];
    const value = Number(raw);
    if (raw === "" || !Number.isInteger(value)) errors[key] = t("limits.errorInteger");
    else if (value < min || value > max) errors[key] = t("limits.errorRange", { min, max });
  });
  if (quotaEditable && !errors.quotaGb && Number(form.quotaGb) * GB <= usedBytes) {
    errors.quotaGb = t("limits.errorQuotaHigher", { used: formatBytes(usedBytes) });
  }
  if (!errors.criticalPercent && !errors.warningPercent && Number(form.criticalPercent) <= Number(form.warningPercent)) {
    errors.criticalPercent = t("limits.errorCriticalHigher");
  }
  // The guard acts without asking, so it must not run before the admins were warned.
  if (
    !errors.creditGuardThreshold &&
    !errors.criticalPercent &&
    Number(form.creditGuardThreshold) <= Number(form.criticalPercent)
  ) {
    errors.creditGuardThreshold = t("limits.errorGuardHigher");
  }
  if (!form.videoFormats.length) errors.maxVideoMb = t("limits.errorNoVideoFormat");
  if (!form.imageFormats.length) errors.maxImageMb = t("limits.errorNoImageFormat");
  return errors;
}

/** Extra hint under some inputs, computed from the current form. */
function liveHint(key, form, usedBytes, quotaEditable, t) {
  const quota = Number(form.quotaGb) * GB;
  if (key === "quotaGb" && quota > 0) {
    // With a plan that does not cap the storage, the quota is only a guideline: the percentage
    // would tell the admin that the system is nearly full when the plan says the opposite.
    if (!quotaEditable) return t("limits.hintGuidelineOnly");
    return t("limits.hintCurrentlyUsed", { percent: Math.round((usedBytes / quota) * 100) });
  }
  if ((key === "warningPercent" || key === "criticalPercent") && quota > 0 && quotaEditable) {
    return `= ${formatBytes((quota * Number(form[key])) / 100)}`;
  }
  return null;
}

function SettingRow({ icon, tone, label, desc, tag, control, children, last }) {
  return (
    <Box
      sx={{
        px: 2.5,
        py: 2,
        display: "flex",
        gap: 2,
        alignItems: "flex-start",
        flexWrap: { xs: "wrap", sm: "nowrap" },
        borderBottom: last ? "none" : `1px solid ${CM.border}`,
      }}
    >
      <IconBox icon={icon} tone={tone} size={40} />
      <Box sx={{ flex: 1, minWidth: 220 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{label}</Typography>
          {tag && <Pill tone={tone}>{tag}</Pill>}
        </Box>
        <Typography sx={{ mt: 0.5, fontSize: 13, color: CM.textMuted }}>{desc}</Typography>
        {children}
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>{control}</Box>
    </Box>
  );
}

/** Tab 3: upload limits, member limits, retention and quota (Figma "Admin / Upload limits"). */
export default function UploadLimitsTab() {
  const { t } = useTranslation("storage");
  const { data, isLoading, error, setData } = useApiQuery(() => adminStorageApi.settings());
  // The Cloudinary plan decides how much space there is, so the quota may not be typed by hand.
  const { data: quota } = useApiQuery(() => adminStorageApi.quota());
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [toast, setToast] = useState("");

  const quotaEditable = quota?.quotaEditable !== false;
  const planLimitBytes = quota?.planLimitBytes ?? 0;

  useEffect(() => {
    document.title = t("limits.documentTitle");
  }, [t]);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const changed = useMemo(
    () => (data && form ? EDITABLE_KEYS.filter((k) => (k === "quotaGb" && !quotaEditable ? false : !same(form[k], data[k]))) : []),
    [data, form, quotaEditable],
  );
  const errors = useMemo(() => (form ? validate(form, form.usedBytes, quotaEditable, t) : {}), [form, quotaEditable, t]);
  const hasErrors = Object.keys(errors).length > 0;

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!changed.length) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [changed.length]);

  if (error) return <Alert severity="error">{apiErrorMessage(error, t("limits.errorLoad"))}</Alert>;
  if (isLoading || !form) return <Skeleton variant="rounded" height={520} />;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const toggleFormat = (listKey, format) =>
    setForm((prev) => {
      const list = prev[listKey];
      return { ...prev, [listKey]: list.includes(format) ? list.filter((f) => f !== format) : [...list, format] };
    });

  const save = async () => {
    setSaving(true);
    setSaveError("");
    const payload = Object.fromEntries(
      EDITABLE_KEYS.map((k) => [k, typeof data[k] === "number" ? Number(form[k]) : form[k]]),
    );
    try {
      const saved = await adminStorageApi.updateSettings(payload);
      setData(saved);
      setToast(t("limits.saved"));
    } catch (err) {
      setSaveError(apiErrorMessage(err, t("limits.errorSave")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 980, display: "grid", gap: 3 }}>
      <Typography sx={{ fontSize: 13, color: CM.textMuted }}>
        {t("limits.intro", { used: formatBytes(form.usedBytes) })}
        {planLimitBytes > 0
          ? t("limits.contextPlanLimit", { limit: formatBytes(planLimitBytes) })
          : quotaEditable
            ? t("limits.contextQuota", { quota: formatBytes(Number(data.quotaGb) * GB) })
            : t("limits.contextCloudinary")}
        {" · "}
        <Link component={RouterLink} to={STORAGE_PATHS.capacity} underline="hover" sx={{ fontWeight: 600, color: CM.violetBright }}>
          {t("limits.viewCapacity")}
        </Link>
      </Typography>

      {SECTIONS.map((section) => (
        <Box key={section.key} component="section" sx={{ borderRadius: "16px", bgcolor: CM.surface, border: `1px solid ${CM.border}`, overflow: "hidden" }}>
          <Box sx={{ px: 2.5, pt: 2.25, pb: 2, borderBottom: `1px solid ${CM.border}` }}>
            <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700 }}>
              {t(`limits.sections.${section.key}.title`)}
            </Typography>
            <Typography sx={{ mt: 0.25, fontSize: 13, color: CM.textDim }}>{t(`limits.sections.${section.key}.sub`)}</Typography>
          </Box>

          {section.fields.map((f, index) => {
            const hint = liveHint(f.key, form, form.usedBytes, quotaEditable, t);
            // With Cloudinary the plan decides the limit, so the quota cannot be typed.
            const locked = f.key === "quotaGb" && !quotaEditable;
            const label = t(`limits.fields.${f.key}.label`);
            return (
              <SettingRow
                key={f.key}
                icon={f.icon}
                tone={f.tone}
                label={label}
                desc={
                  locked
                    ? planLimitBytes > 0
                      ? t("limits.lockedPlanLimit", {
                          plan: quota?.plan ? `${quota.plan} ` : "",
                          limit: formatBytes(planLimitBytes),
                        })
                      : t("limits.lockedCredits", { plan: quota?.plan ? `${quota.plan} ` : "" })
                    : t(`limits.fields.${f.key}.desc`)
                }
                tag={locked ? t("limits.tags.planLimit") : f.tag ? t(`limits.tags.${f.tag}`) : undefined}
                last={!section.toggle && index === section.fields.length - 1}
                control={
                  <TextField
                    type="number"
                    value={locked ? (planLimitBytes > 0 ? Math.round(planLimitBytes / GB) : form[f.key]) : form[f.key]}
                    onChange={(e) => set(f.key, e.target.value)}
                    error={Boolean(errors[f.key])}
                    disabled={locked && planLimitBytes > 0}
                    helperText={
                      errors[f.key] ||
                      hint ||
                      (locked
                        ? planLimitBytes > 0
                          ? t("limits.lockedReadOnly")
                          : t("limits.hintGuidelineOnly")
                        : t("limits.allowedRange", { min: f.min, max: f.max }))
                    }
                    inputProps={{ min: f.min, max: f.max, step: 1, "aria-label": `${label} (${f.unit})`, style: { textAlign: "right" } }}
                    InputProps={{ endAdornment: <InputAdornment position="end">{t(`limits.units.${f.unit}`)}</InputAdornment> }}
                    FormHelperTextProps={{ sx: { textAlign: "right", mr: 0 } }}
                    sx={{ width: 190 }}
                  />
                }
              >
                {f.formats && (
                  <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }} role="group" aria-label={t("limits.formatsAria", { label })}>
                    {f.formats[1].map((format) => {
                      const on = form[f.formats[0]].includes(format);
                      return (
                        <Chip
                          key={format}
                          label={format}
                          size="small"
                          variant={on ? "filled" : "outlined"}
                          icon={on ? <CheckRoundedIcon /> : undefined}
                          onClick={() => toggleFormat(f.formats[0], format)}
                          aria-pressed={on}
                          sx={{ color: on ? CM.text : CM.textDim }}
                        />
                      );
                    })}
                  </Box>
                )}
              </SettingRow>
            );
          })}

          {section.toggles?.map((toggle, toggleIndex) => (
            <SettingRow
              key={toggle.key}
              icon={toggle.icon}
              tone={toggle.tone}
              label={t(`limits.toggle${toggle.key.charAt(0).toUpperCase()}${toggle.key.slice(1)}.label`)}
              desc={t(`limits.toggle${toggle.key.charAt(0).toUpperCase()}${toggle.key.slice(1)}.desc`)}
              last={!section.toggles.slice(toggleIndex + 1).length && index === section.fields.length - 1}
              control={
                <>
                  <Switch
                    checked={form[toggle.key]}
                    onChange={(e) => set(toggle.key, e.target.checked)}
                    inputProps={{ "aria-label": t(`limits.toggle${toggle.key.charAt(0).toUpperCase()}${toggle.key.slice(1)}.label`) }}
                  />
                  {!form[toggle.key] && (
                    <Typography sx={{ fontSize: 12, color: CM.amber }}>
                      {t(`limits.toggle${toggle.key.charAt(0).toUpperCase()}${toggle.key.slice(1)}.offWarning`)}
                    </Typography>
                  )}
                </>
              }
            />
          ))}
        </Box>
      ))}

      {saveError && (
        <Alert severity="error" onClose={() => setSaveError("")}>
          {saveError}
        </Alert>
      )}

      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          flexWrap: "wrap",
          borderRadius: "12px",
          bgcolor: CM.surfaceAlt,
          border: `1px solid ${CM.border}`,
        }}
      >
        <HistoryRoundedIcon sx={{ fontSize: 17, color: CM.textDim }} />
        <Typography sx={{ flex: 1, minWidth: 240, fontSize: 13, color: CM.textDim }}>
          {t("limits.lastUpdated", { user: data.updatedBy || "-", date: fmtDateTime(data.updatedAt) })}
        </Typography>
        {changed.length > 0 && (
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: CM.amber }}>
            {t("limits.unsaved", { count: changed.length })}
          </Typography>
        )}
        <Button color="inherit" onClick={() => setForm(data)} disabled={!changed.length || saving}>
          {t("limits.cancel")}
        </Button>
        <Button variant="contained" onClick={save} disabled={!changed.length || hasErrors || saving}>
          {saving ? t("limits.saving") : t("limits.save")}
        </Button>
      </Box>

      <Snackbar open={Boolean(toast)} autoHideDuration={4000} onClose={() => setToast("")} message={toast} />
    </Box>
  );
}
