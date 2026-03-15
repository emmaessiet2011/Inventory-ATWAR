import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calendar, CornerUpLeft, Printer, Save, Trash2 } from 'lucide-react';
import { SellReturn, SellReturnSettlementMode, useGlobalContext } from '../src/context/GlobalContext';
import { useNotifications } from '../src/context/NotificationContext';
import { printCreditNote } from '../src/utils/printUtils';

interface AddSellReturnProps {
  onNavigate: (page: string) => void;
}

interface ReturnRow {
  rowId: string;
  productId: string;
  name: string;
  unitPrice: number;
  soldQty: number;
  returnQty: number;
  unit?: string;
}

const AddSellReturn: React.FC<AddSellReturnProps> = ({ onNavigate }) => {
  const { addNotification } = useNotifications();
  const {
    sales,
    sellReturns,
    addSellReturn: globalAddSellReturn,
    updateSellReturn: globalUpdateSellReturn,
    taxRates,
    formatCurrency,
    currentUser,
    settings,
    roles,
  } = useGlobalContext();

  const getNowLocalDateTime = () => {
    const now = new Date();
    now.setSeconds(0, 0);
    const tzOffsetMs = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 16);
  };

  const [saleId, setSaleId] = useState<string>('');
  const [editingReturnId, setEditingReturnId] = useState<string>('');
  const [returnDate, setReturnDate] = useState(getNowLocalDateTime());
  const [discountType, setDiscountType] = useState<'None' | 'Fixed' | 'Percentage'>('None');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [returnTax, setReturnTax] = useState<string>('None');
  const [settlementMode, setSettlementMode] = useState<SellReturnSettlementMode>('apply_to_invoice_due');
  const [returnNote, setReturnNote] = useState('');
  const [rows, setRows] = useState<ReturnRow[]>([]);

  const currentRoleRecord = roles.find(role => role.name === currentUser?.role);
  const rolePermissions = currentRoleRecord?.permissions || [];
  const roleHasExplicitPermissions = rolePermissions.length > 0;
  const hasRolePermission = (moduleName: string, permission: string) => {
    if (!currentUser) return false;
    if (String(currentUser.role || '').toLowerCase() === 'admin' || currentRoleRecord?.isSystem) return true;
    if (!roleHasExplicitPermissions) return true;
    return rolePermissions.includes(permission) || rolePermissions.includes(`${moduleName}::${permission}`);
  };

  const canAccessAllSellReturns = hasRolePermission('Sell', 'Access all sell return');
  const canAccessOwnSellReturns = hasRolePermission('Sell', 'Access own sell return');
  const canAccessSellReturns = canAccessAllSellReturns || canAccessOwnSellReturns;
  const ownerName = String(currentUser?.name || '').trim().toLowerCase();
  const isOwnRecord = (addedBy?: string) =>
    ownerName.length > 0 && String(addedBy || '').trim().toLowerCase() === ownerName;

  useEffect(() => {
    if (canAccessSellReturns) return;
    addNotification({
      title: 'Permission denied',
      message: 'You do not have permission to access sell returns.',
      type: 'error',
    });
    onNavigate('returns');
  }, [canAccessSellReturns, addNotification, onNavigate]);

  useEffect(() => {
    const linkedSaleId = localStorage.getItem('app_sell_return_sale_id') || '';
    const editId = localStorage.getItem('app_edit_sell_return_id') || '';

    if (editId) {
      if (editingReturnId === editId) return;
      const existing = sellReturns.find(ret => ret.id === editId);
      if (!existing) return;

      const hasReturnAccess =
        canAccessAllSellReturns ||
        (canAccessOwnSellReturns &&
          ownerName.length > 0 &&
          String(existing.addedBy || '').trim().toLowerCase() === ownerName);
      if (!hasReturnAccess) {
        addNotification({
          title: 'Permission denied',
          message: 'You do not have permission to edit this sell return.',
          type: 'error',
        });
        localStorage.removeItem('app_edit_sell_return_id');
        localStorage.removeItem('app_sell_return_sale_id');
        onNavigate('returns');
        return;
      }

      setEditingReturnId(existing.id);
      setSaleId(existing.parentSaleId || linkedSaleId || '');
      setReturnDate(existing.date || getNowLocalDateTime());
      setDiscountType(existing.discountType || 'None');
      setDiscountAmount(Number(existing.discountAmount || 0));
      setReturnTax(existing.tax || 'None');
      const inferredMode: SellReturnSettlementMode = (() => {
        const mode = String(existing.settlementMode || '').trim();
        if (
          mode === 'refund_due' ||
          mode === 'refund_now' ||
          mode === 'apply_to_invoice_due' ||
          mode === 'customer_credit'
        ) {
          return mode as SellReturnSettlementMode;
        }
        const total = Number(existing.total || 0);
        const due = Number(existing.paymentDue || 0);
        if (due > total + 0.001) return 'refund_due';
        if (due > 0.001) return 'refund_due';
        if (Number(existing.appliedToSaleDue || 0) > 0.001) return 'apply_to_invoice_due';
        if (Number(existing.creditedToAdvance || 0) > 0.001) return 'customer_credit';
        return 'refund_due';
      })();
      setSettlementMode(inferredMode);
      setReturnNote(existing.note || '');
      return;
    }

    if (!saleId && linkedSaleId) {
      setSaleId(linkedSaleId);
    }
  }, [
    sellReturns,
    canAccessAllSellReturns,
    canAccessOwnSellReturns,
    ownerName,
    addNotification,
    onNavigate,
    editingReturnId,
    saleId,
  ]);

  const finalSales = useMemo(
    () => sales.filter(s => {
      if ((s.status || s.saleStatus) !== 'Final') return false;
      if (canAccessAllSellReturns) return true;
      if (!canAccessOwnSellReturns) return false;
      return ownerName.length > 0 && String(s.addedBy || '').trim().toLowerCase() === ownerName;
    }),
    [sales, canAccessAllSellReturns, canAccessOwnSellReturns, ownerName]
  );

  const editingReturn = useMemo(
    () => sellReturns.find(ret => ret.id === editingReturnId),
    [sellReturns, editingReturnId]
  );

  const selectedSale = useMemo(
    () => finalSales.find(s => s.id === saleId),
    [finalSales, saleId]
  );

  const selectedSaleDue = useMemo(() => {
    if (!selectedSale) return 0;
    const due = typeof selectedSale.sellDue === 'number'
      ? Number(selectedSale.sellDue || 0)
      : Math.max(0, Number(selectedSale.grandTotal || selectedSale.totalAmount || 0) - Number(selectedSale.totalPaid || 0));
    return Number(Math.max(0, due).toFixed(3));
  }, [selectedSale]);

  const canAccessSaleRecord = (sale?: { addedBy?: string } | null) =>
    !!sale && (canAccessAllSellReturns || (canAccessOwnSellReturns && isOwnRecord(sale.addedBy)));
  const canAccessReturnRecord = (record?: { addedBy?: string } | null) =>
    !!record && (canAccessAllSellReturns || (canAccessOwnSellReturns && isOwnRecord(record.addedBy)));

  const returnedElseByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    sellReturns
      .filter(ret => ret.parentSaleId === saleId && ret.id !== editingReturnId)
      .forEach(ret => {
        (ret.items || []).forEach(item => {
          const key = String(item.productId || '').trim();
          if (!key) return;
          map[key] = (map[key] || 0) + Number(item.qty || 0);
        });
      });
    return map;
  }, [sellReturns, saleId, editingReturnId]);

  const maxReturnQtyForRow = (row: ReturnRow): number =>
    Math.max(0, Number(row.soldQty || 0) - Number(returnedElseByProduct[row.productId] || 0));

  useEffect(() => {
    if (!selectedSale) {
      setRows([]);
      return;
    }
    const existingQtyByProduct: Record<string, number> = {};
    if (editingReturn && editingReturn.parentSaleId === selectedSale.id) {
      (editingReturn.items || []).forEach(item => {
        const key = String(item.productId || '').trim();
        if (!key) return;
        existingQtyByProduct[key] = (existingQtyByProduct[key] || 0) + Number(item.qty || 0);
      });
    }

    const mappedRows = (selectedSale.items || []).map((item, index) => {
      const productId = String(item.id || `sale-item-${index + 1}`);
      return {
        rowId: `${productId}-${index + 1}`,
        productId,
        name: item.name || 'Unnamed Product',
        unitPrice: Number(item.unitPrice || 0),
        soldQty: Number(item.qty || 0),
        returnQty: Number((existingQtyByProduct[productId] || 0).toFixed(3)),
        unit: item.unit || '',
      };
    });

    setRows(mappedRows);
    if (!editingReturn) {
      setReturnTax(String(selectedSale.tax || selectedSale.orderTax || 'None'));
    }
  }, [selectedSale, editingReturn]);

  useEffect(() => {
    if (editingReturnId) return;
    if (!selectedSale) {
      setSettlementMode('refund_now');
      return;
    }
    setSettlementMode(selectedSaleDue > 0.001 ? 'apply_to_invoice_due' : 'customer_credit');
  }, [editingReturnId, selectedSale, selectedSaleDue]);

  useEffect(() => {
    if (!editingReturn) return;
    const total = Number(editingReturn.total || 0);
    const due = Number(editingReturn.paymentDue || 0);
    if (due > total + 0.001 && settlementMode !== 'refund_due') {
      setSettlementMode('refund_due');
    }
  }, [editingReturn, settlementMode]);

  const clearStoredReturnLinks = () => {
    localStorage.removeItem('app_sell_return_sale_id');
    localStorage.removeItem('app_edit_sell_return_id');
  };

  const buildNextReferenceNo = (): string => {
    const prefixRaw = String(settings.sellReturnPrefix || 'CN').trim() || 'CN';
    const prefix = prefixRaw.endsWith('-') ? prefixRaw : `${prefixRaw}-`;
    const year = new Date(returnDate || Date.now()).getFullYear();
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escapedPrefix}${year}-(\\d+)$`, 'i');
    let maxSerial = 0;
    sellReturns.forEach(ret => {
      const match = String(ret.referenceNo || '').trim().match(pattern);
      if (!match) return;
      const serial = Number(match[1]);
      if (Number.isFinite(serial)) maxSerial = Math.max(maxSerial, serial);
    });
    return `${prefix}${year}-${String(maxSerial + 1).padStart(4, '0')}`;
  };

  const setRowReturnQty = (rowId: string, value: string) => {
    const qty = Number(value);
    setRows(prev => prev.map(row => {
      if (row.rowId !== rowId) return row;
      const normalized = Number.isFinite(qty) ? Math.max(0, qty) : 0;
      const maxAllowed = maxReturnQtyForRow(row);
      return { ...row, returnQty: Number(Math.min(normalized, maxAllowed).toFixed(3)) };
    }));
  };

  const subTotal = useMemo(
    () => rows.reduce((sum, row) => sum + (row.returnQty * row.unitPrice), 0),
    [rows]
  );

  const discountValue = useMemo(() => {
    if (discountType === 'Fixed') return Math.max(0, discountAmount);
    if (discountType === 'Percentage') return Math.max(0, subTotal * (discountAmount / 100));
    return 0;
  }, [discountType, discountAmount, subTotal]);

  const taxValue = useMemo(() => {
    const taxableBase = Math.max(0, subTotal - discountValue);
    const taxObj = taxRates.find(t => t.name === returnTax);
    if (!taxObj) return 0;
    return taxableBase * (Number(taxObj.rate || 0) / 100);
  }, [subTotal, discountValue, taxRates, returnTax]);

  const totalReturn = Math.max(0, subTotal - discountValue + taxValue);

  const existingPaid = useMemo(
    () => editingReturn
      ? Math.max(0, Number(editingReturn.total || 0) - Number(editingReturn.paymentDue || 0))
      : 0,
    [editingReturn]
  );

  const settlementPreview = useMemo(() => {
    const total = Number(totalReturn.toFixed(3));
    if (settlementMode === 'apply_to_invoice_due') {
      const applied = Number(Math.min(total, selectedSaleDue).toFixed(3));
      const credited = Number(Math.max(0, total - applied).toFixed(3));
      return { appliedToInvoice: applied, creditedToAdvance: credited, refundNow: 0, paymentDue: 0 };
    }
    if (settlementMode === 'customer_credit') {
      return { appliedToInvoice: 0, creditedToAdvance: total, refundNow: 0, paymentDue: 0 };
    }
    if (settlementMode === 'refund_now') {
      return { appliedToInvoice: 0, creditedToAdvance: 0, refundNow: total, paymentDue: 0 };
    }
    const paymentDue = Number(Math.min(total, Math.max(0, total - existingPaid)).toFixed(3));
    return { appliedToInvoice: 0, creditedToAdvance: 0, refundNow: 0, paymentDue };
  }, [totalReturn, selectedSaleDue, settlementMode, existingPaid]);

  const showLegacyRefundDueOption = useMemo(() => (
    settlementMode === 'refund_due'
    || Number(editingReturn?.paymentDue || 0) > 0.001
  ), [settlementMode, editingReturn?.paymentDue]);

  const handleClearRow = (rowId: string) => {
    setRows(prev => prev.map(row => row.rowId === rowId ? { ...row, returnQty: 0 } : row));
  };

  /** Validates form and builds the return record. Returns null if validation fails. */
  const buildReturnRecord = (): SellReturn | null => {
    if (!canAccessSellReturns) {
      addNotification({ title: 'Permission denied', message: 'You do not have permission to manage sell returns.', type: 'error' });
      return null;
    }
    if (editingReturn && !canAccessReturnRecord(editingReturn)) {
      addNotification({ title: 'Permission denied', message: 'You do not have permission to edit this sell return.', type: 'error' });
      return null;
    }
    if (!selectedSale) {
      addNotification({ title: 'Validation', message: 'Please select a parent sale first.', type: 'error' });
      return null;
    }
    if (!canAccessSaleRecord(selectedSale)) {
      addNotification({ title: 'Permission denied', message: 'You can only return sales that you own.', type: 'error' });
      return null;
    }
    if (!rows.some(row => row.returnQty > 0)) {
      addNotification({ title: 'Validation', message: 'Enter at least one return quantity.', type: 'error' });
      return null;
    }
    const invalidRow = rows.find(row => row.returnQty > maxReturnQtyForRow(row));
    if (invalidRow) {
      addNotification({ title: 'Validation', message: `Return quantity for "${invalidRow.name}" exceeds available quantity.`, type: 'error' });
      return null;
    }
    if (!settlementMode) {
      addNotification({ title: 'Validation', message: 'Please choose a settlement option.', type: 'error' });
      return null;
    }

    const returnItems = rows
      .filter(row => row.returnQty > 0)
      .map(row => ({
        productId: row.productId,
        productName: row.name,
        qty: Number(row.returnQty.toFixed(3)),
        unitPrice: Number(row.unitPrice.toFixed(3)),
        lineTotal: Number((row.returnQty * row.unitPrice).toFixed(3)),
        soldQty: Number(row.soldQty.toFixed(3)),
        unit: row.unit || '',
      }));

    const referenceNo = editingReturn?.referenceNo || buildNextReferenceNo();
    const roundedTotalReturn = Number(totalReturn.toFixed(3));
    const computedAppliedToSaleDue = Number(settlementPreview.appliedToInvoice.toFixed(3));
    const computedCreditToAdvance = Number(settlementPreview.creditedToAdvance.toFixed(3));
    const computedPaymentDue = settlementMode === 'refund_due'
      ? Number(settlementPreview.paymentDue.toFixed(3))
      : 0;
    const computedPaymentStatus: SellReturn['paymentStatus'] = computedPaymentDue <= 0.001
      ? 'Paid'
      : computedPaymentDue < roundedTotalReturn - 0.001
        ? 'Partial'
        : 'Due';

    return {
      id: editingReturn?.id || `SELL-RET-${Date.now()}`,
      referenceNo,
      parentSaleId: selectedSale.id,
      parentInvoiceNo: selectedSale.invoiceNo,
      date: returnDate,
      customerId: String(selectedSale.customerId || ''),
      customerName: selectedSale.customerName || 'Walk-in Customer',
      location: selectedSale.location || '--',
      discountType,
      discountAmount: Number(discountAmount || 0),
      tax: returnTax,
      subTotal: Number(subTotal.toFixed(3)),
      taxAmount: Number(taxValue.toFixed(3)),
      total: roundedTotalReturn,
      settlementMode,
      appliedToSaleDue: computedAppliedToSaleDue,
      creditedToAdvance: computedCreditToAdvance,
      paymentStatus: computedPaymentStatus,
      paymentDue: computedPaymentDue,
      note: returnNote,
      items: returnItems,
      addedBy: currentUser?.name || 'Admin',
    };
  };

  const handleSubmit = () => {
    const returnRecord = buildReturnRecord();
    if (!returnRecord) return;
    if (editingReturn) {
      globalUpdateSellReturn(returnRecord);
    } else {
      globalAddSellReturn(returnRecord);
    }
    clearStoredReturnLinks();
    addNotification({
      title: editingReturn ? 'Sell Return Updated' : 'Sell Return Saved',
      message: `Credit note ${returnRecord.referenceNo} was ${editingReturn ? 'updated' : 'recorded'}.`,
      type: 'success',
    });
    onNavigate('returns');
  };

  const handleSaveAndPrint = () => {
    const returnRecord = buildReturnRecord();
    if (!returnRecord) return;
    if (editingReturn) {
      globalUpdateSellReturn(returnRecord);
    } else {
      globalAddSellReturn(returnRecord);
    }
    clearStoredReturnLinks();
    addNotification({
      title: editingReturn ? 'Sell Return Updated' : 'Sell Return Saved',
      message: `Credit note ${returnRecord.referenceNo} was ${editingReturn ? 'updated' : 'recorded'}.`,
      type: 'success',
    });
    // Print credit note in new window
    const businessName = settings.businessName || 'ATWAR AL MUSTAQBAL';
    printCreditNote({
      referenceNo: returnRecord.referenceNo,
      parentInvoiceNo: returnRecord.parentInvoiceNo || '--',
      date: returnRecord.date,
      customerName: returnRecord.customerName,
      location: returnRecord.location,
      items: returnRecord.items.map(item => ({
        name: item.productName || item.productId,
        returnQty: Number(item.qty || 0),
        unitPrice: Number(item.unitPrice || 0),
        lineTotal: Number(item.lineTotal || 0),
        unit: item.unit || '',
      })),
      subTotal: returnRecord.subTotal,
      discountValue,
      taxValue,
      total: returnRecord.total,
      settlementMode: returnRecord.settlementMode,
      appliedToInvoice: returnRecord.appliedToSaleDue,
      creditedToAdvance: returnRecord.creditedToAdvance,
      refundNow: settlementPreview.refundNow,
      paymentDue: returnRecord.paymentDue,
      note: returnRecord.note,
      businessName,
      businessAddress: settings.address || undefined,
      printedBy: currentUser?.name || undefined,
      fmtSubTotal: formatCurrency(returnRecord.subTotal),
      fmtDiscount: formatCurrency(discountValue),
      fmtTax: formatCurrency(taxValue),
      fmtTotal: formatCurrency(returnRecord.total),
      fmtApplied: formatCurrency(returnRecord.appliedToSaleDue),
      fmtCredit: formatCurrency(returnRecord.creditedToAdvance),
      fmtRefund: formatCurrency(settlementPreview.refundNow),
      fmtDue: formatCurrency(returnRecord.paymentDue),
    });
    onNavigate('returns');
  };

  if (!canAccessSellReturns) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400">
        <h2 className="text-2xl font-bold text-slate-300 mb-2">Access Denied</h2>
        <p>You do not have permission to create sell returns.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            clearStoredReturnLinks();
            onNavigate('returns');
          }}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="p-2.5 bg-rose-600 rounded-2xl shadow-md">
          <CornerUpLeft size={22} className="text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            {editingReturn ? 'Edit Sell Return' : 'Add Sell Return'}
          </h2>
          <p className="text-slate-500 mt-0.5 text-sm">Credit note / return against a finalized invoice</p>
        </div>
      </div>

      {/* Return Info Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
          <Calendar size={18} className="text-blue-500" /> Return Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Parent Sale *</label>
            <select
              value={saleId}
              onChange={(e) => setSaleId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
            >
              <option value="">Select Invoice</option>
              {finalSales.map(sale => (
                <option key={sale.id} value={sale.id}>{sale.invoiceNo} - {sale.customerName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Date *</label>
            <div className="relative">
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="datetime-local"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full pl-9 pr-3 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Settlement *</label>
            <select
              value={settlementMode}
              onChange={(e) => setSettlementMode(e.target.value as SellReturnSettlementMode)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
            >
              <option value="refund_now">Refund now</option>
              <option value="apply_to_invoice_due">Apply to this invoice due</option>
              <option value="customer_credit">Keep as customer credit</option>
              {showLegacyRefundDueOption && <option value="refund_due">Refund later (legacy)</option>}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Discount Type</label>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as 'None' | 'Fixed' | 'Percentage')}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
            >
              <option value="None">None</option>
              <option value="Fixed">Fixed</option>
              <option value="Percentage">Percentage</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Discount Amount</label>
            <input
              type="number"
              min={0}
              value={discountAmount}
              onChange={(e) => setDiscountAmount(Number(e.target.value || 0))}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
            />
          </div>
        </div>

        {selectedSale && (
          <div className="mt-4 text-xs text-slate-600 bg-blue-50 border border-blue-100 rounded-xl p-3">
            Invoice: <span className="font-bold text-slate-800">{selectedSale.invoiceNo}</span> | Customer: <span className="font-bold text-slate-800">{selectedSale.customerName}</span> | Location: <span className="font-bold text-slate-800">{selectedSale.location || '--'}</span>
            <span className="ml-2">| Invoice Due: <span className="font-bold text-blue-700">{formatCurrency(selectedSaleDue)}</span></span>
          </div>
        )}
      </div>

      {/* Return Items Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-red-600"></div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
          <CornerUpLeft size={18} className="text-rose-500" /> Return Items
        </h3>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-right">Sold Qty</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-right">Return Qty</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Select a sale to load items.</td>
                </tr>
              )}
              {rows.map(row => (
                <tr key={row.rowId} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-slate-800 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{row.soldQty.toFixed(3)} {row.unit || ''}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(row.unitPrice)}</td>
                  <td className="px-4 py-3 text-right">
                    <input
                       type="number"
                       min={0}
                       step="0.001"
                       value={row.returnQty}
                       max={maxReturnQtyForRow(row)}
                       onChange={(e) => setRowReturnQty(row.rowId, e.target.value)}
                       className="w-28 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-right focus:outline-none focus:border-blue-500 focus:bg-white text-sm font-medium"
                     />
                     <div className="text-[10px] text-slate-400 mt-1">Max {maxReturnQtyForRow(row).toFixed(3)}</div>
                   </td>
                   <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(row.returnQty * row.unitPrice)}</td>
                   <td className="px-4 py-3 text-center">
                     <button onClick={() => handleClearRow(row.rowId)} className="text-rose-500 hover:text-rose-700 transition-colors">
                       <Trash2 size={14} />
                     </button>
                   </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start mt-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Return Tax</label>
            <select
              value={returnTax}
              onChange={(e) => setReturnTax(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
            >
              <option value="None">None</option>
              {taxRates.map(rate => (
                <option key={rate.id} value={rate.name}>{rate.name}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Return Note</label>
            <textarea
              rows={3}
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Totals & Settlement Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500"></div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
          <Save size={18} className="text-amber-500" /> Totals & Settlement
        </h3>

        <div className="ml-auto w-full max-w-sm bg-slate-50 rounded-2xl border border-slate-200 p-4 text-sm space-y-2">
          <div className="flex justify-between text-slate-700"><span>Subtotal</span><span>{formatCurrency(subTotal)}</span></div>
          <div className="flex justify-between text-slate-700"><span>Discount</span><span>(-) {formatCurrency(discountValue)}</span></div>
          <div className="flex justify-between text-slate-700"><span>Order Tax</span><span>(+) {formatCurrency(taxValue)}</span></div>
          <div className="border-t border-slate-300 pt-2 mt-2 flex justify-between font-black text-base text-slate-900">
            <span>Return Total</span>
            <span>{formatCurrency(totalReturn)}</span>
          </div>
          <div className="pt-2 border-t border-slate-300 text-xs text-slate-700 space-y-1.5">
            <div className="flex justify-between">
              <span>Apply to invoice due</span>
              <span className="font-bold">{formatCurrency(settlementPreview.appliedToInvoice)}</span>
            </div>
            <div className="flex justify-between">
              <span>Customer credit</span>
              <span className="font-bold">{formatCurrency(settlementPreview.creditedToAdvance)}</span>
            </div>
            <div className="flex justify-between">
              <span>Refund now</span>
              <span className="font-bold">{formatCurrency(settlementPreview.refundNow)}</span>
            </div>
            <div className="flex justify-between">
              <span>Return due</span>
              <span className="font-bold">{formatCurrency(settlementPreview.paymentDue)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={handleSaveAndPrint} className="bg-slate-700 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition shadow-md flex items-center gap-2 active:scale-95">
            <Printer size={16} /> Save &amp; Print
          </button>
          <button onClick={handleSubmit} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-md flex items-center gap-2 active:scale-95">
            <Save size={16} /> {editingReturn ? 'Update' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddSellReturn;
