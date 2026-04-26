import React, { useMemo, useState } from 'react';
import {
  Plus, Search, FileText, FileSpreadsheet, Printer, Download,
  Edit, Trash2, ShoppingCart, Filter, X, Info,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import {
  useGlobalContext,
  PurchaseRequisition as GlobalPurchaseRequisition,
  PurchaseRequisitionItem,
} from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import { printDocument, statusBadge } from '@/utils/printUtils';
import { formatDateBySettings, formatDateTimeBySettings } from '@/utils/dateTime';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

interface PurchaseRequisitionProps {
  onNavigate?: (page: string) => void;
}

interface RequisitionItemForm extends PurchaseRequisitionItem {
  rowId: string;
}

interface RequisitionFormState {
  date: string;
  referenceNo: string;
  location: string;
  brand: string;
  category: string;
  requiredByDate: string;
  items: RequisitionItemForm[];
}

const csvEscape = (value: string): string => {
  const normalized = String(value ?? '');
  return /["\n,]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
};



const toLocalDateTimeInput = (value?: string): string => {
  const src = value ? new Date(value) : new Date();
  const date = Number.isNaN(src.getTime()) ? new Date() : src;
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const toLocalDateInput = (value?: string): string => toLocalDateTimeInput(value).slice(0, 10);
const normalizeText = (value: string): string => value.trim().toLowerCase();

const PurchaseRequisition: React.FC<PurchaseRequisitionProps> = ({ onNavigate }) => {
  const { addNotification } = useNotifications();
  const {
    purchaseRequisitions,
    purchaseOrders,
    addPurchaseRequisition,
    updatePurchaseRequisition,
    deletePurchaseRequisition,
    products,
    productBrands,
    productCategories,
    locations,
    settings,
    currentUser,
    generateId,
  } = useGlobalContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [brandFilter, setBrandFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRequisition, setEditingRequisition] = useState<GlobalPurchaseRequisition | null>(null);
  const [formError, setFormError] = useState('');
  const [pendingDeleteRequisitionId, setPendingDeleteRequisitionId] = useState<string | null>(null);
  const activeLocations = useMemo(
    () => locations.filter(location => location.isActive !== false),
    [locations]
  );
  const defaultLocationName = useMemo(
    () => activeLocations[0]?.name || locations[0]?.name || '',
    [activeLocations, locations]
  );
  const [form, setForm] = useState<RequisitionFormState>({
    date: toLocalDateTimeInput(),
    referenceNo: '',
    location: defaultLocationName,
    brand: '',
    category: '',
    requiredByDate: toLocalDateInput(),
    items: [],
  });

  const brandOptions = useMemo(
    () => Array.from(new Set(productBrands.map(b => b.name).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    [productBrands]
  );
  const categoryOptions = useMemo(
    () => Array.from(new Set(productCategories.map(c => c.name).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    [productCategories]
  );
  const locationOptions = useMemo(
    () => Array.from(new Set(locations.map(l => l.name).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    [locations]
  );
  const formLocationOptions = useMemo(
    () => {
      const options = Array.from(new Set(activeLocations.map(location => location.name).filter(Boolean) as string[]));
      const currentLocation = String(form.location || '').trim();
      if (currentLocation && !options.includes(currentLocation)) options.unshift(currentLocation);
      return options.sort((a, b) => a.localeCompare(b));
    },
    [activeLocations, form.location]
  );

  const buildReferenceNo = (): string => {
    const year = new Date().getFullYear();
    let maxSeq = 0;
    purchaseRequisitions.forEach(item => {
      const match = String(item.referenceNo || '').match(/(\d{4})[\/-](\d+)\s*$/);
      if (!match) return;
      if (Number(match[1]) === year) maxSeq = Math.max(maxSeq, Number(match[2]));
    });
    return `PR${year}/${String(maxSeq + 1).padStart(4, '0')}`;
  };

  const formatDateTime = (value: string): string => {
    return formatDateTimeBySettings(value, settings.dateFormat, settings.timeFormat, settings.timeZone);
  };

  const formatDateOnly = (value?: string): string => {
    return formatDateBySettings(value || '', settings.dateFormat, settings.timeZone);
  };

  const openAddModal = () => {
    setEditingRequisition(null);
    setFormError('');
    setForm({
      date: toLocalDateTimeInput(),
      referenceNo: buildReferenceNo(),
      location: defaultLocationName,
      brand: '',
      category: '',
      requiredByDate: toLocalDateInput(),
      items: [],
    });
    setIsModalOpen(true);
  };

  const openEditModal = (requisition: GlobalPurchaseRequisition) => {
    setEditingRequisition(requisition);
    setFormError('');
    setForm({
      date: toLocalDateTimeInput(requisition.date),
      referenceNo: requisition.referenceNo || '',
      location: requisition.location || defaultLocationName,
      brand: requisition.brand || '',
      category: requisition.category || '',
      requiredByDate: toLocalDateInput(requisition.requiredByDate),
      items: (requisition.items || []).map((i, idx) => ({
        rowId: `${requisition.id}-${i.productId}-${idx}`,
        productId: i.productId,
        productName: i.productName,
        alertQty: Number(i.alertQty || 0),
        requiredQty: Number(i.requiredQty || 0),
      })),
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRequisition(null);
    setFormError('');
  };

  const handleShowProducts = () => {
    if (!form.location.trim()) {
      setFormError('Business location is required before loading products.');
      return;
    }
    const selectedLocationRecord = activeLocations.find(location => location.name === form.location.trim());
    if (!selectedLocationRecord) {
      setFormError('Selected business location is inactive.');
      return;
    }
    const rows: RequisitionItemForm[] = products
      .filter(p =>
        normalizeText(p.businessLocation || '') === normalizeText(form.location || '') &&
        (!form.brand || p.brand === form.brand) &&
        (!form.category || p.category === form.category)
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p, idx) => {
        const alertQty = Number(p.alertQuantity || 0);
        const requiredQty = alertQty > 0 ? Math.max(alertQty - Number(p.stock || 0), 0) : 0;
        return { rowId: `${p.id}-${idx}`, productId: p.id, productName: p.name, alertQty, requiredQty };
      });
    setForm(prev => ({ ...prev, items: rows }));
    setFormError(rows.length === 0 ? 'No products found for selected Brand/Category/Location.' : '');
  };

  const handleUpdateRequiredQty = (rowId: string, value: string) => {
    const parsed = Number(value);
    const requiredQty = Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
    setForm(prev => ({ ...prev, items: prev.items.map(item => item.rowId === rowId ? { ...item, requiredQty } : item) }));
  };

  const handleRemoveItem = (rowId: string) => {
    setForm(prev => ({ ...prev, items: prev.items.filter(item => item.rowId !== rowId) }));
  };

  const handleSave = async () => {
    setFormError('');
    const location = form.location.trim();
    const requiredByDate = form.requiredByDate.trim();
    const referenceNo = form.referenceNo.trim() || editingRequisition?.referenceNo || buildReferenceNo();
    if (!location) return setFormError('Business location is required.');
    const selectedLocationRecord = activeLocations.find(item => item.name === location);
    if (!selectedLocationRecord) return setFormError('Selected business location is inactive.');
    if (!requiredByDate) return setFormError('Required by date is required.');
    if (form.items.length === 0) return setFormError('Add at least one product row (use "Show products").');

    const items: PurchaseRequisitionItem[] = form.items
      .map(item => ({
        productId: item.productId,
        productName: item.productName,
        alertQty: Number(item.alertQty || 0),
        requiredQty: Number(item.requiredQty || 0),
      }))
      .filter(item => item.requiredQty > 0);

    if (items.length === 0) return setFormError('Enter required quantity > 0 for at least one product.');

    const payload: GlobalPurchaseRequisition = editingRequisition
      ? {
          ...editingRequisition,
          date: form.date,
          referenceNo,
          location,
          supplier: editingRequisition.supplier && editingRequisition.supplier !== '--' ? editingRequisition.supplier : '',
          supplierId: editingRequisition.supplierId || '',
          status: editingRequisition.status || 'Pending',
          addedBy: editingRequisition.addedBy || currentUser?.name || 'Admin',
          brand: form.brand || '',
          category: form.category || '',
          requiredByDate,
          items,
          note: editingRequisition.note || '',
        }
      : {
          id: generateId('PR-'),
          date: form.date,
          referenceNo,
          location,
          supplier: '',
          supplierId: '',
          status: 'Pending',
          addedBy: currentUser?.name || 'Admin',
          brand: form.brand || '',
          category: form.category || '',
          requiredByDate,
          items,
          note: '',
        };

    const result = editingRequisition
      ? await updatePurchaseRequisition(payload)
      : await addPurchaseRequisition(payload);
    if (!result.ok) {
      setFormError(result.error || 'Unable to save purchase requisition to Postgres.');
      return;
    }
    closeModal();
  };

  const handleDelete = (id: string) => {
    if (purchaseOrders.some(order => order.purchaseRequisitionId === id)) {
      addNotification({
        title: 'Delete blocked',
        message: 'This requisition cannot be deleted because it is linked to a purchase order.',
        type: 'warning',
      });
      return;
    }
    setPendingDeleteRequisitionId(id);
  };

  const handleCreatePurchaseOrder = async (requisition: GlobalPurchaseRequisition) => {
    if (requisition.status === 'Pending') {
      const result = await updatePurchaseRequisition({ ...requisition, status: 'Approved' });
      if (!result.ok) {
        addNotification({
          title: 'Approval Failed',
          message: result.error || 'Unable to approve requisition before creating purchase order.',
          type: 'error',
        });
        return;
      }
    }
    onNavigate?.(`purchase-order/${requisition.id}`);
  };

  const filteredRequisitions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return purchaseRequisitions
      .filter(item => {
        const matchesSearch = !q ||
          item.referenceNo.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q) ||
          item.status.toLowerCase().includes(q) ||
          item.addedBy.toLowerCase().includes(q) ||
          String(item.brand || '').toLowerCase().includes(q) ||
          String(item.category || '').toLowerCase().includes(q);
        const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
        const matchesBrand = brandFilter === 'All' || (item.brand || '--') === brandFilter;
        const matchesLocation = locationFilter === 'All' || item.location === locationFilter;
        return matchesSearch && matchesStatus && matchesBrand && matchesLocation;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [purchaseRequisitions, searchTerm, statusFilter, brandFilter, locationFilter]);

  const exportRows = filteredRequisitions.map(item => ({
    date: formatDateTime(item.date),
    referenceNo: item.referenceNo,
    location: item.location,
    brand: item.brand || '--',
    category: item.category || '--',
    requiredBy: formatDateOnly(item.requiredByDate),
    itemsQty: (item.items || []).reduce((sum, row) => sum + Number(row.requiredQty || 0), 0),
    status: item.status,
    addedBy: item.addedBy,
  }));

  const download = (content: string, type: string, filename: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const headers = ['Date', 'Reference No', 'Location', 'Brand', 'Category', 'Required By', 'Items Qty', 'Status', 'Added By'];
    const rows = exportRows.map(r => [r.date, r.referenceNo, r.location, r.brand, r.category, r.requiredBy, String(r.itemsQty), r.status, r.addedBy].map(csvEscape).join(','));
    download([headers.join(','), ...rows].join('\n'), 'text/csv;charset=utf-8;', 'purchase-requisitions.csv');
  };

  const exportExcel = () => {
    const headers = ['Date', 'Reference No', 'Location', 'Brand', 'Category', 'Required By', 'Items Qty', 'Status', 'Added By'];
    const rows = exportRows.map(r => [r.date, r.referenceNo, r.location, r.brand, r.category, r.requiredBy, String(r.itemsQty), r.status, r.addedBy].map(v => String(v).replace(/\r?\n/g, ' ').replace(/\t/g, ' ')).join('\t'));
    download([headers.join('\t'), ...rows].join('\n'), 'application/vnd.ms-excel;charset=utf-8;', 'purchase-requisitions.xls');
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    let y = 44; const marginX = 40; const width = doc.internal.pageSize.getWidth() - marginX * 2;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('Purchase Requisitions Report', marginX, y); y += 20;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(`Generated: ${formatDateTimeBySettings(new Date().toISOString(), settings.dateFormat, settings.timeFormat, settings.timeZone)}`, marginX, y); y += 18;
    exportRows.forEach((r, idx) => {
      const line = `${idx + 1}. ${r.referenceNo} | ${r.date} | ${r.location} | ${r.brand} | ${r.category} | Req By: ${r.requiredBy} | Qty: ${r.itemsQty}`;
      const wrapped = doc.splitTextToSize(line, width);
      if (y + wrapped.length * 14 + 4 > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 44; }
      doc.text(wrapped, marginX, y); y += wrapped.length * 14 + 4;
    });
    doc.save('purchase-requisitions.pdf');
  };

  const handlePrint = () => {
    printDocument({
      title: 'Purchase Requisitions',
      businessName: settings?.businessName || 'ATWAR AL MUSTAQBAL',
      businessAddress: settings?.businessAddress || settings?.address || '',
      printedBy: currentUser?.name || '',
      columns: [
        { label: 'Date', width: '90px' },
        { label: 'Reference No', width: '100px' },
        { label: 'Location' },
        { label: 'Required By', width: '90px' },
        { label: 'Brand' },
        { label: 'Category' },
        { label: 'Items Qty', width: '65px', align: 'right' },
        { label: 'Status', width: '80px', align: 'center' },
      ],
      rows: exportRows.map(r => [
        r.date,
        r.referenceNo,
        r.location,
        r.requiredBy,
        r.brand,
        r.category,
        String(r.itemsQty),
        statusBadge(r.status),
      ]),
    });
  };

  const statusClass = (status: GlobalPurchaseRequisition['status']) =>
    status === 'Pending' ? 'bg-amber-100 text-amber-700' : status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700';

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ShoppingCart className="text-blue-600" size={32} /> Purchase Requisitions
          </h2>
          <p className="text-slate-500 mt-1">Manage and track purchase requisitions before ordering.</p>
        </div>
        <button onClick={openAddModal} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-900/20 flex items-center gap-2">
          <Plus size={18} /> Add Requisition
        </button>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col xl:flex-row justify-between gap-4 items-center">
            <div className="flex items-center gap-3 w-full xl:w-auto">
              <div className="relative flex-1 xl:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Search requisitions..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-xl bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm" />
              </div>
              <button onClick={() => setShowFilters(prev => !prev)} className={`p-2 border rounded-xl transition shadow-sm ${showFilters ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                <Filter size={18} />
              </button>
            </div>
            <div className="flex flex-wrap justify-center gap-2 w-full xl:w-auto">
              <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600"><FileText size={14} /> CSV</button>
              <button onClick={exportExcel} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600"><FileSpreadsheet size={14} /> Excel</button>
              <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600"><Printer size={14} /> Print</button>
              <button onClick={exportPDF} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600"><Download size={14} /> PDF</button>
            </div>
          </div>
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-200">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"><option value="All">All Statuses</option><option value="Pending">Pending</option><option value="Approved">Approved</option><option value="Ordered">Ordered</option></select>
              <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"><option value="All">All Brands</option><option value="--">--</option>{brandOptions.map(v => <option key={v} value={v}>{v}</option>)}</select>
              <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"><option value="All">All Locations</option>{locationOptions.map(v => <option key={v} value={v}>{v}</option>)}</select>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Date</th><th className="px-6 py-4">Reference No</th><th className="px-6 py-4">Location</th><th className="px-6 py-4">Brand</th><th className="px-6 py-4">Category</th><th className="px-6 py-4">Required By</th><th className="px-6 py-4 text-right">Items Qty</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Added By</th><th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequisitions.length > 0 ? filteredRequisitions.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">{formatDateTime(item.date)}</td>
                  <td className="px-6 py-4 font-bold text-slate-900">{item.referenceNo}</td>
                  <td className="px-6 py-4 text-slate-600">{item.location}</td>
                  <td className="px-6 py-4 text-slate-600">{item.brand || '--'}</td>
                  <td className="px-6 py-4 text-slate-600">{item.category || '--'}</td>
                  <td className="px-6 py-4 text-slate-600">{formatDateOnly(item.requiredByDate)}</td>
                  <td className="px-6 py-4 text-right font-bold">{(item.items || []).reduce((sum, row) => sum + Number(row.requiredQty || 0), 0).toFixed(3)}</td>
                  <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusClass(item.status)}`}>{item.status}</span></td>
                  <td className="px-6 py-4 text-slate-600">{item.addedBy}</td>
                  <td className="px-6 py-4 text-right"><div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100">
                    <button onClick={() => handleCreatePurchaseOrder(item)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded" title="Create Purchase Order">
                      <ShoppingCart size={14} />
                    </button>
                    <button onClick={() => openEditModal(item)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit size={14} /></button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                  </div></td>
                </tr>
              )) : <tr><td colSpan={10} className="px-6 py-10 text-center text-slate-400 italic">No purchase requisitions found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-7xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden mt-6">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">{editingRequisition ? 'Edit Purchase Requisition' : 'Add Purchase Requisition'}</h3>
              <button onClick={closeModal} className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="p-5 bg-slate-100 space-y-3">
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className="block text-[11px] font-bold text-slate-600 mb-1">Brand:</label><select value={form.brand} onChange={(e) => setForm(prev => ({ ...prev, brand: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-300 rounded"><option value="">All Brands</option>{brandOptions.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                  <div><label className="block text-[11px] font-bold text-slate-600 mb-1">Category:</label><select value={form.category} onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-300 rounded"><option value="">All Categories</option>{categoryOptions.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                  <div><label className="block text-[11px] font-bold text-slate-600 mb-1">Business Location:</label><select value={form.location} onChange={(e) => setForm(prev => ({ ...prev, location: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-300 rounded"><option value="">Please Select</option>{formLocationOptions.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                </div>
                <div className="mt-3 flex justify-end"><button onClick={handleShowProducts} className="px-3 py-1.5 text-xs font-bold rounded bg-amber-500 text-white hover:bg-amber-600">Show products</button></div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">Reference No <Info size={12} className="text-blue-500" /></label><input type="text" value={form.referenceNo} onChange={(e) => setForm(prev => ({ ...prev, referenceNo: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-300 rounded" /></div>
                  <div><label className="block text-[11px] font-bold text-slate-600 mb-1">Required by date:</label><input type="date" value={form.requiredByDate} onChange={(e) => setForm(prev => ({ ...prev, requiredByDate: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-300 rounded" /></div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead><tr className="bg-slate-50 text-slate-600 border-b border-slate-200"><th className="px-4 py-3 text-left">Product</th><th className="px-4 py-3 text-left">Alert quantity</th><th className="px-4 py-3 text-left">Required quantity</th><th className="px-4 py-3 w-12 text-center"></th></tr></thead>
                  <tbody>
                    {form.items.length > 0 ? form.items.map(item => (
                      <tr key={item.rowId} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3 text-slate-700">{item.productName}</td>
                        <td className="px-4 py-3 text-slate-500">{Number(item.alertQty || 0).toFixed(3)}</td>
                        <td className="px-4 py-3"><input type="number" min="0" step="0.001" value={item.requiredQty} onChange={(e) => handleUpdateRequiredQty(item.rowId, e.target.value)} className="w-full max-w-[220px] px-3 py-2 text-sm border border-slate-300 rounded" /></td>
                        <td className="px-4 py-3 text-center"><button onClick={() => handleRemoveItem(item.rowId)} className="text-rose-500 hover:text-rose-700"><Trash2 size={14} /></button></td>
                      </tr>
                    )) : <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400 italic">Click "Show products" to load products into requisition.</td></tr>}
                  </tbody>
                </table>
              </div>

              {formError && <div className="px-3 py-2 rounded border border-rose-200 bg-rose-50 text-rose-700 text-sm font-medium">{formError}</div>}
              <div className="flex justify-center pb-2"><button onClick={handleSave} className="px-8 py-2 rounded bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700">Save</button></div>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={!!pendingDeleteRequisitionId}
        title="Delete Purchase Requisition"
        message="Are you sure you want to delete this purchase requisition? This action cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        onCancel={() => setPendingDeleteRequisitionId(null)}
        onConfirm={async () => {
          if (pendingDeleteRequisitionId) {
            const result = await deletePurchaseRequisition(pendingDeleteRequisitionId);
            if (!result.ok) {
              addNotification({
                title: 'Delete Failed',
                message: result.error || 'Unable to delete purchase requisition.',
                type: 'error',
              });
              return;
            }
          }
          setPendingDeleteRequisitionId(null);
        }}
      />
    </div>
  );
};

export default PurchaseRequisition;
