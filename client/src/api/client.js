import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8080/api",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginRequest = err.config?.url?.includes("/auth/login");
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

export default api;
