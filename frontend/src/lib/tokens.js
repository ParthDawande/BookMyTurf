const TOKEN_KEY = 'bmt_token';
const USER_KEY  = 'bmt_user';

export const getToken  = () => localStorage.getItem(TOKEN_KEY);
export const setToken  = (t) => localStorage.setItem(TOKEN_KEY, t);
export const removeToken = () => localStorage.removeItem(TOKEN_KEY);

export const getUser = () => {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
};
export const setUser   = (u) => localStorage.setItem(USER_KEY, JSON.stringify(u));
export const removeUser = () => localStorage.removeItem(USER_KEY);

export const clearAuth = () => { removeToken(); removeUser(); };
