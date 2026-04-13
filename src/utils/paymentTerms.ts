export type PaymentStatusValue = 'Paid' | 'Due' | 'Partial' | 'Overdue';

export interface SalePaymentTermLike {
  date?: unknown;
  dueDate?: unknown;
  payTerm?: unknown;
  payTermValue?: unknown;
  payTermType?: unknown;
  paymentStatus?: unknown;
  sellDue?: unknown;
  grandTotal?: unknown;
  totalAmount?: unknown;
  totalPaid?: unknown;
}

export interface ParsedPayTerm {
  value: number;
  unit: 'Days' | 'Months';
}

export interface SaleDueTimingSummary {
  hasPayTerm: boolean;
  dueDateIso: string;
  daysUntilDue: number | null;
  isOverdue: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const dmy = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?$/i,
  );
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]) - 1;
    const year = Number(dmy[3]);
    const rawHour = Number(dmy[4] || 0);
    const minute = Number(dmy[5] || 0);
    const ampm = String(dmy[6] || '').toUpperCase();
    const hour = ampm ? ((rawHour % 12) + (ampm === 'PM' ? 12 : 0)) : rawHour;
    const parsed = new Date(year, month, day, hour, minute, 0, 0);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const normalized = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
  const fallback = new Date(normalized);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const startOfDay = (value: Date): Date =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);

const formatIsoDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizePayTermUnit = (value: unknown): 'Days' | 'Months' | null => {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return null;
  if (text.startsWith('month')) return 'Months';
  if (text.startsWith('day')) return 'Days';
  return null;
};

const parsePayTermFromText = (value: unknown): ParsedPayTerm | null => {
  const text = String(value || '').trim();
  if (!text) return null;
  const match = text.match(/(\d+(?:\.\d+)?)\s*(day|days|month|months)/i);
  if (!match) return null;
  const quantity = Number(match[1]);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const unit = normalizePayTermUnit(match[2]);
  if (!unit) return null;
  return {
    value: quantity,
    unit,
  };
};

export const parseSalePayTerm = (sale: SalePaymentTermLike): ParsedPayTerm | null => {
  const explicitValue = Number(sale?.payTermValue);
  const explicitUnit = normalizePayTermUnit(sale?.payTermType);
  if (explicitUnit && Number.isFinite(explicitValue) && explicitValue > 0) {
    return {
      value: explicitValue,
      unit: explicitUnit,
    };
  }
  return parsePayTermFromText(sale?.payTerm);
};

const addPayTermToDate = (base: Date, term: ParsedPayTerm): Date => {
  const result = new Date(base.getTime());
  if (term.unit === 'Months') {
    const wholeMonths = Math.max(0, Math.round(term.value));
    result.setMonth(result.getMonth() + wholeMonths);
    return result;
  }
  const days = Math.max(0, Math.round(term.value));
  result.setDate(result.getDate() + days);
  return result;
};

const resolveOutstanding = (sale: SalePaymentTermLike): number => {
  if (typeof sale?.sellDue === 'number') return Math.max(0, Number(sale.sellDue));
  const total = toNumber(sale?.grandTotal ?? sale?.totalAmount);
  const paid = toNumber(sale?.totalPaid);
  return Math.max(0, Number((total - paid).toFixed(3)));
};

const normalizeStatus = (value: unknown): PaymentStatusValue => {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'paid') return 'Paid';
  if (key === 'partial') return 'Partial';
  if (key === 'overdue') return 'Overdue';
  return 'Due';
};

export const resolveSaleDueDate = (sale: SalePaymentTermLike): string => {
  const explicitDueDate = parseDate(sale?.dueDate);
  if (explicitDueDate) return formatIsoDate(startOfDay(explicitDueDate));

  const baseDate = parseDate(sale?.date);
  const payTerm = parseSalePayTerm(sale);
  if (!baseDate || !payTerm) return '';
  return formatIsoDate(startOfDay(addPayTermToDate(baseDate, payTerm)));
};

export const summarizeSaleDueTiming = (
  sale: SalePaymentTermLike,
  now: Date = new Date(),
): SaleDueTimingSummary => {
  const payTerm = parseSalePayTerm(sale);
  const dueDateIso = resolveSaleDueDate(sale);
  if (!dueDateIso) {
    return {
      hasPayTerm: !!payTerm,
      dueDateIso: '',
      daysUntilDue: null,
      isOverdue: false,
    };
  }
  const dueDate = parseDate(dueDateIso);
  if (!dueDate) {
    return {
      hasPayTerm: !!payTerm,
      dueDateIso: '',
      daysUntilDue: null,
      isOverdue: false,
    };
  }
  const dueStart = startOfDay(dueDate).getTime();
  const todayStart = startOfDay(now).getTime();
  const daysUntilDue = Math.round((dueStart - todayStart) / DAY_MS);
  return {
    hasPayTerm: !!payTerm,
    dueDateIso,
    daysUntilDue,
    isOverdue: daysUntilDue < 0,
  };
};

export const resolveSaleEffectivePaymentStatus = (sale: SalePaymentTermLike): PaymentStatusValue => {
  const baseStatus = normalizeStatus(sale?.paymentStatus);
  const outstanding = resolveOutstanding(sale);
  if (baseStatus === 'Paid' || outstanding <= 0.001) return 'Paid';

  const dueSummary = summarizeSaleDueTiming(sale);
  if (dueSummary.isOverdue) return 'Overdue';

  if (baseStatus === 'Partial') return 'Partial';
  if (baseStatus === 'Overdue') return 'Overdue';
  return 'Due';
};

const pluralizeDays = (days: number): string => `day${Math.abs(days) === 1 ? '' : 's'}`;

export const formatSalePaymentStatusLabel = (sale: SalePaymentTermLike): string => {
  const status = resolveSaleEffectivePaymentStatus(sale);
  if (status === 'Paid') return 'Paid';

  const dueSummary = summarizeSaleDueTiming(sale);
  if (dueSummary.daysUntilDue === null) {
    return status;
  }

  if (dueSummary.daysUntilDue < 0) {
    const overdueBy = Math.abs(dueSummary.daysUntilDue);
    return `Overdue by ${overdueBy} ${pluralizeDays(overdueBy)}`;
  }
  if (dueSummary.daysUntilDue === 0) {
    return status === 'Partial' ? 'Partial - Due today' : 'Due today';
  }
  return status === 'Partial'
    ? `Partial - Due in ${dueSummary.daysUntilDue} ${pluralizeDays(dueSummary.daysUntilDue)}`
    : `Due in ${dueSummary.daysUntilDue} ${pluralizeDays(dueSummary.daysUntilDue)}`;
};

export const formatDueMonthLabel = (dueDateIso: string): string => {
  if (!dueDateIso) return '';
  const parsed = parseDate(dueDateIso);
  if (!parsed) return '';
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(parsed);
  } catch {
    return dueDateIso.slice(0, 7);
  }
};
