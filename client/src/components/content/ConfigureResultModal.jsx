import { useCallback, useEffect, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ModalShell from "../common/ModalShell";
import { contentSurveyApi } from "../../api/contentSurvey";
import { surveyErrorMessage } from "../../api/survey";
import { DESCRIPTION_MAX, errorDetails } from "../../utils/contentSurvey";
import "./ContentSurvey.css";

/** Các ô số của kế hoạch gợi ý; khoảng giống ràng buộc của ResultConfig (BE). */
const NUMBER_FIELDS = [
  { key: "planDurationWeeks", label: "Plan length", unit: "weeks", min: 1, max: 52 },
  { key: "sessionsPerWeek", label: "Sessions per week", unit: "sessions", min: 1, max: 7 },
  { key: "minutesPerSession", label: "Minutes per session", unit: "min", min: 10, max: 180 },
];

const TOGGLES = [
  { key: "showLevelBreakdown", label: "Show level breakdown", hint: "How the level test scores placed the member." },
  { key: "showPlanPreview", label: "Show training plan preview", hint: "Lets members open the weekly plan." },
];

/**
 * Popup Configure bước "Result and recommended plan" (F9 / F10). Figma chưa có màn riêng nên dùng chung
 * bố cục với Update step. Nội dung kế hoạch theo level nằm ở bộ luật level (Level criteria).
 */
export default function ConfigureResultModal({ open, stepId, onClose, onSaved }) {
  const [state, setState] = useState({ status: "idle" });
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setState({ status: "loading" });
    setError(null);
    contentSurveyApi
      .getResultConfig(stepId)
      .then(({ step, config, fitnessLevels }) => {
        setForm({
          stepName: step.stepName,
          description: step.description ?? "",
          ...config,
          // ô số giữ chuỗi để gõ dở không bị mất
          planDurationWeeks: String(config.planDurationWeeks),
          sessionsPerWeek: String(config.sessionsPerWeek),
          minutesPerSession: String(config.minutesPerSession),
        });
        setState({ status: "ready", fitnessLevels });
      })
      .catch((err) => setState({ status: "error", message: surveyErrorMessage(err, "We could not load this step.") }));
  }, [stepId]);

  useEffect(() => {
    if (open && stepId) load();
  }, [open, stepId, load]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const invalid = NUMBER_FIELDS.find(({ key, min, max }) => {
      const n = Number(form[key]);
      return !Number.isInteger(n) || n < min || n > max;
    });
    if (!form.stepName.trim()) return setError({ text: "Step name is required." });
    if (invalid) return setError({ text: `${invalid.label} must be a whole number from ${invalid.min} to ${invalid.max}.` });

    setSaving(true);
    setError(null);
    try {
      await contentSurveyApi.updateResultConfig(stepId, {
        stepName: form.stepName.trim(),
        description: form.description.trim() || null,
        config: {
          showLevelBreakdown: form.showLevelBreakdown,
          showPlanPreview: form.showPlanPreview,
          planDurationWeeks: Number(form.planDurationWeeks),
          sessionsPerWeek: Number(form.sessionsPerWeek),
          minutesPerSession: Number(form.minutesPerSession),
          fallbackFitnessLevelId: form.fallbackFitnessLevelId ?? null,
        },
      });
      onSaved(`"${form.stepName.trim()}" was saved.`);
    } catch (err) {
      setError({ text: surveyErrorMessage(err, "We could not save this step."), details: errorDetails(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      labelledBy="result-config-title"
      className="cs-modal cs-modal--wide"
      as="form"
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="cs-modal-head">
        <div>
          <h2 id="result-config-title">Configure result</h2>
          <p className="cs-muted">System output · Uses the level criteria</p>
        </div>
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
          <CloseRoundedIcon />
        </button>
      </div>

      {state.status === "loading" && <p className="cs-muted cs-pad">Loading configuration…</p>}
      {state.status === "error" && (
        <div className="cs-alert error" role="alert">
          <p>{state.message}</p>
          <button type="button" className="cs-text-btn" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {state.status === "ready" && form && (
        <>
          <label className="cs-field">
            <span className="cs-label">Step name</span>
            <input className="cs-input" value={form.stepName} maxLength={255} onChange={(e) => set("stepName", e.target.value)} />
          </label>

          <label className="cs-field">
            <span className="cs-label">Description</span>
            <textarea
              className="cs-input cs-textarea"
              rows={3}
              value={form.description}
              maxLength={DESCRIPTION_MAX}
              onChange={(e) => set("description", e.target.value)}
            />
            <span className="cs-counter">
              {form.description.length} / {DESCRIPTION_MAX}
            </span>
          </label>

          <div className="cs-field">
            <span className="cs-label cs-label--lg">Recommended plan</span>
            <div className="cs-number-grid">
              {NUMBER_FIELDS.map(({ key, label, unit, min, max }) => (
                <label key={key} className="cs-number">
                  <span className="cs-label">{label}</span>
                  <span className="cs-input cs-input--unit">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={min}
                      max={max}
                      step={1}
                      value={form[key]}
                      onChange={(e) => set(key, e.target.value)}
                    />
                    <small>{unit}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="cs-field">
            <span className="cs-label cs-label--lg">Result screen</span>
            {TOGGLES.map(({ key, label, hint }) => (
              <label key={key} className="cs-toggle-row">
                <span>
                  <strong>{label}</strong>
                  <small>{hint}</small>
                </span>
                <span className="cs-switch">
                  <input type="checkbox" checked={Boolean(form[key])} onChange={(e) => set(key, e.target.checked)} />
                  <span className="cs-switch-track" />
                </span>
              </label>
            ))}
          </div>

          <label className="cs-field">
            <span className="cs-label">Fallback level</span>
            <select
              className="cs-input"
              value={form.fallbackFitnessLevelId ?? ""}
              onChange={(e) => set("fallbackFitnessLevelId", e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">No level</option>
              {state.fitnessLevels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <span className="cs-muted">Used when a member skips the level test or matches no criteria.</span>
          </label>

          {error && (
            <div className="cs-alert error" role="alert">
              <p>{error.text}</p>
              {error.details?.length > 0 && (
                <ul>
                  {error.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="cs-modal-actions">
            <button type="button" className="cs-ghost-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="cs-primary-btn" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
