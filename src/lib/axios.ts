import axios, { InternalAxiosRequestConfig } from 'axios';
import { API_URL } from '@/config';
import { getToken } from './storage';

/**
 * Axios instance dùng chung cho toàn bộ app.
 * - Tự động gắn Authorization: Bearer <token> nếu có token trong localStorage
 * - Giữ token đã lưu khi backend trả 401; chỉ logout chủ động mới xóa token
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
