import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { User } from '../types';

interface UseAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
}

/**
 * Hook tổng hợp cho auth: lấy user + trạng thái đăng nhập.
 * Dùng trong các component cần check login mà không cần mutate.
 */
export function useAuth(): UseAuthReturn {
  const { isAuthenticated, isLoading, user } = useAuthContext();
  return { isAuthenticated, isLoading, user };
}

// Re-export cho code cũ vẫn dùng được
export { useNavigate as useAppNavigate, useLocation };
