import api from "./client";
import i18n from "../i18n";

export const adminUsersApi = {
  list: ({ q, role, status, joinedOn, sort, page, size } = {}) =>
    api
      .get("/admin/users", {
        params: {
          q: q || undefined,
          role: role || undefined,
          status: status || undefined,
          joinedOn: joinedOn || undefined,
          sort: sort || undefined,
          page,
          size,
        },
      })
      .then((res) => res.data),
  create: (payload) => api.post("/admin/users", payload).then((res) => res.data),
  setActive: (ids, active) =>
    api.patch("/admin/users/status", { ids, active }).then((res) => res.data),

  // ---- user detail & activity log ----
  detail: (id) => api.get(`/admin/users/${id}`).then((res) => res.data),
  workoutActivity: (id, { q, type, level, status, date, page, size } = {}) =>
    api
      .get(`/admin/users/${id}/workout-activity`, {
        params: {
          q: q || undefined,
          type: type || undefined,
          level: level || undefined,
          status: status || undefined,
          date: date || undefined,
          page,
          size,
        },
      })
      .then((res) => res.data),
  systemLogs: (id, { type, date, page, size } = {}) =>
    api
      .get(`/admin/users/${id}/system-logs`, {
        params: { type: type || undefined, date: date || undefined, page, size },
      })
      .then((res) => res.data),
  adminActions: (id, { action, date, page, size } = {}) =>
    api
      .get(`/admin/users/${id}/admin-actions`, {
        params: { action: action || undefined, date: date || undefined, page, size },
      })
      .then((res) => res.data),
  contentActivity: (id, { type, action, page, size } = {}) =>
    api
      .get(`/admin/users/${id}/content-activity`, {
        params: { type: type || undefined, action: action || undefined, page, size },
      })
      .then((res) => res.data),

  // ---- Góp ý & khiếu nại đã được chuyển tiếp lên Admin ----
  /**
   * @param {object} filters
   * @param {string} [filters.status] lọc theo trạng thái
   * @param {string} [filters.category] lọc theo nhóm nội dung
   * @param {string} [filters.search] tìm theo tên/email thành viên hoặc tiêu đề/nội dung
   * @param {string} [filters.fromDate] ngày gửi bắt đầu (yyyy-MM-dd)
   * @param {string} [filters.toDate] ngày gửi kết thúc (yyyy-MM-dd)
   */
  feedback: ({ status, category, search, fromDate, toDate } = {}) =>
    api
      .get("/admin/feedback", {
        params: {
          status: status || undefined,
          category: category || undefined,
          search: search || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        },
      })
      .then((res) => res.data),
  /** Chi tiết một đơn góp ý. */
  feedbackDetail: (id) =>
    api.get(`/admin/feedback/${encodeURIComponent(id)}`).then((res) => res.data),
  /** Quyết định cuối cùng: RESOLVE (đóng đơn) | REJECT (không chấp nhận). */
  handleFeedback: (id, action, resolutionNote) =>
    api
      .patch(`/admin/feedback/${encodeURIComponent(id)}/handle`, {
        action,
        resolutionNote: resolutionNote || null,
      })
      .then((res) => res.data),
};

export function apiErrorMessage(err, fallback) {
  return err?.response?.data?.message || fallback || i18n.t("common.error.generic");
}
