import React, { useEffect, useRef, useState } from 'react';
import { Download, ShieldCheck, RefreshCcw } from 'lucide-react';
import { useGlobalContext } from '@/context/GlobalContext';
import {
  BackupAuditTrail,
  createLocalBackupSnapshot,
  getBackupAuditTrail,
  getBackupFilename,
  markBackupExported,
  markBackupValidated,
  restoreLocalBackup,
  serializeLocalBackup,
  validateLocalBackup,
} from '@/utils/backupRestore';
import { formatDateTimeBySettings } from '@/utils/dateTime';

const BackupRestore: React.FC = () => {
  const { settings } = useGlobalContext();
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [backupMode, setBackupMode] = useState<'validate' | 'restore'>('restore');
  const [backupNotice, setBackupNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [backupAudit, setBackupAudit] = useState<BackupAuditTrail>({});

  useEffect(() => {
    setBackupAudit(getBackupAuditTrail(localStorage));
  }, []);

  const formatAuditTime = (value?: string) => {
    const raw = String(value || '').trim();
    if (!raw) return '--';
    return formatDateTimeBySettings(raw, settings.dateFormat, settings.timeFormat, settings.timeZone);
  };

  const handleBackupExport = () => {
    try {
      const snapshot = createLocalBackupSnapshot(localStorage);
      const payload = serializeLocalBackup(localStorage);
      const blob = new Blob([payload], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = getBackupFilename();
      anchor.click();
      URL.revokeObjectURL(url);
      const audit = markBackupExported(localStorage, snapshot);
      setBackupAudit(audit);
      setBackupNotice({
        type: 'success',
        text: `Backup exported successfully (${snapshot.recordCount} records).`,
      });
    } catch {
      setBackupNotice({ type: 'error', text: 'Failed to export backup. Please retry.' });
    }
  };

  const openBackupFilePicker = (mode: 'validate' | 'restore') => {
    setBackupMode(mode);
    backupInputRef.current?.click();
  };

  const handleBackupImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const validated = validateLocalBackup(raw);
      const auditAfterValidation = markBackupValidated(localStorage, validated);
      setBackupAudit(auditAfterValidation);

      if (backupMode === 'validate') {
        setBackupNotice({
          type: 'success',
          text: `Backup is valid (${validated.recordCount} records, created ${formatAuditTime(validated.createdAt)}).`,
        });
      } else {
        const result = restoreLocalBackup(localStorage, raw);
        setBackupAudit(getBackupAuditTrail(localStorage));
        setBackupNotice({
          type: 'success',
          text: `Backup restored (${result.restored} records). Reloading app to apply changes...`,
        });
        setTimeout(() => window.location.reload(), 900);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process backup file.';
      setBackupNotice({ type: 'error', text: message });
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Backup & Restore</h2>
        <p className="text-sm text-slate-500 mt-1">
          Export, validate, and restore browser preferences safely. Business data stays in PostgreSQL.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleBackupExport}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
          >
            <Download size={14} />
            Export Backup
          </button>
          <button
            type="button"
            onClick={() => openBackupFilePicker('validate')}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100"
          >
            <ShieldCheck size={14} />
            Validate Backup File
          </button>
          <button
            type="button"
            onClick={() => openBackupFilePicker('restore')}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100"
          >
            <RefreshCcw size={14} />
            Restore Backup
          </button>
          <input
            ref={backupInputRef}
            type="file"
            accept="application/json"
            onChange={handleBackupImport}
            className="hidden"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-slate-600">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-bold text-slate-700">Last Backup</p>
            <p>{formatAuditTime(backupAudit.lastBackupAt)}</p>
            <p>Records: {Number(backupAudit.lastBackupRecordCount || 0)}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-bold text-slate-700">Last Validation</p>
            <p>{formatAuditTime(backupAudit.lastValidatedAt)}</p>
            <p>Records: {Number(backupAudit.lastValidatedRecordCount || 0)}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-bold text-slate-700">Last Restore</p>
            <p>{formatAuditTime(backupAudit.lastRestoreAt)}</p>
            <p>Records: {Number(backupAudit.lastRestoreRecordCount || 0)}</p>
          </div>
        </div>

        {backupNotice && (
          <p className={`text-xs font-semibold ${backupNotice.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
            {backupNotice.text}
          </p>
        )}
      </div>
    </div>
  );
};

export default BackupRestore;
