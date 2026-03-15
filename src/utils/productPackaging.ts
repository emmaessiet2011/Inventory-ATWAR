export type ProductPackagingType = 'Piece' | 'Pack' | 'Carton';

const PACKAGING_TYPES: ProductPackagingType[] = ['Piece', 'Pack', 'Carton'];

export const normalizePackagingType = (value: unknown): ProductPackagingType => {
  const raw = String(value || '').trim();
  const matched = PACKAGING_TYPES.find((type) => type.toLowerCase() === raw.toLowerCase());
  return matched || 'Piece';
};

export const normalizeUnitsPerPackage = (value: unknown): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.floor(parsed);
};

export const getPackHint = (
  unit: string | undefined,
  packagingType?: unknown,
  unitsPerPackage?: unknown
): string | null => {
  const normalizedType = normalizePackagingType(packagingType);
  const normalizedUnits = normalizeUnitsPerPackage(unitsPerPackage);
  if (!normalizedUnits) return null;

  const normalizedUnit = String(unit || '').trim() || 'Pc(s)';
  const resolvedType = normalizedType === 'Piece' ? 'Carton' : normalizedType;
  return `1 ${resolvedType} = ${normalizedUnits} ${normalizedUnit}`;
};

export const formatUnitWithPack = (
  unit: string | undefined,
  packagingType?: unknown,
  unitsPerPackage?: unknown
): string => {
  const normalizedUnit = String(unit || '').trim() || 'Pc(s)';
  const hint = getPackHint(normalizedUnit, packagingType, unitsPerPackage);
  return hint ? `${normalizedUnit} | ${hint}` : normalizedUnit;
};

export const getAvailableQuantityModes = (
  packagingType?: unknown,
  unitsPerPackage?: unknown
): ProductPackagingType[] => {
  const normalizedType = normalizePackagingType(packagingType);
  const normalizedUnits = normalizeUnitsPerPackage(unitsPerPackage);
  if (!normalizedUnits) {
    return ['Piece'];
  }
  if (normalizedType !== 'Piece') {
    return ['Piece', normalizedType];
  }
  return ['Piece', 'Carton'];
};

const round3 = (value: number): number => Number((Number(value) || 0).toFixed(3));

export const toPieceQuantity = (
  displayQty: unknown,
  quantityMode?: unknown,
  unitsPerPackage?: unknown
): number => {
  const qty = Number(displayQty);
  if (!Number.isFinite(qty) || qty < 0) return 0;
  const mode = normalizePackagingType(quantityMode);
  const units = normalizeUnitsPerPackage(unitsPerPackage);
  if (mode !== 'Piece' && units) return round3(qty * units);
  return round3(qty);
};

export const fromPieceQuantity = (
  pieceQty: unknown,
  quantityMode?: unknown,
  unitsPerPackage?: unknown
): number => {
  const qty = Number(pieceQty);
  if (!Number.isFinite(qty) || qty < 0) return 0;
  const mode = normalizePackagingType(quantityMode);
  const units = normalizeUnitsPerPackage(unitsPerPackage);
  if (mode !== 'Piece' && units) return round3(qty / units);
  return round3(qty);
};
