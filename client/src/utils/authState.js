/**
 * Trạng thái phiên đăng nhập ở phía client.
 *
 * Ứng dụng dùng client-side router nên không có "session" thật — chỉ có token
 * trong localStorage. GUEST là người chưa đăng nhập (không có token).
 */

/** GUEST = chưa đăng nhập (không có token hợp lệ trong localStorage). */
export function isGuestSession() {
  return !localStorage.getItem("token")?.trim();
}

/**
 * Đường dẫn tới trang đăng nhập, kèm `returnTo` để sau khi đăng nhập xong
 * người dùng quay lại đúng trang đang cố mở.
 */
export function loginPath(returnTo) {
  if (!returnTo) return "/login";
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

/**
 * Đường dẫn đầy đủ của trang hiện tại (kèm query) — dùng làm `returnTo`.
 */
export function currentPath(location) {
  if (!location) return "/";
  const search = location.search || "";
  const hash = location.hash || "";
  return `${location.pathname || "/"}${search}${hash}`;
}

export default { isGuestSession, loginPath, currentPath };
