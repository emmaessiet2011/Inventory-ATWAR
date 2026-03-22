import React, { useMemo, useState } from 'react';
import { Printer, Info } from 'lucide-react';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import { useGlobalContext } from '@/context/GlobalContext';

import MultiSelect from '@/components/shared/MultiSelect';

import { printActiveReportTable } from '@/utils/printUtils';
import { parseExpenseDateToMs } from '@/utils/expenses';

interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;
const normalizeText = (value?: string) => String(value || '').trim().toLowerCase();

const getCurrentYearRange = (): DateRangeValue => {
  const now = new Date();
  return {
    startDate: new Date(now.getFullYear(), 0, 1),
    endDate: new Date(now.getFullYear(), 11, 31),
    label: 'This Year',
  };
};

const parseReportDateToMs = (value: unknown): number => {
  const raw = String(value || '').trim();
  if (!raw) return Number.NaN;
  const direct = Date.parse(raw);
  if (Number.isFinite(direct)) return direct;
  return parseExpenseDateToMs(raw);
};

const saleDueAmount = (sale: { paymentStatus?: string; sellDue?: number; grandTotal?: number; totalAmount?: number; totalPaid?: number }) => {
  if (sale.paymentStatus === 'Paid') return 0;
  if (typeof sale.sellDue === 'number') return Math.max(0, sale.sellDue);
  return Math.max(0, (sale.grandTotal || sale.totalAmount || 0) - (sale.totalPaid || 0));
};

const ReportPurchaseSale: React.FC = () => {
  const {
    locations,
    purchases,
    purchaseReturns,
    sales,
    sellReturns,
    formatCurrency,
  } = useGlobalContext();

  const [range, setRange] = useState<DateRangeValue>(getCurrentYearRange);
  const [filters, setFilters] = useState({
    location: [] as string[],
  });

  const selectedLocationSet = useMemo(
    () => new Set(filters.location.map((value) => normalizeText(value))),
    [filters.location],
  );

  const startMs = useMemo(() => (
    range.startDate
      ? new Date(range.startDate.getFullYear(), range.startDate.getMonth(), range.startDate.getDate(), 0, 0, 0, 0).getTime()
      : null
  ), [range.startDate]);

  const endMs = useMemo(() => (
    range.endDate
      ? new Date(range.endDate.getFullYear(), range.endDate.getMonth(), range.endDate.getDate(), 23, 59, 59, 999).getTime()
      : null
  ), [range.endDate]);

  const hasDateFilter = startMs != null || endMs != null;

  const isDateMatch = (value: unknown) => {
    const ms = parseReportDateToMs(value);
    if (!Number.isFinite(ms)) return !hasDateFilter;
    if (startMs != null && ms < startMs) return false;
    if (endMs != null && ms > endMs) return false;
    return true;
  };

  const isLocationMatch = (location?: string) => (
    selectedLocationSet.size === 0 || selectedLocationSet.has(normalizeText(location))
  );

  const locationOptions = useMemo(() => {
    return Array.from(new Set([
      ...locations.map((location) => String(location.name || '').trim()),
      ...purchases.map((purchase) => String(purchase.location || '').trim()),
      ...purchaseReturns.map((record) => String(record.location || '').trim()),
      ...sales.map((sale) => String(sale.location || '').trim()),
      ...sellReturns.map((record) => String(record.location || '').trim()),
    ].filter(Boolean))).sort((left, right) => left.localeCompare(right));
  }, [locations, purchases, purchaseReturns, sales, sellReturns]);

  const filteredPurchases = useMemo(() => purchases.filter((purchase) => (
    isDateMatch(purchase.date) && isLocationMatch(purchase.location)
  )), [purchases, startMs, endMs, hasDateFilter, selectedLocationSet]);

  const filteredPurchaseReturns = useMemo(() => purchaseReturns.filter((record) => (
    isDateMatch(record.date) && isLocationMatch(record.location)
  )), [purchaseReturns, startMs, endMs, hasDateFilter, selectedLocationSet]);

  const filteredSales = useMemo(() => sales.filter((sale) => {
    const status = String(sale.status || sale.saleStatus || '').trim();
    return status === 'Final' && isDateMatch(sale.date) && isLocationMatch(sale.location);
  }), [sales, startMs, endMs, hasDateFilter, selectedLocationSet]);

  const filteredSellReturns = useMemo(() => sellReturns.filter((record) => (
    isDateMatch(record.date) && isLocationMatch(record.location)
  )), [sellReturns, startMs, endMs, hasDateFilter, selectedLocationSet]);

  const metrics = useMemo(() => {
    const purchaseTotal = round3(filteredPurchases.reduce((sum, purchase) => {
      const subTotal = Number(purchase.subTotal);
      const grandTotal = Number(purchase.grandTotal || 0);
      const purchaseTaxAmount = Number(purchase.purchaseTaxAmount || 0);
      const fallback = Math.max(0, grandTotal - (Number.isFinite(purchaseTaxAmount) ? purchaseTaxAmount : 0));
      return sum + (Number.isFinite(subTotal) ? subTotal : fallback);
    }, 0));

    const purchaseIncTax = round3(filteredPurchases.reduce((sum, purchase) => {
      const amount = Number(purchase.grandTotal || 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0));

    const purchaseReturnIncTax = round3(filteredPurchaseReturns.reduce((sum, record) => {
      const amount = Number(record.grandTotal || 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0));

    const purchaseDue = round3(filteredPurchases.reduce((sum, purchase) => {
      const due = Number(purchase.paymentDue || 0);
      return sum + (Number.isFinite(due) ? Math.max(0, due) : 0);
    }, 0));

    const saleTotal = round3(filteredSales.reduce((sum, sale) => {
      const amount = Number(sale.subTotal || 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0));

    const saleIncTax = round3(filteredSales.reduce((sum, sale) => {
      const amount = Number(sale.grandTotal || sale.totalAmount || 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0));

    const sellReturnIncTax = round3(filteredSellReturns.reduce((sum, record) => {
      const amount = Number(record.total || record.subTotal || 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0));

    const saleDue = round3(filteredSales.reduce((sum, sale) => sum + saleDueAmount(sale), 0));

    const saleMinusPurchase = round3((saleIncTax - sellReturnIncTax) - (purchaseIncTax - purchaseReturnIncTax));
    const dueAmount = round3(saleDue - purchaseDue);

    return {
      purchases: {
        total: purchaseTotal,
        incTax: purchaseIncTax,
        returnIncTax: purchaseReturnIncTax,
        due: purchaseDue,
      },
      sales: {
        total: saleTotal,
        incTax: saleIncTax,
        returnIncTax: sellReturnIncTax,
        due: saleDue,
      },
      overall: {
        saleMinusPurchase,
        dueAmount,
      },
    };
  }, [filteredPurchases, filteredPurchaseReturns, filteredSales, filteredSellReturns]);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
<div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            Purchase & Sale Report
          </h2>
          <p className="text-xs text-slate-500 mt-1">Purchase & sale details for the selected date range</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="w-full sm:w-64">
            <MultiSelect
              label="Business Location"
              options={locationOptions}
              selected={filters.location}
              onChange={(nextLocation) => setFilters({ location: nextLocation })}
            />
          </div>

          <div className="bg-slate-100 rounded-lg p-1 border border-slate-200 w-full sm:w-auto">
            <DateRangeFilter
              className="min-w-[200px]"
              onRangeSelect={(nextRange) => setRange(nextRange as DateRangeValue)}
            />
          </div>

        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative h-full">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 text-sm">Purchases</h3>
          </div>
          <div className="p-6 space-y-5 text-sm flex-1">
            <div className="flex justify-between items-center border-b border-slate-50 pb-3">
              <span className="font-bold text-slate-700">Total Purchase:</span>
              <span className="font-medium text-slate-600">{formatCurrency(metrics.purchases.total)}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-50 pb-3">
              <span className="font-bold text-slate-700">Purchase Including tax:</span>
              <span className="font-medium text-slate-600">{formatCurrency(metrics.purchases.incTax)}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-50 pb-3">
              <span className="font-bold text-slate-700">Total Purchase Return Including Tax:</span>
              <span className="font-medium text-slate-600">{formatCurrency(metrics.purchases.returnIncTax)}</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="font-bold text-slate-700 flex items-center gap-1">
                Purchase Due:
                <Info size={14} className="text-blue-500" />
              </span>
              <span className="font-medium text-slate-600">{formatCurrency(metrics.purchases.due)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative h-full">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 text-sm">Sales</h3>
          </div>
          <div className="p-6 space-y-5 text-sm flex-1">
            <div className="flex justify-between items-center border-b border-slate-50 pb-3">
              <span className="font-bold text-slate-700">Total Sale:</span>
              <span className="font-medium text-slate-600">{formatCurrency(metrics.sales.total)}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-50 pb-3">
              <span className="font-bold text-slate-700">Sale Including tax:</span>
              <span className="font-medium text-slate-600">{formatCurrency(metrics.sales.incTax)}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-50 pb-3">
              <span className="font-bold text-slate-700">Total Sell Return Including Tax:</span>
              <span className="font-medium text-slate-600">{formatCurrency(metrics.sales.returnIncTax)}</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="font-bold text-slate-700 flex items-center gap-1">
                Sale Due:
                <Info size={14} className="text-blue-500" />
              </span>
              <span className="font-medium text-slate-600">{formatCurrency(metrics.sales.due)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden p-8">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2 text-sm">
          Overall ((Sale - Sell Return) - (Purchase - Purchase Return))
          <Info size={14} className="text-blue-500 cursor-help" />
        </h3>

        <div className="space-y-4 pl-4 border-l-4 border-emerald-500/20">
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-slate-500 w-32">Sale - Purchase:</span>
            <span className={`text-xl font-black tracking-tight ${metrics.overall.saleMinusPurchase >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {formatCurrency(metrics.overall.saleMinusPurchase)}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-slate-500 w-32">Due amount:</span>
            <span className={`text-xl font-black tracking-tight ${metrics.overall.dueAmount >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {formatCurrency(metrics.overall.dueAmount)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={() => printActiveReportTable()}
          className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-purple-900/20 hover:bg-blue-700 transition-all flex items-center gap-2 transform active:scale-95"
        >
          <Printer size={18} />
          Print
        </button>
      </div>
    </div>
  );
};

export default ReportPurchaseSale;
