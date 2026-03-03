import React, { useState } from 'react';
import { 
  Plus, Search, FileText, FileSpreadsheet, Printer, 
  Columns, Download, Edit, Trash2, ChevronDown, 
  ArrowUpDown, DollarSign, Filter, Calendar
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

interface Expense {
  id: string;
  date: string;
  refNo: string;
  category: string;
  location: string;
  paymentStatus: 'Paid' | 'Due' | 'Partial';
  tax: number;
  totalAmount: number;
  paymentDue: number;
  expenseFor: string;
  addedBy: string;
}

const initialExpenses: Expense[] = [
  { id: '1', date: '2023-11-20 10:00', refNo: 'EXP-2023-001', category: 'Petrol', location: 'CR:1450968', paymentStatus: 'Paid', tax: 0.000, totalAmount: 15.000, paymentDue: 0.000, expenseFor: 'Driver A', addedBy: 'Admin' },
  { id: '2', date: '2023-11-22 14:30', refNo: 'EXP-2023-002', category: 'Maintenance', location: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649', paymentStatus: 'Due', tax: 2.500, totalAmount: 52.500, paymentDue: 52.500, expenseFor: 'Shop', addedBy: 'Manager' },
];

interface ExpensesProps {
    onNavigate?: (page: string) => void;
}

const Expenses: React.FC<ExpensesProps> = ({ onNavigate }) => {
  const { locations } = useGlobalContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState({
      location: [] as string[],
      category: [] as string[],
      paymentStatus: [] as string[],
      user: [] as string[]
  });

  const filteredExpenses = expenses.filter(e => 
    (e.refNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.expenseFor.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filters.location.length === 0 || filters.location.includes(e.location)) &&
    (filters.category.length === 0 || filters.category.includes(e.category)) &&
    (filters.paymentStatus.length === 0 || filters.paymentStatus.includes(e.paymentStatus)) &&
    (filters.user.length === 0 || filters.user.includes(e.addedBy))
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <DollarSign className="text-emerald-600" size={32} />
            Expenses
          </h2>
          <p className="text-slate-500 mt-1">Manage and track your business expenses.</p>
        </div>
        <button 
          onClick={() => onNavigate && onNavigate('add-expense')}
          className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
        >
          <Plus size={18} /> Add Expense
        </button>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
        
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col xl:flex-row justify-between gap-4 items-center">
            
            <div className="flex items-center gap-3 w-full xl:w-auto">
               <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm border ${showFilters ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
               >
                   <Filter size={14} /> Filters
               </button>
            </div>

            <div className="flex flex-wrap justify-center gap-2 w-full xl:w-auto">
              {[
                { icon: FileText, label: 'CSV' },
                { icon: FileSpreadsheet, label: 'Excel' },
                { icon: Printer, label: 'Print' },
                { icon: Download, label: 'PDF' },
              ].map((action, i) => (
                <button key={i} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition shadow-sm">
                  <action.icon size={14} /> {action.label}
                </button>
              ))}
            </div>

            <div className="relative w-full xl:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Search expenses..." 
                    className="w-full xl:w-64 pl-9 pr-4 py-2 rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
          </div>

          {showFilters && (
               <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-200 animate-in slide-in-from-top-2 fade-in">
                   <MultiSelect 
                       label="Business Location"
                       options={locations.map(loc => loc.name)}
                       selected={filters.location}
                       onChange={(val) => setFilters({...filters, location: val})}
                   />
                   <MultiSelect 
                       label="Expense Category"
                       options={['Petrol', 'Maintenance', 'Salary']}
                       selected={filters.category}
                       onChange={(val) => setFilters({...filters, category: val})}
                   />
                   <MultiSelect 
                       label="Payment Status"
                       options={['Paid', 'Due', 'Partial']}
                       selected={filters.paymentStatus}
                       onChange={(val) => setFilters({...filters, paymentStatus: val})}
                   />
                   <div className="group">
                        <DateRangeFilter />
                   </div>
               </div>
           )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Reference No</th>
                <th className="px-6 py-4">Expense Category</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Payment Status</th>
                <th className="px-6 py-4 text-right">Tax</th>
                <th className="px-6 py-4 text-right">Total Amount</th>
                <th className="px-6 py-4 text-right">Payment Due</th>
                <th className="px-6 py-4">Expense For</th>
                <th className="px-6 py-4">Added By</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 text-slate-600">{e.date}</td>
                  <td className="px-6 py-4 font-bold text-slate-900">{e.refNo}</td>
                  <td className="px-6 py-4 text-slate-600">{e.category}</td>
                  <td className="px-6 py-4 text-slate-600">{e.location}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      e.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 
                      e.paymentStatus === 'Due' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {e.paymentStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-600">{e.tax.toFixed(3)}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">{e.totalAmount.toFixed(3)}</td>
                  <td className="px-6 py-4 text-right font-medium text-red-600">{e.paymentDue.toFixed(3)}</td>
                  <td className="px-6 py-4 text-slate-600">{e.expenseFor}</td>
                  <td className="px-6 py-4 text-slate-500 text-xs">{e.addedBy}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                        <Edit size={14} />
                      </button>
                      <button className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-700 text-xs sticky bottom-0 z-10 shadow-inner">
                <tr>
                    <td colSpan={6} className="px-6 py-4 text-right uppercase tracking-wider text-slate-500">Total:</td>
                    <td className="px-6 py-4 text-right font-mono text-base">{filteredExpenses.reduce((acc, curr) => acc + curr.totalAmount, 0).toFixed(3)}</td>
                    <td className="px-6 py-4 text-right font-mono text-base text-red-600">{filteredExpenses.reduce((acc, curr) => acc + curr.paymentDue, 0).toFixed(3)}</td>
                    <td colSpan={3}></td>
                </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Expenses;
