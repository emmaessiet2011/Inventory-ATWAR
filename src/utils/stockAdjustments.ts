import { Product } from '../context/GlobalContext';
import { syncDedicatedStrict, fetchDedicated } from '@/utils/apiClient';
import {
  ProductLocationInventory,
  inventoryKey,
} from './stockLocationInventory';

import type { StockLotAdjustment } from './stockLots';

export type StockAdjustmentType = 'Normal' | 'Abnormal' | 'Damage';
export type StockAdjustmentStatus = 'Pending' | 'Approved';
export type StockAdjustmentDamageDisposition = 'Sellable' | 'Unsellable';

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
  status: StockAdjustmentStatus;
  damageDisposition?: StockAdjustmentDamageDisposition;
  damageSellableLocation?: string;
  reason: string;
  totalAmount: number;
  totalRecovered: number;
  items: StockAdjustmentItem[];
  addedById?: string;
  addedBy: string;
  approvedById?: string;
  approvedBy?: string;
  approvedAt?: string;
  linkedTransferId?: string;
  linkedExpenseId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockLedgerEntry {
  id: string;
  productId: string;
  productName?: string;
  sku?: string;
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
  inventoryAfter: ProductLocationInventory[];
  ledgerEntries: StockLedgerEntry[];
  lotAdjustments: StockLotAdjustment[];
}

const STOCK_ADJUSTMENTS_UPDATED_EVENT = 'app:stock-adjustments-updated';

const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase();
const round3 = (value: number): number => Math.round(value * 1000) / 1000;
const toIsoDate = (value: string): string => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
};
const skuLocationKey = (sku: unknown, location: unknown): string => `${normalize(sku)}@@${normalize(location)}`;

export const normalizeStockAdjustmentType = (value: unknown): StockAdjustmentType => {
  const normalized = normalize(value);
  if (normalized === 'abnormal') return 'Abnormal';
  if (normalized === 'damage') return 'Damage';
  return 'Normal';
};

export const normalizeStockAdjustmentStatus = (value: unknown): StockAdjustmentStatus => {
  const normalized = normalize(value);
  return normalized === 'pending' ? 'Pending' : 'Approved';
};

export const normalizeStockAdjustmentDamageDisposition = (
  value: unknown,
): StockAdjustmentDamageDisposition => {
  const normalized = normalize(value);
  return normalized === 'sellable' ? 'Sellable' : 'Unsellable';
};

let stockAdjustmentsCache: StockAdjustmentRecord[] = [];

const notify = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(STOCK_ADJUSTMENTS_UPDATED_EVENT));
};

const parseRows = (raw: unknown): StockAdjustmentRecord[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const items = Array.isArray((row as any)?.items)
        ? (row as any).items
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
        id: String((row as any)?.id || ''),
        date: String((row as any)?.date || ''),
        referenceNo: String((row as any)?.referenceNo || ''),
        location: String((row as any)?.location || ''),
        adjustmentType: normalizeStockAdjustmentType((row as any)?.adjustmentType),
        status: normalizeStockAdjustmentStatus((row as any)?.status),
        damageDisposition: normalizeStockAdjustmentType((row as any)?.adjustmentType) === 'Damage'
          ? normalizeStockAdjustmentDamageDisposition((row as any)?.damageDisposition)
          : undefined,
        damageSellableLocation: String((row as any)?.damageSellableLocation || ''),
        reason: String((row as any)?.reason || ''),
        totalAmount: round3(Number((row as any)?.totalAmount || 0)),
        totalRecovered: round3(Number((row as any)?.totalRecovered || 0)),
        items,
        addedById: String((row as any)?.addedById || ''),
        addedBy: String((row as any)?.addedBy || 'System'),
        approvedById: String((row as any)?.approvedById || ''),
        approvedBy: String((row as any)?.approvedBy || ''),
        approvedAt: String((row as any)?.approvedAt || ''),
        linkedTransferId: String((row as any)?.linkedTransferId || ''),
        linkedExpenseId: String((row as any)?.linkedExpenseId || ''),
        createdAt: String((row as any)?.createdAt || ''),
        updatedAt: String((row as any)?.updatedAt || ''),
      } as StockAdjustmentRecord;
    })
    .filter((row: StockAdjustmentRecord) => row.id);
};

export const readStockAdjustments = (): StockAdjustmentRecord[] => {
  return stockAdjustmentsCache.map((row) => ({ ...row, items: [...(row.items || [])] }));
};

export const fetchStockAdjustmentsFromDB = async (): Promise<StockAdjustmentRecord[]> => {
  const remoteAdjustments = await fetchDedicated<StockAdjustmentRecord>('/api/sync/stock-adjustments');
  stockAdjustmentsCache = remoteAdjustments ? parseRows(remoteAdjustments) : [];
  return readStockAdjustments();
};

export const writeStockAdjustments = async (
  rows: StockAdjustmentRecord[],
  changedId?: string,
): Promise<boolean> => {
  const normalizedRows = parseRows(rows);
  if (changedId) {
    const record = normalizedRows.find((r) => r.id === changedId);
    if (record) {
      const saved = await syncDedicatedStrict('/api/sync/stock-adjustments', record.id, record);
      if (!saved.ok) return false;
    }
  } else {
    // Bulk write: sync all records (used when deleting — sync remaining)
    for (const record of normalizedRows) {
      const saved = await syncDedicatedStrict('/api/sync/stock-adjustments', record.id, record);
      if (!saved.ok) return false;
    }
  }
  stockAdjustmentsCache = normalizedRows;
  notify();
  return true;
};

/**
 * Bootstrap stock adjustments from DB.
 * Empty DB responses clear local cache to prevent stale browser-only rows.
 */
export const bootstrapStockAdjustmentsFromDB = async (): Promise<void> => {
  await fetchStockAdjustmentsFromDB();
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
  inventoryRows?: ProductLocationInventory[];
  locationId?: string;
  generateId?: (prefix: string) => string;
  actorName: string;
  notePrefix?: string;
}

export const simulateStockAdjustment = ({
  adjustment,
  direction,
  products,
  inventoryRows = [],
  locationId = '',
  generateId,
  actorName,
  notePrefix,
}: SimulateParams): StockAdjustmentSimulationResult => {
  const productById = new Map<string, Product>();
  const skuLocToId = new Map<string, string>();
  const skuToProductIds = new Map<string, string[]>();
  const nameToProductIds = new Map<string, string[]>();
  const originalIds = products.map((p) => p.id);
  const inventoryByKey = new Map<string, ProductLocationInventory>();
  const inventoryIds = inventoryRows.map((row) => row.id);
  const createdInventoryIds: string[] = [];

  products.forEach((product) => {
    productById.set(product.id, { ...product });
    skuLocToId.set(skuLocationKey(product.sku, product.businessLocation), product.id);
    const skuKey = normalize(product.sku);
    const nameKey = normalize(product.name);
    if (skuKey) skuToProductIds.set(skuKey, [...(skuToProductIds.get(skuKey) || []), product.id]);
    if (nameKey) nameToProductIds.set(nameKey, [...(nameToProductIds.get(nameKey) || []), product.id]);
  });

  inventoryRows.forEach((row) => {
    const key = inventoryKey(row.productId, row.locationId);
    const existing = inventoryByKey.get(key);
    if (existing && existing.id !== row.id) {
      throw new Error(`Duplicate inventory rows found for product "${row.productId}" at one location. Merge duplicates before adjustment.`);
    }
    inventoryByKey.set(key, { ...row });
  });

  const transferDate = toIsoDate(adjustment.date);
  const now = Date.now();
  const ledgerEntries: StockLedgerEntry[] = [];
  const lotAdjustments: StockLotAdjustment[] = [];
  let ledgerSeq = 0;

  const resolveProduct = (item: StockAdjustmentItem): Product => {
    const byId = item.productId ? productById.get(item.productId) : undefined;
    if (byId) return byId;
    const fallbackId = skuLocToId.get(skuLocationKey(item.sku, adjustment.location));
    if (fallbackId) {
      const fallback = productById.get(fallbackId);
      if (fallback) return fallback;
    }
    const skuMatches = skuToProductIds.get(normalize(item.sku)) || [];
    if (skuMatches.length === 1) {
      const match = productById.get(skuMatches[0]);
      if (match) return match;
    }
    const nameMatches = nameToProductIds.get(normalize(item.productName)) || [];
    if (nameMatches.length === 1) {
      const match = productById.get(nameMatches[0]);
      if (match) return match;
    }
    throw new Error(`Product not found for SKU "${item.sku}" at "${adjustment.location}".`);
  };

  const getInventoryRecord = (
    product: Product,
    allowCreate: boolean,
  ): ProductLocationInventory => {
    if (!locationId) {
      throw new Error(`Location "${adjustment.location}" does not have a database ID.`);
    }
    const key = inventoryKey(product.id, locationId);
    const existing = inventoryByKey.get(key);
    if (existing) return existing;
    if (!allowCreate || !generateId) {
      throw new Error(`Location inventory not found for SKU "${product.sku}" at "${adjustment.location}".`);
    }
    const created: ProductLocationInventory = {
      id: generateId('PINV'),
      productId: product.id,
      locationId,
      locationName: adjustment.location,
      stock: 0,
      unitCost: round3(Number(product.unitPurchasePrice || 0)),
    };
    inventoryByKey.set(key, created);
    createdInventoryIds.push(created.id);
    return created;
  };

  (adjustment.items || []).forEach((item, index) => {
    const qty = round3(Number(item.quantity || 0));
    if (!qty) return;

    const product = resolveProduct(item);
    const delta = round3(qty * direction);
    // Always apply adjustments against the selected location inventory when we have a locationId.
    // This keeps location-based stock views consistent across sales/POS/transfers/reports.
    const inventory = locationId ? getInventoryRecord(product, delta > 0) : null;
    const currentLocationStock = locationId
      ? Number(inventory?.stock || 0)
      : Number(product.stock || 0);
    const nextLocationStock = round3(currentLocationStock + delta);
    if (nextLocationStock < -0.0001) {
      throw new Error(`Insufficient stock for "${product.name}" at "${adjustment.location}".`);
    }
    if (inventory) {
      inventory.stock = Math.max(0, nextLocationStock);
    }
    // Keep global product stock in sync as an aggregate mirror.
    const currentGlobalStock = Number(product.stock || 0);
    const nextGlobalStock = round3(currentGlobalStock + delta);
    product.stock = Math.max(0, nextGlobalStock);

    const reasonText = adjustment.reason ? ` | ${adjustment.reason}` : '';
    const statusText = adjustment.status ? ` | ${adjustment.status}` : '';
    const note = `${notePrefix ? `${notePrefix}: ` : ''}${adjustment.adjustmentType}${statusText}${reasonText}`;
    ledgerEntries.push({
      id: `STK-ADJ-${now}-${index}-${ledgerSeq += 1}`,
      productId: product.id,
      productName: product.name || item.productName || '',
      sku: product.sku || item.sku || '',
      type: direction === 1 ? 'Stock Adjustment' : 'Stock Adjustment Reversal',
      change: delta,
      newQty: inventory ? Number(inventory.stock || 0) : Number(product.stock || 0),
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

  const allInventory = Array.from(inventoryByKey.values());
  const inventoryAfter: ProductLocationInventory[] = [
    ...inventoryIds
      .map((id) => allInventory.find((row) => row.id === id))
      .filter((row): row is ProductLocationInventory => !!row),
    ...createdInventoryIds
      .map((id) => allInventory.find((row) => row.id === id))
      .filter((row): row is ProductLocationInventory => !!row),
  ];

  return { productsAfter, inventoryAfter, ledgerEntries, lotAdjustments };
};
