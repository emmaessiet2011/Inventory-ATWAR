import React, { useEffect, useMemo, useState } from 'react';
import {
  Filter, FileText, FileSpreadsheet, Printer,
  Search, ArrowUpDown, Users} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import { useGlobalContext } from '../src/context/GlobalContext';

import MultiSelect from './MultiSelect';

import { printActiveReportTable } from '../src/utils/printUtils';
import { buildPaginationItems } from '../src/utils/pagination';
import { parseExpenseDateToMs } from '../src/utils/expenses';

interface ReportRow {
  id: string;
  contact: string;
  location: string;
  locations: string[];
  totalPurchase: number;
  totalPurchaseReturn: number;
  totalSale: number;
  totalSellReturn: number;
  openingBalanceDue: number;
  due: number;
  customerGroup?: string;
  type: 'Customer' | 'Supplier';
}

interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

const normalizeText = (value?: string) => String(value || '').trim().toLowerCase();
const round3 = (value: number) => Math.round(value * 1000) / 1000;
const saleDueAmount = (sale: { paymentStatus?: string; sellDue?: number; grandTotal?: number; totalAmount?: number; totalPaid?: number }) => {
  if (sale.paymentStatus === 'Paid') return 0;
  if (typeof sale.sellDue === 'number') return Math.max(0, sale.sellDue);
  return Math.max(0, (sale.grandTotal || sale.totalAmount || 0) - (sale.totalPaid || 0));
};

const parseReportDateToMs = (value: unknown): number => {
  const raw = String(value || '').trim();
  if (!raw) return Number.NaN;
  const direct = Date.parse(raw);
  if (Number.isFinite(direct)) return direct;
  return parseExpenseDateToMs(raw);
};

const getCurrentYearRange = (): DateRangeValue => {
  const now = new Date();
  return {
    startDate: new Date(now.getFullYear(), 0, 1),
    endDate: new Date(now.getFullYear(), 11, 31),
    label: 'This Year',
  };
};

const toLocationList = (values: string[]) => Array.from(new Set(values.map(v => String(v || '').trim()).filter(Boolean)));

const toLocationLabel = (values: string[]) => {
  if (values.length === 0) return '';
  if (values.length === 1) return values[0];
  return 'Multiple';
};

const ReportSupplierCustomer: React.FC = () => {
  const { locations, customers, suppliers, sales, purchases, sellReturns, purchaseReturns, formatCurrency } = useGlobalContext();
  const [showFilters, setShowFilters] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [range, setRange] = useState<DateRangeValue>(getCurrentYearRange);
  const [filters, setFilters] = useState({
    customerGroup: [] as string[],
    type: [] as string[],
    location: [] as string[],
    contact: [] as string[],
  });

  const selectedLocationSet = useMemo(
    () => new Set(filters.location.map(value => normalizeText(value))),
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

  const customerRows = useMemo<ReportRow[]>(() => {
    return customers.map(customer => {
      const customerSales = sales.filter(sale =>
        ((sale.status || sale.saleStatus) === 'Final') &&
        (String(sale.customerId) === customer.id ||
          normalizeText(sale.customerName) === normalizeText(customer.businessName) ||
          normalizeText(sale.customerName) === normalizeText(customer.name)) &&
        isDateMatch(sale.date) &&
        isLocationMatch(sale.location)
      );
      const customerSellReturns = sellReturns.filter(record =>
        (String(record.customerId) === customer.id ||
          normalizeText(record.customerName) === normalizeText(customer.businessName) ||
          normalizeText(record.customerName) === normalizeText(customer.name)) &&
        isDateMatch(record.date) &&
        isLocationMatch(record.location)
      );
      const totalSale = round3(customerSales.reduce((sum, sale) => sum + Number(sale.grandTotal || sale.totalAmount || 0), 0));
      const totalSellReturn = round3(customerSellReturns.reduce((sum, record) => (
        sum + Number(record.total || record.subTotal || 0)
      ), 0));
      const due = round3(customerSales.reduce((sum, sale) => sum + saleDueAmount(sale), 0));
      const rowLocations = toLocationList([
        ...customerSales.map(sale => String(sale.location || '').trim()),
        ...customerSellReturns.map(record => String(record.location || '').trim()),
      ]);

      return {
        id: `customer-${customer.id}`,
        contact: customer.businessName || customer.name,
        location: toLocationLabel(rowLocations),
        locations: rowLocations,
        totalPurchase: 0,
        totalPurchaseReturn: 0,
        totalSale,
        totalSellReturn,
        openingBalanceDue: Number(customer.openingBalance || 0),
        due,
        customerGroup: customer.customerGroup || 'Ungrouped',
        type: 'Customer',
      };
    });
  }, [customers, sales, sellReturns, startMs, endMs, hasDateFilter, selectedLocationSet]);

  const supplierRows = useMemo<ReportRow[]>(() => {
    return suppliers.map(supplier => {
      const supplierPurchases = purchases.filter(purchase =>
        (purchase.supplierId === supplier.id ||
          normalizeText(purchase.supplier) === normalizeText(supplier.businessName) ||
          normalizeText(purchase.supplier) === normalizeText(supplier.name)) &&
        isDateMatch(purchase.date) &&
        isLocationMatch(purchase.location)
      );
      const supplierPurchaseReturns = purchaseReturns.filter(record =>
        (record.supplierId === supplier.id ||
          normalizeText(record.supplierName) === normalizeText(supplier.businessName) ||
          normalizeText(record.supplierName) === normalizeText(supplier.name)) &&
        isDateMatch(record.date) &&
        isLocationMatch(record.location)
      );
      const totalPurchase = round3(supplierPurchases.reduce((sum, purchase) => sum + Number(purchase.grandTotal || 0), 0));
      const totalPurchaseReturn = round3(supplierPurchaseReturns.reduce((sum, record) => (
        sum + Number(record.grandTotal || 0)
      ), 0));
      const due = round3(supplierPurchases.reduce((sum, purchase) => {
        const value = Number(purchase.paymentDue || 0);
        return sum + (Number.isFinite(value) ? Math.max(0, value) : 0);
      }, 0));
      const rowLocations = toLocationList([
        ...supplierPurchases.map(purchase => String(purchase.location || '').trim()),
        ...supplierPurchaseReturns.map(record => String(record.location || '').trim()),
      ]);

      return {
        id: `supplier-${supplier.id}`,
        contact: supplier.businessName || supplier.name,
        location: toLocationLabel(rowLocations),
        locations: rowLocations,
        totalPurchase,
        totalPurchaseReturn,
        totalSale: 0,
        totalSellReturn: 0,
        openingBalanceDue: Number(supplier.openingBalance || 0),
        due,
        customerGroup: '',
        type: 'Supplier',
      };
    });
  }, [suppliers, purchases, purchaseReturns, startMs, endMs, hasDateFilter, selectedLocationSet]);

  const reportData = useMemo(() => [...customerRows, ...supplierRows], [customerRows, supplierRows]);

  const filteredData = useMemo(() => {
    const selectedLocations = filters.location.map(value => normalizeText(value));
    return reportData.filter(row => {
      const hasActivity = row.totalPurchase > 0 || row.totalPurchaseReturn > 0 || row.totalSale > 0 || row.totalSellReturn > 0;
      const rowLocationKeys = row.locations.map(value => normalizeText(value));
      return (
        row.contact.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (filters.customerGroup.length === 0 || (row.customerGroup && filters.customerGroup.includes(row.customerGroup))) &&
        (filters.type.length === 0 || filters.type.includes(row.type)) &&
        (filters.location.length === 0 || rowLocationKeys.some(value => selectedLocations.includes(value))) &&
        (filters.contact.length === 0 || filters.contact.includes(row.contact)) &&
        (!hasDateFilter || hasActivity)
      );
    });
  }, [reportData, searchTerm, filters, hasDateFilter]);

  const totals = useMemo(() => {
    return filteredData.reduce((acc, row) => ({
      totalPurchase: acc.totalPurchase + row.totalPurchase,
      totalPurchaseReturn: acc.totalPurchaseReturn + row.totalPurchaseReturn,
      totalSale: acc.totalSale + row.totalSale,
      totalSellReturn: acc.totalSellReturn + row.totalSellReturn,
      openingBalanceDue: acc.openingBalanceDue + row.openingBalanceDue,
      due: acc.due + row.due,
    }), {
      totalPurchase: 0,
      totalPurchaseReturn: 0,
      totalSale: 0,
      totalSellReturn: 0,
      openingBalanceDue: 0,
      due: 0,
    });
  }, [filteredData]);
  const totalPages = Math.max(1, Math.ceil(filteredData.length / entriesPerPage));
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const pageStart = (safeCurrentPage - 1) * entriesPerPage;
  const pageData = filteredData.slice(pageStart, pageStart + entriesPerPage);
  const pageItems = buildPaginationItems(safeCurrentPage, totalPages);
  const showingFrom = filteredData.length === 0 ? 0 : pageStart + 1;
  const showingTo = Math.min(pageStart + pageData.length, filteredData.length);

  const customerGroupOptions = Array.from(new Set(
    customerRows.map(row => row.customerGroup).filter(Boolean) as string[]
  ));
  const typeOptions = ['Customer', 'Supplier'];
  const locationOptions = Array.from(new Set([
    ...locations.map(loc => loc.name),
    ...reportData.flatMap(row => row.locations),
  ])).sort((a, b) => a.localeCompare(b));
  const contactOptions = Array.from(new Set(reportData.map(row => row.contact).filter(Boolean)));

  const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const exportToCSV = () => {
    const header = [
      'Contact', 'Type', 'Group', 'Location', 'Total Purchase', 'Total Purchase Return',
      'Total Sale', 'Total Sell Return', 'Opening Balance Due', 'Due',
    ].join(',');

    const rows = filteredData.map(row => [
      csvEscape(row.contact),
      csvEscape(row.type),
      csvEscape(row.customerGroup || ''),
      csvEscape(row.location || ''),
      row.totalPurchase.toFixed(3),
      row.totalPurchaseReturn.toFixed(3),
      row.totalSale.toFixed(3),
      row.totalSellReturn.toFixed(3),
      row.openingBalanceDue.toFixed(3),
      row.due.toFixed(3),
    ].join(','));

    const blob = new Blob([`${header}\n${rows.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customers_suppliers_report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToExcel = () => {
    const header = [
      'Contact', 'Type', 'Group', 'Location', 'Total Purchase', 'Total Purchase Return',
      'Total Sale', 'Total Sell Return', 'Opening Balance Due', 'Due',
    ];
    const rows = filteredData.map(row => [
      row.contact,
      row.type,
      row.customerGroup || '',
      row.location || '',
      row.totalPurchase.toFixed(3),
      row.totalPurchaseReturn.toFixed(3),
      row.totalSale.toFixed(3),
      row.totalSellReturn.toFixed(3),
      row.openingBalanceDue.toFixed(3),
      row.due.toFixed(3),
    ].join('\t'));

    const content = '\uFEFF' + [header.join('\t'), ...rows].join('\n');
    const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customers_suppliers_report.xls';
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, range, entriesPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div>
        <div className="flex items-center gap-4 mb-6">
        <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
          <Users size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Customers & Suppliers Report</h1>
          <p className="text-slate-500 text-sm mt-0.5">Comparative supplier and customer balances</p>
        </div>
      </div>
      </div>

      <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
<div className="flex items-center gap-2 mb-4 text-blue-600 font-bold text-sm cursor-pointer" onClick={() => setShowFilters(v => !v)}>
          <Filter size={16} /> Filters
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <MultiSelect
              label="Customer Group Name"
              options={customerGroupOptions}
              selected={filters.customerGroup}
              onChange={(val) => setFilters({ ...filters, customerGroup: val })}
            />
            <MultiSelect
              label="Contact Type"
              options={typeOptions}
              selected={filters.type}
              onChange={(val) => setFilters({ ...filters, type: val })}
            />
            <MultiSelect
              label="Business Location"
              options={locationOptions}
              selected={filters.location}
              onChange={(val) => setFilters({ ...filters, location: val })}
            />
            <MultiSelect
              label="Contact"
              options={contactOptions}
              selected={filters.contact}
              onChange={(val) => setFilters({ ...filters, contact: val })}
            />
            <DateRangeFilter onRangeSelect={(nextRange) => setRange(nextRange as DateRangeValue)} />
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 font-bold">Show</span>
            <select
              value={entriesPerPage}
              onChange={(event) => setEntriesPerPage(Number(event.target.value) || 25)}
              className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-xs text-slate-600 font-bold">entries</span>
          </div>

          <div className="flex gap-1">
            <button onClick={exportToCSV} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10} /> Export CSV</button>
            <button onClick={exportToExcel} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileSpreadsheet size={10} /> Export Excel</button>
            <button onClick={() => printActiveReportTable()} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Printer size={10} /> Print</button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search contact..."
              className="pl-9 pr-3 py-2 rounded border border-slate-300 text-xs font-medium outline-none w-56"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Contact <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Type</th>
                <th className="px-4 py-3 whitespace-nowrap">Group</th>
                <th className="px-4 py-3 whitespace-nowrap">Location</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Total Purchase</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Total Purchase Return</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Total Sale</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Total Sell Return</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Opening Balance Due</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageData.length > 0 ? (
                pageData.map((row, idx) => (
                  <tr key={row.id} className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/30 hover:bg-slate-50'}>
                    <td className="px-4 py-3 font-medium text-slate-700">{row.contact}</td>
                    <td className="px-4 py-3 text-slate-600">{row.type}</td>
                    <td className="px-4 py-3 text-slate-600">{row.customerGroup || '--'}</td>
                    <td className="px-4 py-3 text-slate-600">{row.location || '--'}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(row.totalPurchase)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(row.totalPurchaseReturn)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(row.totalSale)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(row.totalSellReturn)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(row.openingBalanceDue)}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(row.due)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400 italic">No records found</td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-100 font-bold text-slate-800 text-[10px] border-t border-slate-300 uppercase">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right">Total:</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totals.totalPurchase)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totals.totalPurchaseReturn)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totals.totalSale)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totals.totalSellReturn)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totals.openingBalanceDue)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totals.due)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 bg-slate-50/30">
          <div>Showing {showingFrom} to {showingTo} of {filteredData.length} entries</div>
          <div className="flex gap-1">
            <button
              className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </button>
            {pageItems.map((item, index) => item === '...'
              ? <span key={`page-ellipsis-${index}`} className="px-2 py-1 text-slate-400">...</span>
              : (
                <button
                  key={item}
                  className={`px-3 py-1 border rounded shadow-sm ${item === safeCurrentPage ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                  onClick={() => setCurrentPage(item)}
                >
                  {item}
                </button>
              ))}
            <button
              className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportSupplierCustomer;

