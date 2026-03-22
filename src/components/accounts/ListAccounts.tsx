import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, FileText, FileSpreadsheet, Printer, Filter, ArrowUpDown, BookOpen, List, MapPin,
  X, Edit, Trash2, History, ChevronDown, Landmark
} from 'lucide-react';
import MultiSelect from '@/components/shared/MultiSelect';
import { useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import { ConfirmationModal } from '@/components/users/UserModals';
import {
  dispatchPaymentAccountsUpdated,
  getStoredPaymentAccounts,
  getStoredPaymentAccountTypes,
  inferPaymentAccountName,
  normalizeAccountKey,
  PAYMENT_ACCOUNTS_STORAGE_KEY,
  PAYMENT_ACCOUNT_TYPES_STORAGE_KEY,
} from '@/utils/paymentAccounts';
import { paymentLocationCandidates } from '@/utils/accountingSnapshot';
import { buildPaginationItems } from '@/utils/pagination';

interface ListAccountsProps {
  onNavigate?: (page: string) => void;
  canEditAccountTransactions?: boolean;
  canDeleteAccountTransactions?: boolean;
}

interface PaymentAccountRow {
  id: string;
  name: string;
  location: string;
  type: string;
  subType: string;
  accountNumber: string;
  note: string;
  balance: number;
  addedBy: string;
  status: 'Active' | 'Inactive';
  system?: boolean;
}

const resolvePaymentAccountForLedger = (payment: any): string => {
  const explicitAccount = String(payment?.account || '').trim();
  if (explicitAccount) return explicitAccount;
  return inferPaymentAccountName(payment);
};

const ListAccounts: React.FC<ListAccountsProps> = ({
  onNavigate,
  canEditAccountTransactions = true,
  canDeleteAccountTransactions = true,
}) => {
  const { locations, payments, sales, expenses, currentUser, formatCurrency } = useGlobalContext();
  const { addNotification } = useNotifications();

  const [activeTab, setActiveTab] = useState<'accounts' | 'accountTypes'>('accounts');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddTypeModalOpen, setIsAddTypeModalOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentTypePage, setCurrentTypePage] = useState(1);
  const [newType, setNewType] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showColumnControls, setShowColumnControls] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    location: true,
    type: true,
    subType: true,
    accountNumber: true,
    note: true,
    balance: true,
    addedBy: true,
  });
  const [filters, setFilters] = useState({
    status: [] as string[],
    location: [] as string[],
  });

  const [customAccounts, setCustomAccounts] = useState<PaymentAccountRow[]>(() => {
    return getStoredPaymentAccounts();
  });

  const [accountTypes, setAccountTypes] = useState<string[]>(() => {
    return getStoredPaymentAccountTypes();
  });

  const [form, setForm] = useState({
    name: '',
    location: locations[0]?.name || '',
    type: getStoredPaymentAccountTypes()[0] || 'Cash',
    subType: 'Default',
    accountNumber: '',
    note: '',
    status: 'Active' as 'Active' | 'Inactive',
  });

  useEffect(() => {
    localStorage.setItem(PAYMENT_ACCOUNTS_STORAGE_KEY, JSON.stringify(customAccounts));
    dispatchPaymentAccountsUpdated();
  }, [customAccounts]);

  useEffect(() => {
    localStorage.setItem(PAYMENT_ACCOUNT_TYPES_STORAGE_KEY, JSON.stringify(accountTypes));
    dispatchPaymentAccountsUpdated();
  }, [accountTypes]);

  const salesLocationByInvoice = useMemo(() => {
    const map = new Map<string, string>();
    sales.forEach((sale) => {
      const invoiceNo = String(sale.invoiceNo || '').trim();
      if (!invoiceNo) return;
      map.set(invoiceNo, String(sale.location || '').trim());
    });
    return map;
  }, [sales]);

  const expensesById = useMemo(() => {
    const map = new Map<string, any>();
    expenses.forEach((expense) => map.set(String(expense.id || '').trim(), expense));
    return map;
  }, [expenses]);

  const balanceByAccount = useMemo(() => {
    return payments.reduce<Record<string, number>>((acc, payment) => {
      const accountName = resolvePaymentAccountForLedger(payment);
      const key = normalizeAccountKey(accountName);
      if (!key) return acc;
      const delta = payment.type === 'received' ? Number(payment.amount || 0) : -Number(payment.amount || 0);
      acc[key] = (acc[key] || 0) + delta;
      return acc;
    }, {});
  }, [payments]);

  const accountLabelByKey = useMemo(() => {
    const labels = new Map<string, string>();
    customAccounts.forEach((account) => {
      const key = normalizeAccountKey(account.name);
      if (key) labels.set(key, account.name);
    });
    payments.forEach((payment) => {
      const label = resolvePaymentAccountForLedger(payment);
      const key = normalizeAccountKey(label);
      if (!key || labels.has(key)) return;
      labels.set(key, label);
    });
    return labels;
  }, [customAccounts, payments]);

  const accountLocationByKey = useMemo(() => {
    const map = new Map<string, string>();
    payments.forEach((payment) => {
      const key = normalizeAccountKey(resolvePaymentAccountForLedger(payment));
      if (!key || map.has(key)) return;
      const inferredLocation = paymentLocationCandidates({
        payment,
        salesLocationByInvoice,
        expensesById,
      })[0] || '';
      if (inferredLocation) map.set(key, inferredLocation);
    });
    return map;
  }, [payments, salesLocationByInvoice, expensesById]);

  const countLinkedTransactionsForAccount = (accountName: string): number => {
    const targetKey = normalizeAccountKey(accountName);
    if (!targetKey) return 0;
    return payments.filter(payment => (
      normalizeAccountKey(resolvePaymentAccountForLedger(payment)) === targetKey
    )).length;
  };

  const accounts = useMemo<PaymentAccountRow[]>(() => {
    const customByKey = new Map(customAccounts.map(account => [normalizeAccountKey(account.name), account]));
    const mergedCustom = customAccounts.map(account => {
      const key = normalizeAccountKey(account.name);
      return {
        ...account,
        balance: Number((balanceByAccount[key] ?? account.balance) || 0),
        location: account.location || accountLocationByKey.get(key) || '',
      };
    });

    const generated: PaymentAccountRow[] = Object.entries(balanceByAccount)
      .filter(([key]) => !customByKey.has(normalizeAccountKey(key)))
      .map(([key, balance]) => {
        const label = accountLabelByKey.get(key) || key;
        return {
          id: `AUTO-${key}`,
          name: label,
          location: accountLocationByKey.get(key) || '',
          type: normalizeAccountKey(label).includes('cash') ? 'Cash' : 'Bank',
          subType: 'Auto',
          accountNumber: '',
          note: 'Auto-generated from payment transactions',
          balance: Number(balance) || 0,
          addedBy: 'System',
          status: 'Active',
          system: true,
        };
      });

    return [...mergedCustom, ...generated];
  }, [customAccounts, balanceByAccount, accountLocationByKey, accountLabelByKey]);

  const filteredAccounts = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    const scoped = accounts.filter(acc =>
      (filters.status.length === 0 || filters.status.includes(acc.status)) &&
      (filters.location.length === 0 || filters.location.includes(acc.location)) &&
      (!lowerSearch || `${acc.name} ${acc.accountNumber} ${acc.note} ${acc.type} ${acc.subType}`.toLowerCase().includes(lowerSearch))
    );
    return scoped.sort((left, right) => {
      const compare = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
      return sortDirection === 'asc' ? compare : -compare;
    });
  }, [accounts, filters, search, sortDirection]);

  const totalBalance = filteredAccounts.reduce((acc, a) => acc + a.balance, 0);
  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / entriesPerPage));
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const accountPageStart = (safeCurrentPage - 1) * entriesPerPage;
  const pagedAccounts = filteredAccounts.slice(accountPageStart, accountPageStart + entriesPerPage);
  const accountPageItems = buildPaginationItems(safeCurrentPage, totalPages);
  const showingAccountsFrom = filteredAccounts.length === 0 ? 0 : accountPageStart + 1;
  const showingAccountsTo = Math.min(accountPageStart + pagedAccounts.length, filteredAccounts.length);

  const totalTypePages = Math.max(1, Math.ceil(accountTypes.length / entriesPerPage));
  const safeTypePage = Math.min(Math.max(currentTypePage, 1), totalTypePages);
  const typePageStart = (safeTypePage - 1) * entriesPerPage;
  const pagedAccountTypes = accountTypes.slice(typePageStart, typePageStart + entriesPerPage);
  const typePageItems = buildPaginationItems(safeTypePage, totalTypePages);
  const showingTypesFrom = accountTypes.length === 0 ? 0 : typePageStart + 1;
  const showingTypesTo = Math.min(typePageStart + pagedAccountTypes.length, accountTypes.length);

  const openAddModal = () => {
    if (!canEditAccountTransactions) {
      addNotification({
        title: 'Access Denied',
        message: 'You do not have permission to edit account transactions.',
        type: 'error',
      });
      return;
    }
    setEditingId(null);
    setForm({
      name: '',
      location: locations[0]?.name || '',
      type: accountTypes[0] || 'Cash',
      subType: 'Default',
      accountNumber: '',
      note: '',
      status: 'Active',
    });
    setIsAddModalOpen(true);
    setActiveDropdown(null);
  };

  const handleSaveAccount = () => {
    if (!canEditAccountTransactions) {
      addNotification({
        title: 'Access Denied',
        message: 'You do not have permission to edit account transactions.',
        type: 'error',
      });
      return;
    }
    const name = form.name.trim();
    if (!name) {
      addNotification({
        title: 'Validation Error',
        message: 'Account name is required.',
        type: 'error',
      });
      return;
    }
    if (!form.location.trim()) {
      addNotification({
        title: 'Validation Error',
        message: 'Business location is required.',
        type: 'error',
      });
      return;
    }
    const duplicate = customAccounts.find(account =>
      normalizeAccountKey(account.name) === normalizeAccountKey(name) &&
      account.id !== editingId
    );
    if (duplicate) {
      addNotification({
        title: 'Duplicate Account',
        message: `Account "${name}" already exists.`,
        type: 'error',
      });
      return;
    }

    if (editingId) {
      setCustomAccounts(prev => prev.map(a => a.id === editingId ? {
        ...a,
        ...form,
        name,
      } : a));
      addNotification({
        title: 'Account Updated',
        message: `${name} has been updated successfully.`,
        type: 'success',
      });
    } else {
      setCustomAccounts(prev => [...prev, {
        id: `ACC-${Date.now()}`,
        ...form,
        name,
        balance: 0,
        addedBy: currentUser?.name || 'Admin',
      }]);
      addNotification({
        title: 'Account Added',
        message: `${name} has been created successfully.`,
        type: 'success',
      });
    }
    setIsAddModalOpen(false);
  };

  const handleEdit = (id: string) => {
    if (!canEditAccountTransactions) {
      addNotification({
        title: 'Access Denied',
        message: 'You do not have permission to edit account transactions.',
        type: 'error',
      });
      setActiveDropdown(null);
      return;
    }
    const account = customAccounts.find(a => a.id === id);
    if (!account) return;
    setEditingId(id);
    setForm({
      name: account.name,
      location: account.location,
      type: account.type,
      subType: account.subType,
      accountNumber: account.accountNumber,
      note: account.note,
      status: account.status,
    });
    setIsAddModalOpen(true);
    setActiveDropdown(null);
  };

  const handleAccountBook = (account: PaymentAccountRow) => {
    try {
      localStorage.setItem('app_payment_account_report_focus', JSON.stringify({
        account: account.name,
        location: account.location || '',
      }));
    } catch {
      // do not block navigation for localStorage write errors
    }
    if (onNavigate) onNavigate('payment-account-report');
    setActiveDropdown(null);
  };

  const requestDelete = (id: string) => {
    if (!canDeleteAccountTransactions) {
      addNotification({
        title: 'Access Denied',
        message: 'You do not have permission to delete account transactions.',
        type: 'error',
      });
      setActiveDropdown(null);
      return;
    }
    const account = customAccounts.find(a => a.id === id);
    if (!account) {
      setActiveDropdown(null);
      return;
    }
    const linkedCount = countLinkedTransactionsForAccount(account.name);
    if (linkedCount > 0) {
      addNotification({
        title: 'Delete Blocked',
        message: `Account "${account.name}" is linked to ${linkedCount} transaction(s) and cannot be deleted.`,
        type: 'error',
      });
      setActiveDropdown(null);
      return;
    }
    setPendingDeleteId(id);
    setActiveDropdown(null);
  };

  const handleDeleteConfirmed = () => {
    if (!pendingDeleteId) return;
    const account = customAccounts.find(a => a.id === pendingDeleteId);
    if (!account) {
      setPendingDeleteId(null);
      return;
    }

    const linkedCount = countLinkedTransactionsForAccount(account.name);
    if (linkedCount > 0) {
      addNotification({
        title: 'Delete Blocked',
        message: `Account "${account.name}" is linked to ${linkedCount} transaction(s) and cannot be deleted.`,
        type: 'error',
      });
      setPendingDeleteId(null);
      return;
    }

    setCustomAccounts(prev => prev.filter(acc => acc.id !== pendingDeleteId));
    setPendingDeleteId(null);
    addNotification({
      title: 'Account Deleted',
      message: `${account.name} has been deleted.`,
      type: 'success',
    });
  };

  const handleSaveType = () => {
    const cleaned = newType.trim();
    if (!cleaned) {
      addNotification({
        title: 'Validation Error',
        message: 'Account type is required.',
        type: 'error',
      });
      return;
    }
    if (accountTypes.some(t => normalizeAccountKey(t) === normalizeAccountKey(cleaned))) {
      addNotification({
        title: 'Duplicate Type',
        message: `Account type "${cleaned}" already exists.`,
        type: 'warning',
      });
      return;
    }
    setAccountTypes(prev => [...prev, cleaned]);
    setNewType('');
    setIsAddTypeModalOpen(false);
    addNotification({
      title: 'Type Added',
      message: `${cleaned} was added to account types.`,
      type: 'success',
    });
  };

  const toggleSortByName = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
  };

  const exportRows = filteredAccounts.map(account => ({
    name: account.name,
    location: account.location || '--',
    type: account.type,
    subType: account.subType,
    accountNumber: account.accountNumber || '--',
    note: account.note || '--',
    balance: Number(account.balance || 0),
    addedBy: account.addedBy || '--',
  }));
  const visibleColumnCount = 2 + Object.values(visibleColumns).filter(Boolean).length;

  const handleExportCSV = () => {
    const headers = ['Name', 'Location', 'Account Type', 'Sub Type', 'Account Number', 'Note', 'Balance', 'Added By'];
    const rows = exportRows.map(row => [
      row.name,
      row.location,
      row.type,
      row.subType,
      row.accountNumber,
      row.note.replace(/"/g, '""'),
      row.balance.toFixed(3),
      row.addedBy,
    ]);
    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'payment_accounts.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    const headers = ['Name', 'Location', 'Account Type', 'Sub Type', 'Account Number', 'Note', 'Balance', 'Added By'];
    const rows = exportRows.map(row => [
      row.name,
      row.location,
      row.type,
      row.subType,
      row.accountNumber,
      row.note,
      row.balance.toFixed(3),
      row.addedBy,
    ]);
    const content = [headers.join('\t'), ...rows.map(row => row.join('\t'))].join('\n');
    const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'payment_accounts.xls';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printable = window.open('', '_blank', 'width=1100,height=760');
    if (!printable) return;
    const rows = exportRows
      .map(row => `
        <tr>
          <td>${row.name}</td>
          <td>${row.location}</td>
          <td>${row.type}</td>
          <td>${row.subType}</td>
          <td>${row.accountNumber}</td>
          <td>${row.note}</td>
          <td style="text-align:right;">${formatCurrency(row.balance)}</td>
          <td>${row.addedBy}</td>
        </tr>
      `)
      .join('');
    printable.document.write(`
      <html>
        <head>
          <title>Payment Accounts</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h2 { margin: 0 0 12px; }
            table { border-collapse: collapse; width: 100%; font-size: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #f8fafc; }
            tfoot td { font-weight: bold; background: #f1f5f9; }
          </style>
        </head>
        <body>
          <h2>Payment Accounts</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Location</th>
                <th>Account Type</th>
                <th>Sub Type</th>
                <th>Account Number</th>
                <th>Note</th>
                <th>Balance</th>
                <th>Added By</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr>
                <td colspan="6">Total</td>
                <td style="text-align:right;">${formatCurrency(totalBalance)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `);
    printable.document.close();
    printable.focus();
    printable.print();
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filters, sortDirection, entriesPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (currentTypePage > totalTypePages) setCurrentTypePage(totalTypePages);
  }, [currentTypePage, totalTypePages]);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
            <Landmark size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Payment Accounts</h2>
            <p className="text-slate-500 text-sm mt-0.5">Manage your payment accounts</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="flex border-b border-slate-200 px-6 pt-4 gap-8">
          <button onClick={() => setActiveTab('accounts')} className={`flex items-center gap-2 pb-4 text-sm font-bold transition-colors ${activeTab === 'accounts' ? 'border-b-2 border-blue-500 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>
            <BookOpen size={18} /> Accounts
          </button>
          <button onClick={() => setActiveTab('accountTypes')} className={`flex items-center gap-2 pb-4 text-sm font-bold transition-colors ${activeTab === 'accountTypes' ? 'border-b-2 border-blue-500 text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>
            <List size={18} /> Account Types
          </button>
        </div>

        <div className="p-6 space-y-6">
          {activeTab === 'accounts' ? (
            <>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                  <div className="w-full sm:w-48">
                    <MultiSelect label="Status" options={['Active', 'Inactive']} selected={filters.status} onChange={(val) => setFilters({ ...filters, status: val })} />
                  </div>
                  <div className="w-full sm:w-64">
                    <MultiSelect label="Location" options={locations.map(loc => loc.name)} selected={filters.location} onChange={(val) => setFilters({ ...filters, location: val })} />
                  </div>
                </div>
                <button
                  onClick={openAddModal}
                  disabled={!canEditAccountTransactions}
                  className={`px-6 py-2 rounded-full text-sm font-bold transition shadow-sm flex items-center gap-2 ${
                    canEditAccountTransactions
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Plus size={16} /> Add
                </button>
              </div>

              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-bold">Show</span>
                  <select
                    value={entriesPerPage}
                    onChange={(event) => setEntriesPerPage(Number(event.target.value) || 25)}
                    className="border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-xs text-slate-600 font-bold">entries</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleExportCSV} className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors"><FileText size={14} /> Export CSV</button>
                  <button onClick={handleExportExcel} className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors"><FileSpreadsheet size={14} /> Export Excel</button>
                  <button onClick={handlePrint} className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors"><Printer size={14} /> Print</button>
                  <button onClick={() => setShowColumnControls(prev => !prev)} className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors"><Filter size={14} /> Column visibility</button>
                </div>
                <div className="relative w-full md:w-auto">
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ..." className="w-full md:w-64 px-4 py-1.5 rounded border border-slate-200 bg-white focus:border-blue-500 focus:outline-none text-sm placeholder:text-slate-400" />
                </div>
              </div>

              {showColumnControls && (
                <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 flex flex-wrap gap-3">
                  {(Object.keys(visibleColumns) as Array<keyof typeof visibleColumns>).map((column) => (
                    <label key={column} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 capitalize">
                      <input
                        type="checkbox"
                        checked={visibleColumns[column]}
                        onChange={() => toggleColumn(column)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      {column}
                    </label>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-white text-slate-900 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 whitespace-nowrap">
                        <button onClick={toggleSortByName} className="inline-flex items-center gap-1">
                          Name <ArrowUpDown size={14} className="text-slate-400"/>
                        </button>
                      </th>
                      {visibleColumns.location && <th className="px-4 py-3 whitespace-nowrap border-l border-slate-200">Location</th>}
                      {visibleColumns.type && <th className="px-4 py-3 whitespace-nowrap border-l border-slate-200">Account Type</th>}
                      {visibleColumns.subType && <th className="px-4 py-3 whitespace-nowrap border-l border-slate-200">Account Sub Type</th>}
                      {visibleColumns.accountNumber && <th className="px-4 py-3 whitespace-nowrap border-l border-slate-200">Account Number</th>}
                      {visibleColumns.note && <th className="px-4 py-3 whitespace-nowrap border-l border-slate-200">Note</th>}
                      {visibleColumns.balance && <th className="px-4 py-3 whitespace-nowrap border-l border-slate-200">Balance</th>}
                      {visibleColumns.addedBy && <th className="px-4 py-3 whitespace-nowrap border-l border-slate-200">Added By</th>}
                      <th className="px-4 py-3 whitespace-nowrap border-l border-slate-200">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-slate-50/50">
                    {pagedAccounts.map((account) => (
                      <tr key={account.id} className="bg-white hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">{account.name}</td>
                        {visibleColumns.location && (
                          <td className="px-4 py-3 text-slate-600 border-l border-slate-200 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-bold">
                              <MapPin size={12} /> {account.location || '--'}
                            </span>
                          </td>
                        )}
                        {visibleColumns.type && <td className="px-4 py-3 text-slate-600 border-l border-slate-200 whitespace-nowrap">{account.type}</td>}
                        {visibleColumns.subType && <td className="px-4 py-3 text-slate-600 border-l border-slate-200 whitespace-nowrap">{account.subType}</td>}
                        {visibleColumns.accountNumber && <td className="px-4 py-3 text-slate-600 border-l border-slate-200 whitespace-nowrap">{account.accountNumber || '--'}</td>}
                        {visibleColumns.note && <td className="px-4 py-3 text-slate-600 border-l border-slate-200">{account.note || '--'}</td>}
                        {visibleColumns.balance && <td className="px-4 py-3 font-bold text-slate-900 border-l border-slate-200 whitespace-nowrap">{formatCurrency(account.balance)}</td>}
                        {visibleColumns.addedBy && <td className="px-4 py-3 text-slate-600 border-l border-slate-200 whitespace-nowrap">{account.addedBy}</td>}
                        <td className="px-4 py-3 text-slate-600 border-l border-slate-200 whitespace-nowrap relative">
                          <button onClick={() => setActiveDropdown(activeDropdown === account.id ? null : account.id)} className="bg-blue-500 text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-600 transition-colors flex items-center gap-1">
                            Options <ChevronDown size={12} />
                          </button>
                          {activeDropdown === account.id && (
                            <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-100 z-10 py-1">
                              {!account.system && canEditAccountTransactions && (
                                <button onClick={() => handleEdit(account.id)} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                  <Edit size={14} className="text-slate-400" /> Edit
                                </button>
                              )}
                              <button onClick={() => handleAccountBook(account)} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                <History size={14} className="text-slate-400" /> Account Book
                              </button>
                              {!account.system && canDeleteAccountTransactions && (
                                <button onClick={() => requestDelete(account.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                                  <Trash2 size={14} /> Delete
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {pagedAccounts.length === 0 && (
                      <tr><td colSpan={visibleColumnCount} className="px-6 py-8 text-center text-slate-400 italic">No accounts found</td></tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-200/80 font-bold text-slate-900 border-t border-slate-300">
                    <tr>
                      <td colSpan={Math.max(1, visibleColumnCount - 1)} className="px-6 py-3 text-center text-base">Total:</td>
                      <td className="px-4 py-3 whitespace-nowrap border-l border-slate-300">{formatCurrency(totalBalance)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 bg-slate-50/30">
                <div>Showing {showingAccountsFrom} to {showingAccountsTo} of {filteredAccounts.length} entries</div>
                <div className="flex gap-1">
                  <button
                    className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </button>
                  {accountPageItems.map((item, index) => item === '...'
                    ? <span key={`accounts-page-ellipsis-${index}`} className="px-2 py-1 text-slate-400">...</span>
                    : (
                      <button
                        key={item}
                        className={`px-3 py-1 border rounded shadow-sm ${item === safeCurrentPage ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                        onClick={() => setCurrentPage(item)}
                      >
                        {item}
                      </button>
                    ))}
                  <button
                    className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    if (!canEditAccountTransactions) {
                      addNotification({
                        title: 'Access Denied',
                        message: 'You do not have permission to edit account transactions.',
                        type: 'error',
                      });
                      return;
                    }
                    setIsAddTypeModalOpen(true);
                  }}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition shadow-sm flex items-center gap-2 ${
                    canEditAccountTransactions
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                  disabled={!canEditAccountTransactions}
                >
                  <Plus size={16} /> Add
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-white text-slate-900 font-bold border-b border-slate-200">
                    <tr><th className="px-4 py-3 whitespace-nowrap">Name</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-slate-50/50">
                    {pagedAccountTypes.map(type => (
                      <tr key={type} className="bg-white hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">{type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 bg-slate-50/30">
                <div>Showing {showingTypesFrom} to {showingTypesTo} of {accountTypes.length} entries</div>
                <div className="flex gap-1">
                  <button
                    className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
                    disabled={safeTypePage <= 1}
                    onClick={() => setCurrentTypePage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </button>
                  {typePageItems.map((item, index) => item === '...'
                    ? <span key={`types-page-ellipsis-${index}`} className="px-2 py-1 text-slate-400">...</span>
                    : (
                      <button
                        key={item}
                        className={`px-3 py-1 border rounded shadow-sm ${item === safeTypePage ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                        onClick={() => setCurrentTypePage(item)}
                      >
                        {item}
                      </button>
                    ))}
                  <button
                    className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
                    disabled={safeTypePage >= totalTypePages}
                    onClick={() => setCurrentTypePage((prev) => Math.min(totalTypePages, prev + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-xl font-black text-slate-900">{editingId ? 'Edit Account' : 'Add Account'}</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all" placeholder="Account Name" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Location *</label>
                  <select value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-white">
                    <option value="">Select Location</option>
                    {locations.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Account Type *</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-white">
                    {accountTypes.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Account Sub Type</label>
                  <input value={form.subType} onChange={(e) => setForm({ ...form, subType: e.target.value })} type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all" placeholder="Sub Type" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Account Number</label>
                  <input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all" placeholder="Account Number" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'Active' | 'Inactive' })} className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-white">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Note</label>
                <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all" rows={3} placeholder="Account details..."></textarea>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button onClick={() => setIsAddModalOpen(false)} className="px-6 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-200 transition-colors">Close</button>
              <button
                onClick={handleSaveAccount}
                disabled={!canEditAccountTransactions}
                className={`px-6 py-2 rounded-lg font-bold transition-colors shadow-sm ${
                  canEditAccountTransactions
                    ? 'text-white bg-blue-600 hover:bg-blue-700'
                    : 'text-slate-400 bg-slate-200 cursor-not-allowed'
                }`}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddTypeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-xl font-normal text-slate-800">Add account type</h3>
              <button onClick={() => setIsAddTypeModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-900">Name:*</label>
                <input value={newType} onChange={(e) => setNewType(e.target.value)} type="text" className="w-full px-4 py-2 rounded border border-slate-200 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400" placeholder="Name" />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={handleSaveType}
                disabled={!canEditAccountTransactions}
                className={`px-6 py-2 rounded font-bold transition-colors ${
                  canEditAccountTransactions
                    ? 'text-white bg-blue-600 hover:bg-blue-700'
                    : 'text-slate-400 bg-slate-200 cursor-not-allowed'
                }`}
              >
                Save
              </button>
              <button onClick={() => setIsAddTypeModalOpen(false)} className="px-6 py-2 rounded font-bold text-white bg-slate-700 hover:bg-slate-800 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!pendingDeleteId}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={handleDeleteConfirmed}
        title="Delete account?"
        message={`Are you sure you want to delete "${customAccounts.find(a => a.id === pendingDeleteId)?.name || 'this account'}"?`}
        confirmLabel="Delete"
        confirmVariant="danger"
      />
    </div>
  );
};

export default ListAccounts;
