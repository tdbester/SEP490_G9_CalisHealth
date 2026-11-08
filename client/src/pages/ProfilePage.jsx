import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import ShieldRoundedIcon from "@mui/icons-material/ShieldRounded";
import contentTheme, { CM } from "../theme-content";
import { formatProfileDate, profileApi, toDateInputValue } from "../api/profile";
import { fieldErrors } from "../utils/authInput";
import { FIELD_GRID, ReadOnlyField, SectionCard, StatePill, enter } from "../components/ProfileSections";
import ProfileAvatarCard from "../components/ProfileAvatarCard";
import ProfileSecurityCard from "../components/ProfileSecurityCard";
import FitnessLevelField from "../components/FitnessLevelField";
import "./ProfilePage.css";

/** Where "Back" returns to, per role. */
const ROLE_HOME = {
  ADMIN: "/admin/dashboard",
  CONTENT_MANAGER: "/content/dashboard",
  MEMBER: "/",
};

const EMPTY_FORM = {
  fullName: "",
  phone: "",
  gender: "",
  dateOfBirth: "",
  bio: "",
  fitnessLevel: "",
  daysPerWeek: "",
  goal: "",
};

/** 1..7 training days; the label spells out what the number means at a glance. */
const DAYS_PER_WEEK_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

function normalizeGoal(value) {
  const normalized = String(value || "").toUpperCase();
  if (normalized.includes("SKILL")) return "SKILLS";
  if (normalized.includes("HEALTH")) return "HEALTH";
  return "";
}

function toForm(profile) {
  if (!profile) return EMPTY_FORM;
  return {
    fullName: profile.fullName || "",
    phone: profile.phone || "",
    gender: profile.gender || "",
    dateOfBirth: toDateInputValue(profile.dateOfBirth),
    bio: profile.bio || "",
    fitnessLevel: profile.member?.levelName || "",
    // Seeded from the onboarding survey answer, then owned by this screen.
    daysPerWeek: profile.member?.daysPerWeek ? String(profile.member.daysPerWeek) : "",
    goal: normalizeGoal(profile.member?.goal),
  };
}

/**
 * Profile Information screen for MEMBER, CONTENT_MANAGER and ADMIN.
 *
 * It is mounted by three different layouts (the member shell, the Content Manager area and the Admin
 * area), so it brings its own dark theme and reads the account from /api/profile instead of trusting
 * the localStorage cache. Only the heading and the member fitness block vary by role.
 */
export default function ProfilePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [fieldError, setFieldError] = useState({});
  const [successMessage, setSuccessMessage] = useState("");

  /** Applies a fresh payload from any of the four endpoints and refreshes the cached display name. */
  const applyProfile = (data, message) => {
    setProfile(data);
    setForm(toForm(data));
    if (data?.email) {
      localStorage.setItem(
        "user",
        JSON.stringify({
          email: data.email,
          fullName: data.fullName,
          role: data.role,
          avatarUrl: data.avatarUrl || null,
        }),
      );
      window.dispatchEvent(new CustomEvent("profile-updated", { detail: data }));
    }
    if (message) setSuccessMessage(message);
  };

  useEffect(() => {
    let cancelled = false;
    profileApi
      .get()
      .then((data) => {
        if (!cancelled) applyProfile(data);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(() => {
    if (!profile) return false;
    return (
      form.fullName !== (profile.fullName || "") ||
      form.phone !== (profile.phone || "") ||
      form.gender !== (profile.gender || "") ||
      form.dateOfBirth !== toDateInputValue(profile.dateOfBirth) ||
      form.bio !== (profile.bio || "") ||
      form.fitnessLevel !== (profile.member?.levelName || "") ||
      form.daysPerWeek !== (profile.member?.daysPerWeek ? String(profile.member.daysPerWeek) : "") ||
      form.goal !== normalizeGoal(profile.member?.goal)
    );
  }, [form, profile]);

  const set = (key) => (event) => {
    const { value } = event.target;
    setForm((current) => ({ ...current, [key]: value }));
    if (saveError) setSaveError("");
    if (successMessage) setSuccessMessage("");
    if (fieldError[key]) setFieldError((current) => ({ ...current, [key]: "" }));
  };

  const handleReset = () => {
    setForm(toForm(profile));
    setSaveError("");
    setFieldError({});
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaveError("");
    setSuccessMessage("");

    if (!form.fullName.trim()) {
      setFieldError({ fullName: t("member.profile.fullNameRequired") });
      return;
    }

    setSaving(true);
    try {
      const updated = await profileApi.update({
        fullName: form.fullName,
        phone: form.phone,
        gender: form.gender,
        dateOfBirth: form.dateOfBirth || null,
        // An empty date input must clear the stored value, which JSON null alone cannot express.
        clearDateOfBirth: !form.dateOfBirth,
        bio: form.bio,
        fitnessLevel: form.fitnessLevel,
        daysPerWeek: form.daysPerWeek ? Number(form.daysPerWeek) : null,
        goal: form.goal,
      });
      applyProfile(updated, t("member.profile.saved"));
      setFieldError({});
    } catch (error) {
      const byField = fieldErrors(error);
      if (Object.keys(byField).length > 0) setFieldError(byField);
      else setSaveError(error?.response?.data?.message || t("member.profile.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------------

  if (loading) {
    return (
      <ThemeProvider theme={contentTheme}>
        <Box sx={{ minHeight: "55vh", display: "grid", placeItems: "center", bgcolor: CM.bg }}>
          <Stack spacing={1.5} alignItems="center">
            <CircularProgress size={26} />
            <Typography variant="body2" sx={{ color: CM.textMuted }}>
              Loading your profile…
            </Typography>
          </Stack>
        </Box>
      </ThemeProvider>
    );
  }

  if (loadError) {
    return (
      <ThemeProvider theme={contentTheme}>
        <Box sx={{ maxWidth: 720, mx: "auto", px: { xs: 2, sm: 3 }, py: 4, bgcolor: CM.bg }}>
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => window.location.reload()}>
                Try again
              </Button>
            }
          >
            {loadError?.response?.data?.message || t("member.profile.loadFailed")}
          </Alert>
        </Box>
      </ThemeProvider>
    );
  }

  const back = ROLE_HOME[profile?.role] || "/";
  const security = profile?.security;

  return (
    <ThemeProvider theme={contentTheme}>
      <Box
        className="profile-page"
        sx={{
          maxWidth: 940,
          mx: "auto",
          px: { xs: 2, sm: 3 },
          pt: { xs: 2.5, sm: 3 },
          pb: 14,
        }}
      >
        {/* ---- Heading ---- */}
        <Box className="profile-page-heading" sx={{ position: "relative", textAlign: "center", mb: 3, ...enter(0) }}>
          <Button
            onClick={() => navigate(back)}
            startIcon={<ArrowBackRoundedIcon sx={{ fontSize: 16 }} />}
            sx={{
              position: { xs: "static", sm: "absolute" },
              left: 0,
              top: 6,
              mb: { xs: 1.5, sm: 0 },
              px: 1,
              color: CM.textMuted,
              "&:hover": { color: CM.text },
            }}
          >
            Back
          </Button>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              color: CM.violetBright,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontSize: 10.5,
            }}
          >
            {t("member.profile.accountSettings")}
          </Typography>
          <Typography
            component="h1"
            sx={{
              mt: 0.75,
              fontSize: { xs: "1.7rem", sm: "2.2rem" },
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-0.032em",
              lineHeight: 1.15,
            }}
          >
            {t("member.profile.heading")}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: CM.textMuted, maxWidth: 480, mx: "auto" }}>
            {t("member.profile.intro")}
          </Typography>
        </Box>

        {successMessage && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage("")}>
            {successMessage}
          </Alert>
        )}

        <Stack spacing={2.5}>
          <ProfileAvatarCard profile={profile} onChanged={applyProfile} delay={40} />

          {/* ---- Account information (read-only) ---- */}
          <SectionCard
            icon={<BadgeOutlinedIcon />}
            title={t("member.profile.accountInfo")}
            description={t("member.profile.accountInfoDesc")}
            aside={
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <StatePill tone="primary" icon={<ShieldRoundedIcon />} label={profile?.roleLabel || "Member"} />
                {profile?.active && (
                  <StatePill tone="success" icon={<CheckCircleRoundedIcon />} label={t("member.profile.secure")} />
                )}
              </Stack>
            }
            delay={80}
          >
            <Box sx={FIELD_GRID}>
              <ReadOnlyField
                label={t("member.profile.emailAddress")}
                value={profile?.email}
                adornment={
                  profile?.emailVerified ? (
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: CM.green, flexShrink: 0 }}>
                      <CheckCircleRoundedIcon sx={{ fontSize: 14 }} />
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {t("member.profile.verified")}
                      </Typography>
                    </Stack>
                  ) : (
                    <Typography variant="caption" sx={{ color: CM.amber, flexShrink: 0, fontWeight: 600 }}>
                      {t("member.profile.notVerified")}
                    </Typography>
                  )
                }
              />
              <ReadOnlyField label={t("member.profile.joinDate")} value={formatProfileDate(profile?.memberSince)} />
            </Box>
          </SectionCard>

          {/* ---- Personal details (editable) ---- */}
          <Box component="form" onSubmit={handleSave} noValidate>
            <SectionCard
              icon={<PersonOutlineRoundedIcon />}
            title={t("member.profile.personalDetails")}
            description={t("member.profile.personalDetailsDesc")}
              delay={120}
            >
              {saveError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError("")}>
                  {saveError}
                </Alert>
              )}

              <Box sx={FIELD_GRID}>
                <TextField
                  label={t("member.profile.fullName")}
                  value={form.fullName}
                  onChange={set("fullName")}
                  required
                  fullWidth
                  size="small"
                  error={Boolean(fieldError.fullName)}
                  helperText={fieldError.fullName}
                  inputProps={{ autoComplete: "name", maxLength: 255 }}
                />
                <TextField
                  label={t("member.profile.phone")}
                  value={form.phone}
                  onChange={set("phone")}
                  fullWidth
                  size="small"
                  placeholder={t("member.profile.phonePlaceholder")}
                  error={Boolean(fieldError.phone)}
                  helperText={
                    fieldError.phone || t("member.profile.phoneHint")
                  }
                  inputProps={{ autoComplete: "tel", inputMode: "tel", maxLength: 30 }}
                />
                <TextField
                  select
                  label={t("member.profile.gender")}
                  value={form.gender}
                  onChange={set("gender")}
                  fullWidth
                  size="small"
                  helperText={fieldError.gender}
                  // The empty value keeps the label inside the box, so it must be shrunk by hand.
                  InputLabelProps={{ shrink: true }}
                  SelectProps={{
                    displayEmpty: true,
                    // Without this an account with no gender renders a blank box that looks broken.
                    renderValue: (selected) =>
                      selected || (
                        <Box component="span" sx={{ color: CM.textDim }}>
                          {t("member.profile.notSpecified")}
                        </Box>
                      ),
                    SelectDisplayProps: { "aria-label": t("member.profile.genderAria") },
                  }}
                >
                  <MenuItem value="">
                    <em>{t("member.profile.notSpecified")}</em>
                  </MenuItem>
                  {(profile?.genderOptions && profile.genderOptions.length > 0
                    ? profile.genderOptions
                    : ["Male", "Female", "Other", "Prefer not to say"]
                  ).map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
                {profile?.role === "MEMBER" ? (
                  <>
                    <TextField
                      label={t("member.profile.age")}
                      value={
                        profile?.age != null
                          ? t("member.profile.yearsOld", { count: profile.age })
                          : t("member.profile.notSpecified")
                      }
                      fullWidth
                      size="small"
                      InputProps={{ readOnly: true }}
                      helperText={t("member.profile.ageHelper")}
                    />
                    <TextField
                      select
                      label={t("member.profile.trainingDaysPerWeek")}
                      value={form.daysPerWeek}
                      onChange={set("daysPerWeek")}
                      fullWidth
                      size="small"
                      disabled={!profile?.member || saving}
                      error={Boolean(fieldError.daysPerWeek)}
                      helperText={
                        fieldError.daysPerWeek || t("member.profile.daysHelper")
                      }
                      InputLabelProps={{ shrink: true }}
                      SelectProps={{
                        displayEmpty: true,
                        renderValue: (selected) =>
                          selected ? (
                            t("member.profile.daysPerWeekValue", {
                              count: selected,
                              dayPlural: Number(selected) === 1 ? "day" : "days",
                            })
                          ) : (
                            <Box component="span" sx={{ color: CM.textDim }}>
                              {t("member.profile.notSet")}
                            </Box>
                          ),
                        SelectDisplayProps: { "aria-label": t("member.profile.trainingDaysPerWeek") },
                      }}
                    >
                      {DAYS_PER_WEEK_OPTIONS.map((days) => (
                        <MenuItem key={days} value={String(days)}>
                          {t("member.profile.daysPerWeekValue", {
                            count: days,
                            dayPlural: days === 1 ? "day" : "days",
                          })}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      label={t("member.profile.goal")}
                      value={form.goal}
                      onChange={set("goal")}
                      fullWidth
                      size="small"
                      disabled={!profile?.member || saving}
                      error={Boolean(fieldError.goal)}
                      helperText={fieldError.goal || t("member.profile.goalHelper")}
                      InputLabelProps={{ shrink: true }}
                    >
                      <MenuItem value="SKILLS">{t("member.profile.goalSkills")}</MenuItem>
                      <MenuItem value="HEALTH">{t("member.profile.goalHealth")}</MenuItem>
                    </TextField>
                    <FitnessLevelField
                      value={form.fitnessLevel}
                      options={profile?.fitnessLevelOptions || []}
                      currentLevel={profile?.member?.levelName || ""}
                      disabled={!profile?.member || saving}
                      onChange={(level) => {
                        setForm((current) => ({ ...current, fitnessLevel: level }));
                        if (saveError) setSaveError("");
                        if (successMessage) setSuccessMessage("");
                      }}
                    />
                  </>
                ) : (
                  <TextField
                    label={t("member.profile.dateOfBirth")}
                    type="date"
                    value={form.dateOfBirth}
                    onChange={set("dateOfBirth")}
                    fullWidth
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    helperText={t("member.profile.dateOfBirthHelper")}
                  />
                )}
                <TextField
                  label={t("member.profile.bioNote")}
                  value={form.bio}
                  onChange={set("bio")}
                  fullWidth
                  multiline
                  minRows={3}
                  maxRows={6}
                  size="small"
                  placeholder={t("member.profile.bioPlaceholder")}
                  error={Boolean(fieldError.bio)}
                  helperText={
                    fieldError.bio ||
                    t("member.profile.charCount", { count: form.bio.length })
                  }
                  inputProps={{ maxLength: 500 }}
                  sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}
                />
              </Box>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                justifyContent="flex-end"
                alignItems={{ xs: "stretch", sm: "center" }}
                className="profile-form-actions"
              >
                <Button
                  size="small"
                  onClick={handleReset}
                  disabled={!dirty || saving}
                  sx={{ color: CM.textMuted }}
                >
                  {t("member.profile.discardChanges")}
                </Button>
                <Button type="submit" variant="contained" size="small" disabled={!dirty || saving}>
                  {saving ? t("member.profile.saving") : t("member.profile.save")}
                </Button>
              </Stack>
            </SectionCard>
          </Box>

          <ProfileSecurityCard
            security={security}
            onChanged={applyProfile}
            delay={160}
          />
        </Stack>
      </Box>
    </ThemeProvider>
  );
}
