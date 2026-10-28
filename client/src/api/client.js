import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8080/api",
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

  for (const key of ["token", "accessToken", "jwt"]) {
    const token = normalizeToken(localStorage.getItem(key));
    if (token) return { token, source: key };
  }

  const cachedUser = localStorage.getItem("user");
  if (cachedUser) {
    try {
      const user = JSON.parse(cachedUser);
      const token = normalizeToken(user?.token);
      if (token) return { token, source: "user.token" };
    } catch (error) {
      console.warn("Unable to read cached user token:", error);
    }
  }

  return { token: null, source: null };
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
    if (err.response?.status === 401 || err.response?.status === 403) {
      const requestUrl = err.config?.baseURL
        ? `${err.config.baseURL.replace(/\/$/, "")}/${(err.config.url || "").replace(/^\//, "")}`
        : err.config?.url || "unknown URL";
      console.error("[API Auth Error]", {
        status: err.response.status,
        url: requestUrl,
        method: err.config?.method?.toUpperCase() || "UNKNOWN",
        error: err,
      });
    }
    return Promise.reject(err);
  }
);

export default api;
