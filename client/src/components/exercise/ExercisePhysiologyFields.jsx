import {
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Slider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { useTranslation } from "react-i18next";
import { CM } from "../../theme-content";

/**
 * Form nhập hồ sơ sinh lý vận động cho Content Manager.
 *
 * <p>Dùng chung cho màn Create System Exercise và màn Edit (SystemExerciseDetailPage).
 * Chỉ bài tập hệ thống (source = SYSTEM) mới có hồ sơ này — bài tập do Member
 * tải lên không bao giờ được gán.
 */

export const CONTRACTION_TYPES = ["DYNAMIC", "ISOMETRIC", "STATIC"];
export const BP_EFFECTS = ["LOWERS", "NEUTRAL", "RAISES", "SPIKE_RISK"];
export const RISK_LEVELS = ["NONE", "LOW", "MODERATE", "HIGH"];
export const JOINTS = ["WRIST", "ELBOW", "SHOULDER", "SPINE", "HIP", "KNEE", "ANKLE"];

export const CONTRAINDICATION_OPTIONS = [
  { code: "hypertension", labelKey: "hypertension" },
  { code: "glaucoma", labelKey: "glaucoma" },
  { code: "asthma", labelKey: "asthma" },
  { code: "pregnancy", labelKey: "pregnancy" },
  { code: "osteoporosis", labelKey: "osteoporosis" },
  { code: "cardiac_condition", labelKey: "cardiac_condition" },
  { code: "wrist_pain", labelKey: "wrist_pain" },
  { code: "elbow_pain", labelKey: "elbow_pain" },
  { code: "shoulder_pain", labelKey: "shoulder_pain" },
  { code: "shoulder_impingement", labelKey: "shoulder_impingement" },
  { code: "knee_pain", labelKey: "knee_pain" },
  { code: "lower_back_pain", labelKey: "lower_back_pain" },
];

/** Chuẩn hoá 1 mục bệnh cần lưu ý: cắt khoảng trắng, bỏ mục rỗng. */
export function normalizeContraindications(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const text = String(raw ?? "").trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text.slice(0, 120));
  }
  return out;
}

/** Hồ sơ rỗng — dùng làm mặc định cho bài mới và để reset khi bấm "Xoá hồ sơ". */
export const EMPTY_PHYSIOLOGY = {
  contractionType: "DYNAMIC",
  leverGrade: 3,
  cardiovascularLoad: 3,
  hrZoneLow: 60,
  hrZoneHigh: 80,
  bloodPressureEffect: "NEUTRAL",
  valsalvaRisk: "LOW",
  giRisk: "NONE",
  tendonLoad: 3,
  primaryJoint: "KNEE",
  breathingCue: "",
  contraindications: [],
  physiologyNote: "",
  evidenceRefs: [],
};

function RangeSlider({ label, value, onChange, min = 1, max = 5, helper }) {
  const { t } = useTranslation();
  return (
    <Box>
      <Typography variant="caption" sx={{ color: CM.textMuted }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.25 }}>
        <Slider
          size="small"
          value={Number.isFinite(value) ? value : min}
          min={min}
          max={max}
          step={1}
          marks
          onChange={(_, next) => onChange(next)}
          sx={{ flex: 1, maxWidth: 220 }}
        />
        <Typography variant="body2" sx={{ color: "#fff", fontWeight: 700, minWidth: 32 }}>
          {value ?? "—"}
        </Typography>
      </Stack>
      {helper && (
        <Typography variant="caption" sx={{ color: CM.textMuted, display: "block" }}>
          {helper}
        </Typography>
      )}
    </Box>
  );
}

export default function ExercisePhysiologyFields({ value, onChange }) {
  const { t } = useTranslation();

  const physiology = { ...EMPTY_PHYSIOLOGY, ...(value || {}) };
  const set = (patch) => onChange({ ...physiology, ...patch });

  const contraindications = Array.isArray(physiology.contraindications)
    ? physiology.contraindications
    : [];

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          select
          label={t("contentManager.form.physiology.contractionType")}
          size="small"
          fullWidth
          value={physiology.contractionType}
          onChange={(event) => set({ contractionType: event.target.value })}
        >
          {CONTRACTION_TYPES.map((option) => (
            <MenuItem key={option} value={option}>
              {t(`contentManager.form.physiology.contractionTypes.${option}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label={t("contentManager.form.physiology.primaryJoint")}
          size="small"
          fullWidth
          value={physiology.primaryJoint}
          onChange={(event) => set({ primaryJoint: event.target.value })}
        >
          {JOINTS.map((option) => (
            <MenuItem key={option} value={option}>
              {t(`contentManager.form.physiology.joints.${option}`)}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <RangeSlider
        label={t("contentManager.form.physiology.leverGrade")}
        value={physiology.leverGrade}
        onChange={(next) => set({ leverGrade: next })}
        helper={t("contentManager.form.physiology.leverGradeHint")}
      />
      <RangeSlider
        label={t("contentManager.form.physiology.cardiovascularLoad")}
        value={physiology.cardiovascularLoad}
        onChange={(next) => set({ cardiovascularLoad: next })}
        helper={t("contentManager.form.physiology.cardiovascularLoadHint")}
      />
      <RangeSlider
        label={t("contentManager.form.physiology.tendonLoad")}
        value={physiology.tendonLoad}
        onChange={(next) => set({ tendonLoad: next })}
        helper={t("contentManager.form.physiology.tendonLoadHint")}
      />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          label={t("contentManager.form.physiology.hrZoneLow")}
          type="number"
          size="small"
          fullWidth
          value={physiology.hrZoneLow}
          onChange={(event) => set({ hrZoneLow: event.target.value === "" ? "" : Number(event.target.value) })}
          inputProps={{ min: 30, max: 95, step: 1 }}
        />
        <TextField
          label={t("contentManager.form.physiology.hrZoneHigh")}
          type="number"
          size="small"
          fullWidth
          value={physiology.hrZoneHigh}
          onChange={(event) => set({ hrZoneHigh: event.target.value === "" ? "" : Number(event.target.value) })}
          inputProps={{ min: 30, max: 100, step: 1 }}
        />
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          select
          label={t("contentManager.form.physiology.bloodPressureEffect")}
          size="small"
          fullWidth
          value={physiology.bloodPressureEffect}
          onChange={(event) => set({ bloodPressureEffect: event.target.value })}
        >
          {BP_EFFECTS.map((option) => (
            <MenuItem key={option} value={option}>
              {t(`contentManager.form.physiology.bpEffects.${option}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label={t("contentManager.form.physiology.valsalvaRisk")}
          size="small"
          fullWidth
          value={physiology.valsalvaRisk}
          onChange={(event) => set({ valsalvaRisk: event.target.value })}
        >
          {RISK_LEVELS.map((option) => (
            <MenuItem key={option} value={option}>
              {t(`contentManager.form.physiology.riskLevels.${option}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label={t("contentManager.form.physiology.giRisk")}
          size="small"
          fullWidth
          value={physiology.giRisk}
          onChange={(event) => set({ giRisk: event.target.value })}
        >
          {RISK_LEVELS.map((option) => (
            <MenuItem key={option} value={option}>
              {t(`contentManager.form.physiology.riskLevels.${option}`)}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <TextField
        label={t("contentManager.form.physiology.breathingCue")}
        size="small"
        fullWidth
        value={physiology.breathingCue}
        onChange={(event) => set({ breathingCue: event.target.value })}
        placeholder={t("contentManager.form.physiology.breathingCuePlaceholder")}
        inputProps={{ maxLength: 150 }}
        helperText={`${(physiology.breathingCue || "").length}/150`}
      />

      <Box>
        <Typography variant="caption" sx={{ color: CM.textMuted }}>
          {t("contentManager.form.physiology.contraindications")}
        </Typography>
        <Typography variant="caption" sx={{ color: CM.textDim, display: "block", mt: 0.25 }}>
          {t("contentManager.form.physiology.contraindicationsHint")}
        </Typography>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {(contraindications.length === 0 ? [""] : contraindications).map((item, index) => (
            <Stack key={index} direction="row" spacing={1} alignItems="center">
              <Typography
                variant="caption"
                sx={{ width: 18, textAlign: "right", color: "primary.main", flexShrink: 0 }}
              >
                {index + 1}
              </Typography>
              <TextField
                size="small"
                fullWidth
                value={item}
                onChange={(event) => {
                  const next = [...(contraindications.length === 0 ? [""] : contraindications)];
                  next[index] = event.target.value;
                  set({ contraindications: next });
                }}
                onBlur={() => set({ contraindications: normalizeContraindications(contraindications) })}
                placeholder={t("contentManager.form.physiology.contraindicationsPlaceholder")}
                inputProps={{
                  maxLength: 120,
                  "aria-label": t("contentManager.form.physiology.contraindicationsAria", { number: index + 1 }),
                }}
              />
              <IconButton
                type="button"
                size="small"
                color="error"
                aria-label={t("contentManager.form.physiology.removeContraindicationAria", { number: index + 1 })}
                disabled={contraindications.length <= 1 && !String(item || "").trim()}
                onClick={() =>
                  set({
                    contraindications: normalizeContraindications(
                      contraindications.filter((_, i) => i !== index),
                    ),
                  })
                }
                sx={{ flexShrink: 0 }}
              >
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <Box>
            <Button
              type="button"
              size="small"
              variant="outlined"
              startIcon={<AddRoundedIcon />}
              onClick={() => set({ contraindications: [...normalizeContraindications(contraindications), ""] })}
            >
              {t("contentManager.form.physiology.addContraindication")}
            </Button>
          </Box>
        </Stack>
        {CONTRAINDICATION_OPTIONS.length > 0 && (
          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ mt: 1 }}>
            {CONTRAINDICATION_OPTIONS.map((option) => {
              const label = t(`contentManager.form.physiology.contraindicationsList.${option.labelKey}`, option.code);
              const alreadyAdded = normalizeContraindications(contraindications).some(
                (entry) => entry.toLowerCase() === label.toLowerCase() || entry.toLowerCase() === option.code.toLowerCase(),
              );
              if (alreadyAdded) return null;
              return (
                <Chip
                  key={option.code}
                  label={`+ ${label}`}
                  clickable
                  variant="outlined"
                  size="small"
                  onClick={() =>
                    set({ contraindications: [...normalizeContraindications(contraindications), label] })
                  }
                />
              );
            })}
          </Stack>
        )}
      </Box>

      <TextField
        label={t("contentManager.form.physiology.note")}
        size="small"
        multiline
        minRows={3}
        fullWidth
        value={physiology.physiologyNote}
        onChange={(event) => set({ physiologyNote: event.target.value })}
        placeholder={t("contentManager.form.physiology.notePlaceholder")}
      />
    </Stack>
  );
}
