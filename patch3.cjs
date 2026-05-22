const fs = require('fs');
const path = require('path');

// --- Patch AddSale.tsx ---
const addSalePath = path.join('src', 'components', 'sales', 'AddSale.tsx');
let addSaleContent = fs.readFileSync(addSalePath, 'utf8');

// Update import
addSaleContent = addSaleContent.replace(
  "fetchLocationInventoryFromDB, ProductLocationInventory, inventoryKey",
  "fetchLocationInventoryFromDB, ProductLocationInventory, calculateAvailableStock"
);

// Update getAvailableStock
const oldGetAvailableStock = `    const getAvailableStock = (product: Product) => {
      if (!location) return 0;
      const locId = locations.find(l => l.name === location)?.id;
      if (!locId) return 0;
      const match = locationInventory.find(record => inventoryKey(record.productId, record.locationId) === inventoryKey(product.id, locId));
      return Number(match?.stock || 0);
    };`;

const newGetAvailableStock = `    const getAvailableStock = (product: Product) => {
      if (!location) return 0;
      const locId = locations.find(l => l.name === location)?.id;
      if (!locId) return 0;
      return calculateAvailableStock(product, locId, locationInventory);
    };`;

addSaleContent = addSaleContent.replace(oldGetAvailableStock, newGetAvailableStock);
fs.writeFileSync(addSalePath, addSaleContent);
console.log('Patched AddSale.tsx');

// --- Patch POS.tsx ---
const posPath = path.join('src', 'components', 'pos', 'POS.tsx');
let posContent = fs.readFileSync(posPath, 'utf8');

// 1. Add imports
const posImportPoint = "import { useGlobalContext";
const posImportReplace = `import { fetchLocationInventoryFromDB, ProductLocationInventory, calculateAvailableStock } from '@/utils/stockLocationInventory';
import { useGlobalContext`;
if (!posContent.includes('fetchLocationInventoryFromDB')) {
  posContent = posContent.replace(posImportPoint, posImportReplace);
}

// 2. Add locationInventory state
const posStatePoint = "  const [stockHistoryProduct, setStockHistoryProduct] = useState<GlobalProduct | null>(null);";
const posStateReplace = `  const [stockHistoryProduct, setStockHistoryProduct] = useState<GlobalProduct | null>(null);
  const [locationInventory, setLocationInventory] = useState<ProductLocationInventory[]>([]);

  useEffect(() => {
    let isMounted = true;
    fetchLocationInventoryFromDB().then((records) => {
      if (isMounted) setLocationInventory(records);
    }).catch(() => {
      if (isMounted) setLocationInventory([]);
    });
    return () => { isMounted = false; };
  }, []);`;
if (!posContent.includes('const [locationInventory')) {
  posContent = posContent.replace(posStatePoint, posStateReplace);
}

// 3. Update canAdjustProductQty
const oldCanAdjust = `  const canAdjustProductQty = (product: GlobalProduct, desiredQty: number): boolean => {
    if (settings.allowOverselling) return true;
    return desiredQty <= Number(product.stock || 0);
  };`;

const newCanAdjust = `  const canAdjustProductQty = (product: GlobalProduct, desiredQty: number): boolean => {
    if (settings.allowOverselling) return true;
    if (!selectedLocation?.id) return false;
    const available = calculateAvailableStock(product as any, selectedLocation.id, locationInventory);
    return desiredQty <= available;
  };`;
posContent = posContent.replace(oldCanAdjust, newCanAdjust);

fs.writeFileSync(posPath, posContent);
console.log('Patched POS.tsx');

