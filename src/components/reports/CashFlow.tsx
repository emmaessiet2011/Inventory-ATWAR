import { useGlobalContext } from '@/context/GlobalContext';
import React, { useMemo, useState } from 'react';
import { Layers, ArrowUpRight, TrendingUp, TrendingDown, Filter, FileText, FileSpreadsheet, Printer, Search, Calendar, Info } from 'lucide-react';

import { printActiveReportTable } from '@/utils/printUtils';
import { getExpensePaidAmount, parseExpenseDateToMs } from '@/utils/expenses';
import { inferPaymentAccountName } from '@/utils/paymentAccounts';
import { paymentLocationCandidates } from '@/utils/accountingSnapshot';

type TxType = 'Inflow' | 'Outflow';

interface CashTx {
  id: string;
  date: string;
  account: string;
  location: string;
  locationCandidates: string[];
  description: string;
  method: string;
  details: string;
  type: TxType;
  amount: number;
}

const parseTxDateToMs = (value: string): number => {
  const direct = Date.parse(value);
  if (Number.isFinite(direct)) return direct;
  return parseExpenseDateToMs(value);
};

const normalizeText = (value: unknown) => String(value || '').trim().toLowerCase();

const CashFlow: React.FC = () => {
  const { payments, expenses, sales, locations, formatCurrency } = useGlobalContext();
  const [accountFilter, setAccountFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'inflow' | 'outflow'>('all');
  const [rangeStart, setRangeStart] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [rangeEnd, setRangeEnd] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');

  const transactions = useMemo<CashTx[]>(() => {
    const salesLocationByInvoice = new Map<string, string>();
    sales.forEach((sale) => {
      const invoiceNo = String(sale.invoiceNo || '').trim();
      if (!invoiceNo) return;
      salesLocationByInvoice.set(invoiceNo, String(sale.location || '').trim());
    });

    const expensesById = new Map<string, any>();
    expenses.forEach((expense) => expensesById.set(String(expense.id || '').trim(), expense));

    const paymentRows: CashTx[] = payments.map(payment => {
      const linkedInvoice = String(payment.linkedInvoices?.[0] || '').trim();
      const locationCandidates = paymentLocationCandidates({
        payment,
        salesLocationByInvoice,
        expensesById,
      });
      const inferredLocation = locationCandidates[0] || '';
      const linkedExpense = payment.contactType === 'Expense'
        ? expensesById.get(String(payment.expenseId || payment.contactId || '').trim())
        : null;
      const description = payment.contactType === 'Expense'
        ? `Expense payment - ${payment.contactName || linkedExpense?.category || 'Expense'}`
        : `${payment.contactType} payment - ${payment.contactName}`;

      return {
        id: `PAY-${payment.id}`,
        date: payment.date,
        account: inferPaymentAccountName(payment),
        location: inferredLocation,
        locationCandidates,
        description,
        method: payment.method || '--',
        details: payment.referenceNo || linkedInvoice || '',
        type: payment.type === 'received' ? 'Inflow' : 'Outflow',
        amount: Number(payment.amount || 0),
      };
    });

    const expenseRows: CashTx[] = expenses
      .filter(expense => {
        const paidAmount = getExpensePaidAmount(expense);
        if (paidAmount <= 0) return false;
        return !payments.some(payment =>
          payment.contactType === 'Expense' &&
          String(payment.expenseId || payment.contactId || '').trim() === String(expense.id || '').trim()
        );
      })
      .map(expense => ({
        id: `EXP-${expense.id}`,
        date: expense.date,
        account: expense.paymentAccount || 'Expense',
        location: expense.location || '',
        locationCandidates: String(expense.location || '').trim() ? [String(expense.location || '').trim()] : [],
        description: `${expense.isRefund ? 'Expense Refund' : 'Expense'} - ${expense.category}`,
        method: expense.paymentMethod || 'Expense',
        details: expense.note || '',
        type: expense.isRefund ? 'Inflow' : 'Outflow',
        amount: getExpensePaidAmount(expense),
      }));

    return [...paymentRows, ...expenseRows].sort((a, b) => {
      const left = parseTxDateToMs(a.date);
      const right = parseTxDateToMs(b.date);
      return (Number.isFinite(left) ? left : 0) - (Number.isFinite(right) ? right : 0);
    });
  }, [payments, expenses, sales]);

  const filtered = useMemo(() => {
    const startMs = new Date(rangeStart).getTime();
    const endMs = new Date(rangeEnd).getTime() + (24 * 60 * 60 * 1000 - 1);
    const lowerSearch = search.toLowerCase();
    const selectedAccountKey = accountFilter === 'all' ? '' : normalizeText(accountFilter);
    const selectedLocationKey = locationFilter === 'all' ? '' : normalizeText(locationFilter);

    const matchesBaseFilters = (tx: CashTx) => {
      const matchesAccount = !selectedAccountKey || normalizeText(tx.account) === selectedAccountKey;
      const candidates = tx.locationCandidates.length > 0 ? tx.locationCandidates : [tx.location];
      const matchesLocation = !selectedLocationKey || candidates.some(location => normalizeText(location) === selectedLocationKey);
      const matchesType = typeFilter === 'all' || tx.type.toLowerCase() === typeFilter;
      return matchesAccount && matchesLocation && matchesType;
    };

    const scopedTransactions = transactions.filter(matchesBaseFilters);

    const openingBalance = scopedTransactions
      .filter(tx => {
        const txTime = parseTxDateToMs(tx.date);
        return Number.isFinite(txTime) && txTime < startMs;
      })
      .reduce((acc, tx) => acc + (tx.type === 'Inflow' ? tx.amount : -tx.amount), 0);

    const rows = scopedTransactions.filter(tx => {
      const txTime = parseTxDateToMs(tx.date);
      const matchesDate = Number.isFinite(txTime) && txTime >= startMs && txTime <= endMs;
      const matchesSearch = !lowerSearch || `${tx.description} ${tx.details} ${tx.account} ${tx.method}`.toLowerCase().includes(lowerSearch);
      return matchesDate && matchesSearch;
    });

    return {
      rows,
      openingBalance,
    };
  }, [transactions, rangeStart, rangeEnd, accountFilter, locationFilter, typeFilter, search]);

  const accountOptions = useMemo(() => {
    const labelsByKey = new Map<string, string>();
    transactions.forEach((tx) => {
      const key = normalizeText(tx.account);
      if (!key || labelsByKey.has(key)) return;
      labelsByKey.set(key, tx.account);
    });
    return Array.from(labelsByKey.values()).sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: 'base' }),
    );
  }, [transactions]);

  const summary = useMemo(() => {
    const inflow = filtered.rows.filter(tx => tx.type === 'Inflow').reduce((acc, tx) => acc + tx.amount, 0);
    const outflow = filtered.rows.filter(tx => tx.type === 'Outflow').reduce((acc, tx) => acc + tx.amount, 0);
    let running = filtered.openingBalance;
    const withBalance = filtered.rows.map(tx => {
      running += tx.type === 'Inflow' ? tx.amount : -tx.amount;
      return { ...tx, runningBalance: running };
    });
    return { inflow, outflow, withBalance, openingBalance: filtered.openingBalance };
  }, [filtered]);

  const handleExportCSV = () => {
    const headers = ['Date', 'Account', 'Location', 'Description', 'Payment Method', 'Payment details', 'Type', 'Amount', 'Running Balance'];
    const rows = summary.withBalance.map(tx => ([
      tx.date,
      tx.account,
      tx.location || '--',
      tx.description,
      tx.method,
      tx.details || '--',
      tx.type,
      tx.amount,
      tx.runningBalance,
    ]));
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'cash_flow.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    const headers = ['Date', 'Account', 'Location', 'Description', 'Payment Method', 'Payment details', 'Type', 'Amount', 'Running Balance'];
    const rows = summary.withBalance.map(tx => ([
      tx.date,
      tx.account,
      tx.location || '--',
      tx.description,
      tx.method,
      tx.details || '--',
      tx.type,
      tx.amount,
      tx.runningBalance,
    ]));
    const tsv = [headers.join('\t'), ...rows.map(row => row.join('\t'))].join('\n');
    const blob = new Blob([tsv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'cash_flow.xls';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Layers className="text-orange-600" size={32} />
            Cash Flow
          </h2>
          <p className="text-slate-500 mt-1">Statement of cash inflows and outflows.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
          <Filter className="text-cyan-500" size={20} />
          <h3 className="text-lg font-bold text-cyan-500">Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-900">Account:</label>
            <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className="w-full px-4 py-2.5 rounded-lg bg-white border border-slate-200 focus:border-blue-500 transition-all text-sm text-slate-700 appearance-none cursor-pointer">
              <option value="all">All</option>
              {accountOptions.map(account => <option key={account} value={account}>{account}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-900">Business Location:</label>
            <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="w-full px-4 py-2.5 rounded-lg bg-white border border-slate-200 focus:border-blue-500 transition-all text-sm text-slate-700 appearance-none cursor-pointer">
              <option value="all">All locations</option>
              {locations.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-900">Date Range:</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 transition-all text-sm text-slate-700" />
              </div>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 transition-all text-sm text-slate-700" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-900">Transaction Type:</label>
            <div className="relative">
              <ArrowUpRight size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'all' | 'inflow' | 'outflow')} className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white border border-slate-200 focus:border-blue-500 transition-all text-sm text-slate-700 appearance-none cursor-pointer">
                <option value="all">All</option>
                <option value="inflow">Inflow</option>
                <option value="outflow">Outflow</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2rem] flex items-center gap-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
          <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-900/20">
            <TrendingUp size={28} />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">Total Inflow</p>
            <h3 className="text-2xl font-black text-emerald-900">{formatCurrency(summary.inflow)}</h3>
          </div>
        </div>
        <div className="bg-rose-50 border border-rose-100 p-6 rounded-[2rem] flex items-center gap-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
          <div className="w-14 h-14 bg-rose-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-rose-900/20">
            <TrendingDown size={28} />
          </div>
          <div>
            <p className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-1">Total Outflow</p>
            <h3 className="text-2xl font-black text-rose-900">{formatCurrency(summary.outflow)}</h3>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <FileText size={12} /> Export CSV
            </button>
            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <FileSpreadsheet size={12} /> Export Excel
            </button>
            <button
              onClick={() => printActiveReportTable()}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Printer size={12} /> Print
            </button>
          </div>
          <div className="relative w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ..." className="w-full md:w-56 pl-9 pr-4 py-1.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm placeholder:text-slate-400" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-white text-slate-900 font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">Date</th>
                <th className="px-6 py-4 whitespace-nowrap">Account</th>
                <th className="px-6 py-4 whitespace-nowrap">Description</th>
                <th className="px-6 py-4 whitespace-nowrap">Payment Method</th>
                <th className="px-6 py-4 whitespace-nowrap">Payment details</th>
                <th className="px-6 py-4 whitespace-nowrap">Outflow</th>
                <th className="px-6 py-4 whitespace-nowrap">Inflow</th>
                <th className="px-6 py-4 whitespace-nowrap flex items-center gap-1">Account Balance <Info size={14} className="text-cyan-500"/></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.withBalance.length > 0 ? summary.withBalance.map(tx => (
                <tr key={tx.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{tx.date}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{tx.account}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{tx.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{tx.method}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{tx.details || '--'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{tx.type === 'Outflow' ? formatCurrency(tx.amount) : ''}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{tx.type === 'Inflow' ? formatCurrency(tx.amount) : ''}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-bold">{formatCurrency(tx.runningBalance)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500 bg-slate-50/50">No data available in table</td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-200/60 font-bold text-slate-900 border-t border-slate-300">
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-lg">Total:</td>
                <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(summary.outflow)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(summary.inflow)}</td>
                <td className="px-6 py-4 whitespace-nowrap"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CashFlow;


