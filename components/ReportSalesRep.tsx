import React, { useState } from 'react';
import { 
  Filter, FileText, FileSpreadsheet, Printer, 
  Columns, Search, ArrowUpDown, ChevronDown, 
  Settings, ShoppingBag, CreditCard, Plus
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import AddDiscountModal from './AddDiscountModal';
import MultiSelect from './MultiSelect';

// Utility for currency formatting
const formatRiyal = (amount: number) => {
  return `${amount.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ريال`;
};

const ReportSalesRep: React.FC = () => {
  const [showFilters, setShowFilters] = useState(true);
  const [activeTab, setActiveTab] = useState('sales_added');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [filters, setFilters] = useState({
      user: [] as string[],
      location: [] as string[]
  });

  // Mock Data for Sales
  const salesData = [
    { id: '1', date: '14/02/2026 07:33 AM', invoice: 'K2026-2505', customer: 'Direct Customer', location: 'KNWZ ARD ALKHALYJ ALMTHDH CR:1282649', paymentStatus: 'Paid', total: 33.000, paid: 33.000, remaining: 0.000, commission: 0.000 },
    { id: '2', date: '14/02/2026 07:24 AM', invoice: '2026-2504', customer: 'Tbroza Hypermarket (Mobailah)', location: 'KNWZ ARD ALKHALYJ ALMTHDH CR:1282649', paymentStatus: 'Due', total: 99.797, paid: 0.000, remaining: 99.797, commission: 0.000 },
    { id: '3', date: '12/02/2026 04:21 PM', invoice: 'K2026-2503', customer: 'Dr. Amani (Manooma)', location: 'KNWZ ARD ALKHALYJ ALMTHDH CR:1282649', paymentStatus: 'Paid', total: 22.491, paid: 0.000, remaining: 22.491, commission: 0.000 },
    { id: '4', date: '12/02/2026 09:14 AM', invoice: 'K2026-2501', customer: 'Direct Customer', location: 'KNWZ ARD ALKHALYJ ALMTHDH CR:1282649', paymentStatus: 'Paid', total: 13.000, paid: 13.000, remaining: 0.000, commission: 0.000 },
    { id: '5', date: '12/02/2026 07:44 AM', invoice: 'K2026-2500', customer: 'Direct Customer', location: 'KNWZ ARD ALKHALYJ ALMTHDH CR:1282649', paymentStatus: 'Paid', total: 18.000, paid: 18.000, remaining: 0.000, commission: 0.000 },
    { id: '6', date: '12/02/2026 07:42 AM', invoice: 'K2026-2499', customer: 'Hala Point International LLC', location: 'KNWZ ARD ALKHALYJ ALMTHDH CR:1282649', paymentStatus: 'Paid', total: 26.989, paid: 0.000, remaining: 26.989, commission: 0.000 },
    { id: '7', date: '12/02/2026 07:38 AM', invoice: 'K2026-2498', customer: 'Hala Point International LLC', location: 'KNWZ ARD ALKHALYJ ALMTHDH CR:1282649', paymentStatus: 'Due', total: 60.795, paid: 0.000, remaining: 60.795, commission: 0.000 },
    { id: '8', date: '11/02/2026 08:56 PM', invoice: 'K2026-2497', customer: 'Direct Customer', location: 'KNWZ ARD ALKHALYJ ALMTHDH CR:1282649', paymentStatus: 'Paid', total: 60.000, paid: 60.000, remaining: 0.000, commission: 0.000 },
    { id: '9', date: '11/02/2026 04:20 PM', invoice: 'K2026-2496', customer: 'Dr. Amani (Manooma)', location: 'KNWZ ARD ALKHALYJ ALMTHDH CR:1282649', paymentStatus: 'Due', total: 182.514, paid: 0.000, remaining: 182.514, commission: 0.000 },
    { id: '10', date: '11/02/2026 07:54 AM', invoice: 'K2026-2494', customer: '02 Pet Shop (Mowaleh)', location: 'KNWZ ARD ALKHALYJ ALMTHDH CR:1282649', paymentStatus: 'Due', total: 85.500, paid: 0.000, remaining: 85.500, commission: 0.000 },
  ];

  // Mock Data for Expenses
  const expensesData = [
    { id: '1', date: '12/02/2026 04:19 PM', ref: 'EP2026/0067', category: 'Petrol', location: 'KNWZ ARD ALKHALYJ ALMTHDH CR:1282649', status: 'Paid', amount: 10.000, expenseFor: '', note: 'Zuheb' },
    { id: '2', date: '10/02/2026 09:16 PM', ref: 'EP2026/0066', category: 'Petrol', location: 'KNWZ ARD ALKHALYJ ALMTHDH CR:1282649', status: 'Paid', amount: 10.000, expenseFor: '', note: '' },
    { id: '3', date: '08/02/2026 09:15 PM', ref: 'EP2026/0065', category: 'Petrol', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', status: 'Paid', amount: 10.000, expenseFor: 'Shafikul Islam', note: '' },
    { id: '4', date: '06/02/2026 09:14 PM', ref: 'EP2026/0064', category: 'Delivery charge & Others', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', status: 'Paid', amount: 4.000, expenseFor: '', note: '' },
    { id: '5', date: '05/02/2026 04:25 PM', ref: 'EP2026/0062', category: 'Delivery charge & Others', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', status: 'Paid', amount: 2.000, expenseFor: '', note: 'Zuheb phone case' },
    { id: '6', date: '04/02/2026 04:23 PM', ref: 'EP2026/0061', category: 'Petrol', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', status: 'Paid', amount: 10.000, expenseFor: '', note: 'Zuheb' },
    { id: '7', date: '02/02/2026 04:06 PM', ref: 'EP2026/0060', category: 'Petrol', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', status: 'Paid', amount: 10.000, expenseFor: '', note: 'Zuheb' },
    { id: '8', date: '31/01/2026 07:08 PM', ref: 'EP2026/0059', category: 'Petrol', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', status: 'Paid', amount: 10.000, expenseFor: '', note: 'ZUHEB' },
    { id: '9', date: '25/01/2026 04:58 PM', ref: 'EP2026/0058', category: 'Petrol', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', status: 'Paid', amount: 10.000, expenseFor: '', note: 'Zuheb' },
    { id: '10', date: '22/01/2026 09:12 PM', ref: 'EP2026/0063', category: 'Delivery charge & Others', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', status: 'Paid', amount: 0.300, expenseFor: '', note: '' },
  ];

  const totalSale = 1167.809;
  const totalPaid = 395.619;
  const sellDue = 772.190;
  const totalExpense = expensesData.reduce((acc, curr) => acc + curr.amount, 0);

  const filteredSales = salesData.filter(s => 
    (s.customer.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.invoice.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filters.location.length === 0 || filters.location.includes(s.location))
  );

  const filteredExpenses = expensesData.filter(e => 
    (e.ref.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.category.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filters.location.length === 0 || filters.location.includes(e.location))
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <h2 className="text-xl font-bold text-slate-900">Sales Representative Report</h2>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div 
            className="flex items-center gap-2 mb-2 text-blue-600 font-bold text-sm cursor-pointer w-fit"
            onClick={() => setShowFilters(!showFilters)}
          >
              <Filter size={16} /> Filters
          </div>
          
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 animate-in slide-in-from-top-2">
                <div className="group">
                    <MultiSelect 
                        label="User"
                        options={['Shafikul Islam', 'Mr ADMIN', 'Mr Emad', 'Mr Usman', 'Ahmed']}
                        selected={filters.user}
                        onChange={(val) => setFilters({...filters, user: val})}
                    />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Business Location"
                        options={['KNWZ ARD ALKHALYJ ALMTHDH CR:1282649', 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649']}
                        selected={filters.location}
                        onChange={(val) => setFilters({...filters, location: val})}
                    />
                </div>
                <div className="group">
                    <DateRangeFilter />
                </div>
            </div>
          )}
      </div>

      {/* Summary */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Summary</h3>
          <div className="space-y-2 text-sm">
              <div className="font-medium text-slate-600">
                  Total Sale - Total Sales Return: <span className="font-bold text-slate-800">{formatRiyal(6089.554)} - {formatRiyal(335.652)} = {formatRiyal(5753.902)}</span>
              </div>
              <div className="font-medium text-slate-600">
                  Total Expense: <span className="font-bold text-slate-800">{formatRiyal(totalExpense)}</span>
              </div>
          </div>
      </div>

      {/* Tabs & Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="flex border-b border-slate-200 bg-slate-50/50">
              <button 
                className={`px-6 py-4 text-xs font-bold transition-all border-b-2 ${activeTab === 'sales_added' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                onClick={() => setActiveTab('sales_added')}
              >
                  <span className="flex items-center gap-2"><ShoppingBag size={14} /> Sales Added</span>
              </button>
              <button 
                className={`px-6 py-4 text-xs font-bold transition-all border-b-2 ${activeTab === 'sales_commission' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                onClick={() => setActiveTab('sales_commission')}
              >
                  <span className="flex items-center gap-2"><Settings size={14} /> Sales With Commission</span>
              </button>
              <button 
                className={`px-6 py-4 text-xs font-bold transition-all border-b-2 ${activeTab === 'expenses' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                onClick={() => setActiveTab('expenses')}
              >
                  <span className="flex items-center gap-2"><CreditCard size={14} /> Expenses</span>
              </button>
          </div>

          {/* Common Controls */}
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
              <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-bold">Show</span>
                  <select className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none">
                      <option>25</option>
                      <option>50</option>
                  </select>
                  <span className="text-xs text-slate-600 font-bold">entries</span>
              </div>
              
              <div className="flex gap-1">
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10}/> Export CSV</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileSpreadsheet size={10}/> Export Excel</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Printer size={10}/> Print</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Columns size={10}/> Column visibility</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10}/> Export PDF</button>
              </div>

              <div className="flex items-center gap-2">
                  <Search className="text-slate-400" size={14} />
                  <input 
                      type="text" 
                      placeholder="Search..." 
                      className="pl-2 py-1 border border-slate-300 rounded text-xs outline-none" 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
          </div>

          {activeTab === 'sales_added' && (
              <>
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-[10px] text-left border-collapse">
                        <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 whitespace-nowrap">Date <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap">Invoice No. <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap">Customer Name <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap">Location <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap">Payment Status <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap text-right">Total Amount <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap text-right">Total Paid <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap text-right">Total Remaining <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredSales.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 whitespace-nowrap">{item.date}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">{item.invoice}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">{item.customer}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-[9px] text-slate-500">{item.location}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className={`px-2 py-0.5 rounded text-white font-bold uppercase ${item.paymentStatus === 'Paid' ? 'bg-[#74c365]' : 'bg-amber-400'}`}>
                                            {item.paymentStatus}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold">{formatRiyal(item.total)}</td>
                                    <td className="px-4 py-3 text-right">{formatRiyal(item.paid)}</td>
                                    <td className="px-4 py-3 text-right">{formatRiyal(item.remaining)}</td>
                                </tr>
                            ))}
                            {filteredSales.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400 italic">No data available in table</td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="bg-slate-200 font-bold text-slate-800 text-[10px] border-t border-slate-300 sticky bottom-0">
                            <tr>
                                <td colSpan={5} className="px-4 py-3 text-right uppercase">Total:</td>
                                <td className="px-4 py-3 text-right">{formatRiyal(totalSale)}</td>
                                <td className="px-4 py-3 text-right">{formatRiyal(totalPaid)}</td>
                                <td className="px-4 py-3 text-right text-slate-500">
                                    Sell Due: {formatRiyal(sellDue)} <br/>
                                    Sell Return Due: {formatRiyal(0.000)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
              </>
          )}

          {activeTab === 'sales_commission' && (
              <>
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-[10px] text-left border-collapse">
                        <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 whitespace-nowrap">Date <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap">Invoice No. <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap">Customer Name <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap">Location <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap">Payment Status <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap text-right">Total Amount <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap text-right">Sales Commission <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredSales.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 whitespace-nowrap">{item.date}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">{item.invoice}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">{item.customer}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-[9px] text-slate-500">{item.location}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className={`px-2 py-0.5 rounded text-white font-bold uppercase ${item.paymentStatus === 'Paid' ? 'bg-[#74c365]' : 'bg-amber-400'}`}>
                                            {item.paymentStatus}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold">{formatRiyal(item.total)}</td>
                                    <td className="px-4 py-3 text-right">{formatRiyal(item.commission)}</td>
                                </tr>
                            ))}
                            {filteredSales.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">No data available in table</td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="bg-slate-200 font-bold text-slate-800 text-[10px] border-t border-slate-300 sticky bottom-0">
                            <tr>
                                <td colSpan={5} className="px-4 py-3 text-right uppercase">Total:</td>
                                <td className="px-4 py-3 text-right">{formatRiyal(totalSale)}</td>
                                <td className="px-4 py-3 text-right">{formatRiyal(0.000)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
              </>
          )}

          {activeTab === 'expenses' && (
              <>
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-[10px] text-left border-collapse">
                        <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 whitespace-nowrap">Date <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap">Reference No <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap">Expense Category <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap">Location <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap">Payment Status <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap text-right">Total amount <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap">Expense for <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-4 py-3 whitespace-nowrap">Expense note <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredExpenses.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 whitespace-nowrap">{item.date}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">{item.ref}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">{item.category}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-[9px] text-slate-500">{item.location}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className={`px-2 py-0.5 rounded text-white font-bold uppercase ${item.status === 'Paid' ? 'bg-[#74c365]' : 'bg-amber-400'}`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold">{formatRiyal(item.amount)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">{item.expenseFor}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">{item.note}</td>
                                </tr>
                            ))}
                            {filteredExpenses.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400 italic">No data available in table</td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="bg-slate-200 font-bold text-slate-800 text-[10px] border-t border-slate-300 sticky bottom-0">
                            <tr>
                                <td colSpan={5} className="px-4 py-3 text-right uppercase">Total:</td>
                                <td className="px-4 py-3 text-right">{formatRiyal(totalExpense)}</td>
                                <td colSpan={2}></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
              </>
          )}

          {activeTab === 'activities' && (
            <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
                {/* Controls */}
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/30">
                    <div className="flex items-center gap-2">
                        <button 
                            className="px-4 py-2 bg-[#6200ea] text-white rounded font-bold text-xs shadow-sm hover:bg-[#5000ca]"
                            onClick={() => setIsDiscountModalOpen(true)}
                        >
                            <Plus size={12} className="inline mr-1" /> Add Discount
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            className="px-3 py-1.5 rounded border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {/* Table for Activities */}
                {/* ... (Activity table code would go here) ... */}
            </div>
        )}

          <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
              <div>Showing {activeTab === 'expenses' ? filteredExpenses.length : filteredSales.length} entries</div>
              <div className="flex gap-1">
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50" disabled>Previous</button>
                  <button className="px-2 py-1 bg-blue-600 text-white rounded shadow-sm">1</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50" disabled>Next</button>
              </div>
          </div>
      </div>
      <div className="mt-8 pt-6 border-t border-slate-200 text-[10px] text-slate-400 font-medium text-center sm:text-left">
          Wingital - V6.4 | Copyright © 2026 All rights reserved.
      </div>

      <AddDiscountModal 
        isOpen={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
      />
    </div>
  );
};

export default ReportSalesRep;