/**
 * apiClient.ts
 * Thin, auth-aware HTTP client for atomic record sync.
 * Each CRUD function in GlobalContext calls syncRecord/deleteRecord
 * instead of pushing a giant snapshot blob.
 */

const getApiBase = (): string =>
  String(import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

const getToken = (): string => localStorage.getItem('atwar_auth_token') || '';

const authHeaders = (): Record<string, string> => {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/** True when DB sync is enabled via env var. */
export const isLiveSyncEnabled = (): boolean =>
  String(import.meta.env.VITE_ENABLE_DB_SYNC || '').trim().toLowerCase() === 'true';

/**
 * Fetch ALL records for a resource (no pagination).
 * Returns the `meta` field of each row if present — that is the full
 * original frontend object. Falls back to the whole row if no meta.
 */
export async function apiFetchAll<T>(resource: string): Promise<T[]> {
  const res = await fetch(
    `${getApiBase()}/api/data/${encodeURIComponent(resource)}?paginate=false`,
    { headers: authHeaders() },
  );
  if (!res.ok) throw new Error(`apiFetchAll(${resource}): HTTP ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json.data)) return [];
  return json.data.map((row: Record<string, unknown>) =>
    row.meta && typeof row.meta === 'object' ? (row.meta as T) : (row as T),
  );
}

/**
 * apiFetchAll with up to `retries` retry attempts (5 s, 15 s delays).
 * Returns null only when every attempt fails — callers must NOT wipe
 * local state in that case.
 */
export async function apiFetchAllWithRetry<T>(
  resource: string,
  retries = 2,
): Promise<T[] | null> {
  const delays = [5_000, 15_000];
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await apiFetchAll<T>(resource);
    } catch {
      if (attempt < retries) {
        await new Promise<void>(resolve => setTimeout(resolve, delays[attempt] ?? 15_000));
      }
    }
  }
  return null;
}

/**
 * Fire-and-forget upsert of a single record.
 * Sends the full frontend object to PUT /api/sync/record/:resource —
 * the server handles the field mapping into the relational table.
 * Errors are silently swallowed; the local state is already correct.
 */
export function syncRecord(resource: string, data: object): void {
  if (!isLiveSyncEnabled() || !getToken()) return;
  void fetch(
    `${getApiBase()}/api/sync/record/${encodeURIComponent(resource)}`,
    {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data),
    },
  ).catch(() => {});
}

/**
 * Fire-and-forget delete of a single record.
 * Sends DELETE /api/sync/record/:resource/:id.
 */
export function deleteRecord(resource: string, id: string): void {
  if (!isLiveSyncEnabled() || !getToken()) return;
  void fetch(
    `${getApiBase()}/api/sync/record/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`,
    { method: 'DELETE', headers: authHeaders() },
  ).catch(() => {});
}
