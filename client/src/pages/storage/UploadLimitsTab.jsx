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
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import RestoreFromTrashOutlinedIcon from "@mui/icons-material/RestoreFromTrashOutlined";
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
 */
const SECTIONS = [
  {
    title: "Maximum size per file",
    sub: "Uploads larger than this are rejected before they are stored. Click a format to allow or block it.",
    fields: [
      { key: "maxVideoMb", label: "Videos", desc: "Exercise demo videos and form-check videos uploaded for AI assessment.", unit: "MB", min: 10, max: 500, icon: VideocamOutlinedIcon, tone: "violet", formats: ["videoFormats", VIDEO_FORMATS] },
      { key: "maxImageMb", label: "Images", desc: "Exercise anatomy images.", unit: "MB", min: 1, max: 20, icon: ImageOutlinedIcon, tone: "pink", formats: ["imageFormats", IMAGE_FORMATS] },
    ],
  },
  {
    title: "Video duration & member limits",
    sub: "Keeps each upload small and stops a single member from filling the system.",
    fields: [
      { key: "formCheckMaxSeconds", label: "Form-check video length", desc: "Videos uploaded for AI form assessment. Checked in the browser before uploading.", unit: "sec", min: 10, max: 180, icon: TimerOutlinedIcon, tone: "violet" },
      { key: "demoMaxSeconds", label: "Exercise demo video length", desc: "Demo videos of system and personal exercises.", unit: "sec", min: 30, max: 600, icon: TimerOutlinedIcon, tone: "violet" },
      { key: "memberQuotaMb", label: "Storage quota per member", desc: 'Personal exercises and form-check videos count toward it. Members see "Storage full" when it is reached.', unit: "MB", min: 50, max: 2000, icon: PersonOutlineOutlinedIcon, tone: "violet" },
      { key: "uploadsPerDay", label: "Uploads per member per day", desc: "Prevents spam and accidental repeated uploads.", unit: "files", min: 1, max: 50, icon: UploadFileOutlinedIcon, tone: "violet" },
    ],
  },
  {
    title: "Retention & auto-cleanup",
    sub: "How long media is kept. A daily job deletes expired files, so manual cleanup is only needed for exceptions.",
    fields: [
      { key: "formCheckRetentionDays", label: "Keep form-check videos for", desc: "The AI result (reps, score, form errors) is kept forever; only the video file expires.", unit: "days", min: 1, max: 30, icon: TimerOutlinedIcon, tone: "cyan", tag: "Temporary" },
      { key: "rejectedRetentionDays", label: "Keep rejected media for", desc: "Counted from the moderation rejection date, so the member can read the reason and resubmit.", unit: "days", min: 7, max: 90, icon: DeleteOutlineRoundedIcon, tone: "pink" },
      { key: "orphanGraceHours", label: "Grace period for orphaned files", desc: "Protects files that were just uploaded but whose form is not saved yet.", unit: "hours", min: 1, max: 72, icon: LinkOffRoundedIcon, tone: "amber" },
      { key: "trashRetentionDays", label: "Keep deleted files in trash for", desc: "Deleted and expired files stay restorable in the trash, then are deleted permanently. Storage is freed only at that point. 0 = delete immediately.", unit: "days", min: 0, max: 30, icon: RestoreFromTrashOutlinedIcon, tone: "violet", tag: "Soft delete" },
      { key: "restoreGraceDays", label: "Protect restored files for", desc: "After a file is restored from the trash, auto-cleanup leaves it alone for this long. Admins can still move it to the trash by hand. 0 = only until its original cleanup date.", unit: "days", min: 0, max: 30, icon: HistoryRoundedIcon, tone: "green" },
    ],
    toggle: { key: "autoCleanupEnabled", label: "Daily auto-cleanup", desc: "Runs every day at 03:00 (server time): moves expired files to the trash and permanently deletes trash past its period. Duplicate files are stored once (content hash).", icon: AutoDeleteOutlinedIcon, tone: "green" },
  },
  {
    title: "Storage quota & alerts",
    sub: "Total space the system may use. Admins are notified when usage crosses a threshold.",
    fields: [
      { key: "quotaGb", label: "Total storage quota", desc: "New uploads are blocked once the quota is reached. Must be higher than current usage.", unit: "GB", min: 1, max: 1000, icon: StorageRoundedIcon, tone: "cyan" },
      { key: "warningPercent", label: "Warning threshold", desc: "Shows a warning on Storage capacity and sends a notification.", unit: "%", min: 50, max: 95, icon: WarningAmberRoundedIcon, tone: "amber" },
      { key: "criticalPercent", label: "Critical threshold", desc: "Must be higher than the warning threshold.", unit: "%", min: 51, max: 99, icon: ReportGmailerrorredRoundedIcon, tone: "pink" },
    ],
  },
];

const FIELDS = SECTIONS.flatMap((s) => s.fields);
const EDITABLE_KEYS = [...FIELDS.map((f) => f.key), "videoFormats", "imageFormats", "autoCleanupEnabled"];

// Inputs hold strings ("100") while the API returns numbers (100), so scalars are compared as strings.
const same = (a, b) => (Array.isArray(a) ? [...a].sort().join() === [...b].sort().join() : String(a) === String(b));

function validate(form, usedBytes) {
  const errors = {};
  FIELDS.forEach(({ key, min, max }) => {
    const raw = form[key];
    const value = Number(raw);
    if (raw === "" || !Number.isInteger(value)) errors[key] = "Enter a whole number";
    else if (value < min || value > max) errors[key] = `Must be between ${min} and ${max}`;
  });
  if (!errors.quotaGb && Number(form.quotaGb) * GB <= usedBytes) {
    errors.quotaGb = `Must be higher than current usage (${formatBytes(usedBytes)})`;
  }
  if (!errors.criticalPercent && !errors.warningPercent && Number(form.criticalPercent) <= Number(form.warningPercent)) {
    errors.criticalPercent = "Must be higher than the warning threshold";
  }
  if (!form.videoFormats.length) errors.maxVideoMb = "Allow at least one video format";
  if (!form.imageFormats.length) errors.maxImageMb = "Allow at least one image format";
  return errors;
}

/** Extra hint under some inputs, computed from the current form. */
function liveHint(key, form, usedBytes) {
  const quota = Number(form.quotaGb) * GB;
  if (key === "quotaGb" && quota > 0) return `Currently ${Math.round((usedBytes / quota) * 100)}% used`;
  if ((key === "warningPercent" || key === "criticalPercent") && quota > 0) {
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
  const { data, isLoading, error, setData } = useApiQuery(() => adminStorageApi.settings());
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    document.title = "Upload limits | CalisHealth";
  }, []);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const changed = useMemo(
    () => (data && form ? EDITABLE_KEYS.filter((k) => !same(form[k], data[k])) : []),
    [data, form],
  );
  const errors = useMemo(() => (form ? validate(form, form.usedBytes) : {}), [form]);
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

  if (error) return <Alert severity="error">{apiErrorMessage(error, "Could not load upload settings.")}</Alert>;
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
      setToast("Upload settings saved. They apply to new uploads.");
    } catch (err) {
      setSaveError(apiErrorMessage(err, "Could not save the settings."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 980, display: "grid", gap: 3 }}>
      <Typography sx={{ fontSize: 13, color: CM.textMuted }}>
        Changes apply to new uploads only. {formatBytes(form.usedBytes)} of {formatBytes(Number(data.quotaGb) * GB)} used ·{" "}
        <Link component={RouterLink} to={STORAGE_PATHS.capacity} underline="hover" sx={{ fontWeight: 600, color: CM.violetBright }}>
          View storage capacity →
        </Link>
      </Typography>

      {SECTIONS.map((section) => (
        <Box key={section.title} component="section" sx={{ borderRadius: "16px", bgcolor: CM.surface, border: `1px solid ${CM.border}`, overflow: "hidden" }}>
          <Box sx={{ px: 2.5, pt: 2.25, pb: 2, borderBottom: `1px solid ${CM.border}` }}>
            <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700 }}>
              {section.title}
            </Typography>
            <Typography sx={{ mt: 0.25, fontSize: 13, color: CM.textDim }}>{section.sub}</Typography>
          </Box>

          {section.fields.map((f, index) => {
            const hint = liveHint(f.key, form, form.usedBytes);
            return (
              <SettingRow
                key={f.key}
                icon={f.icon}
                tone={f.tone}
                label={f.label}
                desc={f.desc}
                tag={f.tag}
                last={!section.toggle && index === section.fields.length - 1}
                control={
                  <TextField
                    type="number"
                    value={form[f.key]}
                    onChange={(e) => set(f.key, e.target.value)}
                    error={Boolean(errors[f.key])}
                    helperText={errors[f.key] || hint || `Allowed range: ${f.min} – ${f.max}`}
                    inputProps={{ min: f.min, max: f.max, step: 1, "aria-label": `${f.label} (${f.unit})`, style: { textAlign: "right" } }}
                    InputProps={{ endAdornment: <InputAdornment position="end">{f.unit}</InputAdornment> }}
                    FormHelperTextProps={{ sx: { textAlign: "right", mr: 0 } }}
                    sx={{ width: 190 }}
                  />
                }
              >
                {f.formats && (
                  <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }} role="group" aria-label={`${f.label} formats`}>
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

          {section.toggle && (
            <SettingRow
              icon={section.toggle.icon}
              tone={section.toggle.tone}
              label={section.toggle.label}
              desc={section.toggle.desc}
              last
              control={
                <>
                  <Switch
                    checked={form[section.toggle.key]}
                    onChange={(e) => set(section.toggle.key, e.target.checked)}
                    inputProps={{ "aria-label": section.toggle.label }}
                  />
                  {!form[section.toggle.key] && (
                    <Typography sx={{ fontSize: 12, color: CM.amber }}>Expired files will pile up</Typography>
                  )}
                </>
              }
            />
          )}
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
          Last updated by {data.updatedBy || "-"} · {fmtDateTime(data.updatedAt)}
        </Typography>
        {changed.length > 0 && (
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: CM.amber }}>
            {changed.length} unsaved change{changed.length === 1 ? "" : "s"}
          </Typography>
        )}
        <Button color="inherit" onClick={() => setForm(data)} disabled={!changed.length || saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} disabled={!changed.length || hasErrors || saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </Box>

      <Snackbar open={Boolean(toast)} autoHideDuration={4000} onClose={() => setToast("")} message={toast} />
    </Box>
  );
}
