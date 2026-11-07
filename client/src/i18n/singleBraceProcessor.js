/**
 * Post-processor hỗ trợ cú pháp placeholder một dấu ngoặc: `{name}`.
 *
 * Vì sao cần?
 * ------------
 * i18next mặc định chỉ interpolate cú pháp hai dấu ngoặc `{{name}}`.
 * Toàn bộ locale file của dự án lại viết placeholder theo kiểu `{name}`
 * (vd "{count} exercises", "By {name}"), nên khi không cấu hình gì, i18next
 * trả về nguyên chuỗi và UI hiển thị literal `{count}`.
 *
 * Cách sửa ở đây
 * --------------
 * Giữ nguyên interpolation mặc định (để `{{name}}` vẫn hoạt động) rồi chạy
 * thêm một post-processor quét các placeholder một dấu ngoặc còn sót lại.
 * Cách này không cần sửa hàng loạt file locale và không đụng tới giá trị
 * đã được interpolate.
 */

const SINGLE_BRACE = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

/** Các option không phải giá trị để đưa vào chuỗi. */
const RESERVED = new Set([
  "defaultValue",
  "ordinal",
  "context",
  "replace",
  "lng",
  "lngs",
  "ns",
  "nsSeparator",
  "keySeparator",
  "returnObjects",
  "returnDetails",
  "joinArrays",
  "postProcess",
  "postProcessPassResolved",
  "interpolation",
  "interpolationkey",
  "interpolationPrefix",
  "interpolationSuffix",
  "interpolationFormat",
  "format",
  "nsSeparator",
  "count",
]);

/**
 * @param {string} value chuỗi đã được i18next interpolate
 * @param {string} key key đang dịch
 * @param {object} options các tham số truyền kèm khi gọi t()
 * @returns {string}
 */
export function singleBraceProcessor(value, key, options) {
  if (typeof value !== "string" || !value.includes("{")) {
    return value;
  }
  const params = options && typeof options === "object" ? options : {};

  // Bỏ qua placeholder nằm trong `{{...}}` — phần đó i18next đã xử lý.
  return value.replace(
    SINGLE_BRACE,
    (match, name) => {
      if (!Object.prototype.hasOwnProperty.call(params, name)) {
        // Không có giá trị -> giữ nguyên chuỗi gốc (giống hành vi mặc định).
        return match;
      }
      const replacement = params[name];
      if (replacement === undefined || replacement === null) {
        return match;
      }
      return String(replacement);
    }
  );
}

singleBraceProcessor.type = "postProcessor";

export default singleBraceProcessor;
