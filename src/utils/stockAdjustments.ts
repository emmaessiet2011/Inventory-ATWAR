import { Product } from '../context/GlobalContext';

import type { StockLotAdjustment } from './stockLots';

export type StockAdjustmentType = 'Normal' | 'Abnormal';

export interface StockAdjustmentItem {
  productId: string;
  productName: string;
  sku: string;
  unit?: string;
  quantity: number;
  unitCost: number;
  currentStockBefore: number;
}

export interface StockAdjustmentRecord {
  id: string;
  date: string;
  referenceNo: string;
  location: string;
  adjustmentType: StockAdjustmentType;
  reason: string;
  totalAmount: number;
  totalRecovered: number;
  items: StockAdjustmentItem[];
  addedById?: string;
  addedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockLedgerEntry {
  id: string;
  productId: string;
  type: string;
  change: number;
  newQty: number;
  date: string;
  ref: string;
  party: string;
  location?: string;
  note?: string;
}

export interface StockAdjustmentSimulationResult {
  productsAfter: Product[];
  ledgerEntries: StockLedgerEntry[];
  lotAdjustments: StockLotAdjustment[];
}

const STOCK_ADJUSTMENTS_KEY = 'app_stock_adjustments_v1';
const EDIT_STOCK_ADJUSTMENT_ID_KEY = 'app_edit_stock_adjustment_id';

const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase();
const round3 = (value: number): number => Math.round(value * 1000) / 1000;
const toIsoDate = (value: string): string => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
};
const skuLocationKey = (sku: unknown, location: unknown): string => `${normalize(sku)}@@${normalize(location)}`;

export const getStockAdjustmentStorageKey = () => STOCK_ADJUSTMENTS_KEY;
export const getEditStockAdjustmentIdKey = () => EDIT_STOCK_ADJUSTMENT_ID_KEY;

export const readStockAdjustments = (): StockAdjustmentRecord[] => {
  try {
    const raw = localStorage.getItem(STOCK_ADJUSTMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        const items = Array.isArray(row?.items)
          ? row.items
              .map((item: any) => ({
                productId: String(item?.productId || ''),
                productName: String(item?.productName || ''),
                sku: String(item?.sku || ''),
                unit: String(item?.unit || ''),
                quantity: round3(Number(item?.quantity || 0)),
                unitCost: round3(Number(item?.unitCost || 0)),
                currentStockBefore: round3(Number(item?.currentStockBefore || 0)),
              }))
              .filter((item: StockAdjustmentItem) => item.productId && Number.isFinite(item.quantity) && item.quantity !== 0)
          : [];
        return {
          id: String(row?.id || ''),
          date: String(row?.date || ''),
          referenceNo: String(row?.referenceNo || ''),
          location: String(row?.location || ''),
          adjustmentType: (String(row?.adjustmentType || 'Normal') as StockAdjustmentType),
          reason: String(row?.reason || ''),
          totalAmount: round3(Number(row?.totalAmount || 0)),
          totalRecovered: round3(Number(row?.totalRecovered || 0)),
          items,
          addedById: String(row?.addedById || ''),
          addedBy: String(row?.addedBy || 'System'),
          createdAt: String(row?.createdAt || ''),
          updatedAt: String(row?.updatedAt || ''),
        } as StockAdjustmentRecord;
      })
      .filter((row: StockAdjustmentRecord) => row.id);
  } catch {
    return [];
  }
};

export const writeStockAdjustments = (rows: StockAdjustmentRecord[]) => {
  localStorage.setItem(STOCK_ADJUSTMENTS_KEY, JSON.stringify(rows));
};

export const makeNextStockAdjustmentRef = (prefix: string, rows: StockAdjustmentRecord[]) => {
  const normalizedPrefix = String(prefix || 'SA').trim() || 'SA';
  const re = new RegExp(`^${normalizedPrefix}-?(\\d+)$`, 'i');
  const next = rows.reduce((max, row) => {
    const m = String(row.referenceNo || '').trim().match(re);
    if (!m) return max;
    const n = Number(m[1]);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0) + 1;
  return `${normalizedPrefix}-${String(next).padStart(4, '0')}`;
};

interface SimulateParams {
  adjustment: StockAdjustmentRecord;
  direction: 1 | -1;
  products: Product[];
  actorName: string;
  notePrefix?: string;
}

export const simulateStockAdjustment = ({
  adjustment,
  direction,
  products,
  actorName,
  notePrefix,
}: SimulateParams): StockAdjustmentSimulationResult => {
  const productById = new Map<string, Product>();
  const skuLocToId = new Map<string, string>();
  const originalIds = products.map((p) => p.id);

  products.forEach((product) => {
    productById.set(product.id, { ...product });
    skuLocToId.set(skuLocationKey(product.sku, product.businessLocation), product.id);
  });

  const transferDate = toIsoDate(adjustment.date);
  const now = Date.now();
  const ledgerEntries: StockLedgerEntry[] = [];
  const lotAdjustments: StockLotAdjustment[] = [];
  let ledgerSeq = 0;

  const resolveProduct = (item: StockAdjustmentItem): Product => {
    const byId = item.productId ? productById.get(item.productId) : undefined;
    if (byId && normalize(byId.businessLocation) === normalize(adjustment.location)) return byId;
    const fallbackId = skuLocToId.get(skuLocationKey(item.sku, adjustment.location));
    if (fallbackId) {
      const fallback = productById.get(fallbackId);
      if (fallback) return fallback;
    }
    throw new Error(`Product not found for SKU "${item.sku}" at "${adjustment.location}".`);
  };

  (adjustment.items || []).forEach((item, index) => {
    const qty = round3(Number(item.quantity || 0));
    if (!qty) return;

    const product = resolveProduct(item);
    const delta = round3(qty * direction);
    const next = round3(Number(product.stock || 0) + delta);
    if (next < -0.0001) {
      throw new Error(`Insufficient stock for "${product.name}" at "${adjustment.location}".`);
    }
    product.stock = Math.max(0, next);

    const reasonText = adjustment.reason ? ` | ${adjustment.reason}` : '';
    const note = `${notePrefix ? `${notePrefix}: ` : ''}${adjustment.adjustmentType}${reasonText}`;
    ledgerEntries.push({
      id: `STK-ADJ-${now}-${index}-${ledgerSeq += 1}`,
      productId: product.id,
      type: direction === 1 ? 'Stock Adjustment' : 'Stock Adjustment Reversal',
      change: delta,
      newQty: product.stock,
      date: transferDate,
      ref: adjustment.referenceNo,
      party: actorName || 'System',
      location: adjustment.location,
      note,
    });

    lotAdjustments.push({
      productId: product.id,
      productName: product.name || item.productName || '',
      sku: product.sku || item.sku || '',
      location: adjustment.location,
      lotNumber: String(product.lotNumber || '').trim() || '--',
      expiryDate: String(product.expiryDate || '').trim(),
      unit: product.unit || item.unit || '',
      unitCost: round3(Number(item.unitCost || product.unitPurchasePrice || 0)),
      qtyChange: delta,
      updatedAt: transferDate,
    });
  });

  const productsAfter: Product[] = originalIds
    .map((id) => productById.get(id))
    .filter((product): product is Product => !!product);

  return { productsAfter, ledgerEntries, lotAdjustments };
};
