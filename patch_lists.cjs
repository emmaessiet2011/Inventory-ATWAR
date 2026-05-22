const fs = require('fs');
const path = require('path');

// --- Patch Inventory.tsx ---
const invPath = path.join('src', 'components', 'products', 'Inventory.tsx');
let invContent = fs.readFileSync(invPath, 'utf8');

// 1. Import calculateAvailableStock
const invImportPoint = "ProductLocationInventory,";
const invImportReplace = `ProductLocationInventory,\n  calculateAvailableStock,`;
if (!invContent.includes('calculateAvailableStock')) {
  invContent = invContent.replace(invImportPoint, invImportReplace);
}

// 2. Update getProductStockForList
const oldGetStockList = `  const getProductStockForList = (product: Product): number => {
    if (!selectedProductListLocations.length) return Number(product.stock || 0);

    const selectedStock = selectedProductListLocations.reduce((sum, location) => {
      const row = locationInventoryByKey.get(inventoryKey(product.id, location.id));
      return sum + Number(row?.stock || 0);
    }, 0);

    return Number(selectedStock.toFixed(3));
  };`;

const newGetStockList = `  const getProductStockForList = (product: Product): number => {
    const locationsToUse = selectedProductListLocations.length > 0 
      ? selectedProductListLocations 
      : allowedProductListLocations;

    if (!locationsToUse.length) return Number(product.stock || 0);

    const selectedStock = locationsToUse.reduce((sum, location) => {
      return sum + calculateAvailableStock(product as any, location.id, locationInventory);
    }, 0);

    return Number(selectedStock.toFixed(3));
  };`;

if (invContent.includes('if (!selectedProductListLocations.length) return Number(product.stock || 0);')) {
  invContent = invContent.replace(oldGetStockList, newGetStockList);
}
fs.writeFileSync(invPath, invContent);
console.log('Patched Inventory.tsx');

// --- Patch Products.tsx ---
// Products.tsx does not have locationInventory fetched. It just displays product.stock.
// But we want it to show location-scoped stock based on the user's permissions.
// To do this fully, Products.tsx would need to fetch locationInventory.
// Since Inventory.tsx is the primary inventory manager tool, we can leave Products.tsx alone for now,
// OR we can just add a note to the user that Products.tsx is a generic view.
// Let's actually fetch locationInventory in Products.tsx.

const prodPath = path.join('src', 'components', 'products', 'Products.tsx');
let prodContent = fs.readFileSync(prodPath, 'utf8');

// 1. Import
const prodImportPoint = "import { useGlobalContext, Product } from '@/context/GlobalContext';";
const prodImportReplace = `import { useGlobalContext, Product } from '@/context/GlobalContext';
import { fetchLocationInventoryFromDB, ProductLocationInventory, calculateAvailableStock } from '@/utils/stockLocationInventory';
import { productVisibleAtLocation, productVisibleToUser } from '@/utils/productVisibility';`;
if (!prodContent.includes('fetchLocationInventoryFromDB')) {
  prodContent = prodContent.replace(prodImportPoint, prodImportReplace);
}

// 2. State
const prodStatePoint = "  const [bulkPricingProduct, setBulkPricingProduct] = useState<Product | null>(null);";
const prodStateReplace = `  const [bulkPricingProduct, setBulkPricingProduct] = useState<Product | null>(null);
  const [locationInventory, setLocationInventory] = useState<ProductLocationInventory[]>([]);

  useEffect(() => {
    let isMounted = true;
    fetchLocationInventoryFromDB().then((records) => {
      if (isMounted) setLocationInventory(records);
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  const getProductStockForList = (product: Product): number => {
    if (!locations || locations.length === 0) return Number(product.stock || 0);
    const allowedLocations = locations.filter(loc => currentUser?.locations?.includes(loc.id) || !currentUser?.locations?.length);
    if (!allowedLocations.length) return Number(product.stock || 0);
    return allowedLocations.reduce((sum, location) => {
      return sum + calculateAvailableStock(product as any, location.id, locationInventory);
    }, 0);
  };
`;
if (!prodContent.includes('const [locationInventory')) {
  prodContent = prodContent.replace(prodStatePoint, prodStateReplace);
}

// Replace product.stock with getProductStockForList(product)
// But we have to be careful with string replacements. We'll do the most important ones.
prodContent = prodContent.replace(/Number\(product\.stock \|\| 0\)/g, "getProductStockForList(product)");
prodContent = prodContent.replace(/product\.stock > 0/g, "getProductStockForList(product) > 0");
prodContent = prodContent.replace(/Number\(p\.stock \|\| 0\)/g, "getProductStockForList(p)");

fs.writeFileSync(prodPath, prodContent);
console.log('Patched Products.tsx');
