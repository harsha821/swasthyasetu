import { createContext, useContext, useState, type ReactNode } from "react";
import { getStoredUser, login as apiLogin, logout as apiLogout, type User } from "../api/client";

interface AuthContextValue {
  user: User | null;
  signIn: (phone: string, password: string) => Promise<User>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser());

  async function signIn(phone: string, password: string) {
    const u = await apiLogin(phone, password);
    setUser(u);
    return u;
  }

  function signOut() {
    apiLogout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
