import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, FileText, FileSpreadsheet, Printer,
  Edit, Trash2, X, Tag, ChevronDown, ArrowUpDown, AlertTriangle,
} from 'lucide-react';
import { useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import { syncRecordStrict } from '@/utils/apiClient';

interface ExpenseCategoriesProps {
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

type SortField = 'name' | 'code';

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const htmlEscape = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const ExpenseCategories: React.FC<ExpenseCategoriesProps> = ({
  canAdd = true,
  canEdit = true,
  canDelete = canEdit,
}) => {
  const {
    expenseCategories,
    expenses,
    payments,
    setExpenses,
    setPayments,
    addExpenseCategory,
    updateExpenseCategory,
    deleteExpenseCategory,
    generateId,
  } = useGlobalContext();
  const { addNotification } = useNotifications();

  const [searchTerm, setSearchTerm] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [reassignCategoryId, setReassignCategoryId] = useState('');
  const [formError, setFormError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
  });

  const openAdd = () => {
    if (!canAdd) {
      addNotification({ title: 'Access Denied', message: 'You do not have permission to add expense categories.', type: 'error' });
      return;
    }
    setEditingId(null);
    setFormData({ name: '', code: '', description: '' });
    setFormError('');
    setIsAddModalOpen(true);
  };

  const openEdit = (id: string) => {
    if (!canEdit) {
      addNotification({ title: 'Access Denied', message: 'You do not have permission to edit expense categories.', type: 'error' });
      return;
    }
    const cat = expenseCategories.find((category) => category.id === id);
    if (!cat) return;
    setEditingId(id);
    setFormData({
      name: cat.name || '',
      code: cat.code || '',
      description: cat.description || '',
    });
    setFormError('');
    setIsAddModalOpen(true);
  };

  const propagateExpenseCategoryName = async (fromName: string, toName: string) => {
    if (!fromName || !toName || normalize(fromName) === normalize(toName)) return 0;
    const affectedExpenses = expenses.filter((expense) => normalize(expense.category) === normalize(fromName));
    if (affectedExpenses.length === 0) return 0;

    const persistedExpensesById = new Map<string, typeof affectedExpenses[number]>();
    for (const expense of affectedExpenses) {
      const updatedExpense = { ...expense, category: toName };
      const saved = await syncRecordStrict('expenses', updatedExpense);
      if (!saved.ok) continue;
      persistedExpensesById.set(updatedExpense.id, updatedExpense);
    }
    if (persistedExpensesById.size > 0) {
      setExpenses((prev) => prev.map((expense) => persistedExpensesById.get(expense.id) || expense));
    }

    const affectedIds = new Set(Array.from(persistedExpensesById.keys()));
    const affectedPayments = payments.filter((payment) =>
      payment.contactType === 'Expense' &&
      affectedIds.has(payment.expenseId || payment.contactId),
    );
    const persistedPaymentsById = new Map<string, typeof affectedPayments[number]>();
    for (const payment of affectedPayments) {
      const updatedPayment = { ...payment, contactName: toName };
      const saved = await syncRecordStrict('payments', updatedPayment);
      if (!saved.ok) continue;
      persistedPaymentsById.set(updatedPayment.id, updatedPayment);
    }
    if (persistedPaymentsById.size > 0) {
      setPayments((prev) => prev.map((payment) => persistedPaymentsById.get(payment.id) || payment));
    }

    return persistedExpensesById.size;
  };

  const handleSave = async () => {
    const trimmedName = formData.name.trim();
    const trimmedCode = formData.code.trim();
    const trimmedDescription = formData.description.trim();

    if (!trimmedName) {
      setFormError('Category name is required.');
      return;
    }

    const duplicate = expenseCategories.find((category) => (
      normalize(category.name) === normalize(trimmedName)
      || (trimmedCode !== '' && normalize(category.code) === normalize(trimmedCode))
    ) && category.id !== editingId);
    if (duplicate) {
      setFormError('Category name/code already exists.');
      return;
    }

    if (editingId) {
      const existing = expenseCategories.find((category) => category.id === editingId);
      updateExpenseCategory({
        id: editingId,
        name: trimmedName,
        code: trimmedCode,
        description: trimmedDescription,
      });

      const propagatedCount = existing
        ? await propagateExpenseCategoryName(existing.name, trimmedName)
        : 0;
      addNotification({
        title: 'Category Updated',
        message: propagatedCount > 0
          ? `"${trimmedName}" updated and applied to ${propagatedCount} expense record(s).`
          : `"${trimmedName}" has been updated.`,
        type: 'success',
      });
    } else {
      addExpenseCategory({
        id: generateId('ECAT'),
        name: trimmedName,
        code: trimmedCode,
        description: trimmedDescription,
      });
      addNotification({ title: 'Category Added', message: `"${trimmedName}" has been added.`, type: 'success' });
    }

    setFormData({ name: '', code: '', description: '' });
    setEditingId(null);
    setFormError('');
    setIsAddModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!canDelete) {
      addNotification({ title: 'Access Denied', message: 'You do not have permission to delete expense categories.', type: 'error' });
      return;
    }
    const category = expenseCategories.find((item) => item.id === id);
    if (!category) return;

    const inUseCount = expenses.filter((expense) => normalize(expense.category) === normalize(category.name)).length;
    if (inUseCount > 0) {
      const target = expenseCategories.find((item) => item.id === reassignCategoryId);
      if (!target || target.id === id) {
        addNotification({
          title: 'Reassignment Required',
          message: `This category is used by ${inUseCount} expense record(s). Select another category before deleting.`,
          type: 'error',
        });
        return;
      }
      const movedCount = await propagateExpenseCategoryName(category.name, target.name);
      if (movedCount < inUseCount) {
        addNotification({
          title: 'Delete Blocked',
          message: `Only ${movedCount}/${inUseCount} expense record(s) could be moved to Postgres. Fix connection and retry.`,
          type: 'error',
        });
        return;
      }
      deleteExpenseCategory(id);
      setConfirmDeleteId(null);
      setReassignCategoryId('');
      addNotification({
        title: 'Category Deleted',
        message: `"${category.name}" deleted. ${movedCount} expense record(s) moved to "${target.name}".`,
        type: 'warning',
      });
      return;
    }

    deleteExpenseCategory(id);
    setConfirmDeleteId(null);
    setReassignCategoryId('');
    addNotification({ title: 'Category Deleted', message: `"${category.name}" has been deleted.`, type: 'success' });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  const filteredCategories = useMemo(() => {
    const q = normalize(searchTerm);
    return [...expenseCategories]
      .filter((category) => {
        if (!q) return true;
        return normalize(category.name).includes(q) || normalize(category.code).includes(q);
      })
      .sort((a, b) => {
        const aValue = normalize(sortField === 'name' ? a.name : a.code);
        const bValue = normalize(sortField === 'name' ? b.name : b.code);
        return sortDir === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      });
  }, [expenseCategories, searchTerm, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / entriesPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * entriesPerPage;
  const paginated = filteredCategories.slice(startIndex, startIndex + entriesPerPage);
  const showingFrom = filteredCategories.length === 0 ? 0 : startIndex + 1;
  const showingTo = filteredCategories.length === 0 ? 0 : startIndex + paginated.length;

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, entriesPerPage]);

  const deletionMeta = useMemo(() => {
    if (!confirmDeleteId) return { name: '', inUseCount: 0 };
    const target = expenseCategories.find((category) => category.id === confirmDeleteId);
    if (!target) return { name: '', inUseCount: 0 };
    const inUseCount = expenses.filter((expense) => normalize(expense.category) === normalize(target.name)).length;
    return { name: target.name, inUseCount };
  }, [confirmDeleteId, expenseCategories, expenses]);

  const reassignOptions = useMemo(() => (
    expenseCategories.filter((category) => category.id !== confirmDeleteId)
  ), [expenseCategories, confirmDeleteId]);

  const exportCsv = () => {
    const headers = ['Category Name', 'Category Code', 'Description'];
    const rows = filteredCategories.map((category) => [
      csvCell(category.name),
      csvCell(category.code || ''),
      csvCell(category.description || ''),
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expense-categories.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const headers = ['Category Name', 'Category Code', 'Description'];
    const rows = filteredCategories.map((category) => [
      category.name || '',
      category.code || '',
      category.description || '',
    ].join('\t'));
    const tsv = [headers.join('\t'), ...rows].join('\n');
    const blob = new Blob([tsv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expense-categories.xls';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
      <head><title>Expense Categories</title></head>
      <body>
        <h2>Expense Categories</h2>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%;">
          <thead>
            <tr>
              <th align="left">Category Name</th>
              <th align="left">Category Code</th>
              <th align="left">Description</th>
            </tr>
          </thead>
          <tbody>
            ${filteredCategories.map((category) => `
              <tr>
                <td>${htmlEscape(category.name)}</td>
                <td>${htmlEscape(category.code || '--')}</td>
                <td>${htmlEscape(category.description || '--')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Expense Categories</h2>
          <p className="text-slate-500 text-sm mt-1">Manage categories used when recording expenses.</p>
        </div>
        {canAdd && (
          <button
            onClick={openAdd}
            className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-blue-700 transition shadow-sm flex items-center gap-1"
          >
            <Plus size={16} /> Add Category
          </button>
        )}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-base font-medium text-slate-700 flex items-center gap-2">
            <Tag size={16} className="text-blue-500" />
            All Expense Categories ({filteredCategories.length})
          </h3>
        </div>

        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Show</span>
            <div className="relative">
              <select
                className="border border-slate-300 rounded pl-2 pr-8 py-1 text-sm focus:outline-none appearance-none"
                value={entriesPerPage}
                onChange={(e) => setEntriesPerPage(Number(e.target.value) || 25)}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <span className="text-sm text-slate-600">entries</span>
          </div>

          <div className="flex gap-1 flex-wrap">
            <button onClick={exportCsv} className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={12} /> Export CSV</button>
            <button onClick={exportExcel} className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileSpreadsheet size={12} /> Export Excel</button>
            <button onClick={handlePrint} className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Printer size={12} /> Print</button>
          </div>

          <div className="flex items-center gap-2">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search categories..."
              className="px-3 py-1.5 rounded border border-slate-300 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50 text-slate-800 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-1/2">
                  <button className="flex items-center gap-1 hover:text-slate-900" onClick={() => handleSort('name')}>
                    Category Name <ArrowUpDown size={12} className="text-slate-400" />
                  </button>
                </th>
                <th className="px-4 py-3 w-1/4">
                  <button className="flex items-center gap-1 hover:text-slate-900" onClick={() => handleSort('code')}>
                    Category Code <ArrowUpDown size={12} className="text-slate-400" />
                  </button>
                </th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.length > 0 ? (
                paginated.map((category) => (
                  <tr key={category.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-700">{category.name}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">{category.code || '--'}</td>
                    <td className="px-4 py-3">
                      {(canEdit || canDelete) ? (
                        <div className="flex gap-2">
                          {canEdit && (
                            <button
                              onClick={() => openEdit(category.id)}
                              className="flex items-center gap-1 px-2 py-1 bg-white border border-blue-500 text-blue-600 rounded text-xs font-bold hover:bg-blue-50 transition-colors"
                            >
                              <Edit size={12} /> Edit
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => { setConfirmDeleteId(category.id); setReassignCategoryId(''); }}
                              className="flex items-center gap-1 px-2 py-1 bg-white border border-red-500 text-red-600 rounded text-xs font-bold hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No actions</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-slate-400 italic">
                    {searchTerm ? 'No categories match your search.' : 'No expense categories yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-500">
          <div>Showing {showingFrom} to {showingTo} of {filteredCategories.length} entries</div>
          <div className="flex gap-1">
            <button
              className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safeCurrentPage <= 1}
            >
              Previous
            </button>
            <button className="px-3 py-1 bg-blue-600 text-white rounded shadow-sm">{safeCurrentPage}</button>
            <button
              className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safeCurrentPage >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-slate-100 flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {editingId ? 'Edit Expense Category' : 'Add Expense Category'}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Category Name: <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                  placeholder="e.g. Petrol, Salary, Utilities"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Category Code:</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm font-mono"
                  placeholder="e.g. PTR, SAL"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Description:</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm resize-none"
                  placeholder="Optional description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              {formError && (
                <p className="text-xs text-rose-600 font-medium">{formError}</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
              <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 border border-slate-300 rounded text-slate-700 font-bold hover:bg-white text-sm">
                Cancel
              </button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 text-sm">
                {editingId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-96">
            <h3 className="font-bold text-slate-900 text-lg mb-2">Delete Category?</h3>
            <p className="text-slate-500 text-sm mb-4">
              {deletionMeta.name
                ? <>Are you sure you want to delete "<strong>{deletionMeta.name}</strong>"?</>
                : 'Are you sure you want to delete this category?'}
            </p>

            {deletionMeta.inUseCount > 0 && (
              <div className="mb-4 p-3 rounded border border-amber-200 bg-amber-50 text-amber-800 text-xs">
                <div className="font-bold flex items-center gap-1 mb-2">
                  <AlertTriangle size={12} /> This category is used by {deletionMeta.inUseCount} expense record(s).
                </div>
                <label className="block text-[11px] font-bold mb-1">Reassign affected expenses to:</label>
                <select
                  className="w-full px-2 py-2 rounded border border-amber-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={reassignCategoryId}
                  onChange={(e) => setReassignCategoryId(e.target.value)}
                >
                  <option value="">Select replacement category</option>
                  {reassignOptions.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button onClick={() => { setConfirmDeleteId(null); setReassignCategoryId(''); }} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold hover:bg-slate-50">Cancel</button>
              <button onClick={() => handleDelete(confirmDeleteId)} className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-bold hover:bg-rose-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseCategories;
