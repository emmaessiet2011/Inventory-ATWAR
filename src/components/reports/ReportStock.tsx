import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Columns,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Printer,
  Search,Warehouse} from 'lucide-react';
import MultiSelect from '@/components/shared/MultiSelect';
import { Product, useGlobalContext } from '@/context/GlobalContext';

import ProductStockHistory from '@/components/products/ProductStockHistory';

import { printActiveReportTable } from '@/utils/printUtils';
import { bootstrapStockTransfersFromDB, readStockLedger } from '@/utils/stockTransfers';
import {
  fetchLocationInventoryFromDB,
  LOCATION_INVENTORY_UPDATED_EVENT,
  ProductLocationInventory,
} from '@/utils/stockLocationInventory';
import { getContainerSize, getStockDisplay, isFractionalProduct } from '@/utils/fractionalProducts';

interface StockReportItem {
  id: string;
  productId: string;
  sku: string;
  product: string;
  variation: string;
  category: string;
  subCategory: string;
  location: string;
  unitSellingPrice: number;
  currentStock: number;
  stockValuePurchase: number;
  stockValueSale: number;
  potentialProfit: number;
  totalUnitSold: number;
  totalUnitTransferred: number;
  totalUnitAdjusted: number;
  brand: string;
  unit: string;
  stockDisplay: string;
}

interface ReportStockProps {
  canViewValueMetrics?: boolean;
  onNavigate?: (page: string) => void;
}

type ColumnKey =
  | 'sku'
  | 'product'
  | 'variation'
  | 'category'
  | 'location'
  | 'unitSellingPrice'
  | 'currentStock'
  | 'stockValuePurchase'
  | 'stockValueSale'
  | 'potentialProfit'
  | 'totalUnitSold'
  | 'totalUnitTransferred'
  | 'totalUnitAdjusted';

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const hasStatus = (value: unknown, expected: string) => normalize(value) === normalize(expected);
const stockKey = (left: unknown, right: unknown) => `${normalize(left)}@@${normalize(right)}`;
const toCsvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const formatQty = (value: number, unit?: string) => `${value.toFixed(3)}${unit ? ` ${unit}` : ''}`;
const buildPageItems = (currentPage: number, totalPages: number): Array<number | '...'> => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const items: Array<number | '...'> = [1];
  const left = Math.max(2, currentPage - 1);
  const right = Math.min(totalPages - 1, currentPage + 1);
  if (left > 2) items.push('...');
  for (let page = left; page <= right; page += 1) {
    items.push(page);
  }
  if (right < totalPages - 1) items.push('...');
  items.push(totalPages);
  return items;
};

const ReportStock: React.FC<ReportStockProps> = ({ canViewValueMetrics = true, onNavigate }) => {
  const { products, locations, sales, formatCurrency } = useGlobalContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  const [ledgerVersion, setLedgerVersion] = useState(0);
  const [locationInventory, setLocationInventory] = useState<ProductLocationInventory[]>([]);
  const [filters, setFilters] = useState({
    location: [] as string[],
    category: [] as string[],
    subCategory: [] as string[],
    brand: [] as string[],
    unit: [] as string[],
  });

  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
    sku: true,
    product: true,
    variation: true,
    category: true,
    location: true,
    unitSellingPrice: canViewValueMetrics,
    currentStock: true,
    stockValuePurchase: canViewValueMetrics,
    stockValueSale: canViewValueMetrics,
    potentialProfit: canViewValueMetrics,
    totalUnitSold: true,
    totalUnitTransferred: true,
    totalUnitAdjusted: true,
  });

  useEffect(() => {
    setVisibleColumns((prev) => ({
      ...prev,
      unitSellingPrice: canViewValueMetrics ? prev.unitSellingPrice : false,
      stockValuePurchase: canViewValueMetrics ? prev.stockValuePurchase : false,
      stockValueSale: canViewValueMetrics ? prev.stockValueSale : false,
      potentialProfit: canViewValueMetrics ? prev.potentialProfit : false,
    }));
  }, [canViewValueMetrics]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      const withinMenu = event.target.closest('[data-stock-col-menu]');
      const withinButton = event.target.closest('[data-stock-col-button]');
      if (!withinMenu && !withinButton) setShowColumnMenu(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowColumnMenu(false);
        setHistoryProductId(null);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refreshLedger = async () => {
      const [inventoryRows] = await Promise.all([
        fetchLocationInventoryFromDB().catch(() => [] as ProductLocationInventory[]),
        bootstrapStockTransfersFromDB().catch(() => {}),
      ]);
      if (cancelled) return;
      setLocationInventory(inventoryRows);
      setLedgerVersion((prev) => prev + 1);
    };
    void refreshLedger();
    const onFocus = () => { void refreshLedger(); };
    const onTransfersUpdated = () => { void refreshLedger(); };
    const onLedgerUpdated = () => { void refreshLedger(); };
    const onInventoryUpdated = () => { void refreshLedger(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('app:stock-transfers-updated', onTransfersUpdated);
    window.addEventListener('app:stock-ledger-updated', onLedgerUpdated);
    window.addEventListener(LOCATION_INVENTORY_UPDATED_EVENT, onInventoryUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('app:stock-transfers-updated', onTransfersUpdated);
      window.removeEventListener('app:stock-ledger-updated', onLedgerUpdated);
      window.removeEventListener(LOCATION_INVENTORY_UPDATED_EVENT, onInventoryUpdated);
    };
  }, []);

  const columns = useMemo(
    () => ([
      { key: 'sku' as ColumnKey, label: 'SKU' },
      { key: 'product' as ColumnKey, label: 'Product' },
      { key: 'variation' as ColumnKey, label: 'Variation' },
      { key: 'category' as ColumnKey, label: 'Category' },
      { key: 'location' as ColumnKey, label: 'Location' },
      { key: 'unitSellingPrice' as ColumnKey, label: 'Unit Selling Price', right: true, valueRestricted: true },
      { key: 'currentStock' as ColumnKey, label: 'Current Stock', right: true },
      { key: 'stockValuePurchase' as ColumnKey, label: 'Stock Value (Purchase)', right: true, valueRestricted: true },
      { key: 'stockValueSale' as ColumnKey, label: 'Stock Value (Sale)', right: true, valueRestricted: true },
      { key: 'potentialProfit' as ColumnKey, label: 'Potential Profit', right: true, valueRestricted: true },
      { key: 'totalUnitSold' as ColumnKey, label: 'Total Unit Sold', right: true },
      { key: 'totalUnitTransferred' as ColumnKey, label: 'Total Unit Transferred', right: true },
      { key: 'totalUnitAdjusted' as ColumnKey, label: 'Total Unit Adjusted', right: true },
    ]),
    [],
  );

  const menuColumns = useMemo(
    () => columns.filter((col) => !col.valueRestricted || canViewValueMetrics),
    [columns, canViewValueMetrics],
  );

  const displayedColumns = useMemo(
    () => columns.filter((col) => visibleColumns[col.key] && (!col.valueRestricted || canViewValueMetrics)),
    [columns, visibleColumns, canViewValueMetrics],
  );

  const soldByProductId = useMemo(() => {
    const byProductId = new Map<string, number>();
    const productByIdNorm = new Map<string, string>();
    const productBySkuLoc = new Map<string, string>();
    const productByNameLoc = new Map<string, string>();
    const uniqueProductsBySku = new Map<string, string[]>();
    const uniqueProductsByName = new Map<string, string[]>();

    products.forEach((product) => {
      const id = String(product.id || '').trim();
      if (!id) return;
      productByIdNorm.set(normalize(id), id);

      const skuNorm = normalize(product.sku);
      const nameNorm = normalize(product.name);
      const locNorm = normalize(product.businessLocation);

      if (skuNorm) {
        productBySkuLoc.set(stockKey(skuNorm, locNorm), id);
        const nextSkuIds = uniqueProductsBySku.get(skuNorm) || [];
        if (!nextSkuIds.includes(id)) nextSkuIds.push(id);
        uniqueProductsBySku.set(skuNorm, nextSkuIds);
      }
      if (nameNorm) {
        productByNameLoc.set(stockKey(nameNorm, locNorm), id);
        const nextNameIds = uniqueProductsByName.get(nameNorm) || [];
        if (!nextNameIds.includes(id)) nextNameIds.push(id);
        uniqueProductsByName.set(nameNorm, nextNameIds);
      }
    });

    const pushSoldQty = (productId: string, qty: number) => {
      byProductId.set(productId, Number(((byProductId.get(productId) || 0) + qty).toFixed(3)));
    };

    sales.forEach((sale) => {
      if (!hasStatus(sale.status || sale.saleStatus, 'Final')) return;
      const saleLocNorm = normalize(sale.location);

      (sale.items || []).forEach((item) => {
        const qty = Number(item.qty) || 0;
        if (!Number.isFinite(qty) || qty <= 0) return;

        const itemIdNorm = normalize(item.id);
        const itemNameNorm = normalize(item.name);

        let resolvedProductId = '';

        if (itemIdNorm) {
          resolvedProductId = productByIdNorm.get(itemIdNorm) || '';
        }
        if (!resolvedProductId && itemIdNorm) {
          resolvedProductId = productBySkuLoc.get(stockKey(itemIdNorm, saleLocNorm)) || '';
        }
        if (!resolvedProductId && itemNameNorm) {
          resolvedProductId = productByNameLoc.get(stockKey(itemNameNorm, saleLocNorm)) || '';
        }
        if (!resolvedProductId && itemIdNorm) {
          const skuMatches = uniqueProductsBySku.get(itemIdNorm) || [];
          if (skuMatches.length === 1) resolvedProductId = skuMatches[0];
        }
        if (!resolvedProductId && itemNameNorm) {
          const nameMatches = uniqueProductsByName.get(itemNameNorm) || [];
          if (nameMatches.length === 1) resolvedProductId = nameMatches[0];
        }
        if (!resolvedProductId) return;

        pushSoldQty(resolvedProductId, qty);
      });
    });

    return byProductId;
  }, [sales, products]);

  const movementByProductId = useMemo(() => {
    const map = new Map<string, { transferred: number; adjusted: number }>();
    readStockLedger().forEach((entry) => {
      const productId = String(entry.productId || '').trim();
      if (!productId) return;

      const qty = Math.abs(Number(entry.change) || 0);
      if (!qty) return;

      const current = map.get(productId) || { transferred: 0, adjusted: 0 };
      const type = normalize(entry.type);
      const note = normalize(entry.note);

      if (type === 'stock transfer out' || type === 'stock transfer in') {
        current.transferred += qty;
      } else if (type === 'stock transfer reversal in' || type === 'stock transfer reversal out') {
        current.transferred = Math.max(0, current.transferred - qty);
      } else if (
        type === 'stock adjustment reversal'
        || (type === 'stock adjustment' && (note.startsWith('edit rollback') || note.startsWith('delete rollback')))
      ) {
        current.adjusted = Math.max(0, current.adjusted - qty);
      } else if (type === 'stock adjustment') {
        current.adjusted += qty;
      }

      map.set(productId, {
        transferred: Number(current.transferred.toFixed(3)),
        adjusted: Number(current.adjusted.toFixed(3)),
      });
    });
    return map;
  }, [ledgerVersion, products]);

  const stockData = useMemo<StockReportItem[]>(() => {
    const productById = new Map<string, Product>(products.map((product) => [product.id, product]));
    const locationNameById = new Map(locations.map((location) => [location.id, location.name]));
    const buildRow = (
      product: Product,
      location: string,
      currentStock: number,
      unitPurchasePrice: number,
      rowId: string,
    ): StockReportItem => {
      const unitSellingPrice = Number(product.sellingPrice) || 0;
      const stockValueQty = isFractionalProduct(product) && getContainerSize(product) > 0
        ? currentStock / getContainerSize(product)
        : currentStock;
      const movement = movementByProductId.get(product.id) || { transferred: 0, adjusted: 0 };
      const soldQty = soldByProductId.get(product.id) || 0;
      const variation = Array.isArray(product.variationRows) && product.variationRows.length > 0
        ? product.variationRows.map((row) => String(row.values || '').trim()).filter(Boolean).join(' / ') || 'Variable'
        : (product.type === 'Variable' ? 'Variable' : '-');

      return {
        id: rowId,
        productId: product.id,
        sku: product.sku || '',
        product: product.name || '',
        variation,
        category: product.category || '',
        subCategory: product.subCategory || '',
        location,
        unitSellingPrice,
        currentStock: Number(currentStock.toFixed(3)),
        stockValuePurchase: stockValueQty * unitPurchasePrice,
        stockValueSale: stockValueQty * unitSellingPrice,
        potentialProfit: (stockValueQty * unitSellingPrice) - (stockValueQty * unitPurchasePrice),
        totalUnitSold: Number(soldQty.toFixed(3)),
        totalUnitTransferred: movement.transferred,
        totalUnitAdjusted: movement.adjusted,
        brand: product.brand || '',
        unit: product.unit || '',
        stockDisplay: getStockDisplay(currentStock, product),
      };
    };

    const rows: StockReportItem[] = [];

    locationInventory.forEach((inventory) => {
      const product = productById.get(inventory.productId);
      if (!product) return;
      rows.push(buildRow(
        product,
        inventory.locationName || locationNameById.get(inventory.locationId) || '',
        Number(inventory.stock) || 0,
        Number(inventory.unitCost ?? product.unitPurchasePrice ?? 0) || 0,
        `${product.id}@@${inventory.locationId}`,
      ));
    });

    return rows;
  }, [products, locations, locationInventory, movementByProductId, soldByProductId]);

  const locationOptions = useMemo(
    () => Array.from(new Set([
      ...locations.map((loc) => loc.name),
      ...stockData.map((item) => item.location),
    ].filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [locations, stockData],
  );
  const categoryOptions = useMemo(
    () => Array.from(new Set(stockData.map((item) => item.category).filter(Boolean))).sort(),
    [stockData],
  );
  const subCategoryOptions = useMemo(
    () => Array.from(new Set(stockData.map((item) => item.subCategory || '').filter(Boolean))).sort(),
    [stockData],
  );
  const brandOptions = useMemo(
    () => Array.from(new Set(stockData.map((item) => item.brand).filter(Boolean))).sort(),
    [stockData],
  );
  const unitOptions = useMemo(
    () => Array.from(new Set(stockData.map((item) => item.unit).filter(Boolean))).sort(),
    [stockData],
  );

  const filteredData = useMemo(() => {
    const q = normalize(searchTerm);
    return stockData.filter((item) => {
      if (q) {
        const hay = [item.product, item.sku, item.category, item.subCategory, item.brand, item.location].map(normalize);
        if (!hay.some((value) => value.includes(q))) return false;
      }
      if (filters.location.length > 0 && !filters.location.includes(item.location)) return false;
      if (filters.category.length > 0 && !filters.category.includes(item.category)) return false;
      if (filters.subCategory.length > 0 && !filters.subCategory.includes(item.subCategory)) return false;
      if (filters.brand.length > 0 && !filters.brand.includes(item.brand)) return false;
      if (filters.unit.length > 0 && !filters.unit.includes(item.unit)) return false;
      return true;
    });
  }, [stockData, searchTerm, filters]);

  const totals = useMemo(
    () => filteredData.reduce((acc, curr) => ({
      currentStock: acc.currentStock + curr.currentStock,
      stockValuePurchase: acc.stockValuePurchase + curr.stockValuePurchase,
      stockValueSale: acc.stockValueSale + curr.stockValueSale,
      potentialProfit: acc.potentialProfit + curr.potentialProfit,
      totalUnitSold: acc.totalUnitSold + curr.totalUnitSold,
      totalUnitTransferred: acc.totalUnitTransferred + curr.totalUnitTransferred,
      totalUnitAdjusted: acc.totalUnitAdjusted + curr.totalUnitAdjusted,
    }), {
      currentStock: 0,
      stockValuePurchase: 0,
      stockValueSale: 0,
      potentialProfit: 0,
      totalUnitSold: 0,
      totalUnitTransferred: 0,
      totalUnitAdjusted: 0,
    }),
    [filteredData],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, entriesPerPage]);

  const totalEntries = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / entriesPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * entriesPerPage;
  const paginatedData = filteredData.slice(pageStartIndex, pageStartIndex + entriesPerPage);
  const pageStartEntry = totalEntries === 0 ? 0 : pageStartIndex + 1;
  const pageEndEntry = totalEntries === 0 ? 0 : pageStartIndex + paginatedData.length;
  const pageItems = useMemo(
    () => buildPageItems(safeCurrentPage, totalPages),
    [safeCurrentPage, totalPages],
  );

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const labelColumnKey = useMemo(
    () => displayedColumns.find((column) => (
      column.key === 'sku'
      || column.key === 'product'
      || column.key === 'variation'
      || column.key === 'category'
      || column.key === 'location'
    ))?.key,
    [displayedColumns],
  );

  const historyProduct = useMemo(
    () => products.find((product) => product.id === historyProductId) || null,
    [products, historyProductId],
  );

  const handleOpenHistory = (productId: string) => {
    const normalizedProductId = String(productId || '').trim();
    if (!normalizedProductId) return;
    if (typeof onNavigate === 'function') {
      onNavigate(`product-stock-history/${encodeURIComponent(normalizedProductId)}?from=report-stock`);
      return;
    }
    setHistoryProductId(normalizedProductId);
  };

  const exportCsv = () => {
    const exportColumns = displayedColumns;
    const headers = ['Action', ...exportColumns.map((column) => column.label)];
    const lines = filteredData.map((item) => [
      toCsvCell('Product stock history'),
      ...exportColumns.map((column) => {
        switch (column.key) {
          case 'sku': return toCsvCell(item.sku);
          case 'product': return toCsvCell(item.product);
          case 'variation': return toCsvCell(item.variation);
          case 'category': return toCsvCell(item.category);
          case 'location': return toCsvCell(item.location);
          case 'unitSellingPrice': return toCsvCell(item.unitSellingPrice.toFixed(3));
          case 'currentStock': return toCsvCell(item.stockDisplay || item.currentStock.toFixed(3));
          case 'stockValuePurchase': return toCsvCell(item.stockValuePurchase.toFixed(3));
          case 'stockValueSale': return toCsvCell(item.stockValueSale.toFixed(3));
          case 'potentialProfit': return toCsvCell(item.potentialProfit.toFixed(3));
          case 'totalUnitSold': return toCsvCell(item.totalUnitSold.toFixed(3));
          case 'totalUnitTransferred': return toCsvCell(item.totalUnitTransferred.toFixed(3));
          case 'totalUnitAdjusted': return toCsvCell(item.totalUnitAdjusted.toFixed(3));
          default: return toCsvCell('');
        }
      }),
    ].join(','));
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const exportColumns = displayedColumns;
    const headers = ['Action', ...exportColumns.map((column) => column.label)];
    const lines = filteredData.map((item) => [
      'Product stock history',
      ...exportColumns.map((column) => {
        switch (column.key) {
          case 'sku': return item.sku;
          case 'product': return item.product;
          case 'variation': return item.variation;
          case 'category': return item.category;
          case 'location': return item.location;
          case 'unitSellingPrice': return item.unitSellingPrice.toFixed(3);
          case 'currentStock': return item.stockDisplay || item.currentStock.toFixed(3);
          case 'stockValuePurchase': return item.stockValuePurchase.toFixed(3);
          case 'stockValueSale': return item.stockValueSale.toFixed(3);
          case 'potentialProfit': return item.potentialProfit.toFixed(3);
          case 'totalUnitSold': return item.totalUnitSold.toFixed(3);
          case 'totalUnitTransferred': return item.totalUnitTransferred.toFixed(3);
          case 'totalUnitAdjusted': return item.totalUnitAdjusted.toFixed(3);
          default: return '';
        }
      }),
    ].join('\t'));
    const tsv = [headers.join('\t'), ...lines].join('\n');
    const blob = new Blob([tsv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock-report.xls';
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div>
        <div className="flex items-center gap-4 mb-6">
        <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
          <Warehouse size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Stock Report</h1>
          <p className="text-slate-500 text-sm mt-0.5">Current stock levels across all locations</p>
        </div>
      </div>
      </div>

      <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
<div className="flex items-center gap-2 mb-2 text-blue-600 font-bold text-sm cursor-pointer w-fit" onClick={() => setShowFilters(!showFilters)}>
          <Filter size={16} /> Filters
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2">
            <MultiSelect
              label="Business Location"
              options={locationOptions}
              selected={filters.location}
              onChange={(value) => setFilters({ ...filters, location: value })}
            />
            <MultiSelect
              label="Category"
              options={categoryOptions}
              selected={filters.category}
              onChange={(value) => setFilters({ ...filters, category: value })}
            />
            <MultiSelect
              label="Sub Category"
              options={subCategoryOptions}
              selected={filters.subCategory}
              onChange={(value) => setFilters({ ...filters, subCategory: value })}
            />
            <MultiSelect
              label="Brand"
              options={brandOptions}
              selected={filters.brand}
              onChange={(value) => setFilters({ ...filters, brand: value })}
            />
            <MultiSelect
              label="Unit"
              options={unitOptions}
              selected={filters.unit}
              onChange={(value) => setFilters({ ...filters, unit: value })}
            />
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
          <div className="flex flex-col gap-1 border-r border-slate-100 last:border-0 pr-4">
            <span className="font-medium text-slate-500 text-xs">Closing Stock (By purchase price)</span>
            <span className="font-bold text-slate-800 text-lg">{canViewValueMetrics ? formatCurrency(totals.stockValuePurchase) : 'Restricted'}</span>
          </div>
          <div className="flex flex-col gap-1 border-r border-slate-100 last:border-0 pr-4">
            <span className="font-medium text-slate-500 text-xs">Closing Stock (By sale price)</span>
            <span className="font-bold text-slate-800 text-lg">{canViewValueMetrics ? formatCurrency(totals.stockValueSale) : 'Restricted'}</span>
          </div>
          <div className="flex flex-col gap-1 border-r border-slate-100 last:border-0 pr-4">
            <span className="font-medium text-slate-500 text-xs">Potential Profit</span>
            <span className="font-bold text-emerald-600 text-lg">{canViewValueMetrics ? formatCurrency(totals.potentialProfit) : 'Restricted'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-medium text-slate-500 text-xs">Profit Margin %</span>
            <span className="font-bold text-slate-800 text-lg">
              {canViewValueMetrics
                ? (totals.stockValueSale > 0 ? ((totals.potentialProfit / totals.stockValueSale) * 100).toFixed(3) : '0.000')
                : 'Restricted'}
            </span>
          </div>
        </div>
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
              <button
                data-stock-col-button
                onClick={() => setShowColumnMenu((prev) => !prev)}
                className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"
              >
                <Columns size={10} /> Column visibility
              </button>
              {showColumnMenu && (
                <div data-stock-col-menu className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-2 space-y-1">
                  {menuColumns.map((column) => (
                    <label key={column.key} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={visibleColumns[column.key]}
                        onChange={() => toggleColumn(column.key)}
                      />
                      <span className="text-slate-700 font-medium">{column.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search..."
              className="pl-8 pr-3 py-1.5 rounded border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[420px]">
          <table className="w-full text-[11px] text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Action</th>
                {displayedColumns.map((column) => (
                  <th key={column.key} className={`px-4 py-3 whitespace-nowrap ${column.right ? 'text-right' : ''}`}>
                    {column.label} <ArrowUpDown size={10} className="inline ml-1 text-slate-400" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleOpenHistory(item.productId)}
                      className="flex items-center gap-1 px-2 py-1 bg-white border border-blue-200 text-blue-600 rounded text-[10px] font-bold hover:bg-blue-50 whitespace-nowrap"
                    >
                      <History size={10} /> Product stock history
                    </button>
                  </td>
                  {displayedColumns.map((column) => {
                    if (column.key === 'sku') {
                      return <td key={column.key} className="px-4 py-3 text-slate-600 whitespace-nowrap font-mono">{item.sku}</td>;
                    }
                    if (column.key === 'product') {
                      return <td key={column.key} className="px-4 py-3 text-slate-700 font-bold whitespace-nowrap">{item.product}</td>;
                    }
                    if (column.key === 'variation') {
                      return <td key={column.key} className="px-4 py-3 text-slate-500 whitespace-nowrap">{item.variation}</td>;
                    }
                    if (column.key === 'category') {
                      return <td key={column.key} className="px-4 py-3 text-slate-600 whitespace-nowrap">{item.category}</td>;
                    }
                    if (column.key === 'location') {
                      return <td key={column.key} className="px-4 py-3 text-slate-500 whitespace-nowrap text-[10px]">{item.location}</td>;
                    }
                    if (column.key === 'unitSellingPrice') {
                      return <td key={column.key} className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">{formatCurrency(item.unitSellingPrice)}</td>;
                    }
                    if (column.key === 'currentStock') {
                      return <td key={column.key} className="px-4 py-3 text-right text-slate-700 font-bold whitespace-nowrap">{item.stockDisplay || formatQty(item.currentStock, item.unit)}</td>;
                    }
                    if (column.key === 'stockValuePurchase') {
                      return <td key={column.key} className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{formatCurrency(item.stockValuePurchase)}</td>;
                    }
                    if (column.key === 'stockValueSale') {
                      return <td key={column.key} className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{formatCurrency(item.stockValueSale)}</td>;
                    }
                    if (column.key === 'potentialProfit') {
                      return <td key={column.key} className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{formatCurrency(item.potentialProfit)}</td>;
                    }
                    if (column.key === 'totalUnitSold') {
                      return <td key={column.key} className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{formatQty(item.totalUnitSold, item.unit)}</td>;
                    }
                    if (column.key === 'totalUnitTransferred') {
                      return <td key={column.key} className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{formatQty(item.totalUnitTransferred, item.unit)}</td>;
                    }
                    return <td key={column.key} className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{formatQty(item.totalUnitAdjusted, item.unit)}</td>;
                  })}
                </tr>
              ))}
              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan={Math.max(1, displayedColumns.length + 1)} className="px-4 py-10 text-center text-slate-400 italic">
                    No data available in table
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-100 font-bold text-slate-800 text-[10px] border-t border-slate-300">
              <tr>
                <td className="px-4 py-3">&nbsp;</td>
                {displayedColumns.map((column) => {
                  if (column.key === labelColumnKey) {
                    return <td key={column.key} className="px-4 py-3 text-right uppercase">Total:</td>;
                  }
                  if (column.key === 'currentStock') {
                    return <td key={column.key} className="px-4 py-3 text-right">{totals.currentStock.toFixed(3)}</td>;
                  }
                  if (column.key === 'stockValuePurchase') {
                    return <td key={column.key} className="px-4 py-3 text-right">{formatCurrency(totals.stockValuePurchase)}</td>;
                  }
                  if (column.key === 'stockValueSale') {
                    return <td key={column.key} className="px-4 py-3 text-right">{formatCurrency(totals.stockValueSale)}</td>;
                  }
                  if (column.key === 'potentialProfit') {
                    return <td key={column.key} className="px-4 py-3 text-right">{formatCurrency(totals.potentialProfit)}</td>;
                  }
                  if (column.key === 'totalUnitSold') {
                    return <td key={column.key} className="px-4 py-3 text-right">{totals.totalUnitSold.toFixed(3)}</td>;
                  }
                  if (column.key === 'totalUnitTransferred') {
                    return <td key={column.key} className="px-4 py-3 text-right">{totals.totalUnitTransferred.toFixed(3)}</td>;
                  }
                  if (column.key === 'totalUnitAdjusted') {
                    return <td key={column.key} className="px-4 py-3 text-right">{totals.totalUnitAdjusted.toFixed(3)}</td>;
                  }
                  return <td key={column.key} className="px-4 py-3 text-right">&nbsp;</td>;
                })}
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <div>Showing {pageStartEntry} to {pageEndEntry} of {totalEntries} entries</div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safeCurrentPage <= 1}
              className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {pageItems.map((item, index) => (
              item === '...'
                ? <span key={`ellipsis-${index}`} className="px-2 py-1 text-slate-400">...</span>
                : (
                  <button
                    key={`page-${item}`}
                    type="button"
                    onClick={() => setCurrentPage(item)}
                    className={`px-2 py-1 border rounded ${safeCurrentPage === item ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white border-slate-300 hover:bg-slate-50'}`}
                  >
                    {item}
                  </button>
                )
            ))}
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <ProductStockHistory
        isOpen={!!historyProduct}
        onClose={() => setHistoryProductId(null)}
        product={historyProduct}
        pageMode={true}
      />
    </div>
  );
};

export default ReportStock;

