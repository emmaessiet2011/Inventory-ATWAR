const FALLBACK_TIMEZONE = 'Asia/Dubai';

const resolveTimeZone = (timeZone?: string): string => {
  const candidate = String(timeZone || '').trim() || FALLBACK_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return FALLBACK_TIMEZONE;
  }
};

const parseDateInput = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const fromMs = new Date(value);
    return Number.isNaN(fromMs.getTime()) ? null : fromMs;
  }
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;

  const withTimeSeparator = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
  const fallback = new Date(withTimeSeparator);
  if (!Number.isNaN(fallback.getTime())) return fallback;

  const dmyWithTime = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[T\s]+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?$/i
  );
  if (!dmyWithTime) return null;

  const day = Number(dmyWithTime[1]);
  const month = Number(dmyWithTime[2]) - 1;
  const year = Number(dmyWithTime[3]);
  const rawHour = Number(dmyWithTime[4] || 0);
  const minute = Number(dmyWithTime[5] || 0);
  const meridiem = String(dmyWithTime[6] || '').toUpperCase();
  const hour24 = meridiem ? ((rawHour % 12) + (meridiem === 'PM' ? 12 : 0)) : rawHour;
  const parsed = new Date(year, month, day, hour24, minute, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getDateParts = (input: Date, timeZone?: string) => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: resolveTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(input);
  const getPart = (type: Intl.DateTimeFormatPartTypes, fallback: string): string =>
    parts.find((part) => part.type === type)?.value || fallback;

  return {
    day: getPart('day', '01'),
    month: getPart('month', '01'),
    year: getPart('year', '1970'),
    hour: getPart('hour', '00'),
    minute: getPart('minute', '00'),
    second: getPart('second', '00'),
  };
};

const hasExplicitTime = (raw: string): boolean => /(\d{1,2}:\d{2})|([AP]M)/i.test(raw) || raw.includes('T');

export const formatDateBySettings = (
  value: unknown,
  dateFormat: string = 'dd/mm/yyyy',
  timeZone?: string,
): string => {
  const raw = String(value ?? '').trim();
  const parsed = parseDateInput(value);
  if (!parsed) return raw || '--';
  const parts = getDateParts(parsed, timeZone);
  return dateFormat === 'mm/dd/yyyy'
    ? `${parts.month}/${parts.day}/${parts.year}`
    : `${parts.day}/${parts.month}/${parts.year}`;
};

export const formatDateTimeBySettings = (
  value: unknown,
  dateFormat: string = 'dd/mm/yyyy',
  timeFormat: string = '12',
  timeZone?: string,
): string => {
  const raw = String(value ?? '').trim();
  const parsed = parseDateInput(value);
  if (!parsed) return raw || '--';

  const dateOnly = formatDateBySettings(parsed, dateFormat, timeZone);
  if (!hasExplicitTime(raw) && !(value instanceof Date) && typeof value !== 'number') {
    return dateOnly;
  }

  const parts = getDateParts(parsed, timeZone);
  const hour24 = Number(parts.hour);
  if (timeFormat === '24') return `${dateOnly} ${String(hour24).padStart(2, '0')}:${parts.minute}`;
  const meridiem = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = String(hour24 % 12 || 12).padStart(2, '0');
  return `${dateOnly} ${hour12}:${parts.minute} ${meridiem}`;
};

