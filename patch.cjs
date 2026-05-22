const fs = require('fs');
const path = require('path');
const file = path.join('src', 'components', 'stock', 'AddStockAdjustment.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add imports
content = content.replace(
  "import { useGlobalContext } from '@/context/GlobalContext';",
  "import { useGlobalContext } from '@/context/GlobalContext';\nimport { fetchLocationInventoryFromDB, ProductLocationInventory, inventoryKey } from '@/utils/stockLocationInventory';"
);

// 2. Add state and effect
const stateMarker = "const [rows, setRows] = useState<StockAdjustmentItem[]>([]);";
const stateAdd = `const [rows, setRows] = useState<StockAdjustmentItem[]>([]);
  const [locationInventory, setLocationInventory] = useState<ProductLocationInventory[]>([]);

  useEffect(() => {
    let isMounted = true;
    fetchLocationInventoryFromDB().then((records) => {
      if (isMounted) setLocationInventory(records);
    }).catch(() => {
      if (isMounted) setLocationInventory([]);
    });
    return () => { isMounted = false; };
  }, []);

  const getAvailableStock = (productId: string, locName: string) => {
    const locId = locations.find(l => normalize(l.name) === normalize(locName))?.id;
    if (!locId) return 0;
    const match = locationInventory.find((record) => (
      inventoryKey(record.productId, record.locationId) === inventoryKey(productId, locId)
    ));
    return round3(Number(match?.stock || 0));
  };
`;
content = content.replace(stateMarker, stateAdd);

// 3. Fix handleAddProduct
content = content.replace(
  "currentStockBefore: round3(Number(product.stock || 0)),",
  "currentStockBefore: getAvailableStock(product.id, location),"
);

// 4. Fix handleLocationChange
content = content.replace(
  "currentStockBefore: round3(Number(exact.stock || 0)),",
  "currentStockBefore: getAvailableStock(exact.id, nextLocation),"
);
content = content.replace(
  "currentStockBefore: round3(Number(bySku.stock || 0)),",
  "currentStockBefore: getAvailableStock(bySku.id, nextLocation),"
);

// 5. Fix handleSave (part 1)
content = content.replace(
  "currentStockBefore: round3(Number(latestProduct?.stock ?? row.currentStockBefore ?? 0)),",
  "currentStockBefore: latestProduct ? getAvailableStock(latestProduct.id, location) : row.currentStockBefore,"
);

// 6. Fix handleSave (part 2)
content = content.replace(
  "currentStockBefore: round3(Number(exact.stock || 0)),",
  "currentStockBefore: getAvailableStock(exact.id, location),"
);
content = content.replace(
  "currentStockBefore: round3(Number(bySku.stock || 0)),",
  "currentStockBefore: getAvailableStock(bySku.id, location),"
);

fs.writeFileSync(file, content);
console.log('Patched AddStockAdjustment.tsx');
