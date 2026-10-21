import axios from "axios";
import { LANG_STORAGE_KEY } from "../i18n";

const api = axios.create({
  baseURL: "http://localhost:8080/api",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token + current language to every request
// - Authorization: để backend xác thực
// - Accept-Language: để backend trả message đúng ngôn ngữ (vd: "vi" hoặc "en")
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const lang = localStorage.getItem(LANG_STORAGE_KEY);
  if (lang) {
    config.headers["Accept-Language"] = lang;
  }

  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default api;
