import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Filter, FileText, FileSpreadsheet, Printer,
  Columns, Search, ArrowUpDown, ChevronDown,AlertTriangle} from 'lucide-react';
import MultiSelect from '@/components/shared/MultiSelect';
import { useGlobalContext } from '@/context/GlobalContext';


import { printActiveReportTable } from '@/utils/printUtils';
import { buildPaginationItems } from '@/utils/pagination';
import { bootstrapStockLotsFromDB, readStockLotBalances, type StockLotBalance } from '@/utils/stockLots';
import { formatDateBySettings, formatDateTimeBySettings } from '@/utils/dateTime';

type StockStatus = 'Expired' | 'Expiring' | 'Good';
type ColumnKey =
  | 'product'
  | 'sku'
  | 'location'
  | 'stockLeft'
  | 'lotNumber'
  | 'expDate'
  | 'mfgDate'
  | 'status';

interface StockExpiryItem {
  id: string;
  product: string;
  sku: string;
  location: string;
  stockLeft: number;
  unit: string;
  lotNumber: string;
  expDate: string;
  mfgDate: string;
  category: string;
  subCategory: string;
  brand: string;
  status: StockStatus;
  expiryTimestamp: number;
}

const STATUS_OPTIONS: StockStatus[] = ['Expired', 'Expiring', 'Good'];
const DAY_MS = 24 * 60 * 60 * 1000;

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const toCsvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const parseInputDate = (value: string | undefined): Date | null => {
  const text = String(value || '').trim();
  if (!text) return null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const parsed = new Date(year, month, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (slashMatch) {
    const first = Number(slashMatch[1]);
    const second = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    const day = first > 12 ? first : second > 12 ? second : first;
    const month = first > 12 ? second - 1 : second > 12 ? first - 1 : second - 1;
    const parsed = new Date(year, month, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const dashMatch = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(text);
  if (dashMatch) {
    const month = Number(dashMatch[1]) - 1;
    const day = Number(dashMatch[2]);
    const year = Number(dashMatch[3]);
    const parsed = new Date(year, month, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const fallback = new Date(text);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const toDateOnlyTimestamp = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime();

const formatDate = (date: Date): string => formatDateBySettings(date);

const resolveExpiryStatus = (expiryTimestamp: number, alertDays: number, today: number): StockStatus => {
  const diffDays = Math.floor((expiryTimestamp - today) / DAY_MS);
  if (diffDays < 0) return 'Expired';
  if (diffDays <= alertDays) return 'Expiring';
  return 'Good';
};

const deriveMfgDate = (
  expiryDate: string | undefined,
  expiryPeriod: number | undefined,
  expiryPeriodUnit: 'Days' | 'Months' | undefined,
): string => {
  const parsedExpiry = parseInputDate(expiryDate);
  const period = Number(expiryPeriod || 0);
  if (!parsedExpiry || !Number.isFinite(period) || period <= 0 || !expiryPeriodUnit) return '--';

  const mfgDate = new Date(parsedExpiry);
  if (expiryPeriodUnit === 'Days') {
    mfgDate.setDate(mfgDate.getDate() - period);
  } else {
    mfgDate.setMonth(mfgDate.getMonth() - period);
  }
  return Number.isNaN(mfgDate.getTime()) ? '--' : formatDate(mfgDate);
};

const columns: Array<{ key: ColumnKey; label: string; feature?: 'lot' }> = [
  { key: 'product', label: 'Product' },
  { key: 'sku', label: 'SKU' },
  { key: 'location', label: 'Location' },
  { key: 'stockLeft', label: 'Stock Left' },
  { key: 'lotNumber', label: 'Lot Number', feature: 'lot' },
  { key: 'expDate', label: 'EXP Date' },
  { key: 'mfgDate', label: 'MFG Date' },
  { key: 'status', label: 'Status' },
];

const renderCellValue = (item: StockExpiryItem, key: ColumnKey): string => {
  if (key === 'product') return item.product;
  if (key === 'sku') return item.sku;
  if (key === 'location') return item.location;
  if (key === 'stockLeft') return `${item.stockLeft.toFixed(3)} ${item.unit}`;
  if (key === 'lotNumber') return item.lotNumber;
  if (key === 'expDate') return item.expDate;
  if (key === 'mfgDate') return item.mfgDate;
  return item.status;
};

const toStockExpiryItem = (
  opts: {
    id: string;
    productId: string;
    productName: string;
    sku: string;
    location: string;
    stockQty: number;
    unit: string;
    lotNumber: string;
    expiryDateRaw: string;
    category: string;
    subCategory: string;
    brand: string;
    expiryPeriod?: number;
    expiryPeriodUnit?: 'Days' | 'Months';
  },
  alertDays: number,
  todayTimestamp: number,
): StockExpiryItem | null => {
  const parsedExpiry = parseInputDate(opts.expiryDateRaw);
  if (!parsedExpiry) return null;
  const expiryTimestamp = toDateOnlyTimestamp(parsedExpiry);
  return {
    id: opts.id,
    product: opts.productName,
    sku: opts.sku,
    location: opts.location,
    stockLeft: Number(opts.stockQty.toFixed(3)),
    unit: opts.unit || 'Pc(s)',
    lotNumber: opts.lotNumber || '--',
    expDate: formatDate(parsedExpiry),
    mfgDate: deriveMfgDate(opts.expiryDateRaw, opts.expiryPeriod, opts.expiryPeriodUnit),
    category: opts.category,
    subCategory: opts.subCategory,
    brand: opts.brand,
    status: resolveExpiryStatus(expiryTimestamp, alertDays, todayTimestamp),
    expiryTimestamp,
  };
};

const ReportStockExpiry: React.FC = () => {
  const { products, locations, settings } = useGlobalContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [lotVersion, setLotVersion] = useState(0);
  const [entriesPerPage, setEntriesPerPage] = useState(() => {
    const parsed = Number(settings.defaultTableEntries || 25);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 25;
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    location: [] as string[],
    category: [] as string[],
    subCategory: [] as string[],
    brand: [] as string[],
    unit: [] as string[],
    viewStocks: [] as string[],
  });
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
    product: true,
    sku: true,
    location: true,
    stockLeft: true,
    lotNumber: settings.enableLotNumber || settings.enableLotNumbers,
    expDate: true,
    mfgDate: true,
    status: true,
  });
  const columnMenuRef = useRef<HTMLDivElement | null>(null);
  const lotTrackingEnabled = settings.enableLotNumber || settings.enableLotNumbers;

  useEffect(() => {
    if (!lotTrackingEnabled) {
      setVisibleColumns((prev) => ({ ...prev, lotNumber: false }));
    }
  }, [lotTrackingEnabled]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!columnMenuRef.current) return;
      if (!columnMenuRef.current.contains(event.target as Node)) {
        setShowColumnMenu(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const refreshFromDB = async () => {
      await bootstrapStockLotsFromDB().catch(() => {});
      if (isMounted) setLotVersion((prev) => prev + 1);
    };
    void refreshFromDB();
    const onFocus = () => { void refreshFromDB(); };
    const onLotsUpdated = () => { void refreshFromDB(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('app:stock-lots-updated', onLotsUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('app:stock-lots-updated', onLotsUpdated);
    };
  }, []);

  const alertDays = useMemo(() => {
    const parsed = Number(settings.stockExpiryAlertDays);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 30;
  }, [settings.stockExpiryAlertDays]);

  const reportData = useMemo<StockExpiryItem[]>(() => {
    const todayTimestamp = toDateOnlyTimestamp(new Date());
    const lotsByProduct = new Map<string, StockLotBalance[]>();
    readStockLotBalances().forEach((lot) => {
      if (!lot.productId) return;
      const next = lotsByProduct.get(lot.productId) || [];
      next.push(lot);
      lotsByProduct.set(lot.productId, next);
    });

    const rows: StockExpiryItem[] = [];

    products
      .filter((product) => (Number(product.stock) || 0) > 0)
      .forEach((product) => {
        const location = String(product.businessLocation || '').trim();
        let remainingStock = Number(product.stock) || 0;
        if (remainingStock <= 0) return;

        const lotRows = (lotsByProduct.get(product.id) || [])
          .filter((lot) => normalize(lot.location) === normalize(location) && (Number(lot.qty) || 0) > 0)
          .map((lot) => {
            const parsedExpiry = parseInputDate(lot.expiryDate);
            if (!parsedExpiry) return null;
            return {
              lot,
              expiryTimestamp: toDateOnlyTimestamp(parsedExpiry),
              qty: Number(lot.qty) || 0,
            };
          })
          .filter((lot): lot is NonNullable<typeof lot> => !!lot)
          .sort((a, b) => {
            if (a.expiryTimestamp !== b.expiryTimestamp) return b.expiryTimestamp - a.expiryTimestamp;
            return normalize(b.lot.updatedAt).localeCompare(normalize(a.lot.updatedAt));
          });

        lotRows.forEach(({ lot, qty }) => {
          if (remainingStock <= 0) return;
          const allocatedQty = Math.min(remainingStock, qty);
          if (allocatedQty <= 0) return;
          remainingStock = Number((remainingStock - allocatedQty).toFixed(3));
          const row = toStockExpiryItem({
            id: `${product.id}-${lot.id}`,
            productId: product.id,
            productName: product.name || lot.productName || '',
            sku: product.sku || lot.sku || '',
            location: location || lot.location || '',
            stockQty: allocatedQty,
            unit: product.unit || lot.unit || '',
            lotNumber: lot.lotNumber || '--',
            expiryDateRaw: lot.expiryDate || '',
            category: product.category || '',
            subCategory: product.subCategory || '',
            brand: product.brand || '',
            expiryPeriod: product.expiryPeriod,
            expiryPeriodUnit: product.expiryPeriodUnit,
          }, alertDays, todayTimestamp);
          if (row) rows.push(row);
        });

        if (remainingStock > 0) {
          const fallbackRow = toStockExpiryItem({
            id: `${product.id}-fallback`,
            productId: product.id,
            productName: product.name || '',
            sku: product.sku || '',
            location,
            stockQty: remainingStock,
            unit: product.unit || '',
            lotNumber: product.lotNumber || '--',
            expiryDateRaw: product.expiryDate || '',
            category: product.category || '',
            subCategory: product.subCategory || '',
            brand: product.brand || '',
            expiryPeriod: product.expiryPeriod,
            expiryPeriodUnit: product.expiryPeriodUnit,
          }, alertDays, todayTimestamp);
          if (fallbackRow) rows.push(fallbackRow);
        }
      });

    return rows.sort((a, b) => {
      if (a.status !== b.status) {
        const order: Record<StockStatus, number> = { Expired: 0, Expiring: 1, Good: 2 };
        return order[a.status] - order[b.status];
      }
      if (a.expiryTimestamp !== b.expiryTimestamp) {
        return a.expiryTimestamp - b.expiryTimestamp;
      }
      return normalize(a.product).localeCompare(normalize(b.product));
    });
  }, [products, alertDays, lotVersion]);

  const displayableColumns = useMemo(
    () => columns.filter((column) => column.feature !== 'lot' || lotTrackingEnabled),
    [lotTrackingEnabled],
  );
  const displayedColumns = useMemo(
    () => displayableColumns.filter((column) => visibleColumns[column.key]),
    [displayableColumns, visibleColumns],
  );

  const categoryOptions = useMemo(
    () => Array.from(new Set(reportData.map((row) => row.category).filter(Boolean))).sort(),
    [reportData],
  );
  const locationOptions = useMemo(
    () => Array.from(new Set([
      ...locations.map((loc) => String(loc.name || '').trim()),
      ...reportData.map((row) => String(row.location || '').trim()),
    ].filter(Boolean))).sort(),
    [locations, reportData],
  );
  const subCategoryOptions = useMemo(
    () => Array.from(new Set(reportData.map((row) => row.subCategory).filter(Boolean))).sort(),
    [reportData],
  );
  const brandOptions = useMemo(
    () => Array.from(new Set(reportData.map((row) => row.brand).filter(Boolean))).sort(),
    [reportData],
  );
  const unitOptions = useMemo(
    () => Array.from(new Set(reportData.map((row) => row.unit).filter(Boolean))).sort(),
    [reportData],
  );

  const filteredData = useMemo(() => {
    const query = normalize(searchTerm);
    return reportData.filter((item) => {
      if (query) {
        const hay = [
          item.product, item.sku, item.location, item.category, item.subCategory, item.brand, item.status, item.lotNumber, item.expDate,
        ].map(normalize);
        if (!hay.some((value) => value.includes(query))) return false;
      }
      if (filters.location.length > 0 && !filters.location.includes(item.location)) return false;
      if (filters.category.length > 0 && !filters.category.includes(item.category)) return false;
      if (filters.subCategory.length > 0 && !filters.subCategory.includes(item.subCategory)) return false;
      if (filters.brand.length > 0 && !filters.brand.includes(item.brand)) return false;
      if (filters.unit.length > 0 && !filters.unit.includes(item.unit)) return false;
      if (filters.viewStocks.length > 0 && !filters.viewStocks.includes(item.status)) return false;
      return true;
    });
  }, [reportData, searchTerm, filters]);

  useEffect(() => setCurrentPage(1), [searchTerm, filters, entriesPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / entriesPerPage));
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const pageStart = (currentPage - 1) * entriesPerPage;
  const pageData = filteredData.slice(pageStart, pageStart + entriesPerPage);
  const visibleColumnCount = displayedColumns.length || 1;

  const totals = useMemo(() => filteredData.reduce((acc, curr) => {
    const key = curr.unit || 'Unit';
    acc[key] = (acc[key] || 0) + (Number(curr.stockLeft) || 0);
    return acc;
  }, {} as Record<string, number>), [filteredData]);

  const exportCsv = () => {
    const exportColumns = displayedColumns.length > 0 ? displayedColumns : displayableColumns.slice(0, 1);
    const headers = exportColumns.map((column) => column.label);
    const lines = filteredData.map((item) =>
      exportColumns.map((column) => toCsvCell(renderCellValue(item, column.key))).join(','),
    );
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock-expiry-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const exportColumns = displayedColumns.length > 0 ? displayedColumns : displayableColumns.slice(0, 1);
    const headers = exportColumns.map((column) => column.label);
    const lines = filteredData.map((item) =>
      exportColumns.map((column) => renderCellValue(item, column.key)).join('\t'),
    );
    const tsv = [headers.join('\t'), ...lines].join('\n');
    const blob = new Blob([tsv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock-expiry-report.xls';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
      const margin = 30;
      const rowHeight = 16;
      let y = 40;
      const exportColumns = displayedColumns.length > 0 ? displayedColumns : displayableColumns.slice(0, 1);

      doc.setFontSize(14);
      doc.text('Stock Expiry Report', margin, y);
      y += rowHeight + 2;
      doc.setFontSize(9);
      doc.text(`Generated: ${formatDateTimeBySettings(new Date().toISOString(), settings.dateFormat, settings.timeFormat, settings.timeZone)}`, margin, y);
      y += rowHeight + 4;
      const pageWidth = doc.internal.pageSize.getWidth();
      const tableWidth = pageWidth - margin * 2;
      const colWidth = tableWidth / Math.max(1, exportColumns.length);
      const maxChars = Math.max(6, Math.floor((colWidth - 8) / 5));
      const trimValue = (value: string) => (value.length > maxChars ? `${value.slice(0, maxChars - 3)}...` : value);

      const drawHeader = () => {
        doc.setFontSize(9);
        exportColumns.forEach((column, index) => {
          const x = margin + index * colWidth;
          doc.text(trimValue(column.label), x, y);
        });
        y += rowHeight;
      };
      drawHeader();

      filteredData.forEach((item) => {
        if (y > 560) {
          doc.addPage();
          y = 36;
          drawHeader();
        }
        exportColumns.forEach((column, index) => {
          const x = margin + index * colWidth;
          doc.text(trimValue(renderCellValue(item, column.key)), x, y);
        });
        y += rowHeight;
      });

      doc.save('stock-expiry-report.pdf');
    } catch {
      printActiveReportTable();
    }
  };

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((prev) => {
      const next = !prev[key];
      const currentlyVisible = displayableColumns.filter((column) => prev[column.key]).length;
      if (!next && currentlyVisible <= 1) return prev;
      return { ...prev, [key]: next };
    });
  };

  const showingFrom = filteredData.length === 0 ? 0 : pageStart + 1;
  const showingTo = Math.min(pageStart + entriesPerPage, filteredData.length);
  const paginationItems = buildPaginationItems(currentPage, totalPages);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 mb-6">
        <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
          <AlertTriangle size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Stock Expiry Report</h1>
          <p className="text-slate-500 text-sm mt-0.5">Products approaching or past expiry date</p>
        </div>
      </div>
        {!settings.enableProductExpiry && (
          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded">
            Product expiry tracking is disabled in Settings.
          </span>
        )}
      </div>

      <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-red-500"></div>
<div className="flex items-center gap-2 mb-2 text-blue-600 font-bold text-sm cursor-pointer w-fit" onClick={() => setShowFilters(!showFilters)}>
          <Filter size={16} /> Filters
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2">
            <div className="group">
              <MultiSelect label="Business Location" options={locationOptions} selected={filters.location} onChange={(val) => setFilters({ ...filters, location: val })} />
            </div>
            <div className="group">
              <MultiSelect label="Category" options={categoryOptions} selected={filters.category} onChange={(val) => setFilters({ ...filters, category: val })} />
            </div>
            <div className="group">
              <MultiSelect label="Sub category" options={subCategoryOptions} selected={filters.subCategory} onChange={(val) => setFilters({ ...filters, subCategory: val })} />
            </div>
            <div className="group">
              <MultiSelect label="Brand" options={brandOptions} selected={filters.brand} onChange={(val) => setFilters({ ...filters, brand: val })} />
            </div>
            <div className="group">
              <MultiSelect label="Unit" options={unitOptions} selected={filters.unit} onChange={(val) => setFilters({ ...filters, unit: val })} />
            </div>
            <div className="group">
              <MultiSelect label="Stock Status" options={STATUS_OPTIONS} selected={filters.viewStocks} onChange={(val) => setFilters({ ...filters, viewStocks: val })} />
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 font-bold">Show</span>
            <select
              className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none"
              value={entriesPerPage}
              onChange={(e) => setEntriesPerPage(Number(e.target.value) || 25)}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-xs text-slate-600 font-bold">entries</span>
          </div>

          <div className="flex gap-1 relative" ref={columnMenuRef}>
            <button onClick={exportCsv} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10} /> Export CSV</button>
            <button onClick={exportExcel} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileSpreadsheet size={10} /> Export Excel</button>
            <button onClick={() => printActiveReportTable()} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Printer size={10} /> Print</button>
            <button onClick={() => setShowColumnMenu((prev) => !prev)} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Columns size={10} /> Column visibility <ChevronDown size={10} /></button>
            <button onClick={exportPdf} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10} /> Export PDF</button>
            {showColumnMenu && (
              <div className="absolute right-0 top-8 z-20 bg-white border border-slate-200 shadow-lg rounded p-2 min-w-44 text-xs space-y-1">
                {displayableColumns.map((column) => (
                  <label key={column.key} className="flex items-center gap-2">
                    <input type="checkbox" checked={visibleColumns[column.key]} onChange={() => toggleColumn(column.key)} />
                    {column.label}
                  </label>
                ))}
              </div>
            )}
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

        <div className="overflow-x-auto min-h-[500px]">
          <table className="w-full text-[11px] text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                {displayedColumns.map((column) => (
                  <th key={column.key} className={`px-4 py-3 whitespace-nowrap ${column.key === 'stockLeft' ? 'text-left' : ''}`}>
                    {column.label} <ArrowUpDown size={10} className="inline ml-1 text-slate-400" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageData.map((item, idx) => (
                <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}>
                  {displayedColumns.map((column) => {
                    if (column.key === 'product') return <td key={column.key} className="px-4 py-3 text-slate-700 font-medium">{item.product}</td>;
                    if (column.key === 'sku') return <td key={column.key} className="px-4 py-3 text-slate-500 font-mono">{item.sku}</td>;
                    if (column.key === 'location') return <td key={column.key} className="px-4 py-3 text-slate-600 text-[10px]">{item.location}</td>;
                    if (column.key === 'stockLeft') return <td key={column.key} className="px-4 py-3 text-left font-bold text-slate-800">{item.stockLeft.toFixed(3)} {item.unit}</td>;
                    if (column.key === 'lotNumber') return <td key={column.key} className="px-4 py-3 text-slate-500">{item.lotNumber}</td>;
                    if (column.key === 'expDate') return <td key={column.key} className="px-4 py-3 text-slate-600">{item.expDate}</td>;
                    if (column.key === 'mfgDate') return <td key={column.key} className="px-4 py-3 text-slate-500">{item.mfgDate}</td>;
                    return (
                      <td key={column.key} className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.status === 'Expired'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : item.status === 'Expiring'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {pageData.length === 0 && (
                <tr>
                  <td colSpan={visibleColumnCount} className="px-4 py-8 text-center text-slate-400 italic">No data available in table</td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-200 font-bold text-slate-800 text-[10px] border-t border-slate-300 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <tr>
                <td colSpan={visibleColumnCount} className="px-4 py-3">
                  Total:
                  <span className="ml-2">
                    {Object.entries(totals).map(([unit, count]) => (
                      <span key={unit} className="mr-4">{Number(count).toFixed(3)} {unit}</span>
                    ))}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <div>Showing {showingFrom} to {showingTo} of {filteredData.length} entries</div>
          <div className="flex gap-1">
            <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled={currentPage <= 1} onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}>Previous</button>
            {paginationItems.map((item, index) => item === '...'
              ? <span key={`page-ellipsis-${index}`} className="px-2 py-1 text-slate-400">...</span>
              : (
                <button
                  key={item}
                  className={`px-3 py-1 border rounded shadow-sm ${item === currentPage ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                  onClick={() => setCurrentPage(item)}
                >
                  {item}
                </button>
              ))}
            <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportStockExpiry;

