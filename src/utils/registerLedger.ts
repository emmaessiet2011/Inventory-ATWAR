import {
  syncDedicatedStrict,
  deleteDedicatedStrict,
  fetchDedicated,
} from '@/utils/apiClient';

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

const REGISTER_UPDATED_EVENT = 'app:register-updated';

let activeRegisterSessionCache: RegisterSessionRecord | null = null;
let registerSessionsCache: RegisterSessionRecord[] = [];
let registerTransactionsCache: RegisterTransaction[] = [];

const notify = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REGISTER_UPDATED_EVENT));
};

const normalizeSession = (row: RegisterSessionRecord): RegisterSessionRecord => ({
  ...row,
  status: row.status === 'Closed' ? 'Closed' : 'Open',
  cashInHand: Number(row.cashInHand || 0),
  closingBalance: row.closingBalance == null ? row.closingBalance : Number(row.closingBalance || 0),
});

const parseSessions = (rows: unknown): RegisterSessionRecord[] => {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row: any): RegisterSessionRecord => {
      const status: RegisterSessionRecord['status'] =
        String(row?.status || 'Open') === 'Closed' ? 'Closed' : 'Open';
      return {
        id: String(row?.id || '').trim(),
        openedAt: String(row?.openedAt || '').trim(),
        openedBy: String(row?.openedBy || '').trim(),
        locationId: String(row?.locationId || '').trim(),
        locationName: String(row?.locationName || '').trim(),
        cashInHand: Number(row?.cashInHand || 0),
        status,
        closedAt: String(row?.closedAt || '').trim() || undefined,
        closedBy: String(row?.closedBy || '').trim() || undefined,
        closingBalance: row?.closingBalance == null ? undefined : Number(row?.closingBalance || 0),
      };
    })
    .filter((row): row is RegisterSessionRecord => Boolean(row.id && row.locationId))
    .map(normalizeSession);
};

const parseTransactions = (rows: unknown): RegisterTransaction[] => {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row: any): RegisterTransaction => ({
      id: String(row?.id || '').trim(),
      sessionId: String(row?.sessionId || '').trim(),
      date: String(row?.date || '').trim(),
      type: String(row?.type || '').trim() as RegisterTransaction['type'],
      amount: Number(row?.amount || 0),
      method: String(row?.method || '').trim() || undefined,
      invoiceNo: String(row?.invoiceNo || '').trim() || undefined,
      note: String(row?.note || '').trim() || undefined,
      addedBy: String(row?.addedBy || '').trim() || undefined,
    }))
    .filter((row) => Boolean(row.id && row.sessionId));
};

const cloneSession = (row: RegisterSessionRecord): RegisterSessionRecord => ({ ...row });
const cloneTransaction = (row: RegisterTransaction): RegisterTransaction => ({ ...row });

const syncActiveFromSessions = () => {
  const openSession = registerSessionsCache.find((session) => session.status === 'Open') || null;
  activeRegisterSessionCache = openSession ? cloneSession(openSession) : null;
};

export const getActiveRegisterSession = (): RegisterSessionRecord | null => (
  activeRegisterSessionCache ? cloneSession(activeRegisterSessionCache) : null
);

export const getRegisterSessions = (): RegisterSessionRecord[] => (
  registerSessionsCache.map(cloneSession)
);

export const getRegisterTransactions = (): RegisterTransaction[] => (
  registerTransactionsCache.map(cloneTransaction)
);

export const fetchRegisterSessionsFromDB = async (): Promise<RegisterSessionRecord[]> => {
  const remoteSessions = await fetchDedicated<RegisterSessionRecord>('/api/sync/register-sessions');
  if (remoteSessions) {
    registerSessionsCache = parseSessions(remoteSessions);
    syncActiveFromSessions();
  }
  return getRegisterSessions();
};

export const fetchRegisterTransactionsFromDB = async (): Promise<RegisterTransaction[]> => {
  const remoteTxs = await fetchDedicated<RegisterTransaction>('/api/sync/register-transactions');
  if (remoteTxs) {
    registerTransactionsCache = parseTransactions(remoteTxs);
  }
  return getRegisterTransactions();
};

export const setActiveRegisterSession = async (session: RegisterSessionRecord | null): Promise<boolean> => {
  if (!session) {
    activeRegisterSessionCache = null;
    notify();
    return true;
  }
  const normalized = normalizeSession(session);
  const saved = await syncDedicatedStrict('/api/sync/register-sessions', normalized.id, normalized);
  if (!saved.ok) return false;
  activeRegisterSessionCache = cloneSession(normalized);
  notify();
  return true;
};

export const setRegisterSessions = async (sessions: RegisterSessionRecord[]): Promise<boolean> => {
  const normalizedSessions = parseSessions(sessions);
  for (const session of normalizedSessions) {
    const saved = await syncDedicatedStrict('/api/sync/register-sessions', session.id, session);
    if (!saved.ok) return false;
  }
  registerSessionsCache = normalizedSessions;
  syncActiveFromSessions();
  notify();
  return true;
};

export const setRegisterTransactions = async (transactions: RegisterTransaction[]): Promise<boolean> => {
  const normalizedTransactions = parseTransactions(transactions);
  for (const tx of normalizedTransactions) {
    const saved = await syncDedicatedStrict('/api/sync/register-transactions', tx.id, tx);
    if (!saved.ok) return false;
  }
  registerTransactionsCache = normalizedTransactions;
  notify();
  return true;
};

export const upsertRegisterSession = async (session: RegisterSessionRecord): Promise<boolean> => {
  const normalized = normalizeSession(session);
  const sessions = getRegisterSessions();
  const idx = sessions.findIndex((entry) => entry.id === normalized.id);
  if (idx >= 0) sessions[idx] = normalized;
  else sessions.unshift(normalized);
  return setRegisterSessions(sessions);
};

export const addRegisterTransaction = async (tx: RegisterTransaction): Promise<boolean> => {
  const nextTx: RegisterTransaction = {
    ...tx,
    id: String(tx.id || '').trim(),
    sessionId: String(tx.sessionId || '').trim(),
    date: String(tx.date || '').trim(),
    amount: Number(tx.amount || 0),
  };
  if (!nextTx.id || !nextTx.sessionId) return false;
  const all = getRegisterTransactions();
  const idx = all.findIndex((entry) => entry.id === nextTx.id);
  if (idx >= 0) all[idx] = nextTx;
  else all.unshift(nextTx);
  return setRegisterTransactions(all);
};

export const deleteRegisterTransaction = async (id: string): Promise<boolean> => {
  const key = String(id || '').trim();
  if (!key) return false;
  const all = getRegisterTransactions();
  const next = all.filter((entry) => entry.id !== key);
  if (next.length === all.length) return true;
  const deleted = await deleteDedicatedStrict('/api/sync/register-transactions', key);
  if (!deleted.ok) return false;
  registerTransactionsCache = parseTransactions(next);
  notify();
  return true;
};

export const closeRegisterSession = (
  sessionId: string,
  closedBy: string,
  closingBalance: number
): Promise<RegisterSessionRecord | null> => {
  const sessions = getRegisterSessions();
  const idx = sessions.findIndex((session) => session.id === sessionId);
  if (idx < 0) return Promise.resolve(null);

  const current = sessions[idx];
  const closed: RegisterSessionRecord = normalizeSession({
    ...current,
    status: 'Closed',
    closedAt: new Date().toISOString(),
    closedBy,
    closingBalance,
  });
  sessions[idx] = closed;
  return (async () => {
    const saved = await setRegisterSessions(sessions);
    if (!saved) return null;
    if (activeRegisterSessionCache?.id === sessionId) {
      activeRegisterSessionCache = null;
    }
    notify();
    return closed;
  })();
};

export const startRegisterSession = async (session: RegisterSessionRecord): Promise<boolean> => {
  const normalized = normalizeSession({
    ...session,
    status: 'Open',
  });
  const opened = await setActiveRegisterSession(normalized);
  if (!opened) return false;
  const upserted = await upsertRegisterSession(normalized);
  if (!upserted) return false;
  const txSaved = await addRegisterTransaction({
    id: `RTX-OPEN-${Date.now()}`,
    sessionId: normalized.id,
    date: normalized.openedAt,
    type: 'open',
    amount: normalized.cashInHand,
    note: `Register opened at ${normalized.locationName}`,
    addedBy: normalized.openedBy,
  });
  return txSaved;
};

/**
 * Bootstrap: load register sessions and transactions from DB.
 */
export const bootstrapRegisterFromDB = async (): Promise<void> => {
  await Promise.all([
    fetchRegisterSessionsFromDB(),
    fetchRegisterTransactionsFromDB(),
  ]);
};
