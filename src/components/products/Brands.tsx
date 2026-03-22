import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus, Search, FileText, FileSpreadsheet, Printer,
  Download, Edit, Trash2, X, ChevronDown,
  ArrowUpDown, AlertTriangle, Bookmark
} from 'lucide-react';
import { useGlobalContext } from '@/context/GlobalContext';
import type { ProductBrand } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import { buildPaginationItems } from '@/utils/pagination';

const Brands: React.FC = () => {
  const {
    productBrands,
    products,
    addProductBrand,
    updateProductBrand,
    deleteProductBrand,
    generateId,
  } = useGlobalContext();
  const { addNotification } = useNotifications();

  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<'name' | 'note'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteReassignId, setDeleteReassignId] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<ProductBrand | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    note: ''
  });
  const [formError, setFormError] = useState('');

  const normalizeText = (value?: string) => String(value || '').trim().toLowerCase();

  const csvEscape = (value?: string): string => {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  };

  const htmlEscape = (value?: string): string =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const handleSort = (field: 'name' | 'note') => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setCurrentPage(1);
  };

  const filtered = useMemo(() => {
    const term = normalizeText(searchTerm);
    return [...productBrands]
      .filter(brand =>
        normalizeText(brand.name).includes(term) ||
        normalizeText(brand.note).includes(term)
      )
      .sort((a, b) => {
        const av = normalizeText(String(a[sortField] || ''));
        const bv = normalizeText(String(b[sortField] || ''));
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
  }, [productBrands, searchTerm, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageItems = buildPaginationItems(safePage, totalPages);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pendingDeleteUsage = useMemo(() => {
    if (!pendingDeleteId) return { count: 0, sampleProducts: [] as string[] };
    const target = productBrands.find(brand => brand.id === pendingDeleteId);
    if (!target) return { count: 0, sampleProducts: [] as string[] };
    const linkedProducts = products.filter(product => {
      const linkedById = product.brandId === target.id;
      const linkedByLegacyName = !product.brandId &&
        normalizeText(product.brand) === normalizeText(target.name);
      return linkedById || linkedByLegacyName;
    });
    return {
      count: linkedProducts.length,
      sampleProducts: linkedProducts.slice(0, 3).map(product => product.name),
    };
  }, [pendingDeleteId, productBrands, products]);

  const reassignCandidates = useMemo(() => {
    if (!pendingDeleteId) return productBrands;
    return productBrands.filter(brand => brand.id !== pendingDeleteId);
  }, [productBrands, pendingDeleteId]);

  const exportCSV = () => {
    const headers = ['Brand Name', 'Note'];
    const rows = filtered.map(brand => [csvEscape(brand.name), csvEscape(brand.note)].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'brands.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const html = `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Brands</title>
      </head>
      <body>
        <table border="1">
          <thead><tr><th>Brand Name</th><th>Note</th></tr></thead>
          <tbody>
            ${filtered.map(brand => `<tr><td>${htmlEscape(brand.name)}</td><td>${htmlEscape(brand.note)}</td></tr>`).join('')}
          </tbody>
        </table>
      </body>
      </html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'brands.xls'; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });

      const marginLeft = 40;
      const marginTop = 48;
      const lineHeight = 18;
      let y = marginTop;

      doc.setFontSize(16);
      doc.text('Brands', marginLeft, y);
      y += lineHeight + 4;

      doc.setFontSize(10);
      doc.text('Brand Name', marginLeft, y);
      doc.text('Note', marginLeft + 260, y);
      y += lineHeight - 2;

      filtered.forEach((brand) => {
        if (y > 780) {
          doc.addPage();
          y = marginTop;
          doc.setFontSize(10);
          doc.text('Brand Name', marginLeft, y);
          doc.text('Note', marginLeft + 260, y);
          y += lineHeight - 2;
        }

        doc.text(String(brand.name || ''), marginLeft, y, { maxWidth: 240 });
        doc.text(String(brand.note || ''), marginLeft + 260, y, { maxWidth: 280 });
        y += lineHeight;
      });

      doc.save('brands.pdf');
    } catch {
      addNotification({ title: 'Export Error', message: 'PDF export is currently unavailable.', type: 'error' });
    }
  };

  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=800,height=600');
    if (!w) return;
    w.document.write(`<html><head><title>Brands</title></head><body>
      <h2>Brands</h2>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
        <thead><tr><th>Brand Name</th><th>Note</th></tr></thead>
        <tbody>${filtered.map(brand => `<tr><td>${htmlEscape(brand.name)}</td><td>${htmlEscape(brand.note)}</td></tr>`).join('')}</tbody>
      </table>
      <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
    </body></html>`);
    w.document.close();
  };

  const openAdd = () => {
    setEditingBrand(null);
    setFormData({ name: '', note: '' });
    setFormError('');
    setIsAddModalOpen(true);
  };

  const openEdit = (brand: ProductBrand) => {
    setEditingBrand(brand);
    setFormData({ name: brand.name, note: brand.note || '' });
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleSave = () => {
    const trimmedName = formData.name.trim();
    const trimmedNote = formData.note.trim();

    if (!trimmedName) {
      setFormError('Brand name is required.');
      return;
    }
    const duplicate = productBrands.find(brand =>
      normalizeText(brand.name) === normalizeText(trimmedName) &&
      (!editingBrand || brand.id !== editingBrand.id)
    );
    if (duplicate) {
      setFormError('Brand name already exists.');
      return;
    }

    if (editingBrand) {
      updateProductBrand({
        ...editingBrand,
        name: trimmedName,
        note: trimmedNote,
      });
      addNotification({ title: 'Brand Updated', message: `"${trimmedName}" updated successfully.`, type: 'success' });
    } else {
      const newBrand: ProductBrand = {
        id: generateId('BRD'),
        name: trimmedName,
        note: trimmedNote,
      };
      addProductBrand(newBrand);
      addNotification({ title: 'Brand Created', message: `"${trimmedName}" added successfully.`, type: 'success' });
    }
    setFormData({ name: '', note: '' });
    setFormError('');
    setIsAddModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!pendingDeleteId) return;
    deleteProductBrand(pendingDeleteId, deleteReassignId || undefined);
    if (pendingDeleteUsage.count > 0) {
      addNotification({
        title: 'Brand Deleted',
        message: `${pendingDeleteUsage.count} product(s) were reassigned${deleteReassignId ? ' to the selected brand.' : ' to --.'}`,
        type: 'warning',
      });
    } else {
      addNotification({ title: 'Brand Deleted', message: 'Brand deleted successfully.', type: 'success' });
    }
    setPendingDeleteId(null);
    setDeleteReassignId('');
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
            <Bookmark size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Brands</h2>
            <p className="text-slate-500 mt-0.5 text-sm">Manage your product brands</p>
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
                <FileSpreadsheet size={14} /> Export Excel
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
                    Brand Name <ArrowUpDown size={14} />
                  </button>
                </th>
                <th className="px-6 py-4 w-1/2">
                  <button className="flex items-center gap-2 hover:text-slate-700" onClick={() => handleSort('note')}>
                    Note <ArrowUpDown size={14} />
                  </button>
                </th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.length > 0 ? (
                paginated.map((brand) => (
                  <tr key={brand.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-900 text-sm">{brand.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-slate-600">{brand.note}</span>
                    </td>
                    <td className="px-6 py-4 text-right align-top">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(brand)} className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-xs font-bold hover:bg-indigo-100 transition-colors">
                          <Edit size={12} /> Edit
                        </button>
                        <button onClick={() => { setPendingDeleteId(brand.id); setDeleteReassignId(''); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-400 italic">
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
                {editingBrand ? 'Edit Brand' : 'Add Brand'}
              </h3>
              <button onClick={() => { setIsAddModalOpen(false); setFormError(''); }} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
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
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Brand Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-800 shadow-sm"
                    placeholder="Brand Name"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({...formData, name: e.target.value});
                      setFormError('');
                    }}
                  />
                </div>

                <div className="group">
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Short Description</label>
                  <textarea
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 shadow-sm resize-none"
                    placeholder="Short description"
                    value={formData.note}
                    onChange={(e) => {
                      setFormData({...formData, note: e.target.value});
                      setFormError('');
                    }}
                  ></textarea>
                </div>
              </div>
            </div>

            <div className="px-8 py-6 border-t border-slate-100 flex justify-end gap-3 bg-white z-10">
              <button onClick={() => { setIsAddModalOpen(false); setFormError(''); }} className="px-6 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all text-sm shadow-sm">
                Close
              </button>
              <button onClick={handleSave} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20 text-sm">
                {editingBrand ? 'Update' : 'Save'}
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
            <p className="text-slate-500 text-sm mb-2">Are you sure you want to delete this brand? This action cannot be undone.</p>
            {pendingDeleteUsage.count > 0 ? (
              <div className="mb-4 text-sm">
                <p className="text-amber-700 mb-2">
                  {pendingDeleteUsage.count} product(s) currently use this brand.
                  {pendingDeleteUsage.sampleProducts.length > 0 ? ` Example: ${pendingDeleteUsage.sampleProducts.join(', ')}` : ''}
                </p>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Reassign Products To</label>
                <select
                  value={deleteReassignId}
                  onChange={(e) => setDeleteReassignId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700"
                >
                  <option value="">-- (system default)</option>
                  {reassignCandidates.map(brand => (
                    <option key={brand.id} value={brand.id}>{brand.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-slate-500 text-sm mb-6">No products are linked to this brand.</p>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => { setPendingDeleteId(null); setDeleteReassignId(''); }} className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition">Cancel</button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition"
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Brands;
