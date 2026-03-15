import { Discount } from '../context/GlobalContext';

export interface DiscountMatchItem {
  id?: string;
  name?: string;
  brand?: string;
  category?: string;
}

export interface DiscountMatchContext {
  saleDate: Date;
  location?: string;
  sellingPriceGroup?: string;
  customerGroup?: string;
  items: DiscountMatchItem[];
}

const normalizeText = (value?: string | number | null) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const parseDateValue = (value?: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseNumericValue = (value?: string | number): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const numeric = Number(String(value || '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
};

const isAllToken = (value?: string | number | null): boolean => {
  const normalized = normalizeText(value);
  return (
    normalized.length === 0 ||
    normalized === 'all' ||
    normalized === 'all locations' ||
    normalized === 'all location' ||
    normalized === 'all brands' ||
    normalized === 'all categories' ||
    normalized === 'all products'
  );
};

const normalizePriority = (value?: string | number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return Number.MAX_SAFE_INTEGER;
  return parsed < 0 ? 0 : parsed;
};

export const resolveDiscountType = (discount?: Discount | null): 'Fixed' | 'Percentage' | null => {
  if (!discount) return null;
  const explicit = normalizeText(discount.discountType);
  if (explicit === 'fixed') return 'Fixed';
  if (explicit === 'percentage') return 'Percentage';

  const amountText = String(discount.discountAmount || '');
  if (amountText.includes('%')) return 'Percentage';
  if (amountText.trim().length > 0) return 'Fixed';
  return null;
};

export const getDiscountAmountNumeric = (discount?: Discount | null): number => {
  if (!discount) return 0;
  return Math.max(0, parseNumericValue(discount.discountAmount));
};

export const formatDiscountAmount = (discount?: Discount | null): string => {
  if (!discount) return '--';
  const type = resolveDiscountType(discount);
  const amount = getDiscountAmountNumeric(discount);
  if (!type || amount <= 0) return '--';
  if (type === 'Percentage') return `${amount}%`;
  return `${amount.toFixed(3)}`;
};

export const isDiscountActive = (discount: Discount, atDate: Date): boolean => {
  if (discount.isActive === false) return false;
  const startsAt = parseDateValue(discount.startsAt);
  const endsAt = parseDateValue(discount.endsAt);
  if (startsAt && atDate < startsAt) return false;
  if (endsAt && atDate > endsAt) return false;
  return true;
};

export const discountMatchesContext = (discount: Discount, context: DiscountMatchContext): boolean => {
  if (!isDiscountActive(discount, context.saleDate)) return false;

  const normalizedLocation = normalizeText(discount.location);
  if (!isAllToken(normalizedLocation) && normalizedLocation !== normalizeText(context.location)) {
    return false;
  }

  const normalizedSellingGroup = normalizeText(discount.sellingPriceGroup);
  if (!isAllToken(normalizedSellingGroup) && normalizedSellingGroup !== normalizeText(context.sellingPriceGroup)) {
    return false;
  }

  if (discount.applyInCustomerGroups) {
    const selectedGroups = Array.isArray(discount.selectedGroups)
      ? discount.selectedGroups.map(group => normalizeText(group)).filter(Boolean)
      : [];
    const currentCustomerGroup = normalizeText(context.customerGroup);
    if (selectedGroups.length === 0 || !currentCustomerGroup || !selectedGroups.includes(currentCustomerGroup)) {
      return false;
    }
  }

  const items = context.items || [];
  const normalizedBrand = normalizeText(discount.brand);
  if (!isAllToken(normalizedBrand)) {
    const hasBrandMatch = items.some(item => normalizeText(item.brand) === normalizedBrand);
    if (!hasBrandMatch) return false;
  }

  const normalizedCategory = normalizeText(discount.category);
  if (!isAllToken(normalizedCategory)) {
    const hasCategoryMatch = items.some(item => normalizeText(item.category) === normalizedCategory);
    if (!hasCategoryMatch) return false;
  }

  const productRule = String(discount.products || '').trim();
  if (!isAllToken(productRule)) {
    const terms = productRule
      .split(',')
      .map(term => normalizeText(term))
      .filter(Boolean);

    if (terms.length > 0) {
      const hasProductMatch = items.some(item => {
        const name = normalizeText(item.name);
        return terms.some(term => name.includes(term));
      });
      if (!hasProductMatch) return false;
    }
  }

  return true;
};

export const sortDiscountsByPriority = (a: Discount, b: Discount): number => {
  const pa = normalizePriority(a.priority);
  const pb = normalizePriority(b.priority);
  if (pa !== pb) return pa - pb;
  const aName = normalizeText(a.name);
  const bName = normalizeText(b.name);
  return aName.localeCompare(bName);
};

export const findBestApplicableDiscount = (
  discounts: Discount[],
  context: DiscountMatchContext
): Discount | null => {
  const candidates = discounts
    .filter(discount => discountMatchesContext(discount, context))
    .sort(sortDiscountsByPriority);
  return candidates[0] || null;
};

export const computeDiscountValue = (discount: Discount, subtotal: number): number => {
  const safeSubtotal = Math.max(0, Number(subtotal || 0));
  const amount = getDiscountAmountNumeric(discount);
  const type = resolveDiscountType(discount);
  if (!type || amount <= 0 || safeSubtotal <= 0) return 0;
  if (type === 'Percentage') {
    const pct = Math.min(100, amount);
    return (safeSubtotal * pct) / 100;
  }
  return Math.min(safeSubtotal, amount);
};

export const resolveAppliedDiscount = (
  discount: Discount | null,
  subtotal: number
): { discountType: 'Fixed' | 'Percentage'; discountAmount: number; discountValue: number } | null => {
  if (!discount) return null;
  const discountType = resolveDiscountType(discount);
  if (!discountType) return null;
  const discountAmount = getDiscountAmountNumeric(discount);
  const discountValue = computeDiscountValue(discount, subtotal);
  if (discountAmount <= 0 || discountValue <= 0) return null;
  return {
    discountType,
    discountAmount,
    discountValue,
  };
};
