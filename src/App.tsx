import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Search, X, Check, Clock, Calculator, CalendarDays, ShoppingCart, BookOpen } from 'lucide-react';
import { NotificationProvider, useNotifications } from '@/context/NotificationContext';
import { GlobalProvider, useGlobalContext } from '@/context/GlobalContext';
import { formatTimeBySettings } from '@/utils/dateTime';
import Sidebar from '@/components/layout/Sidebar';
import Dashboard from '@/components/dashboard/Dashboard';
import Login from '@/components/layout/Login';
import Inventory from '@/components/products/Inventory';
import AddOpeningStock from '@/components/products/AddOpeningStock';
import ProductStockHistory from '@/components/products/ProductStockHistory';
import AddProduct from '@/components/products/AddProduct';
import ProductViewCatalog from '@/components/products/ProductViewCatalog';
import POS from '@/components/pos/POS';
import VatBills from '@/components/reports/VatBills';
import Suppliers from '@/components/contacts/Suppliers';
import Customers from '@/components/contacts/Customers';
import CustomerGroups from '@/components/contacts/CustomerGroups';
import ImportContacts from '@/components/contacts/ImportContacts';
import SellingPriceGroups from '@/components/pricing/SellingPriceGroups';
import UpdatePrice from '@/components/products/UpdatePrice';
import PrintLabels from '@/components/products/PrintLabels';
import Variations from '@/components/products/Variations';
import ImportProducts from '@/components/products/ImportProducts';
import ImportOpeningStock from '@/components/products/ImportOpeningStock';
import Units from '@/components/products/Units';
import Categories from '@/components/products/Categories';
import Brands from '@/components/products/Brands';
import Warranties from '@/components/products/Warranties';
import AddPurchase from '@/components/purchases/AddPurchase';
import Purchases from '@/components/purchases/Purchases';
import PurchaseRequisition from '@/components/purchases/PurchaseRequisition';
import PurchaseOrder from '@/components/purchases/PurchaseOrder';
import PurchaseReturn from '@/components/purchases/PurchaseReturn';
import Sales from '@/components/sales/Sales';
import AddSale from '@/components/sales/AddSale';
import ListQuotations from '@/components/sales/ListQuotations';
import AddQuotation from '@/components/sales/AddQuotation';
import ListPOS from '@/components/pos/ListPOS';
import OpenRegister from '@/components/pos/OpenRegister';
import ListReturns from '@/components/sales/ListReturns';
import Shipments from '@/components/sales/Shipments';
import Discounts from '@/components/pricing/Discounts';
import ImportSales from '@/components/sales/ImportSales';
import ListStockTransfers from '@/components/stock/ListStockTransfers';
import AddStockTransfer from '@/components/stock/AddStockTransfer';
import ListStockAdjustments from '@/components/stock/ListStockAdjustments';
import AddStockAdjustment from '@/components/stock/AddStockAdjustment';
import Orders from '@/components/orders/Orders';
import AddOrder from '@/components/orders/AddOrder';
import ViewOrder from '@/components/orders/ViewOrder';
import ListExpenses from '@/components/expenses/ListExpenses';
import AddExpense from '@/components/expenses/AddExpense';
import ExpenseCategories from '@/components/expenses/ExpenseCategories';
import ViewCustomer from '@/components/contacts/ViewCustomer';
import ViewSupplier from '@/components/contacts/ViewSupplier';
import ReportProfitLoss from '@/components/reports/ReportProfitLoss';
import ReportPurchaseSale from '@/components/reports/ReportPurchaseSale';
import ReportTax from '@/components/reports/ReportTax';
import ReportSupplierCustomer from '@/components/reports/ReportSupplierCustomer';
import ReportCustomerGroups from '@/components/reports/ReportCustomerGroups';
import ReportStock from '@/components/reports/ReportStock';
import ReportStockExpiry from '@/components/reports/ReportStockExpiry';
import ReportLot from '@/components/reports/ReportLot';
import ReportStockAdjustment from '@/components/reports/ReportStockAdjustment';
import ReportTrendingProducts from '@/components/reports/ReportTrendingProducts';
import ReportItems from '@/components/reports/ReportItems';
import ReportProductPurchase from '@/components/reports/ReportProductPurchase';
import ReportProductSell from '@/components/reports/ReportProductSell';
import ReportPurchasePayment from '@/components/reports/ReportPurchasePayment';
import ReportSellPayment from '@/components/reports/ReportSellPayment';
import ReportExpense from '@/components/reports/ReportExpense';
import ReportRegister from '@/components/reports/ReportRegister';
import ReportSalesRep from '@/components/reports/ReportSalesRep';
import ActivityLog from '@/components/shared/ActivityLog';
import TaxRates from '@/components/settings/TaxRates';
import Settings from '@/components/settings/Settings';
import BackupRestore from '@/components/settings/BackupRestore';
import Locations from '@/components/settings/Locations';
import InvoiceSettings from '@/components/settings/InvoiceSettings';
import BarcodeSettings from '@/components/settings/BarcodeSettings';
import Printers from '@/components/settings/Printers';
import HelpCenter from '@/components/settings/HelpCenter';
import AddSellReturn from '@/components/sales/AddSellReturn';
import NewPayment from '@/components/payments/NewPayment';
import FieldPayments from '@/components/payments/FieldPayments';
import ListPayments from '@/components/payments/ListPayments';
import ListAccounts from '@/components/accounts/ListAccounts';
import BalanceSheet from '@/components/reports/BalanceSheet';
import TrialBalance from '@/components/reports/TrialBalance';
import CashFlow from '@/components/reports/CashFlow';
import PaymentAccountReport from '@/components/reports/PaymentAccountReport';
import Users from '@/components/users/Users';
import Roles from '@/components/users/Roles';
import SalesCommissionAgents from '@/components/users/SalesCommissionAgents';
import AddUser from '@/components/users/AddUser';
import ViewUser from '@/components/users/ViewUser';
import ViewSaleDetails from '@/components/sales/ViewSaleDetails';

const App: React.FC = () => {
  return (
    <GlobalProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </GlobalProvider>
  );
};

const AppContent: React.FC = () => {
  const { settings, currentUser, setCurrentUser, roles, products } = useGlobalContext();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!currentUser);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [publicInvoiceId, setPublicInvoiceId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [calculatorExpression, setCalculatorExpression] = useState('');
  const [calculatorResult, setCalculatorResult] = useState('');
  const [calendarDate, setCalendarDate] = useState(() => new Date().toISOString().slice(0, 10));
  const { notifications, unreadCount, actionCount, markAsRead, markAllAsRead, removeNotification } = useNotifications();
  const notificationRef = useRef<HTMLDivElement>(null);
  const calculatorRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Apply theme colour to <html> data-theme attribute so index.css overrides take effect
  useEffect(() => {
    const theme = settings.themeColor || 'default';
    if (theme === 'default') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = theme;
    }
  }, [settings.themeColor]);

  const globalSearchOptions = useMemo(() => ([
    { label: 'Dashboard', page: 'dashboard' },
    { label: 'Inventory', page: 'inventory' },
    { label: 'List Products', page: 'products' },
    { label: 'Add New Product', page: 'add-product' },
    { label: 'Product View', page: 'product-view' },
    { label: 'List Purchases', page: 'purchases' },
    { label: 'Add Purchase', page: 'add-purchase' },
    { label: 'All Sales', page: 'sales' },
    { label: 'Add Sale', page: 'add-sale' },
    { label: 'List Orders', page: 'list-orders' },
    { label: 'Add Order', page: 'add-order' },
    { label: 'Shipments', page: 'shipments' },
    { label: 'Discounts', page: 'discounts' },
    { label: 'Expenses', page: 'list-expenses' },
    { label: 'Add Expense', page: 'add-expense' },
    { label: 'Payments', page: 'list-payments' },
    { label: 'Customers', page: 'customers' },
    { label: 'Suppliers', page: 'suppliers' },
    { label: 'Settings', page: 'settings' },
    { label: 'Backup & Restore', page: 'backup-restore' },
    { label: 'Activity Log', page: 'activity-log' },
    { label: 'Profit / Loss Report', page: 'report-profit-loss' },
    { label: 'Tax Report', page: 'report-tax' },
    { label: 'VAT Bills', page: 'vat-bills' },
    { label: 'Stock Report', page: 'report-stock' },
    { label: 'Product Purchase Report', page: 'report-product-purchase' },
    { label: 'Product Sell Report', page: 'report-product-sell' },
    { label: 'Help Center', page: 'help-center' },
  ]), []);

  const searchMatches = useMemo(() => {
    const query = String(globalSearch || '').trim().toLowerCase();
    if (!query) return [];
    return globalSearchOptions
      .filter((option) => option.label.toLowerCase().includes(query) || option.page.toLowerCase().includes(query))
      .slice(0, 8);
  }, [globalSearch, globalSearchOptions]);

  const handleGlobalSearch = () => {
    const query = String(globalSearch || '').trim().toLowerCase();
    if (!query) return;
    const exact = globalSearchOptions.find((option) => option.label.toLowerCase() === query || option.page.toLowerCase() === query);
    const firstMatch = exact || searchMatches[0];
    if (!firstMatch) return;
    setCurrentPage(firstMatch.page);
    setGlobalSearch('');
  };

  useEffect(() => {
    setIsAuthenticated(!!currentUser);
  }, [currentUser]);

  // When the JWT expires the server returns 401. apiClient dispatches this
  // event so all users are returned to the login screen automatically.
  useEffect(() => {
    const handleAuthExpired = () => {
      try { localStorage.removeItem('atwar_auth_token'); } catch {}
      setCurrentUser(null);
      setIsAuthenticated(false);
    };
    window.addEventListener('atwar:auth:expired', handleAuthExpired);
    return () => window.removeEventListener('atwar:auth:expired', handleAuthExpired);
  }, [setCurrentUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (calculatorRef.current && !calculatorRef.current.contains(event.target as Node)) {
        setShowCalculator(false);
      }
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check URL parameters on load for public invoice links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pageParam = params.get('page');
    const idParam = params.get('id');

    if (pageParam === 'public-view-invoice' && idParam) {
      setPublicInvoiceId(idParam);
      setCurrentPage('public-view-invoice');
    }
  }, []);

  // Handle closing public invoice view
  const handleClosePublicInvoice = () => {
    window.history.pushState({}, '', window.location.pathname);
    setPublicInvoiceId(null);
    setCurrentPage('dashboard');
  };

  const evaluateCalculatorExpression = () => {
    const expression = String(calculatorExpression || '').trim();
    if (!expression) {
      setCalculatorResult('');
      return;
    }
    if (!/^[\d+\-*/().%\s]+$/.test(expression)) {
      setCalculatorResult('Invalid expression');
      return;
    }
    try {
      const raw = Function(`"use strict"; return (${expression});`)();
      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) {
        setCalculatorResult('Invalid expression');
        return;
      }
      setCalculatorResult(String(Number(numeric.toFixed(6))));
    } catch {
      setCalculatorResult('Invalid expression');
    }
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
  };

  const handleContactSelect = (contactId: string, tab?: string) => {
    if (!contactId) return;
    const target = tab ? `view-customer/${contactId}:${tab}` : `view-customer/${contactId}`;
    setCurrentPage(target);
  };

  const renderModuleDisabled = (moduleName: string) => (
    <div className="flex flex-col items-center justify-center h-96 text-slate-400">
      <h2 className="text-2xl font-bold text-slate-300 mb-2">Module Disabled</h2>
      <p>
        {moduleName} is disabled in Settings {'>'} Modules.
      </p>
    </div>
  );
  const renderAccessDenied = (moduleName: string) => (
    <div className="flex flex-col items-center justify-center h-96 text-slate-400">
      <h2 className="text-2xl font-bold text-slate-300 mb-2">Access Denied</h2>
      <p>
        You do not have permission to access {moduleName}.
      </p>
    </div>
  );

  const currentRoleRecord = roles.find(r => r.name === currentUser?.role);
  const rolePermissions = currentRoleRecord?.permissions || [];
  const roleHasExplicitPermissions = rolePermissions.length > 0;
  const hasRolePermission = (moduleName: string, permission: string) => {
    if (!currentUser) return false;
    if (String(currentUser.role || '').toLowerCase() === 'admin' || currentRoleRecord?.isSystem) return true;
    if (!roleHasExplicitPermissions) return true;
    return (
      rolePermissions.includes(permission) ||
      rolePermissions.includes(`${moduleName}::${permission}`)
    );
  };
  const canViewQuotations =
    hasRolePermission('Quotation', 'View all quotations') ||
    hasRolePermission('Quotation', 'View own quotations');
  const canCreateQuotations =
    hasRolePermission('Quotation', 'Edit quotation') ||
    hasRolePermission('Sell', 'Add Sell');
  const canAccessAllSellReturns = hasRolePermission('Sell', 'Access all sell return');
  const canAccessOwnSellReturns = hasRolePermission('Sell', 'Access own sell return');
  const canAccessSellReturns = canAccessAllSellReturns || canAccessOwnSellReturns;
  const canAccessShipments =
    hasRolePermission('Shipments', 'Access all shipments') ||
    hasRolePermission('Shipments', 'Access own shipments') ||
    hasRolePermission('Shipments', 'Access pending shipments only') ||
    hasRolePermission('Shipments', 'Commission agent can access their own shipments');
  const canManageDiscounts = hasRolePermission('Sell', 'Add/Edit/Delete Discount');
  const canImportSales =
    hasRolePermission('Sell', 'Import Sales') ||
    hasRolePermission('Sell', 'Add Sell');
  const canViewLegacyStockOperations =
    hasRolePermission('Purchase & Stock Adjustment', 'View all Purchase & Stock Adjustment') ||
    hasRolePermission('Purchase & Stock Adjustment', 'View own Purchase & Stock Adjustment');
  const canViewAllLegacyStockOperations = hasRolePermission(
    'Purchase & Stock Adjustment',
    'View all Purchase & Stock Adjustment',
  );
  const canViewOwnLegacyStockOperations = hasRolePermission(
    'Purchase & Stock Adjustment',
    'View own Purchase & Stock Adjustment',
  );
  const canManageLegacyStockOperations =
    hasRolePermission('Purchase & Stock Adjustment', 'Add purchase & Stock Adjustment') ||
    hasRolePermission('Purchase & Stock Adjustment', 'Edit purchase & Stock Adjustment');
  const canViewStockTransfers =
    hasRolePermission('Stock Transfer', 'View all stock transfers') ||
    hasRolePermission('Stock Transfer', 'View own stock transfers') ||
    canViewLegacyStockOperations;
  const canManageStockTransfers =
    hasRolePermission('Stock Transfer', 'Add stock transfer') ||
    hasRolePermission('Stock Transfer', 'Edit stock transfer') ||
    canManageLegacyStockOperations;
  const canViewStockAdjustments =
    hasRolePermission('Stock Adjustment', 'View all stock adjustments') ||
    hasRolePermission('Stock Adjustment', 'View own stock adjustments') ||
    canViewLegacyStockOperations;
  const canViewAllStockAdjustments =
    hasRolePermission('Stock Adjustment', 'View all stock adjustments') ||
    canViewAllLegacyStockOperations;
  const canViewOwnStockAdjustments =
    hasRolePermission('Stock Adjustment', 'View own stock adjustments') ||
    canViewOwnLegacyStockOperations;
  const canAddStockAdjustments =
    hasRolePermission('Stock Adjustment', 'Add stock adjustment') ||
    canManageLegacyStockOperations;
  const canEditStockAdjustments =
    hasRolePermission('Stock Adjustment', 'Edit stock adjustment') ||
    canManageLegacyStockOperations;
  const canDeleteStockAdjustments =
    hasRolePermission('Stock Adjustment', 'Delete stock adjustment') ||
    hasRolePermission('Purchase & Stock Adjustment', 'Delete purchase & Stock Adjustment');
  const stockAdjustmentOwnerScopeId =
    !canViewAllStockAdjustments && canViewOwnStockAdjustments
      ? (currentUser?.id || '')
      : '';
  const stockAdjustmentOwnerScopeName =
    !canViewAllStockAdjustments && canViewOwnStockAdjustments
      ? (currentUser?.name || '')
      : '';
  const canViewAllExpenses = hasRolePermission('Expense', 'Access all expenses');
  const canViewOwnExpenses = hasRolePermission('Expense', 'View own expense only');
  const canAddExpenses = hasRolePermission('Expense', 'Add Expense');
  const canEditExpenses = hasRolePermission('Expense', 'Edit Expense');
  const canDeleteExpenses = hasRolePermission('Expense', 'Delete Expense');
  const canViewExpenses =
    canViewAllExpenses ||
    canViewOwnExpenses ||
    canAddExpenses ||
    canEditExpenses ||
    canDeleteExpenses;
  const expenseOwnerScopeId =
    !canViewAllExpenses && canViewOwnExpenses
      ? (currentUser?.id || '')
      : '';
  const expenseOwnerScopeName =
    !canViewAllExpenses && canViewOwnExpenses
      ? (currentUser?.name || '')
      : '';
  const canViewStockReports = hasRolePermission(
    'Report',
    'View stock report, stock adjustment report & stock expiry report',
  );
  const canViewPurchaseSaleReport = hasRolePermission('Report', 'View purchase & sell report');
  const canViewTaxReport = hasRolePermission('Report', 'View Tax report');
  const canViewProfitLossReport = hasRolePermission('Report', 'View profit/loss report');
  const canViewExpenseReports = hasRolePermission('Report', 'View expense report');
  const canViewSupplierCustomerReport = hasRolePermission('Report', 'View Supplier & Customer report');
  const canViewCustomerGroupsReport = hasRolePermission('Report', 'View customer groups report');
  const canViewProductStockValue = hasRolePermission('Report', 'View product stock value');
  const canViewTrendingProductReport = hasRolePermission('Report', 'View trending product report');
  const canViewRegisterReport = hasRolePermission('Report', 'View register report');
  const canViewSalesRepresentativeReport = hasRolePermission('Report', 'View sales representative report');
  const canViewActivityLog = hasRolePermission('Report', 'View activity log');
  const canViewOrders = hasRolePermission('Order', 'View order');
  const canAddOrders = hasRolePermission('Order', 'Add order');
  const canEditOrders = hasRolePermission('Order', 'Edit order');
  const canDeleteOrders = hasRolePermission('Order', 'Delete order');
  const canApproveOrders = hasRolePermission('Order', 'Approve order');
  const canAccessOrders = canViewOrders || canAddOrders || canEditOrders || canDeleteOrders || canApproveOrders;
  const canGenerateInvoiceFromOrders = hasRolePermission('Sell', 'Add Sell');
  const canViewSellPayments =
    hasRolePermission('Sell', 'Add sell payment') ||
    hasRolePermission('Sell', 'Edit sell payment') ||
    hasRolePermission('Sell', 'Delete sell payment') ||
    hasRolePermission('POS', 'Add/Edit Payment');
  const canAddSellPayments =
    hasRolePermission('Sell', 'Add sell payment') ||
    hasRolePermission('POS', 'Add/Edit Payment');
  const canViewFieldPayments =
    hasRolePermission('Field Payment', 'View field payment') ||
    hasRolePermission('Field Payment', 'Add field payment') ||
    hasRolePermission('Field Payment', 'Edit field payment') ||
    hasRolePermission('Field Payment', 'Delete field payment') ||
    hasRolePermission('Field Payment', 'Approval field payment');
  const canAccessAccounts = hasRolePermission('Account', 'Access Accounts');
  const canEditAccountTransactions = hasRolePermission('Account', 'Edit account transaction');
  const canDeleteAccountTransactions = hasRolePermission('Account', 'Delete account transaction');
  const canAccessBusinessSettings = hasRolePermission('Settings', 'Access business settings');
  const canAccessInvoiceSettings = hasRolePermission('Settings', 'Access invoice settings');
  const canAccessBarcodeSettings = hasRolePermission('Settings', 'Access barcode settings');
  const canAccessPrinters = hasRolePermission('Settings', 'Access printers');
  const canViewTaxRates = hasRolePermission('Tax rate', 'View tax rate');
  const canAccessHelpCenter = hasRolePermission('Support', 'Access help center');

  // Simple page router
  const renderPage = () => {
    // Handle parameterized EditSale route: edit-sale/{id}
    if (currentPage.startsWith('edit-sale/')) {
        const parts = currentPage.split('/');
        const id = parts[1] || '';
        return <AddSale isEdit={true} saleId={id} onNavigate={setCurrentPage} />;
    }

    // Handle parameterized ViewUser route
    if (currentPage.startsWith('view-user/')) {
        const parts = currentPage.split('/');
        const id = parts[1] || '';
        return <ViewUser userId={id} onNavigate={setCurrentPage} />;
    }

    // Handle parameterized ViewCustomer route: view-customer/{id}:{tab}
    if (currentPage.startsWith('view-customer/')) {
       const parts = currentPage.split('/');
       const params = parts[1] || '';
       const [id, tab] = params.includes(':') ? params.split(':') : [params, undefined];
       return <ViewCustomer onNavigate={setCurrentPage} contactId={id} initialTab={tab} />;
    }

    // Handle parameterized ViewSupplier route: view-supplier/{id}:{tab}
    if (currentPage.startsWith('view-supplier/')) {
       const parts = currentPage.split('/');
       const params = parts[1] || '';
       const [id, tab] = params.includes(':') ? params.split(':') : [params, undefined];
       return <ViewSupplier onNavigate={setCurrentPage} contactId={id} initialTab={tab} />;
    }

    // Handle view-sale/{saleId} — renders invoice details as a page (not a modal)
    if (currentPage.startsWith('view-sale/')) {
      const saleId = currentPage.split('/')[1] || '';
      return (
        <ViewSaleDetails
          isOpen={true}
          pageMode={true}
          saleId={saleId}
          onClose={() => setCurrentPage('sales')}
        />
      );
    }

    // Handle print-sale/{saleId} — opens invoice page and auto-triggers print.
    if (currentPage.startsWith('print-sale/')) {
      const saleId = currentPage.split('/')[1] || '';
      return (
        <ViewSaleDetails
          isOpen={true}
          pageMode={true}
          saleId={saleId}
          autoPrintRequestId={`print-${saleId}`}
          onClose={() => setCurrentPage('sales')}
        />
      );
    }

    // Handle parameterized EditProduct route: edit-product/{id}
    if (currentPage.startsWith('edit-product/')) {
        const parts = currentPage.split('/');
        const id = parts[1] || '';
        return <AddProduct isEdit={true} productId={id} onNavigate={setCurrentPage} />;
    }

    // Handle parameterized PrintLabels route: print-labels/{productId}
    if (currentPage.startsWith('print-labels/')) {
        const parts = currentPage.split('/');
        const id = parts[1] || '';
        return <PrintLabels initialProductId={id} />;
    }

    // Handle parameterized ProductStockHistory route: product-stock-history/{productId}
    if (currentPage.startsWith('product-stock-history/')) {
      const parts = currentPage.split('/');
      const id = decodeURIComponent(parts[1] || '');
      const selectedProduct = products.find((product) => String(product.id) === String(id)) || null;
      if (!selectedProduct) {
        return renderAccessDenied('Product');
      }
      return (
        <ProductStockHistory
          pageMode={true}
          isOpen={true}
          onClose={() => setCurrentPage('products')}
          product={selectedProduct}
        />
      );
    }

    // Handle parameterized AddOpeningStock route: add-opening-stock/{productId}
    if (currentPage.startsWith('add-opening-stock/')) {
      const parts = currentPage.split('/');
      const id = decodeURIComponent(parts[1] || '');
      const selectedProduct = products.find((product) => String(product.id) === String(id)) || null;
      if (!selectedProduct) {
        return renderAccessDenied('Product');
      }
      return (
        <AddOpeningStock
          pageMode={true}
          isOpen={true}
          onClose={() => setCurrentPage('products')}
          product={selectedProduct}
        />
      );
    }

    // Handle parameterized EditUser route: edit-user/{id}
    if (currentPage.startsWith('edit-user/')) {
        const parts = currentPage.split('/');
        const id = parts[1] || '';
        return <AddUser isEdit={true} userId={id} onNavigate={setCurrentPage} />;
    }

    // Handle parameterized add-sell-return/sale/{saleId}
    if (currentPage.startsWith('add-sell-return/sale/')) {
      if (!canAccessSellReturns) return renderAccessDenied('Sell Returns');
      const saleId = currentPage.split('/')[2] || '';
      return <AddSellReturn onNavigate={setCurrentPage} prefillSaleId={saleId} />;
    }

    // Handle parameterized add-sell-return/edit/{returnId}
    if (currentPage.startsWith('add-sell-return/edit/')) {
      if (!canAccessSellReturns) return renderAccessDenied('Sell Returns');
      const returnId = currentPage.split('/')[2] || '';
      return <AddSellReturn onNavigate={setCurrentPage} editReturnId={returnId} />;
    }

    // Handle parameterized add-stock-transfer/{transferId}
    if (currentPage.startsWith('add-stock-transfer/')) {
      if (!settings.enableStockTransfers) return renderModuleDisabled('Stock Transfers');
      if (!canManageStockTransfers) return renderAccessDenied('Stock Transfers');
      const transferId = currentPage.split('/')[1] || '';
      return <AddStockTransfer onNavigate={setCurrentPage} editTransferId={transferId} />;
    }

    // Handle parameterized add-stock-adjustment/{adjustmentId}
    if (currentPage.startsWith('add-stock-adjustment/')) {
      if (!settings.enableStockAdjustments) return renderModuleDisabled('Stock Adjustments');
      if (!canEditStockAdjustments) return renderAccessDenied('Stock Adjustments');
      const adjustmentId = currentPage.split('/')[1] || '';
      return (
        <AddStockAdjustment
          onNavigate={setCurrentPage}
          editAdjustmentId={adjustmentId}
          canAdd={canAddStockAdjustments}
          canEdit={canEditStockAdjustments}
          restrictToAddedById={stockAdjustmentOwnerScopeId}
          restrictToAddedByName={stockAdjustmentOwnerScopeName}
        />
      );
    }

    // Handle parameterized purchase-order/{requisitionId}
    if (currentPage.startsWith('purchase-order/')) {
      if (!settings.enablePurchases) return renderModuleDisabled('Purchases');
      if (!settings.enablePurchaseOrder) return renderModuleDisabled('Purchase Order');
      const requisitionId = currentPage.split('/')[1] || '';
      return <PurchaseOrder onNavigate={setCurrentPage} prefillRequisitionId={requisitionId} />;
    }

    // Handle parameterized add-purchase/{orderId}
    if (currentPage.startsWith('add-purchase/')) {
      if (!settings.enablePurchases) return renderModuleDisabled('Purchases');
      const orderId = currentPage.split('/')[1] || '';
      return <AddPurchase onNavigate={setCurrentPage} prefillOrderId={orderId} />;
    }

    // Handle parameterized purchase-return/{purchaseId}
    if (currentPage.startsWith('purchase-return/')) {
      if (!settings.enablePurchases) return renderModuleDisabled('Purchases');
      const purchaseId = currentPage.split('/')[1] || '';
      return <PurchaseReturn prefillPurchaseId={purchaseId} />;
    }

    // Handle parameterized convert-order-to-invoice/{orderId}
    if (currentPage.startsWith('convert-order-to-invoice/')) {
      if (!settings.enableSalesOrder) return renderModuleDisabled('Orders');
      if (!canGenerateInvoiceFromOrders) return renderAccessDenied('Orders');
      const orderId = currentPage.split('/')[1] || '';
      if (!orderId) return renderAccessDenied('Orders');
      return <AddSale fromOrder={true} sourceOrderId={orderId} onNavigate={setCurrentPage} />;
    }

    // Handle parameterized edit-expense/{expenseId}
    if (currentPage.startsWith('edit-expense/')) {
      if (!settings.enableExpenses) return renderModuleDisabled('Expenses');
      if (!canEditExpenses) return renderAccessDenied('Expenses');
      const expenseId = currentPage.split('/')[1] || '';
      if (!expenseId) return renderAccessDenied('Expenses');
      return (
        <AddExpense
          isEdit
          editExpenseId={expenseId}
          onNavigate={setCurrentPage}
          canAdd={canAddExpenses}
          canEdit={canEditExpenses}
          restrictToAddedById={expenseOwnerScopeId}
          restrictToAddedByName={expenseOwnerScopeName}
        />
      );
    }

    // Handle parameterized payment-account-report/{account}:{location}
    if (currentPage.startsWith('payment-account-report/')) {
      if (!settings.enablePaymentAccounts) return renderModuleDisabled('Payment Accounts');
      if (!canAccessAccounts) return renderAccessDenied('Payment Accounts');
      const encoded = currentPage.split('/')[1] || '';
      const [encodedAccount, encodedLocation] = encoded.split(':');
      const initialAccount = decodeURIComponent(encodedAccount || '').trim();
      const initialLocation = decodeURIComponent(encodedLocation || '').trim();
      return <PaymentAccountReport initialAccount={initialAccount} initialLocation={initialLocation} />;
    }

    switch(currentPage) {
      case 'dashboard': return <Dashboard onNavigate={setCurrentPage} />;
      case 'users': return <Users onNavigate={setCurrentPage} />;
      case 'add-user': return <AddUser onNavigate={setCurrentPage} />;
      case 'roles': return <Roles onNavigate={setCurrentPage} />;
      case 'sales-commission-agents':
        return settings.enableCommissionAgents ? <SalesCommissionAgents /> : renderModuleDisabled('Sales Commission Agents');
      case 'products': return <Inventory onNavigate={setCurrentPage} />;
      case 'add-product': return <AddProduct onNavigate={setCurrentPage} />;
      case 'product-view': return <ProductViewCatalog onNavigate={setCurrentPage} />;
      case 'update-price': return <UpdatePrice />;
      case 'print-labels': return <PrintLabels />;
      case 'variations': return <Variations />;
      case 'import-products': return <ImportProducts />;
      case 'import-opening-stock': return <ImportOpeningStock />;
      case 'units': return <Units />;
      case 'categories': return settings.enableCategories ? <Categories /> : renderModuleDisabled('Categories');
      case 'brands': return settings.enableBrands ? <Brands /> : renderModuleDisabled('Brands');
      case 'warranties': return <Warranties />;
      case 'purchases': return settings.enablePurchases ? <Purchases onNavigate={setCurrentPage} /> : renderModuleDisabled('Purchases');
      case 'add-purchase': return settings.enablePurchases ? <AddPurchase onNavigate={setCurrentPage} /> : renderModuleDisabled('Purchases');
      case 'purchase-requisition':
        if (!settings.enablePurchases) return renderModuleDisabled('Purchases');
        return settings.enablePurchaseRequisition ? <PurchaseRequisition onNavigate={setCurrentPage} /> : renderModuleDisabled('Purchase Requisition');
      case 'purchase-order':
        if (!settings.enablePurchases) return renderModuleDisabled('Purchases');
        return settings.enablePurchaseOrder ? <PurchaseOrder onNavigate={setCurrentPage} /> : renderModuleDisabled('Purchase Order');
      case 'purchase-return': return settings.enablePurchases ? <PurchaseReturn /> : renderModuleDisabled('Purchases');
      case 'sales': return <Sales onNavigate={setCurrentPage} statusFilter="Final" />;
      case 'add-sale': return <AddSale onNavigate={setCurrentPage} />;
      case 'edit-sale': return <AddSale isEdit={true} onNavigate={setCurrentPage} />;
      case 'list-pos': return settings.enablePOS ? <ListPOS onNavigate={setCurrentPage} /> : renderModuleDisabled('POS');
      case 'open-register': return settings.enablePOS ? <OpenRegister onNavigate={setCurrentPage} /> : renderModuleDisabled('POS');
      case 'pos': return settings.enablePOS ? <POS onNavigate={setCurrentPage} /> : renderModuleDisabled('POS');
      case 'drafts':
        return settings.disableDraft
          ? renderModuleDisabled('Draft')
          : <Sales onNavigate={setCurrentPage} statusFilter="Draft" title="Drafts" addPage="add-draft" addButtonLabel="Add Draft" />;
      case 'add-draft':
        return settings.disableDraft
          ? renderModuleDisabled('Draft')
          : <AddSale onNavigate={setCurrentPage} initialStatus="Draft" />;
      case 'quotations':
        if (settings.disableQuotation) return renderModuleDisabled('Quotation');
        if (!canViewQuotations) return renderAccessDenied('Quotation');
        return <ListQuotations onNavigate={setCurrentPage} />;
      case 'add-quotation':
        if (settings.disableQuotation) return renderModuleDisabled('Quotation');
        if (!canCreateQuotations) return renderAccessDenied('Quotation');
        return <AddQuotation onNavigate={setCurrentPage} />;
      case 'returns':
        if (!canAccessSellReturns) return renderAccessDenied('Sell Returns');
        return <ListReturns onNavigate={setCurrentPage} />;
      case 'add-sell-return':
        if (!canAccessSellReturns) return renderAccessDenied('Sell Returns');
        return <AddSellReturn onNavigate={setCurrentPage} />;
      case 'shipments':
        if (!settings.enableShipments) return renderModuleDisabled('Shipments');
        if (!canAccessShipments) return renderAccessDenied('Shipments');
        return <Shipments onNavigate={setCurrentPage} />;
      case 'discounts':
        if (!settings.enableDiscounts) return renderModuleDisabled('Discounts');
        if (!canManageDiscounts) return renderAccessDenied('Discounts');
        return <Discounts onNavigate={setCurrentPage} />;
      case 'import-sales':
        if (!settings.enableImportSales) return renderModuleDisabled('Import Sales');
        if (!canImportSales) return renderAccessDenied('Import Sales');
        return <ImportSales onNavigate={setCurrentPage} />;
      case 'list-stock-transfers':
        if (!settings.enableStockTransfers) return renderModuleDisabled('Stock Transfers');
        if (!canViewStockTransfers) return renderAccessDenied('Stock Transfers');
        return <ListStockTransfers onNavigate={setCurrentPage} canManage={canManageStockTransfers} />;
      case 'add-stock-transfer':
        if (!settings.enableStockTransfers) return renderModuleDisabled('Stock Transfers');
        if (!canManageStockTransfers) return renderAccessDenied('Stock Transfers');
        return <AddStockTransfer onNavigate={setCurrentPage} />;
      case 'list-stock-adjustments':
        if (!settings.enableStockAdjustments) return renderModuleDisabled('Stock Adjustments');
        if (!canViewStockAdjustments) return renderAccessDenied('Stock Adjustments');
        return (
          <ListStockAdjustments
            onNavigate={setCurrentPage}
            canAdd={canAddStockAdjustments}
            canEdit={canEditStockAdjustments}
            canDelete={canDeleteStockAdjustments}
            restrictToAddedById={stockAdjustmentOwnerScopeId}
            restrictToAddedByName={stockAdjustmentOwnerScopeName}
          />
        );
      case 'add-stock-adjustment':
        if (!settings.enableStockAdjustments) return renderModuleDisabled('Stock Adjustments');
        if (!canAddStockAdjustments) return renderAccessDenied('Stock Adjustments');
        return (
          <AddStockAdjustment
            onNavigate={setCurrentPage}
            canAdd={canAddStockAdjustments}
            canEdit={canEditStockAdjustments}
            restrictToAddedById={stockAdjustmentOwnerScopeId}
            restrictToAddedByName={stockAdjustmentOwnerScopeName}
          />
        );
      case 'list-orders':
      case 'orders':
        if (!settings.enableSalesOrder) return renderModuleDisabled('Orders');
        if (!canAccessOrders) return renderAccessDenied('Orders');
        return (
          <Orders
            onNavigate={setCurrentPage}
            onSelectOrder={setSelectedOrderId}
            canAdd={canAddOrders}
            canEdit={canEditOrders}
            canDelete={canDeleteOrders}
            canGenerateInvoice={canGenerateInvoiceFromOrders}
            canApprove={canApproveOrders}
          />
        );
      case 'add-order':
        if (!settings.enableSalesOrder) return renderModuleDisabled('Orders');
        if (!canAddOrders) return renderAccessDenied('Orders');
        return <AddOrder onNavigate={setCurrentPage} />;
      case 'edit-order':
        if (!settings.enableSalesOrder) return renderModuleDisabled('Orders');
        if (!canEditOrders) return renderAccessDenied('Orders');
        if (!selectedOrderId) return renderAccessDenied('Orders');
        return <AddOrder isEdit={true} orderId={selectedOrderId} onNavigate={setCurrentPage} />;
      case 'view-order':
        if (!settings.enableSalesOrder) return renderModuleDisabled('Orders');
        if (!(canViewOrders || canEditOrders || canDeleteOrders)) return renderAccessDenied('Orders');
        if (!selectedOrderId) return renderAccessDenied('Orders');
        return <ViewOrder onClose={() => setCurrentPage('list-orders')} orderId={selectedOrderId} />;
      case 'convert-order-to-invoice':
        if (!settings.enableSalesOrder) return renderModuleDisabled('Orders');
        if (!canGenerateInvoiceFromOrders) return renderAccessDenied('Orders');
        if (!selectedOrderId) return renderAccessDenied('Orders');
        return <AddSale fromOrder={true} sourceOrderId={selectedOrderId} onNavigate={setCurrentPage} />;
      case 'new-payment':
        if (!canAddSellPayments) return renderAccessDenied('Payments');
        return <NewPayment onNavigate={setCurrentPage} />;
      case 'list-payments':
        if (!canViewSellPayments) return renderAccessDenied('Payments');
        return <ListPayments onNavigate={handleNavigate} onContactSelect={handleContactSelect} />;
      case 'field-payments':
        if (!settings.enableFieldPayments) return renderModuleDisabled('Field Payments');
        if (!canViewFieldPayments) return renderAccessDenied('Field Payments');
        return <FieldPayments onNavigate={setCurrentPage} />;
      case 'list-accounts':
        if (!settings.enablePaymentAccounts) return renderModuleDisabled('Payment Accounts');
        if (!canAccessAccounts) return renderAccessDenied('Payment Accounts');
        return (
          <ListAccounts
            onNavigate={setCurrentPage}
            canEditAccountTransactions={canEditAccountTransactions}
            canDeleteAccountTransactions={canDeleteAccountTransactions}
          />
        );
      case 'balance-sheet':
        if (!settings.enablePaymentAccounts) return renderModuleDisabled('Payment Accounts');
        if (!canAccessAccounts) return renderAccessDenied('Payment Accounts');
        return <BalanceSheet />;
      case 'trial-balance':
        if (!settings.enablePaymentAccounts) return renderModuleDisabled('Payment Accounts');
        if (!canAccessAccounts) return renderAccessDenied('Payment Accounts');
        return <TrialBalance />;
      case 'cash-flow':
        if (!settings.enablePaymentAccounts) return renderModuleDisabled('Payment Accounts');
        if (!canAccessAccounts) return renderAccessDenied('Payment Accounts');
        return <CashFlow />;
      case 'payment-account-report':
        if (!settings.enablePaymentAccounts) return renderModuleDisabled('Payment Accounts');
        if (!canAccessAccounts) return renderAccessDenied('Payment Accounts');
        return <PaymentAccountReport />;
      case 'vat-bills':
        if (!canViewTaxReport) return renderAccessDenied('VAT Bills');
        return <VatBills />;
      case 'tax-rates':
        if (!canViewTaxRates) return renderAccessDenied('Tax Rates');
        return <TaxRates />;
      case 'suppliers': return <Suppliers onNavigate={setCurrentPage} />;
      case 'customers': return <Customers onNavigate={setCurrentPage} />;
      case 'customer-groups': return <CustomerGroups />;
      case 'selling-price-groups': return <SellingPriceGroups />;
      case 'import-contacts': return <ImportContacts />;
      case 'expenses':
        if (!settings.enableExpenses) return renderModuleDisabled('Expenses');
        if (!canViewExpenses) return renderAccessDenied('Expenses');
        return (
          <ListExpenses
            onNavigate={setCurrentPage}
            canAdd={canAddExpenses}
            canEdit={canEditExpenses}
            canDelete={canDeleteExpenses}
            restrictToAddedById={expenseOwnerScopeId}
            restrictToAddedByName={expenseOwnerScopeName}
          />
        );
      case 'add-expense':
        if (!settings.enableExpenses) return renderModuleDisabled('Expenses');
        if (!canAddExpenses) return renderAccessDenied('Expenses');
        return (
          <AddExpense
            onNavigate={setCurrentPage}
            canAdd={canAddExpenses}
            canEdit={canEditExpenses}
            restrictToAddedById={expenseOwnerScopeId}
            restrictToAddedByName={expenseOwnerScopeName}
          />
        );
      case 'edit-expense':
        if (!settings.enableExpenses) return renderModuleDisabled('Expenses');
        if (!canEditExpenses) return renderAccessDenied('Expenses');
        return renderAccessDenied('Expenses');
      case 'expense-categories':
        if (!settings.enableExpenses) return renderModuleDisabled('Expenses');
        if (!canAddExpenses && !canEditExpenses && !canDeleteExpenses) return renderAccessDenied('Expense Categories');
        return <ExpenseCategories canAdd={canAddExpenses} canEdit={canEditExpenses} canDelete={canDeleteExpenses} />;
      case 'report-profit-loss':
        if (!canViewProfitLossReport) return renderAccessDenied('Profit / Loss Report');
        return <ReportProfitLoss />;
      case 'report-purchase-sale':
        if (!canViewPurchaseSaleReport) return renderAccessDenied('Purchase & Sale Report');
        return <ReportPurchaseSale />;
      case 'report-tax':
        if (!canViewTaxReport) return renderAccessDenied('Tax Report');
        return <ReportTax />;
      case 'report-supplier-customer':
        if (!canViewSupplierCustomerReport) return renderAccessDenied('Supplier & Customer Report');
        return <ReportSupplierCustomer />;
      case 'report-customer-groups':
        if (!settings.enableCustomerGroupsReport) return renderModuleDisabled('Customer Groups Report');
        if (!canViewCustomerGroupsReport) return renderAccessDenied('Customer Groups Report');
        return <ReportCustomerGroups />;
      case 'report-stock':
        if (!settings.enableStockReport) return renderModuleDisabled('Stock Report');
        if (!canViewStockReports) return renderAccessDenied('Stock Report');
        return <ReportStock canViewValueMetrics={canViewProductStockValue} />;
      case 'report-stock-expiry':
        if (!settings.enableProductExpiry) return renderModuleDisabled('Stock Expiry Report');
        if (!canViewStockReports) return renderAccessDenied('Stock Expiry Report');
        return <ReportStockExpiry />;
      case 'report-lot':
        if (!(settings.enableLotNumber || settings.enableLotNumbers)) return renderModuleDisabled('Lot Report');
        if (!canViewStockReports) return renderAccessDenied('Lot Report');
        return <ReportLot />;
      case 'report-stock-adjustment':
        if (!settings.enableStockAdjustments) return renderModuleDisabled('Stock Adjustments');
        if (!canViewStockReports) return renderAccessDenied('Stock Adjustment Report');
        return (
          <ReportStockAdjustment
            restrictToAddedById={stockAdjustmentOwnerScopeId}
            restrictToAddedByName={stockAdjustmentOwnerScopeName}
          />
        );
      case 'report-trending-products':
        if (!settings.enableTrendingProductsReport) return renderModuleDisabled('Trending Products Report');
        if (!canViewTrendingProductReport) return renderAccessDenied('Trending Products Report');
        return <ReportTrendingProducts />;
      case 'report-items':
        if (!settings.enableItemsReport) return renderModuleDisabled('Items Report');
        if (!canViewPurchaseSaleReport) return renderAccessDenied('Items Report');
        return <ReportItems />;
      case 'report-product-purchase':
        if (!settings.enableProductPurchaseReport) return renderModuleDisabled('Product Purchase Report');
        if (!canViewPurchaseSaleReport) return renderAccessDenied('Product Purchase Report');
        return <ReportProductPurchase />;
      case 'report-product-sell':
        if (!settings.enableProductSellReport) return renderModuleDisabled('Product Sell Report');
        if (!canViewPurchaseSaleReport) return renderAccessDenied('Product Sell Report');
        return <ReportProductSell />;
      case 'report-purchase-payment':
        if (!settings.enablePurchases) return renderModuleDisabled('Purchases');
        if (!settings.enablePurchasePaymentReport) return renderModuleDisabled('Purchase Payment Report');
        if (!canViewPurchaseSaleReport) return renderAccessDenied('Purchase Payment Report');
        return <ReportPurchasePayment />;
      case 'report-sell-payment':
        if (!settings.enableSellPaymentReport) return renderModuleDisabled('Sell Payment Report');
        if (!canViewPurchaseSaleReport) return renderAccessDenied('Sell Payment Report');
        return <ReportSellPayment />;
      case 'report-expense':
        if (!settings.enableExpenses) return renderModuleDisabled('Expenses');
        if (!canViewExpenseReports) return renderAccessDenied('Expense Report');
        return <ReportExpense />;
      case 'report-register':
        if (!settings.enablePOS) return renderModuleDisabled('POS');
        if (!canViewRegisterReport) return renderAccessDenied('Register Report');
        return <ReportRegister />;
      case 'report-sales-rep':
        if (!canViewSalesRepresentativeReport) return renderAccessDenied('Sales Representative Report');
        return <ReportSalesRep />;
      case 'activity-log':
        if (!settings.enableActivityLog) return renderModuleDisabled('Activity Log');
        if (!canViewActivityLog) return renderAccessDenied('Activity Log');
        return <ActivityLog />;
      case 'settings':
        if (!canAccessBusinessSettings) return renderAccessDenied('Business Settings');
        return <Settings />;
      case 'backup-restore':
        if (!canAccessBusinessSettings) return renderAccessDenied('Backup & Restore');
        return <BackupRestore />;
      case 'locations':
        if (!canAccessBusinessSettings) return renderAccessDenied('Business Locations');
        return <Locations />;
      case 'invoice-settings':
        if (!canAccessInvoiceSettings) return renderAccessDenied('Invoice Settings');
        return <InvoiceSettings />;
      case 'barcode-settings':
        if (!canAccessBarcodeSettings) return renderAccessDenied('Barcode Settings');
        return <BarcodeSettings />;
      case 'printers':
        if (!canAccessPrinters) return renderAccessDenied('Receipt Printers');
        return <Printers />;
      case 'help-center':
        if (!canAccessHelpCenter) return renderAccessDenied('Help Center');
        return <HelpCenter onNavigate={setCurrentPage} />;
      case 'public-view-invoice':
        return (
          <ViewSaleDetails
            isOpen={true}
            pageMode={true}
            saleId={publicInvoiceId || undefined}
            onClose={handleClosePublicInvoice}
          />
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-96 text-slate-400">
            <h2 className="text-2xl font-bold text-slate-300 mb-2">Work in Progress</h2>
            <p>The "{currentPage.replace('-', ' ')}" page is under construction.</p>
          </div>
        );
    }
  };

  if (currentPage === 'public-view-invoice') {
     return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 print:p-0 print:bg-white">
           {renderPage()}
        </div>
     );
  }

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="flex bg-slate-50 min-h-screen font-sans text-slate-900">
      <Sidebar 
        currentPage={currentPage} 
        onNavigate={setCurrentPage}
        onLogout={() => {
          try { localStorage.removeItem('atwar_auth_token'); } catch {}
          setCurrentUser(null);
          setIsAuthenticated(false);
        }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isSidebarOpen}
        onMobileClose={() => setIsSidebarOpen(false)}
      />
      
      <div className={`flex-1 ml-0 ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-72'} p-3 sm:p-4 md:p-8 overflow-y-auto min-h-screen md:h-screen transition-all duration-300 print:ml-0 print:p-0`}>
        <header className="flex justify-between items-center mb-6 md:mb-8 print:hidden">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search module or page..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleGlobalSearch();
                  }
                }}
                className="pl-10 pr-4 py-2 rounded-full bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 w-40 md:w-64 shadow-sm"
              />
            {searchMatches.length > 0 && globalSearch.trim().length > 0 && (
              <div className="absolute left-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-40">
                {searchMatches.map((match) => (
                  <button
                    key={`${match.page}-${match.label}`}
                    type="button"
                    onClick={() => {
                      setCurrentPage(match.page);
                      setGlobalSearch('');
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                  >
                    <div className="font-bold text-slate-700">{match.label}</div>
                    <div className="text-[11px] text-slate-400">{match.page}</div>
                  </button>
                ))}
              </div>
            )}
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden md:flex items-center gap-2">
              <div className="relative" ref={calculatorRef}>
                <button
                  onClick={() => {
                    setShowCalculator((prev) => !prev);
                    setShowCalendar(false);
                  }}
                  className={`p-2 rounded-full transition shadow-sm ${showCalculator ? 'bg-blue-50 text-blue-600' : 'bg-white text-slate-600 hover:text-blue-600 hover:bg-blue-50'}`}
                  title="Calculator"
                >
                  <Calculator size={18} />
                </button>
                {showCalculator && (
                  <div className="absolute right-0 mt-3 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-100 z-[1000] overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70">
                      <h4 className="text-sm font-bold text-slate-900">Calculator</h4>
                    </div>
                    <div className="p-4 space-y-3">
                      <input
                        type="text"
                        value={calculatorExpression}
                        onChange={(e) => setCalculatorExpression(e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <div className="h-6 text-right text-xs font-bold text-blue-700">{calculatorResult}</div>
                      <div className="grid grid-cols-4 gap-2">
                        {['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '%', '+'].map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setCalculatorExpression((prev) => `${prev}${key}`)}
                            className="h-9 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
                          >
                            {key}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCalculatorExpression('');
                            setCalculatorResult('');
                          }}
                          className="h-9 rounded-lg border border-rose-200 text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalculatorExpression((prev) => prev.slice(0, -1))}
                          className="h-9 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={evaluateCalculatorExpression}
                          className="h-9 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
                        >
                          =
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative" ref={calendarRef}>
                <button
                  onClick={() => {
                    setShowCalendar((prev) => !prev);
                    setShowCalculator(false);
                  }}
                  className={`p-2 rounded-full transition shadow-sm ${showCalendar ? 'bg-blue-50 text-blue-600' : 'bg-white text-slate-600 hover:text-blue-600 hover:bg-blue-50'}`}
                  title="Calendar"
                >
                  <CalendarDays size={18} />
                </button>
                {showCalendar && (
                  <div className="absolute right-0 mt-3 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-100 z-[1000] overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70">
                      <h4 className="text-sm font-bold text-slate-900">Calendar</h4>
                    </div>
                    <div className="p-4 space-y-3">
                      <input
                        type="date"
                        value={calendarDate}
                        onChange={(e) => setCalendarDate(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <div className="text-xs text-slate-500">
                        Selected: <span className="font-bold text-slate-700">{calendarDate || '--'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCalendarDate(new Date().toISOString().slice(0, 10))}
                        className="w-full h-9 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                      >
                        Today
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => settings.enablePOS && setCurrentPage('pos')}
                disabled={!settings.enablePOS}
                className={`p-2 rounded-full transition shadow-sm ${settings.enablePOS ? 'bg-white text-slate-600 hover:text-blue-600 hover:bg-blue-50' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                title={settings.enablePOS ? 'POS' : 'POS is disabled'}
              >
                <ShoppingCart size={18} />
              </button>

              <button
                onClick={() => canAccessHelpCenter && setCurrentPage('help-center')}
                disabled={!canAccessHelpCenter}
                className={`p-2 rounded-full transition shadow-sm ${canAccessHelpCenter ? 'bg-white text-slate-600 hover:text-blue-600 hover:bg-blue-50' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                title={canAccessHelpCenter ? 'Application Guide' : 'Help Center access denied'}
              >
                <BookOpen size={18} />
              </button>
            </div>

            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2 rounded-full transition shadow-sm relative ${showNotifications ? 'bg-red-50 text-red-600' : 'bg-white text-slate-600 hover:text-red-600 hover:bg-red-50'}`}
              >
                <Bell size={20} />
                {actionCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-500 rounded-full border-2 border-white text-white text-[8px] font-bold flex items-center justify-center">
                    {actionCount > 9 ? '9+' : actionCount}
                  </span>
                )}
                {actionCount === 0 && unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-100 z-[1000] overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold text-slate-900">Notifications</h3>
                    <button 
                      onClick={markAllAsRead}
                      className="text-xs font-bold text-red-600 hover:text-red-700 transition-colors"
                    >
                      Mark all as read
                    </button>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length > 0 ? (
                      <div className="divide-y divide-slate-50">
                        {notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer relative group ${!n.read ? (n.actionRequired ? 'bg-amber-50/40' : 'bg-blue-50/30') : ''}`}
                            onClick={() => {
                              markAsRead(n.id);
                              if (n.navigateTo) {
                                setCurrentPage(n.navigateTo);
                                setShowNotifications(false);
                              }
                            }}
                          >
                            <div className="flex gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                n.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                                n.type === 'error' ? 'bg-rose-100 text-rose-600' :
                                n.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                                'bg-blue-100 text-blue-600'
                              }`}>
                                {n.type === 'success' ? <Check size={14} /> : <Clock size={14} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className={`text-sm ${!n.read ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{n.title}</p>
                                  {n.actionRequired && (
                                    <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0">Action</span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
                                    {formatTimeBySettings(n.timestamp, settings.timeFormat, settings.timeZone)}
                                  </p>
                                  {n.triggeredBy && (
                                    <p className="text-[10px] text-slate-400">by {n.triggeredBy}</p>
                                  )}
                                </div>
                              </div>
                              {!n.read && (
                                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.actionRequired ? 'bg-amber-500' : 'bg-red-500'}`}></div>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeNotification(n.id);
                              }}
                              className="absolute top-2 right-2 p-1 text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                          <Bell size={24} />
                        </div>
                        <p className="text-sm text-slate-500 font-medium">No notifications yet</p>
                      </div>
                    )}
                  </div>
                  <div className="p-3 border-t border-slate-100 bg-slate-50/50 text-center">
                    <button
                      onClick={() => { setCurrentPage('activity-log'); setShowNotifications(false); }}
                      className="text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      View all activity
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main>
          {renderPage()}
        </main>

        <footer className="mt-10 pt-4 border-t border-slate-200 text-center print:hidden">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} ATWAR AL MUSTAQBAL. All rights reserved.
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Designed by{' '}
            <a
              href="https://emmanuelessiet.com.ng"
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-500 hover:text-red-600 hover:underline transition-colors"
            >
              emmaessiet
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
};

export default App;
