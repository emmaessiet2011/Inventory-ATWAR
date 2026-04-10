import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, FileText, FileSpreadsheet, Printer, Download,
  Edit, Trash2, Filter, RotateCcw, X, Upload,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import {
  useGlobalContext,
  PurchaseReturn as GlobalPurchaseReturn,
  PurchaseReturnItem,
} from '@/context/GlobalContext';
import { printDocument, paymentBadge } from '@/utils/printUtils';
import { formatDateTimeBySettings } from '@/utils/dateTime';

interface PurchaseReturnItemForm extends PurchaseReturnItem {
  rowId: string;
}

interface PurchaseReturnFormState {
  supplierId: string;
  location: string;
  referenceNo: string;
  date: string;
  attachDocumentName: string;
  parentPurchaseId: string;
  purchaseTaxId: string;
  items: PurchaseReturnItemForm[];
}

interface PurchaseReturnProps {
  prefillPurchaseId?: string;
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

const toNumber = (value: string | number | undefined): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const toPositiveQuantity = (value: string | number | undefined): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed * 1000) / 1000);
};

const createRowId = (): string => `prt-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const formatAppDateTime = (value: string): string => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mins = String(d.getMinutes()).padStart(2, '0');
  const hrs = d.getHours();
  const ampm = hrs >= 12 ? 'PM' : 'AM';
  const h12 = String(hrs % 12 || 12).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${h12}:${mins} ${ampm}`;
};

const PurchaseReturn: React.FC<PurchaseReturnProps> = ({ prefillPurchaseId }) => {
  const {
    purchaseReturns,
    addPurchaseReturn,
    updatePurchaseReturn,
    deletePurchaseReturn,
    purchases,
    suppliers,
    products,
    locations,
    taxRates,
    currentUser,
    settings,
    formatCurrency,
    generateId,
  } = useGlobalContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReturn, setEditingReturn] = useState<GlobalPurchaseReturn | null>(null);
  const [formError, setFormError] = useState('');
  const [productSearch, setProductSearch] = useState('');

  const activeLocations = useMemo(
    () => locations.filter(location => location.isActive !== false),
    [locations]
  );
  const locationOptions = useMemo(
    () => Array.from(new Set(locations.map(l => l.name).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    [locations]
  );
  const supplierOptions = useMemo(() => {
    const activeSuppliers = suppliers
      .filter(supplier => String(supplier.status || 'Active').trim().toLowerCase() === 'active')
      .map(supplier => ({ id: supplier.id, name: supplier.businessName }));
    if (!editingReturn?.supplierId) {
      return activeSuppliers.sort((a, b) => a.name.localeCompare(b.name));
    }
    const currentSupplier = suppliers.find(supplier => supplier.id === editingReturn.supplierId);
    if (!currentSupplier) {
      return activeSuppliers.sort((a, b) => a.name.localeCompare(b.name));
    }
    const existsInActive = activeSuppliers.some(option => option.id === currentSupplier.id);
    const combined = existsInActive
      ? activeSuppliers
      : [...activeSuppliers, { id: currentSupplier.id, name: currentSupplier.businessName }];
    return combined.sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliers, editingReturn?.supplierId]);

  const buildReferenceNo = (): string => {
    const year = new Date().getFullYear();
    let maxSeq = 0;
    purchaseReturns.forEach(item => {
      const match = String(item.referenceNo || '').match(/(\d{4})[\/-](\d+)\s*$/);
      if (!match) return;
      if (Number(match[1]) === year) maxSeq = Math.max(maxSeq, Number(match[2]));
    });
    return `PRTN${year}/${String(maxSeq + 1).padStart(4, '0')}`;
  };

  const buildEmptyForm = (): PurchaseReturnFormState => ({
    supplierId: '',
    location: locationOptions[0] || '',
    referenceNo: buildReferenceNo(),
    date: toLocalDateTimeInput(),
    attachDocumentName: '',
    parentPurchaseId: '',
    purchaseTaxId: '',
    items: [],
  });

  const [form, setForm] = useState<PurchaseReturnFormState>(buildEmptyForm);
  const formLocationOptions = useMemo(
    () => {
      const options = Array.from(new Set(activeLocations.map(location => location.name).filter(Boolean) as string[]));
      const currentLocation = String(form.location || '').trim();
      if (currentLocation && !options.includes(currentLocation)) options.unshift(currentLocation);
      return options.sort((a, b) => a.localeCompare(b));
    },
    [activeLocations, form.location]
  );

  const buildRowsFromPurchase = (purchaseId: string): PurchaseReturnItemForm[] => {
    const purchase = purchases.find(item => item.id === purchaseId);
    if (!purchase?.items?.length) return [];
    return purchase.items.map((item, idx) => ({
      rowId: `${purchaseId}-${item.id}-${idx}`,
      productId: item.id,
      productName: item.name,
      lotNumber: item.lot || '',
      expDate: item.expiryDate || '',
      quantity: 0,
      unitPrice: toNumber(item.unitCost),
      subtotal: 0,
    }));
  };

  const applyParentPurchaseToForm = (purchaseId: string) => {
    const purchase = purchases.find(item => item.id === purchaseId);
    if (!purchase) return;
    const supplier = supplierOptions.find(s => s.id === purchase.supplierId) || supplierOptions.find(s => s.name === purchase.supplier);
    setForm(prev => ({
      ...prev,
      parentPurchaseId: purchase.id,
      supplierId: supplier?.id || purchase.supplierId || prev.supplierId,
      location: purchase.location || prev.location,
      items: buildRowsFromPurchase(purchase.id),
    }));
  };

  useEffect(() => {
    const purchaseId = String(prefillPurchaseId || '').trim();
    if (!purchaseId) return;
    const purchase = purchases.find(item => item.id === purchaseId);
    if (!purchase) return;
    const supplier = supplierOptions.find(s => s.id === purchase.supplierId) || supplierOptions.find(s => s.name === purchase.supplier);
    setEditingReturn(null);
    setFormError('');
    setProductSearch('');
    setForm({
      ...buildEmptyForm(),
      location: purchase.location || locationOptions[0] || '',
      parentPurchaseId: purchase.id,
      supplierId: supplier?.id || purchase.supplierId || '',
      items: buildRowsFromPurchase(purchase.id),
    });
    setIsModalOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillPurchaseId, purchases, supplierOptions, locationOptions]);

  const addItemRow = (product?: { id: string; name: string; unitPurchasePrice: number }) => {
    const row: PurchaseReturnItemForm = {
      rowId: createRowId(),
      productId: product?.id || '',
      productName: product?.name || '',
      lotNumber: '',
      expDate: '',
      quantity: 1,
      unitPrice: toNumber(product?.unitPurchasePrice || 0),
      subtotal: toNumber(product?.unitPurchasePrice || 0),
    };
    setForm(prev => ({ ...prev, items: [...prev.items, row] }));
  };

  const openAddModal = () => {
    setEditingReturn(null);
    setFormError('');
    setProductSearch('');
    setForm(buildEmptyForm());
    setIsModalOpen(true);
  };

  const openEditModal = (item: GlobalPurchaseReturn) => {
    setEditingReturn(item);
    setFormError('');
    setProductSearch('');
    setForm({
      supplierId: item.supplierId,
      location: item.location,
      referenceNo: item.referenceNo,
      date: toLocalDateTimeInput(item.date),
      attachDocumentName: item.attachDocumentName || '',
      parentPurchaseId: item.parentPurchaseId || '',
      purchaseTaxId: item.purchaseTaxId || '',
      items: item.items.map((row, idx) => ({
        rowId: `${item.id}-${row.productId}-${idx}`,
        productId: row.productId,
        productName: row.productName,
        lotNumber: row.lotNumber || '',
        expDate: row.expDate || '',
        quantity: toPositiveQuantity(row.quantity),
        unitPrice: toNumber(row.unitPrice),
        subtotal: toNumber(row.subtotal),
      })),
    });
    setIsModalOpen(true);
  };

  const handleUpdateItem = (rowId: string, key: keyof PurchaseReturnItemForm, value: string) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map(row => {
        if (row.rowId !== rowId) return row;
        const next: PurchaseReturnItemForm = { ...row, [key]: value } as PurchaseReturnItemForm;
        const qty = toPositiveQuantity(next.quantity);
        const unit = Math.max(0, toNumber(next.unitPrice));
        next.quantity = qty;
        next.unitPrice = unit;
        next.subtotal = qty * unit;
        return next;
      }),
    }));
  };

  const handleSelectProductRow = (rowId: string, productId: string) => {
    const p = products.find(prod => prod.id === productId);
    setForm(prev => ({
      ...prev,
      items: prev.items.map(row => {
        if (row.rowId !== rowId) return row;
        const unitPrice = toNumber(p?.unitPurchasePrice || 0);
        return { ...row, productId: p?.id || '', productName: p?.name || '', unitPrice, subtotal: unitPrice * toPositiveQuantity(row.quantity) };
      }),
    }));
  };

  const handleRemoveRow = (rowId: string) => {
    setForm(prev => ({ ...prev, items: prev.items.filter(row => row.rowId !== rowId) }));
  };

  const productMatches = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return [];
    return products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)).slice(0, 8);
  }, [productSearch, products]);

  const totals = useMemo(() => {
    const subTotal = form.items.reduce((sum, row) => sum + toNumber(row.subtotal), 0);
    const tax = taxRates.find(t => t.id === form.purchaseTaxId);
    const purchaseTaxAmount = tax ? subTotal * (toNumber(tax.rate) / 100) : 0;
    const grandTotal = subTotal + purchaseTaxAmount;
    return { subTotal, purchaseTaxAmount, grandTotal };
  }, [form.items, form.purchaseTaxId, taxRates]);

  const handleSave = () => {
    setFormError('');
    if (!form.supplierId.trim()) return setFormError('Supplier is required.');
    if (!form.location.trim()) return setFormError('Business location is required.');
    const selectedLocationRecord = activeLocations.find(location => location.name === form.location.trim());
    if (!selectedLocationRecord) return setFormError('Selected business location is inactive.');
    if (!form.date.trim()) return setFormError('Date is required.');
    if (form.items.length === 0) return setFormError('Add at least one product row.');

    const selectedRows = form.items.filter(row => toNumber(row.quantity) > 0);
    if (selectedRows.length === 0) return setFormError('Enter quantity > 0 for at least one row.');
    if (selectedRows.some(row => !row.productId)) return setFormError('Select a product for each returned row.');

    if (form.parentPurchaseId) {
      const parentPurchase = purchases.find(p => p.id === form.parentPurchaseId);
      if (parentPurchase?.items?.length) {
        const purchasedByProduct: Record<string, number> = {};
        parentPurchase.items.forEach(item => {
          purchasedByProduct[item.id] = (purchasedByProduct[item.id] || 0) + toNumber(item.qty);
        });

        const alreadyReturnedByProduct: Record<string, number> = {};
        purchaseReturns
          .filter(ret => ret.parentPurchaseId === form.parentPurchaseId && ret.id !== editingReturn?.id)
          .forEach(ret => {
            ret.items.forEach(item => {
              alreadyReturnedByProduct[item.productId] = (alreadyReturnedByProduct[item.productId] || 0) + toNumber(item.quantity);
            });
          });

        const requestedByProduct: Record<string, number> = {};
        selectedRows.forEach(item => {
          requestedByProduct[item.productId] = (requestedByProduct[item.productId] || 0) + toNumber(item.quantity);
        });

        const exceeds = Object.keys(requestedByProduct).find(productId => {
          const purchased = purchasedByProduct[productId] || 0;
          const alreadyReturned = alreadyReturnedByProduct[productId] || 0;
          const available = Math.max(0, purchased - alreadyReturned);
          return requestedByProduct[productId] > available + 0.0001;
        });
        if (exceeds) {
          const productName = products.find(p => p.id === exceeds)?.name || exceeds;
          return setFormError(`Return quantity exceeds available quantity for "${productName}".`);
        }
      }
    }

    const supplier = supplierOptions.find(s => s.id === form.supplierId);
    const purchase = purchases.find(p => p.id === form.parentPurchaseId);
    const tax = taxRates.find(t => t.id === form.purchaseTaxId);
    const paymentDue = totals.grandTotal;
    const paymentStatus: GlobalPurchaseReturn['paymentStatus'] = paymentDue <= 0.001 ? 'Paid' : 'Due';

    const payload: GlobalPurchaseReturn = {
      id: editingReturn?.id || generateId('PRTN-'),
      date: form.date,
      referenceNo: form.referenceNo.trim() || editingReturn?.referenceNo || buildReferenceNo(),
      supplierId: form.supplierId,
      supplierName: supplier?.name || editingReturn?.supplierName || '',
      location: form.location,
      attachDocumentName: form.attachDocumentName || '',
      parentPurchaseId: form.parentPurchaseId || '',
      parentPurchaseRef: purchase?.refNo || '',
      items: selectedRows.map(row => ({
        productId: row.productId,
        productName: row.productName,
        lotNumber: row.lotNumber || '',
        expDate: row.expDate || '',
        quantity: toPositiveQuantity(row.quantity),
        unitPrice: toNumber(row.unitPrice),
        subtotal: toNumber(row.subtotal),
      })),
      purchaseTaxId: form.purchaseTaxId || '',
      purchaseTaxName: tax?.name || 'None',
      purchaseTaxAmount: totals.purchaseTaxAmount,
      subTotal: totals.subTotal,
      grandTotal: totals.grandTotal,
      paymentStatus,
      paymentDue,
      addedBy: editingReturn?.addedBy || currentUser?.name || 'Admin',
    };

    if (editingReturn) updatePurchaseReturn(payload);
    else addPurchaseReturn(payload);
    setIsModalOpen(false);
  };

  const filteredReturns = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
    return purchaseReturns
      .filter(item => {
        const matchesSearch = !q ||
          item.referenceNo.toLowerCase().includes(q) ||
          item.supplierName.toLowerCase().includes(q) ||
          item.parentPurchaseRef?.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q);
        const matchesLocation = locationFilter === 'All' || item.location === locationFilter;
        const dateMs = new Date(item.date).getTime();
        const matchesDate = Number.isNaN(dateMs) ? true : (dateMs >= fromMs && dateMs <= toMs);
        return matchesSearch && matchesLocation && matchesDate;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [purchaseReturns, searchTerm, locationFilter, dateFrom, dateTo]);

  const exportRows = filteredReturns.map(r => ({
    date: formatAppDateTime(r.date),
    referenceNo: r.referenceNo,
    parentPurchase: r.parentPurchaseRef || '--',
    location: r.location,
    supplier: r.supplierName,
    paymentStatus: r.paymentStatus,
    grandTotal: r.grandTotal.toFixed(3),
    paymentDue: r.paymentDue.toFixed(3),
  }));

  const download = (content: string, type: string, filename: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const headers = ['Date', 'Reference No', 'Parent Purchase', 'Location', 'Supplier', 'Payment Status', 'Grand Total', 'Payment due'];
    const rows = exportRows.map(r => [r.date, r.referenceNo, r.parentPurchase, r.location, r.supplier, r.paymentStatus, r.grandTotal, r.paymentDue].map(csvEscape).join(','));
    download([headers.join(','), ...rows].join('\n'), 'text/csv;charset=utf-8;', 'purchase-returns.csv');
  };

  const exportExcel = () => {
    const headers = ['Date', 'Reference No', 'Parent Purchase', 'Location', 'Supplier', 'Payment Status', 'Grand Total', 'Payment due'];
    const rows = exportRows.map(r => [r.date, r.referenceNo, r.parentPurchase, r.location, r.supplier, r.paymentStatus, r.grandTotal, r.paymentDue].join('\t'));
    download([headers.join('\t'), ...rows].join('\n'), 'application/vnd.ms-excel;charset=utf-8;', 'purchase-returns.xls');
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('Purchase Returns', 40, 42);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(`Generated: ${formatDateTimeBySettings(new Date().toISOString(), settings.dateFormat, settings.timeFormat, settings.timeZone)}`, 40, 58);
    let y = 78;
    exportRows.forEach((r, i) => {
      const line = `${i + 1}. ${r.referenceNo} | ${r.date} | ${r.supplier} | ${r.grandTotal}`;
      if (y > 780) { doc.addPage(); y = 42; }
      doc.text(line, 40, y); y += 14;
    });
    doc.save('purchase-returns.pdf');
  };

  const handlePrint = () => {
    printDocument({
      title: 'Purchase Returns',
      businessName: settings?.businessName || 'ATWAR AL MUSTAQBAL',
      businessAddress: settings?.businessAddress || settings?.address || '',
      printedBy: currentUser?.name || '',
      columns: [
        { label: 'Date', width: '90px' },
        { label: 'Reference No', width: '100px' },
        { label: 'Parent Purchase', width: '100px' },
        { label: 'Supplier' },
        { label: 'Location' },
        { label: 'Payment Status', width: '90px', align: 'center' },
        { label: 'Grand Total', width: '90px', align: 'right' },
        { label: 'Amount Due', width: '90px', align: 'right' },
      ],
      rows: exportRows.map(r => [
        r.date,
        r.referenceNo,
        r.parentPurchase,
        r.supplier,
        r.location,
        paymentBadge(r.paymentStatus),
        r.grandTotal,
        r.paymentDue,
      ]),
    });
  };

  const totalGrand = filteredReturns.reduce((sum, row) => sum + toNumber(row.grandTotal), 0);
  const totalDue = filteredReturns.reduce((sum, row) => sum + toNumber(row.paymentDue), 0);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <RotateCcw className="text-rose-600" size={32} /> Purchase Return
        </h2>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        <div className="text-[#0ea5e9] text-sm font-bold mb-3 flex items-center gap-2"><Filter size={16} /> Filters</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Business Location:</label>
            <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm">
              <option value="All">All</option>
              {locationOptions.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Date Range:</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="p-5 border-b border-slate-100 flex flex-col xl:flex-row justify-between gap-4 xl:items-center">
          <div className="text-sm font-bold text-slate-700">All Purchase Returns</div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={exportCSV} className="px-3 py-2 border border-slate-200 rounded text-xs font-bold flex items-center gap-1"><FileText size={14} /> Export CSV</button>
            <button onClick={exportExcel} className="px-3 py-2 border border-slate-200 rounded text-xs font-bold flex items-center gap-1"><FileSpreadsheet size={14} /> Export Excel</button>
            <button onClick={handlePrint} className="px-3 py-2 border border-slate-200 rounded text-xs font-bold flex items-center gap-1"><Printer size={14} /> Print</button>
            <button onClick={exportPDF} className="px-3 py-2 border border-slate-200 rounded text-xs font-bold flex items-center gap-1"><Download size={14} /> Export PDF</button>
            <button onClick={openAddModal} className="ml-2 bg-indigo-600 text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-indigo-700 flex items-center gap-1"><Plus size={14} /> Add</button>
          </div>
        </div>

        <div className="p-4 border-b border-slate-100 flex justify-end">
          <div className="relative w-full xl:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Search ..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded text-sm" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Reference No</th><th className="px-4 py-3 text-left">Parent Purchase</th><th className="px-4 py-3 text-left">Location</th><th className="px-4 py-3 text-left">Supplier</th><th className="px-4 py-3 text-left">Payment Status</th><th className="px-4 py-3 text-right">Grand Total</th><th className="px-4 py-3 text-right">Payment due</th><th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReturns.length > 0 ? filteredReturns.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">{formatAppDateTime(item.date)}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">{item.referenceNo}</td>
                  <td className="px-4 py-3">{item.parentPurchaseRef || '--'}</td>
                  <td className="px-4 py-3">{item.location}</td>
                  <td className="px-4 py-3">{item.supplierName}</td>
                  <td className="px-4 py-3">{item.paymentStatus}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatCurrency(item.grandTotal)}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatCurrency(item.paymentDue)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEditModal(item)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit size={14} /></button>
                      <button onClick={() => { if (confirm('Delete this purchase return?')) deletePurchaseReturn(item.id); }} className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              )) : <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400 italic">No data available in table</td></tr>}
              <tr className="bg-slate-100 font-bold">
                <td colSpan={6} className="px-4 py-3 text-right">Total:</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totalGrand)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totalDue)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-[1900px] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden mt-5">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">{editingReturn ? 'Edit Purchase Return' : 'Add Purchase Return'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="p-4 bg-slate-100 space-y-3">
              <div className="bg-white rounded-lg border border-slate-200 p-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div><label className="block text-[11px] font-bold mb-1">Supplier:<span className="text-rose-500">*</span></label><select value={form.supplierId} onChange={(e) => setForm(prev => ({ ...prev, supplierId: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded text-sm"><option value="">Please Select</option>{supplierOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                <div><label className="block text-[11px] font-bold mb-1">Business Location:<span className="text-rose-500">*</span></label><select value={form.location} onChange={(e) => setForm(prev => ({ ...prev, location: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded text-sm"><option value="">Please Select</option>{formLocationOptions.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
                <div><label className="block text-[11px] font-bold mb-1">Reference No:</label><input type="text" value={form.referenceNo} onChange={(e) => setForm(prev => ({ ...prev, referenceNo: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" /></div>
                <div><label className="block text-[11px] font-bold mb-1">Date:<span className="text-rose-500">*</span></label><input type="datetime-local" value={form.date} onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" /></div>
                <div><label className="block text-[11px] font-bold mb-1">Parent Purchase:</label><select value={form.parentPurchaseId} onChange={(e) => { const next = e.target.value; if (!next) setForm(prev => ({ ...prev, parentPurchaseId: '', items: [] })); else applyParentPurchaseToForm(next); }} className="w-full px-3 py-2 border border-slate-300 rounded text-sm"><option value="">Select purchase</option>{purchases.filter(p => !form.supplierId || p.supplierId === form.supplierId || p.supplier === supplierOptions.find(s => s.id === form.supplierId)?.name).map(p => <option key={p.id} value={p.id}>{p.refNo}</option>)}</select></div>
                <div className="lg:col-span-3"><label className="block text-[11px] font-bold mb-1">Attach Document:</label><label className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white flex items-center justify-between cursor-pointer"><span className="truncate text-slate-500">{form.attachDocumentName || 'Browse...'}</span><span className="text-blue-600 flex items-center gap-1"><Upload size={12} /> Browse</span><input type="file" className="hidden" onChange={(e) => setForm(prev => ({ ...prev, attachDocumentName: e.target.files?.[0]?.name || '' }))} /></label></div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <h4 className="text-xl text-slate-700 mb-3">Search Products</h4>
                <div className="relative max-w-4xl mx-auto">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded text-sm" placeholder="Search Products" />
                  {productSearch.trim() && productMatches.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow max-h-52 overflow-y-auto">
                      {productMatches.map(p => <button key={p.id} type="button" onClick={() => { addItemRow({ id: p.id, name: p.name, unitPurchasePrice: toNumber(p.unitPurchasePrice) }); setProductSearch(''); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs border-b border-slate-100"><div className="font-bold">{p.name}</div><div className="text-slate-500">SKU: {p.sku}</div></button>)}
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-slate-50 border border-slate-200"><tr><th className="px-3 py-2">Product</th><th className="px-3 py-2">Lot Number</th><th className="px-3 py-2">EXP Date</th><th className="px-3 py-2">Quantity</th><th className="px-3 py-2">Unit Price</th><th className="px-3 py-2">Subtotal</th><th className="px-3 py-2 w-10"></th></tr></thead>
                    <tbody className="border border-slate-200 border-t-0">
                      {form.items.length > 0 ? form.items.map(row => (
                        <tr key={row.rowId} className="border-b border-slate-100">
                          <td className="px-2 py-2"><select value={row.productId} onChange={(e) => handleSelectProductRow(row.rowId, e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded text-sm"><option value="">Select product</option>{products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}</select></td>
                          <td className="px-2 py-2"><input value={row.lotNumber || ''} onChange={(e) => handleUpdateItem(row.rowId, 'lotNumber', e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded text-sm" /></td>
                          <td className="px-2 py-2"><input type="date" value={row.expDate || ''} onChange={(e) => handleUpdateItem(row.rowId, 'expDate', e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded text-sm" /></td>
                          <td className="px-2 py-2"><input type="number" min="0" step="0.001" value={row.quantity} onChange={(e) => handleUpdateItem(row.rowId, 'quantity', e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-center" /></td>
                          <td className="px-2 py-2"><input type="number" min="0" step="0.001" value={row.unitPrice} onChange={(e) => handleUpdateItem(row.rowId, 'unitPrice', e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-right" /></td>
                          <td className="px-2 py-2 text-right font-bold">{toNumber(row.subtotal).toFixed(3)}</td>
                          <td className="px-2 py-2 text-center"><button type="button" onClick={() => handleRemoveRow(row.rowId)} className="text-rose-500 hover:text-rose-700"><Trash2 size={14} /></button></td>
                        </tr>
                      )) : <tr><td colSpan={7} className="px-3 py-5 text-center text-slate-400 italic">No products added yet.</td></tr>}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4 items-end">
                  <div><label className="block text-[11px] font-bold mb-1">Purchase Tax:</label><select value={form.purchaseTaxId} onChange={(e) => setForm(prev => ({ ...prev, purchaseTaxId: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded text-sm"><option value="">None</option>{taxRates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>)}</select></div>
                  <div className="text-right font-black text-xl text-slate-900">Total Amount: <span>{formatCurrency(totals.grandTotal)}</span></div>
                </div>
              </div>

              {formError && <div className="px-3 py-2 rounded border border-rose-200 bg-rose-50 text-rose-700 text-sm font-medium">{formError}</div>}
              <div className="flex justify-center pb-2"><button onClick={handleSave} className="px-8 py-2 rounded bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700">Submit</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseReturn;
