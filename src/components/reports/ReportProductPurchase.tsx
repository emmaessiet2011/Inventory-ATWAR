import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Columns,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Printer,
  Search,ShoppingCart} from 'lucide-react';
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

interface ProductPurchaseRow {
  id: string;
  product: string;
  sku: string;
  supplier: string;
  referenceNo: string;
  dateRaw: string;
  dateMs: number;
  qty: number;
  unitAdjusted: number;
  unitPrice: number;
  subtotal: number;
  location: string;
}

type ColKey =
  | 'product'
  | 'sku'
  | 'supplier'
  | 'referenceNo'
  | 'date'
  | 'qty'
  | 'unitAdjusted'
  | 'unitPrice'
  | 'subtotal';

type SortDirection = 'asc' | 'desc';

interface SortState {
  key: ColKey;
  direction: SortDirection;
}

const normalizeText = (value: unknown) => String(value ?? '').trim().toLowerCase();
const round3 = (value: number) => Math.round(value * 1000) / 1000;

const parseReportDateToMs = (value: unknown): number => {
  const raw = String(value || '').trim();
  if (!raw) return Number.NaN;
  const direct = Date.parse(raw);
  if (Number.isFinite(direct)) return direct;
  return parseExpenseDateToMs(raw);
};

const toDayStartMs = (date: Date | null): number | null => (
  date
    ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime()
    : null
);

const toDayEndMs = (date: Date | null): number | null => (
  date
    ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime()
    : null
);

const inRange = (
  ms: number,
  startMs: number | null,
  endMs: number | null,
  hasDateFilter: boolean,
): boolean => {
  if (!hasDateFilter) return true;
  if (!Number.isFinite(ms)) return false;
  if (startMs != null && ms < startMs) return false;
  if (endMs != null && ms > endMs) return false;
  return true;
};

const formatDateBySettings = (raw: string, dateFormat: string, timeFormat: string): string => {
  const ms = parseReportDateToMs(raw);
  if (!Number.isFinite(ms)) return raw || '--';
  const date = new Date(ms);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const dateOnly = dateFormat === 'mm/dd/yyyy'
    ? `${month}/${day}/${year}`
    : `${day}/${month}/${year}`;
  const hasTime = /(\d{1,2}:\d{2})|([AP]M)/i.test(raw);
  if (!hasTime) return dateOnly;
  const hours24 = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  if (timeFormat === '24') {
    return `${dateOnly} ${String(hours24).padStart(2, '0')}:${minutes}`;
  }
  const meridiem = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = String(hours24 % 12 || 12).padStart(2, '0');
  return `${dateOnly} ${hours12}:${minutes} ${meridiem}`;
};

const csvEscape = (value: unknown): string => `"${String(value ?? '').replace(/"/g, '""')}"`;

const downloadBlob = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const allTimeRange = (): DateRangeValue => ({
  startDate: null,
  endDate: null,
  label: 'All Time',
});

const getSortValue = (row: ProductPurchaseRow, sortKey: ColKey): string | number => {
  switch (sortKey) {
    case 'product': return normalizeText(row.product);
    case 'sku': return normalizeText(row.sku);
    case 'supplier': return normalizeText(row.supplier);
    case 'referenceNo': return normalizeText(row.referenceNo);
    case 'date': return Number.isFinite(row.dateMs) ? row.dateMs : Number.NEGATIVE_INFINITY;
    case 'qty': return row.qty;
    case 'unitAdjusted': return row.unitAdjusted;
    case 'unitPrice': return row.unitPrice;
    case 'subtotal': return row.subtotal;
    default: return '';
  }
};

const ReportProductPurchase: React.FC = () => {
  const {
    locations,
    purchases,
    purchaseReturns,
    products,
    settings,
    formatCurrency,
  } = useGlobalContext();

  const [showFilters, setShowFilters] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [showColumns, setShowColumns] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeValue>(allTimeRange);
  const [sortState, setSortState] = useState<SortState>({ key: 'date', direction: 'desc' });
  const [filters, setFilters] = useState({
    supplier: [] as string[],
    location: [] as string[],
  });
  const [visibleColumns, setVisibleColumns] = useState<Record<ColKey, boolean>>({
    product: true,
    sku: true,
    supplier: true,
    referenceNo: true,
    date: true,
    qty: true,
    unitAdjusted: true,
    unitPrice: true,
    subtotal: true,
  });

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      if (
        !event.target.closest('[data-product-purchase-col-menu]')
        && !event.target.closest('[data-product-purchase-col-btn]')
      ) {
        setShowColumns(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const productById = useMemo(() => {
    const map = new Map<string, (typeof products)[number]>();
    products.forEach((product) => map.set(String(product.id || ''), product));
    return map;
  }, [products]);

  const productByName = useMemo(() => {
    const map = new Map<string, (typeof products)[number]>();
    products.forEach((product) => {
      const key = normalizeText(product.name);
      if (key) map.set(key, product);
    });
    return map;
  }, [products]);

  const adjustedQtyByPurchaseProduct = useMemo(() => {
    const map = new Map<string, number>();
    const add = (mapKey: string, qty: number) => {
      const current = map.get(mapKey) || 0;
      map.set(mapKey, round3(current + qty));
    };

    purchaseReturns.forEach((purchaseReturn) => {
      const parentId = normalizeText(purchaseReturn.parentPurchaseId);
      if (!parentId) return;
      (purchaseReturn.items || []).forEach((item) => {
        const qty = Number(item.quantity || 0);
        if (!Number.isFinite(qty) || qty <= 0) return;
        const productId = normalizeText(item.productId);
        const productName = normalizeText(item.productName);
        if (productId) add(`${parentId}@@id@@${productId}`, qty);
        if (productName) add(`${parentId}@@name@@${productName}`, qty);
      });
    });

    return map;
  }, [purchaseReturns]);

  const rows = useMemo<ProductPurchaseRow[]>(() => {
    const reportRows: ProductPurchaseRow[] = [];
    const remainingAdjustedQty = new Map<string, number>(adjustedQtyByPurchaseProduct);

    purchases.forEach((purchase) => {
      const purchaseItems = purchase.items || [];
      if (purchaseItems.length === 0) return;

      const purchaseDateRaw = String(purchase.date || '').trim();
      const purchaseDateMs = parseReportDateToMs(purchaseDateRaw);
      const supplier = String(purchase.supplier || '--').trim() || '--';
      const location = String(purchase.location || '--').trim() || '--';
      const referenceNo = String(purchase.refNo || purchase.id || '--').trim() || '--';
      const purchaseIdNorm = normalizeText(purchase.id);

      purchaseItems.forEach((item, index) => {
        const qty = round3(Number(item.qty || 0));
        if (!Number.isFinite(qty) || qty <= 0) return;

        const matchedProduct = productById.get(String(item.id || ''))
          || productByName.get(normalizeText(item.name));
        const productName = String(item.name || matchedProduct?.name || 'Unknown Product').trim() || 'Unknown Product';
        const sku = String(matchedProduct?.sku || item.id || '').trim();
        const productIdNorm = normalizeText(item.id || matchedProduct?.id);
        const productNameNorm = normalizeText(item.name || matchedProduct?.name);
        const adjustedIdKey = productIdNorm ? `${purchaseIdNorm}@@id@@${productIdNorm}` : '';
        const adjustedNameKey = productNameNorm ? `${purchaseIdNorm}@@name@@${productNameNorm}` : '';
        const lookupKey = adjustedIdKey && remainingAdjustedQty.has(adjustedIdKey)
          ? adjustedIdKey
          : adjustedNameKey;
        const availableAdjustedQty = lookupKey
          ? Number(remainingAdjustedQty.get(lookupKey) || 0)
          : 0;
        const adjustedQty = round3(
          Math.max(0, Math.min(qty, Number.isFinite(availableAdjustedQty) ? availableAdjustedQty : 0)),
        );
        if (lookupKey && adjustedQty > 0) {
          remainingAdjustedQty.set(
            lookupKey,
            round3(Math.max(0, availableAdjustedQty - adjustedQty)),
          );
        }

        const unitPrice = round3(Number(item.unitCost || 0));
        const lineTotal = Number(item.lineTotal);
        const subtotal = round3(
          Number.isFinite(lineTotal)
            ? lineTotal
            : Math.max(0, qty * unitPrice),
        );

        reportRows.push({
          id: `${purchase.id}-${index}`,
          product: productName,
          sku,
          supplier,
          referenceNo,
          dateRaw: purchaseDateRaw,
          dateMs: purchaseDateMs,
          qty,
          unitAdjusted: adjustedQty,
          unitPrice,
          subtotal,
          location,
        });
      });
    });

    return reportRows.sort((left, right) => right.dateMs - left.dateMs);
  }, [purchases, productById, productByName, adjustedQtyByPurchaseProduct]);

  const supplierOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.supplier).filter(Boolean))).sort(),
    [rows],
  );

  const locationOptions = useMemo(
    () => Array.from(new Set([
      ...locations.map((location) => String(location.name || '').trim()),
      ...rows.map((row) => String(row.location || '').trim()),
    ].filter(Boolean))).sort(),
    [locations, rows],
  );

  const startMs = useMemo(() => toDayStartMs(dateRange.startDate), [dateRange.startDate]);
  const endMs = useMemo(() => toDayEndMs(dateRange.endDate), [dateRange.endDate]);
  const hasDateFilter = startMs != null || endMs != null;
  const selectedSupplierSet = useMemo(
    () => new Set(filters.supplier.map((supplier) => normalizeText(supplier))),
    [filters.supplier],
  );
  const selectedLocationSet = useMemo(
    () => new Set(filters.location.map((location) => normalizeText(location))),
    [filters.location],
  );

  const filteredRows = useMemo(() => {
    const productQuery = normalizeText(productSearch);
    const tableQuery = normalizeText(tableSearch);

    return rows.filter((row) => {
      if (!inRange(row.dateMs, startMs, endMs, hasDateFilter)) return false;
      if (selectedSupplierSet.size > 0 && !selectedSupplierSet.has(normalizeText(row.supplier))) return false;
      if (selectedLocationSet.size > 0 && !selectedLocationSet.has(normalizeText(row.location))) return false;

      if (productQuery) {
        const searchPool = [row.product, row.sku, row.referenceNo].map((value) => normalizeText(value));
        if (!searchPool.some((value) => value.includes(productQuery))) return false;
      }
      if (tableQuery) {
        const searchPool = [
          row.product,
          row.sku,
          row.supplier,
          row.referenceNo,
          row.location,
          row.dateRaw,
        ].map((value) => normalizeText(value));
        if (!searchPool.some((value) => value.includes(tableQuery))) return false;
      }
      return true;
    });
  }, [
    rows,
    productSearch,
    tableSearch,
    startMs,
    endMs,
    hasDateFilter,
    selectedSupplierSet,
    selectedLocationSet,
  ]);

  const sortedRows = useMemo(() => {
    const multiplier = sortState.direction === 'asc' ? 1 : -1;
    return [...filteredRows].sort((left, right) => {
      const leftValue = getSortValue(left, sortState.key);
      const rightValue = getSortValue(right, sortState.key);
      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return (leftValue - rightValue) * multiplier;
      }
      return String(leftValue).localeCompare(
        String(rightValue),
        undefined,
        { numeric: true, sensitivity: 'base' },
      ) * multiplier;
    });
  }, [filteredRows, sortState]);

  const totals = useMemo(() => ({
    qty: round3(sortedRows.reduce((sum, row) => sum + row.qty, 0)),
    unitAdjusted: round3(sortedRows.reduce((sum, row) => sum + row.unitAdjusted, 0)),
    subtotal: round3(sortedRows.reduce((sum, row) => sum + row.subtotal, 0)),
  }), [sortedRows]);

  useEffect(() => {
    setCurrentPage(1);
  }, [productSearch, tableSearch, filters, startMs, endMs, entriesPerPage, sortState]);

  const totalEntries = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / entriesPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * entriesPerPage;
  const pageRows = sortedRows.slice(startIndex, startIndex + entriesPerPage);
  const from = totalEntries === 0 ? 0 : startIndex + 1;
  const to = totalEntries === 0 ? 0 : startIndex + pageRows.length;

  const handleSort = (key: ColKey) => {
    setSortState((previous) => {
      if (previous.key === key) {
        return {
          key,
          direction: previous.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      const defaultDirection: SortDirection = (
        key === 'date'
        || key === 'qty'
        || key === 'unitAdjusted'
        || key === 'unitPrice'
        || key === 'subtotal'
      ) ? 'desc' : 'asc';
      return { key, direction: defaultDirection };
    });
  };

  const exportCsv = () => {
    const headers = [
      'Product',
      'SKU',
      'Supplier',
      'Reference No',
      'Date',
      'Quantity',
      'Total Unit Adjusted',
      'Unit Purchase Price',
      'Subtotal',
      'Business Location',
    ];
    const rowsCsv = sortedRows.map((row) => [
      csvEscape(row.product),
      csvEscape(row.sku),
      csvEscape(row.supplier),
      csvEscape(row.referenceNo),
      csvEscape(formatDateBySettings(row.dateRaw, settings.dateFormat, settings.timeFormat)),
      csvEscape(row.qty.toFixed(3)),
      csvEscape(row.unitAdjusted.toFixed(3)),
      csvEscape(row.unitPrice.toFixed(3)),
      csvEscape(row.subtotal.toFixed(3)),
      csvEscape(row.location),
    ].join(','));

    downloadBlob(
      `product_purchase_report_${new Date().toISOString().slice(0, 10)}.csv`,
      [headers.join(','), ...rowsCsv].join('\n'),
      'text/csv;charset=utf-8;',
    );
  };

  const exportExcel = () => {
    const headers = [
      'Product',
      'SKU',
      'Supplier',
      'Reference No',
      'Date',
      'Quantity',
      'Total Unit Adjusted',
      'Unit Purchase Price',
      'Subtotal',
      'Business Location',
    ];
    const rowsXls = sortedRows.map((row) => [
      row.product,
      row.sku,
      row.supplier,
      row.referenceNo,
      formatDateBySettings(row.dateRaw, settings.dateFormat, settings.timeFormat),
      row.qty.toFixed(3),
      row.unitAdjusted.toFixed(3),
      row.unitPrice.toFixed(3),
      row.subtotal.toFixed(3),
      row.location,
    ].join('\t'));

    downloadBlob(
      `product_purchase_report_${new Date().toISOString().slice(0, 10)}.xls`,
      [headers.join('\t'), ...rowsXls].join('\n'),
      'application/vnd.ms-excel;charset=utf-8;',
    );
  };

  const exportPdf = () => {
    try {
      const jspdf = (window as any).jspdf;
      const JsPDF = jspdf?.jsPDF;
      if (!JsPDF) {
        printActiveReportTable();
        return;
      }

      const doc = new JsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
      });

      const margin = 28;
      const rowHeight = 15;
      const maxY = 560;
      let y = 34;

      doc.setFontSize(14);
      doc.text('Product Purchase Report', margin, y);
      y += rowHeight + 4;

      doc.setFontSize(9);
      doc.text(`Date Range: ${dateRange.label || 'Selected range'}`, margin, y);
      y += rowHeight;
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
      y += rowHeight + 4;

      const x = {
        product: 28,
        sku: 155,
        supplier: 228,
        ref: 334,
        date: 430,
        qty: 520,
        adjusted: 575,
        unitPrice: 660,
        subtotal: 742,
      };

      const drawHeader = () => {
        doc.setFont('helvetica', 'bold');
        doc.text('Product', x.product, y);
        doc.text('SKU', x.sku, y);
        doc.text('Supplier', x.supplier, y);
        doc.text('Ref', x.ref, y);
        doc.text('Date', x.date, y);
        doc.text('Qty', x.qty, y);
        doc.text('Adjusted', x.adjusted, y);
        doc.text('Unit Price', x.unitPrice, y);
        doc.text('Subtotal', x.subtotal, y);
        doc.setFont('helvetica', 'normal');
        y += rowHeight;
      };

      drawHeader();

      if (sortedRows.length === 0) {
        doc.text('No data available in table', margin, y);
        y += rowHeight;
      } else {
        sortedRows.forEach((row) => {
          if (y > maxY) {
            doc.addPage();
            y = 34;
            drawHeader();
          }
          doc.text(String(row.product || '').slice(0, 24), x.product, y);
          doc.text(String(row.sku || '').slice(0, 10), x.sku, y);
          doc.text(String(row.supplier || '').slice(0, 20), x.supplier, y);
          doc.text(String(row.referenceNo || '').slice(0, 12), x.ref, y);
          doc.text(
            formatDateBySettings(row.dateRaw, settings.dateFormat, settings.timeFormat).slice(0, 18),
            x.date,
            y,
          );
          doc.text(row.qty.toFixed(3), x.qty, y);
          doc.text(row.unitAdjusted.toFixed(3), x.adjusted, y);
          doc.text(formatCurrency(row.unitPrice), x.unitPrice, y);
          doc.text(formatCurrency(row.subtotal), x.subtotal, y);
          y += rowHeight;
        });
      }

      if (y + rowHeight > maxY) {
        doc.addPage();
        y = 34;
      }
      doc.setFont('helvetica', 'bold');
      doc.text(
        `Total Qty: ${totals.qty.toFixed(3)} | Total Unit Adjusted: ${totals.unitAdjusted.toFixed(3)} | Total Subtotal: ${formatCurrency(totals.subtotal)}`,
        margin,
        y + rowHeight,
      );

      doc.save(`product_purchase_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      printActiveReportTable();
    }
  };

  const columns: Array<[ColKey, string, boolean]> = [
    ['product', 'Product', false],
    ['sku', 'SKU', false],
    ['supplier', 'Supplier', false],
    ['referenceNo', 'Reference No', false],
    ['date', 'Date', false],
    ['qty', 'Quantity', true],
    ['unitAdjusted', 'Total Unit Adjusted', true],
    ['unitPrice', 'Unit Purchase Price', true],
    ['subtotal', 'Subtotal', true],
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
          <ShoppingCart size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Product Purchase Report</h1>
          <p className="text-slate-500 text-sm mt-0.5">Purchase history per product</p>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2 animate-in slide-in-from-top-2">
            <div className="group">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Search Product:</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Enter Product name / SKU / Reference No"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs font-medium outline-none"
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                />
              </div>
            </div>
            <div className="group">
              <MultiSelect
                label="Supplier"
                options={supplierOptions}
                selected={filters.supplier}
                onChange={(value) => setFilters({ ...filters, supplier: value })}
              />
            </div>
            <div className="group">
              <MultiSelect
                label="Business Location"
                options={locationOptions}
                selected={filters.location}
                onChange={(value) => setFilters({ ...filters, location: value })}
              />
            </div>
            <div className="group">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Date Range:</label>
              <DateRangeFilter
                allowAllTime
                initialRange={dateRange}
                onRangeSelect={(range) => setDateRange(range as DateRangeValue)}
              />
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
              className="border border-slate-300 rounded px-2 py-1 text-xs outline-none"
              value={entriesPerPage}
              onChange={(event) => setEntriesPerPage(Number(event.target.value) || 25)}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-xs text-slate-600 font-bold">entries</span>
          </div>

          <div className="flex gap-1">
            <button onClick={exportCsv} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10} /> Export CSV</button>
            <button onClick={exportExcel} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileSpreadsheet size={10} /> Export Excel</button>
            <button onClick={() => printActiveReportTable()} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Printer size={10} /> Print</button>
            <div className="relative">
              <button data-product-purchase-col-btn onClick={() => setShowColumns((value) => !value)} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Columns size={10} /> Visibility</button>
              {showColumns && (
                <div data-product-purchase-col-menu className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-2 space-y-1">
                  {columns.map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer text-xs">
                      <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={visibleColumns[key]} onChange={() => setVisibleColumns((previous) => ({ ...previous, [key]: !previous[key] }))} />
                      <span className="text-slate-700 font-medium">{label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <button onClick={exportPdf} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Download size={10} /> Export PDF</button>
          </div>

          <div className="flex items-center gap-2">
            <Search className="text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search..."
              className="pl-2 py-1 border border-slate-300 rounded text-xs outline-none"
              value={tableSearch}
              onChange={(event) => setTableSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-[11px] text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                {columns.map(([key, label, right]) => visibleColumns[key] && (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className={`px-4 py-3 whitespace-nowrap cursor-pointer select-none ${right ? 'text-right' : ''}`}
                  >
                    {label}
                    <ArrowUpDown
                      size={10}
                      className={`inline ml-1 transition-transform ${sortState.key === key && sortState.direction === 'desc' ? 'rotate-180' : ''} ${sortState.key === key ? 'text-blue-600' : 'text-slate-400'}`}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  {visibleColumns.product && <td className="px-4 py-3 text-slate-700 font-medium">{row.product}</td>}
                  {visibleColumns.sku && <td className="px-4 py-3 text-slate-600">{row.sku || '--'}</td>}
                  {visibleColumns.supplier && <td className="px-4 py-3 text-slate-600">{row.supplier}</td>}
                  {visibleColumns.referenceNo && <td className="px-4 py-3 text-slate-600">{row.referenceNo}</td>}
                  {visibleColumns.date && <td className="px-4 py-3 text-slate-600">{formatDateBySettings(row.dateRaw, settings.dateFormat, settings.timeFormat)}</td>}
                  {visibleColumns.qty && <td className="px-4 py-3 text-slate-600 text-right">{row.qty.toFixed(3)}</td>}
                  {visibleColumns.unitAdjusted && <td className="px-4 py-3 text-slate-600 text-right">{row.unitAdjusted.toFixed(3)}</td>}
                  {visibleColumns.unitPrice && <td className="px-4 py-3 text-slate-600 text-right">{formatCurrency(row.unitPrice)}</td>}
                  {visibleColumns.subtotal && <td className="px-4 py-3 text-slate-800 font-bold text-right">{formatCurrency(row.subtotal)}</td>}
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={Math.max(1, columns.filter(([key]) => visibleColumns[key]).length)} className="px-4 py-8 text-center text-slate-400 italic">No data available in table</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 flex flex-col md:flex-row justify-between md:items-center gap-3 text-xs text-slate-500">
          <div>Showing {from} to {to} of {totalEntries} entries</div>
          <div className="font-bold text-slate-700">
            Total Qty: {totals.qty.toFixed(3)}
            {' | '}
            Total Unit Adjusted: {totals.unitAdjusted.toFixed(3)}
            {' | '}
            Total Subtotal: {formatCurrency(totals.subtotal)}
          </div>
          <div className="flex gap-1">
            <button type="button" onClick={() => setCurrentPage((value) => Math.max(1, value - 1))} disabled={safePage <= 1} className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
            <button className="px-2 py-1 bg-blue-600 text-white rounded shadow-sm">{safePage}</button>
            <button type="button" onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))} disabled={safePage >= totalPages} className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportProductPurchase;


