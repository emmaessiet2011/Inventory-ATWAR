/**
 * apiClient.ts
 * Thin, auth-aware HTTP client for atomic record sync.
 * Each CRUD function in GlobalContext calls syncRecord/deleteRecord
 * instead of pushing a giant snapshot blob.
 */

const getApiBase = (): string =>
  String(import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

const AUTH_TOKEN_KEY = 'atwar_auth_token';

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const parts = String(token || '').split('.');
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const isTokenExpired = (token: string): boolean => {
  const payload = decodeJwtPayload(token);
  if (!payload) return true;
  const exp = Number(payload.exp);
  if (!Number.isFinite(exp) || exp <= 0) return true;
  return Date.now() >= exp * 1000;
};

/**
 * Called whenever the server returns 401 (token expired or invalid).
 * Clears the stored token and dispatches a global event so the app
 * can redirect to the login screen automatically.
 */
function handle401(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  window.dispatchEvent(new CustomEvent('atwar:auth:expired'));
}

const getToken = (): string => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY) || '';
  if (!token) return '';
  // Avoid request storms with expired JWTs: clear the token before
  // any protected call is attempted.
  if (isTokenExpired(token)) {
    handle401();
    return '';
  }
  return token;
};

export const hasValidAuthToken = (): boolean => Boolean(getToken());

const authHeaders = (): Record<string, string> => {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/**
 * True unless explicitly disabled.
 * This keeps Postgres as the default source of truth in production.
 */
export const isLiveSyncEnabled = (): boolean => {
  const flag = String(import.meta.env.VITE_ENABLE_DB_SYNC || '').trim().toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'off') return false;
  return true;
};

/**
 * Fetch ALL records for a resource (no pagination).
 * Returns the `meta` field of each row if present — that is the full
 * original frontend object. Falls back to the whole row if no meta.
 */
export async function apiFetchAll<T>(resource: string): Promise<T[]> {
  if (!isLiveSyncEnabled() || !hasValidAuthToken()) return [];
  const res = await fetch(
    `${getApiBase()}/api/data/${encodeURIComponent(resource)}?paginate=false`,
    { headers: authHeaders() },
  );
  if (res.status === 401) { handle401(); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error(`apiFetchAll(${resource}): HTTP ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json.data)) return [];
  return json.data.map((row: Record<string, unknown>) => {
    const meta = row.meta;
    if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
      // Merge canonical DB row + meta snapshot so partial meta payloads
      // never drop required fields and cause runtime page crashes.
      return ({ ...row, ...(meta as Record<string, unknown>) } as T);
    }
    return row as T;
  });
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
  if (!isLiveSyncEnabled() || !hasValidAuthToken()) return null;
  const delays = [5_000, 15_000];
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await apiFetchAll<T>(resource);
    } catch (err) {
      // Don't retry on auth failure
      if (err instanceof Error && err.message === 'Unauthorized') return null;
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
 * On 401 the token is cleared and the app is redirected to login.
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
  )
    .then(async (res) => {
      if (res.status === 401) {
        handle401();
        return;
      }
      if (!res.ok) {
        let detail = '';
        try {
          detail = await res.text();
        } catch {}
        console.error(`[syncRecord] ${resource} failed (${res.status})`, detail || data);
      }
    })
    .catch(() => {});
}

/**
 * Awaited upsert helper for critical flows where UI must reflect
 * true server state (e.g., business settings that must not disappear).
 */
export async function syncRecordStrict(
  resource: string,
  data: object,
): Promise<{ ok: boolean; status: number; error?: string }> {
  if (!isLiveSyncEnabled()) {
    return { ok: false, status: 0, error: 'Live sync is disabled' };
  }
  if (!getToken()) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  try {
    const res = await fetch(
      `${getApiBase()}/api/sync/record/${encodeURIComponent(resource)}`,
      {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(data),
      },
    );
    if (res.status === 401) {
      handle401();
      return { ok: false, status: 401, error: 'Unauthorized' };
    }
    if (!res.ok) {
      let detail = '';
      try {
        detail = await res.text();
      } catch {}
      console.error(`[syncRecordStrict] ${resource} failed (${res.status})`, detail || data);
      return { ok: false, status: res.status, error: detail || `HTTP ${res.status}` };
    }
    return { ok: true, status: res.status };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
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
  )
    .then(async (res) => {
      if (res.status === 401) {
        handle401();
        return;
      }
      if (!res.ok) {
        let detail = '';
        try {
          detail = await res.text();
        } catch {}
        console.error(`[deleteRecord] ${resource}:${id} failed (${res.status})`, detail);
      }
    })
    .catch(() => {});
}

/**
 * Awaited delete helper for critical flows where UI must reflect
 * true server state (e.g., destructive admin actions).
 */
export async function deleteRecordStrict(
  resource: string,
  id: string,
): Promise<{ ok: boolean; status: number; error?: string }> {
  if (!isLiveSyncEnabled()) {
    return { ok: false, status: 0, error: 'Live sync is disabled' };
  }
  if (!getToken()) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  try {
    const res = await fetch(
      `${getApiBase()}/api/sync/record/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`,
      { method: 'DELETE', headers: authHeaders() },
    );
    if (res.status === 401) {
      handle401();
      return { ok: false, status: 401, error: 'Unauthorized' };
    }
    if (!res.ok) {
      let detail = '';
      try {
        detail = await res.text();
      } catch {}
      console.error(`[deleteRecordStrict] ${resource}:${id} failed (${res.status})`, detail);
      return { ok: false, status: res.status, error: detail || `HTTP ${res.status}` };
    }
    return { ok: true, status: res.status };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Generic helpers for the dedicated resource endpoints
//  (field-payments, payment-accounts, register-sessions, stock-ledger, etc.)
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch all records from a dedicated endpoint like /api/sync/field-payments */
export async function fetchDedicated<T>(path: string): Promise<T[] | null> {
  if (!isLiveSyncEnabled() || !getToken()) return null;
  try {
    const res = await fetch(`${getApiBase()}${path}`, { headers: authHeaders() });
    if (res.status === 401) { handle401(); return null; }
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json.data) ? (json.data as T[]) : null;
  } catch {
    return null;
  }
}

/** Fire-and-forget upsert to a dedicated endpoint like /api/sync/field-payments/:id */
export function syncDedicated(path: string, id: string, data: object): void {
  if (!isLiveSyncEnabled() || !getToken()) return;
  void fetch(`${getApiBase()}${path}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
    .then(async (res) => {
      if (res.status === 401) {
        handle401();
        return;
      }
      if (!res.ok) {
        let detail = '';
        try {
          detail = await res.text();
        } catch {}
        console.error(`[syncDedicated] ${path}:${id} failed (${res.status})`, detail || data);
      }
    })
    .catch(() => {});
}

/** Fire-and-forget delete to a dedicated endpoint like /api/sync/field-payments/:id */
export function deleteDedicated(path: string, id: string): void {
  if (!isLiveSyncEnabled() || !getToken()) return;
  void fetch(`${getApiBase()}${path}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
    .then(async (res) => {
      if (res.status === 401) {
        handle401();
        return;
      }
      if (!res.ok) {
        let detail = '';
        try {
          detail = await res.text();
        } catch {}
        console.error(`[deleteDedicated] ${path}:${id} failed (${res.status})`, detail);
      }
    })
    .catch(() => {});
}

/**
 * Fire-and-forget atomic stock increment/decrement.
 * Uses POST /api/sync/stock-delta so the server applies the change with
 * a SQL-level atomic increment — concurrent requests from different users
 * are both applied correctly instead of the last write winning.
 *
 * @param productId  The product's ID in the database.
 * @param delta      Positive = stock added, negative = stock sold/removed.
 */
export function syncStockDelta(productId: string, delta: number): void {
  if (!isLiveSyncEnabled() || !getToken() || delta === 0) return;
  void fetch(
    `${getApiBase()}/api/sync/stock-delta`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ productId, delta }),
    },
  )
    .then(res => { if (res.status === 401) handle401(); })
    .catch(() => {});
}
