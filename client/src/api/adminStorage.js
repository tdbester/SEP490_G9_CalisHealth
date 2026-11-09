import api from "./client";

/*
 * Admin > Storage (backend: AdminStorageController, /api/admin/storage):
 *   GET    /admin/storage/overview                     -> capacity, breakdowns, 6-month history, top members, auto-cleanup
 *   GET    /admin/storage/quota                        -> { provider, plan, planLimitBytes, quotaEditable }
 *   GET    /admin/storage/media?view&status&source&type&sort&page&size
 *          view=inactive (ORPHANED / REJECTED) | trash (TRASHED; status then filters previousStatus)
 *          -> { items, page, size, totalElements, totalPages, summary }
 *   POST   /admin/storage/media/trash    body { ids }   -> { trashed, purged, freedBytes, skipped, purgeAt }
 *          soft delete: the file stays on disk until purgeAt (settings.trashRetentionDays; 0 = purge now)
 *   POST   /admin/storage/media/restore  body { ids }   -> { restored, graceDays }
 *   POST   /admin/storage/media/{id}/extend body { days } -> media
 *   DELETE /admin/storage/media  body { ids }          -> { deleted, freedBytes, skipped }   (hard delete, TRASHED only)
 *   DELETE /admin/storage/trash                        -> { deleted, freedBytes, skipped }   (empty trash)
 *   GET    /admin/storage/settings                     -> settings
 *   PUT    /admin/storage/settings body settings        -> settings
 *   POST   /admin/storage/usage/refresh                  -> overview (reads the provider right now)
 *   GET    /admin/storage/folders                      -> { folders, created, existing, failed }
 *          the folders of the Cloudinary account the app writes into
 *   POST   /admin/storage/folders/setup                -> creates the folders that are missing
 *   GET    /admin/storage/optimization                 -> { enabled, imageRule, videoRule, deliveryRule, ... }
 *          the rules that shrink the media before it is stored on the CDN
 */
export const adminStorageApi = {
  overview: () => api.get("/admin/storage/overview").then((res) => res.data),
  quota: () => api.get("/admin/storage/quota").then((res) => res.data),
  folders: () => api.get("/admin/storage/folders").then((res) => res.data),
  setupFolders: () => api.post("/admin/storage/folders/setup").then((res) => res.data),
  optimization: () => api.get("/admin/storage/optimization").then((res) => res.data),
  refreshUsage: () => api.post("/admin/storage/usage/refresh").then((res) => res.data),
  media: ({ view, status, source, type, sort, page, size } = {}) =>
    api
      .get("/admin/storage/media", {
        params: {
          view: view || undefined,
          status: status || undefined,
          source: source || undefined,
          type: type || undefined,
          sort: sort || undefined,
          page,
          size,
        },
      })
      .then((res) => res.data),
  trashMedia: (ids) => api.post("/admin/storage/media/trash", { ids }).then((res) => res.data),
  restoreMedia: (ids) => api.post("/admin/storage/media/restore", { ids }).then((res) => res.data),
  extendRetention: (id, days) => api.post(`/admin/storage/media/${id}/extend`, { days }).then((res) => res.data),
  deleteMedia: (ids) => api.delete("/admin/storage/media", { data: { ids } }).then((res) => res.data),
  emptyTrash: () => api.delete("/admin/storage/trash").then((res) => res.data),
  settings: () => api.get("/admin/storage/settings").then((res) => res.data),
  updateSettings: (payload) => api.put("/admin/storage/settings", payload).then((res) => res.data),
};
