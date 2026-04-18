import { hashString } from './hardenedStorage';

export interface LocalBackupSnapshot {
  version: number;
  createdAt: string;
  recordCount: number;
  keys: Record<string, string>;
  checksum: string;
}

export interface BackupAuditTrail {
  lastBackupAt?: string;
  lastBackupRecordCount?: number;
  lastBackupChecksum?: string;
  lastValidatedAt?: string;
  lastValidatedRecordCount?: number;
  lastRestoreAt?: string;
  lastRestoreRecordCount?: number;
}

const BACKUP_VERSION = 1;
const BACKUP_FILE_PREFIX = 'atwar-bss-backup';
export const BACKUP_AUDIT_STORAGE_KEY = 'app_backup_audit_v1';

const BACKUP_ALLOWED_KEYS = new Set<string>([
  BACKUP_AUDIT_STORAGE_KEY,
  'app_customer_custom_columns',
  'app_supplier_custom_columns',
  'app_cheque_reminder_date',
  'atwar_login_identifier',
]);

const BACKUP_ALLOWED_PREFIXES = [
  'app_dashboard_sticky_',
  'app_dashboard_views_',
];

const includeKey = (key: string) =>
  BACKUP_ALLOWED_KEYS.has(key) ||
  BACKUP_ALLOWED_PREFIXES.some((prefix) => key.startsWith(prefix));

export const getBackupFilename = (now: Date = new Date()): string => {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  return `${BACKUP_FILE_PREFIX}-${stamp}.json`;
};

const buildChecksum = (keys: Record<string, string>): string => {
  const serialized = Object.keys(keys)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => `${key}:${keys[key]}`)
    .join('|');
  return hashString(`${serialized}|backup-v${BACKUP_VERSION}`);
};

export const createLocalBackupSnapshot = (storage: Storage): LocalBackupSnapshot => {
  const keys: Record<string, string> = {};
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !includeKey(key)) continue;
    const value = storage.getItem(key);
    if (value === null) continue;
    keys[key] = value;
  }

  return {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    recordCount: Object.keys(keys).length,
    keys,
    checksum: buildChecksum(keys),
  };
};

export const serializeLocalBackup = (storage: Storage): string =>
  JSON.stringify(createLocalBackupSnapshot(storage), null, 2);

const parseSnapshot = (raw: string): LocalBackupSnapshot => {
  const parsed = JSON.parse(raw) as LocalBackupSnapshot;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid backup payload.');
  }
  if (parsed.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version: ${parsed.version}`);
  }
  if (!parsed.keys || typeof parsed.keys !== 'object') {
    throw new Error('Backup keys are missing.');
  }
  const keyEntries = Object.entries(parsed.keys);
  if (keyEntries.some(([key, value]) => typeof key !== 'string' || typeof value !== 'string')) {
    throw new Error('Backup key/value payload is invalid.');
  }
  if (parsed.recordCount !== keyEntries.length) {
    throw new Error('Backup record count mismatch.');
  }
  const expected = buildChecksum(parsed.keys);
  if (expected !== parsed.checksum) {
    throw new Error('Backup checksum mismatch. File may be corrupted or tampered.');
  }
  return parsed;
};

export const validateLocalBackup = (raw: string): LocalBackupSnapshot => parseSnapshot(raw);

const readAuditTrail = (storage: Storage): BackupAuditTrail => {
  try {
    const raw = storage.getItem(BACKUP_AUDIT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as BackupAuditTrail;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
};

const writeAuditTrail = (storage: Storage, next: BackupAuditTrail) => {
  storage.setItem(BACKUP_AUDIT_STORAGE_KEY, JSON.stringify(next));
};

export const getBackupAuditTrail = (storage: Storage): BackupAuditTrail => readAuditTrail(storage);

export const markBackupExported = (storage: Storage, snapshot: LocalBackupSnapshot): BackupAuditTrail => {
  const current = readAuditTrail(storage);
  const next: BackupAuditTrail = {
    ...current,
    lastBackupAt: new Date().toISOString(),
    lastBackupRecordCount: snapshot.recordCount,
    lastBackupChecksum: snapshot.checksum,
  };
  writeAuditTrail(storage, next);
  return next;
};

export const markBackupValidated = (storage: Storage, snapshot: LocalBackupSnapshot): BackupAuditTrail => {
  const current = readAuditTrail(storage);
  const next: BackupAuditTrail = {
    ...current,
    lastValidatedAt: new Date().toISOString(),
    lastValidatedRecordCount: snapshot.recordCount,
  };
  writeAuditTrail(storage, next);
  return next;
};

export const restoreLocalBackup = (
  storage: Storage,
  raw: string,
): { restored: number; skipped: number } => {
  const snapshot = parseSnapshot(raw);
  let restored = 0;
  let skipped = 0;
  Object.entries(snapshot.keys).forEach(([key, value]) => {
    if (!includeKey(key)) {
      skipped += 1;
      return;
    }
    storage.setItem(key, value);
    restored += 1;
  });
  const currentAudit = readAuditTrail(storage);
  const nextAudit: BackupAuditTrail = {
    ...currentAudit,
    lastRestoreAt: new Date().toISOString(),
    lastRestoreRecordCount: restored,
  };
  writeAuditTrail(storage, nextAudit);
  return { restored, skipped };
};
