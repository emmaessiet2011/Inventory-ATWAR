import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  List,
  Printer,
  Search,
  ShoppingBag,
  Tag,BarChart2} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import { useGlobalContext } from '../src/context/GlobalContext';

import MultiSelect from './MultiSelect';

import { printActiveReportTable } from '../src/utils/printUtils';
import { parseExpenseDateToMs } from '../src/utils/expenses';

interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

type TabId = 'detailed' | 'detailed_purchase' | 'grouped' | 'category' | 'detailed_category' | 'brand';
type SortDirection = 'asc' | 'desc';

interface SortState {
  key: string;
  direction: SortDirection;
}

interface ReturnBucket {
  qty: number;
  amount: number;
}

interface InventoryChunk {
  id: string;
  dateMs: number;
  qty: number;
  ref: string;
  lot: string;
  supplier: string;
}

interface DetailRow {
  id: string;
  productKey: string;
  product: string;
  sku: string;
  customer: string;
  contactId: string;
  customerGroup: string;
  invoiceNo: string;
  dateMs: number;
  dateRaw: string;
  qty: number;
  unit: string;
  unitPrice: number;
  discount: number;
  tax: number;
  priceIncTax: number;
  total: number;
  paymentMethod: string;
  location: string;
  category: string;
  brand: string;
  currentStock: number;
  purchaseRef: string;
  lotNumber: string;
  supplierName: string;
}

interface ColumnDef {
  key: string;
  label: string;
  numeric?: boolean;
  currency?: boolean;
  qty?: boolean;
}

type ReportRow = Record<string, string | number>;

interface DetailedCategorySection {
  category: string;
  items: ReportRow[];
  totalQty: number;
  categoryTotal: number;
}

const tabs: Array<{ id: TabId; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: 'detailed', label: 'Detailed', icon: List },
  { id: 'detailed_purchase', label: 'Detailed (With Purchase)', icon: ShoppingBag },
  { id: 'grouped', label: 'Grouped (By Date)', icon: Calendar },
  { id: 'category', label: 'By Category', icon: Layers },
  { id: 'detailed_category', label: 'Detailed Category', icon: Layers },
  { id: 'brand', label: 'By Brand', icon: Tag },
];

const columnsByTab: Record<TabId, ColumnDef[]> = {
  detailed: [
    { key: 'product', label: 'Product' },
    { key: 'sku', label: 'SKU' },
    { key: 'customer', label: 'Customer Name' },
    { key: 'contactId', label: 'Contact ID' },
    { key: 'invoiceNo', label: 'Invoice No.' },
    { key: 'dateMs', label: 'Date', numeric: true },
    { key: 'qty', label: 'Quantity', numeric: true, qty: true },
    { key: 'unitPrice', label: 'Unit Price', numeric: true, currency: true },
    { key: 'discount', label: 'Discount', numeric: true },
    { key: 'tax', label: 'Tax', numeric: true },
    { key: 'priceIncTax', label: 'Price Inc. Tax', numeric: true, currency: true },
    { key: 'total', label: 'Total', numeric: true, currency: true },
    { key: 'paymentMethod', label: 'Payment Method' },
  ],
  detailed_purchase: [
    { key: 'product', label: 'Product' },
    { key: 'sku', label: 'SKU' },
    { key: 'customer', label: 'Customer Name' },
    { key: 'invoiceNo', label: 'Invoice No.' },
    { key: 'dateMs', label: 'Date', numeric: true },
    { key: 'purchaseRef', label: 'Purchase Ref No.' },
    { key: 'lotNumber', label: 'Lot Number' },
    { key: 'supplierName', label: 'Supplier Name' },
    { key: 'qty', label: 'Quantity', numeric: true, qty: true },
  ],
  grouped: [
    { key: 'product', label: 'Product' },
    { key: 'sku', label: 'SKU' },
    { key: 'dateMs', label: 'Date', numeric: true },
    { key: 'currentStock', label: 'Current Stock', numeric: true, qty: true },
    { key: 'totalUnitSold', label: 'Total Unit Sold', numeric: true, qty: true },
    { key: 'total', label: 'Total', numeric: true, currency: true },
  ],
  category: [
    { key: 'category', label: 'Category' },
    { key: 'currentStock', label: 'Current Stock', numeric: true, qty: true },
    { key: 'totalUnitSold', label: 'Total Unit Sold', numeric: true, qty: true },
    { key: 'total', label: 'Total', numeric: true, currency: true },
  ],
  detailed_category: [
    { key: 'category', label: 'Category' },
    { key: 'product', label: 'Name' },
    { key: 'qty', label: 'Quantity', numeric: true, qty: true },
    { key: 'unitPrice', label: 'Unit Price', numeric: true, currency: true },
    { key: 'total', label: 'Total', numeric: true, currency: true },
  ],
  brand: [
    { key: 'brand', label: 'Brand' },
    { key: 'currentStock', label: 'Current Stock', numeric: true, qty: true },
    { key: 'totalUnitSold', label: 'Total Unit Sold', numeric: true, qty: true },
    { key: 'total', label: 'Total', numeric: true, currency: true },
  ],
};

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const round3 = (value: number) => Math.round(value * 1000) / 1000;
const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const allTime = (): DateRangeValue => ({ startDate: null, endDate: null, label: 'All Time' });

const parseMs = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) return Number.NaN;
  const direct = Date.parse(raw);
  if (Number.isFinite(direct)) return direct;
  return parseExpenseDateToMs(raw);
};

const toStartMs = (value: Date | null): number | null => (
  value ? new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0).getTime() : null
);
const toEndMs = (value: Date | null): number | null => (
  value ? new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999).getTime() : null
);

const inRange = (ms: number, start: number | null, end: number | null, active: boolean) => {
  if (!active) return true;
  if (!Number.isFinite(ms)) return false;
  if (start != null && ms < start) return false;
  if (end != null && ms > end) return false;
  return true;
};

const formatDate = (ms: number, dateFormat: string) => {
  if (!Number.isFinite(ms)) return '--';
  const date = new Date(ms);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return dateFormat === 'mm/dd/yyyy' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
};

const formatDateTime = (raw: string, dateFormat: string, timeFormat: string) => {
  const ms = parseMs(raw);
  if (!Number.isFinite(ms)) return raw || '--';
  const dateOnly = formatDate(ms, dateFormat);
  const hasTime = /(\d{1,2}:\d{2})|([AP]M)/i.test(raw);
  if (!hasTime) return dateOnly;
  const value = new Date(ms);
  const hh = value.getHours();
  const mm = String(value.getMinutes()).padStart(2, '0');
  if (timeFormat === '24') return `${dateOnly} ${String(hh).padStart(2, '0')}:${mm}`;
  const meridiem = hh >= 12 ? 'PM' : 'AM';
  const hour12 = String(hh % 12 || 12).padStart(2, '0');
  return `${dateOnly} ${hour12}:${mm} ${meridiem}`;
};

const downloadFile = (name: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

const sortRows = <T extends ReportRow>(rows: T[], sort: SortState): T[] => {
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((left, right) => {
    const lv = left[sort.key];
    const rv = right[sort.key];
    if (typeof lv === 'number' && typeof rv === 'number') return (lv - rv) * factor;
    return String(lv ?? '').localeCompare(String(rv ?? ''), undefined, { numeric: true, sensitivity: 'base' }) * factor;
  });
};

const ReportProductSell: React.FC = () => {
  const { locations, products, customers, customerGroups, sales, sellReturns, purchases, purchaseReturns, settings, formatCurrency } = useGlobalContext();
  const [activeTab, setActiveTab] = useState<TabId>('detailed');
  const [showFilters, setShowFilters] = useState(true);
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [productSearch, setProductSearch] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeValue>(allTime);
  const [filters, setFilters] = useState({
    customer: [] as string[],
    customerGroup: [] as string[],
    location: [] as string[],
    category: [] as string[],
    brand: [] as string[],
  });
  const [sortByTab, setSortByTab] = useState<Record<TabId, SortState>>({
    detailed: { key: 'dateMs', direction: 'desc' },
    detailed_purchase: { key: 'dateMs', direction: 'desc' },
    grouped: { key: 'dateMs', direction: 'desc' },
    category: { key: 'total', direction: 'desc' },
    detailed_category: { key: 'total', direction: 'desc' },
    brand: { key: 'total', direction: 'desc' },
  });

  const qtyPrecision = useMemo(() => {
    const parsed = Number(settings.quantityPrecision);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(6, Math.floor(parsed))) : 3;
  }, [settings.quantityPrecision]);
  const qty = (value: number) => round3(Number(value || 0)).toFixed(qtyPrecision);

  const productById = useMemo(() => {
    const map = new Map<string, (typeof products)[number]>();
    products.forEach((p) => map.set(String(p.id || ''), p));
    return map;
  }, [products]);
  const productByName = useMemo(() => {
    const map = new Map<string, (typeof products)[number]>();
    products.forEach((p) => { const key = normalize(p.name); if (key) map.set(key, p); });
    return map;
  }, [products]);
  const customerById = useMemo(() => {
    const map = new Map<string, (typeof customers)[number]>();
    customers.forEach((c) => { const key = normalize(c.id); if (key) map.set(key, c); });
    return map;
  }, [customers]);
  const groupById = useMemo(() => {
    const map = new Map<string, string>();
    customerGroups.forEach((g) => { const key = normalize(g.id); if (key) map.set(key, String(g.name || '').trim()); });
    return map;
  }, [customerGroups]);

  const inventoryLookup = useMemo(() => {
    const byId = new Map<string, InventoryChunk[]>();
    const bySku = new Map<string, InventoryChunk[]>();
    const byName = new Map<string, InventoryChunk[]>();

    const mapKey = (locationNorm: string, tokenNorm: string) => `${locationNorm}@@${tokenNorm}`;
    const push = (target: Map<string, InventoryChunk[]>, key: string, value: InventoryChunk) => {
      const existing = target.get(key);
      if (existing) existing.push(value); else target.set(key, [value]);
    };
    const indexChunk = (
      locationNorm: string,
      idNorm: string,
      skuNorm: string,
      nameNorm: string,
      chunk: InventoryChunk,
    ) => {
      if (idNorm) push(byId, mapKey(locationNorm, idNorm), chunk);
      if (skuNorm) push(bySku, mapKey(locationNorm, skuNorm), chunk);
      if (nameNorm) push(byName, mapKey(locationNorm, nameNorm), chunk);
    };

    let chunkCounter = 0;
    const addChunk = (
      locationNorm: string,
      idNorm: string,
      skuNorm: string,
      nameNorm: string,
      chunkInput: Omit<InventoryChunk, 'id'>,
    ) => {
      if (!locationNorm || (!idNorm && !skuNorm && !nameNorm)) return;
      const quantity = round3(Number(chunkInput.qty || 0));
      if (!Number.isFinite(quantity) || quantity <= 0) return;
      const chunk: InventoryChunk = {
        id: `INV-${chunkCounter++}`,
        dateMs: Number.isFinite(chunkInput.dateMs) ? chunkInput.dateMs : Number.MAX_SAFE_INTEGER,
        qty: quantity,
        ref: String(chunkInput.ref || '--').trim() || '--',
        lot: String(chunkInput.lot || '--').trim() || '--',
        supplier: String(chunkInput.supplier || '--').trim() || '--',
      };
      indexChunk(locationNorm, idNorm, skuNorm, nameNorm, chunk);
    };

    products.forEach((product, index) => {
      const openingQty = round3(Number(product.openingStock || 0));
      if (!Number.isFinite(openingQty) || openingQty <= 0) return;
      const locationNorm = normalize(product.openingStockLocation || product.businessLocation);
      if (!locationNorm) return;
      addChunk(
        locationNorm,
        normalize(product.id),
        normalize(product.sku),
        normalize(product.name),
        {
          dateMs: -2208988800000 + index,
          qty: openingQty,
          ref: '(Opening Stock)',
          lot: String(product.lotNumber || '').trim() || '--',
          supplier: '--',
        },
      );
    });

    purchases.forEach((purchase) => {
      if (normalize(purchase.status) !== 'received') return;
      const locationNorm = normalize(purchase.location);
      if (!locationNorm) return;
      const dateMs = parseMs(purchase.date);
      const ref = String(purchase.refNo || purchase.id || '--').trim() || '--';
      const supplier = String(purchase.supplier || '--').trim() || '--';
      (purchase.items || []).forEach((item) => {
        const quantity = round3(Number(item.qty || 0));
        if (!Number.isFinite(quantity) || quantity <= 0) return;
        const matched = productById.get(String(item.id || '')) || productByName.get(normalize(item.name));
        const idNorm = normalize(item.id || matched?.id);
        const skuNorm = normalize(matched?.sku);
        const nameNorm = normalize(item.name || matched?.name);
        if (!idNorm && !skuNorm && !nameNorm) return;
        addChunk(locationNorm, idNorm, skuNorm, nameNorm, {
          dateMs,
          qty: quantity,
          ref,
          lot: String(item.lot || matched?.lotNumber || '').trim() || '--',
          supplier,
        });
      });
    });

    const sortRows = (target: Map<string, InventoryChunk[]>) => {
      target.forEach((rows) => rows.sort((left, right) => {
        if (left.dateMs !== right.dateMs) return left.dateMs - right.dateMs;
        return left.id.localeCompare(right.id);
      }));
    };
    sortRows(byId);
    sortRows(bySku);
    sortRows(byName);

    const consume = (rows: InventoryChunk[] | undefined, quantity: number, preferredLotNorm = '') => {
      if (!rows || rows.length === 0 || quantity <= 0) return;
      const ordered = rows
        .filter((row) => row.qty > 0)
        .sort((left, right) => {
          if (preferredLotNorm) {
            const leftRank = normalize(left.lot) === preferredLotNorm ? 0 : 1;
            const rightRank = normalize(right.lot) === preferredLotNorm ? 0 : 1;
            if (leftRank !== rightRank) return leftRank - rightRank;
          }
          if (left.dateMs !== right.dateMs) return left.dateMs - right.dateMs;
          return left.id.localeCompare(right.id);
        });
      let remaining = round3(quantity);
      ordered.forEach((row) => {
        if (remaining <= 0 || row.qty <= 0) return;
        const consumed = round3(Math.min(row.qty, remaining));
        if (consumed <= 0) return;
        row.qty = round3(Math.max(0, row.qty - consumed));
        remaining = round3(Math.max(0, remaining - consumed));
      });
    };

    const returnRecords = [...purchaseReturns].sort((left, right) => {
      const leftMs = parseMs(left.date);
      const rightMs = parseMs(right.date);
      const safeLeftMs = Number.isFinite(leftMs) ? leftMs : Number.MAX_SAFE_INTEGER;
      const safeRightMs = Number.isFinite(rightMs) ? rightMs : Number.MAX_SAFE_INTEGER;
      return safeLeftMs - safeRightMs;
    });
    returnRecords.forEach((record) => {
      const locationNorm = normalize(record.location);
      if (!locationNorm) return;
      (record.items || []).forEach((item) => {
        const quantity = round3(Number(item.quantity || 0));
        if (!Number.isFinite(quantity) || quantity <= 0) return;
        const matched = productById.get(String(item.productId || '')) || productByName.get(normalize(item.productName));
        const idNorm = normalize(item.productId || matched?.id);
        const skuNorm = normalize(matched?.sku);
        const nameNorm = normalize(item.productName || matched?.name);
        const preferredLotNorm = normalize(item.lotNumber);
        const rows = (
          idNorm ? byId.get(mapKey(locationNorm, idNorm)) : undefined
        ) || (
          skuNorm ? bySku.get(mapKey(locationNorm, skuNorm)) : undefined
        ) || (
          nameNorm ? byName.get(mapKey(locationNorm, nameNorm)) : undefined
        );
        consume(rows, quantity, preferredLotNorm);
      });
    });

    return { byId, bySku, byName };
  }, [products, purchases, purchaseReturns, productById, productByName]);

  const sellReturnLookup = useMemo(() => {
    const byId = new Map<string, ReturnBucket>();
    const byName = new Map<string, ReturnBucket>();
    const add = (target: Map<string, ReturnBucket>, key: string, qtyDelta: number, amountDelta: number) => {
      const existing = target.get(key);
      if (existing) {
        existing.qty = round3(existing.qty + qtyDelta);
        existing.amount = round3(existing.amount + amountDelta);
      } else {
        target.set(key, { qty: round3(qtyDelta), amount: round3(amountDelta) });
      }
    };
    sellReturns.forEach((record) => {
      const saleIdNorm = normalize(record.parentSaleId);
      if (!saleIdNorm) return;
      (record.items || []).forEach((item) => {
        const lineQty = Number(item.qty || 0);
        if (!Number.isFinite(lineQty) || lineQty <= 0) return;
        const lineAmount = Math.max(0, Number(item.lineTotal || 0));
        const idNorm = normalize(item.productId);
        const nameNorm = normalize(item.productName);
        if (idNorm) { add(byId, `${saleIdNorm}@@${idNorm}`, lineQty, lineAmount); return; }
        if (nameNorm) add(byName, `${saleIdNorm}@@${nameNorm}`, lineQty, lineAmount);
      });
    });
    return { byId, byName };
  }, [sellReturns]);

  const detailRows = useMemo<DetailRow[]>(() => {
    const remainingById = new Map<string, ReturnBucket>(Array.from(sellReturnLookup.byId.entries()).map(([k, v]) => [k, { ...v }]));
    const remainingByName = new Map<string, ReturnBucket>(Array.from(sellReturnLookup.byName.entries()).map(([k, v]) => [k, { ...v }]));
    const clonedChunks = new Map<string, InventoryChunk>();
    const cloneRows = (rows: InventoryChunk[]) => rows.map((row) => {
      const existing = clonedChunks.get(row.id);
      if (existing) return existing;
      const copy = { ...row };
      clonedChunks.set(row.id, copy);
      return copy;
    });
    const cloneLookupMap = (source: Map<string, InventoryChunk[]>) => {
      const cloned = new Map<string, InventoryChunk[]>();
      source.forEach((rows, key) => cloned.set(key, cloneRows(rows)));
      return cloned;
    };
    const workingInventory = {
      byId: cloneLookupMap(inventoryLookup.byId),
      bySku: cloneLookupMap(inventoryLookup.bySku),
      byName: cloneLookupMap(inventoryLookup.byName),
    };
    type WorkingRow = Omit<DetailRow, 'purchaseRef' | 'lotNumber' | 'supplierName'> & {
      locationNorm: string;
      idNorm: string;
      skuNorm: string;
      nameNorm: string;
      fallbackLot: string;
      hasOpeningStock: boolean;
      fifoDateMs: number;
    };

    const rows: WorkingRow[] = sales.flatMap((sale) => {
      if (normalize(sale.status || sale.saleStatus) !== 'final') return [];
      const dateRaw = String(sale.date || '').trim();
      const dateMs = parseMs(dateRaw);
      const fifoDateMs = Number.isFinite(dateMs) ? dateMs : Number.MAX_SAFE_INTEGER;
      const location = String(sale.location || '--').trim() || '--';
      const locationNorm = normalize(location);
      const saleIdNorm = normalize(sale.id);
      const customerRecord = customerById.get(normalize(sale.customerId));
      const customer = String(sale.customerName || customerRecord?.businessName || customerRecord?.name || 'Direct Customer').trim() || 'Direct Customer';
      const customerGroup = String(sale.customerGroup || groupById.get(normalize(sale.customerGroupId)) || customerRecord?.customerGroup || '--').trim() || '--';
      const invoiceNo = String(sale.invoiceNo || sale.id || '--').trim() || '--';
      const contactId = String(sale.customerId || customerRecord?.id || customer).trim() || customer;
      const paymentMethod = String(sale.paymentMethod || sale.saleType || '--').trim() || '--';

      return (sale.items || []).flatMap((item, idx) => {
        const grossQty = round3(Number(item.qty || 0));
        if (!Number.isFinite(grossQty) || grossQty <= 0) return [];
        const product = productById.get(String(item.id || '')) || productByName.get(normalize(item.name));
        const name = String(item.name || product?.name || 'Unknown Product').trim() || 'Unknown Product';
        const sku = String(product?.sku || item.id || '').trim();
        const category = String(product?.category || '--').trim() || '--';
        const brand = String(product?.brand || '--').trim() || '--';
        const unit = String(item.unit || product?.unit || 'Pc(s)').trim() || 'Pc(s)';
        const unitPrice = round3(Number(item.unitPrice || 0));
        const grossDiscount = Math.max(0, round3(Number(item.discount || 0)));
        const grossTax = Math.max(0, round3(Number(item.tax || 0)));
        const grossSubtotal = round3(Number.isFinite(Number(item.subtotal)) ? Number(item.subtotal) : Math.max(0, grossQty * unitPrice - grossDiscount));
        const grossTotal = round3(Number.isFinite(Number(item.total)) ? Number(item.total) : Math.max(0, grossSubtotal + grossTax));
        const idNorm = normalize(item.id || product?.id);
        const skuNorm = normalize(product?.sku);
        const nameNorm = normalize(item.name || product?.name);
        const productKey = idNorm ? `id@@${idNorm}` : skuNorm ? `sku@@${skuNorm}` : `name@@${nameNorm || normalize(name)}`;

        const bucket = (
          idNorm ? remainingById.get(`${saleIdNorm}@@${idNorm}`) : undefined
        ) || (
          nameNorm ? remainingByName.get(`${saleIdNorm}@@${nameNorm}`) : undefined
        );

        let netQty = grossQty;
        let netTotal = grossTotal;
        if (bucket && bucket.qty > 0) {
          const deductedQty = Math.min(netQty, bucket.qty);
          bucket.qty = round3(Math.max(0, bucket.qty - deductedQty));
          const proportionalAmount = grossQty > 0 ? grossTotal * (deductedQty / grossQty) : 0;
          const amountBudget = bucket.amount > 0 ? bucket.amount : proportionalAmount;
          const deductedAmount = Math.min(netTotal, Math.max(0, proportionalAmount), Math.max(0, amountBudget));
          netTotal = round3(Math.max(0, netTotal - deductedAmount));
          if (bucket.amount > 0) bucket.amount = round3(Math.max(0, bucket.amount - deductedAmount));
          netQty = round3(Math.max(0, netQty - deductedQty));
        }
        if (netQty <= 0 && netTotal <= 0) return [];
        const factor = grossQty > 0 ? netQty / grossQty : 0;
        const currentStock = round3(Number(product?.stock || 0));
        const priceIncTax = netQty > 0 ? round3(netTotal / netQty) : 0;

        const opening = Number(product?.openingStock || 0) > 0
          && (!product?.openingStockLocation || normalize(product.openingStockLocation) === locationNorm);
        const fallbackLot = String(product?.lotNumber || '').trim() || '--';

        return [{
          id: `${sale.id}-${idx}`,
          productKey,
          product: name,
          sku,
          customer,
          contactId,
          customerGroup,
          invoiceNo,
          dateMs,
          dateRaw,
          qty: netQty,
          unit,
          unitPrice,
          discount: round3(grossDiscount * factor),
          tax: round3(grossTax * factor),
          priceIncTax,
          total: netTotal,
          paymentMethod,
          location,
          category,
          brand,
          currentStock,
          locationNorm,
          idNorm,
          skuNorm,
          nameNorm,
          fallbackLot,
          hasOpeningStock: opening,
          fifoDateMs,
        }];
      });
    });

    const summarize = (values: string[], fallback: string) => {
      const unique = Array.from(
        new Set(
          values
            .map((value) => String(value || '').trim())
            .filter((value) => value && value !== '--'),
        ),
      );
      if (unique.length === 0) return fallback;
      if (unique.length === 1) return unique[0];
      if (unique.length === 2) return `${unique[0]}, ${unique[1]}`;
      return `${unique[0]}, ${unique[1]} +${unique.length - 2} more`;
    };

    const allocatedByRowId = new Map<string, { purchaseRef: string; lotNumber: string; supplierName: string }>();
    [...rows]
      .sort((left, right) => {
        if (left.fifoDateMs !== right.fifoDateMs) return left.fifoDateMs - right.fifoDateMs;
        return left.id.localeCompare(right.id);
      })
      .forEach((row) => {
        const inventoryRows = (
          row.idNorm ? workingInventory.byId.get(`${row.locationNorm}@@${row.idNorm}`) : undefined
        ) || (
          row.skuNorm ? workingInventory.bySku.get(`${row.locationNorm}@@${row.skuNorm}`) : undefined
        ) || (
          row.nameNorm ? workingInventory.byName.get(`${row.locationNorm}@@${row.nameNorm}`) : undefined
        );

        let remainingQty = round3(row.qty);
        const refs: string[] = [];
        const lots: string[] = [];
        const suppliers: string[] = [];
        if (inventoryRows && inventoryRows.length > 0 && remainingQty > 0) {
          const ordered = inventoryRows
            .filter((item) => item.qty > 0)
            .sort((left, right) => {
              if (left.dateMs !== right.dateMs) return left.dateMs - right.dateMs;
              return left.id.localeCompare(right.id);
            });

          ordered.forEach((item) => {
            if (remainingQty <= 0 || item.qty <= 0) return;
            const usedQty = round3(Math.min(item.qty, remainingQty));
            if (usedQty <= 0) return;
            item.qty = round3(Math.max(0, item.qty - usedQty));
            remainingQty = round3(Math.max(0, remainingQty - usedQty));
            refs.push(item.ref);
            lots.push(item.lot);
            suppliers.push(item.supplier);
          });
        }

        allocatedByRowId.set(row.id, {
          purchaseRef: summarize(refs, row.hasOpeningStock ? '(Opening Stock)' : '--'),
          lotNumber: summarize(lots, row.fallbackLot || '--'),
          supplierName: summarize(suppliers, '--'),
        });
      });

    return rows
      .map((row) => {
        const {
          locationNorm: _locationNorm,
          idNorm: _idNorm,
          skuNorm: _skuNorm,
          nameNorm: _nameNorm,
          fallbackLot,
          hasOpeningStock,
          fifoDateMs: _fifoDateMs,
          ...baseRow
        } = row;
        const allocated = allocatedByRowId.get(row.id);
        return {
          ...baseRow,
          purchaseRef: allocated?.purchaseRef || (hasOpeningStock ? '(Opening Stock)' : '--'),
          lotNumber: allocated?.lotNumber || fallbackLot || '--',
          supplierName: allocated?.supplierName || '--',
        };
      })
      .sort((left, right) => {
        const leftMs = Number.isFinite(left.dateMs) ? left.dateMs : Number.MIN_SAFE_INTEGER;
        const rightMs = Number.isFinite(right.dateMs) ? right.dateMs : Number.MIN_SAFE_INTEGER;
        return rightMs - leftMs;
      });
  }, [sales, sellReturnLookup, productById, productByName, customerById, groupById, inventoryLookup]);

  const customerOptions = useMemo(() => Array.from(new Set([...customers.map((c) => String(c.businessName || c.name || '').trim()), ...detailRows.map((r) => r.customer)].filter(Boolean))).sort(), [customers, detailRows]);
  const customerGroupOptions = useMemo(() => Array.from(new Set([...customerGroups.map((g) => String(g.name || '').trim()), ...detailRows.map((r) => r.customerGroup)].filter((v) => Boolean(v) && v !== '--'))).sort(), [customerGroups, detailRows]);
  const locationOptions = useMemo(() => Array.from(new Set([...locations.map((l) => String(l.name || '').trim()), ...detailRows.map((r) => r.location)].filter(Boolean))).sort(), [locations, detailRows]);
  const categoryOptions = useMemo(() => Array.from(new Set([...products.map((p) => String(p.category || '').trim()), ...detailRows.map((r) => r.category)].filter((v) => Boolean(v) && v !== '--'))).sort(), [products, detailRows]);
  const brandOptions = useMemo(() => Array.from(new Set([...products.map((p) => String(p.brand || '').trim()), ...detailRows.map((r) => r.brand)].filter((v) => Boolean(v) && v !== '--'))).sort(), [products, detailRows]);

  const startMs = useMemo(() => toStartMs(dateRange.startDate), [dateRange.startDate]);
  const endMs = useMemo(() => toEndMs(dateRange.endDate), [dateRange.endDate]);
  const hasDateFilter = startMs != null || endMs != null;
  const selectedCustomer = useMemo(() => new Set(filters.customer.map(normalize)), [filters.customer]);
  const selectedGroup = useMemo(() => new Set(filters.customerGroup.map(normalize)), [filters.customerGroup]);
  const selectedLocation = useMemo(() => new Set(filters.location.map(normalize)), [filters.location]);
  const selectedCategory = useMemo(() => new Set(filters.category.map(normalize)), [filters.category]);
  const selectedBrand = useMemo(() => new Set(filters.brand.map(normalize)), [filters.brand]);

  const filteredDetailRows = useMemo(() => {
    const productQuery = normalize(productSearch);
    const tableQuery = normalize(tableSearch);
    return detailRows.filter((row) => {
      if (!inRange(row.dateMs, startMs, endMs, hasDateFilter)) return false;
      if (selectedCustomer.size > 0 && !selectedCustomer.has(normalize(row.customer))) return false;
      if (selectedGroup.size > 0 && !selectedGroup.has(normalize(row.customerGroup))) return false;
      if (selectedLocation.size > 0 && !selectedLocation.has(normalize(row.location))) return false;
      if (selectedCategory.size > 0 && !selectedCategory.has(normalize(row.category))) return false;
      if (selectedBrand.size > 0 && !selectedBrand.has(normalize(row.brand))) return false;
      if (productQuery) {
        const hay = [row.product, row.sku, row.invoiceNo, row.customer].map(normalize);
        if (!hay.some((v) => v.includes(productQuery))) return false;
      }
      if (tableQuery) {
        const hay = [row.product, row.sku, row.customer, row.contactId, row.customerGroup, row.invoiceNo, row.location, row.category, row.brand, row.paymentMethod, row.purchaseRef, row.lotNumber, row.supplierName, row.dateRaw].map(normalize);
        if (!hay.some((v) => v.includes(tableQuery))) return false;
      }
      return true;
    });
  }, [detailRows, startMs, endMs, hasDateFilter, selectedCustomer, selectedGroup, selectedLocation, selectedCategory, selectedBrand, productSearch, tableSearch]);

  const groupedRows = useMemo(() => {
    const map = new Map<string, ReportRow>();
    filteredDetailRows.forEach((row) => {
      if (!Number.isFinite(row.dateMs)) return;
      const date = new Date(row.dateMs);
      const dayMs = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime();
      const key = `${row.productKey}@@${dayMs}`;
      const existing = map.get(key);
      if (existing) {
        existing.totalUnitSold = round3(Number(existing.totalUnitSold || 0) + row.qty);
        existing.total = round3(Number(existing.total || 0) + row.total);
      } else {
        map.set(key, { id: key, product: row.product, sku: row.sku, dateMs: dayMs, currentStock: row.currentStock, totalUnitSold: row.qty, total: row.total });
      }
    });
    return Array.from(map.values());
  }, [filteredDetailRows]);

  const categoryRows = useMemo(() => {
    const map = new Map<string, { row: ReportRow; seen: Set<string> }>();
    filteredDetailRows.forEach((row) => {
      const label = row.category || '--';
      const key = normalize(label) || '--';
      const existing = map.get(key);
      if (existing) {
        existing.row.totalUnitSold = round3(Number(existing.row.totalUnitSold || 0) + row.qty);
        existing.row.total = round3(Number(existing.row.total || 0) + row.total);
        if (!existing.seen.has(row.productKey)) {
          existing.row.currentStock = round3(Number(existing.row.currentStock || 0) + row.currentStock);
          existing.seen.add(row.productKey);
        }
      } else {
        map.set(key, { row: { id: key, category: label, currentStock: row.currentStock, totalUnitSold: row.qty, total: row.total }, seen: new Set([row.productKey]) });
      }
    });
    return Array.from(map.values()).map((v) => v.row);
  }, [filteredDetailRows]);

  const brandRows = useMemo(() => {
    const map = new Map<string, { row: ReportRow; seen: Set<string> }>();
    filteredDetailRows.forEach((row) => {
      const label = row.brand || '--';
      const key = normalize(label) || '--';
      const existing = map.get(key);
      if (existing) {
        existing.row.totalUnitSold = round3(Number(existing.row.totalUnitSold || 0) + row.qty);
        existing.row.total = round3(Number(existing.row.total || 0) + row.total);
        if (!existing.seen.has(row.productKey)) {
          existing.row.currentStock = round3(Number(existing.row.currentStock || 0) + row.currentStock);
          existing.seen.add(row.productKey);
        }
      } else {
        map.set(key, { row: { id: key, brand: label, currentStock: row.currentStock, totalUnitSold: row.qty, total: row.total }, seen: new Set([row.productKey]) });
      }
    });
    return Array.from(map.values()).map((v) => v.row);
  }, [filteredDetailRows]);

  const detailedCategoryRows = useMemo(() => {
    const map = new Map<string, ReportRow>();
    filteredDetailRows.forEach((row) => {
      const key = `${normalize(row.category)}@@${row.productKey}`;
      const existing = map.get(key);
      if (existing) {
        const nextQty = round3(Number(existing.qty || 0) + row.qty);
        const nextTotal = round3(Number(existing.total || 0) + row.total);
        existing.qty = nextQty;
        existing.total = nextTotal;
        existing.unitPrice = nextQty > 0 ? round3(nextTotal / nextQty) : 0;
      } else {
        map.set(key, { id: key, category: row.category, product: row.product, qty: row.qty, unitPrice: row.unitPrice, total: row.total });
      }
    });
    return Array.from(map.values());
  }, [filteredDetailRows]);

  const sortedByTab = useMemo(() => ({
    detailed: sortRows(filteredDetailRows as unknown as ReportRow[], sortByTab.detailed),
    detailed_purchase: sortRows(filteredDetailRows as unknown as ReportRow[], sortByTab.detailed_purchase),
    grouped: sortRows(groupedRows, sortByTab.grouped),
    category: sortRows(categoryRows, sortByTab.category),
    detailed_category: sortRows(detailedCategoryRows, sortByTab.detailed_category),
    brand: sortRows(brandRows, sortByTab.brand),
  }), [filteredDetailRows, groupedRows, categoryRows, detailedCategoryRows, brandRows, sortByTab]);

  const detailedCategorySections = useMemo<DetailedCategorySection[]>(() => {
    const categoryMap = new Map<string, { label: string; items: ReportRow[] }>();
    (sortedByTab.detailed_category as ReportRow[]).forEach((row) => {
      const category = String(row.category || '--').trim() || '--';
      const key = normalize(category) || '--';
      const existing = categoryMap.get(key);
      if (existing) {
        existing.items.push(row);
      } else {
        categoryMap.set(key, { label: category, items: [row] });
      }
    });

    const sections = Array.from(categoryMap.values()).map((entry) => {
      const totalQty = round3(entry.items.reduce((sum, row) => sum + Number(row.qty || 0), 0));
      const categoryTotal = round3(entry.items.reduce((sum, row) => sum + Number(row.total || 0), 0));
      return {
        category: entry.label,
        items: entry.items,
        totalQty,
        categoryTotal,
      };
    });

    const sort = sortByTab.detailed_category;
    const factor = sort.direction === 'asc' ? 1 : -1;
    return sections.sort((left, right) => {
      if (sort.key === 'category') {
        return left.category.localeCompare(right.category, undefined, { sensitivity: 'base' }) * factor;
      }
      if (sort.key === 'qty') return (left.totalQty - right.totalQty) * factor;
      if (sort.key === 'total') return (left.categoryTotal - right.categoryTotal) * factor;
      if (sort.key === 'unitPrice') {
        const leftAvg = left.totalQty > 0 ? left.categoryTotal / left.totalQty : 0;
        const rightAvg = right.totalQty > 0 ? right.categoryTotal / right.totalQty : 0;
        return (leftAvg - rightAvg) * factor;
      }
      return left.category.localeCompare(right.category, undefined, { sensitivity: 'base' }) * factor;
    });
  }, [sortedByTab.detailed_category, sortByTab.detailed_category]);

  useEffect(() => { setCurrentPage(1); }, [activeTab, productSearch, tableSearch, filters, dateRange.startDate, dateRange.endDate, entriesPerPage, sortByTab]);

  const activeColumns = columnsByTab[activeTab];
  const activeRows = sortedByTab[activeTab];
  const usePagination = activeTab !== 'detailed_category';
  const totalEntries = activeRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / entriesPerPage));
  const safePage = usePagination ? Math.min(currentPage, totalPages) : 1;
  const start = usePagination ? (safePage - 1) * entriesPerPage : 0;
  const pageRows = usePagination ? activeRows.slice(start, start + entriesPerPage) : activeRows;
  const displayedCount = activeTab === 'detailed_category'
    ? detailedCategorySections.reduce((sum, section) => sum + section.items.length, 0)
    : totalEntries;
  const from = displayedCount === 0 ? 0 : (usePagination ? start + 1 : 1);
  const to = displayedCount === 0 ? 0 : (usePagination ? start + pageRows.length : displayedCount);

  const summary = useMemo(() => {
    if (activeTab === 'detailed') {
      const totalQty = round3((sortedByTab.detailed as ReportRow[]).reduce((sum, row) => sum + Number(row.qty || 0), 0));
      const totalValue = round3((sortedByTab.detailed as ReportRow[]).reduce((sum, row) => sum + Number(row.total || 0), 0));
      return `Total Qty: ${qty(totalQty)} | Total: ${formatCurrency(totalValue)}`;
    }
    if (activeTab === 'detailed_purchase') {
      const totalQty = round3((sortedByTab.detailed_purchase as ReportRow[]).reduce((sum, row) => sum + Number(row.qty || 0), 0));
      return `Total Qty: ${qty(totalQty)}`;
    }
    if (activeTab === 'detailed_category') {
      const totalQty = round3((sortedByTab.detailed_category as ReportRow[]).reduce((sum, row) => sum + Number(row.qty || 0), 0));
      const totalValue = round3((sortedByTab.detailed_category as ReportRow[]).reduce((sum, row) => sum + Number(row.total || 0), 0));
      return `Total Qty: ${qty(totalQty)} | Total: ${formatCurrency(totalValue)}`;
    }
    const stock = round3((activeRows as ReportRow[]).reduce((sum, row) => sum + Number(row.currentStock || 0), 0));
    const sold = round3((activeRows as ReportRow[]).reduce((sum, row) => sum + Number(row.totalUnitSold || 0), 0));
    const total = round3((activeRows as ReportRow[]).reduce((sum, row) => sum + Number(row.total || 0), 0));
    return `Current Stock: ${qty(stock)} | Total Unit Sold: ${qty(sold)} | Total: ${formatCurrency(total)}`;
  }, [activeTab, activeRows, sortedByTab, formatCurrency, qty]);

  const renderValue = (column: ColumnDef, row: ReportRow): string => {
    const raw = row[column.key];
    if (column.key === 'dateMs') {
      if (activeTab === 'detailed' || activeTab === 'detailed_purchase') {
        return formatDateTime(String((row as unknown as DetailRow).dateRaw || ''), settings.dateFormat, settings.timeFormat);
      }
      return formatDate(Number(raw || 0), settings.dateFormat);
    }
    if (column.currency) return formatCurrency(Number(raw || 0));
    if (column.qty) {
      if (column.key === 'qty' && (activeTab === 'detailed' || activeTab === 'detailed_purchase')) {
        return `${qty(Number(raw || 0))} ${String((row as unknown as DetailRow).unit || '').trim()}`.trim();
      }
      return qty(Number(raw || 0));
    }
    if (column.numeric) return qty(Number(raw || 0));
    return String(raw || '--');
  };

  const exportValue = (column: ColumnDef, row: ReportRow): string => {
    const raw = row[column.key];
    if (column.key === 'dateMs') {
      return activeTab === 'detailed' || activeTab === 'detailed_purchase'
        ? formatDateTime(String((row as unknown as DetailRow).dateRaw || ''), settings.dateFormat, settings.timeFormat)
        : formatDate(Number(raw || 0), settings.dateFormat);
    }
    if (column.key === 'qty' && (activeTab === 'detailed' || activeTab === 'detailed_purchase')) return qty(Number(raw || 0));
    if (column.numeric || column.currency || column.qty) return round3(Number(raw || 0)).toFixed(3);
    return String(raw || '');
  };

  const handleSort = (column: ColumnDef) => {
    const sortKey = column.key;
    setSortByTab((prev) => {
      const current = prev[activeTab];
      if (current.key === sortKey) {
        return { ...prev, [activeTab]: { key: sortKey, direction: current.direction === 'asc' ? 'desc' : 'asc' } };
      }
      const direction: SortDirection = (column.numeric || sortKey === 'dateMs') ? 'desc' : 'asc';
      return { ...prev, [activeTab]: { key: sortKey, direction } };
    });
  };

  const handleExportCsv = () => {
    if (activeTab === 'detailed_category') {
      const lines: string[] = [[
        csvEscape('Category'),
        csvEscape('S.N'),
        csvEscape('Name'),
        csvEscape('Quantity'),
        csvEscape('Unit Price'),
        csvEscape('Total'),
      ].join(',')];
      detailedCategorySections.forEach((section) => {
        lines.push([csvEscape(section.category), '', '', '', '', ''].join(','));
        section.items.forEach((row, index) => {
          lines.push([
            '',
            csvEscape(index + 1),
            csvEscape(String(row.product || '--')),
            csvEscape(qty(Number(row.qty || 0))),
            csvEscape(round3(Number(row.unitPrice || 0)).toFixed(3)),
            csvEscape(round3(Number(row.total || 0)).toFixed(3)),
          ].join(','));
        });
        lines.push([
          csvEscape(`Grand Total (${section.category})`),
          '',
          '',
          csvEscape(qty(section.totalQty)),
          '',
          csvEscape(round3(section.categoryTotal).toFixed(3)),
        ].join(','));
      });
      downloadFile(`product_sell_report_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\n'), 'text/csv;charset=utf-8;');
      return;
    }
    const headers = activeColumns.map((c) => c.label);
    const lines = activeRows.map((row) => activeColumns.map((column) => csvEscape(exportValue(column, row))).join(','));
    downloadFile(`product_sell_report_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`, [headers.join(','), ...lines].join('\n'), 'text/csv;charset=utf-8;');
  };

  const handleExportExcel = () => {
    if (activeTab === 'detailed_category') {
      const lines: string[] = ['Category\tS.N\tName\tQuantity\tUnit Price\tTotal'];
      detailedCategorySections.forEach((section) => {
        lines.push(`${section.category}\t\t\t\t\t`);
        section.items.forEach((row, index) => {
          lines.push([
            '',
            String(index + 1),
            String(row.product || '--'),
            qty(Number(row.qty || 0)),
            round3(Number(row.unitPrice || 0)).toFixed(3),
            round3(Number(row.total || 0)).toFixed(3),
          ].join('\t'));
        });
        lines.push([
          `Grand Total (${section.category})`,
          '',
          '',
          qty(section.totalQty),
          '',
          round3(section.categoryTotal).toFixed(3),
        ].join('\t'));
      });
      downloadFile(`product_sell_report_${activeTab}_${new Date().toISOString().slice(0, 10)}.xls`, lines.join('\n'), 'application/vnd.ms-excel;charset=utf-8;');
      return;
    }
    const headers = activeColumns.map((c) => c.label);
    const lines = activeRows.map((row) => activeColumns.map((column) => exportValue(column, row)).join('\t'));
    downloadFile(`product_sell_report_${activeTab}_${new Date().toISOString().slice(0, 10)}.xls`, [headers.join('\t'), ...lines].join('\n'), 'application/vnd.ms-excel;charset=utf-8;');
  };

  const handleExportPdf = () => {
    try {
      const jspdf = (window as any).jspdf;
      const JsPDF = jspdf?.jsPDF;
      if (!JsPDF) { printActiveReportTable(); return; }
      const doc = new JsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const margin = 24;
      const rowHeight = 14;
      const maxY = 560;
      const pageWidth = 842;
      let y = 32;
      doc.setFontSize(14);
      doc.text(`Product Sell Report - ${tabs.find((tab) => tab.id === activeTab)?.label || ''}`, margin, y);
      y += rowHeight + 4;
      doc.setFontSize(9);
      doc.text(`Date Range: ${dateRange.label || 'Selected range'}`, margin, y);
      y += rowHeight;
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
      y += rowHeight + 4;
      if (activeTab === 'detailed_category') {
        const x = {
          sn: margin,
          name: margin + 44,
          qty: margin + 500,
          unit: margin + 610,
          total: margin + 760,
        };
        const ensureSpace = (requiredHeight = rowHeight) => {
          if (y + requiredHeight <= maxY) return;
          doc.addPage();
          y = 32;
          doc.setFontSize(14);
          doc.text(`Product Sell Report - ${tabs.find((tab) => tab.id === activeTab)?.label || ''}`, margin, y);
          y += rowHeight + 4;
          doc.setFontSize(9);
          doc.text(`Date Range: ${dateRange.label || 'Selected range'}`, margin, y);
          y += rowHeight;
          doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
          y += rowHeight + 4;
        };
        const drawTableHeader = () => {
          doc.setFont('helvetica', 'bold');
          doc.text('S.N', x.sn, y);
          doc.text('Name', x.name, y);
          doc.text('Quantity', x.qty, y, { align: 'right' });
          doc.text('Unit Price', x.unit, y, { align: 'right' });
          doc.text('Total', x.total, y, { align: 'right' });
          doc.setFont('helvetica', 'normal');
          y += rowHeight;
        };

        if (detailedCategorySections.length === 0) {
          doc.text('No data available in table', margin, y);
          y += rowHeight;
        } else {
          detailedCategorySections.forEach((section) => {
            ensureSpace(rowHeight * 3);
            doc.setFont('helvetica', 'bold');
            doc.text(section.category, margin, y);
            doc.setFont('helvetica', 'normal');
            y += rowHeight;
            drawTableHeader();
            section.items.forEach((row, index) => {
              ensureSpace(rowHeight * 2);
              doc.text(String(index + 1), x.sn, y);
              doc.text(String(row.product || '--').slice(0, 72), x.name, y);
              doc.text(qty(Number(row.qty || 0)), x.qty, y, { align: 'right' });
              doc.text(round3(Number(row.unitPrice || 0)).toFixed(3), x.unit, y, { align: 'right' });
              doc.text(round3(Number(row.total || 0)).toFixed(3), x.total, y, { align: 'right' });
              y += rowHeight;
            });
            ensureSpace(rowHeight + 4);
            doc.setFont('helvetica', 'bold');
            doc.text(`Grand Total (${section.category})`, x.name, y);
            doc.text(qty(section.totalQty), x.qty, y, { align: 'right' });
            doc.text(round3(section.categoryTotal).toFixed(3), x.total, y, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            y += rowHeight + 4;
          });
        }

        ensureSpace(rowHeight * 2);
        doc.setFont('helvetica', 'bold');
        doc.text(summary, margin, y + rowHeight);
        doc.save(`product_sell_report_${activeTab}_${new Date().toISOString().slice(0, 10)}.pdf`);
        return;
      }
      const headers = activeColumns.map((column) => column.label);
      const width = (pageWidth - margin * 2) / Math.max(1, headers.length);
      const drawHeader = () => {
        doc.setFont('helvetica', 'bold');
        headers.forEach((header, idx) => doc.text(String(header).slice(0, 16), margin + idx * width, y));
        doc.setFont('helvetica', 'normal');
        y += rowHeight;
      };
      drawHeader();
      if (activeRows.length === 0) {
        doc.text('No data available in table', margin, y);
        y += rowHeight;
      } else {
        activeRows.forEach((row) => {
          if (y > maxY) { doc.addPage(); y = 32; drawHeader(); }
          activeColumns.forEach((column, idx) => doc.text(exportValue(column, row).slice(0, 16), margin + idx * width, y));
          y += rowHeight;
        });
      }
      if (y + rowHeight > maxY) { doc.addPage(); y = 32; }
      doc.setFont('helvetica', 'bold');
      doc.text(summary, margin, y + rowHeight);
      doc.save(`product_sell_report_${activeTab}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      printActiveReportTable();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
          <BarChart2 size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Product Sell Report</h1>
          <p className="text-slate-500 text-sm mt-0.5">Sales history and quantity per product</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
<div className="flex items-center gap-2 mb-2 text-blue-600 font-bold text-sm cursor-pointer w-fit" onClick={() => setShowFilters((v) => !v)}>
          <Filter size={16} /> Filters
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2 animate-in slide-in-from-top-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Search Product:</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Product / SKU / Invoice / Customer"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs font-medium outline-none"
                />
              </div>
            </div>
            <MultiSelect label="Customer" options={customerOptions} selected={filters.customer} onChange={(value) => setFilters((prev) => ({ ...prev, customer: value }))} />
            <MultiSelect label="Customer Group" options={customerGroupOptions} selected={filters.customerGroup} onChange={(value) => setFilters((prev) => ({ ...prev, customerGroup: value }))} />
            <MultiSelect label="Business Location" options={locationOptions} selected={filters.location} onChange={(value) => setFilters((prev) => ({ ...prev, location: value }))} />
            <MultiSelect label="Category" options={categoryOptions} selected={filters.category} onChange={(value) => setFilters((prev) => ({ ...prev, category: value }))} />
            <MultiSelect label="Brand" options={brandOptions} selected={filters.brand} onChange={(value) => setFilters((prev) => ({ ...prev, brand: value }))} />
            <DateRangeFilter allowAllTime initialRange={dateRange} onRangeSelect={(range) => setDateRange(range as DateRangeValue)} />
          </div>
        )}
      </div>

      <div className="bg-white p-2 rounded-[2rem] border border-slate-200 shadow-sm overflow-x-auto">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        <div className="flex gap-1 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-50'}`}
              >
                <Icon size={12} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
          {usePagination ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 font-bold">Show</span>
              <select className="border border-slate-300 rounded px-2 py-1 text-xs outline-none" value={entriesPerPage} onChange={(event) => setEntriesPerPage(Number(event.target.value) || 25)}>
                <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
              </select>
              <span className="text-xs text-slate-600 font-bold">entries</span>
            </div>
          ) : <div className="w-[150px]" />}

          <div className="flex gap-1">
            <button type="button" onClick={handleExportCsv} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10} /> Export CSV</button>
            <button type="button" onClick={handleExportExcel} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileSpreadsheet size={10} /> Export Excel</button>
            <button type="button" onClick={() => printActiveReportTable()} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Printer size={10} /> Print</button>
            <button type="button" onClick={handleExportPdf} className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Download size={10} /> Export PDF</button>
          </div>

          <div className="flex items-center gap-2">
            <Search className="text-slate-400" size={14} />
            <input type="text" placeholder="Search..." className="pl-2 py-1 border border-slate-300 rounded text-xs outline-none" value={tableSearch} onChange={(event) => setTableSearch(event.target.value)} />
          </div>
        </div>

        {activeTab !== 'detailed_category' ? (
          <div className="overflow-x-auto min-h-[380px]">
            <table className="w-full text-[11px] text-left border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  {activeColumns.map((column) => (
                    <th key={column.key} onClick={() => handleSort(column)} className={`px-4 py-3 whitespace-nowrap cursor-pointer select-none ${column.numeric ? 'text-right' : ''}`}>
                      {column.label}
                      <ArrowUpDown size={10} className={`inline ml-1 transition-transform ${sortByTab[activeTab].key === column.key && sortByTab[activeTab].direction === 'desc' ? 'rotate-180' : ''} ${sortByTab[activeTab].key === column.key ? 'text-blue-600' : 'text-slate-400'}`} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.map((row) => (
                  <tr key={String(row.id)} className="hover:bg-slate-50 transition-colors">
                    {activeColumns.map((column) => (
                      <td key={column.key} className={`px-4 py-2 text-slate-700 ${column.numeric ? 'text-right' : ''}`}>{renderValue(column, row)}</td>
                    ))}
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={Math.max(1, activeColumns.length)} className="px-4 py-10 text-center text-slate-400 italic">No data available in table</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="min-h-[380px] p-4 space-y-5">
            {detailedCategorySections.length === 0 && (
              <div className="h-72 flex items-center justify-center text-slate-400 italic">No data available in table</div>
            )}

            {detailedCategorySections.map((section) => (
              <div key={section.category} className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-800">{section.category}</h3>
                  <span className="text-xs font-bold text-slate-600">
                    Category Total: {formatCurrency(section.categoryTotal)}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] text-left border-collapse">
                    <thead className="bg-white text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 w-16 text-center">S.N</th>
                        <th className="px-3 py-2 cursor-pointer select-none" onClick={() => handleSort({ key: 'product', label: 'Name' })}>
                          Name
                          <ArrowUpDown size={10} className={`inline ml-1 transition-transform ${sortByTab.detailed_category.key === 'product' && sortByTab.detailed_category.direction === 'desc' ? 'rotate-180' : ''} ${sortByTab.detailed_category.key === 'product' ? 'text-blue-600' : 'text-slate-400'}`} />
                        </th>
                        <th className="px-3 py-2 text-right cursor-pointer select-none" onClick={() => handleSort({ key: 'qty', label: 'Quantity', numeric: true })}>
                          Quantity
                          <ArrowUpDown size={10} className={`inline ml-1 transition-transform ${sortByTab.detailed_category.key === 'qty' && sortByTab.detailed_category.direction === 'desc' ? 'rotate-180' : ''} ${sortByTab.detailed_category.key === 'qty' ? 'text-blue-600' : 'text-slate-400'}`} />
                        </th>
                        <th className="px-3 py-2 text-right cursor-pointer select-none" onClick={() => handleSort({ key: 'unitPrice', label: 'Unit Price', numeric: true })}>
                          Unit Price
                          <ArrowUpDown size={10} className={`inline ml-1 transition-transform ${sortByTab.detailed_category.key === 'unitPrice' && sortByTab.detailed_category.direction === 'desc' ? 'rotate-180' : ''} ${sortByTab.detailed_category.key === 'unitPrice' ? 'text-blue-600' : 'text-slate-400'}`} />
                        </th>
                        <th className="px-3 py-2 text-right cursor-pointer select-none" onClick={() => handleSort({ key: 'total', label: 'Total', numeric: true })}>
                          Total
                          <ArrowUpDown size={10} className={`inline ml-1 transition-transform ${sortByTab.detailed_category.key === 'total' && sortByTab.detailed_category.direction === 'desc' ? 'rotate-180' : ''} ${sortByTab.detailed_category.key === 'total' ? 'text-blue-600' : 'text-slate-400'}`} />
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {section.items.map((row, index) => (
                        <tr key={String(row.id)} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2 text-center text-slate-500">{index + 1}</td>
                          <td className="px-3 py-2 text-slate-700 font-medium">{String(row.product || '--')}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{qty(Number(row.qty || 0))}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(Number(row.unitPrice || 0))}</td>
                          <td className="px-3 py-2 text-right text-slate-800 font-bold">{formatCurrency(Number(row.total || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold text-slate-800 border-t border-slate-200">
                      <tr>
                        <td colSpan={2} className="px-3 py-2 text-right uppercase text-[10px]">Grand Total ({section.category}):</td>
                        <td className="px-3 py-2 text-right">{qty(section.totalQty)}</td>
                        <td className="px-3 py-2 text-right">--</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(section.categoryTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="p-4 border-t border-slate-200 flex flex-col md:flex-row justify-between md:items-center gap-3 text-xs text-slate-500">
          <div>Showing {from} to {to} of {displayedCount} entries</div>
          <div className="font-bold text-slate-700">{summary}</div>
          {usePagination && (
            <div className="flex gap-1">
              <button type="button" onClick={() => setCurrentPage((value) => Math.max(1, value - 1))} disabled={safePage <= 1} className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
              <button className="px-2 py-1 bg-blue-600 text-white rounded shadow-sm">{safePage}</button>
              <button type="button" onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))} disabled={safePage >= totalPages} className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportProductSell;


