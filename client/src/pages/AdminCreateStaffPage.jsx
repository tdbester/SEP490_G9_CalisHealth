import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
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

  return (
    <Box component="form" onSubmit={submit} noValidate sx={{ p: { xs: 2, md: 3.5 }, maxWidth: 760 }}>
      <Typography sx={{ fontSize: 13, color: CM.textMuted }}>Admin / Users / Create</Typography>

      <Box
        sx={{
          mt: 1,
          mb: 3,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box>
          <Typography component="h1" sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>
            Create staff account
          </Typography>
          <Typography sx={{ mt: 0.75, fontSize: 13.5, color: CM.textMuted }}>
            Create an admin or content manager account. Any admin can create these accounts.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1.25 }}>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<ArrowBackRoundedIcon />}
            onClick={() => navigate("/admin/users")}
            disabled={busy}
            sx={{ borderRadius: "10px", borderColor: CM.borderStrong }}
          >
            Back
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={busy}
            sx={{ borderRadius: "10px", px: 3, background: CM.buttonGradient }}
          >
            {busy ? "Creating..." : "Create"}
          </Button>
        </Box>
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
    </Box>
  );
}
