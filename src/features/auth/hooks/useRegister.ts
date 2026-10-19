import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/authApi';
import type { RegisterRequest, MessageResponse } from '../types';

/**
 * Hook xử lý đăng ký.
 * Thành công trả message "Vui lòng kiểm tra email...".
 */
export function useRegister() {
  return useMutation<MessageResponse, Error, RegisterRequest>({
    mutationFn: authApi.register,
  });
}
