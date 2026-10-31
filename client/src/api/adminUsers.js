import api from "./client";

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
};

export function apiErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  return err?.response?.data?.message || fallback;
}
