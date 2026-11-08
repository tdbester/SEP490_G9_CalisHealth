import i18n from "../i18n";

/**
 * Rút message từ payload của backend.
 *
 * Backend có thể trả về:
 *  - JSON: {"message": "..."} hoặc {"error": "..."}
 *  - JSON lỗi: {"status": 400, "message": "...", "errors": {...}}
 *  - HTML (Whitelabel Error Page) khi lỗi chưa được handler -> không dùng làm message.
 */
export function messageFromPayload(payload) {
  if (payload && typeof payload === "object") {
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
    return null;
  }
  if (typeof payload === "string") {
    const text = payload.trim();
    if (!text) return null;
    if (text.startsWith("<")) return null;
    return text;
  }
  return null;
}

/** Message dựng từ HTTP status khi backend không trả về message dùng được. */
export function statusMessage(status) {
  const t = (key, options) => i18n.t(key, options);
  if (status == null) return t("common.apiError.network");
  if (status === 401) return t("common.apiError.unauthorized");
  if (status === 403) return t("common.apiError.forbidden");
  if (status === 404) return t("common.apiError.notFound");
  if (status === 409) return t("common.apiError.conflict");
  if (status === 413) return t("common.apiError.tooLarge");
  if (status >= 500) return t("common.apiError.serverError");
  return t("common.apiError.rejectedStatus", { status });
}

/**
 * Message lỗi thân thiện từ một axios error.
 * Luôn trả về chuỗi để không bao giờ rơi về thông báo chung chung.
 */
export function apiErrorMessage(error, fallbackKey) {
  const fromPayload = messageFromPayload(error?.response?.data);
  if (fromPayload) return fromPayload;
  const status = error?.response?.status;
  if (status == null) {
    return fallbackKey ? i18n.t(fallbackKey) : i18n.t("common.apiError.network");
  }
  return statusMessage(status);
}

/** Map lỗi theo field từ response 400 ({errors: {field: message}}). */
export function fieldErrors(error) {
  const errors = error?.response?.data?.errors;
  return errors && typeof errors === "object" && !Array.isArray(errors) ? errors : {};
}
