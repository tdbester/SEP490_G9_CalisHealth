/**
 * Tiện ích dùng chung cho khai báo ngưỡng chấm form (form rules).
 *
 * Tách riêng khỏi `FormRuleEditor.jsx` để các trang Tailwind (member) dùng được
 * mà không kéo theo thư viện MUI.
 */

/** Các khớp có thể khai báo ngưỡng. */
export const FORM_RULE_JOINTS = [
  "KNEE",
  "HIP",
  "ELBOW",
  "SHOULDER",
  "WRIST",
  "ANKLE",
];

/** Nhóm chuyển động — dùng để gợi ý ngưỡng. */
export const MOVEMENT_GROUPS = ["PUSH", "PULL", "LEGS", "CORE"];

/** Một rule rỗng. */
export function emptyRule() {
  return {
    joint: "ELBOW",
    angleThreshold: "",
    romDepth: "",
    minAngle: "",
    maxAngle: "",
    weight: "",
    tolerance: "",
  };
}

const toNumber = (value) => {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Chuyển rule từ form (string) sang số để gửi API.
 *
 * @param {Array} rules
 * @returns {Array} rule đã chuẩn hoá
 */
export function normalizeRules(rules) {
  if (!Array.isArray(rules)) return [];
  return rules
    .map((rule) => ({
      joint: rule.joint,
      angleThreshold: toNumber(rule.angleThreshold),
      romDepth: toNumber(rule.romDepth),
      minAngle: toNumber(rule.minAngle),
      maxAngle: toNumber(rule.maxAngle),
      weight: toNumber(rule.weight),
      tolerance: toNumber(rule.tolerance),
    }))
    .filter((rule) => rule.joint);
}

/**
 * Chuyển rule từ server (số) về form (string) để hiển thị trong ô nhập.
 *
 * @param {Array} rules
 * @returns {Array}
 */
export function denormalizeRules(rules) {
  if (!Array.isArray(rules)) return [];
  return rules.map((rule) => ({
    joint: rule.joint || "ELBOW",
    angleThreshold: rule.angleThreshold ?? "",
    romDepth: rule.romDepth ?? "",
    minAngle: rule.minAngle ?? "",
    maxAngle: rule.maxAngle ?? "",
    weight: rule.weight ?? "",
    tolerance: rule.tolerance ?? "",
  }));
}

/**
 * Chuẩn hoá payload gợi ý từ server về dạng rule cho form.
 *
 * @param {Array} suggestions
 * @returns {Array}
 */
export function suggestionsToRules(suggestions) {
  if (!Array.isArray(suggestions)) return [];
  return suggestions.map((item) => ({
    joint: item.joint,
    angleThreshold: item.angleThreshold ?? "",
    romDepth: item.romDepth ?? "",
    minAngle: item.minAngle ?? "",
    maxAngle: item.maxAngle ?? "",
    weight: item.weight ?? "",
    tolerance: item.tolerance ?? "",
  }));
}
