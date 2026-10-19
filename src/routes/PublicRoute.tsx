import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';

/**
 * Bọc các route KHÔNG được phép truy cập khi đã đăng nhập.
 * - Đã login: redirect về / (hoặc returnUrl nếu có)
 */
export function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuthContext();
  const location = useLocation();
  const from = (location.state as { from?: Location } | null)?.from?.pathname || '/';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  return <Outlet />;
}
