import React, { useEffect, useState } from 'react';
import {
  Search, Info, Calendar, Plus, Banknote, Clock, Folder, Calculator, Edit, CheckCircle2
} from 'lucide-react';
import { AppSettings, useGlobalContext } from '../src/context/GlobalContext';

const Settings: React.FC = () => {
  const { settings: globalSettings, updateSettings } = useGlobalContext();
  const [activeTab, setActiveTab] = useState('business');
  // Local copy of settings — saved to GlobalContext on Save button click
  const [settings, setSettings] = useState<AppSettings>({ ...globalSettings });
  const [saved, setSaved] = useState(false);
  const currencyOptions = [
    { code: 'OMR', label: 'Oman - Rials (OMR)', symbol: 'OMR' },
    { code: 'AED', label: 'UAE - Dirham (AED)', symbol: 'AED' },
    { code: 'SAR', label: 'Saudi Arabia - Riyal (SAR)', symbol: 'SAR' },
    { code: 'USD', label: 'US Dollar (USD)', symbol: '$' },
    { code: 'EUR', label: 'Euro (EUR)', symbol: 'EUR' },
  ];

  const handleSave = () => {
    updateSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleChange = <K extends keyof AppSettings,>(field: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    setSettings({ ...globalSettings });
  }, [globalSettings]);

  const handleCurrencyChange = (currencyCode: string) => {
    const selected = currencyOptions.find(c => c.code === currencyCode);
    setSettings(prev => ({
      ...prev,
      currency: currencyCode,
      currencySymbol: selected?.symbol || prev.currencySymbol,
    }));
  };

  const handlePrecisionChange = (field: 'currencyPrecision' | 'quantityPrecision', value: string) => {
    const parsed = Number(value);
    handleChange(field, Number.isFinite(parsed) ? parsed : 3);
  };

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

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Business Settings</h2>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
         <div className="p-4 border-b border-slate-200 bg-slate-50/50">
            <div className="relative max-w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search" 
                  className="w-full pl-9 pr-4 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white"
                />
            </div>
         </div>

         <div className="flex flex-col md:flex-row min-h-[600px]">
            {/* Sidebar */}
            <div className="w-full md:w-64 border-r border-slate-200 bg-white shrink-0">
               {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left px-6 py-3.5 text-sm font-bold transition-colors border-b border-slate-100 flex items-center justify-between ${
                        activeTab === tab.id 
                        ? 'bg-[#4F46E5] text-white' 
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                      {tab.label}
                      {tab.id === 'tax' && <Info size={14} className={activeTab === 'tax' ? 'text-white' : 'text-[#06b6d4]'} />}
                  </button>
               ))}
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
                            className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" 
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
                                className="flex-1 px-3 py-2 rounded-r border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-slate-100" 
                                readOnly 
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
                                className="flex-1 px-3 py-2 rounded-r border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" 
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
                                className="flex-1 px-3 py-2 rounded-r border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white"
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
                            className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm"
                        />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Currency Symbol Placement:</label>
                        <select
                            value={settings.currencySymbolPlacement}
                            onChange={(e) => handleChange('currencySymbolPlacement', e.target.value as AppSettings['currencySymbolPlacement'])}
                            className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white"
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
                                className="flex-1 px-3 py-2 rounded-r border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white"
                            >
                                <option value="Asia/Dubai">Asia/Dubai</option>
                            </select>
                        </div>
                     </div>

                     {/* Row 3 */}
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Upload Logo:</label>
                        <div className="flex">
                            <input 
                                type="text" 
                                className="flex-1 px-3 py-2 rounded-l border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white" 
                                readOnly 
                            />
                            <button className="bg-[#2563EB] text-white px-4 py-2 rounded-r text-sm font-bold flex items-center gap-2 hover:bg-blue-700">
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
                                className="flex-1 px-3 py-2 rounded-r border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white"
                            >
                                <option value="January">January</option>
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
                                className="flex-1 px-3 py-2 rounded-r border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white"
                            >
                                <option value="fifo">FIFO (First In First Out)</option>
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
                                className="flex-1 px-3 py-2 rounded-r border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" 
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
                                className="flex-1 px-3 py-2 rounded-r border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white"
                            >
                                <option value="dd/mm/yyyy">dd/mm/yyyy</option>
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
                                className="flex-1 px-3 py-2 rounded-r border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white"
                            >
                                <option value="12">12 Hour</option>
                            </select>
                        </div>
                     </div>

                     {/* Row 5 */}
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Currency precision:* <Info size={14} className="text-[#06b6d4]" /></label>
                        <select
                            value={settings.currencyPrecision}
                            onChange={(e) => handlePrecisionChange('currencyPrecision', e.target.value)}
                            className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white"
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
                            className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white"
                        >
                            <option value={0}>0</option>
                            <option value={1}>1</option>
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                            <option value={4}>4</option>
                        </select>
                     </div>

                  </div>
               )}

               {activeTab === 'tax' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Tax 1 Name: <Info size={14} className="text-[#06b6d4]" /></label>
                        <input type="text" value={settings.tax1Name} onChange={(e) => handleChange('tax1Name', e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" placeholder="e.g. VAT" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Tax 1 No. (Registration No.): <Info size={14} className="text-[#06b6d4]" /></label>
                        <input type="text" value={settings.tax1Number} onChange={(e) => handleChange('tax1Number', e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" placeholder="e.g. OM123456789" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Tax 2 Name: <Info size={14} className="text-[#06b6d4]" /></label>
                        <input type="text" value={settings.tax2Name} onChange={(e) => handleChange('tax2Name', e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" placeholder="Optional second tax name" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Tax 2 No.: <Info size={14} className="text-[#06b6d4]" /></label>
                        <input type="text" value={settings.tax2Number} onChange={(e) => handleChange('tax2Number', e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" placeholder="Optional second tax number" />
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
                        <input type="text" value={settings.skuPrefix} onChange={(e) => handleChange('skuPrefix', e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" placeholder="e.g. SKU-" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Enable Product Expiry: <Info size={14} className="text-[#06b6d4]" /></label>
                        <div className="flex">
                            <span className="inline-flex items-center px-3 rounded-l border border-r-0 border-slate-200 bg-slate-50 text-slate-500">
                                <input type="checkbox" checked={settings.enableProductExpiry} onChange={(e) => handleChange('enableProductExpiry', e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            </span>
                            <select className="flex-1 px-3 py-2 rounded-r border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white">
                                <option>Add item expiry</option>
                            </select>
                        </div>
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">On Product Expiry: <Info size={14} className="text-[#06b6d4]" /></label>
                        <div className="flex gap-2">
                            <select className="flex-1 px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white">
                                <option>Keep Selling</option>
                            </select>
                            <input type="text" defaultValue="0" className="w-20 px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-slate-100" readOnly />
                        </div>
                     </div>

                     <div className="space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={settings.enableBrands} onChange={(e) => handleChange('enableBrands', e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            <span className="text-sm font-bold text-slate-900">Enable Brands</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" defaultChecked />
                            <span className="text-sm font-bold text-slate-900">Enable Price & Tax info</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer mt-6">
                            <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" defaultChecked />
                            <span className="text-sm font-bold text-slate-900">Enable Racks</span>
                            <Info size={14} className="text-[#06b6d4]" />
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
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
                                <select className="flex-1 px-3 py-2 rounded-r border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white">
                                    <option>Please Select</option>
                                </select>
                            </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer mt-6">
                            <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" defaultChecked />
                            <span className="text-sm font-bold text-slate-900">Enable Row</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" defaultChecked />
                            <span className="text-sm font-bold text-slate-900">Is product image required?</span>
                        </label>
                     </div>

                     <div className="space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={settings.enableSubCategories} onChange={(e) => handleChange('enableSubCategories', e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            <span className="text-sm font-bold text-slate-900">Enable Sub-Categories</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer mt-4">
                            <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            <span className="text-sm font-bold text-slate-900">Enable Sub Units</span>
                            <Info size={14} className="text-[#06b6d4]" />
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer mt-6">
                            <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
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
                          className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm"
                          placeholder="0"
                        />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Default Pay Term: <Info size={14} className="text-[#06b6d4]" /></label>
                        <select
                          value={settings.defaultPayTerm}
                          onChange={(e) => handleChange('defaultPayTerm', e.target.value)}
                          className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white"
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
                                          <input type="text" defaultValue="shift+e" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4 items-center">
                                          <label className="text-xs text-slate-900">Pay & Checkout:</label>
                                          <input type="text" defaultValue="shift+p" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4 items-center">
                                          <label className="text-xs text-slate-900">Draft:</label>
                                          <input type="text" defaultValue="shift+d" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4 items-center">
                                          <label className="text-xs text-slate-900">Cancel:</label>
                                          <input type="text" defaultValue="shift+c" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4 items-center">
                                          <label className="text-xs text-slate-900">Go to product quantity:</label>
                                          <input type="text" defaultValue="f2" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4 items-center">
                                          <label className="text-xs text-slate-900">Weighing Scale:</label>
                                          <input type="text" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
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
                                          <input type="text" defaultValue="shift+i" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4 items-center">
                                          <label className="text-xs text-slate-900">Edit Order Tax:</label>
                                          <input type="text" defaultValue="shift+t" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4 items-center">
                                          <label className="text-xs text-slate-900">Add Payment Row:</label>
                                          <input type="text" defaultValue="shift+r" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4 items-center">
                                          <label className="text-xs text-slate-900">Finalize Payment:</label>
                                          <input type="text" defaultValue="shift+f" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                                      </div>
                                      <div className="grid grid-cols-2 gap-4 items-center">
                                          <label className="text-xs text-slate-900">Add new product:</label>
                                          <input type="text" defaultValue="f4" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>

                      <div className="border-t border-slate-200 pt-6">
                          <h3 className="text-sm font-bold text-slate-900 mb-4">POS settings:</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-4">
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                  <span className="text-sm text-slate-900">Disable Multiple Pay</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                  <span className="text-sm text-slate-900">Disable Draft</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                  <span className="text-sm text-slate-900">Disable Express Checkout</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                  <span className="text-sm text-slate-900">Don't show product suggestion</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
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
                                  <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                  <span className="text-sm text-slate-900">Subtotal Editable</span>
                                  <Info size={14} className="text-[#06b6d4]" />
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                  <span className="text-sm text-slate-900">Disable Suspend Sale</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                  <span className="text-sm text-slate-900">Enable transaction date on POS screen</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                  <span className="text-sm text-slate-900">Enable service staff in product line</span>
                                  <Info size={14} className="text-[#06b6d4]" />
                              </label>
                              <div className="hidden md:block"></div>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                  <span className="text-sm text-slate-900">Is service staff required</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                  <span className="text-sm text-slate-900">Disable credit sale button</span>
                                  <Info size={14} className="text-[#06b6d4]" />
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                  <span className="text-sm text-slate-900">Enable Weighing Scale</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                  <span className="text-sm text-slate-900">Show invoice scheme</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                  <span className="text-sm text-slate-900">Show invoice layout dropdown</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                  <span className="text-sm text-slate-900">Print invoice on suspend</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
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
                                  <input type="text" defaultValue="29" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                              </div>
                              <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-900">Product sku length:</label>
                                  <select className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white">
                                      <option>5</option>
                                  </select>
                              </div>
                              <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-900">Quantity integer part length:</label>
                                  <select className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white">
                                      <option>4</option>
                                  </select>
                              </div>
                              <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-900">Quantity fractional part length:</label>
                                  <select className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white">
                                      <option>4</option>
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
                                  className="flex-1 px-3 py-2 rounded-r border border-slate-200 focus:outline-none focus:border-blue-500 text-sm"
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
                                  className="flex-1 px-3 py-2 rounded-r border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white"
                                >
                                    <option value="None">None</option>
                                    <option value="VAT@5%">VAT@5%</option>
                                </select>
                            </div>
                         </div>
                         <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Sales Item Addition Method:</label>
                            <select className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white">
                                <option>Increase item quantity if it already exists</option>
                            </select>
                         </div>
                         <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Amount rounding method: <Info size={14} className="text-[#06b6d4]" /></label>
                            <select className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white">
                                <option>None</option>
                            </select>
                         </div>
                         <div className="space-y-1.5 flex items-center h-full pt-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
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
                                    <select className="flex-1 px-3 py-2 rounded-r border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white">
                                        <option>Disable</option>
                                    </select>
                                </div>
                             </div>
                             <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Commission Calculation Type:</label>
                                <div className="flex">
                                    <span className="inline-flex items-center px-3 rounded-l border border-r-0 border-slate-200 bg-slate-50 text-slate-500">
                                        <Info size={14} />
                                    </span>
                                    <select className="flex-1 px-3 py-2 rounded-r border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white">
                                        <option>Invoice value</option>
                                    </select>
                                </div>
                             </div>
                             <div className="space-y-1.5 flex items-center h-full pt-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={settings.enableCommissionAgents}
                                      onChange={(e) => handleChange('enableCommissionAgents', e.target.checked)}
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
               )}

               {activeTab === 'payment' && (
                  <div className="space-y-6">
                      <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-900">Cash Denominations:</label>
                          <input type="text" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                          <p className="text-xs text-slate-500">Comma separated values Example: 100,200,500,2000</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                          <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-900">Enable cash denomination on:</label>
                              <select className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white">
                                  <option>All screens</option>
                              </select>
                          </div>
                          <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-900">Enable cash denomination for payment methods:</label>
                              <div className="flex items-center gap-4">
                                  <input type="text" className="flex-1 px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                                  <label className="flex items-center gap-2 cursor-pointer">
                                      <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
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
                        <input type="text" value={settings.salesInvoicePrefix || 'INV-'} onChange={(e) => handleChange('salesInvoicePrefix', e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Purchase Prefix:</label>
                        <input type="text" value={settings.purchasePrefix || 'PO-'} onChange={(e) => handleChange('purchasePrefix', e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Quotation Prefix:</label>
                        <input type="text" value={settings.quotationPrefix || 'QT-'} onChange={(e) => handleChange('quotationPrefix', e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Payment Prefix:</label>
                        <input type="text" value={settings.paymentPrefix || 'PAY-'} onChange={(e) => handleChange('paymentPrefix', e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Stock Transfer Prefix:</label>
                        <input type="text" value={settings.stockTransferPrefix} onChange={(e) => handleChange('stockTransferPrefix', e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Stock Adjustment Prefix:</label>
                        <input type="text" value={settings.stockAdjustmentPrefix} onChange={(e) => handleChange('stockAdjustmentPrefix', e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Sell Return Prefix:</label>
                        <input type="text" value={settings.sellReturnPrefix} onChange={(e) => handleChange('sellReturnPrefix', e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Expenses Prefix:</label>
                        <input type="text" value={settings.expensesPrefix} onChange={(e) => handleChange('expensesPrefix', e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Contacts Prefix:</label>
                        <input type="text" value={settings.contactsPrefix} onChange={(e) => handleChange('contactsPrefix', e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Purchase Payment Prefix:</label>
                        <input type="text" value={settings.purchasePaymentPrefix} onChange={(e) => handleChange('purchasePaymentPrefix', e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900">Sell Payment Prefix:</label>
                        <input type="text" value={settings.sellPaymentPrefix} onChange={(e) => handleChange('sellPaymentPrefix', e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Expense Payment:</label>
                        <input type="text" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Business Location:</label>
                        <input type="text" defaultValue="BL" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Username:</label>
                        <input type="text" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Subscription No.:</label>
                        <input type="text" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Draft:</label>
                        <input type="text" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Sales Order:</label>
                        <input type="text" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
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
                              <input type="text" placeholder="Reward Point Display Name" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                          </div>
                      </div>

                      <div className="border border-slate-200 p-4 rounded">
                          <h3 className="text-sm font-bold text-slate-900 mb-4">Earning Points Settings:</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                              <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Amount spend for unit point: <Info size={14} className="text-[#06b6d4]" /></label>
                                  <input type="text" defaultValue="1.000" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                              </div>
                              <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Minimum order total to earn reward: <Info size={14} className="text-[#06b6d4]" /></label>
                                  <input type="text" defaultValue="1.000" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                              </div>
                              <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Maximum points per order: <Info size={14} className="text-[#06b6d4]" /></label>
                                  <input type="text" placeholder="Maximum points per order" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                              </div>
                          </div>
                      </div>

                      <div className="border border-slate-200 p-4 rounded">
                          <h3 className="text-sm font-bold text-slate-900 mb-4">Redeem Points Settings:</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                              <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Redeem amount per unit point: <Info size={14} className="text-[#06b6d4]" /></label>
                                  <input type="text" defaultValue="1.000" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                              </div>
                              <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Minimum order total to redeem points: <Info size={14} className="text-[#06b6d4]" /></label>
                                  <input type="text" defaultValue="1.000" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                              </div>
                              <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Minimum redeem point: <Info size={14} className="text-[#06b6d4]" /></label>
                                  <input type="text" placeholder="Minimum redeem point" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                              </div>
                              <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Maximum redeem point per order: <Info size={14} className="text-[#06b6d4]" /></label>
                                  <input type="text" placeholder="Maximum redeem point per order" className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                              </div>
                              <div className="space-y-1.5">
                                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Reward Point expiry period: <Info size={14} className="text-[#06b6d4]" /></label>
                                  <div className="flex">
                                      <input type="text" placeholder="Reward Point expiry period" className="flex-1 px-3 py-2 rounded-l border border-r-0 border-slate-200 focus:outline-none focus:border-blue-500 text-sm" />
                                      <select className="px-3 py-2 rounded-r border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white">
                                          <option>Year</option>
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
                                checked={settings.enableStockTransfers}
                                onChange={(e) => handleChange('enableStockTransfers', e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-slate-900">Stock Transfers</span>
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
                        <select className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white">
                            <option>Default (Red/Orange)</option>
                            <option>Blue</option>
                            <option>Dark</option>
                        </select>
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-900 flex items-center gap-1">Default datatable page entries:</label>
                        <select value={settings.defaultTableEntries} onChange={(e) => handleChange('defaultTableEntries', e.target.value)} className="w-full px-3 py-2 rounded border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white">
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                     </div>
                  </div>
               )}
            </div>
         </div>
      </div>

      <div className="flex justify-center mt-8 gap-4 items-center">
          {saved && (
            <span className="flex items-center gap-1.5 text-emerald-600 font-bold text-sm">
              <CheckCircle2 size={16} /> Settings saved successfully!
            </span>
          )}
          <button
              onClick={handleSave}
              className="bg-[#FF4D4D] text-white px-8 py-2.5 rounded text-sm font-bold hover:bg-red-600 transition shadow-sm"
          >
              Update Settings
          </button>
      </div>
    </div>
  );
};

export default Settings;
