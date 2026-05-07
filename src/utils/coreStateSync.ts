import { getApiBaseUrl } from './apiBase';

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

