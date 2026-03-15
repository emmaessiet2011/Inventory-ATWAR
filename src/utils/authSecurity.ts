export const AUTH_HASH_VERSION = 'ATWAR-H1';

export interface AuthCredentialShape {
  id?: string;
  username?: string;
  email?: string;
  password?: string;
  passwordHash?: string;
  passwordSalt?: string;
}

const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

const normalizeSecret = (value?: string) => String(value || '').trim();

const fnvHash = (input: string): string => {
  let hash = FNV_OFFSET;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
    hash ^= hash >>> 13;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const randomToken = () => {
  const raw = `${Date.now()}-${Math.random()}-${Math.random()}`;
  return fnvHash(raw);
};

export const generatePasswordSalt = (seed?: string): string => {
  const normalizedSeed = normalizeSecret(seed) || randomToken();
  const seeded = `${normalizedSeed}:${randomToken()}:${Math.random().toString(36).slice(2, 10)}`;
  return fnvHash(`${seeded}:salt:${Date.now()}`);
};

export const hashPasswordSecret = (password: string, salt: string): string => {
  const normalizedPassword = normalizeSecret(password);
  const normalizedSalt = normalizeSecret(salt) || 'atwar-salt-fallback';
  const base = `${AUTH_HASH_VERSION}:${normalizedSalt}:${normalizedPassword}`;
  let rolling = base;
  let digest = '';
  for (let round = 0; round < 4; round += 1) {
    digest = fnvHash(`${rolling}:${round}`);
    rolling = `${digest}:${base}`;
  }
  return `${AUTH_HASH_VERSION}$${digest}`;
};

const fixedTimeEqual = (a: string, b: string): boolean => {
  const left = String(a || '');
  const right = String(b || '');
  const max = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let index = 0; index < max; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return diff === 0;
};

export const hasPasswordCredential = (user?: AuthCredentialShape | null): boolean =>
  !!(
    user &&
    String(user.passwordHash || '').trim() &&
    String(user.passwordSalt || '').trim()
  );

export const verifyUserPassword = (
  user: AuthCredentialShape | null | undefined,
  enteredPassword: string,
): boolean => {
  if (!user) return false;
  const normalizedPassword = normalizeSecret(enteredPassword);
  if (!normalizedPassword) return false;

  const hash = normalizeSecret(user.passwordHash);
  const salt = normalizeSecret(user.passwordSalt);
  if (hash && salt) {
    return fixedTimeEqual(hash, hashPasswordSecret(normalizedPassword, salt));
  }

  // Legacy fallback for users not yet migrated to hashed credentials.
  const legacyPassword = normalizeSecret(user.password);
  if (!legacyPassword) return false;
  return fixedTimeEqual(legacyPassword, normalizedPassword);
};

