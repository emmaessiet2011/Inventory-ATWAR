import React, { useState } from 'react';
import {
  LayoutDashboard, Users, Package, ShoppingCart, 
  CreditCard, Truck, RefreshCw, FileText, Settings, 
  ChevronDown, ChevronRight, LogOut, Tags, Calculator,
  PieChart, BarChart3, Layers, UserCircle, LifeBuoy,
  Banknote, ShieldCheck, UserPlus, Sliders, Wallet,
  Menu, X
} from 'lucide-react';
import { useGlobalContext } from '../src/context/GlobalContext';

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
  const { settings, currentUser } = useGlobalContext();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  const toggleMenu = (title: string) => {
    setExpandedMenus(prev => 
      prev.includes(title) 
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  };

  const handleNavigate = (path: string) => {
    onNavigate(path);
    onMobileClose(); // Close sidebar on mobile when navigating
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
        { title: 'Add Product', path: 'add-product' },
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

      if (item.title === 'Sell' && !settings.enablePOS) {
        subItems = subItems.filter(s => s.path !== 'open-register' && s.path !== 'list-pos');
      }

      if (item.title === 'Products') {
        if (!settings.enableCategories) {
          subItems = subItems.filter(s => s.path !== 'categories');
        }
        if (!settings.enableBrands) {
          subItems = subItems.filter(s => s.path !== 'brands');
        }
      }

      return { ...item, subItems };
    })
    .filter(item => {
      if (item.title === 'Purchases' && !settings.enablePurchases) return false;
      if (item.title === 'Expenses' && !settings.enableExpenses) return false;
      if ((item.title === 'Stock' || item.title === 'Stock Adjustment') && !settings.enableStockTransfers) return false;
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

      </nav>

      {/* User Footer */}
      <div className={`p-4 bg-[#0B1121] border-t border-slate-800 relative ${(isCollapsed && !isMobileOpen) ? 'flex flex-col items-center' : ''}`}>
        {(!isCollapsed || isMobileOpen) ? (
          <div className="flex items-center gap-3 mb-4 p-3 bg-slate-900/50 rounded-xl border border-slate-800">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-red-500 to-orange-500 p-[2px]">
                  <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
                      <UserCircle size={24} className="text-slate-200" />
                  </div>
              </div>
              <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{currentUser?.name || 'Admin User'}</p>
                  <p className="text-[10px] text-slate-500 truncate">{currentUser?.email || 'admin@atwar.com'}</p>
              </div>
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-red-500 to-orange-500 p-[2px] mb-4">
              <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
                  <UserCircle size={20} className="text-slate-200" />
              </div>
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
