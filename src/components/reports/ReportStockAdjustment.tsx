import React, { useEffect, useMemo, useState } from 'react';
import {
  Filter, FileText, FileSpreadsheet, Printer,
  Columns, Search, ArrowUpDown, Eye, X,SlidersHorizontal} from 'lucide-react';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import { useGlobalContext } from '@/context/GlobalContext';

import MultiSelect from '@/components/shared/MultiSelect';

import { printActiveReportTable } from '@/utils/printUtils';
import {
  bootstrapStockAdjustmentsFromDB,
  getStockAdjustmentStorageKey,
  readStockAdjustments,
  StockAdjustmentRecord,
} from '@/utils/stockAdjustments';

interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

interface ReportStockAdjustmentProps {
  restrictToAddedById?: string;
  restrictToAddedByName?: string;
}

type ColumnKey =
  | 'date'
  | 'referenceNo'
  | 'location'
  | 'adjustmentType'
  | 'totalAmount'
  | 'totalRecovered'
  | 'reason'
  | 'addedBy';

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const isAdjustmentOwnerMatch = (
  adjustment: StockAdjustmentRecord,
  ownerIdFilter: string,
  ownerNameFilter: string,
) => {
  if (!ownerIdFilter && !ownerNameFilter) return true;
  const adjustmentOwnerId = normalize(adjustment.addedById);
  const adjustmentOwnerName = normalize(adjustment.addedBy);
  if (ownerIdFilter && adjustmentOwnerId) return adjustmentOwnerId === ownerIdFilter;
  if (ownerIdFilter && ownerNameFilter) return adjustmentOwnerName === ownerNameFilter;
  if (ownerNameFilter) return adjustmentOwnerName === ownerNameFilter;
  return false;
};
const getAllTimeRange = (): DateRangeValue => ({
  startDate: null,
  endDate: null,
  label: 'All Time',
});

const ReportStockAdjustment: React.FC<ReportStockAdjustmentProps> = ({
  restrictToAddedById = '',
  restrictToAddedByName = '',
}) => {
  const { locations, settings, formatCurrency } = useGlobalContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [range, setRange] = useState<DateRangeValue>(getAllTimeRange);
  const [adjustments, setAdjustments] = useState<StockAdjustmentRecord[]>(() => readStockAdjustments());
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [entriesPerPage, setEntriesPerPage] = useState(() => {
    const parsed = Number(settings.defaultTableEntries || 25);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 25;
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
    date: true,
    referenceNo: true,
    location: true,
    adjustmentType: true,
    totalAmount: true,
    totalRecovered: true,
    reason: true,
    addedBy: true,
  });
  const [filters, setFilters] = useState({
    location: [] as string[],
    adjustmentType: [] as string[],
    user: [] as string[],
  });
  const [viewId, setViewId] = useState<string | null>(null);
  const ownerIdFilter = normalize(restrictToAddedById);
  const ownerNameFilter = normalize(restrictToAddedByName);

  useEffect(() => {
    const storageKey = getStockAdjustmentStorageKey();
    const refresh = () => setAdjustments(readStockAdjustments());
    let isMounted = true;
    const bootstrap = async () => {
      await bootstrapStockAdjustmentsFromDB().catch(() => {});
      if (isMounted) refresh();
    };
    bootstrap();
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === storageKey) refresh();
    };
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      const withinColumnMenu = event.target.closest('[data-stock-adjustment-report-column-menu]');
      const withinColumnButton = event.target.closest('[data-stock-adjustment-report-column-button]');
      if (!withinColumnMenu && !withinColumnButton) {
        setShowColumnMenu(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setShowColumnMenu(false);
      setViewId(null);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const filteredData = useMemo(() => {
    const query = normalize(searchTerm);
    const startMs = range.startDate ? new Date(range.startDate.getFullYear(), range.startDate.getMonth(), range.startDate.getDate(), 0, 0, 0, 0).getTime() : null;
    const endMs = range.endDate ? new Date(range.endDate.getFullYear(), range.endDate.getMonth(), range.endDate.getDate(), 23, 59, 59, 999).getTime() : null;
    return adjustments
      .filter((item) => {
        if (!isAdjustmentOwnerMatch(item, ownerIdFilter, ownerNameFilter)) return false;
        if (query) {
          const itemNames = (item.items || []).map((row) => row.productName).join(' ');
          const itemSkus = (item.items || []).map((row) => row.sku).join(' ');
          const hay = [
            item.referenceNo,
            item.reason,
            item.location,
            item.addedBy,
            item.adjustmentType,
            itemNames,
            itemSkus,
          ].map(normalize);
          if (!hay.some((v) => v.includes(query))) return false;
        }
        if (filters.location.length > 0 && !filters.location.includes(item.location)) return false;
        if (filters.adjustmentType.length > 0 && !filters.adjustmentType.includes(item.adjustmentType)) return false;
        if (filters.user.length > 0 && !filters.user.includes(item.addedBy)) return false;
        if (startMs != null || endMs != null) {
          const rowMs = Date.parse(item.date);
          if (!Number.isFinite(rowMs)) return false;
          if (startMs != null && rowMs < startMs) return false;
          if (endMs != null && rowMs > endMs) return false;
        }
        return true;
      })
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }, [adjustments, searchTerm, filters, range, ownerIdFilter, ownerNameFilter]);

  const filteredForUserOptions = useMemo(
    () => adjustments.filter((item) => isAdjustmentOwnerMatch(item, ownerIdFilter, ownerNameFilter)),
    [adjustments, ownerIdFilter, ownerNameFilter],
  );

  const locationOptions = useMemo(
    () => Array.from(new Set([
      ...locations.map((loc) => String(loc.name || '').trim()),
      ...filteredForUserOptions.map((item) => String(item.location || '').trim()),
    ].filter(Boolean))).sort(),
    [locations, filteredForUserOptions],
  );

  const userOptions = useMemo(
    () => Array.from(new Set(filteredForUserOptions.map((item) => item.addedBy).filter(Boolean))).sort(),
    [filteredForUserOptions],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, range, entriesPerPage, ownerIdFilter, ownerNameFilter]);

  const totalEntries = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / entriesPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * entriesPerPage;
  const paginatedData = filteredData.slice(pageStartIndex, pageStartIndex + entriesPerPage);
  const pageStartEntry = totalEntries === 0 ? 0 : pageStartIndex + 1;
  const pageEndEntry = totalEntries === 0 ? 0 : pageStartIndex + paginatedData.length;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const viewRecord = useMemo(
    () => filteredData.find((item) => item.id === viewId) || adjustments.find((item) => item.id === viewId) || null,
    [filteredData, adjustments, viewId],
  );

  const totalNormal = useMemo(
    () => filteredData.filter((row) => row.adjustmentType === 'Normal').reduce((acc, curr) => acc + Number(curr.totalAmount || 0), 0),
    [filteredData],
  );
  const totalAbnormal = useMemo(
    () => filteredData.filter((row) => row.adjustmentType === 'Abnormal').reduce((acc, curr) => acc + Number(curr.totalAmount || 0), 0),
    [filteredData],
  );
  const totalAdjustment = useMemo(() => totalNormal + totalAbnormal, [totalNormal, totalAbnormal]);
  const totalRecovered = useMemo(
    () => filteredData.reduce((acc, curr) => acc + Number(curr.totalRecovered || 0), 0),
    [filteredData],
  );

  const toggleColumn = (column: ColumnKey) => {
    setVisibleColumns((prev) => ({ ...prev, [column]: !prev[column] }));
  };

  const exportCsv = () => {
    const headers = ['Date', 'Reference No', 'Location', 'Adjustment Type', 'Total Amount', 'Recovered', 'Reason', 'Added By'];
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = filteredData.map((item) => [
      escape(item.date),
      escape(item.referenceNo),
      escape(item.location),
      escape(item.adjustmentType),
      escape(Number(item.totalAmount || 0).toFixed(3)),
      escape(Number(item.totalRecovered || 0).toFixed(3)),
      escape(item.reason || ''),
      escape(item.addedBy || ''),
    ].join(','));
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock-adjustment-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const headers = ['Date', 'Reference No', 'Location', 'Adjustment Type', 'Total Amount', 'Recovered', 'Reason', 'Added By'];
    const lines = filteredData.map((item) => [
      item.date,
      item.referenceNo,
      item.location,
      item.adjustmentType,
      Number(item.totalAmount || 0).toFixed(3),
      Number(item.totalRecovered || 0).toFixed(3),
      item.reason || '',
      item.addedBy || '',
    ].join('\t'));
    const tsv = [headers.join('\t'), ...lines].join('\n');
    const blob = new Blob([tsv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock-adjustment-report.xls';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
          <SlidersHorizontal size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Stock Adjustment Report</h1>
          <p className="text-slate-500 text-sm mt-0.5">Stock additions, deductions, and corrections</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-6 rounded-xl border border-slate-200">
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold text-slate-700 border-b border-slate-200 pb-2">
            <span>Total Normal:</span>
            <span>{formatCurrency(totalNormal)}</span>
          </div>
          <div className="flex justify-between text-xs font-bold text-slate-700 border-b border-slate-200 pb-2">
            <span>Total Abnormal:</span>
            <span>{formatCurrency(totalAbnormal)}</span>
          </div>
          <div className="flex justify-between text-xs font-bold text-slate-700 pb-2">
            <span>Total Stock Adjustment:</span>
            <span>{formatCurrency(totalAdjustment)}</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold text-slate-700 border-b border-slate-200 pb-2">
            <span>Total Amount Recovered:</span>
            <span>{formatCurrency(totalRecovered)}</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500"></div>
<div className="flex items-center gap-2 cursor-pointer text-red-600 mb-4" onClick={() => setShowFilters(!showFilters)}>
          <Filter size={16} />
          <span className="text-sm font-medium">Filters</span>
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="group">
              <MultiSelect
                label="Business Location"
                options={locationOptions}
                selected={filters.location}
                onChange={(val) => setFilters({ ...filters, location: val })}
              />
            </div>
            <div className="group">
              <MultiSelect
                label="Adjustment Type"
                options={['Normal', 'Abnormal']}
                selected={filters.adjustmentType}
                onChange={(val) => setFilters({ ...filters, adjustmentType: val })}
              />
            </div>
            <div className="group">
              <MultiSelect
                label="User"
                options={userOptions}
                selected={filters.user}
                onChange={(val) => setFilters({ ...filters, user: val })}
              />
            </div>
            <div className="group">
              <DateRangeFilter
                allowAllTime
                initialRange={getAllTimeRange()}
                onRangeSelect={(nextRange) => setRange(nextRange as DateRangeValue)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-slate-700">Stock Adjustments</h3>
            <div className="flex items-center gap-1 ml-4">
              <span className="text-xs text-slate-600 font-bold">Show</span>
              <select
                className="border border-slate-300 rounded px-2 py-1 text-xs outline-none"
                value={entriesPerPage}
                onChange={(e) => setEntriesPerPage(Number(e.target.value) || 25)}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-xs text-slate-600 font-bold">entries</span>
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={exportCsv} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10} /> Export CSV</button>
            <button onClick={exportExcel} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileSpreadsheet size={10} /> Export Excel</button>
            <button onClick={() => printActiveReportTable()} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Printer size={10} /> Print</button>
            <div className="relative">
              <button
                data-stock-adjustment-report-column-button
                onClick={() => setShowColumnMenu((prev) => !prev)}
                className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"
              >
                <Columns size={10} /> Visibility
              </button>
              {showColumnMenu && (
                <div
                  data-stock-adjustment-report-column-menu
                  className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-2 space-y-1"
                >
                  {([
                    ['date', 'Date'],
                    ['referenceNo', 'Reference No'],
                    ['location', 'Location'],
                    ['adjustmentType', 'Type'],
                    ['totalAmount', 'Total Amount'],
                    ['totalRecovered', 'Recovered'],
                    ['reason', 'Reason'],
                    ['addedBy', 'Added By'],
                  ] as Array<[ColumnKey, string]>).map(([column, label]) => (
                    <label key={column} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                        checked={visibleColumns[column]}
                        onChange={() => toggleColumn(column)}
                      />
                      <span className="text-slate-700 font-medium">{label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <input
              type="text"
              placeholder="Search..."
              className="pl-7 pr-2 py-1 border border-slate-300 rounded text-xs outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[320px]">
          <table className="w-full text-[11px] text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Action</th>
                {visibleColumns.date && <th className="px-4 py-3 whitespace-nowrap">Date <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.referenceNo && <th className="px-4 py-3 whitespace-nowrap">Reference No <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.location && <th className="px-4 py-3 whitespace-nowrap">Location <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.adjustmentType && <th className="px-4 py-3 whitespace-nowrap">Adjustment Type <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.totalAmount && <th className="px-4 py-3 whitespace-nowrap text-right">Total Amount <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.totalRecovered && <th className="px-4 py-3 whitespace-nowrap text-right">Total Recovered <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.reason && <th className="px-4 py-3 whitespace-nowrap">Reason <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.addedBy && <th className="px-4 py-3 whitespace-nowrap">Added By <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <button onClick={() => setViewId(item.id)} className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1">
                      <Eye size={12} /> View
                    </button>
                  </td>
                  {visibleColumns.date && <td className="px-4 py-3 text-slate-600">{new Date(item.date).toLocaleString()}</td>}
                  {visibleColumns.referenceNo && <td className="px-4 py-3 text-slate-600 font-medium">{item.referenceNo}</td>}
                  {visibleColumns.location && <td className="px-4 py-3 text-slate-600">{item.location}</td>}
                  {visibleColumns.adjustmentType && <td className="px-4 py-3 text-slate-600">{item.adjustmentType}</td>}
                  {visibleColumns.totalAmount && <td className="px-4 py-3 text-right text-slate-800 font-bold">{Number(item.totalAmount || 0).toFixed(3)}</td>}
                  {visibleColumns.totalRecovered && <td className="px-4 py-3 text-right text-slate-600">{Number(item.totalRecovered || 0).toFixed(3)}</td>}
                  {visibleColumns.reason && <td className="px-4 py-3 text-slate-600">{item.reason || '--'}</td>}
                  {visibleColumns.addedBy && <td className="px-4 py-3 text-slate-600">{item.addedBy}</td>}
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="px-4 py-10 text-center text-slate-400 italic">No data available in table</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <div>Showing {pageStartEntry} to {pageEndEntry} of {totalEntries} entries</div>
          <div>Date Range: <span className="font-bold text-slate-700">{range.label}</span></div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safeCurrentPage <= 1}
              className="px-2 py-1 rounded border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 hover:bg-slate-100"
            >
              Prev
            </button>
            <span className="px-2">Page {safeCurrentPage} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="px-2 py-1 rounded border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 hover:bg-slate-100"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {viewRecord && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="bg-white w-full max-w-2xl rounded-xl border border-slate-200 shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Adjustment {viewRecord.referenceNo}</h3>
              <button onClick={() => setViewId(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4 overflow-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500">Date:</span> <span className="font-bold text-slate-800">{new Date(viewRecord.date).toLocaleString()}</span></div>
                <div><span className="text-slate-500">Type:</span> <span className="font-bold text-slate-800">{viewRecord.adjustmentType}</span></div>
                <div><span className="text-slate-500">Location:</span> <span className="font-bold text-slate-800">{viewRecord.location}</span></div>
                <div><span className="text-slate-500">Added By:</span> <span className="font-bold text-slate-800">{viewRecord.addedBy}</span></div>
                <div><span className="text-slate-500">Total:</span> <span className="font-bold text-slate-800">{formatCurrency(Number(viewRecord.totalAmount || 0))}</span></div>
                <div><span className="text-slate-500">Recovered:</span> <span className="font-bold text-slate-800">{formatCurrency(Number(viewRecord.totalRecovered || 0))}</span></div>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-700 mb-2">Items</h4>
                <div className="border border-slate-200 rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-left">SKU</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewRecord.items || []).map((item, index) => (
                        <tr key={`${item.productId}-${index}`} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-2">{item.productName}</td>
                          <td className="px-3 py-2">{item.sku}</td>
                          <td className={`px-3 py-2 text-right ${Number(item.quantity || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {Number(item.quantity || 0).toFixed(3)}
                          </td>
                        </tr>
                      ))}
                      {(viewRecord.items || []).length === 0 && (
                        <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-400 italic">No items</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {viewRecord.reason && (
                <div>
                  <h4 className="text-sm font-bold text-slate-700 mb-1">Reason</h4>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{viewRecord.reason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportStockAdjustment;


