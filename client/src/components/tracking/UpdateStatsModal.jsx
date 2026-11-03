import { useEffect, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AccessibilityNewRoundedIcon from "@mui/icons-material/AccessibilityNewRounded";
import MonitorHeartOutlinedIcon from "@mui/icons-material/MonitorHeartOutlined";
import {
  BMI_HEALTHY_MAX,
  BMI_HEALTHY_MIN,
  calculateBmi,
  classifyBmi,
} from "../../utils/bmi";
import ModalShell from "../common/ModalShell";
import "./UpdateStatsModal.css";

const FIELDS = {
  weight: { min: 20, max: 300, step: 0.1, decimals: 1, fallback: 60 },
  height: { min: 100, max: 250, step: 1, decimals: 0, fallback: 170 },
};

const RULER_TICKS = 13;

function clamp(value, { min, max }) {
  return Math.min(max, Math.max(min, value));
}

function isValid(value, field) {
  const number = Number(value);
  return value !== "" && Number.isFinite(number) && number >= field.min && number <= field.max;
}

function bmiMessage(bmiClass) {
  if (bmiClass.tone === "healthy") {
    return `Your BMI is within the recommended range of ${BMI_HEALTHY_MIN}–${BMI_HEALTHY_MAX}.`;
  }
  return `Your BMI is outside the recommended range of ${BMI_HEALTHY_MIN}–${BMI_HEALTHY_MAX}.`;
}

function Stepper({ icon: Icon, label, unit, value, field, onChange }) {
  const stepBy = (direction) => {
    const base = isValid(value, field) ? Number(value) : field.fallback;
    const next = clamp(base + direction * field.step, field);
    onChange(next.toFixed(field.decimals));
  };

  return (
    <div className="usm-stepper">
      <span className="usm-stepper-icon">
        <Icon />
      </span>
      <label className="usm-stepper-label" htmlFor={`usm-${label}`}>
        Current {label}
      </label>

      <div className="usm-stepper-row">
        <button
          type="button"
          className="usm-step-btn"
          aria-label={`Decrease ${label}`}
          onClick={() => stepBy(-1)}
        >
          <RemoveRoundedIcon />
        </button>
        <span className="usm-stepper-value">
          <input
            id={`usm-${label}`}
            type="number"
            inputMode="decimal"
            min={field.min}
            max={field.max}
            step={field.step}
            value={value}
            aria-invalid={!isValid(value, field)}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => {
              if (isValid(value, field)) onChange(Number(value).toFixed(field.decimals));
            }}
            style={{ width: `${Math.max(String(value).length, 2)}ch` }}
          />
          <span className="usm-stepper-unit">{unit}</span>
        </span>
        <button
          type="button"
          className="usm-step-btn"
          aria-label={`Increase ${label}`}
          onClick={() => stepBy(1)}
        >
          <AddRoundedIcon />
        </button>
      </div>

      <div className="usm-ruler" aria-hidden="true">
        {Array.from({ length: RULER_TICKS }, (_, i) => (
          <span
            key={i}
            className={`usm-tick ${i === Math.floor(RULER_TICKS / 2) ? "active" : ""} ${i % 4 === 0 ? "major" : ""}`}
          />
        ))}
      </div>
      <span className="usm-stepper-hint">
        Step {field.step} {unit}
      </span>
    </div>
  );
}

/**
 * Popup cập nhật cân nặng & chiều cao (5.2).
 * onSave nhận { weightKg, heightCm }; trang cha quyết định lưu ở đâu (state, API...).
 */
export default function UpdateStatsModal({ open, initialWeightKg, initialHeightCm, onClose, onSave }) {
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");

  useEffect(() => {
    if (!open) return;
    setWeight(initialWeightKg != null ? initialWeightKg.toFixed(1) : "");
    setHeight(initialHeightCm != null ? String(initialHeightCm) : "");
  }, [open, initialWeightKg, initialHeightCm]);

  const canSave = isValid(weight, FIELDS.weight) && isValid(height, FIELDS.height);
  const bmi = canSave ? calculateBmi(Number(weight), Number(height)) : null;
  const bmiClass = bmi != null ? classifyBmi(bmi) : null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSave) return;
    onSave({ weightKg: Number(weight), heightCm: Number(height) });
  };

  return (
    <ModalShell
      as="form"
      open={open}
      onClose={onClose}
      labelledBy="usm-title"
      onSubmit={handleSubmit}
    >
      <header className="usm-head">
        <div>
          <span className="usm-eyebrow">Body measurements</span>
          <h2 id="usm-title" className="usm-title">Update your stats</h2>
        </div>
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
          <CloseRoundedIcon />
        </button>
      </header>

      <div className="usm-grid">
        <Stepper
          icon={AccessibilityNewRoundedIcon}
          label="weight"
          unit="kg"
          value={weight}
          field={FIELDS.weight}
          onChange={setWeight}
        />
        <Stepper
          icon={MonitorHeartOutlinedIcon}
          label="height"
          unit="cm"
          value={height}
          field={FIELDS.height}
          onChange={setHeight}
        />
      </div>

      <div className="usm-bmi">
        <div className="usm-bmi-value">
          <span className="usm-bmi-label">BMI</span>
          <strong>{bmi != null ? bmi.toFixed(1) : "—"}</strong>
        </div>
        <div className="usm-bmi-info">
          {bmiClass ? (
            <>
              <span className={`usm-badge tone-${bmiClass.tone}`}>
                {bmiClass.tone === "healthy" ? "Healthy range" : bmiClass.label}
              </span>
              <p>{bmiMessage(bmiClass)}</p>
            </>
          ) : (
            <p>
              Enter a weight of {FIELDS.weight.min}–{FIELDS.weight.max} kg and a height of{" "}
              {FIELDS.height.min}–{FIELDS.height.max} cm.
            </p>
          )}
        </div>
      </div>

      <button type="submit" className="modal-primary-btn usm-save" disabled={!canSave}>
        Save measurements
        <ArrowForwardRoundedIcon />
      </button>
    </ModalShell>
  );
}
