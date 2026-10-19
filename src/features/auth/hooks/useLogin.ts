import { useMutation } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../api/authApi';
import { useAuthContext } from '@/contexts/AuthContext';
import type { LoginRequest, AuthResponse } from '../types';

/**
 * Hook xử lý login.
 * - Thành công: lưu token, cập nhật user, redirect về trang trước (hoặc /).
 * - Thất bại: throw lỗi để form xử lý (hiển thị alert).
 */
export function useLogin() {
  const { loginSuccess } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();

  return useMutation<AuthResponse, Error, LoginRequest>({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      loginSuccess(data.token, { email: data.email, fullName: data.fullName });
      const from = (location.state as { from?: Location } | null)?.from?.pathname || '/';
      navigate(from, { replace: true });
    },
  });
}
