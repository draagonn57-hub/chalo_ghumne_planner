import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

// ── Request: attach Bearer token ─────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("tp_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response: handle expired / invalid tokens ────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token is expired or invalid — clear local state and force re-login.
      // We do NOT call the AuthContext logout() here (circular dep risk);
      // clearing the token is enough; RequireAuth will redirect on next render.
      localStorage.removeItem("tp_token");

      // Avoid redirect loops on the auth pages themselves.
      const authPaths = ["/login", "/signup", "/forgot", "/reset"];
      if (!authPaths.some((p) => window.location.pathname.startsWith(p))) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      }
    }
    return Promise.reject(error);
  }
);
