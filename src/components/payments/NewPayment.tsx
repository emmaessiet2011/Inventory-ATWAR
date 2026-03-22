import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  User, DollarSign, Calendar, CreditCard,
  ChevronDown, Banknote, Upload, FileText, MapPin, Landmark,
  Paperclip, X, AlertCircle, CheckCircle2, ArrowLeft
} from 'lucide-react';
import { useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import { addRegisterTransaction, getActiveRegisterSession } from '@/utils/registerLedger';
import {
  buildPaymentAccountOptions,
  PAYMENT_ACCOUNTS_UPDATED_EVENT,
  resolveDefaultAccountFromMethod,
} from '@/utils/paymentAccounts';

const clampPrecision = (value: number) => {
  if (!Number.isFinite(value)) return 3;
  return Math.min(6, Math.max(0, Math.round(value)));
};

const normalizePrefix = (value: string, fallback: string) => {
  const candidate = String(value || fallback).trim();
  if (!candidate) return fallback;
  return candidate.endsWith('-') ? candidate.slice(0, -1) : candidate;
};

const normalizeText = (value: unknown) => String(value ?? '').trim().toLowerCase();

const requiresAttachment = (paymentMethod: string) =>
  /bank.?transfer|cheque|check|wire|transfer/i.test(paymentMethod);
const formatCustomerDisplayLabel = (customer: any): string => {
  const businessName = String(customer?.businessName || '').trim();
  const contactName = String(customer?.name || '').trim();
  if (businessName && contactName && normalizeText(businessName) !== normalizeText(contactName)) {
    return `${businessName} (${contactName})`;
  }
  return businessName || contactName;
};

interface InvoiceBreakdown {
  invoiceNo: string;
  amountApplied: number;
  isFullPayment: boolean;
  remainingAfter: number;
}

interface NewPaymentProps {
  onNavigate?: (page: string) => void;
}

const NewPayment: React.FC<NewPaymentProps> = ({ onNavigate }) => {
  const {
    customers,
    sales,
    settings,
    locations,
    addPayment: globalAddPayment,
    currentUser,
    formatCurrency,
  } = useGlobalContext();
  const { addNotification } = useNotifications();

  const currencyPrecision = clampPrecision(Number(settings.currencyPrecision ?? 3));

  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  const [method, setMethod] = useState(settings.defaultSalePaymentMethod || 'Cash');
  const [account, setAccount] = useState('Cash Account');
  const [accountOptionsVersion, setAccountOptionsVersion] = useState(0);
  const [note, setNote] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentDataUrl, setDocumentDataUrl] = useState<string>('');
  const [confirmingBreakdown, setConfirmingBreakdown] = useState<InvoiceBreakdown[] | null>(null);

  useEffect(() => {
    if (locations.length === 0) {
      setSelectedLocation('');
      return;
    }
    if (!selectedLocation || !locations.some(location => location.name === selectedLocation)) {
      setSelectedLocation(locations[0].name);
    }
  }, [locations, selectedLocation]);

  const activeLocation = useMemo(
    () => locations.find(location => location.name === selectedLocation),
    [locations, selectedLocation]
  );

  const paymentMethodOptions = useMemo(() => {
    const methods = new Set<string>();
    (activeLocation?.paymentMethods || [])
      .filter(methodRecord => methodRecord.enabled)
      .forEach(methodRecord => methods.add(String(methodRecord.name || '').trim()));
    if (methods.size === 0) {
      ['Cash', 'Card', 'Bank Transfer', 'Cheque', 'Emad'].forEach(option => methods.add(option));
    }
    if (settings.defaultSalePaymentMethod) methods.add(settings.defaultSalePaymentMethod);
    return Array.from(methods).filter(Boolean);
  }, [activeLocation?.paymentMethods, settings.defaultSalePaymentMethod]);

  const defaultAccountFromMethod = (methodName: string) =>
    resolveDefaultAccountFromMethod(methodName, activeLocation);

  const paymentAccountOptions = useMemo(() => (
    buildPaymentAccountOptions({
      locations,
      activeLocationName: selectedLocation,
      methodName: method,
      additionalAccountNames: [account],
      includeNone: false,
      includeStoredAccounts: true,
    })
  ), [locations, selectedLocation, method, account, accountOptionsVersion]);
  const resolvePaymentAccount = () => {
    const selectedAccount = String(account || '').trim();
    if (selectedAccount && paymentAccountOptions.includes(selectedAccount)) {
      return selectedAccount;
    }
    const suggestedAccount = String(defaultAccountFromMethod(method) || '').trim();
    if (suggestedAccount) return suggestedAccount;
    return String(paymentAccountOptions.find(Boolean) || '').trim();
  };

  const sanitizeAmountInput = (value: string): string => {
    const cleaned = value.replace(/[^\d.]/g, '');
    if (!cleaned) return '';
    const parts = cleaned.split('.');
    const intPart = parts[0] || '0';
    const decimalPart = parts.slice(1).join('').slice(0, currencyPrecision);
    if (currencyPrecision === 0) return intPart;
    return parts.length > 1 ? `${intPart}.${decimalPart}` : intPart;
  };

  const formatToPrecision = (value: string | number): string => {
    const parsed = parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed.toFixed(currencyPrecision) : (0).toFixed(currencyPrecision);
  };

  const customerStats = useMemo(() => {
    if (!selectedCustomer) return { totalSale: 0, totalPaid: 0, totalSaleDue: 0, openingBalance: 0, openingBalanceDue: 0 };
    const customerSales = sales.filter(sale =>
      String(sale.customerId || '') === String(selectedCustomer.id || '') ||
      String(sale.customerName || '').toLowerCase() === String(selectedCustomer.businessName || '').toLowerCase()
    );
    const totalSale = customerSales.reduce((acc, sale) => acc + (sale.grandTotal || 0), 0);
    const totalPaid = customerSales.reduce((acc, sale) => acc + (sale.totalPaid || 0), 0);
    const totalSaleDue = customerSales.reduce((acc, sale) => acc + (sale.sellDue || 0), 0);
    return {
      totalSale,
      totalPaid,
      totalSaleDue,
      openingBalance: selectedCustomer.openingBalance || 0,
      openingBalanceDue: selectedCustomer.openingBalance > 0 ? selectedCustomer.openingBalance : 0,
    };
  }, [selectedCustomer, sales]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    const recommended = defaultAccountFromMethod(method) || 'Cash Account';
    if (!account || !paymentAccountOptions.includes(account)) {
      setAccount(recommended);
    }
  }, [method, selectedLocation, paymentAccountOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (customer.mobile && customer.mobile.includes(searchQuery))
  );

  const handleSelectCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    setSearchQuery(formatCustomerDisplayLabel(customer));
    setIsDropdownOpen(false);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setDocumentFile(file);
    if (!file) {
      setDocumentDataUrl('');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setDocumentDataUrl((e.target?.result as string) || '');
    reader.readAsDataURL(file);
  };

  const resolveInvoiceBreakdown = (customer: any, paymentAmount: number): InvoiceBreakdown[] => {
    if (!customer || paymentAmount <= 0) return [];
    let remaining = paymentAmount;
    const dueSales = sales
      .filter(sale =>
        String(sale.status || sale.saleStatus || '').trim() === 'Final' &&
        (String(sale.customerId || '') === String(customer.id || '') ||
          String(sale.customerName || '').toLowerCase() === String(customer.businessName || '').toLowerCase()) &&
        ['Due', 'Partial', 'Overdue'].includes(String(sale.paymentStatus || ''))
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const breakdown: InvoiceBreakdown[] = [];
    dueSales.forEach(sale => {
      if (remaining <= 0) return;
      const due = typeof sale.sellDue === 'number'
        ? Math.max(0, sale.sellDue)
        : Math.max(0, (sale.grandTotal || sale.totalAmount || 0) - (sale.totalPaid || 0));
      if (due <= 0 || !sale.invoiceNo) return;
      const amountApplied = Math.min(remaining, due);
      const remainingAfter = due - amountApplied;
      breakdown.push({
        invoiceNo: String(sale.invoiceNo),
        amountApplied,
        isFullPayment: remainingAfter < 0.001,
        remainingAfter,
      });
      remaining -= amountApplied;
    });
    return breakdown;
  };

  const handleSave = () => {
    if (!selectedCustomer || !amount) {
      addNotification({ title: 'Validation Error', message: 'Please select a customer and enter amount.', type: 'error' });
      return;
    }
    if (!method) {
      addNotification({ title: 'Validation Error', message: 'Please select payment method.', type: 'error' });
      return;
    }
    const paymentAmount = parseFloat(formatToPrecision(amount));
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      addNotification({ title: 'Validation Error', message: 'Please enter a valid amount greater than 0.', type: 'error' });
      return;
    }
    if (requiresAttachment(method) && !documentDataUrl) {
      addNotification({ title: 'Attachment Required', message: `An attachment is required for ${method} payments.`, type: 'error' });
      return;
    }

    const breakdown = resolveInvoiceBreakdown(selectedCustomer, paymentAmount);
    setConfirmingBreakdown(breakdown);
  };

  const handleConfirmAndRecord = () => {
    if (!selectedCustomer || !confirmingBreakdown) return;

    const paymentAmount = parseFloat(formatToPrecision(amount));
    const resolvedAccount = resolvePaymentAccount();
    if (!resolvedAccount) {
      addNotification({
        title: 'Payment account required',
        message: 'No payment account is configured for this method/location. Configure payment accounts and try again.',
        type: 'error',
      });
      return;
    }
    const prefix = normalizePrefix(settings.sellPaymentPrefix || settings.paymentPrefix, 'PAY');
    const referenceNo = `${prefix}-${Date.now().toString().slice(-6)}`;
    const linkedInvoices = confirmingBreakdown.map(b => b.invoiceNo);

    globalAddPayment({
      id: `PAY-${Date.now()}`,
      date,
      contactId: selectedCustomer.id,
      contactName: selectedCustomer.businessName,
      contactType: 'Customer',
      amount: paymentAmount,
      method,
      account: resolvedAccount,
      location: selectedLocation || '',
      referenceNo,
      note: note || 'General Payment',
      type: 'received',
      addedBy: currentUser?.name || 'Admin',
      linkedInvoices,
      attachmentName: documentFile?.name || undefined,
      attachmentData: documentDataUrl || undefined,
    });

    const activeRegister = getActiveRegisterSession();
    const paymentLocation = normalizeText(selectedLocation);
    const registerLocation = normalizeText(activeRegister?.locationName);
    if (activeRegister && (!paymentLocation || paymentLocation === registerLocation)) {
      addRegisterTransaction({
        id: `RTX-PAY-${Date.now()}`,
        sessionId: activeRegister.id,
        date: new Date().toISOString(),
        type: 'payment',
        amount: paymentAmount,
        method,
        invoiceNo: linkedInvoices[0],
        note: `Payment received from ${selectedCustomer.businessName}`,
        addedBy: currentUser?.name || 'Admin',
      });
    }

    addNotification({ title: 'Payment Recorded', message: `Payment ${referenceNo} was recorded successfully.`, type: 'success' });
    setConfirmingBreakdown(null);
    setAmount('');
    setNote('');
    setDocumentFile(null);
    setDocumentDataUrl('');
    setSelectedCustomer(null);
    setSearchQuery('');
    setAccount(defaultAccountFromMethod(paymentMethodOptions[0] || settings.defaultSalePaymentMethod || 'Cash') || 'Cash Account');
    setMethod(paymentMethodOptions[0] || settings.defaultSalePaymentMethod || 'Cash');
  };

  const needsAttachment = requiresAttachment(method);

  return (
    <div className="space-y-6 animate-fade-in pb-20 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          {onNavigate && (
            <button
              onClick={() => onNavigate('list-payments')}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
              title="Back to Payments"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">New Payment</h2>
            <p className="text-slate-500 mt-1">Record a payment from a customer.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="group relative" ref={dropdownRef}>
              <label className="block text-sm font-bold text-slate-700 mb-2">Customer <span className="text-red-500">*</span></label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold text-slate-700"
                  placeholder="Search customer..."
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setIsDropdownOpen(true);
                    if (event.target.value === '') {
                      setSelectedCustomer(null);
                    }
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                />
                {isDropdownOpen && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 max-h-60 overflow-y-auto custom-scrollbar">
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map(customer => (
                        <div
                          key={customer.id}
                          className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                          onClick={() => handleSelectCustomer(customer)}
                        >
                          <div className="font-bold text-slate-800">{customer.businessName}</div>
                          <div className="text-xs text-slate-500">{customer.name} - {customer.mobile}</div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-slate-400 italic">No customers found</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="group">
              <label className="block text-sm font-bold text-slate-700 mb-2">Amount <span className="text-red-500">*</span></label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  inputMode="decimal"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-bold text-slate-700"
                  placeholder={currencyPrecision > 0 ? `0.${'0'.repeat(currencyPrecision)}` : '0'}
                  value={amount}
                  onChange={(event) => setAmount(sanitizeAmountInput(event.target.value))}
                  onBlur={() => {
                    if (!amount) return;
                    setAmount(formatToPrecision(amount));
                  }}
                />
              </div>
            </div>

            <div className="group">
              <label className="block text-sm font-bold text-slate-700 mb-2">Payment Date</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="datetime-local"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-medium text-slate-700"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
            </div>

            <div className="group">
              <label className="block text-sm font-bold text-slate-700 mb-2">Business Location</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <select
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-bold text-slate-700 appearance-none bg-white cursor-pointer"
                  value={selectedLocation}
                  onChange={(event) => setSelectedLocation(event.target.value)}
                >
                  {locations.length > 0 ? (
                    locations.map(location => (
                      <option key={location.id} value={location.name}>{location.name}</option>
                    ))
                  ) : (
                    <option value="">No location</option>
                  )}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>

            <div className="group">
              <label className="block text-sm font-bold text-slate-700 mb-2">Payment Method</label>
              <div className="relative">
                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <select
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-bold text-slate-700 appearance-none bg-white cursor-pointer"
                  value={method}
                  onChange={(event) => setMethod(event.target.value)}
                >
                  {paymentMethodOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>

            <div className="group">
              <label className="block text-sm font-bold text-slate-700 mb-2">Payment Account</label>
              <div className="relative">
                <Landmark className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <select
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-bold text-slate-700 appearance-none bg-white cursor-pointer"
                  value={account}
                  onChange={(event) => setAccount(event.target.value)}
                >
                  {paymentAccountOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>

            <div className="group">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Attach Document
                {needsAttachment && (
                  <span className="text-red-500 ml-1">* required</span>
                )}
              </label>
              <div className="flex items-center">
                <label className={`cursor-pointer border text-slate-700 px-4 py-3 rounded-l-xl text-sm hover:bg-slate-200 transition-colors whitespace-nowrap border-r-0 font-bold ${needsAttachment && !documentFile ? 'bg-red-50 border-red-300' : 'bg-slate-100 border-slate-300'}`}>
                  <Upload size={16} className="inline mr-2" /> Choose File
                  <input type="file" className="hidden" onChange={handleFileChange} />
                </label>
                <span className={`px-4 py-3 border rounded-r-xl w-full text-sm bg-white truncate ${needsAttachment && !documentFile ? 'border-red-300 text-red-400' : 'border-slate-300 text-slate-500'}`}>
                  {documentFile ? (
                    <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                      <Paperclip size={13} className="text-blue-500 shrink-0" />
                      {documentFile.name}
                    </span>
                  ) : (needsAttachment ? 'Required — no file chosen' : 'No file chosen')}
                </span>
              </div>
              {needsAttachment && !documentFile && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={11} /> {method} payments must include a supporting document.
                </p>
              )}
            </div>

            <div className="group">
              <label className="block text-sm font-bold text-slate-700 mb-2">Note</label>
              <textarea
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm resize-none"
                placeholder="Payment reference, notes..."
                value={note}
                onChange={(event) => setNote(event.target.value)}
              ></textarea>
            </div>

            <button
              onClick={handleSave}
              className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Banknote size={20} /> Record Payment
            </button>
          </div>

          <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 h-fit">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-200 pb-3">
              <User size={18} className="text-emerald-600" /> Customer Account
            </h3>

            {selectedCustomer ? (
              <div className="space-y-5">
                <div>
                  <p className="text-xs text-slate-500 uppercase font-bold mb-1">Customer</p>
                  <p className="font-bold text-lg text-slate-900 leading-tight">{selectedCustomer.businessName}</p>
                  <p className="text-sm text-slate-600 mt-1">{selectedCustomer.name}</p>
                </div>
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-600">Total Sale:</span><span className="text-sm font-bold text-slate-800">{formatCurrency(customerStats.totalSale)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-600">Total Paid:</span><span className="text-sm font-bold text-emerald-600">{formatCurrency(customerStats.totalPaid)}</span></div>
                  <div className="h-px bg-slate-200"></div>
                  <div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-600">Total Sale Due:</span><span className="text-base font-black text-red-600">{formatCurrency(customerStats.totalSaleDue)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-600">Opening Balance:</span><span className="text-sm font-bold text-slate-800">{formatCurrency(customerStats.openingBalance)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-600">Opening Balance Due:</span><span className="text-sm font-bold text-red-600">{formatCurrency(customerStats.openingBalanceDue)}</span></div>
                </div>
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-center">
                <FileText size={48} className="mb-2 opacity-20" />
                <p className="text-sm">Select a customer to view account stats</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation / Breakdown Preview Modal */}
      {confirmingBreakdown !== null && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-black text-slate-800">Confirm Payment</h3>
              <button onClick={() => setConfirmingBreakdown(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer</span>
                  <span className="font-bold text-slate-800">{selectedCustomer?.businessName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-bold text-emerald-700">{formatCurrency(parseFloat(formatToPrecision(amount)))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Method</span>
                  <span className="font-bold text-slate-800">{method}</span>
                </div>
                {documentFile && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Attachment</span>
                    <span className="flex items-center gap-1 font-medium text-blue-600 text-xs">
                      <Paperclip size={11} /> {documentFile.name}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-bold text-slate-600 uppercase mb-2">Invoice Breakdown</p>
                {confirmingBreakdown.length > 0 ? (
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600">
                          <th className="px-3 py-2 text-left">Invoice</th>
                          <th className="px-3 py-2 text-right">Applied</th>
                          <th className="px-3 py-2 text-right">Remaining</th>
                          <th className="px-3 py-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {confirmingBreakdown.map(b => (
                          <tr key={b.invoiceNo}>
                            <td className="px-3 py-2 font-medium text-slate-700">{b.invoiceNo}</td>
                            <td className="px-3 py-2 text-right font-bold text-emerald-700">{formatCurrency(b.amountApplied)}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(b.remainingAfter)}</td>
                            <td className="px-3 py-2 text-center">
                              {b.isFullPayment ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                  <CheckCircle2 size={9} /> CLEARED
                                </span>
                              ) : (
                                <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                                  PARTIAL
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic px-1">No outstanding invoices found. Payment will be recorded as a general credit.</p>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setConfirmingBreakdown(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAndRecord}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors flex items-center gap-2"
              >
                <Banknote size={15} /> Confirm & Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewPayment;
