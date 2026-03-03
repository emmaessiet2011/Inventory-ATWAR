import React, { useMemo, useState } from 'react';
import { Filter, ArrowUpDown, Calendar, Printer } from 'lucide-react';
import { useGlobalContext } from '../src/context/GlobalContext';

const TrialBalance: React.FC = () => {
  const { locations, suppliers, customers, payments, expenses, formatCurrency } = useGlobalContext();
  const [locationFilter, setLocationFilter] = useState('all');
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));

  const rows = useMemo(() => {
    const supplierDue = suppliers.reduce((acc, s) => acc + (s.totalPurchaseDue || 0), 0);
    const customerDue = customers.reduce((acc, c) => acc + (c.totalSellDue || 0), 0);
    const received = payments.filter(p => p.type === 'received').reduce((acc, p) => acc + (p.amount || 0), 0);
    const paid = payments.filter(p => p.type === 'sent').reduce((acc, p) => acc + (p.amount || 0), 0);
    const expensePaid = expenses.reduce((acc, e) => acc + (e.totalAmount || e.amount || 0), 0);
    const accountBalances = received - (paid + expensePaid);

    const base = [
      { name: 'Supplier Due', debit: 0, credit: supplierDue },
      { name: 'Customer Due', debit: customerDue, credit: 0 },
      { name: 'Account Balances', debit: accountBalances > 0 ? accountBalances : 0, credit: accountBalances < 0 ? Math.abs(accountBalances) : 0 },
    ];

    const totalDebit = base.reduce((acc, r) => acc + r.debit, 0);
    const totalCredit = base.reduce((acc, r) => acc + r.credit, 0);
    return { base, totalDebit, totalCredit };
  }, [suppliers, customers, payments, expenses]);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Trial Balance</h2>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
          <Filter className="text-cyan-500" size={20} />
          <h3 className="text-lg font-bold text-cyan-500">Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-900">Business Location:</label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-white border border-slate-200 focus:border-blue-500 transition-all text-sm text-slate-700 appearance-none cursor-pointer"
            >
              <option value="all">All locations</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.name}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-900">Filter by date:</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none bg-slate-100 border-r border-slate-200 rounded-l-lg px-3">
                <Calendar size={16} className="text-slate-500" />
              </div>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 transition-all text-sm text-slate-700"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden p-6">
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-200/80 text-slate-900 font-bold border-b border-slate-300">
              <tr>
                <th className="px-6 py-4 w-1/2">Trial Balance</th>
                <th className="px-6 py-4 w-1/4 border-l border-slate-300">Debit <ArrowUpDown size={12} className="inline ml-1 text-slate-500" /></th>
                <th className="px-6 py-4 w-1/4 border-l border-slate-300">Credit <ArrowUpDown size={12} className="inline ml-1 text-slate-500" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.base.map(row => (
                <tr key={row.name} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900">{row.name}:</td>
                  <td className="px-6 py-4 text-slate-700 border-l border-slate-200">{row.debit ? formatCurrency(row.debit) : ''}</td>
                  <td className="px-6 py-4 text-slate-700 border-l border-slate-200">{row.credit ? formatCurrency(row.credit) : ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-200/80 text-slate-900 font-bold border-t border-slate-300">
              <tr>
                <td className="px-6 py-4">Total</td>
                <td className="px-6 py-4 border-l border-slate-300">{formatCurrency(rows.totalDebit)}</td>
                <td className="px-6 py-4 border-l border-slate-300">{formatCurrency(rows.totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-sm">
          <Printer size={16} /> Print
        </button>
      </div>
    </div>
  );
};

export default TrialBalance;
