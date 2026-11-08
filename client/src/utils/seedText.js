/**
 * Dịch chuỗi của dữ liệu mẫu (mock/seed) sang ngôn ngữ đang dùng.
 *
 * Dữ liệu mẫu được viết sẵn bằng tiếng Anh trong code, nên không thể gắn
 * `t()` trực tiếp. Thay vào đó, mỗi chuỗi là một key trong dictionary
 * `i18n/locales/<lang>/seed.js` và helper này tra key đó.
 *
 * Không dùng i18next cho phần này vì key chứa dấu chấm, dấu phẩy và khoảng
 * trắng — i18next sẽ tách key theo dấu "." nên không tra được.
 *
 * Ví dụ:
 *   localizeSeed("Full Body Health Maintenance")
 *     -> "Full Body Health Maintenance" (en)
 *     -> "Duy trì sức khỏe toàn thân" (vi)
 */
import enSeed from "../i18n/locales/en/seed.js";
import viSeed from "../i18n/locales/vi/seed.js";
import { currentLanguage } from "../i18n";

const DICTIONARIES = { en: enSeed, vi: viSeed };

/**
 * Mẫu động: key chứa `{{...}}` được biên dịch thành RegExp để khớp các
 * biến thể có số/ngữ khác nhau, ví dụ "20 min" -> "{{n}} min".
 */
const PATTERNS = [
  {
    regex: /^The (.+) develops (.+) strength and supports (.+) training\.$/,
    key: "The {{name}} develops {{muscle}} strength and supports {{level}} training.",
    args: ["name", "muscle", "level"],
  },
  {
    regex: /^Set up in a stable position for (.+)\.$/,
    key: "Set up in a stable position for {{name}}.",
    args: ["name"],
  },
  {
    regex: /^About (\d+) min$/,
    key: "About {{n}} min",
    args: ["n"],
  },
  {
    regex: /^(\d+) min$/,
    key: "{{n}} min",
    args: ["n"],
  },
  {
    regex: /^(\d+) sec$/,
    key: "{{n}} sec",
    args: ["n"],
  },
  {
    regex: /^(\d+) reps$/,
    key: "{{n}} reps",
    args: ["n"],
  },
  {
    regex: /^(\d+) sets · (.+)$/,
    key: "{{n}} sets · {{rest}}",
    args: ["n", "rest"],
  },
];

function dictionary() {
  return DICTIONARIES[currentLanguage()] || DICTIONARIES.en;
}

/**
 * @param {string} text chuỗi gốc (tiếng Anh) của dữ liệu mẫu
 * @returns {string} bản dịch theo ngôn ngữ hiện tại, hoặc chính `text` nếu
 *   không có bản dịch (ví dụ tên riêng, tên bài tập kỹ thuật).
 */
export function localizeSeed(text) {
  if (typeof text !== "string" || !text) return text;
  const dict = dictionary();
  if (dict[text]) return dict[text];
  for (const pattern of PATTERNS) {
    const match = pattern.regex.exec(text);
    if (!match) continue;
    const template = dict[pattern.key];
    if (!template) continue;
    return template.replace(/\{\{(\w+)\}\}/g, (token, name) => {
      const index = pattern.args.indexOf(name);
      return index >= 0 && match[index + 1] != null ? match[index + 1] : token;
    });
  }
  return text;
}

/**
 * Dịch một chuỗi có sẵn các placeholder dạng `{{name}}`.
 * @param {string} template
 * @param {Record<string, unknown>} values
 */
export function localizeSeedTemplate(template, values) {
  if (typeof template !== "string" || !template) return template;
  const localized = localizeSeed(template);
  return localized.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    values && values[key] != null ? String(values[key]) : match,
  );
}

/**
 * Duyệt đệ quy mọi thuộc tính chuỗi của một object mẫu và trả về bản đã dịch.
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function localizeSeedDeep(value) {
  if (typeof value === "string") return localizeSeed(value);
  if (Array.isArray(value)) return value.map((item) => localizeSeedDeep(item));
  if (value && typeof value === "object") {
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = localizeSeedDeep(item);
    }
    return result;
  }
  return value;
}

export default localizeSeed;
