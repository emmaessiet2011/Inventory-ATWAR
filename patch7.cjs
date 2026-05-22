const fs = require('fs');
const path = require('path');

const importPath = path.join('src', 'components', 'products', 'ImportProducts.tsx');
let importContent = fs.readFileSync(importPath, 'utf8');

if (!importContent.includes('Variable and Combo are deprecated')) {
  importContent = importContent.replace(
    `else if (productTypeRaw === 'variable') type = 'Variable';\n        else if (productTypeRaw === 'combo') type = 'Combo';`,
    `// Variable/Combo completely blocked from import\n        else if (productTypeRaw === 'variable' || productTypeRaw === 'combo') type = '';`
  );

  importContent = importContent.replace(
    `if (!type) error = 'Invalid Product Type (must be single, variable, combo)';`,
    `if (!type) error = 'Invalid Product Type. Variable and Combo are deprecated/blocked. Must be Single.';`
  );

  importContent = importContent.replace(
    `instruction: 'single or variable'`,
    `instruction: 'single'`
  );

  fs.writeFileSync(importPath, importContent);
  console.log('Patched ImportProducts.tsx for Variable block');
} else {
  console.log('ImportProducts.tsx already contains the patch.');
}
