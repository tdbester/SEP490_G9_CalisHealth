import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';

/**
 * Bọc các route yêu cầu đăng nhập.
 * - Chưa login: redirect về /login, kèm returnUrl để login xong quay lại.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuthContext();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
