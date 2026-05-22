const fs = require('fs');

function fixProducts() {
  let p = fs.readFileSync('src/components/products/Products.tsx', 'utf8');
  p = p.replace(/import \{ fetchLocationInventoryFromDB, ProductLocationInventory, calculateAvailableStock \} from '@\/utils\/stockLocationInventory';\n/g, '');
  p = p.replace(/import \{ productVisibleAtLocation, productVisibleToUser \} from '@\/utils\/productVisibility';\n/g, '');
  p = p.replace(/import \{ getProductStockForList \} from '@\/utils\/productVisibility';\n/g, '');
  p = p.replace(/getProductStockForList\(p\)\.toFixed\(3\)/g, 'Number(p.stock || 0).toFixed(3)');
  fs.writeFileSync('src/components/products/Products.tsx', p);
}

function fixInventory() {
  let i = fs.readFileSync('src/components/products/Inventory.tsx', 'utf8');
  i = i.replace(/import \{ inventoryKey \} from '@\/utils\/stockLocationInventory';\n/g, '');
  i = i.replace(/, inventoryKey/g, '');
  i = i.replace(/inventoryKey, /g, '');
  fs.writeFileSync('src/components/products/Inventory.tsx', i);
}

function fixAddSale() {
  let a = fs.readFileSync('src/components/sales/AddSale.tsx', 'utf8');
  a = a.replace(/import \{ calculateAvailableStock \} from '@\/utils\/productVisibility';\n/g, '');
  a = a.replace(/, calculateAvailableStock/g, '');
  a = a.replace(/calculateAvailableStock, /g, '');
  fs.writeFileSync('src/components/sales/AddSale.tsx', a);
}

fixProducts();
fixInventory();
fixAddSale();

console.log('Second pass TS fixes applied.');
