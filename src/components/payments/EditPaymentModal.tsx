import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, CalendarIcon, Banknote, DollarSign, ChevronDown, CreditCard, Paperclip, Edit2 } from 'lucide-react';
import { useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import {
  clampPrecision,
  sanitizeDecimalInput,
  toDateTimeLocalInput,
  toFixedPrecision,
} from '@/utils/paymentUtils';
import {
  buildPaymentAccountOptions,
  PAYMENT_ACCOUNTS_UPDATED_EVENT,
  resolveDefaultAccountFromMethod,
} from '@/utils/paymentAccounts';

interface EditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: any;
  customer: any;
  onSave: (updatedPayment: any) => void;
}

const EditPaymentModal: React.FC<EditPaymentModalProps> = ({ isOpen, onClose, payment, customer, onSave }) => {
  const { formatCurrency, settings, locations } = useGlobalContext();
  const { addNotification } = useNotifications();
  const currencyPrecision = clampPrecision(Number(settings.currencyPrecision ?? 3));
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentAccount, setPaymentAccount] = useState('Cash Account');
  const [accountOptionsVersion, setAccountOptionsVersion] = useState(0);
  const [paymentNote, setPaymentNote] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  const activeLocation = useMemo(
    () => locations.find(location => location.name === payment?.location),
    [locations, payment?.location]
  );

  const paymentMethodOptions = useMemo(() => {
    const methods = new Set<string>();
    (activeLocation?.paymentMethods || [])
      .filter(methodRecord => methodRecord.enabled)
      .forEach(methodRecord => methods.add(String(methodRecord.name || '').trim()));
    if (methods.size === 0) {
      ['Cash', 'Card', 'Cheque', 'Bank Transfer', 'Emad'].forEach(methodName => methods.add(methodName));
    }
    if (settings.defaultSalePaymentMethod) methods.add(settings.defaultSalePaymentMethod);
    if (payment?.method) methods.add(String(payment.method));
    return Array.from(methods).filter(Boolean);
  }, [activeLocation?.paymentMethods, payment?.method, settings.defaultSalePaymentMethod]);

  const defaultAccountFromMethod = (methodName: string) =>
    resolveDefaultAccountFromMethod(methodName, activeLocation);

  const paymentAccountOptions = useMemo(() => {
    return buildPaymentAccountOptions({
      locations,
      activeLocationName: payment?.location || '',
      methodName: paymentMethod,
      additionalAccountNames: [paymentAccount, payment?.account, payment?.paymentAccount],
      includeNone: false,
      includeStoredAccounts: true,
    });
  }, [locations, payment?.location, payment?.account, payment?.paymentAccount, paymentMethod, paymentAccount, accountOptionsVersion]);
  const resolvePaymentAccount = () => {
    const selectedAccount = String(paymentAccount || '').trim();
    if (selectedAccount && paymentAccountOptions.includes(selectedAccount)) {
      return selectedAccount;
    }
    const fallbackFromRecord = String(payment?.account || payment?.paymentAccount || '').trim();
    if (fallbackFromRecord) return fallbackFromRecord;
    const suggestedAccount = String(defaultAccountFromMethod(paymentMethod) || '').trim();
    if (suggestedAccount) return suggestedAccount;
    return String(paymentAccountOptions.find(Boolean) || '').trim();
  };

  useEffect(() => {
    if (!payment) return;
    const rawDate = payment.date || payment.paidOn || '';
    setPaymentMethod(payment.method || 'Cash');
    setPaymentDate(toDateTimeLocalInput(rawDate));
    setPaymentAmount(toFixedPrecision(payment.amount ?? 0, currencyPrecision));
    setPaymentAccount(
      String(payment.account || payment.paymentAccount || '').trim()
      || defaultAccountFromMethod(payment.method || 'Cash')
      || paymentAccountOptions.find(Boolean)
      || 'Cash Account'
    );
    setPaymentNote(payment.note || '');
    setAttachmentName(payment.attachmentName || '');
  }, [payment, currencyPrecision]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleAccountsUpdated = () => setAccountOptionsVersion(prev => prev + 1);
    window.addEventListener(PAYMENT_ACCOUNTS_UPDATED_EVENT, handleAccountsUpdated as EventListener);
    return () => window.removeEventListener(PAYMENT_ACCOUNTS_UPDATED_EVENT, handleAccountsUpdated as EventListener);
  }, []);

  useEffect(() => {
    if (paymentMethodOptions.includes(paymentMethod)) return;
    setPaymentMethod(paymentMethodOptions[0] || settings.defaultSalePaymentMethod || 'Cash');
  }, [paymentMethodOptions, paymentMethod, settings.defaultSalePaymentMethod]);

  useEffect(() => {
    const suggested = defaultAccountFromMethod(paymentMethod) || 'Cash Account';
    if (!paymentAccount || !paymentAccountOptions.includes(paymentAccount)) {
      setPaymentAccount(suggested);
    }
  }, [paymentMethod, paymentAccountOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen || !payment) return null;

  const referenceNo = payment.referenceNo || payment.refNo || '--';
  const businessName = customer?.businessName || payment.contactName || '--';

  const save = () => {
    const parsedAmount = parseFloat(toFixedPrecision(paymentAmount, currencyPrecision));
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      addNotification({ title: 'Invalid Amount', message: 'Enter a payment amount greater than 0.', type: 'error' });
      return;
    }
    const resolvedAccount = resolvePaymentAccount();
    if (!resolvedAccount) return;
    const { paymentAccount: _legacyPaymentAccount, ...normalizedPayment } = payment;
    onSave({
      ...normalizedPayment,
      method: paymentMethod,
      date: paymentDate || payment.date,
      paidOn: paymentDate || payment.paidOn || payment.date,
      amount: parsedAmount,
      account: resolvedAccount,
      note: paymentNote,
      attachmentName: attachmentName || undefined,
    });
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh] relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Edit2 size={20} className="text-emerald-600" /> Edit Payment
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-6 overflow-y-auto flex-1 space-y-5">
          {/* Info cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Customer</p>
              <p className="text-sm font-bold text-slate-800 truncate">{businessName}</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Reference No</p>
              <p className="text-sm font-bold text-slate-800">{referenceNo}</p>
              <p className="text-xs text-slate-500">{payment.location || '--'}</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Amount</p>
              <p className="text-sm font-black text-emerald-600">{formatCurrency(Number(payment.amount || 0))}</p>
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
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  {paymentMethodOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Paid On *</label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="datetime-local"
                  className="w-full pl-9 pr-3 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-medium text-slate-700"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
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
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(sanitizeDecimalInput(e.target.value, currencyPrecision))}
                  onBlur={() => setPaymentAmount(toFixedPrecision(paymentAmount || 0, currencyPrecision))}
                  className="w-full pl-9 pr-3 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-bold text-slate-800"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Attach Document</label>
              <label className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer transition-all">
                <Paperclip size={16} className="text-slate-400 shrink-0" />
                <span className="text-sm text-slate-500 truncate">{attachmentName || 'Replace file…'}</span>
                <input
                  type="file"
                  accept=".pdf,.csv,.zip,.doc,.docx,.jpeg,.jpg,.png"
                  className="hidden"
                  onChange={(e) => setAttachmentName(e.target.files?.[0]?.name || '')}
                />
              </label>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Account</label>
              <div className="relative">
                <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <select
                  className="w-full pl-9 pr-8 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-medium text-slate-700 appearance-none cursor-pointer"
                  value={paymentAccount}
                  onChange={(e) => setPaymentAccount(e.target.value)}
                >
                  {paymentAccountOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Note</label>
            <textarea
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700 resize-none"
              rows={3}
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="Optional note…"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition">
            Cancel
          </button>
          <button onClick={save} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition shadow-md flex items-center gap-2 active:scale-95">
            <CreditCard size={16} /> Update Payment
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EditPaymentModal;
