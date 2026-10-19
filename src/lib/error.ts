import { AxiosError } from 'axios';

/**
 * Cấu trúc lỗi chuẩn hóa dùng trong toàn app.
 * Backend Spring Boot trả về Map<String, String> errors cho validation.
 */
export interface ApiError {
  status: number;
  message: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Parse lỗi từ axios thành ApiError chuẩn.
 * - 400 + field errors: trả về fieldErrors
 * - 400 không có field errors: trả về message
 * - 401: "Phiên đăng nhập hết hạn"
 * - 5xx: "Lỗi máy chủ"
 */
export function parseApiError(err: unknown): ApiError {
  if (err instanceof AxiosError) {
    const status = err.response?.status ?? 0;
    const data = err.response?.data as Record<string, unknown> | undefined;

    if (status === 401) {
      return { status, message: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.' };
    }

    if (data && typeof data === 'object') {
      // Spring Boot validation: { errors: { field: message } }
      if (data.errors && typeof data.errors === 'object') {
        return {
          status,
          message: typeof data.message === 'string' ? data.message : 'Dữ liệu không hợp lệ',
          fieldErrors: data.errors as Record<string, string>,
        };
      }
      if (typeof data.message === 'string') {
        return { status, message: data.message };
      }
    }

    if (status >= 500) {
      return { status, message: 'Lỗi máy chủ. Vui lòng thử lại sau.' };
    }

    return { status, message: err.message || 'Có lỗi xảy ra' };
  }

  return { status: 0, message: 'Lỗi không xác định' };
}
