import { describe, expect, it } from 'vitest';
import {
  BACKUP_AUDIT_STORAGE_KEY,
  createLocalBackupSnapshot,
  getBackupAuditTrail,
  markBackupExported,
  markBackupValidated,
  restoreLocalBackup,
  serializeLocalBackup,
  validateLocalBackup,
} from '../../src/utils/backupRestore';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.has(key) ? String(this.data.get(key)) : null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
}

describe('backupRestore utility', () => {
  it('serializes only ERP storage namespaces and validates checksum', () => {
    const storage = new MemoryStorage();
    storage.setItem('app_sales', '[1,2]');
    storage.setItem('atwar_secure_users_v1', '{"ok":true}');
    storage.setItem('random_key', 'should-be-excluded');

    const raw = serializeLocalBackup(storage);
    const snapshot = validateLocalBackup(raw);
    expect(snapshot.recordCount).toBe(2);
    expect(Object.keys(snapshot.keys).sort()).toEqual(['app_sales', 'atwar_secure_users_v1']);
  });

  it('rejects tampered payloads', () => {
    const storage = new MemoryStorage();
    storage.setItem('app_sales', '[1]');
    const raw = serializeLocalBackup(storage);
    const tampered = raw.replace('[1]', '[2]');

    expect(() => validateLocalBackup(tampered)).toThrow(/checksum mismatch/i);
  });

  it('restores backup and records restore audit metadata', () => {
    const source = new MemoryStorage();
    source.setItem('app_sales', '[{"id":"S1"}]');
    source.setItem('atwar_secure_users_v1', '[{"id":"U1"}]');
    const raw = serializeLocalBackup(source);

    const target = new MemoryStorage();
    const result = restoreLocalBackup(target, raw);
    expect(result.restored).toBe(2);
    expect(target.getItem('app_sales')).toBe('[{"id":"S1"}]');
    expect(target.getItem('atwar_secure_users_v1')).toBe('[{"id":"U1"}]');

    const audit = getBackupAuditTrail(target);
    expect(typeof audit.lastRestoreAt).toBe('string');
    expect(audit.lastRestoreRecordCount).toBe(2);
  });

  it('tracks backup export and validation audit entries', () => {
    const storage = new MemoryStorage();
    storage.setItem('app_products_v2', '[{"id":"P1"}]');
    const snapshot = createLocalBackupSnapshot(storage);

    const afterExport = markBackupExported(storage, snapshot);
    expect(typeof afterExport.lastBackupAt).toBe('string');
    expect(afterExport.lastBackupRecordCount).toBe(1);

    const afterValidation = markBackupValidated(storage, snapshot);
    expect(typeof afterValidation.lastValidatedAt).toBe('string');
    expect(afterValidation.lastValidatedRecordCount).toBe(1);

    const rawAudit = storage.getItem(BACKUP_AUDIT_STORAGE_KEY);
    expect(rawAudit).toBeTruthy();
  });
});

