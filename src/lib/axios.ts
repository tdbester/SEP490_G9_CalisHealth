import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_URL } from '@/config';
import { getToken, removeToken } from './storage';

/**
 * Axios instance dùng chung cho toàn bộ app.
 * - Tự động gắn Authorization: Bearer <token> nếu có token trong localStorage
 * - Tự động redirect về /login khi backend trả 401
 */
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: gắn JWT
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: xử lý 401 (token sai/hết hạn)
api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      removeToken();
      // Chỉ redirect khi đang ở trang protected
      const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/verify'];
      const isPublic = publicPaths.some((p) => window.location.pathname.startsWith(p));
      if (!isPublic) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);
