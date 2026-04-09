import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, DollarSign, Banknote, ChevronDown, CreditCard, Paperclip } from 'lucide-react';
import { useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import { addRegisterTransaction, getActiveRegisterSession } from '@/utils/registerLedger';
import {
  clampPrecision,
  normalizePrefix,
  sanitizeDecimalInput,
  toFixedPrecision,
} from '@/utils/paymentUtils';
import {
  buildPaymentAccountOptions,
  PAYMENT_ACCOUNTS_UPDATED_EVENT,
  resolveDefaultAccountFromMethod,
} from '@/utils/paymentAccounts';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: any;
  onSave?: (payment: any) => void;
  paymentType?: 'received' | 'sent';
  documentLabel?: string;
}

const normalizeText = (value: unknown) => String(value ?? '').trim().toLowerCase();

const AddPaymentModal: React.FC<AddPaymentModalProps> = ({
  isOpen,
  onClose,
  sale,
  onSave = (_payment: any) => {},
  paymentType = 'received',
  documentLabel = 'Invoice No.',
}) => {
  const { currentUser, settings, formatCurrency, customers, locations } = useGlobalContext();
  const { addNotification } = useNotifications();
  const currencyPrecision = clampPrecision(Number(settings.currencyPrecision ?? 3));
  const customerRecord = customers.find(c => {
    if (sale?.customerId && c.id === String(sale.customerId).trim()) return true;
    if (sale?.customerName && c.businessName?.toLowerCase().trim() === String(sale.customerName).toLowerCase().trim()) return true;
    return false;
  });
  const customerRebatePercent = Number(customerRecord?.rebatePercent || 0);
  const activeLocation = useMemo(
    () => locations.find(location => location.name === sale?.location),
    [locations, sale?.location]
  );
  const paymentMethodOptions = useMemo(() => {
    const enabledLocationMethods = (activeLocation?.paymentMethods || []).filter(pm => pm.enabled);
    return enabledLocationMethods.length > 0
      ? enabledLocationMethods.map(pm => pm.name)
      : ['Cash', 'Card', 'Cheque', 'Bank Transfer', 'Emad'];
  }, [activeLocation?.paymentMethods]);
  const [amount, setAmount] = useState('0');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  const [method, setMethod] = useState('Cash');
  const [account, setAccount] = useState('Cash Account');
  const [accountOptionsVersion, setAccountOptionsVersion] = useState(0);
  const [note, setNote] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [rebateEnabled, setRebateEnabled] = useState(false);
  const [chequeDate, setChequeDate] = useState('');
  const [chequeNo, setChequeNo] = useState('');
  const [chequeBankName, setChequeBankName] = useState('');
  const [chequeDrawerName, setChequeDrawerName] = useState('');
  const defaultAccountFromMethod = (methodName: string) =>
    resolveDefaultAccountFromMethod(methodName, activeLocation);
  const paymentAccountOptions = useMemo(() => (
    buildPaymentAccountOptions({
      locations,
      activeLocationName: sale?.location || '',
      methodName: method,
      additionalAccountNames: [account],
      includeNone: false,
      includeStoredAccounts: true,
    })
  ), [locations, sale?.location, method, account, accountOptionsVersion]);
  const resolvePaymentAccount = () => {
    const selectedAccount = String(account || '').trim();
    if (selectedAccount && paymentAccountOptions.includes(selectedAccount)) {
      return selectedAccount;
    }
    const suggestedAccount = String(defaultAccountFromMethod(method) || '').trim();
    if (suggestedAccount) return suggestedAccount;
    return String(paymentAccountOptions.find(Boolean) || '').trim();
  };

  useEffect(() => {
    if (!isOpen) return;
    setAmount(toFixedPrecision(sale?.sellDue || 0, currencyPrecision));
    setDate(new Date().toISOString().slice(0, 16));
    setMethod(paymentMethodOptions[0] || settings.defaultSalePaymentMethod || 'Cash');
    setNote('');
    setAttachmentName('');
    setRebateEnabled(customerRebatePercent > 0);
    setChequeDate('');
    setChequeNo('');
    setChequeBankName('');
    setChequeDrawerName('');
  }, [isOpen, sale, settings.defaultSalePaymentMethod, paymentMethodOptions, currencyPrecision, customerRebatePercent]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleAccountsUpdated = () => setAccountOptionsVersion(prev => prev + 1);
    window.addEventListener(PAYMENT_ACCOUNTS_UPDATED_EVENT, handleAccountsUpdated as EventListener);
    return () => window.removeEventListener(PAYMENT_ACCOUNTS_UPDATED_EVENT, handleAccountsUpdated as EventListener);
  }, []);

  useEffect(() => {
    if (paymentMethodOptions.includes(method)) return;
    setMethod(paymentMethodOptions[0] || settings.defaultSalePaymentMethod || 'Cash');
  }, [paymentMethodOptions, method, settings.defaultSalePaymentMethod]);

  useEffect(() => {
    const suggested = defaultAccountFromMethod(method) || 'Cash Account';
    if (!account || !paymentAccountOptions.includes(account)) {
      setAccount(suggested);
    }
  }, [method, paymentAccountOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const paymentAmountPreview = Math.max(0, Number(amount) || 0);
  const rebateAmount = (rebateEnabled && customerRebatePercent > 0)
    ? Number((paymentAmountPreview * customerRebatePercent / 100).toFixed(currencyPrecision))
    : 0;

  const handleSave = () => {
    const paymentAmount = parseFloat(toFixedPrecision(amount, currencyPrecision));
    if (!sale) return;
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      addNotification({
        title: 'Invalid payment amount',
        message: 'Enter a payment amount greater than 0.',
        type: 'error',
      });
      return;
    }
    const normalizedSaleStatus = String(sale.status || sale.saleStatus || '').trim();
    if (paymentType === 'received' && normalizedSaleStatus && normalizedSaleStatus !== 'Final') {
      addNotification({
        title: 'Payment blocked',
        message: 'Payment can only be added to Final sales.',
        type: 'warning',
      });
      return;
    }
    const paymentPrefix = normalizePrefix(settings.sellPaymentPrefix || settings.paymentPrefix, 'PAY');
    const referenceNo = `${paymentPrefix}-${Date.now().toString().slice(-6)}`;
    const linkedDocumentNo = String(sale.invoiceNo || '').trim();
    const resolvedAccount = resolvePaymentAccount();
    if (!resolvedAccount) {
      addNotification({
        title: 'Payment account required',
        message: 'No payment account is configured for this method/location. Configure payment accounts and try again.',
        type: 'error',
      });
      return;
    }
    onSave({
      id: `PAY-${Date.now()}`,
      date,
      contactId: sale.customerId?.toString() || '',
      contactName: sale.customerName || '',
      contactType: 'Customer',
      amount: paymentAmount,
      method,
      account: resolvedAccount,
      location: sale.location || '',
      referenceNo,
      note,
      type: paymentType,
      addedBy: currentUser?.name || 'Admin',
      linkedInvoices: linkedDocumentNo ? [linkedDocumentNo] : [],
      strictLinkedAllocation: Boolean(linkedDocumentNo),
      attachmentName: attachmentName || undefined,
      rebatePercent: rebateEnabled && customerRebatePercent > 0 ? customerRebatePercent : undefined,
      rebateAmount: rebateEnabled && rebateAmount > 0 ? rebateAmount : undefined,
      rebateApplied: rebateEnabled && rebateAmount > 0,
      ...(method === 'Cheque' && chequeDate ? {
        chequeDate,
        chequeNo: chequeNo || undefined,
        bankName: chequeBankName || undefined,
        drawerName: chequeDrawerName || undefined,
      } : {}),
    });
    const activeRegister = getActiveRegisterSession();
    const paymentLocation = normalizeText(sale.location);
    const registerLocation = normalizeText(activeRegister?.locationName);
    if (activeRegister && (!paymentLocation || paymentLocation === registerLocation)) {
      addRegisterTransaction({
        id: `RTX-PAY-${Date.now()}`,
        sessionId: activeRegister.id,
        date: new Date().toISOString(),
        type: paymentType === 'sent' ? 'expense' : 'payment',
        amount: paymentAmount,
        method,
        invoiceNo: sale.invoiceNo,
        note: paymentType === 'sent'
          ? `Refund sent for ${sale.invoiceNo || 'credit note'}`
          : `Payment received for ${sale.invoiceNo || 'invoice'}`,
        addedBy: currentUser?.name || 'Admin',
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 relative">
        {/* Gradient accent bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <CreditCard size={20} className="text-emerald-600" />
            {paymentType === 'sent' ? 'Send Payment / Refund' : 'Add Payment'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Invoice info cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Customer</p>
              <p className="text-sm font-bold text-slate-800 truncate">{sale?.customerName || '--'}</p>
              <p className="text-xs text-slate-500 truncate">{sale?.businessName || ''}</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{documentLabel}</p>
              <p className="text-sm font-bold text-slate-800">{sale?.invoiceNo || '--'}</p>
              <p className="text-xs text-slate-500">{sale?.location || '--'}</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Amount Due</p>
              <p className="text-sm font-black text-rose-600">{formatCurrency(sale?.sellDue ?? sale?.grandTotal ?? 0)}</p>
              {(customerRecord?.advanceBalance ?? 0) > 0 && (
                <p className="text-xs text-emerald-600 font-bold">Advance: {formatCurrency(customerRecord?.advanceBalance || 0)}</p>
              )}
            </div>
          </div>

          {/* Payment fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Method *</label>
              <div className="relative">
                <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <select
                  className="w-full pl-9 pr-8 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  {paymentMethodOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Paid On *</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="datetime-local"
                  className="w-full pl-9 pr-3 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-medium text-slate-700"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Amount *</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  inputMode="decimal"
                  className="w-full pl-9 pr-3 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-bold text-slate-800"
                  value={amount}
                  onChange={(e) => setAmount(sanitizeDecimalInput(e.target.value, currencyPrecision))}
                  onBlur={() => setAmount(toFixedPrecision(amount || 0, currencyPrecision))}
                />
              </div>
            </div>
          </div>

          {/* Rebate section — only shown for rebate customers */}
          {customerRebatePercent > 0 && paymentType !== 'sent' && (
            <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-50 border border-amber-200">
              <div>
                <p className="text-sm font-bold text-amber-800">
                  {customerRebatePercent}% Rebate — write-off: {formatCurrency(rebateAmount)}
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {rebateEnabled
                    ? `Company nets: ${formatCurrency(Math.max(0, paymentAmountPreview - rebateAmount))}`
                    : 'Rebate disabled for this payment'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRebateEnabled(v => !v)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                  rebateEnabled ? 'bg-amber-500' : 'bg-slate-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  rebateEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          )}

          {/* Cheque details — only shown when method is Cheque */}
          {method === 'Cheque' && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3">
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Cheque Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cheque Date *</label>
                  <input type="date" value={chequeDate} onChange={e => setChequeDate(e.target.value)}
                    className="w-full rounded-xl bg-white border border-amber-200 px-3 py-2.5 text-sm focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cheque No.</label>
                  <input type="text" placeholder="e.g. 001234" value={chequeNo} onChange={e => setChequeNo(e.target.value)}
                    className="w-full rounded-xl bg-white border border-amber-200 px-3 py-2.5 text-sm focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bank</label>
                  <input type="text" placeholder="e.g. Bank Muscat" value={chequeBankName} onChange={e => setChequeBankName(e.target.value)}
                    className="w-full rounded-xl bg-white border border-amber-200 px-3 py-2.5 text-sm focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Drawer Name</label>
                  <input type="text" placeholder="Name on cheque" value={chequeDrawerName} onChange={e => setChequeDrawerName(e.target.value)}
                    className="w-full rounded-xl bg-white border border-amber-200 px-3 py-2.5 text-sm focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400 outline-none" />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Account</label>
              <div className="relative">
                <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <select
                  className="w-full pl-9 pr-8 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                >
                  {paymentAccountOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Attach Document</label>
              <label className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer transition-all">
                <Paperclip size={16} className="text-slate-400 shrink-0" />
                <span className="text-sm text-slate-500 truncate">{attachmentName || 'Choose file…'}</span>
                <input
                  type="file"
                  accept=".pdf,.csv,.zip,.doc,.docx,.jpeg,.jpg,.png"
                  className="hidden"
                  onChange={(e) => setAttachmentName(e.target.files?.[0]?.name || '')}
                />
              </label>
              <p className="text-[10px] text-slate-400 mt-1">pdf, csv, zip, doc, jpeg, jpg, png</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Note</label>
            <textarea
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 resize-none"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note…"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
          <button onClick={onClose} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition">
            Cancel
          </button>
          <button onClick={handleSave} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition shadow-md flex items-center gap-2 active:scale-95">
            <CreditCard size={16} /> Save Payment
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddPaymentModal;
