import { useGlobalContext } from '@/context/GlobalContext';
import React, { useMemo, useState } from 'react';
import { Filter, Calendar, Printer } from 'lucide-react';

import { printActiveReportTable } from '@/utils/printUtils';
import { getExpenseCashSignedAmount } from '@/utils/expenses';
import { buildDueSnapshot, paymentLocationCandidates } from '@/utils/accountingSnapshot';

const BalanceSheet: React.FC = () => {
  const { locations, products, sales, purchases, payments, expenses, formatCurrency } = useGlobalContext();
  const [locationFilter, setLocationFilter] = useState('all');
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));

  const totals = useMemo(() => {
    const normalizeText = (value: unknown) => String(value || '').trim().toLowerCase();
    const isAllLocations = locationFilter === 'all';
    const cutoffMs = new Date(`${reportDate}T23:59:59.999`).getTime();
    const isOnOrBeforeReportDate = (value?: string) => {
      const ms = Date.parse(String(value || ''));
      if (!Number.isFinite(ms)) return true;
      return ms <= cutoffMs;
    };
    const matchesLocation = (value?: string) =>
      isAllLocations || normalizeText(value) === normalizeText(locationFilter);

    const salesLocationByInvoice = new Map<string, string>();
    sales.forEach((sale) => {
      const invoiceNo = String(sale.invoiceNo || '').trim();
      if (!invoiceNo) return;
      salesLocationByInvoice.set(invoiceNo, String(sale.location || '').trim());
    });

    const expensesById = new Map<string, any>();
    expenses.forEach((expense) => expensesById.set(String(expense.id || ''), expense));

    const dueSnapshot = buildDueSnapshot({
      sales,
      purchases,
      payments,
      reportDate,
      locationFilter,
    });
    const supplierDue = dueSnapshot.supplierDue;
    const customerDue = dueSnapshot.customerDue;
    const closingStock = products
      .filter(product => isAllLocations || matchesLocation(product.businessLocation))
      .reduce((acc, product) => acc + ((product.stock || 0) * (product.unitPurchasePrice || 0)), 0);

    const filteredPayments = payments.filter(payment => {
      if (!isOnOrBeforeReportDate(payment.date)) return false;
      if (isAllLocations) return true;
      const locationsToMatch = paymentLocationCandidates({
        payment,
        salesLocationByInvoice,
        expensesById,
      });
      return locationsToMatch.some(location => matchesLocation(location));
    });

    const received = filteredPayments.filter(p => p.type === 'received').reduce((acc, p) => acc + (p.amount || 0), 0);
    const paid = filteredPayments.filter(p => p.type === 'sent').reduce((acc, p) => acc + (p.amount || 0), 0);
    const expenseCashFromExpenses = expenses
      .filter(expense => isOnOrBeforeReportDate(expense.date) && matchesLocation(expense.location))
      .reduce((acc, expense) => acc + getExpenseCashSignedAmount(expense), 0);
    const expenseCashFromLedger = payments
      .filter(payment =>
        payment.contactType === 'Expense' &&
        isOnOrBeforeReportDate(payment.date) &&
        (
          isAllLocations ||
          paymentLocationCandidates({
            payment,
            salesLocationByInvoice,
            expensesById,
          }).some(location => matchesLocation(location))
        )
      )
      .reduce((acc, payment) => acc + (payment.type === 'sent' ? payment.amount : -payment.amount), 0);
    const missingExpenseCashImpact = expenseCashFromExpenses - expenseCashFromLedger;
    const accountBalances = received - (paid + missingExpenseCashImpact);
    const accountOverdraft = Math.max(0, -accountBalances);
    const accountAssetBalance = Math.max(0, accountBalances);

    return {
      supplierDue,
      customerDue,
      closingStock,
      accountBalances,
      accountOverdraft,
      accountAssetBalance,
      totalLiability: supplierDue + accountOverdraft,
      totalAssets: customerDue + closingStock + accountAssetBalance,
    };
  }, [locationFilter, reportDate, products, sales, purchases, payments, expenses]);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Balance Sheet</h2>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
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
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-200/80 text-slate-900 font-bold border-b border-slate-300">
              <tr>
                <th className="px-6 py-4 w-1/2">Liability</th>
                <th className="px-6 py-4 w-1/2 border-l border-slate-300">Assets</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr className="hover:bg-slate-50 transition-colors align-top">
                <td className="p-0 border-r border-slate-200">
                  <table className="w-full">
                    <tbody>
                      <tr>
                        <td className="px-6 py-4 font-bold text-slate-900 w-1/2">Supplier Due:</td>
                        <td className="px-6 py-4 text-slate-700 w-1/2 text-right">{formatCurrency(totals.supplierDue)}</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 font-bold text-slate-900 w-1/2">Account Overdraft:</td>
                        <td className="px-6 py-4 text-slate-700 w-1/2 text-right">{formatCurrency(totals.accountOverdraft)}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
                <td className="p-0">
                  <table className="w-full">
                    <tbody>
                      <tr>
                        <td className="px-6 py-4 font-bold text-slate-900 w-1/2">Customer Due:</td>
                        <td className="px-6 py-4 text-slate-700 w-1/2 text-right">{formatCurrency(totals.customerDue)}</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 font-bold text-slate-900 w-1/2">Closing stock:</td>
                        <td className="px-6 py-4 text-slate-700 w-1/2 text-right">{formatCurrency(totals.closingStock)}</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 font-bold text-slate-900 w-1/2">Account Balances:</td>
                        <td className="px-6 py-4 text-slate-700 w-1/2 text-right">{formatCurrency(totals.accountAssetBalance)}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
            <tfoot className="bg-slate-200/80 text-slate-900 font-bold border-t border-slate-300">
              <tr>
                <td className="p-0 border-r border-slate-300">
                  <table className="w-full">
                    <tbody>
                      <tr>
                        <td className="px-6 py-4 w-1/2">Total Liability:</td>
                        <td className="px-6 py-4 w-1/2 text-right">{formatCurrency(totals.totalLiability)}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
                <td className="p-0">
                  <table className="w-full">
                    <tbody>
                      <tr>
                        <td className="px-6 py-4 w-1/2">Total Assets:</td>
                        <td className="px-6 py-4 w-1/2 text-right">{formatCurrency(totals.totalAssets)}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => printActiveReportTable()}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-sm"
        >
          <Printer size={16} /> Print
        </button>
      </div>
    </div>
  );
};

export default BalanceSheet;


