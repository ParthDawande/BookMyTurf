import { useState } from 'react';

// Chosen pattern: (a) useApiError hook + <ErrorBanner> component.
// Simplest for v1 — no extra library, surfaces backend {error:"..."} shape directly.
export function useApiError() {
  const [error, setErrorState] = useState(null);

  const setError = (err) => {
    if (!err) { setErrorState(null); return; }
    // Accept raw axios error, a string, or already-extracted message.
    if (typeof err === 'string') { setErrorState(err); return; }
    const msg = err.response?.data?.error || err.message || 'An unexpected error occurred';
    setErrorState(msg);
  };

  const clearError = () => setErrorState(null);

  return { error, setError, clearError };
}
