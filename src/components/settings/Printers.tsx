import React, { useMemo, useState } from 'react';
import { Edit, Plus, Search, Trash2, X } from 'lucide-react';
import { ReceiptPrinter, useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

type ViewMode = 'list' | 'form';

type PrinterFormState = {
  id: string;
  name: string;
  connectionType: ReceiptPrinter['connectionType'];
  capabilityProfile: string;
  charactersPerLine: string;
  ipAddress: string;
  port: string;
  path: string;
};

const createInitialFormState = (): PrinterFormState => ({
  id: '',
  name: '',
  connectionType: 'Network',
  capabilityProfile: 'Default',
  charactersPerLine: '42',
  ipAddress: '',
  port: '9100',
  path: '',
});

const normalizeText = (value?: string) => String(value || '').trim().toLowerCase();

const Printers: React.FC = () => {
  const { printers, addPrinter, updatePrinter, deletePrinter } = useGlobalContext();
  const { addNotification } = useNotifications();

  const [view, setView] = useState<ViewMode>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<PrinterFormState>(createInitialFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeletePrinter, setPendingDeletePrinter] = useState<ReceiptPrinter | null>(null);

  const isEditing = !!editingId;

  const filteredPrinters = useMemo(() => {
    const query = normalizeText(searchTerm);
    if (!query) return printers;
    return printers.filter(printer => {
      const fields = [
        printer.name,
        printer.connectionType,
        printer.capabilityProfile,
        printer.ipAddress,
        printer.port,
        printer.path,
      ];
      return fields.some(field => normalizeText(field).includes(query));
    });
  }, [printers, searchTerm]);

  const showingStart = filteredPrinters.length > 0 ? 1 : 0;
  const showingEnd = filteredPrinters.length;

  const resetForm = () => {
    setFormData(createInitialFormState());
    setEditingId(null);
  };

  const openAddForm = () => {
    resetForm();
    setView('form');
  };

  const openEditForm = (printer: ReceiptPrinter) => {
    setEditingId(printer.id);
    setFormData({
      id: printer.id,
      name: printer.name,
      connectionType: printer.connectionType,
      capabilityProfile: printer.capabilityProfile || 'Default',
      charactersPerLine: String(printer.charactersPerLine || 42),
      ipAddress: printer.ipAddress || '',
      port: printer.port || '',
      path: printer.path || '',
    });
    setView('form');
  };

  const handleSave = async () => {
    const normalizedName = String(formData.name || '').trim();
    if (!normalizedName) {
      addNotification({
        title: 'Missing printer name',
        message: 'Printer name is required.',
        type: 'error',
      });
      return;
    }

    const charactersPerLine = Number(formData.charactersPerLine);
    if (!Number.isFinite(charactersPerLine) || charactersPerLine <= 0) {
      addNotification({
        title: 'Invalid characters per line',
        message: 'Characters per line must be greater than 0.',
        type: 'error',
      });
      return;
    }

    const normalizedPort = String(formData.port || '').replace(/[^\d]/g, '').trim();
    const normalizedIp = String(formData.ipAddress || '').trim();
    const normalizedPath = String(formData.path || '').trim();

    if (formData.connectionType === 'Network') {
      if (!normalizedIp) {
        addNotification({
          title: 'Missing IP address',
          message: 'IP address is required for network printers.',
          type: 'error',
        });
        return;
      }
      if (!normalizedPort) {
        addNotification({
          title: 'Missing port',
          message: 'Port is required for network printers.',
          type: 'error',
        });
        return;
      }
    }

    const duplicateByName = printers.some(printer =>
      printer.id !== editingId &&
      normalizeText(printer.name) === normalizeText(normalizedName)
    );
    if (duplicateByName) {
      addNotification({
        title: 'Duplicate printer',
        message: `Printer "${normalizedName}" already exists.`,
        type: 'error',
      });
      return;
    }

    const payload: ReceiptPrinter = {
      id: editingId || `PRN-${Date.now()}`,
      name: normalizedName,
      connectionType: formData.connectionType,
      capabilityProfile: String(formData.capabilityProfile || 'Default').trim() || 'Default',
      charactersPerLine: Math.round(charactersPerLine),
      ipAddress: normalizedIp,
      port: normalizedPort || String(formData.port || '').trim(),
      path: normalizedPath,
    };

    if (isEditing) {
      const result = await updatePrinter(payload);
      if (!result.ok) {
        addNotification({
          title: 'Save Failed',
          message: result.error || `Unable to update printer "${payload.name}".`,
          type: 'error',
        });
        return;
      }
      addNotification({
        title: 'Printer updated',
        message: `Printer "${payload.name}" has been updated.`,
        type: 'success',
      });
    } else {
      const result = await addPrinter(payload);
      if (!result.ok) {
        addNotification({
          title: 'Save Failed',
          message: result.error || `Unable to add printer "${payload.name}".`,
          type: 'error',
        });
        return;
      }
      addNotification({
        title: 'Printer added',
        message: `Printer "${payload.name}" has been added.`,
        type: 'success',
      });
    }

    setView('list');
    resetForm();
  };

  const handleDelete = (printer: ReceiptPrinter) => {
    setPendingDeletePrinter(printer);
  };

  if (view === 'form') {
    return (
      <div className="space-y-4 animate-fade-in pb-10">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {isEditing ? 'Edit Printer' : 'Add Printer'}
          </h2>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-800 mb-1">Printer Name:*</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Short descriptive name"
                className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">Connection Type:*</label>
              <select
                value={formData.connectionType}
                onChange={(e) =>
                  setFormData(prev => ({
                    ...prev,
                    connectionType: e.target.value === 'Windows' || e.target.value === 'Linux' ? e.target.value : 'Network',
                  }))
                }
                className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm bg-white"
              >
                <option value="Network">Network</option>
                <option value="Windows">Windows</option>
                <option value="Linux">Linux</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">Capability Profile:*</label>
              <select
                value={formData.capabilityProfile}
                onChange={(e) => setFormData(prev => ({ ...prev, capabilityProfile: e.target.value }))}
                className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm bg-white"
              >
                <option value="Default">Default</option>
                <option value="Simple">Simple</option>
                <option value="Star">Star</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">Characters per line:*</label>
              <input
                type="number"
                min={1}
                value={formData.charactersPerLine}
                onChange={(e) => setFormData(prev => ({ ...prev, charactersPerLine: e.target.value }))}
                className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">IP Address{formData.connectionType === 'Network' ? ':*' : ':'}</label>
              <input
                type="text"
                value={formData.ipAddress}
                onChange={(e) => setFormData(prev => ({ ...prev, ipAddress: e.target.value }))}
                placeholder="IP address for network printer"
                className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-1">Port{formData.connectionType === 'Network' ? ':*' : ':'}</label>
              <input
                type="text"
                value={formData.port}
                onChange={(e) => setFormData(prev => ({ ...prev, port: e.target.value }))}
                placeholder="9100"
                className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">Most thermal printers use port 9100.</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-800 mb-1">Path:</label>
              <input
                type="text"
                value={formData.path}
                onChange={(e) => setFormData(prev => ({ ...prev, path: e.target.value }))}
                placeholder="Printer path for Windows/Linux connections"
                className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-center gap-2 pt-6">
            <button
              onClick={handleSave}
              className="bg-[#1d4ed8] text-white px-8 py-2 rounded font-bold hover:bg-blue-800 transition"
            >
              Save
            </button>
            <button
              onClick={() => {
                setView('list');
                resetForm();
              }}
              className="bg-slate-700 text-white px-8 py-2 rounded font-bold hover:bg-slate-800 transition flex items-center gap-1"
            >
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in pb-10">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Printers</h2>
        <span className="text-sm text-slate-500 mt-1">Manage your receipt printers</span>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-base text-slate-700">All configured printers ({filteredPrinters.length})</h3>
          <button
            onClick={openAddForm}
            className="bg-[#4F46E5] text-white px-4 py-1.5 rounded text-sm hover:bg-indigo-700 transition flex items-center gap-1"
          >
            <Plus size={16} /> Add Printer
          </button>
        </div>

        <div className="p-4 flex justify-end">
          <div className="relative w-64">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search ..."
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded border border-slate-300 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-700 font-bold border-y border-slate-200">
              <tr>
                <th className="px-4 py-3 border-r border-slate-200">Printer Name</th>
                <th className="px-4 py-3 border-r border-slate-200">Connection Type</th>
                <th className="px-4 py-3 border-r border-slate-200">Capability Profile</th>
                <th className="px-4 py-3 border-r border-slate-200">Characters per line</th>
                <th className="px-4 py-3 border-r border-slate-200">IP Address</th>
                <th className="px-4 py-3 border-r border-slate-200">Port</th>
                <th className="px-4 py-3 border-r border-slate-200">Path</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPrinters.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-4 text-center text-slate-500">
                    No printers configured.
                  </td>
                </tr>
              ) : (
                filteredPrinters.map((printer) => (
                  <tr key={printer.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-700">{printer.name}</td>
                    <td className="px-4 py-3 text-slate-700">{printer.connectionType}</td>
                    <td className="px-4 py-3 text-slate-700">{printer.capabilityProfile}</td>
                    <td className="px-4 py-3 text-slate-700">{printer.charactersPerLine}</td>
                    <td className="px-4 py-3 text-slate-700">{printer.ipAddress || '--'}</td>
                    <td className="px-4 py-3 text-slate-700">{printer.port || '--'}</td>
                    <td className="px-4 py-3 text-slate-700">{printer.path || '--'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditForm(printer)}
                          className="px-2 py-1 text-xs text-blue-600 border border-blue-600 rounded flex items-center gap-1 hover:bg-blue-50"
                        >
                          <Edit size={12} /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(printer)}
                          className="px-2 py-1 text-xs text-red-500 border border-red-500 rounded flex items-center gap-1 hover:bg-red-50"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-100 text-sm text-slate-600">
          Showing {showingStart} to {showingEnd} of {filteredPrinters.length} entries
        </div>
      </div>
      <ConfirmDialog
        isOpen={!!pendingDeletePrinter}
        title="Delete Printer"
        message={`Are you sure you want to delete printer "${pendingDeletePrinter?.name || '--'}"?`}
        confirmLabel="Delete"
        tone="danger"
        onCancel={() => setPendingDeletePrinter(null)}
        onConfirm={async () => {
          if (!pendingDeletePrinter) return;
          const result = await deletePrinter(pendingDeletePrinter.id);
          if (!result.ok) {
            addNotification({
              title: 'Delete Failed',
              message: result.error || `Unable to delete printer "${pendingDeletePrinter.name}".`,
              type: 'error',
            });
            return;
          }
          addNotification({
            title: 'Printer deleted',
            message: `Printer "${pendingDeletePrinter.name}" has been removed.`,
            type: 'success',
          });
          setPendingDeletePrinter(null);
        }}
      />
    </div>
  );
};

export default Printers;
