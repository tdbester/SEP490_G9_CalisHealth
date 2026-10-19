import { useQuery } from '@tanstack/react-query';
import { authApi } from '../api/authApi';

/**
 * Hook lấy thông tin user hiện tại từ /api/auth/me.
 * - Chỉ gọi khi enabled = true (đã có token).
 * - Khi token bị xóa (logout), nên set enabled = false.
 */
export function useMe(enabled = true) {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    enabled,
    staleTime: 5 * 60 * 1000, // 5 phút
    retry: false,
  });
}
