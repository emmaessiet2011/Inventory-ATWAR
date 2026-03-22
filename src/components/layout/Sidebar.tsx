import React, { useState } from 'react';
import {
  LayoutDashboard, Users, Package, ShoppingCart,
  CreditCard, Truck, RefreshCw, Settings,
  ChevronDown, ChevronRight, LogOut, Tags,
  BarChart3, UserCircle, LifeBuoy,
  Banknote, ShieldCheck, Sliders, Wallet,
  Menu, X, Cloud, CloudOff, Loader2
} from 'lucide-react';
import { useGlobalContext } from '@/context/GlobalContext';
import { isCoreSyncEnabled } from '@/utils/coreStateSync';
import { getEditStockTransferIdKey } from '@/utils/stockTransfers';
import { getEditStockAdjustmentIdKey } from '@/utils/stockAdjustments';
import { getEditExpenseIdKey } from '@/utils/expenses';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentPage, 
  onNavigate, 
  onLogout,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onMobileClose
}) => {
  const { settings, currentUser, roles, syncStatus } = useGlobalContext();
  const dbSyncEnabled = isCoreSyncEnabled();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  const currentRoleRecord = roles.find(r => r.name === currentUser?.role);
  const rolePermissions = currentRoleRecord?.permissions || [];
  const roleHasExplicitPermissions = rolePermissions.length > 0;
  const hasRolePermission = (moduleName: string, permission: string) => {
    if (!currentUser) return false;
    if (String(currentUser.role || '').toLowerCase() === 'admin' || currentRoleRecord?.isSystem) return true;
    if (!roleHasExplicitPermissions) return true; // backward compatibility for older role data
    return (
      rolePermissions.includes(permission) ||
      rolePermissions.includes(`${moduleName}::${permission}`)
    );
  };
  const canAccessHelpCenter = hasRolePermission('Support', 'Access help center');

  const toggleMenu = (title: string) => {
    setExpandedMenus(prev => 
      prev.includes(title) 
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  };

  const handleNavigate = (path: string) => {
    if (path === 'add-stock-transfer') {
      localStorage.removeItem(getEditStockTransferIdKey());
    }
    if (path === 'add-stock-adjustment') {
      localStorage.removeItem(getEditStockAdjustmentIdKey());
    }
    if (path === 'add-expense') {
      localStorage.removeItem(getEditExpenseIdKey());
    }
    onNavigate(path);
    onMobileClose(); // Close sidebar on mobile when navigating
  };

  const handleOpenProfile = () => {
    const currentUserId = String(currentUser?.id || '').trim();
    handleNavigate(currentUserId ? `view-user/${currentUserId}` : 'users');
  };

  const allMenuItems = [
    { title: 'Dashboard', icon: LayoutDashboard, path: 'dashboard' },
    { 
      title: 'User Management', 
      icon: ShieldCheck, 
      subItems: [
        { title: 'Users', path: 'users' },
        { title: 'Add User', path: 'add-user' },
        { title: 'Roles', path: 'roles' },
        { title: 'Sales Commission Agents', path: 'sales-commission-agents' }
      ]
    },
    { 
      title: 'Contacts', 
      icon: Users, 
      subItems: [
        { title: 'Suppliers', path: 'suppliers' },
        { title: 'Customers', path: 'customers' },
        { title: 'Customer Groups', path: 'customer-groups' },
        { title: 'Import Contacts', path: 'import-contacts' }
      ]
    },
    { 
      title: 'Products', 
      icon: Package, 
      subItems: [
        { title: 'List Products', path: 'products' },
        { title: 'Add New Product', path: 'add-product' },
        { title: 'Product View', path: 'product-view' },
        { title: 'Update Price', path: 'update-price' },
        { title: 'Print Labels', path: 'print-labels' },
        { title: 'Variations', path: 'variations' },
        { title: 'Import Products', path: 'import-products' },
        { title: 'Import Opening Stock', path: 'import-opening-stock' },
        { title: 'Units', path: 'units' },
        { title: 'Selling Price Groups', path: 'selling-price-groups' },
        { title: 'Categories', path: 'categories' },
        { title: 'Brands', path: 'brands' },
        { title: 'Warranties', path: 'warranties' }
      ]
    },
    {
      title: 'Purchases',
      icon: ShoppingCart,
      subItems: [
        { title: 'Purchase Requisition', path: 'purchase-requisition' },
        { title: 'Purchase Order', path: 'purchase-order' },
        { title: 'List Purchases', path: 'purchases' },
        { title: 'Add Purchase', path: 'add-purchase' },
        { title: 'List Purchase Return', path: 'purchase-return' }
      ]
    },
    {
      title: 'Sell',
      icon: Tags,
      subItems: [
        { title: 'All Sales', path: 'sales' },
        { title: 'Add Sale', path: 'add-sale' },
        { title: 'List POS', path: 'list-pos' },
        { title: 'POS', path: 'open-register' },
        { title: 'Add Draft', path: 'add-draft' },
        { title: 'List Drafts', path: 'drafts' },
        { title: 'Add Quotation', path: 'add-quotation' },
        { title: 'List Quotations', path: 'quotations' },
        { title: 'List Returns', path: 'returns' },
        { title: 'Shipments', path: 'shipments' },
        { title: 'Discounts', path: 'discounts' },
        { title: 'Import Sales', path: 'import-sales' }
      ]
    },
    {
      title: 'Stock',
      icon: RefreshCw,
      subItems: [
        { title: 'List Stock Transfers', path: 'list-stock-transfers' },
        { title: 'Add Stock Transfer', path: 'add-stock-transfer' }
      ]
    },
    {
      title: 'Stock Adjustment',
      icon: Sliders,
      subItems: [
        { title: 'List Stock Adjustments', path: 'list-stock-adjustments' },
        { title: 'Add Stock Adjustment', path: 'add-stock-adjustment' }
      ]
    },
    {
      title: 'Expenses',
      icon: CreditCard,
      subItems: [
        { title: 'List Expenses', path: 'expenses' },
        { title: 'Add Expense', path: 'add-expense' },
        { title: 'Categories', path: 'expense-categories' }
      ]
    },
    {
      title: 'Orders',
      icon: Truck,
      subItems: [
        { title: 'List Orders', path: 'list-orders' },
        { title: 'Add Order', path: 'add-order' }
      ]
    },
    {
      title: 'Payments',
      icon: Banknote,
      subItems: [
        { title: 'List Payments', path: 'list-payments' },
        { title: 'New Payment', path: 'new-payment' },
        { title: 'Field Payments', path: 'field-payments' }
      ]
    },
    {
      title: 'Payment Accounts',
      icon: Wallet,
      subItems: [
        { title: 'List Accounts', path: 'list-accounts' },
        { title: 'Balance Sheet', path: 'balance-sheet' },
        { title: 'Trial Balance', path: 'trial-balance' },
        { title: 'Cash Flow', path: 'cash-flow' },
        { title: 'Payment Account Report', path: 'payment-account-report' }
      ]
    },
    {
      title: 'Reports',
      icon: BarChart3,
      subItems: [
        { title: 'Profit / Loss Report', path: 'report-profit-loss' },
        { title: 'Purchase & Sale', path: 'report-purchase-sale' },
        { title: 'Tax Report', path: 'report-tax' },
        { title: 'Supplier & Customer Report', path: 'report-supplier-customer' },
        { title: 'Customer Groups Report', path: 'report-customer-groups' },
        { title: 'Stock Report', path: 'report-stock' },
        { title: 'Stock Expiry Report', path: 'report-stock-expiry' },
        { title: 'Lot Report', path: 'report-lot' },
        { title: 'Stock Adjustment Report', path: 'report-stock-adjustment' },
        { title: 'Trending Products', path: 'report-trending-products' },
        { title: 'Items Report', path: 'report-items' },
        { title: 'Product Purchase Report', path: 'report-product-purchase' },
        { title: 'Product Sell Report', path: 'report-product-sell' },
        { title: 'Purchase Payment Report', path: 'report-purchase-payment' },
        { title: 'Sell Payment Report', path: 'report-sell-payment' },
        { title: 'Expense Report', path: 'report-expense' },
        { title: 'Register Report', path: 'report-register' },
        { title: 'Sales Representative Report', path: 'report-sales-rep' },
        { title: 'Activity Log', path: 'activity-log' }
      ]
    },
    {
      title: 'Settings',
      icon: Settings,
      subItems: [
        { title: 'Business Settings', path: 'settings' },
        { title: 'Business Locations', path: 'locations' },
        { title: 'Backup & Restore', path: 'backup-restore' },
        { title: 'Invoice Settings', path: 'invoice-settings' },
        { title: 'Barcode Settings', path: 'barcode-settings' },
        { title: 'Receipt Printers', path: 'printers' },
        { title: 'Tax Rates', path: 'tax-rates' }
      ]
    }
  ];

  const menuItems = allMenuItems
    .map(item => {
      if (!item.subItems) return item;

      let subItems = item.subItems;

      if (item.title === 'User Management' && !settings.enableCommissionAgents) {
        subItems = subItems.filter(s => s.path !== 'sales-commission-agents');
      }

      if (item.title === 'User Management') {
        subItems = subItems.filter(s => {
          if (s.path === 'users') return hasRolePermission('User', 'View user');
          if (s.path === 'add-user') return hasRolePermission('User', 'Add user');
          if (s.path === 'roles') return hasRolePermission('Roles', 'View role');
          return true;
        });
      }

      if (item.title === 'Sell' && !settings.enablePOS) {
        subItems = subItems.filter(s => s.path !== 'open-register' && s.path !== 'list-pos');
      }
      if (item.title === 'Sell' && !settings.enableShipments) {
        subItems = subItems.filter(s => s.path !== 'shipments');
      }
      if (item.title === 'Sell' && !settings.enableDiscounts) {
        subItems = subItems.filter(s => s.path !== 'discounts');
      }
      if (item.title === 'Sell' && !settings.enableImportSales) {
        subItems = subItems.filter(s => s.path !== 'import-sales');
      }

      if (item.title === 'Sell') {
        const canViewSales =
          hasRolePermission('Sell', 'View all sell') ||
          hasRolePermission('Sell', 'View own sell only') ||
          hasRolePermission('Sell', 'View paid sells only') ||
          hasRolePermission('Sell', 'View due sells only') ||
          hasRolePermission('Sell', 'View partially paid sells only') ||
          hasRolePermission('Sell', 'View overdue sells only');
        const canAddSell = hasRolePermission('Sell', 'Add Sell');
        const canAccessSellReturns =
          hasRolePermission('Sell', 'Access all sell return') ||
          hasRolePermission('Sell', 'Access own sell return');
        const canViewDrafts =
          hasRolePermission('Draft', 'View all drafts') ||
          hasRolePermission('Draft', 'View own drafts');
        const canEditDraft = hasRolePermission('Draft', 'Edit draft');
        const canViewQuotations =
          hasRolePermission('Quotation', 'View all quotations') ||
          hasRolePermission('Quotation', 'View own quotations');
        const canEditQuotation = hasRolePermission('Quotation', 'Edit quotation');
        const canAccessShipments =
          hasRolePermission('Shipments', 'Access all shipments') ||
          hasRolePermission('Shipments', 'Access own shipments') ||
          hasRolePermission('Shipments', 'Access pending shipments only') ||
          hasRolePermission('Shipments', 'Commission agent can access their own shipments');
        const canManageDiscounts = hasRolePermission('Sell', 'Add/Edit/Delete Discount');
        const canImportSales =
          hasRolePermission('Sell', 'Import Sales') ||
          hasRolePermission('Sell', 'Add Sell');

        subItems = subItems.filter(s => {
          if (s.path === 'sales') return canViewSales;
          if (s.path === 'add-sale') return canAddSell;
          if (s.path === 'drafts') return canViewDrafts;
          if (s.path === 'add-draft') return canEditDraft || canAddSell;
          if (s.path === 'quotations') return canViewQuotations;
          if (s.path === 'add-quotation') return canEditQuotation || canAddSell;
          if (s.path === 'returns') return canAccessSellReturns;
          if (s.path === 'shipments') return canAccessShipments;
          if (s.path === 'discounts') return canManageDiscounts;
          if (s.path === 'import-sales') return canImportSales;
          return true;
        });
      }

      if (item.title === 'Sell' && settings.disableDraft) {
        subItems = subItems.filter(s => s.path !== 'add-draft' && s.path !== 'drafts');
      }

      if (item.title === 'Sell' && settings.disableQuotation) {
        subItems = subItems.filter(s => s.path !== 'add-quotation' && s.path !== 'quotations');
      }

      if (item.title === 'Stock' || item.title === 'Stock Adjustment') {
        const canViewLegacyStockOperations =
          hasRolePermission('Purchase & Stock Adjustment', 'View all Purchase & Stock Adjustment') ||
          hasRolePermission('Purchase & Stock Adjustment', 'View own Purchase & Stock Adjustment');
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
        const canAddStockAdjustments =
          hasRolePermission('Stock Adjustment', 'Add stock adjustment') ||
          canManageLegacyStockOperations;
        subItems = subItems.filter((s) => {
          if (s.path === 'list-stock-transfers') return canViewStockTransfers;
          if (s.path === 'add-stock-transfer') return canManageStockTransfers;
          if (s.path === 'list-stock-adjustments') return canViewStockAdjustments;
          if (s.path === 'add-stock-adjustment') return canAddStockAdjustments;
          return true;
        });
      }

      if (item.title === 'Expenses') {
        const canViewExpenses =
          hasRolePermission('Expense', 'Access all expenses') ||
          hasRolePermission('Expense', 'View own expense only') ||
          hasRolePermission('Expense', 'Add Expense') ||
          hasRolePermission('Expense', 'Edit Expense') ||
          hasRolePermission('Expense', 'Delete Expense');
        const canAddExpenses = hasRolePermission('Expense', 'Add Expense');
        const canManageExpenseCategories =
          hasRolePermission('Expense', 'Add Expense') ||
          hasRolePermission('Expense', 'Edit Expense');

        subItems = subItems.filter((s) => {
          if (s.path === 'expenses') return canViewExpenses;
          if (s.path === 'add-expense') return canAddExpenses;
          if (s.path === 'expense-categories') return canManageExpenseCategories;
          return true;
        });
      }

      if (item.title === 'Orders') {
        const canViewOrders =
          hasRolePermission('Order', 'View order') ||
          hasRolePermission('Order', 'Edit order') ||
          hasRolePermission('Order', 'Delete order');
        const canAddOrders = hasRolePermission('Order', 'Add order');

        subItems = subItems.filter((s) => {
          if (s.path === 'list-orders') return canViewOrders;
          if (s.path === 'add-order') return canAddOrders;
          return true;
        });
      }

      if (item.title === 'Payments') {
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

        subItems = subItems.filter((s) => {
          if (s.path === 'list-payments') return canViewSellPayments;
          if (s.path === 'new-payment') return canAddSellPayments;
          if (s.path === 'field-payments') return settings.enableFieldPayments && canViewFieldPayments;
          return true;
        });
      }

      if (item.title === 'Payment Accounts') {
        const canAccessAccounts = hasRolePermission('Account', 'Access Accounts');
        if (!settings.enablePaymentAccounts || !canAccessAccounts) {
          subItems = [];
        }
      }

      if (item.title === 'Settings') {
        const canAccessBusinessSettings = hasRolePermission('Settings', 'Access business settings');
        const canAccessInvoiceSettings = hasRolePermission('Settings', 'Access invoice settings');
        const canAccessBarcodeSettings = hasRolePermission('Settings', 'Access barcode settings');
        const canAccessPrinters = hasRolePermission('Settings', 'Access printers');
        const canViewTaxRates = hasRolePermission('Tax rate', 'View tax rate');
        subItems = subItems.filter((s) => {
          if (s.path === 'settings' || s.path === 'locations' || s.path === 'backup-restore') return canAccessBusinessSettings;
          if (s.path === 'invoice-settings') return canAccessInvoiceSettings;
          if (s.path === 'barcode-settings') return canAccessBarcodeSettings;
          if (s.path === 'printers') return canAccessPrinters;
          if (s.path === 'tax-rates') return canViewTaxRates;
          return true;
        });
      }

      if (item.title === 'Products') {
        if (!settings.enableCategories) {
          subItems = subItems.filter(s => s.path !== 'categories');
        }
        if (!settings.enableBrands) {
          subItems = subItems.filter(s => s.path !== 'brands');
        }
      }

      if (item.title === 'Purchases') {
        if (!settings.enablePurchaseRequisition) {
          subItems = subItems.filter(s => s.path !== 'purchase-requisition');
        }
        if (!settings.enablePurchaseOrder) {
          subItems = subItems.filter(s => s.path !== 'purchase-order');
        }
      }

      if (item.title === 'Reports') {
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
        const canViewTrendingProductReport = hasRolePermission('Report', 'View trending product report');
        const canViewRegisterReport = hasRolePermission('Report', 'View register report');
        const canViewSalesRepresentativeReport = hasRolePermission('Report', 'View sales representative report');
        const canViewActivityLog = hasRolePermission('Report', 'View activity log');
        subItems = subItems.filter((s) => {
          if (s.path === 'report-purchase-sale') {
            return canViewPurchaseSaleReport;
          }
          if (s.path === 'report-items') {
            return settings.enableItemsReport && canViewPurchaseSaleReport;
          }
          if (s.path === 'report-product-purchase') {
            return settings.enableProductPurchaseReport && canViewPurchaseSaleReport;
          }
          if (s.path === 'report-product-sell') {
            return canViewPurchaseSaleReport;
          }
          if (s.path === 'report-purchase-payment') {
            return settings.enablePurchases && settings.enablePurchasePaymentReport && canViewPurchaseSaleReport;
          }
          if (s.path === 'report-sell-payment') {
            return settings.enableSellPaymentReport && canViewPurchaseSaleReport;
          }
          if (s.path === 'report-tax') {
            return canViewTaxReport;
          }
          if (s.path === 'report-profit-loss') {
            return canViewProfitLossReport;
          }
          if (s.path === 'report-supplier-customer') {
            return canViewSupplierCustomerReport;
          }
          if (s.path === 'report-customer-groups') {
            return settings.enableCustomerGroupsReport && canViewCustomerGroupsReport;
          }
          if (s.path === 'report-stock-adjustment') {
            if (!settings.enableStockAdjustments) return false;
            return canViewStockReports;
          }
          if (s.path === 'report-stock') {
            return settings.enableStockReport && canViewStockReports;
          }
          if (s.path === 'report-stock-expiry') {
            if (!settings.enableProductExpiry) return false;
            return canViewStockReports;
          }
          if (s.path === 'report-lot') {
            return (settings.enableLotNumber || settings.enableLotNumbers) && canViewStockReports;
          }
          if (s.path === 'report-expense') {
            if (!settings.enableExpenses) return false;
            return canViewExpenseReports;
          }
          if (s.path === 'report-register') {
            if (!settings.enablePOS) return false;
            return canViewRegisterReport;
          }
          if (s.path === 'report-sales-rep') {
            return canViewSalesRepresentativeReport;
          }
          if (s.path === 'activity-log') {
            return settings.enableActivityLog && canViewActivityLog;
          }
          if (s.path === 'report-trending-products') {
            return settings.enableTrendingProductsReport && canViewTrendingProductReport;
          }
          return true;
        });
      }

      return { ...item, subItems };
    })
    .filter(item => {
      if (item.title === 'Purchases' && !settings.enablePurchases) return false;
      if (item.title === 'Expenses' && !settings.enableExpenses) return false;
      if (item.title === 'Orders' && !settings.enableSalesOrder) return false;
      if (item.title === 'Payment Accounts' && !settings.enablePaymentAccounts) return false;
      if (item.title === 'Stock' && !settings.enableStockTransfers) return false;
      if (item.title === 'Stock Adjustment' && !settings.enableStockAdjustments) return false;
      if (item.subItems && item.subItems.length === 0) return false;
      return true;
    });

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside className={`
        fixed top-0 left-0 h-screen bg-slate-950 text-slate-400 flex flex-col z-50 border-r border-slate-800 shadow-[4px_0_24px_rgba(0,0,0,0.4)] transition-all duration-300 ease-in-out font-sans selection:bg-red-500/30
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        ${isCollapsed ? 'md:w-20' : 'md:w-72'} w-72
      `}>
      
      {/* Brand Header */}
      <div className={`h-24 flex flex-col justify-center ${isCollapsed ? 'md:px-4' : 'px-8'} border-b border-slate-800 bg-[#0B1121] relative overflow-hidden shrink-0`}>
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-red-600 via-orange-500 to-red-600"></div>
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-red-600/10 rounded-full blur-2xl"></div>
        
        <div className="flex items-center justify-between relative z-10">
          {(!isCollapsed || isMobileOpen) && (
            <div className="flex flex-col select-none group cursor-pointer">
              <div className="flex items-baseline transition-transform group-hover:translate-x-1 duration-300">
                <span className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-red-500 to-red-700 mr-[2px]">A</span>
                <span className="text-3xl font-black italic tracking-tighter text-white">TWAR</span>
              </div>
              <span className="text-[0.65rem] font-bold text-slate-500 tracking-[0.35em] uppercase leading-none ml-1 group-hover:text-red-500 transition-colors duration-300">
                AL MUSTAQBAL
              </span>
            </div>
          )}
          {isCollapsed && !isMobileOpen && (
            <div className="text-3xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-red-500 to-red-700 mx-auto">
              A
            </div>
          )}
          
          <button 
            onClick={onToggleCollapse}
            className={`hidden md:block p-1.5 rounded-lg bg-slate-900 text-slate-500 hover:text-white hover:bg-slate-800 transition-all ${isCollapsed ? 'absolute -right-3 top-1/2 -translate-y-1/2 bg-red-600 text-white shadow-lg z-50' : ''}`}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <Menu size={16} />}
          </button>

          <button 
            onClick={onMobileClose}
            className="md:hidden p-1.5 rounded-lg bg-slate-900 text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 custom-scrollbar overflow-x-hidden">
        {(!isCollapsed || isMobileOpen) && (
          <div className="px-3 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Main Menu</span>
          </div>
        )}
        
        {menuItems.map((item) => {
          const isActiveParent = item.subItems 
            ? item.subItems.some(sub => sub.path === currentPage) 
            : currentPage === item.path;
          
          return (
            <div key={item.title} className="mb-1">
              {item.subItems ? (
                <div className="overflow-hidden">
                  <button
                    onClick={() => (isCollapsed && !isMobileOpen) ? onToggleCollapse() : toggleMenu(item.title)}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all duration-200 group relative ${
                      isActiveParent || expandedMenus.includes(item.title)
                        ? 'text-white' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                    title={(isCollapsed && !isMobileOpen) ? item.title : ''}
                  >
                    <div className="flex items-center gap-3 relative z-10">
                      <div className={`p-1.5 rounded-lg transition-colors ${
                          isActiveParent ? 'bg-red-600/20 text-red-500' : 'bg-slate-900 group-hover:bg-slate-800'
                      }`}>
                        <item.icon size={18} strokeWidth={2} />
                      </div>
                      {(!isCollapsed || isMobileOpen) && <span className="text-sm font-semibold tracking-wide truncate">{item.title}</span>}
                    </div>
                    {(!isCollapsed || isMobileOpen) && (
                      <ChevronDown 
                          size={14} 
                          className={`transition-transform duration-300 text-slate-500 ${expandedMenus.includes(item.title) ? 'rotate-180 text-white' : ''}`} 
                      />
                    )}
                    
                    {/* Active Indicator Bar */}
                    {isActiveParent && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-red-600 rounded-r-full blur-[1px]"></div>}
                  </button>
                  
                  {/* Submenu */}
                  {(!isCollapsed || isMobileOpen) && (
                    <div className={`
                        transition-all duration-300 ease-in-out overflow-hidden
                        ${expandedMenus.includes(item.title) ? 'max-h-[800px] opacity-100 mt-1' : 'max-h-0 opacity-0'}
                    `}>
                      <div className="relative pl-4 ml-3.5 border-l border-slate-800 space-y-0.5 pb-2">
                          {item.subItems.map((sub) => (
                          <button
                              key={sub.title}
                              onClick={() => handleNavigate(sub.path)}
                              className={`w-full text-left pl-4 pr-3 py-2.5 rounded-r-lg text-xs font-medium transition-all relative group/sub flex items-center justify-between ${
                              currentPage === sub.path 
                                  ? 'text-red-400 bg-gradient-to-r from-red-500/10 to-transparent' 
                                  : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'
                              }`}
                          >
                              <span className="relative z-10 truncate">{sub.title}</span>
                              {currentPage === sub.path && <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>}
                              
                              {/* Hover line connector */}
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-[1px] bg-slate-800 group-hover/sub:bg-slate-600 transition-colors"></div>
                          </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => handleNavigate(item.path!)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative ${
                    currentPage === item.path 
                      ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-900/20' 
                      : 'hover:bg-slate-900 hover:text-white'
                  }`}
                  title={(isCollapsed && !isMobileOpen) ? item.title : ''}
                >
                  <div className={`p-1.5 rounded-lg transition-colors ${currentPage === item.path ? 'bg-white/20' : 'bg-slate-900 group-hover:bg-slate-800'}`}>
                    <item.icon size={18} strokeWidth={2} />
                  </div>
                  {(!isCollapsed || isMobileOpen) && <span className="text-sm font-semibold tracking-wide truncate">{item.title}</span>}
                </button>
              )}
            </div>
          );
        })}
        
        {canAccessHelpCenter && (
          <>
            {(!isCollapsed || isMobileOpen) && (
              <div className="px-3 mt-6 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Support</span>
              </div>
            )}
            <button 
                onClick={() => handleNavigate('help-center')}
                className={`w-full flex items-center gap-3 ${(isCollapsed && !isMobileOpen) ? 'px-3' : 'px-6'} py-3 rounded-xl transition-all ${
                    currentPage === 'help-center'
                    ? 'bg-blue-600/10 text-blue-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
                title={(isCollapsed && !isMobileOpen) ? 'Help Center' : ''}
            >
                <div className={`${(isCollapsed && !isMobileOpen) ? 'p-1.5 rounded-lg bg-slate-900' : ''}`}>
                  <LifeBuoy size={18} />
                </div>
                {(!isCollapsed || isMobileOpen) && <span className="text-sm font-medium">Help Center</span>}
            </button>
          </>
        )}

      </nav>

      {/* User Footer */}
      <div className={`p-4 bg-[#0B1121] border-t border-slate-800 relative ${(isCollapsed && !isMobileOpen) ? 'flex flex-col items-center' : ''}`}>
        {(!isCollapsed || isMobileOpen) ? (
          <button
            type="button"
            onClick={handleOpenProfile}
            className="w-full text-left flex items-center gap-3 mb-4 p-3 bg-slate-900/50 rounded-xl border border-slate-800 hover:bg-slate-900 hover:border-slate-700 transition"
            title="My profile"
          >
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-red-500 to-orange-500 p-[2px]">
                  <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
                      <UserCircle size={24} className="text-slate-200" />
                  </div>
              </div>
              <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{currentUser?.name || 'Admin User'}</p>
                  <p className="text-[10px] text-slate-500 truncate">{currentUser?.email || 'admin@atwar.com'}</p>
              </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleOpenProfile}
            className="w-10 h-10 rounded-full bg-gradient-to-tr from-red-500 to-orange-500 p-[2px] mb-4 hover:brightness-110 transition"
            title="My profile"
          >
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
              <UserCircle size={20} className="text-slate-200" />
            </div>
          </button>
        )}
        
        {/* DB Sync status — only visible on production when sync is enabled */}
        {dbSyncEnabled && (!isCollapsed || isMobileOpen) && (
          <div className={`flex items-center gap-2 px-3 py-1.5 mb-2 rounded-lg text-[11px] font-semibold border ${
            syncStatus === 'syncing'
              ? 'bg-blue-900/40 border-blue-700/50 text-blue-300'
              : syncStatus === 'error'
              ? 'bg-red-900/40 border-red-700/50 text-red-300'
              : syncStatus === 'synced'
              ? 'bg-emerald-900/40 border-emerald-700/50 text-emerald-300'
              : 'bg-slate-800/60 border-slate-700/50 text-slate-500'
          }`}>
            {syncStatus === 'syncing' && <Loader2 size={12} className="animate-spin flex-shrink-0" />}
            {syncStatus === 'error'   && <CloudOff size={12} className="flex-shrink-0" />}
            {syncStatus === 'synced'  && <Cloud size={12} className="flex-shrink-0" />}
            {syncStatus === 'idle'    && <Cloud size={12} className="flex-shrink-0" />}
            <span>
              {syncStatus === 'syncing' && 'Saving to cloud…'}
              {syncStatus === 'error'   && 'Save failed — retrying'}
              {syncStatus === 'synced'  && 'All changes saved'}
              {syncStatus === 'idle'    && 'Cloud sync ready'}
            </span>
          </div>
        )}

        <button
          onClick={onLogout}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 text-red-400 hover:text-white hover:bg-red-600 rounded-lg transition-all duration-300 font-bold text-xs uppercase tracking-wider border border-slate-800 hover:border-red-500 group ${(isCollapsed && !isMobileOpen) ? 'w-10 h-10 p-0' : ''}`}
          title={(isCollapsed && !isMobileOpen) ? 'Sign Out' : ''}
        >
          <LogOut size={16} className={`${(!isCollapsed || isMobileOpen) ? 'group-hover:-translate-x-1' : ''} transition-transform`} />
          {(!isCollapsed || isMobileOpen) && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;
