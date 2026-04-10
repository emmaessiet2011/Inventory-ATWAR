import React, { useState, useMemo, useRef, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import {
  Plus, Search, FileText, FileSpreadsheet, Printer,
  Columns, Download, Edit, Trash2, X, ChevronDown,
  ArrowUpDown, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { useGlobalContext } from '@/context/GlobalContext';
import type { ProductVariation } from '@/context/GlobalContext';
import { buildPaginationItems } from '@/utils/pagination';
import { formatDateTimeBySettings } from '@/utils/dateTime';

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const csvEscape = (value: string) => `"${value.replace(/"/g, '""')}"`;

const Variations: React.FC = () => {
  const {
    productVariations,
    addProductVariation,
    updateProductVariation,
    deleteProductVariation,
    products,
    settings,
    generateId,
  } = useGlobalContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showColMenu, setShowColMenu] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const colMenuRef = useRef<HTMLDivElement>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVariation, setEditingVariation] = useState<ProductVariation | null>(null);
  const [formName, setFormName] = useState('');
  const [formValues, setFormValues] = useState<string[]>(['']);
  const [formError, setFormError] = useState('');

  const handleSort = () => {
    setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    setCurrentPage(1);
  };

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return [...productVariations]
      .filter(v =>
        v.name.toLowerCase().includes(term) ||
        v.values.some(val => val.toLowerCase().includes(term))
      )
      .sort((a, b) => sortDir === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name)
      );
  }, [productVariations, searchTerm, sortDir]);

  const pendingDeleteUsage = useMemo(() => {
    if (!pendingDeleteId) return [];
    return products.filter(p => (p.variationRows || []).some(row => row.variationId === pendingDeleteId));
  }, [products, pendingDeleteId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageItems = buildPaginationItems(safePage, totalPages);
  const colDefs = [
    { key: 'name', label: 'Variations' },
    { key: 'values', label: 'Values' },
  ];
  const visibleCols = colDefs.filter(c => !hiddenCols.includes(c.key));

  const exportCSV = () => {
    const headers = ['Name', 'Values'];
    const rows = filtered.map(v => [csvEscape(v.name), csvEscape(v.values.join(' | '))].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'variations.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const sanitizeTsv = (value: string) => value.replace(/\r?\n/g, ' ').replace(/\t/g, ' ');
    const headers = ['Name', 'Values'];
    const rows = filtered.map(v => [sanitizeTsv(v.name), sanitizeTsv(v.values.join(' | '))].join('\t'));
    const tsv = [headers.join('\t'), ...rows].join('\n');
    const blob = new Blob([tsv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'variations.xls';
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!showColMenu) return;
    const onDocClick = (event: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(event.target as Node)) {
        setShowColMenu(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showColMenu]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=800,height=600');
    if (!w) return;
    w.document.write(`<html><head><title>Variations</title></head><body>
      <h2>Variations</h2>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
        <thead><tr><th>Name</th><th>Values</th></tr></thead>
        <tbody>${filtered.map(v => `<tr><td>${escapeHtml(v.name)}</td><td>${escapeHtml(v.values.join(', '))}</td></tr>`).join('')}</tbody>
      </table>
      <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
    </body></html>`);
    w.document.close();
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 40;
    const contentWidth = pageWidth - marginX * 2;
    let y = 44;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Variations Report', marginX, y);
    y += 22;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Generated: ${formatDateTimeBySettings(new Date().toISOString(), settings.dateFormat, settings.timeFormat, settings.timeZone)}`, marginX, y);
    y += 20;

    filtered.forEach((v, idx) => {
      const line = `${idx + 1}. ${v.name} - ${v.values.join(', ')}`;
      const wrapped = doc.splitTextToSize(line, contentWidth);
      const requiredHeight = wrapped.length * 14 + 4;
      if (y + requiredHeight > pageHeight - 40) {
        doc.addPage();
        y = 44;
      }
      doc.text(wrapped, marginX, y);
      y += requiredHeight;
    });

    doc.save('variations.pdf');
  };

  const openAdd = () => {
    setEditingVariation(null);
    setFormName('');
    setFormValues(['']);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEdit = (v: ProductVariation) => {
    setEditingVariation(v);
    setFormName(v.name);
    setFormValues([...v.values]);
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingVariation(null);
    setFormName('');
    setFormValues(['']);
    setFormError('');
  };

  const handleAddValue = () => setFormValues(prev => [...prev, '']);

  const handleValueChange = (index: number, val: string) => {
    setFormValues(prev => { const u = [...prev]; u[index] = val; return u; });
  };

  const handleRemoveValue = (index: number) => {
    setFormValues(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const name = normalizeText(formName);
    if (!name) {
      setFormError('Variation name is required.');
      return;
    }
    const cleanedValues = formValues.map(normalizeText).filter(Boolean);
    if (cleanedValues.length === 0) {
      setFormError('Add at least one variation value.');
      return;
    }
    const seen = new Set<string>();
    const values: string[] = [];
    for (const val of cleanedValues) {
      const key = val.toLowerCase();
      if (seen.has(key)) {
        setFormError(`Duplicate value "${val}" is not allowed.`);
        return;
      }
      seen.add(key);
      values.push(val);
    }
    if (values.length === 0) {
      setFormError('Add at least one variation value.');
      return;
    }
    const duplicate = productVariations.find(v =>
      normalizeText(v.name).toLowerCase() === name.toLowerCase() &&
      (!editingVariation || v.id !== editingVariation.id)
    );
    if (duplicate) {
      setFormError(`Variation "${name}" already exists.`);
      return;
    }

    if (editingVariation) {
      updateProductVariation({ ...editingVariation, name, values });
    } else {
      addProductVariation({ id: generateId('VAR'), name, values });
    }
    setFormError('');
    closeModal();
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
            <Columns size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Variations</h2>
            <p className="text-slate-500 text-sm mt-0.5">Manage product variations and value sets</p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-md flex items-center gap-2 active:scale-95"
        >
          <Plus size={18} /> Add Variation
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
            <div ref={colMenuRef} className="flex flex-wrap justify-center gap-2 w-full xl:w-auto relative">
              <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap">
                <FileText size={14} /> Export CSV
              </button>
              <button onClick={exportExcel} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap">
                <FileSpreadsheet size={14} /> Export Excel
              </button>
              <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap">
                <Printer size={14} /> Print
              </button>
              <button onClick={() => setShowColMenu(v => !v)} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap">
                <Columns size={14} /> Column visibility
              </button>
              {showColMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 p-3 min-w-[180px]">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Toggle Columns</p>
                  {colDefs.map(col => (
                    <label key={col.key} className="flex items-center gap-2 py-1 cursor-pointer hover:text-blue-600">
                      <input type="checkbox"
                        checked={!hiddenCols.includes(col.key)}
                        onChange={() => setHiddenCols(prev => prev.includes(col.key) ? prev.filter(c => c !== col.key) : [...prev, col.key])}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                      <span className="text-xs font-medium text-slate-700">{col.label}</span>
                    </label>
                  ))}
                </div>
              )}
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
            <thead className="bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10 text-slate-500 font-semibold border-b border-slate-200 whitespace-nowrap">
              <tr>
                {!hiddenCols.includes('name') && (
                  <th className="px-6 py-4 w-1/4">
                    <button className="flex items-center gap-2 hover:text-slate-700" onClick={handleSort}>
                      Variations <ArrowUpDown size={14} />
                    </button>
                  </th>
                )}
                {!hiddenCols.includes('values') && (
                  <th className="px-6 py-4">
                    <div className="flex items-center gap-2">Values</div>
                  </th>
                )}
                <th className="px-6 py-4 text-right w-32">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.length > 0 ? (
                paginated.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/80 transition-colors group">
                    {!hiddenCols.includes('name') && (
                      <td className="px-6 py-4 align-top">
                        <span className="font-bold text-slate-900 text-sm">{v.name}</span>
                      </td>
                    )}
                    {!hiddenCols.includes('values') && (
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {v.values.map((val, idx) => (
                            <span key={idx} className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">
                              {val}
                            </span>
                          ))}
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 text-right align-top">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(v)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => setPendingDeleteId(v.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={visibleCols.length + 1} className="px-6 py-12 text-center text-slate-400 italic">
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
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 bg-white sticky top-0 z-10">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                {editingVariation ? 'Edit Variation' : 'Add Variation'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
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
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Variation Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm"
                    placeholder="e.g. Size"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Values</label>
                    <button onClick={handleAddValue} className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:underline">
                      <Plus size={12} /> Add Value
                    </button>
                  </div>
                  <div className="space-y-3">
                    {formValues.map((val, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="text"
                          className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium shadow-sm"
                          placeholder={`Value ${idx + 1}`}
                          value={val}
                          onChange={(e) => handleValueChange(idx, e.target.value)}
                        />
                        {formValues.length > 1 && (
                          <button onClick={() => handleRemoveValue(idx)} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                            <X size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-8 py-6 border-t border-slate-100 flex justify-end gap-3 bg-white z-10">
              <button onClick={closeModal} className="px-6 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all text-sm shadow-sm">
                Cancel
              </button>
              <button onClick={handleSave} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20 text-sm flex items-center gap-2">
                <CheckCircle2 size={16} />
                {editingVariation ? 'Update Variation' : 'Save Variation'}
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
            <p className="text-slate-500 text-sm mb-6">Are you sure you want to delete this variation? This action cannot be undone.</p>
            {pendingDeleteUsage.length > 0 && (
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-amber-800 text-xs font-bold mb-1">This variation is used in {pendingDeleteUsage.length} product(s).</p>
                <p className="text-amber-700 text-xs">
                  Remove variation rows from these products first: {pendingDeleteUsage.slice(0, 3).map(p => p.name).join(', ')}
                  {pendingDeleteUsage.length > 3 ? ` +${pendingDeleteUsage.length - 3} more` : ''}
                </p>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setPendingDeleteId(null)} className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition">Cancel</button>
              <button
                onClick={() => { deleteProductVariation(pendingDeleteId); setPendingDeleteId(null); }}
                disabled={pendingDeleteUsage.length > 0}
                className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Variations;
