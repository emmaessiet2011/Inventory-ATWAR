export const PAYMENT_ACCOUNTS_STORAGE_KEY = 'app_payment_accounts';
export const PAYMENT_ACCOUNT_TYPES_STORAGE_KEY = 'app_payment_account_types';
export const PAYMENT_ACCOUNTS_UPDATED_EVENT = 'app:payment-accounts-updated';

type PaymentMethodLike = {
  name?: string;
  enabled?: boolean;
  account?: string;
};

type LocationLike = {
  name?: string;
  paymentMethods?: PaymentMethodLike[];
};

type PaymentLike = {
  account?: string;
  method?: string;
};

export interface StoredPaymentAccount {
  id: string;
  name: string;
  location: string;
  type: string;
  subType: string;
  accountNumber: string;
  note: string;
  balance: number;
  addedBy: string;
  status: 'Active' | 'Inactive';
  system?: boolean;
}

const normalizeText = (value: unknown) => String(value || '').trim().toLowerCase();
const isCashMethod = (methodName: string) => normalizeText(methodName).includes('cash');
const accountFromMethod = (methodName: string) => (isCashMethod(methodName) ? 'Cash Account' : 'Bank Account');

export const normalizeAccountKey = (value: unknown) => normalizeText(value);

const toBoolean = (value: unknown, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return normalizeText(value) === 'true';
  return fallback;
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const inferPaymentAccountName = (payment: PaymentLike): string => {
  const explicit = String(payment.account || '').trim();
  if (explicit) {
    return normalizeText(explicit).includes('cash') ? 'Cash Account' : 'Bank Account';
  }
  return accountFromMethod(String(payment.method || ''));
};

export const resolveDefaultAccountFromMethod = (
  methodName: string,
  activeLocation?: LocationLike | null,
): string => {
  const normalizedMethod = normalizeText(methodName);
  const locationMethods = Array.isArray(activeLocation?.paymentMethods)
    ? activeLocation.paymentMethods
    : [];
  const matchedMethod = locationMethods.find((method) => {
    if (method?.enabled === false) return false;
    return normalizeText(method?.name) === normalizedMethod;
  });
  const explicitAccount = String(matchedMethod?.account || '').trim();
  if (explicitAccount && normalizeText(explicitAccount) !== 'none') {
    return explicitAccount;
  }
  return accountFromMethod(methodName);
};

const parseStoredPaymentAccounts = (raw: unknown): StoredPaymentAccount[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      const record = item as Partial<StoredPaymentAccount>;
      const name = String(record?.name || '').trim();
      if (!name) return null;
      const status = normalizeText(record?.status) === 'inactive' ? 'Inactive' : 'Active';
      return {
        id: String(record?.id || `ACC-STORED-${index + 1}`),
        name,
        location: String(record?.location || '').trim(),
        type: String(record?.type || 'Cash').trim() || 'Cash',
        subType: String(record?.subType || 'Default').trim() || 'Default',
        accountNumber: String(record?.accountNumber || '').trim(),
        note: String(record?.note || '').trim(),
        balance: toNumber(record?.balance, 0),
        addedBy: String(record?.addedBy || 'Admin').trim() || 'Admin',
        status,
        system: toBoolean(record?.system, false),
      } as StoredPaymentAccount;
    })
    .filter((record): record is StoredPaymentAccount => !!record);
};

export const getStoredPaymentAccounts = (): StoredPaymentAccount[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PAYMENT_ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];
    return parseStoredPaymentAccounts(JSON.parse(raw));
  } catch {
    return [];
  }
};

export const getStoredPaymentAccountTypes = (): string[] => {
  if (typeof window === 'undefined') return ['Cash', 'Bank'];
  try {
    const raw = localStorage.getItem(PAYMENT_ACCOUNT_TYPES_STORAGE_KEY);
    if (!raw) return ['Cash', 'Bank'];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return ['Cash', 'Bank'];
    const normalized = parsed.map(type => String(type || '').trim()).filter(Boolean);
    return normalized.length > 0 ? normalized : ['Cash', 'Bank'];
  } catch {
    return ['Cash', 'Bank'];
  }
};

export const dispatchPaymentAccountsUpdated = (): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PAYMENT_ACCOUNTS_UPDATED_EVENT));
};

export interface BuildPaymentAccountOptionsInput {
  locations: LocationLike[];
  activeLocationName?: string;
  includeNone?: boolean;
  includeDefaults?: boolean;
  includeStoredAccounts?: boolean;
  includeAllLocationAccounts?: boolean;
  methodName?: string;
  additionalAccountNames?: string[];
}

export const buildPaymentAccountOptions = ({
  locations,
  activeLocationName = '',
  includeNone = true,
  includeDefaults = true,
  includeStoredAccounts = true,
  includeAllLocationAccounts = false,
  methodName = '',
  additionalAccountNames = [],
}: BuildPaymentAccountOptionsInput): string[] => {
  if (methodName) {
    const strictOptions = new Set<string>();
    if (includeNone) strictOptions.add('None');
    strictOptions.add(resolveDefaultAccountFromMethod(methodName));
    return Array.from(strictOptions);
  }

  const options = new Set<string>();
  if (includeNone) options.add('None');
  if (includeDefaults) {
    options.add('Cash Account');
    options.add('Bank Account');
  }

  const activeLocation = locations.find(location => normalizeText(location.name) === normalizeText(activeLocationName));
  const locationsToInspect = includeAllLocationAccounts
    ? locations
    : activeLocation
      ? [activeLocation]
      : [];

  locationsToInspect
    .flatMap(location => location.paymentMethods || [])
    .filter(methodRecord => toBoolean(methodRecord.enabled, true))
    .forEach(methodRecord => {
      const configured = String(methodRecord.account || '').trim();
      if (configured && normalizeText(configured) !== 'none') {
        options.add(configured);
      }
    });

  if (includeStoredAccounts) {
    getStoredPaymentAccounts()
      .filter(account => account.status === 'Active')
      .forEach(account => options.add(account.name));
  }

  if (methodName) {
    const suggested = resolveDefaultAccountFromMethod(methodName, activeLocation);
    if (suggested) options.add(suggested);
  }

  additionalAccountNames
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .forEach(value => options.add(value));

  return Array.from(options).filter(Boolean);
};
