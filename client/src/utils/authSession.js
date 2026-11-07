/**
 * Sự kiện toàn cục báo "phiên đăng nhập đã thay đổi".
 *
 * Vì ứng dụng điều hướng bằng client-side router (không reload trang),
 * các Context đang mount từ trước lúc đăng nhập sẽ không tự biết là
 * người dùng vừa đăng nhập / đăng xuất. Ta bắn sự kiện này để chúng
 * nạp lại dữ liệu theo đúng vai trò hiện tại.
 */
export const AUTH_SESSION_CHANGED = "calishealth:auth-session-changed";

export function notifyAuthSessionChanged() {
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_CHANGED));
}
