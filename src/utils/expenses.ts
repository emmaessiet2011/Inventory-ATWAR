import { formatDateTimeBySettings } from './dateTime';

const EDIT_EXPENSE_ID_KEY = 'app_edit_expense_id';

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();

export const getEditExpenseIdKey = () => EDIT_EXPENSE_ID_KEY;

type ExpenseAmountLike = {
  totalAmount?: number;
  amount?: number;
  paidAmount?: number;
  paymentDue?: number;
  isRefund?: boolean;
};

export const parseExpenseDateToMs = (value: unknown): number => {
  const raw = String(value ?? '').trim();
  if (!raw) return Number.NaN;

  const isoDateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnly) {
    const year = Number(isoDateOnly[1]);
    const month = Number(isoDateOnly[2]) - 1;
    const day = Number(isoDateOnly[3]);
    const parsed = new Date(year, month, day, 0, 0, 0, 0).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }

  const direct = Date.parse(raw);
  if (Number.isFinite(direct)) return direct;

  const dmy12h = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,\s*|\s+)?(?:(\d{1,2}):(\d{2})(?:\s*([AP]M))?)?$/i,
  );
  if (dmy12h) {
    const day = Number(dmy12h[1]);
    const month = Number(dmy12h[2]);
    const year = Number(dmy12h[3]);
    const minute = Number(dmy12h[5] || 0);
    let hour = Number(dmy12h[4] || 0);
    const meridiem = normalize(dmy12h[6]);
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    const parsed = new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }

  return Number.NaN;
};

export const toExpenseIsoDateTime = (value: string): string => {
  const parsedMs = parseExpenseDateToMs(value);
  return Number.isFinite(parsedMs) ? new Date(parsedMs).toISOString() : new Date().toISOString();
};

export const toExpenseDateTimeInput = (value: string): string => {
  const parsedMs = parseExpenseDateToMs(value);
  const date = Number.isFinite(parsedMs) ? new Date(parsedMs) : new Date();
  date.setSeconds(0, 0);
  const tzOffsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 16);
};

export const formatExpenseDateTime = (
  value: string,
  dateFormat: string = 'dd/mm/yyyy',
  timeFormat: string = '12',
  timeZone?: string,
): string => {
  const parsedMs = parseExpenseDateToMs(value);
  if (!Number.isFinite(parsedMs)) return String(value || '--');
  return formatDateTimeBySettings(parsedMs, dateFormat, timeFormat, timeZone);
};

export const getExpenseTotalAmount = (expense: ExpenseAmountLike): number => {
  const total = Number(expense.totalAmount ?? expense.amount ?? 0);
  return Number.isFinite(total) ? Math.max(0, total) : 0;
};

export const getExpensePaidAmount = (expense: ExpenseAmountLike): number => {
  const total = getExpenseTotalAmount(expense);
  const explicitPaid = Number(expense.paidAmount);
  if (Number.isFinite(explicitPaid) && explicitPaid >= 0) {
    return Math.max(0, explicitPaid);
  }
  const due = Number(expense.paymentDue);
  if (Number.isFinite(due) && due >= 0) {
    return Math.max(0, total - due);
  }
  return total;
};

export const getExpenseDueAmount = (expense: ExpenseAmountLike): number => {
  const total = getExpenseTotalAmount(expense);
  const paid = getExpensePaidAmount(expense);
  return Math.max(0, total - paid);
};

export const getExpenseCashSignedAmount = (expense: ExpenseAmountLike): number => {
  const paid = getExpensePaidAmount(expense);
  return expense.isRefund ? -paid : paid;
};
