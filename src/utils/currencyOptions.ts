export interface CurrencyOption {
  code: string;
  label: string;
  symbol: string;
}

const FALLBACK_CURRENCIES: CurrencyOption[] = [
  { code: 'OMR', label: 'Omani Rial (OMR)', symbol: 'OMR' },
  { code: 'AED', label: 'UAE Dirham (AED)', symbol: 'AED' },
  { code: 'SAR', label: 'Saudi Riyal (SAR)', symbol: 'SAR' },
  { code: 'USD', label: 'US Dollar (USD)', symbol: '$' },
  { code: 'EUR', label: 'Euro (EUR)', symbol: 'EUR' },
];

const SYMBOL_CLEANUP_REGEX = /[0-9\s.,\u0660-\u0669\u06f0-\u06f9]/g;

const getCurrencyName = (code: string, locale: string): string => {
  try {
    const DisplayNamesCtor = (Intl as unknown as { DisplayNames?: new (locales?: string | string[], options?: { type: 'currency' }) => { of?: (value: string) => string } }).DisplayNames;
    if (!DisplayNamesCtor) return code;
    const displayNames = new DisplayNamesCtor(locale, { type: 'currency' });
    const name = displayNames.of?.(code) || code;
    return String(name).trim() || code;
  } catch {
    return code;
  }
};

const getCurrencySymbol = (code: string, locale: string): string => {
  try {
    const formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(0);
    const symbol = formatted.replace(SYMBOL_CLEANUP_REGEX, '').trim();
    return symbol || code;
  } catch {
    return code;
  }
};

export const buildAvailableCurrencyOptions = (locale = 'en'): CurrencyOption[] => {
  try {
    const supportedValuesOf = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
    if (!supportedValuesOf) return FALLBACK_CURRENCIES;
    const codes = supportedValuesOf('currency');
    if (!Array.isArray(codes) || codes.length === 0) return FALLBACK_CURRENCIES;

    return Array.from(new Set(codes.map((code) => String(code || '').toUpperCase()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b))
      .map((code) => {
        const name = getCurrencyName(code, locale);
        return {
          code,
          label: `${name} (${code})`,
          symbol: getCurrencySymbol(code, locale),
        };
      });
  } catch {
    return FALLBACK_CURRENCIES;
  }
};
