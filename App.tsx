import React, { useState, useEffect, useRef } from 'react';
import { Bell, Search, User, Menu, X, Check, Clock } from 'lucide-react';
import { NotificationProvider, useNotifications } from './src/context/NotificationContext';
import { GlobalProvider, useGlobalContext } from './src/context/GlobalContext';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Inventory from './components/Inventory';
import AddProduct from './components/AddProduct';
import POS from './components/POS';
import Orders from './components/Orders';
import VatBills from './components/VatBills';
import Suppliers from './components/Suppliers';
import Customers from './components/Customers';
import CustomerGroups from './components/CustomerGroups';
import ImportContacts from './components/ImportContacts';
import SellingPriceGroups from './components/SellingPriceGroups';
import UpdatePrice from './components/UpdatePrice';
import PrintLabels from './components/PrintLabels';
import Variations from './components/Variations';
import ImportProducts from './components/ImportProducts';
import ImportOpeningStock from './components/ImportOpeningStock';
import Units from './components/Units';
import Categories from './components/Categories';
import Brands from './components/Brands';
import Warranties from './components/Warranties';
import AddPurchase from './components/AddPurchase';
import Purchases from './components/Purchases';
import PurchaseRequisition from './components/PurchaseRequisition';
import PurchaseOrder from './components/PurchaseOrder';
import PurchaseReturn from './components/PurchaseReturn';
import Sales from './components/Sales';
import AddSale from './components/AddSale';
import ListPOS from './components/ListPOS';
import OpenRegister from './components/OpenRegister';
import ListReturns from './components/ListReturns';
import Shipments from './components/Shipments';
import Discounts from './components/Discounts';
import ImportSales from './components/ImportSales';
import ListStockTransfers from './components/ListStockTransfers';
import AddStockTransfer from './components/AddStockTransfer';
import ListStockAdjustments from './components/ListStockAdjustments';
import AddStockAdjustment from './components/AddStockAdjustment';
import ListOrders from './components/ListOrders';
import AddOrder from './components/AddOrder';
import ViewOrder from './components/ViewOrder';
import ListExpenses from './components/ListExpenses';
import AddExpense from './components/AddExpense';
import ExpenseCategories from './components/ExpenseCategories';
import ViewCustomer from './components/ViewCustomer';
import ViewSupplier from './components/ViewSupplier';
import ReportProfitLoss from './components/ReportProfitLoss';
import ReportPurchaseSale from './components/ReportPurchaseSale';
import ReportTax from './components/ReportTax';
import ReportSupplierCustomer from './components/ReportSupplierCustomer';
import ReportCustomerGroups from './components/ReportCustomerGroups';
import ReportStock from './components/ReportStock';
import ReportStockExpiry from './components/ReportStockExpiry';
import ReportLot from './components/ReportLot';
import ReportStockAdjustment from './components/ReportStockAdjustment';
import ReportTrendingProducts from './components/ReportTrendingProducts';
import ReportItems from './components/ReportItems';
import ReportProductPurchase from './components/ReportProductPurchase';
import ReportProductSell from './components/ReportProductSell';
import ReportPurchasePayment from './components/ReportPurchasePayment';
import ReportSellPayment from './components/ReportSellPayment';
import ReportExpense from './components/ReportExpense';
import ReportRegister from './components/ReportRegister';
import ReportSalesRep from './components/ReportSalesRep';
import ActivityLog from './components/ActivityLog';
import TaxRates from './components/TaxRates';
import Settings from './components/Settings';
import Locations from './components/Locations';
import InvoiceSettings from './components/InvoiceSettings';
import BarcodeSettings from './components/BarcodeSettings';
import Printers from './components/Printers';
import HelpCenter from './components/HelpCenter';
import AddSellReturn from './components/AddSellReturn';
import NewPayment from './components/NewPayment';
import FieldPayments from './components/FieldPayments';
import ListPayments from './components/ListPayments';
import ListAccounts from './components/ListAccounts';
import BalanceSheet from './components/BalanceSheet';
import TrialBalance from './components/TrialBalance';
import CashFlow from './components/CashFlow';
import PaymentAccountReport from './components/PaymentAccountReport';
import UserManagement from './components/UserManagement';
import Roles from './components/Roles';
import SalesCommissionAgents from './components/SalesCommissionAgents';
import AddUser from './components/AddUser';
import ViewUser from './components/ViewUser';

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
  const { settings, currentUser, setCurrentUser } = useGlobalContext();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!currentUser);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [publicInvoiceId, setPublicInvoiceId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [showNotifications, setShowNotifications] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } = useNotifications();
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsAuthenticated(!!currentUser);
  }, [currentUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
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

    // Handle parameterized EditProduct route: edit-product/{id}
    if (currentPage.startsWith('edit-product/')) {
        const parts = currentPage.split('/');
        const id = parts[1] || '';
        return <AddProduct isEdit={true} productId={id} onNavigate={setCurrentPage} />;
    }

    // Handle parameterized EditUser route: edit-user/{id}
    if (currentPage.startsWith('edit-user/')) {
        const parts = currentPage.split('/');
        const id = parts[1] || '';
        return <AddUser isEdit={true} userId={id} onNavigate={setCurrentPage} />;
    }

    switch(currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'users': return <UserManagement onNavigate={setCurrentPage} />;
      case 'add-user': return <AddUser onNavigate={setCurrentPage} />;
      case 'roles': return <Roles onNavigate={setCurrentPage} />;
      case 'sales-commission-agents':
        return settings.enableCommissionAgents ? <SalesCommissionAgents /> : renderModuleDisabled('Sales Commission Agents');
      case 'products': return <Inventory onNavigate={setCurrentPage} />;
      case 'add-product': return <AddProduct onNavigate={setCurrentPage} />;
      case 'update-price': return <UpdatePrice />;
      case 'print-labels': return <PrintLabels />;
      case 'variations': return <Variations />;
      case 'import-products': return <ImportProducts />;
      case 'import-opening-stock': return <ImportOpeningStock />;
      case 'units': return <Units />;
      case 'categories': return settings.enableCategories ? <Categories /> : renderModuleDisabled('Categories');
      case 'brands': return settings.enableBrands ? <Brands /> : renderModuleDisabled('Brands');
      case 'warranties': return <Warranties />;
      case 'purchases': return settings.enablePurchases ? <Purchases /> : renderModuleDisabled('Purchases');
      case 'add-purchase': return settings.enablePurchases ? <AddPurchase /> : renderModuleDisabled('Purchases');
      case 'purchase-requisition': return settings.enablePurchases ? <PurchaseRequisition /> : renderModuleDisabled('Purchases');
      case 'purchase-order': return settings.enablePurchases ? <PurchaseOrder /> : renderModuleDisabled('Purchases');
      case 'purchase-return': return settings.enablePurchases ? <PurchaseReturn /> : renderModuleDisabled('Purchases');
      case 'sales': return <Sales onNavigate={setCurrentPage} statusFilter="Final" />;
      case 'add-sale': return <AddSale onNavigate={setCurrentPage} />;
      case 'edit-sale': return <AddSale isEdit={true} onNavigate={setCurrentPage} />;
      case 'list-pos': return settings.enablePOS ? <ListPOS onNavigate={setCurrentPage} /> : renderModuleDisabled('POS');
      case 'open-register': return settings.enablePOS ? <OpenRegister onNavigate={setCurrentPage} /> : renderModuleDisabled('POS');
      case 'pos': return settings.enablePOS ? <POS /> : renderModuleDisabled('POS');
      case 'drafts': return <Sales onNavigate={setCurrentPage} statusFilter="Draft" title="Drafts" addPage="add-draft" addButtonLabel="Add Draft" />;
      case 'add-draft': return <AddSale onNavigate={setCurrentPage} initialStatus="Draft" />;
      case 'quotations': return <Sales onNavigate={setCurrentPage} statusFilter="Quotation" title="Quotations" addPage="add-quotation" addButtonLabel="Add Quotation" />;
      case 'add-quotation': return <AddSale onNavigate={setCurrentPage} initialStatus="Quotation" />;
      case 'returns': return <ListReturns onNavigate={setCurrentPage} />;
      case 'add-sell-return': return <AddSellReturn onNavigate={setCurrentPage} />;
      case 'shipments': return <Shipments onNavigate={setCurrentPage} />;
      case 'discounts': return <Discounts onNavigate={setCurrentPage} />;
      case 'import-sales': return <ImportSales onNavigate={setCurrentPage} />;
      case 'list-stock-transfers': return settings.enableStockTransfers ? <ListStockTransfers onNavigate={setCurrentPage} /> : renderModuleDisabled('Stock Transfers');
      case 'add-stock-transfer': return settings.enableStockTransfers ? <AddStockTransfer /> : renderModuleDisabled('Stock Transfers');
      case 'list-stock-adjustments': return settings.enableStockTransfers ? <ListStockAdjustments onNavigate={setCurrentPage} /> : renderModuleDisabled('Stock Transfers');
      case 'add-stock-adjustment': return settings.enableStockTransfers ? <AddStockAdjustment /> : renderModuleDisabled('Stock Transfers');
      case 'list-orders':
      case 'orders':
        return <ListOrders onNavigate={setCurrentPage} onSelectOrder={setSelectedOrderId} />;
      case 'add-order': return <AddOrder onNavigate={setCurrentPage} />;
      case 'edit-order': return <AddOrder isEdit={true} orderId={selectedOrderId} onNavigate={setCurrentPage} />;
      case 'view-order': return <ViewOrder onClose={() => setCurrentPage('list-orders')} orderId={selectedOrderId} />;
      case 'convert-order-to-invoice': return <AddSale fromOrder={true} onNavigate={setCurrentPage} />;
      case 'new-payment': return <NewPayment />;
      case 'list-payments': return <ListPayments onNavigate={handleNavigate} onContactSelect={handleContactSelect} />;
      case 'field-payments': return <FieldPayments />;
      case 'list-accounts': return <ListAccounts onNavigate={setCurrentPage} />;
      case 'balance-sheet': return <BalanceSheet />;
      case 'trial-balance': return <TrialBalance />;
      case 'cash-flow': return <CashFlow />;
      case 'payment-account-report': return <PaymentAccountReport />;
      case 'vat-bills': return <VatBills />;
      case 'tax-rates': return <TaxRates />;
      case 'suppliers': return <Suppliers onNavigate={setCurrentPage} />;
      case 'customers': return <Customers onNavigate={setCurrentPage} />;
      case 'customer-groups': return <CustomerGroups />;
      case 'selling-price-groups': return <SellingPriceGroups />;
      case 'import-contacts': return <ImportContacts />;
      case 'expenses': return settings.enableExpenses ? <ListExpenses onNavigate={setCurrentPage} /> : renderModuleDisabled('Expenses');
      case 'add-expense': return settings.enableExpenses ? <AddExpense /> : renderModuleDisabled('Expenses');
      case 'edit-expense': return settings.enableExpenses ? <AddExpense isEdit={true} /> : renderModuleDisabled('Expenses');
      case 'expense-categories': return settings.enableExpenses ? <ExpenseCategories /> : renderModuleDisabled('Expenses');
      case 'report-profit-loss': return <ReportProfitLoss />;
      case 'report-purchase-sale': return <ReportPurchaseSale />;
      case 'report-tax': return <ReportTax />;
      case 'report-supplier-customer': return <ReportSupplierCustomer />;
      case 'report-customer-groups': return <ReportCustomerGroups />;
      case 'report-stock': return <ReportStock />;
      case 'report-stock-expiry': return <ReportStockExpiry />;
      case 'report-lot': return <ReportLot />;
      case 'report-stock-adjustment': return <ReportStockAdjustment />;
      case 'report-trending-products': return <ReportTrendingProducts />;
      case 'report-items': return <ReportItems />;
      case 'report-product-purchase': return <ReportProductPurchase />;
      case 'report-product-sell': return <ReportProductSell />;
      case 'report-purchase-payment': return <ReportPurchasePayment />;
      case 'report-sell-payment': return <ReportSellPayment />;
      case 'report-expense': return <ReportExpense />;
      case 'report-register': return <ReportRegister />;
      case 'report-sales-rep': return <ReportSalesRep />;
      case 'activity-log': return <ActivityLog />;
      case 'settings': return <Settings />;
      case 'locations': return <Locations />;
      case 'invoice-settings': return <InvoiceSettings />;
      case 'barcode-settings': return <BarcodeSettings />;
      case 'printers': return <Printers />;
      case 'help-center': return <HelpCenter />;
      case 'public-view-invoice': 
        return (
          <ViewOrder 
            onClose={handleClosePublicInvoice} 
            invoiceNo={`INV-${publicInvoiceId}`} 
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
          setCurrentUser(null);
          setIsAuthenticated(false);
        }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isSidebarOpen}
        onMobileClose={() => setIsSidebarOpen(false)}
      />
      
      <div className={`flex-1 ${isSidebarCollapsed ? 'ml-20' : 'ml-72'} p-8 overflow-y-auto h-screen transition-all duration-300 print:ml-0 print:p-0`}>
        <header className="flex justify-between items-center mb-8 print:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Search anything..." 
              className="pl-10 pr-4 py-2 rounded-full bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 w-64 shadow-sm"
            />
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative" ref={notificationRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2 rounded-full transition shadow-sm relative ${showNotifications ? 'bg-red-50 text-red-600' : 'bg-white text-slate-600 hover:text-red-600 hover:bg-red-50'}`}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[1000] overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
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
                            className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer relative group ${!n.read ? 'bg-blue-50/30' : ''}`}
                            onClick={() => markAsRead(n.id)}
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
                                <p className={`text-sm ${!n.read ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{n.title}</p>
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-medium">
                                  {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              {!n.read && (
                                <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 shrink-0"></div>
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
                    <button className="text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors">
                      View all activity
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900">{currentUser?.name || 'Admin'}</p>
                <p className="text-xs text-slate-500">{currentUser?.role || 'Admin'}</p>
              </div>
              <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 border-2 border-white shadow-sm">
                <User size={20} />
              </div>
            </div>
          </div>
        </header>

        <main>
          {renderPage()}
        </main>
      </div>
    </div>
  );
};

export default App;
