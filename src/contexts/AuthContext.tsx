import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getToken, setToken, removeToken } from '@/lib/storage';
import { useMe } from '@/features/auth/hooks/useMe';
import type { User } from '@/features/auth/types';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginSuccess: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Provider quản lý trạng thái đăng nhập:
 * - Token lưu trong localStorage
 * - User info lấy từ API /auth/me khi có token
 * - Khi logout: xóa token + xóa cache React Query
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(getToken());
  const queryClient = useQueryClient();

  // Chỉ gọi /me khi có token
  const { data: user, isLoading } = useMe(Boolean(token));

  // Nếu token bị xóa từ axios interceptor (401), đồng bộ lại state
  useEffect(() => {
    const onStorage = () => setTokenState(getToken());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const loginSuccess = (newToken: string, newUser: User) => {
    setToken(newToken);
    setTokenState(newToken);
    queryClient.setQueryData(['auth', 'me'], newUser);
  };

  const logout = () => {
    removeToken();
    setTokenState(null);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isAuthenticated: Boolean(token && user),
        isLoading: isLoading && Boolean(token),
        loginSuccess,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext phải được dùng trong AuthProvider');
  return ctx;
}
