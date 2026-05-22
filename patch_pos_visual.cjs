const fs = require('fs');
const path = require('path');
const posPath = path.join('src', 'components', 'pos', 'POS.tsx');
let posContent = fs.readFileSync(posPath, 'utf8');

posContent = posContent.replace(
  "message: \`\${product.name} stock is \${Number(product.stock || 0).toFixed(3)}.\`,",
  "message: \`\${product.name} stock is \${selectedLocation ? calculateAvailableStock(product as any, selectedLocation.id, locationInventory) : 0}.\`,"
);

posContent = posContent.replace(
  "message: \`\${item.name} stock is \${Number(item.stock || 0).toFixed(3)}.\`,",
  "message: \`\${item.name} stock is \${selectedLocation ? calculateAvailableStock(item as any, selectedLocation.id, locationInventory) : 0}.\`,"
);

posContent = posContent.replace(
  "Stock: {product.stock}",
  "Stock: {selectedLocation ? calculateAvailableStock(product as any, selectedLocation.id, locationInventory) : 0}"
);

posContent = posContent.replace(
  "const productStock = Number(p.stock || 0);",
  "const productStock = selectedLocation ? calculateAvailableStock(p as any, selectedLocation.id, locationInventory) : 0;"
);

fs.writeFileSync(posPath, posContent);
console.log('Patched visual elements in POS.tsx');
