import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Info, Calendar, Plus, Banknote, Clock, Folder, Calculator, Edit, CheckCircle2, Download, Upload, Settings as SettingsIcon
} from 'lucide-react';
import { AppSettings, useGlobalContext } from '@/context/GlobalContext';
import {
  createLocalBackupSnapshot,
  getBackupAuditTrail,
  getBackupFilename,
  markBackupExported,
  markBackupValidated,
  restoreLocalBackup,
  serializeLocalBackup,
  validateLocalBackup,
  BackupAuditTrail,
} from '@/utils/backupRestore';
import { buildAvailableCurrencyOptions, type CurrencyOption } from '@/utils/currencyOptions';

const Settings: React.FC = () => {
  const { settings: globalSettings, updateSettings, taxRates, productUnits, currentUser, roles } = useGlobalContext();
  const [activeTab, setActiveTab] = useState('business');
  // Local copy of settings — saved to GlobalContext on Save button click
  const [settings, setSettings] = useState<AppSettings>({ ...globalSettings });
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [tabSearch, setTabSearch] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [backupMode, setBackupMode] = useState<'validate' | 'restore'>('restore');
  const [backupNotice, setBackupNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [backupAudit, setBackupAudit] = useState<BackupAuditTrail>({});
  const currencyOptions = useMemo<CurrencyOption[]>(() => {
    const options = buildAvailableCurrencyOptions('en');
    const selectedCode = String(settings.currency || '').trim().toUpperCase();
    if (!selectedCode || options.some((option) => option.code === selectedCode)) {
      return options;
    }
    return [
      {
        code: selectedCode,
        label: `${selectedCode} (Custom)`,
        symbol: String(settings.currencySymbol || '').trim() || selectedCode,
      },
      ...options,
    ];
  }, [settings.currency, settings.currencySymbol]);
  const monthOptions = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const timeZoneOptions = ['Asia/Dubai', 'Asia/Muscat', 'UTC'];
  const stockAccountingOptions = [
    { value: 'fifo', label: 'FIFO (First In First Out)' },
    { value: 'lifo', label: 'LIFO (Last In First Out)' },
    { value: 'average', label: 'Weighted Average Cost' },
  ];
  const dateFormatOptions = ['dd/mm/yyyy', 'mm/dd/yyyy'];
  const timeFormatOptions = [
    { value: '12', label: '12 Hour' },
    { value: '24', label: '24 Hour' },
  ];
  const weighingScaleLengthOptions = [1, 2, 3, 4, 5, 6, 7, 8];

  const handleSave = () => {
    if (!currentUser) return;
    const currentRoleRecord = roles.find(r => r.name === currentUser.role);
    const rolePermissions = currentRoleRecord?.permissions || [];
    const isAdmin = String(currentUser.role || '').toLowerCase() === 'admin' || !!currentRoleRecord?.isSystem;
    const hasPermission = isAdmin || rolePermissions.length === 0 ||
      rolePermissions.includes('Access business settings') ||
      rolePermissions.includes('Settings::Access business settings');
    if (!hasPermission) {
      setSaveError('You do not have permission to update business settings.');
      setTimeout(() => setSaveError(''), 4000);
      return;
    }
    updateSettings(settings);
    setSaved(true);
    setSaveError('');
    setTimeout(() => setSaved(false), 3000);
  };

  const handleChange = <K extends keyof AppSettings,>(field: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    setSettings({ ...globalSettings });
  }, [globalSettings]);

  useEffect(() => {
    setBackupAudit(getBackupAuditTrail(localStorage));
  }, []);

  const handleCurrencyChange = (currencyCode: string) => {
    const normalizedCode = String(currencyCode || '').trim().toUpperCase();
    const selected = currencyOptions.find(c => c.code === normalizedCode);
    setSettings(prev => ({
      ...prev,
      currency: normalizedCode,
      currencySymbol: selected?.symbol || normalizedCode || prev.currencySymbol,
    }));
  };

  const handlePrecisionChange = (field: 'currencyPrecision' | 'quantityPrecision', value: string) => {
    const parsed = Number(value);
    handleChange(field, Number.isFinite(parsed) ? parsed : 3);
  };

  const defaultSaleTaxOptions = useMemo(() => {
    const uniqueByName = new Map<string, { value: string; label: string }>();
    taxRates.forEach((taxRate) => {
      const name = String(taxRate.name || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (uniqueByName.has(key)) return;
      uniqueByName.set(key, {
        value: name,
        label: `${name} (${Number(taxRate.rate || 0).toFixed(3)}%)`,
      });
    });
    const options = [
      { value: 'None', label: 'None' },
      ...Array.from(uniqueByName.values()),
    ];
    const selected = String(settings.defaultSaleTax || '').trim();
    if (selected && selected !== 'None' && !uniqueByName.has(selected.toLowerCase())) {
      options.push({ value: selected, label: `${selected} (Unavailable)` });
    }
    return options;
  }, [taxRates, settings.defaultSaleTax]);

  const tabs = [
    { id: 'business', label: 'Business' },
    { id: 'tax', label: 'Tax' },
    { id: 'product', label: 'Product' },
    { id: 'contact', label: 'Contact' },
    { id: 'sale', label: 'Sale' },
    { id: 'pos', label: 'POS' },
    { id: 'purchases', label: 'Purchases' },
    { id: 'payment', label: 'Payment' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'system', label: 'System' },
    { id: 'prefixes', label: 'Prefixes' },
    { id: 'reward_point_settings', label: 'Reward Point Settings' },
    { id: 'modules', label: 'Modules' },
  ];
  const filteredTabs = useMemo(() => {
    const q = tabSearch.trim().toLowerCase();
    if (!q) return tabs;
    return tabs.filter(tab => tab.label.toLowerCase().includes(q));
  }, [tabSearch]);
  const selectedLogoName = useMemo(() => {
    const logo = String(settings.businessLogo || '').trim();
    if (!logo) return '';
    return logo.startsWith('data:') ? 'Logo selected' : logo;
  }, [settings.businessLogo]);

  useEffect(() => {
    if (filteredTabs.length === 0) return;
    if (!filteredTabs.some(tab => tab.id === activeTab)) {
      setActiveTab(filteredTabs[0].id);
    }
  }, [activeTab, filteredTabs]);

  const handleLogoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleChange('businessLogo', reader.result);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const formatAuditTime = (value?: string) => {
    const raw = String(value || '').trim();
    if (!raw) return '--';
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;
    return parsed.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
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
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
          <SettingsIcon size={22} className="text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Business Settings</h2>
          <p className="text-slate-500 mt-0.5 text-sm">Configure your business preferences and system behaviour.</p>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-500"></div>
         <div className="p-4 border-b border-slate-200 bg-slate-50/50 mt-1">
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search settings…"
                  value={tabSearch}
                  onChange={(e) => setTabSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm"
                />
            </div>
         </div>

         <div className="flex flex-col md:flex-row min-h-[600px]">
            {/* Sidebar */}
            <div className="w-full md:w-64 border-r border-slate-200 bg-white shrink-0">
               {filteredTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left px-6 py-3.5 text-sm font-bold transition-colors border-b border-slate-100 flex items-center justify-between ${
                        activeTab === tab.id 
                        ? 'bg-blue-600 text-white' 
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                      {tab.label}
                      {tab.id === 'tax' && <Info size={14} className={activeTab === 'tax' ? 'text-white' : 'text-[#06b6d4]'} />}
                  </button>
               ))}
               {filteredTabs.length === 0 && (
                 <div className="px-6 py-4 text-xs font-medium text-slate-500">No matching settings section.</div>
               )}
            </div>

            {/* Content Area */}
            <div className="flex-1 p-6 bg-white">
               {activeTab === 'business' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                     {/* Row 1 */}
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Business Name:*</label>
                        <input 
                            type="text" 
                            value={settings.businessName} 
                            onChange={(e) => handleChange('businessName', e.target.value)} 
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" 
                        />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Start Date:</label>
                        <div className="flex">
                            <span className="inline-flex items-center px-3 rounded-l border border-r-0 border-slate-200 bg-slate-50 text-slate-500">
                                <Calendar size={14} />
                            </span>
                            <input 
                                type="text" 
                                value={settings.startDate} 
                                onChange={(e) => handleChange('startDate', e.target.value)} 
                                className="flex-1 px-4 py-3 rounded-r-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" 
                            />
                        </div>
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Default profit percent:* <Info size={14} className="text-[#06b6d4]" /></label>
                        <div className="flex">
                            <span className="inline-flex items-center px-3 rounded-l border border-r-0 border-slate-200 bg-slate-50 text-slate-500">
                                <Plus size={14} />
                            </span>
                            <input 
                                type="text" 
                                value={settings.defaultProfitPercent} 
                                onChange={(e) => handleChange('defaultProfitPercent', e.target.value)} 
                                className="flex-1 px-4 py-3 rounded-r-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" 
                            />
                        </div>
                     </div>

                     {/* Row 2 */}
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Currency:</label>
                        <div className="flex">
                            <span className="inline-flex items-center px-3 rounded-l border border-r-0 border-slate-200 bg-slate-50 text-slate-500">
                                <Banknote size={14} />
                            </span>
                            <select
                                value={settings.currency}
                                onChange={(e) => handleCurrencyChange(e.target.value)}
                                className="flex-1 px-4 py-3 rounded-r-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                            >
                                {currencyOptions.map(option => (
                                  <option key={option.code} value={option.code}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Currency Symbol:</label>
                        <input
                            type="text"
                            value={settings.currencySymbol}
                            onChange={(e) => handleChange('currencySymbol', e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                        />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Currency Symbol Placement:</label>
                        <select
                            value={settings.currencySymbolPlacement}
                            onChange={(e) => handleChange('currencySymbolPlacement', e.target.value as AppSettings['currencySymbolPlacement'])}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                        >
                            <option value="before">Before amount</option>
                            <option value="after">After amount</option>
                        </select>
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Time zone:</label>
                        <div className="flex">
                            <span className="inline-flex items-center px-3 rounded-l border border-r-0 border-slate-200 bg-slate-50 text-slate-500">
                                <Clock size={14} />
                            </span>
                            <select 
                                value={settings.timeZone} 
                                onChange={(e) => handleChange('timeZone', e.target.value)} 
                                className="flex-1 px-4 py-3 rounded-r-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                            >
                                {timeZoneOptions.map(zone => (
                                  <option key={zone} value={zone}>{zone}</option>
                                ))}
                            </select>
                        </div>
                     </div>

                     {/* Row 3 */}
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Upload Logo:</label>
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoSelect}
                          className="hidden"
                        />
                        <div className="flex">
                            <input 
                                type="text" 
                                value={selectedLogoName}
                                className="flex-1 px-3 py-2 rounded-l border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white" 
                                readOnly 
                            />
                            <button
                              type="button"
                              onClick={() => logoInputRef.current?.click()}
                              className="bg-[#2563EB] text-white px-4 py-2 rounded-r text-sm font-bold flex items-center gap-2 hover:bg-blue-700"
                            >
                                <Folder size={14} /> Browse..
                            </button>
                        </div>
                        <p className="text-[11px] text-slate-400 italic mt-1">Previous logo (if exists) will be replaced</p>
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Financial year start month: <Info size={14} className="text-[#06b6d4]" /></label>
                        <div className="flex">
                            <span className="inline-flex items-center px-3 rounded-l border border-r-0 border-slate-200 bg-slate-50 text-slate-500">
                                <Calendar size={14} />
                            </span>
                            <select 
                                value={settings.fyStartMonth} 
                                onChange={(e) => handleChange('fyStartMonth', e.target.value)} 
                                className="flex-1 px-4 py-3 rounded-r-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                            >
                                {monthOptions.map(month => (
                                  <option key={month} value={month}>{month}</option>
                                ))}
                            </select>
                        </div>
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Stock Accounting Method:* <Info size={14} className="text-[#06b6d4]" /></label>
                        <div className="flex">
                            <span className="inline-flex items-center px-3 rounded-l border border-r-0 border-slate-200 bg-slate-50 text-slate-500">
                                <Calculator size={14} />
                            </span>
                            <select 
                                value={settings.stockAccountingMethod} 
                                onChange={(e) => handleChange('stockAccountingMethod', e.target.value)} 
                                className="flex-1 px-4 py-3 rounded-r-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                            >
                                {stockAccountingOptions.map(option => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                     </div>

                     {/* Row 4 */}
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Transaction Edit Days:* <Info size={14} className="text-[#06b6d4]" /></label>
                        <div className="flex">
                            <span className="inline-flex items-center px-3 rounded-l border border-r-0 border-slate-200 bg-slate-50 text-slate-500">
                                <Edit size={14} />
                            </span>
                            <input 
                                type="text" 
                                value={settings.transactionEditDays} 
                                onChange={(e) => handleChange('transactionEditDays', e.target.value)} 
                                className="flex-1 px-4 py-3 rounded-r-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" 
                            />
                        </div>
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Date Format:*</label>
                        <div className="flex">
                            <span className="inline-flex items-center px-3 rounded-l border border-r-0 border-slate-200 bg-slate-50 text-slate-500">
                                <Calendar size={14} />
                            </span>
                            <select 
                                value={settings.dateFormat} 
                                onChange={(e) => handleChange('dateFormat', e.target.value)} 
                                className="flex-1 px-4 py-3 rounded-r-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                            >
                                {dateFormatOptions.map(format => (
                                  <option key={format} value={format}>{format}</option>
                                ))}
                            </select>
                        </div>
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Time Format:*</label>
                        <div className="flex">
                            <span className="inline-flex items-center px-3 rounded-l border border-r-0 border-slate-200 bg-slate-50 text-slate-500">
                                <Clock size={14} />
                            </span>
                            <select 
                                value={settings.timeFormat} 
                                onChange={(e) => handleChange('timeFormat', e.target.value)} 
                                className="flex-1 px-4 py-3 rounded-r-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                            >
                                {timeFormatOptions.map(format => (
                                  <option key={format.value} value={format.value}>{format.label}</option>
                                ))}
                            </select>
                        </div>
                     </div>

                     {/* Row 5 */}
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Currency precision:* <Info size={14} className="text-[#06b6d4]" /></label>
                        <select
                            value={settings.currencyPrecision}
                            onChange={(e) => handlePrecisionChange('currencyPrecision', e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                        >
                            <option value={0}>0</option>
                            <option value={1}>1</option>
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                            <option value={4}>4</option>
                        </select>
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Quantity precision:* <Info size={14} className="text-[#06b6d4]" /></label>
                        <select
                            value={settings.quantityPrecision}
                            onChange={(e) => handlePrecisionChange('quantityPrecision', e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                        >
                            <option value={0}>0</option>
                            <option value={1}>1</option>
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                            <option value={4}>4</option>
                        </select>
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Business Address:</label>
                        <input
                          type="text"
                          value={settings.businessAddress}
                          onChange={(e) => {
                            handleChange('businessAddress', e.target.value);
                            handleChange('address', e.target.value);
                          }}
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                        />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Business City:</label>
                        <input
                          type="text"
                          value={settings.businessCity}
                          onChange={(e) => handleChange('businessCity', e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                        />
                     </div>

                  </div>
               )}

               {activeTab === 'tax' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Tax 1 Name: <Info size={14} className="text-[#06b6d4]" /></label>
                        <input type="text" value={settings.tax1Name} onChange={(e) => handleChange('tax1Name', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" placeholder="e.g. VAT" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Tax 1 No. (Registration No.): <Info size={14} className="text-[#06b6d4]" /></label>
                        <input type="text" value={settings.tax1Number} onChange={(e) => handleChange('tax1Number', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" placeholder="e.g. OM123456789" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Tax 2 Name: <Info size={14} className="text-[#06b6d4]" /></label>
                        <input type="text" value={settings.tax2Name} onChange={(e) => handleChange('tax2Name', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" placeholder="Optional second tax name" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Tax 2 No.: <Info size={14} className="text-[#06b6d4]" /></label>
                        <input type="text" value={settings.tax2Number} onChange={(e) => handleChange('tax2Number', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" placeholder="Optional second tax number" />
                     </div>
                     <div className="space-y-1.5 md:col-span-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={settings.enableTax} onChange={(e) => handleChange('enableTax', e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            <span className="text-sm font-bold text-slate-900">Enable inline tax in purchase and sell</span>
                            <Info size={14} className="text-[#06b6d4]" />
                        </label>
                     </div>
                  </div>
               )}

               {activeTab === 'product' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">SKU Prefix:</label>
                        <input type="text" value={settings.skuPrefix} onChange={(e) => handleChange('skuPrefix', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" placeholder="e.g. SKU-" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Enable Product Expiry: <Info size={14} className="text-[#06b6d4]" /></label>
                        <div className="flex">
                            <span className="inline-flex items-center px-3 rounded-l border border-r-0 border-slate-200 bg-slate-50 text-slate-500">
                                <input type="checkbox" checked={settings.enableProductExpiry} onChange={(e) => handleChange('enableProductExpiry', e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            </span>
                            <select
                              value={settings.enableProductExpiry ? 'add-item-expiry' : 'disabled'}
                              onChange={(e) => handleChange('enableProductExpiry', e.target.value === 'add-item-expiry')}
                              className="flex-1 px-4 py-3 rounded-r-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                            >
                                <option value="add-item-expiry">Add item expiry</option>
                                <option value="disabled">Disable product expiry</option>
                            </select>
                        </div>
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">On Product Expiry: <Info size={14} className="text-[#06b6d4]" /></label>
                        <div className="flex gap-2">
                            <select
                              value={settings.productExpiryAction}
                              onChange={(e) => handleChange('productExpiryAction', e.target.value as AppSettings['productExpiryAction'])}
                              className="flex-1 px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white"
                            >
                                <option value="Keep Selling">Keep Selling</option>
                                <option value="Stop Selling">Stop Selling</option>
                            </select>
                            <input
                              type="text"
                              value={settings.productExpiryGraceDays}
                              onChange={(e) => handleChange('productExpiryGraceDays', e.target.value)}
                              className="w-20 px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm"
                              placeholder="0"
                              title="Days before expiry to stop selling"
                            />
                        </div>
                     </div>

                     <div className="space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={settings.enableBrands} onChange={(e) => handleChange('enableBrands', e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            <span className="text-sm font-bold text-slate-900">Enable Brands</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              checked={settings.enablePriceTaxInfo}
                              onChange={(e) => handleChange('enablePriceTaxInfo', e.target.checked)}
                            />
                            <span className="text-sm font-bold text-slate-900">Enable Price & Tax info</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer mt-6">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              checked={settings.enableRacks}
                              onChange={(e) => handleChange('enableRacks', e.target.checked)}
                            />
                            <span className="text-sm font-bold text-slate-900">Enable Racks</span>
                            <Info size={14} className="text-[#06b6d4]" />
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              checked={settings.enableWarranty}
                              onChange={(e) => handleChange('enableWarranty', e.target.checked)}
                            />
                            <span className="text-sm font-bold text-slate-900">Enable Warranty</span>
                        </label>
                     </div>

                     <div className="space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={settings.enableCategories} onChange={(e) => handleChange('enableCategories', e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            <span className="text-sm font-bold text-slate-900">Enable Categories</span>
                        </label>
                        <div className="space-y-1.5 mt-4">
                            <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Default Unit:</label>
                            <div className="flex">
                                <span className="inline-flex items-center px-3 rounded-l border border-r-0 border-slate-200 bg-slate-50 text-slate-500">
                                    <Calculator size={14} />
                                </span>
                                <select
                                  value={settings.defaultUnit}
                                  onChange={(e) => handleChange('defaultUnit', e.target.value)}
                                  className="flex-1 px-4 py-3 rounded-r-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                >
                                    <option value="">Please Select</option>
                                    {productUnits.map((unit) => (
                                      <option key={unit.id} value={unit.shortName}>{unit.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer mt-6">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              checked={settings.enableRow}
                              onChange={(e) => handleChange('enableRow', e.target.checked)}
                            />
                            <span className="text-sm font-bold text-slate-900">Enable Row</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              checked={settings.isProductImageRequired}
                              onChange={(e) => handleChange('isProductImageRequired', e.target.checked)}
                            />
                            <span className="text-sm font-bold text-slate-900">Is product image required?</span>
                        </label>
                     </div>

                     <div className="space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={settings.enableSubCategories} onChange={(e) => handleChange('enableSubCategories', e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            <span className="text-sm font-bold text-slate-900">Enable Sub-Categories</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer mt-4">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              checked={settings.enableSubUnits}
                              onChange={(e) => handleChange('enableSubUnits', e.target.checked)}
                            />
                            <span className="text-sm font-bold text-slate-900">Enable Sub Units</span>
                            <Info size={14} className="text-[#06b6d4]" />
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer mt-6">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              checked={settings.enablePosition}
                              onChange={(e) => handleChange('enablePosition', e.target.checked)}
                            />
                            <span className="text-sm font-bold text-slate-900">Enable Position</span>
                        </label>
                     </div>
                  </div>
               )}

               {activeTab === 'contact' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Default Credit Limit:</label>
                        <input
                          type="text"
                          value={settings.defaultCreditLimit}
                          onChange={(e) => handleChange('defaultCreditLimit', e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                          placeholder="0"
                        />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Default Pay Term: <Info size={14} className="text-[#06b6d4]" /></label>
                        <select
                          value={settings.defaultPayTerm}
                          onChange={(e) => handleChange('defaultPayTerm', e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                        >
                          <option value="No Limit">No Limit</option>
                          <option value="7 Days">7 Days</option>
                          <option value="15 Days">15 Days</option>
                          <option value="30 Days">30 Days</option>
                          <option value="45 Days">45 Days</option>
                          <option value="60 Days">60 Days</option>
                          <option value="90 Days">90 Days</option>
                        </select>
                     </div>
                  </div>
               )}

               {activeTab === 'pos' && (
                  <div className="space-y-8">
                      <div>
                          <h3 className="text-sm font-bold text-slate-900 mb-1">Add keyboard shortcuts:</h3>
                          <p className="text-xs text-slate-500 mb-2">Shortcut should be the names of the keys separated by '+'; Example: <span className="font-bold">ctrl+shift+b, ctrl+h</span></p>
                          <p className="text-xs text-slate-500 mb-4">
                              <span className="font-bold">Available key names are:</span><br/>
                              shift, ctrl, alt, backspace, tab, enter, return, capslock, esc, escape, space, pageup, pagedown, end, home,<br/>
                              left, up, right, down, ins, del, and plus
                          </p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                              <div>
                                  <div className="grid grid-cols-2 gap-4 mb-2">
                                      <div className="text-xs font-bold text-slate-900">Operations</div>
                                      <div className="text-xs font-bold text-slate-900">Keyboard Shortcut</div>
                                  </div>
                                  <div className="space-y-4">
                                      <div className="grid grid-cols-2 gap-4 items-center">
                                          <label className="text-xs text-slate-900">Express Checkout:</label>
                                          <input
                                            type="text"
                                            value={settings.posShortcutExpressCheckout}
                                            onChange={(e) => handleChange('posShortcutExpressCheckout', e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                          />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4 items-center">
                                          <label className="text-xs text-slate-900">Pay & Checkout:</label>
                                          <input
                                            type="text"
                                            value={settings.posShortcutPayCheckout}
                                            onChange={(e) => handleChange('posShortcutPayCheckout', e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                          />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4 items-center">
                                          <label className="text-xs text-slate-900">Draft:</label>
                                          <input
                                            type="text"
                                            value={settings.posShortcutDraft}
                                            onChange={(e) => handleChange('posShortcutDraft', e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                          />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4 items-center">
                                          <label className="text-xs text-slate-900">Cancel:</label>
                                          <input
                                            type="text"
                                            value={settings.posShortcutCancel}
                                            onChange={(e) => handleChange('posShortcutCancel', e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                          />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4 items-center">
                                          <label className="text-xs text-slate-900">Go to product quantity:</label>
                                          <input
                                            type="text"
                                            value={settings.posShortcutProductQty}
                                            onChange={(e) => handleChange('posShortcutProductQty', e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                          />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4 items-center">
                                          <label className="text-xs text-slate-900">Weighing Scale:</label>
                                          <input
                                            type="text"
                                            value={settings.posShortcutWeighingScale}
                                            onChange={(e) => handleChange('posShortcutWeighingScale', e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                          />
                                      </div>
                                  </div>
                              </div>
                              <div>
                                  <div className="grid grid-cols-2 gap-4 mb-2">
                                      <div className="text-xs font-bold text-slate-900">Operations</div>
                                      <div className="text-xs font-bold text-slate-900">Keyboard Shortcut</div>
                                  </div>
                                  <div className="space-y-4">
                                      <div className="grid grid-cols-2 gap-4 items-center">
                                          <label className="text-xs text-slate-900">Edit Discount:</label>
                                          <input
                                            type="text"
                                            value={settings.posShortcutEditDiscount}
                                            onChange={(e) => handleChange('posShortcutEditDiscount', e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                          />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4 items-center">
                                          <label className="text-xs text-slate-900">Edit Order Tax:</label>
                                          <input
                                            type="text"
                                            value={settings.posShortcutEditOrderTax}
                                            onChange={(e) => handleChange('posShortcutEditOrderTax', e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                          />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4 items-center">
                                          <label className="text-xs text-slate-900">Add Payment Row:</label>
                                          <input
                                            type="text"
                                            value={settings.posShortcutAddPaymentRow}
                                            onChange={(e) => handleChange('posShortcutAddPaymentRow', e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                          />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4 items-center">
                                          <label className="text-xs text-slate-900">Finalize Payment:</label>
                                          <input
                                            type="text"
                                            value={settings.posShortcutFinalizePayment}
                                            onChange={(e) => handleChange('posShortcutFinalizePayment', e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                          />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4 items-center">
                                          <label className="text-xs text-slate-900">Add new product:</label>
                                          <input
                                            type="text"
                                            value={settings.posShortcutAddNewProduct}
                                            onChange={(e) => handleChange('posShortcutAddNewProduct', e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                          />
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>

                      <div className="border-t border-slate-200 pt-6">
                          <h3 className="text-sm font-bold text-slate-900 mb-4">POS settings:</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-4">
                              <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-900">Default POS Payment Method:</label>
                                  <select
                                    value={settings.posDefaultPaymentMethod}
                                    onChange={(e) => handleChange('posDefaultPaymentMethod', e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                                  >
                                      <option value="Cash">Cash</option>
                                      <option value="Card">Card</option>
                                      <option value="Bank Transfer">Bank Transfer</option>
                                      <option value="Cheque">Cheque</option>
                                      <option value="Multi Pay">Multi Pay</option>
                                  </select>
                              </div>
                              <div className="hidden md:block"></div>
                              <div className="hidden md:block"></div>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={settings.disableMultiplePay}
                                    onChange={(e) => handleChange('disableMultiplePay', e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-slate-900">Disable Multiple Pay</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={settings.disableDraft}
                                    onChange={(e) => handleChange('disableDraft', e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-slate-900">Disable Draft</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={settings.disableQuotation}
                                    onChange={(e) => handleChange('disableQuotation', e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-slate-900">Disable Quotation</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={settings.disableExpressCheckout}
                                    onChange={(e) => handleChange('disableExpressCheckout', e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-slate-900">Disable Express Checkout</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={settings.dontShowProductSuggestion}
                                    onChange={(e) => handleChange('dontShowProductSuggestion', e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-slate-900">Don't show product suggestion</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={settings.dontShowRecentTransactions}
                                    onChange={(e) => handleChange('dontShowRecentTransactions', e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-slate-900">Don't show recent transactions</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!settings.posEnableDiscount}
                                    onChange={(e) => handleChange('posEnableDiscount', !e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-slate-900">Disable Discount</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!settings.posEnableTax}
                                    onChange={(e) => handleChange('posEnableTax', !e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-slate-900">Disable order tax</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={settings.subtotalEditable}
                                    onChange={(e) => handleChange('subtotalEditable', e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-slate-900">Subtotal Editable</span>
                                  <Info size={14} className="text-[#06b6d4]" />
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={settings.disableSuspendSale}
                                    onChange={(e) => handleChange('disableSuspendSale', e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-slate-900">Disable Suspend Sale</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={settings.enableTransactionDateOnPOSScreens}
                                    onChange={(e) => handleChange('enableTransactionDateOnPOSScreens', e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-slate-900">Enable transaction date on POS screen</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={settings.enableServiceStaffInProductLine}
                                    onChange={(e) => handleChange('enableServiceStaffInProductLine', e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-slate-900">Enable service staff in product line</span>
                                  <Info size={14} className="text-[#06b6d4]" />
                              </label>
                              <div className="hidden md:block"></div>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={settings.isServiceStaffRequired}
                                    onChange={(e) => handleChange('isServiceStaffRequired', e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-slate-900">Is service staff required</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={settings.disableCreditSaleButton}
                                    onChange={(e) => handleChange('disableCreditSaleButton', e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-slate-900">Disable credit sale button</span>
                                  <Info size={14} className="text-[#06b6d4]" />
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={settings.enableWeighingScale}
                                    onChange={(e) => handleChange('enableWeighingScale', e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-slate-900">Enable Weighing Scale</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={settings.showInvoiceScheme}
                                    onChange={(e) => handleChange('showInvoiceScheme', e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-slate-900">Show invoice scheme</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={settings.showInvoiceLayoutDropdown}
                                    onChange={(e) => handleChange('showInvoiceLayoutDropdown', e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-slate-900">Show invoice layout dropdown</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={settings.printInvoiceOnSuspend}
                                    onChange={(e) => handleChange('printInvoiceOnSuspend', e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-slate-900">Print invoice on suspend</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={settings.showPricingOnProductSuggestionTooltip}
                                    onChange={(e) => handleChange('showPricingOnProductSuggestionTooltip', e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-slate-900">Show pricing on product suggestion tooltip</span>
                              </label>
                          </div>
                      </div>

                      <div className="border-t border-slate-200 pt-6">
                          <h3 className="text-sm font-bold text-slate-900 mb-2">Weighing Scale barcode Setting:</h3>
                          <p className="text-xs text-slate-500 mb-4">Configure barcode as per your weighing scale.</p>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-x-8 gap-y-6">
                              <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-900">Prefix:</label>
                                  <input
                                    type="text"
                                    value={settings.weighingScaleBarcodePrefix}
                                    onChange={(e) => handleChange('weighingScaleBarcodePrefix', e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                  />
                              </div>
                              <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-900">Product sku length:</label>
                                  <select
                                    value={settings.weighingScaleProductSkuLength}
                                    onChange={(e) => handleChange('weighingScaleProductSkuLength', Number(e.target.value) || 1)}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                                  >
                                      {weighingScaleLengthOptions.map(length => (
                                        <option key={`ws-sku-${length}`} value={length}>{length}</option>
                                      ))}
                                  </select>
                              </div>
                              <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-900">Quantity integer part length:</label>
                                  <select
                                    value={settings.weighingScaleQuantityIntegerPartLength}
                                    onChange={(e) => handleChange('weighingScaleQuantityIntegerPartLength', Number(e.target.value) || 1)}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                                  >
                                      {weighingScaleLengthOptions.map(length => (
                                        <option key={`ws-int-${length}`} value={length}>{length}</option>
                                      ))}
                                  </select>
                              </div>
                              <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-900">Quantity fractional part length:</label>
                                  <select
                                    value={settings.weighingScaleQuantityFractionalPartLength}
                                    onChange={(e) => handleChange('weighingScaleQuantityFractionalPartLength', Number(e.target.value) || 1)}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                                  >
                                      {weighingScaleLengthOptions.map(length => (
                                        <option key={`ws-frac-${length}`} value={length}>{length}</option>
                                      ))}
                                  </select>
                              </div>
                          </div>
                      </div>
                  </div>
               )}

               {activeTab === 'sale' && (
                  <div className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                         <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Default Sale Discount:*</label>
                            <div className="flex">
                                <span className="inline-flex items-center px-3 rounded-l border border-r-0 border-slate-200 bg-slate-50 text-slate-500 font-bold">
                                    %
                                </span>
                                <input
                                  type="text"
                                  value={settings.defaultSaleDiscount}
                                  onChange={(e) => handleChange('defaultSaleDiscount', e.target.value)}
                                  className="flex-1 px-4 py-3 rounded-r-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                />
                            </div>
                         </div>
                         <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Default Sale Tax:</label>
                            <div className="flex">
                                <span className="inline-flex items-center px-3 rounded-l border border-r-0 border-slate-200 bg-slate-50 text-slate-500">
                                    <Info size={14} />
                                </span>
                                <select
                                  value={settings.defaultSaleTax}
                                  onChange={(e) => handleChange('defaultSaleTax', e.target.value)}
                                  className="flex-1 px-4 py-3 rounded-r-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                >
                                    {defaultSaleTaxOptions.map((option) => (
                                      <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </div>
                         </div>
                         <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Default Sale Payment Method:</label>
                            <select
                              value={settings.defaultSalePaymentMethod}
                              onChange={(e) => handleChange('defaultSalePaymentMethod', e.target.value)}
                              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                            >
                                <option value="Cash">Cash</option>
                                <option value="Card">Card</option>
                                <option value="Cheque">Cheque</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="Emad">Emad</option>
                            </select>
                         </div>
                         <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Sales Item Addition Method:</label>
                            <select
                              value={settings.saleItemAdditionMethod}
                              onChange={(e) => handleChange('saleItemAdditionMethod', e.target.value)}
                              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                            >
                                <option value="Increase item quantity if it already exists">Increase item quantity if it already exists</option>
                                <option value="Add item as a new line">Add item as a new line</option>
                            </select>
                         </div>
                         <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Amount rounding method: <Info size={14} className="text-[#06b6d4]" /></label>
                            <select
                              value={settings.amountRoundingMethod}
                              onChange={(e) => handleChange('amountRoundingMethod', e.target.value)}
                              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                            >
                                <option value="None">None</option>
                                <option value="Round to nearest 0.001">Round to nearest 0.001</option>
                                <option value="Round to nearest 0.010">Round to nearest 0.010</option>
                            </select>
                         </div>
                         <div className="space-y-1.5 flex items-center h-full pt-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  checked={settings.salesPriceIsMinimumSellingPrice}
                                  onChange={(e) => handleChange('salesPriceIsMinimumSellingPrice', e.target.checked)}
                                />
                                <span className="text-sm font-bold text-slate-900">Sales price is minimum selling price</span>
                                <Info size={14} className="text-[#06b6d4]" />
                            </label>
                         </div>
                         <div className="space-y-1.5 flex items-center h-full pt-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={settings.allowOverselling} onChange={(e) => handleChange('allowOverselling', e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                <span className="text-sm font-bold text-slate-900">Allow Overselling</span>
                                <Info size={14} className="text-[#06b6d4]" />
                            </label>
                         </div>
                         <div className="space-y-1.5 flex items-center h-full pt-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={settings.filterProductsByLocation}
                                  onChange={(e) => handleChange('filterProductsByLocation', e.target.checked)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm font-bold text-slate-900">Filter products by location</span>
                                <Info size={14} className="text-[#06b6d4]" title="When ON: only products assigned to the selected location appear in Add Sale / Add Order. When OFF: all products are shown and automatically used under the sale's location." />
                            </label>
                         </div>
                         <div className="space-y-1.5 flex items-center h-full">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={settings.enableSalesOrder} onChange={(e) => handleChange('enableSalesOrder', e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                <span className="text-sm font-bold text-slate-900">Enable Sales Order</span>
                                <Info size={14} className="text-[#06b6d4]" />
                            </label>
                         </div>
                         <div className="space-y-1.5 flex items-center h-full">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={settings.isPayTermRequired} onChange={(e) => handleChange('isPayTermRequired', e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                <span className="text-sm font-bold text-slate-900">Is pay term required?</span>
                            </label>
                         </div>
                      </div>

                      <div className="border-t border-slate-200 pt-6">
                          <h3 className="text-sm font-bold text-slate-900 mb-4">Commission Agent:</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                             <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Sales Commission Agent:</label>
                                <div className="flex">
                                    <span className="inline-flex items-center px-3 rounded-l border border-r-0 border-slate-200 bg-slate-50 text-slate-500">
                                        <Info size={14} />
                                    </span>
                                    <select
                                      value={settings.salesCommissionAgent}
                                      onChange={(e) => handleChange('salesCommissionAgent', e.target.value as 'Disable' | 'Enable')}
                                      className="flex-1 px-4 py-3 rounded-r-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                    >
                                        <option value="Disable">Disable</option>
                                        <option value="Enable">Enable</option>
                                    </select>
                                </div>
                             </div>
                             <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Commission Calculation Type:</label>
                                <div className="flex">
                                    <span className="inline-flex items-center px-3 rounded-l border border-r-0 border-slate-200 bg-slate-50 text-slate-500">
                                        <Info size={14} />
                                    </span>
                                    <select
                                      value={settings.commissionCalculationType}
                                      onChange={(e) => handleChange('commissionCalculationType', e.target.value as 'Invoice value' | 'Paid amount')}
                                      className="flex-1 px-4 py-3 rounded-r-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                      disabled={settings.salesCommissionAgent === 'Disable'}
                                    >
                                        <option value="Invoice value">Invoice value</option>
                                        <option value="Paid amount">Paid amount</option>
                                    </select>
                                </div>
                             </div>
                             <div className="space-y-1.5 flex items-center h-full pt-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={settings.isCommissionAgentRequired}
                                      onChange={(e) => handleChange('isCommissionAgentRequired', e.target.checked)}
                                      disabled={settings.salesCommissionAgent === 'Disable'}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-bold text-slate-900">Is commission agent required?</span>
                                </label>
                             </div>
                          </div>
                      </div>
                  </div>
               )}

               {activeTab === 'purchases' && (
                  <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                          <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Default Purchase Payment Method:</label>
                              <select
                                value={settings.defaultPurchasePaymentMethod}
                                onChange={(e) => handleChange('defaultPurchasePaymentMethod', e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                              >
                                  <option value="Cash">Cash</option>
                                  <option value="Card">Card</option>
                                  <option value="Cheque">Cheque</option>
                                  <option value="Bank Transfer">Bank Transfer</option>
                                  <option value="Emad">Emad</option>
                              </select>
                          </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={settings.enableEditPriceFromPurchase} onChange={(e) => handleChange('enableEditPriceFromPurchase', e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                          <span className="text-sm font-bold text-slate-900">Enable editing product price from purchase screen</span>
                          <Info size={14} className="text-[#06b6d4]" />
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={settings.enablePurchaseStatus} onChange={(e) => handleChange('enablePurchaseStatus', e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                          <span className="text-sm font-bold text-slate-900">Enable Purchase Status</span>
                          <Info size={14} className="text-[#06b6d4]" />
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={settings.enableLotNumber} onChange={(e) => handleChange('enableLotNumber', e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                          <span className="text-sm font-bold text-slate-900">Enable Lot number</span>
                          <Info size={14} className="text-[#06b6d4]" />
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={settings.enablePurchaseOrder} onChange={(e) => handleChange('enablePurchaseOrder', e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                          <span className="text-sm font-bold text-slate-900">Enable purchase order</span>
                          <Info size={14} className="text-[#06b6d4]" />
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={settings.enablePurchaseRequisition} onChange={(e) => handleChange('enablePurchaseRequisition', e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                          <span className="text-sm font-bold text-slate-900">Enable Purchase Requisition</span>
                          <Info size={14} className="text-[#06b6d4]" />
                      </label>
                      </div>
                  </div>
               )}

               {activeTab === 'payment' && (
                  <div className="space-y-6">
                      <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-900">Cash Denominations:</label>
                          <input
                            type="text"
                            value={settings.cashDenominations}
                            onChange={(e) => handleChange('cashDenominations', e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                          />
                          <p className="text-xs text-slate-500">Comma separated values Example: 100,200,500,2000</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                          <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-900">Enable cash denomination on:</label>
                              <select
                                value={settings.cashDenominationEnabledOn}
                                onChange={(e) => handleChange('cashDenominationEnabledOn', e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                              >
                                  <option value="All screens">All screens</option>
                                  <option value="POS screen">POS screen</option>
                                  <option value="Sell screen">Sell screen</option>
                              </select>
                          </div>
                          <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-900">Enable cash denomination for payment methods:</label>
                              <div className="flex items-center gap-4">
                                  <input
                                    type="text"
                                    value={settings.cashDenominationPaymentMethods}
                                    onChange={(e) => handleChange('cashDenominationPaymentMethods', e.target.value)}
                                    className="flex-1 px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm"
                                  />
                                  <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        checked={settings.strictCashDenominationCheck}
                                        onChange={(e) => handleChange('strictCashDenominationCheck', e.target.checked)}
                                      />
                                      <span className="text-sm text-slate-900">Strict check</span>
                                      <Info size={14} className="text-[#06b6d4]" />
                                  </label>
                              </div>
                          </div>
                      </div>
                  </div>
               )}

               {activeTab === 'dashboard' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                      <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-900">View Stock Expiry Alert For:*</label>
                          <div className="flex">
                              <span className="inline-flex items-center px-3 rounded-l border border-r-0 border-slate-200 bg-slate-50 text-slate-500">
                                  <Calendar size={14} />
                              </span>
                              <input type="text" value={settings.stockExpiryAlertDays} onChange={(e) => handleChange('stockExpiryAlertDays', e.target.value)} className="flex-1 px-3 py-2 border-y border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                              <span className="inline-flex items-center px-3 rounded-r border border-l-0 border-slate-200 bg-slate-50 text-slate-500 text-xs">
                                  Days
                              </span>
                          </div>
                      </div>
                  </div>
               )}

               {activeTab === 'prefixes' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Sales Invoice Prefix:</label>
                        <input type="text" value={settings.salesInvoicePrefix || 'INV-'} onChange={(e) => handleChange('salesInvoicePrefix', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Purchase Prefix:</label>
                        <input type="text" value={settings.purchasePrefix || 'PO-'} onChange={(e) => handleChange('purchasePrefix', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Quotation Prefix:</label>
                        <input type="text" value={settings.quotationPrefix || 'QT-'} onChange={(e) => handleChange('quotationPrefix', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Payment Prefix:</label>
                        <input type="text" value={settings.paymentPrefix || 'PAY-'} onChange={(e) => handleChange('paymentPrefix', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Stock Transfer Prefix:</label>
                        <input type="text" value={settings.stockTransferPrefix} onChange={(e) => handleChange('stockTransferPrefix', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Stock Adjustment Prefix:</label>
                        <input type="text" value={settings.stockAdjustmentPrefix} onChange={(e) => handleChange('stockAdjustmentPrefix', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Sell Return Prefix:</label>
                        <input type="text" value={settings.sellReturnPrefix} onChange={(e) => handleChange('sellReturnPrefix', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Expenses Prefix:</label>
                        <input type="text" value={settings.expensesPrefix} onChange={(e) => handleChange('expensesPrefix', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Contacts Prefix:</label>
                        <input type="text" value={settings.contactsPrefix} onChange={(e) => handleChange('contactsPrefix', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Purchase Payment Prefix:</label>
                        <input type="text" value={settings.purchasePaymentPrefix} onChange={(e) => handleChange('purchasePaymentPrefix', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Sell Payment Prefix:</label>
                        <input type="text" value={settings.sellPaymentPrefix} onChange={(e) => handleChange('sellPaymentPrefix', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Expense Payment Prefix:</label>
                        <input
                          type="text"
                          value={settings.expensePaymentPrefix}
                          onChange={(e) => handleChange('expensePaymentPrefix', e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                        />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Username:</label>
                        <input
                          type="text"
                          value={settings.usernamePrefix}
                          onChange={(e) => handleChange('usernamePrefix', e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                        />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Subscription No.:</label>
                        <input
                          type="text"
                          value={settings.subscriptionPrefix}
                          onChange={(e) => handleChange('subscriptionPrefix', e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                        />
                     </div>
                    <div className="space-y-1.5">
                       <label className="text-xs font-bold text-slate-900">Draft Prefix:</label>
                       <input
                         type="text"
                         value={settings.draftPrefix || 'DR-'}
                         onChange={(e) => handleChange('draftPrefix', e.target.value)}
                         className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                       />
                    </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Sales Order:</label>
                        <input
                          type="text"
                          value={settings.salesOrderPrefix}
                          onChange={(e) => handleChange('salesOrderPrefix', e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                        />
                     </div>
                  </div>
               )}

               {activeTab === 'reward_point_settings' && (
                  <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                          <label className="flex items-center gap-2 cursor-pointer pt-4">
                              <input
                                type="checkbox"
                                checked={settings.enableRewardPoints}
                                onChange={(e) => handleChange('enableRewardPoints', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-900">Enable Reward Point</span>
                          </label>
                          <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-900">Reward Point Display Name:</label>
                              <input
                                type="text"
                                value={settings.rewardPointDisplayName}
                                onChange={(e) => handleChange('rewardPointDisplayName', e.target.value)}
                                placeholder="Reward Point Display Name"
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                              />
                          </div>
                      </div>

                      <div className="border border-slate-200 p-4 rounded">
                          <h3 className="text-sm font-bold text-slate-900 mb-4">Earning Points Settings:</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                              <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Amount spend for unit point: <Info size={14} className="text-[#06b6d4]" /></label>
                                  <input
                                    type="text"
                                    value={settings.rewardAmountPerPoint}
                                    onChange={(e) => handleChange('rewardAmountPerPoint', e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                  />
                              </div>
                              <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Minimum order total to earn reward: <Info size={14} className="text-[#06b6d4]" /></label>
                                  <input
                                    type="text"
                                    value={settings.rewardMinOrderToEarn}
                                    onChange={(e) => handleChange('rewardMinOrderToEarn', e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                  />
                              </div>
                              <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Maximum points per order: <Info size={14} className="text-[#06b6d4]" /></label>
                                  <input
                                    type="text"
                                    value={settings.rewardMaxPointsPerOrder}
                                    onChange={(e) => handleChange('rewardMaxPointsPerOrder', e.target.value)}
                                    placeholder="Maximum points per order"
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                  />
                              </div>
                          </div>
                      </div>

                      <div className="border border-slate-200 p-4 rounded">
                          <h3 className="text-sm font-bold text-slate-900 mb-4">Redeem Points Settings:</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                              <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Redeem amount per unit point: <Info size={14} className="text-[#06b6d4]" /></label>
                                  <input
                                    type="text"
                                    value={settings.rewardRedeemAmountPerPoint}
                                    onChange={(e) => handleChange('rewardRedeemAmountPerPoint', e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                  />
                              </div>
                              <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Minimum order total to redeem points: <Info size={14} className="text-[#06b6d4]" /></label>
                                  <input
                                    type="text"
                                    value={settings.rewardMinOrderToRedeem}
                                    onChange={(e) => handleChange('rewardMinOrderToRedeem', e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                  />
                              </div>
                              <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Minimum redeem point: <Info size={14} className="text-[#06b6d4]" /></label>
                                  <input
                                    type="text"
                                    value={settings.rewardMinRedeemPoint}
                                    onChange={(e) => handleChange('rewardMinRedeemPoint', e.target.value)}
                                    placeholder="Minimum redeem point"
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                  />
                              </div>
                              <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Maximum redeem point per order: <Info size={14} className="text-[#06b6d4]" /></label>
                                  <input
                                    type="text"
                                    value={settings.rewardMaxRedeemPerOrder}
                                    onChange={(e) => handleChange('rewardMaxRedeemPerOrder', e.target.value)}
                                    placeholder="Maximum redeem point per order"
                                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
                                  />
                              </div>
                              <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Reward Point expiry period: <Info size={14} className="text-[#06b6d4]" /></label>
                                  <div className="flex">
                                      <input
                                        type="text"
                                        value={settings.rewardExpiryPeriod}
                                        onChange={(e) => handleChange('rewardExpiryPeriod', e.target.value)}
                                        placeholder="Reward Point expiry period"
                                        className="flex-1 px-3 py-2 rounded-l border border-r-0 border-slate-200 focus:outline-none focus:border-blue-500 text-sm"
                                      />
                                      <select
                                        value={settings.rewardExpiryUnit}
                                        onChange={(e) => handleChange('rewardExpiryUnit', e.target.value as AppSettings['rewardExpiryUnit'])}
                                        className="px-3 py-2 rounded-r border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white"
                                      >
                                          <option value="Year">Year</option>
                                          <option value="Month">Month</option>
                                          <option value="Day">Day</option>
                                      </select>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
               )}

               {activeTab === 'modules' && (
                  <div>
                      <h3 className="text-sm font-normal text-slate-900 mb-6">Enable/Disable Modules</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.enablePurchases}
                                onChange={(e) => handleChange('enablePurchases', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-900">Purchases</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.enablePOS}
                                onChange={(e) => handleChange('enablePOS', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-900">POS</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.enableSalesOrder}
                                onChange={(e) => handleChange('enableSalesOrder', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-900">Sales Orders</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.enableShipments}
                                onChange={(e) => handleChange('enableShipments', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-900">Shipments</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.enableDiscounts}
                                onChange={(e) => handleChange('enableDiscounts', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-900">Discounts</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.enableImportSales}
                                onChange={(e) => handleChange('enableImportSales', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-900">Import Sales</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.enableCustomerGroupsReport}
                                onChange={(e) => handleChange('enableCustomerGroupsReport', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-900">Customer Groups Report</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.enableStockReport}
                                onChange={(e) => handleChange('enableStockReport', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-900">Stock Report</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.enableTrendingProductsReport}
                                onChange={(e) => handleChange('enableTrendingProductsReport', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-900">Trending Products Report</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.enableItemsReport}
                                onChange={(e) => handleChange('enableItemsReport', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-900">Items Report</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.enableProductPurchaseReport}
                                onChange={(e) => handleChange('enableProductPurchaseReport', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-900">Product Purchase Report</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.enableProductSellReport}
                                onChange={(e) => handleChange('enableProductSellReport', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-900">Product Sell Report</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.enablePurchasePaymentReport}
                                onChange={(e) => handleChange('enablePurchasePaymentReport', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-900">Purchase Payment Report</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.enableSellPaymentReport}
                                onChange={(e) => handleChange('enableSellPaymentReport', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-900">Sell Payment Report</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.enableActivityLog}
                                onChange={(e) => handleChange('enableActivityLog', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-900">Activity Log</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.enableStockTransfers}
                                onChange={(e) => handleChange('enableStockTransfers', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-900">Stock Transfers</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.enableStockAdjustments}
                                onChange={(e) => handleChange('enableStockAdjustments', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-900">Stock Adjustments</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.enableExpenses}
                                onChange={(e) => handleChange('enableExpenses', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-900">Expenses</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.enableFieldPayments}
                                onChange={(e) => handleChange('enableFieldPayments', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-900">Field Payments</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.enablePaymentAccounts}
                                onChange={(e) => handleChange('enablePaymentAccounts', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-900">Payment Accounts</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.enableCommissionAgents}
                                onChange={(e) => handleChange('enableCommissionAgents', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-900">Commission Agents</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={settings.enableRewardPoints}
                                onChange={(e) => handleChange('enableRewardPoints', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-900">Reward Points</span>
                          </label>
                      </div>
                  </div>
               )}

               {activeTab === 'system' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Theme Color:</label>
                        <select
                          value={settings.themeColor || 'default'}
                          onChange={(e) => handleChange('themeColor', e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                        >
                            <option value="default">Default (Blue)</option>
                            <option value="emerald">Emerald / Green</option>
                            <option value="rose">Rose / Red</option>
                            <option value="amber">Amber / Orange</option>
                            <option value="violet">Violet / Purple</option>
                        </select>
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Default datatable page entries:</label>
                        <select value={settings.defaultTableEntries} onChange={(e) => handleChange('defaultTableEntries', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer">
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                     </div>
                     <div className="md:col-span-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">Backup & Restore</h4>
                          <p className="text-xs text-slate-500">Export your full browser data and restore it when needed.</p>
                        </div>
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
                            <Upload size={14} />
                            Validate Backup File
                          </button>
                          <button
                            type="button"
                            onClick={() => openBackupFilePicker('restore')}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100"
                          >
                            <Upload size={14} />
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
                          <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                            <p className="font-bold text-slate-700">Last Backup</p>
                            <p>{formatAuditTime(backupAudit.lastBackupAt)}</p>
                            <p>Records: {Number(backupAudit.lastBackupRecordCount || 0)}</p>
                          </div>
                          <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                            <p className="font-bold text-slate-700">Last Validation</p>
                            <p>{formatAuditTime(backupAudit.lastValidatedAt)}</p>
                            <p>Records: {Number(backupAudit.lastValidatedRecordCount || 0)}</p>
                          </div>
                          <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
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
               )}
            </div>
         </div>
      </div>

      <div className="flex flex-col items-center mt-8 gap-3">
          <div className="flex items-center gap-4">
            {saved && (
              <span className="flex items-center gap-1.5 text-emerald-600 font-bold text-sm">
                <CheckCircle2 size={16} /> Settings saved successfully!
              </span>
            )}
            {saveError && (
              <span className="flex items-center gap-1.5 text-rose-600 font-bold text-sm">
                <Info size={16} /> {saveError}
              </span>
            )}
            <button
                onClick={handleSave}
                className="bg-blue-600 text-white px-8 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-md active:scale-95 flex items-center gap-2"
            >
                <CheckCircle2 size={16} /> Save Settings
            </button>
          </div>
      </div>
    </div>
  );
};

export default Settings;
