import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../lib/api";
import { AuthUser, Permissions, ModuleName } from "../types";

interface AuthContextValue {
  user: AuthUser | null;
  permissions: Permissions | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  can: (module: ModuleName, action?: "view" | "create" | "edit" | "delete") => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadMe() {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setPermissions(data.permissions);
    } catch {
      setUser(null);
      setPermissions(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("mrgrain_token");
    if (token) {
      loadMe();
    } else {
      setLoading(false);
    }
  }, []);

  async function login(email: string, password: string) {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("mrgrain_token", data.token);
    setUser({ ...data.user, roleName: data.user.role });
    await loadMe();
  }

  function logout() {
    localStorage.removeItem("mrgrain_token");
    setUser(null);
    setPermissions(null);
    window.location.href = "/login";
  }

  function can(module: ModuleName, action: "view" | "create" | "edit" | "delete" = "view") {
    if (!permissions) return false;
    return !!permissions[module]?.[action];
  }

  return (
    <AuthContext.Provider value={{ user, permissions, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
