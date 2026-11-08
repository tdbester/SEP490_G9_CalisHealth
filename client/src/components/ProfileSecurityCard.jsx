import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import { CM } from "../theme-content";
import { profileApi } from "../api/profile";
import { formatProfileDate } from "../api/profile";
import { hasNonAscii, isStrongPassword } from "../utils/authInput";
import { SectionCard, StatePill } from "./ProfileSections";

const EMPTY = { currentPassword: "", newPassword: "", confirmNewPassword: "" };

/**
 * Password input. Pass `visible` + `onToggle` to render the show/hide eye; without them the value
 * stays masked and no toggle is offered (the confirmation field works this way).
 */
function PasswordField({ label, value, onChange, autoComplete, visible, onToggle, showLabel, hideLabel }) {
  const canToggle = typeof onToggle === "function";
  return (
    <TextField
      label={label}
      type={visible ? "text" : "password"}
      value={value}
      onChange={onChange}
      fullWidth
      size="small"
      autoComplete={autoComplete}
      InputProps={
        canToggle
          ? {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    edge="end"
                    onClick={onToggle}
                    aria-label={visible ? hideLabel : showLabel}
                    sx={{ color: CM.textDim }}
                  >
                    {visible ? (
                      <VisibilityOffRoundedIcon sx={{ fontSize: 18 }} />
                    ) : (
                      <VisibilityRoundedIcon sx={{ fontSize: 18 }} />
                    )}
                  </IconButton>
                </InputAdornment>
              ),
            }
          : undefined
      }
      sx={{
        // Also hide the browser's own "reveal password" control (Edge/IE) so the value stays hidden.
        "& input::-ms-reveal, & input::-ms-clear": { display: "none" },
      }}
    />
  );
}

/**
 * "Security & sign-in" card: when the password was last changed plus an inline change-password form.
 * On success it reports the refreshed profile so the page can update the "Last changed" date and the
 * temporary-password warning without another request.
 */
export default function SecurityCard({ security, onChanged, delay = 0 }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [visible, setVisible] = useState({ currentPassword: false, newPassword: false });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const temporary = Boolean(security?.temporaryPassword);

  const toggle = (key) => () => setVisible((v) => ({ ...v, [key]: !v[key] }));
  const set = (key) => (event) => {
    const { value } = event.target;
    setForm((current) => ({ ...current, [key]: value }));
    if (error) setError("");
  };

  const handleOpen = () => {
    setForm(EMPTY);
    setVisible({ currentPassword: false, newPassword: false });
    setError("");
    setOpen(true);
  };

  const handleCancel = () => {
    setOpen(false);
    setForm(EMPTY);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (hasNonAscii(form.currentPassword) || hasNonAscii(form.newPassword)) {
      setError(t("common.security.asciiOnly"));
      return;
    }
    if (!isStrongPassword(form.newPassword)) {
      setError(t("common.passwordRule"));
      return;
    }
    if (form.newPassword !== form.confirmNewPassword) {
      setError(t("common.security.mismatch"));
      return;
    }

    setSaving(true);
    try {
      const updated = await profileApi.changePassword(form);
      onChanged?.(updated, t("common.security.changed"));
      setForm(EMPTY);
      setOpen(false);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          t("common.security.changeFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      icon={<LockRoundedIcon />}
      title={t("common.security.title")}
      description={t("common.security.description")}
      aside={
        <StatePill
          tone={temporary ? "warning" : "success"}
          icon={<LockRoundedIcon />}
          label={temporary ? t("common.security.temporaryPassword") : t("common.security.passwordProtected")}
        />
      }
      delay={delay}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        sx={{
          p: 2,
          borderRadius: "12px",
          border: `1px solid ${CM.border}`,
          backgroundColor: "rgba(12,8,27,0.35)",
          transition: "border-color .16s ease",
        }}
      >
        <Stack direction="row" spacing={1.75} alignItems="center" sx={{ minWidth: 0 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              flexShrink: 0,
              borderRadius: "12px",
              display: "grid",
              placeItems: "center",
              bgcolor: "rgba(139,92,246,0.16)",
              color: CM.violetBright,
            }}
          >
            <LockRoundedIcon sx={{ fontSize: 18 }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ color: "#fff", fontWeight: 600 }}>
              {t("common.security.password")}
            </Typography>
            <Typography variant="caption" sx={{ color: CM.textMuted, display: "block" }}>
              {t("common.security.lastChanged")}{" "}
              <Box component="span" sx={{ color: CM.text, fontWeight: 600 }}>
                {formatProfileDate(security?.passwordChangedAt) || "—"}
              </Box>
            </Typography>
            {temporary && (
              <Typography variant="caption" sx={{ color: CM.amber, display: "block", mt: 0.25 }}>
                {t("common.security.temporaryNotice")}
              </Typography>
            )}
          </Box>
        </Stack>

        {!open && (
          <Button variant="outlined" size="small" onClick={handleOpen} sx={{ flexShrink: 0 }}>
            {t("common.security.changePassword")}
          </Button>
        )}
      </Stack>

      {open && (
        <Box
          component="form"
          onSubmit={handleSubmit}
          noValidate
          sx={{
            mt: 2,
            p: 2,
            borderRadius: "14px",
            border: `1px solid ${CM.borderStrong}`,
            backgroundColor: CM.surfaceSoft,
          }}
        >
          <Typography variant="body2" sx={{ color: "#fff", fontWeight: 700 }}>
            {t("common.security.changePassword")}
          </Typography>
          <Typography variant="caption" sx={{ color: CM.textDim, display: "block", mt: 0.25, mb: 2 }}>
            {t("common.passwordRule")}.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
              {error}
            </Alert>
          )}

          <Stack spacing={1.75}>
            <PasswordField
              label={t("common.security.currentPassword")}
              value={form.currentPassword}
              onChange={set("currentPassword")}
              visible={visible.currentPassword}
              onToggle={toggle("currentPassword")}
              autoComplete="current-password"
              showLabel={t("common.security.show", { field: t("common.security.currentPassword") })}
              hideLabel={t("common.security.hide", { field: t("common.security.currentPassword") })}
            />
            <PasswordField
              label={t("common.security.newPassword")}
              value={form.newPassword}
              onChange={set("newPassword")}
              visible={visible.newPassword}
              onToggle={toggle("newPassword")}
              autoComplete="new-password"
              showLabel={t("common.security.show", { field: t("common.security.newPassword") })}
              hideLabel={t("common.security.hide", { field: t("common.security.newPassword") })}
            />
            <PasswordField
              label={t("common.security.confirmNewPassword")}
              value={form.confirmNewPassword}
              onChange={set("confirmNewPassword")}
              autoComplete="new-password"
            />
          </Stack>

          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
            <Button size="small" onClick={handleCancel} disabled={saving} sx={{ color: CM.textMuted }}>
              {t("common.security.cancel")}
            </Button>
            <Button type="submit" variant="contained" size="small" disabled={saving}>
              {saving ? t("common.security.saving") : t("common.security.updatePassword")}
            </Button>
          </Stack>
        </Box>
      )}
    </SectionCard>
  );
}
