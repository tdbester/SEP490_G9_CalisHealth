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
    const status = err.response?.status;
    const requestPath = err.config?.url || "";
    const isLoginRequest = /\/auth\/login(?:\?|$)/i.test(requestPath);
    const { token } = getStoredAuthToken();

    if (status === 401 || status === 403) {
      const requestUrl = err.config?.baseURL
        ? `${err.config.baseURL.replace(/\/$/, "")}/${(err.config.url || "").replace(/^\//, "")}`
        : err.config?.url || "unknown URL";
      console.error("[API Auth Error]", {
        status: err.response.status,
        url: requestUrl,
        method: err.config?.method?.toUpperCase() || "UNKNOWN",
        error: err,
      });

      if (token && !isLoginRequest) {
        localStorage.clear();
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
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
