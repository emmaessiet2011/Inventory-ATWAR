import { Product } from '../context/GlobalContext';

export type StockTransferStatus = 'Pending' | 'In Transit' | 'Completed';

export interface StockTransferItem {
  productId: string;
  productName: string;
  sku: string;
  qty: number;
  unit?: string;
  unitCost?: number;
}

export interface StockTransferRecord {
  id: string;
  date: string;
  refNo: string;
  locationFrom: string;
  locationTo: string;
  status: StockTransferStatus;
  shippingCharges: number;
  totalAmount: number;
  notes: string;
  items: StockTransferItem[];
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

export interface StockTransferSimulationResult {
  productsAfter: Product[];
  ledgerEntries: StockLedgerEntry[];
}

const STOCK_TRANSFERS_KEY = 'app_stock_transfers_v1';
const EDIT_STOCK_TRANSFER_ID_KEY = 'app_edit_stock_transfer_id';
const STOCK_LEDGER_KEY = 'app_product_stock_ledger_v1';

const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase();
const round3 = (value: number): number => Math.round(value * 1000) / 1000;
const toIsoDate = (value: string): string => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
};
const skuLocationKey = (sku: unknown, location: unknown): string => `${normalize(sku)}@@${normalize(location)}`;

export const getStockTransferStorageKey = () => STOCK_TRANSFERS_KEY;
export const getEditStockTransferIdKey = () => EDIT_STOCK_TRANSFER_ID_KEY;

export const readStockTransfers = (): StockTransferRecord[] => {
  try {
    const raw = localStorage.getItem(STOCK_TRANSFERS_KEY);
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
                qty: round3(Number(item?.qty || 0)),
                unit: String(item?.unit || ''),
                unitCost: round3(Number(item?.unitCost || 0)),
              }))
              .filter((item: StockTransferItem) => item.qty > 0 && item.productId)
          : [];
        return {
          id: String(row?.id || ''),
          date: String(row?.date || ''),
          refNo: String(row?.refNo || ''),
          locationFrom: String(row?.locationFrom || ''),
          locationTo: String(row?.locationTo || ''),
          status: (String(row?.status || 'Pending') as StockTransferStatus),
          shippingCharges: round3(Number(row?.shippingCharges || 0)),
          totalAmount: round3(Number(row?.totalAmount || 0)),
          notes: String(row?.notes || ''),
          items,
          addedBy: String(row?.addedBy || 'System'),
          createdAt: String(row?.createdAt || ''),
          updatedAt: String(row?.updatedAt || ''),
        } as StockTransferRecord;
      })
      .filter((row: StockTransferRecord) => row.id);
  } catch {
    return [];
  }
};

export const writeStockTransfers = (rows: StockTransferRecord[]) => {
  localStorage.setItem(STOCK_TRANSFERS_KEY, JSON.stringify(rows));
};

export const readStockLedger = (): StockLedgerEntry[] => {
  try {
    const raw = localStorage.getItem(STOCK_LEDGER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const appendStockLedgerEntries = (entries: StockLedgerEntry[]) => {
  if (entries.length === 0) return;
  const existing = readStockLedger();
  localStorage.setItem(STOCK_LEDGER_KEY, JSON.stringify([...existing, ...entries]));
};

export const makeNextStockTransferRef = (prefix: string, rows: StockTransferRecord[]) => {
  const normalizedPrefix = String(prefix || 'ST').trim() || 'ST';
  const re = new RegExp(`^${normalizedPrefix}-?(\\d+)$`, 'i');
  const next = rows.reduce((max, row) => {
    const m = String(row.refNo || '').trim().match(re);
    if (!m) return max;
    const n = Number(m[1]);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0) + 1;
  return `${normalizedPrefix}-${String(next).padStart(4, '0')}`;
};

interface SimulateParams {
  transfer: StockTransferRecord;
  direction: 1 | -1;
  products: Product[];
  generateId: (prefix: string) => string;
  actorName: string;
  notePrefix?: string;
}

export const simulateStockTransfer = ({
  transfer,
  direction,
  products,
  generateId,
  actorName,
  notePrefix,
}: SimulateParams): StockTransferSimulationResult => {
  const productById = new Map<string, Product>();
  const skuLocToId = new Map<string, string>();
  const originalIds = products.map(p => p.id);

  products.forEach((product) => {
    productById.set(product.id, { ...product });
    skuLocToId.set(skuLocationKey(product.sku, product.businessLocation), product.id);
  });

  const createdIds: string[] = [];
  const transferDate = toIsoDate(transfer.date);
  const now = Date.now();
  const ledgerEntries: StockLedgerEntry[] = [];
  let ledgerSeq = 0;

  const getSourceProduct = (item: StockTransferItem): Product => {
    const idMatch = item.productId ? productById.get(item.productId) : undefined;
    if (idMatch && normalize(idMatch.businessLocation) === normalize(transfer.locationFrom)) return idMatch;
    const fallbackId = skuLocToId.get(skuLocationKey(item.sku, transfer.locationFrom));
    if (fallbackId) {
      const fallback = productById.get(fallbackId);
      if (fallback) return fallback;
    }
    throw new Error(`Source product not found for SKU "${item.sku}" at "${transfer.locationFrom}".`);
  };

  const getTargetProduct = (
    item: StockTransferItem,
    sourceProduct: Product,
    delta: number,
  ): Product => {
    const key = skuLocationKey(item.sku || sourceProduct.sku, transfer.locationTo);
    const targetId = skuLocToId.get(key);
    if (targetId) {
      const target = productById.get(targetId);
      if (target) return target;
    }
    if (delta < 0) {
      throw new Error(`Target product not found for SKU "${item.sku}" at "${transfer.locationTo}".`);
    }
    const created: Product = {
      ...sourceProduct,
      id: generateId('PRD'),
      businessLocation: transfer.locationTo,
      stock: 0,
      openingStock: 0,
      openingStockLocation: transfer.locationTo,
    };
    productById.set(created.id, created);
    skuLocToId.set(key, created.id);
    createdIds.push(created.id);
    return created;
  };

  (transfer.items || []).forEach((item, index) => {
    const qty = round3(Number(item.qty || 0));
    if (!qty) return;
    const source = getSourceProduct(item);
    const deltaOut = round3(-qty * direction);
    const sourceNext = round3(Number(source.stock || 0) + deltaOut);
    if (sourceNext < -0.0001) {
      throw new Error(`Insufficient stock for "${source.name}" at "${transfer.locationFrom}".`);
    }
    source.stock = Math.max(0, sourceNext);

    const target = getTargetProduct(item, source, round3(qty * direction));
    const deltaIn = round3(qty * direction);
    const targetNext = round3(Number(target.stock || 0) + deltaIn);
    if (targetNext < -0.0001) {
      throw new Error(`Insufficient stock at target "${transfer.locationTo}" for SKU "${item.sku}".`);
    }
    target.stock = Math.max(0, targetNext);

    const transferNote = `${notePrefix ? `${notePrefix}: ` : ''}${transfer.locationFrom} -> ${transfer.locationTo}`;
    const outType = deltaOut < 0 ? 'Stock Transfer Out' : 'Stock Transfer Reversal In';
    const inType = deltaIn > 0 ? 'Stock Transfer In' : 'Stock Transfer Reversal Out';
    ledgerEntries.push({
      id: `STK-TR-${now}-${index}-${ledgerSeq += 1}`,
      productId: source.id,
      type: outType,
      change: deltaOut,
      newQty: source.stock,
      date: transferDate,
      ref: transfer.refNo,
      party: actorName || 'System',
      location: transfer.locationFrom,
      note: transferNote,
    });
    ledgerEntries.push({
      id: `STK-TR-${now}-${index}-${ledgerSeq += 1}`,
      productId: target.id,
      type: inType,
      change: deltaIn,
      newQty: target.stock,
      date: transferDate,
      ref: transfer.refNo,
      party: actorName || 'System',
      location: transfer.locationTo,
      note: transferNote,
    });
  });

  const productsAfter: Product[] = [
    ...originalIds
      .map((id) => productById.get(id))
      .filter((product): product is Product => !!product),
    ...createdIds
      .map((id) => productById.get(id))
      .filter((product): product is Product => !!product),
  ];

  return { productsAfter, ledgerEntries };
};

