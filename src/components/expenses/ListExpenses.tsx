import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, FileText, FileSpreadsheet, Printer, Columns, Edit, Trash2, ChevronDown, Filter, Eye, ArrowUpDown, X, Receipt } from 'lucide-react';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import MultiSelect from '@/components/shared/MultiSelect';
import { Expense, useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import { printDocument, paymentBadge } from '@/utils/printUtils';
import { formatExpenseDateTime, parseExpenseDateToMs } from '@/utils/expenses';
import { formatDateBySettings } from '@/utils/dateTime';

interface ListExpensesProps {
  onNavigate: (page: string) => void;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  restrictToAddedById?: string;
  restrictToAddedByName?: string;
}

interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

type ColumnKey = 'date' | 'ref' | 'recurring' | 'category' | 'subCategory' | 'location' | 'status' | 'tax' | 'total' | 'due' | 'expenseFor' | 'contact' | 'note' | 'addedBy';

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const getCurrentYearRange = (): DateRangeValue => {
  const now = new Date();
  return { startDate: new Date(now.getFullYear(), 0, 1), endDate: new Date(now.getFullYear(), 11, 31), label: 'This Year' };
};

const isOwnerMatch = (expense: Expense, ownerIdFilter: string, ownerNameFilter: string) => {
  if (!ownerIdFilter && !ownerNameFilter) return true;
  const ownerId = normalize(expense.addedById);
  const ownerName = normalize(expense.addedBy);
  if (ownerIdFilter && ownerNameFilter) {
    return ownerId === ownerIdFilter && ownerName === ownerNameFilter;
  }
  if (ownerIdFilter) return ownerId === ownerIdFilter;
  if (ownerNameFilter) return ownerName === ownerNameFilter;
  return false;
};

const toCsvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const ListExpenses: React.FC<ListExpensesProps> = ({
  onNavigate,
  canAdd = true,
  canEdit = true,
  canDelete = canEdit,
  restrictToAddedById = '',
  restrictToAddedByName = '',
}) => {
  const { expenses, expenseCategories, deleteExpense, formatCurrency, settings, currentUser, payments, deletePayment } = useGlobalContext();
  const { addNotification } = useNotifications();

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewExpenseId, setViewExpenseId] = useState<string | null>(null);
  const [range, setRange] = useState<DateRangeValue>(getCurrentYearRange);
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const [filters, setFilters] = useState({
    category: [] as string[],
    subCategory: [] as string[],
    paymentStatus: [] as string[],
  });

  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
    date: true,
    ref: true,
    recurring: true,
    category: true,
    subCategory: true,
    location: true,
    status: true,
    tax: true,
    total: true,
    due: true,
    expenseFor: true,
    contact: true,
    note: true,
    addedBy: true,
  });

  const ownerIdFilter = normalize(restrictToAddedById);
  const ownerNameFilter = normalize(restrictToAddedByName);

  const getTotal = (expense: Expense) => Number(expense.totalAmount || expense.amount || 0);
  const getDue = (expense: Expense) => {
    const total = getTotal(expense);
    if (typeof expense.paymentDue === 'number' && Number.isFinite(expense.paymentDue)) return Math.max(0, expense.paymentDue);
    const paid = Number(expense.paidAmount || 0);
    return Math.max(0, total - paid);
  };

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      const inActionMenu = event.target.closest('[data-expense-action-menu]');
      const inActionButton = event.target.closest('[data-expense-action-button]');
      const inColumnMenu = event.target.closest('[data-expense-column-menu]');
      const inColumnButton = event.target.closest('[data-expense-column-button]');
      if (!inActionMenu && !inActionButton) setActiveActionId(null);
      if (!inColumnMenu && !inColumnButton) setShowColumnMenu(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setActiveActionId(null);
      setShowColumnMenu(false);
      setViewExpenseId(null);
      setConfirmDeleteId(null);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const categoryOptions = useMemo(() => Array.from(new Set([
    ...expenseCategories.map((c) => String(c.name || '').trim()),
    ...expenses.map((e) => String(e.category || '').trim()),
  ].filter(Boolean))).sort(), [expenseCategories, expenses]);

  const subCategoryOptions = useMemo(() => Array.from(new Set(expenses.map((e) => String(e.subCategory || '').trim()).filter(Boolean))).sort(), [expenses]);

  const filteredExpenses = useMemo(() => {
    const query = normalize(searchTerm);
    const startMs = range.startDate ? new Date(range.startDate.getFullYear(), range.startDate.getMonth(), range.startDate.getDate(), 0, 0, 0, 0).getTime() : null;
    const endMs = range.endDate ? new Date(range.endDate.getFullYear(), range.endDate.getMonth(), range.endDate.getDate(), 23, 59, 59, 999).getTime() : null;

    return expenses
      .filter((expense) => {
        if (!isOwnerMatch(expense, ownerIdFilter, ownerNameFilter)) return false;
        if (query) {
          const hay = [expense.refNo, expense.category, expense.subCategory, expense.contact, expense.expenseFor, expense.location, expense.note, expense.addedBy].map(normalize);
          if (!hay.some((v) => v.includes(query))) return false;
        }
        if (filters.category.length > 0 && !filters.category.includes(expense.category)) return false;
        if (filters.subCategory.length > 0 && !filters.subCategory.includes(expense.subCategory || '')) return false;
        if (filters.paymentStatus.length > 0 && !filters.paymentStatus.includes(expense.paymentStatus)) return false;
        if (startMs != null || endMs != null) {
          const expenseMs = parseExpenseDateToMs(expense.date);
          if (!Number.isFinite(expenseMs)) return false;
          if (startMs != null && expenseMs < startMs) return false;
          if (endMs != null && expenseMs > endMs) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const left = parseExpenseDateToMs(a.date);
        const right = parseExpenseDateToMs(b.date);
        return (Number.isFinite(right) ? right : 0) - (Number.isFinite(left) ? left : 0);
      });
  }, [expenses, searchTerm, filters, range, ownerIdFilter, ownerNameFilter]);

  const totalAmount = useMemo(() => filteredExpenses.reduce((sum, e) => sum + getTotal(e), 0), [filteredExpenses]);
  const totalDue = useMemo(() => filteredExpenses.reduce((sum, e) => sum + getDue(e), 0), [filteredExpenses]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, filters, range, entriesPerPage, ownerIdFilter, ownerNameFilter]);

  const totalEntries = filteredExpenses.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / entriesPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * entriesPerPage;
  const paginatedExpenses = filteredExpenses.slice(pageStartIndex, pageStartIndex + entriesPerPage);
  const pageStartEntry = totalEntries === 0 ? 0 : pageStartIndex + 1;
  const pageEndEntry = totalEntries === 0 ? 0 : pageStartIndex + paginatedExpenses.length;

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const toggleColumn = (column: ColumnKey) => setVisibleColumns((prev) => ({ ...prev, [column]: !prev[column] }));

  const exportCsv = () => {
    const headers = ['Date', 'Reference No', 'Recurring Details', 'Expense Category', 'Sub Category', 'Location', 'Payment Status', 'Tax', 'Total Amount', 'Payment Due', 'Expense For', 'Contact', 'Expense Note', 'Added By'];
    const rows = filteredExpenses.map((e) => [
      toCsvCell(formatExpenseDateTime(e.date, settings.dateFormat, settings.timeFormat, settings.timeZone)),
      toCsvCell(e.refNo),
      toCsvCell(e.isRecurring ? `Every ${e.recurringInterval || ''} ${e.recurringUnit || ''}`.trim() : ''),
      toCsvCell(e.category),
      toCsvCell(e.subCategory || ''),
      toCsvCell(e.location || ''),
      toCsvCell(e.paymentStatus || ''),
      toCsvCell(Number(e.tax || 0).toFixed(3)),
      toCsvCell(getTotal(e).toFixed(3)),
      toCsvCell(getDue(e).toFixed(3)),
      toCsvCell(e.expenseFor || ''),
      toCsvCell(e.contact || ''),
      toCsvCell(e.note || ''),
      toCsvCell(e.addedBy || ''),
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expenses.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const headers = ['Date', 'Reference No', 'Recurring Details', 'Expense Category', 'Sub Category', 'Location', 'Payment Status', 'Tax', 'Total Amount', 'Payment Due', 'Expense For', 'Contact', 'Expense Note', 'Added By'];
    const rows = filteredExpenses.map((e) => [
      formatExpenseDateTime(e.date, settings.dateFormat, settings.timeFormat, settings.timeZone),
      e.refNo || '',
      e.isRecurring ? `Every ${e.recurringInterval || ''} ${e.recurringUnit || ''}`.trim() : '',
      e.category || '',
      e.subCategory || '',
      e.location || '',
      e.paymentStatus || '',
      Number(e.tax || 0).toFixed(3),
      getTotal(e).toFixed(3),
      getDue(e).toFixed(3),
      e.expenseFor || '',
      e.contact || '',
      e.note || '',
      e.addedBy || '',
    ].join('\t'));
    const tsv = [headers.join('\t'), ...rows].join('\n');
    const blob = new Blob([tsv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expenses.xls';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const rangeLabel = range?.label;
    printDocument({
      title: 'Expenses',
      subtitle: rangeLabel ? `Period: ${rangeLabel}` : undefined,
      businessName: settings?.businessName || 'ATWAR AL MUSTAQBAL',
      businessAddress: settings?.address || '',
      printedBy: currentUser?.name || '',
      columns: [
        { label: 'Date', width: '80px' },
        { label: 'Reference', width: '90px' },
        { label: 'Category' },
        { label: 'Sub Category' },
        { label: 'Location', width: '80px' },
        { label: 'Status', width: '70px' },
        { label: 'Tax', align: 'right', width: '70px' },
        { label: 'Total', align: 'right', width: '80px' },
        { label: 'Due', align: 'right', width: '80px' },
        { label: 'Added By', width: '80px' },
      ],
      rows: filteredExpenses.map(e => {
        return [
          formatDateBySettings(e.date || '', settings.dateFormat, settings.timeZone),
          e.refNo || '--',
          e.category || '--',
          e.subCategory || '--',
          e.location || '--',
          paymentBadge(e.paymentStatus || 'Due'),
          formatCurrency(Number(e.tax || 0)),
          formatCurrency(getTotal(e)),
          formatCurrency(getDue(e)),
          e.addedBy || '--',
        ];
      }),
      stats: [
        { label: 'Total Expenses', value: String(filteredExpenses.length), color: 'blue' },
        { label: 'Total Amount', value: formatCurrency(totalAmount), color: 'amber' },
        { label: 'Total Due', value: formatCurrency(totalDue), color: 'rose' },
      ],
      totalRow: ['TOTAL', '', '', '', '', '',
        '', formatCurrency(totalAmount), formatCurrency(totalDue), ''],
    });
  };

  const startEdit = (expenseId: string) => {
    if (!canEdit) {
      addNotification({ title: 'Access Denied', message: 'You do not have permission to edit expenses.', type: 'error' });
      return;
    }
    setActiveActionId(null);
    onNavigate(`edit-expense/${expenseId}`);
  };

  const handleDelete = async (id: string) => {
    if (!canDelete) {
      addNotification({ title: 'Access Denied', message: 'You do not have permission to delete expenses.', type: 'error' });
      return;
    }
    // Remove the linked payment for this expense to prevent orphaned records
    const linkedPayment = payments.find(
      (p) => p.contactType === 'Expense' && (p.expenseId === id || p.contactId === id),
    );
    if (linkedPayment) await deletePayment(linkedPayment.id);
    deleteExpense(id);
    setConfirmDeleteId(null);
    addNotification({ title: 'Expense Deleted', message: 'The expense has been removed.', type: 'success' });
  };

  const viewExpense = useMemo(() => expenses.find((e) => e.id === viewExpenseId) || null, [expenses, viewExpenseId]);

  return (
    <div className="space-y-6 animate-fade-in pb-16 print:p-0">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
            <Receipt size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Expenses</h2>
            <p className="text-slate-500 mt-0.5 text-sm">Track and manage all business expenses.</p>
          </div>
        </div>
        {canAdd && (
          <button
            onClick={() => { onNavigate('add-expense'); }}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-md flex items-center gap-2 active:scale-95"
          >
            <Plus size={18} /> Add Expense
          </button>
        )}
      </div>

      {/* Filter Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-400"></div>
        <div className="flex items-center gap-2 cursor-pointer text-blue-600 mb-4" onClick={() => setShowFilters(!showFilters)}>
          <Filter size={16} />
          <span className="text-sm font-semibold">Filters</span>
          <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
            <MultiSelect label="Expense Category" options={categoryOptions} selected={filters.category} onChange={(val) => setFilters({ ...filters, category: val })} />
            <MultiSelect label="Sub Category" options={subCategoryOptions} selected={filters.subCategory} onChange={(val) => setFilters({ ...filters, subCategory: val })} />
            <DateRangeFilter onRangeSelect={(nextRange) => setRange(nextRange as DateRangeValue)} />
            <MultiSelect label="Payment Status" options={['Paid', 'Due', 'Partial']} selected={filters.paymentStatus} onChange={(val) => setFilters({ ...filters, paymentStatus: val })} />
          </div>
        )}
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>

        {/* Toolbar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/30 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Show</span>
            <select
              className="rounded-xl border-0 bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 text-sm font-medium px-3 py-2"
              value={entriesPerPage}
              onChange={(e) => setEntriesPerPage(Number(e.target.value) || 25)}
            >
              <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
            </select>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">entries ({filteredExpenses.length} total)</span>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button onClick={exportCsv} className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors"><FileText size={13} /> CSV</button>
            <button onClick={exportExcel} className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors"><FileSpreadsheet size={13} /> Excel</button>
            <button onClick={handlePrint} className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors"><Printer size={13} /> Print</button>
            <div className="relative">
              <button data-expense-column-button onClick={() => setShowColumnMenu((prev) => !prev)} className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors">
                <Columns size={13} /> Columns
              </button>
              {showColumnMenu && (
                <div data-expense-column-menu className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-20 p-2 space-y-1">
                  {([
                    ['date', 'Date'], ['ref', 'Reference No'], ['recurring', 'Recurring'], ['category', 'Expense Category'], ['subCategory', 'Sub Category'], ['location', 'Location'], ['status', 'Payment Status'], ['tax', 'Tax'], ['total', 'Total Amount'], ['due', 'Payment Due'], ['expenseFor', 'Expense For'], ['contact', 'Contact'], ['note', 'Expense Note'], ['addedBy', 'Added By'],
                  ] as Array<[ColumnKey, string]>).map(([column, label]) => (
                    <label key={column} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer text-xs">
                      <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={visibleColumns[column]} onChange={() => toggleColumn(column)} />
                      <span className="text-slate-700 font-medium">{label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="relative w-full md:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search expenses..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border-0 bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-slate-500">Action</th>
                {visibleColumns.date && <th className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-slate-500">Date <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.ref && <th className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-slate-500">Reference No <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.recurring && <th className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-slate-500">Recurring Details</th>}
                {visibleColumns.category && <th className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-slate-500">Expense Category <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.subCategory && <th className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-slate-500">Sub Category</th>}
                {visibleColumns.location && <th className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-slate-500">Location <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.status && <th className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-slate-500">Payment Status <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.tax && <th className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-slate-500 text-right">Tax <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.total && <th className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-slate-500 text-right">Total Amount <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.due && <th className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-slate-500 text-right">Payment Due <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.expenseFor && <th className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-slate-500">Expense For</th>}
                {visibleColumns.contact && <th className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-slate-500">Contact</th>}
                {visibleColumns.note && <th className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-slate-500">Expense Note</th>}
                {visibleColumns.addedBy && <th className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-slate-500">Added By</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedExpenses.length === 0 ? (
                <tr><td colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="px-4 py-12 text-center text-slate-400">No expenses found.</td></tr>
              ) : (
                paginatedExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-center relative">
                      <button data-expense-action-button onClick={() => setActiveActionId((prev) => (prev === expense.id ? null : expense.id))} className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-bold hover:bg-slate-50 transition-colors shadow-sm">
                        Actions <ChevronDown size={10} />
                      </button>
                      {activeActionId === expense.id && (
                        <div data-expense-action-menu className="absolute top-8 left-0 z-50 w-36 bg-white rounded shadow-xl border border-slate-100 py-1 text-left">
                          <button onClick={() => { setViewExpenseId(expense.id); setActiveActionId(null); }} className="w-full text-left px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2"><Eye size={12} /> View</button>
                          {canEdit && <button onClick={() => startEdit(expense.id)} className="w-full text-left px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2"><Edit size={12} /> Edit</button>}
                          {canDelete && <button onClick={() => { setConfirmDeleteId(expense.id); setActiveActionId(null); }} className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2"><Trash2 size={12} /> Delete</button>}
                        </div>
                      )}
                    </td>
                    {visibleColumns.date && <td className="px-4 py-3 whitespace-nowrap">{formatExpenseDateTime(expense.date, settings.dateFormat, settings.timeFormat, settings.timeZone)}</td>}
                    {visibleColumns.ref && <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">{expense.refNo || '--'}</td>}
                    {visibleColumns.recurring && <td className="px-4 py-3 whitespace-nowrap text-slate-400 italic">{expense.isRecurring ? `Every ${expense.recurringInterval || ''} ${expense.recurringUnit || ''}`.trim() : '--'}</td>}
                    {visibleColumns.category && <td className="px-4 py-3 whitespace-nowrap">{expense.category}</td>}
                    {visibleColumns.subCategory && <td className="px-4 py-3 whitespace-nowrap">{expense.subCategory || '--'}</td>}
                    {visibleColumns.location && <td className="px-4 py-3 whitespace-nowrap text-[10px] text-slate-500 max-w-[150px] truncate" title={expense.location}>{expense.location}</td>}
                    {visibleColumns.status && <td className="px-4 py-3 whitespace-nowrap"><span className={`px-2.5 py-1 rounded-full text-xs font-bold text-white ${expense.paymentStatus === 'Paid' ? 'bg-emerald-500' : expense.paymentStatus === 'Partial' ? 'bg-sky-500' : 'bg-red-400'}`}>{expense.paymentStatus}</span></td>}
                    {visibleColumns.tax && <td className="px-4 py-3 whitespace-nowrap text-right">{formatCurrency(expense.tax || 0)}</td>}
                    {visibleColumns.total && <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-slate-700">{formatCurrency(getTotal(expense))}</td>}
                    {visibleColumns.due && <td className="px-4 py-3 whitespace-nowrap text-right">{formatCurrency(getDue(expense))}</td>}
                    {visibleColumns.expenseFor && <td className="px-4 py-3 whitespace-nowrap">{expense.expenseFor || '--'}</td>}
                    {visibleColumns.contact && <td className="px-4 py-3 whitespace-nowrap">{expense.contact || '--'}</td>}
                    {visibleColumns.note && <td className="px-4 py-3 whitespace-nowrap italic text-slate-500 max-w-[120px] truncate">{expense.note || '--'}</td>}
                    {visibleColumns.addedBy && <td className="px-4 py-3 whitespace-nowrap">{expense.addedBy}</td>}
                  </tr>
                ))
              )}
            </tbody>
            {paginatedExpenses.length > 0 && (
              <tfoot className="bg-slate-200/60 font-bold text-slate-800 border-t border-slate-300">
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="px-4 py-3">
                    <div className="flex justify-end gap-12">
                      {visibleColumns.total && <span>Total Amount: {formatCurrency(totalAmount)}</span>}
                      {visibleColumns.due && <span>Payment Due: {formatCurrency(totalDue)}</span>}
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <span className="text-xs text-slate-500">Showing {pageStartEntry} to {pageEndEntry} of {totalEntries} entries &mdash; <span className="font-bold text-slate-700">{range.label || 'All'}</span></span>
          <div className="flex gap-1.5 items-center">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safeCurrentPage <= 1}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >Previous</button>
            <span className="px-4 py-2 text-sm text-slate-600">Page {safeCurrentPage} / {totalPages}</span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >Next</button>
          </div>
        </div>
      </div>

      {viewExpense && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="bg-white w-full max-w-2xl rounded-xl border border-slate-200 shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Expense {viewExpense.refNo || viewExpense.id}</h3>
              <button onClick={() => setViewExpenseId(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4 overflow-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500">Date:</span> <span className="font-bold text-slate-800">{formatExpenseDateTime(viewExpense.date, settings.dateFormat, settings.timeFormat, settings.timeZone)}</span></div>
                <div><span className="text-slate-500">Category:</span> <span className="font-bold text-slate-800">{viewExpense.category}</span></div>
                <div><span className="text-slate-500">Sub Category:</span> <span className="font-bold text-slate-800">{viewExpense.subCategory || '--'}</span></div>
                <div><span className="text-slate-500">Location:</span> <span className="font-bold text-slate-800">{viewExpense.location}</span></div>
                <div><span className="text-slate-500">Total:</span> <span className="font-bold text-slate-800">{formatCurrency(getTotal(viewExpense))}</span></div>
                <div><span className="text-slate-500">Payment Due:</span> <span className="font-bold text-slate-800">{formatCurrency(getDue(viewExpense))}</span></div>
                <div><span className="text-slate-500">Payment Status:</span> <span className="font-bold text-slate-800">{viewExpense.paymentStatus}</span></div>
                <div><span className="text-slate-500">Added By:</span> <span className="font-bold text-slate-800">{viewExpense.addedBy}</span></div>
                <div><span className="text-slate-500">Expense For:</span> <span className="font-bold text-slate-800">{viewExpense.expenseFor || '--'}</span></div>
                <div><span className="text-slate-500">Contact:</span> <span className="font-bold text-slate-800">{viewExpense.contact || '--'}</span></div>
              </div>
              {viewExpense.note && (
                <div>
                  <h4 className="text-sm font-bold text-slate-700 mb-1">Expense Note</h4>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{viewExpense.note}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-80">
            <h3 className="font-bold text-slate-900 text-lg mb-2">Delete Expense?</h3>
            <p className="text-slate-500 text-sm mb-6">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold hover:bg-slate-50">Cancel</button>
              <button onClick={() => handleDelete(confirmDeleteId)} className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-bold hover:bg-rose-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListExpenses;
