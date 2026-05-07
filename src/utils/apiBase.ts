const DEFAULT_LOCAL_API_BASE_URL = 'http://localhost:4000';

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, '');

export const getApiBaseUrl = (): string => {
  const configured = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  if (configured) return trimTrailingSlashes(configured);

  if (typeof window !== 'undefined' && window.location?.origin) {
    const host = String(window.location.hostname || '').trim().toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') {
      return DEFAULT_LOCAL_API_BASE_URL;
    }
    return trimTrailingSlashes(window.location.origin);
  }

  return DEFAULT_LOCAL_API_BASE_URL;
};

