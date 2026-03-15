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
};

export const setRegisterSessions = (sessions: RegisterSessionRecord[]): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REGISTER_SESSIONS_KEY, JSON.stringify(sessions));
};

export const setRegisterTransactions = (transactions: RegisterTransaction[]): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REGISTER_TRANSACTIONS_KEY, JSON.stringify(transactions));
};

export const upsertRegisterSession = (session: RegisterSessionRecord): void => {
  const sessions = getRegisterSessions();
  const idx = sessions.findIndex(s => s.id === session.id);
  if (idx >= 0) sessions[idx] = session;
  else sessions.unshift(session);
  setRegisterSessions(sessions);
};

export const addRegisterTransaction = (tx: RegisterTransaction): void => {
  const all = getRegisterTransactions();
  const idx = all.findIndex(entry => entry.id === tx.id);
  if (idx >= 0) {
    all[idx] = tx;
  } else {
    all.unshift(tx);
  }
  setRegisterTransactions(all);
};

export const deleteRegisterTransaction = (id: string): void => {
  const key = String(id || '').trim();
  if (!key) return;
  const all = getRegisterTransactions();
  const next = all.filter(entry => entry.id !== key);
  if (next.length === all.length) return;
  setRegisterTransactions(next);
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
  setRegisterSessions(sessions);

  const active = getActiveRegisterSession();
  if (active?.id === sessionId) {
    setActiveRegisterSession(null);
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
