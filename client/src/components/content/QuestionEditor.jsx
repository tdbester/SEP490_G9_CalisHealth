import { useState } from "react";
import { useTranslation } from "react-i18next";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { QUESTION_TYPES, isChoiceType, newOption, typeLabel } from "../../utils/contentSurvey";

/**
 * Soạn 1 câu hỏi ngay trong popup Create / Update step (kiểu Google Form): nội dung, mô tả, loại câu hỏi và
 * phần cấu hình theo loại (lựa chọn, khoảng giá trị + đơn vị, độ dài tối đa).
 * Câu đã có member trả lời / rule chấm level đang dùng: không đổi được loại (BE cũng chặn).
 */
export default function QuestionEditor({ row, position, onChange, onDone }) {
  const { t } = useTranslation();
  const [focusOptionKey, setFocusOptionKey] = useState(null);
  const update = (patch) => onChange({ ...patch, dirty: true });
  const setOptions = (options) => update({ options });

  const changeType = (questionType) => {
    const patch = { questionType };
    if (isChoiceType(questionType) && row.options.length === 0) {
      patch.options = [newOption(t("contentManager.survey.optionDefaultLabel", { index: 1 }))];
    }
    update(patch);
  };

  const addOption = (afterIndex = row.options.length - 1) => {
    const option = newOption(t("contentManager.survey.optionDefaultLabel", { index: row.options.length + 1 }));
    const next = [...row.options];
    next.splice(afterIndex + 1, 0, option);
    setOptions(next);
    setFocusOptionKey(option.key);
  };

  // Enter trong các ô của editor không được submit cả popup
  const blockEnter = (event) => {
    if (event.key === "Enter" && event.target.tagName === "INPUT") event.preventDefault();
  };

  const id = `question-${row.key}`;
  const lockHint = row.answered
    ? t("contentManager.survey.typeLockedAnswered")
    : t("contentManager.survey.typeLockedRule");

  return (
    <div className="cs-qe" onKeyDown={blockEnter}>
      <div className="cs-qe-top">
        <label className="cs-field cs-qe-title">
          <span className="cs-label">{t("contentManager.survey.questionLabel", { position })}</span>
          <input
            id={`${id}-title`}
            className="cs-input"
            value={row.title}
            maxLength={500}
            onChange={(e) => update({ title: e.target.value })}
            placeholder={t("contentManager.survey.untitledQuestion")}
            autoFocus={!row.questionCode && !row.title}
          />
        </label>
        <label className="cs-field cs-qe-type">
          <span className="cs-label">{t("contentManager.survey.answerType")}</span>
          <select
            className="cs-input cs-select"
            value={row.questionType}
            disabled={row.typeLocked}
            title={row.typeLocked ? lockHint : undefined}
            onChange={(e) => changeType(e.target.value)}
          >
            {QUESTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {typeLabel(type)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {row.typeLocked && <p className="cs-muted cs-qe-hint">{lockHint}</p>}

      <label className="cs-field">
        <span className="cs-label">{t("contentManager.survey.descriptionOptional")}</span>
        <input
          className="cs-input"
          value={row.description}
          maxLength={1000}
          onChange={(e) => update({ description: e.target.value })}
          placeholder={t("contentManager.survey.extraHelpPlaceholder")}
        />
      </label>

      {isChoiceType(row.questionType) && (
        <div className="cs-field">
          <span className="cs-label">{t("contentManager.survey.options")}</span>
          <ul className="cs-qe-options">
            {row.options.map((option, index) => (
              <li key={option.key}>
                <span
                  className={`cs-qe-marker ${row.questionType === "MULTIPLE_SELECT" ? "is-box" : ""}`}
                  aria-hidden="true"
                />
                <input
                  className="cs-input"
                  value={option.label}
                  maxLength={255}
                  aria-label={t("contentManager.survey.optionAria", { index: index + 1 })}
                  autoFocus={option.key === focusOptionKey}
                  onFocus={(e) => option.key === focusOptionKey && e.target.select()}
                  onChange={(e) =>
                    setOptions(row.options.map((o) => (o.key === option.key ? { ...o, label: e.target.value } : o)))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addOption(index);
                  }}
                />
                <button
                  type="button"
                  className="cs-icon-btn"
                  aria-label={t("contentManager.survey.removeOptionAria", { index: index + 1 })}
                  disabled={row.options.length === 1}
                  onClick={() => setOptions(row.options.filter((o) => o.key !== option.key))}
                >
                  <CloseRoundedIcon />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="cs-text-btn cs-qe-add" onClick={() => addOption()}>
            <AddRoundedIcon />
            {t("contentManager.survey.addOption")}
          </button>
          {row.answered && (
            <p className="cs-muted cs-qe-hint">{t("contentManager.survey.removedOptionsHidden")}</p>
          )}
          {row.questionType === "MULTIPLE_SELECT" && (
            <label className="cs-number cs-qe-narrow">
              <span className="cs-label">{t("contentManager.survey.maxSelections")}</span>
              <input
                className="cs-input"
                inputMode="numeric"
                value={row.maxSelections}
                onChange={(e) => update({ maxSelections: e.target.value })}
                placeholder={t("contentManager.survey.noLimit")}
              />
            </label>
          )}
        </div>
      )}

      {row.questionType === "NUMBER" && (
        <div className="cs-field">
          <span className="cs-label">{t("contentManager.survey.allowedRange")}</span>
          <div className="cs-number-grid">
            <label className="cs-number">
              <small className="cs-muted">{t("contentManager.survey.min")}</small>
              <input
                className="cs-input"
                inputMode="decimal"
                value={row.min}
                onChange={(e) => update({ min: e.target.value })}
                placeholder={t("contentManager.survey.noMinimum")}
              />
            </label>
            <label className="cs-number">
              <small className="cs-muted">{t("contentManager.survey.max")}</small>
              <input
                className="cs-input"
                inputMode="decimal"
                value={row.max}
                onChange={(e) => update({ max: e.target.value })}
                placeholder={t("contentManager.survey.noMaximum")}
              />
            </label>
            <label className="cs-number">
              <small className="cs-muted">{t("contentManager.survey.unit")}</small>
              <input
                className="cs-input"
                value={row.unit}
                maxLength={32}
                onChange={(e) => update({ unit: e.target.value })}
                placeholder={t("contentManager.survey.unitPlaceholder")}
              />
            </label>
          </div>
          <label className="cs-qe-check">
            <input type="checkbox" checked={row.integerOnly} onChange={(e) => update({ integerOnly: e.target.checked })} />
            {t("contentManager.survey.wholeNumbersOnly")}
          </label>
        </div>
      )}

      {(row.questionType === "TEXT" || row.questionType === "TEXTAREA") && (
        <label className="cs-number cs-qe-narrow">
          <span className="cs-label">{t("contentManager.survey.maxLength")}</span>
          <input
            className="cs-input"
            inputMode="numeric"
            value={row.maxLength}
            onChange={(e) => update({ maxLength: e.target.value })}
            placeholder={row.questionType === "TEXT" ? t("contentManager.survey.default255") : t("contentManager.survey.default2000")}
          />
        </label>
      )}

      {row.questionType === "BOOLEAN" && <p className="cs-muted">{t("contentManager.survey.booleanHint")}</p>}

      <div className="cs-qe-footer">
        <button type="button" className="cs-ghost-btn" onClick={onDone}>
          {t("contentManager.survey.done")}
        </button>
      </div>
    </div>
  );
}
