import i18n from "../i18n";

/**
 * Dịch 1 key của namespace member.
 *
 * @param {string} key
 * @param {object} [options]
 * @returns {string}
 */
const t = (key, options) => i18n.t(key, options);

/*
 * Logic khảo sát dùng chung cho các màn onboarding. Mọi câu hỏi, lựa chọn, ràng buộc và điều kiện
 * hiển thị đều đến từ GET /api/surveys/{code}; file này chỉ diễn giải chúng giống hệt backend
 * (Condition.java, NumberQuestionType.java...) để báo lỗi ngay trên form trước khi gửi.
 * Backend vẫn kiểm tra lại toàn bộ khi lưu.
 */

/** Tiêu đề lớn / mô tả của từng bước theo Figma; bước khác dùng tên + mô tả từ backend. */
const STEP_COPY_KEYS = {
  BODY_INFORMATION: "BODY_INFORMATION",
  GOALS_AND_MOTIVATION: "GOALS_AND_MOTIVATION",
  CURRENT_TRAINING_ROUTINE: "CURRENT_TRAINING_ROUTINE",
  LEVEL_TEST: "LEVEL_TEST",
};

export function stepCopy(step) {
  const key = STEP_COPY_KEYS[step.stepCode];
  const copy = key ? t(`member:survey.stepTitles.${key}`) : null;
  return {
    label: step.stepName,
    title: copy?.title ?? step.stepName,
    subtitle: copy?.subtitle ?? step.description ?? "",
  };
}

/** BODY_INFORMATION <-> body-information (URL giống Figma: /survey/body-information). */
export const stepSlug = (stepCode) => stepCode.toLowerCase().replaceAll("_", "-");
export const findStepBySlug = (steps, slug) => steps.find((s) => stepSlug(s.stepCode) === slug);

/** display_config của câu hỏi (JSON tùy ý do content manager cấu hình). */
export const displayOf = (question) => question.displayConfig ?? {};

/** Tiêu đề ngắn hiển thị trên màn hình. */
export const questionLabel = (question) => displayOf(question).label ?? question.questionText;

/** Kiểu hiển thị: theo display_config.widget, mặc định theo loại câu hỏi. */
export function widgetOf(question) {
  const widget = displayOf(question).widget;
  if (widget) return widget;
  switch (question.questionType) {
    case "SINGLE_SELECT":
      return "tiles";
    case "MULTIPLE_SELECT":
      return "chips";
    case "BOOLEAN":
      return "boolean";
    case "TEXT":
    case "TEXTAREA":
      return "text";
    default:
      return "number";
  }
}

/* ─── Giá trị câu trả lời ─────────────────────────────────────────────
Trong form, câu NUMBER giữ chuỗi người dùng gõ (để gõ dở "1." không bị mất);
các loại khác giữ đúng giá trị JSON gửi lên backend. */

const isBlank = (value) =>
  value === undefined ||
  value === null ||
  (typeof value === "string" && value.trim() === "") ||
  (Array.isArray(value) && value.length === 0);

/** Giá trị từ phiên (backend) -> giá trị trong form. */
export function toFormValue(question, value) {
  if (value === null || value === undefined) return question.questionType === "MULTIPLE_SELECT" ? [] : "";
  if (question.questionType === "NUMBER") return String(value);
  return value;
}

/** Giá trị trong form -> JSON gửi backend; trống -> null. NUMBER gõ sai giữ nguyên chuỗi (validate sẽ báo). */
export function toAnswerValue(question, formValue) {
  if (isBlank(formValue)) return null;
  if (question.questionType === "NUMBER") {
    const text = String(formValue).trim();
    return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : text;
  }
  if (typeof formValue === "string") return formValue.trim();
  return formValue;
}

/* ─── Điều kiện hiển thị (giống Condition.java) ────────────────────── */

/** Nguồn là mảng (MULTIPLE_SELECT): khớp khi có chứa giá trị. */
function matchesAny(actual, expected) {
  return Array.isArray(actual) ? actual.includes(expected) : actual === expected;
}

/** answers: questionCode -> giá trị JSON (không chứa câu chưa trả lời). */
export function testCondition(condition, answers) {
  if (!condition) return true;
  const operator = String(condition.operator).toUpperCase();
  if (operator === "AND") return condition.conditions.every((c) => testCondition(c, answers));
  if (operator === "OR") return condition.conditions.some((c) => testCondition(c, answers));

  const actual = answers[condition.questionCode];
  if (actual === undefined || actual === null) return false;
  const expected = condition.value;
  switch (operator) {
    case "EQ":
      return matchesAny(actual, expected);
    case "NE":
      return !matchesAny(actual, expected);
    case "IN":
      return expected.some((e) => matchesAny(actual, e));
    case "NOT_IN":
      return !expected.some((e) => matchesAny(actual, e));
    case "GT":
      return typeof actual === "number" && actual > expected;
    case "GTE":
      return typeof actual === "number" && actual >= expected;
    case "LT":
      return typeof actual === "number" && actual < expected;
    case "LTE":
      return typeof actual === "number" && actual <= expected;
    default:
      return false;
  }
}

/** Câu trả lời đã chuẩn hóa của toàn khảo sát (dùng cho điều kiện). */
export function answerValues(definition, formValues) {
  const values = {};
  for (const step of definition.steps) {
    for (const question of step.questions) {
      const value = toAnswerValue(question, formValues[question.questionCode]);
      if (value !== null) values[question.questionCode] = value;
    }
  }
  return values;
}

export const isApplicable = (question, values) => testCondition(question.conditionalRules, values);

/* ─── Validate 1 câu (giống các QuestionTypeHandler) ───────────────── */

function decimals(number) {
  const text = String(number);
  return text.includes(".") ? text.split(".")[1].length : 0;
}

function rangeMessage(min, max, unit) {
  const suffix = unit ? ` ${unit}` : "";
  if (min !== undefined && max !== undefined) {
    return t("member:survey.validation.rangeBetween", { min, max, unit: suffix });
  }
  if (min !== undefined) return t("member:survey.validation.rangeAtLeast", { min, unit: suffix });
  return t("member:survey.validation.rangeAtMost", { max, unit: suffix });
}

/** Thông báo lỗi, hoặc null nếu hợp lệ. Chỉ gọi cho câu đang áp dụng. */
export function validateAnswer(question, formValue) {
  const rules = question.validationRules ?? {};
  const value = toAnswerValue(question, formValue);
  const isSelect = question.questionType === "SINGLE_SELECT" || question.questionType === "MULTIPLE_SELECT";

  if (value === null) {
    if (!question.required) return null;
    return isSelect
      ? t("member:survey.validation.chooseOption")
      : t("member:survey.validation.required");
  }

  switch (question.questionType) {
    case "NUMBER": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return t("member:survey.validation.validNumber");
      }
      if (rules.integerOnly && !Number.isInteger(value)) {
        return t("member:survey.validation.wholeNumbersOnly");
      }
      if (rules.maxDecimals !== undefined && decimals(value) > rules.maxDecimals) {
        return t("member:survey.validation.decimalPlaces", { count: rules.maxDecimals });
      }
      if ((rules.min !== undefined && value < rules.min) || (rules.max !== undefined && value > rules.max)) {
        return rangeMessage(rules.min, rules.max, question.unit);
      }
      return null;
    }
    case "MULTIPLE_SELECT": {
      const min = rules.minSelections ?? 1;
      if (value.length < min) return t("member:survey.validation.minSelections", { count: min });
      if (rules.maxSelections !== undefined && value.length > rules.maxSelections) {
        return t("member:survey.validation.maxSelections", { count: rules.maxSelections });
      }
      return null;
    }
    case "TEXT":
    case "TEXTAREA": {
      if (rules.minLength !== undefined && value.length < rules.minLength) {
        return t("member:survey.validation.minLength", { count: rules.minLength });
      }
      if (rules.maxLength !== undefined && value.length > rules.maxLength) {
        return t("member:survey.validation.maxLength", { count: rules.maxLength });
      }
      if (rules.pattern && !new RegExp(`^(?:${rules.pattern})$`).test(value)) {
        return t("member:survey.validation.invalidFormat");
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Validate 1 bước. Trả về { errors: {questionCode: message}, answers: [{questionCode, value}] }
 * - answers gửi đúng định dạng PUT .../steps/{stepCode}/answers: câu đang áp dụng gửi giá trị (null nếu bỏ trống),
 *   câu KHÔNG còn áp dụng gửi null để xóa câu trả lời cũ (backend sẽ chặn hoàn thành nếu còn giữ).
 */
export function prepareStep(definition, step, formValues) {
  const values = answerValues(definition, formValues);
  const errors = {};
  const answers = [];
  for (const question of step.questions) {
    if (!isApplicable(question, values)) {
      answers.push({ questionCode: question.questionCode, value: null });
      continue;
    }
    const message = validateAnswer(question, formValues[question.questionCode]);
    if (message) errors[question.questionCode] = message;
    answers.push({ questionCode: question.questionCode, value: toAnswerValue(question, formValues[question.questionCode]) });
  }
  return { errors, answers };
}

/** Lỗi theo câu từ response 400 của backend ({errors: [{questionCode, message}]}) -> {questionCode: message}. */
export function serverFieldErrors(err) {
  const items = err?.response?.data?.errors;
  if (!Array.isArray(items)) return {};
  return Object.fromEntries(items.filter((e) => e.questionCode).map((e) => [e.questionCode, e.message]));
}
