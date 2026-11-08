import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import i18n from "../i18n";
import { questionLabel } from "./survey";

dayjs.extend(relativeTime);

/** Dịch 1 key của namespace contentManager. */
const t = (key, options) => i18n.t(key, options);

/* Hiển thị dữ liệu của Survey management (Content Manager). */

export const typeLabel = (type) => t(`contentManager:survey.typeLabels.${type}`, { defaultValue: type });

/** "Numeric input, single choice" (Figma: chữ hoa ở loại đầu tiên). */
export function typeSummary(types) {
  const text = types.map((type) => typeLabel(type).toLowerCase()).join(", ");
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

/** "Updated 2 days ago" */
export const updatedAgo = (updatedAt) =>
  updatedAt ? `${t("contentManager:survey.updatedLabel")} ${dayjs(updatedAt).fromNow()}` : "";

/** Dòng tóm tắt dưới mỗi bước trong danh sách. */
export function stepMeta(step) {
  if (step.stepType === "RESULT") {
    return [
      t("contentManager:survey.systemOutput"),
      t("contentManager:survey.usesLevelCriteria"),
      updatedAgo(step.updatedAt),
    ];
  }
  const count = t("contentManager:survey.questionCount", { count: step.questionCount });
  return [count, typeSummary(step.questionTypes), updatedAgo(step.updatedAt)].filter(Boolean);
}

/** validationRules + unit -> "100 to 250 cm" (null nếu không có khoảng). */
export function rangeText(rules, unit) {
  const { min, max } = rules ?? {};
  const suffix = unit ? ` ${unit}` : "";
  if (min != null && max != null) return t("contentManager:survey.rangeTo", { min, max, unit: suffix });
  if (min != null) return t("contentManager:survey.rangeAtLeastShort", { min, unit: suffix });
  if (max != null) return t("contentManager:survey.rangeAtMostShort", { max, unit: suffix });
  return null;
}

export const STATUS_LABELS = {
  get ACTIVE() {
    return t("contentManager:survey.statusLabels.ACTIVE");
  },
  get DRAFT() {
    return t("contentManager:survey.statusLabels.DRAFT");
  },
  get INACTIVE() {
    return t("contentManager:survey.statusLabels.INACTIVE");
  },
};

/** Tab lọc của danh sách: key = status gửi lên API (rỗng = All), countKey = field trong counts. */
export const STATUS_TABS = [
  { status: "", labelKey: "all", countKey: "all" },
  { status: "ACTIVE", labelKey: "active", countKey: "active" },
  { status: "DRAFT", labelKey: "draft", countKey: "draft" },
  { status: "INACTIVE", labelKey: "inactive", countKey: "inactive" },
];

export const DESCRIPTION_MAX = 150;

/* ─── Editor câu hỏi kiểu Google Form (popup Create / Update step) ─────────────
Mỗi câu hỏi trong popup là 1 "row". Ô số giữ chuỗi người dùng gõ; validationRules chỉ được dựng lúc gửi.
Câu có sẵn chỉ gửi content khi đã bị sửa (dirty), để không chạm vào câu hỏi không đổi. */

export const QUESTION_TYPES = ["SINGLE_SELECT", "MULTIPLE_SELECT", "NUMBER", "BOOLEAN", "TEXT", "TEXTAREA"];

export const isChoiceType = (type) => type === "SINGLE_SELECT" || type === "MULTIPLE_SELECT";

/** Rule mà BE chấp nhận theo loại câu hỏi (rule lạ bị từ chối). */
const RULE_KEYS = {
  NUMBER: ["min", "max", "integerOnly", "maxDecimals"],
  MULTIPLE_SELECT: ["minSelections", "maxSelections"],
  TEXT: ["minLength", "maxLength", "pattern"],
  TEXTAREA: ["minLength", "maxLength", "pattern"],
};

let keySeq = 0;
const newKey = () => `k${++keySeq}`;
const toText = (value) => (value == null ? "" : String(value));
const isObject = (value) => value != null && typeof value === "object" && !Array.isArray(value);

export const newOption = (label = "") => ({ key: newKey(), optionCode: null, label });

/** Câu hỏi từ API (chi tiết bước hoặc ngân hàng câu hỏi) -> row. */
export function questionToRow(question) {
  const rules = isObject(question.validationRules) ? question.validationRules : {};
  const title = questionLabel(question);
  return {
    key: newKey(),
    questionCode: question.questionCode,
    required: Boolean(question.required),
    answered: Boolean(question.answered),
    typeLocked: Boolean(question.typeLocked),
    title,
    originalTitle: title,
    originalText: question.questionText,
    description: question.description ?? "",
    questionType: question.questionType,
    unit: question.unit ?? "",
    baseRules: rules,
    min: toText(rules.min),
    max: toText(rules.max),
    integerOnly: Boolean(rules.integerOnly),
    maxSelections: toText(rules.maxSelections),
    maxLength: toText(rules.maxLength),
    options: (question.options ?? []).map((o) => ({ key: newKey(), optionCode: o.optionCode, label: o.label })),
    dirty: false,
  };
}

/** Câu hỏi mới: mặc định "Single choice" với 1 lựa chọn, giống Google Form. */
export function blankRow() {
  return {
    ...questionToRow({ questionCode: null, questionText: "", questionType: "SINGLE_SELECT", required: true }),
    originalTitle: "",
    options: [newOption(t("contentManager:survey.optionDefaultLabel", { index: 1 }))],
    dirty: true,
  };
}

const numberOrNull = (text) => (text.trim() === "" ? null : Number(text));

/** validationRules gửi lên: giữ rule cũ hợp lệ với loại hiện tại (vd maxDecimals), ghi đè các ô trong editor. */
export function rowRules(row) {
  const rules = {};
  for (const key of RULE_KEYS[row.questionType] ?? []) {
    if (row.baseRules[key] != null) rules[key] = row.baseRules[key];
  }
  const put = (key, value) => {
    if (value == null || value === false) delete rules[key];
    else rules[key] = value;
  };
  if (row.questionType === "NUMBER") {
    put("min", numberOrNull(row.min));
    put("max", numberOrNull(row.max));
    put("integerOnly", row.integerOnly);
  } else if (row.questionType === "MULTIPLE_SELECT") {
    put("maxSelections", numberOrNull(row.maxSelections));
  } else if (row.questionType === "TEXT" || row.questionType === "TEXTAREA") {
    put("maxLength", numberOrNull(row.maxLength));
  }
  return rules;
}

/** Dòng tóm tắt dưới tên câu hỏi: "0 to 60 reps", "3 options", "Up to 200 characters". */
export function rowSummary(row) {
  if (isChoiceType(row.questionType)) {
    return t("contentManager:survey.optionCountLabel", { count: row.options.length });
  }
  const rules = rowRules(row);
  if (row.questionType === "NUMBER") return rangeText(rules, row.unit.trim());
  if (rules.maxLength != null) return t("contentManager:survey.upToCharacters", { count: rules.maxLength });
  return null;
}

/** row -> 1 phần tử questions của POST/PUT step. */
export function rowToInput(row) {
  const input = { questionCode: row.questionCode, required: row.required };
  if (row.dirty || !row.questionCode) {
    const title = row.title.trim();
    input.content = {
      // màn member hiện label thay cho questionText: chỉ đổi nội dung khi tiêu đề thật sự đổi
      questionText: title !== row.originalTitle ? title : row.originalText,
      description: row.description.trim() || null,
      questionType: row.questionType,
      unit: row.questionType === "NUMBER" ? row.unit.trim() || null : null,
      validationRules: rowRules(row),
      options: isChoiceType(row.questionType)
        ? row.options.map((o) => ({ optionCode: o.optionCode, label: o.label.trim() }))
        : [],
    };
  }
  return input;
}

const isWholeNumber = (text) => /^\d+$/.test(text.trim());

/** Kiểm tra phía client trước khi gửi (BE vẫn kiểm tra lại đầy đủ). */
export function rowProblems(row, position) {
  const problems = [];
  const where = { position };
  if (!row.title.trim()) problems.push(t("contentManager:survey.problems.enterQuestion", where));
  if (isChoiceType(row.questionType)) {
    const labels = row.options.map((o) => o.label.trim().toLowerCase());
    if (labels.length === 0) problems.push(t("contentManager:survey.problems.addOption", where));
    if (labels.some((l) => !l)) problems.push(t("contentManager:survey.problems.optionLabel", where));
    if (new Set(labels.filter(Boolean)).size !== labels.filter(Boolean).length) {
      problems.push(t("contentManager:survey.problems.optionUnique", where));
    }
    if (row.questionType === "MULTIPLE_SELECT" && row.maxSelections.trim() && !(isWholeNumber(row.maxSelections) && Number(row.maxSelections) >= 1)) {
      problems.push(t("contentManager:survey.problems.maxSelections", where));
    }
  }
  if (row.questionType === "NUMBER") {
    const min = numberOrNull(row.min);
    const max = numberOrNull(row.max);
    if (Number.isNaN(min) || Number.isNaN(max)) {
      problems.push(t("contentManager:survey.problems.numbersOnly", where));
    } else if (min != null && max != null && min > max) {
      problems.push(t("contentManager:survey.problems.minNotGreater", where));
    }
  }
  if ((row.questionType === "TEXT" || row.questionType === "TEXTAREA") && row.maxLength.trim()
    && !(isWholeNumber(row.maxLength) && Number(row.maxLength) >= 1)) {
    problems.push(t("contentManager:survey.problems.maxLength", where));
  }
  return problems;
}

/** Lỗi từng câu hỏi của 400 INVALID_STEP_QUESTIONS / 409 SURVEY_CONFIG_CONFLICT -> danh sách chuỗi. */
export function errorDetails(err) {
  const items = err?.response?.data?.errors;
  return Array.isArray(items) ? items.map((e) => e.message).filter(Boolean) : [];
}
