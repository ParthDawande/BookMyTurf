import { Navigate } from 'react-router-dom';
import { getToken, getUser } from '../lib/tokens';

// Reads auth state directly from localStorage so the guard sees the correct
// state immediately after navigate() fires from Login/Register — React's batched
// setState commits asynchronously, but localStorage writes are synchronous.
export function RoleGuard({ role, children }) {
  const token = getToken();
  const user  = getUser();
  const isAuthenticated = !!token && !!user;

  const hasRole = (r) => {
    if (!user) return false;
    if (Array.isArray(r)) return r.includes(user.role);
    return user.role === r;
  };

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!hasRole(role))   return <Navigate to="/" replace />;

  return children;
}
