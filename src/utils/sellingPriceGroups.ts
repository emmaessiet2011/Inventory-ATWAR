export interface SellingPriceRuleLike {
  id?: string;
  productId?: string;
  product_id?: string;
  productID?: string;
  name?: string;
  productName?: string;
  product?: string;
  description?: string;
  sku?: string;
  productSku?: string;
  productSKU?: string;
  productCode?: string;
  code?: string;
  barcode?: string;
  price?: number | string;
  sellingPrice?: number | string;
  unitPrice?: number | string;
  groupPrice?: number | string;
  overridePrice?: number | string;
  finalPrice?: number | string;
  value?: number | string;
  overrideDiscount?: number | string;
  overrideDiscountPercent?: number | string;
  discount?: number | string;
  discountPercent?: number | string;
}

export interface ProductLike {
  id?: string;
  name?: string;
  sku?: string;
  barcode?: string;
  barcodeNo?: string;
  productCode?: string;
  code?: string;
  sellingPrice?: number | string;
}

export interface SellingPriceGroupLike {
  id?: string;
  name?: string;
  status?: string;
  discount?: number | string;
  priceCalcPercentage?: number | string;
  applicableProducts?: unknown;
  productPrices?: unknown;
  prices?: unknown;
  meta?: Record<string, unknown> | null;
}

interface PriceComputationOptions {
  basePrice?: number;
}

export interface SellingPriceComputation {
  price: number;
  applies: boolean;
  rule?: SellingPriceRuleLike;
}

const toArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

const toPlainObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const parseNumberish = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed
      .replace(/,/g, '')
      .replace(/[^\d.+-]/g, '');
    if (!normalized || ['-', '+', '.', '-.', '+.'].includes(normalized)) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  const parsed = parseNumberish(value);
  if (parsed === null) return fallback;
  return parsed;
};

const toOptionalNonNegativeNumber = (value: unknown): number | null => {
  const parsed = parseNumberish(value);
  if (parsed === null) return null;
  if (parsed < 0) return null;
  return parsed;
};

const normalizeText = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const compactText = (value: unknown): string =>
  normalizeText(value).replace(/[^a-z0-9]+/g, '');

const normalizeSku = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

const firstNonEmpty = (...values: unknown[]): string => {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
};

const firstNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    const parsed = toOptionalNonNegativeNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

const normalizeRule = (value: unknown): SellingPriceRuleLike | null => {
  const row = toPlainObject(value);
  if (Object.keys(row).length === 0) return null;
  const id = firstNonEmpty(row.id, row.productId, row.product_id, row.productID);
  const name = firstNonEmpty(row.name, row.productName, row.product, row.description);
  const sku = firstNonEmpty(row.sku, row.productSku, row.productSKU, row.productCode, row.code, row.barcode);
  const price = firstNumber(
    row.overridePrice,
    row.price,
    row.sellingPrice,
    row.unitPrice,
    row.groupPrice,
    row.value,
  );
  const finalPrice = firstNumber(row.finalPrice, row.final_price, row.finalprice);
  const discount = firstNumber(
    row.overrideDiscount,
    row.overrideDiscountPercent,
    row.discount,
    row.discountPercent,
  );

  if (!id && !name && !sku && price === null && finalPrice === null && discount === null) return null;

  const normalizedPrice = price ?? finalPrice;

  return {
    ...row,
    id,
    name,
    sku,
    price: normalizedPrice ?? undefined,
    finalPrice: finalPrice ?? undefined,
    discount: discount ?? undefined,
    overrideDiscount: discount ?? undefined,
    overrideDiscountPercent: discount ?? undefined,
  } as SellingPriceRuleLike;
};

const dedupeRules = (rules: SellingPriceRuleLike[]): SellingPriceRuleLike[] => {
  const seen = new Set<string>();
  const result: SellingPriceRuleLike[] = [];
  rules.forEach((rule, index) => {
    const key = [
      normalizeSku(rule.id || rule.productId || rule.product_id || rule.productID),
      normalizeSku(rule.sku || rule.productSku || rule.productSKU || rule.productCode || rule.code || rule.barcode),
      compactText(rule.name || rule.productName || rule.product || rule.description),
      index,
    ].filter(Boolean).join('|');
    if (seen.has(key)) return;
    seen.add(key);
    result.push(rule);
  });
  return result;
};

export const getSellingPriceGroupProductRules = (group?: SellingPriceGroupLike | null): SellingPriceRuleLike[] => {
  if (!group) return [];
  const meta = toPlainObject(group.meta);
  const sources = [
    group.applicableProducts,
    meta.applicableProducts,
    group.productPrices,
    meta.productPrices,
    group.prices,
    meta.prices,
  ];
  return dedupeRules(
    sources
      .flatMap(toArray)
      .map(normalizeRule)
      .filter((rule): rule is SellingPriceRuleLike => !!rule),
  );
};

export const findSellingPriceGroupProductRule = (
  group: SellingPriceGroupLike | null | undefined,
  product: ProductLike | null | undefined,
): SellingPriceRuleLike | undefined => {
  if (!group || !product) return undefined;
  const rules = getSellingPriceGroupProductRules(group);
  if (rules.length === 0) return undefined;

  const productId = normalizeSku(product.id);
  const productSkuCandidates = [
    product.sku,
    product.barcode,
    product.barcodeNo,
    product.productCode,
    product.code,
  ].map(normalizeSku).filter(Boolean);
  const productName = normalizeText(product.name);
  const productNameCompact = compactText(product.name);

  return rules.find((rule) => {
    const ruleId = normalizeSku(rule.id || rule.productId || rule.product_id || rule.productID);
    if (ruleId && productId && ruleId === productId) return true;

    const ruleSkuCandidates = [
      rule.sku,
      rule.productSku,
      rule.productSKU,
      rule.productCode,
      rule.code,
      rule.barcode,
    ].map(normalizeSku).filter(Boolean);
    if (ruleSkuCandidates.some((candidate) => productSkuCandidates.includes(candidate))) return true;

    const ruleName = normalizeText(rule.name || rule.productName || rule.product || rule.description);
    if (ruleName && productName && ruleName === productName) return true;

    const ruleNameCompact = compactText(rule.name || rule.productName || rule.product || rule.description);
    return !!ruleNameCompact && !!productNameCompact && ruleNameCompact === productNameCompact;
  });
};

export const computeSellingPriceGroupProductPrice = (
  group: SellingPriceGroupLike | null | undefined,
  product: ProductLike | null | undefined,
  options: PriceComputationOptions = {},
): SellingPriceComputation => {
  const basePrice = Math.max(0, toFiniteNumber(options.basePrice ?? product?.sellingPrice, 0));
  if (!group) return { price: basePrice, applies: false };

  const rules = getSellingPriceGroupProductRules(group);
  const meta = toPlainObject(group.meta);
  const groupDiscount = toFiniteNumber(
    group.discount
      ?? (group as { discountPercent?: unknown }).discountPercent
      ?? meta.discount
      ?? meta.discountPercent
      ?? meta.defaultDiscount,
    0,
  );
  const adjustedBase = basePrice * (1 + (toFiniteNumber(group.priceCalcPercentage, 0) / 100));

  if (rules.length === 0) {
    const price = Math.max(0, adjustedBase * (1 - (groupDiscount / 100)));
    return { price: Number(price.toFixed(3)), applies: true };
  }

  const rule = findSellingPriceGroupProductRule(group, product);
  if (!rule) return { price: basePrice, applies: false };

  const rulePrice = firstNumber(
    rule.overridePrice,
    rule.price,
    rule.sellingPrice,
    rule.unitPrice,
    rule.groupPrice,
    rule.value,
  );
  const ruleFinalPrice = firstNumber(
    rule.finalPrice,
    (rule as { final_price?: unknown }).final_price,
    (rule as { finalprice?: unknown }).finalprice,
  );
  const discount = firstNumber(
    rule.overrideDiscount,
    rule.overrideDiscountPercent,
    rule.discount,
    rule.discountPercent,
  ) ?? groupDiscount;
  const price = (() => {
    if (rulePrice === null && ruleFinalPrice !== null) return Math.max(0, ruleFinalPrice);
    const priceBase = rulePrice !== null ? rulePrice : adjustedBase;
    return Math.max(0, priceBase * (1 - (discount / 100)));
  })();

  return {
    price: Number(price.toFixed(3)),
    applies: true,
    rule,
  };
};

export const getSellingPriceGroupRuleSignature = (group?: SellingPriceGroupLike | null): string => {
  if (!group) return '';
  return getSellingPriceGroupProductRules(group)
    .map((rule) => [
      rule.id || rule.productId || rule.product_id || rule.productID || '',
      rule.sku || rule.productSku || rule.productSKU || rule.productCode || rule.code || rule.barcode || '',
      rule.name || rule.productName || rule.product || rule.description || '',
      rule.overridePrice ?? rule.price ?? rule.sellingPrice ?? rule.unitPrice ?? rule.groupPrice ?? rule.value ?? '',
      rule.overrideDiscount ?? rule.overrideDiscountPercent ?? rule.discount ?? rule.discountPercent ?? '',
      rule.finalPrice ?? '',
    ].map((value) => String(value).trim()).join(':'))
    .join('|');
};
