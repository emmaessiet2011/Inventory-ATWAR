import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Save, Plus, Search, Trash2, Upload, PackageCheck } from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { useGlobalContext } from '@/context/GlobalContext';

interface AddPurchaseProps {
  onNavigate?: (page: string) => void;
}

interface PurchaseRow {
  rowId: string;
  productId: string;
  productName: string;
  qty: number;
  unitCost: number;
  discountPercent: number;
  costBeforeTax: number;
  lineTotal: number;
  margin: number;
  sellingPrice: number;
  lot: string;
  expiryDate: string;
}

const DRAFT_KEY = 'addPurchaseDraft_v2';
const PREFILL_ORDER_KEY = 'app_purchase_prefill_order_id';

const toNumber = (value: string | number | undefined): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const toIntegerQuantity = (value: string | number | undefined): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
};
const normalizeOrderDiscount = (
  type: 'None' | 'Fixed' | 'Percentage',
  value: string | number,
  subTotal: number
): string => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '';
  if (type === 'Percentage') return clamp(parsed, 0, 100).toFixed(3);
  if (type === 'Fixed') return clamp(parsed, 0, Math.max(0, subTotal)).toFixed(3);
  return '';
};

const normalizePrefix = (value: string, fallback: string): string => {
  const candidate = String(value || fallback).trim();
  if (!candidate) return fallback;
  return candidate.endsWith('-') ? candidate.slice(0, -1) : candidate;
};

const toInputDateTime = (value?: string): string => {
  const src = value ? new Date(value.includes('T') ? value : value.replace(' ', 'T')) : new Date();
  const date = Number.isNaN(src.getTime()) ? new Date() : src;
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const createRowId = (): string => `pur-row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const recalcRow = (row: PurchaseRow): PurchaseRow => {
  const qty = toIntegerQuantity(row.qty);
  const unitCost = Math.max(0, toNumber(row.unitCost));
  const discountPercent = Math.min(100, Math.max(0, toNumber(row.discountPercent)));
  const costBeforeTax = unitCost * (1 - discountPercent / 100);
  const lineTotal = qty * costBeforeTax;
  return {
    ...row,
    qty,
    unitCost,
    discountPercent,
    costBeforeTax,
    lineTotal,
    margin: toNumber(row.margin),
    sellingPrice: toNumber(row.sellingPrice),
    expiryDate: String(row.expiryDate || '').trim(),
  };
};

const AddPurchase: React.FC<AddPurchaseProps> = ({ onNavigate }) => {
  const {
    locations,
    suppliers,
    products,
    purchases,
    purchaseOrders,
    addPurchase,
    setPayments,
    updatePurchaseOrder,
    currentUser,
    settings,
    formatCurrency,
    taxRates,
    generateId,
  } = useGlobalContext();
  const { addNotification } = useNotifications();

  const [supplierId, setSupplierId] = useState('');
  const [purchaseStatus, setPurchaseStatus] = useState<'Received' | 'Pending' | 'Ordered'>('Received');
  const [referenceNo, setReferenceNo] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(toInputDateTime());
  const [locationName, setLocationName] = useState('');
  const [attachDocumentName, setAttachDocumentName] = useState('');
  const [linkedPurchaseOrderId, setLinkedPurchaseOrderId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [rows, setRows] = useState<PurchaseRow[]>([]);
  const [discountType, setDiscountType] = useState<'None' | 'Fixed' | 'Percentage'>('None');
  const [discountAmount, setDiscountAmount] = useState('');
  const [purchaseTaxId, setPurchaseTaxId] = useState('');
  const [shippingDetails, setShippingDetails] = useState('');
  const [shippingCharges, setShippingCharges] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paidOn, setPaidOn] = useState(toInputDateTime());
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentNote, setPaymentNote] = useState('');
  const [formError, setFormError] = useState('');
  const prefillChecked = useRef(false);

  const linkedOrder = useMemo(() => purchaseOrders.find(order => order.id === linkedPurchaseOrderId) || null, [purchaseOrders, linkedPurchaseOrderId]);
  const activeSuppliers = useMemo(() => suppliers.filter(s => s.status === 'Active'), [suppliers]);
  const locationOptions = useMemo(() => Array.from(new Set(locations.map(l => l.name).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)), [locations]);

  const buildNextRefNo = (): string => {
    const year = new Date().getFullYear();
    let maxSeq = 0;
    purchases.forEach(item => {
      const match = String(item.refNo || '').match(/(\d{4})[/-](\d+)\s*$/);
      if (!match) return;
      if (Number(match[1]) === year) maxSeq = Math.max(maxSeq, Number(match[2]));
    });
    return `PUR${year}/${String(maxSeq + 1).padStart(4, '0')}`;
  };

  const resetForm = () => {
    setSupplierId('');
    setPurchaseStatus('Received');
    setReferenceNo(buildNextRefNo());
    setPurchaseDate(toInputDateTime());
    setLocationName(locationOptions[0] || '');
    setAttachDocumentName('');
    setLinkedPurchaseOrderId('');
    setProductSearch('');
    setRows([]);
    setDiscountType('None');
    setDiscountAmount('');
    setPurchaseTaxId('');
    setShippingDetails('');
    setShippingCharges('');
    setAdditionalNotes('');
    setPaymentAmount('');
    setPaidOn(toInputDateTime());
    setPaymentMethod('Cash');
    setPaymentNote('');
    setFormError('');
  };

  const applyOrderPrefill = (orderId: string) => {
    const order = purchaseOrders.find(item => item.id === orderId);
    if (!order) return;
    setLinkedPurchaseOrderId(order.id);
    setSupplierId(order.supplierId || '');
    setLocationName(order.location || locationOptions[0] || '');
    setReferenceNo(order.referenceNo || buildNextRefNo());
    setPurchaseDate(toInputDateTime(order.orderDate));
    setAttachDocumentName(order.attachDocumentName || '');
    setShippingDetails(order.shippingDetails || '');
    setShippingCharges(String(toNumber(order.shippingCharges || 0)));
    setAdditionalNotes(order.additionalNotes || '');
    setPurchaseStatus(order.status === 'Received' ? 'Received' : order.status === 'Draft' ? 'Pending' : 'Ordered');
    const seededRows = (order.items || []).map(item => recalcRow({
      rowId: createRowId(),
      productId: item.productId,
      productName: item.productName,
      qty: toNumber(item.orderQty),
      unitCost: toNumber(item.unitCostBeforeDiscount),
      discountPercent: toNumber(item.discountPercent),
      costBeforeTax: toNumber(item.unitCostBeforeTax),
      lineTotal: toNumber(item.lineTotal),
      margin: 0,
      sellingPrice: 0,
      lot: '',
      expiryDate: '',
    }));
    setRows(seededRows);
  };

  useEffect(() => {
    resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationOptions.length]);

  useEffect(() => {
    if (prefillChecked.current) return;
    const orderId = localStorage.getItem(PREFILL_ORDER_KEY);
    if (!orderId) {
      prefillChecked.current = true;
      return;
    }
    if (purchaseOrders.length === 0) return;
    applyOrderPrefill(orderId);
    localStorage.removeItem(PREFILL_ORDER_KEY);
    prefillChecked.current = true;
  }, [purchaseOrders, locationOptions]);

  useEffect(() => {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (!draft) return;
    try {
      const parsed = JSON.parse(draft);
      setSupplierId(parsed.supplierId || '');
      setPurchaseStatus(parsed.purchaseStatus || 'Received');
      setReferenceNo(parsed.referenceNo || buildNextRefNo());
      setPurchaseDate(parsed.purchaseDate || toInputDateTime());
      setLocationName(parsed.locationName || locationOptions[0] || '');
      setAttachDocumentName(parsed.attachDocumentName || '');
      setLinkedPurchaseOrderId(parsed.linkedPurchaseOrderId || '');
      setRows((parsed.rows || []).map((r: PurchaseRow) => recalcRow({ ...r, rowId: r.rowId || createRowId(), expiryDate: String((r as any)?.expiryDate || '') })));
      setDiscountType(parsed.discountType || 'None');
      setDiscountAmount(parsed.discountAmount || '');
      setPurchaseTaxId(parsed.purchaseTaxId || '');
      setShippingDetails(parsed.shippingDetails || '');
      setShippingCharges(parsed.shippingCharges || '');
      setAdditionalNotes(parsed.additionalNotes || '');
      setPaymentAmount(parsed.paymentAmount || '');
      setPaidOn(parsed.paidOn || toInputDateTime());
      setPaymentMethod(parsed.paymentMethod || 'Cash');
      setPaymentNote(parsed.paymentNote || '');
    } catch {
      // Ignore invalid draft.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      supplierId, purchaseStatus, referenceNo, purchaseDate, locationName, attachDocumentName, linkedPurchaseOrderId,
      rows, discountType, discountAmount, purchaseTaxId, shippingDetails, shippingCharges, additionalNotes,
      paymentAmount, paidOn, paymentMethod, paymentNote,
    }));
  }, [supplierId, purchaseStatus, referenceNo, purchaseDate, locationName, attachDocumentName, linkedPurchaseOrderId, rows, discountType, discountAmount, purchaseTaxId, shippingDetails, shippingCharges, additionalNotes, paymentAmount, paidOn, paymentMethod, paymentNote]);

  const addRow = (product?: { id: string; name: string; unitPurchasePrice: number; sellingPrice: number }) =>
    setRows(prev => [...prev, recalcRow({ rowId: createRowId(), productId: product?.id || '', productName: product?.name || '', qty: 1, unitCost: toNumber(product?.unitPurchasePrice || 0), discountPercent: 0, costBeforeTax: 0, lineTotal: 0, margin: 0, sellingPrice: toNumber(product?.sellingPrice || 0), lot: '', expiryDate: '' })]);

  const updateRow = (rowId: string, patch: Partial<PurchaseRow>) =>
    setRows(prev => prev.map(row => row.rowId === rowId ? recalcRow({ ...row, ...patch }) : row));

  const removeRow = (rowId: string) => setRows(prev => prev.filter(row => row.rowId !== rowId));

  const selectProductForRow = (rowId: string, productId: string) => {
    const product = products.find(item => item.id === productId);
    updateRow(rowId, { productId: product?.id || '', productName: product?.name || '', unitCost: toNumber(product?.unitPurchasePrice || 0), sellingPrice: toNumber(product?.sellingPrice || 0) });
  };

  const quickProductMatches = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return [];
    return products.filter(item => item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q)).slice(0, 8);
  }, [productSearch, products]);

  const subTotal = useMemo(() => rows.reduce((sum, row) => sum + toNumber(row.lineTotal), 0), [rows]);
  const normalizedDiscountAmount = useMemo(
    () => normalizeOrderDiscount(discountType, discountAmount, subTotal),
    [discountType, discountAmount, subTotal]
  );
  const discountValue = discountType === 'Fixed'
    ? toNumber(normalizedDiscountAmount)
    : discountType === 'Percentage'
      ? subTotal * (toNumber(normalizedDiscountAmount) / 100)
      : 0;
  const afterDiscount = Math.max(0, subTotal - discountValue);
  const selectedTax = taxRates.find(t => t.id === purchaseTaxId);
  const purchaseTaxAmount = selectedTax ? afterDiscount * (toNumber(selectedTax.rate) / 100) : 0;
  const shippingChargesNum = toNumber(shippingCharges);
  const netTotal = afterDiscount + purchaseTaxAmount + shippingChargesNum;
  const paymentAmountNum = toNumber(paymentAmount);
  const paymentDue = Math.max(0, netTotal - paymentAmountNum);
  const paymentStatus: 'Paid' | 'Due' | 'Partial' = paymentDue <= 0.001 ? 'Paid' : paymentAmountNum > 0 ? 'Partial' : 'Due';

  const handleSave = () => {
    setFormError('');
    const selectedSupplier = activeSuppliers.find(item => item.id === supplierId);
    if (!selectedSupplier) return setFormError('Supplier is required.');
    if (!locationName.trim()) return setFormError('Business location is required.');
    if (!purchaseDate.trim()) return setFormError('Purchase date is required.');
    if (rows.length === 0) return setFormError('Add at least one product row.');
    if (rows.some(row => !row.productId)) return setFormError('Select a product in every row.');
    if (rows.some(row => toNumber(row.qty) <= 0)) return setFormError('Quantity must be greater than 0.');
    if (rows.some(row => !Number.isInteger(toNumber(row.qty)))) return setFormError('Quantity must be a whole number.');

    const finalRefNo = referenceNo.trim() || buildNextRefNo();
    const selectedTaxRate = Number(selectedTax?.rate || 0);
    addPurchase({
      id: generateId('PUR-'),
      refNo: finalRefNo,
      date: purchaseDate.replace('T', ' '),
      location: locationName,
      supplier: selectedSupplier.businessName,
      supplierId: selectedSupplier.id,
      status: purchaseStatus,
      paymentStatus,
      grandTotal: netTotal,
      paymentDue,
      addedBy: currentUser?.name || 'Admin',
      items: rows.map(row => ({
        id: row.productId,
        name: row.productName,
        qty: toIntegerQuantity(row.qty),
        unitCost: toNumber(row.unitCost),
        discount: toNumber(row.discountPercent),
        tax: Number((toNumber(row.lineTotal) * (selectedTaxRate / 100)).toFixed(3)),
        lineTotal: toNumber(row.lineTotal),
        lot: row.lot || '',
        expiryDate: row.expiryDate || undefined,
        margin: toNumber(row.margin),
        sellingPrice: toNumber(row.sellingPrice),
      })),
      subTotal,
      discountType,
      discountAmount: discountValue,
      purchaseTaxId: selectedTax?.id || '',
      purchaseTaxName: selectedTax?.name || 'None',
      purchaseTaxAmount,
      shippingCharges: shippingChargesNum,
      shippingDetails: shippingDetails.trim(),
      attachDocumentName: attachDocumentName || '',
      purchaseOrderId: linkedOrder?.id || '',
      purchaseOrderRef: linkedOrder?.referenceNo || '',
      purchaseRequisitionId: linkedOrder?.purchaseRequisitionId || '',
      purchaseRequisitionRef: linkedOrder?.purchaseRequisitionRef || '',
      notes: additionalNotes.trim(),
      paymentMethod,
      paymentAmount: paymentAmountNum,
      paidOn: (paidOn || purchaseDate).replace('T', ' '),
      paymentNote: paymentNote.trim(),
    });

    if (paymentAmountNum > 0) {
      const paymentPrefix = normalizePrefix(settings.purchasePaymentPrefix || settings.paymentPrefix, 'PP');
      const paymentRefNo = `${paymentPrefix}-${Date.now().toString().slice(-6)}`;
      setPayments((prev) => [...prev, {
        id: `PAY-SUP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: (paidOn || purchaseDate).replace('T', ' '),
        contactId: selectedSupplier.id,
        contactName: selectedSupplier.businessName,
        contactType: 'Supplier',
        amount: paymentAmountNum,
        method: paymentMethod || settings.defaultPurchasePaymentMethod || 'Cash',
        account: '',
        location: locationName,
        referenceNo: paymentRefNo,
        note: paymentNote.trim() || `Payment for purchase ${finalRefNo}`,
        type: 'sent',
        linkedInvoices: [finalRefNo],
        addedBy: currentUser?.name || 'Admin',
        attachmentName: attachDocumentName || undefined,
      }]);
    }

    if (linkedOrder && purchaseStatus === 'Received' && linkedOrder.status !== 'Received') {
      updatePurchaseOrder({ ...linkedOrder, status: 'Received' });
    }

    localStorage.removeItem(DRAFT_KEY);
    addNotification({ title: 'Purchase Saved', message: 'The purchase has been recorded successfully.', type: 'success' });
    resetForm();
    onNavigate?.('purchases');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-24 max-w-[1800px] mx-auto">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <PackageCheck className="text-emerald-600" size={32} />
          Add Purchase
        </h2>
        <button
          type="button"
          onClick={() => onNavigate?.('purchases')}
          className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          Back to Purchases
        </button>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Supplier: <span className="text-rose-500">*</span></label>
          <div className="flex gap-2">
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white">
              <option value="">Please Select</option>
              {activeSuppliers.map(s => <option key={s.id} value={s.id}>{s.businessName}</option>)}
            </select>
            <button type="button" onClick={() => onNavigate?.('suppliers')} className="px-2 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">
              <Plus size={14} />
            </button>
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Reference No:</label>
          <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Purchase Date: <span className="text-rose-500">*</span></label>
          <input type="datetime-local" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Business Location: <span className="text-rose-500">*</span></label>
          <select value={locationName} onChange={(e) => setLocationName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white">
            <option value="">Please Select</option>
            {locationOptions.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Purchase Status:</label>
          <select value={purchaseStatus} onChange={(e) => setPurchaseStatus(e.target.value as 'Received' | 'Pending' | 'Ordered')} className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white">
            <option value="Received">Received</option>
            <option value="Pending">Pending</option>
            <option value="Ordered">Ordered</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Purchase Order:</label>
          <select
            value={linkedPurchaseOrderId}
            onChange={(e) => {
              const nextId = e.target.value;
              setLinkedPurchaseOrderId(nextId);
              if (nextId) applyOrderPrefill(nextId);
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
          >
            <option value="">Select purchase order</option>
            {purchaseOrders.map(order => <option key={order.id} value={order.id}>{order.referenceNo} ({order.supplierName})</option>)}
          </select>
        </div>
        <div className="xl:col-span-2">
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Attach Document:</label>
          <label className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white flex items-center justify-between cursor-pointer">
            <span className="truncate text-slate-500">{attachDocumentName || 'Browse...'}</span>
            <span className="text-blue-600 flex items-center gap-1"><Upload size={12} /> Browse</span>
            <input type="file" className="hidden" onChange={(e) => setAttachDocumentName(e.target.files?.[0]?.name || '')} />
          </label>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded text-sm" placeholder="Enter Product name / SKU / Scan bar code" />
            {productSearch.trim() && quickProductMatches.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow max-h-56 overflow-y-auto">
                {quickProductMatches.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      addRow({ id: p.id, name: p.name, unitPurchasePrice: toNumber(p.unitPurchasePrice), sellingPrice: toNumber(p.sellingPrice) });
                      setProductSearch('');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs border-b border-slate-100 last:border-b-0"
                  >
                    <div className="font-bold text-slate-700">{p.name}</div>
                    <div className="text-slate-500">SKU: {p.sku}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-end">
            <button type="button" onClick={() => addRow()} className="text-sm font-bold text-blue-600 hover:text-blue-700">+ Add new product</button>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-[#5cb85c] text-white text-[11px] uppercase tracking-wider font-bold">
              <tr>
                <th className="px-3 py-2 w-10">#</th>
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-center">Qty</th>
                <th className="px-3 py-2 text-right">Unit Cost</th>
                <th className="px-3 py-2 text-center">Discount %</th>
                <th className="px-3 py-2 text-right">Unit Cost (Tax Excl.)</th>
                <th className="px-3 py-2 text-right">Line Total</th>
                <th className="px-3 py-2 text-left">Lot</th>
                <th className="px-3 py-2 text-left">Expiry Date</th>
                <th className="px-3 py-2 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length > 0 ? rows.map((row, idx) => (
                <tr key={row.rowId}>
                  <td className="px-3 py-2 text-center">{idx + 1}</td>
                  <td className="px-3 py-2 min-w-[220px]">
                    <select value={row.productId} onChange={(e) => selectProductForRow(row.rowId, e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white">
                      <option value="">Select product</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2"><input type="number" min="1" step="1" value={row.qty} onChange={(e) => updateRow(row.rowId, { qty: toIntegerQuantity(e.target.value) })} className="w-24 px-2 py-1.5 border border-slate-300 rounded text-sm text-center" /></td>
                  <td className="px-3 py-2"><input type="number" min="0" step="0.001" value={row.unitCost} onChange={(e) => updateRow(row.rowId, { unitCost: toNumber(e.target.value) })} className="w-32 px-2 py-1.5 border border-slate-300 rounded text-sm text-right" /></td>
                  <td className="px-3 py-2"><input type="number" min="0" max="100" step="0.001" value={row.discountPercent} onChange={(e) => updateRow(row.rowId, { discountPercent: toNumber(e.target.value) })} className="w-24 px-2 py-1.5 border border-slate-300 rounded text-sm text-center" /></td>
                  <td className="px-3 py-2 text-right font-medium">{toNumber(row.costBeforeTax).toFixed(3)}</td>
                  <td className="px-3 py-2 text-right font-bold">{toNumber(row.lineTotal).toFixed(3)}</td>
                  <td className="px-3 py-2"><input value={row.lot || ''} onChange={(e) => updateRow(row.rowId, { lot: e.target.value })} className="w-28 px-2 py-1.5 border border-slate-300 rounded text-sm" /></td>
                  <td className="px-3 py-2"><input type="date" value={row.expiryDate || ''} onChange={(e) => updateRow(row.rowId, { expiryDate: e.target.value })} className="w-36 px-2 py-1.5 border border-slate-300 rounded text-sm" /></td>
                  <td className="px-3 py-2 text-center">
                    <button type="button" onClick={() => removeRow(row.rowId)} className="text-rose-500 hover:text-rose-700"><Trash2 size={14} /></button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400 italic">No products added yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
          <h3 className="text-sm font-black text-slate-900">Totals</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Discount Type:</label>
              <select
                value={discountType}
                onChange={(e) => {
                  const nextType = e.target.value as 'None' | 'Fixed' | 'Percentage';
                  setDiscountType(nextType);
                  setDiscountAmount(prev => normalizeOrderDiscount(nextType, prev, subTotal));
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
              >
                <option value="None">None</option>
                <option value="Fixed">Fixed</option>
                <option value="Percentage">Percentage</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Discount:</label>
              <input
                type="number"
                min="0"
                step="0.001"
                max={discountType === 'Percentage' ? 100 : Number(subTotal.toFixed(3))}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(normalizeOrderDiscount(discountType, e.target.value, subTotal))}
                disabled={discountType === 'None'}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Order Tax:</label>
              <select value={purchaseTaxId} onChange={(e) => setPurchaseTaxId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white">
                <option value="">None</option>
                {taxRates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Shipping Charges:</label>
              <input type="number" min="0" step="0.001" value={shippingCharges} onChange={(e) => setShippingCharges(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
            </div>
          </div>
          <div className="border border-slate-200 rounded p-3 bg-slate-50 text-sm space-y-1">
            <div className="flex justify-between"><span>Subtotal</span><span className="font-bold">{formatCurrency(subTotal)}</span></div>
            <div className="flex justify-between"><span>Discount (-)</span><span className="font-bold">{formatCurrency(discountValue)}</span></div>
            <div className="flex justify-between"><span>Order Tax (+)</span><span className="font-bold">{formatCurrency(purchaseTaxAmount)}</span></div>
            <div className="flex justify-between"><span>Shipping (+)</span><span className="font-bold">{formatCurrency(shippingChargesNum)}</span></div>
            <div className="h-px bg-slate-200" />
            <div className="flex justify-between text-base"><span className="font-black">Net Total</span><span className="font-black">{formatCurrency(netTotal)}</span></div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
          <h3 className="text-sm font-black text-slate-900">Payment & Notes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Payment Amount:</label>
              <input type="number" min="0" step="0.001" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Paid On:</label>
              <input type="datetime-local" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Payment Method:</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white">
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Payment Status:</label>
              <div className="px-3 py-2 border border-slate-300 rounded text-sm bg-slate-50 font-bold">{paymentStatus}</div>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Shipping Details:</label>
            <textarea rows={2} value={shippingDetails} onChange={(e) => setShippingDetails(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm resize-none" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Payment Note:</label>
            <textarea rows={2} value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm resize-none" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Additional Notes:</label>
            <textarea rows={2} value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm resize-none" />
          </div>
          <div className="border border-slate-200 rounded p-3 bg-slate-50 text-sm">
            <div className="flex justify-between"><span>Total Paid</span><span className="font-bold">{formatCurrency(paymentAmountNum)}</span></div>
            <div className="flex justify-between"><span>Payment Due</span><span className="font-bold">{formatCurrency(paymentDue)}</span></div>
          </div>
        </div>
      </div>

      {formError && <div className="px-3 py-2 rounded border border-rose-200 bg-rose-50 text-rose-700 text-sm font-medium">{formError}</div>}
      <div className="flex justify-center pb-2">
        <button onClick={handleSave} className="px-8 py-2 rounded bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 flex items-center gap-2">
          <Save size={16} /> Save
        </button>
      </div>
    </div>
  );
};

export default AddPurchase;
