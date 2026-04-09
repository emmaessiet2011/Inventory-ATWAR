import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Columns,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Printer,
  Search,Package} from 'lucide-react';
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

interface PurchaseLine {
  locationNorm: string;
  productIdNorm: string;
  skuNorm: string;
  nameNorm: string;
  dateMs: number;
  dateRaw: string;
  ref: string;
  supplier: string;
  lot: string;
  unitCost: number;
}

interface Row {
  id: string;
  product: string;
  sku: string;
  description: string;
  purchaseDateRaw: string;
  purchaseDateMs: number;
  purchaseRef: string;
  lot: string;
  supplier: string;
  purchasePrice: number;
  sellDateRaw: string;
  sellDateMs: number;
  saleRef: string;
  customer: string;
  location: string;
  sellQty: number;
  unit: string;
  sellingPrice: number;
  subtotal: number;
}

type ColKey =
  | 'product'
  | 'sku'
  | 'description'
  | 'purchaseDate'
  | 'purchaseRef'
  | 'lot'
  | 'supplier'
  | 'purchasePrice'
  | 'sellDate'
  | 'saleRef'
  | 'customer'
  | 'location'
  | 'sellQty'
  | 'sellingPrice'
  | 'subtotal';

type SortDirection = 'asc' | 'desc';

interface SortState {
  key: ColKey;
  direction: SortDirection;
}

interface ReturnBucket {
  qty: number;
  amount: number;
}

const normalize = (v: unknown) => String(v ?? '').trim().toLowerCase();
const round3 = (v: number) => Math.round(v * 1000) / 1000;
const key = (loc: string, token: string) => `${loc}@@${token}`;
const csv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const hasStatus = (value: unknown, expected: string) => normalize(value) === normalize(expected);
const parseMs = (v: unknown) => {
  const raw = String(v ?? '').trim();
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
    const meridiem = normalize(dmy12h[6]);
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    const parsed = new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  const direct = Date.parse(raw);
  return Number.isFinite(direct) ? direct : parseExpenseDateToMs(raw);
};
const dayStart = (d: Date | null) => (d ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime() : null);
const dayEnd = (d: Date | null) => (d ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime() : null);
const inRange = (ms: number, start: number | null, end: number | null, active: boolean) => {
  if (!active) return true;
  if (!Number.isFinite(ms)) return false;
  if (start != null && ms < start) return false;
  if (end != null && ms > end) return false;
  return true;
};
const formatDateBySettings = (raw: string, dateFormat: string, timeFormat: string) => {
  const ms = parseMs(raw);
  if (!Number.isFinite(ms)) return raw || '--';
  const value = new Date(ms);
  const day = String(value.getDate()).padStart(2, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const year = value.getFullYear();
  const dateOnly = dateFormat === 'mm/dd/yyyy'
    ? `${month}/${day}/${year}`
    : `${day}/${month}/${year}`;
  const hasTime = /(\d{1,2}:\d{2})|([AP]M)/i.test(raw);
  if (!hasTime) return dateOnly;
  const hours24 = value.getHours();
  const minutes = String(value.getMinutes()).padStart(2, '0');
  if (timeFormat === '24') {
    return `${dateOnly} ${String(hours24).padStart(2, '0')}:${minutes}`;
  }
  const meridiem = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = String(hours24 % 12 || 12).padStart(2, '0');
  return `${dateOnly} ${hours12}:${minutes} ${meridiem}`;
};

const allTime = (): DateRangeValue => ({
  startDate: null,
  endDate: null,
  label: 'All Time',
});

const getSortValue = (row: Row, sortKey: ColKey): string | number => {
  switch (sortKey) {
    case 'product': return normalize(row.product);
    case 'sku': return normalize(row.sku);
    case 'description': return normalize(row.description);
    case 'purchaseDate': return Number.isFinite(row.purchaseDateMs) ? row.purchaseDateMs : Number.NEGATIVE_INFINITY;
    case 'purchaseRef': return normalize(row.purchaseRef);
    case 'lot': return normalize(row.lot);
    case 'supplier': return normalize(row.supplier);
    case 'purchasePrice': return row.purchasePrice;
    case 'sellDate': return Number.isFinite(row.sellDateMs) ? row.sellDateMs : Number.NEGATIVE_INFINITY;
    case 'saleRef': return normalize(row.saleRef);
    case 'customer': return normalize(row.customer);
    case 'location': return normalize(row.location);
    case 'sellQty': return row.sellQty;
    case 'sellingPrice': return row.sellingPrice;
    case 'subtotal': return row.subtotal;
    default: return '';
  }
};

const getSaleLineTotalsTaxInclusive = (sale: any, items: any[]): number[] => {
  if (!Array.isArray(items) || items.length === 0) return [];
  const baseTotals = items.map((item) => {
    const qty = Number(item?.qty || 0);
    if (!Number.isFinite(qty) || qty <= 0) return 0;
    const unitPrice = Number(item?.unitPrice || 0);
    const discount = Number(item?.discount || 0);
    const subtotalRaw = Number(item?.subtotal);
    const taxRaw = Number(item?.tax || 0);
    const totalRaw = Number(item?.total);
    const subtotal = Number.isFinite(subtotalRaw)
      ? subtotalRaw
      : Math.max(0, qty * unitPrice - (Number.isFinite(discount) ? discount : 0));
    const fallbackTotal = Math.max(0, subtotal + (Number.isFinite(taxRaw) ? taxRaw : 0));
    return round3(Math.max(0, Number.isFinite(totalRaw) ? totalRaw : fallbackTotal));
  });

  const positiveIndexes = baseTotals
    .map((value, index) => ({ value, index }))
    .filter((row) => row.value > 0)
    .map((row) => row.index);
  const baseSum = round3(positiveIndexes.reduce((sum, index) => sum + baseTotals[index], 0));
  if (positiveIndexes.length === 0 || baseSum <= 0) return baseTotals;

  const grandRaw = Number(sale?.grandTotal || sale?.totalAmount || baseSum);
  const grandTotal = round3(Math.max(0, Number.isFinite(grandRaw) ? grandRaw : baseSum));
  if (grandTotal <= 0) return baseTotals.map(() => 0);

  const allocated = new Array(items.length).fill(0);
  let remainingBase = baseSum;
  let remainingGrand = grandTotal;
  positiveIndexes.forEach((index, position) => {
    const base = baseTotals[index];
    if (position === positiveIndexes.length - 1 || remainingBase <= 0) {
      allocated[index] = round3(Math.max(0, remainingGrand));
      return;
    }
    const share = round3(Math.max(0, (base / remainingBase) * remainingGrand));
    allocated[index] = share;
    remainingBase = round3(Math.max(0, remainingBase - base));
    remainingGrand = round3(Math.max(0, remainingGrand - share));
  });
  return allocated;
};

const ReportItems: React.FC = () => {
  const { locations, products, customers, sales, purchases, sellReturns, formatCurrency, settings } = useGlobalContext();

  const [showFilters, setShowFilters] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [showColumns, setShowColumns] = useState(false);
  const [purchaseRange, setPurchaseRange] = useState<DateRangeValue>(allTime);
  const [sellRange, setSellRange] = useState<DateRangeValue>(allTime);
  const [sortState, setSortState] = useState<SortState>({ key: 'sellDate', direction: 'desc' });
  const [filters, setFilters] = useState({ supplier: [] as string[], customer: [] as string[], location: [] as string[] });
  const [visible, setVisible] = useState<Record<ColKey, boolean>>({
    product: true, sku: true, description: true, purchaseDate: true, purchaseRef: true, lot: true, supplier: true, purchasePrice: true,
    sellDate: true, saleRef: true, customer: true, location: true, sellQty: true, sellingPrice: true, subtotal: true,
  });

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!(e.target instanceof HTMLElement)) return;
      if (!e.target.closest('[data-items-col-menu]') && !e.target.closest('[data-items-col-btn]')) setShowColumns(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const productById = useMemo(() => {
    const m = new Map<string, (typeof products)[number]>();
    products.forEach((p) => m.set(String(p.id || ''), p));
    return m;
  }, [products]);
  const productByName = useMemo(() => {
    const m = new Map<string, (typeof products)[number]>();
    products.forEach((p) => { const k = normalize(p.name); if (k) m.set(k, p); });
    return m;
  }, [products]);
  const customerById = useMemo(() => {
    const m = new Map<string, (typeof customers)[number]>();
    customers.forEach((c) => m.set(String(c.id || ''), c));
    return m;
  }, [customers]);

  const purchaseLookup = useMemo(() => {
    const byId = new Map<string, PurchaseLine[]>();
    const bySku = new Map<string, PurchaseLine[]>();
    const byName = new Map<string, PurchaseLine[]>();
    const push = (m: Map<string, PurchaseLine[]>, k: string, row: PurchaseLine) => {
      const list = m.get(k);
      if (list) list.push(row); else m.set(k, [row]);
    };
    purchases.filter((p) => hasStatus(p.status, 'Received')).forEach((p) => {
      const loc = normalize(p.location);
      const ref = String(p.refNo || '').trim() || '--';
      const supplier = String(p.supplier || '').trim() || '--';
      const dateRaw = String(p.date || '').trim();
      const dateMs = parseMs(dateRaw);
      (p.items || []).forEach((i) => {
        const product = productById.get(String(i.id || '')) || productByName.get(normalize(i.name));
        const idNorm = normalize(i.id || product?.id);
        const skuNorm = normalize(product?.sku);
        const nameNorm = normalize(i.name || product?.name);
        if (!idNorm && !skuNorm && !nameNorm) return;
        const row: PurchaseLine = {
          locationNorm: loc, productIdNorm: idNorm, skuNorm, nameNorm, dateMs, dateRaw, ref, supplier,
          lot: String(i.lot || '').trim(), unitCost: round3(Number(i.unitCost || 0)),
        };
        if (idNorm) push(byId, key(loc, idNorm), row);
        if (skuNorm) push(bySku, key(loc, skuNorm), row);
        if (nameNorm) push(byName, key(loc, nameNorm), row);
      });
    });
    const sort = (m: Map<string, PurchaseLine[]>) => m.forEach((list) => list.sort((a, b) => b.dateMs - a.dateMs));
    sort(byId); sort(bySku); sort(byName);
    return { byId, bySku, byName };
  }, [purchases, productById, productByName]);

  const sellReturnLookup = useMemo(() => {
    const bySaleProductId = new Map<string, ReturnBucket>();
    const bySaleProductName = new Map<string, ReturnBucket>();
    const push = (target: Map<string, ReturnBucket>, mapKey: string, qtyDelta: number, amountDelta: number) => {
      const existing = target.get(mapKey);
      if (existing) {
        existing.qty = round3(existing.qty + qtyDelta);
        existing.amount = round3(existing.amount + amountDelta);
        return;
      }
      target.set(mapKey, { qty: round3(qtyDelta), amount: round3(amountDelta) });
    };

    sellReturns.forEach((sellReturn) => {
      const saleIdNorm = normalize(sellReturn.parentSaleId);
      if (!saleIdNorm) return;
      (sellReturn.items || []).forEach((item) => {
        const qty = Number(item.qty || 0);
        if (!Number.isFinite(qty) || qty <= 0) return;
        const amount = Math.max(0, Number(item.lineTotal || 0));
        const productIdNorm = normalize(item.productId);
        const productNameNorm = normalize(item.productName);
        if (productIdNorm) {
          push(bySaleProductId, `${saleIdNorm}@@${productIdNorm}`, qty, amount);
          return;
        }
        if (productNameNorm) {
          push(bySaleProductName, `${saleIdNorm}@@${productNameNorm}`, qty, amount);
        }
      });
    });

    return { bySaleProductId, bySaleProductName };
  }, [sellReturns]);

  const rows = useMemo<Row[]>(() => {
    const remainingById = new Map<string, ReturnBucket>(
      Array.from(sellReturnLookup.bySaleProductId.entries()).map(([mapKey, bucket]) => [mapKey, { ...bucket }]),
    );
    const remainingByName = new Map<string, ReturnBucket>(
      Array.from(sellReturnLookup.bySaleProductName.entries()).map(([mapKey, bucket]) => [mapKey, { ...bucket }]),
    );

    const pick = (list: PurchaseLine[] | undefined, saleMs: number) => {
      if (!list || list.length === 0) return null;
      if (!Number.isFinite(saleMs)) return list[0];
      const before = list.find((r) => Number.isFinite(r.dateMs) && r.dateMs <= saleMs);
      return before || list[0];
    };
    return sales.flatMap((sale) => {
      if (!hasStatus(sale.status || sale.saleStatus, 'Final')) return [];
      const sellDateRaw = String(sale.date || '').trim();
      const sellDateMs = parseMs(sellDateRaw);
      const location = String(sale.location || '').trim();
      const locNorm = normalize(location);
      const customer = String(sale.customerName || customerById.get(String(sale.customerId || ''))?.businessName || 'Direct Customer').trim() || 'Direct Customer';
      const saleRef = String(sale.invoiceNo || sale.id || '').trim() || '--';
      const saleItems = Array.isArray(sale.items) ? sale.items : [];
      const lineTotalsTaxInclusive = getSaleLineTotalsTaxInclusive(sale, saleItems);
      return saleItems.flatMap((item, idx) => {
        const grossQty = round3(Number(item.qty || 0));
        if (!Number.isFinite(grossQty) || grossQty <= 0) return [];
        const product = productById.get(String(item.id || '')) || productByName.get(normalize(item.name));
        const idNorm = normalize(item.id || product?.id);
        const skuNorm = normalize(product?.sku);
        const nameNorm = normalize(item.name || product?.name);
        const match =
          (idNorm ? pick(purchaseLookup.byId.get(key(locNorm, idNorm)), sellDateMs) : null) ||
          (skuNorm ? pick(purchaseLookup.bySku.get(key(locNorm, skuNorm)), sellDateMs) : null) ||
          (nameNorm ? pick(purchaseLookup.byName.get(key(locNorm, nameNorm)), sellDateMs) : null);
        const opening = Number(product?.openingStock || 0) > 0 && (!product?.openingStockLocation || normalize(product.openingStockLocation) === locNorm);
        const unitPrice = round3(Number(item.unitPrice || 0));
        const lineSubtotal = Number(item.subtotal);
        const fallbackSubtotal = round3(Number.isFinite(lineSubtotal) ? lineSubtotal : Math.max(0, (grossQty * unitPrice) - Number(item.discount || 0)));
        const grossSubtotal = round3(Math.max(0, Number(lineTotalsTaxInclusive[idx] ?? fallbackSubtotal)));
        const saleIdNorm = normalize(sale.id);
        const returnBucket = (
          (idNorm ? remainingById.get(`${saleIdNorm}@@${idNorm}`) : undefined)
          || (nameNorm ? remainingByName.get(`${saleIdNorm}@@${nameNorm}`) : undefined)
        );

        let qty = grossQty;
        let subtotal = grossSubtotal;
        if (returnBucket && returnBucket.qty > 0) {
          const deductedQty = Math.min(qty, returnBucket.qty);
          returnBucket.qty = round3(Math.max(0, returnBucket.qty - deductedQty));

          const proportionalAmount = grossQty > 0 ? grossSubtotal * (deductedQty / grossQty) : 0;
          const amountBudget = returnBucket.amount > 0 ? returnBucket.amount : proportionalAmount;
          const deductedAmount = Math.min(
            subtotal,
            Math.max(0, proportionalAmount),
            Math.max(0, amountBudget),
          );
          subtotal = round3(Math.max(0, subtotal - deductedAmount));
          if (returnBucket.amount > 0) {
            returnBucket.amount = round3(Math.max(0, returnBucket.amount - deductedAmount));
          }
          qty = round3(Math.max(0, qty - deductedQty));
        }

        if (qty <= 0 && subtotal <= 0) return [];

        return [{
          id: `${sale.id}-${idx}`,
          product: String(item.name || product?.name || 'Unknown Product').trim() || 'Unknown Product',
          sku: String(product?.sku || item.id || '').trim(),
          description: String(product?.description || '').trim(),
          purchaseDateRaw: match?.dateRaw || '',
          purchaseDateMs: match?.dateMs ?? Number.NaN,
          purchaseRef: match?.ref || (opening ? '(Opening Stock)' : '--'),
          lot: match?.lot || String(product?.lotNumber || '').trim(),
          supplier: match?.supplier || '--',
          purchasePrice: round3(Number(match?.unitCost ?? product?.unitPurchasePrice ?? 0)),
          sellDateRaw,
          sellDateMs,
          saleRef,
          customer,
          location,
          sellQty: qty,
          unit: String(item.unit || product?.unit || '').trim(),
          sellingPrice: unitPrice,
          subtotal,
        }];
      });
    }).sort((a, b) => b.sellDateMs - a.sellDateMs);
  }, [sales, customerById, productById, productByName, purchaseLookup, sellReturnLookup]);

  const supplierOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.supplier).filter((v) => v && v !== '--'))).sort(), [rows]);
  const customerOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.customer).filter(Boolean))).sort(), [rows]);
  const locationOptions = useMemo(() => Array.from(new Set([...locations.map((l) => l.name), ...rows.map((r) => r.location)].filter(Boolean))).sort(), [locations, rows]);

  const pStart = useMemo(() => dayStart(purchaseRange.startDate), [purchaseRange.startDate]);
  const pEnd = useMemo(() => dayEnd(purchaseRange.endDate), [purchaseRange.endDate]);
  const sStart = useMemo(() => dayStart(sellRange.startDate), [sellRange.startDate]);
  const sEnd = useMemo(() => dayEnd(sellRange.endDate), [sellRange.endDate]);
  const hasP = pStart != null || pEnd != null;
  const hasS = sStart != null || sEnd != null;

  const filtered = useMemo(() => {
    const q = normalize(searchTerm);
    return rows.filter((r) => {
      if (q) {
        const hay = [r.product, r.sku, r.purchaseRef, r.saleRef, r.supplier, r.customer, r.location, r.lot].map(normalize);
        if (!hay.some((v) => v.includes(q))) return false;
      }
      if (filters.supplier.length > 0 && !filters.supplier.includes(r.supplier)) return false;
      if (filters.customer.length > 0 && !filters.customer.includes(r.customer)) return false;
      if (filters.location.length > 0 && !filters.location.includes(r.location)) return false;
      if (!inRange(r.purchaseDateMs, pStart, pEnd, hasP)) return false;
      if (!inRange(r.sellDateMs, sStart, sEnd, hasS)) return false;
      return true;
    });
  }, [rows, searchTerm, filters, pStart, pEnd, sStart, sEnd, hasP, hasS]);

  const sorted = useMemo(() => {
    const directionFactor = sortState.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((left, right) => {
      const leftValue = getSortValue(left, sortState.key);
      const rightValue = getSortValue(right, sortState.key);

      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return (leftValue - rightValue) * directionFactor;
      }
      return String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: 'base' }) * directionFactor;
    });
  }, [filtered, sortState]);

  const totals = useMemo(() => ({
    qty: round3(sorted.reduce((sum, r) => sum + r.sellQty, 0)),
    subtotal: round3(sorted.reduce((sum, r) => sum + r.subtotal, 0)),
  }), [sorted]);

  useEffect(() => setCurrentPage(1), [searchTerm, filters, pStart, pEnd, sStart, sEnd, entriesPerPage, sortState]);
  const totalEntries = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / entriesPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * entriesPerPage;
  const pageRows = sorted.slice(start, start + entriesPerPage);
  const from = totalEntries === 0 ? 0 : start + 1;
  const to = totalEntries === 0 ? 0 : start + pageRows.length;

  const exportCsv = () => {
    const headers = ['Product', 'SKU', 'Description', 'Purchase Date', 'Purchase', 'Lot Number', 'Supplier', 'Purchase Price', 'Sell Date', 'Sale', 'Customer', 'Location', 'Sell Qty', 'Selling Price', 'Total (Inc. Tax)'];
    const lines = sorted.map((r) => [
      csv(r.product),
      csv(r.sku),
      csv(r.description),
      csv(formatDateBySettings(r.purchaseDateRaw, settings.dateFormat, settings.timeFormat)),
      csv(r.purchaseRef),
      csv(r.lot),
      csv(r.supplier),
      csv(r.purchasePrice.toFixed(3)),
      csv(formatDateBySettings(r.sellDateRaw, settings.dateFormat, settings.timeFormat)),
      csv(r.saleRef),
      csv(r.customer),
      csv(r.location),
      csv(r.sellQty.toFixed(3)),
      csv(r.sellingPrice.toFixed(3)),
      csv(r.subtotal.toFixed(3)),
    ].join(','));
    const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'items-report.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const headers = ['Product', 'SKU', 'Description', 'Purchase Date', 'Purchase', 'Lot Number', 'Supplier', 'Purchase Price', 'Sell Date', 'Sale', 'Customer', 'Location', 'Sell Qty', 'Selling Price', 'Total (Inc. Tax)'];
    const lines = sorted.map((r) => [
      r.product,
      r.sku,
      r.description,
      formatDateBySettings(r.purchaseDateRaw, settings.dateFormat, settings.timeFormat),
      r.purchaseRef,
      r.lot,
      r.supplier,
      r.purchasePrice.toFixed(3),
      formatDateBySettings(r.sellDateRaw, settings.dateFormat, settings.timeFormat),
      r.saleRef,
      r.customer,
      r.location,
      r.sellQty.toFixed(3),
      r.sellingPrice.toFixed(3),
      r.subtotal.toFixed(3),
    ].join('\t'));
    const blob = new Blob([[headers.join('\t'), ...lines].join('\n')], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'items-report.xls'; a.click();
    URL.revokeObjectURL(url);
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
      const rowHeight = 14;
      const maxY = 560;
      let y = 34;

      doc.setFontSize(14);
      doc.text('Items Report', margin, y);
      y += rowHeight + 4;

      doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
      y += rowHeight;
      doc.text(`Rows: ${sorted.length}`, margin, y);
      y += rowHeight + 2;

      const x = {
        product: 28,
        sale: 290,
        customer: 370,
        location: 500,
        qty: 660,
        subtotal: 740,
      };

      const drawHeader = () => {
        doc.setFont('helvetica', 'bold');
        doc.text('Product', x.product, y);
        doc.text('Sale', x.sale, y);
        doc.text('Customer', x.customer, y);
        doc.text('Location', x.location, y);
        doc.text('Qty', x.qty, y);
        doc.text('Total (Inc. Tax)', x.subtotal, y);
        doc.setFont('helvetica', 'normal');
        y += rowHeight;
      };

      drawHeader();

      if (sorted.length === 0) {
        doc.text('No data available in table', margin, y);
        y += rowHeight;
      } else {
        sorted.forEach((row) => {
          if (y > maxY) {
            doc.addPage();
            y = 34;
            drawHeader();
          }
          doc.text(String(row.product || '').slice(0, 38), x.product, y);
          doc.text(String(row.saleRef || '').slice(0, 12), x.sale, y);
          doc.text(String(row.customer || '').slice(0, 24), x.customer, y);
          doc.text(String(row.location || '').slice(0, 28), x.location, y);
          doc.text(row.sellQty.toFixed(3), x.qty, y);
          doc.text(formatCurrency(row.subtotal), x.subtotal, y);
          y += rowHeight;
        });
      }

      if (y + rowHeight > maxY) {
        doc.addPage();
        y = 34;
      }
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Qty: ${totals.qty.toFixed(3)} | Total (Inc. Tax): ${formatCurrency(totals.subtotal)}`, margin, y + rowHeight);
      doc.save(`items_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      printActiveReportTable();
    }
  };

  const handleSort = (sortKey: ColKey) => {
    setSortState((prev) => {
      if (prev.key === sortKey) {
        return { key: sortKey, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      const defaultDirection: SortDirection = (
        sortKey === 'purchaseDate'
        || sortKey === 'sellDate'
        || sortKey === 'purchasePrice'
        || sortKey === 'sellQty'
        || sortKey === 'sellingPrice'
        || sortKey === 'subtotal'
      ) ? 'desc' : 'asc';
      return { key: sortKey, direction: defaultDirection };
    });
  };

  const cols: Array<[ColKey, string]> = [
    ['product', 'Product'], ['sku', 'SKU'], ['description', 'Description'], ['purchaseDate', 'Purchase Date'], ['purchaseRef', 'Purchase'],
    ['lot', 'Lot Number'], ['supplier', 'Supplier'], ['purchasePrice', 'Purchase Price'], ['sellDate', 'Sell Date'], ['saleRef', 'Sale'],
    ['customer', 'Customer'], ['location', 'Location'], ['sellQty', 'Sell Quantity'], ['sellingPrice', 'Selling Price'], ['subtotal', 'Total (Inc. Tax)'],
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
          <Package size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Items Report</h1>
          <p className="text-slate-500 text-sm mt-0.5">Product sales and purchase summary</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
<div className="flex items-center gap-2 mb-2 text-blue-600 font-bold text-sm cursor-pointer w-fit" onClick={() => setShowFilters(!showFilters)}>
          <Filter size={16} /> Filters
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 pt-2 animate-in slide-in-from-top-2">
            <MultiSelect label="Supplier" options={supplierOptions} selected={filters.supplier} onChange={(v) => setFilters({ ...filters, supplier: v })} />
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Purchase Date:</label>
              <DateRangeFilter
                allowAllTime
                initialRange={purchaseRange}
                onRangeSelect={(r) => setPurchaseRange(r as DateRangeValue)}
              />
            </div>
            <MultiSelect label="Customer" options={customerOptions} selected={filters.customer} onChange={(v) => setFilters({ ...filters, customer: v })} />
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Sell Date:</label>
              <DateRangeFilter
                allowAllTime
                initialRange={sellRange}
                onRangeSelect={(r) => setSellRange(r as DateRangeValue)}
              />
            </div>
            <MultiSelect label="Business Location" options={locationOptions} selected={filters.location} onChange={(v) => setFilters({ ...filters, location: v })} />
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 font-bold">Show</span>
            <select className="border border-slate-300 rounded px-2 py-1 text-xs outline-none" value={entriesPerPage} onChange={(e) => setEntriesPerPage(Number(e.target.value) || 25)}>
              <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
            </select>
            <span className="text-xs text-slate-600 font-bold">entries</span>
          </div>
          <div className="flex gap-1">
            <button onClick={exportCsv} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10} /> Export CSV</button>
            <button onClick={exportExcel} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileSpreadsheet size={10} /> Export Excel</button>
            <button onClick={() => printActiveReportTable()} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Printer size={10} /> Print</button>
            <div className="relative">
              <button data-items-col-btn onClick={() => setShowColumns((v) => !v)} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Columns size={10} /> Column visibility</button>
              {showColumns && (
                <div data-items-col-menu className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-2 space-y-1">
                  {cols.map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer text-xs">
                      <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={visible[k]} onChange={() => setVisible((p) => ({ ...p, [k]: !p[k] }))} />
                      <span className="text-slate-700 font-medium">{label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <button onClick={exportPdf} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Download size={10} /> Export PDF</button>
          </div>
          <div className="flex items-center gap-2"><Search className="text-slate-400" size={14} /><input type="text" placeholder="Search..." className="pl-2 py-1 border border-slate-300 rounded text-xs outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-[11px] text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                {cols.map(([k, label]) => visible[k] && (
                  <th
                    key={k}
                    onClick={() => handleSort(k)}
                    className={`px-4 py-3 whitespace-nowrap cursor-pointer select-none ${['purchasePrice', 'sellQty', 'sellingPrice', 'subtotal'].includes(k) ? 'text-right' : ''}`}
                  >
                    {label}
                    <ArrowUpDown
                      size={10}
                      className={`inline ml-1 transition-transform ${sortState.key === k && sortState.direction === 'desc' ? 'rotate-180' : ''} ${sortState.key === k ? 'text-blue-600' : 'text-slate-400'}`}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  {visible.product && <td className="px-4 py-2 font-medium text-slate-700">{r.product}</td>}
                  {visible.sku && <td className="px-4 py-2 text-slate-500 font-mono">{r.sku || '--'}</td>}
                  {visible.description && <td className="px-4 py-2 text-slate-600">{r.description || '--'}</td>}
                  {visible.purchaseDate && <td className="px-4 py-2 text-slate-600">{formatDateBySettings(r.purchaseDateRaw, settings.dateFormat, settings.timeFormat)}</td>}
                  {visible.purchaseRef && <td className="px-4 py-2 text-slate-600">{r.purchaseRef || '--'}</td>}
                  {visible.lot && <td className="px-4 py-2 text-slate-600">{r.lot || '--'}</td>}
                  {visible.supplier && <td className="px-4 py-2 text-slate-600">{r.supplier || '--'}</td>}
                  {visible.purchasePrice && <td className="px-4 py-2 text-right text-slate-600">{formatCurrency(r.purchasePrice)}</td>}
                  {visible.sellDate && <td className="px-4 py-2 text-slate-600">{formatDateBySettings(r.sellDateRaw, settings.dateFormat, settings.timeFormat)}</td>}
                  {visible.saleRef && <td className="px-4 py-2 text-slate-700 font-bold">{r.saleRef}</td>}
                  {visible.customer && <td className="px-4 py-2 text-slate-600">{r.customer}</td>}
                  {visible.location && <td className="px-4 py-2 text-[10px] text-slate-500 max-w-[130px] truncate">{r.location || '--'}</td>}
                  {visible.sellQty && <td className="px-4 py-2 text-right font-medium text-slate-700">{r.sellQty.toFixed(3)} {r.unit || ''}</td>}
                  {visible.sellingPrice && <td className="px-4 py-2 text-right text-slate-600">{formatCurrency(r.sellingPrice)}</td>}
                  {visible.subtotal && <td className="px-4 py-2 text-right font-bold text-slate-800">{formatCurrency(r.subtotal)}</td>}
                </tr>
              ))}
              {pageRows.length === 0 && <tr><td colSpan={Math.max(1, cols.filter(([k]) => visible[k]).length)} className="px-4 py-10 text-center text-slate-400 italic">No data available in table</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <div>Showing {from} to {to} of {totalEntries} entries</div>
          <div className="font-bold text-slate-700">Total Qty: {totals.qty.toFixed(3)} | Total (Inc. Tax): {formatCurrency(totals.subtotal)}</div>
          <div className="flex gap-1">
            <button type="button" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
            <button className="px-2 py-1 bg-blue-600 text-white rounded shadow-sm">{safePage}</button>
            <button type="button" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportItems;


