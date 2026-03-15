import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  LifeBuoy,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useGlobalContext } from '../src/context/GlobalContext';

type CategoryId =
  | 'onboarding'
  | 'products'
  | 'sales'
  | 'stock'
  | 'finance'
  | 'reports'
  | 'admin'
  | 'troubleshooting';

type PermissionCheck = { module: string; permission: string };
type GuideRoute = { label: string; path: string };
type Guide = {
  id: string;
  title: string;
  module: string;
  category: CategoryId;
  summary: string;
  tags: string[];
  routes: GuideRoute[];
  permissions?: PermissionCheck[];
  steps: string[];
  checks: string[];
  fixes: string[];
};
type Faq = { id: string; question: string; answer: string; tags: string[] };

interface HelpCenterProps {
  onNavigate?: (page: string) => void;
}

const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase();

const CATEGORIES: Array<{ id: CategoryId | 'all'; label: string }> = [
  { id: 'all', label: 'All Guides' },
  { id: 'onboarding', label: 'Getting Started' },
  { id: 'products', label: 'Products' },
  { id: 'sales', label: 'Sales and Orders' },
  { id: 'stock', label: 'Stock' },
  { id: 'finance', label: 'Payments and Expense' },
  { id: 'reports', label: 'Reports' },
  { id: 'admin', label: 'Settings and Users' },
  { id: 'troubleshooting', label: 'Troubleshooting' },
];

// Keep this aligned with App.tsx route switch.
const APP_STATIC_ROUTE_PATHS = new Set<string>([
  'dashboard',
  'users',
  'add-user',
  'roles',
  'sales-commission-agents',
  'products',
  'add-product',
  'product-view',
  'update-price',
  'print-labels',
  'variations',
  'import-products',
  'import-opening-stock',
  'units',
  'categories',
  'brands',
  'warranties',
  'purchases',
  'add-purchase',
  'purchase-requisition',
  'purchase-order',
  'purchase-return',
  'sales',
  'add-sale',
  'edit-sale',
  'list-pos',
  'open-register',
  'pos',
  'drafts',
  'add-draft',
  'quotations',
  'add-quotation',
  'returns',
  'add-sell-return',
  'shipments',
  'discounts',
  'import-sales',
  'list-stock-transfers',
  'add-stock-transfer',
  'list-stock-adjustments',
  'add-stock-adjustment',
  'list-orders',
  'orders',
  'add-order',
  'edit-order',
  'view-order',
  'convert-order-to-invoice',
  'new-payment',
  'list-payments',
  'field-payments',
  'list-accounts',
  'balance-sheet',
  'trial-balance',
  'cash-flow',
  'payment-account-report',
  'vat-bills',
  'tax-rates',
  'suppliers',
  'customers',
  'customer-groups',
  'selling-price-groups',
  'import-contacts',
  'expenses',
  'add-expense',
  'edit-expense',
  'expense-categories',
  'report-profit-loss',
  'report-purchase-sale',
  'report-tax',
  'report-supplier-customer',
  'report-customer-groups',
  'report-stock',
  'report-stock-expiry',
  'report-lot',
  'report-stock-adjustment',
  'report-trending-products',
  'report-items',
  'report-product-purchase',
  'report-product-sell',
  'report-purchase-payment',
  'report-sell-payment',
  'report-expense',
  'report-register',
  'report-sales-rep',
  'activity-log',
  'settings',
  'backup-restore',
  'locations',
  'invoice-settings',
  'barcode-settings',
  'printers',
  'help-center',
  'public-view-invoice',
]);

const APP_DYNAMIC_ROUTE_PREFIXES = [
  'edit-sale/',
  'view-user/',
  'view-customer/',
  'view-supplier/',
  'view-sale/',
  'print-sale/',
  'edit-product/',
  'print-labels/',
  'product-stock-history/',
  'add-opening-stock/',
  'edit-user/',
];

const isRegisteredAppRoute = (path: string): boolean => {
  const normalizedPath = String(path || '').trim();
  if (!normalizedPath) return false;
  if (APP_STATIC_ROUTE_PATHS.has(normalizedPath)) return true;
  return APP_DYNAMIC_ROUTE_PREFIXES.some(prefix => normalizedPath.startsWith(prefix));
};

const GUIDES: Guide[] = [
  {
    id: 'setup',
    title: 'Business Setup First',
    module: 'Settings',
    category: 'onboarding',
    summary: 'Configure company details, locations, invoice, taxes, and printers before transactions.',
    tags: ['settings', 'invoice', 'tax', 'location', 'printer'],
    routes: [
      { label: 'Business Settings', path: 'settings' },
      { label: 'Business Locations', path: 'locations' },
      { label: 'Invoice Settings', path: 'invoice-settings' },
      { label: 'Tax Rates', path: 'tax-rates' },
      { label: 'Receipt Printers', path: 'printers' },
    ],
    permissions: [{ module: 'Settings', permission: 'Access business settings' }],
    steps: [
      'Set business profile, currency, date/time format, and invoice prefixes.',
      'Create all active branches in Business Locations.',
      'Configure invoice templates and printer settings.',
      'Create tax rates and set the default sale tax behavior.',
    ],
    checks: [
      'At least one active location must exist.',
      'Invoice prefixes must be unique across transaction types.',
      'Default tax rate should match your sale tax policy.',
    ],
    fixes: [
      'Missing tax dropdown in sale screens usually means tax rates were not configured.',
      'Print output issues usually come from wrong printer profile or page size settings.',
    ],
  },
  {
    id: 'users-roles',
    title: 'Users and Roles',
    module: 'User Management',
    category: 'admin',
    summary: 'Create least-privilege roles and test non-admin access before rollout.',
    tags: ['users', 'roles', 'permissions'],
    routes: [
      { label: 'Users', path: 'users' },
      { label: 'Add User', path: 'add-user' },
      { label: 'Roles', path: 'roles' },
    ],
    permissions: [{ module: 'Roles', permission: 'View role' }],
    steps: [
      'Create roles first, then assign users.',
      'Grant only required permissions per team.',
      'Test critical flows with each role after saving changes.',
    ],
    checks: [
      'Do not run daily operations with admin account.',
      'Ensure inactive users cannot log in.',
      'Ensure own-vs-all permissions reflect your policy.',
    ],
    fixes: [
      'If a menu disappears, verify module and action permission on the role.',
      'After role changes, re-login to refresh effective access.',
    ],
  },
  {
    id: 'products-packaging',
    title: 'Products and Packaging',
    module: 'Products',
    category: 'products',
    summary: 'Maintain SKU, unit, tax, category, brand, and carton/pack conversion data.',
    tags: ['products', 'pack', 'carton', 'units', 'price', 'sku'],
    routes: [
      { label: 'List Products', path: 'products' },
      { label: 'Add New Product', path: 'add-product' },
      { label: 'Units', path: 'units' },
      { label: 'Categories', path: 'categories' },
      { label: 'Brands', path: 'brands' },
    ],
    permissions: [{ module: 'Product', permission: 'View product' }],
    steps: [
      'Create Units, Categories, and Brands before mass product entry.',
      'Set product packaging (piece, pack, carton) and units-per-package accurately.',
      'Set purchase/sell price and tax type correctly.',
      'Verify product is active and sellable in needed locations.',
    ],
    checks: [
      'SKU must be unique.',
      'Do not leave unit or category empty for stock products.',
      'Packaging factor should map cleanly to piece quantity.',
    ],
    fixes: [
      'If quantity conversion is wrong in Add Sale/Add Order, check units-per-package on product.',
      'If product does not appear in search, check active status and location availability.',
    ],
  },
  {
    id: 'imports',
    title: 'Bulk Imports and Price Updates',
    module: 'Products',
    category: 'products',
    summary: 'Use import tools to load products, opening stock, and bulk price updates safely.',
    tags: ['import products', 'opening stock', 'update price'],
    routes: [
      { label: 'Import Products', path: 'import-products' },
      { label: 'Import Opening Stock', path: 'import-opening-stock' },
      { label: 'Update Price', path: 'update-price' },
    ],
    steps: [
      'Prepare a clean import file with mandatory fields and unique SKUs.',
      'Import products first, then opening stock by location.',
      'Use Update Price for controlled price corrections.',
    ],
    checks: [
      'Validate sample rows before full import.',
      'Keep backup CSV before mass update.',
      'Reconcile stock and price reports after import.',
    ],
    fixes: [
      'Import errors usually come from duplicates, blank required columns, or invalid numeric values.',
    ],
  },
  {
    id: 'contacts',
    title: 'Suppliers, Customers, and Groups',
    module: 'Contacts',
    category: 'onboarding',
    summary: 'Create clean supplier/customer masters and map customer groups to pricing strategy.',
    tags: ['suppliers', 'customers', 'groups', 'selling price group'],
    routes: [
      { label: 'Suppliers', path: 'suppliers' },
      { label: 'Customers', path: 'customers' },
      { label: 'Customer Groups', path: 'customer-groups' },
      { label: 'Import Contacts', path: 'import-contacts' },
      { label: 'Selling Price Groups', path: 'selling-price-groups' },
    ],
    steps: [
      'Create supplier and customer records with consistent naming.',
      'Set customer groups and link selling price groups where needed.',
      'Maintain credit limits and payment terms for controlled risk.',
    ],
    checks: [
      'Avoid duplicate customer names with different spellings.',
      'Keep one clear walk-in customer record only.',
    ],
    fixes: [
      'If customer pricing is wrong, verify customer group and linked selling price group mapping.',
    ],
  },
  {
    id: 'purchase-flow',
    title: 'Purchases End-to-End',
    module: 'Purchases',
    category: 'products',
    summary: 'Process requisition, order, receive purchase, and return with stock and payment sync.',
    tags: ['purchase requisition', 'purchase order', 'purchase', 'return'],
    routes: [
      { label: 'Purchase Requisition', path: 'purchase-requisition' },
      { label: 'Purchase Order', path: 'purchase-order' },
      { label: 'List Purchases', path: 'purchases' },
      { label: 'Add Purchase', path: 'add-purchase' },
      { label: 'Purchase Return', path: 'purchase-return' },
    ],
    permissions: [{ module: 'Purchase & Stock Adjustment', permission: 'View all Purchase & Stock Adjustment' }],
    steps: [
      'Raise requisition for internal demand.',
      'Create purchase order and send to supplier.',
      'Receive purchase with exact quantity and cost.',
      'Record payment and handle returns where required.',
    ],
    checks: [
      'Verify received quantity and line cost before finalizing.',
      'Ensure purchase status and payment status are consistent.',
    ],
    fixes: [
      'If stock does not increase, check purchase finalization status and selected location.',
      'If payment due is wrong, verify discount/tax/shipping values.',
    ],
  },
  {
    id: 'sales-pos',
    title: 'Sales, POS, Draft, Quotation, Returns',
    module: 'Sell',
    category: 'sales',
    summary: 'Run all sales channels and ensure price, tax, payment, and return integrity.',
    tags: ['sales', 'pos', 'draft', 'quotation', 'returns'],
    routes: [
      { label: 'All Sales', path: 'sales' },
      { label: 'Add Sale', path: 'add-sale' },
      { label: 'List POS', path: 'list-pos' },
      { label: 'POS', path: 'open-register' },
      { label: 'List Returns', path: 'returns' },
      { label: 'Discounts', path: 'discounts' },
      { label: 'Import Sales', path: 'import-sales' },
    ],
    permissions: [{ module: 'Sell', permission: 'View all sell' }],
    steps: [
      'Use Add Sale for standard invoices and POS for fast checkout.',
      'Use draft/quotation flows before final conversion.',
      'Capture payments with correct method and account.',
      'Process sell returns from original sale for clean reversal.',
    ],
    checks: [
      'Tax and discount should match invoice policy.',
      'Payment status must match paid amount.',
      'Returned quantity must not exceed sold quantity.',
    ],
    fixes: [
      'If totals mismatch, validate line discount vs invoice discount behavior.',
      'If return fails, check sale link and available returnable quantity.',
    ],
  },
  {
    id: 'orders-shipments',
    title: 'Orders and Shipments',
    module: 'Orders',
    category: 'sales',
    summary: 'Capture customer orders, convert to invoice, and manage shipment lifecycle.',
    tags: ['orders', 'shipments', 'delivery', 'invoice'],
    routes: [
      { label: 'List Orders', path: 'list-orders' },
      { label: 'Add Order', path: 'add-order' },
      { label: 'Shipments', path: 'shipments' },
      { label: 'Add Sale', path: 'add-sale' },
    ],
    permissions: [{ module: 'Order', permission: 'View order' }],
    steps: [
      'Create order with searchable products and clear quantities.',
      'Edit or review order before conversion to invoice.',
      'Track shipping status, delivery person, and documents in Shipments.',
      'Generate final invoice only after order confirmation.',
    ],
    checks: [
      'Order should not be saved empty.',
      'Shipping status and payment status should not conflict.',
    ],
    fixes: [
      'If order item search dropdown is hidden, review container overflow and z-index behavior.',
      'If carton/pack quantity does not convert, verify product packaging factor.',
    ],
  },
  {
    id: 'stock-transfer',
    title: 'Stock Transfer',
    module: 'Stock Transfer',
    category: 'stock',
    summary: 'Move stock between locations with traceable reference and quantity integrity.',
    tags: ['stock transfer', 'locations', 'inventory movement'],
    routes: [
      { label: 'List Stock Transfers', path: 'list-stock-transfers' },
      { label: 'Add Stock Transfer', path: 'add-stock-transfer' },
      { label: 'Stock Report', path: 'report-stock' },
    ],
    permissions: [{ module: 'Stock Transfer', permission: 'View all stock transfers' }],
    steps: [
      'Select from and to locations correctly.',
      'Add only available products and valid transfer quantities.',
      'Finalize transfer and verify destination stock increase.',
    ],
    checks: [
      'Transfer quantity cannot exceed source availability.',
      'Source and destination location must differ.',
    ],
    fixes: [
      'If stock report is static, verify report reads live ledger and transfer records.',
      'If transfer is missing from list, verify it was saved with final status.',
    ],
  },
  {
    id: 'stock-adjustment',
    title: 'Stock Adjustment',
    module: 'Stock Adjustment',
    category: 'stock',
    summary: 'Adjust physical-vs-system stock with reasons and full auditability.',
    tags: ['stock adjustment', 'loss', 'damaged', 'audit'],
    routes: [
      { label: 'List Stock Adjustments', path: 'list-stock-adjustments' },
      { label: 'Add Stock Adjustment', path: 'add-stock-adjustment' },
      { label: 'Stock Adjustment Report', path: 'report-stock-adjustment' },
    ],
    permissions: [{ module: 'Stock Adjustment', permission: 'View all stock adjustments' }],
    steps: [
      'Create adjustment entry by location and date.',
      'Add affected products and quantity differences.',
      'Set clear reason and finalize adjustment.',
      'Review impact in stock adjustment report.',
    ],
    checks: [
      'Adjustment quantity and value impact should be reviewed by manager.',
      'Use consistent reason taxonomy for audit.',
    ],
    fixes: [
      'If report does not match adjustments, ensure report source uses saved adjustment ledger.',
    ],
  },
  {
    id: 'expense-payments',
    title: 'Expenses and Payments',
    module: 'Expenses / Payments',
    category: 'finance',
    summary: 'Record expenses, categories, and customer payments with full traceability.',
    tags: ['expenses', 'categories', 'payments', 'field payments'],
    routes: [
      { label: 'List Expenses', path: 'expenses' },
      { label: 'Add Expense', path: 'add-expense' },
      { label: 'Expense Categories', path: 'expense-categories' },
      { label: 'List Payments', path: 'list-payments' },
      { label: 'New Payment', path: 'new-payment' },
      { label: 'Field Payments', path: 'field-payments' },
    ],
    permissions: [{ module: 'Expense', permission: 'Access all expenses' }],
    steps: [
      'Create expense categories before expense entry.',
      'Record expenses with date, category, amount, and note.',
      'Capture payments against invoice/contact with proper method/account.',
      'Use field payments where applicable and track approvals.',
    ],
    checks: [
      'Payment amount cannot exceed due unless overpayment is intended.',
      'Expense should always have a category for reporting quality.',
    ],
    fixes: [
      'If payment is missing in reports, verify payment date range and account filter.',
      'If field payment is unavailable, check module toggle and role permission.',
    ],
  },
  {
    id: 'payment-accounts',
    title: 'Payment Accounts and Financial Statements',
    module: 'Payment Accounts',
    category: 'finance',
    summary: 'Manage account transactions and review balance sheet, trial balance, and cash flow.',
    tags: ['accounts', 'balance sheet', 'trial balance', 'cash flow'],
    routes: [
      { label: 'List Accounts', path: 'list-accounts' },
      { label: 'Balance Sheet', path: 'balance-sheet' },
      { label: 'Trial Balance', path: 'trial-balance' },
      { label: 'Cash Flow', path: 'cash-flow' },
      { label: 'Payment Account Report', path: 'payment-account-report' },
    ],
    permissions: [{ module: 'Account', permission: 'Access Accounts' }],
    steps: [
      'Set opening balances and account types.',
      'Post account-linked transactions consistently.',
      'Review statements with aligned date filters.',
    ],
    checks: [
      'Every payment method should map to an account where required.',
      'Statement date range must match report expectation.',
    ],
    fixes: [
      'If statements differ from transaction list, check date filter and opening balances.',
    ],
  },
  {
    id: 'reports',
    title: 'Reports Operating Guide',
    module: 'Reports',
    category: 'reports',
    summary: 'Use all report filters correctly and validate totals against source modules.',
    tags: ['profit loss', 'purchase sale', 'tax report', 'items', 'trending'],
    routes: [
      { label: 'Profit and Loss', path: 'report-profit-loss' },
      { label: 'Purchase and Sale', path: 'report-purchase-sale' },
      { label: 'Tax Report', path: 'report-tax' },
      { label: 'Supplier and Customer', path: 'report-supplier-customer' },
      { label: 'Customer Groups', path: 'report-customer-groups' },
      { label: 'Stock Report', path: 'report-stock' },
      { label: 'Stock Expiry', path: 'report-stock-expiry' },
      { label: 'Lot Report', path: 'report-lot' },
      { label: 'Trending Products', path: 'report-trending-products' },
      { label: 'Items Report', path: 'report-items' },
      { label: 'Product Purchase', path: 'report-product-purchase' },
      { label: 'Product Sell', path: 'report-product-sell' },
      { label: 'Purchase Payment', path: 'report-purchase-payment' },
      { label: 'Sell Payment', path: 'report-sell-payment' },
      { label: 'Expense Report', path: 'report-expense' },
      { label: 'Register Report', path: 'report-register' },
      { label: 'Sales Representative', path: 'report-sales-rep' },
      { label: 'Activity Log', path: 'activity-log' },
    ],
    permissions: [{ module: 'Report', permission: 'View purchase & sell report' }],
    steps: [
      'Always set location, user, and date range before reading totals.',
      'Use the same date range when comparing across tabs/reports.',
      'Validate suspicious totals against source transaction lists.',
      'Use export buttons only after confirming table filters.',
    ],
    checks: [
      'Grand totals should represent full filtered dataset, not just visible page.',
      'Avoid dead buttons or filters with no handler.',
    ],
    fixes: [
      'If tab totals look inconsistent, verify footer total uses dataset total not page subtotal.',
      'If a filter button has no effect, bind it to state and query logic or remove it.',
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting Playbook',
    module: 'Operations',
    category: 'troubleshooting',
    summary: 'Fast checks for the most common data, permission, and UI issues.',
    tags: ['troubleshoot', 'missing data', 'permission denied', 'ui issue'],
    routes: [
      { label: 'Settings', path: 'settings' },
      { label: 'Roles', path: 'roles' },
      { label: 'Activity Log', path: 'activity-log' },
      { label: 'Help Center', path: 'help-center' },
    ],
    steps: [
      'Check module toggle first (Settings > Modules).',
      'Check role permission second (Roles).',
      'Check source data third (transaction saved/finalized).',
      'Check filters last (date/location/user/status).',
    ],
    checks: [
      'Most missing records are caused by filters.',
      'Most hidden menus are caused by role permissions.',
      'Most report mismatches are caused by stale/mock data sources.',
    ],
    fixes: [
      'Clear local storage only as last resort after backup.',
      'When issue is reproducible, capture steps and expected vs actual behavior in Activity Log ticket.',
    ],
  },
];

const FAQS: Faq[] = [
  {
    id: 'faq-1',
    question: 'Why is a report menu or tab not visible for my user?',
    answer: 'Check module toggle in Settings and then role permissions. The menu is hidden when either is off.',
    tags: ['permissions', 'settings', 'report'],
  },
  {
    id: 'faq-2',
    question: 'Why does Product Sell Report not show in Reports menu?',
    answer: 'Enable Product Sell Report in Settings modules and ensure role has purchase and sell report permission.',
    tags: ['product sell', 'reports'],
  },
  {
    id: 'faq-3',
    question: 'Why does Add Order product search dropdown appear hidden?',
    answer: 'This is usually container overflow or z-index conflict. The search dropdown should render above surrounding containers.',
    tags: ['orders', 'ui', 'dropdown'],
  },
  {
    id: 'faq-4',
    question: 'How should carton or pack quantity behave in Add Sale/Add Order?',
    answer: 'Changing unit to carton/pack should convert quantity to equivalent piece count using product packaging factor.',
    tags: ['carton', 'pack', 'quantity'],
  },
  {
    id: 'faq-5',
    question: 'Why are report totals different across tabs?',
    answer: 'Use identical filters and ensure footer total uses full filtered dataset, not page-only subtotal.',
    tags: ['totals', 'pagination', 'reports'],
  },
  {
    id: 'faq-6',
    question: 'What should I configure before first sale?',
    answer: 'Complete business settings, locations, tax rates, invoice setup, products, and at least one customer.',
    tags: ['setup', 'sale'],
  },
];
const getRouteAvailability = (
  path: string,
  settings: ReturnType<typeof useGlobalContext>['settings'],
): { enabled: boolean; reason?: string } => {
  if (!isRegisteredAppRoute(path)) {
    return { enabled: false, reason: 'Guide link target does not exist in current app routes.' };
  }
  const hasLotModule = !!settings.enableLotNumber || !!settings.enableLotNumbers;
  if (path === 'categories' && !settings.enableCategories) return { enabled: false, reason: 'Categories module is disabled.' };
  if (path === 'brands' && !settings.enableBrands) return { enabled: false, reason: 'Brands module is disabled.' };
  if ((path === 'purchases' || path === 'add-purchase' || path === 'purchase-requisition' || path === 'purchase-order' || path === 'purchase-return') && !settings.enablePurchases) {
    return { enabled: false, reason: 'Purchases module is disabled.' };
  }
  if ((path === 'open-register' || path === 'list-pos' || path === 'report-register') && !settings.enablePOS) {
    return { enabled: false, reason: 'POS module is disabled.' };
  }
  if (path === 'shipments' && !settings.enableShipments) return { enabled: false, reason: 'Shipments module is disabled.' };
  if (path === 'discounts' && !settings.enableDiscounts) return { enabled: false, reason: 'Discounts module is disabled.' };
  if (path === 'import-sales' && !settings.enableImportSales) return { enabled: false, reason: 'Import Sales module is disabled.' };
  if ((path === 'list-orders' || path === 'add-order') && !settings.enableSalesOrder) return { enabled: false, reason: 'Sales Order module is disabled.' };
  if ((path === 'list-stock-transfers' || path === 'add-stock-transfer') && !settings.enableStockTransfers) return { enabled: false, reason: 'Stock Transfers module is disabled.' };
  if ((path === 'list-stock-adjustments' || path === 'add-stock-adjustment' || path === 'report-stock-adjustment') && !settings.enableStockAdjustments) {
    return { enabled: false, reason: 'Stock Adjustments module is disabled.' };
  }
  if ((path === 'expenses' || path === 'add-expense' || path === 'expense-categories' || path === 'report-expense') && !settings.enableExpenses) {
    return { enabled: false, reason: 'Expenses module is disabled.' };
  }
  if (path === 'field-payments' && !settings.enableFieldPayments) return { enabled: false, reason: 'Field Payments module is disabled.' };
  if ((path === 'list-accounts' || path === 'balance-sheet' || path === 'trial-balance' || path === 'cash-flow' || path === 'payment-account-report') && !settings.enablePaymentAccounts) {
    return { enabled: false, reason: 'Payment Accounts module is disabled.' };
  }
  if (path === 'report-customer-groups' && !settings.enableCustomerGroupsReport) return { enabled: false, reason: 'Customer Groups report is disabled.' };
  if (path === 'report-stock' && !settings.enableStockReport) return { enabled: false, reason: 'Stock report is disabled.' };
  if (path === 'report-stock-expiry' && !settings.enableProductExpiry) return { enabled: false, reason: 'Product expiry tracking is disabled.' };
  if (path === 'report-lot' && !hasLotModule) return { enabled: false, reason: 'Lot number tracking is disabled.' };
  if (path === 'report-trending-products' && !settings.enableTrendingProductsReport) {
    return { enabled: false, reason: 'Trending Products report is disabled.' };
  }
  if (path === 'report-items' && !settings.enableItemsReport) return { enabled: false, reason: 'Items report is disabled.' };
  if (path === 'report-product-purchase' && !settings.enableProductPurchaseReport) {
    return { enabled: false, reason: 'Product Purchase report is disabled.' };
  }
  if (path === 'report-product-sell' && !settings.enableProductSellReport) {
    return { enabled: false, reason: 'Product Sell report is disabled.' };
  }
  if (path === 'report-purchase-payment' && (!settings.enablePurchases || !settings.enablePurchasePaymentReport)) {
    return { enabled: false, reason: 'Purchase Payment report is disabled.' };
  }
  if (path === 'report-sell-payment' && !settings.enableSellPaymentReport) {
    return { enabled: false, reason: 'Sell Payment report is disabled.' };
  }
  if (path === 'activity-log' && !settings.enableActivityLog) return { enabled: false, reason: 'Activity log is disabled.' };
  return { enabled: true };
};

const HelpCenter: React.FC<HelpCenterProps> = ({ onNavigate }) => {
  const { currentUser, roles, settings } = useGlobalContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryId | 'all'>('all');
  const [expandedGuideId, setExpandedGuideId] = useState<string | null>(GUIDES[0]?.id ?? null);
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(FAQS[0]?.id ?? null);

  const currentRoleRecord = roles.find((role) => role.name === currentUser?.role);
  const rolePermissions = currentRoleRecord?.permissions || [];
  const roleHasExplicitPermissions = rolePermissions.length > 0;
  const hasRolePermission = (moduleName: string, permission: string) => {
    if (!currentUser) return false;
    if (String(currentUser.role || '').toLowerCase() === 'admin' || currentRoleRecord?.isSystem) return true;
    if (!roleHasExplicitPermissions) return true;
    return rolePermissions.includes(permission) || rolePermissions.includes(`${moduleName}::${permission}`);
  };

  const canAccessHelpCenter = hasRolePermission('Support', 'Access help center');

  const normalizedSearch = normalize(searchTerm);
  const filteredGuides = useMemo(() => {
    return GUIDES.filter((guide) => {
      const categoryMatch = activeCategory === 'all' || guide.category === activeCategory;
      if (!categoryMatch) return false;
      if (!normalizedSearch) return true;
      const searchable = [
        guide.title,
        guide.summary,
        guide.module,
        ...guide.tags,
        ...guide.steps,
        ...guide.checks,
        ...guide.fixes,
        ...guide.routes.map((route) => route.label),
      ]
        .join(' ')
        .toLowerCase();
      return searchable.includes(normalizedSearch);
    });
  }, [activeCategory, normalizedSearch]);

  const filteredFaqs = useMemo(() => {
    return FAQS.filter((faq) => {
      if (!normalizedSearch) return true;
      return `${faq.question} ${faq.answer} ${faq.tags.join(' ')}`.toLowerCase().includes(normalizedSearch);
    });
  }, [normalizedSearch]);

  const openGuideCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    GUIDES.forEach((guide) => {
      counts[guide.category] = (counts[guide.category] || 0) + 1;
    });
    return counts;
  }, []);

  const quickRoutes = useMemo(
    () => [
      { label: 'Add New Product', path: 'add-product' },
      { label: 'Add Sale', path: 'add-sale' },
      { label: 'Add Order', path: 'add-order' },
      { label: 'Stock Transfer', path: 'add-stock-transfer' },
      { label: 'Add Expense', path: 'add-expense' },
      { label: 'Profit and Loss', path: 'report-profit-loss' },
      { label: 'Product Sell Report', path: 'report-product-sell' },
      { label: 'Tax Report', path: 'report-tax' },
    ],
    [],
  );

  const handleRouteOpen = (path: string) => {
    if (!onNavigate) return;
    onNavigate(path);
  };

  const handleOpenGettingStarted = () => {
    setSearchTerm('');
    setActiveCategory('onboarding');
    setExpandedGuideId('setup');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                <LifeBuoy className="text-blue-600" size={30} />
                Help Center
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Operational guides for setup, sales, stock, reports, and troubleshooting.
              </p>
            </div>
            <div className="text-xs text-slate-500">
              Logged in as <span className="font-bold text-slate-700">{currentUser?.role || 'Unknown role'}</span>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search guides, modules, fixes, or report names..."
              className="w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((category) => {
              const isActive = activeCategory === category.id;
              const count = category.id === 'all' ? GUIDES.length : (openGuideCountByCategory[category.id] || 0);
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition border ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700'
                  }`}
                >
                  {category.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {!canAccessHelpCenter && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 shrink-0" size={18} />
            <p className="text-sm">
              Your role does not explicitly include <strong>Support::Access help center</strong>. Access works now only because of backward compatibility for older roles without explicit permissions.
            </p>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Quick Actions</h3>
          <button
            onClick={handleOpenGettingStarted}
            className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1"
          >
            Open Getting Started
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {quickRoutes.map((route) => {
            const availability = getRouteAvailability(route.path, settings);
            return (
              <button
                key={route.path}
                onClick={() => handleRouteOpen(route.path)}
                disabled={!onNavigate || !availability.enabled}
                title={availability.reason || ''}
                className={`rounded-xl border px-3 py-2 text-xs font-bold text-left transition ${
                  !onNavigate || !availability.enabled
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-700'
                }`}
              >
                {route.label}
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Guides ({filteredGuides.length})
            </h3>
          </div>

          {filteredGuides.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500 text-sm">
              No guide matched your search and category filter.
            </div>
          )}

          <div className="space-y-3">
            {filteredGuides.map((guide) => {
              const isOpen = expandedGuideId === guide.id;
              const hasGuideAccess =
                !guide.permissions ||
                guide.permissions.some((permission) =>
                  hasRolePermission(permission.module, permission.permission),
                );

              return (
                <article key={guide.id} className="rounded-2xl border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => setExpandedGuideId(isOpen ? null : guide.id)}
                    className="w-full px-4 py-4 bg-slate-50 hover:bg-slate-100 transition text-left"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-1 rounded-full">
                            {guide.module}
                          </span>
                          {!hasGuideAccess && (
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                              Permission required
                            </span>
                          )}
                        </div>
                        <h4 className="text-base font-black text-slate-900">{guide.title}</h4>
                        <p className="text-sm text-slate-600 mt-1">{guide.summary}</p>
                      </div>
                      <div className="shrink-0 text-slate-400">
                        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="p-4 border-t border-slate-200 bg-white">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Steps</p>
                          <ol className="space-y-2 text-sm text-slate-700 list-decimal list-inside">
                            {guide.steps.map((step) => (
                              <li key={step}>{step}</li>
                            ))}
                          </ol>
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Checks</p>
                          <ul className="space-y-2 text-sm text-slate-700">
                            {guide.checks.map((check) => (
                              <li key={check} className="flex items-start gap-2">
                                <CircleCheck className="mt-0.5 shrink-0 text-emerald-600" size={14} />
                                <span>{check}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Fixes</p>
                          <ul className="space-y-2 text-sm text-slate-700">
                            {guide.fixes.map((fix) => (
                              <li key={fix} className="flex items-start gap-2">
                                <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={14} />
                                <span>{fix}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Go To Module</p>
                        <div className="flex flex-wrap gap-2">
                          {guide.routes.map((route) => {
                            const availability = getRouteAvailability(route.path, settings);
                            const isDisabled = !onNavigate || !availability.enabled;
                            return (
                              <button
                                key={`${guide.id}-${route.path}`}
                                onClick={() => handleRouteOpen(route.path)}
                                title={availability.reason || ''}
                                disabled={isDisabled}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                                  isDisabled
                                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                    : 'bg-white border-slate-300 text-slate-700 hover:border-blue-400 hover:text-blue-700'
                                }`}
                              >
                                {route.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
              <ShieldCheck size={16} className="text-indigo-600" />
              First Week Checklist
            </h3>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <CircleCheck size={14} className="mt-0.5 text-emerald-600 shrink-0" />
                Complete settings, taxes, locations, and invoice setup.
              </li>
              <li className="flex items-start gap-2">
                <CircleCheck size={14} className="mt-0.5 text-emerald-600 shrink-0" />
                Import products and opening stock.
              </li>
              <li className="flex items-start gap-2">
                <CircleCheck size={14} className="mt-0.5 text-emerald-600 shrink-0" />
                Configure roles before onboarding non-admin users.
              </li>
              <li className="flex items-start gap-2">
                <CircleCheck size={14} className="mt-0.5 text-emerald-600 shrink-0" />
                Test add sale, add order, shipment, payment, and key reports.
              </li>
            </ul>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
              <BookOpen size={16} className="text-blue-600" />
              FAQ
            </h3>
            <div className="space-y-2">
              {filteredFaqs.map((faq) => {
                const isOpen = expandedFaqId === faq.id;
                return (
                  <article key={faq.id} className="rounded-xl border border-slate-200 overflow-hidden">
                    <button
                      onClick={() => setExpandedFaqId(isOpen ? null : faq.id)}
                      className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100 text-left text-sm font-bold text-slate-800 flex items-center justify-between gap-2"
                    >
                      <span>{faq.question}</span>
                      {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </button>
                    {isOpen && <p className="px-3 py-3 text-sm text-slate-600">{faq.answer}</p>}
                  </article>
                );
              })}
              {filteredFaqs.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  No FAQ matched your current search.
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default HelpCenter;
