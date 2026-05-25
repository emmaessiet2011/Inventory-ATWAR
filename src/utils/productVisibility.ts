import type { AppUser, Location, Product } from '@/context/GlobalContext';

const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase();
const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const isMeaningfulToken = (value: unknown): boolean => {
  const token = String(value ?? '').trim();
  if (!token) return false;
  const lowered = token.toLowerCase();
  return lowered !== '[object object]' && lowered !== 'undefined' && lowered !== 'null';
};
const extractLocationTokens = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractLocationTokens(item));
  }
  if (value && typeof value === 'object') {
    const record = toRecord(value);
    return [
      String(record.id || '').trim(),
      String(record.name || '').trim(),
      String(record.locationId || '').trim(),
      String(record.locationName || '').trim(),
      String(record.location || '').trim(),
      String(record.businessLocation || '').trim(),
    ].filter(isMeaningfulToken);
  }
  const token = String(value ?? '').trim();
  return isMeaningfulToken(token) ? [token] : [];
};
const getUserLocationTokens = (user: AppUser | null): string[] => {
  if (!user) return [];
  const unsafeUser = user as any;
  const meta = toRecord(unsafeUser.meta);
  const tokens = [
    ...extractLocationTokens(user.accessLocations),
    ...extractLocationTokens(unsafeUser.locationId),
    ...extractLocationTokens(unsafeUser.location),
    ...extractLocationTokens(unsafeUser.locationName),
    ...extractLocationTokens(user.businessLocation),
    ...extractLocationTokens(meta.accessLocations),
    ...extractLocationTokens(meta.locationId),
    ...extractLocationTokens(meta.location),
    ...extractLocationTokens(meta.locationName),
    ...extractLocationTokens(meta.businessLocation),
  ];
  return Array.from(new Set(tokens.map((token) => token.trim()).filter(isMeaningfulToken)));
};

export const getProductLocationIds = (product: Product): string[] => (
  Array.isArray(product.availableLocationIds)
    ? product.availableLocationIds.map(String).map(value => value.trim()).filter(Boolean)
    : []
);

export const getProductLocationNames = (product: Product): string[] => (
  Array.isArray(product.availableLocations)
    ? product.availableLocations.map(String).map(value => value.trim()).filter(Boolean)
    : []
);

export const productVisibleAtLocation = (
  _product: Product,
  _location?: Pick<Location, 'id' | 'name'> | null,
): boolean => {
  // FORCE GLOBAL CATALOG: All products are visible everywhere. 
  // Stock availability per location naturally dictates what can be sold.
  return true;
};

export const productVisibleToUser = (
  product: Product,
  user: AppUser | null,
  _locations: Location[],
): boolean => {
  if (!user) return true;
  if (normalize(user.role) === 'admin') return true;

  // Category restriction (if defined by user role permissions)
  const accessCategories = Array.isArray(user.accessCategories)
    ? user.accessCategories.map(normalize).filter(Boolean)
    : [];
  
  if (accessCategories.length > 0 && !accessCategories.includes('all categories') && !accessCategories.includes('all')) {
    const productCat = normalize(product.category);
    if (!accessCategories.includes(productCat)) {
      return false;
    }
  }

  // Location filters bypassed: enforce global product visibility.
  return true;
};

export const isLocationAccessible = (
  recordLocationName: string,
  user: AppUser | null,
  locations: Location[]
): boolean => {
  if (!user) return true;
  if (normalize(user.role) === 'admin') return true;

  const accessLocationIds = getUserLocationTokens(user).map(normalize).filter(Boolean);

  if (accessLocationIds.some(value => value === 'all locations' || value === 'all')) {
    return true;
  }

  const normalizedRecordLoc = normalize(recordLocationName);
  if (!normalizedRecordLoc) return true; // Global or unassigned

  if (normalize(user.businessLocation) === normalizedRecordLoc) {
    return true;
  }

  const matchingLoc = locations.find(loc => normalize(loc.name) === normalizedRecordLoc);
  
  if (matchingLoc) {
    if (accessLocationIds.includes(normalize(matchingLoc.id))) return true;
    if (accessLocationIds.includes(normalize(matchingLoc.name))) return true;
  } else {
    if (accessLocationIds.includes(normalizedRecordLoc)) return true;
  }

  return false;
};

export const getAccessibleActiveLocations = (
  locations: Location[],
  user: AppUser | null,
): Location[] => {
  const activeLocations = locations.filter((location) => location.isActive !== false);
  if (!user) return activeLocations;
  if (normalize(user.role) === 'admin') return activeLocations;

  const scoped = activeLocations.filter((location) => isLocationAccessible(location.name, user, locations));
  if (scoped.length > 0) return scoped;

  const fallbackLocationTokens = getUserLocationTokens(user).map(normalize).filter(Boolean);
  if (fallbackLocationTokens.length === 0) return [];
  if (fallbackLocationTokens.some((value) => value === 'all locations' || value === 'all')) return activeLocations;
  return activeLocations.filter((location) =>
    fallbackLocationTokens.includes(normalize(location.name)) ||
    fallbackLocationTokens.includes(normalize(location.id)),
  );
};
