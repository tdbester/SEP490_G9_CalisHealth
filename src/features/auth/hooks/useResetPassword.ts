import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/authApi';
import type { ResetRequest, MessageResponse } from '../types';

export function useResetPassword() {
  return useMutation<MessageResponse, Error, ResetRequest>({
    mutationFn: authApi.resetPassword,
  });
}
