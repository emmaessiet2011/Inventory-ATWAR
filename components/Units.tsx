import React, { useState, useMemo, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import {
  Plus, Search, FileText, FileSpreadsheet, Printer,
  Download, Edit, Trash2, X, ChevronDown,
  ArrowUpDown, AlertTriangle, Ruler, Star
} from 'lucide-react';
import { useGlobalContext } from '../src/context/GlobalContext';
import type { ProductUnit } from '../src/context/GlobalContext';
import { buildPaginationItems } from '../src/utils/pagination';

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const csvEscape = (value: string) => `"${value.replace(/"/g, '""')}"`;

const Units: React.FC = () => {
  const {
    productUnits,
    addProductUnit,
    updateProductUnit,
    deleteProductUnit,
    products,
    setProducts,
    settings,
    updateSettings,
    generateId,
  } = useGlobalContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<'name' | 'shortName' | 'allowDecimal'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<ProductUnit | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    shortName: '',
    allowDecimal: 'Yes'
  });
  const [formError, setFormError] = useState('');

  const handleSort = (field: 'name' | 'shortName' | 'allowDecimal') => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setCurrentPage(1);
  };

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return [...productUnits]
      .filter(u =>
        u.name.toLowerCase().includes(term) ||
        u.shortName.toLowerCase().includes(term)
      )
      .sort((a, b) => {
        let av: string, bv: string;
        if (sortField === 'allowDecimal') {
          av = a.allowDecimal ? 'yes' : 'no';
          bv = b.allowDecimal ? 'yes' : 'no';
        } else {
          av = a[sortField];
          bv = b[sortField];
        }
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
  }, [productUnits, searchTerm, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageItems = buildPaginationItems(safePage, totalPages);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pendingDeleteInfo = useMemo(() => {
    if (!pendingDeleteId) return null;
    const unit = productUnits.find(u => u.id === pendingDeleteId);
    if (!unit) return null;
    const tokens = new Set(
      [normalizeText(unit.name).toLowerCase(), normalizeText(unit.shortName).toLowerCase()].filter(Boolean)
    );
    const usedByProducts = products.filter(p => tokens.has(normalizeText(p.unit || '').toLowerCase()));
    const isDefaultUnit = tokens.has(normalizeText(settings.defaultUnit || '').toLowerCase());
    return { unit, usedByProducts, isDefaultUnit };
  }, [pendingDeleteId, productUnits, products, settings.defaultUnit]);

  const exportCSV = () => {
    const headers = ['Name', 'Short Name', 'Allow Decimal'];
    const rows = filtered.map(u => [csvEscape(u.name), csvEscape(u.shortName), u.allowDecimal ? 'Yes' : 'No'].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'units.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const sanitizeTsv = (value: string) => value.replace(/\r?\n/g, ' ').replace(/\t/g, ' ');
    const headers = ['Name', 'Short Name', 'Allow Decimal'];
    const rows = filtered.map(u => [sanitizeTsv(u.name), sanitizeTsv(u.shortName), u.allowDecimal ? 'Yes' : 'No'].join('\t'));
    const tsv = [headers.join('\t'), ...rows].join('\n');
    const blob = new Blob([tsv], { type: 'text/tab-separated-values;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'units.tsv'; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const marginX = 40;
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = doc.internal.pageSize.getWidth() - marginX * 2;
    let y = 44;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Units Report', marginX, y);
    y += 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, marginX, y);
    y += 18;

    filtered.forEach((u, idx) => {
      const line = `${idx + 1}. ${u.name} (${u.shortName}) - Allow Decimal: ${u.allowDecimal ? 'Yes' : 'No'}`;
      const wrapped = doc.splitTextToSize(line, contentWidth);
      const requiredHeight = wrapped.length * 14 + 4;
      if (y + requiredHeight > pageHeight - 40) {
        doc.addPage();
        y = 44;
      }
      doc.text(wrapped, marginX, y);
      y += requiredHeight;
    });

    doc.save('units.pdf');
  };

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=800,height=600');
    if (!w) return;
    w.document.write(`<html><head><title>Units</title></head><body>
      <h2>Units</h2>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
        <thead><tr><th>Name</th><th>Short Name</th><th>Allow Decimal</th></tr></thead>
        <tbody>${filtered.map(u => `<tr><td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.shortName)}</td><td>${u.allowDecimal ? 'Yes' : 'No'}</td></tr>`).join('')}</tbody>
      </table>
      <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
    </body></html>`);
    w.document.close();
  };

  const openAdd = () => {
    setEditingUnit(null);
    setFormData({ name: '', shortName: '', allowDecimal: 'Yes' });
    setFormError('');
    setIsAddModalOpen(true);
  };

  const openEdit = (unit: ProductUnit) => {
    setEditingUnit(unit);
    setFormData({ name: unit.name, shortName: unit.shortName, allowDecimal: unit.allowDecimal ? 'Yes' : 'No' });
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleSave = () => {
    const nextName = normalizeText(formData.name);
    const nextShortName = normalizeText(formData.shortName);
    if (!nextName || !nextShortName) {
      setFormError('Name and Short Name are required.');
      return;
    }
    const duplicate = productUnits.find(u =>
      (normalizeText(u.name).toLowerCase() === nextName.toLowerCase() ||
        normalizeText(u.shortName).toLowerCase() === nextShortName.toLowerCase()) &&
      (!editingUnit || u.id !== editingUnit.id)
    );
    if (duplicate) {
      setFormError('A unit with the same Name or Short Name already exists.');
      return;
    }

    if (editingUnit) {
      const prevNameKey = normalizeText(editingUnit.name).toLowerCase();
      const prevShortKey = normalizeText(editingUnit.shortName).toLowerCase();
      const updatedUnit: ProductUnit = {
        ...editingUnit,
        name: nextName,
        shortName: nextShortName,
        allowDecimal: formData.allowDecimal === 'Yes',
      };
      updateProductUnit(updatedUnit);

      // Keep product unit values aligned when unit label/short name changes.
      setProducts(prev => prev.map(product => {
        const productUnitKey = normalizeText(product.unit || '').toLowerCase();
        if (productUnitKey === prevShortKey || productUnitKey === prevNameKey) {
          return { ...product, unit: updatedUnit.shortName };
        }
        return product;
      }));

      const defaultUnitKey = normalizeText(settings.defaultUnit || '').toLowerCase();
      if (defaultUnitKey === prevShortKey || defaultUnitKey === prevNameKey) {
        updateSettings({ ...settings, defaultUnit: updatedUnit.shortName });
      }
    } else {
      const newUnit: ProductUnit = {
        id: generateId('UNIT'),
        name: nextName,
        shortName: nextShortName,
        allowDecimal: formData.allowDecimal === 'Yes',
      };
      addProductUnit(newUnit);
    }
    setFormData({ name: '', shortName: '', allowDecimal: 'Yes' });
    setFormError('');
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
            <Ruler size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Units</h2>
            <p className="text-slate-500 mt-0.5 text-sm">Manage your units of measure</p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-md flex items-center gap-2 active:scale-95"
        >
          <Plus size={18} /> Add
        </button>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>

        {/* Controls Bar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col xl:flex-row justify-between gap-4 items-center">
            {/* Show Entries */}
            <div className="flex items-center gap-3 w-full xl:w-auto">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Show</span>
              <div className="relative">
                <select
                  className="border-0 bg-white shadow-sm ring-1 ring-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm font-medium focus:ring-2 focus:ring-red-500/20 focus:outline-none cursor-pointer appearance-none"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">entries</span>
            </div>

            {/* Export Buttons */}
            <div className="flex flex-wrap justify-center gap-2 w-full xl:w-auto">
              <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap">
                <FileText size={14} /> Export CSV
              </button>
              <button onClick={exportExcel} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap">
                <FileSpreadsheet size={14} /> Export TSV
              </button>
              <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap">
                <Printer size={14} /> Print
              </button>
              <button onClick={exportPDF} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap">
                <Download size={14} /> Export PDF
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full xl:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search..."
                className="w-full xl:w-64 pl-9 pr-4 py-2.5 rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-red-500/20 focus:outline-none text-sm placeholder:text-slate-400"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/80 backdrop-blur-sm sticky top-0 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 w-1/3">
                  <button className="flex items-center gap-2 hover:text-slate-700" onClick={() => handleSort('name')}>
                    Name <ArrowUpDown size={14} />
                  </button>
                </th>
                <th className="px-6 py-4 w-1/4">
                  <button className="flex items-center gap-2 hover:text-slate-700" onClick={() => handleSort('shortName')}>
                    Short name <ArrowUpDown size={14} />
                  </button>
                </th>
                <th className="px-6 py-4 w-1/4">
                  <button className="flex items-center gap-2 hover:text-slate-700" onClick={() => handleSort('allowDecimal')}>
                    Allow decimal <ArrowUpDown size={14} />
                  </button>
                </th>
                <th className="px-6 py-4 w-1/6">Default</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.length > 0 ? (
                paginated.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-900 text-sm">{u.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-slate-600">{u.shortName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-slate-600">{u.allowDecimal ? 'Yes' : 'No'}</span>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const isDefault = normalizeText(u.shortName).toLowerCase() === normalizeText(settings.defaultUnit || '').toLowerCase() ||
                          normalizeText(u.name).toLowerCase() === normalizeText(settings.defaultUnit || '').toLowerCase();
                        return isDefault ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                            <Star size={10} /> Default
                          </span>
                        ) : null;
                      })()}
                    </td>
                    <td className="px-6 py-4 text-right align-top">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(() => {
                          const isDefault = normalizeText(u.shortName).toLowerCase() === normalizeText(settings.defaultUnit || '').toLowerCase() ||
                            normalizeText(u.name).toLowerCase() === normalizeText(settings.defaultUnit || '').toLowerCase();
                          return !isDefault ? (
                            <button
                              onClick={() => updateSettings({ ...settings, defaultUnit: u.shortName })}
                              className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Set as Default"
                            >
                              <Star size={16} />
                            </button>
                          ) : null;
                        })()}
                        <button onClick={() => openEdit(u)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => setPendingDeleteId(u.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                    No data available in table
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-500 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <span>Showing {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1} to {Math.min(safePage * pageSize, filtered.length)} of {filtered.length} entries</span>
            <label className="flex items-center gap-2">
              <span className="text-slate-500">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1 border border-slate-200 rounded bg-white text-slate-700"
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >Previous</button>
            {pageItems.map((item, index) => item === '...'
              ? <span key={`page-ellipsis-${index}`} className="px-2 py-2 text-slate-400">...</span>
              : (
                <button
                  key={item}
                  onClick={() => setCurrentPage(item)}
                  className={`px-4 py-2 rounded-lg shadow-sm ${item === safePage ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' : 'bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-700 transition'}`}
                >
                  {item}
                </button>
              ))}
            <button
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >Next</button>
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 bg-white sticky top-0 z-10">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                {editingUnit ? 'Edit Unit' : 'Add Unit'}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto custom-scrollbar">
              <div className="space-y-6">
                {formError && (
                  <div className="px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-bold">
                    {formError}
                  </div>
                )}
                <div className="group">
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm"
                    placeholder="Name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div className="group">
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Short Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm"
                    placeholder="Short name"
                    value={formData.shortName}
                    onChange={(e) => setFormData({...formData, shortName: e.target.value})}
                  />
                </div>

                <div className="group">
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Allow Decimal</label>
                  <div className="relative">
                    <select
                      className="w-full pl-4 pr-10 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 appearance-none cursor-pointer"
                      value={formData.allowDecimal}
                      onChange={(e) => setFormData({...formData, allowDecimal: e.target.value})}
                    >
                      <option>Yes</option>
                      <option>No</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-8 py-6 border-t border-slate-100 flex justify-end gap-3 bg-white z-10">
              <button onClick={() => setIsAddModalOpen(false)} className="px-6 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all text-sm shadow-sm">
                Close
              </button>
              <button onClick={handleSave} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20 text-sm">
                {editingUnit ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {pendingDeleteId && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Confirm Delete</h3>
            </div>
            <p className="text-slate-500 text-sm mb-6">Are you sure you want to delete this unit? This action cannot be undone.</p>
            {pendingDeleteInfo?.isDefaultUnit && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-amber-800 text-xs font-bold">This unit is the system default. Use the <Star size={10} className="inline" /> (Set as Default) button on another unit first, then delete this one.</p>
              </div>
            )}
            {pendingDeleteInfo && pendingDeleteInfo.usedByProducts.length > 0 && (
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-amber-800 text-xs font-bold mb-1">This unit is used by {pendingDeleteInfo.usedByProducts.length} product(s).</p>
                <p className="text-amber-700 text-xs">
                  Reassign those products first: {pendingDeleteInfo.usedByProducts.slice(0, 3).map(p => p.name).join(', ')}
                  {pendingDeleteInfo.usedByProducts.length > 3 ? ` +${pendingDeleteInfo.usedByProducts.length - 3} more` : ''}
                </p>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setPendingDeleteId(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition">Cancel</button>
              <button
                onClick={() => {
                  if (!pendingDeleteInfo) {
                    setPendingDeleteId(null);
                    return;
                  }
                  const canDelete = !pendingDeleteInfo.isDefaultUnit && pendingDeleteInfo.usedByProducts.length === 0;
                  if (!canDelete) return;
                  deleteProductUnit(pendingDeleteId);
                  setPendingDeleteId(null);
                }}
                disabled={!!pendingDeleteInfo && (pendingDeleteInfo.isDefaultUnit || pendingDeleteInfo.usedByProducts.length > 0)}
                className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Units;
