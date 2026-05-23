const fs = require('fs');

function fixImport(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace("import React,", "import { isLocationAccessible } from '@/utils/productVisibility';\nimport React,");
  fs.writeFileSync(file, content);
}

fixImport('src/components/stock/AddStockTransfer.tsx');
fixImport('src/components/stock/AddStockAdjustment.tsx');
console.log('Imports fixed.');
