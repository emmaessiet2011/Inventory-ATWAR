import React, { useMemo, useState } from 'react';
import { Edit, Plus, Search, Trash2, X } from 'lucide-react';
import { useGlobalContext, BarcodeStickerSetting } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';

type BarcodeSettingForm = {
  name: string;
  description: string;
  isContinuousFeed: boolean;
  additionalTopMargin: string;
  additionalLeftMargin: string;
  stickerWidth: string;
  stickerHeight: string;
  paperWidth: string;
  paperHeight: string;
  stickersInOneRow: string;
  distanceBetweenRows: string;
  distanceBetweenColumns: string;
  stickersInOneSheet: string;
  isDefault: boolean;
};

const normalizeText = (value: unknown) => String(value ?? '').trim().toLowerCase();

const createEmptyForm = (isDefault = false): BarcodeSettingForm => ({
  name: '',
  description: '',
  isContinuousFeed: false,
  additionalTopMargin: '0',
  additionalLeftMargin: '0',
  stickerWidth: '',
  stickerHeight: '',
  paperWidth: '',
  paperHeight: '',
  stickersInOneRow: '1',
  distanceBetweenRows: '0',
  distanceBetweenColumns: '0',
  stickersInOneSheet: '1',
  isDefault,
});

const toForm = (setting: BarcodeStickerSetting): BarcodeSettingForm => ({
  name: setting.name,
  description: setting.description,
  isContinuousFeed: !!setting.isContinuousFeed,
  additionalTopMargin: String(setting.additionalTopMargin ?? 0),
  additionalLeftMargin: String(setting.additionalLeftMargin ?? 0),
  stickerWidth: String(setting.stickerWidth ?? ''),
  stickerHeight: String(setting.stickerHeight ?? ''),
  paperWidth: String(setting.paperWidth ?? ''),
  paperHeight: String(setting.paperHeight ?? ''),
  stickersInOneRow: String(setting.stickersInOneRow ?? 1),
  distanceBetweenRows: String(setting.distanceBetweenRows ?? 0),
  distanceBetweenColumns: String(setting.distanceBetweenColumns ?? 0),
  stickersInOneSheet: String(setting.stickersInOneSheet ?? 1),
  isDefault: !!setting.isDefault,
});

const toNumber = (value: string, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const BarcodeSettings: React.FC = () => {
  const { addNotification } = useNotifications();
  const {
    barcodeSettings,
    addBarcodeSetting,
    updateBarcodeSetting,
    deleteBarcodeSetting,
    generateId,
  } = useGlobalContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BarcodeSettingForm>(createEmptyForm(barcodeSettings.length === 0));
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void} | null>(null);

  const filteredSettings = useMemo(() => {
    const q = normalizeText(searchTerm);
    if (!q) return barcodeSettings;
    return barcodeSettings.filter((setting) =>
      normalizeText(setting.name).includes(q) || normalizeText(setting.description).includes(q),
    );
  }, [barcodeSettings, searchTerm]);

  const openAddModal = () => {
    setEditingId(null);
    setForm(createEmptyForm(barcodeSettings.length === 0));
    setIsModalOpen(true);
  };

  const openEditModal = (setting: BarcodeStickerSetting) => {
    setEditingId(setting.id);
    setForm(toForm(setting));
    setIsModalOpen(true);
  };

  const handleDelete = (setting: BarcodeStickerSetting) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Barcode Setting',
      message: `Delete barcode setting "${setting.name}"?`,
      onConfirm: () => {
        const result = deleteBarcodeSetting(setting.id);
        if (!result.success) addNotification({ title: 'Blocked', message: result.message || 'Unable to delete barcode setting.', type: 'error' });
        setConfirmModal(null);
      },
    });
  };

  const setDefault = (setting: BarcodeStickerSetting) => {
    barcodeSettings
      .filter((s) => s.id !== setting.id && s.isDefault)
      .forEach((s) => updateBarcodeSetting({ ...s, isDefault: false }));
    updateBarcodeSetting({ ...setting, isDefault: true });
  };

  const handleSave = () => {
    const name = form.name.trim();
    if (!name) {
      addNotification({ title: 'Validation', message: 'Setting name is required.', type: 'error' });
      return;
    }
    const duplicate = barcodeSettings.find((setting) =>
      setting.id !== editingId && normalizeText(setting.name) === normalizeText(name),
    );
    if (duplicate) {
      addNotification({ title: 'Validation', message: 'Setting name already exists.', type: 'error' });
      return;
    }

    const stickerWidth = toNumber(form.stickerWidth, -1);
    const stickerHeight = toNumber(form.stickerHeight, -1);
    const paperWidth = toNumber(form.paperWidth, -1);
    const paperHeight = toNumber(form.paperHeight, -1);
    const stickersInOneRow = Math.floor(toNumber(form.stickersInOneRow, 0));
    const stickersInOneSheet = Math.floor(toNumber(form.stickersInOneSheet, 0));
    const additionalTopMargin = toNumber(form.additionalTopMargin, 0);
    const additionalLeftMargin = toNumber(form.additionalLeftMargin, 0);
    const distanceBetweenRows = toNumber(form.distanceBetweenRows, 0);
    const distanceBetweenColumns = toNumber(form.distanceBetweenColumns, 0);

    if (stickerWidth <= 0 || stickerHeight <= 0 || paperWidth <= 0 || paperHeight <= 0) {
      addNotification({
        title: 'Validation',
        message: 'Sticker and paper dimensions must be greater than zero.',
        type: 'error',
      });
      return;
    }

    if (
      additionalTopMargin < 0 ||
      additionalLeftMargin < 0 ||
      distanceBetweenRows < 0 ||
      distanceBetweenColumns < 0
    ) {
      addNotification({
        title: 'Validation',
        message: 'Margins and distances cannot be negative.',
        type: 'error',
      });
      return;
    }

    if (stickersInOneRow <= 0 || stickersInOneSheet <= 0) {
      addNotification({
        title: 'Validation',
        message: 'Stickers in row/sheet must be greater than zero.',
        type: 'error',
      });
      return;
    }

    const usablePaperWidth = paperWidth - additionalLeftMargin;
    const usablePaperHeight = paperHeight - additionalTopMargin;
    if (usablePaperWidth <= 0 || usablePaperHeight <= 0) {
      addNotification({
        title: 'Validation',
        message: 'Paper dimensions must be larger than additional margins.',
        type: 'error',
      });
      return;
    }

    if (stickerWidth > usablePaperWidth || stickerHeight > usablePaperHeight) {
      addNotification({
        title: 'Validation',
        message: 'Sticker dimensions must fit inside paper dimensions after margins.',
        type: 'error',
      });
      return;
    }

    const requiredRowWidth =
      (stickersInOneRow * stickerWidth) +
      (Math.max(0, stickersInOneRow - 1) * distanceBetweenColumns);
    if (requiredRowWidth > usablePaperWidth) {
      addNotification({
        title: 'Validation',
        message: 'Sticker width + columns spacing exceeds paper width.',
        type: 'error',
      });
      return;
    }

    const rowPitch = stickerHeight + distanceBetweenRows;
    const maxRowsByHeight = Math.floor((usablePaperHeight + distanceBetweenRows) / rowPitch);
    const maxStickersPerSheet = Math.max(0, maxRowsByHeight * stickersInOneRow);
    if (!form.isContinuousFeed && stickersInOneSheet > maxStickersPerSheet) {
      addNotification({
        title: 'Validation',
        message: `No. of stickers per sheet exceeds capacity (${maxStickersPerSheet}) for the selected dimensions.`,
        type: 'error',
      });
      return;
    }

    const record: BarcodeStickerSetting = {
      id: editingId || generateId('BRC-'),
      name,
      description: form.description.trim(),
      isContinuousFeed: form.isContinuousFeed,
      additionalTopMargin,
      additionalLeftMargin,
      stickerWidth,
      stickerHeight,
      paperWidth,
      paperHeight,
      stickersInOneRow,
      distanceBetweenRows,
      distanceBetweenColumns,
      stickersInOneSheet,
      isDefault: form.isDefault,
    };

    if (editingId) updateBarcodeSetting(record);
    else addBarcodeSetting(record);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4 animate-fade-in pb-10">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Barcode Settings</h2>
        <span className="text-sm text-slate-500 mt-1">Manage barcode sticker templates</span>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-base text-slate-700">All barcode settings</h3>
          <button
            onClick={openAddModal}
            className="bg-[#4F46E5] text-white px-4 py-1.5 rounded text-sm hover:bg-indigo-700 transition flex items-center gap-1"
          >
            <Plus size={16} /> Add new setting
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 flex justify-end">
          <div className="relative w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search setting..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded border border-slate-300 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-700 font-bold border-y border-slate-200">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Label Size</th>
                <th className="px-4 py-3">Per Sheet</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSettings.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No barcode settings found.</td>
                </tr>
              )}
              {filteredSettings.map((setting) => (
                <tr key={setting.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-700">
                    {setting.name}
                    {setting.isDefault && (
                      <span className="ml-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">Default</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{setting.description || '--'}</td>
                  <td className="px-4 py-3 text-slate-700">{setting.isContinuousFeed ? 'Continuous' : 'Sheet'}</td>
                  <td className="px-4 py-3 text-slate-700">{setting.stickerWidth}" x {setting.stickerHeight}"</td>
                  <td className="px-4 py-3 text-slate-700">{setting.stickersInOneSheet}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditModal(setting)} className="px-2 py-1 text-xs text-blue-600 border border-blue-600 rounded flex items-center gap-1 hover:bg-blue-50">
                        <Edit size={12} /> Edit
                      </button>
                      <button onClick={() => handleDelete(setting)} className="px-2 py-1 text-xs text-red-500 border border-red-500 rounded flex items-center gap-1 hover:bg-red-50">
                        <Trash2 size={12} /> Delete
                      </button>
                      {!setting.isDefault && (
                        <button onClick={() => setDefault(setting)} className="px-2 py-1 text-xs text-cyan-500 border border-cyan-500 rounded hover:bg-cyan-50">
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

        <div className="p-4 border-t border-slate-100 text-sm text-slate-600">
          Showing {filteredSettings.length > 0 ? 1 : 0} to {filteredSettings.length} of {filteredSettings.length} entries
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded shadow-xl w-full max-w-3xl overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-200">
              <h3 className="text-xl text-slate-800">{editingId ? 'Edit barcode setting' : 'Add barcode setting'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={22} />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-800 mb-1">Setting Name *</label>
                  <input value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-800 mb-1">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))} className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm h-20" />
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
                  <input type="checkbox" checked={form.isContinuousFeed} onChange={(e) => setForm(prev => ({ ...prev, isContinuousFeed: e.target.checked }))} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  Continuous feed or rolls
                </label>

                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Additional top margin (Inches)</label>
                  <input type="number" step="0.01" value={form.additionalTopMargin} onChange={(e) => setForm(prev => ({ ...prev, additionalTopMargin: e.target.value }))} className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Additional left margin (Inches)</label>
                  <input type="number" step="0.01" value={form.additionalLeftMargin} onChange={(e) => setForm(prev => ({ ...prev, additionalLeftMargin: e.target.value }))} className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Width of sticker (Inches) *</label>
                  <input type="number" step="0.01" value={form.stickerWidth} onChange={(e) => setForm(prev => ({ ...prev, stickerWidth: e.target.value }))} className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Height of sticker (Inches) *</label>
                  <input type="number" step="0.01" value={form.stickerHeight} onChange={(e) => setForm(prev => ({ ...prev, stickerHeight: e.target.value }))} className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Paper width (Inches) *</label>
                  <input type="number" step="0.01" value={form.paperWidth} onChange={(e) => setForm(prev => ({ ...prev, paperWidth: e.target.value }))} className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Paper height (Inches) *</label>
                  <input type="number" step="0.01" value={form.paperHeight} onChange={(e) => setForm(prev => ({ ...prev, paperHeight: e.target.value }))} className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Stickers in one row *</label>
                  <input type="number" min={1} value={form.stickersInOneRow} onChange={(e) => setForm(prev => ({ ...prev, stickersInOneRow: e.target.value }))} className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">No. of stickers per sheet *</label>
                  <input type="number" min={1} value={form.stickersInOneSheet} onChange={(e) => setForm(prev => ({ ...prev, stickersInOneSheet: e.target.value }))} className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Distance between rows (Inches)</label>
                  <input type="number" step="0.01" value={form.distanceBetweenRows} onChange={(e) => setForm(prev => ({ ...prev, distanceBetweenRows: e.target.value }))} className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-1">Distance between columns (Inches)</label>
                  <input type="number" step="0.01" value={form.distanceBetweenColumns} onChange={(e) => setForm(prev => ({ ...prev, distanceBetweenColumns: e.target.value }))} className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:border-blue-500 text-sm" />
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
                  <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm(prev => ({ ...prev, isDefault: e.target.checked }))} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  Set as default
                </label>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={handleSave} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition">Save</button>
              <button onClick={() => setIsModalOpen(false)} className="bg-slate-700 text-white px-6 py-2 rounded font-bold hover:bg-slate-800 transition">Close</button>
            </div>
          </div>
        </div>
      )}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <div className="flex flex-col items-center text-center">
              <div className="p-4 rounded-full bg-rose-50 text-rose-500 mb-4"><Trash2 size={32} /></div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{confirmModal.title}</h3>
              <p className="text-slate-500 text-sm mb-6">{confirmModal.message}</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setConfirmModal(null)} className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={confirmModal.onConfirm} className="flex-1 px-4 py-2.5 rounded-lg text-white font-bold bg-rose-600 hover:bg-rose-700 transition-colors">Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarcodeSettings;
