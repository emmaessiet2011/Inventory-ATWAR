import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Search, Filter, Download, Printer, Eye, Edit, Trash2, MoreHorizontal,
  ArrowUpDown, Paperclip, CreditCard, CheckCircle2
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import { ConfirmationModal } from '@/components/users/UserModals';
import ViewPaymentModal from './ViewPaymentModal';
import EditPaymentModal from './EditPaymentModal';
import { clampPrecision } from '@/utils/paymentUtils';
import { printDocument, paymentBadge } from '@/utils/printUtils';

interface ListPaymentsProps {
  onNavigate?: (page: string) => void;
  onContactSelect?: (contactId: string, tab?: string) => void;
}

interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

interface PaymentRow {
  id: string;
  date: string;
  referenceNo: string;
  contactId: string;
  customerName: string;
  amount: number;
  method: string;
  note: string;
  account: string;
  attachmentName?: string;
  addedBy?: string;
  location: string;
  clearedInvoices: { invoiceNo: string; status: string }[];
  raw: any;
}

const parseDateSafe = (value?: string) => {
  const parsed = value ? new Date(value) : new Date('');
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const findInvoiceTokens = (value: string): string[] => {
  const matches = value.match(/\b(?:INV|CN|QT)[-A-Z0-9/]+\b/gi) || [];
  return Array.from(new Set(matches.map(token => token.trim()))).filter(Boolean);
};
const inferAccountFromMethod = (methodName: string): string => (
  String(methodName || '').toLowerCase().includes('cash') ? 'Cash Account' : 'Bank Account'
);

const ListPayments: React.FC<ListPaymentsProps> = ({ onNavigate, onContactSelect }) => {
  const {
    payments: globalPayments,
    sales,
    customers,
    updatePayment: globalUpdatePayment,
    deletePayment: globalDeletePayment,
    formatCurrency,
    settings,
    currentUser,
    roles,
  } = useGlobalContext();
  const { addNotification } = useNotifications();
  const currencyPrecision = clampPrecision(Number(settings.currencyPrecision ?? 3));

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [selectedUser, setSelectedUser] = useState('All');
  const [selectedMethod, setSelectedMethod] = useState('All');
  const [selectedAccount, setSelectedAccount] = useState('All');
  const [selectedDateRange, setSelectedDateRange] = useState<DateRangeValue | null>(null);
  const [dateRangeFilterKey, setDateRangeFilterKey] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(Number(settings.defaultTableEntries) || 25);
  const [currentPage, setCurrentPage] = useState(1);

  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const actionButtonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  const [viewingPayment, setViewingPayment] = useState<any | null>(null);
  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<any | null>(null);

  const currentRoleRecord = roles.find(r => r.name === currentUser?.role);
  const rolePermissions = currentRoleRecord?.permissions || [];
  const roleHasExplicitPermissions = rolePermissions.length > 0;
  const hasRolePermission = (moduleName: string, permission: string) => {
    if (!currentUser) return false;
    if (String(currentUser.role || '').toLowerCase() === 'admin' || currentRoleRecord?.isSystem) return true;
    if (!roleHasExplicitPermissions) return true;
    return rolePermissions.includes(permission) || rolePermissions.includes(`${moduleName}::${permission}`);
  };
  const canEditPayment = hasRolePermission('Sell', 'Edit sell payment') || hasRolePermission('POS', 'Add/Edit Payment');
  const canDeletePayment = hasRolePermission('Sell', 'Delete sell payment');

  const salesByInvoice = useMemo(() => {
    const map = new Map<string, any>();
    sales.forEach(sale => {
      if (sale.invoiceNo) map.set(String(sale.invoiceNo), sale);
    });
    return map;
  }, [sales]);

  const customerMap = useMemo(() => {
    const map = new Map<string, any>();
    customers.forEach(customer => map.set(String(customer.id), customer));
    return map;
  }, [customers]);

  const paymentRows = useMemo<PaymentRow[]>(() => {
    return globalPayments
      .filter(payment => payment.contactType === 'Customer' && payment.type === 'received')
      .map(payment => {
        const linkedInvoices = Array.isArray(payment.linkedInvoices) ? payment.linkedInvoices.filter(Boolean) : [];
        const inferredInvoices = linkedInvoices.length > 0
          ? linkedInvoices
          : findInvoiceTokens(`${payment.referenceNo || ''} ${payment.note || ''}`);
        const primarySale = inferredInvoices.length > 0 ? salesByInvoice.get(inferredInvoices[0]) : undefined;
        const customer = customerMap.get(String(payment.contactId));
        const customerName = payment.contactName || customer?.businessName || customer?.name || 'Unknown';

        return {
          id: payment.id,
          date: payment.date,
          referenceNo: payment.referenceNo || payment.id,
          contactId: payment.contactId,
          customerName,
          amount: Number(payment.amount || 0),
          method: payment.method || '--',
          note: payment.note || '',
          account: payment.account || payment.paymentAccount || '',
          attachmentName: payment.attachmentName,
          addedBy: payment.addedBy || '',
          location: payment.location || primarySale?.location || '',
          clearedInvoices: inferredInvoices.map(invoiceNo => ({
            invoiceNo,
            status: salesByInvoice.get(invoiceNo)?.paymentStatus || '--',
          })),
          raw: payment,
        };
      })
      .sort((a, b) => (parseDateSafe(b.date)?.getTime() || 0) - (parseDateSafe(a.date)?.getTime() || 0));
  }, [globalPayments, salesByInvoice, customerMap]);

  const customerOptions = useMemo(() => ['All', ...Array.from(new Set(paymentRows.map(p => p.customerName).filter(Boolean)))], [paymentRows]);
  const locationOptions = useMemo(() => ['All', ...Array.from(new Set(paymentRows.map(p => p.location).filter(Boolean)))], [paymentRows]);
  const userOptions = useMemo(() => ['All', ...Array.from(new Set(paymentRows.map(p => p.addedBy).filter(Boolean)))], [paymentRows]);
  const methodOptions = useMemo(() => ['All', ...Array.from(new Set(paymentRows.map(p => p.method).filter(Boolean)))], [paymentRows]);
  const accountOptions = useMemo(() => ['All', ...Array.from(new Set(paymentRows.map(p => p.account || '--').filter(Boolean)))], [paymentRows]);

  const filteredPayments = useMemo(() => {
    const loweredSearch = searchTerm.trim().toLowerCase();
    const startDate = selectedDateRange?.startDate ? new Date(selectedDateRange.startDate) : null;
    const endDate = selectedDateRange?.endDate ? new Date(selectedDateRange.endDate) : null;
    if (endDate) endDate.setHours(23, 59, 59, 999);

    return paymentRows.filter(payment => {
      const paymentDate = parseDateSafe(payment.date);
      const searchMatched =
        !loweredSearch ||
        payment.referenceNo.toLowerCase().includes(loweredSearch) ||
        payment.customerName.toLowerCase().includes(loweredSearch) ||
        payment.note.toLowerCase().includes(loweredSearch) ||
        payment.method.toLowerCase().includes(loweredSearch) ||
        payment.clearedInvoices.some(inv => inv.invoiceNo.toLowerCase().includes(loweredSearch));

      const customerMatched = selectedCustomer === 'All' || payment.customerName === selectedCustomer;
      const locationMatched = selectedLocation === 'All' || payment.location === selectedLocation;
      const userMatched = selectedUser === 'All' || payment.addedBy === selectedUser;
      const methodMatched = selectedMethod === 'All' || payment.method === selectedMethod;
      const accountMatched = selectedAccount === 'All' || (payment.account || '--') === selectedAccount;
      const startMatched = !startDate || (paymentDate && paymentDate >= startDate);
      const endMatched = !endDate || (paymentDate && paymentDate <= endDate);

      return searchMatched && customerMatched && locationMatched && userMatched && methodMatched && accountMatched && !!startMatched && !!endMatched;
    });
  }, [
    paymentRows,
    searchTerm,
    selectedCustomer,
    selectedLocation,
    selectedUser,
    selectedMethod,
    selectedAccount,
    selectedDateRange,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / rowsPerPage));
  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredPayments.slice(start, start + rowsPerPage);
  }, [filteredPayments, currentPage, rowsPerPage]);
  const showingStart = filteredPayments.length === 0 ? 0 : ((currentPage - 1) * rowsPerPage) + 1;
  const showingEnd = Math.min(currentPage * rowsPerPage, filteredPayments.length);

  const paginationItems = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
    const pages: Array<number | 'dots-left' | 'dots-right'> = [1];
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    if (start > 2) pages.push('dots-left');
    for (let page = start; page <= end; page += 1) pages.push(page);
    if (end < totalPages - 1) pages.push('dots-right');
    pages.push(totalPages);
    return pages;
  }, [currentPage, totalPages]);

  useEffect(() => {
    const handleClickOutside = () => setActiveActionId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCustomer, selectedLocation, selectedUser, selectedMethod, selectedAccount, selectedDateRange, rowsPerPage]);

  useEffect(() => {
    if (currentPage <= totalPages) return;
    setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const selectedModalCustomer = useMemo(() => {
    if (!viewingPayment && !editingPayment) return null;
    const targetId = viewingPayment?.contactId || editingPayment?.contactId;
    return customers.find(customer => String(customer.id) === String(targetId)) || null;
  }, [customers, viewingPayment, editingPayment]);

  const toggleActions = (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    if (activeActionId === id) {
      setActiveActionId(null);
      return;
    }
    const button = actionButtonRefs.current[id];
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setDropdownPosition({ top: rect.bottom + 8, left: rect.right - 192 });
    setActiveActionId(id);
  };

  const handleExportCSV = () => {
    const header = ['Date', 'Reference', 'Customer', 'Location', 'Amount', 'Method', 'Payment Account', 'Invoices', 'Added By', 'Note'].join(',');
    const rows = filteredPayments.map(payment => [
      `"${payment.date}"`,
      `"${payment.referenceNo}"`,
      `"${payment.customerName}"`,
      `"${payment.location || '--'}"`,
      payment.amount.toFixed(currencyPrecision),
      `"${payment.method}"`,
      `"${payment.account || '--'}"`,
      `"${payment.clearedInvoices.map(inv => inv.invoiceNo).join(' | ')}"`,
      `"${payment.addedBy || '--'}"`,
      `"${(payment.note || '').replace(/"/g, '""')}"`,
    ].join(','));

    const blob = new Blob([`${header}\n${rows.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'list_payments.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPayment = (payment: PaymentRow) => {
    const newWindow = window.open('', '_blank', 'width=900,height=700');
    if (!newWindow) return;
    const invoices = payment.clearedInvoices.map(inv => inv.invoiceNo).join(', ') || '--';
    newWindow.document.write(`
      <html>
        <head>
          <title>Payment Receipt - ${payment.referenceNo}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { margin-bottom: 0; }
            .muted { color: #64748b; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 24px; }
            td { padding: 10px 0; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
            .label { color: #475569; font-weight: 600; width: 180px; }
          </style>
        </head>
        <body>
          <h1>${settings.businessName || 'ATWAR AL MUSTAQBAL'}</h1>
          <p class="muted">Payment Receipt</p>
          <table>
            <tr><td class="label">Reference</td><td>${payment.referenceNo}</td></tr>
            <tr><td class="label">Date</td><td>${payment.date}</td></tr>
            <tr><td class="label">Customer</td><td>${payment.customerName}</td></tr>
            <tr><td class="label">Amount</td><td>${formatCurrency(payment.amount)}</td></tr>
            <tr><td class="label">Method</td><td>${payment.method}</td></tr>
            <tr><td class="label">Payment Account</td><td>${payment.account || '--'}</td></tr>
            <tr><td class="label">Invoices</td><td>${invoices}</td></tr>
            <tr><td class="label">Note</td><td>${payment.note || '--'}</td></tr>
            <tr><td class="label">Added By</td><td>${payment.addedBy || '--'}</td></tr>
          </table>
        </body>
      </html>
    `);
    newWindow.document.close();
    newWindow.focus();
    newWindow.print();
  };

  const handleSaveEditedPayment = (updatedPayment: any) => {
    const original = globalPayments.find(payment => payment.id === updatedPayment.id);
    if (!original) return;
    const dateValue = String(updatedPayment.paidOn || updatedPayment.date || original.date);
    const resolvedAccount = String(
      updatedPayment.account
      || original.account
      || original.paymentAccount
      || inferAccountFromMethod(updatedPayment.method || original.method || '')
    ).trim();
    const { paymentAccount: _legacyPaymentAccount, ...normalizedUpdatedPayment } = updatedPayment;
    const { paymentAccount: _legacyOriginalPaymentAccount, ...normalizedOriginal } = original;
    globalUpdatePayment({
      ...normalizedOriginal,
      ...normalizedUpdatedPayment,
      amount: Number(updatedPayment.amount || original.amount),
      referenceNo: updatedPayment.referenceNo || updatedPayment.refNo || original.referenceNo,
      date: String(dateValue || original.date),
      account: resolvedAccount,
      note: updatedPayment.note || '',
      location: updatedPayment.location || original.location || '',
      attachmentName: updatedPayment.attachmentName || original.attachmentName,
    });
    addNotification({
      title: 'Payment Updated',
      message: `${updatedPayment.referenceNo || updatedPayment.refNo || original.referenceNo} was updated successfully.`,
      type: 'success',
    });
  };

  const handleDeleteConfirmed = () => {
    if (!deletingPayment) return;
    globalDeletePayment(deletingPayment.id);
    addNotification({
      title: 'Payment Deleted',
      message: `${deletingPayment.referenceNo} was deleted successfully.`,
      type: 'success',
    });
    setDeletingPayment(null);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCustomer('All');
    setSelectedLocation('All');
    setSelectedUser('All');
    setSelectedMethod('All');
    setSelectedAccount('All');
    setSelectedDateRange(null);
    setDateRangeFilterKey((prev) => prev + 1);
    setCurrentPage(1);
  };

  const totalAmount = filteredPayments.reduce((sum, payment) => sum + payment.amount, 0);

  const handlePrint = () => {
    printDocument({
      title: 'List Payments',
      subtitle: selectedDateRange?.label
        ? `Period: ${selectedDateRange.label}`
        : selectedCustomer !== 'All'
          ? `Customer: ${selectedCustomer}`
          : undefined,
      businessName: settings.businessName || 'ATWAR AL MUSTAQBAL',
      businessAddress: settings.address || '',
      printedBy: currentUser?.name || '',
      columns: [
        { label: 'Date', width: '80px' },
        { label: 'Reference No', width: '110px' },
        { label: 'Customer' },
        { label: 'Location', width: '90px' },
        { label: 'Amount', align: 'right', width: '90px' },
        { label: 'Method', width: '90px' },
        { label: 'Account', width: '90px' },
        { label: 'Cleared Invoices' },
        { label: 'Added By', width: '90px' },
        { label: 'Note' },
      ],
      rows: filteredPayments.map(p => [
        parseDateSafe(p.date)?.toLocaleDateString() || p.date,
        p.referenceNo,
        p.customerName,
        p.location || '--',
        formatCurrency(p.amount),
        p.method,
        p.account || '--',
        p.clearedInvoices.length > 0
          ? p.clearedInvoices
            .map(inv => `${inv.invoiceNo} ${paymentBadge(inv.status)}`)
            .join(' ')
          : '--',
        p.addedBy || '--',
        p.note || '--',
      ]),
      stats: [
        { label: 'Total Payments', value: String(filteredPayments.length), color: 'blue' },
        { label: 'Total Amount', value: formatCurrency(totalAmount), color: 'green' },
      ],
      totalRow: [
        'TOTAL', '', '', '',
        formatCurrency(totalAmount),
        '', '', '', '', '',
      ],
    });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
            <CreditCard size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">List Payments</h2>
            <p className="text-slate-500 mt-0.5 text-sm">Manage and view all received customer payments.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowFilters(prev => !prev)}
            className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
          >
            <Filter size={16} /> Filter
          </button>
          <button
            onClick={handleExportCSV}
            className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
          >
            <Download size={16} /> Export
          </button>
          <button
            onClick={handlePrint}
            className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-400"></div>
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search by ref, customer, invoice, method..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border-0 bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-6 px-6 border-l border-slate-100">
            <div className="text-center">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Payments</p>
              <p className="text-xl font-black text-slate-800">{filteredPayments.length}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Amount</p>
              <p className="text-xl font-black text-emerald-600">{formatCurrency(totalAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5 relative overflow-hidden animate-in fade-in duration-200">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-400"></div>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Customer</label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full rounded-xl border-0 bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 text-sm font-medium px-3 py-2.5"
              >
                {customerOptions.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Business Location</label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full rounded-xl border-0 bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 text-sm font-medium px-3 py-2.5"
              >
                {locationOptions.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">User</label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full rounded-xl border-0 bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 text-sm font-medium px-3 py-2.5"
              >
                {userOptions.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Payment Method</label>
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="w-full rounded-xl border-0 bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 text-sm font-medium px-3 py-2.5"
              >
                {methodOptions.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Payment Account</label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full rounded-xl border-0 bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 text-sm font-medium px-3 py-2.5"
              >
                {accountOptions.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <DateRangeFilter key={dateRangeFilterKey} onRangeSelect={(range) => setSelectedDateRange(range)} />
            </div>
            <div className="md:col-span-6 flex justify-end">
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 sticky top-0 text-slate-500 font-semibold border-b border-slate-200">
                <th className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-xs font-semibold text-slate-500 w-44"><div className="flex items-center gap-2">Date <ArrowUpDown size={12} /></div></th>
                <th className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-xs font-semibold text-slate-500 w-40">Reference No</th>
                <th className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-xs font-semibold text-slate-500">Customer</th>
                <th className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-xs font-semibold text-slate-500 w-36">Location</th>
                <th className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-xs font-semibold text-slate-500 w-36">Amount</th>
                <th className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-xs font-semibold text-slate-500 w-40">Payment Method</th>
                <th className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-xs font-semibold text-slate-500 w-44">Attachment</th>
                <th className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-xs font-semibold text-slate-500 w-56">Cleared Invoices</th>
                <th className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-xs font-semibold text-slate-500 w-40">Added By</th>
                <th className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-xs font-semibold text-slate-500 w-56">Note</th>
                <th className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-xs font-semibold text-slate-500 w-24 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.length > 0 ? paginatedPayments.map((payment) => (
                <tr key={payment.id} className="group hover:bg-slate-50/80 transition-colors">
                  <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4">
                    <div className="font-bold text-slate-700 text-sm">
                      {parseDateSafe(payment.date)?.toLocaleDateString() || payment.date}
                      <span className="block text-[10px] text-slate-400 font-medium">
                        {parseDateSafe(payment.date)?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '--'}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4">
                    <span className="font-bold text-slate-600 text-sm bg-slate-100 px-2 py-1 rounded border border-slate-200">{payment.referenceNo}</span>
                  </td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4">
                    <span className="font-bold text-slate-800 text-sm">{payment.customerName}</span>
                  </td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-sm text-slate-600">{payment.location || '--'}</td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4">
                    <span className="font-black text-emerald-600 text-sm">{formatCurrency(payment.amount)}</span>
                  </td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-sm text-slate-700">
                    <span>{payment.method}</span>
                    {payment.raw.method === 'Cheque' && payment.raw.chequeCleared && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">Cleared</span>
                    )}
                    {payment.raw.method === 'Cheque' && !payment.raw.chequeCleared && payment.raw.chequeDate && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">Pending</span>
                    )}
                  </td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4">
                    {payment.attachmentName ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                        <Paperclip size={12} /> {payment.attachmentName}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium italic">No file</span>
                    )}
                  </td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4">
                    {payment.clearedInvoices.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {payment.clearedInvoices.slice(0, 3).map((invoice, index) => (
                          <div key={`${invoice.invoiceNo}-${index}`} className="flex items-center gap-2 text-xs">
                            <button
                              onClick={() => {
                                if (onContactSelect) {
                                  onContactSelect(payment.contactId, 'payments');
                                } else if (onNavigate) {
                                  onNavigate(`view-customer/${payment.contactId}:payments`);
                                }
                              }}
                              className="font-bold text-blue-600 hover:underline"
                            >
                              {invoice.invoiceNo}
                            </button>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase text-white ${invoice.status === 'Paid' ? 'bg-[#74c365]' : invoice.status === 'Partial' ? 'bg-sky-500' : 'bg-amber-400'}`}>
                              {invoice.status}
                            </span>
                          </div>
                        ))}
                        {payment.clearedInvoices.length > 3 && (
                          <span className="text-[10px] text-slate-400 font-bold">+{payment.clearedInvoices.length - 3} more</span>
                        )}
                      </div>
                    ) : <span className="text-xs text-slate-400 italic">None</span>}
                  </td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-sm text-slate-600">{payment.addedBy || '--'}</td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4">
                    <p className="text-sm text-slate-500 truncate max-w-[220px]" title={payment.note}>{payment.note || '-'}</p>
                  </td>
                  <td className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-center relative">
                    <button
                      ref={el => { actionButtonRefs.current[payment.id] = el; }}
                      onClick={(event) => toggleActions(event, payment.id)}
                      className={`p-2 rounded-xl transition-all ${activeActionId === payment.id ? 'bg-slate-900 text-white shadow-lg' : 'p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors'}`}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {activeActionId === payment.id && createPortal(
                      <div
                        className="fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-100 py-2 w-48 max-w-[calc(100vw-2rem)] animate-in fade-in zoom-in-95"
                        style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button onClick={() => { setViewingPayment(payment.raw); setActiveActionId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"><Eye size={16} className="text-blue-500" /> View Details</button>
                        {canEditPayment && (
                          <button onClick={() => { setEditingPayment(payment.raw); setActiveActionId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"><Edit size={16} className="text-amber-500" /> Edit Payment</button>
                        )}
                        {payment.raw.method === 'Cheque' && !payment.raw.chequeCleared && (
                          <button
                            onClick={() => {
                              globalUpdatePayment({ ...payment.raw, chequeCleared: true });
                              setActiveActionId(null);
                              addNotification({ title: 'Cheque Cleared', message: `Payment marked as deposited/cleared.`, type: 'success' });
                            }}
                            className="w-full text-left px-4 py-2.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50 flex items-center gap-3 transition-colors"
                          >
                            <CheckCircle2 size={16} className="text-emerald-500" /> Mark as Cleared
                          </button>
                        )}
                        <button onClick={() => { handlePrintPayment(payment); setActiveActionId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"><Printer size={16} className="text-slate-500" /> Print Receipt</button>
                        {canDeletePayment && (
                          <>
                            <div className="h-px bg-slate-100 my-1 mx-2"></div>
                            <button onClick={() => { setDeletingPayment(payment); setActiveActionId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-3 transition-colors"><Trash2 size={16} /> Delete Payment</button>
                          </>
                        )}
                      </div>,
                      document.body
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-slate-400">
                    <p className="font-medium">No payments found</p>
                    <p className="text-xs mt-1">Try adjusting your filters or search term.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-slate-600">
            <label className="flex items-center gap-2">
              <span>Show</span>
              <select
                value={rowsPerPage}
                onChange={(e) => setRowsPerPage(Number(e.target.value) || 25)}
                className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-sm"
              >
                {[10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
              </select>
              <span>entries</span>
            </label>
            <span className="text-xs text-slate-500">
              Showing {showingStart} to {showingEnd} of {filteredPayments.length} entries
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1.5 rounded-lg border text-sm ${currentPage === 1 ? 'border-slate-100 text-slate-300 cursor-not-allowed' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              Previous
            </button>

            {paginationItems.map((pageItem, index) => (
              typeof pageItem === 'number' ? (
                <button
                  key={`page-${pageItem}`}
                  onClick={() => setCurrentPage(pageItem)}
                  className={`min-w-[2rem] px-2.5 py-1.5 rounded-lg text-sm border ${currentPage === pageItem ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {pageItem}
                </button>
              ) : (
                <span key={`dots-${index}`} className="px-2 text-slate-400">...</span>
              )
            ))}

            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1.5 rounded-lg border text-sm ${currentPage === totalPages ? 'border-slate-100 text-slate-300 cursor-not-allowed' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <ViewPaymentModal
        isOpen={!!viewingPayment}
        onClose={() => setViewingPayment(null)}
        payment={viewingPayment}
        customer={selectedModalCustomer}
      />

      <EditPaymentModal
        isOpen={!!editingPayment}
        onClose={() => setEditingPayment(null)}
        payment={editingPayment}
        customer={selectedModalCustomer}
        onSave={handleSaveEditedPayment}
      />

      <ConfirmationModal
        isOpen={!!deletingPayment}
        onClose={() => setDeletingPayment(null)}
        onConfirm={handleDeleteConfirmed}
        title="Delete Payment"
        message={`Are you sure you want to delete payment ${deletingPayment?.referenceNo}? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
      />
    </div>
  );
};

export default ListPayments;
