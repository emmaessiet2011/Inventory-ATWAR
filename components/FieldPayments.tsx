import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Search, CheckCircle2, Trash2, X, Pencil, Eye, Paperclip, User, DollarSign, ArrowLeft, CreditCard,
} from 'lucide-react';
import { useGlobalContext } from '../src/context/GlobalContext';
import { useNotifications } from '../src/context/NotificationContext';
import { ConfirmationModal } from './UserModals';
import { addRegisterTransaction, getActiveRegisterSession } from '../src/utils/registerLedger';
import {
  clampPrecision,
  normalizePrefix,
  sanitizeDecimalInput,
  toDateTimeLocalInput,
  toFixedPrecision,
} from '../src/utils/paymentUtils';
import {
  buildPaymentAccountOptions,
  PAYMENT_ACCOUNTS_UPDATED_EVENT,
  resolveDefaultAccountFromMethod,
} from '../src/utils/paymentAccounts';

type FieldPaymentStatus = 'Pending' | 'Approved';

interface InvoiceBreakdown {
  invoiceNo: string;
  amountApplied: number;
  isFullPayment: boolean;
  remainingAfter: number;
}

interface FieldPaymentRecord {
  id: string;
  referenceNo: string;
  customerId: string;
  customerName: string;
  amount: number;
  date: string;
  location: string;
  method: string;
  account: string;
  collectedBy: string;
  status: FieldPaymentStatus;
  note: string;
  attachmentName?: string;
  linkedInvoices?: string[];
  linkedInvoiceBreakdown?: InvoiceBreakdown[];
  postedPaymentId?: string;
  approvedBy?: string;
  approvedAt?: string;
}

const STORAGE_KEY = 'app_field_payments';

const normalizeText = (value: unknown) => String(value || '').trim().toLowerCase();

const sortByDateDesc = (rows: FieldPaymentRecord[]) => (
  [...rows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
);

const normalizeFieldPaymentRecord = (raw: any, index: number): FieldPaymentRecord => {
  const id = String(raw?.id || `FP-${Date.now()}-${index + 1}`);
  const status: FieldPaymentStatus = String(raw?.status) === 'Approved' ? 'Approved' : 'Pending';
  const amount = Number(raw?.amount || 0);
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const referenceNo = String(raw?.referenceNo || id);
  const date = toDateTimeLocalInput(raw?.date) || toDateTimeLocalInput(new Date().toISOString());
  const attachmentName = String(raw?.attachmentName || raw?.document || '').trim();
  const linkedInvoices = Array.isArray(raw?.linkedInvoices)
    ? raw.linkedInvoices.map((ref: unknown) => String(ref || '').trim()).filter(Boolean)
    : [];

  const linkedInvoiceBreakdown: InvoiceBreakdown[] = Array.isArray(raw?.linkedInvoiceBreakdown)
    ? raw.linkedInvoiceBreakdown
        .filter((b: any) => b && String(b.invoiceNo || '').trim())
        .map((b: any) => ({
          invoiceNo: String(b.invoiceNo || '').trim(),
          amountApplied: Number(b.amountApplied || 0),
          isFullPayment: Boolean(b.isFullPayment),
          remainingAfter: Number(b.remainingAfter || 0),
        }))
    : [];

  return {
    id,
    referenceNo,
    customerId: String(raw?.customerId || ''),
    customerName: String(raw?.customerName || '').trim() || 'Unknown',
    amount: safeAmount,
    date,
    location: String(raw?.location || '').trim(),
    method: String(raw?.method || 'Cash').trim() || 'Cash',
    account: String(raw?.account || '').trim(),
    collectedBy: String(raw?.collectedBy || 'Admin').trim() || 'Admin',
    status,
    note: String(raw?.note || '').trim(),
    attachmentName: attachmentName || undefined,
    linkedInvoices,
    linkedInvoiceBreakdown: linkedInvoiceBreakdown.length > 0 ? linkedInvoiceBreakdown : undefined,
    postedPaymentId: String(raw?.postedPaymentId || '').trim() || undefined,
    approvedBy: String(raw?.approvedBy || '').trim() || undefined,
    approvedAt: toDateTimeLocalInput(raw?.approvedAt) || undefined,
  };
};

interface FieldPaymentsProps {
  onNavigate?: (page: string) => void;
}

const FieldPayments: React.FC<FieldPaymentsProps> = ({ onNavigate }) => {
  const {
    customers,
    sales,
    locations,
    payments,
    addPayment: globalAddPayment,
    deletePayment: globalDeletePayment,
    currentUser,
    roles,
    settings,
    formatCurrency,
  } = useGlobalContext();
  const { addNotification } = useNotifications();

  const currencyPrecision = clampPrecision(Number(settings.currencyPrecision ?? 3));

  const currentRoleRecord = roles.find(role => role.name === currentUser?.role);
  const rolePermissions = currentRoleRecord?.permissions || [];
  const roleHasExplicitPermissions = rolePermissions.length > 0;
  const hasRolePermission = (moduleName: string, permission: string) => {
    if (!currentUser) return false;
    if (String(currentUser.role || '').toLowerCase() === 'admin' || currentRoleRecord?.isSystem) return true;
    if (!roleHasExplicitPermissions) return true;
    return rolePermissions.includes(permission) || rolePermissions.includes(`${moduleName}::${permission}`);
  };
  const canAdd = hasRolePermission('Field Payment', 'Add field payment');
  const canEdit = hasRolePermission('Field Payment', 'Edit field payment');
  const canDelete = hasRolePermission('Field Payment', 'Delete field payment');
  const canApprove = hasRolePermission('Field Payment', 'Approval field payment');

  const [records, setRecords] = useState<FieldPaymentRecord[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | FieldPaymentStatus>('All');
  const [locationFilter, setLocationFilter] = useState('All');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<FieldPaymentRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<FieldPaymentRecord | null>(null);
  const [approvingRecord, setApprovingRecord] = useState<FieldPaymentRecord | null>(null);
  const [editingId, setEditingId] = useState('');

  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  const [amountInput, setAmountInput] = useState('');
  const [dateInput, setDateInput] = useState(toDateTimeLocalInput(new Date().toISOString()));
  const [locationInput, setLocationInput] = useState('');
  const [methodInput, setMethodInput] = useState(settings.defaultSalePaymentMethod || 'Cash');
  const [accountInput, setAccountInput] = useState('');
  const [accountOptionsVersion, setAccountOptionsVersion] = useState(0);
  const [noteInput, setNoteInput] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  const persistRecords = (next: FieldPaymentRecord[]) => {
    const sorted = sortByDateDesc(next);
    setRecords(sorted);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
    } catch {
      // localStorage write failure should not block UI
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) {
        setRecords([]);
        return;
      }
      setRecords(sortByDateDesc(parsed.map((row, index) => normalizeFieldPaymentRecord(row, index))));
    } catch {
      setRecords([]);
    }
  }, []);

  useEffect(() => {
    if (locationInput) return;
    if (locations.length > 0) setLocationInput(locations[0].name);
  }, [locations, locationInput]);

  const activeLocation = useMemo(
    () => locations.find(location => location.name === locationInput),
    [locations, locationInput]
  );

  const paymentMethodOptions = useMemo(() => {
    const methods = new Set<string>();
    (activeLocation?.paymentMethods || [])
      .filter(methodRecord => methodRecord.enabled)
      .forEach(methodRecord => methods.add(String(methodRecord.name || '').trim()));
    if (methods.size === 0) ['Cash', 'Card', 'Bank Transfer', 'Cheque'].forEach(method => methods.add(method));
    if (settings.defaultSalePaymentMethod) methods.add(settings.defaultSalePaymentMethod);
    return Array.from(methods).filter(Boolean);
  }, [activeLocation?.paymentMethods, settings.defaultSalePaymentMethod]);

  const defaultAccountFromMethod = (methodName: string) =>
    resolveDefaultAccountFromMethod(methodName, activeLocation);

  const paymentAccountOptions = useMemo(() => (
    buildPaymentAccountOptions({
      locations,
      activeLocationName: locationInput,
      methodName: methodInput,
      additionalAccountNames: [accountInput],
      includeNone: false,
      includeStoredAccounts: true,
    })
  ), [locations, locationInput, methodInput, accountInput, accountOptionsVersion]);

  useEffect(() => {
    if (paymentMethodOptions.includes(methodInput)) return;
    setMethodInput(paymentMethodOptions[0] || settings.defaultSalePaymentMethod || 'Cash');
  }, [methodInput, paymentMethodOptions, settings.defaultSalePaymentMethod]);

  useEffect(() => {
    if (accountInput && paymentAccountOptions.includes(accountInput)) return;
    setAccountInput(defaultAccountFromMethod(methodInput) || paymentAccountOptions[0] || '');
  }, [accountInput, methodInput, paymentAccountOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    const handleAccountsUpdated = () => setAccountOptionsVersion(prev => prev + 1);
    window.addEventListener(PAYMENT_ACCOUNTS_UPDATED_EVENT, handleAccountsUpdated as EventListener);
    return () => window.removeEventListener(PAYMENT_ACCOUNTS_UPDATED_EVENT, handleAccountsUpdated as EventListener);
  }, []);

  useEffect(() => {
    setRecords(prev => {
      let changed = false;
      const next = prev.map(record => {
        if (record.status !== 'Approved') return record;

        const postedById = record.postedPaymentId
          ? payments.find(payment => payment.id === record.postedPaymentId)
          : undefined;
        if (postedById) return record;

        const fallbackLinked = payments.find(payment =>
          payment.contactType === 'Customer' &&
          payment.type === 'received' &&
          normalizeText(payment.referenceNo) === normalizeText(record.referenceNo) &&
          normalizeText(payment.contactId) === normalizeText(record.customerId) &&
          Math.abs(Number(payment.amount || 0) - Number(record.amount || 0)) < 0.0001
        );

        changed = true;
        if (fallbackLinked) return { ...record, postedPaymentId: fallbackLinked.id };
        return { ...record, status: 'Pending', postedPaymentId: undefined, approvedBy: undefined, approvedAt: undefined };
      });

      if (changed) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore localStorage failures
        }
        return next;
      }
      return prev;
    });
  }, [payments]);

  const filteredCustomers = useMemo(() => {
    const query = normalizeText(customerQuery);
    return customers.filter(customer => {
      if (!query) return true;
      return (
        normalizeText(customer.businessName).includes(query) ||
        normalizeText(customer.name).includes(query) ||
        normalizeText(customer.mobile).includes(query)
      );
    });
  }, [customers, customerQuery]);

  const filteredRecords = useMemo(() => {
    const query = normalizeText(search);
    return records.filter(record => {
      const matchesQuery = !query || (
        normalizeText(record.referenceNo).includes(query) ||
        normalizeText(record.customerName).includes(query) ||
        normalizeText(record.collectedBy).includes(query) ||
        normalizeText(record.method).includes(query) ||
        normalizeText(record.note).includes(query)
      );
      const matchesStatus = statusFilter === 'All' || record.status === statusFilter;
      const matchesLocation = locationFilter === 'All' || record.location === locationFilter;
      return matchesQuery && matchesStatus && matchesLocation;
    });
  }, [records, search, statusFilter, locationFilter]);

  const locationOptions = useMemo(
    () => ['All', ...Array.from(new Set(records.map(record => record.location).filter(Boolean)))],
    [records]
  );

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId('');
    setSelectedCustomer(null);
    setCustomerQuery('');
    setAmountInput('');
    setDateInput(toDateTimeLocalInput(new Date().toISOString()));
    setMethodInput(settings.defaultSalePaymentMethod || paymentMethodOptions[0] || 'Cash');
    setAccountInput(defaultAccountFromMethod(settings.defaultSalePaymentMethod || paymentMethodOptions[0] || 'Cash') || paymentAccountOptions[0] || '');
    setNoteInput('');
    setAttachmentName('');
    setShowCustomerDropdown(false);
  };

  const openCreateModal = () => {
    if (!canAdd) {
      addNotification({ title: 'Access Denied', message: 'You do not have permission to add field payments.', type: 'error' });
      return;
    }
    closeModal();
    setLocationInput(locations[0]?.name || '');
    setIsModalOpen(true);
  };

  const openEditModal = (record: FieldPaymentRecord) => {
    if (!canEdit) {
      addNotification({ title: 'Access Denied', message: 'You do not have permission to edit field payments.', type: 'error' });
      return;
    }
    if (record.status === 'Approved') {
      addNotification({ title: 'Edit Blocked', message: 'Approved field payments cannot be edited.', type: 'warning' });
      return;
    }
    const customer = customers.find(c => String(c.id) === String(record.customerId)) || null;
    setEditingId(record.id);
    setSelectedCustomer(customer || { id: record.customerId, businessName: record.customerName, name: record.customerName });
    setCustomerQuery(record.customerName);
    setAmountInput(toFixedPrecision(record.amount, currencyPrecision));
    setDateInput(toDateTimeLocalInput(record.date) || toDateTimeLocalInput(new Date().toISOString()));
    setLocationInput(record.location || locations[0]?.name || '');
    setMethodInput(record.method || settings.defaultSalePaymentMethod || 'Cash');
    setAccountInput(record.account || '');
    setNoteInput(record.note || '');
    setAttachmentName(record.attachmentName || '');
    setIsModalOpen(true);
  };

  const resolveInvoiceBreakdown = (customer: any, paymentAmount: number, locationName: string): InvoiceBreakdown[] => {
    if (!customer || paymentAmount <= 0) return [];
    let remaining = paymentAmount;
    const dueSales = sales
      .filter(sale =>
        String(sale.status || sale.saleStatus || '').trim() === 'Final' &&
        (String(sale.customerId || '') === String(customer.id || '') ||
          normalizeText(sale.customerName) === normalizeText(customer.businessName)) &&
        ['Due', 'Partial', 'Overdue'].includes(String(sale.paymentStatus || ''))
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const prioritized = locationName
      ? [
          ...dueSales.filter(sale => normalizeText(sale.location) === normalizeText(locationName)),
          ...dueSales.filter(sale => normalizeText(sale.location) !== normalizeText(locationName)),
        ]
      : dueSales;

    const seen = new Set<string>();
    const breakdown: InvoiceBreakdown[] = [];
    prioritized.forEach(sale => {
      if (remaining <= 0) return;
      if (!sale.invoiceNo || seen.has(sale.invoiceNo)) return;
      const due = typeof sale.sellDue === 'number'
        ? Math.max(0, sale.sellDue)
        : Math.max(0, (sale.grandTotal || sale.totalAmount || 0) - (sale.totalPaid || 0));
      if (due <= 0) return;
      const paying = Math.min(remaining, due);
      if (paying > 0) {
        seen.add(sale.invoiceNo);
        breakdown.push({
          invoiceNo: String(sale.invoiceNo),
          amountApplied: paying,
          isFullPayment: Math.abs(paying - due) < 0.001,
          remainingAfter: Math.max(0, due - paying),
        });
      }
      remaining -= paying;
    });
    return breakdown;
  };

  const requiresAttachment = (method: string) =>
    /bank.?transfer|cheque|check|wire|transfer/i.test(method);

  const handleSave = () => {
    const paymentAmount = Number(toFixedPrecision(amountInput || 0, currencyPrecision));
    if (!selectedCustomer || !paymentAmount || paymentAmount <= 0) {
      addNotification({ title: 'Validation Error', message: 'Select customer and enter a valid amount.', type: 'error' });
      return;
    }
    if (!locationInput) {
      addNotification({ title: 'Validation Error', message: 'Select a business location.', type: 'error' });
      return;
    }
    if (requiresAttachment(methodInput) && !attachmentName) {
      addNotification({ title: 'Attachment Required', message: `A proof of payment is required for ${methodInput}.`, type: 'error' });
      return;
    }
    const resolvedAccount = String(
      accountInput
      || defaultAccountFromMethod(methodInput || 'Cash')
      || paymentAccountOptions.find(Boolean)
      || ''
    ).trim();
    if (!resolvedAccount) {
      addNotification({
        title: 'Validation Error',
        message: 'Please select a payment account.',
        type: 'error',
      });
      return;
    }

    const breakdown = resolveInvoiceBreakdown(selectedCustomer, paymentAmount, locationInput);
    const linkedInvoices = breakdown.map(b => b.invoiceNo);

    if (editingId) {
      const current = records.find(record => record.id === editingId);
      if (!current) return;
      persistRecords(records.map(record => record.id === editingId
        ? {
            ...record,
            customerId: selectedCustomer.id,
            customerName: selectedCustomer.businessName || selectedCustomer.name,
            amount: paymentAmount,
            date: dateInput || toDateTimeLocalInput(new Date().toISOString()),
            location: locationInput,
            method: methodInput || 'Cash',
            account: resolvedAccount,
            note: noteInput.trim(),
            attachmentName: attachmentName || undefined,
            linkedInvoices,
            linkedInvoiceBreakdown: breakdown.length > 0 ? breakdown : undefined,
          }
        : record));
      addNotification({ title: 'Field Payment Updated', message: `${current.referenceNo} was updated.`, type: 'success' });
      closeModal();
      return;
    }

    const prefix = normalizePrefix(settings.paymentPrefix, 'FP');
    const referenceNo = `${prefix}-FP-${Date.now().toString().slice(-6)}`;
    const newRecord: FieldPaymentRecord = {
      id: `FP-${Date.now()}`,
      referenceNo,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.businessName || selectedCustomer.name,
      amount: paymentAmount,
      date: dateInput || toDateTimeLocalInput(new Date().toISOString()),
      location: locationInput,
      method: methodInput || 'Cash',
      account: resolvedAccount,
      collectedBy: currentUser?.name || 'Admin',
      status: 'Pending',
      note: noteInput.trim(),
      attachmentName: attachmentName || undefined,
      linkedInvoices,
      linkedInvoiceBreakdown: breakdown.length > 0 ? breakdown : undefined,
    };
    persistRecords([newRecord, ...records]);
    addNotification({ title: 'Field Payment Added', message: `${referenceNo} created and pending approval.`, type: 'success' });
    closeModal();
  };

  const handleApprove = (record: FieldPaymentRecord) => {
    if (!canApprove) {
      addNotification({ title: 'Access Denied', message: 'You do not have permission to approve field payments.', type: 'error' });
      return;
    }
    if (record.status === 'Approved') return;

    const existingGlobal = payments.find(payment =>
      payment.contactType === 'Customer' &&
      payment.type === 'received' &&
      normalizeText(payment.referenceNo) === normalizeText(record.referenceNo) &&
      normalizeText(payment.contactId) === normalizeText(record.customerId) &&
      Math.abs(Number(payment.amount || 0) - Number(record.amount || 0)) < 0.0001
    );

    const paymentId = existingGlobal?.id || record.postedPaymentId || `PAY-FIELD-${Date.now()}`;
    if (!existingGlobal) {
      globalAddPayment({
        id: paymentId,
        date: record.date,
        contactId: record.customerId,
        contactName: record.customerName,
        contactType: 'Customer',
        amount: record.amount,
        method: record.method || 'Cash',
        account: String(record.account || defaultAccountFromMethod(record.method || 'Cash') || '').trim(),
        location: record.location || '',
        referenceNo: record.referenceNo,
        note: `Field collection by ${record.collectedBy}${record.note ? ` | ${record.note}` : ''}`,
        type: 'received',
        addedBy: currentUser?.name || 'Admin',
        linkedInvoices: record.linkedInvoices || [],
        attachmentName: record.attachmentName,
      });
    }

    const activeRegister = getActiveRegisterSession();
    if (activeRegister && (!record.location || activeRegister.locationName === record.location)) {
      addRegisterTransaction({
        id: `RTX-FIELD-${Date.now()}`,
        sessionId: activeRegister.id,
        date: new Date().toISOString(),
        type: 'payment',
        amount: record.amount,
        method: record.method,
        invoiceNo: record.linkedInvoices?.[0],
        note: `Approved field payment ${record.referenceNo}`,
        addedBy: currentUser?.name || 'Admin',
      });
    }

    persistRecords(records.map(row => row.id === record.id
      ? {
          ...row,
          status: 'Approved',
          postedPaymentId: paymentId,
          approvedBy: currentUser?.name || 'Admin',
          approvedAt: toDateTimeLocalInput(new Date().toISOString()),
        }
      : row));
    addNotification({ title: 'Field Payment Approved', message: `${record.referenceNo} posted to payment ledger.`, type: 'success' });
  };

  const handleDelete = () => {
    if (!deletingRecord) return;
    if (!canDelete) {
      addNotification({ title: 'Access Denied', message: 'You do not have permission to delete field payments.', type: 'error' });
      setDeletingRecord(null);
      return;
    }
    const fallbackPayment = payments.find(payment =>
      payment.contactType === 'Customer' &&
      payment.type === 'received' &&
      normalizeText(payment.referenceNo) === normalizeText(deletingRecord.referenceNo) &&
      normalizeText(payment.contactId) === normalizeText(deletingRecord.customerId) &&
      Math.abs(Number(payment.amount || 0) - Number(deletingRecord.amount || 0)) < 0.0001
    );
    const linkedPaymentId = deletingRecord.postedPaymentId || fallbackPayment?.id || '';
    if (linkedPaymentId) globalDeletePayment(linkedPaymentId);
    persistRecords(records.filter(record => record.id !== deletingRecord.id));
    addNotification({ title: 'Field Payment Deleted', message: `${deletingRecord.referenceNo} was deleted.`, type: 'success' });
    setDeletingRecord(null);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
              <CreditCard size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Field Payments</h2>
              <p className="text-slate-500 text-sm mt-0.5">Collect customer dues from field staff</p>
            </div>
          </div>
        </div>
        <button onClick={openCreateModal} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition flex items-center gap-2">
          <Plus size={18} /> Add Collection
        </button>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-4 gap-3 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by ref/customer/collector..." className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'All' | FieldPaymentStatus)} className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm">
          <option value="All">All Status</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
        </select>
        <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm">
          {locationOptions.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRecords.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400 italic">No field payments found.</td></tr>
            ) : filteredRecords.map(record => (
              <tr key={record.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">{new Date(record.date).toLocaleString()}</td>
                <td className="px-4 py-3 font-semibold">{record.referenceNo}</td>
                <td className="px-4 py-3">{record.customerName}</td>
                <td className="px-4 py-3">{record.location || '--'}</td>
                <td className="px-4 py-3">{record.method}</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrency(record.amount)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${record.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {record.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => setViewingRecord(record)} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50" title="View"><Eye size={14} /></button>
                    {record.status === 'Pending' && canEdit && (
                      <button onClick={() => openEditModal(record)} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50" title="Edit"><Pencil size={14} /></button>
                    )}
                    {record.status === 'Pending' && canApprove && (
                      <button onClick={() => setApprovingRecord(record)} className="p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700" title="Approve"><CheckCircle2 size={14} /></button>
                    )}
                    {canDelete && (
                      <button onClick={() => setDeletingRecord(record)} className="p-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50" title="Delete"><Trash2 size={14} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 p-4 flex items-center justify-center">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 relative">
            <button onClick={closeModal} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
            <h3 className="text-xl font-black text-slate-900">{editingId ? 'Edit Field Payment' : 'Add Field Payment'}</h3>
            <p className="text-xs text-slate-500 mb-4">Approved records are posted to List Payments and customer ledgers.</p>

            <div className="space-y-4">
              <div ref={customerDropdownRef} className="relative">
                <label className="text-xs font-bold text-slate-600">Customer</label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    value={customerQuery}
                    onChange={(e) => {
                      setCustomerQuery(e.target.value);
                      setShowCustomerDropdown(true);
                      if (!e.target.value) setSelectedCustomer(null);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    placeholder="Search customer"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
                {showCustomerDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-44 overflow-y-auto z-20">
                    {filteredCustomers.map(customer => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setCustomerQuery(customer.businessName || customer.name);
                          setShowCustomerDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <div className="font-semibold text-slate-800">{customer.businessName}</div>
                        <div className="text-xs text-slate-500">{customer.mobile}</div>
                      </button>
                    ))}
                    {filteredCustomers.length === 0 && <div className="px-3 py-2 text-xs text-slate-400">No customers found</div>}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600">Business Location</label>
                  <select value={locationInput} onChange={(e) => setLocationInput(e.target.value)} className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm">
                    {locations.map(location => <option key={location.id} value={location.name}>{location.name}</option>)}
                    {locations.length === 0 && <option value="">No location</option>}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Date &amp; Time</label>
                  <input type="datetime-local" value={dateInput} onChange={(e) => setDateInput(e.target.value)} className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600">Amount</label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amountInput}
                      onChange={(e) => setAmountInput(sanitizeDecimalInput(e.target.value, currencyPrecision))}
                      onBlur={() => amountInput && setAmountInput(toFixedPrecision(amountInput, currencyPrecision))}
                      placeholder={currencyPrecision > 0 ? `0.${'0'.repeat(currencyPrecision)}` : '0'}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Payment Method</label>
                  <select value={methodInput} onChange={(e) => setMethodInput(e.target.value)} className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm">
                    {paymentMethodOptions.map(method => <option key={method} value={method}>{method}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600">Payment Account</label>
                  <select value={accountInput} onChange={(e) => setAccountInput(e.target.value)} className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm">
                    {paymentAccountOptions.map(account => <option key={account} value={account}>{account}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">
                    Attachment
                    {requiresAttachment(methodInput) && (
                      <span className="ml-1 text-rose-600">* required</span>
                    )}
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setAttachmentName(e.target.files?.[0]?.name || '')}
                    className={`w-full mt-1 px-3 py-2 rounded-xl border text-xs ${requiresAttachment(methodInput) && !attachmentName ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`}
                  />
                  {attachmentName && <p className="text-xs text-slate-500 mt-1 flex items-center gap-1"><Paperclip size={12} />{attachmentName}</p>}
                  {requiresAttachment(methodInput) && !attachmentName && (
                    <p className="text-xs text-rose-500 mt-1">Upload the transfer receipt or proof of payment.</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600">Note</label>
                <textarea value={noteInput} onChange={(e) => setNoteInput(e.target.value)} rows={3} className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm" placeholder="Optional note" />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={closeModal} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold">{editingId ? 'Save Changes' : 'Save Collection'}</button>
            </div>
          </div>
        </div>
      )}

      {viewingRecord && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 p-4 flex items-center justify-center">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 relative overflow-y-auto max-h-[90vh]">
            <button onClick={() => setViewingRecord(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
            <h3 className="text-xl font-black text-slate-900 mb-4">Field Payment Details</h3>
            <div className="space-y-2 text-sm">
              <p><span className="font-semibold text-slate-700">Reference:</span> {viewingRecord.referenceNo}</p>
              <p><span className="font-semibold text-slate-700">Customer:</span> {viewingRecord.customerName}</p>
              <p><span className="font-semibold text-slate-700">Amount:</span> {formatCurrency(viewingRecord.amount)}</p>
              <p><span className="font-semibold text-slate-700">Date:</span> {new Date(viewingRecord.date).toLocaleString()}</p>
              <p><span className="font-semibold text-slate-700">Location:</span> {viewingRecord.location || '--'}</p>
              <p><span className="font-semibold text-slate-700">Method/Account:</span> {viewingRecord.method} / {viewingRecord.account || '--'}</p>
              <p><span className="font-semibold text-slate-700">Collected By:</span> {viewingRecord.collectedBy}</p>
              <p>
                <span className="font-semibold text-slate-700">Status:</span>{' '}
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${viewingRecord.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {viewingRecord.status}
                </span>
              </p>
              {viewingRecord.approvedBy && <p><span className="font-semibold text-slate-700">Approved By:</span> {viewingRecord.approvedBy}</p>}
              {viewingRecord.approvedAt && <p><span className="font-semibold text-slate-700">Approved At:</span> {new Date(viewingRecord.approvedAt).toLocaleString()}</p>}
              {viewingRecord.attachmentName && (
                <p className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700">Attachment:</span>
                  <span className="inline-flex items-center gap-1 text-blue-600"><Paperclip size={12} />{viewingRecord.attachmentName}</span>
                </p>
              )}
              {viewingRecord.note && <p><span className="font-semibold text-slate-700">Note:</span> {viewingRecord.note}</p>}
            </div>

            {(viewingRecord.linkedInvoiceBreakdown && viewingRecord.linkedInvoiceBreakdown.length > 0) ? (
              <div className="mt-4">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Invoice Distribution</p>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  {viewingRecord.linkedInvoiceBreakdown.map((item) => (
                    <div key={item.invoiceNo} className="flex items-center justify-between px-3 py-2 border-b border-slate-100 last:border-b-0 text-sm">
                      <span className="font-semibold text-slate-700">{item.invoiceNo}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-800">{formatCurrency(item.amountApplied)}</span>
                        {item.isFullPayment ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">CLEARED</span>
                        ) : (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">PARTIAL · {formatCurrency(item.remainingAfter)} left</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : viewingRecord.linkedInvoices && viewingRecord.linkedInvoices.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Linked Invoices</p>
                <p className="text-sm text-slate-700">{viewingRecord.linkedInvoices.join(', ')}</p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {approvingRecord && (
        <div className="fixed inset-0 z-[110] bg-slate-900/50 p-4 flex items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
            <button onClick={() => setApprovingRecord(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
            <h3 className="text-lg font-black text-slate-900">Confirm Approval</h3>
            <p className="text-xs text-slate-500 mb-4">Review the distribution below before posting to the payment ledger.</p>

            <div className="space-y-1.5 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Reference</span>
                <span className="font-semibold text-slate-800">{approvingRecord.referenceNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer</span>
                <span className="font-semibold text-slate-800">{approvingRecord.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Amount</span>
                <span className="font-black text-slate-900">{formatCurrency(approvingRecord.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Method</span>
                <span className="font-semibold text-slate-800">{approvingRecord.method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Collected By</span>
                <span className="font-semibold text-slate-800">{approvingRecord.collectedBy}</span>
              </div>
              {approvingRecord.attachmentName && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Attachment</span>
                  <span className="inline-flex items-center gap-1 text-blue-600 font-semibold text-xs"><Paperclip size={11} />{approvingRecord.attachmentName}</span>
                </div>
              )}
            </div>

            {(approvingRecord.linkedInvoiceBreakdown && approvingRecord.linkedInvoiceBreakdown.length > 0) ? (
              <div className="mb-4">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">This payment will be distributed as follows:</p>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  {approvingRecord.linkedInvoiceBreakdown.map((item) => (
                    <div key={item.invoiceNo} className="px-3 py-2.5 border-b border-slate-100 last:border-b-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700 text-sm">{item.invoiceNo}</span>
                        <span className="font-mono font-bold text-slate-900 text-sm">{formatCurrency(item.amountApplied)}</span>
                      </div>
                      <div className="mt-0.5">
                        {item.isFullPayment ? (
                          <span className="text-[11px] font-bold text-emerald-600">✓ Fully cleared</span>
                        ) : (
                          <span className="text-[11px] font-bold text-amber-600">~ Partially paid · {formatCurrency(item.remainingAfter)} will remain outstanding</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-slate-50 rounded-xl text-sm text-slate-500 italic">
                No outstanding invoices found for this customer. Payment will be posted as a credit.
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setApprovingRecord(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => { handleApprove(approvingRecord); setApprovingRecord(null); }}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 flex items-center gap-2"
              >
                <CheckCircle2 size={15} /> Confirm & Post
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deletingRecord}
        onClose={() => setDeletingRecord(null)}
        onConfirm={handleDelete}
        title="Delete field payment?"
        message={deletingRecord?.status === 'Approved'
          ? 'This will also remove the linked payment entry from the ledger.'
          : 'This action cannot be undone.'}
        confirmLabel="Delete"
        confirmVariant="danger"
      />
    </div>
  );
};

export default FieldPayments;
