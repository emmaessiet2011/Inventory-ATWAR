const fs = require('fs');

function patchListTransfers() {
  let f = fs.readFileSync('src/components/stock/ListStockTransfers.tsx', 'utf8');
  if (!f.includes('isLocationAccessible')) {
    f = f.replace(/import \{ fetchLocationInventoryFromDB \} from '@\/utils\/stockLocationInventory';/g, "import { fetchLocationInventoryFromDB } from '@/utils/stockLocationInventory';\nimport { isLocationAccessible } from '@/utils/productVisibility';");
    f = f.replace(/if \(filters\.status\.length > 0 && !filters\.status\.includes\(transfer\.status\)\) return false;/g, `if (filters.status.length > 0 && !filters.status.includes(transfer.status)) return false;

        const fromAccessible = isLocationAccessible(transfer.locationFrom, currentUser, locations);
        const toAccessible = isLocationAccessible(transfer.locationTo, currentUser, locations);
        if (!fromAccessible && !toAccessible) return false;`);
    fs.writeFileSync('src/components/stock/ListStockTransfers.tsx', f);
    console.log('Patched ListStockTransfers.tsx');
  }
}

function patchListAdjustments() {
  let f = fs.readFileSync('src/components/stock/ListStockAdjustments.tsx', 'utf8');
  if (!f.includes('isLocationAccessible')) {
    f = f.replace(/import \{ deleteDedicatedStrict \} from '@\/utils\/apiClient';/g, "import { deleteDedicatedStrict } from '@/utils/apiClient';\nimport { isLocationAccessible } from '@/utils/productVisibility';");
    f = f.replace(/if \(filters\.user\.length > 0 && !filters\.user\.includes\(adjustment\.addedBy\)\) return false;/g, `if (filters.user.length > 0 && !filters.user.includes(adjustment.addedBy)) return false;
        
        if (!isLocationAccessible(adjustment.location, currentUser, locations)) return false;`);
    fs.writeFileSync('src/components/stock/ListStockAdjustments.tsx', f);
    console.log('Patched ListStockAdjustments.tsx');
  }
}

function patchAddTransfer() {
  let f = fs.readFileSync('src/components/stock/AddStockTransfer.tsx', 'utf8');
  if (!f.includes('isLocationAccessible')) {
    f = f.replace(/import \{ fetchLocationInventoryFromDB/g, "import { isLocationAccessible } from '@/utils/productVisibility';\nimport { fetchLocationInventoryFromDB");
    
    // Replace selectableSourceLocations
    f = f.replace(/const selectableSourceLocations = useMemo\(\(\) => \{[\s\S]*?\}, \[activeLocations, locationFrom, locations\]\);/, `const selectableSourceLocations = useMemo(() => {
    const baseLocations = activeLocations.filter(loc => isLocationAccessible(loc.name, currentUser, locations));
    if (!locationFrom) return baseLocations;
    const current = resolveLocationRecord(locationFrom);
    if (
      current &&
      current.isActive === false &&
      !baseLocations.some(location => normalize(location.id) === normalize(current.id))
    ) {
      return [current, ...baseLocations];
    }
    return baseLocations;
  }, [activeLocations, locationFrom, locations, currentUser]);`);
    fs.writeFileSync('src/components/stock/AddStockTransfer.tsx', f);
    console.log('Patched AddStockTransfer.tsx');
  }
}

function patchAddAdjustment() {
  let f = fs.readFileSync('src/components/stock/AddStockAdjustment.tsx', 'utf8');
  if (!f.includes('isLocationAccessible')) {
    f = f.replace(/import \{ deleteDedicatedStrict \} from '@\/utils\/apiClient';/g, "import { deleteDedicatedStrict } from '@/utils/apiClient';\nimport { isLocationAccessible } from '@/utils/productVisibility';");
    
    f = f.replace(/const selectableLocations = useMemo\(\(\) => \{[\s\S]*?\}, \[locationPool, locations, location\]\);/, `const selectableLocations = useMemo(() => {
      let filteredPool = locationPool.filter(loc => isLocationAccessible(loc.name, currentUser, locations));
      if (!location) return filteredPool;
      const current = locations.find(loc => normalize(loc.name) === normalize(location));
      if (
        current &&
        current.isActive === false &&
        !filteredPool.some(loc => normalize(loc.id) === normalize(current.id))
      ) {
        return [current, ...filteredPool];
      }
      return filteredPool;
    }, [locationPool, locations, location, currentUser]);`);
    fs.writeFileSync('src/components/stock/AddStockAdjustment.tsx', f);
    console.log('Patched AddStockAdjustment.tsx');
  }
}

patchListTransfers();
patchListAdjustments();
patchAddTransfer();
patchAddAdjustment();
