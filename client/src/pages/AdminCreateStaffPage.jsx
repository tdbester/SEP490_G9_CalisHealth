import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import { hasNonAscii } from "../utils/authInput";

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const ROLE_OPTIONS = [
  {
    value: "ADMIN",
    labelKey: "admin.users.roleAdmin",
    descriptionKey: "admin.users.roleAdminDesc",
  },
  {
    value: "CONTENT_MANAGER",
    labelKey: "admin.users.roleContentManager",
    descriptionKey: "admin.users.roleContentManagerDesc",
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
  const { t } = useTranslation();
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
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{t(option.labelKey)}</Typography>
        <Typography sx={{ mt: 0.5, fontSize: 12.5, color: CM.textMuted, lineHeight: 1.5 }}>
          {t(option.descriptionKey)}
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
  const { t } = useTranslation();
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
              {t("admin.users.discardTitle")}
            </Typography>
          </Box>
        </Box>
        <Typography id="discard-desc" sx={{ fontSize: 13, lineHeight: 1.7, color: CM.textMuted }}>
          {t("admin.users.discardMessage")}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" onClick={onCancel} disabled={busy} sx={{ borderRadius: "10px" }}>
          {t("admin.users.keepEditing")}
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={busy}
          sx={{ borderRadius: "10px", bgcolor: CM.pink, color: "#2A0A14", "&:hover": { bgcolor: "#FF5C85" } }}
        >
          {busy ? t("admin.users.leaving") : t("admin.users.backAndDiscard")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Admin creates an Admin or Content Manager account (Figma create_staff_account_ui 1, node 146:1395). */
export default function AdminCreateStaffPage() {
  const { t } = useTranslation();
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
    fullName: form.fullName.trim() ? "" : t("admin.users.nameRequired"),
    email: !form.email.trim()
      ? t("admin.users.emailRequired")
      : !EMAIL_RE.test(form.email.trim())
        ? t("admin.users.emailInvalid")
        : emailTaken
          ? t("admin.users.emailTaken")
          : "",
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const asciiWarning = hasNonAscii(form.email);

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    setServerError("");
    if (asciiWarning) {
      setServerError(t("common.imeWarning"));
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
        state: {
          toast: t("admin.users.createdAs", {
            name: created.fullName,
            role: t(
              ROLE_OPTIONS.find((o) => o.value === created.role)?.labelKey
                ?? `role.${created.role?.toLowerCase()}`,
              created.role,
            ),
          }),
        },
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
      <Typography sx={{ fontSize: 13, color: CM.textMuted }}>{t("admin.users.createBreadcrumb")}</Typography>

      <Box sx={{ mt: 1, mb: 3 }}>
        <Typography component="h1" sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>
          {t("admin.users.createTitle")}
        </Typography>
        <Typography sx={{ mt: 0.75, fontSize: 13.5, color: CM.textMuted }}>
          {t("admin.users.createDescription")}
        </Typography>
      </Box>

      {serverError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setServerError("")}>
          {serverError}
        </Alert>
      )}

      <Box sx={{ display: "grid", gap: 2 }}>
        <Section title={t("admin.users.accountDetails")}>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
            <TextField
              label={t("admin.users.fullName")}
              value={form.fullName}
              onChange={set("fullName")}
              placeholder={t("admin.users.fullNamePlaceholder")}
              error={Boolean(show("fullName"))}
              helperText={show("fullName") || " "}
              inputProps={{ maxLength: 255 }}
              required
              autoFocus
              sx={fieldSx}
            />
            <TextField
              label={t("admin.users.email")}
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder={t("admin.users.emailPlaceholder")}
              error={Boolean(show("email"))}
              helperText={show("email") || " "}
              autoComplete="off"
              required
              sx={fieldSx}
            />
          </Box>
          <Typography sx={{ mt: -0.5, fontSize: 12, color: CM.textDim }}>
            {t("admin.users.emailHint")}
          </Typography>
        </Section>

        <Section title={t("admin.users.role")}>
          <Box role="radiogroup" aria-label={t("admin.users.roleAria")} sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
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

        <Section title={t("admin.users.initialPassword")}>
          <Typography sx={{ fontSize: 13.5, color: CM.textMuted, lineHeight: 1.6 }}>
            {t("admin.users.initialPasswordPrefix")}{" "}
            <Box component="code" sx={{ px: 0.75, py: 0.25, borderRadius: "6px", bgcolor: CM.surfaceSoft, color: CM.text }}>
              Test@123
            </Box>
            . {form.role === "CONTENT_MANAGER"
              ? t("admin.users.initialPasswordContentManager")
              : t("admin.users.initialPasswordAdmin")}
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
          {t("admin.users.back")}
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={busy}
          sx={{ borderRadius: "10px", px: 3, background: CM.buttonGradient, ml: "auto" }}
        >
          {busy ? t("admin.users.creating") : t("common.create")}
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
