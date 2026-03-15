export type DropdownCollectionMap = Record<string, any[]>;

const DEFAULT_API_BASE_URL = 'http://localhost:4000';

const getApiBaseUrl = (): string => {
  const configured = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  const base = configured || DEFAULT_API_BASE_URL;
  return base.replace(/\/+$/, '');
};

export const isDropdownSyncEnabled = (): boolean =>
  String(import.meta.env.VITE_ENABLE_DB_SYNC || '').trim().toLowerCase() === 'true';

export const fetchDropdownCollections = async (keys: string[]): Promise<DropdownCollectionMap> => {
  const normalizedKeys = Array.from(new Set(
    keys
      .map((key) => String(key || '').trim())
      .filter(Boolean),
  ));

  if (normalizedKeys.length === 0) return {};

  try {
    const params = new URLSearchParams({ keys: normalizedKeys.join(',') });
    const response = await fetch(`${getApiBaseUrl()}/api/options/bulk?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
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

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/options/bulk`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ collections: payload }),
    });
    return response.ok;
  } catch {
    return false;
  }
};
