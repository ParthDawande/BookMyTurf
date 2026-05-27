import axios from 'axios';
import { getToken, clearAuth } from '../lib/tokens';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
});

// Attach JWT if present; omit header entirely when no token exists.
client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401: session is invalid — clear stored auth and hard-redirect to login.
// Exclude the login endpoint itself so a wrong-password 401 surfaces as an
// error banner instead of causing a hard reload that wipes the form state.
// All other error statuses (400/403/404/409/500/502) pass through so calling
// code can read error.response.data.error from the standard backend shape.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthEndpoint = error.config?.url?.includes('/auth/login') ||
                           error.config?.url?.includes('/auth/register');
    if (error.response?.status === 401 && !isAuthEndpoint) {
      clearAuth();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;
