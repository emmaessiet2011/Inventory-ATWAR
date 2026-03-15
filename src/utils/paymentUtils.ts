export const clampPrecision = (value: number, fallback = 3, max = 6) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(0, Math.round(value)));
};

const ARABIC_INDIC_DIGITS: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

const normalizeNumericInput = (value: string | number): string => {
  const raw = String(value ?? '');
  if (!raw) return '';
  return raw
    .replace(/[٠-٩۰-۹]/g, (digit) => ARABIC_INDIC_DIGITS[digit] ?? digit)
    .replace(/[٫,]/g, '.')
    .replace(/[\u066C\s]/g, '');
};

export const normalizePrefix = (value: string | undefined | null, fallback: string) => {
  const candidate = String(value || fallback).trim();
  if (!candidate) return fallback;
  return candidate.endsWith('-') ? candidate.slice(0, -1) : candidate;
};

export const sanitizeDecimalInput = (value: string, precision: number): string => {
  const cleaned = normalizeNumericInput(value).replace(/[^\d.]/g, '');
  if (!cleaned) return '';
  const parts = cleaned.split('.');
  const intPart = parts[0] || '0';
  const decimals = parts.slice(1).join('').slice(0, Math.max(0, precision));
  if (precision === 0) return intPart;
  return parts.length > 1 ? `${intPart}.${decimals}` : intPart;
};

export const toFixedPrecision = (value: string | number, precision: number): string => {
  const parsed = Number(normalizeNumericInput(value));
  if (!Number.isFinite(parsed)) return (0).toFixed(Math.max(0, precision));
  return parsed.toFixed(Math.max(0, precision));
};

const pad = (value: number) => String(value).padStart(2, '0');

export const toDateTimeLocalInput = (value?: string): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const dateTimeMatch = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/);
  if (dateTimeMatch) return `${dateTimeMatch[1]}T${dateTimeMatch[2]}:${dateTimeMatch[3]}`;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T00:00`;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';

  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
};
