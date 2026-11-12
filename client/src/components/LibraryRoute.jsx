import { useEffect, useState } from "react";
import ProtectedRoute from "./ProtectedRoute";
import { AUTH_SESSION_CHANGED } from "../utils/authSession";
import { isGuestSession } from "../utils/authState";

/**
 * Guard cho các trang Library MỞ CHO CẢ GUEST:
 * - GUEST (chưa đăng nhập): được xem danh sách bài tập / workout hệ thống.
 * - Đã đăng nhập: áp dụng đầy đủ `ProtectedRoute` (kiểm tra role + bảo trì)
 *   như các trang member khác.
 *
 * Trạng thái token được theo dõi liên tục nên khi người dùng vừa đăng nhập
 * xong (không reload trang) thì trang tự chuyển sang chế độ member.
 */
export default function LibraryRoute({ children }) {
  const [guest, setGuest] = useState(() => isGuestSession());

  useEffect(() => {
    const sync = () => setGuest(isGuestSession());
    window.addEventListener(AUTH_SESSION_CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTH_SESSION_CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (guest) return children;
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
