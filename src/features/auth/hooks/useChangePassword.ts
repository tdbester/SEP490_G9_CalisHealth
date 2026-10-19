import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/authApi';
import type { ChangePasswordRequest, MessageResponse } from '../types';

export function useChangePassword() {
  return useMutation<MessageResponse, Error, ChangePasswordRequest>({
    mutationFn: authApi.changePassword,
  });
}
