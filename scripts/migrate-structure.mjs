/**
 * migrate-structure.mjs
 * Reorganises the project into a standard full-stack layout:
 *
 *   src/
 *     main.tsx          (was index.tsx at root)
 *     App.tsx           (was App.tsx at root)
 *     index.css         (was index.css at root)
 *     types.ts          (was types.ts at root)
 *     context/          (already here)
 *     utils/            (already here)
 *     components/
 *       layout/         Sidebar, Login
 *       dashboard/      Dashboard
 *       sales/          AddSale, Sales, Quotations, Returns ...
 *       purchases/      AddPurchase, Purchases, PO ...
 *       products/       Products, Inventory, Labels ...
 *       contacts/       Customers, Suppliers, Groups ...
 *       payments/       Payments, Modals ...
 *       stock/          Transfers, Adjustments ...
 *       expenses/       Expenses, Categories ...
 *       orders/         Orders ...
 *       users/          Users, Roles, Agents ...
 *       reports/        19 report files ...
 *       settings/       Settings, Locations, Tax ...
 *       pos/            POS, Register ...
 *       pricing/        Discounts, Price Groups ...
 *       shipping/       DeliveryNote, PackingSlip ...
 *       accounts/       ListAccounts ...
 *       shared/         MultiSelect, DateRangeFilter ...
 *   server/             (unchanged)
 *   prisma/             (unchanged)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── Component → module map ───────────────────────────────────────────────────
const MODULE_MAP = {
  Sidebar:                    'layout',
  Login:                      'layout',

  Dashboard:                  'dashboard',

  AddSale:                    'sales',
  Sales:                      'sales',
  AddQuotation:               'sales',
  ListQuotations:             'sales',
  AddSellReturn:              'sales',
  ListReturns:                'sales',
  ViewSaleDetails:            'sales',
  ViewSellReturnDetails:      'sales',
  ViewSellReturnPaymentsModal:'sales',
  Sell:                       'sales',
  ImportSales:                'sales',
  Shipments:                  'sales',

  AddPurchase:                'purchases',
  Purchases:                  'purchases',
  PurchaseOrder:              'purchases',
  PurchaseRequisition:        'purchases',
  PurchaseReturn:             'purchases',

  AddProduct:                 'products',
  Products:                   'products',
  Inventory:                  'products',
  ViewProduct:                'products',
  ProductViewCatalog:         'products',
  ProductStockHistory:        'products',
  PrintLabels:                'products',
  ImportProducts:             'products',
  ImportOpeningStock:         'products',
  AddOpeningStock:            'products',
  UpdatePrice:                'products',
  Variations:                 'products',
  Categories:                 'products',
  Brands:                     'products',
  Units:                      'products',
  Warranties:                 'products',

  Contacts:                   'contacts',
  Customers:                  'contacts',
  ViewCustomer:               'contacts',
  Suppliers:                  'contacts',
  ViewSupplier:               'contacts',
  CustomerGroups:             'contacts',
  ImportContacts:             'contacts',

  NewPayment:                 'payments',
  ListPayments:               'payments',
  AddPaymentModal:            'payments',
  EditPaymentModal:           'payments',
  ViewPaymentModal:           'payments',
  ViewPaymentsModal:          'payments',
  FieldPayments:              'payments',

  AddStockTransfer:           'stock',
  ListStockTransfers:         'stock',
  StockTransfer:              'stock',
  AddStockAdjustment:         'stock',
  ListStockAdjustments:       'stock',
  StockAdjustment:            'stock',

  AddExpense:                 'expenses',
  Expenses:                   'expenses',
  ListExpenses:               'expenses',
  ExpenseCategories:          'expenses',

  AddOrder:                   'orders',
  ListOrders:                 'orders',
  Orders:                     'orders',
  ViewOrder:                  'orders',

  AddUser:                    'users',
  AddUserModal:               'users',
  Users:                      'users',
  UserManagement:             'users',
  UserModals:                 'users',
  ViewUser:                   'users',
  Roles:                      'users',
  SalesCommissionAgents:      'users',

  ReportCustomerGroups:       'reports',
  ReportExpense:              'reports',
  ReportItems:                'reports',
  ReportLot:                  'reports',
  ReportProductPurchase:      'reports',
  ReportProductSell:          'reports',
  ReportProfitLoss:           'reports',
  ReportPurchasePayment:      'reports',
  ReportPurchaseSale:         'reports',
  ReportRegister:             'reports',
  ReportSalesRep:             'reports',
  ReportSellPayment:          'reports',
  ReportStock:                'reports',
  ReportStockAdjustment:      'reports',
  ReportStockExpiry:          'reports',
  ReportSupplierCustomer:     'reports',
  ReportTax:                  'reports',
  ReportTrendingProducts:     'reports',
  VatBills:                   'reports',
  BalanceSheet:               'reports',
  TrialBalance:               'reports',
  CashFlow:                   'reports',
  PaymentAccountReport:       'reports',

  Settings:                   'settings',
  Locations:                  'settings',
  TaxRates:                   'settings',
  InvoiceSettings:            'settings',
  BarcodeSettings:            'settings',
  Printers:                   'settings',
  BackupRestore:              'settings',
  HelpCenter:                 'settings',

  POS:                        'pos',
  ListPOS:                    'pos',
  OpenRegister:               'pos',

  Discounts:                  'pricing',
  AddDiscountModal:           'pricing',
  SellingPriceGroups:         'pricing',

  DeliveryNote:               'shipping',
  PackingSlip:                'shipping',
  EditShippingModal:          'shipping',

  ListAccounts:               'accounts',

  MultiSelect:                'shared',
  DateRangeFilter:            'shared',
  InvoiceURLModal:            'shared',
  ActivityLog:                'shared',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

function writeFile(p, content) {
  fs.writeFileSync(p, content, 'utf8');
}

// Update import paths inside a file's content.
// fromModule = the module folder this file lives in (e.g. 'sales'), or null for src root files
function updateImports(content, fromModule) {
  // 1. ../src/context/X  →  @/context/X
  content = content.replace(/from '\.\.\/src\/context\//g, "from '@/context/");
  content = content.replace(/from "\.\.\/src\/context\//g, 'from "@/context/');

  // 2. ../src/utils/X  →  @/utils/X
  content = content.replace(/from '\.\.\/src\/utils\//g, "from '@/utils/");
  content = content.replace(/from "\.\.\/src\/utils\//g, 'from "@/utils/');

  // 3. ../types  →  @/types
  content = content.replace(/from '\.\.\/types'/g, "from '@/types'");
  content = content.replace(/from "\.\.\/types"/g, 'from "@/types"');

  // 4. App.tsx specific: ./src/context/X  →  @/context/X
  content = content.replace(/from '\.\/src\/context\//g, "from '@/context/");
  content = content.replace(/from "\.\/src\/context\//g, 'from "@/context/');

  // 5. App.tsx specific: ./src/utils/X  →  @/utils/X
  content = content.replace(/from '\.\/src\/utils\//g, "from '@/utils/");
  content = content.replace(/from "\.\/src\/utils\//g, 'from "@/utils/');

  // 6. App.tsx specific: ./types  →  @/types
  content = content.replace(/from '\.\/types'/g, "from '@/types'");
  content = content.replace(/from "\.\/types"/g, 'from "@/types"');

  // 7. Cross-component ./ComponentName  →  @/components/MODULE/ComponentName
  //    Only applies when importing a known component from a different module
  content = content.replace(/from '\.\/([A-Z][A-Za-z0-9]+)'/g, (match, name) => {
    const targetModule = MODULE_MAP[name];
    if (!targetModule) return match; // unknown — leave alone
    if (targetModule === fromModule) return match; // same module — leave as ./X
    return `from '@/components/${targetModule}/${name}'`;
  });
  content = content.replace(/from "\.\/([A-Z][A-Za-z0-9]+)"/g, (match, name) => {
    const targetModule = MODULE_MAP[name];
    if (!targetModule) return match;
    if (targetModule === fromModule) return match;
    return `from "@/components/${targetModule}/${name}"`;
  });

  // 8. App.tsx: ./components/X  →  @/components/MODULE/X
  content = content.replace(/from '\.\/components\/([A-Z][A-Za-z0-9]+)'/g, (match, name) => {
    const mod = MODULE_MAP[name];
    if (!mod) return match;
    return `from '@/components/${mod}/${name}'`;
  });
  content = content.replace(/from "\.\/components\/([A-Z][A-Za-z0-9]+)"/g, (match, name) => {
    const mod = MODULE_MAP[name];
    if (!mod) return match;
    return `from "@/components/${mod}/${name}"`;
  });

  return content;
}

// ─── Step 1: Create target directories ───────────────────────────────────────
console.log('\n📁 Creating directory structure...');
const modules = [...new Set(Object.values(MODULE_MAP))];
for (const mod of modules) {
  ensureDir(path.join(ROOT, 'src', 'components', mod));
}
console.log('   Created src/components/{' + modules.join(', ') + '}');

// ─── Step 2: Move root frontend files into src/ ───────────────────────────────
console.log('\n📦 Moving root frontend files → src/');

const rootMoves = [
  { from: 'App.tsx',    to: 'src/App.tsx' },
  { from: 'index.tsx',  to: 'src/main.tsx' },   // rename to Vite standard
  { from: 'index.css',  to: 'src/index.css' },
  { from: 'types.ts',   to: 'src/types.ts' },
];

for (const { from, to } of rootMoves) {
  const src  = path.join(ROOT, from);
  const dest = path.join(ROOT, to);
  if (!fs.existsSync(src)) { console.log(`   SKIP (not found): ${from}`); continue; }
  let content = readFile(src);
  // For main.tsx, add css import and fix App path
  if (from === 'index.tsx') {
    content = `import './index.css';\n` + content;
    content = content.replace(/from '\.\/App'/g, "from './App'");
  }
  // For App.tsx, update imports
  if (from === 'App.tsx') {
    content = updateImports(content, null);
  }
  writeFile(dest, content);
  fs.unlinkSync(src);
  console.log(`   ${from} → ${to}`);
}

// ─── Step 3: Move components into src/components/{module}/ ───────────────────
console.log('\n📦 Moving components → src/components/{module}/');

const componentsDir = path.join(ROOT, 'components');
const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const name = file.replace('.tsx', '');
  const mod  = MODULE_MAP[name];
  if (!mod) {
    console.log(`   WARNING — no module mapping for: ${file}`);
    continue;
  }
  const srcPath  = path.join(componentsDir, file);
  const destPath = path.join(ROOT, 'src', 'components', mod, file);
  let content = readFile(srcPath);
  content = updateImports(content, mod);
  writeFile(destPath, content);
  fs.unlinkSync(srcPath);
  console.log(`   components/${file} → src/components/${mod}/${file}`);
}

// Remove empty components dir
try { fs.rmdirSync(componentsDir); console.log('\n   Removed empty components/ folder'); }
catch { console.log('\n   components/ folder not empty (check for leftover files)'); }

// ─── Step 4: Update src/context and src/utils files ──────────────────────────
// These files may import from root types.ts
console.log('\n🔧 Updating src/context/ and src/utils/ imports...');
const srcDirs = [
  path.join(ROOT, 'src', 'context'),
  path.join(ROOT, 'src', 'utils'),
];
for (const dir of srcDirs) {
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
    const p = path.join(dir, file);
    let content = readFile(p);
    // context/utils are one level inside src, so ../types → ./types (both in src)
    // But with @/ alias pointing to src, we can use @/types
    content = content.replace(/from '\.\.\/types'/g, "from '@/types'");
    content = content.replace(/from "\.\.\/types"/g, 'from "@/types"');
    writeFile(p, content);
  }
}

// ─── Step 5: Report ──────────────────────────────────────────────────────────
console.log('\n✅ File moves complete.');
console.log('\n⚠️  Now update these config files manually (see instructions below):');
console.log('   1. index.html  — change entry from /index.tsx to /src/main.tsx');
console.log('                  — remove <link rel="stylesheet" href="/index.css">');
console.log('   2. vite.config.ts — change alias @ from . to ./src');
console.log('   3. tsconfig.json  — change paths @/* from ./* to ./src/*');
console.log('\nThen run: npm run build');
