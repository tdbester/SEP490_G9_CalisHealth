import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/authApi';
import type { ForgotRequest, MessageResponse } from '../types';

export function useForgotPassword() {
  return useMutation<MessageResponse, Error, ForgotRequest>({
    mutationFn: authApi.forgotPassword,
  });
}
