/**
 * apiClient.ts
 * Thin, auth-aware HTTP client for atomic record sync.
 * Each CRUD function in GlobalContext calls syncRecord/deleteRecord
 * instead of pushing a giant snapshot blob.
 */

import { clearAuthToken, readAuthToken } from './hardenedStorage';
import { getApiBaseUrl } from './apiBase';

const getApiBase = (): string => getApiBaseUrl();

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
  clearAuthToken();
  window.dispatchEvent(new CustomEvent('atwar:auth:expired'));
}

const getToken = (): string => {
  const token = readAuthToken();
  if (!token) return '';
  // Avoid request storms with expired JWTs: clear the token before
  // any protected call is attempted.
  if (isTokenExpired(token)) {
    handle401();
    return '';
  }
  return token;
};

const toObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

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

const isTestRuntime = (): boolean => {
  const mode = String(import.meta.env.MODE || '').trim().toLowerCase();
  if (mode === 'test') return true;
  const globalProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const nodeEnv = String(globalProcess?.env?.NODE_ENV || '').trim().toLowerCase();
  if (nodeEnv === 'test') return true;
  const vitestFlag = String(globalProcess?.env?.VITEST || '').trim().toLowerCase();
  return vitestFlag === 'true' || vitestFlag === '1';
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
  const rows = json.data.filter(
    (row: unknown): row is Record<string, unknown> =>
      !!row && typeof row === 'object' && !Array.isArray(row),
  );
  return rows.map((row) => {
    const meta = row.meta;
    if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
      return ({ ...(meta as Record<string, unknown>), ...row } as T);
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
 * Backward-compatible awaited upsert wrapper.
 * Sends the full frontend object to PUT /api/sync/record/:resource by
 * delegating to `syncRecordStrict`.
 */
export async function syncRecord(
  resource: string,
  data: object,
): Promise<{ ok: boolean; status: number; error?: string }> {
  return syncRecordStrict(resource, data);
}

/**
 * Awaited upsert helper for critical flows where UI must reflect
 * true server state (e.g., business settings that must not disappear).
 */
export async function syncRecordStrict(
  resource: string,
  data: object,
): Promise<{ ok: boolean; status: number; error?: string }> {
  if (isTestRuntime()) {
    return { ok: true, status: 200 };
  }
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
    if (res.status === 404) {
      // Idempotent delete: already absent server-side.
      return { ok: true, status: 404 };
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
 * Saves a customer payment and recalculates the related invoice balances on
 * the server in one transaction. This prevents background refreshes from
 * briefly reverting paid invoices back to due.
 */
export async function postCustomerPaymentStrict(
  payment: object,
): Promise<{ ok: boolean; status: number; error?: string; data?: unknown }> {
  if (isTestRuntime()) {
    return { ok: true, status: 200 };
  }
  if (!isLiveSyncEnabled()) {
    return { ok: false, status: 0, error: 'Live sync is disabled' };
  }
  if (!getToken()) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  try {
    const res = await fetch(`${getApiBase()}/api/sync/customer-payment`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payment),
    });
    if (res.status === 401) {
      handle401();
      return { ok: false, status: 401, error: 'Unauthorized' };
    }
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {}
    if (!res.ok) {
      const error = toObject(payload).error;
      console.error('[postCustomerPaymentStrict] failed', res.status, payload || payment);
      return {
        ok: false,
        status: res.status,
        error: typeof error === 'string' ? error : `HTTP ${res.status}`,
      };
    }
    return { ok: true, status: res.status, data: payload };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Backward-compatible awaited delete wrapper.
 * Sends DELETE /api/sync/record/:resource/:id by delegating to
 * `deleteRecordStrict`.
 */
export async function deleteRecord(
  resource: string,
  id: string,
): Promise<{ ok: boolean; status: number; error?: string }> {
  return deleteRecordStrict(resource, id);
}

/**
 * Awaited delete helper for critical flows where UI must reflect
 * true server state (e.g., destructive admin actions).
 */
export async function deleteRecordStrict(
  resource: string,
  id: string,
): Promise<{ ok: boolean; status: number; error?: string }> {
  if (isTestRuntime()) {
    return { ok: true, status: 200 };
  }
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
    if (!Array.isArray(json.data)) return null;
    return json.data.filter(
      (row: unknown): row is T =>
        !!row && typeof row === 'object' && !Array.isArray(row),
    );
  } catch {
    return null;
  }
}

/** Backward-compatible awaited upsert to a dedicated endpoint like /api/sync/field-payments/:id */
export async function syncDedicated(
  path: string,
  id: string,
  data: object,
): Promise<{ ok: boolean; status: number; error?: string }> {
  return syncDedicatedStrict(path, id, data);
}

/** Backward-compatible awaited delete to a dedicated endpoint like /api/sync/field-payments/:id */
export async function deleteDedicated(
  path: string,
  id: string,
): Promise<{ ok: boolean; status: number; error?: string }> {
  return deleteDedicatedStrict(path, id);
}

/** Awaited upsert to a dedicated endpoint like /api/sync/field-payments/:id */
export async function syncDedicatedStrict(
  path: string,
  id: string,
  data: object,
): Promise<{ ok: boolean; status: number; error?: string }> {
  if (isTestRuntime()) {
    return { ok: true, status: 200 };
  }
  if (!isLiveSyncEnabled()) {
    return { ok: false, status: 0, error: 'Live sync is disabled' };
  }
  if (!getToken()) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  try {
    const res = await fetch(`${getApiBase()}${path}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    if (res.status === 401) {
      handle401();
      return { ok: false, status: 401, error: 'Unauthorized' };
    }
    if (!res.ok) {
      let detail = '';
      try {
        detail = await res.text();
      } catch {}
      console.error(`[syncDedicatedStrict] ${path}:${id} failed (${res.status})`, detail || data);
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

/** Awaited delete to a dedicated endpoint like /api/sync/field-payments/:id */
export async function deleteDedicatedStrict(
  path: string,
  id: string,
): Promise<{ ok: boolean; status: number; error?: string }> {
  if (isTestRuntime()) {
    return { ok: true, status: 200 };
  }
  if (!isLiveSyncEnabled()) {
    return { ok: false, status: 0, error: 'Live sync is disabled' };
  }
  if (!getToken()) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  try {
    const res = await fetch(`${getApiBase()}${path}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (res.status === 401) {
      handle401();
      return { ok: false, status: 401, error: 'Unauthorized' };
    }
    if (res.status === 404) {
      // Idempotent delete: already absent server-side.
      return { ok: true, status: 404 };
    }
    if (!res.ok) {
      let detail = '';
      try {
        detail = await res.text();
      } catch {}
      console.error(`[deleteDedicatedStrict] ${path}:${id} failed (${res.status})`, detail);
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
 * Backward-compatible awaited atomic stock increment/decrement wrapper.
 * Delegates to `syncStockDeltaStrict`.
 *
 * @param productId  The product's ID in the database.
 * @param delta      Positive = stock added, negative = stock sold/removed.
 */
export async function syncStockDelta(
  productId: string,
  delta: number,
): Promise<{ ok: boolean; status: number; error?: string }> {
  return syncStockDeltaStrict(productId, delta);
}

/** Awaited atomic stock increment/decrement. */
export async function syncStockDeltaStrict(
  productId: string,
  delta: number,
): Promise<{ ok: boolean; status: number; error?: string }> {
  if (isTestRuntime()) {
    return { ok: true, status: 200 };
  }
  if (!isLiveSyncEnabled()) {
    return { ok: false, status: 0, error: 'Live sync is disabled' };
  }
  if (!getToken()) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  if (!delta) {
    return { ok: true, status: 200 };
  }
  try {
    const res = await fetch(
      `${getApiBase()}/api/sync/stock-delta`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ productId, delta }),
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

export async function fetchUserPreferences(
  userId: string,
): Promise<{ ok: boolean; status: number; preferences?: Record<string, unknown>; error?: string }> {
  if (isTestRuntime()) {
    return { ok: true, status: 200, preferences: {} };
  }
  if (!isLiveSyncEnabled()) {
    return { ok: false, status: 0, error: 'Live sync is disabled' };
  }
  if (!getToken()) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) {
    return { ok: false, status: 400, error: 'User id is required' };
  }
  try {
    const res = await fetch(
      `${getApiBase()}/api/users/${encodeURIComponent(normalizedUserId)}/preferences`,
      { headers: authHeaders() },
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
      return { ok: false, status: res.status, error: detail || `HTTP ${res.status}` };
    }
    const payload = await res.json().catch(() => ({}));
    return {
      ok: true,
      status: res.status,
      preferences: toObject(payload?.preferences),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

export async function updateUserPreferences(
  userId: string,
  preferences: Record<string, unknown>,
  options?: { replace?: boolean },
): Promise<{ ok: boolean; status: number; preferences?: Record<string, unknown>; error?: string }> {
  if (isTestRuntime()) {
    return { ok: true, status: 200, preferences: toObject(preferences) };
  }
  if (!isLiveSyncEnabled()) {
    return { ok: false, status: 0, error: 'Live sync is disabled' };
  }
  if (!getToken()) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) {
    return { ok: false, status: 400, error: 'User id is required' };
  }
  try {
    const res = await fetch(
      `${getApiBase()}/api/users/${encodeURIComponent(normalizedUserId)}/preferences`,
      {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          preferences: toObject(preferences),
          mode: options?.replace ? 'replace' : 'merge',
        }),
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
      return { ok: false, status: res.status, error: detail || `HTTP ${res.status}` };
    }
    const payload = await res.json().catch(() => ({}));
    return {
      ok: true,
      status: res.status,
      preferences: toObject(payload?.preferences),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}
