/**
 * Hạ tầng đa ngôn ngữ (English / Tiếng Việt).
 *
 * Ngôn ngữ được lưu ở localStorage và đồng bộ với server qua header
 * `Accept-Language` để các message do backend trả về cũng đúng ngôn ngữ.
 *
 * Thêm ngôn ngữ mới: thêm vào `SUPPORTED_LANGUAGES` + tạo khối tương ứng
 * trong `resources` bên dưới.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { resources } from "./resources.js";
import { singleBraceProcessor } from "./singleBraceProcessor.js";

/** Ngôn ngữ đang được hỗ trợ. */
export const SUPPORTED_LANGUAGES = [
  { code: "vi", label: "Tiếng Việt", short: "VI" },
  { code: "en", label: "English", short: "EN" },
];

export const DEFAULT_LANG = "vi";

/**
 * Key lưu lựa chọn ngôn ngữ.
 *
 * Backend đọc cùng key này qua header `Accept-Language` để trả message
 * đúng ngôn ngữ — xem `client/src/api/client.js`.
 */
export const LANG_STORAGE_KEY = "calishealth_lang";

/** Ngôn ngữ đang dùng, luôn là một mã trong `SUPPORTED_LANGUAGES`. */
export function currentLanguage() {
  const stored = localStorage.getItem(LANG_STORAGE_KEY);
  return SUPPORTED_LANGUAGES.some((item) => item.code === stored)
    ? stored
    : DEFAULT_LANG;
}

/**
 * Đổi ngôn ngữ và báo cho server biết.
 *
 * `document.documentElement.lang` giúp trình đọc màn hình đọc đúng.
 */
export function changeLanguage(code) {
  const next = SUPPORTED_LANGUAGES.some((item) => item.code === code) ? code : DEFAULT_LANG;
  localStorage.setItem(LANG_STORAGE_KEY, next);
  document.documentElement.lang = next;
  return i18n.changeLanguage(next);
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .use({
    type: "postProcessor",
    name: "singleBrace",
    process: singleBraceProcessor,
  })
  .init({
    resources,
    fallbackLng: DEFAULT_LANG,
    supportedLngs: SUPPORTED_LANGUAGES.map((item) => item.code),
    // Đọc ngôn ngữ đã lưu trước; nếu chưa có thì dùng `fallbackLng`.
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: LANG_STORAGE_KEY,
      caches: ["localStorage"],
    },
    interpolation: {
      // React tự escape, không cần escape thêm.
      escapeValue: false,
    },
    // Chạy post-processor hỗ trợ placeholder một dấu ngoặc `{name}`.
    // Interpolation mặc định của i18next chỉ hiểu `{{name}}`, trong khi locale
    // file của dự án dùng `{name}` — xem `singleBraceProcessor.js`.
    postProcess: ["singleBrace"],
    react: {
      useSuspense: false,
    },
  });

export default i18n;
