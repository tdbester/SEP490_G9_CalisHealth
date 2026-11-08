import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ModalShell from "../common/ModalShell";
import { contentSurveyApi } from "../../api/contentSurvey";
import { surveyErrorMessage } from "../../api/survey";
import { DESCRIPTION_MAX, errorDetails } from "../../utils/contentSurvey";
import "./ContentSurvey.css";

/** Các ô số của kế hoạch gợi ý; khoảng giống ràng buộc của ResultConfig (BE). */
const NUMBER_FIELDS = [
  { key: "planDurationWeeks", labelKey: "contentManager.survey.planLength", unitKey: "contentManager.survey.unitWeeks", min: 1, max: 52 },
  { key: "sessionsPerWeek", labelKey: "contentManager.survey.sessionsPerWeek", unitKey: "contentManager.survey.unitSessions", min: 1, max: 7 },
  { key: "minutesPerSession", labelKey: "contentManager.survey.minutesPerSession", unitKey: "contentManager.survey.unitMin", min: 10, max: 180 },
];

const TOGGLES = [
  { key: "showLevelBreakdown", labelKey: "contentManager.survey.showLevelBreakdown", hintKey: "contentManager.survey.showLevelBreakdownHint" },
  { key: "showPlanPreview", labelKey: "contentManager.survey.showPlanPreview", hintKey: "contentManager.survey.showPlanPreviewHint" },
];

/**
 * Popup Configure bước "Result and recommended plan" (F9 / F10). Figma chưa có màn riêng nên dùng chung
 * bố cục với Update step. Nội dung kế hoạch theo level nằm ở bộ luật level (Level criteria).
 */
export default function ConfigureResultModal({ open, stepId, onClose, onSaved }) {
  const { t } = useTranslation();
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
      .catch((err) => setState({ status: "error", message: surveyErrorMessage(err, t("contentManager.survey.couldNotLoadStep")) }));
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
    if (!form.stepName.trim()) return setError({ text: t("contentManager.survey.stepNameRequired") });
    if (invalid) {
      return setError({
        text: t("contentManager.survey.numberRangeError", {
          label: t(invalid.labelKey),
          min: invalid.min,
          max: invalid.max,
        }),
      });
    }

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
      onSaved(t("contentManager.survey.stepSavedMessage", { name: form.stepName.trim() }));
    } catch (err) {
      setError({ text: surveyErrorMessage(err, t("contentManager.survey.couldNotSaveStep")), details: errorDetails(err) });
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
          <h2 id="result-config-title">{t("contentManager.survey.configureResult")}</h2>
          <p className="cs-muted">{t("contentManager.survey.configureResultCaption")}</p>
        </div>
        <button type="button" className="modal-close" aria-label={t("common.ui.closeAria")} onClick={onClose}>
          <CloseRoundedIcon />
        </button>
      </div>

      {state.status === "loading" && <p className="cs-muted cs-pad">{t("contentManager.survey.loadingConfiguration")}</p>}
      {state.status === "error" && (
        <div className="cs-alert error" role="alert">
          <p>{state.message}</p>
          <button type="button" className="cs-text-btn" onClick={load}>
            {t("contentManager.detail.tryAgain")}
          </button>
        </div>
      )}

      {state.status === "ready" && form && (
        <>
          <label className="cs-field">
            <span className="cs-label">{t("contentManager.survey.stepName")}</span>
            <input className="cs-input" value={form.stepName} maxLength={255} onChange={(e) => set("stepName", e.target.value)} />
          </label>

          <label className="cs-field">
            <span className="cs-label">{t("contentManager.survey.description")}</span>
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
            <span className="cs-label cs-label--lg">{t("contentManager.survey.recommendedPlan")}</span>
            <div className="cs-number-grid">
              {NUMBER_FIELDS.map(({ key, labelKey, unitKey, min, max }) => (
                <label key={key} className="cs-number">
                  <span className="cs-label">{t(labelKey)}</span>
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
                    <small>{t(unitKey)}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="cs-field">
            <span className="cs-label cs-label--lg">{t("contentManager.survey.resultScreen")}</span>
            {TOGGLES.map(({ key, labelKey, hintKey }) => (
              <label key={key} className="cs-toggle-row">
                <span>
                  <strong>{t(labelKey)}</strong>
                  <small>{t(hintKey)}</small>
                </span>
                <span className="cs-switch">
                  <input type="checkbox" checked={Boolean(form[key])} onChange={(e) => set(key, e.target.checked)} />
                  <span className="cs-switch-track" />
                </span>
              </label>
            ))}
          </div>

          <label className="cs-field">
            <span className="cs-label">{t("contentManager.survey.fallbackLevel")}</span>
            <select
              className="cs-input"
              value={form.fallbackFitnessLevelId ?? ""}
              onChange={(e) => set("fallbackFitnessLevelId", e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{t("contentManager.survey.noLevel")}</option>
              {state.fitnessLevels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <span className="cs-muted">{t("contentManager.survey.fallbackLevelHint")}</span>
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
              {t("common.ui.close")}
            </button>
            <button type="submit" className="cs-primary-btn" disabled={saving}>
              {saving ? t("contentManager.detail.saving") : t("contentManager.survey.saveChanges")}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
