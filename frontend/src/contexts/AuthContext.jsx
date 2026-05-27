import { createContext, useState } from 'react';
import { loginApi, registerCustomerApi } from '../api/auth';
import { getToken, getUser, setToken, setUser, clearAuth } from '../lib/tokens';

export const AuthContext = createContext(null);

// Hydration is synchronous on mount: localStorage reads are synchronous,
// so initial state is always populated before first render. No loading flag needed.
export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => getToken());
  const [user,  setUserState]  = useState(() => getUser());

  const login = async (email, password) => {
    const { data } = await loginApi(email, password);
    // Backend response (SNAKE_CASE): user_id, name, email, role, token
    const userData = { id: data.user_id, name: data.name, email: data.email, role: data.role };
    // Write to localStorage first (synchronous) so RoleGuard can read the
    // current auth state even before React batches these setState calls.
    setToken(data.token);
    setUser(userData);
    setTokenState(data.token);
    setUserState(userData);
    return userData;
  };

  const logout = () => {
    clearAuth();
    setTokenState(null);
    setUserState(null);
  };

  const register = async (payload) => {
    const { data } = await registerCustomerApi(payload);
    return data;
  };

  const isAuthenticated = !!token && !!user;
  const hasRole = (role) => {
    if (Array.isArray(role)) return role.includes(user?.role);
    return user?.role === role;
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, register, isAuthenticated, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}
