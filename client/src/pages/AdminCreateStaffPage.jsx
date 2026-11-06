import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { adminUsersApi, apiErrorMessage } from "../api/adminUsers";
import { CM } from "../theme-content";
import { hasNonAscii, IME_WARNING_MESSAGE } from "../utils/authInput";

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const ROLE_OPTIONS = [
  {
    value: "ADMIN",
    label: "Admin",
    description: "Full access to the whole system, including staff accounts and system settings.",
  },
  {
    value: "CONTENT_MANAGER",
    label: "Content manager",
    description: "Manages exercises, skills and notifications only.",
  },
];

const fieldSx = {
  "& .MuiOutlinedInput-root": { bgcolor: CM.surfaceSoft, borderRadius: "10px" },
};

function Section({ title, children }) {
  return (
    <Box
      component="section"
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: "16px",
        bgcolor: CM.surface,
        border: `1px solid ${CM.border}`,
      }}
    >
      <Typography component="h2" sx={{ mb: 2, fontSize: 15, fontWeight: 700 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function RoleCard({ option, selected, onSelect }) {
  return (
    <Box
      component="button"
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      sx={{
        all: "unset",
        boxSizing: "border-box",
        cursor: "pointer",
        flex: "1 1 240px",
        display: "flex",
        gap: 1.5,
        alignItems: "flex-start",
        p: 2,
        minHeight: 80,
        borderRadius: "12px",
        bgcolor: selected ? "rgba(139,92,246,0.16)" : CM.surfaceSoft,
        border: `1.5px solid ${selected ? CM.violet : CM.border}`,
        transition: "border-color .15s, background-color .15s",
        "&:hover": { borderColor: selected ? CM.violet : CM.borderStrong },
        "&:focus-visible": { outline: `2px solid ${CM.violetBright}`, outlineOffset: 2 },
      }}
    >
      <Box
        aria-hidden
        sx={{
          mt: 0.25,
          width: 18,
          height: 18,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          borderRadius: "50%",
          bgcolor: selected ? CM.violet : "transparent",
          border: selected ? "none" : `1.5px solid ${CM.textDim}`,
        }}
      >
        {selected && <CheckRoundedIcon sx={{ fontSize: 13, color: "#fff" }} />}
      </Box>
      <Box>
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{option.label}</Typography>
        <Typography sx={{ mt: 0.5, fontSize: 12.5, color: CM.textMuted, lineHeight: 1.5 }}>
          {option.description}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * Popup xác nhận trước khi rời màn tạo tài khoản.
 *
 * Member (admin) đang nhập dữ liệu chưa lưu — bấm Back sẽ mất sạch form nên
 * cần hỏi lại trước.
 */
function DiscardDialog({ open, busy, onCancel, onConfirm }) {
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onCancel}
      aria-labelledby="discard-title"
      aria-describedby="discard-desc"
      PaperProps={{
        sx: {
          width: 440,
          maxWidth: "calc(100% - 32px)",
          p: 1,
          borderRadius: "16px",
          bgcolor: CM.surface,
          border: `1px solid ${CM.borderStrong}`,
        },
      }}
    >
      <DialogContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
          <Box
            aria-hidden
            sx={{
              width: 36,
              height: 36,
              display: "grid",
              placeItems: "center",
              borderRadius: "50%",
              fontWeight: 800,
              color: CM.pink,
              bgcolor: "rgba(255,119,153,0.16)",
            }}
          >
            !
          </Box>
          <Box>
            <Typography id="discard-title" component="h2" sx={{ fontSize: 17, fontWeight: 700 }}>
              Discard this account?
            </Typography>
          </Box>
        </Box>
        <Typography id="discard-desc" sx={{ fontSize: 13, lineHeight: 1.7, color: CM.textMuted }}>
          You have unsaved changes. If you go back now, everything you have typed in
          this form will be lost.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" onClick={onCancel} disabled={busy} sx={{ borderRadius: "10px" }}>
          Keep editing
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={busy}
          sx={{ borderRadius: "10px", bgcolor: CM.pink, color: "#2A0A14", "&:hover": { bgcolor: "#FF5C85" } }}
        >
          {busy ? "Leaving…" : "Back and discard"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Admin creates an Admin or Content Manager account (Figma create_staff_account_ui 1, node 146:1395). */
export default function AdminCreateStaffPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    role: "CONTENT_MANAGER",
  });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState("");
  const [emailTaken, setEmailTaken] = useState(false);
  /** Mở popup xác nhận khi bấm Back mà form còn dữ liệu. */
  const [discardOpen, setDiscardOpen] = useState(false);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    if (key === "email") setEmailTaken(false);
  };

  const errors = {
    fullName: form.fullName.trim() ? "" : "Please enter the full name",
    email: !form.email.trim()
      ? "Please enter an email"
      : !EMAIL_RE.test(form.email.trim())
        ? "Invalid email format"
        : emailTaken
          ? "Email is already registered"
          : "",
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const asciiWarning = hasNonAscii(form.email);

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    setServerError("");
    if (asciiWarning) {
      setServerError(IME_WARNING_MESSAGE);
      return;
    }
    if (hasErrors) return;
    setBusy(true);
    try {
      const created = await adminUsersApi.create({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        role: form.role,
      });
      navigate("/admin/users", {
        replace: true,
        state: { toast: `${created.fullName} was created as ${ROLE_OPTIONS.find((o) => o.value === created.role)?.label ?? created.role}.` },
      });
    } catch (err) {
      if (err?.response?.status === 409) setEmailTaken(true);
      else setServerError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const show = (key) => touched && errors[key];

  /** Form còn dữ liệu chưa lưu — dùng để quyết định có cảnh báo khi Back. */
  const hasChanges =
    form.fullName.trim() !== "" || form.email.trim() !== "";

  /**
   * Bấm Back.
   *
   * Nếu form còn dữ liệu thì hỏi lại trước (sẽ mất dữ liệu nếu đi). Nếu
   * form trống thì ra luôn — không có gì để mất.
   */
  const handleBack = () => {
    if (busy) return;
    if (hasChanges) {
      setDiscardOpen(true);
      return;
    }
    navigate("/admin/users");
  };

  /** Xác nhận bỏ form -> rời màn. */
  const confirmDiscard = () => {
    navigate("/admin/users");
  };

  return (
    <Box component="form" onSubmit={submit} noValidate sx={{ p: { xs: 2, md: 3.5 }, maxWidth: 760 }}>
      <Typography sx={{ fontSize: 13, color: CM.textMuted }}>Admin / Users / Create</Typography>

      <Box sx={{ mt: 1, mb: 3 }}>
        <Typography component="h1" sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>
          Create staff account
        </Typography>
        <Typography sx={{ mt: 0.75, fontSize: 13.5, color: CM.textMuted }}>
          Create an admin or content manager account. Any admin can create these accounts.
        </Typography>
      </Box>

      {serverError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setServerError("")}>
          {serverError}
        </Alert>
      )}

      <Box sx={{ display: "grid", gap: 2 }}>
        <Section title="Account details">
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            <TextField
              label="Full name"
              value={form.fullName}
              onChange={set("fullName")}
              placeholder="e.g. Nguyen Van A"
              error={Boolean(show("fullName"))}
              helperText={show("fullName") || " "}
              inputProps={{ maxLength: 255 }}
              required
              autoFocus
              sx={fieldSx}
            />
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder="name@calishealth.com"
              error={Boolean(show("email"))}
              helperText={show("email") || " "}
              autoComplete="off"
              required
              sx={fieldSx}
            />
          </Box>
          <Typography sx={{ mt: -0.5, fontSize: 12, color: CM.textDim }}>
            Email is the login name and cannot be changed after creation.
          </Typography>
        </Section>

        <Section title="Role">
          <Box role="radiogroup" aria-label="Role" sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {ROLE_OPTIONS.map((o) => (
              <RoleCard
                key={o.value}
                option={o}
                selected={form.role === o.value}
                onSelect={() => setForm((f) => ({ ...f, role: o.value }))}
              />
            ))}
          </Box>
        </Section>

        <Section title="Initial password">
          <Typography sx={{ fontSize: 13.5, color: CM.textMuted, lineHeight: 1.6 }}>
            The account is created with the default password{" "}
            <Box component="code" sx={{ px: 0.75, py: 0.25, borderRadius: "6px", bgcolor: CM.surfaceSoft, color: CM.text }}>
              Test@123
            </Box>
            . {form.role === "CONTENT_MANAGER"
              ? "A content manager must change it on first login."
              : "An admin can keep using it, but should change it from their profile."}
          </Typography>
        </Section>
      </Box>

      {/* Thanh thao tác dưới cùng: Back bên trái, Create bên phải. */}
      <Box
        sx={{
          mt: 3,
          pt: 2.5,
          borderTop: `1px solid ${CM.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<ArrowBackRoundedIcon />}
          onClick={handleBack}
          disabled={busy}
          sx={{ borderRadius: "10px", borderColor: CM.borderStrong }}
        >
          Back
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={busy}
          sx={{ borderRadius: "10px", px: 3, background: CM.buttonGradient, ml: "auto" }}
        >
          {busy ? "Creating..." : "Create"}
        </Button>
      </Box>

      <DiscardDialog
        open={discardOpen}
        busy={busy}
        onCancel={() => setDiscardOpen(false)}
        onConfirm={confirmDiscard}
      />
    </Box>
  );
}
