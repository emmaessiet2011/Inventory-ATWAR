const DEFAULT_API_BASE_URL = 'http://localhost:4000';

const getApiBaseUrl = (): string => {
  const configured = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  const base = configured || DEFAULT_API_BASE_URL;
  return base.replace(/\/+$/, '');
};

export const isCoreSyncEnabled = (): boolean =>
  String(import.meta.env.VITE_ENABLE_DB_SYNC || '').trim().toLowerCase() === 'true';

/** Lightweight health ping while users are active. */
export const pingBackend = async (): Promise<void> => {
  try {
    await fetch(`${getApiBaseUrl()}/api/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  } catch {
    // Best effort only; app data is always loaded through typed API resources.
  }
};
