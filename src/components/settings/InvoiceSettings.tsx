import React, { useMemo, useState } from 'react';
import { Edit, FileText, Plus, Search, Trash2, X } from 'lucide-react';
import { useGlobalContext, InvoiceLayout, InvoiceScheme } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';

type ActiveTab = 'schemes' | 'layouts';
const normalizeText = (value?: string) => String(value || '').trim().toLowerCase();

const InvoiceSettings: React.FC = () => {
  const { addNotification } = useNotifications();
  const {
    invoiceSchemes,
    addInvoiceScheme,
    updateInvoiceScheme,
    deleteInvoiceScheme,
    invoiceLayouts,
    addInvoiceLayout,
    updateInvoiceLayout,
    deleteInvoiceLayout,
    locations,
    sales,
    generateId,
  } = useGlobalContext();

  const [activeTab, setActiveTab] = useState<ActiveTab>('schemes');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSchemeModalOpen, setIsSchemeModalOpen] = useState(false);
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [editingSchemeId, setEditingSchemeId] = useState<string | null>(null);
  const [editingLayoutId, setEditingLayoutId] = useState<string | null>(null);

  const [schemeForm, setSchemeForm] = useState({
    name: '',
    prefix: 'INV-',
    startFrom: 1,
    numberOfDigits: 4,
    isDefault: false,
  });

  const [layoutForm, setLayoutForm] = useState({
    name: '',
    design: 'Classic',
    isDefault: false,
  });

  const filteredSchemes = useMemo(
    () => invoiceSchemes.filter(s =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.prefix.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [invoiceSchemes, searchTerm]
  );

  const filteredLayouts = useMemo(
    () => invoiceLayouts.filter(l =>
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.design.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [invoiceLayouts, searchTerm]
  );

  const openAddScheme = () => {
    setEditingSchemeId(null);
    setSchemeForm({
      name: '',
      prefix: 'INV-',
      startFrom: 1,
      numberOfDigits: 4,
      isDefault: invoiceSchemes.length === 0,
    });
    setIsSchemeModalOpen(true);
  };

  const openEditScheme = (scheme: InvoiceScheme) => {
    setEditingSchemeId(scheme.id);
    setSchemeForm({
      name: scheme.name,
      prefix: scheme.prefix,
      startFrom: Number(scheme.startFrom || 1),
      numberOfDigits: Number(scheme.numberOfDigits || 4),
      isDefault: !!scheme.isDefault,
    });
    setIsSchemeModalOpen(true);
  };

  const handleSaveScheme = () => {
    const name = schemeForm.name.trim();
    if (!name) {
      addNotification({ title: 'Validation', message: 'Scheme name is required.', type: 'error' });
      return;
    }

    const duplicate = invoiceSchemes.find(s =>
      s.id !== editingSchemeId &&
      s.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      addNotification({ title: 'Validation', message: 'Scheme name already exists.', type: 'error' });
      return;
    }

    const record: InvoiceScheme = {
      id: editingSchemeId || generateId('INV-SCH-'),
      name,
      prefix: schemeForm.prefix.trim() || 'INV-',
      numberingType: 'Sequential',
      startFrom: Math.max(1, Number(schemeForm.startFrom || 1)),
      numberOfDigits: Math.max(1, Number(schemeForm.numberOfDigits || 4)),
      isDefault: schemeForm.isDefault,
    };

    if (editingSchemeId) updateInvoiceScheme(record);
    else addInvoiceScheme(record);

    setIsSchemeModalOpen(false);
  };

  const handleDeleteScheme = (scheme: InvoiceScheme) => {
    if (window.confirm(`Delete invoice scheme "${scheme.name}"?`)) {
      const result = deleteInvoiceScheme(scheme.id);
      if (!result.success) {
        addNotification({
          title: 'Blocked',
          message: result.message || 'Unable to delete invoice scheme.',
          type: 'error',
        });
      }
    }
  };

  const setDefaultScheme = (scheme: InvoiceScheme) => {
    invoiceSchemes
      .filter(record => record.id !== scheme.id && record.isDefault)
      .forEach(record => updateInvoiceScheme({ ...record, isDefault: false }));
    updateInvoiceScheme({ ...scheme, isDefault: true });
  };

  const openAddLayout = () => {
    setEditingLayoutId(null);
    setLayoutForm({
      name: '',
      design: 'Classic',
      isDefault: invoiceLayouts.length === 0,
    });
    setIsLayoutModalOpen(true);
  };

  const openEditLayout = (layout: InvoiceLayout) => {
    setEditingLayoutId(layout.id);
    setLayoutForm({
      name: layout.name,
      design: layout.design || 'Classic',
      isDefault: !!layout.isDefault,
    });
    setIsLayoutModalOpen(true);
  };

  const handleSaveLayout = () => {
    const name = layoutForm.name.trim();
    if (!name) {
      addNotification({ title: 'Validation', message: 'Layout name is required.', type: 'error' });
      return;
    }

    const duplicate = invoiceLayouts.find(l =>
      l.id !== editingLayoutId &&
      l.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      addNotification({ title: 'Validation', message: 'Layout name already exists.', type: 'error' });
      return;
    }

    const record: InvoiceLayout = {
      id: editingLayoutId || generateId('INV-LYT-'),
      name,
      design: layoutForm.design.trim() || 'Classic',
      isDefault: layoutForm.isDefault,
    };

    if (editingLayoutId) updateInvoiceLayout(record);
    else addInvoiceLayout(record);

    setIsLayoutModalOpen(false);
  };

  const handleDeleteLayout = (layout: InvoiceLayout) => {
    if (window.confirm(`Delete invoice layout "${layout.name}"?`)) {
      const result = deleteInvoiceLayout(layout.id);
      if (!result.success) {
        addNotification({
          title: 'Blocked',
          message: result.message || 'Unable to delete invoice layout.',
          type: 'error',
        });
      }
    }
  };

  const setDefaultLayout = (layout: InvoiceLayout) => {
    invoiceLayouts
      .filter(record => record.id !== layout.id && record.isDefault)
      .forEach(record => updateInvoiceLayout({ ...record, isDefault: false }));
    updateInvoiceLayout({ ...layout, isDefault: true });
  };

  const getInvoiceCountForScheme = (schemeName: string) =>
    sales.filter(s => normalizeText(s.invoiceScheme) === normalizeText(schemeName)).length;

  const getLocationsForLayout = (layoutName: string) =>
    locations
      .filter(l =>
        normalizeText(l.invoiceLayoutPos) === normalizeText(layoutName) ||
        normalizeText(l.invoiceLayoutSale) === normalizeText(layoutName)
      )
      .map(l => l.name);

  return (
    <div className="space-y-4 animate-fade-in pb-10">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Invoice Settings</h2>
        <span className="text-sm text-slate-500 mt-1">Manage your invoice schemes and layouts</span>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('schemes')}
            className={`px-6 py-3 text-sm font-bold ${activeTab === 'schemes' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            Invoice Schemes
          </button>
          <button
            onClick={() => setActiveTab('layouts')}
            className={`px-6 py-3 text-sm font-bold ${activeTab === 'layouts' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
          >
            Invoice Layouts
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-base text-slate-700">
            {activeTab === 'schemes' ? 'All invoice schemes' : 'All invoice layouts'}
          </h3>
          <button
            onClick={activeTab === 'schemes' ? openAddScheme : openAddLayout}
            className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 transition flex items-center gap-1"
          >
            <Plus size={16} /> Add
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 flex justify-end">
          <div className="relative w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={activeTab === 'schemes' ? 'Search scheme...' : 'Search layout...'}
              className="w-full pl-9 pr-3 py-2 text-sm rounded border border-slate-300 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {activeTab === 'schemes' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-700 font-bold border-y border-slate-200">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Prefix</th>
                  <th className="px-4 py-3">Numbering Type</th>
                  <th className="px-4 py-3">Start From</th>
                  <th className="px-4 py-3">Digits</th>
                  <th className="px-4 py-3">Invoice Count</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSchemes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">No invoice schemes found.</td>
                  </tr>
                )}
                {filteredSchemes.map((scheme) => (
                  <tr key={scheme.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-700">
                      {scheme.name}
                      {scheme.isDefault && <span className="ml-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">Default</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{scheme.prefix}</td>
                    <td className="px-4 py-3 text-slate-700">{scheme.numberingType}</td>
                    <td className="px-4 py-3 text-slate-700">{scheme.startFrom}</td>
                    <td className="px-4 py-3 text-slate-700">{scheme.numberOfDigits}</td>
                    <td className="px-4 py-3 text-slate-700">{getInvoiceCountForScheme(scheme.name)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditScheme(scheme)} className="px-2 py-1 text-xs text-blue-600 border border-blue-600 rounded flex items-center gap-1 hover:bg-blue-50">
                          <Edit size={12} /> Edit
                        </button>
                        <button onClick={() => handleDeleteScheme(scheme)} className="px-2 py-1 text-xs text-red-500 border border-red-500 rounded flex items-center gap-1 hover:bg-red-50">
                          <Trash2 size={12} /> Delete
                        </button>
                        {!scheme.isDefault && (
                          <button onClick={() => setDefaultScheme(scheme)} className="px-2 py-1 text-xs text-cyan-500 border border-cyan-500 rounded hover:bg-cyan-50">
                            Set as default
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'layouts' && (
          <div className="p-8 flex flex-wrap gap-12 justify-center md:justify-start min-h-[300px]">
            {filteredLayouts.length === 0 && (
              <div className="text-sm text-slate-500">No invoice layouts found.</div>
            )}
            {filteredLayouts.map((layout) => {
              const usedInLocations = getLocationsForLayout(layout.name);
              return (
                <div key={layout.id} className="flex flex-col items-center text-center max-w-[260px] border border-slate-200 rounded p-4 bg-slate-50">
                  <div className="mb-2 relative">
                    <FileText size={48} className="text-blue-400" strokeWidth={1.5} />
                    {layout.isDefault && (
                      <span className="absolute -right-10 top-1/2 -translate-y-1/2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mb-1">{layout.name}</h4>
                  <p className="text-xs text-slate-600 mb-1">Design: {layout.design}</p>
                  <p className="text-xs text-slate-600 mb-3">
                    Used in: {usedInLocations.length > 0 ? usedInLocations.join(', ') : 'None'}
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditLayout(layout)} className="px-2 py-1 text-xs text-blue-600 border border-blue-600 rounded flex items-center gap-1 hover:bg-blue-50">
                      <Edit size={12} /> Edit
                    </button>
                    <button onClick={() => handleDeleteLayout(layout)} className="px-2 py-1 text-xs text-red-500 border border-red-500 rounded flex items-center gap-1 hover:bg-red-50">
                      <Trash2 size={12} /> Delete
                    </button>
                    {!layout.isDefault && (
                      <button onClick={() => setDefaultLayout(layout)} className="px-2 py-1 text-xs text-cyan-500 border border-cyan-500 rounded hover:bg-cyan-50">
                        Set as default
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isSchemeModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-200">
              <h3 className="text-xl text-slate-800">{editingSchemeId ? 'Edit invoice scheme' : 'Add invoice scheme'}</h3>
              <button onClick={() => setIsSchemeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={22} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Name *</label>
                <input value={schemeForm.name} onChange={(e) => setSchemeForm(prev => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Prefix *</label>
                <input value={schemeForm.prefix} onChange={(e) => setSchemeForm(prev => ({ ...prev, prefix: e.target.value }))} className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Start From</label>
                  <input type="number" min={1} value={schemeForm.startFrom} onChange={(e) => setSchemeForm(prev => ({ ...prev, startFrom: Number(e.target.value || 1) }))} className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Digits</label>
                  <input type="number" min={1} value={schemeForm.numberOfDigits} onChange={(e) => setSchemeForm(prev => ({ ...prev, numberOfDigits: Number(e.target.value || 4) }))} className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={schemeForm.isDefault} onChange={(e) => setSchemeForm(prev => ({ ...prev, isDefault: e.target.checked }))} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-slate-900">Set as default scheme</span>
              </label>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={handleSaveScheme} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition">Save</button>
              <button onClick={() => setIsSchemeModalOpen(false)} className="bg-slate-700 text-white px-6 py-2 rounded font-bold hover:bg-slate-800 transition">Close</button>
            </div>
          </div>
        </div>
      )}

      {isLayoutModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-200">
              <h3 className="text-xl text-slate-800">{editingLayoutId ? 'Edit invoice layout' : 'Add invoice layout'}</h3>
              <button onClick={() => setIsLayoutModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={22} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Name *</label>
                <input value={layoutForm.name} onChange={(e) => setLayoutForm(prev => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">Design</label>
                <input value={layoutForm.design} onChange={(e) => setLayoutForm(prev => ({ ...prev, design: e.target.value }))} className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={layoutForm.isDefault} onChange={(e) => setLayoutForm(prev => ({ ...prev, isDefault: e.target.checked }))} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-slate-900">Set as default layout</span>
              </label>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={handleSaveLayout} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition">Save</button>
              <button onClick={() => setIsLayoutModalOpen(false)} className="bg-slate-700 text-white px-6 py-2 rounded font-bold hover:bg-slate-800 transition">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceSettings;
