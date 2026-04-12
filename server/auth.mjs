import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'atwar-bss-super-secret-key-change-me-in-prod';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REMEMBER_EXPIRES_IN = process.env.JWT_REMEMBER_EXPIRES_IN || '30d';

// Helper to gracefully extract token from auth header
export const extractToken = (req) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.split(' ')[1];
  }
  return null;
};

// Middleware to verify JWT tokens
export const requireAuth = (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // Attach user info to request
    next();
  } catch (error) {
    return res.status(401).json({ ok: false, error: 'Invalid or expired token' });
  }
};

// Ensure password is cryptographically secure
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// --- LEGACY FNV HASH LOGIC (for migration) ---
const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;
const AUTH_HASH_VERSION = 'ATWAR-H1';

const normalizeSecret = (value) => String(value || '').trim();

const fnvHash = (input) => {
  let hash = FNV_OFFSET;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
    hash ^= hash >>> 13;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const hashPasswordSecret = (password, salt) => {
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

const fixedTimeEqual = (a, b) => {
  const left = String(a || '');
  const right = String(b || '');
  const max = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let index = 0; index < max; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return diff === 0;
};

export const verifyLegacyPassword = (enteredPassword, passwordHash, passwordSalt, plaintextLegacy) => {
  const normalizedPassword = normalizeSecret(enteredPassword);
  if (!normalizedPassword) return false;

  const hash = normalizeSecret(passwordHash);
  const salt = normalizeSecret(passwordSalt);
  if (hash && salt) {
    return fixedTimeEqual(hash, hashPasswordSecret(normalizedPassword, salt));
  }
  const legacyPassword = normalizeSecret(plaintextLegacy);
  if (!legacyPassword) return false;
  return fixedTimeEqual(legacyPassword, normalizedPassword);
};

// Compare provided password with existing secure hash or legacy hash
// Returns: { isValid: boolean, needsMigration: boolean }
export const verifyPassword = async (password, user) => {
  // If the user's passwordHash starts with standard bcrypt identifier ($2a$, $2b$, or $2y$)
  const isBcrypt = user.passwordHash?.startsWith('$2');
  
  if (isBcrypt) {
    const isValid = await bcrypt.compare(password, user.passwordHash);
    return { isValid, needsMigration: false };
  } else {
    // Attempt legacy FNV check
    const isValid = verifyLegacyPassword(password, user.passwordHash, user.passwordSalt, user.password);
    return { isValid, needsMigration: isValid }; // If valid, we need to migrate it to bcrypt
  }
};

// Generate JWT for authenticated user
export const generateToken = (user, options = {}) => {
  const rememberMe = options?.rememberMe === true;
  const expiresIn = rememberMe ? JWT_REMEMBER_EXPIRES_IN : JWT_EXPIRES_IN;
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      roleId: user.roleId,
    },
    JWT_SECRET,
    { expiresIn }
  );
};
