import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("tp_token");
    if (!token) { setLoading(false); return; }
    api.get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem("tp_token"))
      .finally(() => setLoading(false));
  }, []);

  const sendOtp = async (email) => {
    const { data } = await api.post("/auth/send-otp", { email });
    return data;
  };

  const verifyOtp = async (email, code) => {
    const { data } = await api.post("/auth/verify-otp", { email, code });
    localStorage.setItem("tp_token", data.token);
    setUser(data.user);
    return data;
  };

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("tp_token", data.token);
    setUser(data.user);
    return data.user;
  };
  const signup = async (name, email, password) => {
    const { data } = await api.post("/auth/signup", { name, email, password });
    localStorage.setItem("tp_token", data.token);
    setUser(data.user);
    return data.user;
  };
  const loginWithGoogle = async (credential) => {
    const { data } = await api.post("/auth/google", {
      credential,
      token: credential,
    });
    localStorage.setItem("tp_token", data.token);
    setUser(data.user);
    return data;
  };
  const logout = () => {
    localStorage.removeItem("tp_token");
    setUser(null);
  };
  const refresh = async () => {
    const { data } = await api.get("/auth/me");
    setUser(data);
    return data;
  };

  return (
    <AuthCtx.Provider value={{ user, loading, sendOtp, verifyOtp, login, signup, loginWithGoogle, logout, refresh, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
