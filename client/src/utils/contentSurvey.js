import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

/* Hiển thị dữ liệu của Survey management (Content Manager). */

const TYPE_LABELS = {
  NUMBER: "Numeric input",
  SINGLE_SELECT: "Single choice",
  MULTIPLE_SELECT: "Multiple choice",
  BOOLEAN: "Yes / no",
  TEXT: "Text",
  TEXTAREA: "Long text",
};

export const typeLabel = (type) => TYPE_LABELS[type] ?? type;

/** "Numeric input, single choice" (Figma: chữ hoa ở loại đầu tiên). */
export function typeSummary(types) {
  const text = types.map((t) => typeLabel(t).toLowerCase()).join(", ");
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

/** "Updated 2 days ago" */
export const updatedAgo = (updatedAt) => (updatedAt ? `Updated ${dayjs(updatedAt).fromNow()}` : "");

/** Dòng tóm tắt dưới mỗi bước trong danh sách. */
export function stepMeta(step) {
  if (step.stepType === "RESULT") return ["System output", "Uses the level criteria", updatedAgo(step.updatedAt)];
  const count = `${step.questionCount} question${step.questionCount === 1 ? "" : "s"}`;
  return [count, typeSummary(step.questionTypes), updatedAgo(step.updatedAt)].filter(Boolean);
}

/** validationRules + unit -> "100 to 250 cm" (null nếu không có khoảng). */
export function rangeText(rules, unit) {
  const { min, max } = rules ?? {};
  const suffix = unit ? ` ${unit}` : "";
  if (min != null && max != null) return `${min} to ${max}${suffix}`;
  if (min != null) return `At least ${min}${suffix}`;
  if (max != null) return `At most ${max}${suffix}`;
  return null;
}

export const STATUS_LABELS = { ACTIVE: "Active", DRAFT: "Draft", INACTIVE: "Inactive" };

/** Tab lọc của danh sách: key = status gửi lên API (rỗng = All), countKey = field trong counts. */
export const STATUS_TABS = [
  { status: "", label: "All", countKey: "all" },
  { status: "ACTIVE", label: "Active", countKey: "active" },
  { status: "DRAFT", label: "Draft", countKey: "draft" },
  { status: "INACTIVE", label: "Inactive", countKey: "inactive" },
];

export const DESCRIPTION_MAX = 150;

/** Lỗi từng câu hỏi của 400 INVALID_STEP_QUESTIONS / 409 SURVEY_CONFIG_CONFLICT -> danh sách chuỗi. */
export function errorDetails(err) {
  const items = err?.response?.data?.errors;
  return Array.isArray(items) ? items.map((e) => e.message).filter(Boolean) : [];
}
