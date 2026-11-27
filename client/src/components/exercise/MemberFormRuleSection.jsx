import { useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../../api/client";
import {
  FORM_RULE_JOINTS,
  MOVEMENT_GROUPS,
  emptyRule,
  suggestionsToRules,
  validateFormRules,
  groupRuleErrors,
} from "./formRuleUtils";
import FormRuleFieldHelp from "./FormRuleFieldHelp";

/**
 * Khối khai báo ngưỡng chấm form cho Member (Tailwind).
 *
 * Member chọn nhóm chuyển động, bấm "Gợi ý" để lấy trung bình ngưỡng của các
 * bài đang có trong cùng nhóm, rồi chỉnh lại nếu muốn.
 *
 * Ô nhập góc hiển thị theo `category` vì công thức chấm của REPS và HOLD khác
 * nhau (xem `FormRuleEditor.jsx`). Chuyển loại bài không xoá giá trị đã nhập.
 *
 * @param {object} props
 * @param {Array} props.rules
 * @param {Function} props.onChange
 * @param {string} props.movementGroup
 * @param {Function} props.onMovementGroupChange
 * @param {string} props.category - REPS | HOLD
 */
export default function MemberFormRuleSection({
  rules,
  onChange,
  movementGroup,
  onMovementGroupChange,
  category,
}) {
  const { t } = useTranslation();
  const [suggesting, setSuggesting] = useState(false);
  const list = Array.isArray(rules) ? rules : [];

  const isHold = category === "HOLD";

  /**
   * Lỗi của từng rule — hiển thị ngay dưới ô sai để member biết chỗ nào
   * cần sửa, thay vì server trả lỗi chung.
   */
  const ruleErrors = validateFormRules(rules, category);
  const errorsByRule = groupRuleErrors(ruleErrors);
  const errorFor = (ruleIndex, field) => {
    const fields = errorsByRule.get(ruleIndex);
    if (!fields || !fields.has(field)) return null;
    const error = ruleErrors.find(
      (item) => item.ruleIndex === ruleIndex && item.field === field,
    );
    return error ? t(`contentManager.form.formRules.err.${error.key}`) : null;
  };

  const update = (index, patch) => {
    onChange(list.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  };

  const loadSuggestion = async () => {
    if (!movementGroup) return;
    setSuggesting(true);
    try {
      const { data } = await api.get("/member/form-rules/suggestions", {
        params: { movementGroup, category: category || undefined },
      });
      const suggested = suggestionsToRules(data?.suggestions || []);
      if (suggested.length) onChange(suggested);
    } catch {
      // Không lấy được gợi ý -> member vẫn tự nhập.
    } finally {
      setSuggesting(false);
    }
  };

  /**
   * Nhãn của một ô nhập kèm dấu hỏi giải thích.
   * Vì là `<input placeholder>` nên nhãn hiển thị bên cạnh ô (flex) thay vì
   * dùng placeholder thuần.
   */
  const fieldLabel = (field, text) => (
    <span className="flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
      <span>{text}</span>
      <FormRuleFieldHelp field={field} scope="member" />
    </span>
  );

  const numberField = (field, labelText, value, onChangeValue, step, errorText) => (
    <label className="flex flex-col gap-1">
      {fieldLabel(field, labelText)}
      <input
        type="number"
        step={step}
        value={value}
        onChange={(event) => onChangeValue(event.target.value)}
        aria-invalid={errorText ? "true" : undefined}
        className={`rounded-lg border bg-[#17102f] px-2 py-1.5 text-[11px] text-slate-200 ${
          errorText ? "border-rose-500/70" : "border-[#2b2257]"
        }`}
      />
      {errorText && (
        <span className="text-[10px] font-medium text-rose-300">{errorText}</span>
      )}
    </label>
  );

  return (
    <div className="rounded-2xl border border-[#2b2257] bg-[#0c0820]/70 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-200">
          {t("member.customExercise.formRules.title")}
        </p>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label={t("member.customExercise.formRules.movementGroup")}
            value={movementGroup}
            onChange={(event) => onMovementGroupChange(event.target.value)}
            className="rounded-lg border border-[#3b2c70] bg-[#17102f] px-2 py-1 text-[11px] text-slate-200"
          >
            <option value="">
              {t("member.customExercise.formRules.autoDetect")}
            </option>
            {MOVEMENT_GROUPS.map((group) => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={loadSuggestion}
            disabled={suggesting || !movementGroup}
            title={!movementGroup
              ? t("member.customExercise.formRules.pickGroupFirst")
              : undefined}
            className="rounded-lg border border-violet-500/50 bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold text-violet-100 disabled:opacity-50"
          >
            {suggesting
              ? t("member.customExercise.formRules.suggestLoading")
              : t("member.customExercise.formRules.suggest")}
          </button>
          <button
            type="button"
            onClick={() => onChange([...list, emptyRule()])}
            className="rounded-lg border border-[#3b2c70] bg-[#17102f] px-2.5 py-1 text-[11px] font-semibold text-slate-200"
          >
            {t("member.customExercise.formRules.addRule")}
          </button>
        </div>
      </div>

      <p className="mb-3 text-[11px] text-slate-400">
        {isHold
          ? t("formRuleHelp.categoryNoticeHold")
          : t("formRuleHelp.categoryNoticeReps")}
      </p>

      {list.map((rule, index) => (
        <div key={index} className="mb-3 space-y-2 rounded-xl border border-[#2b2257] bg-[#100b24] p-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <span>{t("member.customExercise.formRules.joint")}</span>
              <FormRuleFieldHelp field="joint" scope="member" />
            </span>
            <select
              aria-label={t("member.customExercise.formRules.joint")}
              value={rule.joint}
              onChange={(event) => update(index, { joint: event.target.value })}
              className="rounded-lg border border-[#3b2c70] bg-[#17102f] px-2 py-1 text-[11px] text-slate-200"
            >
              {FORM_RULE_JOINTS.map((joint) => (
                <option key={joint} value={joint}>{joint}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onChange(list.filter((_, i) => i !== index))}
              className="ml-auto rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-200"
            >
              {t("member.customExercise.formRules.removeRule")}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {isHold ? (
              <>
                {numberField(
                  "minAngle",
                  t("member.customExercise.formRules.minAngle"),
                  rule.minAngle,
                  (value) => update(index, { minAngle: value }),
                  undefined,
                  errorFor(index, "minAngle")
                )}
                {numberField(
                  "maxAngle",
                  t("member.customExercise.formRules.maxAngle"),
                  rule.maxAngle,
                  (value) => update(index, { maxAngle: value }),
                  undefined,
                  errorFor(index, "maxAngle")
                )}
              </>
            ) : (
              <>
                {numberField(
                  "topAngle",
                  t("member.customExercise.formRules.topAngle"),
                  rule.angleThreshold,
                  (value) => update(index, { angleThreshold: value }),
                  undefined,
                  errorFor(index, "angleThreshold")
                )}
                {numberField(
                  "bottomAngle",
                  t("member.customExercise.formRules.bottomAngle"),
                  rule.romDepth,
                  (value) => update(index, { romDepth: value }),
                  undefined,
                  errorFor(index, "romDepth")
                )}
              </>
            )}
            {numberField(
              "weight",
              t("member.customExercise.formRules.weight"),
              rule.weight,
              (value) => update(index, { weight: value }),
              "0.05",
              errorFor(index, "weight")
            )}
            {numberField(
              "tolerance",
              t("member.customExercise.formRules.tolerance"),
              rule.tolerance,
              (value) => update(index, { tolerance: value }),
              undefined,
              errorFor(index, "tolerance")
            )}
          </div>
        </div>
      ))}

      {list.length === 0 && (
        <p className="text-[11px] text-slate-500">
          {t("member.customExercise.formRules.emptyHint")}
        </p>
      )}
    </div>
  );
}
