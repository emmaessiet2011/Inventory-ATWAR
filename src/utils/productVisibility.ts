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
  product: Product,
  location?: Pick<Location, 'id' | 'name'> | null,
): boolean => {
  if (!location) return true;
  const locationId = normalize(location.id);
  const locationName = normalize(location.name);

  const selectedIds = getProductLocationIds(product).map(normalize);
  const selectedNames = getProductLocationNames(product).map(normalize);

  if (selectedIds.length > 0 || selectedNames.length > 0) {
    return selectedIds.includes(locationId) || selectedNames.includes(locationName);
  }

  const legacyLocation = normalize(product.businessLocation);
  return !legacyLocation || legacyLocation === locationName;
};

export const productVisibleToUser = (
  product: Product,
  user: AppUser | null,
  locations: Location[],
): boolean => {
  if (!user) return true;
  if (normalize(user.role) === 'admin') return true;

  const accessLocationIds = Array.isArray(user.accessLocations)
    ? user.accessLocations.map(normalize).filter(Boolean)
    : [];
  const hasAllLocations = accessLocationIds.some(value => value === 'all locations' || value === 'all');

  let locMatch = false;
  if (hasAllLocations) {
    locMatch = true;
  } else {
    const locationMatches = locations.filter(location => (
      accessLocationIds.includes(normalize(location.id)) ||
      accessLocationIds.includes(normalize(location.name)) ||
      normalize(location.name) === normalize(user.businessLocation)
    ));

    if (locationMatches.length === 0 && user.businessLocation) {
      locMatch = !normalize(product.businessLocation) || normalize(product.businessLocation) === normalize(user.businessLocation);
    } else {
      locMatch = locationMatches.some(location => productVisibleAtLocation(product, location));
    }
  }

  if (!locMatch) return false;

  // Category restriction (if defined)
  const accessCategories = Array.isArray(user.accessCategories)
    ? user.accessCategories.map(normalize).filter(Boolean)
    : [];
  
  if (accessCategories.length > 0 && !accessCategories.includes('all categories') && !accessCategories.includes('all')) {
    const productCat = normalize(product.category);
    if (!accessCategories.includes(productCat)) {
      return false;
    }
  }

  return true;
};
