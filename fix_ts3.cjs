const fs = require('fs');

function fixProducts() {
  let p = fs.readFileSync('src/components/products/Products.tsx', 'utf8');
  p = p.replace(/getProductStockForList\(([^)]+)\)/g, 'Number($1.stock || 0)');
  fs.writeFileSync('src/components/products/Products.tsx', p);
}

function fixInventory() {
  let i = fs.readFileSync('src/components/products/Inventory.tsx', 'utf8');
  i = i.replace(/import \{ inventoryKey \} from '@\/utils\/stockLocationInventory';\n/g, '');
  i = i.replace(/, inventoryKey/g, '');
  i = i.replace(/inventoryKey, /g, '');
  i = i.replace(/  inventoryKey,\n/g, '');
  fs.writeFileSync('src/components/products/Inventory.tsx', i);
}

function fixAddStock() {
  let a = fs.readFileSync('src/components/stock/AddStockAdjustment.tsx', 'utf8');
  a = a.replace(/import \{ ProductLocationInventory, fetchLocationInventoryFromDB \} from '@\/context\/GlobalContext';\n/g, '');
  a = a.replace(/import \{ ProductLocationInventory, fetchLocationInventoryFromDB \} from '@\/utils\/stockLocationInventory';\n/g, '');
  a = `import { ProductLocationInventory, fetchLocationInventoryFromDB } from '@/utils/stockLocationInventory';\n` + a;
  fs.writeFileSync('src/components/stock/AddStockAdjustment.tsx', a);
}

fixProducts();
fixInventory();
fixAddStock();

console.log('Third pass TS fixes applied.');
