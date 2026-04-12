import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Filter, FileText, FileSpreadsheet, Printer,
  Columns, Search, ArrowUpDown, ChevronDown,Layers} from 'lucide-react';
import MultiSelect from '@/components/shared/MultiSelect';
import { useGlobalContext } from '@/context/GlobalContext';


import { printActiveReportTable } from '@/utils/printUtils';
import { buildPaginationItems } from '@/utils/pagination';
import { formatDateBySettings, formatDateTimeBySettings } from '@/utils/dateTime';
import { bootstrapStockLotsFromDB, readStockLotBalances } from '@/utils/stockLots';
import { bootstrapStockTransfersFromDB, readStockLedger } from '@/utils/stockTransfers';

interface LotReportItem {
  id: string;
  productId: string;
  sku: string;
  product: string;
  lotNumber: string;
  expDate: string;
  currentStock: number;
  unit: string;
  totalSold: number;
  totalAdjusted: number;
  location: string;
  category: string;
  subCategory: string;
  brand: string;
  isFallback: boolean;
}

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const round3 = (value: number) => Math.round(value * 1000) / 1000;
const toCsvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const productLocationKey = (productId: string, location: string) => `${normalize(productId)}@@${normalize(location)}`;

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

const ReportLot: React.FC = () => {
  const { products, sales, locations, settings } = useGlobalContext();
  const formatExpiryDate = (value: string | undefined): string => {
    const parsed = parseInputDate(value);
    if (!parsed) return '--';
    return formatDateBySettings(parsed, settings.dateFormat, settings.timeZone);
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
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
  });
  const [visibleColumns, setVisibleColumns] = useState({
    sku: true,
    product: true,
    lotNumber: true,
    expDate: true,
    currentStock: true,
    totalSold: true,
    totalAdjusted: true,
  });
  const [lotVersion, setLotVersion] = useState(0);
  const columnMenuRef = useRef<HTMLDivElement | null>(null);

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
    let cancelled = false;
    const refreshLots = async () => {
      await Promise.all([
        bootstrapStockLotsFromDB().catch(() => {}),
        bootstrapStockTransfersFromDB().catch(() => {}),
      ]);
      if (cancelled) return;
      setLotVersion((prev) => prev + 1);
    };
    void refreshLots();
    const onFocus = () => { void refreshLots(); };
    const onLotsUpdated = () => { void refreshLots(); };
    const onLedgerUpdated = () => { void refreshLots(); };
    const onTransfersUpdated = () => { void refreshLots(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('app:stock-lots-updated', onLotsUpdated);
    window.addEventListener('app:stock-ledger-updated', onLedgerUpdated);
    window.addEventListener('app:stock-transfers-updated', onTransfersUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('app:stock-lots-updated', onLotsUpdated);
      window.removeEventListener('app:stock-ledger-updated', onLedgerUpdated);
      window.removeEventListener('app:stock-transfers-updated', onTransfersUpdated);
    };
  }, []);

  const soldByProductId = useMemo(() => {
    const byId = new Map<string, number>();
    const byName = new Map<string, number>();
    sales.forEach((sale) => {
      const status = normalize(sale.status || sale.saleStatus || '');
      if (status !== 'final') return;
      (sale.items || []).forEach((item) => {
        const key = String(item.id || '').trim();
        const qty = Number(item.qty || 0);
        if (!qty) return;
        if (key) byId.set(key, (byId.get(key) || 0) + qty);
        byName.set(normalize(item.name), (byName.get(normalize(item.name)) || 0) + qty);
      });
    });
    return { byId, byName };
  }, [sales]);

  const adjustedByProductId = useMemo(() => {
    const map = new Map<string, number>();
    readStockLedger().forEach((entry) => {
      const productId = String(entry.productId || '').trim();
      if (!productId) return;
      const qty = Math.abs(Number(entry.change) || 0);
      if (!qty) return;

      const type = normalize(entry.type);
      const note = normalize(entry.note);
      const current = map.get(productId) || 0;

      if (type === 'stock adjustment') {
        if (note.startsWith('edit rollback') || note.startsWith('delete rollback')) {
          map.set(productId, round3(Math.max(0, current - qty)));
        } else {
          map.set(productId, round3(current + qty));
        }
      } else if (type === 'stock adjustment reversal') {
        map.set(productId, round3(Math.max(0, current - qty)));
      }
    });
    return map;
  }, [products]);

  const productById = useMemo(() => {
    const map = new Map<string, (typeof products)[number]>();
    products.forEach((product) => {
      const key = String(product.id || '').trim();
      if (key) map.set(key, product);
    });
    return map;
  }, [products]);

  const lotData = useMemo<LotReportItem[]>(() => {
    const stockLots = readStockLotBalances().filter((lot) => (Number(lot.qty) || 0) > 0);
    const lotQtyByProductLocation = new Map<string, number>();

    const lotRows = stockLots
      .map((lot) => {
        const qty = round3(Number(lot.qty) || 0);
        if (qty <= 0) return null;

        const productId = String(lot.productId || '').trim();
        const location = String(lot.location || '').trim();
        if (!productId || !location) return null;

        const lotKey = productLocationKey(productId, location);
        lotQtyByProductLocation.set(lotKey, round3((lotQtyByProductLocation.get(lotKey) || 0) + qty));

        const linkedProduct = productById.get(productId);
        const productName = linkedProduct?.name || lot.productName || '--';
        const soldQty = soldByProductId.byId.get(productId)
          || soldByProductId.byName.get(normalize(productName))
          || 0;

        return {
          id: `LOT-${lot.id}`,
          productId,
          sku: linkedProduct?.sku || lot.sku || '',
          product: productName,
          lotNumber: String(lot.lotNumber || '').trim() || '--',
          expDate: formatExpiryDate(lot.expiryDate),
          currentStock: qty,
          unit: linkedProduct?.unit || lot.unit || 'Pc(s)',
          totalSold: round3(soldQty),
          totalAdjusted: round3(adjustedByProductId.get(productId) || 0),
          location,
          category: linkedProduct?.category || '',
          subCategory: linkedProduct?.subCategory || '',
          brand: linkedProduct?.brand || '',
          isFallback: false,
        };
      })
      .filter((row): row is LotReportItem => !!row);

    const fallbackRows = products
      .filter((product) => (Number(product.stock) || 0) > 0)
      .map((product) => {
        const location = String(product.businessLocation || '').trim();
        if (!location) return null;
        const stockQty = round3(Number(product.stock) || 0);
        if (stockQty <= 0) return null;

        const lotQty = round3(lotQtyByProductLocation.get(productLocationKey(product.id, location)) || 0);
        const remainingStock = round3(stockQty - lotQty);
        if (remainingStock <= 0.0001) return null;

        const soldQty = soldByProductId.byId.get(product.id)
          || soldByProductId.byName.get(normalize(product.name))
          || 0;

        return {
          id: `FALLBACK-${product.id}-${normalize(location)}`,
          productId: product.id,
          sku: product.sku || '',
          product: product.name || '--',
          lotNumber: String(product.lotNumber || '').trim() || '--',
          expDate: formatExpiryDate(product.expiryDate),
          currentStock: remainingStock,
          unit: product.unit || 'Pc(s)',
          totalSold: round3(soldQty),
          totalAdjusted: round3(adjustedByProductId.get(product.id) || 0),
          location,
          category: product.category || '',
          subCategory: product.subCategory || '',
          brand: product.brand || '',
          isFallback: true,
        };
      })
      .filter((row): row is LotReportItem => !!row);

    return [...lotRows, ...fallbackRows].sort((a, b) => {
      if (a.isFallback !== b.isFallback) return a.isFallback ? 1 : -1;
      const aHasLot = a.lotNumber !== '--';
      const bHasLot = b.lotNumber !== '--';
      if (aHasLot !== bHasLot) return aHasLot ? -1 : 1;
      const byProduct = normalize(a.product).localeCompare(normalize(b.product));
      if (byProduct !== 0) return byProduct;
      const byLocation = normalize(a.location).localeCompare(normalize(b.location));
      if (byLocation !== 0) return byLocation;
      return normalize(a.lotNumber).localeCompare(normalize(b.lotNumber));
    });
  }, [products, soldByProductId, adjustedByProductId, productById, lotVersion]);

  const locationOptions = useMemo(
    () => Array.from(new Set([
      ...locations.map((loc) => String(loc.name || '').trim()),
      ...lotData.map((row) => String(row.location || '').trim()),
    ].filter(Boolean))).sort(),
    [locations, lotData],
  );
  const categoryOptions = useMemo(
    () => Array.from(new Set(lotData.map((row) => row.category).filter(Boolean))).sort(),
    [lotData],
  );
  const subCategoryOptions = useMemo(
    () => Array.from(new Set(lotData.map((row) => row.subCategory).filter(Boolean))).sort(),
    [lotData],
  );
  const brandOptions = useMemo(
    () => Array.from(new Set(lotData.map((row) => row.brand).filter(Boolean))).sort(),
    [lotData],
  );
  const unitOptions = useMemo(
    () => Array.from(new Set(lotData.map((row) => row.unit).filter(Boolean))).sort(),
    [lotData],
  );

  const filteredData = useMemo(() => {
    const query = normalize(searchTerm);
    return lotData.filter((item) => {
      if (query) {
        const hay = [
          item.sku, item.product, item.lotNumber, item.expDate,
          item.location, item.category, item.subCategory, item.brand,
        ].map(normalize);
        if (!hay.some((value) => value.includes(query))) return false;
      }
      if (filters.location.length > 0 && !filters.location.includes(item.location)) return false;
      if (filters.category.length > 0 && !filters.category.includes(item.category)) return false;
      if (filters.subCategory.length > 0 && !filters.subCategory.includes(item.subCategory)) return false;
      if (filters.brand.length > 0 && !filters.brand.includes(item.brand)) return false;
      if (filters.unit.length > 0 && !filters.unit.includes(item.unit)) return false;
      return true;
    });
  }, [lotData, searchTerm, filters]);

  useEffect(() => setCurrentPage(1), [searchTerm, filters, entriesPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / entriesPerPage));
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const pageStart = (currentPage - 1) * entriesPerPage;
  const pageData = filteredData.slice(pageStart, pageStart + entriesPerPage);
  const visibleColumnCount = Object.values(visibleColumns).filter(Boolean).length || 1;

  const totalsByUnit = useMemo(() => {
    const totals: Record<string, { stock: number; sold: number; adjusted: number }> = {};
    const seenProducts = new Set<string>();

    filteredData.forEach((item) => {
      const key = item.unit || 'Unit';
      const current = totals[key] || { stock: 0, sold: 0, adjusted: 0 };
      current.stock += Number(item.currentStock) || 0;

      const seenKey = normalize(item.productId);
      if (!seenProducts.has(seenKey)) {
        current.sold += Number(item.totalSold) || 0;
        current.adjusted += Number(item.totalAdjusted) || 0;
        seenProducts.add(seenKey);
      }
      totals[key] = current;
    });

    return totals;
  }, [filteredData]);

  const exportCsv = () => {
    const headers = [
      'SKU', 'Product', 'Lot Number', 'EXP Date',
      'Current Stock', 'Product Total Unit Sold', 'Product Total Unit Adjusted',
      'Location', 'Category', 'Sub Category', 'Brand', 'Unit',
    ];
    const lines = filteredData.map((item) => [
      toCsvCell(item.sku),
      toCsvCell(item.product),
      toCsvCell(item.lotNumber),
      toCsvCell(item.expDate),
      toCsvCell(item.currentStock.toFixed(3)),
      toCsvCell(item.totalSold.toFixed(3)),
      toCsvCell(item.totalAdjusted.toFixed(3)),
      toCsvCell(item.location),
      toCsvCell(item.category),
      toCsvCell(item.subCategory),
      toCsvCell(item.brand),
      toCsvCell(item.unit),
    ].join(','));
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lot-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const headers = [
      'SKU', 'Product', 'Lot Number', 'EXP Date',
      'Current Stock', 'Product Total Unit Sold', 'Product Total Unit Adjusted',
      'Location', 'Category', 'Sub Category', 'Brand', 'Unit',
    ];
    const lines = filteredData.map((item) => [
      item.sku,
      item.product,
      item.lotNumber,
      item.expDate,
      item.currentStock.toFixed(3),
      item.totalSold.toFixed(3),
      item.totalAdjusted.toFixed(3),
      item.location,
      item.category,
      item.subCategory,
      item.brand,
      item.unit,
    ].join('\t'));
    const tsv = [headers.join('\t'), ...lines].join('\n');
    const blob = new Blob([tsv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lot-report.xls';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
      const margin = 28;
      const rowHeight = 16;
      let y = 38;

      doc.setFontSize(14);
      doc.text('Lot Report', margin, y);
      y += rowHeight + 2;
      doc.setFontSize(9);
      doc.text(`Generated: ${formatDateTimeBySettings(new Date().toISOString(), settings.dateFormat, settings.timeFormat, settings.timeZone)}`, margin, y);
      y += rowHeight + 4;

      const x = {
        sku: 28,
        product: 108,
        lot: 312,
        exp: 428,
        stock: 505,
        sold: 592,
        adjusted: 678,
      };
      const drawHeader = () => {
        doc.setFontSize(9);
        doc.text('SKU', x.sku, y);
        doc.text('Product', x.product, y);
        doc.text('Lot', x.lot, y);
        doc.text('EXP', x.exp, y);
        doc.text('Stock', x.stock, y);
        doc.text('Prod Sold', x.sold, y);
        doc.text('Prod Adj', x.adjusted, y);
        y += rowHeight;
      };
      drawHeader();

      filteredData.forEach((item) => {
        if (y > 560) {
          doc.addPage();
          y = 34;
          drawHeader();
        }
        doc.text(item.sku.slice(0, 14), x.sku, y);
        doc.text(item.product.slice(0, 30), x.product, y);
        doc.text(item.lotNumber.slice(0, 15), x.lot, y);
        doc.text(item.expDate, x.exp, y);
        doc.text(item.currentStock.toFixed(3), x.stock, y);
        doc.text(item.totalSold.toFixed(3), x.sold, y);
        doc.text(item.totalAdjusted.toFixed(3), x.adjusted, y);
        y += rowHeight;
      });

      doc.save('lot-report.pdf');
    } catch {
      printActiveReportTable();
    }
  };

  const toggleColumn = (key: keyof typeof visibleColumns) =>
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));

  const showingFrom = filteredData.length === 0 ? 0 : pageStart + 1;
  const showingTo = Math.min(pageStart + entriesPerPage, filteredData.length);
  const paginationItems = buildPaginationItems(currentPage, totalPages);
  const lotTrackingEnabled = settings.enableLotNumber || settings.enableLotNumbers;
  const totalsByUnitEntries = Object.entries(totalsByUnit) as Array<[string, { stock: number; sold: number; adjusted: number }]>;

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 mb-6">
        <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
          <Layers size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Lot Report</h1>
          <p className="text-slate-500 text-sm mt-0.5">Inventory by lot number and batch</p>
        </div>
      </div>
        {!lotTrackingEnabled && (
          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded">
            Lot number tracking is disabled in Settings.
          </span>
        )}
      </div>

      <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
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
            <button onClick={() => setShowColumnMenu((prev) => !prev)} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Columns size={10} /> Visibility <ChevronDown size={10} /></button>
            <button onClick={exportPdf} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10} /> PDF</button>
            {showColumnMenu && (
              <div className="absolute right-0 top-8 z-20 bg-white border border-slate-200 shadow-lg rounded p-2 min-w-44 text-xs space-y-1">
                <label className="flex items-center gap-2"><input type="checkbox" checked={visibleColumns.sku} onChange={() => toggleColumn('sku')} /> SKU</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={visibleColumns.product} onChange={() => toggleColumn('product')} /> Product</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={visibleColumns.lotNumber} onChange={() => toggleColumn('lotNumber')} /> Lot Number</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={visibleColumns.expDate} onChange={() => toggleColumn('expDate')} /> EXP Date</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={visibleColumns.currentStock} onChange={() => toggleColumn('currentStock')} /> Current Stock</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={visibleColumns.totalSold} onChange={() => toggleColumn('totalSold')} /> Product Total Unit Sold</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={visibleColumns.totalAdjusted} onChange={() => toggleColumn('totalAdjusted')} /> Product Total Unit Adjusted</label>
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

        <div className="overflow-x-auto min-h-[420px]">
          <table className="w-full text-[11px] text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                {visibleColumns.sku && <th className="px-4 py-3 whitespace-nowrap">SKU <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.product && <th className="px-4 py-3 whitespace-nowrap">Product <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.lotNumber && <th className="px-4 py-3 whitespace-nowrap">Lot Number <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.expDate && <th className="px-4 py-3 whitespace-nowrap">EXP Date <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.currentStock && <th className="px-4 py-3 whitespace-nowrap text-right">Current Stock <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.totalSold && <th className="px-4 py-3 whitespace-nowrap text-right">Product Total Unit Sold <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.totalAdjusted && <th className="px-4 py-3 whitespace-nowrap text-right">Product Total Unit Adjusted <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageData.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  {visibleColumns.sku && <td className="px-4 py-3 text-slate-600 font-mono">{item.sku}</td>}
                  {visibleColumns.product && <td className="px-4 py-3 text-slate-700 font-medium">{item.product}</td>}
                  {visibleColumns.lotNumber && <td className="px-4 py-3 text-slate-600">{item.lotNumber}</td>}
                  {visibleColumns.expDate && <td className="px-4 py-3 text-slate-500">{item.expDate}</td>}
                  {visibleColumns.currentStock && <td className="px-4 py-3 text-right text-slate-700 font-bold">{item.currentStock.toFixed(3)} {item.unit}</td>}
                  {visibleColumns.totalSold && <td className="px-4 py-3 text-right text-slate-600">{item.totalSold.toFixed(3)}</td>}
                  {visibleColumns.totalAdjusted && <td className="px-4 py-3 text-right text-slate-600">{item.totalAdjusted.toFixed(3)}</td>}
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
                  {totalsByUnitEntries.map(([unit, totals]) => (
                    <div key={unit}>
                      {totals.stock.toFixed(3)} {unit} stock | {totals.sold.toFixed(3)} {unit} sold | {totals.adjusted.toFixed(3)} {unit} adjusted
                    </div>
                  ))}
                  {Object.keys(totalsByUnit).length === 0 && 'Total: --'}
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

export default ReportLot;

