/**
 * Nhãn trình độ dùng chung (Beginner / Intermediate / Advanced / Expert).
 *
 * Key trong dictionary: `member.catalog.<level>` (đã có sẵn ở cả `en` và `vi`).
 * Hàm này nhận chuỗi ở mọi dạng viết hoa/thường và trả về nhãn đã dịch.
 */
import i18n from "../i18n";

const LEVEL_KEYS = {
  BEGINNER: "member.catalog.beginner",
  INTERMEDIATE: "member.catalog.intermediate",
  ADVANCED: "member.catalog.advanced",
  EXPERT: "member.catalog.expert",
};

/**
 * @param {string} level
 * @returns {string} nhãn đã dịch; nếu không có bản dịch thì trả về chuỗi gốc.
 */
export function getLevelLabel(level) {
  const normalized = String(level || "").trim().toUpperCase();
  const key = LEVEL_KEYS[normalized];
  if (!key) return level || "";
  return i18n.t(key, { defaultValue: level || "" });
}

export default getLevelLabel;
