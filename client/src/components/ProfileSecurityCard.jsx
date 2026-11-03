import { useState } from "react";
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
import { PASSWORD_RULE_MESSAGE, hasNonAscii, isStrongPassword } from "../utils/authInput";
import { SectionCard, StatePill } from "./ProfileSections";

const EMPTY = { currentPassword: "", newPassword: "", confirmNewPassword: "" };

/**
 * Password input. Pass `visible` + `onToggle` to render the show/hide eye; without them the value
 * stays masked and no toggle is offered (the confirmation field works this way).
 */
function PasswordField({ label, value, onChange, autoComplete, visible, onToggle }) {
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
                    aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
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
      setError("Use English characters only for passwords.");
      return;
    }
    if (!isStrongPassword(form.newPassword)) {
      setError(PASSWORD_RULE_MESSAGE);
      return;
    }
    if (form.newPassword !== form.confirmNewPassword) {
      setError("The confirmation password does not match");
      return;
    }

    setSaving(true);
    try {
      const updated = await profileApi.changePassword(form);
      onChanged?.(updated, "Your password has been changed.");
      setForm(EMPTY);
      setOpen(false);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          "Could not change your password. Please check your current password and try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      icon={<LockRoundedIcon />}
      title="Security & sign-in"
      description="Manage the password you use to sign in to your account."
      aside={
        <StatePill
          tone={temporary ? "warning" : "success"}
          icon={<LockRoundedIcon />}
          label={temporary ? "Temporary password" : "Password protected"}
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
              Password
            </Typography>
            <Typography variant="caption" sx={{ color: CM.textMuted, display: "block" }}>
              Last changed{" "}
              <Box component="span" sx={{ color: CM.text, fontWeight: 600 }}>
                {formatProfileDate(security?.passwordChangedAt) || "—"}
              </Box>
            </Typography>
            {temporary && (
              <Typography variant="caption" sx={{ color: CM.amber, display: "block", mt: 0.25 }}>
                You are still using the temporary password issued by an administrator.
              </Typography>
            )}
          </Box>
        </Stack>

        {!open && (
          <Button variant="outlined" size="small" onClick={handleOpen} sx={{ flexShrink: 0 }}>
            Change password
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
            Change password
          </Typography>
          <Typography variant="caption" sx={{ color: CM.textDim, display: "block", mt: 0.25, mb: 2 }}>
            {PASSWORD_RULE_MESSAGE}.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
              {error}
            </Alert>
          )}

          <Stack spacing={1.75}>
            <PasswordField
              label="Current password"
              value={form.currentPassword}
              onChange={set("currentPassword")}
              visible={visible.currentPassword}
              onToggle={toggle("currentPassword")}
              autoComplete="current-password"
            />
            <PasswordField
              label="New password"
              value={form.newPassword}
              onChange={set("newPassword")}
              visible={visible.newPassword}
              onToggle={toggle("newPassword")}
              autoComplete="new-password"
            />
            <PasswordField
              label="Confirm new password"
              value={form.confirmNewPassword}
              onChange={set("confirmNewPassword")}
              autoComplete="new-password"
            />
          </Stack>

          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
            <Button size="small" onClick={handleCancel} disabled={saving} sx={{ color: CM.textMuted }}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" size="small" disabled={saving}>
              {saving ? "Saving…" : "Update password"}
            </Button>
          </Stack>
        </Box>
      )}
    </SectionCard>
  );
}
