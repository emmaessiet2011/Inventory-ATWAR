export type DropdownCollectionMap = Record<string, any[]>;

const DEFAULT_API_BASE_URL = 'http://localhost:4000';
const AUTH_TOKEN_KEY = 'atwar_auth_token';

const getApiBaseUrl = (): string => {
  const configured = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  const base = configured || DEFAULT_API_BASE_URL;
  return base.replace(/\/+$/, '');
};

export const isDropdownSyncEnabled = (): boolean =>
  !['false', '0', 'off'].includes(String(import.meta.env.VITE_ENABLE_DB_SYNC || '').trim().toLowerCase());

const getToken = (): string => {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

const buildHeaders = (includeJsonContentType = false): Record<string, string> => {
  const token = getToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  if (includeJsonContentType) headers['Content-Type'] = 'application/json';
  return headers;
};

const handle401 = (): void => {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // ignore storage errors
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('atwar:auth:expired'));
  }
};

export const fetchDropdownCollections = async (keys: string[]): Promise<DropdownCollectionMap> => {
  const normalizedKeys = Array.from(new Set(
    keys
      .map((key) => String(key || '').trim())
      .filter(Boolean),
  ));

  if (normalizedKeys.length === 0) return {};
  if (!isDropdownSyncEnabled() || !getToken()) return {};

  try {
    const params = new URLSearchParams({ keys: normalizedKeys.join(',') });
    const response = await fetch(`${getApiBaseUrl()}/api/options/bulk?${params.toString()}`, {
      method: 'GET',
      headers: buildHeaders(false),
    });
    if (response.status === 401) {
      handle401();
      return {};
    }
    if (!response.ok) return {};
    const payload = await response.json();
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
    const collections: DropdownCollectionMap = {};
    normalizedKeys.forEach((key) => {
      collections[key] = Array.isArray(data[key]) ? data[key] : [];
    });
    return collections;
  } catch {
    return {};
  }
};

export const pushDropdownCollections = async (collections: DropdownCollectionMap): Promise<boolean> => {
  const payload: DropdownCollectionMap = {};
  Object.entries(collections || {}).forEach(([key, value]) => {
    const normalizedKey = String(key || '').trim();
    if (!normalizedKey) return;
    payload[normalizedKey] = Array.isArray(value) ? value : [];
  });

  if (Object.keys(payload).length === 0) return true;
  if (!isDropdownSyncEnabled() || !getToken()) return false;

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/options/bulk`, {
      method: 'PUT',
      headers: buildHeaders(true),
      body: JSON.stringify({ collections: payload }),
    });
    if (response.status === 401) {
      handle401();
      return false;
    }
    return response.ok;
  } catch {
    return false;
  }
};
