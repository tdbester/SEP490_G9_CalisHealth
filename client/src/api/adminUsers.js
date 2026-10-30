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
};

export function apiErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  return err?.response?.data?.message || fallback;
}
