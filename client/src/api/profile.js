import api from "./client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

/** Profile photos are served from the backend root, not from under /api. */
export function avatarUrl(value) {
  if (!value) return null;
  try {
    return new URL(value, new URL(API_URL, window.location.origin)).toString();
  } catch {
    return value;
  }
}

/**
 * Profile Information screen (MEMBER, CONTENT_MANAGER and ADMIN).
 * Every call acts on the signed-in account; the account id never has to be sent.
 */
export const profileApi = {
  get: () => api.get("/profile").then((res) => res.data),

  /** Accepts the editable fields: fullName, phone, gender, dateOfBirth, bio. */
  update: (payload) => api.put("/profile", payload).then((res) => res.data),

  /**
   * Multipart upload. The Content-Type header is dropped for FormData so the browser can add the
   * multipart boundary itself.
   */
  uploadAvatar: (file) => {
    const body = new FormData();
    body.append("file", file);
    // Override the JSON default so Axios/browser can add the multipart boundary.
    return api
      .post("/profile/avatar", body, { headers: { "Content-Type": undefined } })
      .then((res) => res.data);
  },

  removeAvatar: () => api.delete("/profile/avatar").then((res) => res.data),

  /** { currentPassword, newPassword, confirmNewPassword } -> refreshed profile. */
  changePassword: (payload) => api.post("/profile/password", payload).then((res) => res.data),
};

/** "Last changed 02/11/2026": the dd/MM/yyyy format the profile screen uses. */
export function formatProfileDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

/** Value for <input type="date">, which only accepts yyyy-MM-dd. */
export function toDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
