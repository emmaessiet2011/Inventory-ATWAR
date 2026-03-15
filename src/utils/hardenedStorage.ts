const ENVELOPE_VERSION = 1;

export const AUTH_SESSION_STORAGE_KEY = 'atwar_secure_session_user_v1';
export const CORE_SALES_STORAGE_KEY = 'atwar_secure_sales_v1';
export const CORE_PAYMENTS_STORAGE_KEY = 'atwar_secure_payments_v1';
export const CORE_USERS_STORAGE_KEY = 'atwar_secure_users_v1';

interface HardenedEnvelope<T> {
  version: number;
  updatedAt: string;
  payload: string;
  checksum: string;
  meta?: {
    source?: string;
  };
  value?: T;
}

const normalize = (value: string) => String(value || '');

export const hashString = (value: string): string => {
  const text = normalize(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
    hash ^= hash >>> 13;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const encodeBase64 = (value: string): string => {
  const text = normalize(value);
  try {
    return btoa(unescape(encodeURIComponent(text)));
  } catch {
    return text;
  }
};

const decodeBase64 = (value: string): string => {
  const text = normalize(value);
  try {
    return decodeURIComponent(escape(atob(text)));
  } catch {
    return text;
  }
};

const buildChecksum = (key: string, payload: string, updatedAt: string) =>
  hashString(`${key}|${payload}|${updatedAt}|${ENVELOPE_VERSION}`);

const parseLegacyJson = <T,>(raw: string): T | null => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const parseEnvelope = <T,>(raw: string): HardenedEnvelope<T> | null => {
  try {
    const parsed = JSON.parse(raw) as HardenedEnvelope<T>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.version !== 'number') return null;
    if (typeof parsed.updatedAt !== 'string') return null;
    if (typeof parsed.payload !== 'string') return null;
    if (typeof parsed.checksum !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
};

export const readHardenedState = <T,>(
  storage: Storage,
  key: string,
  fallback: T,
  legacyKeys: string[] = [],
): T => {
  try {
    const raw = storage.getItem(key);
    if (raw) {
      const envelope = parseEnvelope<T>(raw);
      if (envelope) {
        const expected = buildChecksum(key, envelope.payload, envelope.updatedAt);
        if (expected === envelope.checksum) {
          const decoded = decodeBase64(envelope.payload);
          const parsed = parseLegacyJson<T>(decoded);
          if (parsed !== null) return parsed;
        }
      } else {
        const plain = parseLegacyJson<T>(raw);
        if (plain !== null) return plain;
      }
    }
  } catch {
    // ignored
  }

  for (const legacyKey of legacyKeys) {
    try {
      const legacyRaw = storage.getItem(legacyKey);
      if (!legacyRaw) continue;
      const parsed = parseLegacyJson<T>(legacyRaw);
      if (parsed !== null) return parsed;
    } catch {
      // ignored
    }
  }

  return fallback;
};

export const writeHardenedState = <T,>(
  storage: Storage,
  key: string,
  value: T,
): void => {
  const updatedAt = new Date().toISOString();
  const payload = encodeBase64(JSON.stringify(value));
  const envelope: HardenedEnvelope<T> = {
    version: ENVELOPE_VERSION,
    updatedAt,
    payload,
    checksum: buildChecksum(key, payload, updatedAt),
  };
  storage.setItem(key, JSON.stringify(envelope));
};

export const removeLegacyKeys = (storage: Storage, legacyKeys: string[]): void => {
  legacyKeys.forEach((legacyKey) => {
    try {
      storage.removeItem(legacyKey);
    } catch {
      // ignored
    }
  });
};

