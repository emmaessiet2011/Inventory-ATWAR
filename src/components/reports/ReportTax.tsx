import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Filter,
  FileText,
  FileSpreadsheet,
  Printer,
  Columns,
  Search,
  Info,
  ArrowUpDown,
  CreditCard,Calculator} from 'lucide-react';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import { useGlobalContext } from '@/context/GlobalContext';

import MultiSelect from '@/components/shared/MultiSelect';

import { printActiveReportTable } from '@/utils/printUtils';
import { parseExpenseDateToMs } from '@/utils/expenses';

interface TaxTransaction {
  id: string;
  date: string;
  dateMs: number;
  referenceNo: string;
  partyName: string;
  taxNumber: string;
  totalAmount: number;
  paymentMethod: string;
  discountAmount: number;
  vat: number;
  location: string;
}

interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;
const normalizeText = (value?: string) => String(value || '').trim().toLowerCase();
const escapeCsv = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
const escapeTsv = (value: string) => `"${String(value).replace(/"/g, '""').replace(/\t/g, ' ').replace(/\r?\n/g, ' ')}"`;

const getCurrentYearRange = (): DateRangeValue => {
  const now = new Date();
  return {
    startDate: new Date(now.getFullYear(), 0, 1),
    endDate: new Date(now.getFullYear(), 11, 31),
    label: 'This Year',
  };
};

const parseTaxDateToMs = (value: unknown): number => {
  const raw = String(value || '').trim();
  if (!raw) return Number.NaN;
  const direct = Date.parse(raw);
  if (Number.isFinite(direct)) return direct;
  return parseExpenseDateToMs(raw);
};

const parseRateFromLabel = (value?: string): number => {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const match = raw.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) return 0;
  const rate = Number(match[1]);
  return Number.isFinite(rate) ? Math.max(0, rate) : 0;
};

const safeTaxNumber = (value: unknown): string => {
  const normalized = String(value || '').trim();
  if (!normalized) return '—';
  const key = normalized.toLowerCase();
  if (key === '--' || key === '-' || key === 'na' || key === 'n/a' || key === 'none') {
    return '—';
  }
  return normalized;
};

const resolveReportedVat = (input: {
  headerVat?: number;
  lineVat?: number;
  rateVat?: number;
  diffVat?: number;
}): number => {
  const headerVat = Number(input.headerVat);
  if (Number.isFinite(headerVat) && headerVat > 0) return round3(headerVat);

  const lineVat = Number(input.lineVat);
  if (Number.isFinite(lineVat) && lineVat > 0) return round3(lineVat);

  const rateVat = Number(input.rateVat);
  if (Number.isFinite(rateVat) && rateVat > 0) return round3(rateVat);

  const diffVat = Number(input.diffVat);
  if (Number.isFinite(diffVat) && diffVat > 0) return round3(diffVat);

  return 0;
};

const resolveSaleDiscount = (subTotal: number, discountType?: string, discountAmount?: number): number => {
  const amount = Number(discountAmount || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (String(discountType || '').trim() === 'Percentage') {
    return Math.max(0, subTotal * (amount / 100));
  }
  return Math.max(0, amount);
};

const formatDateBySettings = (ms: number, dateFormat: string): string => {
  if (!Number.isFinite(ms)) return '--';
  const date = new Date(ms);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours24 = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = String(hours24 % 12 || 12).padStart(2, '0');
  const datePart = dateFormat === 'mm/dd/yyyy' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
  return `${datePart} ${hours12}:${minutes} ${suffix}`;
};

const buildPageItems = (currentPage: number, totalPages: number): Array<number | '...'> => {
  const safeCurrentPage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const items: Array<number | '...'> = [1];
  const left = Math.max(2, safeCurrentPage - 1);
  const right = Math.min(totalPages - 1, safeCurrentPage + 1);
  if (left > 2) items.push('...');
  for (let page = left; page <= right; page += 1) items.push(page);
  if (right < totalPages - 1) items.push('...');
  items.push(totalPages);
  return items;
};

type ColumnKey =
  | 'date'
  | 'referenceNo'
  | 'partyName'
  | 'taxNumber'
  | 'totalAmount'
  | 'paymentMethod'
  | 'discount'
  | 'vat';

const ReportTax: React.FC = () => {
  const { locations, sales, purchases, expenses, customers, suppliers, taxRates, settings, formatCurrency } = useGlobalContext();
  const [activeTab, setActiveTab] = useState<'purchase' | 'sales' | 'expense'>('sales');
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [range, setRange] = useState<DateRangeValue>(getCurrentYearRange);
  const [filters, setFilters] = useState({
    location: [] as string[],
    contact: [] as string[],
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
    date: true,
    referenceNo: true,
    partyName: true,
    taxNumber: true,
    totalAmount: true,
    paymentMethod: true,
    discount: true,
    vat: true,
  });
  const columnMenuRef = useRef<HTMLDivElement | null>(null);

  const taxRateByName = useMemo(() => {
    const map = new Map<string, number>();
    taxRates.forEach((rate) => {
      const key = normalizeText(rate.name);
      if (key) map.set(key, Number(rate.rate || 0));
    });
    return map;
  }, [taxRates]);

  const taxRateById = useMemo(() => {
    const map = new Map<string, number>();
    taxRates.forEach((rate) => map.set(String(rate.id || ''), Number(rate.rate || 0)));
    return map;
  }, [taxRates]);

  const customerById = useMemo(() => {
    const map = new Map<string, (typeof customers)[number]>();
    customers.forEach((customer) => map.set(String(customer.id || ''), customer));
    return map;
  }, [customers]);

  const supplierById = useMemo(() => {
    const map = new Map<string, (typeof suppliers)[number]>();
    suppliers.forEach((supplier) => map.set(String(supplier.id || ''), supplier));
    return map;
  }, [suppliers]);

  const salesTaxData = useMemo<TaxTransaction[]>(() => {
    return sales
      .filter((sale) => String(sale.status || sale.saleStatus || '').trim() === 'Final')
      .map((sale) => {
        const subTotal = Number(sale.subTotal || 0);
        const shipping = Number(sale.shippingCharges || 0);
        const discount = resolveSaleDiscount(subTotal, sale.discountType, Number(sale.discountAmount || 0));
        const taxableBase = Math.max(0, subTotal - discount);
        const saleTaxLabel = String(sale.tax || '').trim();
        const rateFromSettings = taxRateByName.get(normalizeText(saleTaxLabel)) || 0;
        const rate = rateFromSettings > 0 ? rateFromSettings : parseRateFromLabel(saleTaxLabel);
        const saleTaxType = String((sale as any).taxType || '').trim().toLowerCase();
        const vatByRate = rate > 0
          ? saleTaxType === 'inclusive'
            ? taxableBase * rate / (100 + rate)
            : taxableBase * (rate / 100)
          : 0;
        const vatByLine = (sale.items || []).reduce((sum, item) => sum + Number(item.tax || 0), 0);
        const grand = Number(sale.grandTotal || sale.totalAmount || 0);
        const vatByDiff = Math.max(0, grand - shipping - taxableBase);
        const vatByHeader = Number((sale as any)?.taxAmount || 0);
        const vat = resolveReportedVat({
          headerVat: vatByHeader,
          lineVat: vatByLine,
          rateVat: vatByRate,
          diffVat: vatByDiff,
        });
        const customer = customerById.get(String(sale.customerId || ''));
        return {
          id: String(sale.id || ''),
          date: String(sale.date || ''),
          dateMs: parseTaxDateToMs(sale.date),
          referenceNo: String(sale.invoiceNo || '--'),
          partyName: String(sale.customerName || customer?.businessName || 'Walk-in Customer'),
          taxNumber: safeTaxNumber(customer?.taxNumber),
          totalAmount: round3(grand),
          paymentMethod: String(sale.paymentMethod || ''),
          discountAmount: round3(discount),
          vat,
          location: String(sale.location || ''),
        };
      })
      .filter((row) => row.vat > 0.0001);
  }, [sales, customerById, taxRateByName]);

  const purchaseTaxData = useMemo<TaxTransaction[]>(() => {
    return purchases
      .map((purchase) => {
        const headerVat = Number(purchase.purchaseTaxAmount || 0);
        const subTotal = Number(purchase.subTotal || 0);
        const discount = Number(purchase.discountAmount || 0);
        const taxableBase = Math.max(0, subTotal - (Number.isFinite(discount) ? discount : 0));
        const rateById = taxRateById.get(String(purchase.purchaseTaxId || '')) || 0;
        const rateByName = taxRateByName.get(normalizeText(purchase.purchaseTaxName)) || 0;
        const rate = rateById > 0 ? rateById : rateByName > 0 ? rateByName : parseRateFromLabel(purchase.purchaseTaxName);
        const purchaseTaxType = String((purchase as any).purchaseTaxType || (purchase as any).taxType || '').trim().toLowerCase();
        const vatByRate = rate > 0
          ? purchaseTaxType === 'inclusive'
            ? taxableBase * rate / (100 + rate)
            : taxableBase * (rate / 100)
          : 0;
        const vatByLine = (purchase.items || []).reduce((sum, item) => sum + Number(item.tax || 0), 0);
        const vat = resolveReportedVat({
          headerVat,
          lineVat: vatByLine,
          rateVat: vatByRate,
        });
        const supplier = supplierById.get(String(purchase.supplierId || ''));
        return {
          id: String(purchase.id || ''),
          date: String(purchase.date || ''),
          dateMs: parseTaxDateToMs(purchase.date),
          referenceNo: String(purchase.refNo || purchase.id || '--'),
          partyName: String(purchase.supplier || supplier?.businessName || 'Unknown Supplier'),
          taxNumber: safeTaxNumber(supplier?.taxNumber),
          totalAmount: round3(Number(purchase.grandTotal || 0)),
          paymentMethod: String(purchase.paymentMethod || ''),
          discountAmount: round3(Number(purchase.discountAmount || 0)),
          vat,
          location: String(purchase.location || ''),
        };
      })
      .filter((row) => row.vat > 0.0001);
  }, [purchases, supplierById, taxRateById, taxRateByName]);

  const expenseTaxData = useMemo<TaxTransaction[]>(() => {
    return expenses
      .map((expense) => ({
        id: String(expense.id || ''),
        date: String(expense.date || ''),
        dateMs: parseTaxDateToMs(expense.date),
        referenceNo: String(expense.refNo || expense.id || '--'),
        partyName: String(expense.category || 'Uncategorized'),
        taxNumber: '—',
        totalAmount: round3(Number(expense.totalAmount || expense.amount || 0)),
        paymentMethod: String(expense.paymentMethod || ''),
        discountAmount: 0,
        vat: round3(Number(expense.tax || 0)),
        location: String(expense.location || ''),
      }))
      .filter((row) => row.vat > 0.0001);
  }, [expenses]);

  const startMs = range.startDate ? new Date(range.startDate.getFullYear(), range.startDate.getMonth(), range.startDate.getDate(), 0, 0, 0, 0).getTime() : null;
  const endMs = range.endDate ? new Date(range.endDate.getFullYear(), range.endDate.getMonth(), range.endDate.getDate(), 23, 59, 59, 999).getTime() : null;
  const selectedLocationSet = new Set(filters.location.map((value) => normalizeText(value)));
  const matchesDateAndLocation = (row: TaxTransaction) => {
    if ((startMs != null || endMs != null) && !Number.isFinite(row.dateMs)) return false;
    if (startMs != null && Number.isFinite(row.dateMs) && row.dateMs < startMs) return false;
    if (endMs != null && Number.isFinite(row.dateMs) && row.dateMs > endMs) return false;
    if (selectedLocationSet.size > 0 && !selectedLocationSet.has(normalizeText(row.location))) return false;
    return true;
  };

  const scopedSales = useMemo(() => salesTaxData.filter(matchesDateAndLocation), [salesTaxData, startMs, endMs, filters.location]);
  const scopedPurchases = useMemo(() => purchaseTaxData.filter(matchesDateAndLocation), [purchaseTaxData, startMs, endMs, filters.location]);
  const scopedExpenses = useMemo(() => expenseTaxData.filter(matchesDateAndLocation), [expenseTaxData, startMs, endMs, filters.location]);

  const currentData = activeTab === 'sales' ? scopedSales : activeTab === 'purchase' ? scopedPurchases : scopedExpenses;
  const partyHeader = activeTab === 'sales' ? 'Customer' : activeTab === 'purchase' ? 'Supplier' : 'Expense Category';
  const referenceHeader = activeTab === 'expense' ? 'Reference No' : 'Invoice No.';

  const contactOptions = useMemo(() => {
    const names: string[] = currentData.map((row) => String(row.partyName || ''));
    return Array.from(new Set(names.filter(Boolean))).sort((left, right) => left.localeCompare(right));
  }, [currentData]);
  const locationOptions = useMemo(() => {
    const merged: string[] = [
      ...locations.map((location) => String(location.name || '')),
      ...salesTaxData.map((row) => String(row.location || '')),
      ...purchaseTaxData.map((row) => String(row.location || '')),
      ...expenseTaxData.map((row) => String(row.location || '')),
    ];
    return Array.from(new Set(merged.filter(Boolean))).sort((left, right) => left.localeCompare(right));
  }, [locations, salesTaxData, purchaseTaxData, expenseTaxData]);

  const filteredData = useMemo(() => {
    const query = normalizeText(searchTerm);
    return currentData.filter((row) => {
      if (filters.contact.length > 0 && !filters.contact.includes(row.partyName)) return false;
      if (!query) return true;
      const haystack = `${row.partyName} ${row.referenceNo} ${row.taxNumber}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [currentData, searchTerm, filters.contact]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, entriesPerPage, filters.location, filters.contact, startMs, endMs]);

  useEffect(() => {
    if (!showColumnMenu) return undefined;
    const handleClickOutside = (event: MouseEvent) => {
      if (!columnMenuRef.current) return;
      if (!columnMenuRef.current.contains(event.target as Node)) {
        setShowColumnMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColumnMenu]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / entriesPerPage));
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
    if (currentPage < 1) setCurrentPage(1);
  }, [currentPage, totalPages]);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * entriesPerPage;
  const pageRows = filteredData.slice(startIndex, startIndex + entriesPerPage);

  const outputTax = round3(scopedSales.reduce((sum, row) => sum + row.vat, 0));
  const inputTax = round3(scopedPurchases.reduce((sum, row) => sum + row.vat, 0));
  const expenseTax = round3(scopedExpenses.reduce((sum, row) => sum + row.vat, 0));
  const overallTax = round3(outputTax - inputTax - expenseTax);
  const filteredTotalAmount = round3(filteredData.reduce((sum, row) => sum + row.totalAmount, 0));
  const filteredTotalVat = round3(filteredData.reduce((sum, row) => sum + row.vat, 0));

  const exportCsv = () => {
    const header = ['Date', referenceHeader, partyHeader, 'Tax Number', 'Total Amount', 'Payment Method', 'Discount', 'VAT'];
    const rows = filteredData.map((row) => [
      formatDateBySettings(row.dateMs, settings.dateFormat),
      row.referenceNo,
      row.partyName,
      row.taxNumber || '--',
      row.totalAmount.toFixed(3),
      row.paymentMethod || '--',
      row.discountAmount.toFixed(3),
      row.vat.toFixed(3),
    ].map(escapeCsv).join(','));
    const csv = [header.map(escapeCsv).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax-report-${activeTab}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const header = ['Date', referenceHeader, partyHeader, 'Tax Number', 'Total Amount', 'Payment Method', 'Discount', 'VAT'];
    const rows = filteredData.map((row) => [
      formatDateBySettings(row.dateMs, settings.dateFormat),
      row.referenceNo,
      row.partyName,
      row.taxNumber || '--',
      row.totalAmount.toFixed(3),
      row.paymentMethod || '--',
      row.discountAmount.toFixed(3),
      row.vat.toFixed(3),
    ].map(escapeTsv).join('\t'));
    const tsv = [header.map(escapeTsv).join('\t'), ...rows].join('\n');
    const blob = new Blob([tsv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax-report-${activeTab}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pageItems = buildPageItems(safeCurrentPage, totalPages);

  const toggleColumn = (column: ColumnKey) => {
    setVisibleColumns((previous) => ({
      ...previous,
      [column]: !previous[column],
    }));
  };

  const visibleColumnCount = Math.max(1, Object.values(visibleColumns).filter(Boolean).length);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-4 mb-6">
        <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
          <Calculator size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Tax Report</h1>
          <p className="text-slate-500 text-sm mt-0.5">VAT and tax collected by period</p>
        </div>
      </div>
          <p className="text-xs text-slate-500 mt-1">VAT details computed from real sales, purchases and expenses.</p>
        </div>

        <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
<div className="flex items-center gap-2 mb-4 text-blue-600 font-bold text-sm cursor-pointer">
            <Filter size={16} /> Filters
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MultiSelect label="Business Location" options={locationOptions} selected={filters.location} onChange={(location) => setFilters({ ...filters, location })} />
            <MultiSelect label="Contact" options={contactOptions} selected={filters.contact} onChange={(contact) => setFilters({ ...filters, contact })} />
            <DateRangeFilter onRangeSelect={(nextRange) => setRange(nextRange as DateRangeValue)} />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        <h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1">Overall Tax (Output - Input - Expense) <Info size={12} className="text-blue-500" /></h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Output Tax (Sales)</p><p className="text-sm font-bold text-emerald-600">{formatCurrency(outputTax)}</p></div>
          <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Input Tax (Purchases)</p><p className="text-sm font-bold text-red-500">{formatCurrency(inputTax)}</p></div>
          <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Expense Tax</p><p className="text-sm font-bold text-red-500">{formatCurrency(expenseTax)}</p></div>
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200"><p className="text-xs text-blue-700 font-bold">Net Tax Payable</p><p className={`text-lg font-bold ${overallTax >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(overallTax)}</p></div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="flex border-b border-slate-200 bg-slate-50/50">
          <button onClick={() => setActiveTab('purchase')} className={`px-6 py-4 text-xs font-bold transition-all border-b-2 ${activeTab === 'purchase' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><span className="flex items-center gap-2"><CreditCard size={14} /> Input Tax (Purchases)</span></button>
          <button onClick={() => setActiveTab('sales')} className={`px-6 py-4 text-xs font-bold transition-all border-b-2 ${activeTab === 'sales' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><span className="flex items-center gap-2"><CreditCard size={14} /> Output Tax (Sales)</span></button>
          <button onClick={() => setActiveTab('expense')} className={`px-6 py-4 text-xs font-bold transition-all border-b-2 ${activeTab === 'expense' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><span className="flex items-center gap-2"><CreditCard size={14} /> Expense Tax</span></button>
        </div>

        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 font-bold">Show</span>
            <select className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none" value={entriesPerPage} onChange={(e) => setEntriesPerPage(Number(e.target.value) || 25)}>
              <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
            </select>
            <span className="text-xs text-slate-600 font-bold">entries</span>
          </div>
          <div className="flex gap-1 flex-wrap relative" ref={columnMenuRef}>
            <button onClick={exportCsv} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10} /> Export CSV</button>
            <button onClick={exportExcel} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileSpreadsheet size={10} /> Excel</button>
            <button onClick={() => printActiveReportTable()} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Printer size={10} /> Print</button>
            <button type="button" onClick={() => setShowColumnMenu((value) => !value)} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Columns size={10} /> Columns</button>
            {showColumnMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded shadow-xl z-20 p-2 space-y-1 text-xs">
                <label className="flex items-center gap-2"><input type="checkbox" checked={visibleColumns.date} onChange={() => toggleColumn('date')} /> Date</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={visibleColumns.referenceNo} onChange={() => toggleColumn('referenceNo')} /> {referenceHeader}</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={visibleColumns.partyName} onChange={() => toggleColumn('partyName')} /> {partyHeader}</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={visibleColumns.taxNumber} onChange={() => toggleColumn('taxNumber')} /> Tax Number</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={visibleColumns.totalAmount} onChange={() => toggleColumn('totalAmount')} /> Total Amount</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={visibleColumns.paymentMethod} onChange={() => toggleColumn('paymentMethod')} /> Payment Method</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={visibleColumns.discount} onChange={() => toggleColumn('discount')} /> Discount</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={visibleColumns.vat} onChange={() => toggleColumn('vat')} /> VAT</label>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input type="text" placeholder="Search..." className="pl-8 pr-3 py-1.5 rounded border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-48" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                {visibleColumns.date && <th className="px-4 py-3 whitespace-nowrap">Date <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.referenceNo && <th className="px-4 py-3 whitespace-nowrap">{referenceHeader} <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.partyName && <th className="px-4 py-3 whitespace-nowrap">{partyHeader} <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.taxNumber && <th className="px-4 py-3 whitespace-nowrap">Tax Number</th>}
                {visibleColumns.totalAmount && <th className="px-4 py-3 whitespace-nowrap text-right">Total Amount <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.paymentMethod && <th className="px-4 py-3 whitespace-nowrap text-center">Payment Method</th>}
                {visibleColumns.discount && <th className="px-4 py-3 whitespace-nowrap text-right">Discount</th>}
                {visibleColumns.vat && <th className="px-4 py-3 whitespace-nowrap text-right">VAT <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.length > 0 ? pageRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  {visibleColumns.date && <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDateBySettings(row.dateMs, settings.dateFormat)}</td>}
                  {visibleColumns.referenceNo && <td className="px-4 py-3 text-slate-600 whitespace-nowrap font-mono text-[10px]">{row.referenceNo}</td>}
                  {visibleColumns.partyName && <td className="px-4 py-3 text-slate-700 font-bold whitespace-nowrap">{row.partyName}</td>}
                  {visibleColumns.taxNumber && <td className="px-4 py-3 text-slate-500 whitespace-nowrap font-mono text-[10px]">{row.taxNumber || '--'}</td>}
                  {visibleColumns.totalAmount && <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">{formatCurrency(row.totalAmount)}</td>}
                  {visibleColumns.paymentMethod && <td className="px-4 py-3 text-center text-slate-600 whitespace-nowrap">{row.paymentMethod || '--'}</td>}
                  {visibleColumns.discount && <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{formatCurrency(row.discountAmount)}</td>}
                  {visibleColumns.vat && <td className="px-4 py-3 text-right text-emerald-700 font-bold whitespace-nowrap">{formatCurrency(row.vat)}</td>}
                </tr>
              )) : (
                <tr><td colSpan={visibleColumnCount} className="px-4 py-12 text-center text-slate-400 italic">No records match your filters.</td></tr>
              )}
            </tbody>
            {filteredData.length > 0 && (
              <tfoot className="bg-slate-200 font-bold text-slate-800 text-xs border-t border-slate-300">
                <tr>
                  <td colSpan={visibleColumnCount} className="px-4 py-3 text-right uppercase">
                    Total Amount: {formatCurrency(filteredTotalAmount)} | VAT: {formatCurrency(filteredTotalVat)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <div>Showing {filteredData.length === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + entriesPerPage, filteredData.length)} of {filteredData.length} records</div>
          <div className="flex gap-1">
            <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={safeCurrentPage <= 1}>Previous</button>
            {pageItems.map((item, index) => item === '...' ? <span key={`ellipsis-${index}`} className="px-2 py-1 text-slate-400">...</span> : <button key={`page-${item}`} className={`px-3 py-1 border rounded ${safeCurrentPage === item ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 hover:bg-slate-50'}`} onClick={() => setCurrentPage(item)}>{item}</button>)}
            <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={safeCurrentPage >= totalPages}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportTax;
