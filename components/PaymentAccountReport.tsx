import React, { useMemo, useState } from 'react';
import {
  BarChart3, Search, Download, Printer,
  CreditCard, Banknote, FileText, FileSpreadsheet
} from 'lucide-react';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

interface ReportRow {
  id: string;
  date: string;
  ref: string;
  inv: string;
  amount: number;
  type: 'Sell' | 'Purchase';
  method: string;
  account: string;
  desc: string;
  location: string;
}

const PaymentAccountReport: React.FC = () => {
  const { locations, payments, formatCurrency } = useGlobalContext();
  const [filters, setFilters] = useState({
    location: [] as string[],
    account: [] as string[],
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');

  const rows = useMemo<ReportRow[]>(() => {
    return payments.map((p) => {
      const inferredAccount = p.account || (p.method === 'Cash' ? 'Cash' : 'Bank');
      const invoice = p.linkedInvoices?.[0] || '-';
      return {
        id: p.id,
        date: p.date,
        ref: p.referenceNo || p.id,
        inv: invoice,
        amount: p.amount || 0,
        type: p.type === 'received' ? 'Sell' : 'Purchase',
        method: p.method || '-',
        account: inferredAccount,
        desc: `${p.contactType}: ${p.contactName}`,
        location: '',
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [payments]);

  const filteredData = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    const startMs = startDate ? new Date(startDate).getTime() : Number.NEGATIVE_INFINITY;
    const endMs = endDate ? (new Date(endDate).getTime() + (24 * 60 * 60 * 1000 - 1)) : Number.POSITIVE_INFINITY;
    return rows.filter(item => {
      const ts = new Date(item.date).getTime();
      const matchesLocation = filters.location.length === 0 || filters.location.includes(item.location);
      const matchesAccount = filters.account.length === 0 || filters.account.includes(item.account);
      const matchesDate = ts >= startMs && ts <= endMs;
      const matchesSearch = !lowerSearch || `${item.ref} ${item.inv} ${item.method} ${item.desc}`.toLowerCase().includes(lowerSearch);
      return matchesLocation && matchesAccount && matchesDate && matchesSearch;
    });
  }, [rows, filters, startDate, endDate, search]);

  const accountOptions = useMemo(
    () => Array.from(new Set(rows.map(r => r.account))).filter(Boolean).sort(),
    [rows]
  );

  const distribution = useMemo(() => {
    const totals = filteredData.reduce<Record<string, number>>((acc, row) => {
      acc[row.account] = (acc[row.account] || 0) + row.amount;
      return acc;
    }, {});
    const entries = Object.entries(totals) as Array<[string, number]>;
    const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
    return entries.map(([label, value]) => ({
      label,
      value,
      percentage: Math.round((value / total) * 100),
      icon: label.toLowerCase().includes('cash') ? Banknote : CreditCard,
      color: label.toLowerCase().includes('cash') ? 'bg-emerald-500' : 'bg-blue-500',
    })).sort((a, b) => b.value - a.value);
  }, [filteredData]);

  const mostActive = useMemo(() => {
    const counts = filteredData.reduce<Record<string, number>>((acc, row) => {
      acc[row.account] = (acc[row.account] || 0) + 1;
      return acc;
    }, {});
    const entries = (Object.entries(counts) as Array<[string, number]>).sort((a, b) => b[1] - a[1]);
    return entries[0] || ['-', 0];
  }, [filteredData]);

  const monthlyBars = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return { key, label: d.toLocaleString('en-US', { month: 'short' }), inflow: 0, outflow: 0 };
    });
    filteredData.forEach(row => {
      const d = new Date(row.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const month = months.find(m => m.key === key);
      if (!month) return;
      if (row.type === 'Sell') month.inflow += row.amount;
      else month.outflow += row.amount;
    });
    const maxValue = Math.max(...months.map(m => Math.max(m.inflow, m.outflow)), 1);
    return months.map(m => ({
      ...m,
      inflowPct: Math.max(4, Math.round((m.inflow / maxValue) * 100)),
      outflowPct: Math.max(4, Math.round((m.outflow / maxValue) * 100)),
    }));
  }, [filteredData]);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <BarChart3 className="text-cyan-600" size={32} />
            Payment Account Report
          </h2>
          <p className="text-slate-500 mt-1">Detailed analysis of account transactions and performance.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition shadow-sm">
            <Printer size={16} /> Print
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-xl text-sm font-bold hover:bg-cyan-700 transition shadow-lg shadow-cyan-900/20">
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px] space-y-2">
          <MultiSelect
            label="Location"
            options={locations.map(loc => loc.name)}
            selected={filters.location}
            onChange={(val) => setFilters({ ...filters, location: val })}
          />
        </div>
        <div className="flex-1 min-w-[200px] space-y-2">
          <MultiSelect
            label="Account"
            options={accountOptions}
            selected={filters.account}
            onChange={(val) => setFilters({ ...filters, account: val })}
          />
        </div>
        <div className="flex-1 min-w-[220px] space-y-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">Date Range</label>
          <div className="flex items-center gap-2">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-cyan-500 transition-all text-sm font-bold text-slate-800" />
            <span className="text-slate-400 font-bold">to</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-cyan-500 transition-all text-sm font-bold text-slate-800" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-black text-slate-900 text-lg">Transaction Volume</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-full"></div><span className="text-xs font-bold text-slate-500 uppercase">Inflow</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-rose-500 rounded-full"></div><span className="text-xs font-bold text-slate-500 uppercase">Outflow</span></div>
            </div>
          </div>

          <div className="h-64 flex items-end justify-between gap-2">
            {monthlyBars.map((m) => (
              <div key={m.key} className="flex-1 flex flex-col gap-1 items-center group">
                <div className="w-full bg-slate-100 rounded-t-lg relative overflow-hidden h-full flex flex-col justify-end">
                  <div className="bg-rose-500/20 w-full" style={{ height: `${m.outflowPct}%` }}></div>
                  <div className="bg-emerald-500 w-full" style={{ height: `${m.inflowPct}%` }}></div>
                </div>
                <span className="text-[10px] font-bold text-slate-400">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
          <h3 className="font-black text-slate-900 text-lg mb-2">Account Distribution</h3>
          <div className="space-y-4">
            {distribution.length > 0 ? distribution.map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <item.icon size={14} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-700">{item.label}</span>
                  </div>
                  <span className="text-xs font-black text-slate-900">{item.percentage}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color}`} style={{ width: `${item.percentage}%` }}></div>
                </div>
              </div>
            )) : (
              <p className="text-sm text-slate-400 italic">No payment data for selected filters.</p>
            )}
          </div>

          <div className="pt-6 border-t border-slate-100">
            <div className="p-4 bg-cyan-50 rounded-2xl">
              <p className="text-[10px] font-black text-cyan-700 uppercase tracking-wider mb-1">Most Active Account</p>
              <p className="text-sm font-bold text-cyan-900">{mostActive[0]}</p>
              <p className="text-[10px] text-cyan-700 mt-1">{mostActive[1]} transactions this period</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap gap-2">
            <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors"><FileText size={12} /> Export CSV</button>
            <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors"><FileSpreadsheet size={12} /> Export Excel</button>
            <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors"><Printer size={12} /> Print</button>
          </div>
          <div className="relative w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ..."
              className="w-full md:w-48 pl-9 pr-4 py-1.5 rounded-lg border-0 bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">Date</th>
                <th className="px-6 py-4 whitespace-nowrap">Payment Ref No.</th>
                <th className="px-6 py-4 whitespace-nowrap">Invoice No./Ref. No.</th>
                <th className="px-6 py-4 whitespace-nowrap">Amount</th>
                <th className="px-6 py-4 whitespace-nowrap">Payment Type</th>
                <th className="px-6 py-4 whitespace-nowrap">Payment Method</th>
                <th className="px-6 py-4 whitespace-nowrap">Account</th>
                <th className="px-6 py-4 whitespace-nowrap">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{row.date}</td>
                  <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{row.ref}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-cyan-600 border border-cyan-400 px-2 py-0.5 rounded text-xs">{row.inv}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{formatCurrency(row.amount)}</td>
                  <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{row.type}</td>
                  <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{row.method}</td>
                  <td className="px-6 py-4 text-slate-600 whitespace-nowrap font-bold">{row.account}</td>
                  <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{row.desc}</td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-400 italic">No data available in table</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PaymentAccountReport;
