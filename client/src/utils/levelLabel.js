/**
 * Nhãn trình độ dùng chung.
 *
 * Level do Content Manager cấu hình động trong Level & Benchmark Criteria nên không thể giả
 * định chỉ có Beginner / Intermediate / Advanced / Expert. Key trong dictionary
 * (`member.catalog.<level>`) chỉ tồn tại cho các level mặc định; level mới sẽ hiển thị đúng
 * tên do Content Manager đặt.
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
  const raw = String(level ?? "").trim();
  if (!raw) return "";
  const key = LEVEL_KEYS[raw.toUpperCase()];
  if (!key) return raw;
  return i18n.t(key, { defaultValue: raw });
}

export default getLevelLabel;
