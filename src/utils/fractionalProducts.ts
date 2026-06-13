export type FractionalSaleMode = 'base' | 'container';

export interface FractionalProductLike {
  id?: string;
  fractionalSaleEnabled?: boolean;
  baseUnitName?: string;
  containerUnitName?: string;
  containerSize?: number;
  fractionalPricePremium?: number;
  fractionalUnitPrice?: number;
  fractionalStockConvertedToBase?: boolean;
  sellingPrice?: number;
  unit?: string;
}

export interface FractionalSaleItemLike {
  isFractionalSale?: boolean;
  fractionalSaleMode?: FractionalSaleMode;
  saleQuantity?: number;
  saleUnitName?: string;
  stockQuantity?: number;
  stockUnitName?: string;
  qty?: number;
  quantityInput?: number;
  unit?: string;
}

export interface FractionalStockMetaLike {
  meta?: Record<string, unknown>;
  fractionalStockStoredAsBase?: boolean;
  fractionalStockUnit?: string;
}

const round3 = (value: number): number => Number((Number(value) || 0).toFixed(3));
const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase();

export const FRACTIONAL_STOCK_UNIT_META_KEY = 'fractionalStockUnit';
export const FRACTIONAL_STOCK_BASE_UNIT_VALUE = 'base';

export const isFractionalProduct = (product?: FractionalProductLike | null): boolean =>
  product?.fractionalSaleEnabled === true && Number(product?.containerSize || 0) > 0;

export const getBaseUnitName = (product?: FractionalProductLike | null): string =>
  String(product?.baseUnitName || product?.unit || 'Litre').trim() || 'Litre';

export const getContainerUnitName = (product?: FractionalProductLike | null): string =>
  String(product?.containerUnitName || 'Container').trim() || 'Container';

export const getContainerSize = (product?: FractionalProductLike | null): number =>
  Math.max(0, round3(Number(product?.containerSize || 0)));

export const getFractionalBasePrice = (product?: FractionalProductLike | null): number => {
  if (!isFractionalProduct(product)) return round3(Number(product?.sellingPrice || 0));
  const configured = Number(product?.fractionalUnitPrice || 0);
  if (configured > 0) return round3(configured);
  const wholePrice = Math.max(0, Number(product?.sellingPrice || 0));
  const divided = wholePrice / getContainerSize(product);
  const premium = Math.max(0, Number(product?.fractionalPricePremium || 0));
  return round3(divided + premium);
};

export const getContainerPrice = (product?: FractionalProductLike | null): number =>
  round3(Math.max(0, Number(product?.sellingPrice || 0)));

export const getFractionalModeUnitName = (
  product: FractionalProductLike | null | undefined,
  mode: FractionalSaleMode,
): string => mode === 'container' ? getContainerUnitName(product) : getBaseUnitName(product);

export const getFractionalModeUnitPrice = (
  product: FractionalProductLike | null | undefined,
  mode: FractionalSaleMode,
): number => mode === 'container' ? getContainerPrice(product) : getFractionalBasePrice(product);

export const getStockQuantityForSale = (
  product: FractionalProductLike | null | undefined,
  saleQuantity: unknown,
  mode: FractionalSaleMode,
): number => {
  const qty = Math.max(0, Number(saleQuantity || 0));
  if (!Number.isFinite(qty)) return 0;
  if (isFractionalProduct(product) && mode === 'container') {
    return round3(qty * getContainerSize(product));
  }
  return round3(qty);
};

export const isFractionalStockStoredAsBase = (record?: FractionalStockMetaLike | null): boolean => {
  if (!record) return false;
  if (record.fractionalStockStoredAsBase === true) return true;
  if (normalize(record.fractionalStockUnit) === FRACTIONAL_STOCK_BASE_UNIT_VALUE) return true;
  if (normalize(record.meta?.fractionalStockUnit) === FRACTIONAL_STOCK_BASE_UNIT_VALUE) return true;
  return record.meta?.fractionalStockStoredAsBase === true;
};

export const withFractionalStockBaseMeta = <T extends FractionalStockMetaLike>(record: T): T => ({
  ...record,
  fractionalStockStoredAsBase: true,
  fractionalStockUnit: FRACTIONAL_STOCK_BASE_UNIT_VALUE,
  meta: {
    ...(record.meta || {}),
    fractionalStockStoredAsBase: true,
    fractionalStockUnit: FRACTIONAL_STOCK_BASE_UNIT_VALUE,
  },
});

export const convertContainerStockToBaseUnits = (
  stock: unknown,
  product?: FractionalProductLike | null,
): number => {
  const qty = Math.max(0, Number(stock || 0));
  if (!isFractionalProduct(product)) return round3(qty);
  return round3(qty * getContainerSize(product));
};

export const getSaleDisplayQuantity = (item: FractionalSaleItemLike): number =>
  round3(Number(item.saleQuantity ?? item.quantityInput ?? item.qty ?? 0));

export const getSaleDisplayUnit = (item: FractionalSaleItemLike): string =>
  String(item.saleUnitName || item.unit || '').trim();

export const getStockDisplay = (
  stock: unknown,
  product?: FractionalProductLike | null,
): string => {
  const qty = Math.max(0, round3(Number(stock || 0)));
  if (!isFractionalProduct(product)) {
    return `${qty.toFixed(3)} ${String(product?.unit || '').trim()}`.trim();
  }
  const size = getContainerSize(product);
  const fullContainers = size > 0 ? Math.floor(qty / size) : 0;
  const remainder = size > 0 ? round3(qty - (fullContainers * size)) : qty;
  const parts: string[] = [];
  if (fullContainers > 0) parts.push(`${fullContainers} ${getContainerUnitName(product)}`);
  if (remainder > 0 || parts.length === 0) parts.push(`${remainder.toFixed(3)} ${getBaseUnitName(product)}`);
  return parts.join(' + ');
};
