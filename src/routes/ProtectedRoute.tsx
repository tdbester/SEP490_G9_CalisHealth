import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  allowedRole?: string;
}

/**
 * Bọc các route yêu cầu đăng nhập.
 * - Chưa login: redirect về /login, kèm returnUrl để login xong quay lại.
 */
export function ProtectedRoute({ allowedRole }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuthContext();
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

  if (allowedRole && user?.role !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
