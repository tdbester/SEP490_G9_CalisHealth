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
    joint: item.joint || "",
    angleThreshold: item.angleThreshold ?? "",
    romDepth: item.romDepth ?? "",
    minAngle: item.minAngle ?? "",
    maxAngle: item.maxAngle ?? "",
    weight: item.weight ?? "",
    tolerance: item.tolerance ?? "",
  }));
}

/** Số ngưỡng tối đa cho một bài (khớp với validate phía server). */
export const MAX_FORM_RULES = 6;

/**
 * Kiểm tra danh sách rule trước khi gửi lên server.
 *
 * Mục tiêu: báo lỗi NGAY TẠI Ô nhập thay vì đợi server trả về lỗi chung
 * "dữ liệu không hợp lệ" — CM biết chính xác rule nào sai và sai ở đâu.
 *
 * Quy tắc giống hệt `FormRuleAdminService.validateRules` phía server:
 *   - joint phải nằm trong `FORM_RULE_JOINTS`
 *   - mọi góc nằm trong [0, 180]
 *   - `minAngle` không được lớn hơn `maxAngle`
 *   - `weight` nằm trong [0, 1]
 *   - mỗi rule phải có 2 ngưỡng (trên/đáy) HOẶC dải min/max
 *
 * @param {Array} rules - rule dạng form (giá trị string)
 * @param {string} category - "REPS" | "HOLD" để biết dùng cặp ngưỡng nào
 * @returns {Array} danh sách lỗi, mỗi lỗi gắn `ruleIndex` + `field`
 */
export function validateFormRules(rules, category) {
  const list = Array.isArray(rules) ? rules : [];
  const errors = [];
  const isHold = category === "HOLD";

  if (list.length > MAX_FORM_RULES) {
    errors.push({ ruleIndex: -1, field: "count", key: "tooMany" });
  }

  list.forEach((rule, ruleIndex) => {
    const joint = String(rule.joint || "").trim().toUpperCase();
    if (!joint) {
      errors.push({ ruleIndex, field: "joint", key: "jointRequired" });
    } else if (!FORM_RULE_JOINTS.includes(joint)) {
      errors.push({ ruleIndex, field: "joint", key: "jointUnknown" });
    }

    // Ô nào đang hiển thị phụ thuộc category.
    const angleFields = isHold
      ? ["minAngle", "maxAngle"]
      : ["angleThreshold", "romDepth"];
    const rangeFields = ["minAngle", "maxAngle"];

    const angles = {};
    angleFields.forEach((field) => {
      const value = toNumber(rule[field]);
      angles[field] = value;
      if (value == null) return;
      if (value < 0 || value > 180) {
        errors.push({ ruleIndex, field, key: "angleOutOfRange" });
      }
    });

    const tolerance = toNumber(rule.tolerance);
    if (tolerance != null && (tolerance < 0 || tolerance > 180)) {
      errors.push({ ruleIndex, field: "tolerance", key: "angleOutOfRange" });
    }

    const weight = toNumber(rule.weight);
    if (weight != null && (weight < 0 || weight > 1)) {
      errors.push({ ruleIndex, field: "weight", key: "weightOutOfRange" });
    }

    const minAngle = toNumber(rule.minAngle);
    const maxAngle = toNumber(rule.maxAngle);
    // Chỉ so min > max khi cả hai góc đều hợp lệ. Nếu một góc đã vượt
    // 0-180 thì lỗi "ngoài khoảng" đã đủ rõ — báo thêm lỗi thứ hai chỉ gây
    // nhiễu (và server cũng chỉ báo lỗi range trước).
    const minValid = minAngle != null && minAngle >= 0 && minAngle <= 180;
    const maxValid = maxAngle != null && maxAngle >= 0 && maxAngle <= 180;
    if (minValid && maxValid && minAngle > maxAngle) {
      errors.push({ ruleIndex, field: "minAngle", key: "minGreaterThanMax" });
    }

    // Phải có đủ một cặp ngưỡng: 2 ngưỡng (trên/đáy) hoặc dải min/max.
    const hasTwoThresholds = angles.angleThreshold != null || angles.romDepth != null;
    const hasRange = minAngle != null || maxAngle != null;
    if (!hasTwoThresholds && !hasRange) {
      errors.push({ ruleIndex, field: isHold ? "minAngle" : "angleThreshold", key: "needThreshold" });
    }
  });

  return errors;
}

/**
 * Gom lỗi theo rule để hiển thị tại từng khối rule.
 *
 * @param {Array} errors - kết quả của {@link validateFormRules}
 * @returns {Map} key = ruleIndex, value = Set các field bị lỗi
 */
export function groupRuleErrors(errors) {
  const grouped = new Map();
  (Array.isArray(errors) ? errors : []).forEach((error) => {
    if (error.ruleIndex < 0) return;
    if (!grouped.has(error.ruleIndex)) grouped.set(error.ruleIndex, new Set());
    grouped.get(error.ruleIndex).add(error.field);
  });
  return grouped;
}
