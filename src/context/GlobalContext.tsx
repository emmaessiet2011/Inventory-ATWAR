import React, { createContext, useContext, useState, useEffect } from 'react';

// ============================================================
//  INTERFACES — Every data shape used across the app
// ============================================================

export interface Product {
  id: string;
  name: string;
  sku: string;
  type: 'Single' | 'Variable' | 'Combo';
  category: string;
  brand: string;
  tax: string;                    // e.g. '--' or 'VAT@5%'
  businessLocation: string;
  unitPurchasePrice: number;
  sellingPrice: number;
  stock: number;
  unit: string;
  image: string;
  alertQuantity?: number;         // low-stock threshold
  expiryDate?: string;
  description?: string;
}

// Rich Customer record — used in Customers module + AddSale dropdown
export interface Customer {
  id: string;                     // e.g. 'CUST-0001'
  type: 'Customer';
  businessName: string;
  name: string;                   // contact person
  email: string;
  mobile: string;
  phone?: string;
  taxNumber: string;
  creditLimit: number;
  payTerm: string;
  openingBalance: number;
  advanceBalance: number;
  totalSellDue: number;
  totalSellReturnDue: number;
  addedOn: string;
  customerGroup: string;
  address: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  status: 'Active' | 'Inactive';
  assignedTo?: string;
  lastSellDate?: string;
  customValues?: Record<string, string>;
}

// Rich Supplier record — used in Suppliers module + AddPurchase dropdown
export interface Supplier {
  id: string;                     // e.g. 'SUP-1001'
  type: 'Supplier';
  businessName: string;
  name: string;                   // contact person
  email: string;
  mobile: string;
  phone?: string;
  taxNumber: string;
  payTerm: string;
  openingBalance: number;
  advanceBalance: number;
  totalPurchaseDue: number;
  totalReturnDue: number;
  addedOn: string;
  address: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  status: 'Active' | 'Inactive';
  assignedTo?: string;
  purchaseStatus?: string;
  customValues?: Record<string, string>;
}

// Kept for backward compatibility (Contact = Customer | Supplier minimal)
export interface Contact {
  id: number;
  type: 'Supplier' | 'Customer';
  contactId: string;
  name: string;
  businessName: string;
  mobile: string;
  email: string;
  taxNumber: string;
  creditLimit: number;
  balance: number;
  payTerm: string;
  status: 'Active' | 'Inactive';
}

export interface SaleItem {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  tax: number;
  total: number;
  unit?: string;
}

export interface Sale {
  id: string;
  date: string;
  invoiceNo: string;
  invoiceScheme?: string;
  customerId: number | string;
  customerName?: string;
  contactNumber?: string;
  billingAddress?: string;
  shippingAddress?: string;
  location?: string;
  saleType?: string;
  saleStatus?: string;
  payTerm?: string;
  paymentStatus: 'Paid' | 'Due' | 'Partial' | 'Overdue';
  paymentMethod?: string;
  paymentAccount?: string;
  paymentNote?: string;
  totalAmount?: number;
  totalPaid?: number;
  sellDue?: number;
  sellReturnDue?: number;
  discount?: string;
  orderTax?: string;
  shippingStatus?: 'Delivered' | 'Pending' | 'Shipped' | 'Ordered' | 'Packed';
  shippingDetails?: string;
  shippingCharges: number;
  deliveredTo?: string;
  deliveryPerson?: string;
  totalItems?: number;
  addedBy?: string;
  sellNote?: string;
  staffNote?: string;
  document?: string;
  items: SaleItem[];
  subTotal: number;
  discountType: string;
  discountAmount: number;
  tax: string;
  grandTotal: number;
  status: 'Final' | 'Draft' | 'Quotation';
}

export interface PurchaseItem {
  id: string;
  name: string;
  qty: number;
  unitCost: number;
  discount: number;
  tax: number;
  lineTotal: number;
  lot?: string;
  margin?: number;
  sellingPrice?: number;
}

export interface Purchase {
  id: string;
  refNo: string;
  date: string;
  location: string;
  supplier: string;
  supplierId?: string;
  status: 'Received' | 'Pending' | 'Ordered';
  paymentStatus: 'Paid' | 'Due' | 'Partial';
  grandTotal: number;
  paymentDue: number;
  addedBy: string;
  items?: PurchaseItem[];
  subTotal?: number;
  discountType?: string;
  discountAmount?: number;
  shippingCharges?: number;
  notes?: string;
  paymentMethod?: string;
  paymentAmount?: number;
}

export interface OrderItem {
  id: string | number;
  name: string;
  qty: number;
  price: number;
  total: number;
}

export interface GlobalOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  orderDate: string;
  deliveryDate: string;
  deliveryTimeSlot?: string;
  status: 'Pending' | 'Processing' | 'Ready' | 'Shipped' | 'Delivered' | 'Cancelled';
  paymentStatus: 'Paid' | 'Due' | 'Partial';
  orderType: 'Paid' | 'Credit';
  paymentMethod?: string;
  source?: string;
  items: OrderItem[];
  itemCount: number;
  subTotal: number;
  taxType: string;
  taxAmount: number;
  total: number;
  driver?: string;
  area: string;
  salesRep: string;
  deliveryAddress?: string;
  note?: string;
  addedBy?: string;
}

export interface Payment {
  id: string;
  date: string;
  contactId: string;
  contactName: string;
  contactType: 'Customer' | 'Supplier';
  amount: number;
  method: string;
  account: string;
  referenceNo: string;
  note: string;
  type: 'received' | 'sent'; // received = customer pays us; sent = we pay supplier
  linkedInvoices?: string[];
  addedBy?: string;
}

export interface Expense {
  id: string;
  refNo: string;
  date: string;
  category: string;
  subCategory: string;
  location: string;
  amount: number;
  tax: number;
  totalAmount: number;
  paymentStatus: 'Paid' | 'Due' | 'Partial';
  paymentDue: number;
  expenseFor: string;
  contact: string;
  paymentAccount: string;
  paymentMethod: string;
  note: string;
  addedBy: string;
  isRefund?: boolean;
  isRecurring?: boolean;
  recurringInterval?: string;
  recurringUnit?: string;
  recurringRepetitions?: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
  code?: string;
}

export interface AppUser {
  id: string;
  username: string;
  name: string;
  role: 'CEO' | 'Manager' | 'Sale Agent' | 'Cashier' | 'Admin' | 'Sales Man' | 'Order' | 'Field Payment' | string;
  email: string;
  password?: string;              // stored for local-auth; would be hashed in production
  status: 'Active' | 'Inactive';
  lastLogin: string;
  commissionPercent?: number;
  businessLocation?: string;
}

export interface Role {
  id: number;
  name: string;
  description: string;
  userCount: number;
  permissionsCount: number;
  isSystem: boolean;
  permissions?: string[];
}

export interface CommissionAgent {
  id: number;
  name: string;
  email: string;
  contactNo: string;
  address: string;
  commissionPercentage: number;
}

export interface PaymentMethod {
  id: string;
  name: string;
  enabled: boolean;
  account: string;
}

export interface Location {
  id: string;
  name: string;
  landmark: string;
  city: string;
  zipCode: string;
  state: string;
  country: string;
  mobile: string;
  email: string;
  website: string;
  isActive: boolean;
  priceGroup: string;
  invoiceScheme: string;
  invoiceLayoutPos: string;
  invoiceLayoutSale: string;
  paymentMethods?: PaymentMethod[];
}

export interface TaxRate {
  id: string;
  name: string;
  rate: number;
  type: 'Inclusive' | 'Exclusive';
  description?: string;
}

export interface CustomerGroup {
  id: string;
  name: string;
  discountPercent: number;
  description?: string;
}

export interface AppSettings {
  businessName: string;
  businessLogo?: string;
  startDate: string;
  defaultProfitPercent: string;
  currency: string;
  currencySymbol: string;
  currencySymbolPlacement: 'before' | 'after';
  timeZone: string;
  fyStartMonth: string;
  stockAccountingMethod: string;
  transactionEditDays: string;
  dateFormat: string;
  timeFormat: string;
  currencyPrecision: number;
  quantityPrecision: number;
  enableProductExpiry: boolean;
  enableBrands: boolean;
  enableCategories: boolean;
  enableSerialNumbers: boolean;
  enableLotNumbers: boolean;
  // Sale settings
  salesInvoicePrefix: string;
  purchasePrefix: string;
  quotationPrefix: string;
  paymentPrefix: string;
  defaultSalePaymentMethod: string;
  defaultPurchasePaymentMethod: string;
  defaultSaleDiscount: string;
  defaultSaleTax: string;
  defaultCreditSaleDays: string;
  // Contact
  defaultPayTerm: string;
  defaultCreditLimit: string;
  // POS
  posEnableDiscount: boolean;
  posEnableTax: boolean;
  posDefaultPaymentMethod: string;
  // Tax
  taxLabel: string;
  enableTax: boolean;
  tax1Name: string;
  tax1Number: string;
  tax2Name: string;
  tax2Number: string;
  // Prefixes (extended)
  stockTransferPrefix: string;
  stockAdjustmentPrefix: string;
  sellReturnPrefix: string;
  expensesPrefix: string;
  contactsPrefix: string;
  purchasePaymentPrefix: string;
  sellPaymentPrefix: string;
  // Product settings
  skuPrefix: string;
  defaultUnit: string;
  enableSubCategories: boolean;
  // Dashboard
  stockExpiryAlertDays: string;
  // System
  defaultTableEntries: string;
  // Sale (extended)
  allowOverselling: boolean;
  isPayTermRequired: boolean;
  // Purchases (extended)
  enableEditPriceFromPurchase: boolean;
  enablePurchaseStatus: boolean;
  enableLotNumber: boolean;
  enablePurchaseOrder: boolean;
  enablePurchaseRequisition: boolean;
  // Sale settings (extended)
  enableSalesOrder: boolean;
  // Modules
  enablePOS: boolean;
  enablePurchases: boolean;
  enableExpenses: boolean;
  enableStockTransfers: boolean;
  enableCommissionAgents: boolean;
  enableRewardPoints: boolean;
}

// ============================================================
//  CONTEXT TYPE
// ============================================================

interface GlobalContextType {
  // --- Products ---
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;

  // --- Customers ---
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  addCustomer: (customer: Customer) => void;
  updateCustomer: (customer: Customer) => void;
  deleteCustomer: (id: string) => void;

  // --- Suppliers ---
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (supplier: Supplier) => void;
  deleteSupplier: (id: string) => void;

  // --- Contacts (legacy — derived from customers + suppliers) ---
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  addContact: (contact: Contact) => void;
  updateContact: (contact: Contact) => void;
  deleteContact: (id: number) => void;

  // --- Sales ---
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  addSale: (sale: Sale) => void;
  updateSale: (sale: Sale) => void;
  deleteSale: (id: string) => void;

  // --- Purchases ---
  purchases: Purchase[];
  setPurchases: React.Dispatch<React.SetStateAction<Purchase[]>>;
  addPurchase: (purchase: Purchase) => void;
  updatePurchase: (purchase: Purchase) => void;
  deletePurchase: (id: string) => void;

  // --- Payments ---
  payments: Payment[];
  setPayments: React.Dispatch<React.SetStateAction<Payment[]>>;
  addPayment: (payment: Payment) => void;
  updatePayment: (payment: Payment) => void;
  deletePayment: (id: string) => void;

  // --- Expenses ---
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  addExpense: (expense: Expense) => void;
  updateExpense: (expense: Expense) => void;
  deleteExpense: (id: string) => void;

  // --- Expense Categories ---
  expenseCategories: ExpenseCategory[];
  setExpenseCategories: React.Dispatch<React.SetStateAction<ExpenseCategory[]>>;
  addExpenseCategory: (cat: ExpenseCategory) => void;
  updateExpenseCategory: (cat: ExpenseCategory) => void;
  deleteExpenseCategory: (id: string) => void;

  // --- Users ---
  users: AppUser[];
  setUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;
  addUser: (user: AppUser) => void;
  updateUser: (user: AppUser) => void;
  deleteUser: (id: string) => void;

  // --- Roles ---
  roles: Role[];
  setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
  addRole: (role: Role) => void;
  updateRole: (role: Role) => void;
  deleteRole: (id: number) => void;

  // --- Commission Agents ---
  commissionAgents: CommissionAgent[];
  setCommissionAgents: React.Dispatch<React.SetStateAction<CommissionAgent[]>>;
  addCommissionAgent: (agent: CommissionAgent) => void;
  updateCommissionAgent: (agent: CommissionAgent) => void;
  deleteCommissionAgent: (id: number) => void;

  // --- Locations ---
  locations: Location[];
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  addLocation: (location: Location) => void;
  updateLocation: (location: Location) => void;
  deleteLocation: (id: string) => void;

  // --- Tax Rates ---
  taxRates: TaxRate[];
  setTaxRates: React.Dispatch<React.SetStateAction<TaxRate[]>>;
  addTaxRate: (tax: TaxRate) => void;
  updateTaxRate: (tax: TaxRate) => void;
  deleteTaxRate: (id: string) => void;

  // --- Customer Groups ---
  customerGroups: CustomerGroup[];
  setCustomerGroups: React.Dispatch<React.SetStateAction<CustomerGroup[]>>;
  addCustomerGroup: (group: CustomerGroup) => void;
  updateCustomerGroup: (group: CustomerGroup) => void;
  deleteCustomerGroup: (id: string) => void;

  // --- Orders ---
  orders: GlobalOrder[];
  setOrders: React.Dispatch<React.SetStateAction<GlobalOrder[]>>;
  addOrder: (order: GlobalOrder) => void;
  updateOrder: (order: GlobalOrder) => void;
  deleteOrder: (id: string) => void;

  // --- Settings ---
  settings: AppSettings;
  updateSettings: (settings: AppSettings) => void;

  // --- Auth ---
  currentUser: AppUser | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<AppUser | null>>;

  // --- Utilities ---
  formatCurrency: (amount: number) => string;
  generateId: (prefix: string) => string;
  nextInvoiceNumber: (locationId?: string) => string;
}

// ============================================================
//  DEFAULT / SEED DATA
// ============================================================

const defaultPaymentMethods: PaymentMethod[] = [
  { id: '1',  name: 'Cash',            enabled: true, account: 'None' },
  { id: '2',  name: 'Card',            enabled: true, account: 'None' },
  { id: '3',  name: 'Cheque',          enabled: true, account: 'None' },
  { id: '4',  name: 'Bank Transfer',   enabled: true, account: 'None' },
  { id: '5',  name: 'Other',           enabled: true, account: 'None' },
  { id: '6',  name: 'Credit',          enabled: true, account: 'None' },
  { id: '7',  name: 'Yahya',           enabled: true, account: 'None' },
  { id: '8',  name: 'Emad',            enabled: true, account: 'None' },
  { id: '9',  name: 'Jaifar',          enabled: true, account: 'None' },
  { id: '10', name: 'Khalil',          enabled: true, account: 'None' },
  { id: '11', name: 'Custom Payment 6',enabled: true, account: 'None' },
  { id: '12', name: 'Custom Payment 7',enabled: true, account: 'None' },
];

const initialLocations: Location[] = [
  {
    id: 'BL0001',
    name: 'CR:1450968',
    landmark: 'Atwar',
    city: 'Muscat',
    zipCode: '112',
    state: 'Muscat',
    country: 'Oman',
    mobile: '',
    email: '',
    website: '',
    isActive: true,
    priceGroup: '',
    invoiceScheme: 'Atwar',
    invoiceLayoutPos: 'Default',
    invoiceLayoutSale: 'Default',
    paymentMethods: defaultPaymentMethods,
  },
  {
    id: 'BL0002',
    name: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649',
    landmark: 'KNWZ',
    city: 'Muscat',
    zipCode: '112',
    state: 'Muscat',
    country: 'Oman',
    mobile: '',
    email: '',
    website: '',
    isActive: true,
    priceGroup: '',
    invoiceScheme: 'Knwz Ard Alkhlyj',
    invoiceLayoutPos: 'Knwz Ard Alkhlyj',
    invoiceLayoutSale: 'Knwz Ard Alkhlyj',
    paymentMethods: defaultPaymentMethods,
  }
];

const initialProducts: Product[] = [
  { id: '0147', name: 'Activated Carbon 10L', sku: '0147', type: 'Single', category: 'Sand (clear cat)', brand: 'ClearCat Blanco', tax: '--', businessLocation: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649', unitPurchasePrice: 1.800, sellingPrice: 2.565, stock: 3, unit: 'Pieces', image: 'https://images.unsplash.com/photo-1597843786271-105124152c74?w=200&h=200&fit=crop&q=80' },
  { id: '0146', name: 'Activated Carbon 5L', sku: '0146', type: 'Single', category: 'Sand (clear cat)', brand: 'ClearCat Blanco', tax: '--', businessLocation: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649', unitPurchasePrice: 1.100, sellingPrice: 1.520, stock: 457, unit: 'Pieces', image: 'https://images.unsplash.com/photo-1597843786271-105124152c74?w=200&h=200&fit=crop&q=80' },
  { id: '0071', name: 'Adore hazelnut', sku: '0071', type: 'Single', category: 'Food product', brand: '--', tax: '--', businessLocation: 'CR:1450968', unitPurchasePrice: 0.650, sellingPrice: 0.900, stock: 0, unit: 'Pieces', image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=200&h=200&fit=crop&q=80' },
  { id: '0201', name: 'Royal Canin Maxi Adult 15kg', sku: 'RC-MAXI-15', type: 'Single', category: 'Pet Foods', brand: 'Royal Canin', tax: 'VAT@5%', businessLocation: 'CR:1450968', unitPurchasePrice: 22.000, sellingPrice: 28.500, stock: 12, unit: 'Bags', image: 'https://images.unsplash.com/photo-1589924691195-41432c84c161?w=200&h=200&fit=crop&q=80' },
  { id: '0202', name: 'Shell Helix Ultra 5W-40 4L', sku: 'SH-HELIX-4L', type: 'Single', category: 'Engine Oil', brand: 'Shell', tax: 'VAT@5%', businessLocation: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649', unitPurchasePrice: 10.500, sellingPrice: 14.200, stock: 45, unit: 'Bottles', image: 'https://images.unsplash.com/photo-1635784063737-96334d517177?w=200&h=200&fit=crop&q=80' },
  { id: '0203', name: 'Whiskas Tuna Flavour 1.2kg', sku: 'WH-TUNA-1.2', type: 'Single', category: 'Pet Foods', brand: 'Whiskas', tax: '--', businessLocation: 'CR:1450968', unitPurchasePrice: 2.900, sellingPrice: 3.800, stock: 24, unit: 'Packs', image: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=200&h=200&fit=crop&q=80' },
  { id: '0204', name: 'Flexi New Classic Retractable Leash', sku: 'FL-LEASH-M', type: 'Single', category: 'Pet Accessories', brand: 'Flexi', tax: 'VAT@5%', businessLocation: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649', unitPurchasePrice: 4.200, sellingPrice: 6.500, stock: 8, unit: 'Pieces', image: 'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?w=200&h=200&fit=crop&q=80' },
  { id: '0205', name: 'Pedigree Adult Chicken & Vegetables 3kg', sku: 'PDG-CHK-3KG', type: 'Single', category: 'Pet Foods', brand: 'Pedigree', tax: 'VAT@5%', businessLocation: 'CR:1450968', unitPurchasePrice: 3.500, sellingPrice: 4.800, stock: 30, unit: 'Bags', image: 'https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?w=200&h=200&fit=crop&q=80' },
  { id: '0206', name: 'Me-O Creamy Treats Salmon', sku: 'MEO-TRT-SAL', type: 'Single', category: 'Pet Foods', brand: 'Me-O', tax: '--', businessLocation: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649', unitPurchasePrice: 0.800, sellingPrice: 1.200, stock: 100, unit: 'Packs', image: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=200&h=200&fit=crop&q=80' },
  { id: '0207', name: 'Trixie Cat Scratching Post', sku: 'TRX-SCR-POST', type: 'Single', category: 'Pet Accessories', brand: 'Trixie', tax: 'VAT@5%', businessLocation: 'CR:1450968', unitPurchasePrice: 8.500, sellingPrice: 12.900, stock: 5, unit: 'Pieces', image: 'https://images.unsplash.com/photo-1545249390-6bdfa286032f?w=200&h=200&fit=crop&q=80' },
  { id: '0208', name: 'Purina Friskies Seafood Sensations 1.1kg', sku: 'PUR-SEA-1.1', type: 'Single', category: 'Pet Foods', brand: 'Purina', tax: '--', businessLocation: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649', unitPurchasePrice: 2.100, sellingPrice: 2.950, stock: 18, unit: 'Bags', image: 'https://images.unsplash.com/photo-1615266895738-11f1371cd7e5?w=200&h=200&fit=crop&q=80' },
  { id: '0209', name: 'Danna 10W40 Engine Oil 1L', sku: 'DAN-10W40-1L', type: 'Single', category: 'Engine Oil', brand: 'Danna', tax: 'VAT@5%', businessLocation: 'CR:1450968', unitPurchasePrice: 1.800, sellingPrice: 2.500, stock: 60, unit: 'Bottles', image: 'https://images.unsplash.com/photo-1563630423918-b58f07336ac9?w=200&h=200&fit=crop&q=80' },
];

const initialCustomers: Customer[] = [
  { id: 'CUST-0001', type: 'Customer', businessName: 'Zan Supermarket (Mobailah)', name: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649', email: 'zan@example.com', taxNumber: 'OM123456', creditLimit: 0, payTerm: 'No Limit', openingBalance: 0, advanceBalance: 0, totalSellDue: 7.800, totalSellReturnDue: 0, addedOn: '26/10/2024', customerGroup: 'Supermarkets Customers', address: 'Mobailah, Seeb', mobile: '96434389', status: 'Active', assignedTo: 'Admin', lastSellDate: '2025-01-01', customValues: { 'Route': 'Route A' } },
  { id: 'CUST-0002', type: 'Customer', businessName: 'Zain Discount Center', name: 'Zain Discount Center', email: '--', taxNumber: '--', creditLimit: 0, payTerm: 'No Limit', openingBalance: 0, advanceBalance: 0, totalSellDue: 0, totalSellReturnDue: 0, addedOn: '04/11/2023', customerGroup: 'Supermarkets Customers', address: 'Seeb', mobile: '+96891665656', status: 'Active', assignedTo: 'Sales Rep', lastSellDate: '2026-02-01' },
  { id: 'CUST-0003', type: 'Customer', businessName: 'Yellow Way LLC (Mobailah)', name: 'Yellow Way LLC', email: '--', taxNumber: 'OM987654', creditLimit: 500, payTerm: '30 Days', openingBalance: 0, advanceBalance: 0, totalSellDue: 318.150, totalSellReturnDue: 0, addedOn: '15/03/2024', customerGroup: 'Wholesale', address: 'Mobailah', mobile: '+96892345678', status: 'Active', assignedTo: 'Admin', lastSellDate: '2026-01-15' },
  { id: 'CUST-0004', type: 'Customer', businessName: 'Happy Pets Shop', name: 'John Doe', email: 'happypets@example.com', taxNumber: '--', creditLimit: 1000, payTerm: '15 Days', openingBalance: 50, advanceBalance: 0, totalSellDue: 150.500, totalSellReturnDue: 0, addedOn: '10/05/2024', customerGroup: 'Pet Shops', address: 'Muscat', mobile: '98887777', status: 'Active', assignedTo: 'Shafikul Islam', lastSellDate: '2026-02-10' },
  { id: 'CUST-0005', type: 'Customer', businessName: 'Al Khaleej Stores', name: 'Khalid Bin Ali', email: '--', taxNumber: '--', creditLimit: 0, payTerm: 'Immediate', openingBalance: 0, advanceBalance: 0, totalSellDue: 0, totalSellReturnDue: 0, addedOn: '01/01/2025', customerGroup: '', address: 'Muscat', mobile: '+96895678901', status: 'Active', lastSellDate: '2026-02-05' },
  { id: 'WALK-IN', type: 'Customer', businessName: 'Walk-in Customer', name: 'Walk-in Customer', email: '', taxNumber: '', creditLimit: 0, payTerm: 'Immediate', openingBalance: 0, advanceBalance: 0, totalSellDue: 0, totalSellReturnDue: 0, addedOn: '01/01/2023', customerGroup: '', address: '', mobile: '', status: 'Active' },
];

const initialSuppliers: Supplier[] = [
  { id: 'SUP-1001', type: 'Supplier', businessName: 'Oman Oil Marketing Co.', name: 'Ahmed Al-Balushi', email: 'sales@oomco.com', taxNumber: 'OM12345678', payTerm: 'Net 30', openingBalance: 0, advanceBalance: 500, totalPurchaseDue: 4500, totalReturnDue: 0, addedOn: '2023-01-15', address: 'PO Box 123, Muscat', mobile: '+968 9988 7766', status: 'Active', assignedTo: 'Admin', purchaseStatus: 'Received' },
  { id: 'SUP-1002', type: 'Supplier', businessName: 'Global Pet Supplies LLC', name: 'Sarah Jenkins', email: 'sarah@globalpet.com', taxNumber: 'OM87654321', payTerm: 'Net 15', openingBalance: 150, advanceBalance: 0, totalPurchaseDue: 1250.500, totalReturnDue: 50, addedOn: '2023-03-22', address: 'Rusayl Industrial Estate', mobile: '+968 9123 4567', status: 'Active', assignedTo: 'Sales Rep 1', purchaseStatus: 'Pending' },
  { id: 'SUP-1003', type: 'Supplier', businessName: 'Al Maha Ceramics', name: 'Mohammed Al-Lawati', email: 'procurement@almaha.com', taxNumber: 'OM11223344', payTerm: 'Cash', openingBalance: 0, advanceBalance: 0, totalPurchaseDue: 0, totalReturnDue: 0, addedOn: '2023-06-10', address: 'Sohar Port Freezone', mobile: '+968 9876 5432', status: 'Inactive', assignedTo: 'Admin', purchaseStatus: 'Ordered' },
  { id: 'SUP-1004', type: 'Supplier', businessName: 'Kennol Performance Oil', name: 'Pierre Dumont', email: 'p.dumont@kennol.com', taxNumber: 'FR99887766', payTerm: 'Net 45', openingBalance: 0, advanceBalance: 0, totalPurchaseDue: 2100, totalReturnDue: 0, addedOn: '2022-11-01', address: 'Rusayl, Muscat', mobile: '+968 9001 2345', status: 'Active', assignedTo: 'Admin', purchaseStatus: 'Received' },
  { id: 'SUP-1005', type: 'Supplier', businessName: 'Royal Canin Oman', name: 'Sara Khalid', email: 'sara@royalcanin.om', taxNumber: 'OM55667788', payTerm: 'Net 30', openingBalance: 0, advanceBalance: 0, totalPurchaseDue: 850, totalReturnDue: 0, addedOn: '2023-09-01', address: 'Azaiba, Muscat', mobile: '+968 9321 5678', status: 'Active', assignedTo: 'Admin', purchaseStatus: 'Received' },
];

const initialUsers: AppUser[] = [
  { id: 'USR-001', username: 'admin_main', name: 'Admin User', role: 'Admin', email: 'admin@atwar.com', password: 'admin123', status: 'Active', lastLogin: '14/02/2026 09:15 AM', commissionPercent: 0 },
  { id: 'USR-002', username: 'ceo_owner', name: 'Hussain Al-Lawati', role: 'CEO', email: 'hussain@atwar.com', password: 'hussain123', status: 'Active', lastLogin: '13/02/2026 04:30 PM', commissionPercent: 0 },
  { id: 'USR-003', username: 'sales_mgr', name: 'Shafikul Islam', role: 'Manager', email: 'shafikul@atwar.com', password: 'shafikul123', status: 'Active', lastLogin: '14/02/2026 10:00 AM', commissionPercent: 5 },
  { id: 'USR-004', username: 'agent_01', name: 'Ahmed Balushi', role: 'Sale Agent', email: 'ahmed.b@atwar.com', password: 'ahmed123', status: 'Active', lastLogin: '12/02/2026 08:45 AM', commissionPercent: 8 },
  { id: 'USR-005', username: 'cashier_01', name: 'Sarah J.', role: 'Cashier', email: 'sarah@atwar.com', password: 'sarah123', status: 'Inactive', lastLogin: '01/01/2026 11:20 AM', commissionPercent: 0 },
];

const initialRoles: Role[] = [
  { id: 1, name: 'Admin', description: 'Full system access with all permissions.', userCount: 1, permissionsCount: 145, isSystem: true },
  { id: 2, name: 'Sales Man', description: 'Standard sales and customer management access.', userCount: 5, permissionsCount: 48, isSystem: false },
  { id: 3, name: 'Order', description: 'Access to purchase orders and requisitions.', userCount: 2, permissionsCount: 24, isSystem: false },
  { id: 4, name: 'Field Payment', description: 'Access to field payments and customer dues.', userCount: 3, permissionsCount: 18, isSystem: false },
  { id: 5, name: 'Manager', description: 'Can manage inventory, purchases and staff.', userCount: 4, permissionsCount: 85, isSystem: false },
];

const initialCommissionAgents: CommissionAgent[] = [
  { id: 1, name: 'Ahmed Al Balushi', email: 'ahmed.b@example.com', contactNo: '+968 9123 4567', address: 'Muscat, Oman', commissionPercentage: 5.0 },
  { id: 2, name: 'Fatma Al Said', email: 'fatma.s@example.com', contactNo: '+968 9234 5678', address: 'Sohar, Oman', commissionPercentage: 3.5 },
];

// Legacy contacts array (minimal — kept so any component using contacts doesn't break)
const initialContacts: Contact[] = [
  { id: 1, type: 'Supplier', contactId: 'SUP-001', name: 'Ali Hassan', businessName: 'Al-Nour Electronics', mobile: '+968 9123 4567', email: 'ali@alnour.com', taxNumber: 'OM12345678', creditLimit: 5000, balance: -1200.50, payTerm: '30 Days', status: 'Active' },
  { id: 2, type: 'Customer', contactId: 'CUS-001', name: 'Mohammed Al-Said', businessName: 'Personal', mobile: '+968 9876 5432', email: 'mohammed@gmail.com', taxNumber: '', creditLimit: 1000, balance: 450.00, payTerm: 'Immediate', status: 'Active' },
];

const initialPurchases: Purchase[] = [
  { id: '1', refNo: 'PO-2023-001', date: '2023-10-25 14:30', location: 'CR:1450968', supplier: 'Kennol Performance Oil', supplierId: 'SUP-1004', status: 'Received', paymentStatus: 'Paid', grandTotal: 1200, paymentDue: 0, addedBy: 'Admin' },
  { id: '2', refNo: 'PO-2023-002', date: '2023-10-26 09:15', location: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649', supplier: 'Global Pet Supplies LLC', supplierId: 'SUP-1002', status: 'Pending', paymentStatus: 'Due', grandTotal: 450.500, paymentDue: 450.500, addedBy: 'Admin' },
  { id: '3', refNo: 'PO-2023-003', date: '2023-10-27 11:00', location: 'CR:1450968', supplier: 'Al Maha Ceramics', supplierId: 'SUP-1003', status: 'Ordered', paymentStatus: 'Partial', grandTotal: 3000, paymentDue: 1500, addedBy: 'Manager' },
  { id: '4', refNo: 'PO-2023-004', date: '2023-10-28 16:45', location: 'CR:1450968', supplier: 'Oman Oil Marketing Co.', supplierId: 'SUP-1001', status: 'Received', paymentStatus: 'Paid', grandTotal: 850.250, paymentDue: 0, addedBy: 'Admin' },
];

const initialSales: Sale[] = [
  // INV-2025-0001 — Zan Supermarket (Partial: paid 50.300, still owes 7.800)
  {
    id: 'SALE-MOCK-001', date: '2025-01-01T10:30', invoiceNo: 'INV-2025-0001', invoiceScheme: 'Atwar',
    customerId: 'CUST-0001', customerName: 'Zan Supermarket (Mobailah)', contactNumber: '96434389', billingAddress: 'Mobailah, Seeb',
    location: 'CR:1450968', saleType: 'Paid', status: 'Final', saleStatus: 'Final',
    paymentStatus: 'Partial', paymentMethod: 'Cash', paymentAccount: 'Cash Account', paymentNote: '',
    items: [
      { id: '0206', name: 'Me-O Creamy Treats Salmon', qty: 25, unitPrice: 1.200, discount: 0, subtotal: 30.000, tax: 0, total: 30.000, unit: 'Packs' },
      { id: '0208', name: 'Purina Friskies Seafood Sensations 1.1kg', qty: 8, unitPrice: 2.950, discount: 0, subtotal: 23.600, tax: 0, total: 23.600, unit: 'Bags' },
      { id: '0071', name: 'Adore hazelnut', qty: 5, unitPrice: 0.900, discount: 0, subtotal: 4.500, tax: 0, total: 4.500, unit: 'Pieces' },
    ],
    subTotal: 58.100, discountType: 'None', discountAmount: 0, tax: 'None',
    grandTotal: 58.100, totalAmount: 58.100, totalPaid: 50.300, sellDue: 7.800,
    shippingCharges: 0, shippingStatus: 'Delivered', totalItems: 3, addedBy: 'Admin', sellNote: '',
  },
  // INV-2026-0001 — Zain Discount Center (Fully Paid)
  {
    id: 'SALE-MOCK-002', date: '2026-02-01T09:15', invoiceNo: 'INV-2026-0001', invoiceScheme: 'Knwz Ard Alkhlyj',
    customerId: 'CUST-0002', customerName: 'Zain Discount Center', contactNumber: '+96891665656', billingAddress: 'Seeb',
    location: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649', saleType: 'Paid', status: 'Final', saleStatus: 'Final',
    paymentStatus: 'Paid', paymentMethod: 'Cash', paymentAccount: 'Cash Account', paymentNote: '',
    items: [
      { id: '0146', name: 'Activated Carbon 5L', qty: 75, unitPrice: 1.520, discount: 0, subtotal: 114.000, tax: 0, total: 114.000, unit: 'Pieces' },
    ],
    subTotal: 114.000, discountType: 'None', discountAmount: 0, tax: 'None',
    grandTotal: 114.000, totalAmount: 114.000, totalPaid: 114.000, sellDue: 0,
    shippingCharges: 0, shippingStatus: 'Delivered', totalItems: 1, addedBy: 'Shafikul Islam', sellNote: '',
  },
  // INV-2026-0002 — Yellow Way LLC (Credit Sale, fully due)
  {
    id: 'SALE-MOCK-003', date: '2026-01-15T14:00', invoiceNo: 'INV-2026-0002', invoiceScheme: 'Knwz Ard Alkhlyj',
    customerId: 'CUST-0003', customerName: 'Yellow Way LLC (Mobailah)', contactNumber: '+96892345678', billingAddress: 'Mobailah',
    location: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649', saleType: 'Credit Sale', status: 'Final', saleStatus: 'Final',
    payTerm: '30 Days', paymentStatus: 'Due', paymentMethod: 'Cash', paymentAccount: 'Cash Account', paymentNote: '',
    items: [
      { id: '0202', name: 'Shell Helix Ultra 5W-40 4L', qty: 15, unitPrice: 14.200, discount: 0, subtotal: 213.000, tax: 10.650, total: 223.650, unit: 'Bottles' },
      { id: '0209', name: 'Danna 10W40 Engine Oil 1L', qty: 36, unitPrice: 2.500, discount: 0, subtotal: 90.000, tax: 4.500, total: 94.500, unit: 'Bottles' },
    ],
    subTotal: 303.000, discountType: 'None', discountAmount: 0, tax: 'VAT@5%',
    grandTotal: 318.150, totalAmount: 318.150, totalPaid: 0, sellDue: 318.150,
    shippingCharges: 0, shippingStatus: 'Delivered', totalItems: 2, addedBy: 'Admin', sellNote: '',
  },
  // INV-2026-0003 — Happy Pets Shop (Partial: paid 215.600, still owes 150.500)
  {
    id: 'SALE-MOCK-004', date: '2026-02-10T11:30', invoiceNo: 'INV-2026-0003', invoiceScheme: 'Atwar',
    customerId: 'CUST-0004', customerName: 'Happy Pets Shop', contactNumber: '98887777', billingAddress: 'Muscat',
    location: 'CR:1450968', saleType: 'Paid', status: 'Final', saleStatus: 'Final',
    payTerm: '15 Days', paymentStatus: 'Partial', paymentMethod: 'Card', paymentAccount: 'Bank Account', paymentNote: '',
    items: [
      { id: '0201', name: 'Royal Canin Maxi Adult 15kg', qty: 10, unitPrice: 28.500, discount: 0, subtotal: 285.000, tax: 14.250, total: 299.250, unit: 'Bags' },
      { id: '0203', name: 'Whiskas Tuna Flavour 1.2kg', qty: 14, unitPrice: 3.800, discount: 0, subtotal: 53.200, tax: 0, total: 53.200, unit: 'Packs' },
      { id: '0204', name: 'Flexi New Classic Retractable Leash', qty: 2, unitPrice: 6.500, discount: 0, subtotal: 13.000, tax: 0.650, total: 13.650, unit: 'Pieces' },
    ],
    subTotal: 351.200, discountType: 'None', discountAmount: 0, tax: 'VAT@5%',
    grandTotal: 366.100, totalAmount: 366.100, totalPaid: 215.600, sellDue: 150.500,
    shippingCharges: 0, shippingStatus: 'Delivered', totalItems: 3, addedBy: 'Shafikul Islam', sellNote: '',
  },
  // INV-2026-0004 — Al Khaleej Stores (Fully Paid)
  {
    id: 'SALE-MOCK-005', date: '2026-02-05T15:45', invoiceNo: 'INV-2026-0004', invoiceScheme: 'Atwar',
    customerId: 'CUST-0005', customerName: 'Al Khaleej Stores', contactNumber: '+96895678901', billingAddress: 'Muscat',
    location: 'CR:1450968', saleType: 'Paid', status: 'Final', saleStatus: 'Final',
    paymentStatus: 'Paid', paymentMethod: 'Bank Transfer', paymentAccount: 'Bank Account', paymentNote: 'Bank transfer received',
    items: [
      { id: '0205', name: 'Pedigree Adult Chicken & Vegetables 3kg', qty: 40, unitPrice: 4.800, discount: 0, subtotal: 192.000, tax: 9.600, total: 201.600, unit: 'Bags' },
      { id: '0207', name: 'Trixie Cat Scratching Post', qty: 4, unitPrice: 12.900, discount: 0, subtotal: 51.600, tax: 2.580, total: 54.180, unit: 'Pieces' },
    ],
    subTotal: 243.600, discountType: 'None', discountAmount: 0, tax: 'VAT@5%',
    grandTotal: 255.780, totalAmount: 255.780, totalPaid: 255.780, sellDue: 0,
    shippingCharges: 0, shippingStatus: 'Delivered', totalItems: 2, addedBy: 'Ahmed Balushi', sellNote: '',
  },
];

const initialPayments: Payment[] = [
  // Partial payment for INV-2025-0001 (Zan Supermarket)
  { id: 'pay-SALE-MOCK-001', date: '2025-01-01T10:30', contactId: 'CUST-0001', contactName: 'Zan Supermarket (Mobailah)', contactType: 'Customer', amount: 50.300, method: 'Cash', account: 'Cash Account', referenceNo: 'SP-INV-2025-0001', note: 'Payment for invoice INV-2025-0001', type: 'received', linkedInvoices: ['INV-2025-0001'], addedBy: 'Admin' },
  // Full payment for INV-2026-0001 (Zain Discount Center)
  { id: 'pay-SALE-MOCK-002', date: '2026-02-01T09:15', contactId: 'CUST-0002', contactName: 'Zain Discount Center', contactType: 'Customer', amount: 114.000, method: 'Cash', account: 'Cash Account', referenceNo: 'SP-INV-2026-0001', note: 'Payment for invoice INV-2026-0001', type: 'received', linkedInvoices: ['INV-2026-0001'], addedBy: 'Shafikul Islam' },
  // Partial payment for INV-2026-0003 (Happy Pets Shop)
  { id: 'pay-SALE-MOCK-004', date: '2026-02-10T11:30', contactId: 'CUST-0004', contactName: 'Happy Pets Shop', contactType: 'Customer', amount: 215.600, method: 'Card', account: 'Bank Account', referenceNo: 'SP-INV-2026-0003', note: 'Payment for invoice INV-2026-0003', type: 'received', linkedInvoices: ['INV-2026-0003'], addedBy: 'Shafikul Islam' },
  // Full payment for INV-2026-0004 (Al Khaleej Stores)
  { id: 'pay-SALE-MOCK-005', date: '2026-02-05T15:45', contactId: 'CUST-0005', contactName: 'Al Khaleej Stores', contactType: 'Customer', amount: 255.780, method: 'Bank Transfer', account: 'Bank Account', referenceNo: 'SP-INV-2026-0004', note: 'Payment for invoice INV-2026-0004', type: 'received', linkedInvoices: ['INV-2026-0004'], addedBy: 'Ahmed Balushi' },
];

const initialTaxRates: TaxRate[] = [
  { id: 'TAX-001', name: 'VAT@5%', rate: 5, type: 'Exclusive', description: 'Standard Omani VAT' },
  { id: 'TAX-002', name: 'No Tax', rate: 0, type: 'Exclusive', description: 'Tax exempt items' },
];

const initialCustomerGroups: CustomerGroup[] = [
  { id: 'GRP-001', name: 'Supermarkets Customers', discountPercent: 0, description: 'Supermarket and grocery retailers' },
  { id: 'GRP-002', name: 'Wholesale', discountPercent: 5, description: 'Wholesale buyers' },
  { id: 'GRP-003', name: 'Pet Shops', discountPercent: 2, description: 'Pet specialty stores' },
  { id: 'GRP-004', name: 'Individual', discountPercent: 0, description: 'Walk-in / individual customers' },
];

const initialExpenseCategories: ExpenseCategory[] = [
  { id: 'ECAT-001', name: 'Rent', description: 'Rent and premises expenses', code: 'RENT' },
  { id: 'ECAT-002', name: 'Utilities', description: 'Electricity, water, internet', code: 'UTIL' },
  { id: 'ECAT-003', name: 'Salaries', description: 'Staff salaries and wages', code: 'SAL' },
  { id: 'ECAT-004', name: 'Transport', description: 'Vehicle fuel, delivery', code: 'TRANS' },
  { id: 'ECAT-005', name: 'Marketing', description: 'Advertising and marketing', code: 'MKT' },
  { id: 'ECAT-006', name: 'Office Supplies', description: 'Stationery and supplies', code: 'OFFICE' },
];

const defaultSettings: AppSettings = {
  businessName: 'Atwar Al Mustaqbal',
  businessLogo: '',
  startDate: '11/10/2023',
  defaultProfitPercent: '25.000',
  currency: 'OMR',
  currencySymbol: 'OMR',
  currencySymbolPlacement: 'before',
  timeZone: 'Asia/Dubai',
  fyStartMonth: 'January',
  stockAccountingMethod: 'fifo',
  transactionEditDays: '0',
  dateFormat: 'dd/mm/yyyy',
  timeFormat: '12',
  currencyPrecision: 3,
  quantityPrecision: 3,
  enableProductExpiry: true,
  enableBrands: true,
  enableCategories: true,
  enableSerialNumbers: false,
  enableLotNumbers: true,
  salesInvoicePrefix: 'INV-',
  purchasePrefix: 'PO-',
  quotationPrefix: 'QT-',
  paymentPrefix: 'PAY-',
  defaultSalePaymentMethod: 'Cash',
  defaultPurchasePaymentMethod: 'Cash',
  defaultSaleDiscount: '0',
  defaultSaleTax: 'VAT@5%',
  defaultCreditSaleDays: '30',
  defaultPayTerm: 'No Limit',
  defaultCreditLimit: '0',
  posEnableDiscount: true,
  posEnableTax: true,
  posDefaultPaymentMethod: 'Cash',
  taxLabel: 'VAT',
  enableTax: true,
  tax1Name: 'VAT',
  tax1Number: '',
  tax2Name: '',
  tax2Number: '',
  // Prefixes (extended)
  stockTransferPrefix: 'ST',
  stockAdjustmentPrefix: 'SA',
  sellReturnPrefix: 'CN',
  expensesPrefix: 'EP',
  contactsPrefix: 'CO',
  purchasePaymentPrefix: 'PP',
  sellPaymentPrefix: 'SP',
  // Product settings
  skuPrefix: '',
  defaultUnit: '',
  enableSubCategories: true,
  // Dashboard
  stockExpiryAlertDays: '200',
  // System
  defaultTableEntries: '25',
  // Sale (extended)
  allowOverselling: false,
  isPayTermRequired: false,
  // Purchases (extended)
  enableEditPriceFromPurchase: true,
  enablePurchaseStatus: true,
  enableLotNumber: true,
  enablePurchaseOrder: true,
  enablePurchaseRequisition: true,
  // Sale settings (extended)
  enableSalesOrder: true,
  // Modules
  enablePOS: true,
  enablePurchases: true,
  enableExpenses: true,
  enableStockTransfers: true,
  enableCommissionAgents: true,
  enableRewardPoints: false,
};

const DATA_SEED_KEY = 'app_data_seeded_v3';

// ============================================================
//  CONTEXT
// ============================================================

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export const GlobalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  // ---- Products ----
  const [products, setProducts] = useState<Product[]>(() => {
    try { const s = localStorage.getItem('app_products_v2'); return s ? JSON.parse(s) : initialProducts; } catch { return initialProducts; }
  });

  // ---- Customers ----
  const [customers, setCustomers] = useState<Customer[]>(() => {
    try { const s = localStorage.getItem('app_customers_v2'); return s ? JSON.parse(s) : initialCustomers; } catch { return initialCustomers; }
  });

  // ---- Suppliers ----
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    try { const s = localStorage.getItem('app_suppliers_v2'); return s ? JSON.parse(s) : initialSuppliers; } catch { return initialSuppliers; }
  });

  // ---- Legacy contacts ----
  const [contacts, setContacts] = useState<Contact[]>(() => {
    try { const s = localStorage.getItem('app_contacts'); return s ? JSON.parse(s) : initialContacts; } catch { return initialContacts; }
  });

  // ---- Sales ----
  const [sales, setSales] = useState<Sale[]>(() => {
    try {
      const s = localStorage.getItem('app_sales');
      const parsed = s ? JSON.parse(s) : null;
      // Seed mock data on first load (when no real sales exist yet)
      if (!parsed || (parsed.length === 0 && !localStorage.getItem(DATA_SEED_KEY))) return initialSales;
      return parsed;
    } catch { return initialSales; }
  });

  // ---- Purchases ----
  const [purchases, setPurchases] = useState<Purchase[]>(() => {
    try { const s = localStorage.getItem('app_purchases'); return s ? JSON.parse(s) : initialPurchases; } catch { return initialPurchases; }
  });

  // ---- Orders ----
  const [orders, setOrders] = useState<GlobalOrder[]>(() => {
    try { const s = localStorage.getItem('app_orders'); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  // ---- Payments ----
  const [payments, setPayments] = useState<Payment[]>(() => {
    try {
      const s = localStorage.getItem('app_payments');
      const parsed = s ? JSON.parse(s) : null;
      // Seed mock data on first load (when no real payments exist yet)
      if (!parsed || (parsed.length === 0 && !localStorage.getItem(DATA_SEED_KEY))) return initialPayments;
      return parsed;
    } catch { return initialPayments; }
  });

  // ---- Expenses ----
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try { const s = localStorage.getItem('app_expenses'); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  // ---- Expense Categories ----
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>(() => {
    try { const s = localStorage.getItem('app_expense_categories'); return s ? JSON.parse(s) : initialExpenseCategories; } catch { return initialExpenseCategories; }
  });

  // ---- Users ----
  const [users, setUsers] = useState<AppUser[]>(() => {
    try { const s = localStorage.getItem('app_users'); return s ? JSON.parse(s) : initialUsers; } catch { return initialUsers; }
  });

  // ---- Roles ----
  const [roles, setRoles] = useState<Role[]>(() => {
    try { const s = localStorage.getItem('app_roles'); return s ? JSON.parse(s) : initialRoles; } catch { return initialRoles; }
  });

  // ---- Commission Agents ----
  const [commissionAgents, setCommissionAgents] = useState<CommissionAgent[]>(() => {
    try { const s = localStorage.getItem('app_commission_agents'); return s ? JSON.parse(s) : initialCommissionAgents; } catch { return initialCommissionAgents; }
  });

  // ---- Locations ----
  const [locations, setLocations] = useState<Location[]>(() => {
    try {
      const s = localStorage.getItem('app_locations');
      if (s) {
        const parsed = JSON.parse(s);
        if (parsed && parsed.length > 0) return parsed;
      }
      return initialLocations;
    } catch { return initialLocations; }
  });

  // ---- Tax Rates ----
  const [taxRates, setTaxRates] = useState<TaxRate[]>(() => {
    try { const s = localStorage.getItem('app_tax_rates'); return s ? JSON.parse(s) : initialTaxRates; } catch { return initialTaxRates; }
  });

  // ---- Customer Groups ----
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>(() => {
    try { const s = localStorage.getItem('app_customer_groups'); return s ? JSON.parse(s) : initialCustomerGroups; } catch { return initialCustomerGroups; }
  });

  // ---- Settings ----
  const [settings, setSettings] = useState<AppSettings>(() => {
    try { const s = localStorage.getItem('app_settings'); return s ? { ...defaultSettings, ...JSON.parse(s) } : defaultSettings; } catch { return defaultSettings; }
  });

  // ---- Auth ----
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try { const s = localStorage.getItem('app_current_user'); return s ? JSON.parse(s) : null; } catch { return null; }
  });

  // ============================================================
  //  PERSIST TO LOCALSTORAGE
  // ============================================================

  useEffect(() => { localStorage.setItem('app_products_v2', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('app_customers_v2', JSON.stringify(customers)); }, [customers]);
  useEffect(() => { localStorage.setItem('app_suppliers_v2', JSON.stringify(suppliers)); }, [suppliers]);
  useEffect(() => { localStorage.setItem('app_contacts', JSON.stringify(contacts)); }, [contacts]);
  // Mark mock data as seeded so we don't re-seed after user clears their own data
  useEffect(() => { localStorage.setItem(DATA_SEED_KEY, '1'); }, []);
  useEffect(() => { localStorage.setItem('app_sales', JSON.stringify(sales)); }, [sales]);
  useEffect(() => { localStorage.setItem('app_purchases', JSON.stringify(purchases)); }, [purchases]);
  useEffect(() => { localStorage.setItem('app_orders', JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem('app_payments', JSON.stringify(payments)); }, [payments]);
  useEffect(() => { localStorage.setItem('app_expenses', JSON.stringify(expenses)); }, [expenses]);
  useEffect(() => { localStorage.setItem('app_expense_categories', JSON.stringify(expenseCategories)); }, [expenseCategories]);
  useEffect(() => { localStorage.setItem('app_users', JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem('app_roles', JSON.stringify(roles)); }, [roles]);
  useEffect(() => { localStorage.setItem('app_commission_agents', JSON.stringify(commissionAgents)); }, [commissionAgents]);
  useEffect(() => { localStorage.setItem('app_locations', JSON.stringify(locations)); }, [locations]);
  useEffect(() => { localStorage.setItem('app_tax_rates', JSON.stringify(taxRates)); }, [taxRates]);
  useEffect(() => { localStorage.setItem('app_customer_groups', JSON.stringify(customerGroups)); }, [customerGroups]);
  useEffect(() => { localStorage.setItem('app_settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => {
    if (currentUser) { localStorage.setItem('app_current_user', JSON.stringify(currentUser)); }
    else { localStorage.removeItem('app_current_user'); }
  }, [currentUser]);

  // ============================================================
  //  UTILITY FUNCTIONS
  // ============================================================

  const formatCurrency = (amount: number): string => {
    const precision = settings.currencyPrecision;
    const formatted = amount.toLocaleString('en-OM', { minimumFractionDigits: precision, maximumFractionDigits: precision });
    return settings.currencySymbolPlacement === 'before'
      ? `${settings.currencySymbol} ${formatted}`
      : `${formatted} ${settings.currencySymbol}`;
  };

  const generateId = (prefix: string): string => {
    return `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  };

  // Generates the next invoice number based on existing sales
  const nextInvoiceNumber = (locationId?: string): string => {
    const prefix = settings.salesInvoicePrefix || 'INV-';
    const year = new Date().getFullYear();
    const locationSales = locationId
      ? sales.filter(s => s.location === locationId)
      : sales;
    const count = locationSales.length + 1;
    return `${prefix}${year}-${String(count).padStart(4, '0')}`;
  };

  // ============================================================
  //  CRUD: PRODUCTS
  // ============================================================

  const addProduct = (product: Product) => setProducts(prev => [...prev, product]);
  const updateProduct = (product: Product) => setProducts(prev => prev.map(p => p.id === product.id ? product : p));
  const deleteProduct = (id: string) => setProducts(prev => prev.filter(p => p.id !== id));

  // ============================================================
  //  CRUD: CUSTOMERS
  // ============================================================

  const addCustomer = (customer: Customer) => setCustomers(prev => [...prev, customer]);
  const updateCustomer = (customer: Customer) => setCustomers(prev => prev.map(c => c.id === customer.id ? customer : c));
  const deleteCustomer = (id: string) => setCustomers(prev => prev.filter(c => c.id !== id));

  // ============================================================
  //  CRUD: SUPPLIERS
  // ============================================================

  const addSupplier = (supplier: Supplier) => setSuppliers(prev => [...prev, supplier]);
  const updateSupplier = (supplier: Supplier) => setSuppliers(prev => prev.map(s => s.id === supplier.id ? supplier : s));
  const deleteSupplier = (id: string) => setSuppliers(prev => prev.filter(s => s.id !== id));

  // ============================================================
  //  CRUD: CONTACTS (legacy)
  // ============================================================

  const addContact = (contact: Contact) => setContacts(prev => [...prev, contact]);
  const updateContact = (contact: Contact) => setContacts(prev => prev.map(c => c.id === contact.id ? contact : c));
  const deleteContact = (id: number) => setContacts(prev => prev.filter(c => c.id !== id));

  // ============================================================
  //  CRUD: SALES
  //  Only Final sales affect stock and customer due balances
  // ============================================================

  const isFinalizedSale = (sale: Sale): boolean => (sale.status || sale.saleStatus) === 'Final';

  const saleDueAmount = (sale: Sale): number => {
    if (sale.paymentStatus === 'Paid') return 0;
    if (typeof sale.sellDue === 'number') return Math.max(0, sale.sellDue);
    return Math.max(0, (sale.grandTotal || sale.totalAmount || 0) - (sale.totalPaid || 0));
  };

  const isWalkInSale = (sale: Sale): boolean => !sale.customerId || sale.customerId === 'WALK-IN';

  const isSaleCustomerMatch = (customer: Customer, sale: Sale): boolean => {
    return customer.id === String(sale.customerId) || customer.businessName === sale.customerName;
  };

  const buildSaleStockDelta = (sale: Sale, multiplier: number): Record<string, number> => {
    const delta: Record<string, number> = {};
    (sale.items || []).forEach(item => {
      const key = String(item.id || '').trim();
      if (!key) return;
      delta[key] = (delta[key] || 0) + (multiplier * (item.qty || 0));
    });
    return delta;
  };

  const mergeStockDelta = (target: Record<string, number>, next: Record<string, number>) => {
    Object.entries(next).forEach(([k, v]) => {
      target[k] = (target[k] || 0) + v;
    });
  };

  const applyStockDelta = (deltaByProduct: Record<string, number>) => {
    if (Object.keys(deltaByProduct).length === 0) return;
    setProducts(prevProducts => prevProducts.map(p => {
      const delta = (deltaByProduct[p.id] || 0) + (deltaByProduct[p.sku] || 0);
      if (!delta) return p;
      return { ...p, stock: p.stock + delta };
    }));
  };

  const addSale = (sale: Sale) => {
    setSales(prev => [...prev, sale]);

    if (isFinalizedSale(sale)) {
      applyStockDelta(buildSaleStockDelta(sale, -1));

      if (!isWalkInSale(sale)) {
        const dueToAdd = saleDueAmount(sale);
        setCustomers(prev => prev.map(c => {
          if (!isSaleCustomerMatch(c, sale)) return c;
          return {
            ...c,
            lastSellDate: new Date().toISOString().split('T')[0],
            totalSellDue: c.totalSellDue + dueToAdd,
          };
        }));
      }

      // Auto-create a payment record if money was collected at time of sale
      const paidAmount = typeof sale.totalPaid === 'number' ? sale.totalPaid : 0;
      if (paidAmount > 0) {
        const prefix = settings.sellPaymentPrefix || 'SP';
        const payRef = `${prefix}-${sale.invoiceNo || Date.now()}`;
        const payRecord: Payment = {
          id: `pay-${sale.id}`,
          date: sale.date,
          contactId: String(sale.customerId || 'WALK-IN'),
          contactName: sale.customerName || 'Walk-in Customer',
          contactType: 'Customer',
          amount: paidAmount,
          method: sale.paymentMethod || 'Cash',
          account: sale.paymentAccount || 'Cash Account',
          referenceNo: payRef,
          note: sale.paymentNote || `Payment for invoice ${sale.invoiceNo}`,
          type: 'received',
          linkedInvoices: sale.invoiceNo ? [sale.invoiceNo] : [],
          addedBy: sale.addedBy || 'System',
        };
        setPayments(prev => [...prev, payRecord]);
      }
    }
  };

  const updateSale = (sale: Sale) => {
    setSales(prev => {
      const oldSale = prev.find(s => s.id === sale.id);
      if (!oldSale) return prev;

      const stockDelta: Record<string, number> = {};
      if (isFinalizedSale(oldSale)) mergeStockDelta(stockDelta, buildSaleStockDelta(oldSale, +1)); // undo old
      if (isFinalizedSale(sale)) mergeStockDelta(stockDelta, buildSaleStockDelta(sale, -1));       // apply new
      applyStockDelta(stockDelta);

      const oldDue = isFinalizedSale(oldSale) && !isWalkInSale(oldSale) ? saleDueAmount(oldSale) : 0;
      const newDue = isFinalizedSale(sale) && !isWalkInSale(sale) ? saleDueAmount(sale) : 0;
      setCustomers(prevCustomers => prevCustomers.map(c => {
        let next = c;
        if (oldDue > 0 && isSaleCustomerMatch(next, oldSale)) {
          next = { ...next, totalSellDue: Math.max(0, next.totalSellDue - oldDue) };
        }
        if (newDue > 0 && isSaleCustomerMatch(next, sale)) {
          next = {
            ...next,
            lastSellDate: new Date().toISOString().split('T')[0],
            totalSellDue: next.totalSellDue + newDue,
          };
        }
        return next;
      }));

      return prev.map(s => s.id === sale.id ? sale : s);
    });

    // Sync the auto-generated payment record if paid amount changed
    if (isFinalizedSale(sale)) {
      const paidAmount = typeof sale.totalPaid === 'number' ? sale.totalPaid : 0;
      const payId = `pay-${sale.id}`;
      const prefix = settings.sellPaymentPrefix || 'SP';
      const payRef = `${prefix}-${sale.invoiceNo || Date.now()}`;
      if (paidAmount > 0) {
        setPayments(prev => {
          const exists = prev.find(p => p.id === payId);
          const record: Payment = {
            id: payId,
            date: sale.date,
            contactId: String(sale.customerId || 'WALK-IN'),
            contactName: sale.customerName || 'Walk-in Customer',
            contactType: 'Customer',
            amount: paidAmount,
            method: sale.paymentMethod || 'Cash',
            account: sale.paymentAccount || 'Cash Account',
            referenceNo: payRef,
            note: sale.paymentNote || `Payment for invoice ${sale.invoiceNo}`,
            type: 'received',
            linkedInvoices: sale.invoiceNo ? [sale.invoiceNo] : [],
            addedBy: sale.addedBy || 'System',
          };
          return exists ? prev.map(p => p.id === payId ? record : p) : [...prev, record];
        });
      } else {
        // Payment was removed (changed to Credit Sale) — remove the auto record
        setPayments(prev => prev.filter(p => p.id !== payId));
      }
    }
  };

  const deleteSale = (id: string) => {
    setSales(prev => {
      const saleToDelete = prev.find(s => s.id === id);
      if (!saleToDelete) return prev.filter(s => s.id !== id);

      if (isFinalizedSale(saleToDelete)) {
        applyStockDelta(buildSaleStockDelta(saleToDelete, +1));
      }

      if (!isWalkInSale(saleToDelete) && isFinalizedSale(saleToDelete)) {
        const dueToRemove = saleDueAmount(saleToDelete);
        if (dueToRemove > 0) {
          setCustomers(prevCustomers => prevCustomers.map(c => {
            if (!isSaleCustomerMatch(c, saleToDelete)) return c;
            return { ...c, totalSellDue: Math.max(0, c.totalSellDue - dueToRemove) };
          }));
        }
      }

      return prev.filter(s => s.id !== id);
    });
    // Remove the auto-generated payment record for this sale
    setPayments(prev => prev.filter(p => p.id !== `pay-${id}`));
  };

  // ============================================================
  //  CRUD: PURCHASES
  //  addPurchase also: increases stock, updates supplier totalPurchaseDue
  // ============================================================

  const addPurchase = (purchase: Purchase) => {
    setPurchases(prev => [...prev, purchase]);

    // Increase stock if status is Received
    if (purchase.status === 'Received' && purchase.items) {
      setProducts(prev => {
        const updated = [...prev];
        purchase.items!.forEach(item => {
          const idx = updated.findIndex(p => p.id === item.id || p.name === item.name);
          if (idx !== -1) {
            updated[idx] = { ...updated[idx], stock: updated[idx].stock + item.qty };
          }
        });
        return updated;
      });
    }

    // Update supplier totalPurchaseDue if not fully paid
    if (purchase.supplierId) {
      setSuppliers(prev => prev.map(s => {
        if (s.id === purchase.supplierId || s.businessName === purchase.supplier) {
          const addedDue = purchase.paymentStatus !== 'Paid' ? purchase.paymentDue : 0;
          return { ...s, totalPurchaseDue: s.totalPurchaseDue + addedDue };
        }
        return s;
      }));
    }
  };

  const updatePurchase = (purchase: Purchase) => setPurchases(prev => prev.map(p => p.id === purchase.id ? purchase : p));
  const deletePurchase = (id: string) => setPurchases(prev => prev.filter(p => p.id !== id));

  // ============================================================
  //  CRUD: ORDERS
  // ============================================================

  const addOrder = (order: GlobalOrder) => setOrders(prev => [...prev, order]);
  const updateOrder = (order: GlobalOrder) => setOrders(prev => prev.map(o => o.id === order.id ? order : o));
  const deleteOrder = (id: string) => setOrders(prev => prev.filter(o => o.id !== id));

  // ============================================================
  //  CRUD: PAYMENTS
  //  addPayment also: updates sale paymentStatus + customer/supplier balances
  // ============================================================

  const addPayment = (payment: Payment) => {
    setPayments(prev => [...prev, payment]);

    if (payment.contactType === 'Customer') {
      // Apply payment to outstanding customer invoices (FIFO)
      let remaining = payment.amount;
      setSales(prev => {
        const updated = [...prev];
        // Sort by date ascending (oldest first)
        const dueInvoices = updated
          .map((s, i) => ({ s, i }))
          .filter(({ s }) =>
            (s.customerName === payment.contactName || String(s.customerId) === payment.contactId) &&
            (s.paymentStatus === 'Due' || s.paymentStatus === 'Partial' || s.paymentStatus === 'Overdue')
          )
          .sort((a, b) => new Date(a.s.date).getTime() - new Date(b.s.date).getTime());

        dueInvoices.forEach(({ s, i }) => {
          if (remaining <= 0) return;
          const due = s.sellDue || 0;
          const paying = Math.min(remaining, due);
          remaining -= paying;
          const newPaid = (s.totalPaid || 0) + paying;
          const newDue = due - paying;
          updated[i] = {
            ...s,
            totalPaid: newPaid,
            sellDue: newDue,
            paymentStatus: newDue <= 0.001 ? 'Paid' : 'Partial',
          };
        });
        return updated;
      });

      // Update customer balance
      setCustomers(prev => prev.map(c => {
        if (c.id === payment.contactId || c.businessName === payment.contactName) {
          const newDue = Math.max(0, c.totalSellDue - payment.amount);
          const newAdv = payment.amount > c.totalSellDue ? c.advanceBalance + (payment.amount - c.totalSellDue) : c.advanceBalance;
          return { ...c, totalSellDue: newDue, advanceBalance: newAdv };
        }
        return c;
      }));
    }

    if (payment.contactType === 'Supplier') {
      // Update supplier totalPurchaseDue
      setSuppliers(prev => prev.map(s => {
        if (s.id === payment.contactId || s.businessName === payment.contactName) {
          const newDue = Math.max(0, s.totalPurchaseDue - payment.amount);
          const newAdv = payment.amount > s.totalPurchaseDue ? s.advanceBalance + (payment.amount - s.totalPurchaseDue) : s.advanceBalance;
          return { ...s, totalPurchaseDue: newDue, advanceBalance: newAdv };
        }
        return s;
      }));
      // Update purchase payment status
      setPurchases(prev => {
        let remaining = payment.amount;
        return prev.map(p => {
          if (p.supplier !== payment.contactName && p.supplierId !== payment.contactId) return p;
          if (remaining <= 0) return p;
          if (p.paymentStatus === 'Paid') return p;
          const paying = Math.min(remaining, p.paymentDue);
          remaining -= paying;
          const newDue = p.paymentDue - paying;
          return { ...p, paymentDue: newDue, paymentStatus: newDue <= 0.001 ? 'Paid' : 'Partial' };
        });
      });
    }
  };

  const updatePayment = (payment: Payment) => setPayments(prev => prev.map(p => p.id === payment.id ? payment : p));
  const deletePayment = (id: string) => setPayments(prev => prev.filter(p => p.id !== id));

  // ============================================================
  //  CRUD: EXPENSES
  // ============================================================

  const addExpense = (expense: Expense) => setExpenses(prev => [...prev, expense]);
  const updateExpense = (expense: Expense) => setExpenses(prev => prev.map(e => e.id === expense.id ? expense : e));
  const deleteExpense = (id: string) => setExpenses(prev => prev.filter(e => e.id !== id));

  const addExpenseCategory = (cat: ExpenseCategory) => setExpenseCategories(prev => [...prev, cat]);
  const updateExpenseCategory = (cat: ExpenseCategory) => setExpenseCategories(prev => prev.map(c => c.id === cat.id ? cat : c));
  const deleteExpenseCategory = (id: string) => setExpenseCategories(prev => prev.filter(c => c.id !== id));

  // ============================================================
  //  CRUD: USERS
  // ============================================================

  const addUser = (user: AppUser) => setUsers(prev => [...prev, user]);
  const updateUser = (user: AppUser) => setUsers(prev => prev.map(u => u.id === user.id ? user : u));
  const deleteUser = (id: string) => setUsers(prev => prev.filter(u => u.id !== id));

  // ============================================================
  //  CRUD: ROLES
  // ============================================================

  const addRole = (role: Role) => setRoles(prev => [...prev, role]);
  const updateRole = (role: Role) => setRoles(prev => prev.map(r => r.id === role.id ? role : r));
  const deleteRole = (id: number) => setRoles(prev => prev.filter(r => r.id !== id));

  // ============================================================
  //  CRUD: COMMISSION AGENTS
  // ============================================================

  const addCommissionAgent = (agent: CommissionAgent) => setCommissionAgents(prev => [...prev, agent]);
  const updateCommissionAgent = (agent: CommissionAgent) => setCommissionAgents(prev => prev.map(a => a.id === agent.id ? agent : a));
  const deleteCommissionAgent = (id: number) => setCommissionAgents(prev => prev.filter(a => a.id !== id));

  // ============================================================
  //  CRUD: LOCATIONS
  // ============================================================

  const addLocation = (location: Location) => setLocations(prev => [...prev, location]);
  const updateLocation = (location: Location) => setLocations(prev => prev.map(l => l.id === location.id ? location : l));
  const deleteLocation = (id: string) => setLocations(prev => prev.filter(l => l.id !== id));

  // ============================================================
  //  CRUD: TAX RATES
  // ============================================================

  const addTaxRate = (tax: TaxRate) => setTaxRates(prev => [...prev, tax]);
  const updateTaxRate = (tax: TaxRate) => setTaxRates(prev => prev.map(t => t.id === tax.id ? tax : t));
  const deleteTaxRate = (id: string) => setTaxRates(prev => prev.filter(t => t.id !== id));

  // ============================================================
  //  CRUD: CUSTOMER GROUPS
  // ============================================================

  const addCustomerGroup = (group: CustomerGroup) => setCustomerGroups(prev => [...prev, group]);
  const updateCustomerGroup = (group: CustomerGroup) => setCustomerGroups(prev => prev.map(g => g.id === group.id ? group : g));
  const deleteCustomerGroup = (id: string) => setCustomerGroups(prev => prev.filter(g => g.id !== id));

  // ============================================================
  //  SETTINGS
  // ============================================================

  const updateSettings = (newSettings: AppSettings) => setSettings(newSettings);

  // ============================================================
  //  PROVIDE CONTEXT
  // ============================================================

  return (
    <GlobalContext.Provider value={{
      products, setProducts, addProduct, updateProduct, deleteProduct,
      customers, setCustomers, addCustomer, updateCustomer, deleteCustomer,
      suppliers, setSuppliers, addSupplier, updateSupplier, deleteSupplier,
      contacts, setContacts, addContact, updateContact, deleteContact,
      sales, setSales, addSale, updateSale, deleteSale,
      purchases, setPurchases, addPurchase, updatePurchase, deletePurchase,
      orders, setOrders, addOrder, updateOrder, deleteOrder,
      payments, setPayments, addPayment, updatePayment, deletePayment,
      expenses, setExpenses, addExpense, updateExpense, deleteExpense,
      expenseCategories, setExpenseCategories, addExpenseCategory, updateExpenseCategory, deleteExpenseCategory,
      users, setUsers, addUser, updateUser, deleteUser,
      roles, setRoles, addRole, updateRole, deleteRole,
      commissionAgents, setCommissionAgents, addCommissionAgent, updateCommissionAgent, deleteCommissionAgent,
      locations, setLocations, addLocation, updateLocation, deleteLocation,
      taxRates, setTaxRates, addTaxRate, updateTaxRate, deleteTaxRate,
      customerGroups, setCustomerGroups, addCustomerGroup, updateCustomerGroup, deleteCustomerGroup,
      settings, updateSettings,
      currentUser, setCurrentUser,
      formatCurrency, generateId, nextInvoiceNumber,
    }}>
      {children}
    </GlobalContext.Provider>
  );
};

export const useGlobalContext = () => {
  const context = useContext(GlobalContext);
  if (context === undefined) {
    throw new Error('useGlobalContext must be used within a GlobalProvider');
  }
  return context;
};
