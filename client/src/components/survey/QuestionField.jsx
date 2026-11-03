import { displayOf, questionLabel, widgetOf } from "../../utils/survey";
import { ChevronDown, SurveyIcon } from "./SurveyIcons";

/*
 * 1 câu hỏi khảo sát, hiển thị theo display_config.widget (xem utils/survey.js#widgetOf):
 *   number  thẻ có icon + ô số (Body information / Level test)
 *   select  thẻ có icon + dropdown (Gender)
 *   cards   2 thẻ lớn chọn hướng tập (For health / For skills)
 *   list    hàng lựa chọn có icon (health goal)
 *   chips   nút bo tròn, chọn 1 hoặc nhiều (skills, motivations)
 *   tiles   ô chọn (training experience, minutes per session)
 *   scale   dãy số min..max (days per week)
 * Câu hỏi mới do content manager thêm vẫn hiển thị được nhờ widget mặc định theo loại câu hỏi.
 */

const toggle = (list, code) => (list.includes(code) ? list.filter((c) => c !== code) : [...list, code]);

function FieldError({ id, message }) {
  return message ? (
    <p className="survey-field-error" id={id} role="alert">
      {message}
    </p>
  ) : null;
}

/** Thẻ có icon dùng cho number / select (Figma: gender-card, age-card... và các thẻ Level test). */
function IconCard({ question, compact, children, error, errorId }) {
  const display = displayOf(question);
  return (
    <div className={`survey-icon-card${compact ? " survey-icon-card--compact" : ""}${error ? " has-error" : ""}`}>
      <div className="survey-icon-card-head">
        <span className="survey-icon-tile">
          <SurveyIcon name={display.icon} />
        </span>
        <span className="survey-icon-card-titles">
          <span className="survey-icon-card-title">{questionLabel(question)}</span>
          {display.hint && <span className="survey-icon-card-hint">{display.hint}</span>}
        </span>
      </div>
      {children}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

function NumberField({ question, value, error, onChange, errorId }) {
  const display = displayOf(question);
  const rules = question.validationRules ?? {};
  return (
    <IconCard question={question} compact={Boolean(display.hint)} error={error} errorId={errorId}>
      <label className="survey-input">
        <input
          type="number"
          inputMode={rules.integerOnly ? "numeric" : "decimal"}
          min={rules.min}
          max={rules.max}
          step={rules.integerOnly ? 1 : "any"}
          placeholder={display.placeholder ?? ""}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          aria-label={questionLabel(question)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
        {question.unit && <span className="survey-input-unit">{question.unit}</span>}
      </label>
    </IconCard>
  );
}

function SelectField({ question, value, error, onChange, errorId }) {
  const display = displayOf(question);
  return (
    <IconCard question={question} error={error} errorId={errorId}>
      <label className="survey-input survey-input--select">
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          aria-label={questionLabel(question)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={value ? "" : "is-placeholder"}
        >
          <option value="" disabled>
            {display.placeholder ?? "Select an option"}
          </option>
          {question.options.map((o) => (
            <option key={o.optionCode} value={o.optionCode}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="survey-input-chevron">
          <ChevronDown />
        </span>
      </label>
    </IconCard>
  );
}

/** Nhóm lựa chọn có tiêu đề (list / chips / tiles / scale / boolean). */
function ChoiceGroup({ question, error, errorId, showTitle = true, children }) {
  const multiple = question.questionType === "MULTIPLE_SELECT";
  return (
    <section className="survey-question" role="group" aria-labelledby={`${errorId}-title`}>
      {showTitle && (
        <h2 className="survey-question-title" id={`${errorId}-title`}>
          {questionLabel(question)}
        </h2>
      )}
      {question.description && multiple && <p className="survey-question-hint">{question.description}</p>}
      {children}
      <FieldError id={errorId} message={error} />
    </section>
  );
}

/** Danh sách lựa chọn dạng nút; chọn 1 (SINGLE_SELECT) hoặc nhiều (MULTIPLE_SELECT). */
function OptionButtons({ question, value, onChange, className, renderOption }) {
  const multiple = question.questionType === "MULTIPLE_SELECT";
  const selected = (code) => (multiple ? (value ?? []).includes(code) : value === code);
  return (
    <div className={className}>
      {question.options.map((option) => (
        <button
          key={option.optionCode}
          type="button"
          className={selected(option.optionCode) ? "is-selected" : ""}
          aria-pressed={selected(option.optionCode)}
          onClick={() => onChange(multiple ? toggle(value ?? [], option.optionCode) : option.optionCode)}
        >
          {renderOption ? renderOption(option) : option.label}
        </button>
      ))}
    </div>
  );
}

function ScaleField({ question, value, onChange }) {
  const display = displayOf(question);
  const rules = question.validationRules ?? {};
  const min = display.min ?? rules.min ?? 1;
  const max = display.max ?? rules.max ?? 7;
  const numbers = Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);
  return (
    <div className="survey-scale">
      {numbers.map((n) => (
        <button
          key={n}
          type="button"
          className={String(value) === String(n) ? "is-selected" : ""}
          aria-pressed={String(value) === String(n)}
          onClick={() => onChange(String(n))}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export default function QuestionField({ question, value, error, onChange }) {
  const errorId = `q-${question.questionCode}`;
  const widget = widgetOf(question);
  const icons = displayOf(question).optionIcons ?? {};
  const common = { question, value, error, onChange, errorId };

  switch (widget) {
    case "select":
      return <SelectField {...common} />;
    case "cards":
      return (
        <ChoiceGroup {...common} showTitle={false}>
          <OptionButtons
            {...common}
            className="survey-path-cards"
            renderOption={(option) => (
              <>
                <span className="survey-path-card-icon">
                  <SurveyIcon name={icons[option.optionCode]} />
                </span>
                <span className="survey-path-card-label">{option.label}</span>
              </>
            )}
          />
        </ChoiceGroup>
      );
    case "list":
      return (
        <ChoiceGroup {...common}>
          <OptionButtons
            {...common}
            className="survey-option-list"
            renderOption={(option) => (
              <>
                <span className="survey-option-list-icon">
                  <SurveyIcon name={icons[option.optionCode]} />
                </span>
                <span className="survey-option-list-label">{option.label}</span>
              </>
            )}
          />
        </ChoiceGroup>
      );
    case "chips":
      return (
        <ChoiceGroup {...common}>
          <OptionButtons {...common} className="survey-chips" />
        </ChoiceGroup>
      );
    case "tiles":
      return (
        <ChoiceGroup {...common}>
          <OptionButtons {...common} className="survey-tiles" />
        </ChoiceGroup>
      );
    case "scale":
      return (
        <ChoiceGroup {...common}>
          <ScaleField {...common} />
        </ChoiceGroup>
      );
    case "boolean":
      return (
        <ChoiceGroup {...common}>
          <div className="survey-tiles">
            {[
              [true, "Yes"],
              [false, "No"],
            ].map(([option, label]) => (
              <button
                key={label}
                type="button"
                className={value === option ? "is-selected" : ""}
                aria-pressed={value === option}
                onClick={() => onChange(option)}
              >
                {label}
              </button>
            ))}
          </div>
        </ChoiceGroup>
      );
    case "text":
      return (
        <ChoiceGroup {...common}>
          <label className="survey-input survey-input--text">
            {question.questionType === "TEXTAREA" ? (
              <textarea rows={4} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
            ) : (
              <input type="text" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
            )}
          </label>
        </ChoiceGroup>
      );
    default:
      return <NumberField {...common} />;
  }
}
