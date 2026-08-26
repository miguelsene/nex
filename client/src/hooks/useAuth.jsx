import { createContext, useCallback, useContext, useState } from "react";
import { getSession, logout as authLogout } from "../services/auth.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getSession());

  const login = useCallback((userData) => setUser(userData), []);
  const logout = useCallback(() => {
    authLogout();
    setUser(null);
  }, []);
  const updateUser = useCallback((userData) => setUser(userData), []);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
