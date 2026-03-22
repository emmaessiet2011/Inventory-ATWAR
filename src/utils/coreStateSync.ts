export interface CoreSyncSnapshot {
  products: any[];
  customers: any[];
  suppliers: any[];
  sales: any[];
  payments: any[];
  users: any[];
  settings: Record<string, any>;
  syncedAt?: string;
}

const DEFAULT_API_BASE_URL = 'http://localhost:4000';

const getApiBaseUrl = (): string => {
  const configured = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  const base = configured || DEFAULT_API_BASE_URL;
  return base.replace(/\/+$/, '');
};

export const isCoreSyncEnabled = (): boolean =>
  String(import.meta.env.VITE_ENABLE_DB_SYNC || '').trim().toLowerCase() === 'true';

const toArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);
const toObject = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};

const normalizeSnapshot = (value: unknown): CoreSyncSnapshot => {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    products: toArray(raw.products),
    customers: toArray(raw.customers),
    suppliers: toArray(raw.suppliers),
    sales: toArray(raw.sales),
    payments: toArray(raw.payments),
    users: toArray(raw.users),
    settings: toObject(raw.settings),
    syncedAt: typeof raw.syncedAt === 'string' ? raw.syncedAt : undefined,
  };
};

export const hasCoreSnapshotData = (snapshot: CoreSyncSnapshot): boolean =>
  snapshot.products.length > 0 ||
  snapshot.customers.length > 0 ||
  snapshot.suppliers.length > 0 ||
  snapshot.sales.length > 0 ||
  snapshot.payments.length > 0 ||
  snapshot.users.length > 0;

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Single attempt to fetch the snapshot with a 20 s timeout.
 * Returns { ok: true, snapshot } on success, { ok: false, snapshot: null } on any failure.
 */
const fetchCoreSnapshotOnce = async (): Promise<{ snapshot: CoreSyncSnapshot | null; ok: boolean }> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20_000);
    const response = await fetch(`${getApiBaseUrl()}/api/sync/core`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return { snapshot: null, ok: false };
    const payload = await response.json();
    return { snapshot: normalizeSnapshot(payload?.data ?? payload), ok: true };
  } catch {
    return { snapshot: null, ok: false };
  }
};

/**
 * Fetch with up to 3 attempts (retrying at 5 s, 15 s) to survive Render cold-start 502s.
 * Returns null ONLY when ALL attempts fail — callers must NOT overwrite DB in that case.
 */
export const fetchCoreSnapshot = async (): Promise<CoreSyncSnapshot | null> => {
  const retryDelays = [5000, 15000];
  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    const { snapshot, ok } = await fetchCoreSnapshotOnce();
    if (ok) return snapshot;
    if (attempt < retryDelays.length) await sleep(retryDelays[attempt]);
  }
  return null;
};

export const pushCoreSnapshot = async (snapshot: CoreSyncSnapshot): Promise<boolean> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/sync/core`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(snapshot),
    });
    if (!response.ok) return false;
    // Keep relational tables up to date while frontend still uses snapshot sync.
    try {
      await fetch(`${getApiBaseUrl()}/api/sync/core/materialize`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
    } catch {
      // non-blocking
    }
    return true;
  } catch {
    return false;
  }
};

/** Lightweight ping to keep the Render free-tier server awake. */
export const pingBackend = async (): Promise<void> => {
  try {
    await fetch(`${getApiBaseUrl()}/api/sync/core`, {
      method: 'HEAD',
      headers: { Accept: 'application/json' },
    });
  } catch {
    // non-blocking — best effort only
  }
};

/**
 * Pushes snapshot with automatic retries to handle Render free-tier cold starts.
 * Retries at 5 s, 15 s, and 30 s before giving up.
 */
export const pushCoreSnapshotWithRetry = async (
  snapshot: CoreSyncSnapshot,
  onStatusChange?: (status: 'syncing' | 'synced' | 'error') => void,
): Promise<boolean> => {
  const retryDelays = [5000, 15000, 30000];
  onStatusChange?.('syncing');
  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    const ok = await pushCoreSnapshot(snapshot);
    if (ok) {
      onStatusChange?.('synced');
      return true;
    }
    if (attempt < retryDelays.length) {
      await sleep(retryDelays[attempt]);
    }
  }
  onStatusChange?.('error');
  return false;
};
