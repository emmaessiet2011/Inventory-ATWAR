const fs = require('fs');
const path = require('path');

// 1. productVisibility.ts
const pvPath = path.join('src', 'utils', 'productVisibility.ts');
let pvContent = fs.readFileSync(pvPath, 'utf8');

const isLocAccessibleStr = `
export const isLocationAccessible = (
  recordLocationName: string,
  user: AppUser | null,
  locations: Location[]
): boolean => {
  if (!user) return true;
  if (normalize(user.role) === 'admin') return true;

  const accessLocationIds = Array.isArray(user.accessLocations)
    ? user.accessLocations.map(normalize).filter(Boolean)
    : [];

  if (accessLocationIds.some(value => value === 'all locations' || value === 'all')) {
    return true;
  }

  const normalizedRecordLoc = normalize(recordLocationName);
  if (!normalizedRecordLoc) return true; // Global or unassigned

  if (normalize(user.businessLocation) === normalizedRecordLoc) {
    return true;
  }

  const matchingLoc = locations.find(loc => normalize(loc.name) === normalizedRecordLoc);
  
  if (matchingLoc) {
    if (accessLocationIds.includes(normalize(matchingLoc.id))) return true;
    if (accessLocationIds.includes(normalize(matchingLoc.name))) return true;
  } else {
    if (accessLocationIds.includes(normalizedRecordLoc)) return true;
  }

  return false;
};
`;

if (!pvContent.includes('isLocationAccessible')) {
  pvContent += isLocAccessibleStr;
  fs.writeFileSync(pvPath, pvContent);
  console.log('Patched productVisibility.ts');
}

// 2. Sales.tsx
const salesPath = path.join('src', 'components', 'sales', 'Sales.tsx');
let salesContent = fs.readFileSync(salesPath, 'utf8');

if (!salesContent.includes('isLocationAccessible')) {
  salesContent = salesContent.replace(
    `import { exportToCSV, formatSaleDateTime } from '@/utils/exportUtils';`,
    `import { exportToCSV, formatSaleDateTime } from '@/utils/exportUtils';\nimport { isLocationAccessible } from '@/utils/productVisibility';`
  );

  salesContent = salesContent.replace(
    `return owner.length > 0 && String(sale.addedBy || '').trim().toLowerCase() === owner;\n  };`,
    `return owner.length > 0 && String(sale.addedBy || '').trim().toLowerCase() === owner;\n  };\n\n  const canViewLocation = (sale: any) => isLocationAccessible(sale.location || '', currentUser, locations);`
  );

  salesContent = salesContent.replace(
    `if (!canViewAllQuotations && !canViewOwnQuotations) return false;`,
    `if (!canViewAllQuotations && !canViewOwnQuotations) return false;\n        if (!canViewLocation(s)) return false;`
  );

  fs.writeFileSync(salesPath, salesContent);
  console.log('Patched Sales.tsx');
}

// 3. Purchases.tsx
const purchPath = path.join('src', 'components', 'purchases', 'Purchases.tsx');
let purchContent = fs.readFileSync(purchPath, 'utf8');

if (!purchContent.includes('isLocationAccessible')) {
  purchContent = purchContent.replace(
    `import { exportToCSV, formatSaleDateTime } from '@/utils/exportUtils';`,
    `import { exportToCSV, formatSaleDateTime } from '@/utils/exportUtils';\nimport { isLocationAccessible } from '@/utils/productVisibility';`
  );

  purchContent = purchContent.replace(
    `const normalize = (v: any) => String(v || '').trim().toLowerCase();`,
    `const normalize = (v: any) => String(v || '').trim().toLowerCase();\n  const canViewLocation = (purchase: any) => isLocationAccessible(purchase.location || '', currentUser, locations);`
  );

  purchContent = purchContent.replace(
    `return purchases.filter((p) => {`,
    `return purchases.filter((p) => {\n      if (!canViewLocation(p)) return false;`
  );

  fs.writeFileSync(purchPath, purchContent);
  console.log('Patched Purchases.tsx');
}

// 4. ListExpenses.tsx
const expPath = path.join('src', 'components', 'expenses', 'ListExpenses.tsx');
let expContent = fs.readFileSync(expPath, 'utf8');

if (!expContent.includes('isLocationAccessible')) {
  expContent = expContent.replace(
    `import { exportToCSV, formatExpenseDateTime } from '@/utils/exportUtils';`,
    `import { exportToCSV, formatExpenseDateTime } from '@/utils/exportUtils';\nimport { isLocationAccessible } from '@/utils/productVisibility';`
  );

  expContent = expContent.replace(
    `const { expenses, expenseCategories, deleteExpense, formatCurrency, settings, currentUser, payments, deletePayment } = useGlobalContext();`,
    `const { expenses, expenseCategories, deleteExpense, formatCurrency, settings, currentUser, payments, deletePayment, locations } = useGlobalContext();`
  );

  expContent = expContent.replace(
    `const query = normalize(searchTerm);`,
    `const query = normalize(searchTerm);\n    const canViewLocation = (expense: any) => isLocationAccessible(expense.location || '', currentUser, locations);`
  );

  expContent = expContent.replace(
    `if (!isOwnerMatch(expense, ownerIdFilter, ownerNameFilter)) return false;`,
    `if (!isOwnerMatch(expense, ownerIdFilter, ownerNameFilter)) return false;\n        if (!canViewLocation(expense)) return false;`
  );

  fs.writeFileSync(expPath, expContent);
  console.log('Patched ListExpenses.tsx');
}
