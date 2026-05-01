import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, User, MapPin, Phone, FileText, ShoppingBag, BarChart3, StickyNote,
  CreditCard, Activity, Plus, Eye, Edit, Trash2, ChevronDown, Printer, Mail, Tag, Hash,
  Receipt, Truck
} from 'lucide-react';
import AddDiscountModal from '@/components/pricing/AddDiscountModal';
import { useGlobalContext } from '@/context/GlobalContext';
import {
  clampPrecision,
  normalizePrefix,
  toDateTimeLocalInput,
  toFixedPrecision,
} from '@/utils/paymentUtils';
import { resolveDefaultAccountFromMethod } from '@/utils/paymentAccounts';
import { printDocument } from '@/utils/printUtils';
import { formatDateBySettings } from '@/utils/dateTime';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { useNotifications } from '@/context/NotificationContext';

interface ViewSupplierProps {
  onNavigate: (page: string) => void;
  contactId?: string;
  initialTab?: string;
}

interface SupplierPaymentForm {
  amount: string;
  method: string;
  account: string;
  date: string;
  note: string;
  attachmentName?: string;
}

const ViewSupplier: React.FC<ViewSupplierProps> = ({ onNavigate, contactId, initialTab }) => {
  const {
    suppliers,
    purchases,
    payments,
    products,
    sales,
    locations,
    settings,
    currentUser,
    addPayment: globalAddPayment,
    updatePayment: globalUpdatePayment,
    deletePayment: globalDeletePayment,
    updateSupplier: globalUpdateSupplier,
    formatCurrency,
    addDiscount: globalAddDiscount,
    generateId,
  } = useGlobalContext();
  const { addNotification } = useNotifications();
  const currencyPrecision = clampPrecision(Number(settings.currencyPrecision ?? 3));

  const year = new Date().getFullYear();
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(contactId || '');
  const [activeTab, setActiveTab] = useState(initialTab === 'add-payment' ? 'payments' : (initialTab || 'ledger'));
  const [dateFrom, setDateFrom] = useState(`${year}-01-01`);
  const [dateTo, setDateTo] = useState(`${year}-12-31`);
  const [ledgerFormat, setLedgerFormat] = useState(1);
  const [locationFilter, setLocationFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(initialTab === 'add-payment');
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [viewPaymentId, setViewPaymentId] = useState<string | null>(null);
  const [editPaymentId, setEditPaymentId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState<SupplierPaymentForm>({
    amount: '',
    method: 'Cash',
    account: resolveDefaultAccountFromMethod('Cash'),
    date: new Date().toISOString().slice(0, 16),
    note: '',
  });
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [newDocHeading, setNewDocHeading] = useState('');
  const [pendingDeletePaymentId, setPendingDeletePaymentId] = useState<string | null>(null);
  const [pendingDeleteDocId, setPendingDeleteDocId] = useState<string | null>(null);
  const paymentAccountOptions = useMemo(
    () => ['Cash Account', 'Bank Account'],
    []
  );

  const supplier = useMemo(() => {
    const id = selectedSupplierId || contactId;
    if (id) {
      const found = suppliers.find(s => s.id === id);
      if (found) return found;
    }
    return suppliers[0] || null;
  }, [suppliers, selectedSupplierId, contactId]);

  useEffect(() => {
    if (!supplier) return;
    setDateFrom(`${year}-01-01`);
    setDateTo(`${year}-12-31`);
    setLocationFilter('');
    setPaymentForm({
      amount: '',
      method: 'Cash',
      account: resolveDefaultAccountFromMethod('Cash'),
      date: new Date().toISOString().slice(0, 16),
      note: '',
      attachmentName: undefined,
    });
  }, [supplier?.id, year]);

  useEffect(() => {
    if (initialTab === 'add-payment') {
      setActiveTab('payments');
      setIsPaymentModalOpen(true);
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (isPaymentModalOpen && supplier && !paymentForm.amount) {
      const due = supplier.totalPurchaseDue;
      if (due > 0) {
        setPaymentForm(prev => ({ ...prev, amount: due.toFixed(currencyPrecision) }));
      }
    }
  }, [isPaymentModalOpen, supplier, paymentForm.amount, currencyPrecision]);

  useEffect(() => {
    const resolved = resolveDefaultAccountFromMethod(paymentForm.method || 'Cash');
    setPaymentForm(prev => (prev.account === resolved ? prev : { ...prev, account: resolved }));
  }, [paymentForm.method]);

  const supplierPurchases = useMemo(() => {
    if (!supplier) return [];
    return purchases
      .filter(p => p.supplierId === supplier.id || p.supplier === supplier.businessName)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [purchases, supplier]);

  const supplierPayments = useMemo(() => {
    if (!supplier) return [];
    return payments
      .filter(p => p.contactType === 'Supplier' && (p.contactId === supplier.id || p.contactName === supplier.businessName))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [payments, supplier]);

  const purchaseTotal = supplierPurchases.reduce((acc, p) => acc + (p.grandTotal || 0), 0);
  const paidTotal = supplierPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
  const balanceDue = supplier?.totalPurchaseDue ?? 0;

  const allLedgerRows = useMemo(() => {
    const rows = [
      ...supplierPurchases.map(p => ({
        id: `PUR-${p.id}`,
        date: p.date,
        ref: p.refNo,
        type: 'Purchase',
        location: p.location || '',
        paymentStatus: p.paymentStatus || '',
        debit: p.grandTotal || 0,
        credit: 0,
        method: p.paymentMethod || '',
        note: p.status || '',
        items: (p.items || []).map((item: any, idx: number) => ({
          id: idx + 1,
          name: item.name,
          qty: item.qty,
          unit: item.unit || 'Pc(s)',
          unitPrice: item.unitPrice || item.price || 0,
          discount: item.discount || 0,
          tax: item.tax || 0,
          subtotal: item.subtotal || 0,
        })),
      })),
      ...supplierPayments.map(pay => ({
        id: `PAY-${pay.id}`,
        date: pay.date,
        ref: pay.referenceNo,
        type: 'Payment',
        location: pay.contactName || supplier?.businessName || '',
        paymentStatus: '',
        debit: 0,
        credit: pay.amount || 0,
        method: pay.method,
        note: Array.isArray(pay.linkedInvoices) && pay.linkedInvoices.filter(Boolean).length > 0
          ? `Payment For: ${pay.linkedInvoices.filter(Boolean).join(', ')}`
          : (pay.note || ''),
        items: [] as any[],
      })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return rows;
  }, [supplierPurchases, supplierPayments]);

  const ledgerRows = useMemo(() => {
    const fromTime = new Date(dateFrom).getTime();
    const toTime = new Date(dateTo + 'T23:59:59').getTime();
    return allLedgerRows.filter(row => {
      const rowTime = new Date(row.date).getTime();
      const inRange = rowTime >= fromTime && rowTime <= toTime;
      // Payments always pass location filter (same as Customer ledger behavior)
      const inLocation = !locationFilter || row.type === 'Payment' || row.location === locationFilter;
      return inRange && inLocation;
    });
  }, [allLedgerRows, dateFrom, dateTo, locationFilter]);

  const ledgerRowsWithBalance = useMemo(() => {
    let running = 0;
    return ledgerRows.map(r => {
      running += (r.debit - r.credit);
      return { ...r, balance: running };
    });
  }, [ledgerRows]);

  const rangedPurchaseTotal = ledgerRows.filter(r => r.type === 'Purchase').reduce((acc, r) => acc + r.debit, 0);
  const rangedPaidTotal = ledgerRows.filter(r => r.type === 'Payment').reduce((acc, r) => acc + r.credit, 0);
  const totalDebit = ledgerRows.reduce((acc, r) => acc + r.debit, 0);
  const totalCredit = ledgerRows.reduce((acc, r) => acc + r.credit, 0);
  const runningBalance = ledgerRowsWithBalance.length > 0 ? ledgerRowsWithBalance[ledgerRowsWithBalance.length - 1].balance : 0;

  const stockRows = useMemo(() => {
    const purchasedByProduct = new Map<string, number>();
    supplierPurchases.forEach(purchase => {
      (purchase.items || []).forEach(item => {
        const key = String(item.id || item.name);
        purchasedByProduct.set(key, (purchasedByProduct.get(key) || 0) + (item.qty || 0));
      });
    });
    const soldByProduct = new Map<string, number>();
    sales.forEach(sale => {
      (sale.items || []).forEach(item => {
        const key = String(item.id || item.name);
        soldByProduct.set(key, (soldByProduct.get(key) || 0) + (item.qty || 0));
      });
    });
    return Array.from(purchasedByProduct.entries()).map(([key, purchased]) => {
      const product = products.find(p => p.id === key || p.sku === key || p.name === key);
      const sold = soldByProduct.get(key) || 0;
      const currentStock = product?.stock || 0;
      const unitPrice = product?.unitPurchasePrice || 0;
      return { key, product: product?.name || key, sku: product?.sku || key, purchased, sold, currentStock, stockValue: currentStock * unitPrice };
    });
  }, [supplierPurchases, products, sales]);

  const activities = useMemo(() => {
    return [
      ...supplierPurchases.map(p => ({ id: `AP-${p.id}`, date: p.date, action: 'Purchase Added', by: p.addedBy || '-', note: p.refNo })),
      ...supplierPayments.map(p => ({ id: `AY-${p.id}`, date: p.date, action: 'Payment Recorded', by: p.addedBy || '-', note: p.referenceNo })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [supplierPurchases, supplierPayments]);

  const filteredPayments = supplierPayments.filter(pay =>
    `${pay.referenceNo} ${pay.note} ${pay.method}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedViewPayment = supplierPayments.find(p => p.id === viewPaymentId) || null;
  const selectedEditPayment = supplierPayments.find(p => p.id === editPaymentId) || null;

  const formatDateDisplay = (dateStr: string) => {
    return formatDateBySettings(dateStr || '', settings.dateFormat, settings.timeZone);
  };

  const getContactLabel = (s: any) => {
    const digits = s.id.replace(/\D/g, '');
    const suffix = digits.length >= 3 ? digits.slice(-3) : s.id.slice(-3);
    return `- ${s.businessName}(${suffix})`;
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      amount: '',
      method: 'Cash',
      account: resolveDefaultAccountFromMethod('Cash'),
      date: new Date().toISOString().slice(0, 16),
      note: '',
    });
  };

  const handleSaveSupplierPayment = async () => {
    if (!supplier) return;
    const amount = parseFloat(paymentForm.amount);
    if (Number.isNaN(amount) || amount <= 0) return;
    const roundedAmount = Number(toFixedPrecision(amount, currencyPrecision));
    const paymentPrefix = normalizePrefix(settings.purchasePaymentPrefix || settings.paymentPrefix, 'PP');
    const result = await globalAddPayment({
      id: `PAY-SUP-${Date.now()}`,
      date: paymentForm.date || new Date().toISOString().slice(0, 16),
      contactId: supplier.id,
      contactName: supplier.businessName,
      contactType: 'Supplier',
      amount: roundedAmount,
      method: paymentForm.method,
      account: String(paymentForm.account || '').trim() || resolveDefaultAccountFromMethod(paymentForm.method || 'Cash'),
      location: supplierPurchases[0]?.location || '',
      referenceNo: `${paymentPrefix}-${Date.now().toString().slice(-6)}`,
      note: paymentForm.note,
      type: 'sent',
      addedBy: currentUser?.name || 'Admin',
      attachmentName: paymentForm.attachmentName || undefined,
    });
    if (!result.ok) {
      addNotification({
        title: 'Payment Save Failed',
        message: result.error || `Payment for ${supplier.businessName} could not be saved to Postgres.`,
        type: 'error',
      });
      return;
    }
    addNotification({
      title: 'Payment Recorded',
      message: `Payment of ${formatCurrency(roundedAmount)} recorded for ${supplier.businessName}.`,
      type: 'success',
    });
    setIsPaymentModalOpen(false);
    resetPaymentForm();
  };

  const openEditPayment = (paymentId: string) => {
    const pay = supplierPayments.find(p => p.id === paymentId);
    if (!pay) return;
    setPaymentForm({
      amount: toFixedPrecision(pay.amount || 0, currencyPrecision),
      method: pay.method || 'Cash',
      account: resolveDefaultAccountFromMethod(pay.method || 'Cash'),
      date: toDateTimeLocalInput(pay.date),
      note: pay.note || '',
    });
    setEditPaymentId(paymentId);
  };

  const handleUpdatePayment = async () => {
    if (!selectedEditPayment) return;
    const amount = parseFloat(paymentForm.amount);
    if (Number.isNaN(amount) || amount <= 0) return;
    const roundedAmount = Number(toFixedPrecision(amount, currencyPrecision));
    const result = await globalUpdatePayment({
      ...selectedEditPayment,
      amount: roundedAmount,
      method: paymentForm.method,
      account: String(paymentForm.account || '').trim() || resolveDefaultAccountFromMethod(paymentForm.method || 'Cash'),
      date: paymentForm.date || selectedEditPayment.date,
      note: paymentForm.note,
    });
    if (!result.ok) {
      addNotification({
        title: 'Payment Update Failed',
        message: result.error || 'Supplier payment could not be saved to Postgres.',
        type: 'error',
      });
      return;
    }
    addNotification({
      title: 'Payment Updated',
      message: `${selectedEditPayment.referenceNo || 'Payment'} was updated successfully.`,
      type: 'success',
    });
    setEditPaymentId(null);
    resetPaymentForm();
  };

  const handleDeletePayment = (id: string) => {
    setPendingDeletePaymentId(id);
  };

  const handlePrintLedger = () => {
    if (!supplier) return;
    printDocument({
      title: `Supplier Ledger - ${supplier.businessName || supplier.name}`,
      subtitle: `Date: ${dateFrom} - ${dateTo} | Location: ${locationFilter || 'All locations'}`,
      businessName: settings.businessName || 'ATWAR AL MUSTAQBAL',
      businessAddress: settings.businessAddress || settings.address || '',
      printedBy: currentUser?.name || currentUser?.username || '',
      columns: [
        { label: 'Date', width: '95px' },
        { label: 'Type', width: '80px' },
        { label: 'Ref', width: '110px' },
        { label: 'Method', width: '80px' },
        { label: 'Debit', width: '95px', align: 'right' },
        { label: 'Credit', width: '95px', align: 'right' },
        { label: 'Balance', width: '95px', align: 'right' },
        { label: 'Note' },
      ],
      rows: ledgerRowsWithBalance.map(row => [
        formatDateDisplay(row.date),
        row.type || '--',
        row.ref || '--',
        row.method || '--',
        formatCurrency(Number(row.debit || 0)),
        formatCurrency(Number(row.credit || 0)),
        formatCurrency(Number((row as any).balance || 0)),
        row.note || '--',
      ]),
      stats: [
        { label: 'By Filter Total Purchase', value: formatCurrency(rangedPurchaseTotal), color: 'blue' },
        { label: 'By Filter Total Paid', value: formatCurrency(rangedPaidTotal), color: 'green' },
        { label: 'By Filter Balance Due', value: formatCurrency(Math.max(0, rangedPurchaseTotal - rangedPaidTotal)), color: 'rose' },
        { label: 'Overall Balance Due', value: formatCurrency(balanceDue), color: 'amber' },
      ],
    });
  };

  const handleSaveDoc = async () => {
    if (!supplier || !newDocHeading.trim()) return;
    const docs = supplier.documents ? [...supplier.documents] : [];
    if (editingDocId) {
      const idx = docs.findIndex(d => d.id === editingDocId);
      if (idx !== -1) docs[idx] = { ...docs[idx], heading: newDocHeading.trim(), updatedAt: new Date().toISOString() };
    } else {
      docs.push({ id: `doc_${Date.now()}`, heading: newDocHeading.trim(), addedBy: currentUser?.name || 'Admin', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    const result = await globalUpdateSupplier({ ...supplier, documents: docs });
    if (!result.ok) {
      addNotification({
        title: 'Document Save Failed',
        message: result.error || 'Supplier document could not be saved to Postgres.',
        type: 'error',
      });
      return;
    }
    setIsDocModalOpen(false);
    setEditingDocId(null);
    setNewDocHeading('');
  };

  const handleDeleteDoc = (docId: string) => {
    if (!supplier) return;
    setPendingDeleteDocId(docId);
  };

  if (!supplier) {
    return <div className="p-10 text-center text-slate-500">No suppliers available.</div>;
  }

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('suppliers')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-2xl shadow-md">
              <Truck size={20} className="text-white" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">View Supplier</h2>
          </div>
        </div>
        {/* Contact Selector */}
        <div className="relative min-w-[220px]">
          <select
            className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded text-sm text-slate-700 bg-white appearance-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={selectedSupplierId || supplier.id}
            onChange={e => setSelectedSupplierId(e.target.value)}
          >
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{getContactLabel(s)}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
        </div>
      </div>

      {/* Contact Info Card */}
      <div className="bg-white border border-slate-200 rounded shadow-sm">
        <div className="p-5 flex flex-col md:flex-row justify-between gap-5">
          {/* Left: contact details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <User size={15} className="text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-800">{supplier.name || supplier.businessName}</span>
              <span className="ml-1 text-[10px] font-bold uppercase bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Supplier</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-slate-400 shrink-0" />
              <span className="text-slate-600">{supplier.address || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Hash size={15} className="text-slate-400 shrink-0" />
              <span className="text-slate-500 text-xs">Tax No:</span>
              <span className="text-slate-600">{supplier.taxNumber || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Tag size={15} className="text-slate-400 shrink-0" />
              <span className="text-slate-500 text-xs">Business:</span>
              <span className="text-slate-600">{supplier.businessName || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={15} className="text-slate-400 shrink-0" />
              <span className="text-slate-600">{supplier.mobile || '—'}</span>
            </div>
          </div>
          {/* Right: action buttons */}
          <div className="flex gap-3 shrink-0 items-start">
            <button
              onClick={() => { setPaymentForm(prev => ({ ...prev, amount: balanceDue.toFixed(currencyPrecision), date: new Date().toISOString().slice(0, 16) })); setIsPaymentModalOpen(true); }}
              className="bg-emerald-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-emerald-700 transition shadow-sm flex items-center gap-2"
            >
              <CreditCard size={15} /> Pay
            </button>
            <button
              onClick={() => setIsDiscountModalOpen(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-blue-700 transition shadow-sm"
            >
              Add Discount
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 bg-white rounded-t overflow-hidden shadow-sm">
        {[
          { id: 'ledger', label: 'Ledger', icon: FileText },
          { id: 'purchases', label: 'Purchases', icon: ShoppingBag },
          { id: 'stock', label: 'Stock Report', icon: BarChart3 },
          { id: 'docs', label: 'Documents & Note', icon: StickyNote },
          { id: 'payments', label: 'Payments', icon: CreditCard },
          { id: 'activities', label: 'Activities', icon: Activity },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── LEDGER TAB ── */}
      {activeTab === 'ledger' && (
        <div className="bg-white border border-t-0 border-slate-200 rounded-b shadow-sm">
          {/* Filter row */}
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="px-2 py-1.5 border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <span className="text-slate-400 text-xs">—</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="px-2 py-1.5 border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-bold text-slate-700">Ledger format:</span>
              <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                {[1, 2, 3].map(f => (
                  <button
                    key={f}
                    onClick={() => setLedgerFormat(f)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      ledgerFormat === f ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Format {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <select
                value={locationFilter}
                onChange={e => setLocationFilter(e.target.value)}
                className="pl-3 pr-7 py-1.5 border border-slate-300 rounded text-xs text-slate-700 bg-white appearance-none focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">All Business Locations</option>
                {(locations || []).map((loc: any) => (
                  <option key={loc.id} value={loc.name}>{loc.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={13} />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={handlePrintLedger} className="p-1.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition" title="Print / Save as PDF">
                <Printer size={15} />
              </button>
              <button
                onClick={() => supplier && window.open(`mailto:${supplier.email || ''}?subject=Account Statement - ${supplier.businessName || supplier.name}&body=Dear ${supplier.businessName || supplier.name},%0A%0APlease find your account statement below.%0A%0ATotal Purchase: ${formatCurrency(purchaseTotal)}%0ATotal Paid: ${formatCurrency(paidTotal)}%0ABalance Due: ${formatCurrency(balanceDue)}%0A%0ARegards`)}
                className="p-1.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
                title="Email ledger"
              >
                <Mail size={15} />
              </button>
            </div>
          </div>

          {/* Two-panel summary */}
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left "To:" panel */}
            <div className="border border-slate-200 rounded overflow-hidden">
              <div className="bg-blue-700 text-white px-4 py-2 text-sm font-bold">To:</div>
              <div className="p-4 text-sm space-y-1">
                <p className="font-bold text-slate-800">{supplier.businessName || supplier.name}</p>
                {supplier.address && <p className="text-slate-600">{supplier.address}</p>}
                {supplier.taxNumber && <p className="text-slate-500 text-xs">Tax No: {supplier.taxNumber}</p>}
                {supplier.mobile && (
                  <p className="text-slate-600 flex items-center gap-1">
                    <Phone size={12} className="text-slate-400" /> {supplier.mobile}
                  </p>
                )}
              </div>
            </div>

            {/* Right "Account Summary" panel */}
            <div className="border border-slate-200 rounded overflow-hidden">
              <div className="bg-teal-700 text-white px-4 py-2 text-sm font-bold">Account Summary</div>
              {/* Date range section */}
              <div className="border-b border-slate-100">
                <div className="bg-teal-50 px-4 py-1.5 text-xs font-bold text-teal-800 border-b border-slate-100">
                  {formatDateDisplay(dateFrom)} — {formatDateDisplay(dateTo)}
                </div>
                <div className="px-4 py-2 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Purchase:</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(rangedPurchaseTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total paid:</span>
                    <span className="font-semibold text-emerald-700">{formatCurrency(rangedPaidTotal)}</span>
                  </div>
                </div>
              </div>
              {/* Overall summary section */}
              <div>
                <div className="bg-teal-50 px-4 py-1.5 text-xs font-bold text-teal-800 border-b border-slate-100">
                  Overall Summary
                </div>
                <div className="px-4 py-2 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Purchase:</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(purchaseTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total paid:</span>
                    <span className="font-semibold text-emerald-700">{formatCurrency(paidTotal)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-1 mt-1">
                    <span className="font-bold text-slate-800">Balance due:</span>
                    <span className={`font-bold ${balanceDue > 0 ? 'text-red-600' : 'text-slate-400'}`}>{formatCurrency(balanceDue)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Info text */}
          <div className="px-4 pb-2 text-xs text-slate-500">
            Showing all invoices and payments between {formatDateDisplay(dateFrom)} to {formatDateDisplay(dateTo)}
          </div>

          {/* ── FORMAT 1 ── Simple table */}
          {ledgerFormat === 1 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#0f4c75] text-white font-bold">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap">Date</th>
                    <th className="px-4 py-3 whitespace-nowrap">Reference No</th>
                    <th className="px-4 py-3 whitespace-nowrap">Type</th>
                    <th className="px-4 py-3 whitespace-nowrap">Location</th>
                    <th className="px-4 py-3 whitespace-nowrap">Payment Status</th>
                    <th className="px-4 py-3 whitespace-nowrap text-right">Debit</th>
                    <th className="px-4 py-3 whitespace-nowrap text-right">Credit</th>
                    <th className="px-4 py-3 whitespace-nowrap">Payment Method</th>
                    <th className="px-4 py-3 whitespace-nowrap">Others</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgerRowsWithBalance.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDateDisplay(row.date)}</td>
                      <td className="px-4 py-3 text-blue-600 font-medium whitespace-nowrap cursor-pointer hover:underline">{row.ref}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.type}</td>
                      <td className="px-4 py-3 text-[10px] text-slate-500 whitespace-nowrap">{row.location || '--'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.paymentStatus ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white ${
                            row.paymentStatus === 'Paid' ? 'bg-emerald-500' :
                            row.paymentStatus === 'Partial' ? 'bg-sky-500' :
                            row.paymentStatus === 'Overdue' ? 'bg-red-500' :
                            row.paymentStatus === 'Due' ? 'bg-amber-500' : 'bg-slate-400'
                          }`}>{row.paymentStatus}</span>
                        ) : <span className="text-slate-400">--</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{row.debit > 0 ? formatCurrency(row.debit) : ''}</td>
                      <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{row.credit > 0 ? formatCurrency(row.credit) : ''}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.method || '--'}</td>
                      <td className="px-4 py-3 text-[10px] text-slate-500 whitespace-nowrap">{row.note || '--'}</td>
                    </tr>
                  ))}
                  {ledgerRowsWithBalance.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400">No data available in table</td></tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-100 font-bold border-t border-slate-200">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right text-slate-600">Balance:</td>
                    <td className="px-4 py-3 text-right text-slate-800">{formatCurrency(totalDebit)}</td>
                    <td className="px-4 py-3 text-right text-slate-800">{formatCurrency(totalCredit)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* ── FORMAT 2 ── With running balance + expandable product rows */}
          {ledgerFormat === 2 && (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] text-left border-collapse">
                <thead className="bg-[#0f4c75] text-white font-bold">
                  <tr>
                    <th className="px-4 py-2 whitespace-nowrap">Date</th>
                    <th className="px-4 py-2 whitespace-nowrap">Reference No</th>
                    <th className="px-4 py-2 whitespace-nowrap">Type</th>
                    <th className="px-4 py-2 whitespace-nowrap">Location</th>
                    <th className="px-4 py-2 whitespace-nowrap">Payment Status</th>
                    <th className="px-4 py-2 whitespace-nowrap text-right">Debit</th>
                    <th className="px-4 py-2 whitespace-nowrap text-right">Credit</th>
                    <th className="px-4 py-2 whitespace-nowrap text-right bg-slate-900/30">Balance</th>
                    <th className="px-4 py-2 whitespace-nowrap">Payment Method</th>
                    <th className="px-4 py-2 whitespace-nowrap">Others</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {ledgerRowsWithBalance.map((row) => (
                    <React.Fragment key={row.id}>
                      <tr className="bg-white hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{formatDateDisplay(row.date)}</td>
                        <td className="px-4 py-3 text-blue-600 font-bold whitespace-nowrap">{row.ref}</td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800">{row.type}</td>
                        <td className="px-4 py-3 text-[10px] text-slate-500 whitespace-nowrap">{row.location || '--'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                        {row.paymentStatus ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white ${
                            row.paymentStatus === 'Paid' ? 'bg-emerald-500' :
                            row.paymentStatus === 'Partial' ? 'bg-sky-500' :
                            row.paymentStatus === 'Overdue' ? 'bg-red-500' :
                            row.paymentStatus === 'Due' ? 'bg-amber-500' : 'bg-slate-400'
                          }`}>{row.paymentStatus}</span>
                        ) : <span className="text-slate-400">--</span>}
                      </td>
                        <td className="px-4 py-3 text-right font-medium whitespace-nowrap text-slate-800">{row.debit > 0 ? formatCurrency(row.debit) : ''}</td>
                        <td className="px-4 py-3 text-right font-medium whitespace-nowrap text-slate-800">{row.credit > 0 ? formatCurrency(row.credit) : ''}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900 bg-slate-50 whitespace-nowrap border-l border-slate-200">
                          {formatCurrency(row.balance)} <span className="text-[9px] text-slate-400">{row.balance >= 0 ? 'DR' : 'CR'}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">{row.method || '--'}</td>
                        <td className="px-4 py-3 text-[10px] text-slate-500 whitespace-nowrap">{row.note || '--'}</td>
                      </tr>
                      {row.type === 'Purchase' && row.items && row.items.length > 0 && (
                        <tr className="bg-white">
                          <td colSpan={10} className="px-4 pb-4 pt-0 border-b border-slate-200">
                            <div className="pl-4 border-l-4 border-slate-200 ml-4 mt-2">
                              <table className="w-full text-[10px]">
                                <thead>
                                  <tr className="text-slate-500 border-b border-slate-100">
                                    <th className="py-1 text-left w-8">#</th>
                                    <th className="py-1 text-left">Product</th>
                                    <th className="py-1 text-right">Quantity</th>
                                    <th className="py-1 text-right">Unit Price</th>
                                    <th className="py-1 text-right">Discount</th>
                                    <th className="py-1 text-right">Tax</th>
                                    <th className="py-1 text-right">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.items.map((item: any, pIdx: number) => (
                                    <tr key={pIdx} className="hover:bg-slate-50 text-slate-600">
                                      <td className="py-1 font-bold">{item.id}</td>
                                      <td className="py-1 font-medium">{item.name}</td>
                                      <td className="py-1 text-right">{item.qty} {item.unit || ''}</td>
                                      <td className="py-1 text-right">{Number(item.unitPrice).toFixed(3)}</td>
                                      <td className="py-1 text-right">{Number(item.discount).toFixed(3)}</td>
                                      <td className="py-1 text-right">{Number(item.tax).toFixed(3)}</td>
                                      <td className="py-1 text-right font-bold text-slate-800">{Number(item.subtotal).toFixed(3)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {ledgerRowsWithBalance.length === 0 && (
                    <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-400">No data available in table</td></tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-100 font-bold border-t border-slate-300 text-slate-800">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right text-slate-600 uppercase text-[10px]">Grand Total:</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(totalDebit)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(totalCredit)}</td>
                    <td className="px-4 py-3 text-right bg-slate-200">{formatCurrency(runningBalance)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* ── FORMAT 3 ── Rich visual */}
          {ledgerFormat === 3 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-800 text-white font-bold uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4 rounded-tl-lg">Date</th>
                    <th className="px-6 py-4 w-1/2">Description</th>
                    <th className="px-6 py-4 text-right">Debit</th>
                    <th className="px-6 py-4 text-right">Credit</th>
                    <th className="px-6 py-4 text-right rounded-tr-lg">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {ledgerRowsWithBalance.map(row => (
                    <tr key={row.id} className={`hover:bg-slate-50 transition-colors group ${
                      row.type === 'Payment' ? 'bg-emerald-50/40' :
                      row.type === 'Purchase' ? 'bg-white' : 'bg-slate-50/20'
                    }`}>
                      <td className={`px-6 py-4 text-slate-600 align-top whitespace-nowrap font-medium border-l-4 ${
                        row.type === 'Payment' ? 'border-emerald-500' :
                        row.type === 'Purchase' ? 'border-blue-500' : 'border-slate-300'
                      }`}>
                        {formatDateDisplay(row.date)}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-col gap-1">
                          <div className={`font-bold text-base flex items-center gap-2 ${
                            row.type === 'Payment' ? 'text-emerald-700' :
                            row.type === 'Purchase' ? 'text-blue-700' : 'text-slate-700'
                          }`}>
                            {row.type === 'Payment' && <CreditCard size={16} />}
                            {row.type === 'Purchase' && <ShoppingBag size={16} />}
                            {row.type} <span className="text-slate-300 font-normal text-xs mx-1">|</span>
                            <span className={row.type === 'Payment' ? 'text-emerald-600' : 'text-blue-600'}>{row.ref || 'N/A'}</span>
                          </div>
                          {row.location && (
                            <div className="text-xs text-slate-500">
                              <span className="font-semibold text-slate-600">Location:</span> {row.location}
                            </div>
                          )}
                          {row.method && (
                            <div className="text-xs text-slate-500">
                              <span className="font-semibold text-slate-600">Method:</span> {row.method}
                            </div>
                          )}
                          {row.note && (
                            <div className="text-xs text-slate-500 italic bg-white/50 px-2 py-1 rounded w-fit mt-1 border border-slate-200">
                              {row.note}
                            </div>
                          )}
                          {row.items && row.items.length > 0 && (
                            <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                              <Receipt size={10} /> Includes {row.items.length} item{row.items.length !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right align-top">
                        {row.debit > 0 ? (
                          <span className="font-bold text-emerald-700 bg-emerald-100/50 px-2 py-1 rounded border border-emerald-200">{formatCurrency(row.debit)}</span>
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-6 py-4 text-right align-top">
                        {row.credit > 0 ? (
                          <span className="font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100">{formatCurrency(row.credit)}</span>
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-6 py-4 text-right align-top">
                        <span className={`font-black ${row.balance > 0 ? 'text-red-600' : 'text-slate-800'}`}>{formatCurrency(row.balance)}</span>
                        <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">{row.balance >= 0 ? 'DR' : 'CR'}</div>
                      </td>
                    </tr>
                  ))}
                  {ledgerRowsWithBalance.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400">No data available in table</td></tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-800 text-white font-bold border-t border-slate-700">
                  <tr>
                    <td colSpan={2} className="px-6 py-4 text-right uppercase text-xs tracking-wider opacity-80">Totals</td>
                    <td className="px-6 py-4 text-right text-emerald-400">{formatCurrency(totalDebit)}</td>
                    <td className="px-6 py-4 text-right text-blue-300">{formatCurrency(totalCredit)}</td>
                    <td className="px-6 py-4 text-right bg-slate-900">{formatCurrency(runningBalance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── PURCHASES TAB ── */}
      {activeTab === 'purchases' && (
        <div className="bg-white border border-t-0 border-slate-200 rounded-b shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-teal-700 text-white font-semibold">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Reference No</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment Status</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3 text-right">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {supplierPurchases.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{formatDateDisplay(p.date)}</td>
                    <td className="px-4 py-3 font-medium text-blue-700">{p.refNo}</td>
                    <td className="px-4 py-3">{p.location}</td>
                    <td className="px-4 py-3">{p.status}</td>
                    <td className="px-4 py-3">
                      {p.paymentStatus ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white ${
                          p.paymentStatus === 'Paid' ? 'bg-emerald-500' :
                          p.paymentStatus === 'Partial' ? 'bg-sky-500' :
                          p.paymentStatus === 'Due' ? 'bg-amber-500' : 'bg-slate-400'
                        }`}>{p.paymentStatus}</span>
                      ) : '--'}
                    </td>
                    <td className="px-4 py-3 text-right">{formatCurrency(p.grandTotal || 0)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(p.paymentDue || 0)}</td>
                  </tr>
                ))}
                {supplierPurchases.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">No data available in table</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── STOCK REPORT TAB ── */}
      {activeTab === 'stock' && (
        <div className="bg-white border border-t-0 border-slate-200 rounded-b shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-teal-700 text-white font-semibold">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">Purchased Qty</th>
                  <th className="px-4 py-3 text-right">Sold Qty</th>
                  <th className="px-4 py-3 text-right">Current Stock</th>
                  <th className="px-4 py-3 text-right">Stock Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockRows.map(row => (
                  <tr key={row.key} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{row.product}</td>
                    <td className="px-4 py-3">{row.sku}</td>
                    <td className="px-4 py-3 text-right">{row.purchased}</td>
                    <td className="px-4 py-3 text-right">{row.sold}</td>
                    <td className="px-4 py-3 text-right">{row.currentStock}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(row.stockValue)}</td>
                  </tr>
                ))}
                {stockRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">No data available in table</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DOCUMENTS & NOTE TAB ── */}
      {activeTab === 'docs' && (
        <div className="bg-white border border-t-0 border-slate-200 rounded-b shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
            <span className="text-sm font-semibold text-slate-600">Documents & Notes</span>
            <button
              onClick={() => { setEditingDocId(null); setNewDocHeading(''); setIsDocModalOpen(true); }}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 flex items-center gap-1"
            >
              <Plus size={12} /> Add Document
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-teal-700 text-white font-semibold">
                  <th className="px-4 py-3">Heading</th>
                  <th className="px-4 py-3">Added By</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Last Updated</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(supplier.documents || []).map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{doc.heading}</td>
                    <td className="px-4 py-3 text-slate-600">{doc.addedBy}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDateDisplay(doc.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDateDisplay(doc.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setEditingDocId(doc.id); setNewDocHeading(doc.heading); setIsDocModalOpen(true); }}
                          className="text-amber-600 hover:text-amber-800"
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleDeleteDoc(doc.id)} className="text-rose-600 hover:text-rose-800" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(supplier.documents || []).length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No documents added yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PAYMENTS TAB ── */}
      {activeTab === 'payments' && (
        <div className="bg-white border border-t-0 border-slate-200 rounded-b shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-3 bg-slate-50/30">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search payments..."
              className="px-3 py-1.5 rounded border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-full md:w-64"
            />
            <button
              onClick={() => { resetPaymentForm(); setPaymentForm(prev => ({ ...prev, amount: balanceDue.toFixed(currencyPrecision), date: new Date().toISOString().slice(0, 16) })); setIsPaymentModalOpen(true); }}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded font-bold text-xs shadow-sm hover:bg-emerald-700 whitespace-nowrap flex items-center gap-1"
            >
              <Plus size={12} /> Add Payment
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-teal-700 text-white font-semibold">
                  <th className="px-5 py-3">Paid on</th>
                  <th className="px-5 py-3">Reference No</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Note</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map(pay => (
                  <tr key={pay.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">{formatDateDisplay(pay.date)}</td>
                    <td className="px-5 py-3">{pay.referenceNo}</td>
                    <td className="px-5 py-3 text-right font-bold">{formatCurrency(pay.amount || 0)}</td>
                    <td className="px-5 py-3">{pay.method}</td>
                    <td className="px-5 py-3">{pay.note || '-'}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => setViewPaymentId(pay.id)} className="text-blue-600 hover:text-blue-800"><Eye size={14} /></button>
                        <button onClick={() => openEditPayment(pay.id)} className="text-amber-600 hover:text-amber-800"><Edit size={14} /></button>
                        <button onClick={() => handleDeletePayment(pay.id)} className="text-rose-600 hover:text-rose-800"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-400">No data available in table</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ACTIVITIES TAB ── */}
      {activeTab === 'activities' && (
        <div className="bg-white border border-t-0 border-slate-200 rounded-b shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-teal-700 text-white font-semibold">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">By</th>
                  <th className="px-5 py-3">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activities.map(act => (
                  <tr key={act.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">{formatDateDisplay(act.date)}</td>
                    <td className="px-5 py-3">{act.action}</td>
                    <td className="px-5 py-3">{act.by}</td>
                    <td className="px-5 py-3">{act.note}</td>
                  </tr>
                ))}
                {activities.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-slate-400">No data available in table</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ADD PAYMENT MODAL ── */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-700">Add Supplier Payment</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            {/* Supplier summary */}
            <div className="px-6 pt-4 grid grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-100 p-3 rounded text-sm">
                <p className="font-bold text-slate-700 text-xs mb-1">Supplier</p>
                <p className="text-slate-600">{supplier.businessName}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-3 rounded text-sm">
                <p className="font-bold text-slate-700 text-xs mb-1">Total Purchase Due</p>
                <p className={`font-bold ${balanceDue > 0 ? 'text-red-600' : 'text-slate-400'}`}>{formatCurrency(balanceDue)}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-3 rounded text-sm">
                <p className="font-bold text-slate-700 text-xs mb-1">Return Due</p>
                <p className="text-slate-600">{formatCurrency(supplier.totalReturnDue ?? 0)}</p>
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                <select value={paymentForm.method} onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option>Cash</option>
                  <option>Card</option>
                  <option>Bank Transfer</option>
                  <option>Cheque</option>
                  <option>Emad</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Paid On</label>
                <input type="datetime-local" value={paymentForm.date} onChange={e => setPaymentForm({ ...paymentForm, date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount</label>
                <input type="text" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Account</label>
                <select
                  value={paymentForm.account}
                  onChange={e => setPaymentForm({ ...paymentForm, account: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {paymentAccountOptions.map(account => (
                    <option key={account} value={account}>{account}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Attach Document</label>
                <div className="flex items-center">
                  <label className="cursor-pointer bg-slate-100 border border-slate-300 text-slate-700 px-3 py-2 rounded-l text-xs hover:bg-slate-200 transition-colors whitespace-nowrap">
                    Choose File
                    <input type="file" accept=".pdf,.csv,.zip,.doc,.docx,.jpeg,.jpg,.png" className="hidden" onChange={(e) => setPaymentForm({ ...paymentForm, attachmentName: e.target.files?.[0]?.name || '' })} />
                  </label>
                  <span className="px-3 py-2 border border-l-0 border-slate-300 rounded-r w-full text-xs text-slate-500 bg-white truncate">{paymentForm.attachmentName || 'No file chosen'}</span>
                </div>
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Note</label>
                <textarea value={paymentForm.note} onChange={e => setPaymentForm({ ...paymentForm, note: e.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
              <button onClick={handleSaveSupplierPayment} className="px-6 py-2 bg-blue-600 text-white font-bold text-sm rounded hover:bg-blue-700 transition">Save</button>
              <button onClick={() => setIsPaymentModalOpen(false)} className="px-6 py-2 bg-slate-800 text-white font-bold text-sm rounded hover:bg-slate-900 transition">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW PAYMENT MODAL ── */}
      {selectedViewPayment && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded shadow-xl w-full max-w-md p-6 space-y-3">
            <h3 className="text-lg font-semibold text-slate-700">Payment Details</h3>
            <div className="space-y-2 text-sm">
              <p><span className="font-bold text-slate-600">Reference:</span> {selectedViewPayment.referenceNo}</p>
              <p><span className="font-bold text-slate-600">Date:</span> {formatDateDisplay(selectedViewPayment.date)}</p>
              <p><span className="font-bold text-slate-600">Amount:</span> {formatCurrency(selectedViewPayment.amount || 0)}</p>
              <p><span className="font-bold text-slate-600">Method:</span> {selectedViewPayment.method}</p>
              <p><span className="font-bold text-slate-600">Note:</span> {selectedViewPayment.note || '-'}</p>
            </div>
            <div className="pt-2 flex justify-end">
              <button onClick={() => setViewPaymentId(null)} className="px-4 py-2 bg-slate-800 text-white rounded text-sm font-bold hover:bg-slate-900">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT PAYMENT MODAL ── */}
      {selectedEditPayment && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded shadow-xl w-full max-w-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-700">Edit Payment</h3>
              <button onClick={() => setEditPaymentId(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount</label>
                <input type="number" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Method</label>
                <select value={paymentForm.method} onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white">
                  <option>Cash</option>
                  <option>Card</option>
                  <option>Bank Transfer</option>
                  <option>Cheque</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Account</label>
                <input
                  type="text"
                  value={resolveDefaultAccountFromMethod(paymentForm.method || 'Cash')}
                  readOnly
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-slate-100 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                <input type="datetime-local" value={paymentForm.date} onChange={e => setPaymentForm({ ...paymentForm, date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Note</label>
                <textarea value={paymentForm.note} onChange={e => setPaymentForm({ ...paymentForm, note: e.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded text-sm resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
              <button onClick={handleUpdatePayment} className="px-6 py-2 bg-blue-600 text-white rounded font-bold text-sm hover:bg-blue-700">Update</button>
              <button onClick={() => setEditPaymentId(null)} className="px-6 py-2 bg-slate-800 text-white rounded font-bold text-sm hover:bg-slate-900">Close</button>
            </div>
          </div>
        </div>
      )}

      {isDiscountModalOpen && (
        <AddDiscountModal
          isOpen={isDiscountModalOpen}
          onClose={() => setIsDiscountModalOpen(false)}
          onSave={async (formData) => {
            const result = await globalAddDiscount({ ...formData, id: generateId('DISC') });
            if (!result.ok) {
              addNotification({
                title: 'Discount Save Failed',
                message: result.error || 'Discount could not be saved to Postgres.',
                type: 'error',
              });
              return false;
            }
            addNotification({ title: 'Discount Saved', message: 'Discount was saved successfully.', type: 'success' });
            return true;
          }}
        />
      )}

      {/* ── DOCUMENT ADD/EDIT MODAL ── */}
      {isDocModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-700">{editingDocId ? 'Edit Document' : 'Add Document'}</h3>
              <button onClick={() => { setIsDocModalOpen(false); setEditingDocId(null); setNewDocHeading(''); }} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Heading / Title</label>
                <input
                  type="text"
                  value={newDocHeading}
                  onChange={e => setNewDocHeading(e.target.value)}
                  placeholder="Enter document heading..."
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={handleSaveDoc} className="px-5 py-2 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700">Save</button>
              <button onClick={() => { setIsDocModalOpen(false); setEditingDocId(null); setNewDocHeading(''); }} className="px-5 py-2 bg-slate-700 text-white rounded text-sm font-bold hover:bg-slate-800">Cancel</button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={!!pendingDeletePaymentId}
        title="Delete Supplier Payment"
        message="Are you sure you want to delete this supplier payment? This action cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        onCancel={() => setPendingDeletePaymentId(null)}
        onConfirm={async () => {
          if (!pendingDeletePaymentId) return;
          const result = await globalDeletePayment(pendingDeletePaymentId);
          if (!result.ok) {
            addNotification({
              title: 'Payment Delete Failed',
              message: result.error || 'Supplier payment could not be deleted from Postgres.',
              type: 'error',
            });
            return false;
          }
          addNotification({
            title: 'Payment Deleted',
            message: 'Supplier payment was deleted successfully.',
            type: 'success',
          });
          setPendingDeletePaymentId(null);
        }}
      />
      <ConfirmDialog
        isOpen={!!pendingDeleteDocId}
        title="Delete Document"
        message="Are you sure you want to delete this document? This action cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        onCancel={() => setPendingDeleteDocId(null)}
        onConfirm={async () => {
          if (!supplier || !pendingDeleteDocId) return;
          const docs = (supplier.documents || []).filter(d => d.id !== pendingDeleteDocId);
          const result = await globalUpdateSupplier({ ...supplier, documents: docs });
          if (!result.ok) {
            addNotification({
              title: 'Document Delete Failed',
              message: result.error || 'Supplier document could not be deleted from Postgres.',
              type: 'error',
            });
            return false;
          }
          addNotification({
            title: 'Document Deleted',
            message: 'Supplier document was deleted successfully.',
            type: 'success',
          });
          setPendingDeleteDocId(null);
        }}
      />
    </div>
  );
};

export default ViewSupplier;
