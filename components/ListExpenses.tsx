import React, { useState } from 'react';
import {
  Plus, Search, FileText, FileSpreadsheet, Printer,
  Columns, Edit, Trash2, ChevronDown,
  Filter, Eye, ArrowUpDown
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';
import { useNotifications } from '../src/context/NotificationContext';

interface ListExpensesProps {
    onNavigate: (page: string) => void;
}

const ListExpenses: React.FC<ListExpensesProps> = ({ onNavigate }) => {
  const { expenses, expenseCategories, deleteExpense, formatCurrency } = useGlobalContext();
  const { addNotification } = useNotifications();

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [filters, setFilters] = useState({
      category: [] as string[],
      subCategory: [] as string[],
      paymentStatus: [] as string[]
  });

  const toggleActions = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    setActiveActionId(prev => prev === id ? null : id);
  };

  React.useEffect(() => {
    const handleOutsideClick = () => setActiveActionId(null);
    if (activeActionId) {
        window.addEventListener('click', handleOutsideClick);
    }
    return () => {
        window.removeEventListener('click', handleOutsideClick);
    };
  }, [activeActionId]);

  const handleDelete = (id: string) => {
    deleteExpense(id);
    setConfirmDeleteId(null);
    addNotification({ title: 'Expense Deleted', message: 'The expense has been removed.', type: 'success' });
  };

  // Build unique category options from real GlobalContext data
  const categoryOptions = expenseCategories.map(c => c.name);

  const filteredExpenses = expenses.filter(e => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      e.refNo?.toLowerCase().includes(search) ||
      e.category.toLowerCase().includes(search) ||
      e.contact?.toLowerCase().includes(search) ||
      e.expenseFor?.toLowerCase().includes(search) ||
      e.location.toLowerCase().includes(search);

    const matchesCategory = filters.category.length === 0 || filters.category.includes(e.category);
    const matchesStatus = filters.paymentStatus.length === 0 || filters.paymentStatus.includes(e.paymentStatus);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const totalAmount = filteredExpenses.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
  const totalDue = filteredExpenses.reduce((acc, curr) => acc + (curr.paymentDue || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in pb-20">

      {/* Header */}
      <h2 className="text-2xl font-bold text-slate-900">Expenses</h2>

      {/* Filter Section */}
      <div className="bg-white rounded shadow-sm border border-slate-200 p-4">
          <div
            className="flex items-center gap-2 cursor-pointer text-blue-600 mb-4"
            onClick={() => setShowFilters(!showFilters)}
          >
              <Filter size={16} />
              <span className="text-sm font-medium">Filters</span>
          </div>

          {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
                  <div>
                        <MultiSelect
                            label="Expense Category"
                            options={categoryOptions}
                            selected={filters.category}
                            onChange={(val) => setFilters({...filters, category: val})}
                        />
                  </div>
                  <div>
                        <MultiSelect
                            label="Sub Category"
                            options={[]}
                            selected={filters.subCategory}
                            onChange={(val) => setFilters({...filters, subCategory: val})}
                        />
                  </div>
                  <div>
                      <DateRangeFilter />
                  </div>
                  <div>
                       <MultiSelect
                            label="Payment Status"
                            options={['Paid', 'Due', 'Partial']}
                            selected={filters.paymentStatus}
                            onChange={(val) => setFilters({...filters, paymentStatus: val})}
                        />
                  </div>
              </div>
          )}
      </div>

      {/* Main Content */}
      <div className="bg-white rounded shadow-sm border border-slate-200 overflow-hidden">

        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
           <h3 className="text-lg font-medium text-slate-700">All Expenses ({filteredExpenses.length})</h3>
           <button
                onClick={() => onNavigate('add-expense')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-1 shadow-sm transition-all"
            >
                <Plus size={16} /> Add Expense
            </button>
        </div>

        {/* Controls Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50">
           <div className="flex items-center gap-2">
               <span className="text-sm text-slate-600">Show</span>
               <select className="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none">
                   <option>25</option>
                   <option>50</option>
                   <option>100</option>
               </select>
               <span className="text-sm text-slate-600">entries</span>
           </div>

           <div className="flex gap-1 flex-wrap">
                <button className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={12}/> Export CSV</button>
                <button className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileSpreadsheet size={12}/> Export Excel</button>
                <button className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm" onClick={() => window.print()}><Printer size={12}/> Print</button>
                <button className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Columns size={12}/> Columns</button>
           </div>

           <div className="flex items-center gap-2">
               <Search size={14} className="text-slate-400" />
               <input
                   type="text"
                   placeholder="Search..."
                   className="px-3 py-2 rounded border border-slate-300 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
               />
           </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-white text-slate-800 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Action</th>
                <th className="px-4 py-3 whitespace-nowrap">Date <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Reference No <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Recurring Details</th>
                <th className="px-4 py-3 whitespace-nowrap">Expense Category <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Sub Category</th>
                <th className="px-4 py-3 whitespace-nowrap">Location <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Payment Status <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Tax <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Total Amount <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Payment Due <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Expense For</th>
                <th className="px-4 py-3 whitespace-nowrap">Contact</th>
                <th className="px-4 py-3 whitespace-nowrap">Expense Note</th>
                <th className="px-4 py-3 whitespace-nowrap">Added By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-4 py-12 text-center text-slate-400">
                    No expenses found. Click "Add Expense" to add one.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-center relative">
                        <button
                          onClick={(e) => toggleActions(e, expense.id)}
                          className="flex items-center gap-1 px-2 py-1 bg-white border border-blue-200 text-blue-600 rounded text-[10px] font-bold hover:bg-blue-50 transition-colors"
                        >
                            Actions <ChevronDown size={10} />
                        </button>

                        {activeActionId === expense.id && (
                            <div className="absolute top-8 left-0 z-50 w-36 bg-white rounded shadow-xl border border-slate-100 py-1 text-left">
                                <button className="w-full text-left px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                                    <Eye size={12} /> View
                                </button>
                                <button
                                  onClick={() => { onNavigate('edit-expense'); setActiveActionId(null); }}
                                  className="w-full text-left px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                                >
                                    <Edit size={12} /> Edit
                                </button>
                                <button
                                  onClick={() => { setConfirmDeleteId(expense.id); setActiveActionId(null); }}
                                  className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                                >
                                    <Trash2 size={12} /> Delete
                                </button>
                            </div>
                        )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{expense.date}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">{expense.refNo || '--'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-400 italic">
                      {expense.isRecurring ? `Every ${expense.recurringInterval} ${expense.recurringUnit}` : '--'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{expense.category}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{expense.subCategory || '--'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-[10px] text-slate-500 max-w-[150px] truncate" title={expense.location}>{expense.location}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase ${
                          expense.paymentStatus === 'Paid' ? 'bg-emerald-500' :
                          expense.paymentStatus === 'Partial' ? 'bg-sky-500' : 'bg-red-400'
                        }`}>
                            {expense.paymentStatus}
                        </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">{formatCurrency(expense.tax || 0)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-slate-700">{formatCurrency(expense.totalAmount)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">{formatCurrency(expense.paymentDue || 0)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{expense.expenseFor || '--'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{expense.contact || '--'}</td>
                    <td className="px-4 py-3 whitespace-nowrap italic text-slate-500 max-w-[120px] truncate">{expense.note || '--'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{expense.addedBy}</td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredExpenses.length > 0 && (
              <tfoot className="bg-slate-200/60 font-bold text-slate-800 border-t border-slate-300">
                  <tr>
                      <td colSpan={9} className="px-4 py-3 text-right">Total:</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(totalAmount)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(totalDue)}</td>
                      <td colSpan={4}></td>
                  </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
            <div>Showing 1 to {filteredExpenses.length} of {expenses.length} total entries</div>
            <div className="flex gap-1">
                 <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled>Previous</button>
                 <button className="px-3 py-1 bg-blue-600 text-white rounded shadow-sm">1</button>
                <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50">Next</button>
            </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
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
