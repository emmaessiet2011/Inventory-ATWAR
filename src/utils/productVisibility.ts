import type { AppUser, Location, Product } from '@/context/GlobalContext';

const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase();

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

  const accessLocationIds = Array.isArray(user.accessLocations)
    ? user.accessLocations.map(normalize).filter(Boolean)
    : [];

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

  const fallbackLocation = normalize(user.businessLocation);
  if (!fallbackLocation) return [];
  return activeLocations.filter((location) =>
    normalize(location.name) === fallbackLocation || normalize(location.id) === fallbackLocation,
  );
};
