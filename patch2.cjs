const fs = require('fs');
const path = require('path');

const applyFilterPatch = (filePath, oldPattern, newPattern) => {
  const fullPath = path.join('src', 'components', filePath);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes(oldPattern)) {
      content = content.replace(oldPattern, newPattern);
      fs.writeFileSync(fullPath, content);
      console.log(`Patched: ${filePath}`);
    } else {
      console.log(`Pattern not found in: ${filePath}`);
    }
  } else {
    console.log(`File not found: ${filePath}`);
  }
};

const comboCheck = "String(product.type || '').trim().toLowerCase() !== 'combo' && ";
const comboCheckItem = "String(item.type || '').trim().toLowerCase() !== 'combo' && ";
const comboCheckP = "String(p.type || '').trim().toLowerCase() !== 'combo' && ";

// 1. AddStockAdjustment.tsx
applyFilterPatch(
  'stock/AddStockAdjustment.tsx',
  "      .filter((product) => normalize(product.name).includes(q) || normalize(product.sku).includes(q))",
  "      .filter((product) => " + comboCheck + "(normalize(product.name).includes(q) || normalize(product.sku).includes(q)))"
);

// 2. AddStockTransfer.tsx
applyFilterPatch(
  'stock/AddStockTransfer.tsx',
  "      .filter((product) =>\n        normalize(product.name).includes(query) ||\n        normalize(product.sku).includes(query)",
  "      .filter((product) =>\n        " + comboCheck + "(\n        normalize(product.name).includes(query) ||\n        normalize(product.sku).includes(query))"
);

// 3. SeedLocationStock.tsx
applyFilterPatch(
  'stock/SeedLocationStock.tsx',
  "      .filter((product) => {\n        const matchSearch = !query ||\n          normalize(product.name).includes(query) ||",
  "      .filter((product) => {\n        if (String(product.type || '').trim().toLowerCase() === 'combo') return false;\n        const matchSearch = !query ||\n          normalize(product.name).includes(query) ||"
);

// 4. AddPurchase.tsx
applyFilterPatch(
  'purchases/AddPurchase.tsx',
  "    return products.filter(item => item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q)).slice(0, 8);",
  "    return products.filter(item => " + comboCheckItem + "(item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q))).slice(0, 8);"
);

// 5. PurchaseReturn.tsx
applyFilterPatch(
  'purchases/PurchaseReturn.tsx',
  "    return products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)).slice(0, 8);",
  "    return products.filter(p => " + comboCheckP + "(p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))).slice(0, 8);"
);

// 6. PurchaseOrder.tsx
applyFilterPatch(
  'purchases/PurchaseOrder.tsx',
  "      .filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))",
  "      .filter(p => " + comboCheckP + "(p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)))"
);

// 7. PurchaseRequisition.tsx
applyFilterPatch(
  'purchases/PurchaseRequisition.tsx',
  "      .filter(p =>\n        normalizeText(p.businessLocation || '') === normalizeText(form.location || '') &&\n        (!form.brand || p.brand === form.brand) &&\n        (!form.category || p.category === form.category)",
  "      .filter(p =>\n        " + comboCheckP + "\n        normalizeText(p.businessLocation || '') === normalizeText(form.location || '') &&\n        (!form.brand || p.brand === form.brand) &&\n        (!form.category || p.category === form.category)"
);

console.log('Done.');
