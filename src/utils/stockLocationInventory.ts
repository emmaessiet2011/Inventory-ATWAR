import { apiFetchAll, syncRecordStrict } from './apiClient';
import {
  convertContainerStockToBaseUnits,
  isFractionalProduct,
} from './fractionalProducts';

export interface ProductLocationInventory {
  id: string;
  productId: string;
  locationId: string;
  locationName?: string;
  stock: number;
  unitCost?: number;
  rack?: string;
  row?: string;
  position?: string;
  lotNumber?: string;
  expiryDate?: string;
  meta?: Record<string, unknown>;
}

export interface LocationInventorySyncResult {
  ok: boolean;
  status: number;
  error?: string;
  failedInventoryId?: string;
}

const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase();
const round3 = (value: number): number => Math.round(value * 1000) / 1000;
const stableJson = (value: unknown): string => {
  if (!value || typeof value !== 'object') return '';
  try {
    return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
  } catch {
    return '';
  }
};
export const LOCATION_INVENTORY_UPDATED_EVENT = 'app:location-inventory-updated';

const notifyInventoryUpdated = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LOCATION_INVENTORY_UPDATED_EVENT));
};

export const inventoryKey = (productId: unknown, locationId: unknown): string => (
  `${normalize(productId)}@@${normalize(locationId)}`
);

export const normalizeInventoryRows = (raw: unknown): ProductLocationInventory[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row: any) => ({
      id: String(row?.id || ''),
      productId: String(row?.productId || ''),
      locationId: String(row?.locationId || ''),
      locationName: String(row?.locationName || row?.location?.name || ''),
      stock: round3(Number(row?.stock || 0)),
      unitCost: row?.unitCost === undefined || row?.unitCost === null ? undefined : round3(Number(row.unitCost || 0)),
      rack: String(row?.rack || ''),
      row: String(row?.row || ''),
      position: String(row?.position || ''),
      lotNumber: String(row?.lotNumber || ''),
      expiryDate: String(row?.expiryDate || ''),
      meta: row?.meta && typeof row.meta === 'object' && !Array.isArray(row.meta) ? row.meta : undefined,
    }))
    .filter((row: ProductLocationInventory) => row.id && row.productId && row.locationId);
};

export const fetchLocationInventoryFromDB = async (): Promise<ProductLocationInventory[]> => {
  const rows = await apiFetchAll<ProductLocationInventory>('productInventory');
  return normalizeInventoryRows(rows);
};

export const syncChangedLocationInventoryStrict = async (
  nextRows: ProductLocationInventory[],
  previousRows: ProductLocationInventory[],
): Promise<LocationInventorySyncResult> => {
  const previousById = new Map(previousRows.map((row) => [row.id, row]));
  const changedRows = nextRows.filter((row) => {
    const previous = previousById.get(row.id);
    if (!previous) return true;
    return (
      normalize(previous.productId) !== normalize(row.productId) ||
      normalize(previous.locationId) !== normalize(row.locationId) ||
      round3(Number(previous.stock || 0)) !== round3(Number(row.stock || 0)) ||
      round3(Number(previous.unitCost || 0)) !== round3(Number(row.unitCost || 0)) ||
      stableJson(previous.meta) !== stableJson(row.meta)
    );
  });

  for (const row of changedRows) {
    const saved = await syncRecordStrict('productInventory', row);
    if (!saved.ok) {
      return {
        ok: false,
        status: saved.status,
        error: saved.error,
        failedInventoryId: row.id,
      };
    }
  }

  if (changedRows.length > 0) {
    notifyInventoryUpdated();
  }

  return { ok: true, status: 200 };
};

export const calculateAvailableStock = (
  product: {
    id: string;
    type?: string;
    comboItems?: { productId: string; qty: number }[];
    fractionalSaleEnabled?: boolean;
    baseUnitName?: string;
    containerUnitName?: string;
    containerSize?: number;
    fractionalStockConvertedToBase?: boolean;
    unit?: string;
  },
  locationId: string,
  locationInventory: ProductLocationInventory[]
): number => {
  if (!locationId) return 0;

  if (String(product.type || '').trim().toLowerCase() === 'combo') {
    if (!product.comboItems || product.comboItems.length === 0) return 0;

    let maxCombos = Infinity;
    for (const item of product.comboItems) {
      if (!item.productId || !item.qty) continue;
      const match = locationInventory.find(record => inventoryKey(record.productId, record.locationId) === inventoryKey(item.productId, locationId));
      const physicalStock = Number(match?.stock || 0);
      const possibleCombos = Math.floor(physicalStock / item.qty);
      if (possibleCombos < maxCombos) maxCombos = possibleCombos;
    }
    return maxCombos === Infinity ? 0 : Math.max(0, maxCombos);
  } else {
    const match = locationInventory.find(record => inventoryKey(record.productId, record.locationId) === inventoryKey(product.id, locationId));
    const stock = Number(match?.stock || 0);
    if (match && isFractionalProduct(product) && product.fractionalStockConvertedToBase !== true) {
      return convertContainerStockToBaseUnits(stock, product);
    }
    return round3(stock);
  }
};
