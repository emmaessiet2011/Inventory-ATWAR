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

export const fetchCoreSnapshot = async (): Promise<CoreSyncSnapshot | null> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/sync/core`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return normalizeSnapshot(payload?.data ?? payload);
  } catch {
    return null;
  }
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
