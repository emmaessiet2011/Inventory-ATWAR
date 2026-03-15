import type { AppSettings } from '../context/GlobalContext';

export interface ParsedWeighingScaleBarcode {
  skuSegment: string;
  quantity: number;
}

const toPositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const toDigits = (value: unknown): string => String(value ?? '').replace(/\D/g, '');

export const parseWeighingScaleBarcode = (
  rawInput: string,
  config: Pick<
    AppSettings,
    | 'weighingScaleBarcodePrefix'
    | 'weighingScaleProductSkuLength'
    | 'weighingScaleQuantityIntegerPartLength'
    | 'weighingScaleQuantityFractionalPartLength'
  >,
): ParsedWeighingScaleBarcode | null => {
  const digits = toDigits(rawInput);
  if (!digits) return null;

  const prefix = toDigits(config.weighingScaleBarcodePrefix || '29');
  if (!prefix || !digits.startsWith(prefix)) return null;

  const skuLength = toPositiveInt(config.weighingScaleProductSkuLength, 5);
  const integerLength = toPositiveInt(config.weighingScaleQuantityIntegerPartLength, 4);
  const fractionalLength = toPositiveInt(config.weighingScaleQuantityFractionalPartLength, 4);
  const minLength = prefix.length + skuLength + integerLength + fractionalLength;
  if (digits.length < minLength) return null;

  const skuStart = prefix.length;
  const skuEnd = skuStart + skuLength;
  const intEnd = skuEnd + integerLength;
  const fracEnd = intEnd + fractionalLength;

  const skuSegment = digits.slice(skuStart, skuEnd);
  const integerPart = Number.parseInt(digits.slice(skuEnd, intEnd), 10);
  const fractionalPartRaw = digits.slice(intEnd, fracEnd);
  const fractionalPart = Number.parseInt(fractionalPartRaw || '0', 10);

  if (!skuSegment || Number.isNaN(integerPart) || Number.isNaN(fractionalPart)) return null;

  const quantity = Number((integerPart + (fractionalPart / (10 ** fractionalLength))).toFixed(3));
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  return { skuSegment, quantity };
};

export const normalizeSkuDigits = (sku: string): string => String(sku || '').replace(/\D/g, '');
