/**
 * Apply AddProduct icon-box header theme to all report pages.
 * Run: node scripts/theme-reports.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const componentsDir = new URL('../components/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

const reportConfigs = [
  {
    file: 'ReportExpense.tsx',
    icon: 'Receipt',
    title: 'Expense Report',
    subtitle: 'Analyse expenses by category and date range',
    oldHeader: '<h2 className="text-xl font-bold text-slate-900">Expense Report</h2>',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    file: 'ReportItems.tsx',
    icon: 'Package',
    title: 'Items Report',
    subtitle: 'Product sales and purchase summary',
    oldHeader: '<h2 className="text-xl font-bold text-slate-900">Items Report</h2>',
    gradient: 'from-blue-500 to-indigo-500',
  },
  {
    file: 'ReportProfitLoss.tsx',
    icon: 'TrendingUp',
    title: 'Profit / Loss Report',
    subtitle: 'Revenue, cost, and net profit overview',
    oldHeader: '<h2 className="text-xl font-bold text-slate-800 whitespace-nowrap">Profit / Loss Report</h2>',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    file: 'ReportTax.tsx',
    icon: 'Calculator',
    title: 'Tax Report',
    subtitle: 'VAT and tax collected by period',
    oldHeader: '<h2 className="text-xl font-bold text-slate-900">Tax Report</h2>',
    gradient: 'from-blue-500 to-indigo-500',
  },
  {
    file: 'ReportStock.tsx',
    icon: 'Warehouse',
    title: 'Stock Report',
    subtitle: 'Current stock levels across all locations',
    oldHeader: '<h2 className="text-xl font-bold text-slate-900">Stock Report</h2>',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    file: 'ReportStockExpiry.tsx',
    icon: 'AlertTriangle',
    title: 'Stock Expiry Report',
    subtitle: 'Products approaching or past expiry date',
    oldHeader: '<h2 className="text-xl font-bold text-slate-900">Stock Expiry Report</h2>',
    gradient: 'from-rose-500 to-red-500',
  },
  {
    file: 'ReportCustomerGroups.tsx',
    icon: 'UsersRound',
    title: 'Customer Groups Report',
    subtitle: 'Sales and balance by customer group',
    oldHeader: '<h2 className="text-xl font-bold text-slate-900">Customer Groups Report</h2>',
    gradient: 'from-blue-500 to-indigo-500',
  },
  {
    file: 'ReportLot.tsx',
    icon: 'Layers',
    title: 'Lot Report',
    subtitle: 'Inventory by lot number and batch',
    oldHeader: '<h2 className="text-xl font-bold text-slate-900">Lot Report</h2>',
    gradient: 'from-blue-500 to-indigo-500',
  },
  {
    file: 'ReportProductPurchase.tsx',
    icon: 'ShoppingCart',
    title: 'Product Purchase Report',
    subtitle: 'Purchase history per product',
    oldHeader: '<h2 className="text-xl font-bold text-slate-900">Product Purchase Report</h2>',
    gradient: 'from-blue-500 to-indigo-500',
  },
  {
    file: 'ReportProductSell.tsx',
    icon: 'BarChart2',
    title: 'Product Sell Report',
    subtitle: 'Sales history and quantity per product',
    oldHeader: '<h2 className="text-xl font-bold text-slate-900">Product Sell Report</h2>',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    file: 'ReportStockAdjustment.tsx',
    icon: 'SlidersHorizontal',
    title: 'Stock Adjustment Report',
    subtitle: 'Stock additions, deductions, and corrections',
    oldHeader: '<h2 className="text-xl font-bold text-slate-900">Stock Adjustment Report</h2>',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    file: 'ReportTrendingProducts.tsx',
    icon: 'TrendingUp',
    title: 'Trending Products',
    subtitle: 'Top selling products by quantity and revenue',
    oldHeader: '<h2 className="text-xl font-bold text-slate-900">Trending Products</h2>',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    file: 'ReportSalesRep.tsx',
    icon: 'UserCheck',
    title: 'Sales Representative Report',
    subtitle: 'Performance metrics per sales representative',
    oldHeader: '<h2 className="text-xl font-bold text-slate-900">Sales Representative Report</h2>',
    gradient: 'from-blue-500 to-indigo-500',
  },
  {
    file: 'ReportPurchasePayment.tsx',
    icon: 'CreditCard',
    title: 'Purchase Payment Report',
    subtitle: 'Payments made to suppliers',
    oldHeader: '<h2 className="text-xl font-bold text-slate-900">Purchase Payment Report</h2>',
    gradient: 'from-blue-500 to-indigo-500',
  },
  {
    file: 'ReportPurchaseSale.tsx',
    icon: 'FileText',
    title: 'Purchase & Sale Report',
    subtitle: 'Combined purchase and sale summary',
    oldHeader: null, // has a different header structure
    gradient: 'from-blue-500 to-indigo-500',
  },
  {
    file: 'ReportRegister.tsx',
    icon: 'Landmark',
    title: 'Register Report',
    subtitle: 'Cash register sessions and transactions',
    oldHeader: '<h2 className="text-xl font-bold text-slate-900">Register Report</h2>',
    gradient: 'from-blue-500 to-indigo-500',
  },
  {
    file: 'ReportSellPayment.tsx',
    icon: 'CreditCard',
    title: 'Sell Payment Report',
    subtitle: 'Payments received from customers',
    oldHeader: '<h2 className="text-xl font-bold text-slate-900">Sell Payment Report</h2>',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    file: 'ReportSupplierCustomer.tsx',
    icon: 'Users',
    title: 'Customers & Suppliers Report',
    subtitle: 'Comparative supplier and customer balances',
    oldHeader: '<h2 className="text-xl font-bold text-slate-900">Customers & Suppliers Reports</h2>',
    gradient: 'from-blue-500 to-indigo-500',
  },
];

// Build new icon-box header JSX
function buildHeader(icon, title, subtitle) {
  return `<div className="flex items-center gap-4 mb-6">
        <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
          <${icon} size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">${title}</h1>
          <p className="text-slate-500 text-sm mt-0.5">${subtitle}</p>
        </div>
      </div>`;
}

// For each icon used, ensure it's imported
function ensureIconImport(content, icon) {
  const importLineMatch = content.match(/^import \{([^}]+)\} from 'lucide-react';/m);
  if (!importLineMatch) return content;
  const currentIcons = importLineMatch[1];
  if (currentIcons.includes(icon)) return content;
  // Add icon to imports
  const newImports = currentIcons.trimEnd() + `, ${icon}`;
  return content.replace(importLineMatch[0], `import {${newImports}} from 'lucide-react';`);
}

let successCount = 0;
let skipCount = 0;

for (const config of reportConfigs) {
  const filePath = join(componentsDir, config.file);
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    console.warn(`⚠ Could not read ${config.file}`);
    skipCount++;
    continue;
  }

  let changed = false;

  // 1. Replace header
  if (config.oldHeader && content.includes(config.oldHeader)) {
    const newHeader = buildHeader(config.icon, config.title, config.subtitle);
    content = content.replace(config.oldHeader, newHeader);
    changed = true;
  } else if (config.oldHeader) {
    console.warn(`⚠ Could not find header in ${config.file} — skipping header replacement`);
  }

  // 2. Ensure icon is imported
  const contentBefore = content;
  content = ensureIconImport(content, config.icon);
  if (content !== contentBefore) changed = true;

  // 3. Add gradient accent bars to rounded-[2rem] cards that don't have them
  // Pattern: <div className="...rounded-[2rem]..."> without a gradient bar inside
  // We'll add gradient bars after each opening div that has rounded-[2rem] and relative
  // but doesn't already have the gradient div
  const gradientBar = `<div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${config.gradient}"></div>`;

  // Add gradient bar to filter cards (after first child of relative overflow-hidden rounded cards)
  // Use a regex to find divs with rounded-[2rem] ... relative overflow-hidden that don't have gradient bar
  const filterCardRegex = /(className="[^"]*rounded-\[2rem\][^"]*relative[^"]*overflow-hidden[^"]*">)\s*(?!<div className="absolute)/g;
  const newContent = content.replace(filterCardRegex, (match, group1) => {
    return `${group1}\n        ${gradientBar}\n`;
  });
  if (newContent !== content) {
    content = newContent;
    changed = true;
  }

  if (changed) {
    writeFileSync(filePath, content, 'utf8');
    console.log(`✓ ${config.file}`);
    successCount++;
  } else {
    console.log(`- ${config.file} (no changes needed)`);
    skipCount++;
  }
}

console.log(`\nDone: ${successCount} updated, ${skipCount} skipped`);
