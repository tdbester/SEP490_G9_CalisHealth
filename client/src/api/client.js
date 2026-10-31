import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

export const getStoredAuthToken = () => {
  const normalizeToken = (value) => {
    if (typeof value !== "string") return null;
    let token = value.trim();
    if (token.startsWith('"') && token.endsWith('"')) {
      token = token.slice(1, -1).trim();
    }
    while (/^Bearer\s+/i.test(token)) {
      token = token.replace(/^Bearer\s+/i, "").trim();
    }
    return token || null;
  };

  const token = normalizeToken(localStorage.getItem("token"));
  return { token, source: token ? "token" : null };
};

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const { token } = getStoredAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    config.headers.delete("Content-Type");
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Admin-issued temporary password: every API except /auth/me and change-password is refused.
    if (
      err.response?.status === 403 &&
      err.response?.data?.code === "PASSWORD_CHANGE_REQUIRED" &&
      window.location.pathname !== "/change-password"
    ) {
      window.location.href = "/change-password";
    }
    const isLoginRequest = /\/auth\/login(?:\?|$)/i.test(err.config?.url || "");
    if (err.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/login") {
        const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
      }
    }
    return Promise.reject(err);
  }
);

export const libraryApi = {
  exercises: () => api.get("/public/library/exercises").then((response) => response.data),
  workouts: () => api.get("/public/library/workouts").then((response) => response.data),
};

export default api;
