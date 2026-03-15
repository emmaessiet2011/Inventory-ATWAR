import React, { useEffect, useMemo, useState } from 'react';
import {
  Filter, FileText, FileSpreadsheet, Printer,
  Search, ArrowUpDown, UsersRound} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import { useGlobalContext } from '../src/context/GlobalContext';

import MultiSelect from './MultiSelect';

import { printActiveReportTable } from '../src/utils/printUtils';
import { buildPaginationItems } from '../src/utils/pagination';
import { parseExpenseDateToMs } from '../src/utils/expenses';

interface GroupReportRow {
  groupName: string;
  totalSale: number;
  invoices: number;
  members: number;
}

interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

const normalizeText = (value?: string) => String(value || '').trim().toLowerCase();
const round3 = (value: number) => Math.round(value * 1000) / 1000;
const hasStatus = (value: unknown, expected: string) => normalizeText(String(value || '')) === normalizeText(expected);

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
  const dmy12h = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,\s*|\s+)?(?:(\d{1,2}):(\d{2})(?:\s*([AP]M))?)?$/i,
  );
  if (dmy12h) {
    const day = Number(dmy12h[1]);
    const month = Number(dmy12h[2]);
    const year = Number(dmy12h[3]);
    const minute = Number(dmy12h[5] || 0);
    let hour = Number(dmy12h[4] || 0);
    const meridiem = normalizeText(dmy12h[6]);
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    const parsed = new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  const direct = Date.parse(raw);
  if (Number.isFinite(direct)) return direct;
  return parseExpenseDateToMs(raw);
};

const ReportCustomerGroups: React.FC = () => {
  const { locations, customerGroups, customers, sales, formatCurrency } = useGlobalContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(true);
  const [range, setRange] = useState<DateRangeValue>(getCurrentYearRange);
  const [filters, setFilters] = useState({
    location: [] as string[],
    customerGroup: [] as string[],
  });

  const selectedLocationSet = useMemo(
    () => new Set(filters.location.map(value => normalizeText(value))),
    [filters.location]
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

  const isLocationMatch = (value?: string) => (
    selectedLocationSet.size === 0 || selectedLocationSet.has(normalizeText(value))
  );

  const customerById = useMemo(() => {
    const map = new Map<string, (typeof customers)[number]>();
    customers.forEach(c => map.set(c.id, c));
    return map;
  }, [customers]);

  const customerByName = useMemo(() => {
    const map = new Map<string, (typeof customers)[number]>();
    customers.forEach(c => {
      const businessNameKey = normalizeText(c.businessName);
      const nameKey = normalizeText(c.name);
      if (businessNameKey) map.set(businessNameKey, c);
      if (nameKey && !map.has(nameKey)) map.set(nameKey, c);
    });
    return map;
  }, [customers]);

  const customerGroupById = useMemo(() => {
    const map = new Map<string, (typeof customerGroups)[number]>();
    customerGroups.forEach(g => map.set(g.id, g));
    return map;
  }, [customerGroups]);

  const memberCountByGroupName = useMemo(() => {
    const counts = new Map<string, number>();
    customers.forEach(customer => {
      const normalizedGroup = customer.customerGroupId
        ? customerGroupById.get(customer.customerGroupId)?.name || ''
        : String(customer.customerGroup || '').trim();
      const groupName = normalizedGroup || 'Ungrouped';
      counts.set(groupName, (counts.get(groupName) || 0) + 1);
    });
    return counts;
  }, [customers, customerGroupById]);

  const resolveCustomerGroupName = (sale: (typeof sales)[number]): string => {
    const saleSnapshotGroupName = String(sale.customerGroup || '').trim();
    if (saleSnapshotGroupName) {
      return saleSnapshotGroupName;
    }

    const saleSnapshotGroupId = String(sale.customerGroupId || '').trim();
    if (saleSnapshotGroupId) {
      const bySaleSnapshotId = customerGroupById.get(saleSnapshotGroupId);
      if (bySaleSnapshotId) return bySaleSnapshotId.name;
    }

    const directCustomer = customerById.get(String(sale.customerId || ''));
    const namedCustomer = directCustomer || customerByName.get(normalizeText(sale.customerName));
    if (!namedCustomer) return 'Ungrouped';

    const byId = namedCustomer.customerGroupId
      ? customerGroupById.get(namedCustomer.customerGroupId)
      : undefined;
    if (byId) return byId.name;

    if (namedCustomer.customerGroup) {
      return namedCustomer.customerGroup;
    }
    return 'Ungrouped';
  };

  const rows = useMemo<GroupReportRow[]>(() => {
    const map = new Map<string, GroupReportRow>();

    sales.forEach(sale => {
      const isFinal = hasStatus(sale.status || sale.saleStatus, 'Final');
      if (!isFinal) return;

      if (!isDateMatch(sale.date)) return;
      if (!isLocationMatch(sale.location)) return;

      const groupName = resolveCustomerGroupName(sale);
      if (filters.customerGroup.length > 0 && !filters.customerGroup.includes(groupName)) return;

      const existing = map.get(groupName) || {
        groupName,
        totalSale: 0,
        invoices: 0,
        members: memberCountByGroupName.get(groupName) || 0,
      };

      existing.totalSale += Number(sale.grandTotal || sale.totalAmount || 0);
      existing.invoices += 1;
      map.set(groupName, existing);
    });

    return Array.from(map.values())
      .filter(row => row.groupName.toLowerCase().includes(searchTerm.toLowerCase()))
      .map(row => ({ ...row, totalSale: round3(row.totalSale) }))
      .sort((a, b) => b.totalSale - a.totalSale);
  }, [
    sales,
    filters.customerGroup,
    searchTerm,
    customerById,
    customerByName,
    memberCountByGroupName,
    startMs,
    endMs,
    hasDateFilter,
    selectedLocationSet
  ]);

  const totalAmount = rows.reduce((acc, row) => acc + row.totalSale, 0);
  const totalPages = Math.max(1, Math.ceil(rows.length / entriesPerPage));
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const pageStart = (safeCurrentPage - 1) * entriesPerPage;
  const pageRows = rows.slice(pageStart, pageStart + entriesPerPage);
  const pageItems = buildPaginationItems(safeCurrentPage, totalPages);
  const showingFrom = rows.length === 0 ? 0 : pageStart + 1;
  const showingTo = Math.min(pageStart + pageRows.length, rows.length);
  const groupFilterOptions = Array.from(new Set([
    ...customerGroups.map(g => g.name),
    ...rows.map(r => r.groupName),
  ]));
  const locationOptions = Array.from(new Set([
    ...locations.map(loc => loc.name),
    ...sales.map(s => s.location || '').filter(Boolean),
  ])).sort((a, b) => a.localeCompare(b));

  const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const exportToCSV = () => {
    const header = ['Customer Group', 'Members', 'Invoices', 'Total Sale'].join(',');
    const body = rows.map(row => [
      csvEscape(row.groupName),
      row.members,
      row.invoices,
      row.totalSale.toFixed(3),
    ].join(','));
    const blob = new Blob([`${header}\n${body.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer_groups_report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToExcel = () => {
    const header = ['Customer Group', 'Members', 'Invoices', 'Total Sale'];
    const body = rows.map(row => [
      row.groupName,
      row.members,
      row.invoices,
      row.totalSale.toFixed(3),
    ].join('\t'));
    const content = '\uFEFF' + [header.join('\t'), ...body].join('\n');
    const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer_groups_report.xls';
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
          <UsersRound size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Customer Groups Report</h1>
          <p className="text-slate-500 text-sm mt-0.5">Sales and balance by customer group</p>
        </div>
      </div>
      </div>

      <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
<div
          className="flex items-center gap-2 mb-2 text-blue-600 font-bold text-sm cursor-pointer w-fit"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={16} /> Filters
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 animate-in slide-in-from-top-2">
            <MultiSelect
              label="Business Location"
              options={locationOptions}
              selected={filters.location}
              onChange={(val) => setFilters({ ...filters, location: val })}
            />
            <MultiSelect
              label="Customer Group"
              options={groupFilterOptions}
              selected={filters.customerGroup}
              onChange={(val) => setFilters({ ...filters, customerGroup: val })}
            />
            <DateRangeFilter onRangeSelect={(nextRange) => setRange(nextRange as DateRangeValue)} />
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
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

          <div className="flex items-center gap-2 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search..."
              className="pl-8 pr-3 py-1.5 rounded border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Customer Group <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap text-center">Members</th>
                <th className="px-4 py-3 whitespace-nowrap text-center">Invoices</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Total Sale <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.length > 0 ? (
                pageRows.map((row, idx) => (
                  <tr key={row.groupName} className={`hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                    <td className="px-4 py-3 text-slate-700 font-medium">{row.groupName}</td>
                    <td className="px-4 py-3 text-center text-slate-700">{row.members}</td>
                    <td className="px-4 py-3 text-center text-slate-700">{row.invoices}</td>
                    <td className="px-4 py-3 text-right text-slate-800 font-bold whitespace-nowrap">{formatCurrency(row.totalSale)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-slate-400 italic">No records found</td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-100 font-bold text-slate-800 text-[10px] border-t border-slate-300 uppercase">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right">Total:</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 bg-slate-50/30">
          <div>Showing {showingFrom} to {showingTo} of {rows.length} entries</div>
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

export default ReportCustomerGroups;

