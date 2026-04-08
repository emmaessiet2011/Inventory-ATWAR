import { syncDedicated, deleteDedicated, fetchDedicated } from '@/utils/apiClient';

export interface RegisterSessionRecord {
  id: string;
  openedAt: string;
  openedBy: string;
  locationId: string;
  locationName: string;
  cashInHand: number;
  status: 'Open' | 'Closed';
  closedAt?: string;
  closedBy?: string;
  closingBalance?: number;
}

export interface RegisterTransaction {
  id: string;
  sessionId: string;
  date: string;
  type: 'open' | 'close' | 'sale' | 'payment' | 'draft' | 'quotation' | 'suspend' | 'expense';
  amount: number;
  method?: string;
  invoiceNo?: string;
  note?: string;
  addedBy?: string;
}

export const REGISTER_ACTIVE_KEY = 'app_open_register';
export const REGISTER_SESSIONS_KEY = 'app_register_sessions';
export const REGISTER_TRANSACTIONS_KEY = 'app_register_transactions';

const safeParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const getActiveRegisterSession = (): RegisterSessionRecord | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(REGISTER_ACTIVE_KEY);
  const parsed = safeParse<RegisterSessionRecord | null>(raw, null);
  if (!parsed || !parsed.id || !parsed.locationId) return null;
  const normalized: RegisterSessionRecord = {
    ...parsed,
    status: parsed.status === 'Closed' ? 'Closed' : 'Open',
  };
  const sessions = getRegisterSessions();
  if (!sessions.some(session => session.id === normalized.id)) {
    upsertRegisterSession(normalized);
  }
  return normalized;
};

export const getRegisterSessions = (): RegisterSessionRecord[] => {
  if (typeof window === 'undefined') return [];
  return safeParse<RegisterSessionRecord[]>(
    localStorage.getItem(REGISTER_SESSIONS_KEY),
    []
  );
};

export const getRegisterTransactions = (): RegisterTransaction[] => {
  if (typeof window === 'undefined') return [];
  return safeParse<RegisterTransaction[]>(
    localStorage.getItem(REGISTER_TRANSACTIONS_KEY),
    []
  );
};

export const setActiveRegisterSession = (session: RegisterSessionRecord | null): void => {
  if (typeof window === 'undefined') return;
  if (!session) {
    localStorage.removeItem(REGISTER_ACTIVE_KEY);
    return;
  }
  localStorage.setItem(REGISTER_ACTIVE_KEY, JSON.stringify(session));
  syncDedicated('/api/sync/register-sessions', session.id, session);
};

export const setRegisterSessions = (sessions: RegisterSessionRecord[]): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REGISTER_SESSIONS_KEY, JSON.stringify(sessions));
  // Sync each session individually so the server has all records
  sessions.forEach(s => syncDedicated('/api/sync/register-sessions', s.id, s));
};

export const setRegisterTransactions = (transactions: RegisterTransaction[]): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REGISTER_TRANSACTIONS_KEY, JSON.stringify(transactions));
  // Sync each transaction individually
  transactions.forEach(tx => syncDedicated('/api/sync/register-transactions', tx.id, tx));
};

export const upsertRegisterSession = (session: RegisterSessionRecord): void => {
  const sessions = getRegisterSessions();
  const idx = sessions.findIndex(s => s.id === session.id);
  if (idx >= 0) sessions[idx] = session;
  else sessions.unshift(session);
  localStorage.setItem(REGISTER_SESSIONS_KEY, JSON.stringify(sessions));
  syncDedicated('/api/sync/register-sessions', session.id, session);
};

export const addRegisterTransaction = (tx: RegisterTransaction): void => {
  const all = getRegisterTransactions();
  const idx = all.findIndex(entry => entry.id === tx.id);
  if (idx >= 0) {
    all[idx] = tx;
  } else {
    all.unshift(tx);
  }
  localStorage.setItem(REGISTER_TRANSACTIONS_KEY, JSON.stringify(all));
  syncDedicated('/api/sync/register-transactions', tx.id, tx);
};

export const deleteRegisterTransaction = (id: string): void => {
  const key = String(id || '').trim();
  if (!key) return;
  const all = getRegisterTransactions();
  const next = all.filter(entry => entry.id !== key);
  if (next.length === all.length) return;
  localStorage.setItem(REGISTER_TRANSACTIONS_KEY, JSON.stringify(next));
  deleteDedicated('/api/sync/register-transactions', key);
};

export const closeRegisterSession = (
  sessionId: string,
  closedBy: string,
  closingBalance: number
): RegisterSessionRecord | null => {
  const sessions = getRegisterSessions();
  const idx = sessions.findIndex(s => s.id === sessionId);
  if (idx < 0) return null;
  const current = sessions[idx];
  const closed: RegisterSessionRecord = {
    ...current,
    status: 'Closed',
    closedAt: new Date().toISOString(),
    closedBy,
    closingBalance,
  };
  sessions[idx] = closed;
  localStorage.setItem(REGISTER_SESSIONS_KEY, JSON.stringify(sessions));
  syncDedicated('/api/sync/register-sessions', closed.id, closed);

  const active = getActiveRegisterSession();
  if (active?.id === sessionId) {
    localStorage.removeItem(REGISTER_ACTIVE_KEY);
  }
  return closed;
};

export const startRegisterSession = (session: RegisterSessionRecord): void => {
  const normalized: RegisterSessionRecord = {
    ...session,
    status: 'Open',
  };
  setActiveRegisterSession(normalized);
  upsertRegisterSession(normalized);
  addRegisterTransaction({
    id: `RTX-OPEN-${Date.now()}`,
    sessionId: normalized.id,
    date: normalized.openedAt,
    type: 'open',
    amount: normalized.cashInHand,
    note: `Register opened at ${normalized.locationName}`,
    addedBy: normalized.openedBy,
  });
};

/**
 * Bootstrap: load register sessions and transactions from DB into localStorage.
 * Call once on app mount (e.g. in POS component).
 */
export const bootstrapRegisterFromDB = async (): Promise<void> => {
  const [remoteSessions, remoteTxs] = await Promise.all([
    fetchDedicated<RegisterSessionRecord>('/api/sync/register-sessions'),
    fetchDedicated<RegisterTransaction>('/api/sync/register-transactions'),
  ]);
  if (remoteSessions) {
    localStorage.setItem(REGISTER_SESSIONS_KEY, JSON.stringify(remoteSessions));
    // Restore active session from DB if present
    const openSession = remoteSessions.find(s => s.status === 'Open');
    if (openSession) {
      localStorage.setItem(REGISTER_ACTIVE_KEY, JSON.stringify(openSession));
    } else {
      localStorage.removeItem(REGISTER_ACTIVE_KEY);
    }
  }
  if (remoteTxs) {
    localStorage.setItem(REGISTER_TRANSACTIONS_KEY, JSON.stringify(remoteTxs));
  }
};
