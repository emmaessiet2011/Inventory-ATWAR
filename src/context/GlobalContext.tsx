import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import {
  applyStockLotAdjustments,
  bootstrapStockLotsFromDB,
  readStockLotBalances,
  writeStockLotBalances,
} from '../utils/stockLots';
import {
  bootstrapStockTransfersFromDB,
  readStockTransfers,
  writeStockTransfers,
} from '../utils/stockTransfers';
import {
  bootstrapStockAdjustmentsFromDB,
  readStockAdjustments,
  writeStockAdjustments,
} from '../utils/stockAdjustments';
import {
  fetchLocationInventoryFromDB,
  syncChangedLocationInventoryStrict,
  inventoryKey,
} from '../utils/stockLocationInventory';
import {
  bootstrapRegisterFromDB,
  getActiveRegisterSession,
  getRegisterSessions,
  setActiveRegisterSession,
  setRegisterSessions,
} from '../utils/registerLedger';
import {
  normalizePackagingType,
  normalizeUnitsPerPackage,
} from '../utils/productPackaging';
import {
  dispatchPaymentAccountsUpdated,
  getStoredPaymentAccounts,
  resolveDefaultAccountFromMethod,
  setStoredPaymentAccounts,
  setStoredPaymentAccountTypes,
} from '../utils/paymentAccounts';
import {
  generatePasswordSalt,
  hashPasswordSecret,
} from '../utils/authSecurity';
import {
  AUTH_PERSISTENT_STORAGE_KEY,
  AUTH_REMEMBER_ME_STORAGE_KEY,
  AUTH_SESSION_STORAGE_KEY,
  clearAuthToken,
  readAuthToken,
  readHardenedState,
  removeLegacyKeys,
  writeHardenedState,
} from '../utils/hardenedStorage';
import {
  isCoreSyncEnabled,
  pingBackend,
} from '../utils/coreStateSync';
import {
  apiFetchAll,
  apiFetchAllWithRetry,
  updateUserPreferences as updateUserPreferencesApi,
  hasValidAuthToken,
  isLiveSyncEnabled,
  syncRecordStrict,
  deleteRecordStrict,
  syncDedicatedStrict,
  fetchDedicated,
} from '../utils/apiClient';
import { getSellingPriceGroupProductRules } from '../utils/sellingPriceGroups';
import type { ProductPackagingType } from '../utils/productPackaging';

// ============================================================
//  INTERFACES — Every data shape used across the app
// ============================================================

export interface ContactDocument {
  id: string;
  heading: string;
  fileName?: string;
  addedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariationRow {
  id: string;
  variationId: string;
  values: string;
  sku: string;
  purchasePrice: number;
  margin: number;
  sellingPrice: number;
}

export interface ProductComboItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  qty: number;
  unitPrice: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  type: 'Single' | 'Variable' | 'Combo';
  categoryId?: string;
  category: string;
  brandId?: string;
  brand: string;
  tax: string;                    // e.g. '--' or 'VAT@5%'
  businessLocation: string;
  availableLocationIds?: string[];
  availableLocations?: string[];
  unitPurchasePrice: number;
  sellingPrice: number;
  stock: number;
  unit: string;
  packagingType?: ProductPackagingType;
  unitsPerPackage?: number;
  image: string;
  brochureName?: string;
  brochureData?: string;
  alertQuantity?: number;         // low-stock threshold
  expiryDate?: string;
  expiryPeriod?: number;
  expiryPeriodUnit?: 'Days' | 'Months';
  lotNumber?: string;
  description?: string;
  customField1?: string;
  customField2?: string;
  customField3?: string;
  customField4?: string;
  warranty?: string;              // warranty ID or name
  barcodeType?: string;
  taxType?: string;
  weight?: number;
  notForSelling?: boolean;
  enableSerialNumber?: boolean;
  subCategory?: string;
  openingStock?: number;
  variationRows?: ProductVariationRow[];
  comboItems?: ProductComboItem[];
  rack?: string;
  row?: string;
  position?: string;
  locationRackDetails?: Record<string, { rack: string; row: string; position: string }>;
  serviceStaffTimer?: number;
  openingStockLocation?: string;
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
  customerGroupId?: string;
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
  documents?: ContactDocument[];
  contactCategory?: 'Individual' | 'Business';
  rewardPoints?: number;
  rebatePercent?: number;   // % rebate applied on payments (e.g. 5 = 5%)
  sellingPriceGroupId?: string;
  sellingPriceGroup?: string;
  sellingPriceGroupMode?: 'auto' | 'manual';
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
  documents?: ContactDocument[];
  contactCategory?: 'Supplier' | 'Individual';
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
  quantityMode?: ProductPackagingType;
  quantityInput?: number;
  unitsPerPackage?: number;
  productPackagingType?: ProductPackagingType;
  unitPrice: number;
  discount: number;
  subtotal: number;
  tax: number;
  total: number;
  unit?: string;
}

export type ShippingStatus =
  | 'Pending'
  | 'Ordered'
  | 'Packed'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled';

export const SHIPPING_STATUS_OPTIONS: ShippingStatus[] = [
  'Ordered',
  'Pending',
  'Packed',
  'Shipped',
  'Delivered',
  'Cancelled',
];

export interface ShippingActivity {
  date: string;
  action: string;
  by: string;
  note: string;
}

export interface ShippingDocumentMeta {
  name: string;
  type?: string;
  size?: number;
  lastModified?: number;
}

export interface Sale {
  id: string;
  date: string;
  paymentDate?: string;
  invoiceNo: string;
  invoiceScheme?: string;
  invoiceLayout?: string;
  customerId: number | string;
  customerName?: string;
  customerGroupId?: string;
  customerGroup?: string;
  contactNumber?: string;
  billingAddress?: string;
  shippingAddress?: string;
  location?: string;
  saleType?: string;
  saleStatus?: string;
  sellingPriceGroupId?: string;
  sellingPriceGroup?: string;
  sellingPriceGroupMode?: 'auto' | 'manual';
  sellingPriceGroupDiscount?: number;
  sellingPriceGroupPriceAdj?: number;
  sellingPriceGroupTaxRate?: number;
  payTerm?: string;
  payTermValue?: number;
  payTermType?: 'Days' | 'Months';
  dueDate?: string;
  paymentStatus: 'Paid' | 'Due' | 'Partial' | 'Overdue';
  paymentMethod?: string;
  paymentAccount?: string;
  paymentNote?: string;
  totalAmount?: number;
  totalPaid?: number;
  sellDue?: number;
  sellReturnDue?: number;
  sellReturns?: SellReturn[];
  discount?: string;
  orderTax?: string;
  shippingStatus?: ShippingStatus;
  shippingDetails?: string;
  shippingCharges: number;
  deliveredTo?: string;
  deliveryPerson?: string;
  shippingNote?: string;
  shippingDocName?: string;
  shippingActivities?: ShippingActivity[];
  shippingDocument?: ShippingDocumentMeta;
  commissionAgentId?: string | number;
  commissionAgentName?: string;
  commissionRate?: number;
  commissionAmount?: number;
  commissionCalculationType?: 'Invoice value' | 'Paid amount';
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
  status: 'Final' | 'Draft' | 'Quotation' | 'Proforma';
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
  expiryDate?: string;
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
  purchaseTaxId?: string;
  purchaseTaxName?: string;
  purchaseTaxAmount?: number;
  shippingCharges?: number;
  shippingDetails?: string;
  attachDocumentName?: string;
  purchaseOrderId?: string;
  purchaseOrderRef?: string;
  purchaseRequisitionId?: string;
  purchaseRequisitionRef?: string;
  paidOn?: string;
  paymentNote?: string;
  notes?: string;
  paymentMethod?: string;
  paymentAmount?: number;
}

export interface PurchaseRequisition {
  id: string;
  date: string;
  referenceNo: string;
  location: string;
  supplier: string;
  supplierId?: string;
  status: 'Pending' | 'Approved' | 'Ordered';
  addedBy: string;
  brand?: string;
  category?: string;
  requiredByDate?: string;
  items?: PurchaseRequisitionItem[];
  note?: string;
}

export interface PurchaseRequisitionItem {
  productId: string;
  productName: string;
  alertQty: number;
  requiredQty: number;
}

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  orderQty: number;
  unitCostBeforeDiscount: number;
  discountPercent: number;
  unitCostBeforeTax: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  id: string;
  orderDate: string;
  referenceNo: string;
  supplierId: string;
  supplierName: string;
  supplierAddress?: string;
  location: string;
  deliveryDate?: string;
  payTermValue?: string;
  payTermType?: 'Days' | 'Months';
  attachDocumentName?: string;
  purchaseRequisitionId?: string;
  purchaseRequisitionRef?: string;
  items: PurchaseOrderItem[];
  shippingDetails?: string;
  shippingAddress?: string;
  shippingCharges: number;
  shippingStatus?: 'Pending' | 'Ordered' | 'Shipped' | 'Delivered';
  deliveredTo?: string;
  shippingDocumentName?: string;
  additionalExpenses?: number;
  additionalNotes?: string;
  totalItems: number;
  netTotalAmount: number;
  orderTotal: number;
  status: 'Draft' | 'Sent' | 'Received' | 'Partial';
  addedBy: string;
}

export interface PurchaseReturnItem {
  productId: string;
  productName: string;
  lotNumber?: string;
  expDate?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface PurchaseReturn {
  id: string;
  date: string;
  referenceNo: string;
  supplierId: string;
  supplierName: string;
  location: string;
  attachDocumentName?: string;
  parentPurchaseId?: string;
  parentPurchaseRef?: string;
  items: PurchaseReturnItem[];
  purchaseTaxId?: string;
  purchaseTaxName?: string;
  purchaseTaxAmount: number;
  subTotal: number;
  grandTotal: number;
  paymentStatus: 'Paid' | 'Due' | 'Partial';
  paymentDue: number;
  addedBy: string;
}

export interface SellReturnItem {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  soldQty?: number;
  unit?: string;
}

export type SellReturnSettlementMode =
  | 'refund_due'
  | 'refund_now'
  | 'apply_to_invoice_due'
  | 'customer_credit';

export interface SellReturn {
  id: string;
  referenceNo: string;
  parentSaleId: string;
  parentInvoiceNo: string;
  date: string;
  customerId: string;
  customerName: string;
  location: string;
  discountType: 'None' | 'Fixed' | 'Percentage';
  discountAmount: number;
  tax: string;
  subTotal: number;
  taxAmount: number;
  total: number;
  settlementMode?: SellReturnSettlementMode;
  appliedToSaleDue?: number;
  creditedToAdvance?: number;
  autoRefundPaymentId?: string;
  paymentStatus: 'Paid' | 'Due' | 'Partial';
  paymentDue: number;
  note?: string;
  items: SellReturnItem[];
  addedBy: string;
}

export interface OrderItem {
  id: string | number;
  productId?: string;
  productSku?: string;
  name: string;
  qty: number;
  quantityMode?: ProductPackagingType;
  quantityInput?: number;
  unitsPerPackage?: number;
  productPackagingType?: ProductPackagingType;
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
  businessLocation?: string;
  items: OrderItem[];
  itemCount: number;
  subTotal: number;
  discountType?: 'None' | 'Fixed' | 'Percentage';
  discountAmount?: number;
  taxType: string;
  taxAmount: number;
  total: number;
  driver?: string;
  area: string;
  salesRep: string;
  deliveryAddress?: string;
  note?: string;
  addedBy?: string;
  convertedSaleId?: string;
  convertedInvoiceNo?: string;
  convertedAt?: string;
  isApproved?: boolean;
  approvedBy?: string;
  approvedAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface Payment {
  id: string;
  date: string;
  contactId: string;
  contactName: string;
  contactType: 'Customer' | 'Supplier' | 'Expense';
  amount: number;
  method: string;
  account: string;
  location?: string;
  referenceNo: string;
  note: string;
  type: 'received' | 'sent'; // received = customer pays us; sent = we pay supplier
  linkedInvoices?: string[];
  strictLinkedAllocation?: boolean; // if true, only linkedInvoices are settled; extra becomes advance
  addedBy?: string;
  attachmentName?: string;
  attachmentData?: string;
  expenseId?: string;
  rebatePercent?: number;   // % at time of payment (snapshot from customer profile)
  rebateAmount?: number;    // Amount written off as rebate
  rebateApplied?: boolean;  // Whether rebate was applied for this payment
  // Cheque-specific fields (only set when method === 'Cheque')
  chequeDate?: string;      // Post-dated cheque date (YYYY-MM-DD)
  chequeNo?: string;        // Cheque number printed on the cheque
  bankName?: string;        // Bank the cheque is drawn on
  drawerName?: string;      // Name written on the cheque
  chequeCleared?: boolean;  // true once cheque has been deposited/cleared
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
  taxRateId?: string;
  taxName?: string;
  totalAmount: number;
  paymentStatus: 'Paid' | 'Due' | 'Partial';
  paymentDue: number;
  expenseFor: string;
  contact: string;
  paymentAccount: string;
  paymentMethod: string;
  note: string;
  paidAmount?: number;
  paidOn?: string;
  paymentNote?: string;
  addedById?: string;
  attachmentName?: string;
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

export interface ActivityLogEntry {
  id: string;
  user: string;
  action: string;
  module: string;
  description: string;
  date: string;
  ipAddress?: string;
}

export interface ActivityLogInput {
  action: string;
  module: string;
  description: string;
  user?: string;
  date?: string;
  ipAddress?: string;
  id?: string;
}

export interface AppUser {
  id: string;
  username: string;
  name: string;
  role: 'CEO' | 'Manager' | 'Sale Agent' | 'Cashier' | 'Admin' | 'Sales Man' | 'Order' | 'Field Payment' | string;
  email: string;
  password?: string;
  passwordHash?: string;
  passwordSalt?: string;
  passwordUpdatedAt?: string;
  status: 'Active' | 'Inactive';
  lastLogin: string;
  commissionPercent?: number;
  maxDiscountPercent?: number;
  businessLocation?: string;
  accessLocations?: string[];
  accessCategories?: string[];
  allowSelectedContacts?: boolean;
  allowLogin?: boolean;
  enableServiceStaffPin?: boolean;
  prefix?: string;
  mobile?: string;
  altContact?: string;
  familyContact?: string;
  dob?: string;
  gender?: string;
  maritalStatus?: string;
  bloodGroup?: string;
  facebook?: string;
  twitter?: string;
  social1?: string;
  social2?: string;
  guardianName?: string;
  idProofName?: string;
  idProofNumber?: string;
  permanentAddress?: string;
  currentAddress?: string;
  accountHolder?: string;
  accountNumber?: string;
  bankName?: string;
  bankIdentifierCode?: string;
  branch?: string;
  taxPayerId?: string;
  documents?: ContactDocument[];
  preferences?: Record<string, unknown>;
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
  linkedUserId?: string;
  name: string;
  email: string;
  contactNo: string;
  address: string;
  commissionPercentage: number;
  isActive?: boolean;
  prefix?: string;
  firstName?: string;
  lastName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  enabled: boolean;
  account: string;
}

export interface ReceiptPrinter {
  id: string;
  name: string;
  connectionType: 'Network' | 'Windows' | 'Linux';
  capabilityProfile: string;
  charactersPerLine: number;
  ipAddress: string;
  port: string;
  path: string;
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
  altContact?: string;
  email: string;
  website: string;
  isActive: boolean;
  priceGroup: string;
  invoiceScheme: string;
  invoiceLayoutPos: string;
  invoiceLayoutSale: string;
  posFeaturedProducts?: string;
  businessLogo?: string;
  autoPrintInvoiceAfterFinalizing?: boolean;
  receiptPrinterType?: 'browser' | 'network';
  receiptPrinterId?: string;
  paymentMethods?: PaymentMethod[];
}

export interface CrudMutationResult {
  ok: boolean;
  status?: number;
  error?: string;
}

export interface LocationMutationResult extends Partial<CrudMutationResult> {
  success: boolean;
  message?: string;
}

export interface InvoiceScheme {
  id: string;
  name: string;
  prefix: string;
  numberingType: 'Sequential';
  startFrom: number;
  numberOfDigits: number;
  isDefault: boolean;
}

export interface InvoiceLayout {
  id: string;
  name: string;
  design: string;
  isDefault: boolean;
  headerHtml?: string;
  footerHtml?: string;
  showClientLogo?: boolean;
  bodyTemplate?: InvoiceLayoutBodyTemplate;
}

export interface InvoiceLayoutBodyTemplate {
  invoiceHeading?: string;
  showInvoiceLogo?: boolean;
  showBusinessName?: boolean;
  showLocationName?: boolean;
  showCustomerTaxNumber?: boolean;
  showCustomerMobile?: boolean;
  showPaymentInformation?: boolean;
  footerText?: string;
  labels?: InvoiceLayoutLabels;
}

export interface InvoiceLayoutLabels {
  invoiceNo?: string;
  date?: string;
  customer?: string;
  customerTaxNumber?: string;
  mobile?: string;
  product?: string;
  quantity?: string;
  unitPrice?: string;
  subtotal?: string;
  tax?: string;
  total?: string;
  paid?: string;
  due?: string;
}

export interface BarcodeStickerSetting {
  id: string;
  name: string;
  description: string;
  isContinuousFeed: boolean;
  additionalTopMargin: number;
  additionalLeftMargin: number;
  stickerWidth: number;
  stickerHeight: number;
  paperWidth: number;
  paperHeight: number;
  stickersInOneRow: number;
  distanceBetweenRows: number;
  distanceBetweenColumns: number;
  stickersInOneSheet: number;
  isDefault: boolean;
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
  sellingPriceGroupId?: string;
  sellingPriceGroup?: string;
  status?: 'Active' | 'Inactive';
  calculationPercentage?: number;
}

export interface ProductCategory {
  id: string;
  name: string;
  code?: string;
  description?: string;
}

export interface ProductBrand {
  id: string;
  name: string;
  note?: string;
}

export interface ProductUnit {
  id: string;
  name: string;
  shortName: string;
  allowDecimal: boolean;
}

export interface ProductWarranty {
  id: string;
  name: string;
  description?: string;
  duration: number;
  durationUnit: 'Days' | 'Months' | 'Years';
}

export interface SellingPriceGroupProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  discount: number;
}

export interface SellingPriceGroup {
  id: string;
  name: string;
  description: string;
  payTermDays: number;
  payTermUnit: 'Days' | 'Months';
  taxRate: number;
  discount: number;
  priceCalcPercentage: number;
  status: 'Active' | 'Inactive';
  applicableProducts?: SellingPriceGroupProduct[];
  meta?: Record<string, any>;
}

export interface ProductVariation {
  id: string;
  name: string;
  values: string[];
}

export interface Discount {
  id: string;
  name: string;
  products?: string;
  productIds?: string[];
  brand?: string;
  category?: string;
  location?: string;
  priority?: string | number;
  discountType?: 'Fixed' | 'Percentage' | string;
  discountAmount?: string | number;
  startsAt?: string;
  endsAt?: string;
  sellingPriceGroup?: string;
  isActive?: boolean;
  applyInCustomerGroups?: boolean;
  selectedGroups?: string[];
}

export interface AppSettings {
  businessName: string;
  businessAddress: string;
  businessCity: string;
  address: string;
  businessLogo?: string;
  invoiceFooterText?: string;
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
  productExpiryAction: 'Keep Selling' | 'Stop Selling';
  productExpiryGraceDays: string;
  enablePriceTaxInfo: boolean;
  enableRacks: boolean;
  enableWarranty: boolean;
  enableRow: boolean;
  isProductImageRequired: boolean;
  enableSubUnits: boolean;
  enablePosition: boolean;
  // Sale settings
  salesInvoicePrefix: string;
  draftPrefix: string;
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
  disableMultiplePay: boolean;
  disableDraft: boolean;
  disableQuotation: boolean;
  disableExpressCheckout: boolean;
  dontShowProductSuggestion: boolean;
  dontShowRecentTransactions: boolean;
  subtotalEditable: boolean;
  disableSuspendSale: boolean;
  enableTransactionDateOnPOSScreens: boolean;
  enableServiceStaffInProductLine: boolean;
  isServiceStaffRequired: boolean;
  enableWeighingScale: boolean;
  weighingScaleBarcodePrefix: string;
  weighingScaleProductSkuLength: number;
  weighingScaleQuantityIntegerPartLength: number;
  weighingScaleQuantityFractionalPartLength: number;
  showPricingOnProductSuggestionTooltip: boolean;
  posShortcutExpressCheckout: string;
  posShortcutPayCheckout: string;
  posShortcutDraft: string;
  posShortcutCancel: string;
  posShortcutProductQty: string;
  posShortcutWeighingScale: string;
  posShortcutEditDiscount: string;
  posShortcutEditOrderTax: string;
  posShortcutAddPaymentRow: string;
  posShortcutFinalizePayment: string;
  posShortcutAddNewProduct: string;
  // Tax
  taxLabel: string;
  enableTax: boolean;
  taxNumber: string;
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
  expensePaymentPrefix: string;
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
  saleItemAdditionMethod: string;
  amountRoundingMethod: string;
  salesPriceIsMinimumSellingPrice: boolean;
  isPayTermRequired: boolean;
  filterProductsByLocation: boolean;
  salesCommissionAgent: 'Disable' | 'Enable';
  commissionCalculationType: 'Invoice value' | 'Paid amount';
  isCommissionAgentRequired: boolean;
  // Purchases (extended)
  enableEditPriceFromPurchase: boolean;
  enablePurchaseStatus: boolean;
  enableLotNumber: boolean;
  enablePurchaseOrder: boolean;
  enablePurchaseRequisition: boolean;
  // Sale settings (extended)
  enableSalesOrder: boolean;
  showInvoiceScheme: boolean;
  showInvoiceLayoutDropdown: boolean;
  printInvoiceOnSuspend: boolean;
  disableCreditSaleButton: boolean;
  // Modules
  enablePOS: boolean;
  enablePurchases: boolean;
  enableExpenses: boolean;
  enableFieldPayments: boolean;
  enablePaymentAccounts: boolean;
  enableStockTransfers: boolean;
  enableStockAdjustments: boolean;
  enableShipments: boolean;
  enableDiscounts: boolean;
  enableImportSales: boolean;
  enableCustomerGroupsReport: boolean;
  enableStockReport: boolean;
  enableTrendingProductsReport: boolean;
  enableItemsReport: boolean;
  enableProductPurchaseReport: boolean;
  enableProductSellReport: boolean;
  enablePurchasePaymentReport: boolean;
  enableSellPaymentReport: boolean;
  enableActivityLog: boolean;
  enableCommissionAgents: boolean;
  enableRewardPoints: boolean;
  cashDenominations: string;
  cashDenominationEnabledOn: string;
  cashDenominationPaymentMethods: string;
  strictCashDenominationCheck: boolean;
  usernamePrefix: string;
  subscriptionPrefix: string;
  salesOrderPrefix: string;
  rewardPointDisplayName: string;
  rewardAmountPerPoint: string;
  rewardMinOrderToEarn: string;
  rewardMaxPointsPerOrder: string;
  rewardRedeemAmountPerPoint: string;
  rewardMinOrderToRedeem: string;
  rewardMinRedeemPoint: string;
  rewardMaxRedeemPerOrder: string;
  rewardExpiryPeriod: string;
  rewardExpiryUnit: 'Day' | 'Month' | 'Year';
  // System appearance
  themeColor: string;
}

// ============================================================
//  CONTEXT TYPE
// ============================================================

interface GlobalContextType {
  // --- Products ---
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  addProduct: (product: Product) => Promise<CrudMutationResult>;
  updateProduct: (product: Product) => Promise<CrudMutationResult>;
  deleteProduct: (id: string) => Promise<CrudMutationResult>;

  // --- Customers ---
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  addCustomer: (customer: Customer) => Promise<CrudMutationResult>;
  updateCustomer: (customer: Customer) => Promise<CrudMutationResult>;
  deleteCustomer: (id: string) => Promise<CrudMutationResult>;
  addCustomerRewardPoints: (customerId: string, points: number) => Promise<CrudMutationResult>;
  redeemCustomerRewardPoints: (customerId: string, points: number) => Promise<CrudMutationResult>;

  // --- Suppliers ---
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  addSupplier: (supplier: Supplier) => Promise<CrudMutationResult>;
  updateSupplier: (supplier: Supplier) => Promise<CrudMutationResult>;
  deleteSupplier: (id: string) => Promise<CrudMutationResult>;

  // --- Contacts (legacy — derived from customers + suppliers) ---
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  addContact: (contact: Contact) => Promise<CrudMutationResult>;
  updateContact: (contact: Contact) => Promise<CrudMutationResult>;
  deleteContact: (id: number) => Promise<CrudMutationResult>;

  // --- Sales ---
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  addSale: (sale: Sale) => Promise<CrudMutationResult>;
  updateSale: (sale: Sale) => Promise<CrudMutationResult>;
  deleteSale: (id: string) => Promise<CrudMutationResult>;

  // --- Sell Returns ---
  sellReturns: SellReturn[];
  setSellReturns: React.Dispatch<React.SetStateAction<SellReturn[]>>;
  addSellReturn: (sellReturn: SellReturn) => Promise<CrudMutationResult>;
  updateSellReturn: (sellReturn: SellReturn) => Promise<CrudMutationResult>;
  deleteSellReturn: (id: string) => Promise<CrudMutationResult>;

  // --- Purchases ---
  purchases: Purchase[];
  setPurchases: React.Dispatch<React.SetStateAction<Purchase[]>>;
  addPurchase: (purchase: Purchase) => Promise<CrudMutationResult>;
  updatePurchase: (purchase: Purchase) => Promise<CrudMutationResult>;
  deletePurchase: (id: string) => Promise<CrudMutationResult>;

  // --- Purchase Requisitions ---
  purchaseRequisitions: PurchaseRequisition[];
  setPurchaseRequisitions: React.Dispatch<React.SetStateAction<PurchaseRequisition[]>>;
  addPurchaseRequisition: (requisition: PurchaseRequisition) => Promise<CrudMutationResult>;
  updatePurchaseRequisition: (requisition: PurchaseRequisition) => Promise<CrudMutationResult>;
  deletePurchaseRequisition: (id: string) => Promise<CrudMutationResult>;

  // --- Purchase Orders ---
  purchaseOrders: PurchaseOrder[];
  setPurchaseOrders: React.Dispatch<React.SetStateAction<PurchaseOrder[]>>;
  addPurchaseOrder: (order: PurchaseOrder) => Promise<CrudMutationResult>;
  updatePurchaseOrder: (order: PurchaseOrder) => Promise<CrudMutationResult>;
  deletePurchaseOrder: (id: string) => Promise<CrudMutationResult>;

  // --- Purchase Returns ---
  purchaseReturns: PurchaseReturn[];
  setPurchaseReturns: React.Dispatch<React.SetStateAction<PurchaseReturn[]>>;
  addPurchaseReturn: (purchaseReturn: PurchaseReturn) => Promise<CrudMutationResult>;
  updatePurchaseReturn: (purchaseReturn: PurchaseReturn) => Promise<CrudMutationResult>;
  deletePurchaseReturn: (id: string) => Promise<CrudMutationResult>;

  // --- Payments ---
  payments: Payment[];
  setPayments: React.Dispatch<React.SetStateAction<Payment[]>>;
  addPayment: (payment: Payment, options?: { skipActivity?: boolean; skipPermissionBoundary?: boolean }) => Promise<CrudMutationResult>;
  updatePayment: (payment: Payment) => Promise<CrudMutationResult>;
  deletePayment: (id: string, options?: { skipActivity?: boolean; skipServerDelete?: boolean; skipPermissionBoundary?: boolean }) => Promise<CrudMutationResult>;

  // --- Expenses ---
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  addExpense: (expense: Expense) => Promise<CrudMutationResult>;
  updateExpense: (expense: Expense) => Promise<CrudMutationResult>;
  deleteExpense: (id: string) => Promise<CrudMutationResult>;

  // --- Expense Categories ---
  expenseCategories: ExpenseCategory[];
  setExpenseCategories: React.Dispatch<React.SetStateAction<ExpenseCategory[]>>;
  addExpenseCategory: (cat: ExpenseCategory) => Promise<CrudMutationResult>;
  updateExpenseCategory: (cat: ExpenseCategory) => Promise<CrudMutationResult>;
  deleteExpenseCategory: (id: string) => Promise<CrudMutationResult>;

  // --- Users ---
  users: AppUser[];
  setUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;
  addUser: (user: AppUser) => Promise<CrudMutationResult>;
  updateUser: (user: AppUser) => Promise<CrudMutationResult>;
  deleteUser: (id: string) => Promise<CrudMutationResult>;

  // --- Roles ---
  roles: Role[];
  setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
  addRole: (role: Role) => Promise<CrudMutationResult>;
  updateRole: (role: Role) => Promise<CrudMutationResult>;
  deleteRole: (id: number) => Promise<CrudMutationResult>;

  // --- Commission Agents ---
  commissionAgents: CommissionAgent[];
  setCommissionAgents: React.Dispatch<React.SetStateAction<CommissionAgent[]>>;
  addCommissionAgent: (agent: CommissionAgent) => Promise<CrudMutationResult>;
  updateCommissionAgent: (agent: CommissionAgent) => Promise<CrudMutationResult>;
  deleteCommissionAgent: (id: number) => Promise<CrudMutationResult>;

  // --- Locations ---
  locations: Location[];
  setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
  addLocation: (location: Location) => Promise<LocationMutationResult>;
  updateLocation: (location: Location) => Promise<LocationMutationResult>;
  deleteLocation: (id: string) => Promise<LocationMutationResult>;

  // --- Receipt Printers ---
  printers: ReceiptPrinter[];
  setPrinters: React.Dispatch<React.SetStateAction<ReceiptPrinter[]>>;
  addPrinter: (printer: ReceiptPrinter) => Promise<CrudMutationResult>;
  updatePrinter: (printer: ReceiptPrinter) => Promise<CrudMutationResult>;
  deletePrinter: (id: string) => Promise<CrudMutationResult>;

  // --- Invoice Settings ---
  invoiceSchemes: InvoiceScheme[];
  setInvoiceSchemes: React.Dispatch<React.SetStateAction<InvoiceScheme[]>>;
  addInvoiceScheme: (scheme: InvoiceScheme) => Promise<CrudMutationResult>;
  updateInvoiceScheme: (scheme: InvoiceScheme) => Promise<CrudMutationResult>;
  deleteInvoiceScheme: (id: string) => Promise<LocationMutationResult>;
  invoiceLayouts: InvoiceLayout[];
  setInvoiceLayouts: React.Dispatch<React.SetStateAction<InvoiceLayout[]>>;
  addInvoiceLayout: (layout: InvoiceLayout) => Promise<CrudMutationResult>;
  updateInvoiceLayout: (layout: InvoiceLayout) => Promise<CrudMutationResult>;
  deleteInvoiceLayout: (id: string) => Promise<LocationMutationResult>;

  // --- Barcode Settings ---
  barcodeSettings: BarcodeStickerSetting[];
  setBarcodeSettings: React.Dispatch<React.SetStateAction<BarcodeStickerSetting[]>>;
  addBarcodeSetting: (setting: BarcodeStickerSetting) => Promise<CrudMutationResult>;
  updateBarcodeSetting: (setting: BarcodeStickerSetting) => Promise<CrudMutationResult>;
  deleteBarcodeSetting: (id: string) => Promise<LocationMutationResult>;

  // --- Tax Rates ---
  taxRates: TaxRate[];
  setTaxRates: React.Dispatch<React.SetStateAction<TaxRate[]>>;
  addTaxRate: (tax: TaxRate) => Promise<CrudMutationResult>;
  updateTaxRate: (tax: TaxRate) => Promise<CrudMutationResult>;
  deleteTaxRate: (id: string) => Promise<CrudMutationResult>;

  // --- Customer Groups ---
  customerGroups: CustomerGroup[];
  setCustomerGroups: React.Dispatch<React.SetStateAction<CustomerGroup[]>>;
  addCustomerGroup: (group: CustomerGroup) => Promise<CrudMutationResult>;
  updateCustomerGroup: (group: CustomerGroup) => Promise<CrudMutationResult>;
  deleteCustomerGroup: (id: string, reassignToGroupId?: string) => Promise<CrudMutationResult>;

  // --- Product Categories ---
  productCategories: ProductCategory[];
  setProductCategories: React.Dispatch<React.SetStateAction<ProductCategory[]>>;
  addProductCategory: (cat: ProductCategory) => Promise<CrudMutationResult>;
  updateProductCategory: (cat: ProductCategory) => Promise<CrudMutationResult>;
  deleteProductCategory: (id: string, reassignToCategoryId?: string) => Promise<CrudMutationResult>;

  // --- Product Brands ---
  productBrands: ProductBrand[];
  setProductBrands: React.Dispatch<React.SetStateAction<ProductBrand[]>>;
  addProductBrand: (brand: ProductBrand) => Promise<CrudMutationResult>;
  updateProductBrand: (brand: ProductBrand) => Promise<CrudMutationResult>;
  deleteProductBrand: (id: string, reassignToBrandId?: string) => Promise<CrudMutationResult>;

  // --- Product Units ---
  productUnits: ProductUnit[];
  setProductUnits: React.Dispatch<React.SetStateAction<ProductUnit[]>>;
  addProductUnit: (unit: ProductUnit) => Promise<CrudMutationResult>;
  updateProductUnit: (unit: ProductUnit) => Promise<CrudMutationResult>;
  deleteProductUnit: (id: string) => Promise<CrudMutationResult>;

  // --- Product Warranties ---
  warranties: ProductWarranty[];
  setWarranties: React.Dispatch<React.SetStateAction<ProductWarranty[]>>;
  addWarranty: (warranty: ProductWarranty) => Promise<CrudMutationResult>;
  updateWarranty: (warranty: ProductWarranty) => Promise<CrudMutationResult>;
  deleteWarranty: (id: string, reassignToWarrantyId?: string) => Promise<CrudMutationResult>;

  // --- Selling Price Groups ---
  sellingPriceGroups: SellingPriceGroup[];
  setSellingPriceGroups: React.Dispatch<React.SetStateAction<SellingPriceGroup[]>>;
  addSellingPriceGroup: (group: SellingPriceGroup) => Promise<CrudMutationResult>;
  updateSellingPriceGroup: (group: SellingPriceGroup) => Promise<CrudMutationResult>;
  deleteSellingPriceGroup: (id: string) => Promise<CrudMutationResult>;

  // --- Product Variations ---
  productVariations: ProductVariation[];
  setProductVariations: React.Dispatch<React.SetStateAction<ProductVariation[]>>;
  addProductVariation: (v: ProductVariation) => Promise<CrudMutationResult>;
  updateProductVariation: (v: ProductVariation) => Promise<CrudMutationResult>;
  deleteProductVariation: (id: string) => Promise<CrudMutationResult>;

  // --- Discounts ---
  discounts: Discount[];
  setDiscounts: React.Dispatch<React.SetStateAction<Discount[]>>;
  addDiscount: (discount: Discount) => Promise<CrudMutationResult>;
  updateDiscount: (discount: Discount) => Promise<CrudMutationResult>;
  deleteDiscount: (id: string) => Promise<CrudMutationResult>;

  // --- Orders ---
  orders: GlobalOrder[];
  setOrders: React.Dispatch<React.SetStateAction<GlobalOrder[]>>;
  addOrder: (order: GlobalOrder) => Promise<CrudMutationResult>;
  updateOrder: (order: GlobalOrder) => Promise<CrudMutationResult>;
  deleteOrder: (id: string) => Promise<CrudMutationResult>;

  // --- Activity Logs ---
  activityLogs: ActivityLogEntry[];
  setActivityLogs: React.Dispatch<React.SetStateAction<ActivityLogEntry[]>>;
  addActivityLog: (entry: ActivityLogInput) => Promise<void>;
  clearActivityLogs: () => void;

  // --- Settings ---
  settings: AppSettings;
  updateSettings: (settings: AppSettings) => Promise<CrudMutationResult>;

  // --- Auth ---
  currentUser: AppUser | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<AppUser | null>>;
  userPreferences: Record<string, unknown>;
  updateCurrentUserPreferences: (
    patch: Record<string, unknown>,
    options?: { replace?: boolean }
  ) => Promise<CrudMutationResult>;

  // --- Utilities ---
  formatCurrency: (amount: number) => string;
  generateId: (prefix: string) => string;
  nextInvoiceNumber: (locationId?: string, prefixOverride?: string) => string;

  // --- Sync Status ---
  syncStatus: 'idle' | 'syncing' | 'error' | 'synced';
}

// ============================================================
//  DEFAULT / SEED DATA
// ============================================================

export const DEFAULT_LOCATION_PAYMENT_METHODS: PaymentMethod[] = [
  { id: '1',  name: 'Cash',            enabled: true, account: 'Cash Account' },
  { id: '2',  name: 'Card',            enabled: true, account: 'Bank Account' },
  { id: '3',  name: 'Cheque',          enabled: true, account: 'Bank Account' },
  { id: '4',  name: 'Bank Transfer',   enabled: true, account: 'Bank Account' },
  { id: '5',  name: 'Other',           enabled: true, account: 'Bank Account' },
  { id: '6',  name: 'Credit',          enabled: true, account: 'Bank Account' },
  { id: '7',  name: 'Yahya',           enabled: true, account: 'Bank Account' },
  { id: '8',  name: 'Emad',            enabled: true, account: 'Bank Account' },
  { id: '9',  name: 'Jaifar',          enabled: true, account: 'Bank Account' },
  { id: '10', name: 'Khalil',          enabled: true, account: 'Bank Account' },
  { id: '11', name: 'Custom Payment 6',enabled: true, account: 'Bank Account' },
  { id: '12', name: 'Custom Payment 7',enabled: true, account: 'Bank Account' },
];

const cloneDefaultLocationPaymentMethods = (): PaymentMethod[] =>
  DEFAULT_LOCATION_PAYMENT_METHODS.map(method => ({ ...method }));

const initialPrinters: ReceiptPrinter[] = [];
const REMOVED_LOCATION_ID = 'BL0002';
const REMOVED_LOCATION_CODE = 'CR:1282649';
const REMOVED_LOCATION_NAME_TERM = 'KNWZ ARD ALKHLYJ ALMTHDH';
const REMOVED_INVOICE_LAYOUT_NAME = 'Knwz Ard Alkhlyj';
const isRemovedLocationRecord = (value: Partial<Location> | null | undefined): boolean => {
  if (!value) return false;
  const id = String(value.id || '').trim().toLowerCase();
  const name = String(value.name || '').trim().toLowerCase();
  return (
    id === REMOVED_LOCATION_ID.toLowerCase()
    || name.includes(String(REMOVED_LOCATION_CODE).toLowerCase())
    || name.includes(String(REMOVED_LOCATION_NAME_TERM).toLowerCase())
  );
};
const isRemovedInvoiceLayoutName = (value: unknown): boolean =>
  String(value || '').trim().toLowerCase() === REMOVED_INVOICE_LAYOUT_NAME.toLowerCase();
const isRemovedInvoiceScheme = (value: Partial<InvoiceScheme> | null | undefined): boolean =>
  isRemovedInvoiceLayoutName(value?.name);
const isRemovedInvoiceLayout = (value: Partial<InvoiceLayout> | null | undefined): boolean =>
  isRemovedInvoiceLayoutName(value?.name);
const normalizeLocationArray = (records: Location[]): Location[] =>
  records.filter((record) => !isRemovedLocationRecord(record));

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
    paymentMethods: cloneDefaultLocationPaymentMethods(),
    autoPrintInvoiceAfterFinalizing: false,
    receiptPrinterType: 'browser',
    receiptPrinterId: '',
    posFeaturedProducts: '',
  }
];

const initialProducts: Product[] = [];

const initialCustomers: Customer[] = [
  { id: 'WALK-IN', type: 'Customer', businessName: 'Direct Customer', name: 'Direct Customer', email: '', taxNumber: '', creditLimit: 0, payTerm: 'Immediate', openingBalance: 0, advanceBalance: 0, totalSellDue: 0, totalSellReturnDue: 0, addedOn: '01/01/2023', customerGroup: '', address: '', mobile: '', status: 'Active' },
];

const initialSuppliers: Supplier[] = [];

const CRITICAL_ADMIN_EMAIL = 'admin@atwar.com';
const normalizeUserEmail = (value: unknown): string => String(value || '').trim().toLowerCase();
const isCriticalAdminUser = (user: Partial<AppUser> | null | undefined): boolean =>
  normalizeUserEmail(user?.email) === CRITICAL_ADMIN_EMAIL;

const normalizeAccessLocations = (
  user: AppUser,
  userMeta: Record<string, unknown>,
): string[] => {
  const isMeaningfulToken = (value: unknown): boolean => {
    const token = String(value || '').trim();
    if (!token) return false;
    const lowered = token.toLowerCase();
    return lowered !== '[object object]' && lowered !== 'undefined' && lowered !== 'null';
  };
  const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const extractTokens = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.flatMap((item) => extractTokens(item));
    if (value && typeof value === 'object') {
      const record = asRecord(value);
      return [
        String(record.id || '').trim(),
        String(record.name || '').trim(),
        String(record.locationId || '').trim(),
        String(record.locationName || '').trim(),
        String(record.location || '').trim(),
        String(record.businessLocation || '').trim(),
      ].filter(isMeaningfulToken);
    }
    const token = String(value || '').trim();
    return isMeaningfulToken(token) ? [token] : [];
  };

  const unsafeUser = user as any;
  const locationTokens = [
    ...extractTokens(user.accessLocations),
    ...extractTokens((userMeta as any).accessLocations),
    ...extractTokens(user.businessLocation),
    ...extractTokens(unsafeUser.locationId),
    ...extractTokens(unsafeUser.locationName),
    ...extractTokens(unsafeUser.location),
    ...extractTokens((userMeta as any).locationId),
    ...extractTokens((userMeta as any).locationName),
    ...extractTokens((userMeta as any).location),
    ...extractTokens((userMeta as any).businessLocation),
  ];

  return Array.from(new Set(locationTokens.map((value) => String(value || '').trim()).filter(isMeaningfulToken)));
};

const normalizeActiveState = (status: unknown, isActiveFallback?: unknown): 'Active' | 'Inactive' => {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  if (normalizedStatus === 'inactive') return 'Inactive';
  if (normalizedStatus === 'active') return 'Active';
  if (typeof isActiveFallback === 'boolean') return isActiveFallback ? 'Active' : 'Inactive';
  return 'Active';
};

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? ({ ...(value as Record<string, unknown>) })
    : {};

const isUserLoginEnabled = (user: Partial<AppUser> | null | undefined): boolean =>
  normalizeActiveState(user?.status, (user as any)?.isActive) === 'Active' &&
  user?.allowLogin !== false;

const initialUsers: AppUser[] = [
  {
    id: 'USR-001',
    username: 'admin_main',
    name: 'Admin User',
    role: 'Admin',
    email: 'admin@atwar.com',
    passwordHash: 'ATWAR-H1$5397ebb1',
    passwordSalt: 'seed-admin-v1',
    passwordUpdatedAt: '2026-01-01T00:00:00.000Z',
    status: 'Active',
    lastLogin: '14/02/2026 09:15 AM',
    commissionPercent: 0,
    allowLogin: true,
    enableServiceStaffPin: false,
  },
];

const normalizeUserRecord = (user: AppUser): AppUser => {
  const normalizedPassword = String((user as any).password || '').trim();
  let passwordHash = String(user.passwordHash || '').trim();
  let passwordSalt = String(user.passwordSalt || '').trim();
  let passwordUpdatedAt = String(user.passwordUpdatedAt || '').trim();
  const normalizedEmail = normalizeUserEmail(user.email);
  let normalizedStatus = normalizeActiveState(user.status, (user as any).isActive);
  const userMeta = toRecord((user as any).meta);
  const relationRoleName = String(toRecord((user as any).role).name || '').trim();
  const directRole = typeof (user as any).role === 'string' ? String((user as any).role) : '';
  const normalizedRole = String(
    directRole
    || relationRoleName
    || (user as any).roleName
    || (user as any).userRole
    || userMeta.role
    || userMeta.roleName
    || userMeta.userRole
    || 'Cashier',
  ).trim();
  const normalizedPreferences = toRecord(
    (user as any).preferences ?? userMeta.preferences,
  );

  if (!passwordHash && normalizedPassword) {
    passwordSalt = passwordSalt || generatePasswordSalt(`${user.id}-${user.email}-${user.username}`);
    passwordHash = hashPasswordSecret(normalizedPassword, passwordSalt);
    passwordUpdatedAt = passwordUpdatedAt || new Date().toISOString();
  }

  const hasCredential = passwordHash.length > 0 && passwordSalt.length > 0;
  let allowLogin = typeof user.allowLogin === 'boolean' ? user.allowLogin : hasCredential;
  if (isCriticalAdminUser({ ...user, email: normalizedEmail })) {
    normalizedStatus = 'Active';
    allowLogin = true;
  }
  const sanitizedUser: AppUser = { ...user };
  delete (sanitizedUser as any).password;

  return {
    ...sanitizedUser,
    role: normalizedRole || 'Cashier',
    email: normalizedEmail,
    status: normalizedStatus,
    passwordHash: hasCredential ? passwordHash : undefined,
    passwordSalt: hasCredential ? passwordSalt : undefined,
    passwordUpdatedAt: hasCredential ? (passwordUpdatedAt || new Date().toISOString()) : undefined,
    accessLocations: normalizeAccessLocations(user, userMeta),
    allowLogin,
    enableServiceStaffPin: user.enableServiceStaffPin ?? false,
    preferences: normalizedPreferences,
  };
};

const normalizeRoleRecord = (role: Role): Role => {
  const normalizedPermissions = Array.isArray(role.permissions)
    ? role.permissions.map(p => String(p)).filter(Boolean)
    : [];
  const normalizedName = String(role.name || '').trim();
  const normalizedDescription = String(role.description || '').trim();
  const derivedPermissionsCount = Array.isArray(role.permissions)
    ? normalizedPermissions.length
    : Number(role.permissionsCount || 0);

  return {
    ...role,
    name: normalizedName || role.name,
    description: normalizedDescription,
    userCount: Number(role.userCount || 0),
    permissionsCount: derivedPermissionsCount,
    isSystem: !!role.isSystem,
    permissions: normalizedPermissions.length > 0 ? normalizedPermissions : undefined,
  };
};

const permissionKeys = (moduleName: string, permissions: string[]): string[] =>
  permissions.map((permission) => `${moduleName}::${permission}`);

const REQUIRED_ROLE_TEMPLATES: Array<Omit<Role, 'id' | 'userCount' | 'permissionsCount'>> = [
  {
    name: 'Order Creator',
    description: 'Can create, edit, and delete unapproved orders.',
    isSystem: false,
    permissions: permissionKeys('Order', ['View order', 'Add order']),
  },
  {
    name: 'Order Approver',
    description: 'Can approve orders and delete approved orders when allowed by lifecycle rules.',
    isSystem: false,
    permissions: permissionKeys('Order', ['View order', 'Approve order']),
  },
  {
    name: 'Order Manager',
    description: 'Can manage full order workflow including creation, approval, and controlled deletion.',
    isSystem: false,
    permissions: permissionKeys('Order', ['View order', 'Add order', 'Edit order', 'Delete order', 'Approve order']),
  },
  {
    name: 'Invoice Generator',
    description: 'Can generate and manage sales invoices from approved orders.',
    isSystem: false,
    permissions: [
      ...permissionKeys('Order', ['View order']),
      ...permissionKeys('Sell', ['View all sell', 'Add Sell', 'Update Sell']),
    ],
  },
  {
    name: 'Field Payment Collector',
    description: 'Can record field collections pending approval.',
    isSystem: false,
    permissions: permissionKeys('Field Payment', ['View field payment', 'Add field payment']),
  },
  {
    name: 'Field Payment Approver',
    description: 'Can approve field payments submitted by collection staff.',
    isSystem: false,
    permissions: permissionKeys('Field Payment', ['View field payment', 'Approval field payment']),
  },
  {
    name: 'Payment Ledger Viewer',
    description: 'Can view customer payment ledger summary without payment edit access.',
    isSystem: false,
    permissions: permissionKeys('Sell', ['View customer payment ledger']),
  },
];

const normalizeRoleNameKey = (value: unknown): string => String(value || '').trim().toLowerCase();

const ensureRequiredRoles = (input: Role[]): Role[] => {
  const normalized = (Array.isArray(input) ? input : [])
    .map(normalizeRoleRecord)
    .filter((role) => !!String(role.name || '').trim());

  const existingNames = new Set(normalized.map((role) => normalizeRoleNameKey(role.name)));
  let nextId = normalized.reduce((max, role) => Math.max(max, Number(role.id) || 0), 0);
  const additions: Role[] = [];

  REQUIRED_ROLE_TEMPLATES.forEach((template) => {
    const key = normalizeRoleNameKey(template.name);
    if (existingNames.has(key)) return;
    existingNames.add(key);
    nextId += 1;
    additions.push(
      normalizeRoleRecord({
        id: nextId,
        name: template.name,
        description: template.description,
        userCount: 0,
        permissionsCount: (template.permissions || []).length,
        isSystem: template.isSystem,
        permissions: template.permissions ? [...template.permissions] : [],
      })
    );
  });

  return additions.length > 0 ? [...normalized, ...additions] : normalized;
};

const shouldRememberAuthSession = (): boolean => {
  try {
    return (
      localStorage.getItem(AUTH_REMEMBER_ME_STORAGE_KEY) === '1'
      || Boolean(localStorage.getItem('atwar_login_identifier'))
    );
  } catch {
    return false;
  }
};

const getAuthTokenPayload = (): Record<string, unknown> | null => {
  try {
    const token = readAuthToken();
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const resolveUserFromAuthToken = (users: AppUser[]): AppUser | null => {
  const payload = getAuthTokenPayload();
  if (!payload) return null;
  const tokenId = String(payload.id || '').trim();
  const tokenEmail = normalizeUserEmail(payload.email);
  const tokenUsername = String(payload.username || '').trim().toLowerCase();
  if (!tokenId && !tokenEmail && !tokenUsername) return null;

  const matched = users.find((user) => {
    const userId = String(user.id || '').trim();
    const userEmail = normalizeUserEmail(user.email);
    const userUsername = String(user.username || '').trim().toLowerCase();
    return (
      (tokenId && userId === tokenId)
      || (tokenEmail && userEmail === tokenEmail)
      || (tokenUsername && userUsername === tokenUsername)
    );
  });
  return matched ? normalizeUserRecord(matched) : null;
};

const normalizeCommissionAgentRecord = (agent: CommissionAgent): CommissionAgent => {
  const normalizedName = String(agent.name || '').trim();
  const resolvedPrefix = String(agent.prefix || '').trim();
  const linkedUserId = String(agent.linkedUserId || '').trim();
  const resolvedFirstName = String(
    agent.firstName || normalizedName.split(' ')[0] || ''
  ).trim();
  const resolvedLastName = String(
    agent.lastName || normalizedName.split(' ').slice(1).join(' ') || ''
  ).trim();
  const displayName = normalizedName || [resolvedPrefix, resolvedFirstName, resolvedLastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return {
    ...agent,
    linkedUserId: linkedUserId || undefined,
    name: displayName,
    prefix: resolvedPrefix,
    firstName: resolvedFirstName,
    lastName: resolvedLastName,
    commissionPercentage: Number.isFinite(Number(agent.commissionPercentage))
      ? Number(agent.commissionPercentage)
      : 0,
    isActive: agent.isActive ?? true,
    createdAt: agent.createdAt || new Date().toISOString(),
    updatedAt: agent.updatedAt || agent.createdAt || new Date().toISOString(),
  };
};

const nextCommissionAgentId = (agents: CommissionAgent[]): number => {
  const maxId = agents.reduce((max, agent) => {
    const parsedId = Number(agent.id);
    return Number.isFinite(parsedId) ? Math.max(max, parsedId) : max;
  }, 0);
  return maxId + 1;
};

const upsertCommissionAgentForUser = (
  agents: CommissionAgent[],
  user: AppUser,
): CommissionAgent[] => {
  const linkedUserId = String(user.id || '').trim();
  if (!linkedUserId) return agents;

  const linkedIndex = agents.findIndex(
    (agent) => String(agent.linkedUserId || '').trim() === linkedUserId,
  );
  const existingLinked = linkedIndex >= 0 ? agents[linkedIndex] : undefined;
  const commissionPercent = Number(user.commissionPercent || 0);
  const shouldExist = Number.isFinite(commissionPercent) && commissionPercent > 0;

  if (!shouldExist) {
    if (linkedIndex < 0) return agents;
    return agents.filter((_, index) => index !== linkedIndex);
  }

  const displayName = String(user.name || user.username || `User ${linkedUserId}`).trim();
  const nameParts = displayName.split(/\s+/).filter(Boolean);
  const nowIso = new Date().toISOString();
  const syncedAgent = normalizeCommissionAgentRecord({
    id: existingLinked?.id ?? nextCommissionAgentId(agents),
    linkedUserId,
    name: displayName,
    prefix: String(existingLinked?.prefix || '').trim(),
    firstName: nameParts[0] || String(existingLinked?.firstName || '').trim(),
    lastName: nameParts.slice(1).join(' ') || String(existingLinked?.lastName || '').trim(),
    email: String(user.email || existingLinked?.email || '').trim(),
    contactNo: String(user.mobile || existingLinked?.contactNo || '').trim(),
    address: String(existingLinked?.address || user.currentAddress || user.permanentAddress || '').trim(),
    commissionPercentage: Number(commissionPercent.toFixed(2)),
    isActive: user.status === 'Active',
    createdAt: existingLinked?.createdAt || nowIso,
    updatedAt: nowIso,
  });

  if (linkedIndex >= 0) {
    const nextAgents = [...agents];
    nextAgents[linkedIndex] = syncedAgent;
    return nextAgents;
  }
  return [...agents, syncedAgent];
};

const normalizePaymentMethodRecord = (input: Partial<PaymentMethod>, index: number): PaymentMethod => {
  const id = String(input.id || `PM-${index + 1}`).trim() || `PM-${index + 1}`;
  const name = String(input.name || `Payment Method ${index + 1}`).trim() || `Payment Method ${index + 1}`;
  const rawAccount = String(input.account || '').trim();
  const account = rawAccount && rawAccount.toLowerCase() !== 'none'
    ? rawAccount
    : resolveDefaultAccountFromMethod(name);
  return {
    id,
    name,
    account,
    enabled: input.enabled !== false,
  };
};

const normalizePrinterRecord = (input: Partial<ReceiptPrinter>, fallback?: Partial<ReceiptPrinter>): ReceiptPrinter => {
  const rawConnectionType = String(
    input.connectionType || fallback?.connectionType || 'Network'
  ).trim().toLowerCase();
  const connectionType: ReceiptPrinter['connectionType'] =
    rawConnectionType === 'windows'
      ? 'Windows'
      : rawConnectionType === 'linux'
        ? 'Linux'
        : 'Network';
  const parsedCharacters = Number(input.charactersPerLine ?? fallback?.charactersPerLine ?? 42);
  const charactersPerLine = Number.isFinite(parsedCharacters) && parsedCharacters > 0
    ? Math.round(parsedCharacters)
    : 42;
  const normalizedPortRaw = String(input.port ?? fallback?.port ?? (connectionType === 'Network' ? '9100' : '')).trim();
  const normalizedPortDigits = normalizedPortRaw.replace(/[^\d]/g, '');

  return {
    id: String(input.id || fallback?.id || '').trim(),
    name: String(input.name || fallback?.name || '').trim(),
    connectionType,
    capabilityProfile: String(input.capabilityProfile || fallback?.capabilityProfile || 'Default').trim() || 'Default',
    charactersPerLine,
    ipAddress: String(input.ipAddress || fallback?.ipAddress || '').trim(),
    port: normalizedPortDigits || normalizedPortRaw,
    path: String(input.path || fallback?.path || '').trim(),
  };
};

const normalizeLocationRecord = (input: Partial<Location>, fallback?: Partial<Location>): Location => {
  const inputMeta = toRecord((input as any)?.meta);
  const fallbackMeta = toRecord((fallback as any)?.meta);
  const sourceMethods = Array.isArray(input.paymentMethods) && input.paymentMethods.length > 0
    ? input.paymentMethods
    : Array.isArray(fallback?.paymentMethods) && fallback.paymentMethods.length > 0
      ? fallback.paymentMethods
      : cloneDefaultLocationPaymentMethods();

  const dedupeMethodNames = new Set<string>();
  const normalizedMethods = sourceMethods
    .map((method, index) => normalizePaymentMethodRecord(method, index))
    .filter((method) => {
      const key = method.name.trim().toLowerCase();
      if (!key || dedupeMethodNames.has(key)) return false;
      dedupeMethodNames.add(key);
      return true;
    });

  const resolvedReceiptPrinterType: 'browser' | 'network' =
    input.receiptPrinterType === 'network' || input.receiptPrinterType === 'browser'
      ? input.receiptPrinterType
      : fallback?.receiptPrinterType === 'network'
        ? 'network'
        : 'browser';
  const resolvedReceiptPrinterId = String(
    input.receiptPrinterId ?? fallback?.receiptPrinterId ?? ''
  ).trim();

  return {
    id: String(input.id || fallback?.id || '').trim(),
    name: String(input.name || fallback?.name || '').trim(),
    landmark: String(input.landmark || fallback?.landmark || '').trim(),
    city: String(input.city || fallback?.city || '').trim(),
    zipCode: String(input.zipCode || fallback?.zipCode || '').trim(),
    state: String(input.state || fallback?.state || '').trim(),
    country: String(input.country || fallback?.country || '').trim(),
    mobile: String(input.mobile || fallback?.mobile || '').trim(),
    altContact: String(input.altContact || fallback?.altContact || '').trim(),
    email: String(input.email || fallback?.email || '').trim(),
    website: String(input.website || fallback?.website || '').trim(),
    isActive: input.isActive ?? fallback?.isActive ?? true,
    priceGroup: String(input.priceGroup || fallback?.priceGroup || '').trim(),
    invoiceScheme: String(input.invoiceScheme || fallback?.invoiceScheme || '').trim(),
    invoiceLayoutPos: String(input.invoiceLayoutPos || fallback?.invoiceLayoutPos || '').trim(),
    invoiceLayoutSale: String(input.invoiceLayoutSale || fallback?.invoiceLayoutSale || '').trim(),
    posFeaturedProducts: String(input.posFeaturedProducts || fallback?.posFeaturedProducts || '').trim(),
    businessLogo: String(
      input.businessLogo ||
      inputMeta.businessLogo ||
      fallback?.businessLogo ||
      fallbackMeta.businessLogo ||
      ''
    ).trim(),
    autoPrintInvoiceAfterFinalizing:
      input.autoPrintInvoiceAfterFinalizing ?? fallback?.autoPrintInvoiceAfterFinalizing ?? false,
    receiptPrinterType: resolvedReceiptPrinterType,
    receiptPrinterId: resolvedReceiptPrinterType === 'network' ? resolvedReceiptPrinterId : '',
    paymentMethods: normalizedMethods.length > 0
      ? normalizedMethods
      : cloneDefaultLocationPaymentMethods(),
  };
};

const initialRoles: Role[] = [
  { id: 1, name: 'Admin', description: 'Full system access with all permissions.', userCount: 1, permissionsCount: 145, isSystem: true },
  { id: 2, name: 'Sales Man', description: 'Standard sales and customer management access.', userCount: 5, permissionsCount: 48, isSystem: false },
  { id: 3, name: 'Order', description: 'Access to purchase orders and requisitions.', userCount: 2, permissionsCount: 24, isSystem: false },
  { id: 4, name: 'Field Payment', description: 'Access to field payments and customer dues.', userCount: 3, permissionsCount: 18, isSystem: false },
  { id: 5, name: 'Manager', description: 'Can manage inventory, purchases and staff.', userCount: 4, permissionsCount: 85, isSystem: false },
];

const initialCommissionAgents: CommissionAgent[] = [];

// Legacy contacts array (minimal — kept so any component using contacts doesn't break)
const initialContacts: Contact[] = [];

const initialPurchases: Purchase[] = [];

const initialPurchaseRequisitions: PurchaseRequisition[] = [];

const initialPurchaseOrders: PurchaseOrder[] = [];

const initialPurchaseReturns: PurchaseReturn[] = [];

const initialTaxRates: TaxRate[] = [
  { id: 'TAX-001', name: 'VAT@5%', rate: 5, type: 'Exclusive', description: 'Standard Omani VAT' },
  { id: 'TAX-002', name: 'No Tax', rate: 0, type: 'Exclusive', description: 'Tax exempt items' },
];

const initialCustomerGroups: CustomerGroup[] = [];

const initialExpenseCategories: ExpenseCategory[] = [
  { id: 'ECAT-001', name: 'Rent', description: 'Rent and premises expenses', code: 'RENT' },
  { id: 'ECAT-002', name: 'Utilities', description: 'Electricity, water, internet', code: 'UTIL' },
  { id: 'ECAT-003', name: 'Salaries', description: 'Staff salaries and wages', code: 'SAL' },
  { id: 'ECAT-004', name: 'Transport', description: 'Vehicle fuel, delivery', code: 'TRANS' },
  { id: 'ECAT-005', name: 'Marketing', description: 'Advertising and marketing', code: 'MKT' },
  { id: 'ECAT-006', name: 'Office Supplies', description: 'Stationery and supplies', code: 'OFFICE' },
];

const initialProductCategories: ProductCategory[] = [];

const initialProductBrands: ProductBrand[] = [];

const initialProductUnits: ProductUnit[] = [
  { id: 'UNIT-001', name: 'Cartoons', shortName: 'Cartoon', allowDecimal: true },
  { id: 'UNIT-002', name: 'Pieces', shortName: 'Pc(s)', allowDecimal: true },
  { id: 'UNIT-003', name: 'Kilograms', shortName: 'Kg', allowDecimal: true },
  { id: 'UNIT-004', name: 'Liters', shortName: 'Ltr', allowDecimal: true },
];

const initialWarranties: ProductWarranty[] = [
  { id: 'WRN-001', name: '6 Months Warranty', description: 'Standard 6-month manufacturer warranty', duration: 6, durationUnit: 'Months' },
  { id: 'WRN-002', name: '1 Year Warranty', description: 'Standard 1-year manufacturer warranty', duration: 1, durationUnit: 'Years' },
  { id: 'WRN-003', name: '2 Years Warranty', description: 'Extended 2-year warranty', duration: 2, durationUnit: 'Years' },
];

const initialProductVariations: ProductVariation[] = [];

const initialSellingPriceGroups: SellingPriceGroup[] = [];

const initialInvoiceSchemes: InvoiceScheme[] = [
  {
    id: 'INV-SCH-ATWAR',
    name: 'Atwar',
    prefix: 'INV-',
    numberingType: 'Sequential',
    startFrom: 1,
    numberOfDigits: 4,
    isDefault: true,
  },
];

const initialInvoiceLayouts: InvoiceLayout[] = [
  { id: 'INV-LYT-DEFAULT', name: 'Default', design: 'Classic', isDefault: true },
];

const initialBarcodeSettings: BarcodeStickerSetting[] = [
  {
    id: '20-per-sheet',
    name: '20 Labels per Sheet',
    description: 'Sheet Size: 8.5" x 11", Label Size: 4" x 1"',
    isContinuousFeed: false,
    additionalTopMargin: 0.5,
    additionalLeftMargin: 0.25,
    stickerWidth: 4,
    stickerHeight: 1,
    paperWidth: 8.5,
    paperHeight: 11,
    stickersInOneRow: 2,
    distanceBetweenRows: 0,
    distanceBetweenColumns: 0,
    stickersInOneSheet: 20,
    isDefault: true,
  },
  {
    id: '30-per-sheet',
    name: '30 Labels per Sheet',
    description: 'Sheet Size: 8.5" x 11", Label Size: 2.625" x 1"',
    isContinuousFeed: false,
    additionalTopMargin: 0.5,
    additionalLeftMargin: 0.3125,
    stickerWidth: 2.625,
    stickerHeight: 1,
    paperWidth: 8.5,
    paperHeight: 11,
    stickersInOneRow: 3,
    distanceBetweenRows: 0,
    distanceBetweenColumns: 0,
    stickersInOneSheet: 30,
    isDefault: false,
  },
  {
    id: '32-per-sheet',
    name: '32 Labels per Sheet',
    description: 'Sheet Size: 8.5" x 11", Label Size: 2" x 1.25"',
    isContinuousFeed: false,
    additionalTopMargin: 0.5,
    additionalLeftMargin: 0.25,
    stickerWidth: 2,
    stickerHeight: 1.25,
    paperWidth: 8.5,
    paperHeight: 11,
    stickersInOneRow: 4,
    distanceBetweenRows: 0,
    distanceBetweenColumns: 0,
    stickersInOneSheet: 32,
    isDefault: false,
  },
  {
    id: '40-per-sheet',
    name: '40 Labels per Sheet',
    description: 'Sheet Size: 8.5" x 11", Label Size: 2" x 1"',
    isContinuousFeed: false,
    additionalTopMargin: 0.5,
    additionalLeftMargin: 0.25,
    stickerWidth: 2,
    stickerHeight: 1,
    paperWidth: 8.5,
    paperHeight: 11,
    stickersInOneRow: 4,
    distanceBetweenRows: 0,
    distanceBetweenColumns: 0,
    stickersInOneSheet: 40,
    isDefault: false,
  },
  {
    id: '50-per-sheet',
    name: '50 Labels per Sheet',
    description: 'Sheet Size: 8.5" x 11", Label Size: 1.5" x 1"',
    isContinuousFeed: false,
    additionalTopMargin: 0.5,
    additionalLeftMargin: 0.5,
    stickerWidth: 1.5,
    stickerHeight: 1,
    paperWidth: 8.5,
    paperHeight: 11,
    stickersInOneRow: 5,
    distanceBetweenRows: 0,
    distanceBetweenColumns: 0,
    stickersInOneSheet: 50,
    isDefault: false,
  },
  {
    id: 'continuous',
    name: 'Continuous Rolls',
    description: 'Continuous feed labels',
    isContinuousFeed: true,
    additionalTopMargin: 0,
    additionalLeftMargin: 0,
    stickerWidth: 3,
    stickerHeight: 1.5,
    paperWidth: 3,
    paperHeight: 1.5,
    stickersInOneRow: 1,
    distanceBetweenRows: 0,
    distanceBetweenColumns: 0,
    stickersInOneSheet: 1,
    isDefault: false,
  },
];

const DEFAULT_VATIN_NUMBER = 'OM1100399470';

const defaultSettings: AppSettings = {
  businessName: 'Atwar Al Mustaqbal',
  businessAddress: '',
  businessCity: '',
  address: '',
  businessLogo: '',
  invoiceFooterText: 'Received in good condition; payment as agreed.',
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
  productExpiryAction: 'Stop Selling',
  productExpiryGraceDays: '0',
  enablePriceTaxInfo: true,
  enableRacks: true,
  enableWarranty: false,
  enableRow: true,
  isProductImageRequired: true,
  enableSubUnits: false,
  enablePosition: false,
  salesInvoicePrefix: 'INV-',
  draftPrefix: 'DR-',
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
  disableMultiplePay: false,
  disableDraft: false,
  disableQuotation: false,
  disableExpressCheckout: false,
  dontShowProductSuggestion: false,
  dontShowRecentTransactions: false,
  subtotalEditable: false,
  disableSuspendSale: false,
  enableTransactionDateOnPOSScreens: true,
  enableServiceStaffInProductLine: false,
  isServiceStaffRequired: false,
  enableWeighingScale: false,
  weighingScaleBarcodePrefix: '29',
  weighingScaleProductSkuLength: 5,
  weighingScaleQuantityIntegerPartLength: 4,
  weighingScaleQuantityFractionalPartLength: 4,
  showPricingOnProductSuggestionTooltip: true,
  posShortcutExpressCheckout: 'shift+e',
  posShortcutPayCheckout: 'shift+p',
  posShortcutDraft: 'shift+d',
  posShortcutCancel: 'shift+c',
  posShortcutProductQty: 'f2',
  posShortcutWeighingScale: '',
  posShortcutEditDiscount: 'shift+i',
  posShortcutEditOrderTax: 'shift+t',
  posShortcutAddPaymentRow: 'shift+r',
  posShortcutFinalizePayment: 'shift+f',
  posShortcutAddNewProduct: 'f4',
  taxLabel: 'VAT',
  enableTax: true,
  taxNumber: DEFAULT_VATIN_NUMBER,
  tax1Name: 'VAT',
  tax1Number: DEFAULT_VATIN_NUMBER,
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
  expensePaymentPrefix: 'EPY',
  // Product settings
  skuPrefix: '',
  defaultUnit: '',
  enableSubCategories: true,
  // Dashboard
  stockExpiryAlertDays: '60',
  // System
  defaultTableEntries: '25',
  // Sale (extended)
  allowOverselling: false,
  saleItemAdditionMethod: 'Increase item quantity if it already exists',
  amountRoundingMethod: 'None',
  salesPriceIsMinimumSellingPrice: false,
  isPayTermRequired: false,
  filterProductsByLocation: false,
  salesCommissionAgent: 'Enable',
  commissionCalculationType: 'Invoice value',
  isCommissionAgentRequired: false,
  // Purchases (extended)
  enableEditPriceFromPurchase: true,
  enablePurchaseStatus: true,
  enableLotNumber: true,
  enablePurchaseOrder: true,
  enablePurchaseRequisition: true,
  // Sale settings (extended)
  enableSalesOrder: true,
  showInvoiceScheme: true,
  showInvoiceLayoutDropdown: false,
  printInvoiceOnSuspend: false,
  disableCreditSaleButton: false,
  // Modules
  enablePOS: true,
  enablePurchases: true,
  enableExpenses: true,
  enableFieldPayments: true,
  enablePaymentAccounts: true,
  enableStockTransfers: true,
  enableStockAdjustments: true,
  enableShipments: true,
  enableDiscounts: true,
  enableImportSales: true,
  enableCustomerGroupsReport: true,
  enableStockReport: true,
  enableTrendingProductsReport: true,
  enableItemsReport: true,
  enableProductPurchaseReport: true,
  enableProductSellReport: true,
  enablePurchasePaymentReport: true,
  enableSellPaymentReport: true,
  enableActivityLog: true,
  enableCommissionAgents: true,
  enableRewardPoints: false,
  cashDenominations: '',
  cashDenominationEnabledOn: 'All screens',
  cashDenominationPaymentMethods: '',
  strictCashDenominationCheck: false,
  usernamePrefix: '',
  subscriptionPrefix: '',
  salesOrderPrefix: 'SO-',
  rewardPointDisplayName: 'Reward Points',
  rewardAmountPerPoint: '1.000',
  rewardMinOrderToEarn: '1.000',
  rewardMaxPointsPerOrder: '',
  rewardRedeemAmountPerPoint: '1.000',
  rewardMinOrderToRedeem: '1.000',
  rewardMinRedeemPoint: '',
  rewardMaxRedeemPerOrder: '',
  rewardExpiryPeriod: '',
  rewardExpiryUnit: 'Year',
  themeColor: 'default',
};

const toFiniteNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toPositiveNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const normalizeTaxRateRecord = (
  raw: Partial<TaxRate>,
  fallback: TaxRate = initialTaxRates[0],
  fallbackIndex = 0,
): TaxRate => {
  const fallbackId = String(fallback?.id || `TAX-${String(fallbackIndex + 1).padStart(3, '0')}`).trim();
  const id = String(raw?.id || fallbackId).trim() || fallbackId;
  const name = String(raw?.name || fallback?.name || '').trim();
  const rateRaw = Number(raw?.rate);
  const fallbackRate = Number(fallback?.rate || 0);
  const rate = Number((Number.isFinite(rateRaw) ? Math.max(0, rateRaw) : Math.max(0, fallbackRate)).toFixed(3));
  const type = String(raw?.type || fallback?.type || 'Exclusive').trim().toLowerCase() === 'inclusive'
    ? 'Inclusive'
    : 'Exclusive';
  const description = String(raw?.description || fallback?.description || '').trim();
  return {
    id,
    name,
    rate,
    type,
    description: description || undefined,
  };
};

const normalizeTaxRates = (raw: unknown): TaxRate[] => {
  const records = Array.isArray(raw) ? raw as Partial<TaxRate>[] : [];
  const usedIds = new Set<string>();
  const usedNames = new Set<string>();
  const normalized: TaxRate[] = [];

  records.forEach((record, index) => {
    const normalizedRate = normalizeTaxRateRecord(record, initialTaxRates[0], index);
    const trimmedName = String(normalizedRate.name || '').trim();
    if (!trimmedName) return;
    const nameKey = trimmedName.toLowerCase();
    if (usedNames.has(nameKey)) return;

    let idCandidate = String(normalizedRate.id || '').trim() || `TAX-${String(index + 1).padStart(3, '0')}`;
    while (usedIds.has(idCandidate)) {
      idCandidate = `${idCandidate}-${usedIds.size + 1}`;
    }

    usedIds.add(idCandidate);
    usedNames.add(nameKey);
    normalized.push({ ...normalizedRate, id: idCandidate, name: trimmedName });
  });

  if (normalized.length > 0) return normalized;
  return initialTaxRates.map((rate, index) => normalizeTaxRateRecord(rate, rate, index));
};

const normalizeBarcodeSettingRecord = (
  raw: Partial<BarcodeStickerSetting>,
  fallback: BarcodeStickerSetting = initialBarcodeSettings[0],
): BarcodeStickerSetting => ({
  id: String(raw.id || fallback.id || `BRC-${Date.now()}`).trim() || `BRC-${Date.now()}`,
  name: String(raw.name || fallback.name || '').trim(),
  description: String(raw.description || fallback.description || '').trim(),
  isContinuousFeed: !!raw.isContinuousFeed,
  additionalTopMargin: toFiniteNumber(raw.additionalTopMargin, fallback.additionalTopMargin),
  additionalLeftMargin: toFiniteNumber(raw.additionalLeftMargin, fallback.additionalLeftMargin),
  stickerWidth: toPositiveNumber(raw.stickerWidth, fallback.stickerWidth),
  stickerHeight: toPositiveNumber(raw.stickerHeight, fallback.stickerHeight),
  paperWidth: toPositiveNumber(raw.paperWidth, fallback.paperWidth),
  paperHeight: toPositiveNumber(raw.paperHeight, fallback.paperHeight),
  stickersInOneRow: Math.max(1, Math.floor(toPositiveNumber(raw.stickersInOneRow, fallback.stickersInOneRow))),
  distanceBetweenRows: toFiniteNumber(raw.distanceBetweenRows, fallback.distanceBetweenRows),
  distanceBetweenColumns: toFiniteNumber(raw.distanceBetweenColumns, fallback.distanceBetweenColumns),
  stickersInOneSheet: Math.max(1, Math.floor(toPositiveNumber(raw.stickersInOneSheet, fallback.stickersInOneSheet))),
  isDefault: !!raw.isDefault,
});

const normalizeBarcodeSettings = (records: BarcodeStickerSetting[]): BarcodeStickerSetting[] => {
  if (records.length === 0) return [];
  const withDefault = records.some(record => record.isDefault)
    ? records
    : records.map((record, index) => ({ ...record, isDefault: index === 0 }));
  let defaultAssigned = false;
  return withDefault.map(record => {
    if (!record.isDefault) return record;
    if (!defaultAssigned) {
      defaultAssigned = true;
      return record;
    }
    return { ...record, isDefault: false };
  });
};

const normalizeAppSettings = (raw: unknown): AppSettings => {
  if (!raw || typeof raw !== 'object') {
    return { ...defaultSettings };
  }
  const parsed = raw as Partial<AppSettings>;
  const merged: AppSettings = { ...defaultSettings, ...parsed };
  if (!Object.prototype.hasOwnProperty.call(parsed, 'businessAddress')
    && Object.prototype.hasOwnProperty.call(parsed, 'address')) {
    merged.businessAddress = String(parsed.address || '').trim();
  }
  if (!Object.prototype.hasOwnProperty.call(parsed, 'address')
    && Object.prototype.hasOwnProperty.call(parsed, 'businessAddress')) {
    merged.address = String(parsed.businessAddress || '').trim();
  }
  if (!Object.prototype.hasOwnProperty.call(parsed, 'tax1Number')
    && Object.prototype.hasOwnProperty.call(parsed, 'taxNumber')) {
    merged.tax1Number = String(parsed.taxNumber || '').trim();
  }
  if (!Object.prototype.hasOwnProperty.call(parsed, 'taxNumber')
    && Object.prototype.hasOwnProperty.call(parsed, 'tax1Number')) {
    merged.taxNumber = String(parsed.tax1Number || '').trim();
  }
  merged.businessAddress = String(merged.businessAddress || '').trim();
  merged.address = merged.businessAddress;
  merged.businessCity = String(merged.businessCity || '').trim();
  merged.businessLogo = String(merged.businessLogo || '').trim();
  merged.invoiceFooterText = String(merged.invoiceFooterText || '').trim();
  merged.currency = String(merged.currency || '').trim().toUpperCase() || 'OMR';
  merged.currencySymbol = String(merged.currencySymbol || '').trim() || merged.currency || 'OMR';
  if (merged.currencySymbol === '$' || merged.currencySymbol.toLowerCase() === 'usd') {
    merged.currencySymbol = 'OMR';
    merged.currency = 'OMR';
  }
  merged.tax1Number = String(merged.tax1Number || '').trim() || DEFAULT_VATIN_NUMBER;
  merged.taxNumber = merged.tax1Number;
  if (!Object.prototype.hasOwnProperty.call(parsed, 'enableLotNumber')
    && Object.prototype.hasOwnProperty.call(parsed, 'enableLotNumbers')) {
    merged.enableLotNumber = !!parsed.enableLotNumbers;
  }
  if (!Object.prototype.hasOwnProperty.call(parsed, 'enableLotNumbers')
    && Object.prototype.hasOwnProperty.call(parsed, 'enableLotNumber')) {
    merged.enableLotNumbers = !!parsed.enableLotNumber;
  }
  merged.enableLotNumbers = !!merged.enableLotNumber;
  if (!Object.prototype.hasOwnProperty.call(parsed, 'enableStockAdjustments')) {
    merged.enableStockAdjustments = typeof parsed.enableStockTransfers === 'boolean'
      ? parsed.enableStockTransfers
      : defaultSettings.enableStockAdjustments;
  }
  const toPositiveInt = (value: unknown, fallback: number): number => {
    const parsedValue = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) return fallback;
    return parsedValue;
  };
  merged.weighingScaleBarcodePrefix = String(merged.weighingScaleBarcodePrefix || '29').trim() || '29';
  merged.weighingScaleProductSkuLength = toPositiveInt(
    merged.weighingScaleProductSkuLength,
    defaultSettings.weighingScaleProductSkuLength,
  );
  merged.weighingScaleQuantityIntegerPartLength = toPositiveInt(
    merged.weighingScaleQuantityIntegerPartLength,
    defaultSettings.weighingScaleQuantityIntegerPartLength,
  );
  merged.weighingScaleQuantityFractionalPartLength = toPositiveInt(
    merged.weighingScaleQuantityFractionalPartLength,
    defaultSettings.weighingScaleQuantityFractionalPartLength,
  );
  merged.enableCustomerGroupsReport = !!merged.enableCustomerGroupsReport;
  merged.enableStockReport = !!merged.enableStockReport;
  merged.enableTrendingProductsReport = !!merged.enableTrendingProductsReport;
  merged.enableItemsReport = !!merged.enableItemsReport;
  merged.enableProductPurchaseReport = !!merged.enableProductPurchaseReport;
  merged.enableProductSellReport = !!merged.enableProductSellReport;
  merged.enablePurchasePaymentReport = !!merged.enablePurchasePaymentReport;
  merged.enableSellPaymentReport = !!merged.enableSellPaymentReport;
  merged.enableActivityLog = !!merged.enableActivityLog;
  merged.enablePriceTaxInfo = !!merged.enablePriceTaxInfo;
  merged.enableRacks = !!merged.enableRacks;
  merged.enableWarranty = !!merged.enableWarranty;
  merged.enableRow = !!merged.enableRow;
  merged.isProductImageRequired = !!merged.isProductImageRequired;
  merged.enableSubUnits = !!merged.enableSubUnits;
  merged.enablePosition = !!merged.enablePosition;
  merged.salesPriceIsMinimumSellingPrice = !!merged.salesPriceIsMinimumSellingPrice;
  merged.strictCashDenominationCheck = !!merged.strictCashDenominationCheck;
  merged.filterProductsByLocation = !!merged.filterProductsByLocation;
  const expiryAction = String(merged.productExpiryAction || '').trim();
  merged.productExpiryAction = expiryAction === 'Keep Selling' ? 'Keep Selling' : 'Stop Selling';
  const graceDays = Number.parseInt(String(merged.productExpiryGraceDays || '0').trim(), 10);
  merged.productExpiryGraceDays = Number.isFinite(graceDays) && graceDays >= 0 ? String(graceDays) : '0';
  const stockExpiryAlertDays = Number.parseInt(String(merged.stockExpiryAlertDays || '60').trim(), 10);
  const normalizedStockAlertDays = Number.isFinite(stockExpiryAlertDays) ? Math.min(365, Math.max(1, stockExpiryAlertDays)) : 60;
  merged.stockExpiryAlertDays = String(normalizedStockAlertDays);
  return merged;
};

// ============================================================
//  CONTEXT
// ============================================================

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export const GlobalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const toNumber = (value: any, fallback = 0): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const deriveSellReturnPaymentStatus = (due: number, total: number): SellReturn['paymentStatus'] => {
    if (due <= 0.001) return 'Paid';
    if (total > 0 && due < total - 0.001) return 'Partial';
    return 'Due';
  };

  const normalizeSellReturnSettlementMode = (
    value: unknown,
    fallback: SellReturnSettlementMode
  ): SellReturnSettlementMode => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'refund_now') return 'refund_now';
    if (normalized === 'apply_to_invoice_due') return 'apply_to_invoice_due';
    if (normalized === 'customer_credit') return 'customer_credit';
    if (normalized === 'refund_due') return 'refund_due';
    return fallback;
  };

  const normalizeSellReturnRecord = (
    input: Partial<SellReturn> & { items?: any[] },
    fallback: Partial<SellReturn> = {}
  ): SellReturn => {
    const subTotal = Math.max(0, Number(toNumber(input.subTotal, toNumber(fallback.subTotal)).toFixed(3)));
    const taxAmount = Math.max(0, Number(toNumber(input.taxAmount, toNumber(fallback.taxAmount)).toFixed(3)));
    const totalRaw = Math.max(0, toNumber(input.total, subTotal + taxAmount));
    const total = Number(totalRaw.toFixed(3));
    const rawPaymentDue = toNumber(input.paymentDue, toNumber(fallback.paymentDue, total));
    const paymentDue = Number(Math.min(total, Math.max(0, rawPaymentDue)).toFixed(3));
    const fallbackMode = normalizeSellReturnSettlementMode(
      fallback.settlementMode,
      'refund_due'
    );
    const settlementMode = normalizeSellReturnSettlementMode(
      input.settlementMode,
      fallbackMode
    );
    const appliedToSaleDue = Number(Math.max(0, toNumber(
      input.appliedToSaleDue,
      toNumber(fallback.appliedToSaleDue)
    )).toFixed(3));
    const creditedToAdvance = Number(Math.max(0, toNumber(
      input.creditedToAdvance,
      toNumber(fallback.creditedToAdvance)
    )).toFixed(3));
    const normalizedAppliedToSaleDue = settlementMode === 'apply_to_invoice_due'
      ? Number(Math.min(total, appliedToSaleDue).toFixed(3))
      : 0;
    const normalizedCreditedToAdvance = settlementMode === 'customer_credit'
      ? Number(Math.min(total, creditedToAdvance || total).toFixed(3))
      : 0;
    const normalizedPaymentDue = settlementMode === 'refund_due'
      ? paymentDue
      : 0;
    const items = (Array.isArray(input.items) ? input.items : []).map((item: any, index) => {
      const qty = Number(Math.max(0, toNumber(item?.qty)).toFixed(3));
      const unitPrice = Number(Math.max(0, toNumber(item?.unitPrice)).toFixed(3));
      const lineTotal = Number(Math.max(0, toNumber(item?.lineTotal, qty * unitPrice)).toFixed(3));
      return {
        productId: String(item?.productId || item?.id || `RET-ITEM-${index + 1}`),
        productName: String(item?.productName || item?.name || 'Unnamed Product'),
        qty,
        unitPrice,
        lineTotal,
        soldQty: Number(Math.max(0, toNumber(item?.soldQty)).toFixed(3)),
        unit: String(item?.unit || ''),
      };
    });

    return {
      id: String(input.id || fallback.id || `SELL-RET-${Date.now()}`),
      referenceNo: String(input.referenceNo || fallback.referenceNo || `CN-${Date.now()}`),
      parentSaleId: String(input.parentSaleId || fallback.parentSaleId || ''),
      parentInvoiceNo: String(input.parentInvoiceNo || fallback.parentInvoiceNo || ''),
      date: String(input.date || fallback.date || new Date().toISOString().slice(0, 16)),
      customerId: String(input.customerId || fallback.customerId || ''),
      customerName: String(input.customerName || fallback.customerName || 'Walk-in Customer'),
      location: String(input.location || fallback.location || '--'),
      discountType: (String(input.discountType || fallback.discountType || 'None') as SellReturn['discountType']),
      discountAmount: Number(Math.max(0, toNumber(input.discountAmount, toNumber(fallback.discountAmount))).toFixed(3)),
      tax: String(input.tax || fallback.tax || 'None'),
      subTotal,
      taxAmount,
      total,
      settlementMode,
      appliedToSaleDue: normalizedAppliedToSaleDue,
      creditedToAdvance: normalizedCreditedToAdvance,
      autoRefundPaymentId: String(input.autoRefundPaymentId || fallback.autoRefundPaymentId || ''),
      paymentDue: normalizedPaymentDue,
      paymentStatus: deriveSellReturnPaymentStatus(normalizedPaymentDue, total),
      note: String(input.note || fallback.note || ''),
      items,
      addedBy: String(input.addedBy || fallback.addedBy || 'System'),
    };
  };

  const normalizeDiscountRecord = (input: Partial<Discount>): Discount => {
    const normalizedType = (() => {
      const rawType = String(input.discountType || '').trim().toLowerCase();
      if (rawType === 'fixed') return 'Fixed';
      if (rawType === 'percentage') return 'Percentage';
      if (String(input.discountAmount || '').includes('%')) return 'Percentage';
      return rawType ? String(input.discountType || '').trim() : '';
    })();

    const parsedAmount = Number(String(input.discountAmount || '').replace(/[^\d.-]/g, ''));
    const normalizedAmount = Number.isFinite(parsedAmount) && parsedAmount > 0
      ? Number(parsedAmount.toFixed(3))
      : 0;

    const parsedPriority = Number(input.priority);
    const normalizedPriority = Number.isFinite(parsedPriority) && parsedPriority >= 0
      ? parsedPriority
      : 0;

    return {
      id: String(input.id || `DISC-${Date.now()}`),
      name: String(input.name || '').trim(),
      products: String(input.products || '').trim() || 'All',
      productIds: Array.isArray(input.productIds) ? input.productIds.map(id => String(id)) : [],
      brand: String(input.brand || '').trim() || 'All',
      category: String(input.category || '').trim() || 'All',
      location: String(input.location || '').trim() || 'All locations',
      priority: String(normalizedPriority),
      discountType: normalizedType,
      discountAmount: normalizedAmount > 0 ? String(normalizedAmount) : '',
      startsAt: String(input.startsAt || '').trim(),
      endsAt: String(input.endsAt || '').trim(),
      sellingPriceGroup: String(input.sellingPriceGroup || '').trim() || 'All',
      isActive: input.isActive !== false,
      applyInCustomerGroups: !!input.applyInCustomerGroups,
      selectedGroups: Array.isArray(input.selectedGroups)
        ? input.selectedGroups.map(group => String(group)).filter(Boolean)
        : [],
    };
  };

  // Hard-lock business state to DB/API as the only source of truth.
  // Local business-data hydration/writes are intentionally disabled.
  const testRuntime = String(import.meta.env.MODE || '').trim().toLowerCase() === 'test';
  const liveSyncRuntime = isLiveSyncEnabled() && !testRuntime;

  // ---- Products ----
  const [products, setProducts] = useState<Product[]>(initialProducts);

  // ---- Customers ----
  const [customers, setCustomers] = useState<Customer[]>(liveSyncRuntime ? [] : initialCustomers);

  // ---- Suppliers ----
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);

  // ---- Legacy contacts ----
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);

  const numericLegacyContactId = (value: unknown, fallback: number): number => {
    const direct = Number(value);
    if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);
    const fromText = Number(String(value || '').replace(/[^\d]/g, ''));
    return Number.isFinite(fromText) && fromText > 0 ? Math.floor(fromText) : fallback;
  };

  const customerToLegacyContact = (customer: Customer, index = 0): Contact => ({
    id: numericLegacyContactId(customer.id, index + 1),
    type: 'Customer',
    contactId: String(customer.id || ''),
    name: String(customer.name || customer.businessName || ''),
    businessName: String(customer.businessName || customer.name || ''),
    mobile: String(customer.mobile || customer.phone || ''),
    email: String(customer.email || ''),
    taxNumber: String(customer.taxNumber || ''),
    creditLimit: Number(customer.creditLimit || 0),
    balance: Number(customer.totalSellDue || 0),
    payTerm: String(customer.payTerm || ''),
    status: customer.status === 'Inactive' ? 'Inactive' : 'Active',
  });

  const supplierToLegacyContact = (supplier: Supplier, index = 0): Contact => ({
    id: numericLegacyContactId(supplier.id, index + 1),
    type: 'Supplier',
    contactId: String(supplier.id || ''),
    name: String(supplier.name || supplier.businessName || ''),
    businessName: String(supplier.businessName || supplier.name || ''),
    mobile: String(supplier.mobile || supplier.phone || ''),
    email: String(supplier.email || ''),
    taxNumber: String(supplier.taxNumber || ''),
    creditLimit: 0,
    balance: Number(supplier.totalPurchaseDue || 0),
    payTerm: String(supplier.payTerm || ''),
    status: supplier.status === 'Inactive' ? 'Inactive' : 'Active',
  });

  useEffect(() => {
    setContacts([
      ...customers.map(customerToLegacyContact),
      ...suppliers.map(supplierToLegacyContact),
    ]);
  }, [customers, suppliers]);

  // ---- Sales ----
  const [sales, setSales] = useState<Sale[]>([]);

  // ---- Sell Returns ----
  const [sellReturns, setSellReturns] = useState<SellReturn[]>([]);

  // ---- Purchases ----
  const [purchases, setPurchases] = useState<Purchase[]>(initialPurchases);

  // ---- Purchase Requisitions ----
  const [purchaseRequisitions, setPurchaseRequisitions] = useState<PurchaseRequisition[]>(initialPurchaseRequisitions);

  // ---- Purchase Orders ----
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(initialPurchaseOrders);

  // ---- Purchase Returns ----
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturn[]>(initialPurchaseReturns);

  // ---- Orders ----
  const [orders, setOrders] = useState<GlobalOrder[]>([]);

  // ---- Payments ----
  const [payments, setPayments] = useState<Payment[]>([]);

  // ---- Expenses ----
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // ---- Expense Categories ----
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>(liveSyncRuntime ? [] : initialExpenseCategories);

  // ---- Users ----
  const [users, setUsers] = useState<AppUser[]>(liveSyncRuntime ? [] : initialUsers.map(normalizeUserRecord));

  // ---- Roles ----
  const [roles, setRoles] = useState<Role[]>(liveSyncRuntime ? [] : ensureRequiredRoles(initialRoles));

  // ---- Commission Agents ----
  const [commissionAgents, setCommissionAgents] = useState<CommissionAgent[]>(
    liveSyncRuntime ? [] : initialCommissionAgents.map(normalizeCommissionAgentRecord)
  );

  useEffect(() => {
    setCommissionAgents((prev) => {
      const knownUserIds = new Set(users.map((user) => String(user.id || '').trim()).filter(Boolean));
      let next = prev.filter((agent) => {
        const linkedUserId = String(agent.linkedUserId || '').trim();
        return !linkedUserId || knownUserIds.has(linkedUserId);
      });
      users.forEach((user) => {
        next = upsertCommissionAgentForUser(next, user);
      });

      if (next.length !== prev.length) return next;
      const isSame = next.every((agent, index) => {
        const current = prev[index];
        return (
          current &&
          current.id === agent.id &&
          String(current.linkedUserId || '') === String(agent.linkedUserId || '') &&
          current.name === agent.name &&
          current.email === agent.email &&
          current.contactNo === agent.contactNo &&
          current.address === agent.address &&
          Number(current.commissionPercentage || 0) === Number(agent.commissionPercentage || 0) &&
          (current.isActive !== false) === (agent.isActive !== false)
        );
      });
      return isSame ? prev : next;
    });
  }, [users]);

  // ---- Locations ----
  const [locations, setLocations] = useState<Location[]>(() => {
    if (liveSyncRuntime) return [];
    const normalizedFallback = initialLocations.map((location) =>
      normalizeLocationRecord(location, location)
    );
    return normalizedFallback;
  });

  // ---- Receipt Printers ----
  const [printers, setPrinters] = useState<ReceiptPrinter[]>(
    liveSyncRuntime ? [] : initialPrinters.map(row => normalizePrinterRecord(row, row))
  );

  // ---- Invoice Schemes ----
  const [invoiceSchemes, setInvoiceSchemes] = useState<InvoiceScheme[]>(liveSyncRuntime ? [] : initialInvoiceSchemes);

  // ---- Invoice Layouts ----
  const [invoiceLayouts, setInvoiceLayouts] = useState<InvoiceLayout[]>(liveSyncRuntime ? [] : initialInvoiceLayouts);

  // ---- Barcode Settings ----
  const [barcodeSettings, setBarcodeSettings] = useState<BarcodeStickerSetting[]>(
    liveSyncRuntime ? [] : normalizeBarcodeSettings(initialBarcodeSettings.map(row => normalizeBarcodeSettingRecord(row, row)))
  );

  // ---- Tax Rates ----
  const [taxRates, setTaxRates] = useState<TaxRate[]>(liveSyncRuntime ? [] : normalizeTaxRates(initialTaxRates));

  // ---- Customer Groups ----
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>(liveSyncRuntime ? [] : initialCustomerGroups);

  // ---- Product Categories ----
  const [productCategories, setProductCategories] = useState<ProductCategory[]>(liveSyncRuntime ? [] : initialProductCategories);

  // ---- Product Brands ----
  const [productBrands, setProductBrands] = useState<ProductBrand[]>(liveSyncRuntime ? [] : initialProductBrands);

  // ---- Product Units ----
  const [productUnits, setProductUnits] = useState<ProductUnit[]>(liveSyncRuntime ? [] : initialProductUnits);

  // ---- Product Warranties ----
  const [warranties, setWarranties] = useState<ProductWarranty[]>(liveSyncRuntime ? [] : initialWarranties);

  // ---- Product Variations ----
  const [productVariations, setProductVariations] = useState<ProductVariation[]>(liveSyncRuntime ? [] : initialProductVariations);

  // ---- Selling Price Groups ----
  const [sellingPriceGroups, setSellingPriceGroups] = useState<SellingPriceGroup[]>(liveSyncRuntime ? [] : initialSellingPriceGroups);

  // ---- Discounts ----
  const [discounts, setDiscounts] = useState<Discount[]>([]);

  // ---- Activity Logs ----
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);

  // ---- Settings ----
  const [settings, setSettings] = useState<AppSettings>({ ...defaultSettings });

  // ---- Auth ----
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      if (isLiveSyncEnabled() && !hasValidAuthToken()) {
        try {
          sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
          localStorage.removeItem(AUTH_PERSISTENT_STORAGE_KEY);
        } catch {
          // ignore storage failures
        }
        return null;
      }

      if (shouldRememberAuthSession()) {
        const persistentUser = readHardenedState<AppUser | null>(
          localStorage,
          AUTH_PERSISTENT_STORAGE_KEY,
          null,
        );
        if (persistentUser) return normalizeUserRecord(persistentUser);
      }

      const sessionUser = readHardenedState<AppUser | null>(
        sessionStorage,
        AUTH_SESSION_STORAGE_KEY,
        null,
      );
      if (sessionUser) return normalizeUserRecord(sessionUser);

      if (isLiveSyncEnabled() && hasValidAuthToken()) {
        const tokenUser = resolveUserFromAuthToken(users);
        if (tokenUser) return tokenUser;
      }
    } catch {
      // ignore storage failures
    }
    return null;
  });
  const userPreferences = useMemo(
    () => toRecord(currentUser?.preferences),
    [currentUser?.preferences],
  );

  useEffect(() => {
    if (!currentUser) return;
    const normalizedCurrent = normalizeUserRecord(currentUser);
    const userId = String(normalizedCurrent.id || '').trim();
    const linkedUser = users.find((user) => String(user.id || '').trim() === userId);
    const effectiveUser = linkedUser ? normalizeUserRecord(linkedUser) : normalizedCurrent;

    if (!isUserLoginEnabled(effectiveUser)) {
      clearAuthToken();
      setCurrentUser(null);
      window.dispatchEvent(new CustomEvent('atwar:auth:expired'));
      return;
    }

    const sameIdentity =
      String(normalizedCurrent.id || '').trim() === String(effectiveUser.id || '').trim() &&
      normalizeActiveState(normalizedCurrent.status) === normalizeActiveState(effectiveUser.status) &&
      normalizedCurrent.allowLogin === effectiveUser.allowLogin &&
      normalizeUserEmail(normalizedCurrent.email) === normalizeUserEmail(effectiveUser.email) &&
      String(normalizedCurrent.name || '').trim() === String(effectiveUser.name || '').trim() &&
      String(normalizedCurrent.username || '').trim() === String(effectiveUser.username || '').trim() &&
      normalizeRoleNameKey(normalizedCurrent.role) === normalizeRoleNameKey(effectiveUser.role) &&
      String(normalizedCurrent.businessLocation || '').trim() === String(effectiveUser.businessLocation || '').trim();
    const sameAccessLocations =
      JSON.stringify([...(normalizedCurrent.accessLocations || [])].map((id) => String(id)).sort()) ===
      JSON.stringify([...(effectiveUser.accessLocations || [])].map((id) => String(id)).sort());
    const samePreferences = JSON.stringify(toRecord(normalizedCurrent.preferences)) === JSON.stringify(toRecord(effectiveUser.preferences));
    if (!sameIdentity || !sameAccessLocations || !samePreferences) {
      setCurrentUser(effectiveUser);
    }
  }, [currentUser, users]);

  useEffect(() => {
    if (currentUser) return;
    if (!isLiveSyncEnabled() || !hasValidAuthToken()) return;
    const tokenUser = resolveUserFromAuthToken(users);
    if (tokenUser && isUserLoginEnabled(tokenUser)) {
      setCurrentUser(tokenUser);
    }
  }, [currentUser, users]);

  const coreSyncReadyRef = useRef(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'synced'>('idle');
  const customerLedgerCarryRef = useRef<Record<string, { due: number; advance: number }>>({});
  const fieldPaymentsCacheRef = useRef<any[]>([]);

  useEffect(() => {
    const dueBySale: Record<string, number> = {};
    const returnsBySale: Record<string, SellReturn[]> = {};
    sellReturns.forEach(record => {
      const saleId = String(record.parentSaleId || '').trim();
      if (!saleId) return;
      dueBySale[saleId] = (dueBySale[saleId] || 0) + Number(record.paymentDue || 0);
      if (!returnsBySale[saleId]) returnsBySale[saleId] = [];
      returnsBySale[saleId].push(record);
    });

    setSales(prev => {
      let changed = false;
      const next = prev.map(sale => {
        const saleId = String(sale.id || '').trim();
        const nextDue = Number((dueBySale[saleId] || 0).toFixed(3));
        const nextReturns = returnsBySale[saleId] || [];
        const prevDue = Number(sale.sellReturnDue || 0);
        const prevReturns = Array.isArray(sale.sellReturns) ? sale.sellReturns : [];
        const sameReturnsSnapshot = prevReturns.length === nextReturns.length &&
          prevReturns.every((record, index) =>
            record.id === nextReturns[index]?.id &&
            Number(record.paymentDue || 0) === Number(nextReturns[index]?.paymentDue || 0) &&
            record.paymentStatus === nextReturns[index]?.paymentStatus
          );

        if (Math.abs(prevDue - nextDue) <= 0.0005 && sameReturnsSnapshot) {
          return sale;
        }
        changed = true;
        return {
          ...sale,
          sellReturnDue: nextDue,
          sellReturns: nextReturns.length > 0 ? nextReturns : undefined,
        };
      });
      return changed ? next : prev;
    });
  }, [sellReturns]);

  useEffect(() => {
    setCustomers(prev => {
      let changed = false;
      const carryByCustomer = customerLedgerCarryRef.current;
      const next = prev.map(customer => {
        const customerSales = sales.filter(sale =>
          isFinalizedSale(sale) && isSaleCustomerMatch(customer, sale)
        );
        const saleDueTotal = Number(customerSales
          .reduce((sum, sale) => sum + saleDueAmount(sale), 0)
          .toFixed(3));
        const invoiceTotal = Number(customerSales
          .reduce((sum, sale) => sum + Number(sale.grandTotal || sale.totalAmount || 0), 0)
          .toFixed(3));
        const receivedTotal = Number(payments
          .filter(payment =>
            payment.contactType === 'Customer' &&
            payment.type !== 'sent' &&
            (payment.contactId === customer.id || payment.contactName === customer.businessName)
          )
          .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
          .toFixed(3));
        const appliedToInvoices = Number(Math.max(0, invoiceTotal - saleDueTotal).toFixed(3));
        const overflowPayments = Number(Math.max(0, receivedTotal - appliedToInvoices).toFixed(3));

        const customerKey = String(customer.id || customer.businessName || customer.name || '').trim();
        if (customerKey && !carryByCustomer[customerKey]) {
          carryByCustomer[customerKey] = {
            due: Number(Math.max(0, Number(customer.totalSellDue || 0) - saleDueTotal).toFixed(3)),
            advance: Number(Math.max(0, Number(customer.advanceBalance || 0) - overflowPayments).toFixed(3)),
          };
        }
        const dueCarry = customerKey ? Number(carryByCustomer[customerKey]?.due || 0) : 0;
        const advanceCarry = customerKey ? Number(carryByCustomer[customerKey]?.advance || 0) : 0;
        const remainingCarryDue = Number(Math.max(0, dueCarry - overflowPayments).toFixed(3));
        const overflowAfterCarry = Number(Math.max(0, overflowPayments - dueCarry).toFixed(3));

        const recalculatedDue = Number((saleDueTotal + remainingCarryDue).toFixed(3));
        const recalculatedAdvance = Number((advanceCarry + overflowAfterCarry).toFixed(3));

        if (
          Math.abs(Number(customer.totalSellDue || 0) - recalculatedDue) <= 0.0005 &&
          Math.abs(Number(customer.advanceBalance || 0) - recalculatedAdvance) <= 0.0005
        ) {
          return customer;
        }
        changed = true;
        return {
          ...customer,
          totalSellDue: recalculatedDue,
          advanceBalance: recalculatedAdvance,
        };
      });
      return changed ? next : prev;
    });
  }, [sales, payments]);

  // ─── ATOMIC BOOTSTRAP ────────────────────────────────────────────────────
  // On startup, load each core resource individually from the DB.
  // This replaces the old "fetch entire snapshot blob" approach and eliminates
  // the concurrency data-loss issue: no more whole-state overwrites.
  useEffect(() => {
    if (!isLiveSyncEnabled()) {
      coreSyncReadyRef.current = true;
      return;
    }
    const hasToken = hasValidAuthToken();
    if (!hasToken) {
      // Before login there is no token, so avoid protected API calls that would
      // spam 401 errors in console and falsely set sync status to error.
      setSyncStatus('idle');
      coreSyncReadyRef.current = true;
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      coreSyncReadyRef.current = false;
      setSyncStatus('syncing');
      try {
        const [
          remoteProducts,
          remoteCustomers,
          remoteSuppliers,
          remoteSales,
          remotePayments,
          remoteRoles,
          remoteUsers,
          remoteLocations,
          remoteSettings,
          remoteExpenses,
          remoteExpenseCategories,
          remotePurchases,
          remoteSellReturns,
          remotePurchaseReturns,
          remoteOrders,
          remoteActivityLogs,
          remoteTaxRates,
          remoteProductCategories,
          remoteProductBrands,
          remoteProductUnits,
          remoteCustomerGroups,
          remoteSellingPriceGroups,
          remotePurchaseReqs,
          remotePurchaseOrders,
        ] = await Promise.all([
          apiFetchAllWithRetry<Product>('products'),
          apiFetchAllWithRetry<Customer>('customers'),
          apiFetchAllWithRetry<Supplier>('suppliers'),
          apiFetchAllWithRetry<Sale>('sales'),
          apiFetchAllWithRetry<Payment>('payments'),
          apiFetchAllWithRetry<Role>('roles'),
          apiFetchAllWithRetry<AppUser>('users'),
          apiFetchAllWithRetry<Location>('locations'),
          apiFetchAllWithRetry<AppSettings>('settings'),
          apiFetchAllWithRetry<Expense>('expenses'),
          apiFetchAllWithRetry<ExpenseCategory>('expenseCategories'),
          apiFetchAllWithRetry<Purchase>('purchases'),
          apiFetchAllWithRetry<SellReturn>('sellReturns'),
          apiFetchAllWithRetry<PurchaseReturn>('purchaseReturns'),
          apiFetchAllWithRetry<GlobalOrder>('salesOrders'),
          apiFetchAllWithRetry<ActivityLogEntry>('activityLogs'),
          apiFetchAllWithRetry<TaxRate>('taxRates'),
          apiFetchAllWithRetry<ProductCategory>('productCategories'),
          apiFetchAllWithRetry<ProductBrand>('productBrands'),
          apiFetchAllWithRetry<ProductUnit>('productUnits'),
          apiFetchAllWithRetry<CustomerGroup>('customerGroups'),
          apiFetchAllWithRetry<SellingPriceGroup>('sellingPriceGroups'),
          apiFetchAllWithRetry<PurchaseRequisition>('purchaseRequisitions'),
          apiFetchAllWithRetry<PurchaseOrder>('purchaseOrders'),
        ]);

        if (cancelled) return;

        const bootResults = [
          remoteProducts,
          remoteCustomers,
          remoteSuppliers,
          remoteSales,
          remotePayments,
          remoteRoles,
          remoteUsers,
          remoteLocations,
          remoteSettings,
          remoteExpenses,
          remoteExpenseCategories,
          remotePurchases,
          remoteSellReturns,
          remotePurchaseReturns,
          remoteOrders,
          remoteActivityLogs,
          remoteTaxRates,
          remoteProductCategories,
          remoteProductBrands,
          remoteProductUnits,
          remoteCustomerGroups,
          remoteSellingPriceGroups,
          remotePurchaseReqs,
          remotePurchaseOrders,
        ];
        const hadFetchFailure = bootResults.some((result) => result === null);

        // In DB sync mode, apply successful fetches even when arrays are empty
        // so stale browser cache cannot survive a refresh.
        if (remoteProducts) {
          const availableCategories = (remoteProductCategories as ProductCategory[] | null) ?? [];
          const availableBrands = (remoteProductBrands as ProductBrand[] | null) ?? [];
          setProducts(
            (remoteProducts as Product[]).map((product) =>
              normalizeProductRecord(product, availableCategories, availableBrands, warranties),
            ),
          );
        }
        if (remoteCustomers) {
          const availableCustomerGroups = (remoteCustomerGroups as CustomerGroup[] | null) ?? customerGroups;
          setCustomers((remoteCustomers as Customer[]).map((customer) => normalizeCustomerRecord(customer, availableCustomerGroups)));
        }
        if (remoteSuppliers) {
          setSuppliers((remoteSuppliers as Supplier[]).map((supplier) => normalizeSupplierRecord(supplier)));
        }
        if (remoteSales) {
          setSales((remoteSales as Sale[]).map((sale) => normalizeSaleRecordLoaded(sale)));
        }
        if (remotePayments) {
          setPayments((remotePayments as Payment[]).map((payment) => normalizePaymentRecordLoaded(payment)));
        }
        if (remoteRoles) {
          setRoles(ensureRequiredRoles((remoteRoles as Role[]).map(normalizeRoleRecord)));
        }
        if (remoteUsers) setUsers(remoteUsers.map(normalizeUserRecord));
        if (remoteLocations) {
          setLocations(
            normalizeLocationArray(
              (remoteLocations as Location[])
                .map((row, index) => normalizeLocationRecord(row, initialLocations[index] || initialLocations[0]))
                .filter((row) => row.id && row.name),
            ),
          );
        }
        if (remoteSettings && remoteSettings.length > 0) {
          const s = remoteSettings[0];
          // Only apply settings from DB if it has more than the 3 bootstrap fields,
          // indicating it was previously synced with the full settings object.
          // A sparse object (id, businessName, currency, currencySymbol only) would
          // silently wipe out timezone, VAT, invoice config, etc.
          const richEnough = s && Object.keys(s).filter(k => !['id', 'businessName', 'currency', 'currencySymbol', 'createdAt', 'updatedAt'].includes(k)).length > 0;
          if (richEnough) setSettings(normalizeAppSettings(s));
        }
        if (remoteExpenses) {
          setExpenses((remoteExpenses as Expense[]).map((expense) => normalizeExpenseRecordLoaded(expense)));
        }
        if (remoteExpenseCategories) {
          if ((remoteExpenseCategories as ExpenseCategory[]).length === 0) {
            setExpenseCategories(initialExpenseCategories);
          } else {
            setExpenseCategories(remoteExpenseCategories as ExpenseCategory[]);
          }
        }
        if (remotePurchases) {
          setPurchases((remotePurchases as Purchase[]).map((purchase) => normalizePurchaseRecordLoaded(purchase)));
        }
        if (remoteSellReturns) {
          setSellReturns((remoteSellReturns as SellReturn[]).map((record) => normalizeSellReturnRecordLoaded(record)));
        }
        if (remotePurchaseReturns) {
          setPurchaseReturns((remotePurchaseReturns as PurchaseReturn[]).map((record) => normalizePurchaseReturnRecordLoaded(record)));
        }
        if (remoteOrders) {
          setOrders((remoteOrders as GlobalOrder[]).map((order) => normalizeOrderRecordLoaded(order)));
        }
        if (remoteActivityLogs) {
          setActivityLogs((remoteActivityLogs as ActivityLogEntry[]).map((entry) => normalizeActivityLogRecordLoaded(entry)));
        }
        if (remoteTaxRates) setTaxRates(normalizeTaxRates(remoteTaxRates as TaxRate[]));
        if (remoteProductCategories) setProductCategories(remoteProductCategories as ProductCategory[]);
        if (remoteProductBrands) setProductBrands(remoteProductBrands as ProductBrand[]);
        if (remoteProductUnits) setProductUnits(remoteProductUnits as ProductUnit[]);
        const normalizedRemoteSellingPriceGroups = remoteSellingPriceGroups
          ? (remoteSellingPriceGroups as SellingPriceGroup[]).map(normalizeSellingPriceGroupRecord)
          : null;
        if (normalizedRemoteSellingPriceGroups) {
          setSellingPriceGroups(normalizedRemoteSellingPriceGroups);
        }
        if (remoteCustomerGroups) {
          const availablePriceGroups = normalizedRemoteSellingPriceGroups ?? sellingPriceGroups;
          setCustomerGroups((remoteCustomerGroups as CustomerGroup[]).map((group) =>
            normalizeCustomerGroupRecord(group, availablePriceGroups),
          ));
        }
        if (remotePurchaseReqs) {
          setPurchaseRequisitions((remotePurchaseReqs as PurchaseRequisition[]).map((record) => normalizePurchaseRequisitionRecordLoaded(record)));
        }
        if (remotePurchaseOrders) {
          setPurchaseOrders((remotePurchaseOrders as PurchaseOrder[]).map((record) => normalizePurchaseOrderRecordLoaded(record)));
        }

        setSyncStatus(hadFetchFailure ? 'error' : 'synced');
      } catch {
        if (!cancelled) setSyncStatus('error');
      } finally {
        if (!cancelled) coreSyncReadyRef.current = true;
      }
    };

    void bootstrap();
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  // Keep the backend health connection warm while the app is open.
  useEffect(() => {
    if (!isCoreSyncEnabled()) return;
    void pingBackend();
    const id = window.setInterval(() => {
      void pingBackend();
    }, 4 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isLiveSyncEnabled()) return;
    let cancelled = false;
    const bootstrapPaymentAccountCaches = async () => {
      const [remoteAccounts, remoteAccountTypes] = await Promise.all([
        fetchDedicated<any>('/api/sync/payment-accounts').catch(() => null),
        apiFetchAll<{ name?: string; isActive?: boolean }>('paymentAccountTypes').catch(() => null),
      ]);
      if (cancelled) return;
      setStoredPaymentAccounts(remoteAccounts || []);
      if (remoteAccountTypes) {
        const types = remoteAccountTypes
          .filter((row) => row?.isActive !== false)
          .map((row) => String(row?.name || '').trim())
          .filter(Boolean);
        setStoredPaymentAccountTypes(types);
      } else {
        setStoredPaymentAccountTypes([]);
      }
      dispatchPaymentAccountsUpdated();
    };
    void bootstrapPaymentAccountCaches();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLiveSyncEnabled()) return;
    let cancelled = false;
    const refreshFieldPaymentsCache = async () => {
      const rows = await fetchDedicated<any>('/api/sync/field-payments').catch(() => null);
      if (cancelled) return;
      fieldPaymentsCacheRef.current = Array.isArray(rows) ? rows : [];
    };
    void refreshFieldPaymentsCache();
    const onFieldPaymentsUpdated = (event: Event) => {
      const custom = event as CustomEvent<any[]>;
      if (!Array.isArray(custom.detail)) return;
      fieldPaymentsCacheRef.current = custom.detail;
    };
    const onFocus = () => { void refreshFieldPaymentsCache(); };
    window.addEventListener('app:field-payments-updated', onFieldPaymentsUpdated as EventListener);
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('app:field-payments-updated', onFieldPaymentsUpdated as EventListener);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // ─── BACKGROUND POLLING ──────────────────────────────────────────────────
  // Every 60 seconds, re-fetch the four most dynamic resources so employees
  // at different locations see each other's sales, payments, and stock
  // changes without having to manually refresh the page.
  useEffect(() => {
    if (!isLiveSyncEnabled()) return;

    const poll = async () => {
      if (!hasValidAuthToken()) return;
      try {
        const [
          freshProducts, freshSales, freshPayments, freshCustomers, freshLocations,
          freshRoles,
          freshExpenses, freshExpenseCategories, freshPurchases, freshSellReturns, freshPurchaseReturns, freshOrders, freshActivityLogs,
          freshTaxRates, freshProductCategories, freshProductBrands, freshProductUnits,
          freshCustomerGroups, freshSellingPriceGroups,
        ] = await Promise.all([
          apiFetchAll<Product>('products').catch(() => null),
          apiFetchAll<Sale>('sales').catch(() => null),
          apiFetchAll<Payment>('payments').catch(() => null),
          apiFetchAll<Customer>('customers').catch(() => null),
          apiFetchAll<Location>('locations').catch(() => null),
          apiFetchAll<Role>('roles').catch(() => null),
          apiFetchAll<Expense>('expenses').catch(() => null),
          apiFetchAll<ExpenseCategory>('expenseCategories').catch(() => null),
          apiFetchAll<Purchase>('purchases').catch(() => null),
          apiFetchAll<SellReturn>('sellReturns').catch(() => null),
          apiFetchAll<PurchaseReturn>('purchaseReturns').catch(() => null),
          apiFetchAll<GlobalOrder>('salesOrders').catch(() => null),
          apiFetchAll<ActivityLogEntry>('activityLogs').catch(() => null),
          apiFetchAll<TaxRate>('taxRates').catch(() => null),
          apiFetchAll<ProductCategory>('productCategories').catch(() => null),
          apiFetchAll<ProductBrand>('productBrands').catch(() => null),
          apiFetchAll<ProductUnit>('productUnits').catch(() => null),
          apiFetchAll<CustomerGroup>('customerGroups').catch(() => null),
          apiFetchAll<SellingPriceGroup>('sellingPriceGroups').catch(() => null),
        ]);
        if (freshProducts) {
          const availableCategories = (freshProductCategories as ProductCategory[] | null) ?? [];
          const availableBrands = (freshProductBrands as ProductBrand[] | null) ?? [];
          setProducts(
            (freshProducts as Product[]).map((product) =>
              normalizeProductRecord(product, availableCategories, availableBrands, warranties),
            ),
          );
        }
        if (freshSales) {
          setSales((freshSales as Sale[]).map((sale) => normalizeSaleRecordLoaded(sale)));
        }
        if (freshPayments) {
          setPayments((freshPayments as Payment[]).map((payment) => normalizePaymentRecordLoaded(payment)));
        }
        if (freshRoles) {
          setRoles(ensureRequiredRoles((freshRoles as Role[]).map(normalizeRoleRecord)));
        }
        if (freshCustomers) {
          const availableCustomerGroups = (freshCustomerGroups as CustomerGroup[] | null) ?? customerGroups;
          setCustomers((freshCustomers as Customer[]).map((customer) => normalizeCustomerRecord(customer, availableCustomerGroups)));
        }
        if (freshLocations) {
          setLocations(
            normalizeLocationArray(
              (freshLocations as Location[])
                .map((row, index) => normalizeLocationRecord(row, initialLocations[index] || initialLocations[0]))
                .filter((row) => row.id && row.name),
            ),
          );
        }
        if (freshExpenses) {
          setExpenses((freshExpenses as Expense[]).map((expense) => normalizeExpenseRecordLoaded(expense)));
        }
        if (freshExpenseCategories) {
          if ((freshExpenseCategories as ExpenseCategory[]).length === 0) {
            setExpenseCategories(initialExpenseCategories);
          } else {
            setExpenseCategories(freshExpenseCategories as ExpenseCategory[]);
          }
        }
        if (freshPurchases) {
          setPurchases((freshPurchases as Purchase[]).map((purchase) => normalizePurchaseRecordLoaded(purchase)));
        }
        if (freshSellReturns) {
          setSellReturns((freshSellReturns as SellReturn[]).map((record) => normalizeSellReturnRecordLoaded(record)));
        }
        if (freshPurchaseReturns) {
          setPurchaseReturns((freshPurchaseReturns as PurchaseReturn[]).map((record) => normalizePurchaseReturnRecordLoaded(record)));
        }
        if (freshOrders) {
          setOrders((freshOrders as GlobalOrder[]).map((order) => normalizeOrderRecordLoaded(order)));
        }
        if (freshActivityLogs) {
          setActivityLogs((freshActivityLogs as ActivityLogEntry[]).map((entry) => normalizeActivityLogRecordLoaded(entry)));
        }
        if (freshTaxRates) setTaxRates(normalizeTaxRates(freshTaxRates as TaxRate[]));
        if (freshProductCategories) setProductCategories(freshProductCategories as ProductCategory[]);
        if (freshProductBrands) setProductBrands(freshProductBrands as ProductBrand[]);
        if (freshProductUnits) setProductUnits(freshProductUnits as ProductUnit[]);
        const normalizedFreshSellingPriceGroups = freshSellingPriceGroups
          ? (freshSellingPriceGroups as SellingPriceGroup[]).map(normalizeSellingPriceGroupRecord)
          : null;
        if (normalizedFreshSellingPriceGroups) {
          setSellingPriceGroups(normalizedFreshSellingPriceGroups);
        }
        if (freshCustomerGroups) {
          const availablePriceGroups = normalizedFreshSellingPriceGroups ?? sellingPriceGroups;
          setCustomerGroups((freshCustomerGroups as CustomerGroup[]).map((group) =>
            normalizeCustomerGroupRecord(group, availablePriceGroups),
          ));
        }
      } catch {
        // polling failure is non-fatal — the user keeps their current data
      }
    };

    const id = window.setInterval(poll, 60_000);
    return () => window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  //  RUNTIME SETTINGS + AUTH SESSION STORAGE ONLY
  // ============================================================

  useEffect(() => {
    (window as Window & { __ATWAR_RUNTIME_SETTINGS__?: AppSettings }).__ATWAR_RUNTIME_SETTINGS__ = settings;
  }, [settings]);

  useEffect(() => {
    if (currentUser) {
      writeHardenedState(sessionStorage, AUTH_SESSION_STORAGE_KEY, currentUser);
      if (shouldRememberAuthSession()) {
        writeHardenedState(localStorage, AUTH_PERSISTENT_STORAGE_KEY, currentUser);
      } else {
        localStorage.removeItem(AUTH_PERSISTENT_STORAGE_KEY);
      }
    } else {
      sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      localStorage.removeItem(AUTH_PERSISTENT_STORAGE_KEY);
    }
    removeLegacyKeys(localStorage, ['app_current_user']);
  }, [currentUser]);

  // Keep invoice scheme/layout master lists in sync with location-assigned values
  useEffect(() => {
    const schemeNames: string[] = Array.from(new Set<string>(
      locations
        .map(location => String(location.invoiceScheme || '').trim())
        .filter(name => name.length > 0)
    ));
    if (schemeNames.length === 0) return;
    setInvoiceSchemes(prev => {
      const existing = new Set(prev.map(scheme => scheme.name.trim().toLowerCase()));
      const missing = schemeNames.filter(name => !existing.has(name.trim().toLowerCase()));
      if (missing.length === 0) return prev;
      const additions = missing.map((name, index) => ({
        id: `INV-SCH-AUTO-${Date.now()}-${index}`,
        name,
        prefix: `${settings.salesInvoicePrefix || 'INV-'}`,
        numberingType: 'Sequential' as const,
        startFrom: 1,
        numberOfDigits: 4,
        isDefault: false,
      }));
      return [...prev, ...additions];
    });
  }, [locations, settings.salesInvoicePrefix]);

  useEffect(() => {
    const layoutNames: string[] = Array.from(new Set<string>(
      locations
        .flatMap(location => [location.invoiceLayoutPos, location.invoiceLayoutSale])
        .map(name => String(name || '').trim())
        .filter(name => name.length > 0)
    ));
    if (layoutNames.length === 0) return;
    setInvoiceLayouts(prev => {
      const existing = new Set(prev.map(layout => layout.name.trim().toLowerCase()));
      const missing = layoutNames.filter(name => !existing.has(name.trim().toLowerCase()));
      if (missing.length === 0) return prev;
      const additions = missing.map((name, index) => ({
        id: `INV-LYT-AUTO-${Date.now()}-${index}`,
        name,
        design: 'Classic',
        isDefault: false,
      }));
      return [...prev, ...additions];
    });
  }, [locations]);

  // ============================================================
  //  UTILITY FUNCTIONS
  // ============================================================

  const formatCurrency = (amount: number): string => {
    const rawPrecision = Number(settings.currencyPrecision);
    const precision = Number.isFinite(rawPrecision)
      ? Math.min(6, Math.max(0, Math.round(rawPrecision)))
      : 3;
    const normalizedAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
    const formatted = normalizedAmount.toLocaleString('en-OM', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
    const currencySymbol = String(settings.currencySymbol || '').trim() || 'OMR';
    return settings.currencySymbolPlacement === 'before'
      ? `${currencySymbol} ${formatted}`
      : `${formatted} ${currencySymbol}`;
  };

  const generateId = (prefix: string): string => {
    return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  };

  const resolveBusinessTimeZone = (): string => {
    const fallback = 'Asia/Dubai';
    const configured = String(settings.timeZone || '').trim() || fallback;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: configured }).format(new Date());
      return configured;
    } catch {
      return fallback;
    }
  };

  const getDatePartsByTimeZone = (input: Date = new Date()) => {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: resolveBusinessTimeZone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(input);
    const read = (type: Intl.DateTimeFormatPartTypes, fallback = '00') =>
      parts.find(part => part.type === type)?.value || fallback;
    return {
      year: read('year', '1970'),
      month: read('month', '01'),
      day: read('day', '01'),
      hour: read('hour', '00'),
      minute: read('minute', '00'),
      second: read('second', '00'),
    };
  };

  const getBusinessDateString = (input: Date = new Date()) => {
    const parts = getDatePartsByTimeZone(input);
    return `${parts.year}-${parts.month}-${parts.day}`;
  };

  const getBusinessDateTimeString = (input: Date = new Date()) => {
    const parts = getDatePartsByTimeZone(input);
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  };

  const parseTransactionDateMs = (value?: string | null): number | null => {
    const raw = String(value || '').trim();
    if (!raw) return null;

    const direct = new Date(raw);
    if (!Number.isNaN(direct.getTime())) return direct.getTime();

    const withTimeSeparator = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
    const fallbackDirect = new Date(withTimeSeparator);
    if (!Number.isNaN(fallbackDirect.getTime())) return fallbackDirect.getTime();

    const dmyWithTime = raw.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[T\s]+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?$/i
    );
    if (!dmyWithTime) return null;

    const first = Number(dmyWithTime[1]);
    const second = Number(dmyWithTime[2]);
    const year = Number(dmyWithTime[3]);
    const rawHour = Number(dmyWithTime[4] || 0);
    const minute = Number(dmyWithTime[5] || 0);
    const meridiem = String(dmyWithTime[6] || '').toUpperCase();
    const hour24 = meridiem ? ((rawHour % 12) + (meridiem === 'PM' ? 12 : 0)) : rawHour;

    let day = first;
    let month = second - 1;
    if (settings.dateFormat === 'mm/dd/yyyy') {
      day = second;
      month = first - 1;
    }
    const parsed = new Date(year, month, day, hour24, minute, 0, 0);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  };

  const getBusinessNowMs = (): number => {
    try {
      return new Date(new Date().toLocaleString('en-US', { timeZone: resolveBusinessTimeZone() })).getTime();
    } catch {
      return Date.now();
    }
  };

  const recordActivity = async (entry: ActivityLogInput): Promise<void> => {
    const userLabel = String(entry.user || currentUser?.name || currentUser?.username || 'System').trim() || 'System';
    const timestamp = entry.date || getBusinessDateTimeString();
    const id = entry.id || `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const next: ActivityLogEntry = {
      id,
      user: userLabel,
      action: String(entry.action || '').trim() || 'Updated',
      module: String(entry.module || '').trim() || 'System',
      description: String(entry.description || '').trim() || '--',
      date: timestamp,
      ipAddress: entry.ipAddress || '',
    };
    try {
      const saved = await syncRecordStrict('activityLogs', next);
      if (!saved.ok) return;
    } catch {
      return;
    }
    setActivityLogs(prev => [next, ...prev].slice(0, 5000));

    // Broadcast bell notifications for key business activities
    const module = next.module;
    const action = next.action;
    const desc = next.description;
    const notifyModules = ['Payments', 'Sales', 'Sell Returns', 'Orders', 'Purchases', 'Field Payments'];
    if (action !== 'Blocked' && action !== 'Viewed' && notifyModules.includes(module)) {
      const isOrder = module === 'Orders';
      const isFieldPayment = module === 'Field Payments';
      const isPayment = module === 'Payments';
      const actionRequired =
        (isOrder && action === 'Created') ||
        (isFieldPayment && action === 'Created');
      let notifType: 'success' | 'info' | 'warning' = 'info';
      if (action === 'Created' || action === 'Received') notifType = 'success';
      if (isFieldPayment && action === 'Created') notifType = 'warning';
      if (actionRequired) notifType = 'warning';
      const navigateTo =
        module === 'Sales' ? 'sales' :
        module === 'Payments' ? 'list-payments' :
        module === 'Sell Returns' ? 'returns' :
        module === 'Orders' ? 'list-orders' :
        module === 'Purchases' ? 'purchases' :
        module === 'Field Payments' ? 'field-payments' :
        undefined;
      const isPaymentIn = /^received payment/i.test(desc);
      const isPaymentOut = /^sent payment/i.test(desc);
      const normalizedMessage =
        module === 'Orders' && action === 'Created'
          ? desc.replace(/^created order:\s*/i, 'Order No: ')
          : isPayment && action === 'Created'
            ? desc.replace(/^(received|sent) payment:\s*/i, 'Reference: ')
            : desc;
      const notificationTitle =
        module === 'Orders' && action === 'Created'
          ? 'New order created'
          : module === 'Payments' && action === 'Created'
            ? (isPaymentIn ? 'New payment received' : (isPaymentOut ? 'Payment sent' : 'New payment recorded'))
            : module === 'Sales' && action === 'Created'
              ? 'New sale created'
              : module === 'Field Payments' && action === 'Created'
                ? 'Field payment pending approval'
                : `${action}: ${module}`;
      try {
        window.dispatchEvent(new CustomEvent('atwar-bss-notify', {
          detail: {
            title: notificationTitle,
            message: normalizedMessage,
            type: notifType,
            actionRequired,
            module,
            navigateTo,
            triggeredBy: userLabel,
            activityId: next.id,
            sourceActivityId: next.id,
            timestamp: next.date,
          },
        }));
      } catch {
        // ignore if window unavailable
      }
    }
  };

  const addActivityLog = (entry: ActivityLogInput): Promise<void> => recordActivity(entry);

  const clearActivityLogs = () => setActivityLogs([]);

  const hasContextPermission = (moduleName: string, permission: string): boolean => {
    if (!currentUser) return true;
    const currentRoleRecord = roles.find(role => role.name === currentUser.role);
    const explicitPermissions = currentRoleRecord?.permissions || [];
    const hasExplicitList = explicitPermissions.length > 0;
    if (String(currentUser.role || '').toLowerCase() === 'admin' || currentRoleRecord?.isSystem) return true;
    if (!hasExplicitList) return true;
    return (
      explicitPermissions.includes(permission) ||
      explicitPermissions.includes(`${moduleName}::${permission}`)
    );
  };

  const enforcePermissionBoundary = (
    moduleName: string,
    permission: string | string[],
    actionDescription: string,
  ): boolean => {
    const requiredPermissions = Array.isArray(permission) ? permission : [permission];
    if (requiredPermissions.some((item) => hasContextPermission(moduleName, item))) return true;
    recordActivity({
      action: 'Blocked',
      module: moduleName,
      description: `Permission blocked: ${actionDescription}. Missing permission "${requiredPermissions.join('" or "')}".`,
    });
    return false;
  };

  const canEditTransaction = (module: string, reference: string, dateRaw?: string | null): boolean => {
    const maxDays = Number(settings.transactionEditDays || 0);
    if (!Number.isFinite(maxDays) || maxDays <= 0) return true;

    const transactionMs = parseTransactionDateMs(dateRaw);
    if (!Number.isFinite(transactionMs)) return true;

    const elapsedMs = getBusinessNowMs() - Number(transactionMs);
    const maxMs = maxDays * 24 * 60 * 60 * 1000;
    if (elapsedMs <= maxMs) return true;

    recordActivity({
      action: 'Blocked',
      module,
      description: `Edit blocked for ${reference || 'record'} (older than ${maxDays} day(s)).`,
    });
    return false;
  };

  // Generates next invoice number using scheme start and digit settings.
  const nextInvoiceNumber = (locationId?: string, prefixOverride?: string): string => {
    const year = new Date().getFullYear();
    const locationRef = String(locationId || '').trim().toLowerCase();
    const locationObj = locationRef
      ? locations.find(l =>
          l.id.trim().toLowerCase() === locationRef ||
          l.name.trim().toLowerCase() === locationRef
        )
      : undefined;

    const locationName = locationObj?.name.trim().toLowerCase();
    const locationSales = locationName
      ? sales.filter(s => String(s.location || '').trim().toLowerCase() === locationName)
      : sales;

    const schemeByPrefix = prefixOverride
      ? invoiceSchemes.find(s => String(s.prefix || '').trim().toLowerCase() === String(prefixOverride).trim().toLowerCase())
      : undefined;
    const schemeByLocation = locationObj?.invoiceScheme
      ? invoiceSchemes.find(s => String(s.name || '').trim().toLowerCase() === String(locationObj.invoiceScheme).trim().toLowerCase())
      : undefined;
    const defaultScheme = invoiceSchemes.find(s => s.isDefault) || invoiceSchemes[0];
    const activeScheme = schemeByPrefix || schemeByLocation || defaultScheme;

    const prefix = String(prefixOverride || activeScheme?.prefix || settings.salesInvoicePrefix || 'INV-');
    const startFrom = Math.max(1, Number(activeScheme?.startFrom || 1));
    const digits = Math.max(1, Number(activeScheme?.numberOfDigits || 4));

    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escapedPrefix}${year}-(\\d+)$`, 'i');

    let maxSerial = startFrom - 1;
    locationSales.forEach(sale => {
      const invoiceNo = String(sale.invoiceNo || '').trim();
      const match = invoiceNo.match(pattern);
      if (!match) return;
      const serial = Number(match[1]);
      if (Number.isFinite(serial)) {
        maxSerial = Math.max(maxSerial, serial);
      }
    });

    const nextSerial = Math.max(startFrom, maxSerial + 1);
    return `${prefix}${year}-${String(nextSerial).padStart(digits, '0')}`;
  };

  const normalizeText = (value?: string): string => String(value || '').trim().toLowerCase();

  const normalizeSellingPriceGroupProductRule = (
    rule: any,
    index = 0,
  ): SellingPriceGroupProduct | null => {
    if (!rule || typeof rule !== 'object') return null;
    const id = String(rule.id || rule.productId || rule.product_id || rule.productID || '').trim();
    const name = String(rule.name || rule.productName || rule.product || rule.description || '').trim();
    const sku = String(rule.sku || rule.productSku || rule.productSKU || rule.productCode || rule.code || rule.barcode || '').trim();
    const price = toFiniteNumber(
      rule.price ?? rule.sellingPrice ?? rule.unitPrice ?? rule.groupPrice ?? rule.overridePrice ?? rule.value,
      0,
    );
    const discount = toFiniteNumber(rule.discount ?? rule.discountPercent, 0);

    if (!id && !name && !sku) return null;

    return {
      id: id || sku || `SPG-PRODUCT-${index}`,
      name,
      sku,
      price: Number(Math.max(0, price).toFixed(3)),
      discount: Number(Math.min(100, Math.max(0, discount)).toFixed(3)),
    };
  };

  const normalizeSellingPriceGroupRecord = (group: SellingPriceGroup): SellingPriceGroup => {
    const meta = group.meta && typeof group.meta === 'object' && !Array.isArray(group.meta)
      ? group.meta
      : {};
    const applicableProducts = getSellingPriceGroupProductRules(group)
      .map((rule, index) => normalizeSellingPriceGroupProductRule(rule, index))
      .filter((rule): rule is SellingPriceGroupProduct => !!rule);
    const status = String(group.status || (meta as any).status || 'Active').toLowerCase() === 'inactive'
      ? 'Inactive'
      : 'Active';

    return {
      ...group,
      description: String(group.description || (meta as any).description || '').trim(),
      payTermDays: Math.max(0, Math.floor(toFiniteNumber(group.payTermDays ?? (meta as any).payTermDays, 0))),
      payTermUnit: group.payTermUnit === 'Months' || (meta as any).payTermUnit === 'Months' ? 'Months' : 'Days',
      taxRate: Number(Math.max(0, toFiniteNumber(group.taxRate ?? (meta as any).taxRate, 0)).toFixed(3)),
      discount: Number(Math.min(100, Math.max(0, toFiniteNumber(group.discount ?? (meta as any).discount, 0))).toFixed(3)),
      priceCalcPercentage: Number(toFiniteNumber(group.priceCalcPercentage ?? (meta as any).priceCalcPercentage, 0).toFixed(3)),
      status,
      applicableProducts: applicableProducts.length > 0 ? applicableProducts : undefined,
      meta: {
        ...meta,
        applicableProducts,
      },
    };
  };

  const isCustomerRecordActive = (customer?: Customer): boolean =>
    !!customer && String(customer.status || 'Active') === 'Active';

  const resolveCustomerRecordForTransaction = (customerId?: string, customerName?: string): Customer | undefined => {
    const normalizedCustomerId = String(customerId || '').trim();
    const normalizedCustomerName = normalizeText(customerName);
    return customers.find(customer =>
      (normalizedCustomerId && String(customer.id || '').trim() === normalizedCustomerId) ||
      (normalizedCustomerName && (
        normalizeText(customer.businessName) === normalizedCustomerName ||
        normalizeText(customer.name) === normalizedCustomerName
      ))
    );
  };

  const resolveLocationRecordByName = (locationName?: string): Location | undefined => {
    const normalizedLocationName = normalizeText(locationName);
    if (!normalizedLocationName) return undefined;
    return locations.find(location => normalizeText(location.name) === normalizedLocationName);
  };

  const resolveProductCategoryLink = (
    categoryId: string | undefined,
    categoryName: string | undefined,
    availableCategories: ProductCategory[] = productCategories
  ): { id: string; name: string } => {
    const byId = categoryId
      ? availableCategories.find(category => category.id === categoryId)
      : undefined;
    if (byId) return { id: byId.id, name: byId.name };

    const normalizedName = normalizeText(categoryName);
    if (!normalizedName) {
      const uncategorized = availableCategories.find(category => normalizeText(category.name) === 'uncategorized');
      return uncategorized
        ? { id: uncategorized.id, name: uncategorized.name }
        : { id: '', name: 'Uncategorized' };
    }

    const byName = availableCategories.find(category => normalizeText(category.name) === normalizedName);
    if (byName) return { id: byName.id, name: byName.name };

    const byAlias = availableCategories.find(category => {
      const candidate = normalizeText(category.name);
      return candidate.includes(normalizedName) || normalizedName.includes(candidate);
    });
    if (byAlias) return { id: byAlias.id, name: byAlias.name };

    return { id: '', name: String(categoryName || '').trim() || 'Uncategorized' };
  };

  const resolveProductBrandLink = (
    brandId: string | undefined,
    brandName: string | undefined,
    availableBrands: ProductBrand[] = productBrands
  ): { id: string; name: string } => {
    const byId = brandId
      ? availableBrands.find(brand => brand.id === brandId)
      : undefined;
    if (byId) return { id: byId.id, name: byId.name };

    const normalizedName = normalizeText(brandName);
    if (!normalizedName) {
      const unknownBrand = availableBrands.find(brand => normalizeText(brand.name) === '--');
      return unknownBrand
        ? { id: unknownBrand.id, name: unknownBrand.name }
        : { id: '', name: '--' };
    }

    const byName = availableBrands.find(brand => normalizeText(brand.name) === normalizedName);
    if (byName) return { id: byName.id, name: byName.name };

    const byAlias = availableBrands.find(brand => {
      const candidate = normalizeText(brand.name);
      return candidate.includes(normalizedName) || normalizedName.includes(candidate);
    });
    if (byAlias) return { id: byAlias.id, name: byAlias.name };

    return { id: '', name: String(brandName || '').trim() || '--' };
  };

  const resolveProductWarrantyLink = (
    warrantyValue: string | undefined,
    availableWarranties: ProductWarranty[] = warranties
  ): { id: string; name: string } => {
    const value = String(warrantyValue || '').trim();
    if (!value) return { id: '', name: '' };

    const byId = availableWarranties.find(warranty => warranty.id === value);
    if (byId) return { id: byId.id, name: byId.name };

    const normalizedValue = normalizeText(value);
    const byName = availableWarranties.find(warranty => normalizeText(warranty.name) === normalizedValue);
    if (byName) return { id: byName.id, name: byName.name };

    const byAlias = availableWarranties.find(warranty => {
      const candidate = normalizeText(warranty.name);
      return candidate.includes(normalizedValue) || normalizedValue.includes(candidate);
    });
    if (byAlias) return { id: byAlias.id, name: byAlias.name };

    return { id: '', name: value };
  };

  const normalizeProductRecord = (
    product: Product,
    availableCategories: ProductCategory[] = productCategories,
    availableBrands: ProductBrand[] = productBrands,
    availableWarranties: ProductWarranty[] = warranties
  ): Product => {
    const linkedCategory = resolveProductCategoryLink(
      product.categoryId,
      product.category,
      availableCategories
    );
    const linkedBrand = resolveProductBrandLink(
      product.brandId,
      product.brand,
      availableBrands
    );
    const linkedWarranty = resolveProductWarrantyLink(
      product.warranty,
      availableWarranties
    );
    const normalizedTypeKey = normalizeText((product as any)?.type);
    const normalizedType: Product['type'] =
      normalizedTypeKey === 'variable'
        ? 'Variable'
        : normalizedTypeKey === 'combo'
          ? 'Combo'
          : 'Single';
    const normalizedUnitPurchasePrice = Number(
      Math.max(0, toFiniteNumber((product as any)?.unitPurchasePrice, 0)).toFixed(3),
    );
    const normalizedSellingPrice = Number(
      Math.max(0, toFiniteNumber((product as any)?.sellingPrice, 0)).toFixed(3),
    );
    const normalizedStock = Number(
      Math.max(0, toFiniteNumber((product as any)?.stock, 0)).toFixed(3),
    );
    const normalizedOpeningStockRaw = Number((product as any)?.openingStock);
    const normalizedAlertQuantityRaw = Number((product as any)?.alertQuantity);
    const normalizedWeightRaw = Number((product as any)?.weight);
    const normalizedServiceTimerRaw = Number((product as any)?.serviceStaffTimer);
    const resolvedPackagingType = normalizePackagingType((product as any)?.packagingType);
    const resolvedUnitsPerPackage = normalizeUnitsPerPackage((product as any)?.unitsPerPackage);
    const productMeta = ((product as any)?.meta && typeof (product as any).meta === 'object' && !Array.isArray((product as any).meta))
      ? ((product as any).meta as Record<string, unknown>)
      : {};
    const legacyImageCandidates = [
      productMeta.image,
      (productMeta as any).imageLink,
      (productMeta as any).imageUrl,
      (productMeta as any).imageURL,
      (productMeta as any).productImage,
      (productMeta as any).productImageUrl,
      (productMeta as any).productImageURL,
    ];
    const legacyImage = legacyImageCandidates.find((value) => typeof value === 'string' && String(value).trim().length > 0);
    return {
      ...product,
      name: String((product as any)?.name || '').trim(),
      sku: String((product as any)?.sku || '').trim(),
      type: normalizedType,
      tax: String((product as any)?.tax || '--').trim() || '--',
      businessLocation: String((product as any)?.businessLocation || '').trim(),
      unit: String((product as any)?.unit || 'Pc(s)').trim() || 'Pc(s)',
      image: String((product as any)?.image || legacyImage || '').trim(),
      unitPurchasePrice: normalizedUnitPurchasePrice,
      sellingPrice: normalizedSellingPrice,
      stock: normalizedStock,
      openingStock: Number.isFinite(normalizedOpeningStockRaw)
        ? Number(Math.max(0, normalizedOpeningStockRaw).toFixed(3))
        : undefined,
      alertQuantity: Number.isFinite(normalizedAlertQuantityRaw)
        ? Math.max(0, Math.trunc(normalizedAlertQuantityRaw))
        : undefined,
      weight: Number.isFinite(normalizedWeightRaw)
        ? Number(Math.max(0, normalizedWeightRaw).toFixed(3))
        : undefined,
      serviceStaffTimer: Number.isFinite(normalizedServiceTimerRaw)
        ? Number(Math.max(0, normalizedServiceTimerRaw).toFixed(3))
        : undefined,
      categoryId: linkedCategory.id,
      category: linkedCategory.name,
      brandId: linkedBrand.id,
      brand: linkedBrand.name,
      warranty: linkedWarranty.id || undefined,
      packagingType: resolvedPackagingType === 'Piece' ? undefined : resolvedPackagingType,
      unitsPerPackage: resolvedUnitsPerPackage,
    };
  };

  const resolveSellingPriceGroupLink = (
    sellingPriceGroupId: string | undefined,
    sellingPriceGroupName: string | undefined,
    availableGroups: SellingPriceGroup[]
  ): { id: string; name: string } => {
    const byId = sellingPriceGroupId
      ? availableGroups.find(g => g.id === sellingPriceGroupId)
      : undefined;
    if (byId) return { id: byId.id, name: byId.name };

    const normalizedName = normalizeText(sellingPriceGroupName);
    if (!normalizedName) return { id: '', name: '' };

    const byName = availableGroups.find(g => normalizeText(g.name) === normalizedName);
    if (byName) return { id: byName.id, name: byName.name };

    const byAlias = availableGroups.find(g => {
      const candidate = normalizeText(g.name);
      return candidate.includes(normalizedName) || normalizedName.includes(candidate);
    });
    if (byAlias) return { id: byAlias.id, name: byAlias.name };

    return { id: '', name: String(sellingPriceGroupName || '').trim() };
  };

  const resolveDefaultCustomerGroupSellingPrice = (
    groupName: string | undefined,
    availableGroups: SellingPriceGroup[]
  ): { id: string; name: string } => {
    const normalizedGroupName = normalizeText(groupName);
    if (!normalizedGroupName.includes('supermarket')) return { id: '', name: '' };
    return resolveSellingPriceGroupLink(
      undefined,
      'highest group supermarket',
      availableGroups,
    );
  };

  const normalizeCustomerGroupRecord = (
    group: CustomerGroup,
    availablePriceGroups: SellingPriceGroup[] = sellingPriceGroups
  ): CustomerGroup => {
    const linked = resolveSellingPriceGroupLink(
      group.sellingPriceGroupId,
      group.sellingPriceGroup,
      availablePriceGroups
    );
    const fallbackLinked = (linked.id || linked.name)
      ? linked
      : resolveDefaultCustomerGroupSellingPrice(group.name, availablePriceGroups);
    const parsedCalculation = Number(group.calculationPercentage);
    const parsedDiscount = Number(group.discountPercent);
    const calculationPercentage = Number.isFinite(parsedCalculation)
      ? parsedCalculation
      : (Number.isFinite(parsedDiscount) ? parsedDiscount : 0);
    const discountPercent = Number.isFinite(parsedDiscount)
      ? parsedDiscount
      : (Number.isFinite(parsedCalculation) ? parsedCalculation : 0);

    return {
      ...group,
      discountPercent,
      calculationPercentage,
      status: group.status || 'Active',
      sellingPriceGroupId: fallbackLinked.id,
      sellingPriceGroup: fallbackLinked.name,
    };
  };

  const resolveCustomerGroupLink = (
    customerGroupId: string | undefined,
    customerGroupName: string | undefined,
    availableGroups: CustomerGroup[]
  ): { id: string; name: string } => {
    const byId = customerGroupId
      ? availableGroups.find(g => g.id === customerGroupId)
      : undefined;
    if (byId) return { id: byId.id, name: byId.name };

    const normalizedName = normalizeText(customerGroupName);
    if (!normalizedName) return { id: '', name: '' };

    const byName = availableGroups.find(g => normalizeText(g.name) === normalizedName);
    if (byName) return { id: byName.id, name: byName.name };

    return { id: '', name: String(customerGroupName || '').trim() };
  };

  const normalizeContactDocuments = (docs: unknown): ContactDocument[] => {
    if (!Array.isArray(docs)) return [];
    return docs
      .filter((row): row is Partial<ContactDocument> => !!row && typeof row === 'object' && !Array.isArray(row))
      .map((row, index) => {
        const nowIso = new Date().toISOString();
        return {
          id: String(row.id || `DOC-${Date.now()}-${index}`),
          heading: String(row.heading || '').trim(),
          fileName: String(row.fileName || '').trim() || undefined,
          addedBy: String(row.addedBy || '').trim() || 'System',
          createdAt: String(row.createdAt || '').trim() || nowIso,
          updatedAt: String(row.updatedAt || row.createdAt || '').trim() || nowIso,
        };
      });
  };

  const normalizeCustomerRecord = (
    customer: Customer,
    availableGroups: CustomerGroup[] = customerGroups
  ): Customer => {
    const linked = resolveCustomerGroupLink(
      customer.customerGroupId,
      customer.customerGroup,
      availableGroups
    );
    const businessName = String(customer.businessName || customer.name || '').trim();
    const contactName = String(customer.name || customer.businessName || '').trim() || businessName;
    const id = String(customer.id || businessName || contactName).trim();
    const normalizedStatus = normalizeActiveState(customer.status, (customer as any).isActive);
    const customerGroupId = String(linked.id || '').trim();
    const customerGroup = String(linked.name || '').trim();
    const resolvedCustomerGroupRecord = customerGroupId
      ? availableGroups.find((group) => group.id === customerGroupId)
      : availableGroups.find((group) => normalizeText(group.name) === normalizeText(customerGroup));
    const linkedGroupSellingPrice = resolveSellingPriceGroupLink(
      resolvedCustomerGroupRecord?.sellingPriceGroupId,
      resolvedCustomerGroupRecord?.sellingPriceGroup,
      sellingPriceGroups,
    );
    const customerPriceGroupLink = resolveSellingPriceGroupLink(
      String((customer as { sellingPriceGroupId?: string }).sellingPriceGroupId || '').trim() || undefined,
      String((customer as { sellingPriceGroup?: string }).sellingPriceGroup || '').trim() || undefined,
      sellingPriceGroups,
    );
    const explicitModeRaw = String(
      (customer as { sellingPriceGroupMode?: string }).sellingPriceGroupMode || '',
    ).trim().toLowerCase();
    const explicitMatchesCustomerGroup =
      Boolean(customerPriceGroupLink.id) &&
      Boolean(linkedGroupSellingPrice.id) &&
      customerPriceGroupLink.id === linkedGroupSellingPrice.id;
    const hasManualSelection = (
      explicitModeRaw === 'manual'
      || (
        explicitModeRaw !== 'auto'
        && Boolean(customerPriceGroupLink.id || customerPriceGroupLink.name)
        && !explicitMatchesCustomerGroup
      )
    );
    const sellingPriceGroupMode: 'auto' | 'manual' = hasManualSelection ? 'manual' : 'auto';
    const sellingPriceGroupId = sellingPriceGroupMode === 'manual'
      ? String(customerPriceGroupLink.id || '').trim()
      : '';
    const sellingPriceGroup = sellingPriceGroupMode === 'manual'
      ? String(customerPriceGroupLink.name || '').trim()
      : '';
    const customValues = customer.customValues && typeof customer.customValues === 'object' && !Array.isArray(customer.customValues)
      ? Object.fromEntries(
          Object.entries(customer.customValues).map(([key, value]) => [String(key), String(value ?? '')]),
        )
      : undefined;
    const parsedRebate = Number(customer.rebatePercent);
    const parsedReward = Number(customer.rewardPoints);

    return {
      ...customer,
      id,
      type: 'Customer',
      businessName,
      name: contactName,
      email: String(customer.email || '').trim(),
      mobile: String(customer.mobile || '').trim(),
      phone: String(customer.phone || '').trim() || undefined,
      taxNumber: String(customer.taxNumber || '').trim(),
      creditLimit: Number(customer.creditLimit || 0),
      payTerm: String(customer.payTerm || '').trim(),
      openingBalance: Number(customer.openingBalance || 0),
      advanceBalance: Number(customer.advanceBalance || 0),
      totalSellDue: Number(customer.totalSellDue || 0),
      totalSellReturnDue: Number(customer.totalSellReturnDue || 0),
      addedOn: String(customer.addedOn || '').trim() || new Date().toISOString().slice(0, 10),
      customerGroupId,
      customerGroup,
      sellingPriceGroupId,
      sellingPriceGroup,
      sellingPriceGroupMode,
      address: String(customer.address || '').trim(),
      city: String(customer.city || '').trim() || undefined,
      state: String(customer.state || '').trim() || undefined,
      country: String(customer.country || '').trim() || undefined,
      zipCode: String(customer.zipCode || '').trim() || undefined,
      status: normalizedStatus,
      assignedTo: String(customer.assignedTo || '').trim() || undefined,
      lastSellDate: String(customer.lastSellDate || '').trim() || undefined,
      customValues,
      documents: normalizeContactDocuments(customer.documents),
      contactCategory: customer.contactCategory === 'Business' ? 'Business' : 'Individual',
      rewardPoints: Number.isFinite(parsedReward) ? parsedReward : 0,
      rebatePercent: Number.isFinite(parsedRebate) ? parsedRebate : 0,
    };
  };

  const normalizeSupplierRecord = (supplier: Supplier): Supplier => {
    const businessName = String(supplier.businessName || supplier.name || '').trim();
    const contactName = String(supplier.name || supplier.businessName || '').trim() || businessName;
    const id = String(supplier.id || businessName || contactName).trim();
    const normalizedStatus = normalizeActiveState(supplier.status, (supplier as any).isActive);
    const customValues = supplier.customValues && typeof supplier.customValues === 'object' && !Array.isArray(supplier.customValues)
      ? Object.fromEntries(
          Object.entries(supplier.customValues).map(([key, value]) => [String(key), String(value ?? '')]),
        )
      : undefined;

    return {
      ...supplier,
      id,
      type: 'Supplier',
      businessName,
      name: contactName,
      email: String(supplier.email || '').trim(),
      mobile: String(supplier.mobile || '').trim(),
      phone: String(supplier.phone || '').trim() || undefined,
      taxNumber: String(supplier.taxNumber || '').trim(),
      payTerm: String(supplier.payTerm || '').trim(),
      openingBalance: Number(supplier.openingBalance || 0),
      advanceBalance: Number(supplier.advanceBalance || 0),
      totalPurchaseDue: Number(supplier.totalPurchaseDue || 0),
      totalReturnDue: Number(supplier.totalReturnDue || 0),
      addedOn: String(supplier.addedOn || '').trim() || new Date().toISOString().slice(0, 10),
      address: String(supplier.address || '').trim(),
      city: String(supplier.city || '').trim() || undefined,
      state: String(supplier.state || '').trim() || undefined,
      country: String(supplier.country || '').trim() || undefined,
      zipCode: String(supplier.zipCode || '').trim() || undefined,
      status: normalizedStatus,
      assignedTo: String(supplier.assignedTo || '').trim() || undefined,
      purchaseStatus: String(supplier.purchaseStatus || '').trim() || undefined,
      customValues,
      documents: normalizeContactDocuments(supplier.documents),
      contactCategory: supplier.contactCategory === 'Individual' ? 'Individual' : 'Supplier',
    };
  };

  const asNumber = (value: unknown, fallback = 0): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const asString = (value: unknown, fallback = ''): string => String(value ?? fallback).trim();
  const asOptionalNumber = (value: unknown): number | undefined => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const normalizeSalePaymentStatus = (value: unknown): Sale['paymentStatus'] => {
    const key = normalizeText(asString(value));
    if (key === 'paid') return 'Paid';
    if (key === 'partial') return 'Partial';
    if (key === 'overdue') return 'Overdue';
    return 'Due';
  };

  const normalizePurchaseStatus = (value: unknown): Purchase['status'] => {
    const key = normalizeText(asString(value));
    if (key === 'received') return 'Received';
    if (key === 'ordered') return 'Ordered';
    return 'Pending';
  };

  const normalizePurchasePaymentStatus = (value: unknown): Purchase['paymentStatus'] => {
    const key = normalizeText(asString(value));
    if (key === 'paid') return 'Paid';
    if (key === 'partial') return 'Partial';
    return 'Due';
  };

  const normalizeExpensePaymentStatus = (value: unknown): Expense['paymentStatus'] => {
    const key = normalizeText(asString(value));
    if (key === 'paid') return 'Paid';
    if (key === 'partial') return 'Partial';
    return 'Due';
  };

  const normalizeOrderStatus = (value: unknown): GlobalOrder['status'] => {
    const key = normalizeText(asString(value));
    if (key === 'processing') return 'Processing';
    if (key === 'ready') return 'Ready';
    if (key === 'shipped') return 'Shipped';
    if (key === 'delivered') return 'Delivered';
    if (key === 'cancelled') return 'Cancelled';
    return 'Pending';
  };

  const normalizeOrderPaymentStatus = (value: unknown): GlobalOrder['paymentStatus'] => {
    const key = normalizeText(asString(value));
    if (key === 'paid') return 'Paid';
    if (key === 'partial') return 'Partial';
    return 'Due';
  };

  const normalizeOrderType = (value: unknown): GlobalOrder['orderType'] =>
    normalizeText(asString(value)) === 'credit' ? 'Credit' : 'Paid';

  const normalizeSaleItemRecord = (item: Partial<SaleItem>): SaleItem => ({
    id: asString(item.id || item.name),
    name: asString(item.name),
    qty: asNumber(item.qty),
    quantityMode: item.quantityMode,
    quantityInput: asOptionalNumber(item.quantityInput),
    unitsPerPackage: asOptionalNumber(item.unitsPerPackage),
    productPackagingType: item.productPackagingType,
    unitPrice: asNumber(item.unitPrice),
    discount: asNumber(item.discount),
    subtotal: asNumber(item.subtotal),
    tax: asNumber(item.tax),
    total: asNumber(item.total),
    unit: asString(item.unit) || undefined,
  });

  const normalizePurchaseItemRecord = (item: Partial<PurchaseItem>): PurchaseItem => ({
    id: asString(item.id || item.name),
    name: asString(item.name),
    qty: asNumber(item.qty),
    unitCost: asNumber(item.unitCost),
    discount: asNumber(item.discount),
    tax: asNumber(item.tax),
    lineTotal: asNumber(item.lineTotal),
    lot: asString(item.lot) || undefined,
    expiryDate: asString(item.expiryDate) || undefined,
    margin: asOptionalNumber(item.margin),
    sellingPrice: asOptionalNumber(item.sellingPrice),
  });

  const normalizePurchaseReturnItemRecord = (item: Partial<PurchaseReturnItem>): PurchaseReturnItem => ({
    productId: asString(item.productId || item.productName),
    productName: asString(item.productName),
    lotNumber: asString(item.lotNumber) || undefined,
    expDate: asString(item.expDate) || undefined,
    quantity: asNumber(item.quantity),
    unitPrice: asNumber(item.unitPrice),
    subtotal: asNumber(item.subtotal),
  });

  const normalizeSellReturnItemRecord = (item: Partial<SellReturnItem>): SellReturnItem => ({
    productId: asString(item.productId || item.productName),
    productName: asString(item.productName),
    qty: asNumber(item.qty),
    unitPrice: asNumber(item.unitPrice),
    lineTotal: asNumber(item.lineTotal),
    soldQty: asNumber(item.soldQty, undefined as unknown as number),
    unit: asString(item.unit) || undefined,
  });

  const normalizeOrderItemRecord = (item: Partial<OrderItem>): OrderItem => ({
    id: String(item.id ?? item.productId ?? item.name ?? ''),
    productId: asString(item.productId) || undefined,
    productSku: asString(item.productSku) || undefined,
    name: asString(item.name),
    qty: asNumber(item.qty),
    quantityMode: item.quantityMode,
    quantityInput: asOptionalNumber(item.quantityInput),
    unitsPerPackage: asOptionalNumber(item.unitsPerPackage),
    productPackagingType: item.productPackagingType,
    price: asNumber(item.price),
    total: asNumber(item.total),
  });

  const normalizePurchaseRequisitionItemRecord = (item: Partial<PurchaseRequisitionItem>): PurchaseRequisitionItem => ({
    productId: asString(item.productId || item.productName),
    productName: asString(item.productName),
    alertQty: asNumber(item.alertQty),
    requiredQty: asNumber(item.requiredQty),
  });

  const normalizePurchaseOrderItemRecord = (item: Partial<PurchaseOrderItem>): PurchaseOrderItem => ({
    productId: asString(item.productId || item.productName),
    productName: asString(item.productName),
    orderQty: asNumber(item.orderQty),
    unitCostBeforeDiscount: asNumber(item.unitCostBeforeDiscount),
    discountPercent: asNumber(item.discountPercent),
    unitCostBeforeTax: asNumber(item.unitCostBeforeTax),
    lineTotal: asNumber(item.lineTotal),
  });

  const normalizeSaleRecordLoaded = (sale: Sale): Sale => {
    const normalizedStatus = normalizeSaleLifecycleStatus(sale.status || sale.saleStatus) || 'Final';

    return {
      ...sale,
      id: asString(sale.id || sale.invoiceNo),
      date: asString(sale.date),
      paymentDate: asString(sale.paymentDate) || undefined,
      invoiceNo: asString(sale.invoiceNo),
      invoiceScheme: asString(sale.invoiceScheme) || undefined,
      invoiceLayout: asString(sale.invoiceLayout) || undefined,
      customerId: asString(sale.customerId),
      customerName: asString(sale.customerName) || undefined,
      customerGroupId: asString(sale.customerGroupId) || undefined,
      customerGroup: asString(sale.customerGroup) || undefined,
      contactNumber: asString(sale.contactNumber) || undefined,
      billingAddress: asString(sale.billingAddress) || undefined,
      shippingAddress: asString(sale.shippingAddress) || undefined,
      location: asString(sale.location) || undefined,
      saleType: asString(sale.saleType) || undefined,
      saleStatus: normalizedStatus,
      paymentStatus: normalizeSalePaymentStatus(sale.paymentStatus),
      paymentMethod: asString(sale.paymentMethod) || undefined,
      paymentAccount: asString(sale.paymentAccount) || undefined,
      paymentNote: asString(sale.paymentNote) || undefined,
      totalAmount: asNumber(sale.totalAmount),
      totalPaid: asNumber(sale.totalPaid),
      sellDue: asNumber(sale.sellDue),
      sellReturnDue: asNumber(sale.sellReturnDue),
      discount: asString(sale.discount) || undefined,
      orderTax: asString(sale.orderTax) || undefined,
      shippingStatus: sale.shippingStatus,
      shippingDetails: asString(sale.shippingDetails) || undefined,
      shippingCharges: asNumber(sale.shippingCharges),
      deliveredTo: asString(sale.deliveredTo) || undefined,
      deliveryPerson: asString(sale.deliveryPerson) || undefined,
      shippingNote: asString(sale.shippingNote) || undefined,
      shippingDocName: asString(sale.shippingDocName) || undefined,
      totalItems: asNumber(sale.totalItems),
      addedBy: asString(sale.addedBy) || undefined,
      sellNote: asString(sale.sellNote) || undefined,
      staffNote: asString(sale.staffNote) || undefined,
      document: asString(sale.document) || undefined,
      items: Array.isArray(sale.items) ? sale.items.map((item) => normalizeSaleItemRecord(item)) : [],
      subTotal: asNumber(sale.subTotal),
      discountType: asString(sale.discountType),
      discountAmount: asNumber(sale.discountAmount),
      tax: asString(sale.tax),
      grandTotal: asNumber(sale.grandTotal),
      status: normalizedStatus,
    };
  };

  const normalizePaymentRecordLoaded = (payment: Payment): Payment => ({
    ...payment,
    id: asString(payment.id || payment.referenceNo),
    date: asString(payment.date),
    contactId: asString(payment.contactId),
    contactName: asString(payment.contactName),
    contactType: payment.contactType === 'Supplier' || payment.contactType === 'Expense' ? payment.contactType : 'Customer',
    amount: asNumber(payment.amount),
    method: asString(payment.method),
    account: asString(payment.account),
    location: asString(payment.location) || undefined,
    referenceNo: asString(payment.referenceNo),
    note: asString(payment.note),
    type: payment.type === 'sent' ? 'sent' : 'received',
    linkedInvoices: Array.isArray(payment.linkedInvoices)
      ? payment.linkedInvoices.map((value) => asString(value)).filter(Boolean)
      : undefined,
    strictLinkedAllocation: Boolean(payment.strictLinkedAllocation),
    addedBy: asString(payment.addedBy) || undefined,
    attachmentName: asString(payment.attachmentName) || undefined,
    attachmentData: asString(payment.attachmentData) || undefined,
    expenseId: asString(payment.expenseId) || undefined,
    rebatePercent: asNumber(payment.rebatePercent),
    rebateAmount: asNumber(payment.rebateAmount),
    rebateApplied: Boolean(payment.rebateApplied),
    chequeDate: asString(payment.chequeDate) || undefined,
    chequeNo: asString(payment.chequeNo) || undefined,
    bankName: asString(payment.bankName) || undefined,
    drawerName: asString(payment.drawerName) || undefined,
    chequeCleared: Boolean(payment.chequeCleared),
  });

  const normalizePurchaseRecordLoaded = (purchase: Purchase): Purchase => ({
    ...purchase,
    id: asString(purchase.id || purchase.refNo),
    refNo: asString(purchase.refNo),
    date: asString(purchase.date),
    location: asString(purchase.location),
    supplier: asString(purchase.supplier),
    supplierId: asString(purchase.supplierId) || undefined,
    status: normalizePurchaseStatus(purchase.status),
    paymentStatus: normalizePurchasePaymentStatus(purchase.paymentStatus),
    grandTotal: asNumber(purchase.grandTotal),
    paymentDue: asNumber(purchase.paymentDue),
    addedBy: asString(purchase.addedBy),
    items: Array.isArray(purchase.items) ? purchase.items.map((item) => normalizePurchaseItemRecord(item)) : [],
    subTotal: asNumber(purchase.subTotal),
    discountType: asString(purchase.discountType) || undefined,
    discountAmount: asNumber(purchase.discountAmount),
    purchaseTaxId: asString(purchase.purchaseTaxId) || undefined,
    purchaseTaxName: asString(purchase.purchaseTaxName) || undefined,
    purchaseTaxAmount: asNumber(purchase.purchaseTaxAmount),
    shippingCharges: asNumber(purchase.shippingCharges),
    shippingDetails: asString(purchase.shippingDetails) || undefined,
    attachDocumentName: asString(purchase.attachDocumentName) || undefined,
    purchaseOrderId: asString(purchase.purchaseOrderId) || undefined,
    purchaseOrderRef: asString(purchase.purchaseOrderRef) || undefined,
    purchaseRequisitionId: asString(purchase.purchaseRequisitionId) || undefined,
    purchaseRequisitionRef: asString(purchase.purchaseRequisitionRef) || undefined,
    paidOn: asString(purchase.paidOn) || undefined,
    paymentNote: asString(purchase.paymentNote) || undefined,
    notes: asString(purchase.notes) || undefined,
    paymentMethod: asString(purchase.paymentMethod) || undefined,
    paymentAmount: asNumber(purchase.paymentAmount),
  });

  const normalizeExpenseRecordLoaded = (expense: Expense): Expense => ({
    ...expense,
    id: asString(expense.id || expense.refNo),
    refNo: asString(expense.refNo),
    date: asString(expense.date),
    category: asString(expense.category),
    subCategory: asString(expense.subCategory),
    location: asString(expense.location),
    amount: asNumber(expense.amount),
    tax: asNumber(expense.tax),
    taxRateId: asString(expense.taxRateId) || undefined,
    taxName: asString(expense.taxName) || undefined,
    totalAmount: asNumber(expense.totalAmount),
    paymentStatus: normalizeExpensePaymentStatus(expense.paymentStatus),
    paymentDue: asNumber(expense.paymentDue),
    expenseFor: asString(expense.expenseFor),
    contact: asString(expense.contact),
    paymentAccount: asString(expense.paymentAccount),
    paymentMethod: asString(expense.paymentMethod),
    note: asString(expense.note),
    paidAmount: asNumber(expense.paidAmount),
    paidOn: asString(expense.paidOn) || undefined,
    paymentNote: asString(expense.paymentNote) || undefined,
    addedById: asString(expense.addedById) || undefined,
    attachmentName: asString(expense.attachmentName) || undefined,
    addedBy: asString(expense.addedBy),
    isRefund: Boolean(expense.isRefund),
    isRecurring: Boolean(expense.isRecurring),
    recurringInterval: asString(expense.recurringInterval) || undefined,
    recurringUnit: asString(expense.recurringUnit) || undefined,
    recurringRepetitions: asString(expense.recurringRepetitions) || undefined,
  });

  const normalizeSellReturnRecordLoaded = (record: SellReturn): SellReturn => ({
    ...record,
    id: asString(record.id || record.referenceNo),
    referenceNo: asString(record.referenceNo),
    parentSaleId: asString(record.parentSaleId),
    parentInvoiceNo: asString(record.parentInvoiceNo),
    date: asString(record.date),
    customerId: asString(record.customerId),
    customerName: asString(record.customerName),
    location: asString(record.location),
    discountType: record.discountType || 'None',
    discountAmount: asNumber(record.discountAmount),
    tax: asString(record.tax),
    subTotal: asNumber(record.subTotal),
    taxAmount: asNumber(record.taxAmount),
    total: asNumber(record.total),
    settlementMode: record.settlementMode,
    appliedToSaleDue: asNumber(record.appliedToSaleDue),
    creditedToAdvance: asNumber(record.creditedToAdvance),
    autoRefundPaymentId: asString(record.autoRefundPaymentId) || undefined,
    paymentStatus: normalizePurchasePaymentStatus(record.paymentStatus),
    paymentDue: asNumber(record.paymentDue),
    note: asString(record.note) || undefined,
    items: Array.isArray(record.items) ? record.items.map((item) => normalizeSellReturnItemRecord(item)) : [],
    addedBy: asString(record.addedBy),
  });

  const normalizePurchaseReturnRecordLoaded = (record: PurchaseReturn): PurchaseReturn => ({
    ...record,
    id: asString(record.id || record.referenceNo),
    date: asString(record.date),
    referenceNo: asString(record.referenceNo),
    supplierId: asString(record.supplierId),
    supplierName: asString(record.supplierName),
    location: asString(record.location),
    attachDocumentName: asString(record.attachDocumentName) || undefined,
    parentPurchaseId: asString(record.parentPurchaseId) || undefined,
    parentPurchaseRef: asString(record.parentPurchaseRef) || undefined,
    items: Array.isArray(record.items) ? record.items.map((item) => normalizePurchaseReturnItemRecord(item)) : [],
    purchaseTaxId: asString(record.purchaseTaxId) || undefined,
    purchaseTaxName: asString(record.purchaseTaxName) || undefined,
    purchaseTaxAmount: asNumber(record.purchaseTaxAmount),
    subTotal: asNumber(record.subTotal),
    grandTotal: asNumber(record.grandTotal),
    paymentStatus: normalizePurchasePaymentStatus(record.paymentStatus),
    paymentDue: asNumber(record.paymentDue),
    addedBy: asString(record.addedBy),
  });

  const normalizeOrderRecordLoaded = (order: GlobalOrder): GlobalOrder => ({
    ...order,
    id: asString(order.id || order.orderNumber),
    orderNumber: asString(order.orderNumber),
    customerId: asString(order.customerId),
    customerName: asString(order.customerName),
    customerPhone: asString(order.customerPhone),
    orderDate: asString(order.orderDate),
    deliveryDate: asString(order.deliveryDate),
    deliveryTimeSlot: asString(order.deliveryTimeSlot) || undefined,
    status: normalizeOrderStatus(order.status),
    paymentStatus: normalizeOrderPaymentStatus(order.paymentStatus),
    orderType: normalizeOrderType(order.orderType),
    paymentMethod: asString(order.paymentMethod) || undefined,
    source: asString(order.source) || undefined,
    businessLocation: asString(order.businessLocation) || undefined,
    items: Array.isArray(order.items) ? order.items.map((item) => normalizeOrderItemRecord(item)) : [],
    itemCount: asNumber(order.itemCount),
    subTotal: asNumber(order.subTotal),
    discountType: order.discountType,
    discountAmount: asNumber(order.discountAmount),
    taxType: asString(order.taxType),
    taxAmount: asNumber(order.taxAmount),
    total: asNumber(order.total),
    driver: asString(order.driver) || undefined,
    area: asString(order.area),
    salesRep: asString(order.salesRep),
    deliveryAddress: asString(order.deliveryAddress) || undefined,
    note: asString(order.note) || undefined,
    addedBy: asString(order.addedBy) || undefined,
    convertedSaleId: asString(order.convertedSaleId) || undefined,
    convertedInvoiceNo: asString(order.convertedInvoiceNo) || undefined,
    convertedAt: asString(order.convertedAt) || undefined,
    isApproved: Boolean(order.isApproved),
    approvedBy: asString(order.approvedBy) || undefined,
    approvedAt: asString(order.approvedAt) || undefined,
    cancelledBy: asString(order.cancelledBy) || undefined,
    cancelledAt: asString(order.cancelledAt) || undefined,
    cancelReason: asString(order.cancelReason) || undefined,
  });

  const normalizeActivityLogRecordLoaded = (entry: ActivityLogEntry): ActivityLogEntry => ({
    ...entry,
    id: asString(entry.id || `${entry.date}-${entry.action}-${entry.module}`),
    user: asString(entry.user),
    action: asString(entry.action),
    module: asString(entry.module),
    description: asString(entry.description),
    date: asString(entry.date),
    ipAddress: asString(entry.ipAddress) || undefined,
  });

  const normalizePurchaseRequisitionRecordLoaded = (record: PurchaseRequisition): PurchaseRequisition => ({
    ...record,
    id: asString(record.id || record.referenceNo),
    date: asString(record.date),
    referenceNo: asString(record.referenceNo),
    location: asString(record.location),
    supplier: asString(record.supplier),
    supplierId: asString(record.supplierId) || undefined,
    status: normalizeText(record.status) === 'approved'
      ? 'Approved'
      : normalizeText(record.status) === 'ordered'
        ? 'Ordered'
        : 'Pending',
    addedBy: asString(record.addedBy),
    brand: asString(record.brand) || undefined,
    category: asString(record.category) || undefined,
    requiredByDate: asString(record.requiredByDate) || undefined,
    items: Array.isArray(record.items) ? record.items.map((item) => normalizePurchaseRequisitionItemRecord(item)) : [],
    note: asString(record.note) || undefined,
  });

  const normalizePurchaseOrderRecordLoaded = (record: PurchaseOrder): PurchaseOrder => ({
    ...record,
    id: asString(record.id || record.referenceNo),
    orderDate: asString(record.orderDate),
    referenceNo: asString(record.referenceNo),
    supplierId: asString(record.supplierId),
    supplierName: asString(record.supplierName),
    supplierAddress: asString(record.supplierAddress) || undefined,
    location: asString(record.location),
    deliveryDate: asString(record.deliveryDate) || undefined,
    payTermValue: asString(record.payTermValue) || undefined,
    payTermType: record.payTermType,
    attachDocumentName: asString(record.attachDocumentName) || undefined,
    purchaseRequisitionId: asString(record.purchaseRequisitionId) || undefined,
    purchaseRequisitionRef: asString(record.purchaseRequisitionRef) || undefined,
    items: Array.isArray(record.items) ? record.items.map((item) => normalizePurchaseOrderItemRecord(item)) : [],
    shippingDetails: asString(record.shippingDetails) || undefined,
    shippingAddress: asString(record.shippingAddress) || undefined,
    shippingCharges: asNumber(record.shippingCharges),
    shippingStatus: record.shippingStatus,
    deliveredTo: asString(record.deliveredTo) || undefined,
    shippingDocumentName: asString(record.shippingDocumentName) || undefined,
    additionalExpenses: asNumber(record.additionalExpenses),
    additionalNotes: asString(record.additionalNotes) || undefined,
    totalItems: asNumber(record.totalItems),
    netTotalAmount: asNumber(record.netTotalAmount),
    orderTotal: asNumber(record.orderTotal),
    status: normalizeText(record.status) === 'sent'
      ? 'Sent'
      : normalizeText(record.status) === 'received'
        ? 'Received'
        : normalizeText(record.status) === 'partial'
          ? 'Partial'
          : 'Draft',
    addedBy: asString(record.addedBy),
  });

  // ============================================================
  //  CRUD: PRODUCTS
  // ============================================================

  const toCrudResult = (
    result: { ok: boolean; status: number; error?: string },
  ): CrudMutationResult => ({
    ok: !!result.ok,
    status: Number(result.status || 0),
    error: result.ok ? undefined : (result.error || `HTTP ${result.status || 0}`),
  });
  const okResult = (status = 200): CrudMutationResult => ({ ok: true, status });
  const failResult = (status = 0, error = 'Operation failed'): CrudMutationResult => ({ ok: false, status, error });
  const toLocationResult = (
    result: CrudMutationResult,
    fallbackMessage: string,
  ): LocationMutationResult => ({
    ...result,
    success: result.ok,
    message: result.ok ? undefined : (result.error || fallbackMessage),
  });

  const addProduct = async (product: Product): Promise<CrudMutationResult> => {
    const normalized = normalizeProductRecord(product, productCategories, productBrands, warranties);
    const saved = await syncRecordStrict('products', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Products',
        description: `Failed to add product ${normalized.name || normalized.sku || normalized.id} to Postgres (${result.status || 0}).`,
      });
      return result;
    }

    if (normalized.openingStock && normalized.openingStock > 0 && normalized.openingStockLocation) {
      await applyStockDelta(
        { [normalized.id]: normalized.openingStock },
        normalized.openingStockLocation
      );
    }

    setProducts(prev => [...prev, normalized]);
    recordActivity({
      action: 'Created',
      module: 'Products',
      description: `Added product: ${normalized.name || normalized.sku || normalized.id}`,
    });
    return result;
  };
  const confirmDeleteFromPostgres = (
    resource: string,
    id: string,
    module: string,
    failureLabel: string,
    onConfirmed: () => void | Promise<void>,
  ): Promise<CrudMutationResult> => {
    const normalizedId = String(id || '').trim();
    if (!normalizedId) return Promise.resolve(failResult(400, 'Missing record id.'));
    return (async () => {
      const outcome = await deleteRecordStrict(resource, normalizedId);
      const result = toCrudResult(outcome);
      if (!result.ok) {
        recordActivity({
          action: 'Blocked',
          module,
          description: `Failed to delete ${failureLabel} from Postgres (${result.status || 0}).`,
        });
        return result;
      }
      await onConfirmed();
      return result;
    })();
  };

  const updateProduct = async (product: Product): Promise<CrudMutationResult> => {
    const normalized = normalizeProductRecord(product, productCategories, productBrands, warranties);
    const saved = await syncRecordStrict('products', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Products',
        description: `Failed to update product ${normalized.name || normalized.sku || normalized.id} in Postgres (${result.status || 0}).`,
      });
      return result;
    }
    setProducts(prev => prev.map(p => p.id === product.id ? normalized : p));
    recordActivity({
      action: 'Updated',
      module: 'Products',
      description: `Updated product: ${normalized.name || normalized.sku || normalized.id}`,
    });
    return result;
  };
  const deleteProduct = async (id: string): Promise<CrudMutationResult> => {
    const existing = products.find(p => p.id === id);
    return confirmDeleteFromPostgres('products', id, 'Products', existing?.name || existing?.sku || id, () => {
      setProducts(prev => prev.filter(p => p.id !== id));
      recordActivity({
        action: 'Deleted',
        module: 'Products',
        description: `Deleted product: ${existing?.name || existing?.sku || id}`,
      });
    });
  };

  // ============================================================
  //  CRUD: CUSTOMERS
  // ============================================================

  const addCustomer = async (customer: Customer): Promise<CrudMutationResult> => {
    const normalized = normalizeCustomerRecord(customer, customerGroups);
    const saved = await syncRecordStrict('customers', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Customers',
        description: `Failed to add customer ${normalized.businessName || normalized.name || normalized.id} to Postgres (${result.status || 0}).`,
      });
      return result;
    }
    setCustomers(prev => [...prev, normalized]);
    recordActivity({
      action: 'Created',
      module: 'Customers',
      description: `Added customer: ${normalized.businessName || normalized.name || normalized.id}`,
    });
    return result;
  };
  const updateCustomer = async (customer: Customer): Promise<CrudMutationResult> => {
    const normalized = normalizeCustomerRecord(customer, customerGroups);
    const saved = await syncRecordStrict('customers', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Customers',
        description: `Failed to update customer ${normalized.businessName || normalized.name || normalized.id} in Postgres (${result.status || 0}).`,
      });
      return result;
    }
    setCustomers(prev => prev.map(c => c.id === customer.id ? normalized : c));
    recordActivity({
      action: 'Updated',
      module: 'Customers',
      description: `Updated customer: ${normalized.businessName || normalized.name || normalized.id}`,
    });
    return result;
  };
  const addCustomerRewardPoints = async (customerId: string, points: number): Promise<CrudMutationResult> => {
    const existing = customers.find(customer => customer.id === customerId);
    if (!existing) return failResult(404, 'Customer not found.');
    const updatedCustomer: Customer = {
      ...existing,
      rewardPoints: Math.max(0, Number(existing.rewardPoints || 0) + Number(points || 0)),
    };
    const saved = await syncRecordStrict('customers', updatedCustomer);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Customers',
        description: `Failed to update reward points for ${updatedCustomer.businessName || updatedCustomer.name || updatedCustomer.id} in Postgres (${result.status || 0}).`,
      });
      return result;
    }
    setCustomers(prev => prev.map(customer => customer.id === customerId ? updatedCustomer : customer));
    return result;
  };

  const redeemCustomerRewardPoints = async (customerId: string, points: number): Promise<CrudMutationResult> => {
    const existing = customers.find(customer => customer.id === customerId);
    if (!existing) return failResult(404, 'Customer not found.');
    const updatedCustomer: Customer = {
      ...existing,
      rewardPoints: Math.max(0, Number(existing.rewardPoints || 0) - Number(points || 0)),
    };
    const saved = await syncRecordStrict('customers', updatedCustomer);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Customers',
        description: `Failed to redeem reward points for ${updatedCustomer.businessName || updatedCustomer.name || updatedCustomer.id} in Postgres (${result.status || 0}).`,
      });
      return result;
    }
    setCustomers(prev => prev.map(customer => customer.id === customerId ? updatedCustomer : customer));
    return result;
  };

  const deleteCustomer = async (id: string): Promise<CrudMutationResult> => {
    const existing = customers.find(c => c.id === id);
    return confirmDeleteFromPostgres('customers', id, 'Customers', existing?.businessName || existing?.name || id, () => {
      setCustomers(prev => prev.filter(c => c.id !== id));
      recordActivity({
        action: 'Deleted',
        module: 'Customers',
        description: `Deleted customer: ${existing?.businessName || existing?.name || id}`,
      });
    });
  };

  // ============================================================
  //  CRUD: SUPPLIERS
  // ============================================================

  const addSupplier = async (supplier: Supplier): Promise<CrudMutationResult> => {
    const normalized = normalizeSupplierRecord(supplier);
    const saved = await syncRecordStrict('suppliers', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Suppliers',
        description: `Failed to add supplier ${normalized.businessName || normalized.name || normalized.id} to Postgres (${result.status || 0}).`,
      });
      return result;
    }
    setSuppliers(prev => [...prev, normalized]);
    recordActivity({
      action: 'Created',
      module: 'Suppliers',
      description: `Added supplier: ${normalized.businessName || normalized.name || normalized.id}`,
    });
    return result;
  };
  const updateSupplier = async (supplier: Supplier): Promise<CrudMutationResult> => {
    const normalized = normalizeSupplierRecord(supplier);
    const saved = await syncRecordStrict('suppliers', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Suppliers',
        description: `Failed to update supplier ${normalized.businessName || normalized.name || normalized.id} in Postgres (${result.status || 0}).`,
      });
      return result;
    }
    setSuppliers(prev => prev.map(s => s.id === supplier.id ? normalized : s));
    recordActivity({
      action: 'Updated',
      module: 'Suppliers',
      description: `Updated supplier: ${normalized.businessName || normalized.name || normalized.id}`,
    });
    return result;
  };
  const deleteSupplier = async (id: string): Promise<CrudMutationResult> => {
    const existing = suppliers.find(s => s.id === id);
    return confirmDeleteFromPostgres('suppliers', id, 'Suppliers', existing?.businessName || existing?.name || id, () => {
      setSuppliers(prev => prev.filter(s => s.id !== id));
      recordActivity({
        action: 'Deleted',
        module: 'Suppliers',
        description: `Deleted supplier: ${existing?.businessName || existing?.name || id}`,
      });
    });
  };

  // ============================================================
  //  CRUD: CONTACTS (legacy)
  // ============================================================

  const addContact = async (contact: Contact): Promise<CrudMutationResult> => {
    const recordId = String(contact.contactId || `${contact.type === 'Supplier' ? 'SUP' : 'CUST'}-${contact.id}`).trim();
    if (contact.type === 'Supplier') {
      const supplier: Supplier = {
        id: recordId,
        type: 'Supplier',
        businessName: contact.businessName || contact.name,
        name: contact.name || contact.businessName,
        email: contact.email || '',
        mobile: contact.mobile || '',
        taxNumber: contact.taxNumber || '',
        payTerm: contact.payTerm || '',
        openingBalance: Number(contact.balance || 0),
        advanceBalance: 0,
        totalPurchaseDue: Number(contact.balance || 0),
        totalReturnDue: 0,
        addedOn: new Date().toISOString(),
        address: '',
        status: contact.status,
      };
      const normalizedSupplier = normalizeSupplierRecord(supplier);
      const saved = await syncRecordStrict('suppliers', normalizedSupplier);
      const result = toCrudResult(saved);
      if (!result.ok) {
        recordActivity({
          action: 'Blocked',
          module: 'Suppliers',
          description: `Failed to save supplier contact ${normalizedSupplier.businessName || normalizedSupplier.name || normalizedSupplier.id} to Postgres (${result.status || 0}).`,
        });
        return result;
      }
      setSuppliers(prev => [...prev.filter(row => row.id !== recordId), normalizedSupplier]);
      return result;
    }

    const customer: Customer = {
      id: recordId,
      type: 'Customer',
      businessName: contact.businessName || contact.name,
      name: contact.name || contact.businessName,
      email: contact.email || '',
      mobile: contact.mobile || '',
      taxNumber: contact.taxNumber || '',
      creditLimit: Number(contact.creditLimit || 0),
      payTerm: contact.payTerm || '',
      openingBalance: Number(contact.balance || 0),
      advanceBalance: 0,
      totalSellDue: Number(contact.balance || 0),
      totalSellReturnDue: 0,
      addedOn: new Date().toISOString(),
      customerGroup: '',
      address: '',
      status: contact.status,
    };
    const normalizedCustomer = normalizeCustomerRecord(customer, customerGroups);
    const saved = await syncRecordStrict('customers', normalizedCustomer);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Customers',
        description: `Failed to save customer contact ${normalizedCustomer.businessName || normalizedCustomer.name || normalizedCustomer.id} to Postgres (${result.status || 0}).`,
      });
      return result;
    }
    setCustomers(prev => [...prev.filter(row => row.id !== recordId), normalizedCustomer]);
    return result;
  };
  const updateContact = async (contact: Contact): Promise<CrudMutationResult> => {
    return addContact(contact);
  };
  const deleteContact = async (id: number): Promise<CrudMutationResult> => {
    const existing = contacts.find(contact => contact.id === id);
    if (!existing) return failResult(404, 'Contact not found.');
    if (existing.type === 'Supplier') {
      const contactId = String(existing.contactId || '').trim();
      return confirmDeleteFromPostgres('suppliers', contactId, 'Suppliers', existing.businessName || existing.name || contactId, () => {
        setSuppliers(prev => prev.filter(supplier => supplier.id !== existing.contactId));
      });
    }
    const contactId = String(existing.contactId || '').trim();
    return confirmDeleteFromPostgres('customers', contactId, 'Customers', existing.businessName || existing.name || contactId, () => {
      setCustomers(prev => prev.filter(customer => customer.id !== existing.contactId));
    });
  };

  // ============================================================
  //  CRUD: SALES
  //  Only Final sales affect stock and customer due balances
  // ============================================================

  const normalizeSaleLifecycleStatus = (value: unknown): Sale['status'] | '' => {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'FINAL') return 'Final';
    if (normalized === 'DRAFT' || normalized === 'SUSPEND') return 'Draft';
    if (normalized === 'QUOTATION') return 'Quotation';
    if (normalized === 'PROFORMA') return 'Proforma';
    return '';
  };

  const isFinalizedSale = (sale: Sale): boolean =>
    normalizeSaleLifecycleStatus(sale.status || sale.saleStatus) === 'Final';

  const saleDueAmount = (sale: Sale): number => {
    if (sale.paymentStatus === 'Paid') return 0;
    if (typeof sale.sellDue === 'number') return Math.max(0, sale.sellDue);
    return Math.max(0, (sale.grandTotal || sale.totalAmount || 0) - (sale.totalPaid || 0));
  };

  const isWalkInSale = (sale: Sale): boolean => {
    const customerId = String(sale.customerId || '').trim().toUpperCase();
    return !sale.customerId || customerId === 'WALK-IN' || customerId === 'DIRECT-CUSTOMER';
  };

  const isSaleCustomerMatch = (customer: Customer, sale: Sale): boolean => {
    return customer.id === String(sale.customerId) || customer.businessName === sale.customerName;
  };

  const resolveSaleCustomerGroupSnapshot = (sale: Sale): { customerGroupId: string; customerGroup: string } => {
    const explicitGroupId = String(sale.customerGroupId || '').trim();
    const explicitGroupName = String(sale.customerGroup || '').trim();
    if (explicitGroupId || explicitGroupName) {
      const linkedById = explicitGroupId
        ? customerGroups.find(group => group.id === explicitGroupId)
        : undefined;
      return {
        customerGroupId: explicitGroupId || String(linkedById?.id || '').trim(),
        customerGroup: explicitGroupName || String(linkedById?.name || '').trim(),
      };
    }

    const saleCustomerId = String(sale.customerId || '').trim();
    const saleCustomerNameNorm = normalizeText(sale.customerName);
    const matchedCustomer = customers.find(customer => (
      String(customer.id || '').trim() === saleCustomerId
      || normalizeText(customer.businessName) === saleCustomerNameNorm
      || normalizeText(customer.name) === saleCustomerNameNorm
    ));
    if (!matchedCustomer) {
      return { customerGroupId: '', customerGroup: '' };
    }

    const linkedGroup = resolveCustomerGroupLink(
      matchedCustomer.customerGroupId,
      matchedCustomer.customerGroup,
      customerGroups,
    );
    return {
      customerGroupId: String(linkedGroup.id || '').trim(),
      customerGroup: String(linkedGroup.name || '').trim(),
    };
  };

  const withSaleCustomerGroupSnapshot = (sale: Sale): Sale => {
    const snapshot = resolveSaleCustomerGroupSnapshot(sale);
    const nextGroupId = snapshot.customerGroupId;
    const nextGroupName = snapshot.customerGroup;
    const currentGroupId = String(sale.customerGroupId || '').trim();
    const currentGroupName = String(sale.customerGroup || '').trim();
    if (nextGroupId === currentGroupId && nextGroupName === currentGroupName) return sale;
    return {
      ...sale,
      customerGroupId: nextGroupId,
      customerGroup: nextGroupName,
    };
  };

  const buildSaleStockDelta = (sale: Sale, multiplier: number): Record<string, number> => {
    const delta: Record<string, number> = {};
    (sale.items || []).forEach(item => {
      const key = String((item as any).productId || item.id || '').trim();
      if (!key) return;
      
      const qty = multiplier * (item.qty || 0);
      const product = products.find(p => p.id === key || p.sku === key);
      
      if (product && String(product.type || '').trim().toLowerCase() === 'combo' && product.comboItems && product.comboItems.length > 0) {
        product.comboItems.forEach(cItem => {
          const cKey = String(cItem.productId || '').trim();
          if (cKey) {
            delta[cKey] = (delta[cKey] || 0) + (qty * (cItem.qty || 1));
          }
        });
      } else {
        delta[key] = (delta[key] || 0) + qty;
      }
    });
    return delta;
  };

  const mergeStockDelta = (target: Record<string, number>, next: Record<string, number>) => {
    Object.entries(next).forEach(([k, v]) => {
      target[k] = (target[k] || 0) + v;
    });
  };

  const applyStockDelta = async (deltaByProduct: Record<string, number>, locationName?: string): Promise<CrudMutationResult> => {
    if (Object.keys(deltaByProduct).length === 0) return okResult(200);
    const perProductDeltas = products
      .map((product) => {
        const delta = Number((deltaByProduct[product.id] || 0) + (deltaByProduct[product.sku] || 0));
        if (!delta) return null;
        return { id: product.id, delta };
      })
      .filter((entry): entry is { id: string; delta: number } => !!entry);
    if (perProductDeltas.length === 0) return okResult(200);

    const linkedLocation = locationName ? resolveLocationRecordByName(locationName) : null;
    const usesBranchInventory = !!linkedLocation;

    if (usesBranchInventory) {
      try {
        const currentInventory = await fetchLocationInventoryFromDB();
        const nextInventory = currentInventory.map(row => ({ ...row }));
        
        perProductDeltas.forEach((entry) => {
          const key = inventoryKey(entry.id, linkedLocation.id);
          const matchIndex = nextInventory.findIndex(r => inventoryKey(r.productId, r.locationId) === key);
          if (matchIndex >= 0) {
            nextInventory[matchIndex].stock = Math.max(0, nextInventory[matchIndex].stock + entry.delta);
          } else if (entry.delta > 0) {
             const product = products.find(p => p.id === entry.id);
             nextInventory.push({
               id: `PINV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
               productId: entry.id,
               locationId: linkedLocation.id,
               locationName: linkedLocation.name,
               stock: entry.delta,
               unitCost: product ? Number(product.unitPurchasePrice || 0) : 0,
             });
          }
        });

        const syncResult = await syncChangedLocationInventoryStrict(nextInventory, currentInventory);
        if (!syncResult.ok) {
           return toCrudResult(syncResult);
        }

        // Also proactively update the global products array in React state to reflect the new global sum
        // The Postgres trigger automatically updates the DB `Product.stock`, but we need to update UI.
        const deltaById = new Map<string, number>(perProductDeltas.map((entry) => [entry.id, entry.delta]));
        setProducts(prevProducts => prevProducts.map((product) => {
          const delta = deltaById.get(product.id) || 0;
          if (!delta) return product;
          return { ...product, stock: Math.max(0, product.stock + delta) };
        }));

        return okResult(200);
      } catch (error) {
        return failResult(500, String(error));
      }
    }

    // Fallback if no location was provided: just return ok (stock changes MUST have a location now).
    // In legacy cases, we don't update anything if we don't know where it happened.
    console.warn('applyStockDelta: No location provided, skipping stock update.');
    return okResult(200);
  };

  const refreshSalesFromServer = async (): Promise<void> => {
    if (!isLiveSyncEnabled() || !hasValidAuthToken()) return;
    const freshSales = await apiFetchAll<Sale>('sales').catch(() => null);
    if (!freshSales) return;
    setSales((freshSales as Sale[]).map((record) => normalizeSaleRecordLoaded(record)));
  };

  const addSale = async (sale: Sale): Promise<CrudMutationResult> => {
    if (!enforcePermissionBoundary('Sell', 'Add Sell', 'Create sale')) return failResult(403, 'Permission denied.');
    const saleWithSnapshot = withSaleCustomerGroupSnapshot(normalizeSaleRecordLoaded(sale));
    const linkedLocation = resolveLocationRecordByName(saleWithSnapshot.location);
    if (!linkedLocation || linkedLocation.isActive === false) {
      recordActivity({
        action: 'Blocked',
        module: 'Sales',
        description: `Blocked sale creation for ${saleWithSnapshot.invoiceNo || saleWithSnapshot.id}: selected location is inactive.`,
      });
      return failResult(400, 'Selected location is inactive.');
    }
    if (!isWalkInSale(saleWithSnapshot)) {
      const linkedCustomer = resolveCustomerRecordForTransaction(
        String(saleWithSnapshot.customerId || ''),
        saleWithSnapshot.customerName,
      );
      if (!linkedCustomer) {
        recordActivity({
          action: 'Blocked',
          module: 'Sales',
          description: `Blocked sale creation for ${saleWithSnapshot.invoiceNo || saleWithSnapshot.id}: customer not found.`,
        });
        return failResult(404, 'Customer not found.');
      }
      if (!isCustomerRecordActive(linkedCustomer)) {
        recordActivity({
          action: 'Blocked',
          module: 'Sales',
          description: `Blocked sale creation for ${saleWithSnapshot.invoiceNo || saleWithSnapshot.id}: customer is inactive.`,
        });
        return failResult(400, 'Customer is inactive.');
      }
    }

    const syncOutcome = await syncRecordStrict('sales', saleWithSnapshot);
    if (!syncOutcome.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Sales',
        description: `Failed to save sale ${saleWithSnapshot.invoiceNo || saleWithSnapshot.id} to Postgres (${syncOutcome.status || 0}).`,
      });
      return toCrudResult(syncOutcome);
    }

    setSales(prev => {
      const exists = prev.some(existing => String(existing.id || '').trim() === String(saleWithSnapshot.id || '').trim());
      if (exists) {
        return prev.map(existing =>
          String(existing.id || '').trim() === String(saleWithSnapshot.id || '').trim() ? saleWithSnapshot : existing,
        );
      }
      return [...prev, saleWithSnapshot];
    });
    recordActivity({
      action: 'Created',
      module: 'Sales',
      description: `Created sale: ${saleWithSnapshot.invoiceNo || saleWithSnapshot.id}`,
    });

    let stockSyncFailure: CrudMutationResult | null = null;
    if (isFinalizedSale(saleWithSnapshot)) {
      const stockResult = await applyStockDelta(buildSaleStockDelta(saleWithSnapshot, -1), saleWithSnapshot.location);
      if (!stockResult.ok) {
        recordActivity({
          action: 'Blocked',
          module: 'Sales',
          description: `Sale saved but stock sync failed for ${saleWithSnapshot.invoiceNo || saleWithSnapshot.id}: ${stockResult.error || `HTTP ${stockResult.status || 0}`}.`,
        });
        stockSyncFailure = stockResult;
      }

      if (!isWalkInSale(saleWithSnapshot)) {
        const dueToAdd = saleDueAmount(saleWithSnapshot);
        const customerToUpdate = customers.find((customer) => isSaleCustomerMatch(customer, saleWithSnapshot));
        if (customerToUpdate) {
          const updated = {
            ...customerToUpdate,
            lastSellDate: getBusinessDateString(),
            totalSellDue: customerToUpdate.totalSellDue + dueToAdd,
          };
          const customerSaved = await syncRecordStrict('customers', updated);
          if (customerSaved.ok) {
            setCustomers(prev => prev.map(c => (c.id === updated.id ? updated : c)));
          }
        }
      }

      // Auto-create a payment record if money was collected at time of sale
      const paidAmount = typeof saleWithSnapshot.totalPaid === 'number' ? saleWithSnapshot.totalPaid : 0;
      if (paidAmount > 0) {
        const prefix = settings.sellPaymentPrefix || 'SP';
        const payRef = `${prefix}-${saleWithSnapshot.invoiceNo || Date.now()}`;
        const payRecord: Payment = {
          id: `pay-${saleWithSnapshot.id}`,
          date: saleWithSnapshot.paymentDate || saleWithSnapshot.date,
          contactId: String(saleWithSnapshot.customerId || 'WALK-IN'),
          contactName: saleWithSnapshot.customerName || 'Walk-in Customer',
          contactType: 'Customer',
          amount: paidAmount,
          method: saleWithSnapshot.paymentMethod || 'Cash',
          account: resolveDefaultAccountFromMethod(saleWithSnapshot.paymentMethod || 'Cash'),
          location: saleWithSnapshot.location || '',
          referenceNo: payRef,
          note: saleWithSnapshot.paymentNote || `Payment for invoice ${saleWithSnapshot.invoiceNo}`,
          type: 'received',
          linkedInvoices: saleWithSnapshot.invoiceNo ? [saleWithSnapshot.invoiceNo] : [],
          addedBy: saleWithSnapshot.addedBy || 'System',
        };
        const paymentSaved = await syncRecordStrict('payments', payRecord);
        if (paymentSaved.ok) {
          setPayments(prev => {
            const exists = prev.some(payment => payment.id === payRecord.id);
            return exists
              ? prev.map(payment => payment.id === payRecord.id ? payRecord : payment)
              : [...prev, payRecord];
          });
        }
      }
    }
    void refreshSalesFromServer();
    if (stockSyncFailure) {
      return failResult(
        stockSyncFailure.status || 500,
        stockSyncFailure.error || 'Sale saved, but stock sync failed.',
      );
    }
    return okResult(syncOutcome.status || 200);
  };

  const updateSale = async (sale: Sale): Promise<CrudMutationResult> => {
    if (!enforcePermissionBoundary('Sell', ['Add Sell', 'Edit Sell'], 'Update sale')) return failResult(403, 'Permission denied.');
    const normalizedSale = normalizeSaleRecordLoaded(sale);
    if (!canEditTransaction('Sales', String(normalizedSale.invoiceNo || normalizedSale.id || '').trim(), normalizedSale.date)) {
      return failResult(403, 'Edit window expired.');
    }
    const saleWithSnapshot = withSaleCustomerGroupSnapshot(normalizedSale);
    const syncOutcome = await syncRecordStrict('sales', saleWithSnapshot);
    if (!syncOutcome.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Sales',
        description: `Failed to update sale ${saleWithSnapshot.invoiceNo || saleWithSnapshot.id} in Postgres (${syncOutcome.status || 0}).`,
      });
      return toCrudResult(syncOutcome);
    }
    const oldSale = sales.find(s => s.id === saleWithSnapshot.id);
    if (!oldSale) return failResult(404, 'Sale not found.');
    let stockSyncFailure: CrudMutationResult | null = null;

    let stockResult: CrudMutationResult = okResult(200);
    if (oldSale.location === saleWithSnapshot.location) {
      const stockDelta: Record<string, number> = {};
      if (isFinalizedSale(oldSale)) mergeStockDelta(stockDelta, buildSaleStockDelta(oldSale, +1));
      if (isFinalizedSale(saleWithSnapshot)) mergeStockDelta(stockDelta, buildSaleStockDelta(saleWithSnapshot, -1));
      stockResult = await applyStockDelta(stockDelta, saleWithSnapshot.location);
    } else {
      if (isFinalizedSale(oldSale)) await applyStockDelta(buildSaleStockDelta(oldSale, +1), oldSale.location);
      if (isFinalizedSale(saleWithSnapshot)) stockResult = await applyStockDelta(buildSaleStockDelta(saleWithSnapshot, -1), saleWithSnapshot.location);
    }
    if (!stockResult.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Sales',
        description: `Sale updated but stock sync failed for ${saleWithSnapshot.invoiceNo || saleWithSnapshot.id}: ${stockResult.error || `HTTP ${stockResult.status || 0}`}.`,
      });
      stockSyncFailure = stockResult;
    }

    const oldDue = isFinalizedSale(oldSale) && !isWalkInSale(oldSale) ? saleDueAmount(oldSale) : 0;
    const newDue = isFinalizedSale(saleWithSnapshot) && !isWalkInSale(saleWithSnapshot) ? saleDueAmount(saleWithSnapshot) : 0;
    const oldWasFinalized = isFinalizedSale(oldSale);
    const newIsFinalized = isFinalizedSale(saleWithSnapshot);

    const changedCustomers = customers
      .map((customer) => {
        let next = customer;
        const matchesOldSale = isSaleCustomerMatch(next, oldSale);
        const matchesNewSale = isSaleCustomerMatch(next, saleWithSnapshot);
        if (oldDue > 0 && matchesOldSale) {
          next = { ...next, totalSellDue: Math.max(0, next.totalSellDue - oldDue) };
        }
        if (newDue > 0 && matchesNewSale) {
          next = { ...next, totalSellDue: next.totalSellDue + newDue };
        }
        if (newIsFinalized && matchesNewSale && (!oldWasFinalized || !matchesOldSale)) {
          next = { ...next, lastSellDate: getBusinessDateString() };
        }
        return next !== customer ? next : null;
      })
      .filter((entry): entry is Customer => !!entry);

    if (changedCustomers.length > 0) {
      const persisted = new Map<string, Customer>();
      for (const customer of changedCustomers) {
        const saved = await syncRecordStrict('customers', customer);
        if (saved.ok) persisted.set(customer.id, customer);
      }
      if (persisted.size > 0) {
        setCustomers(prev => prev.map(customer => persisted.get(customer.id) || customer));
      }
    }

    setSales(prev => prev.map(s => s.id === saleWithSnapshot.id ? saleWithSnapshot : s));
    recordActivity({
      action: 'Updated',
      module: 'Sales',
      description: `Updated sale: ${saleWithSnapshot.invoiceNo || saleWithSnapshot.id}`,
    });

    // Sync the auto-generated payment record if paid amount changed
    const payId = `pay-${saleWithSnapshot.id}`;
    if (isFinalizedSale(saleWithSnapshot)) {
      const paidAmount = typeof saleWithSnapshot.totalPaid === 'number' ? saleWithSnapshot.totalPaid : 0;
      const prefix = settings.sellPaymentPrefix || 'SP';
      const payRef = `${prefix}-${saleWithSnapshot.invoiceNo || Date.now()}`;
      if (paidAmount > 0) {
        const paymentRecord: Payment = {
          id: payId,
          date: saleWithSnapshot.paymentDate || saleWithSnapshot.date,
          contactId: String(saleWithSnapshot.customerId || 'WALK-IN'),
          contactName: saleWithSnapshot.customerName || 'Walk-in Customer',
          contactType: 'Customer',
          amount: paidAmount,
          method: saleWithSnapshot.paymentMethod || 'Cash',
          account: resolveDefaultAccountFromMethod(saleWithSnapshot.paymentMethod || 'Cash'),
          location: saleWithSnapshot.location || '',
          referenceNo: payRef,
          note: saleWithSnapshot.paymentNote || `Payment for invoice ${saleWithSnapshot.invoiceNo}`,
          type: 'received',
          linkedInvoices: saleWithSnapshot.invoiceNo ? [saleWithSnapshot.invoiceNo] : [],
          addedBy: saleWithSnapshot.addedBy || 'System',
        };
        const paymentSaved = await syncRecordStrict('payments', paymentRecord);
        if (paymentSaved.ok) {
          setPayments(prev => {
            const exists = prev.find(p => p.id === payId);
            return exists ? prev.map(p => p.id === payId ? paymentRecord : p) : [...prev, paymentRecord];
          });
        }
      } else {
        // Payment was removed (changed to Credit Sale) — remove the auto record
        const removed = await deleteRecordStrict('payments', payId);
        if (removed.ok) {
          setPayments(prev => prev.filter(p => p.id !== payId));
        }
      }
    } else {
      const removed = await deleteRecordStrict('payments', payId);
      if (removed.ok) {
        setPayments(prev => prev.filter(p => p.id !== payId));
      }
    }
    void refreshSalesFromServer();
    if (stockSyncFailure) {
      return failResult(
        stockSyncFailure.status || 500,
        stockSyncFailure.error || 'Sale updated, but stock sync failed.',
      );
    }
    return okResult(syncOutcome.status || 200);
  };

  const deleteSale = async (id: string): Promise<CrudMutationResult> => {
    if (!enforcePermissionBoundary('Sell', ['Add Sell', 'Delete Sell'], 'Delete sale')) return failResult(403, 'Permission denied.');
    const normalizedSaleId = String(id || '').trim();
    const hasLinkedSellReturn = (saleId: string) =>
      sellReturns.some(ret => String(ret.parentSaleId || '').trim() === saleId);
    if (hasLinkedSellReturn(normalizedSaleId)) return failResult(409, 'Sale has linked sell return.');
    const existingSale = sales.find(s => String(s.id || '').trim() === normalizedSaleId);
    const deleteOutcome = await deleteRecordStrict('sales', normalizedSaleId);
    if (!deleteOutcome.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Sales',
        description: `Failed to delete sale ${existingSale?.invoiceNo || normalizedSaleId} from Postgres (${deleteOutcome.status || 0}).`,
      });
      return toCrudResult(deleteOutcome);
    }
    const saleToDelete = sales.find(s => String(s.id || '').trim() === normalizedSaleId);
    let stockSyncFailure: CrudMutationResult | null = null;
    if (saleToDelete) {
      if (isFinalizedSale(saleToDelete)) {
        const stockResult = await applyStockDelta(buildSaleStockDelta(saleToDelete, +1), saleToDelete.location);
        if (!stockResult.ok) {
          recordActivity({
            action: 'Blocked',
            module: 'Sales',
            description: `Sale deleted but stock rollback failed for ${saleToDelete.invoiceNo || saleToDelete.id}: ${stockResult.error || `HTTP ${stockResult.status || 0}`}.`,
          });
          stockSyncFailure = stockResult;
        }
      }

      if (!isWalkInSale(saleToDelete) && isFinalizedSale(saleToDelete)) {
        const dueToRemove = saleDueAmount(saleToDelete);
        if (dueToRemove > 0) {
          const customerToUpdate = customers.find(customer => isSaleCustomerMatch(customer, saleToDelete));
          if (customerToUpdate) {
            const updated = {
              ...customerToUpdate,
              totalSellDue: Math.max(0, customerToUpdate.totalSellDue - dueToRemove),
            };
            const customerSaved = await syncRecordStrict('customers', updated);
            if (customerSaved.ok) {
              setCustomers(prevCustomers => prevCustomers.map(c => (c.id === updated.id ? updated : c)));
            }
          }
        }
      }
    }

    setSales(prev => prev.filter(s => String(s.id || '').trim() !== normalizedSaleId));
    // Remove the auto-generated payment record for this sale
    const paymentDeleted = await deleteRecordStrict('payments', `pay-${normalizedSaleId}`);
    if (paymentDeleted.ok) {
      setPayments(prev => prev.filter(p => p.id !== `pay-${normalizedSaleId}`));
    }
    recordActivity({
      action: 'Deleted',
      module: 'Sales',
      description: `Deleted sale: ${existingSale?.invoiceNo || existingSale?.id || normalizedSaleId}`,
    });
    void refreshSalesFromServer();
    if (stockSyncFailure) {
      return failResult(
        stockSyncFailure.status || 500,
        stockSyncFailure.error || 'Sale deleted, but stock rollback failed.',
      );
    }
    return okResult(deleteOutcome.status || 200);
  };

  // ============================================================
  //  CRUD: SELL RETURNS
  //  sell return records affect stock and keep sale.sellReturnDue synced
  // ============================================================

  const buildSellReturnStockDelta = (sellReturn: SellReturn, multiplier: 1 | -1): Record<string, number> => {
    const delta: Record<string, number> = {};
    (sellReturn.items || []).forEach(item => {
      const key = String(item.productId || '').trim();
      if (!key) return;
      const qty = multiplier * Number(item.qty || 0);
      if (!qty) return;

      const product = products.find(p => p.id === key);
      if (product && String(product.type || '').trim().toLowerCase() === 'combo' && product.comboItems && product.comboItems.length > 0) {
        product.comboItems.forEach(cItem => {
          const cKey = String(cItem.productId || '').trim();
          if (cKey) {
            delta[cKey] = (delta[cKey] || 0) + (qty * (cItem.qty || 1));
          }
        });
      } else {
        delta[key] = (delta[key] || 0) + qty;
      }
    });
    return delta;
  };

  const applySellReturnEffects = async (sellReturn: SellReturn, factor: 1 | -1): Promise<CrudMutationResult> => {
    return applyStockDelta(buildSellReturnStockDelta(sellReturn, factor), sellReturn.location);
  };

  const resolveSaleDueCeiling = (sale: Sale): number =>
    Math.max(0, Number(((sale.grandTotal || sale.totalAmount || 0) - (sale.totalPaid || 0)).toFixed(3)));

  const deriveSalePaymentStatusFromDue = (sale: Sale, due: number): Sale['paymentStatus'] => {
    const nextDue = Math.max(0, Number(due.toFixed(3)));
    if (nextDue <= 0.001) return 'Paid';
    const ceiling = resolveSaleDueCeiling(sale);
    if (ceiling > 0 && nextDue < ceiling - 0.001) return 'Partial';
    return sale.paymentStatus === 'Overdue' ? 'Overdue' : 'Due';
  };

  const applySellReturnFinancialEffects = (sellReturn: SellReturn, factor: 1 | -1) => {
    const appliedDelta = Number((Number(sellReturn.appliedToSaleDue || 0) * factor).toFixed(3));
    const creditDelta = Number((Number(sellReturn.creditedToAdvance || 0) * factor).toFixed(3));
    const targetSaleId = String(sellReturn.parentSaleId || '').trim();
    const targetCustomerId = String(sellReturn.customerId || '').trim();
    const targetCustomerName = normalizeText(sellReturn.customerName);

    if (Math.abs(appliedDelta) > 0.0005 && targetSaleId) {
      setSales(prev => prev.map(sale => {
        if (String(sale.id || '').trim() !== targetSaleId) return sale;
        const currentDue = typeof sale.sellDue === 'number'
          ? Math.max(0, Number(sale.sellDue))
          : Math.max(0, (sale.grandTotal || sale.totalAmount || 0) - (sale.totalPaid || 0));
        const dueCeiling = resolveSaleDueCeiling(sale);
        const nextDue = Math.max(0, Math.min(
          dueCeiling,
          Number((currentDue - appliedDelta).toFixed(3))
        ));
        return {
          ...sale,
          sellDue: nextDue,
          paymentStatus: deriveSalePaymentStatusFromDue(sale, nextDue),
        };
      }));
    }

    if (Math.abs(appliedDelta) > 0.0005 || Math.abs(creditDelta) > 0.0005) {
      setCustomers(prev => prev.map(customer => {
        if (
          String(customer.id || '').trim() !== targetCustomerId &&
          normalizeText(customer.businessName) !== targetCustomerName
        ) {
          return customer;
        }
        return {
          ...customer,
          totalSellDue: Math.max(0, Number((customer.totalSellDue - appliedDelta).toFixed(3))),
          advanceBalance: Math.max(0, Number((customer.advanceBalance + creditDelta).toFixed(3))),
        };
      }));
    }
  };

  const buildAutoRefundPaymentFromSellReturn = (sellReturn: SellReturn): Payment => {
    const paymentId = String(sellReturn.autoRefundPaymentId || `pay-sell-return-${sellReturn.id}`);
    const referenceToken = String(sellReturn.referenceNo || sellReturn.id || '').trim();
    return {
      id: paymentId,
      date: String(sellReturn.date || new Date().toISOString().slice(0, 16)),
      contactId: String(sellReturn.customerId || ''),
      contactName: String(sellReturn.customerName || 'Walk-in Customer'),
      contactType: 'Customer',
      amount: Number(Math.max(0, Number(sellReturn.total || 0)).toFixed(3)),
      method: 'Cash',
      account: 'Cash Account',
      location: String(sellReturn.location || ''),
      referenceNo: `SRF-${referenceToken || Date.now()}`,
      note: `Auto refund for credit note ${referenceToken || '--'}`,
      type: 'sent',
      linkedInvoices: referenceToken ? [referenceToken] : [],
      addedBy: String(sellReturn.addedBy || currentUser?.name || 'System'),
    };
  };

  const upsertAutoRefundPaymentForSellReturn = async (sellReturn: SellReturn): Promise<boolean> => {
    if (sellReturn.settlementMode !== 'refund_now') return true;
    const record = buildAutoRefundPaymentFromSellReturn(sellReturn);
    const saved = await syncRecordStrict('payments', record);
    if (!saved.ok) return false;
    setPayments(prev => {
      const exists = prev.some(payment => payment.id === record.id);
      if (exists) {
        return prev.map(payment => payment.id === record.id ? record : payment);
      }
      return [...prev, record];
    });
    return true;
  };

  const removeAutoRefundPaymentForSellReturn = async (sellReturn?: SellReturn | null): Promise<boolean> => {
    if (!sellReturn) return true;
    const paymentId = String(sellReturn.autoRefundPaymentId || `pay-sell-return-${sellReturn.id}`).trim();
    if (!paymentId) return true;
    const deleted = await deleteRecordStrict('payments', paymentId);
    if (!deleted.ok) return false;
    setPayments(prev => prev.filter(payment => payment.id !== paymentId));
    return true;
  };

  const addSellReturn = async (sellReturn: SellReturn): Promise<CrudMutationResult> => {
    const normalizedBase = normalizeSellReturnRecord(sellReturn);
    const normalized: SellReturn = {
      ...normalizedBase,
      autoRefundPaymentId: normalizedBase.settlementMode === 'refund_now'
        ? String(normalizedBase.autoRefundPaymentId || `pay-sell-return-${normalizedBase.id}`)
        : '',
    };
    const saved = await syncRecordStrict('sellReturns', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Sell Returns',
        description: `Failed to create sell return ${normalized.referenceNo || normalized.id} in Postgres (${result.status || 0}).`,
      });
      return result;
    }
    setSellReturns(prev => [...prev, normalized]);
    const stockResult = await applySellReturnEffects(normalized, 1);
    let stockSyncFailure: CrudMutationResult | null = null;
    if (!stockResult.ok) {
      stockSyncFailure = stockResult;
      recordActivity({
        action: 'Blocked',
        module: 'Sell Returns',
        description: `Sell return saved but stock sync failed for ${normalized.referenceNo || normalized.id}: ${stockResult.error || `HTTP ${stockResult.status || 0}`}.`,
      });
    }
    applySellReturnFinancialEffects(normalized, 1);
    if (normalized.settlementMode === 'refund_now') {
      await upsertAutoRefundPaymentForSellReturn(normalized);
    } else {
      await removeAutoRefundPaymentForSellReturn(normalized);
    }
    recordActivity({
      action: 'Created',
      module: 'Sell Returns',
      description: `Created sell return: ${normalized.referenceNo || normalized.id}`,
    });
    if (stockSyncFailure) {
      return failResult(
        stockSyncFailure.status || 500,
        stockSyncFailure.error || 'Sell return saved, but stock sync failed.',
      );
    }
    return result;
  };

  const updateSellReturn = async (sellReturn: SellReturn): Promise<CrudMutationResult> => {
    if (!canEditTransaction('Sell Returns', String(sellReturn.referenceNo || sellReturn.id || '').trim(), sellReturn.date)) {
      return failResult(403, 'Edit window expired.');
    }
    const existing = sellReturns.find(record => record.id === sellReturn.id);
    const normalizedDraft = normalizeSellReturnRecord(sellReturn);
    const normalized: SellReturn = {
      ...normalizedDraft,
      autoRefundPaymentId: normalizedDraft.settlementMode === 'refund_now'
        ? String(
          normalizedDraft.autoRefundPaymentId
          || existing?.autoRefundPaymentId
          || `pay-sell-return-${normalizedDraft.id}`
        )
        : '',
    };
    const saved = await syncRecordStrict('sellReturns', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Sell Returns',
        description: `Failed to update sell return ${normalized.referenceNo || normalized.id} in Postgres (${result.status || 0}).`,
      });
      return result;
    }
    let stockSyncFailure: CrudMutationResult | null = null;
    const trackStockFailure = (phase: string, stockResult: CrudMutationResult) => {
      if (stockSyncFailure) return;
      stockSyncFailure = stockResult;
      recordActivity({
        action: 'Blocked',
        module: 'Sell Returns',
        description: `Sell return updated but stock sync failed (${phase}) for ${normalized.referenceNo || normalized.id}: ${stockResult.error || `HTTP ${stockResult.status || 0}`}.`,
      });
    };

    if (existing) {
      const rollbackResult = await applySellReturnEffects(existing, -1);
      if (!rollbackResult.ok) {
        trackStockFailure('rollback', rollbackResult);
      }
      applySellReturnFinancialEffects(existing, -1);
      const applyResult = await applySellReturnEffects(normalized, 1);
      if (!applyResult.ok) {
        trackStockFailure('apply', applyResult);
      }
      applySellReturnFinancialEffects(normalized, 1);
      setSellReturns(prev => prev.map(record => record.id === normalized.id ? normalized : record));
    } else {
      const applyResult = await applySellReturnEffects(normalized, 1);
      if (!applyResult.ok) {
        trackStockFailure('apply', applyResult);
      }
      applySellReturnFinancialEffects(normalized, 1);
      setSellReturns(prev => [...prev, normalized]);
    }

    if (existing) {
      await removeAutoRefundPaymentForSellReturn(existing);
    }
    if (normalized.settlementMode === 'refund_now') {
      await upsertAutoRefundPaymentForSellReturn(normalized);
    }
    recordActivity({
      action: 'Updated',
      module: 'Sell Returns',
      description: `Updated sell return: ${normalized.referenceNo || normalized.id}`,
    });
    if (stockSyncFailure) {
      return failResult(
        stockSyncFailure.status || 500,
        stockSyncFailure.error || 'Sell return updated, but stock sync failed.',
      );
    }
    return result;
  };

  const deleteSellReturn = async (id: string): Promise<CrudMutationResult> => {
    const existingReturn = sellReturns.find(record => record.id === id);
    if (!existingReturn) {
      return { ok: false, status: 404, error: 'Sell return not found.' };
    }
    const deleteOutcome = await deleteRecordStrict('sellReturns', id);
    if (!deleteOutcome.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Sell Returns',
        description: `Failed to delete sell return ${existingReturn.referenceNo || existingReturn.id || id} from Postgres (${deleteOutcome.status || 0}).`,
      });
      return deleteOutcome;
    }
    let stockSyncFailure: CrudMutationResult | null = null;
    if (existingReturn) {
      const rollbackResult = await applySellReturnEffects(existingReturn, -1);
      if (!rollbackResult.ok) {
        stockSyncFailure = rollbackResult;
        recordActivity({
          action: 'Blocked',
          module: 'Sell Returns',
          description: `Sell return deleted but stock rollback failed for ${existingReturn.referenceNo || existingReturn.id}: ${rollbackResult.error || `HTTP ${rollbackResult.status || 0}`}.`,
        });
      }
      applySellReturnFinancialEffects(existingReturn, -1);
      await removeAutoRefundPaymentForSellReturn(existingReturn);
    }
    setSellReturns(prev => prev.filter(record => record.id !== id));
    const autoRefundPaymentId = String(
      existingReturn.autoRefundPaymentId || `pay-sell-return-${existingReturn.id}`,
    ).trim();
    if (autoRefundPaymentId) {
      await deleteRecordStrict('payments', autoRefundPaymentId);
    }
    recordActivity({
      action: 'Deleted',
      module: 'Sell Returns',
      description: `Deleted sell return: ${existingReturn?.referenceNo || existingReturn?.id || id}`,
    });
    if (stockSyncFailure) {
      return failResult(
        stockSyncFailure.status || 500,
        stockSyncFailure.error || 'Sell return deleted, but stock rollback failed.',
      );
    }
    return { ok: true, status: deleteOutcome.status || 200 };
  };

  // ============================================================
  //  CRUD: PURCHASES
  //  add/update/deletePurchase also maintain stock + supplier balances
  // ============================================================

  const derivePurchasePaymentStatus = (due: number, grandTotal: number): Purchase['paymentStatus'] => {
    if (due <= 0.001) return 'Paid';
    if (grandTotal > 0 && due < grandTotal - 0.001) return 'Partial';
    return 'Due';
  };

  const normalizeName = (value: string): string => String(value || '').trim().toLowerCase();

  const applyPurchaseEffects = async (purchase: Purchase, factor: 1 | -1): Promise<boolean> => {
    if (purchase.status === 'Received' && purchase.items && purchase.items.length > 0) {
      const byId: Record<string, number> = {};
      const byName: Record<string, number> = {};
      const costById: Record<string, { qty: number; value: number; firstCost: number; latestCost: number }> = {};
      const costByName: Record<string, { qty: number; value: number; firstCost: number; latestCost: number }> = {};
      const accountingMethod = String(settings.stockAccountingMethod || 'fifo').trim().toLowerCase();
      const lotAdjustments = purchase.items
        .map((item) => {
          const qtyChange = Number(item.qty || 0) * factor;
          if (!qtyChange) return null;
          const lotNumber = String(item.lot || '').trim();
          const expiryDate = String(item.expiryDate || '').trim();
          if (!lotNumber && !expiryDate) return null;
          const linkedProduct = products.find(product =>
            product.id === item.id || normalizeName(product.name) === normalizeName(item.name),
          );
          const productId = String(item.id || linkedProduct?.id || '').trim();
          if (!productId) return null;
          return {
            productId,
            productName: linkedProduct?.name || item.name || '',
            sku: linkedProduct?.sku || '',
            location: String(purchase.location || '').trim(),
            lotNumber,
            expiryDate,
            unit: linkedProduct?.unit || '',
            unitCost: Number(item.unitCost || linkedProduct?.unitPurchasePrice || 0),
            qtyChange,
            updatedAt: purchase.date ? new Date(purchase.date).toISOString() : new Date().toISOString(),
          };
        })
        .filter((row): row is NonNullable<typeof row> => !!row);

      purchase.items.forEach(item => {
        const qty = Number(item.qty || 0) * factor;
        if (!qty) return;
        const unitCost = Math.max(0, Number(item.unitCost || 0));
        const lineValue = qty * unitCost;
        if (item.id) byId[item.id] = (byId[item.id] || 0) + qty;
        if (item.id) {
          const prevCost = costById[item.id] || {
            qty: 0,
            value: 0,
            firstCost: unitCost,
            latestCost: unitCost,
          };
          costById[item.id] = {
            qty: prevCost.qty + qty,
            value: prevCost.value + lineValue,
            firstCost: prevCost.firstCost,
            latestCost: unitCost,
          };
        }
        const key = normalizeName(item.name);
        if (key) byName[key] = (byName[key] || 0) + qty;
        if (key) {
          const prevCost = costByName[key] || {
            qty: 0,
            value: 0,
            firstCost: unitCost,
            latestCost: unitCost,
          };
          costByName[key] = {
            qty: prevCost.qty + qty,
            value: prevCost.value + lineValue,
            firstCost: prevCost.firstCost,
            latestCost: unitCost,
          };
        }
      });
      setProducts(prev => prev.map(product => {
        const byIdDelta = byId[product.id] || 0;
        const byNameDelta = byName[normalizeName(product.name)] || 0;
        const delta = byIdDelta || byNameDelta;
        if (!delta) return product;
        const movement = costById[product.id] || costByName[normalizeName(product.name)];
        const currentStock = Math.max(0, Number(product.stock || 0));
        const nextStock = Math.max(0, currentStock + delta);
        const currentCost = Math.max(0, Number(product.unitPurchasePrice || 0));
        let nextCost = currentCost;

        if (movement) {
          const movementQty = Number(movement.qty || 0);
          const movementValue = Number(movement.value || 0);
          if (accountingMethod === 'lifo') {
            if (movementQty > 0) {
              nextCost = Math.max(0, Number(movement.latestCost || currentCost));
            }
          } else if (accountingMethod === 'average') {
            const nextRawQty = currentStock + movementQty;
            const currentValue = currentStock * currentCost;
            const projectedValue = currentValue + movementValue;
            if (nextRawQty > 0) {
              nextCost = Math.max(0, projectedValue / nextRawQty);
            }
          } else {
            if (currentStock <= 0 && movementQty > 0) {
              nextCost = Math.max(0, Number(movement.firstCost || movement.latestCost || currentCost));
            }
          }
        }

        return {
          ...product,
          stock: nextStock,
          unitPurchasePrice: Number(nextCost.toFixed(3)),
        };
      }));

      if (lotAdjustments.length > 0) {
        const lotSaved = await applyStockLotAdjustments(lotAdjustments);
        if (!lotSaved) return false;
      }

      const purchaseStockDelta: Record<string, number> = {};
      purchase.items.forEach(item => {
        const qty = Number(item.qty || 0) * factor;
        const linkedProduct = products.find(p => p.id === item.id || normalizeName(p.name) === normalizeName(item.name));
        const key = String(item.id || linkedProduct?.id || '').trim();
        if (key && qty) {
          purchaseStockDelta[key] = (purchaseStockDelta[key] || 0) + qty;
        }
      });
      if (Object.keys(purchaseStockDelta).length > 0) {
        const stockResult = await applyStockDelta(purchaseStockDelta, purchase.location);
        if (!stockResult.ok) return false;
      }
    }

    const dueAmount = purchase.paymentStatus !== 'Paid' ? Number(purchase.paymentDue || 0) : 0;
    const dueDelta = dueAmount * factor;
    if (!dueDelta) return true;
    setSuppliers(prev => prev.map(supplier => {
      if (supplier.id === purchase.supplierId || supplier.businessName === purchase.supplier) {
        return {
          ...supplier,
          totalPurchaseDue: Math.max(0, Number(supplier.totalPurchaseDue || 0) + dueDelta),
        };
      }
      return supplier;
    }));
    return true;
  };

  const applyPurchaseReturnEffects = async (
    purchaseReturn: PurchaseReturn,
    factor: 1 | -1,
  ): Promise<boolean> => {
    const amount = Number(purchaseReturn.grandTotal || 0);
    if (amount) {
      const returnDelta = amount * factor;
      setSuppliers(prev => prev.map(supplier => {
        if (supplier.id === purchaseReturn.supplierId || supplier.businessName === purchaseReturn.supplierName) {
          return {
            ...supplier,
            totalReturnDue: Math.max(0, Number(supplier.totalReturnDue || 0) + returnDelta),
            totalPurchaseDue: Math.max(0, Number(supplier.totalPurchaseDue || 0) - returnDelta),
          };
        }
        return supplier;
      }));

      if (purchaseReturn.parentPurchaseId) {
        setPurchases(prev => prev.map(purchase => {
          if (purchase.id !== purchaseReturn.parentPurchaseId) return purchase;
          const grandTotal = Number(purchase.grandTotal || 0);
          const currentDue = Number(purchase.paymentDue || 0);
          const nextDue = Math.min(grandTotal, Math.max(0, currentDue - returnDelta));
          return {
            ...purchase,
            paymentDue: nextDue,
            paymentStatus: derivePurchasePaymentStatus(nextDue, grandTotal),
          };
        }));
      }
    }

    if (purchaseReturn.items && purchaseReturn.items.length > 0) {
      const byId: Record<string, number> = {};
      const byName: Record<string, number> = {};
      const costById: Record<string, { qty: number; value: number }> = {};
      const costByName: Record<string, { qty: number; value: number }> = {};
      const accountingMethod = String(settings.stockAccountingMethod || 'fifo').trim().toLowerCase();
      const lotAdjustments = purchaseReturn.items
        .map((item) => {
          const qty = Number(item.quantity || 0);
          if (!qty) return null;
          const lotNumber = String(item.lotNumber || '').trim();
          const expiryDate = String(item.expDate || '').trim();
          if (!lotNumber && !expiryDate) return null;
          const linkedProduct = products.find(product =>
            product.id === item.productId || normalizeName(product.name) === normalizeName(item.productName),
          );
          const productId = String(item.productId || linkedProduct?.id || '').trim();
          if (!productId) return null;
          return {
            productId,
            productName: linkedProduct?.name || item.productName || '',
            sku: linkedProduct?.sku || '',
            location: String(purchaseReturn.location || '').trim(),
            lotNumber,
            expiryDate,
            unit: linkedProduct?.unit || '',
            unitCost: Number(item.unitPrice || linkedProduct?.unitPurchasePrice || 0),
            qtyChange: -factor * qty,
            updatedAt: purchaseReturn.date ? new Date(purchaseReturn.date).toISOString() : new Date().toISOString(),
          };
        })
        .filter((row): row is NonNullable<typeof row> => !!row);

      purchaseReturn.items.forEach(item => {
        const qty = Number(item.quantity || 0);
        if (!qty) return;
        const stockDelta = -factor * qty;
        const unitCost = Math.max(0, Number(item.unitPrice || 0));
        const lineValue = stockDelta * unitCost;
        if (item.productId) byId[item.productId] = (byId[item.productId] || 0) + stockDelta;
        if (item.productId) {
          const prevCost = costById[item.productId] || { qty: 0, value: 0 };
          costById[item.productId] = {
            qty: prevCost.qty + stockDelta,
            value: prevCost.value + lineValue,
          };
        }
        const key = normalizeName(item.productName);
        if (key) byName[key] = (byName[key] || 0) + stockDelta;
        if (key) {
          const prevCost = costByName[key] || { qty: 0, value: 0 };
          costByName[key] = {
            qty: prevCost.qty + stockDelta,
            value: prevCost.value + lineValue,
          };
        }
      });
      setProducts(prev => prev.map(product => {
        const byIdDelta = byId[product.id] || 0;
        const byNameDelta = byName[normalizeName(product.name)] || 0;
        const delta = byIdDelta || byNameDelta;
        if (!delta) return product;
        const movement = costById[product.id] || costByName[normalizeName(product.name)];
        const currentStock = Math.max(0, Number(product.stock || 0));
        const nextStock = Math.max(0, currentStock + delta);
        const currentCost = Math.max(0, Number(product.unitPurchasePrice || 0));
        let nextCost = currentCost;

        if (movement && accountingMethod === 'average') {
          const nextRawQty = currentStock + movement.qty;
          const currentValue = currentStock * currentCost;
          const projectedValue = currentValue + movement.value;
          if (nextRawQty > 0) {
            nextCost = Math.max(0, projectedValue / nextRawQty);
          }
        }

        return {
          ...product,
          stock: nextStock,
          unitPurchasePrice: Number(nextCost.toFixed(3)),
        };
      }));

      if (lotAdjustments.length > 0) {
        const lotSaved = await applyStockLotAdjustments(lotAdjustments);
        if (!lotSaved) return false;
      }

      const returnStockDelta: Record<string, number> = {};
      purchaseReturn.items.forEach(item => {
        const qty = Number(item.quantity || 0) * -factor;
        const linkedProduct = products.find(p => p.id === item.productId || normalizeName(p.name) === normalizeName(item.productName));
        const key = String(item.productId || linkedProduct?.id || '').trim();
        if (key && qty) {
          returnStockDelta[key] = (returnStockDelta[key] || 0) + qty;
        }
      });
      if (Object.keys(returnStockDelta).length > 0) {
        const stockResult = await applyStockDelta(returnStockDelta, purchaseReturn.location);
        if (!stockResult.ok) return false;
      }
    }
    return true;
  };

  const addPurchase = async (purchase: Purchase): Promise<CrudMutationResult> => {
    const normalized = normalizePurchaseRecordLoaded(purchase);
    const saved = await syncRecordStrict('purchases', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Purchases',
        description: `Failed to create purchase ${normalized.refNo || normalized.id} in Postgres (${result.status || 0}).`,
      });
      return result;
    }
    setPurchases(prev => [...prev, normalized]);
    const effectsApplied = await applyPurchaseEffects(normalized, 1);
    if (!effectsApplied) {
      recordActivity({
        action: 'Blocked',
        module: 'Purchases',
        description: `Purchase ${normalized.refNo || normalized.id} saved but stock-lot sync failed.`,
      });
      return failResult(500, 'Purchase saved, but stock-lot sync failed.');
    }
    recordActivity({
      action: 'Created',
      module: 'Purchases',
      description: `Created purchase: ${normalized.refNo || normalized.id}`,
    });
    return result;
  };

  const updatePurchase = async (purchase: Purchase): Promise<CrudMutationResult> => {
    const normalized = normalizePurchaseRecordLoaded(purchase);
    if (!canEditTransaction('Purchases', String(normalized.refNo || normalized.id || '').trim(), normalized.date)) {
      return failResult(403, 'Edit window expired.');
    }
    const saved = await syncRecordStrict('purchases', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Purchases',
        description: `Failed to update purchase ${normalized.refNo || normalized.id} in Postgres (${result.status || 0}).`,
      });
      return result;
    }
    const existing = purchases.find(item => item.id === normalized.id);
    if (!existing) return failResult(404, 'Purchase not found.');
    const reverted = await applyPurchaseEffects(existing, -1);
    if (!reverted) {
      recordActivity({
        action: 'Blocked',
        module: 'Purchases',
        description: `Failed to reverse effects for purchase ${existing.refNo || existing.id}.`,
      });
      return failResult(500, 'Failed to reverse previous purchase effects.');
    }
    const applied = await applyPurchaseEffects(normalized, 1);
    if (!applied) {
      await applyPurchaseEffects(existing, 1);
      recordActivity({
        action: 'Blocked',
        module: 'Purchases',
        description: `Failed to apply updated effects for purchase ${normalized.refNo || normalized.id}.`,
      });
      return failResult(500, 'Failed to apply updated purchase effects.');
    }
    setPurchases(prev => prev.map(item => item.id === normalized.id ? normalized : item));
    recordActivity({
      action: 'Updated',
      module: 'Purchases',
      description: `Updated purchase: ${normalized.refNo || normalized.id}`,
    });
    return result;
  };

  const deletePurchase = async (id: string): Promise<CrudMutationResult> => {
    const existingPurchase = purchases.find(item => item.id === id);
    if (purchaseReturns.some(ret => ret.parentPurchaseId === id)) {
      return failResult(409, 'Purchase has linked return.');
    }
    return confirmDeleteFromPostgres('purchases', id, 'Purchases', existingPurchase?.refNo || existingPurchase?.id || id, async () => {
      const existing = purchases.find(item => item.id === id);
      if (existing) {
        const reverted = await applyPurchaseEffects(existing, -1);
        if (!reverted) {
          recordActivity({
            action: 'Blocked',
            module: 'Purchases',
            description: `Deleted purchase ${existing.refNo || existing.id}, but failed to sync stock lot reversal.`,
          });
        }
      }
      setPurchases(prev => prev.filter(item => item.id !== id));
      recordActivity({
        action: 'Deleted',
        module: 'Purchases',
        description: `Deleted purchase: ${existingPurchase?.refNo || existingPurchase?.id || id}`,
      });
    });
  };

  // ============================================================
  //  CRUD: PURCHASE REQUISITIONS
  // ============================================================

  const addPurchaseRequisition = async (requisition: PurchaseRequisition): Promise<CrudMutationResult> => {
    const normalized = normalizePurchaseRequisitionRecordLoaded(requisition);
    const saved = await syncRecordStrict('purchaseRequisitions', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Purchase Requisitions',
        description: `Failed to create requisition ${normalized.referenceNo || normalized.id} in Postgres (${result.status || 0}).`,
      });
      return result;
    }
    setPurchaseRequisitions(prev => [...prev, normalized]);
    recordActivity({
      action: 'Created',
      module: 'Purchase Requisitions',
      description: `Created requisition: ${normalized.referenceNo || normalized.id}`,
    });
    return result;
  };
  const updatePurchaseRequisition = async (requisition: PurchaseRequisition): Promise<CrudMutationResult> => {
    const normalized = normalizePurchaseRequisitionRecordLoaded(requisition);
    if (!canEditTransaction('Purchase Requisitions', String(normalized.referenceNo || normalized.id || '').trim(), normalized.date)) {
      return failResult(403, 'Edit window expired.');
    }
    const saved = await syncRecordStrict('purchaseRequisitions', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Purchase Requisitions',
        description: `Failed to update requisition ${normalized.referenceNo || normalized.id} in Postgres (${result.status || 0}).`,
      });
      return result;
    }
    setPurchaseRequisitions(prev => prev.map(item => item.id === normalized.id ? normalized : item));
    recordActivity({
      action: 'Updated',
      module: 'Purchase Requisitions',
      description: `Updated requisition: ${normalized.referenceNo || normalized.id}`,
    });
    return result;
  };
  const deletePurchaseRequisition = async (id: string): Promise<CrudMutationResult> => {
    const existing = purchaseRequisitions.find(item => item.id === id);
    if (purchaseOrders.some(order => order.purchaseRequisitionId === id)) return failResult(409, 'Requisition has linked purchase order.');
    return confirmDeleteFromPostgres('purchaseRequisitions', id, 'Purchase Requisitions', existing?.referenceNo || existing?.id || id, () => {
      setPurchaseRequisitions(prev => prev.filter(item => item.id !== id));
      recordActivity({
        action: 'Deleted',
        module: 'Purchase Requisitions',
        description: `Deleted requisition: ${existing?.referenceNo || existing?.id || id}`,
      });
    });
  };

  // ============================================================
  //  CRUD: PURCHASE ORDERS
  // ============================================================

  const addPurchaseOrder = async (order: PurchaseOrder): Promise<CrudMutationResult> => {
    const normalized = normalizePurchaseOrderRecordLoaded(order);
    const saved = await syncRecordStrict('purchaseOrders', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Purchase Orders',
        description: `Failed to create purchase order ${normalized.referenceNo || normalized.id} in Postgres (${result.status || 0}).`,
      });
      return result;
    }
    setPurchaseOrders(prev => [...prev, normalized]);
    recordActivity({
      action: 'Created',
      module: 'Purchase Orders',
      description: `Created order: ${normalized.referenceNo || normalized.id}`,
    });
    return result;
  };
  const updatePurchaseOrder = async (order: PurchaseOrder): Promise<CrudMutationResult> => {
    const normalized = normalizePurchaseOrderRecordLoaded(order);
    if (!canEditTransaction('Purchase Orders', String(normalized.referenceNo || normalized.id || '').trim(), normalized.orderDate)) {
      return failResult(403, 'Edit window expired.');
    }
    const saved = await syncRecordStrict('purchaseOrders', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Purchase Orders',
        description: `Failed to update purchase order ${normalized.referenceNo || normalized.id} in Postgres (${result.status || 0}).`,
      });
      return result;
    }
    setPurchaseOrders(prev => prev.map(item => item.id === normalized.id ? normalized : item));
    recordActivity({
      action: 'Updated',
      module: 'Purchase Orders',
      description: `Updated order: ${normalized.referenceNo || normalized.id}`,
    });
    return result;
  };
  const deletePurchaseOrder = async (id: string): Promise<CrudMutationResult> => {
    const existing = purchaseOrders.find(item => item.id === id);
    if (purchases.some(purchase => purchase.purchaseOrderId === id)) return failResult(409, 'Purchase order has linked purchase.');
    return confirmDeleteFromPostgres('purchaseOrders', id, 'Purchase Orders', existing?.referenceNo || existing?.id || id, () => {
      setPurchaseOrders(prev => prev.filter(item => item.id !== id));
      recordActivity({
        action: 'Deleted',
        module: 'Purchase Orders',
        description: `Deleted order: ${existing?.referenceNo || existing?.id || id}`,
      });
    });
  };

  // ============================================================
  //  CRUD: PURCHASE RETURNS
  // ============================================================

  const addPurchaseReturn = async (purchaseReturn: PurchaseReturn): Promise<CrudMutationResult> => {
    const normalized = normalizePurchaseReturnRecordLoaded(purchaseReturn);
    const saved = await syncRecordStrict('purchaseReturns', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Purchase Returns',
        description: `Failed to create purchase return ${normalized.referenceNo || normalized.id} in Postgres (${result.status || 0}).`,
      });
      return result;
    }
    setPurchaseReturns(prev => [...prev, normalized]);
    const effectsApplied = await applyPurchaseReturnEffects(normalized, 1);
    if (!effectsApplied) {
      recordActivity({
        action: 'Blocked',
        module: 'Purchase Returns',
        description: `Purchase return ${normalized.referenceNo || normalized.id} saved but stock-lot sync failed.`,
      });
      return failResult(500, 'Purchase return saved, but stock-lot sync failed.');
    }
    recordActivity({
      action: 'Created',
      module: 'Purchase Returns',
      description: `Created purchase return: ${normalized.referenceNo || normalized.id}`,
    });
    return result;
  };

  const updatePurchaseReturn = async (purchaseReturn: PurchaseReturn): Promise<CrudMutationResult> => {
    const normalized = normalizePurchaseReturnRecordLoaded(purchaseReturn);
    if (!canEditTransaction('Purchase Returns', String(normalized.referenceNo || normalized.id || '').trim(), normalized.date)) {
      return failResult(403, 'Edit window expired.');
    }
    const saved = await syncRecordStrict('purchaseReturns', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Purchase Returns',
        description: `Failed to update purchase return ${normalized.referenceNo || normalized.id} in Postgres (${result.status || 0}).`,
      });
      return result;
    }
    const existing = purchaseReturns.find(item => item.id === normalized.id);
    if (existing) {
      const reverted = await applyPurchaseReturnEffects(existing, -1);
      if (!reverted) {
        recordActivity({
          action: 'Blocked',
          module: 'Purchase Returns',
          description: `Failed to reverse effects for purchase return ${existing.referenceNo || existing.id}.`,
        });
        return failResult(500, 'Failed to reverse previous purchase return effects.');
      }
    }
    const applied = await applyPurchaseReturnEffects(normalized, 1);
    if (!applied) {
      if (existing) await applyPurchaseReturnEffects(existing, 1);
      recordActivity({
        action: 'Blocked',
        module: 'Purchase Returns',
        description: `Failed to apply updated effects for purchase return ${normalized.referenceNo || normalized.id}.`,
      });
      return failResult(500, 'Failed to apply updated purchase return effects.');
    }
    setPurchaseReturns(prev => prev.map(item => item.id === normalized.id ? normalized : item));
    recordActivity({
      action: 'Updated',
      module: 'Purchase Returns',
      description: `Updated purchase return: ${normalized.referenceNo || normalized.id}`,
    });
    return result;
  };

  const deletePurchaseReturn = async (id: string): Promise<CrudMutationResult> => {
    const existingReturn = purchaseReturns.find(item => item.id === id);
    return confirmDeleteFromPostgres('purchaseReturns', id, 'Purchase Returns', existingReturn?.referenceNo || existingReturn?.id || id, async () => {
      const existing = purchaseReturns.find(item => item.id === id);
      if (existing) {
        const reverted = await applyPurchaseReturnEffects(existing, -1);
        if (!reverted) {
          recordActivity({
            action: 'Blocked',
            module: 'Purchase Returns',
            description: `Deleted purchase return ${existing.referenceNo || existing.id}, but failed to sync stock lot reversal.`,
          });
        }
      }
      setPurchaseReturns(prev => prev.filter(item => item.id !== id));
      recordActivity({
        action: 'Deleted',
        module: 'Purchase Returns',
        description: `Deleted purchase return: ${existingReturn?.referenceNo || existingReturn?.id || id}`,
      });
    });
  };

  // ============================================================
  //  CRUD: ORDERS
  // ============================================================

  const addOrder = async (order: GlobalOrder): Promise<CrudMutationResult> => {
    const normalized = normalizeOrderRecordLoaded(order);
    if (normalized.status === 'Cancelled') {
      recordActivity({
        action: 'Blocked',
        module: 'Orders',
        description: `Blocked order creation for ${normalized.orderNumber || normalized.id}: orders cannot be created directly as Cancelled.`,
      });
      return failResult(400, 'Orders cannot be created directly as cancelled.');
    }
    const saved = await syncRecordStrict('orders', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Orders',
        description: `Failed to create order ${normalized.orderNumber || normalized.id} in Postgres (${result.status || 0}).`,
      });
      return result;
    }
    setOrders(prev => [...prev, normalized]);
    recordActivity({
      action: 'Created',
      module: 'Orders',
      description: `Created order: ${normalized.orderNumber || normalized.id}`,
    });
    return result;
  };
  const updateOrder = async (order: GlobalOrder): Promise<CrudMutationResult> => {
    const normalized = normalizeOrderRecordLoaded(order);
    const existingOrder = orders.find(o => o.id === normalized.id);
    if (existingOrder?.status === 'Cancelled') {
      recordActivity({
        action: 'Blocked',
        module: 'Orders',
        description: `Blocked update for cancelled order: ${existingOrder.orderNumber || existingOrder.id}`,
      });
      return failResult(409, 'Cancelled orders cannot be updated.');
    }

    const isCancellingNow = existingOrder?.status !== 'Cancelled' && normalized.status === 'Cancelled';
    if (isCancellingNow) {
      const cancelReason = String(normalized.cancelReason || '').trim();
      const cancelledBy = String(normalized.cancelledBy || '').trim();
      const cancelledAt = String(normalized.cancelledAt || '').trim();
      if (!cancelReason || !cancelledBy || !cancelledAt) {
        recordActivity({
          action: 'Blocked',
          module: 'Orders',
          description: `Blocked cancellation for ${normalized.orderNumber || normalized.id}: missing cancellation reason/by/at.`,
        });
        return failResult(400, 'Missing cancellation metadata.');
      }
    }

    if (!canEditTransaction('Orders', String(normalized.orderNumber || normalized.id || '').trim(), normalized.orderDate)) {
      return failResult(403, 'Edit window expired.');
    }
    const saved = await syncRecordStrict('orders', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Orders',
        description: `Failed to update order ${normalized.orderNumber || normalized.id} in Postgres (${result.status || 0}).`,
      });
      return result;
    }
    setOrders(prev => prev.map(o => o.id === normalized.id ? normalized : o));
    recordActivity({
      action: 'Updated',
      module: 'Orders',
      description: `Updated order: ${normalized.orderNumber || normalized.id}`,
    });
    return result;
  };
  const deleteOrder = async (id: string): Promise<CrudMutationResult> => {
    const existing = orders.find(o => o.id === id);
    if (!existing) {
      recordActivity({
        action: 'Blocked',
        module: 'Orders',
        description: `Delete failed: order not found (${id}).`,
      });
      return failResult(404, 'Order not found.');
    }

    const currentRoleRecord = roles.find((role) => role.name === currentUser?.role);
    const explicitPermissions = currentRoleRecord?.permissions || [];
    const isSystemOrderAdmin =
      String(currentUser?.role || '').toLowerCase() === 'admin' ||
      currentRoleRecord?.isSystem === true;
    const hasOrderPermissionStrict = (permission: 'Approve order' | 'Add order' | 'Delete order'): boolean => {
      if (isSystemOrderAdmin) return true;
      return (
        explicitPermissions.includes(permission) ||
        explicitPermissions.includes(`Order::${permission}`)
      );
    };

    const canDeleteApprovedOrder = hasOrderPermissionStrict('Approve order');
    const canDeleteUnapprovedOrder =
      hasOrderPermissionStrict('Add order') ||
      hasOrderPermissionStrict('Delete order');
    if (existing.isApproved && !canDeleteApprovedOrder) {
      recordActivity({
        action: 'Blocked',
        module: 'Orders',
        description: `Permission blocked: Delete approved order ${existing.orderNumber || existing.id}. Missing permission "Approve order".`,
      });
      return failResult(403, 'Missing permission to delete approved order.');
    }
    if (!existing.isApproved && !canDeleteUnapprovedOrder) {
      recordActivity({
        action: 'Blocked',
        module: 'Orders',
        description: `Permission blocked: Delete unapproved order ${existing.orderNumber || existing.id}. Missing permission "Add order" (or "Delete order").`,
      });
      return failResult(403, 'Missing permission to delete unapproved order.');
    }

    const linkedSale = existing.convertedSaleId
      ? sales.find((sale) => String(sale.id || '').trim() === String(existing.convertedSaleId || '').trim())
      : undefined;
    const linkedSaleDelivered = !!linkedSale && (
      String(linkedSale.shippingStatus || '').trim().toLowerCase() === 'delivered' ||
      isFinalizedSale(linkedSale)
    );
    if (linkedSaleDelivered) {
      recordActivity({
        action: 'Blocked',
        module: 'Orders',
        description: `Delete blocked for ${existing.orderNumber || existing.id}: linked invoice ${linkedSale?.invoiceNo || linkedSale?.id} is delivered.`,
      });
      return failResult(409, 'Linked delivered invoice prevents delete.');
    }

    const result = await deleteRecordStrict('orders', id);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Orders',
        description: `Delete failed for order ${existing?.orderNumber || existing?.id || id}: ${result.error || `HTTP ${result.status}`}`,
      });
      return toCrudResult(result);
    }
    setOrders(prev => prev.filter(o => o.id !== id));
    recordActivity({
      action: 'Deleted',
      module: 'Orders',
      description: `Deleted order: ${existing?.orderNumber || existing?.id || id}`,
    });
    return okResult(result.status || 200);
  };

  // ============================================================
  //  CRUD: PAYMENTS
  //  addPayment also: updates sale paymentStatus + customer/supplier balances
  // ============================================================

  const addPayment = async (
    payment: Payment,
    options?: { skipActivity?: boolean; skipPermissionBoundary?: boolean },
  ): Promise<CrudMutationResult> => {
    const canCreatePayment =
      options?.skipPermissionBoundary === true ||
      hasContextPermission('POS', 'Add/Edit Payment') ||
      hasContextPermission('Sell', 'Add sell payment');
    if (!canCreatePayment) {
      recordActivity({
        action: 'Blocked',
        module: 'Payments',
        description: 'Permission blocked: Create payment. Missing permission "Add/Edit Payment" or "Add sell payment".',
      });
      return failResult(403, 'Missing permission to create payment.');
    }
    const normalizedMethod = String(payment.method || '').trim() || 'Cash';
    const normalizedPayment = normalizePaymentRecordLoaded({
      ...payment,
      method: normalizedMethod,
      account: resolveDefaultAccountFromMethod(normalizedMethod),
    });
    let customerAllocationBySaleId = new Map<string, number>();
    let customerAppliedToInvoices = 0;
    let customerUnappliedRemainder = 0;

    // Enrich linkedInvoices: dry-run FIFO so the stored payment always references
    // the invoices it will actually cover — fixes visibility in ViewSaleDetails/ViewPaymentsModal.
    let paymentToStore = normalizedPayment;
    if (normalizedPayment.contactType === 'Customer' && normalizedPayment.type !== 'sent') {
      const linkedSet = new Set(
        (normalizedPayment.linkedInvoices || []).map(inv => String(inv || '').trim()).filter(Boolean)
      );
      const strictLinkedAllocation = normalizedPayment.strictLinkedAllocation === true && linkedSet.size > 0;
      const dueInvoices = sales
        .filter(s =>
          isFinalizedSale(s) &&
          (s.customerName === normalizedPayment.contactName || String(s.customerId) === normalizedPayment.contactId) &&
          (s.paymentStatus === 'Due' || s.paymentStatus === 'Partial' || s.paymentStatus === 'Overdue')
        )
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const prioritized = linkedSet.size === 0
        ? dueInvoices
        : strictLinkedAllocation
          ? dueInvoices.filter(s => linkedSet.has(String(s.invoiceNo || '').trim()))
          : [
              ...dueInvoices.filter(s => linkedSet.has(String(s.invoiceNo || '').trim())),
              ...dueInvoices.filter(s => !linkedSet.has(String(s.invoiceNo || '').trim())),
            ];
      let remaining = normalizedPayment.amount;
      const covered = new Set<string>(linkedSet);
      const allocationBySaleId = new Map<string, number>();
      for (const s of prioritized) {
        if (remaining <= 0) break;
        const due = typeof s.sellDue === 'number'
          ? Math.max(0, s.sellDue)
          : Math.max(0, (s.grandTotal || s.totalAmount || 0) - (s.totalPaid || 0));
        if (due <= 0) continue;
        const paying = Math.min(remaining, due);
        remaining = Number(Math.max(0, remaining - paying).toFixed(3));
        const saleId = String(s.id || '').trim();
        if (saleId) {
          allocationBySaleId.set(saleId, Number(((allocationBySaleId.get(saleId) || 0) + paying).toFixed(3)));
        }
        customerAppliedToInvoices = Number((customerAppliedToInvoices + paying).toFixed(3));
        if (s.invoiceNo) covered.add(String(s.invoiceNo).trim());
      }
      customerAllocationBySaleId = allocationBySaleId;
      customerUnappliedRemainder = Number(Math.max(0, normalizedPayment.amount - customerAppliedToInvoices).toFixed(3));
      if (covered.size > 0) {
        paymentToStore = {
          ...normalizedPayment,
          linkedInvoices: Array.from(covered).filter(Boolean),
          strictLinkedAllocation,
        };
      } else if (strictLinkedAllocation) {
        paymentToStore = { ...normalizedPayment, strictLinkedAllocation: true };
      }
    }
    const saved = await syncRecordStrict('payments', paymentToStore);
    if (!saved.ok) {
      return toCrudResult(saved);
    }
    setPayments(prev => [...prev, paymentToStore]);
    const appliedPayment = paymentToStore;

    if (appliedPayment.contactType === 'Customer') {
      if (appliedPayment.type === 'sent') {
        // Apply refund to outstanding sell return dues (FIFO by return date)
        setSellReturns(prev => {
          let remaining = appliedPayment.amount;
          const updated = [...prev];
          const dueReturns = updated
            .map((record, index) => ({ record, index }))
            .filter(({ record }) =>
              (record.customerName === appliedPayment.contactName || String(record.customerId) === appliedPayment.contactId) &&
              (record.paymentStatus === 'Due' || record.paymentStatus === 'Partial') &&
              Number(record.paymentDue || 0) > 0
            )
            .sort((a, b) => new Date(a.record.date).getTime() - new Date(b.record.date).getTime());
          const linkedSet = new Set(
            (appliedPayment.linkedInvoices || [])
              .map(ref => String(ref || '').trim())
              .filter(Boolean)
          );
          const prioritized = linkedSet.size === 0
            ? dueReturns
            : [
                ...dueReturns.filter(({ record }) => linkedSet.has(String(record.referenceNo || '').trim())),
                ...dueReturns.filter(({ record }) => !linkedSet.has(String(record.referenceNo || '').trim())),
              ];

          prioritized.forEach(({ record, index }) => {
            if (remaining <= 0) return;
            const due = Math.max(0, Number(record.paymentDue || 0));
            if (due <= 0) return;
            const settled = Math.min(remaining, due);
            remaining -= settled;
            const nextDue = Number((due - settled).toFixed(3));
            const total = Number(record.total || 0);
            updated[index] = {
              ...record,
              paymentDue: nextDue,
              paymentStatus: deriveSellReturnPaymentStatus(nextDue, total),
            };
          });
          return updated;
        });
        return okResult(saved.status || 200);
      }

      if (customerAllocationBySaleId.size > 0) {
        setSales(prev => prev.map((sale) => {
          const appliedAmount = Number(customerAllocationBySaleId.get(String(sale.id || '')) || 0);
          if (appliedAmount <= 0) return sale;
          // Use sellDue if set; fall back to grandTotal - totalPaid for legacy sales.
          const due = typeof sale.sellDue === 'number'
            ? Math.max(0, sale.sellDue)
            : Math.max(0, (sale.grandTotal || sale.totalAmount || 0) - (sale.totalPaid || 0));
          if (due <= 0) return sale;
          const settled = Math.min(appliedAmount, due);
          const newPaid = Number(((sale.totalPaid || 0) + settled).toFixed(3));
          const newDue = Number(Math.max(0, due - settled).toFixed(3));
          return {
            ...sale,
            totalPaid: newPaid,
            sellDue: newDue,
            paymentStatus: newDue <= 0.001 ? 'Paid' : 'Partial',
          };
        }));
      }

      // Update customer balance
      setCustomers(prev => prev.map(c => {
        if (c.id === appliedPayment.contactId || c.businessName === appliedPayment.contactName) {
          const totalSellDue = Number(c.totalSellDue || 0);
          const currentAdvance = Number(c.advanceBalance || 0);
          const appliedToDue = Math.min(totalSellDue, customerAppliedToInvoices);
          const newDue = Number(Math.max(0, totalSellDue - appliedToDue).toFixed(3));
          const newAdv = Number((currentAdvance + customerUnappliedRemainder).toFixed(3));
          return { ...c, totalSellDue: newDue, advanceBalance: newAdv };
        }
        return c;
      }));
    }

    if (appliedPayment.contactType === 'Supplier') {
      // Update supplier totalPurchaseDue
      setSuppliers(prev => prev.map(s => {
        if (s.id === appliedPayment.contactId || s.businessName === appliedPayment.contactName) {
          const newDue = Math.max(0, s.totalPurchaseDue - appliedPayment.amount);
          const newAdv = appliedPayment.amount > s.totalPurchaseDue ? s.advanceBalance + (appliedPayment.amount - s.totalPurchaseDue) : s.advanceBalance;
          return { ...s, totalPurchaseDue: newDue, advanceBalance: newAdv };
        }
        return s;
      }));
      // Update purchase payment status
      setPurchases(prev => {
        let remaining = appliedPayment.amount;
        return prev.map(p => {
          if (p.supplier !== appliedPayment.contactName && p.supplierId !== appliedPayment.contactId) return p;
          if (remaining <= 0) return p;
          if (p.paymentStatus === 'Paid') return p;
          // Use paymentDue if set; fall back to grandTotal for legacy purchases
          const due = typeof p.paymentDue === 'number'
            ? Math.max(0, p.paymentDue)
            : Math.max(0, p.grandTotal || 0);
          if (due <= 0) return p;
          const paying = Math.min(remaining, due);
          remaining -= paying;
          const newDue = due - paying;
          return { ...p, paymentDue: newDue, paymentStatus: newDue <= 0.001 ? 'Paid' : 'Partial' };
        });
      });
    }
      if (!options?.skipActivity) {
        const direction = appliedPayment.type === 'sent' ? 'Sent' : 'Received';
        recordActivity({
          action: 'Created',
          module: 'Payments',
          description: `${direction} payment: ${appliedPayment.referenceNo || appliedPayment.id}`,
        });
      }
      return okResult(saved.status || 200);
  };

  const updatePayment = async (payment: Payment): Promise<CrudMutationResult> => {
    if (!enforcePermissionBoundary('POS', 'Add/Edit Payment', 'Update payment')) {
      return failResult(403, 'Missing permission to update payment.');
    }
    const normalizedMethod = String(payment.method || '').trim() || 'Cash';
    const normalizedPayment = normalizePaymentRecordLoaded({
      ...payment,
      method: normalizedMethod,
      account: resolveDefaultAccountFromMethod(normalizedMethod),
    });
    const existing = payments.find(p => p.id === normalizedPayment.id);
    if (!existing) {
      return addPayment(normalizedPayment);
    }
    if (!canEditTransaction('Payments', String(normalizedPayment.referenceNo || normalizedPayment.id || '').trim(), existing.date || normalizedPayment.date)) {
      return failResult(403, 'Payment is outside editable transaction window.');
    }

    const normalizeLinkedInvoices = (values?: string[]) =>
      (values || [])
        .map(value => String(value || '').trim())
        .filter(Boolean)
        .sort();

    const existingLinked = normalizeLinkedInvoices(existing.linkedInvoices).join('|');
    const updatedLinked = normalizeLinkedInvoices(normalizedPayment.linkedInvoices).join('|');
    const hasFinancialImpact =
      Number(existing.amount || 0) !== Number(normalizedPayment.amount || 0) ||
      String(existing.date || '') !== String(normalizedPayment.date || '') ||
      String(existing.contactId || '') !== String(normalizedPayment.contactId || '') ||
      String(existing.contactName || '') !== String(normalizedPayment.contactName || '') ||
      existing.contactType !== normalizedPayment.contactType ||
      existing.type !== normalizedPayment.type ||
      existingLinked !== updatedLinked;

    if (!hasFinancialImpact) {
      const saved = await syncRecordStrict('payments', normalizedPayment);
      const result = toCrudResult(saved);
      if (!result.ok) return result;
      setPayments(prev => prev.map(p => p.id === normalizedPayment.id ? normalizedPayment : p));
      recordActivity({
        action: 'Updated',
        module: 'Payments',
        description: `Updated payment: ${normalizedPayment.referenceNo || normalizedPayment.id}`,
      });
      return result;
    }

    // Rebuild balances/statuses by removing old effects then applying updated payment.
    const deleteResult = await deletePayment(existing.id, {
      skipActivity: true,
      skipServerDelete: true,
      skipPermissionBoundary: true,
    });
    if (!deleteResult.ok) return deleteResult;
    const addResult = await addPayment(
      { ...normalizedPayment, id: existing.id },
      { skipActivity: true, skipPermissionBoundary: true },
    );
    if (!addResult.ok) return addResult;
    recordActivity({
      action: 'Updated',
      module: 'Payments',
      description: `Updated payment: ${normalizedPayment.referenceNo || normalizedPayment.id}`,
    });
    return okResult(addResult.status || 200);
  };

  const deletePayment = async (
    id: string,
    options?: { skipActivity?: boolean; skipServerDelete?: boolean; skipPermissionBoundary?: boolean },
  ): Promise<CrudMutationResult> => {
    if (!(options?.skipPermissionBoundary === true) && !enforcePermissionBoundary('POS', 'Add/Edit Payment', 'Delete payment')) {
      return failResult(403, 'Missing permission to delete payment.');
    }
    const payment = payments.find(p => p.id === id);
    if (!payment) return failResult(404, 'Payment not found.');

    const applyLocalDelete = () => {
      setPayments(prev => prev.filter(p => p.id !== id));

      if (payment.contactType === 'Customer') {
        if (payment.type === 'sent') {
          const remainingSentPayments = payments
            .filter(p =>
              p.id !== id &&
              p.contactType === 'Customer' &&
              p.type === 'sent' &&
              (p.contactId === payment.contactId || p.contactName === payment.contactName)
            )
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          setSellReturns(prev => {
            let copy = prev.map(record => {
              if (record.customerName !== payment.contactName && String(record.customerId) !== payment.contactId) return record;
              const total = Number(record.total || 0);
              return {
                ...record,
                paymentDue: total,
                paymentStatus: deriveSellReturnPaymentStatus(total, total),
              };
            });

            remainingSentPayments.forEach(pay => {
              let rem = Number(pay.amount || 0);
              const dueReturns = copy
                .map((record, index) => ({ record, index }))
                .filter(({ record }) =>
                  (record.customerName === pay.contactName || String(record.customerId) === pay.contactId) &&
                  Number(record.paymentDue || 0) > 0 &&
                  (record.paymentStatus === 'Due' || record.paymentStatus === 'Partial')
                )
                .sort((a, b) => new Date(a.record.date).getTime() - new Date(b.record.date).getTime());

              const linkedSet = new Set(
                (pay.linkedInvoices || [])
                  .map(ref => String(ref || '').trim())
                  .filter(Boolean)
              );
              const prioritized = linkedSet.size === 0
                ? dueReturns
                : [
                    ...dueReturns.filter(({ record }) => linkedSet.has(String(record.referenceNo || '').trim())),
                    ...dueReturns.filter(({ record }) => !linkedSet.has(String(record.referenceNo || '').trim())),
                  ];

              prioritized.forEach(({ record, index }) => {
                if (rem <= 0) return;
                const due = Math.max(0, Number(record.paymentDue || 0));
                if (due <= 0) return;
                const settled = Math.min(rem, due);
                rem -= settled;
                const nextDue = Number((due - settled).toFixed(3));
                const total = Number(record.total || 0);
                copy[index] = {
                  ...record,
                  paymentDue: nextDue,
                  paymentStatus: deriveSellReturnPaymentStatus(nextDue, total),
                };
              });
            });

            return copy;
          });
          return;
        }

        // Restore customer balance
        setCustomers(prev => prev.map(c => {
          if (c.id !== payment.contactId && c.businessName !== payment.contactName) return c;
          return { ...c, totalSellDue: c.totalSellDue + payment.amount };
        }));
        // Recalculate all sales for this customer from remaining payments
        const remainingPays = payments
          .filter(p => p.id !== id && p.contactType === 'Customer' &&
            p.type !== 'sent' &&
            (p.contactId === payment.contactId || p.contactName === payment.contactName))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setSales(prev => {
          // Reset all finalized sales for this customer to Due
          let copy = prev.map(s => {
            if (!isFinalizedSale(s)) return s;
            if (s.customerName !== payment.contactName && String(s.customerId) !== payment.contactId) return s;
            const grand = s.grandTotal || s.totalAmount || 0;
            return { ...s, totalPaid: 0, sellDue: grand, paymentStatus: 'Due' as const };
          });
          // Re-run FIFO for each remaining payment
          remainingPays.forEach(pay => {
            let rem = pay.amount;
            const dues = copy
              .map((s, i) => ({ s, i }))
              .filter(({ s }) =>
                isFinalizedSale(s) &&
                (s.customerName === pay.contactName || String(s.customerId) === pay.contactId) &&
                (s.paymentStatus === 'Due' || s.paymentStatus === 'Partial')
              )
              .sort((a, b) => new Date(a.s.date).getTime() - new Date(b.s.date).getTime());
            const linkedSet = new Set(
              (pay.linkedInvoices || [])
                .map(inv => String(inv || '').trim())
                .filter(Boolean)
            );
            const prioritized = linkedSet.size === 0
              ? dues
              : [
                  ...dues.filter(({ s }) => linkedSet.has(String(s.invoiceNo || '').trim())),
                  ...dues.filter(({ s }) => !linkedSet.has(String(s.invoiceNo || '').trim())),
                ];
            prioritized.forEach(({ s, i }) => {
              if (rem <= 0) return;
              const due = typeof s.sellDue === 'number' ? Math.max(0, s.sellDue) : Math.max(0, (s.grandTotal || 0) - (s.totalPaid || 0));
              if (due <= 0) return;
              const paying = Math.min(rem, due);
              rem -= paying;
              const newDue = due - paying;
              copy[i] = { ...s, totalPaid: (s.totalPaid || 0) + paying, sellDue: newDue, paymentStatus: newDue <= 0.001 ? 'Paid' : 'Partial' };
            });
          });
          return copy;
        });
      }

      if (payment.contactType === 'Supplier') {
        // Restore supplier balance
        setSuppliers(prev => prev.map(s => {
          if (s.id !== payment.contactId && s.businessName !== payment.contactName) return s;
          return { ...s, totalPurchaseDue: s.totalPurchaseDue + payment.amount };
        }));
        // Recalculate purchases for this supplier from remaining payments
        const remainingSupPays = payments
          .filter(p => p.id !== id && p.contactType === 'Supplier' &&
            (p.contactId === payment.contactId || p.contactName === payment.contactName))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setPurchases(prev => {
          let copy = prev.map(p => {
            if (p.supplier !== payment.contactName && p.supplierId !== payment.contactId) return p;
            const grand = p.grandTotal || 0;
            return { ...p, paymentDue: grand, paymentStatus: 'Due' as const };
          });
          remainingSupPays.forEach(pay => {
            let rem = pay.amount;
            copy = copy.map(p => {
              if (p.supplier !== pay.contactName && p.supplierId !== pay.contactId) return p;
              if (rem <= 0 || p.paymentStatus === 'Paid') return p;
              const due = typeof p.paymentDue === 'number' ? Math.max(0, p.paymentDue) : Math.max(0, p.grandTotal || 0);
              const paying = Math.min(rem, due);
              rem -= paying;
              const newDue = due - paying;
              return { ...p, paymentDue: newDue, paymentStatus: newDue <= 0.001 ? 'Paid' : 'Partial' };
            });
          });
          return copy;
        });
      }
      if (!options?.skipActivity) {
        recordActivity({
          action: 'Deleted',
          module: 'Payments',
          description: `Deleted payment: ${payment.referenceNo || payment.id}`,
        });
      }
    };

    if (options?.skipServerDelete) {
      applyLocalDelete();
      return okResult(200);
    }
    return confirmDeleteFromPostgres(
      'payments',
      id,
      'Payments',
      payment.referenceNo || payment.id,
      async () => {
        applyLocalDelete();
      },
    );
  };

  // ============================================================
  //  CRUD: EXPENSES
  // ============================================================

  const addExpense = async (expense: Expense): Promise<CrudMutationResult> => {
    const normalized = normalizeExpenseRecordLoaded(expense);
    const saved = await syncRecordStrict('expenses', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Expenses',
        description: `Failed to add expense ${normalized.refNo || normalized.id} to Postgres (${saved.status || 0}).`,
      });
      return result;
    }
    setExpenses(prev => [...prev, normalized]);
    recordActivity({
      action: 'Created',
      module: 'Expenses',
      description: `Added expense: ${normalized.refNo || normalized.id}`,
    });
    return result;
  };
  const updateExpense = async (expense: Expense): Promise<CrudMutationResult> => {
    const normalized = normalizeExpenseRecordLoaded(expense);
    if (!canEditTransaction('Expenses', String(normalized.refNo || normalized.id || '').trim(), normalized.date)) {
      return failResult(403, 'Expense is outside editable transaction window.');
    }
    const saved = await syncRecordStrict('expenses', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Expenses',
        description: `Failed to update expense ${normalized.refNo || normalized.id} in Postgres (${saved.status || 0}).`,
      });
      return result;
    }
    setExpenses(prev => prev.map(e => e.id === normalized.id ? normalized : e));
    recordActivity({
      action: 'Updated',
      module: 'Expenses',
      description: `Updated expense: ${normalized.refNo || normalized.id}`,
    });
    return result;
  };
  const deleteExpense = async (id: string): Promise<CrudMutationResult> => {
    const existing = expenses.find(e => e.id === id);
    return confirmDeleteFromPostgres('expenses', id, 'Expenses', existing?.refNo || existing?.id || id, async () => {
      setExpenses(prev => prev.filter(e => e.id !== id));
      setPayments(prev => prev.filter(payment =>
        !(
          payment.contactType === 'Expense' &&
          (payment.expenseId === id || payment.contactId === id)
        )
      ));
      recordActivity({
        action: 'Deleted',
        module: 'Expenses',
        description: `Deleted expense: ${existing?.refNo || existing?.id || id}`,
      });
    });
  };

  const addExpenseCategory = async (cat: ExpenseCategory): Promise<CrudMutationResult> => {
    const saved = await syncRecordStrict('expenseCategories', cat);
    const result = toCrudResult(saved);
    if (!result.ok) return result;
    setExpenseCategories(prev => [...prev, cat]);
    return result;
  };
  const updateExpenseCategory = async (cat: ExpenseCategory): Promise<CrudMutationResult> => {
    const saved = await syncRecordStrict('expenseCategories', cat);
    const result = toCrudResult(saved);
    if (!result.ok) return result;
    setExpenseCategories(prev => prev.map(c => c.id === cat.id ? cat : c));
    return result;
  };
  const deleteExpenseCategory = async (id: string): Promise<CrudMutationResult> => {
    return confirmDeleteFromPostgres('expenseCategories', id, 'Expense Categories', id, async () => {
      setExpenseCategories(prev => prev.filter(c => c.id !== id));
    });
  };

  // ============================================================
  //  CRUD: USERS
  // ============================================================

  const addUser = async (user: AppUser): Promise<CrudMutationResult> => {
    if (!enforcePermissionBoundary('User', 'Add user', 'Create user')) {
      return failResult(403, 'Missing permission to create user.');
    }
    const normalized = normalizeUserRecord(user);
    const saved = await syncRecordStrict('users', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Users',
        description: `Failed to add user ${normalized.name || normalized.username || normalized.id} to Postgres (${saved.status || 0}).`,
      });
      return result;
    }
    setUsers(prev => [...prev, normalized]);
    setCommissionAgents(prev => upsertCommissionAgentForUser(prev, normalized));
    recordActivity({
      action: 'Created',
      module: 'Users',
      description: `Added user: ${normalized.name || normalized.username || normalized.id}`,
    });
    return result;
  };
  const updateUser = async (user: AppUser): Promise<CrudMutationResult> => {
    if (!enforcePermissionBoundary('User', ['Add user', 'Edit user'], 'Update user')) {
      return failResult(403, 'Missing permission to update user.');
    }
    const normalized = normalizeUserRecord(user);
    const saved = await syncRecordStrict('users', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Users',
        description: `Failed to update user ${normalized.name || normalized.username || normalized.id} in Postgres (${saved.status || 0}).`,
      });
      return result;
    }
    setUsers(prev => prev.map(u => u.id === user.id ? normalized : u));
    setCommissionAgents(prev => upsertCommissionAgentForUser(prev, normalized));
    recordActivity({
      action: 'Updated',
      module: 'Users',
      description: `Updated user: ${normalized.name || normalized.username || normalized.id}`,
    });
    return result;
  };
  const deleteUser = async (id: string): Promise<CrudMutationResult> => {
    if (!enforcePermissionBoundary('User', ['Add user', 'Delete user'], 'Delete user')) {
      return failResult(403, 'Missing permission to delete user.');
    }
    const existing = users.find(u => u.id === id);
    return confirmDeleteFromPostgres('users', id, 'Users', existing?.name || existing?.username || id, async () => {
      setUsers(prev => prev.filter(u => u.id !== id));
      setCommissionAgents(prev =>
        prev.filter(agent => String(agent.linkedUserId || '').trim() !== String(id || '').trim())
      );
      recordActivity({
        action: 'Deleted',
        module: 'Users',
        description: `Deleted user: ${existing?.name || existing?.username || id}`,
      });
    });
  };

  // ============================================================
  //  CRUD: ROLES
  // ============================================================

  const addRole = async (role: Role): Promise<CrudMutationResult> => {
    const normalized = normalizeRoleRecord(role);
    const saved = await syncRecordStrict('roles', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Roles',
        description: `Failed to add role ${normalized.name || normalized.id} to Postgres (${saved.status || 0}).`,
      });
      return result;
    }
    setRoles(prev => [...prev, normalized]);
    recordActivity({
      action: 'Created',
      module: 'Roles',
      description: `Added role: ${normalized.name || normalized.id}`,
    });
    return result;
  };
  const updateRole = async (role: Role): Promise<CrudMutationResult> => {
    const normalized = normalizeRoleRecord(role);
    const saved = await syncRecordStrict('roles', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Roles',
        description: `Failed to update role ${normalized.name || normalized.id} in Postgres (${saved.status || 0}).`,
      });
      return result;
    }
    setRoles(prev => prev.map(r => r.id === role.id ? normalized : r));
    recordActivity({
      action: 'Updated',
      module: 'Roles',
      description: `Updated role: ${normalized.name || normalized.id}`,
    });
    return result;
  };
  const deleteRole = async (id: number): Promise<CrudMutationResult> => {
    const existing = roles.find(r => r.id === id);
    return confirmDeleteFromPostgres('roles', String(id), 'Roles', existing?.name || String(id), async () => {
      setRoles(prev => prev.filter(r => r.id !== id));
      recordActivity({
        action: 'Deleted',
        module: 'Roles',
        description: `Deleted role: ${existing?.name || id}`,
      });
    });
  };

  // ============================================================
  //  CRUD: COMMISSION AGENTS
  // ============================================================

  const addCommissionAgent = async (agent: CommissionAgent): Promise<CrudMutationResult> => {
    const normalized = normalizeCommissionAgentRecord(agent);
    const saved = await syncRecordStrict('commissionAgents', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Commission Agents',
        description: `Failed to add agent ${normalized.name || normalized.id} to Postgres (${saved.status || 0}).`,
      });
      return result;
    }
    setCommissionAgents(prev => [...prev, normalized]);
    recordActivity({
      action: 'Created',
      module: 'Commission Agents',
      description: `Added agent: ${normalized.name || normalized.id}`,
    });
    return result;
  };
  const updateCommissionAgent = async (agent: CommissionAgent): Promise<CrudMutationResult> => {
    const normalized = normalizeCommissionAgentRecord(agent);
    const saved = await syncRecordStrict('commissionAgents', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Commission Agents',
        description: `Failed to update agent ${normalized.name || normalized.id} in Postgres (${saved.status || 0}).`,
      });
      return result;
    }
    setCommissionAgents(prev => prev.map(a => a.id === agent.id ? normalized : a));
    recordActivity({
      action: 'Updated',
      module: 'Commission Agents',
      description: `Updated agent: ${normalized.name || normalized.id}`,
    });
    return result;
  };
  const deleteCommissionAgent = async (id: number): Promise<CrudMutationResult> => {
    const existing = commissionAgents.find(a => a.id === id);
    return confirmDeleteFromPostgres('commissionAgents', String(id), 'Commission Agents', existing?.name || String(id), async () => {
      setCommissionAgents(prev => prev.filter(a => a.id !== id));
      recordActivity({
        action: 'Deleted',
        module: 'Commission Agents',
        description: `Deleted agent: ${existing?.name || id}`,
      });
    });
  };

  // ============================================================
  //  CRUD: LOCATIONS
  // ============================================================

  const addLocation = async (location: Location): Promise<LocationMutationResult> => {
    const normalized = normalizeLocationRecord(location, location);
    const resolvedId = String(normalized.id || `BL${Date.now()}`).trim();
    const payload: Location = {
      ...normalized,
      id: resolvedId,
    };
    const normalizedName = normalizeText(payload.name);
    if (!normalizedName) {
      recordActivity({
        action: 'Blocked',
        module: 'Locations',
        description: 'Add blocked. Location name is required.',
      });
      return { success: false, message: 'Location name is required.' };
    }
    const hasDuplicateId = locations.some(existing => existing.id === payload.id);
    if (hasDuplicateId) {
      recordActivity({
        action: 'Blocked',
        module: 'Locations',
        description: `Add blocked. Duplicate location id: ${payload.id}`,
      });
      return { success: false, message: `Location ID "${payload.id}" already exists.` };
    }
    const hasDuplicateName = locations.some(existing => normalizeText(existing.name) === normalizedName);
    if (hasDuplicateName) {
      recordActivity({
        action: 'Blocked',
        module: 'Locations',
        description: `Add blocked. Duplicate location name: ${payload.name}`,
      });
      return { success: false, message: `Location name "${payload.name}" already exists.` };
    }
    if (isRemovedLocationRecord(payload)) {
      recordActivity({
        action: 'Blocked',
        module: 'Locations',
        description: `Add blocked. Location is deprecated and cannot be created: ${payload.name || payload.id}`,
      });
      return { success: false, message: 'This location is deprecated and cannot be used.' };
    }

    const saved = await syncRecordStrict('locations', payload);
    if (!saved.ok) {
      const message = saved.status === 401
        ? 'Your session expired. Please sign in again.'
        : (saved.error || 'Failed to save location to database.');
      recordActivity({
        action: 'Blocked',
        module: 'Locations',
        description: `Add blocked. Database save failed for ${payload.name || payload.id}: ${message}`,
      });
      return { success: false, message };
    }

    setLocations(prev => normalizeLocationArray([...prev, payload]));
    recordActivity({
      action: 'Created',
      module: 'Locations',
      description: `Added location: ${payload.name || payload.id}`,
    });
    return { success: true };
  };
  const refreshLocationDependencyCaches = async () => {
    await Promise.all([
      bootstrapStockTransfersFromDB().catch(() => {}),
      bootstrapStockAdjustmentsFromDB().catch(() => {}),
      bootstrapStockLotsFromDB().catch(() => {}),
      bootstrapRegisterFromDB().catch(() => {}),
    ]);

    const [remoteFieldPayments, remotePaymentAccounts] = await Promise.all([
      fetchDedicated<any>('/api/sync/field-payments').catch(() => null),
      fetchDedicated<any>('/api/sync/payment-accounts').catch(() => null),
    ]);

    if (Array.isArray(remoteFieldPayments)) {
      fieldPaymentsCacheRef.current = remoteFieldPayments;
    }
    if (Array.isArray(remotePaymentAccounts)) {
      setStoredPaymentAccounts(remotePaymentAccounts);
      dispatchPaymentAccountsUpdated();
    }
  };
  const updateLocation = async (location: Location): Promise<LocationMutationResult> => {
    const existing = locations.find(l => l.id === location.id);
    if (!existing) {
      recordActivity({
        action: 'Blocked',
        module: 'Locations',
        description: `Update blocked. Location not found: ${location.id}`,
      });
      return { success: false, message: 'Location not found.' };
    }

    const normalized = normalizeLocationRecord(location, existing);
    const normalizedName = normalizeText(normalized.name);
    if (!normalizedName) {
      recordActivity({
        action: 'Blocked',
        module: 'Locations',
        description: `Update blocked. Location name is required: ${normalized.id}`,
      });
      return { success: false, message: 'Location name is required.' };
    }
    const duplicateName = locations.some(
      (row) => row.id !== normalized.id && normalizeText(row.name) === normalizedName
    );
    if (duplicateName) {
      recordActivity({
        action: 'Blocked',
        module: 'Locations',
        description: `Update blocked. Duplicate location name: ${normalized.name}`,
      });
      return { success: false, message: `Location name "${normalized.name}" already exists.` };
    }
    if (isRemovedLocationRecord(normalized)) {
      recordActivity({
        action: 'Blocked',
        module: 'Locations',
        description: `Update blocked. Location is deprecated and cannot be used: ${normalized.name || normalized.id}`,
      });
      return { success: false, message: 'This location is deprecated and cannot be used.' };
    }

    const saved = await syncRecordStrict('locations', normalized);
    if (!saved.ok) {
      const message = saved.status === 401
        ? 'Your session expired. Please sign in again.'
        : (saved.error || 'Failed to update location in database.');
      recordActivity({
        action: 'Blocked',
        module: 'Locations',
        description: `Update blocked. Database save failed for ${normalized.name || normalized.id}: ${message}`,
      });
      return { success: false, message };
    }

    const previousName = String(existing.name || '').trim();
    const nextName = String(normalized.name || '').trim();
    const nameChanged = normalizeText(previousName) !== normalizeText(nextName);

    setLocations(prev =>
      normalizeLocationArray(prev.map(l => l.id === normalized.id ? normalized : l))
    );

    if (nameChanged && previousName && nextName) {
      const matchesOldName = (value?: string) => normalizeText(value) === normalizeText(previousName);
      await refreshLocationDependencyCaches();

      const nextProducts = products.map((product) => {
        const businessLocation = matchesOldName(product.businessLocation) ? nextName : product.businessLocation;
        const openingStockLocation = matchesOldName(product.openingStockLocation)
          ? nextName
          : product.openingStockLocation;
        if (businessLocation === product.businessLocation && openingStockLocation === product.openingStockLocation) {
          return product;
        }
        return {
          ...product,
          businessLocation,
          openingStockLocation,
        };
      });
      const nextSales = sales.map(sale => matchesOldName(sale.location) ? { ...sale, location: nextName } : sale);
      const nextSellReturns = sellReturns.map(record => matchesOldName(record.location) ? { ...record, location: nextName } : record);
      const nextPurchases = purchases.map(purchase => matchesOldName(purchase.location) ? { ...purchase, location: nextName } : purchase);
      const nextPurchaseRequisitions = purchaseRequisitions.map(requisition => matchesOldName(requisition.location) ? { ...requisition, location: nextName } : requisition);
      const nextPurchaseOrders = purchaseOrders.map(order => matchesOldName(order.location) ? { ...order, location: nextName } : order);
      const nextPurchaseReturns = purchaseReturns.map(record => matchesOldName(record.location) ? { ...record, location: nextName } : record);
      const nextOrders = orders.map(order => matchesOldName(order.businessLocation) ? { ...order, businessLocation: nextName } : order);
      const nextExpenses = expenses.map(expense => matchesOldName(expense.location) ? { ...expense, location: nextName } : expense);
      const nextDiscounts = discounts.map(discount => matchesOldName(discount.location) ? { ...discount, location: nextName } : discount);
      const nextPayments = payments.map(payment => matchesOldName(payment.location) ? { ...payment, location: nextName } : payment);
      const nextUsers = users.map(user => matchesOldName(user.businessLocation) ? { ...user, businessLocation: nextName } : user);
      const nextCurrentUser = currentUser && matchesOldName(currentUser.businessLocation)
        ? { ...currentUser, businessLocation: nextName }
        : currentUser;

      const syncRenamedRows = async (
        resource: string,
        label: string,
        rows: Record<string, unknown>[],
      ): Promise<LocationMutationResult> => {
        for (const row of rows) {
          const saved = await syncRecordStrict(resource, row);
          if (saved.ok) continue;
          const message = saved.status === 401
            ? 'Your session expired. Please sign in again.'
            : (saved.error || `Failed to sync ${label}.`);
          recordActivity({
            action: 'Blocked',
            module: 'Locations',
            description: `Location rename cascade failed on ${label} (${saved.status || 0}): ${message}`,
          });
          return { success: false, message };
        }
        return { success: true };
      };

      const renameSyncPlan: Array<{
        resource: string;
        label: string;
        rows: Record<string, unknown>[];
      }> = [
        { resource: 'products', label: 'Products', rows: nextProducts.filter((row, index) => row !== products[index]) as Record<string, unknown>[] },
        { resource: 'sales', label: 'Sales', rows: nextSales.filter((row, index) => row !== sales[index]) as Record<string, unknown>[] },
        { resource: 'sellReturns', label: 'Sell Returns', rows: nextSellReturns.filter((row, index) => row !== sellReturns[index]) as Record<string, unknown>[] },
        { resource: 'purchases', label: 'Purchases', rows: nextPurchases.filter((row, index) => row !== purchases[index]) as Record<string, unknown>[] },
        { resource: 'purchaseRequisitions', label: 'Purchase Requisitions', rows: nextPurchaseRequisitions.filter((row, index) => row !== purchaseRequisitions[index]) as Record<string, unknown>[] },
        { resource: 'purchaseOrders', label: 'Purchase Orders', rows: nextPurchaseOrders.filter((row, index) => row !== purchaseOrders[index]) as Record<string, unknown>[] },
        { resource: 'purchaseReturns', label: 'Purchase Returns', rows: nextPurchaseReturns.filter((row, index) => row !== purchaseReturns[index]) as Record<string, unknown>[] },
        { resource: 'orders', label: 'Orders', rows: nextOrders.filter((row, index) => row !== orders[index]) as Record<string, unknown>[] },
        { resource: 'expenses', label: 'Expenses', rows: nextExpenses.filter((row, index) => row !== expenses[index]) as Record<string, unknown>[] },
        { resource: 'discounts', label: 'Discounts', rows: nextDiscounts.filter((row, index) => row !== discounts[index]) as Record<string, unknown>[] },
        { resource: 'payments', label: 'Payments', rows: nextPayments.filter((row, index) => row !== payments[index]) as Record<string, unknown>[] },
        { resource: 'users', label: 'Users', rows: nextUsers.filter((row, index) => row !== users[index]) as Record<string, unknown>[] },
      ];

      for (const step of renameSyncPlan) {
        if (step.rows.length === 0) continue;
        const outcome = await syncRenamedRows(step.resource, step.label, step.rows);
        if (!outcome.success) return outcome;
      }

      try {
        const transferRows = readStockTransfers();
        let transferChanged = false;
        const nextTransfers = transferRows.map((row) => {
          const fromMatch = matchesOldName(row.locationFrom);
          const toMatch = matchesOldName(row.locationTo);
          if (!fromMatch && !toMatch) return row;
          transferChanged = true;
          return {
            ...row,
            locationFrom: fromMatch ? nextName : row.locationFrom,
            locationTo: toMatch ? nextName : row.locationTo,
          };
        });
        if (transferChanged) {
          const transferSaved = await writeStockTransfers(nextTransfers);
          if (!transferSaved) {
            return { success: false, message: 'Failed to sync linked stock transfers in Postgres.' };
          }
        }
      } catch {
        return { success: false, message: 'Failed to sync linked stock transfers in Postgres.' };
      }

      try {
        const adjustmentRows = readStockAdjustments();
        let adjustmentChanged = false;
        const nextAdjustments = adjustmentRows.map((row) => {
          if (!matchesOldName(row.location)) return row;
          adjustmentChanged = true;
          return { ...row, location: nextName };
        });
        if (adjustmentChanged) {
          const adjustmentSaved = await writeStockAdjustments(nextAdjustments);
          if (!adjustmentSaved) {
            return { success: false, message: 'Failed to sync linked stock adjustments in Postgres.' };
          }
        }
      } catch {
        return { success: false, message: 'Failed to sync linked stock adjustments in Postgres.' };
      }

      try {
        const lotRows = readStockLotBalances();
        let lotChanged = false;
        const nextLotRows = lotRows.map((row) => {
          if (!matchesOldName(row.location)) return row;
          lotChanged = true;
          return {
            ...row,
            location: nextName,
          };
        });
        if (lotChanged) {
          const lotSaved = await writeStockLotBalances(nextLotRows, lotRows);
          if (!lotSaved) {
            return { success: false, message: 'Failed to sync linked stock lots in Postgres.' };
          }
        }
      } catch {
        return { success: false, message: 'Failed to sync linked stock lots in Postgres.' };
      }

      try {
        const activeSession = getActiveRegisterSession();
        if (activeSession && (activeSession.locationId === normalized.id || matchesOldName(activeSession.locationName))) {
          const activeSaved = await setActiveRegisterSession({
            ...activeSession,
            locationId: normalized.id,
            locationName: nextName,
          });
          if (!activeSaved) {
            return { success: false, message: 'Failed to sync active register session in Postgres.' };
          }
        }
        const sessions = getRegisterSessions();
        let sessionChanged = false;
        const nextSessions = sessions.map((session) => {
          if (session.locationId !== normalized.id && !matchesOldName(session.locationName)) return session;
          sessionChanged = true;
          return {
            ...session,
            locationId: normalized.id,
            locationName: nextName,
          };
        });
        if (sessionChanged) {
          const sessionSaved = await setRegisterSessions(nextSessions);
          if (!sessionSaved) {
            return { success: false, message: 'Failed to sync register sessions in Postgres.' };
          }
        }
      } catch {
        return { success: false, message: 'Failed to sync register sessions in Postgres.' };
      }

      try {
        const nextRows = fieldPaymentsCacheRef.current.map((row: any) => {
          if (!matchesOldName(row?.location)) return row;
          return { ...row, location: nextName };
        });
        const changed = nextRows.some((row, index) => row !== fieldPaymentsCacheRef.current[index]);
        if (changed) {
          for (const row of nextRows) {
            const id = String(row?.id || '').trim();
            if (!id) continue;
            const saved = await syncDedicatedStrict('/api/sync/field-payments', id, row);
            if (!saved.ok) {
              return { success: false, message: saved.error || 'Failed to sync field payments in Postgres.' };
            }
          }
          fieldPaymentsCacheRef.current = nextRows;
        }
      } catch {
        return { success: false, message: 'Failed to sync field payments in Postgres.' };
      }

      try {
        const paymentAccountRows = getStoredPaymentAccounts();
        const nextRows = paymentAccountRows.map((row: any) => {
          if (!matchesOldName(row?.location)) return row;
          return { ...row, location: nextName };
        });
        const changed = nextRows.some((row, index) => row !== paymentAccountRows[index]);
        if (changed) {
          for (const row of nextRows) {
            const id = String(row?.id || '').trim();
            if (!id) continue;
            const saved = await syncDedicatedStrict('/api/sync/payment-accounts', id, row);
            if (!saved.ok) {
              return { success: false, message: saved.error || 'Failed to sync payment accounts in Postgres.' };
            }
          }
          setStoredPaymentAccounts(nextRows);
          dispatchPaymentAccountsUpdated();
        }
      } catch {
        return { success: false, message: 'Failed to sync payment accounts in Postgres.' };
      }

      setProducts(nextProducts);
      setSales(nextSales);
      setSellReturns(nextSellReturns);
      setPurchases(nextPurchases);
      setPurchaseRequisitions(nextPurchaseRequisitions);
      setPurchaseOrders(nextPurchaseOrders);
      setPurchaseReturns(nextPurchaseReturns);
      setOrders(nextOrders);
      setExpenses(nextExpenses);
      setDiscounts(nextDiscounts);
      setPayments(nextPayments);
      setUsers(nextUsers);
      setCurrentUser(nextCurrentUser);
    }

    recordActivity({
      action: 'Updated',
      module: 'Locations',
      description: `Updated location: ${normalized.name || normalized.id}`,
    });
    return { success: true };
  };
  const deleteLocation = async (id: string): Promise<LocationMutationResult> => {
    const existing = locations.find(l => l.id === id);
    if (!existing) {
      return { success: false, message: 'Location not found.' };
    }

    if (locations.length <= 1) {
      return { success: false, message: 'At least one business location must remain.' };
    }
    const remainingActiveCount = locations.filter(
      (row) => row.id !== id && row.isActive !== false
    ).length;
    if (remainingActiveCount <= 0) {
      return { success: false, message: 'At least one active business location must remain.' };
    }

    const matchesLocationName = (value?: string) =>
      normalizeText(value) === normalizeText(existing.name);

    const usageParts: string[] = [];
    const pushUsage = (label: string, count: number) => {
      if (count > 0) usageParts.push(`${label} (${count})`);
    };

    pushUsage('Products', products.filter(product => matchesLocationName(product.businessLocation) || matchesLocationName(product.openingStockLocation)).length);
    pushUsage('Sales', sales.filter(sale => matchesLocationName(sale.location)).length);
    pushUsage('Sell Returns', sellReturns.filter(record => matchesLocationName(record.location)).length);
    pushUsage('Purchases', purchases.filter(purchase => matchesLocationName(purchase.location)).length);
    pushUsage('Purchase Requisitions', purchaseRequisitions.filter(record => matchesLocationName(record.location)).length);
    pushUsage('Purchase Orders', purchaseOrders.filter(record => matchesLocationName(record.location)).length);
    pushUsage('Purchase Returns', purchaseReturns.filter(record => matchesLocationName(record.location)).length);
    pushUsage('Orders', orders.filter(order => matchesLocationName(order.businessLocation)).length);
    pushUsage('Expenses', expenses.filter(expense => matchesLocationName(expense.location)).length);
    pushUsage('Discounts', discounts.filter(discount => matchesLocationName(discount.location)).length);
    pushUsage('Payments', payments.filter(payment => matchesLocationName(payment.location)).length);
    pushUsage('Users (access)', users.filter(user => (user.accessLocations || []).includes(existing.id)).length);
    pushUsage('Users (default location)', users.filter(user => matchesLocationName(user.businessLocation)).length);
    if (currentUser && (matchesLocationName(currentUser.businessLocation) || (currentUser.accessLocations || []).includes(existing.id))) {
      usageParts.push('Current User Session (1)');
    }

    await refreshLocationDependencyCaches();

    try {
      pushUsage('Stock Transfers', readStockTransfers().filter(row => matchesLocationName(row.locationFrom) || matchesLocationName(row.locationTo)).length);
      pushUsage('Stock Adjustments', readStockAdjustments().filter(row => matchesLocationName(row.location)).length);
      pushUsage('Stock Lots', readStockLotBalances().filter(row => matchesLocationName(row.location)).length);
      const registerSessions = getRegisterSessions();
      pushUsage(
        'Register Sessions',
        registerSessions.filter(
          session => session.locationId === existing.id || matchesLocationName(session.locationName)
        ).length
      );
      const activeSession = getActiveRegisterSession();
      if (activeSession && (activeSession.locationId === existing.id || matchesLocationName(activeSession.locationName))) {
        usageParts.push('Open Register (1)');
      }

      pushUsage(
        'Field Payments',
        fieldPaymentsCacheRef.current.filter((row: any) => matchesLocationName(row?.location)).length
      );
      pushUsage(
        'Payment Accounts',
        getStoredPaymentAccounts().filter((row: any) => matchesLocationName(row?.location)).length
      );
    } catch {
      // ignore storage read failures for dependency summary
    }

    if (usageParts.length > 0) {
      const message = `Location "${existing.name}" is in use: ${usageParts.join(', ')}.`;
      recordActivity({
        action: 'Blocked',
        module: 'Locations',
        description: `Delete blocked for ${existing.name}: ${usageParts.join(', ')}`,
      });
      return { success: false, message };
    }

    const deleted = await deleteRecordStrict('locations', id);
    if (!deleted.ok) {
      return {
        success: false,
        message: deleted.status === 401
          ? 'Your session expired. Please sign in again.'
          : (deleted.error || 'Failed to delete location from database.'),
      };
    }

    setLocations(prev => prev.filter(l => l.id !== id));
    recordActivity({
      action: 'Deleted',
      module: 'Locations',
      description: `Deleted location: ${existing?.name || id}`,
    });
    return { success: true };
  };

  // ============================================================
  //  CRUD: RECEIPT PRINTERS
  // ============================================================

  const addPrinter = async (printer: ReceiptPrinter): Promise<CrudMutationResult> => {
    const normalized = normalizePrinterRecord(printer, printer);
    const resolvedId = String(normalized.id || `PRN-${Date.now()}`).trim();
    const payload: ReceiptPrinter = { ...normalized, id: resolvedId };
    const normalizedName = normalizeText(payload.name);

    if (!normalizedName) {
      recordActivity({
        action: 'Blocked',
        module: 'Receipt Printers',
        description: 'Add blocked. Printer name is required.',
      });
      return failResult(400, 'Printer name is required.');
    }

    const duplicateId = printers.some(existing => existing.id === payload.id);
    if (duplicateId) {
      recordActivity({
        action: 'Blocked',
        module: 'Receipt Printers',
        description: `Add blocked. Duplicate printer id: ${payload.id}`,
      });
      return failResult(409, `Printer ID "${payload.id}" already exists.`);
    }

    const duplicateName = printers.some(existing => normalizeText(existing.name) === normalizedName);
    if (duplicateName) {
      recordActivity({
        action: 'Blocked',
        module: 'Receipt Printers',
        description: `Add blocked. Duplicate printer name: ${payload.name}`,
      });
      return failResult(409, `Printer name "${payload.name}" already exists.`);
    }

    const saved = await syncRecordStrict('receiptPrinters', payload);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Receipt Printers',
        description: `Failed to add printer ${payload.name || payload.id} to Postgres (${saved.status || 0}).`,
      });
      return result;
    }
    setPrinters(prev => [...prev, payload]);
    recordActivity({
      action: 'Created',
      module: 'Receipt Printers',
      description: `Added printer: ${payload.name || payload.id}`,
    });
    return result;
  };

  const updatePrinter = async (printer: ReceiptPrinter): Promise<CrudMutationResult> => {
    const existing = printers.find(row => row.id === printer.id);
    if (!existing) {
      recordActivity({
        action: 'Blocked',
        module: 'Receipt Printers',
        description: `Update blocked. Printer not found: ${printer.id}`,
      });
      return failResult(404, 'Printer not found.');
    }

    const normalized = normalizePrinterRecord(printer, existing);
    const normalizedName = normalizeText(normalized.name);
    if (!normalizedName) {
      recordActivity({
        action: 'Blocked',
        module: 'Receipt Printers',
        description: `Update blocked. Printer name is required: ${normalized.id}`,
      });
      return failResult(400, 'Printer name is required.');
    }

    const duplicateName = printers.some(
      row => row.id !== normalized.id && normalizeText(row.name) === normalizedName
    );
    if (duplicateName) {
      recordActivity({
        action: 'Blocked',
        module: 'Receipt Printers',
        description: `Update blocked. Duplicate printer name: ${normalized.name}`,
      });
      return failResult(409, `Printer name "${normalized.name}" already exists.`);
    }

    const saved = await syncRecordStrict('receiptPrinters', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Receipt Printers',
        description: `Failed to update printer ${normalized.name || normalized.id} in Postgres (${saved.status || 0}).`,
      });
      return result;
    }
    setPrinters(prev => prev.map(row => (row.id === normalized.id ? normalized : row)));
    recordActivity({
      action: 'Updated',
      module: 'Receipt Printers',
      description: `Updated printer: ${normalized.name || normalized.id}`,
    });
    return result;
  };

  const deletePrinter = async (id: string): Promise<CrudMutationResult> => {
    const existing = printers.find(row => row.id === id);
    if (!existing) {
      recordActivity({
        action: 'Blocked',
        module: 'Receipt Printers',
        description: `Delete blocked. Printer not found: ${id}`,
      });
      return failResult(404, 'Printer not found.');
    }

    return confirmDeleteFromPostgres('receiptPrinters', id, 'Receipt Printers', existing.name || existing.id, async () => {
      const affectedLocations = locations
        .filter(location => String(location.receiptPrinterId || '').trim() === id)
        .map(location => ({
          ...location,
          receiptPrinterType: 'browser' as const,
          receiptPrinterId: '',
        }));
      const persistedLocations = new Map<string, Location>();
      for (const location of affectedLocations) {
        const saved = await syncRecordStrict('locations', location);
        if (!saved.ok) {
          recordActivity({
            action: 'Blocked',
            module: 'Receipt Printers',
            description: `Failed to sync linked location ${location.name || location.id} after printer delete (${saved.status || 0}).`,
          });
          continue;
        }
        persistedLocations.set(location.id, location);
      }
      setPrinters(prev => prev.filter(row => row.id !== id));
      if (persistedLocations.size > 0) {
        setLocations(prev => prev.map(location => persistedLocations.get(location.id) || location));
      }
      recordActivity({
        action: 'Deleted',
        module: 'Receipt Printers',
        description: `Deleted printer: ${existing.name || existing.id}`,
      });
    });
  };

  // ============================================================
  //  CRUD: INVOICE SETTINGS
  // ============================================================

  const normalizeInvoiceSchemes = (records: InvoiceScheme[]): InvoiceScheme[] => {
    const filtered = records.filter((record) => !isRemovedInvoiceScheme(record));
    if (filtered.length === 0) return [];
    const withDefault = filtered.some(record => record.isDefault)
      ? filtered
      : filtered.map((record, index) => ({ ...record, isDefault: index === 0 }));
    let defaultAssigned = false;
    return withDefault.map(record => {
      if (!record.isDefault) return record;
      if (!defaultAssigned) {
        defaultAssigned = true;
        return record;
      }
      return { ...record, isDefault: false };
    });
  };

  const normalizeInvoiceLayouts = (records: InvoiceLayout[]): InvoiceLayout[] => {
    const filtered = records.filter((record) => !isRemovedInvoiceLayout(record));
    if (filtered.length === 0) return [];
    const withDefault = filtered.some(record => record.isDefault)
      ? filtered
      : filtered.map((record, index) => ({ ...record, isDefault: index === 0 }));
    let defaultAssigned = false;
    return withDefault.map(record => {
      if (!record.isDefault) return record;
      if (!defaultAssigned) {
        defaultAssigned = true;
        return record;
      }
      return { ...record, isDefault: false };
    });
  };

  const normalizeInvoiceSchemeRecord = (scheme: InvoiceScheme): InvoiceScheme => ({
    ...scheme,
    id: String(scheme.id || `INV-SCH-${Date.now()}`).trim(),
    name: String(scheme.name || '').trim(),
    prefix: String(scheme.prefix || settings.salesInvoicePrefix || 'INV-').trim() || (settings.salesInvoicePrefix || 'INV-'),
    numberingType: 'Sequential',
    startFrom: Math.max(1, Number(scheme.startFrom || 1)),
    numberOfDigits: Math.max(1, Number(scheme.numberOfDigits || 4)),
    isDefault: !!scheme.isDefault,
  });

  const normalizeInvoiceLayoutRecord = (layout: InvoiceLayout): InvoiceLayout => ({
    ...layout,
    id: String(layout.id || `INV-LYT-${Date.now()}`).trim(),
    name: String(layout.name || '').trim(),
    design: String(layout.design || 'Classic').trim() || 'Classic',
    isDefault: !!layout.isDefault,
  });

  const addInvoiceScheme = async (scheme: InvoiceScheme): Promise<CrudMutationResult> => {
    const normalized = normalizeInvoiceSchemeRecord(scheme);
    if (!normalized.name) {
      recordActivity({
        action: 'Blocked',
        module: 'Invoice Settings',
        description: 'Add invoice scheme blocked. Name is required.',
      });
      return failResult(400, 'Invoice scheme name is required.');
    }
    const duplicateByName = invoiceSchemes.some(record =>
      normalizeText(record.name) === normalizeText(normalized.name)
    );
    if (duplicateByName) {
      recordActivity({
        action: 'Blocked',
        module: 'Invoice Settings',
        description: `Add invoice scheme blocked. Duplicate name: ${normalized.name}`,
      });
      return failResult(409, `Invoice scheme "${normalized.name}" already exists.`);
    }
    if (isRemovedInvoiceScheme(normalized)) {
      recordActivity({
        action: 'Blocked',
        module: 'Invoice Settings',
        description: `Add invoice scheme blocked. Deprecated scheme: ${normalized.name}`,
      });
      return failResult(400, 'This invoice scheme is deprecated and cannot be used.');
    }

    const saved = await syncRecordStrict('invoiceSchemes', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Invoice Settings',
        description: `Failed to add invoice scheme ${normalized.name} to Postgres (${saved.status || 0}).`,
      });
      return result;
    }
    setInvoiceSchemes(prev => {
      const withoutDuplicate = prev.filter(record => record.id !== normalized.id);
      const nextRecords = normalized.isDefault
        ? [...withoutDuplicate.map(record => ({ ...record, isDefault: false })), { ...normalized, isDefault: true }]
        : [...withoutDuplicate, normalized];
      return normalizeInvoiceSchemes(nextRecords);
    });
    recordActivity({
      action: 'Created',
      module: 'Invoice Settings',
      description: `Added invoice scheme: ${normalized.name}`,
    });
    return result;
  };

  const updateInvoiceScheme = async (scheme: InvoiceScheme): Promise<CrudMutationResult> => {
    const existing = invoiceSchemes.find(record => record.id === scheme.id);
    if (!existing) {
      recordActivity({
        action: 'Blocked',
        module: 'Invoice Settings',
        description: `Update invoice scheme blocked. Scheme not found: ${scheme.id}`,
      });
      return failResult(404, 'Invoice scheme not found.');
    }
    const normalized = normalizeInvoiceSchemeRecord(scheme);
    if (!normalized.name) {
      recordActivity({
        action: 'Blocked',
        module: 'Invoice Settings',
        description: `Update invoice scheme blocked. Name is required: ${scheme.id}`,
      });
      return failResult(400, 'Invoice scheme name is required.');
    }
    const duplicateByName = invoiceSchemes.some(record =>
      record.id !== normalized.id &&
      normalizeText(record.name) === normalizeText(normalized.name)
    );
    if (duplicateByName) {
      recordActivity({
        action: 'Blocked',
        module: 'Invoice Settings',
        description: `Update invoice scheme blocked. Duplicate name: ${normalized.name}`,
      });
      return failResult(409, `Invoice scheme "${normalized.name}" already exists.`);
    }
    if (isRemovedInvoiceScheme(normalized)) {
      recordActivity({
        action: 'Blocked',
        module: 'Invoice Settings',
        description: `Update invoice scheme blocked. Deprecated scheme: ${normalized.name}`,
      });
      return failResult(400, 'This invoice scheme is deprecated and cannot be used.');
    }

    const saved = await syncRecordStrict('invoiceSchemes', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Invoice Settings',
        description: `Failed to update invoice scheme ${normalized.name} in Postgres (${saved.status || 0}).`,
      });
      return result;
    }

    const oldName = String(existing.name || '').trim();
    const newName = String(normalized.name || '').trim();
    const renamed = oldName && newName && normalizeText(oldName) !== normalizeText(newName);
    const persistedLocations = new Map<string, Location>();
    const persistedSales = new Map<string, Sale>();

    if (renamed) {
      const affectedLocations = locations
        .filter(location => normalizeText(location.invoiceScheme) === normalizeText(oldName))
        .map(location => ({ ...location, invoiceScheme: newName }));
      for (const location of affectedLocations) {
        const locationSaved = await syncRecordStrict('locations', location);
        if (!locationSaved.ok) {
          recordActivity({
            action: 'Blocked',
            module: 'Invoice Settings',
            description: `Failed to sync linked location ${location.name || location.id} after scheme rename (${locationSaved.status || 0}).`,
          });
          continue;
        }
        persistedLocations.set(location.id, location);
      }

      const affectedSales = sales
        .filter(sale => normalizeText(sale.invoiceScheme) === normalizeText(oldName))
        .map(sale => ({ ...sale, invoiceScheme: newName }));
      for (const sale of affectedSales) {
        const saleSaved = await syncRecordStrict('sales', sale);
        if (!saleSaved.ok) {
          recordActivity({
            action: 'Blocked',
            module: 'Invoice Settings',
            description: `Failed to sync linked sale ${sale.invoiceNo || sale.id} after scheme rename (${saleSaved.status || 0}).`,
          });
          continue;
        }
        persistedSales.set(sale.id, sale);
      }
    }

    setInvoiceSchemes(prev => {
      const mapped = prev.map(record => record.id === normalized.id ? normalized : record);
      const withExclusiveDefault = normalized.isDefault
        ? mapped.map(record => (
          record.id === normalized.id
            ? { ...record, isDefault: true }
            : { ...record, isDefault: false }
        ))
        : mapped;
      return normalizeInvoiceSchemes(withExclusiveDefault);
    });
    if (persistedLocations.size > 0) {
      setLocations(prev => prev.map(location => persistedLocations.get(location.id) || location));
    }
    if (persistedSales.size > 0) {
      setSales(prev => prev.map(sale => persistedSales.get(sale.id) || sale));
    }
    recordActivity({
      action: 'Updated',
      module: 'Invoice Settings',
      description: `Updated invoice scheme: ${normalized.name}`,
    });
    return result;
  };

  const deleteInvoiceScheme = async (id: string): Promise<LocationMutationResult> => {
    const existing = invoiceSchemes.find(record => record.id === id);
    if (!existing) {
      return {
        ok: false,
        success: false,
        status: 404,
        error: 'Invoice scheme not found.',
        message: 'Invoice scheme not found.',
      };
    }
    const usageByLocations = locations.filter(location =>
      normalizeText(location.invoiceScheme) === normalizeText(existing.name)
    ).length;
    const usageBySales = sales.filter(sale =>
      normalizeText(sale.invoiceScheme) === normalizeText(existing.name)
    ).length;
    if (usageByLocations > 0 || usageBySales > 0) {
      const parts: string[] = [];
      if (usageByLocations > 0) parts.push(`Locations (${usageByLocations})`);
      if (usageBySales > 0) parts.push(`Sales (${usageBySales})`);
      const message = `Invoice scheme "${existing.name}" is in use: ${parts.join(', ')}.`;
      recordActivity({
        action: 'Blocked',
        module: 'Invoice Settings',
        description: `Delete invoice scheme blocked for ${existing.name}: ${parts.join(', ')}`,
      });
      return {
        ok: false,
        success: false,
        status: 409,
        error: message,
        message,
      };
    }
    const result = await confirmDeleteFromPostgres('invoiceSchemes', id, 'Invoice Settings', existing.name, async () => {
      setInvoiceSchemes(prev => normalizeInvoiceSchemes(prev.filter(record => record.id !== id)));
      recordActivity({
        action: 'Deleted',
        module: 'Invoice Settings',
        description: `Deleted invoice scheme: ${existing.name}`,
      });
    });
    return toLocationResult(result, 'Failed to delete invoice scheme from database.');
  };

  const addInvoiceLayout = async (layout: InvoiceLayout): Promise<CrudMutationResult> => {
    const normalized = normalizeInvoiceLayoutRecord(layout);
    if (!normalized.name) {
      recordActivity({
        action: 'Blocked',
        module: 'Invoice Settings',
        description: 'Add invoice layout blocked. Name is required.',
      });
      return failResult(400, 'Invoice layout name is required.');
    }
    const duplicateByName = invoiceLayouts.some(record =>
      normalizeText(record.name) === normalizeText(normalized.name)
    );
    if (duplicateByName) {
      recordActivity({
        action: 'Blocked',
        module: 'Invoice Settings',
        description: `Add invoice layout blocked. Duplicate name: ${normalized.name}`,
      });
      return failResult(409, `Invoice layout "${normalized.name}" already exists.`);
    }
    if (isRemovedInvoiceLayout(normalized)) {
      recordActivity({
        action: 'Blocked',
        module: 'Invoice Settings',
        description: `Add invoice layout blocked. Deprecated layout: ${normalized.name}`,
      });
      return failResult(400, 'This invoice layout is deprecated and cannot be used.');
    }
    const saved = await syncRecordStrict('invoiceLayouts', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Invoice Settings',
        description: `Failed to add invoice layout ${normalized.name} to Postgres (${saved.status || 0}).`,
      });
      return result;
    }
    setInvoiceLayouts(prev => {
      const withoutDuplicate = prev.filter(record => record.id !== normalized.id);
      const nextRecords = normalized.isDefault
        ? [...withoutDuplicate.map(record => ({ ...record, isDefault: false })), { ...normalized, isDefault: true }]
        : [...withoutDuplicate, normalized];
      return normalizeInvoiceLayouts(nextRecords);
    });
    recordActivity({
      action: 'Created',
      module: 'Invoice Settings',
      description: `Added invoice layout: ${normalized.name}`,
    });
    return result;
  };

  const updateInvoiceLayout = async (layout: InvoiceLayout): Promise<CrudMutationResult> => {
    const existing = invoiceLayouts.find(record => record.id === layout.id);
    if (!existing) {
      recordActivity({
        action: 'Blocked',
        module: 'Invoice Settings',
        description: `Update invoice layout blocked. Layout not found: ${layout.id}`,
      });
      return failResult(404, 'Invoice layout not found.');
    }
    const normalized = normalizeInvoiceLayoutRecord(layout);
    if (!normalized.name) {
      recordActivity({
        action: 'Blocked',
        module: 'Invoice Settings',
        description: `Update invoice layout blocked. Name is required: ${layout.id}`,
      });
      return failResult(400, 'Invoice layout name is required.');
    }
    const duplicateByName = invoiceLayouts.some(record =>
      record.id !== normalized.id &&
      normalizeText(record.name) === normalizeText(normalized.name)
    );
    if (duplicateByName) {
      recordActivity({
        action: 'Blocked',
        module: 'Invoice Settings',
        description: `Update invoice layout blocked. Duplicate name: ${normalized.name}`,
      });
      return failResult(409, `Invoice layout "${normalized.name}" already exists.`);
    }
    if (isRemovedInvoiceLayout(normalized)) {
      recordActivity({
        action: 'Blocked',
        module: 'Invoice Settings',
        description: `Update invoice layout blocked. Deprecated layout: ${normalized.name}`,
      });
      return failResult(400, 'This invoice layout is deprecated and cannot be used.');
    }
    const saved = await syncRecordStrict('invoiceLayouts', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Invoice Settings',
        description: `Failed to update invoice layout ${normalized.name} in Postgres (${saved.status || 0}).`,
      });
      return result;
    }
    const oldName = String(existing.name || '').trim();
    const newName = String(normalized.name || '').trim();
    const renamed = oldName && newName && normalizeText(oldName) !== normalizeText(newName);
    const persistedLocations = new Map<string, Location>();
    const persistedSales = new Map<string, Sale>();

    if (renamed) {
      const affectedLocations = locations
        .filter(location => (
          normalizeText(location.invoiceLayoutPos) === normalizeText(oldName) ||
          normalizeText(location.invoiceLayoutSale) === normalizeText(oldName)
        ))
        .map(location => {
          const matchedPos = normalizeText(location.invoiceLayoutPos) === normalizeText(oldName);
          const matchedSale = normalizeText(location.invoiceLayoutSale) === normalizeText(oldName);
          return {
            ...location,
            invoiceLayoutPos: matchedPos ? newName : location.invoiceLayoutPos,
            invoiceLayoutSale: matchedSale ? newName : location.invoiceLayoutSale,
          };
        });
      for (const location of affectedLocations) {
        const locationSaved = await syncRecordStrict('locations', location);
        if (!locationSaved.ok) {
          recordActivity({
            action: 'Blocked',
            module: 'Invoice Settings',
            description: `Failed to sync linked location ${location.name || location.id} after layout rename (${locationSaved.status || 0}).`,
          });
          continue;
        }
        persistedLocations.set(location.id, location);
      }

      const affectedSales = sales
        .filter(sale => normalizeText(sale.invoiceLayout) === normalizeText(oldName))
        .map(sale => ({ ...sale, invoiceLayout: newName }));
      for (const sale of affectedSales) {
        const saleSaved = await syncRecordStrict('sales', sale);
        if (!saleSaved.ok) {
          recordActivity({
            action: 'Blocked',
            module: 'Invoice Settings',
            description: `Failed to sync linked sale ${sale.invoiceNo || sale.id} after layout rename (${saleSaved.status || 0}).`,
          });
          continue;
        }
        persistedSales.set(sale.id, sale);
      }
    }

    setInvoiceLayouts(prev => {
      const mapped = prev.map(record => record.id === normalized.id ? normalized : record);
      const withExclusiveDefault = normalized.isDefault
        ? mapped.map(record => (
          record.id === normalized.id
            ? { ...record, isDefault: true }
            : { ...record, isDefault: false }
        ))
        : mapped;
      return normalizeInvoiceLayouts(withExclusiveDefault);
    });
    if (persistedLocations.size > 0) {
      setLocations(prev => prev.map(location => persistedLocations.get(location.id) || location));
    }
    if (persistedSales.size > 0) {
      setSales(prev => prev.map(sale => persistedSales.get(sale.id) || sale));
    }
    recordActivity({
      action: 'Updated',
      module: 'Invoice Settings',
      description: `Updated invoice layout: ${normalized.name}`,
    });
    return result;
  };

  const deleteInvoiceLayout = async (id: string): Promise<LocationMutationResult> => {
    const existing = invoiceLayouts.find(record => record.id === id);
    if (!existing) {
      return {
        ok: false,
        success: false,
        status: 404,
        error: 'Invoice layout not found.',
        message: 'Invoice layout not found.',
      };
    }
    const usageByLocations = locations.filter(location =>
      normalizeText(location.invoiceLayoutPos) === normalizeText(existing.name) ||
      normalizeText(location.invoiceLayoutSale) === normalizeText(existing.name)
    ).length;
    const usageBySales = sales.filter(sale =>
      normalizeText(sale.invoiceLayout) === normalizeText(existing.name)
    ).length;
    if (usageByLocations > 0 || usageBySales > 0) {
      const parts: string[] = [];
      if (usageByLocations > 0) parts.push(`Locations (${usageByLocations})`);
      if (usageBySales > 0) parts.push(`Sales (${usageBySales})`);
      const message = `Invoice layout "${existing.name}" is in use: ${parts.join(', ')}.`;
      recordActivity({
        action: 'Blocked',
        module: 'Invoice Settings',
        description: `Delete invoice layout blocked for ${existing.name}: ${parts.join(', ')}`,
      });
      return {
        ok: false,
        success: false,
        status: 409,
        error: message,
        message,
      };
    }
    const result = await confirmDeleteFromPostgres('invoiceLayouts', id, 'Invoice Settings', existing.name, async () => {
      setInvoiceLayouts(prev => normalizeInvoiceLayouts(prev.filter(record => record.id !== id)));
      recordActivity({
        action: 'Deleted',
        module: 'Invoice Settings',
        description: `Deleted invoice layout: ${existing.name}`,
      });
    });
    return toLocationResult(result, 'Failed to delete invoice layout from database.');
  };

  // ============================================================
  //  CRUD: BARCODE SETTINGS
  // ============================================================

  const addBarcodeSetting = async (setting: BarcodeStickerSetting): Promise<CrudMutationResult> => {
    const normalized = normalizeBarcodeSettingRecord(setting);
    if (!normalized.name) {
      recordActivity({
        action: 'Blocked',
        module: 'Barcode Settings',
        description: 'Add barcode setting blocked. Name is required.',
      });
      return failResult(400, 'Barcode setting name is required.');
    }
    const duplicateByName = barcodeSettings.some(record =>
      normalizeText(record.name) === normalizeText(normalized.name)
    );
    if (duplicateByName) {
      recordActivity({
        action: 'Blocked',
        module: 'Barcode Settings',
        description: `Add barcode setting blocked. Duplicate name: ${normalized.name}`,
      });
      return failResult(409, `Barcode setting "${normalized.name}" already exists.`);
    }

    const saved = await syncRecordStrict('barcodeSettings', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Barcode Settings',
        description: `Failed to add barcode setting ${normalized.name} to Postgres (${saved.status || 0}).`,
      });
      return result;
    }
    setBarcodeSettings(prev => {
      const withoutDuplicate = prev.filter(record => record.id !== normalized.id);
      if (normalized.isDefault) {
        return normalizeBarcodeSettings([
          ...withoutDuplicate.map(record => ({ ...record, isDefault: false })),
          { ...normalized, isDefault: true },
        ]);
      }
      return normalizeBarcodeSettings([...withoutDuplicate, normalized]);
    });
    recordActivity({
      action: 'Created',
      module: 'Barcode Settings',
      description: `Added barcode setting: ${normalized.name}`,
    });
    return result;
  };

  const updateBarcodeSetting = async (setting: BarcodeStickerSetting): Promise<CrudMutationResult> => {
    const existing = barcodeSettings.find(record => record.id === setting.id);
    if (!existing) {
      recordActivity({
        action: 'Blocked',
        module: 'Barcode Settings',
        description: `Update barcode setting blocked. Setting not found: ${setting.id}`,
      });
      return failResult(404, 'Barcode setting not found.');
    }
    const normalized = normalizeBarcodeSettingRecord(setting, existing);
    if (!normalized.name) {
      recordActivity({
        action: 'Blocked',
        module: 'Barcode Settings',
        description: `Update barcode setting blocked. Name is required: ${setting.id}`,
      });
      return failResult(400, 'Barcode setting name is required.');
    }
    const duplicateByName = barcodeSettings.some(record =>
      record.id !== normalized.id &&
      normalizeText(record.name) === normalizeText(normalized.name)
    );
    if (duplicateByName) {
      recordActivity({
        action: 'Blocked',
        module: 'Barcode Settings',
        description: `Update barcode setting blocked. Duplicate name: ${normalized.name}`,
      });
      return failResult(409, `Barcode setting "${normalized.name}" already exists.`);
    }
    const saved = await syncRecordStrict('barcodeSettings', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Barcode Settings',
        description: `Failed to update barcode setting ${normalized.name} in Postgres (${saved.status || 0}).`,
      });
      return result;
    }
    setBarcodeSettings(prev => {
      const nextRecords = prev.map(record => (
        record.id === normalized.id
          ? normalized
          : normalized.isDefault
            ? { ...record, isDefault: false }
            : record
      ));
      return normalizeBarcodeSettings(nextRecords);
    });
    recordActivity({
      action: 'Updated',
      module: 'Barcode Settings',
      description: `Updated barcode setting: ${normalized.name}`,
    });
    return result;
  };

  const deleteBarcodeSetting = async (id: string): Promise<LocationMutationResult> => {
    const existing = barcodeSettings.find(record => record.id === id);
    if (!existing) {
      return {
        ok: false,
        success: false,
        status: 404,
        error: 'Barcode setting not found.',
        message: 'Barcode setting not found.',
      };
    }
    if (barcodeSettings.length <= 1) {
      const message = 'At least one barcode setting must remain.';
      recordActivity({
        action: 'Blocked',
        module: 'Barcode Settings',
        description: `Delete barcode setting blocked for ${existing.name}: minimum one setting required.`,
      });
      return {
        ok: false,
        success: false,
        status: 409,
        error: message,
        message,
      };
    }
    const result = await confirmDeleteFromPostgres('barcodeSettings', id, 'Barcode Settings', existing.name, async () => {
      setBarcodeSettings(prev => normalizeBarcodeSettings(prev.filter(record => record.id !== id)));
      recordActivity({
        action: 'Deleted',
        module: 'Barcode Settings',
        description: `Deleted barcode setting: ${existing.name}`,
      });
    });
    return toLocationResult(result, 'Failed to delete barcode setting from database.');
  };

  // ============================================================
  //  CRUD: TAX RATES
  // ============================================================

  const addTaxRate = async (tax: TaxRate): Promise<CrudMutationResult> => {
    const normalized = normalizeTaxRateRecord(tax, initialTaxRates[0], taxRates.length);
    const duplicateByName = taxRates.some(existing => (
      existing.name.trim().toLowerCase() === normalized.name.trim().toLowerCase()
    ));
    if (duplicateByName) {
      recordActivity({
        action: 'Blocked',
        module: 'Tax Rates',
        description: `Add tax rate blocked. Duplicate name: ${normalized.name}`,
      });
      return failResult(409, `Tax rate "${normalized.name}" already exists.`);
    }
    const saved = await syncRecordStrict('taxRates', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Tax Rates',
        description: `Failed to add tax rate ${normalized.name} to Postgres (${saved.status || 0}).`,
      });
      return result;
    }
    setTaxRates(prev => normalizeTaxRates([...prev, normalized]));
    recordActivity({
      action: 'Added',
      module: 'Tax Rates',
      description: `Added tax rate: ${normalized.name} (${normalized.rate}%)`,
    });
    return result;
  };

  const updateTaxRate = async (tax: TaxRate): Promise<CrudMutationResult> => {
    const existing = taxRates.find(record => record.id === tax.id);
    if (!existing) return failResult(404, 'Tax rate not found.');
    const normalized = normalizeTaxRateRecord(tax, existing);
    const duplicateByName = taxRates.some(record => (
      record.id !== normalized.id &&
      record.name.trim().toLowerCase() === normalized.name.trim().toLowerCase()
    ));
    if (duplicateByName) {
      recordActivity({
        action: 'Blocked',
        module: 'Tax Rates',
        description: `Update tax rate blocked. Duplicate name: ${normalized.name}`,
      });
      return failResult(409, `Tax rate "${normalized.name}" already exists.`);
    }
    const saved = await syncRecordStrict('taxRates', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Tax Rates',
        description: `Failed to update tax rate ${normalized.name} in Postgres (${saved.status || 0}).`,
      });
      return result;
    }
    setTaxRates(prev => normalizeTaxRates(prev.map(record => record.id === normalized.id ? normalized : record)));
    recordActivity({
      action: 'Updated',
      module: 'Tax Rates',
      description: `Updated tax rate: ${normalized.name} (${normalized.rate}%)`,
    });
    return result;
  };

  const deleteTaxRate = async (id: string): Promise<CrudMutationResult> => {
    const existing = taxRates.find(record => record.id === id);
    if (!existing) return failResult(404, 'Tax rate not found.');
    if (taxRates.length <= 1) {
      recordActivity({
        action: 'Blocked',
        module: 'Tax Rates',
        description: `Delete tax rate blocked for ${existing.name}: minimum one tax rate required.`,
      });
      return failResult(409, 'At least one tax rate must remain.');
    }
    return confirmDeleteFromPostgres('taxRates', id, 'Tax Rates', existing.name, async () => {
      setTaxRates(prev => normalizeTaxRates(prev.filter(record => record.id !== id)));
      recordActivity({
        action: 'Deleted',
        module: 'Tax Rates',
        description: `Deleted tax rate: ${existing.name}`,
      });
    });
  };

  // ============================================================
  //  CRUD: CUSTOMER GROUPS
  // ============================================================

  const deriveMirroredSellingPriceGroupId = (customerGroupId: string): string => {
    const normalized = String(customerGroupId || '')
      .trim()
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    return `SPG-${normalized || 'CUSTOMER-GROUP'}`;
  };

  const mergeSellingPriceGroupList = (
    source: SellingPriceGroup[],
    incoming: SellingPriceGroup,
  ): SellingPriceGroup[] => {
    const existingIndex = source.findIndex((row) => row.id === incoming.id);
    if (existingIndex < 0) return [...source, incoming];
    const next = [...source];
    next[existingIndex] = incoming;
    return next;
  };

  const buildMirroredSellingPriceGroup = (
    group: CustomerGroup,
    existing?: SellingPriceGroup,
  ): SellingPriceGroup => {
    const normalizedName = String(group.name || '').trim() || String(existing?.name || '').trim() || 'Customer Group';
    const status = group.status === 'Inactive'
      ? 'Inactive'
      : existing?.status === 'Inactive'
        ? 'Inactive'
        : 'Active';
    const parsedGroupDiscount = Number(group.discountPercent);
    const parsedGroupCalculation = Number(group.calculationPercentage);
    const discount = Number.isFinite(parsedGroupDiscount)
      ? parsedGroupDiscount
      : Number(existing?.discount || 0);
    const priceCalcPercentage = Number.isFinite(parsedGroupCalculation)
      ? parsedGroupCalculation
      : Number.isFinite(Number(existing?.priceCalcPercentage))
        ? Number(existing?.priceCalcPercentage)
        : discount;
    const parsedPayTermDays = Number(existing?.payTermDays);
    const payTermDays = Number.isFinite(parsedPayTermDays) ? parsedPayTermDays : 0;
    const parsedTaxRate = Number(existing?.taxRate);
    const taxRate = Number.isFinite(parsedTaxRate) ? parsedTaxRate : 0;
    const mirrorId = String(existing?.id || group.sellingPriceGroupId || '').trim() || deriveMirroredSellingPriceGroupId(group.id);
    const applicableProducts = existing
      ? getSellingPriceGroupProductRules(existing)
        .map((rule, index) => normalizeSellingPriceGroupProductRule(rule, index))
        .filter((rule): rule is SellingPriceGroupProduct => !!rule)
      : [];

    return {
      id: mirrorId,
      name: normalizedName,
      description: String(group.description || existing?.description || '').trim(),
      payTermDays,
      payTermUnit: existing?.payTermUnit === 'Months' ? 'Months' : 'Days',
      taxRate,
      discount,
      priceCalcPercentage,
      status,
      applicableProducts,
    };
  };

  const ensureMirroredSellingPriceGroup = async (
    group: CustomerGroup,
    sourceSellingGroups: SellingPriceGroup[],
  ): Promise<{ result: CrudMutationResult; mirror?: SellingPriceGroup }> => {
    const normalizedGroupName = normalizeText(group.name);
    const derivedMirrorId = deriveMirroredSellingPriceGroupId(group.id);
    const existing = (
      sourceSellingGroups.find((row) => row.id === group.sellingPriceGroupId)
      || sourceSellingGroups.find((row) => row.id === derivedMirrorId)
      || sourceSellingGroups.find((row) => normalizeText(row.name) === normalizedGroupName)
    );
    const mirror = buildMirroredSellingPriceGroup(group, existing);
    const saved = await syncRecordStrict('sellingPriceGroups', mirror);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Selling Price Groups',
        description: `Failed to sync mirrored selling price group for customer group ${group.name || group.id} (${saved.status || 0}).`,
      });
      return { result };
    }
    return { result, mirror };
  };

  const shouldUseMirroredSellingPriceGroup = (group: CustomerGroup): boolean => {
    const linkedId = String(group.sellingPriceGroupId || '').trim();
    const linkedName = normalizeText(group.sellingPriceGroup);
    const normalizedGroupName = normalizeText(group.name);
    const derivedMirrorId = deriveMirroredSellingPriceGroupId(group.id);
    if (!linkedId && !linkedName) return true;
    if (linkedId && linkedId === derivedMirrorId) return true;
    if (!linkedId && linkedName && linkedName === normalizedGroupName) return true;
    return false;
  };

  const syncLinkedCustomersForCustomerGroupUpdate = async (
    existingGroup: CustomerGroup | undefined,
    normalizedGroup: CustomerGroup,
  ): Promise<Map<string, Customer>> => {
    const linkedCustomers = customers.filter((customer) => {
      const linkedById = customer.customerGroupId === normalizedGroup.id;
      const linkedByLegacyName = !customer.customerGroupId &&
        !!existingGroup &&
        normalizeText(customer.customerGroup) === normalizeText(existingGroup.name);
      return linkedById || linkedByLegacyName;
    });
    const persistedById = new Map<string, Customer>();
    for (const customer of linkedCustomers) {
      const updatedCustomer: Customer = {
        ...customer,
        customerGroupId: normalizedGroup.id,
        customerGroup: normalizedGroup.name,
      };
      const customerSaved = await syncRecordStrict('customers', updatedCustomer);
      if (!customerSaved.ok) {
        recordActivity({
          action: 'Blocked',
          module: 'Customer Groups',
          description: `Failed to sync linked customer ${updatedCustomer.businessName || updatedCustomer.name || updatedCustomer.id} after group update (${customerSaved.status || 0}).`,
        });
        continue;
      }
      persistedById.set(updatedCustomer.id, updatedCustomer);
    }
    return persistedById;
  };

  const addCustomerGroup = async (group: CustomerGroup): Promise<CrudMutationResult> => {
    const normalizedGroupBase = normalizeCustomerGroupRecord(group, sellingPriceGroups);
    if (!shouldUseMirroredSellingPriceGroup(normalizedGroupBase)) {
      const saved = await syncRecordStrict('customerGroups', normalizedGroupBase);
      const result = toCrudResult(saved);
      if (!result.ok) return result;
      setCustomerGroups(prev => [...prev, normalizedGroupBase]);
      return result;
    }
    const mirrorOutcome = await ensureMirroredSellingPriceGroup(normalizedGroupBase, sellingPriceGroups);
    if (!mirrorOutcome.result.ok || !mirrorOutcome.mirror) return mirrorOutcome.result;
    const mirror = mirrorOutcome.mirror;
    const nextSellingPriceGroups = mergeSellingPriceGroupList(sellingPriceGroups, mirror);
    const normalizedGroup = normalizeCustomerGroupRecord({
      ...normalizedGroupBase,
      sellingPriceGroupId: mirror.id,
      sellingPriceGroup: mirror.name,
    }, nextSellingPriceGroups);
    const saved = await syncRecordStrict('customerGroups', normalizedGroup);
    const result = toCrudResult(saved);
    if (!result.ok) return result;
    setSellingPriceGroups((prev) => mergeSellingPriceGroupList(prev, mirror));
    setCustomerGroups(prev => [...prev, normalizedGroup]);
    return result;
  };
  const updateCustomerGroup = async (group: CustomerGroup): Promise<CrudMutationResult> => {
    const existingGroup = customerGroups.find(g => g.id === group.id);
    const normalizedGroupBase = normalizeCustomerGroupRecord(group, sellingPriceGroups);
    if (!shouldUseMirroredSellingPriceGroup(normalizedGroupBase)) {
      const saved = await syncRecordStrict('customerGroups', normalizedGroupBase);
      const result = toCrudResult(saved);
      if (!result.ok) return result;
      const persistedById = await syncLinkedCustomersForCustomerGroupUpdate(existingGroup, normalizedGroupBase);
      setCustomerGroups(prev => prev.map(g => g.id === group.id ? normalizedGroupBase : g));
      if (persistedById.size > 0) {
        setCustomers(prev => prev.map(customer => persistedById.get(customer.id) || customer));
      }
      return result;
    }
    const mirrorOutcome = await ensureMirroredSellingPriceGroup(normalizedGroupBase, sellingPriceGroups);
    if (!mirrorOutcome.result.ok || !mirrorOutcome.mirror) return mirrorOutcome.result;
    const mirror = mirrorOutcome.mirror;
    const nextSellingPriceGroups = mergeSellingPriceGroupList(sellingPriceGroups, mirror);
    const normalizedGroup = normalizeCustomerGroupRecord({
      ...normalizedGroupBase,
      sellingPriceGroupId: mirror.id,
      sellingPriceGroup: mirror.name,
    }, nextSellingPriceGroups);
    const saved = await syncRecordStrict('customerGroups', normalizedGroup);
    const result = toCrudResult(saved);
    if (!result.ok) return result;
    const persistedById = await syncLinkedCustomersForCustomerGroupUpdate(existingGroup, normalizedGroup);
    setSellingPriceGroups((prev) => mergeSellingPriceGroupList(prev, mirror));
    setCustomerGroups(prev => prev.map(g => g.id === group.id ? normalizedGroup : g));
    if (persistedById.size > 0) {
      setCustomers(prev => prev.map(customer => persistedById.get(customer.id) || customer));
    }
    return result;
  };
  const deleteCustomerGroup = async (id: string, reassignToGroupId?: string): Promise<CrudMutationResult> => {
    const existingGroup = customerGroups.find(g => g.id === id);
    const reassignGroup = reassignToGroupId
      ? customerGroups.find(g => g.id === reassignToGroupId)
      : undefined;
    const mirrorGroup = existingGroup && shouldUseMirroredSellingPriceGroup(existingGroup)
      ? (
          sellingPriceGroups.find((row) => row.id === existingGroup.sellingPriceGroupId)
          || sellingPriceGroups.find((row) => normalizeText(row.name) === normalizeText(existingGroup.name))
        )
      : undefined;
    return confirmDeleteFromPostgres('customerGroups', id, 'Customer Groups', existingGroup?.name || id, async () => {
      setCustomerGroups(prev => prev.filter(g => g.id !== id));
      const linkedCustomers = customers.filter((customer) => {
        const linkedById = customer.customerGroupId === id;
        const linkedByLegacyName = !customer.customerGroupId &&
          !!existingGroup &&
          normalizeText(customer.customerGroup) === normalizeText(existingGroup.name);
        return linkedById || linkedByLegacyName;
      });
      const persistedById = new Map<string, Customer>();
      for (const customer of linkedCustomers) {
        const updatedCustomer: Customer = (reassignGroup && reassignGroup.id !== id)
          ? {
              ...customer,
              customerGroupId: reassignGroup.id,
              customerGroup: reassignGroup.name,
            }
          : {
              ...customer,
              customerGroupId: '',
              customerGroup: '',
            };
        const customerSaved = await syncRecordStrict('customers', updatedCustomer);
        if (!customerSaved.ok) {
          recordActivity({
            action: 'Blocked',
            module: 'Customer Groups',
            description: `Failed to sync linked customer ${updatedCustomer.businessName || updatedCustomer.name || updatedCustomer.id} after group delete (${customerSaved.status || 0}).`,
          });
          continue;
        }
        persistedById.set(updatedCustomer.id, updatedCustomer);
      }
      if (persistedById.size > 0) {
        setCustomers(prev => prev.map(customer => persistedById.get(customer.id) || customer));
      }

      if (mirrorGroup) {
        const stillLinkedElsewhere = customerGroups.some((group) => (
          group.id !== id && (
            group.sellingPriceGroupId === mirrorGroup.id
            || normalizeText(group.sellingPriceGroup) === normalizeText(mirrorGroup.name)
            || normalizeText(group.name) === normalizeText(mirrorGroup.name)
          )
        ));
        if (!stillLinkedElsewhere) {
          const mirrorDeleted = await deleteRecordStrict('sellingPriceGroups', mirrorGroup.id);
          if (mirrorDeleted.ok || mirrorDeleted.status === 404) {
            setSellingPriceGroups((prev) => prev.filter((row) => row.id !== mirrorGroup.id));
          } else {
            recordActivity({
              action: 'Blocked',
              module: 'Selling Price Groups',
              description: `Failed to delete mirrored selling price group ${mirrorGroup.name || mirrorGroup.id} after customer group delete (${mirrorDeleted.status || 0}).`,
            });
          }
        }
      }
    });
  };

  // ============================================================
  //  CRUD: PRODUCT CATEGORIES
  // ============================================================

  const addProductCategory = async (cat: ProductCategory): Promise<CrudMutationResult> => {
    const normalizedCategory: ProductCategory = {
      ...cat,
      name: String(cat.name || '').trim() || 'Uncategorized',
      code: String(cat.code || '').trim(),
      description: String(cat.description || '').trim(),
    };
    const saved = await syncRecordStrict('productCategories', normalizedCategory);
    const result = toCrudResult(saved);
    if (!result.ok) return result;
    const productsToLink = products.filter((product) => (
      !product.categoryId &&
      normalizeText(product.category) === normalizeText(normalizedCategory.name)
    ));
    const persistedProducts = new Map<string, Product>();
    for (const product of productsToLink) {
      const updatedProduct: Product = {
        ...product,
        categoryId: normalizedCategory.id,
        category: normalizedCategory.name,
      };
      const productSaved = await syncRecordStrict('products', updatedProduct);
      if (!productSaved.ok) {
        recordActivity({
          action: 'Blocked',
          module: 'Product Categories',
          description: `Failed to sync linked product ${updatedProduct.name || updatedProduct.sku || updatedProduct.id} after category add (${productSaved.status || 0}).`,
        });
        continue;
      }
      persistedProducts.set(updatedProduct.id, updatedProduct);
    }
    setProductCategories(prev => [...prev, normalizedCategory]);
    if (persistedProducts.size > 0) {
      setProducts(prev => prev.map(product => persistedProducts.get(product.id) || product));
    }
    return result;
  };
  const updateProductCategory = async (cat: ProductCategory): Promise<CrudMutationResult> => {
    const existingCategory = productCategories.find(category => category.id === cat.id);
    const normalizedCategory: ProductCategory = {
      ...cat,
      name: String(cat.name || '').trim() || 'Uncategorized',
      code: String(cat.code || '').trim(),
      description: String(cat.description || '').trim(),
    };
    const saved = await syncRecordStrict('productCategories', normalizedCategory);
    const result = toCrudResult(saved);
    if (!result.ok) return result;
    const productsToLink = products.filter((product) => {
      const linkedById = product.categoryId === normalizedCategory.id;
      const linkedByLegacyName = !product.categoryId &&
        !!existingCategory &&
        normalizeText(product.category) === normalizeText(existingCategory.name);
      return linkedById || linkedByLegacyName;
    });
    const persistedProducts = new Map<string, Product>();
    for (const product of productsToLink) {
      const updatedProduct: Product = {
        ...product,
        categoryId: normalizedCategory.id,
        category: normalizedCategory.name,
      };
      const productSaved = await syncRecordStrict('products', updatedProduct);
      if (!productSaved.ok) {
        recordActivity({
          action: 'Blocked',
          module: 'Product Categories',
          description: `Failed to sync linked product ${updatedProduct.name || updatedProduct.sku || updatedProduct.id} after category update (${productSaved.status || 0}).`,
        });
        continue;
      }
      persistedProducts.set(updatedProduct.id, updatedProduct);
    }
    setProductCategories(prev => prev.map(category => category.id === cat.id ? normalizedCategory : category));
    if (persistedProducts.size > 0) {
      setProducts(prev => prev.map(product => persistedProducts.get(product.id) || product));
    }
    return result;
  };
  const deleteProductCategory = async (id: string, reassignToCategoryId?: string): Promise<CrudMutationResult> => {
    const existingCategory = productCategories.find(category => category.id === id);
    if (!existingCategory) return failResult(404, 'Product category not found.');

    const explicitReplacement = reassignToCategoryId
      ? productCategories.find(category => category.id === reassignToCategoryId && category.id !== id)
      : undefined;
    const fallbackUncategorized = productCategories.find(category =>
      category.id !== id &&
      normalizeText(category.name) === 'uncategorized'
    );
    const createdUncategorized: ProductCategory | null =
      explicitReplacement || fallbackUncategorized
        ? null
        : {
            id: generateId('CAT'),
            name: 'Uncategorized',
            code: '',
            description: 'System default category',
          };
    const replacementCategory = explicitReplacement || fallbackUncategorized || createdUncategorized;

    return confirmDeleteFromPostgres('productCategories', id, 'Product Categories', existingCategory.name || id, async () => {
      let ensuredReplacement = replacementCategory;
      if (createdUncategorized && !productCategories.some(category => normalizeText(category.name) === 'uncategorized')) {
        const createdSaved = await syncRecordStrict('productCategories', createdUncategorized);
        if (!createdSaved.ok) {
          recordActivity({
            action: 'Blocked',
            module: 'Product Categories',
            description: `Failed to create fallback category "Uncategorized" after delete (${createdSaved.status || 0}).`,
          });
          ensuredReplacement = fallbackUncategorized || explicitReplacement;
        }
      }

      setProductCategories(prev => {
        let next = prev;
        if (
          createdUncategorized &&
          ensuredReplacement?.id === createdUncategorized.id &&
          !prev.some(category => normalizeText(category.name) === 'uncategorized')
        ) {
          next = [...next, createdUncategorized];
        }
        return next.filter(category => category.id !== id);
      });

      if (!ensuredReplacement) return;
      const linkedProducts = products.filter((product) => {
        const linkedById = product.categoryId === id;
        const linkedByLegacyName = !product.categoryId &&
          normalizeText(product.category) === normalizeText(existingCategory.name);
        return linkedById || linkedByLegacyName;
      });
      const persistedProducts = new Map<string, Product>();
      for (const product of linkedProducts) {
        const updatedProduct: Product = {
          ...product,
          categoryId: ensuredReplacement.id,
          category: ensuredReplacement.name,
        };
        const productSaved = await syncRecordStrict('products', updatedProduct);
        if (!productSaved.ok) {
          recordActivity({
            action: 'Blocked',
            module: 'Product Categories',
            description: `Failed to sync linked product ${updatedProduct.name || updatedProduct.sku || updatedProduct.id} after category delete (${productSaved.status || 0}).`,
          });
          continue;
        }
        persistedProducts.set(updatedProduct.id, updatedProduct);
      }
      if (persistedProducts.size > 0) {
        setProducts(prev => prev.map(product => persistedProducts.get(product.id) || product));
      }
    });
  };

  // ============================================================
  //  CRUD: PRODUCT BRANDS
  // ============================================================

  const addProductBrand = async (brand: ProductBrand): Promise<CrudMutationResult> => {
    const normalizedBrand: ProductBrand = {
      ...brand,
      name: String(brand.name || '').trim() || '--',
      note: String(brand.note || '').trim(),
    };
    const saved = await syncRecordStrict('productBrands', normalizedBrand);
    const result = toCrudResult(saved);
    if (!result.ok) return result;
    const productsToLink = products.filter((product) => (
      !product.brandId &&
      normalizeText(product.brand) === normalizeText(normalizedBrand.name)
    ));
    const persistedProducts = new Map<string, Product>();
    for (const product of productsToLink) {
      const updatedProduct: Product = {
        ...product,
        brandId: normalizedBrand.id,
        brand: normalizedBrand.name,
      };
      const productSaved = await syncRecordStrict('products', updatedProduct);
      if (!productSaved.ok) {
        recordActivity({
          action: 'Blocked',
          module: 'Product Brands',
          description: `Failed to sync linked product ${updatedProduct.name || updatedProduct.sku || updatedProduct.id} after brand add (${productSaved.status || 0}).`,
        });
        continue;
      }
      persistedProducts.set(updatedProduct.id, updatedProduct);
    }
    setProductBrands(prev => [...prev, normalizedBrand]);
    if (persistedProducts.size > 0) {
      setProducts(prev => prev.map(product => persistedProducts.get(product.id) || product));
    }
    return result;
  };
  const updateProductBrand = async (brand: ProductBrand): Promise<CrudMutationResult> => {
    const existingBrand = productBrands.find(currentBrand => currentBrand.id === brand.id);
    const normalizedBrand: ProductBrand = {
      ...brand,
      name: String(brand.name || '').trim() || '--',
      note: String(brand.note || '').trim(),
    };
    const saved = await syncRecordStrict('productBrands', normalizedBrand);
    const result = toCrudResult(saved);
    if (!result.ok) return result;
    const productsToLink = products.filter((product) => {
      const linkedById = product.brandId === normalizedBrand.id;
      const linkedByLegacyName = !product.brandId &&
        !!existingBrand &&
        normalizeText(product.brand) === normalizeText(existingBrand.name);
      return linkedById || linkedByLegacyName;
    });
    const persistedProducts = new Map<string, Product>();
    for (const product of productsToLink) {
      const updatedProduct: Product = {
        ...product,
        brandId: normalizedBrand.id,
        brand: normalizedBrand.name,
      };
      const productSaved = await syncRecordStrict('products', updatedProduct);
      if (!productSaved.ok) {
        recordActivity({
          action: 'Blocked',
          module: 'Product Brands',
          description: `Failed to sync linked product ${updatedProduct.name || updatedProduct.sku || updatedProduct.id} after brand update (${productSaved.status || 0}).`,
        });
        continue;
      }
      persistedProducts.set(updatedProduct.id, updatedProduct);
    }
    setProductBrands(prev => prev.map(currentBrand => currentBrand.id === brand.id ? normalizedBrand : currentBrand));
    if (persistedProducts.size > 0) {
      setProducts(prev => prev.map(product => persistedProducts.get(product.id) || product));
    }
    return result;
  };
  const deleteProductBrand = async (id: string, reassignToBrandId?: string): Promise<CrudMutationResult> => {
    const existingBrand = productBrands.find(brand => brand.id === id);
    if (!existingBrand) return failResult(404, 'Product brand not found.');

    const explicitReplacement = reassignToBrandId
      ? productBrands.find(brand => brand.id === reassignToBrandId && brand.id !== id)
      : undefined;
    const fallbackUnknown = productBrands.find(brand =>
      brand.id !== id &&
      normalizeText(brand.name) === '--'
    );
    const createdUnknownBrand: ProductBrand | null =
      explicitReplacement || fallbackUnknown
        ? null
        : {
            id: generateId('BRD'),
            name: '--',
            note: 'System default brand',
          };
    const replacementBrand = explicitReplacement || fallbackUnknown || createdUnknownBrand;

    return confirmDeleteFromPostgres('productBrands', id, 'Product Brands', existingBrand.name || id, async () => {
      let ensuredReplacement = replacementBrand;
      if (createdUnknownBrand && !productBrands.some((brand) => normalizeText(brand.name) === '--')) {
        const createdSaved = await syncRecordStrict('productBrands', createdUnknownBrand);
        if (!createdSaved.ok) {
          recordActivity({
            action: 'Blocked',
            module: 'Product Brands',
            description: `Failed to create fallback brand "--" after delete (${createdSaved.status || 0}).`,
          });
          ensuredReplacement = fallbackUnknown || explicitReplacement;
        }
      }

      setProductBrands(prev => {
        let next = prev;
        if (
          createdUnknownBrand &&
          ensuredReplacement?.id === createdUnknownBrand.id &&
          !prev.some((brand) => normalizeText(brand.name) === '--')
        ) {
          next = [...next, createdUnknownBrand];
        }
        return next.filter(brand => brand.id !== id);
      });

      if (!ensuredReplacement) return;
      const linkedProducts = products.filter((product) => {
        const linkedById = product.brandId === id;
        const linkedByLegacyName = !product.brandId &&
          normalizeText(product.brand) === normalizeText(existingBrand.name);
        return linkedById || linkedByLegacyName;
      });
      const persistedProducts = new Map<string, Product>();
      for (const product of linkedProducts) {
        const updatedProduct: Product = {
          ...product,
          brandId: ensuredReplacement.id,
          brand: ensuredReplacement.name,
        };
        const productSaved = await syncRecordStrict('products', updatedProduct);
        if (!productSaved.ok) {
          recordActivity({
            action: 'Blocked',
            module: 'Product Brands',
            description: `Failed to sync linked product ${updatedProduct.name || updatedProduct.sku || updatedProduct.id} after brand delete (${productSaved.status || 0}).`,
          });
          continue;
        }
        persistedProducts.set(updatedProduct.id, updatedProduct);
      }
      if (persistedProducts.size > 0) {
        setProducts(prev => prev.map(product => persistedProducts.get(product.id) || product));
      }
    });
  };

  // ============================================================
  //  CRUD: PRODUCT UNITS
  // ============================================================

  const addProductUnit = async (unit: ProductUnit): Promise<CrudMutationResult> => {
    const saved = await syncRecordStrict('productUnits', unit);
    const result = toCrudResult(saved);
    if (!result.ok) return result;
    setProductUnits(prev => [...prev, unit]);
    return result;
  };
  const updateProductUnit = async (unit: ProductUnit): Promise<CrudMutationResult> => {
    const saved = await syncRecordStrict('productUnits', unit);
    const result = toCrudResult(saved);
    if (!result.ok) return result;
    setProductUnits(prev => prev.map(u => u.id === unit.id ? unit : u));
    return result;
  };
  const deleteProductUnit = async (id: string): Promise<CrudMutationResult> => {
    return confirmDeleteFromPostgres('productUnits', id, 'Product Units', id, async () => {
      setProductUnits(prev => prev.filter(u => u.id !== id));
    });
  };

  // ============================================================
  //  CRUD: PRODUCT WARRANTIES
  // ============================================================

  const addWarranty = async (warranty: ProductWarranty): Promise<CrudMutationResult> => {
    const parsedDuration = Number(warranty.duration);
    const normalizedWarranty: ProductWarranty = {
      ...warranty,
      name: String(warranty.name || '').trim(),
      description: String(warranty.description || '').trim(),
      duration: Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 1,
      durationUnit: warranty.durationUnit || 'Months',
    };
    const saved = await syncRecordStrict('productWarranties', normalizedWarranty);
    const result = toCrudResult(saved);
    if (!result.ok) return result;
    const productsToLink = products.filter((product) => {
      const linked = resolveProductWarrantyLink(product.warranty, [normalizedWarranty]);
      return Boolean(linked.id);
    });
    const persistedProducts = new Map<string, Product>();
    for (const product of productsToLink) {
      const updatedProduct: Product = { ...product, warranty: normalizedWarranty.id };
      const productSaved = await syncRecordStrict('products', updatedProduct);
      if (!productSaved.ok) {
        recordActivity({
          action: 'Blocked',
          module: 'Warranties',
          description: `Failed to sync linked product ${updatedProduct.name || updatedProduct.sku || updatedProduct.id} after warranty add (${productSaved.status || 0}).`,
        });
        continue;
      }
      persistedProducts.set(updatedProduct.id, updatedProduct);
    }
    setWarranties(prev => [...prev, normalizedWarranty]);
    if (persistedProducts.size > 0) {
      setProducts(prev => prev.map(product => persistedProducts.get(product.id) || product));
    }
    return result;
  };
  const updateWarranty = async (warranty: ProductWarranty): Promise<CrudMutationResult> => {
    const existingWarranty = warranties.find(currentWarranty => currentWarranty.id === warranty.id);
    const parsedDuration = Number(warranty.duration);
    const normalizedWarranty: ProductWarranty = {
      ...warranty,
      name: String(warranty.name || '').trim(),
      description: String(warranty.description || '').trim(),
      duration: Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 1,
      durationUnit: warranty.durationUnit || 'Months',
    };
    const saved = await syncRecordStrict('productWarranties', normalizedWarranty);
    const result = toCrudResult(saved);
    if (!result.ok) return result;
    const productsToLink = products.filter((product) => {
      const linkedById = product.warranty === normalizedWarranty.id;
      const linkedByLegacyName = !!existingWarranty &&
        normalizeText(product.warranty) === normalizeText(existingWarranty.name);
      return linkedById || linkedByLegacyName;
    });
    const persistedProducts = new Map<string, Product>();
    for (const product of productsToLink) {
      const updatedProduct: Product = {
        ...product,
        warranty: normalizedWarranty.id,
      };
      const productSaved = await syncRecordStrict('products', updatedProduct);
      if (!productSaved.ok) {
        recordActivity({
          action: 'Blocked',
          module: 'Warranties',
          description: `Failed to sync linked product ${updatedProduct.name || updatedProduct.sku || updatedProduct.id} after warranty update (${productSaved.status || 0}).`,
        });
        continue;
      }
      persistedProducts.set(updatedProduct.id, updatedProduct);
    }
    setWarranties(prev => prev.map(currentWarranty => currentWarranty.id === warranty.id ? normalizedWarranty : currentWarranty));
    if (persistedProducts.size > 0) {
      setProducts(prev => prev.map(product => persistedProducts.get(product.id) || product));
    }
    return result;
  };
  const deleteWarranty = async (id: string, reassignToWarrantyId?: string): Promise<CrudMutationResult> => {
    const existingWarranty = warranties.find(warranty => warranty.id === id);
    if (!existingWarranty) return failResult(404, 'Warranty not found.');

    const replacementWarranty = reassignToWarrantyId
      ? warranties.find(warranty => warranty.id === reassignToWarrantyId && warranty.id !== id)
      : undefined;

    return confirmDeleteFromPostgres('productWarranties', id, 'Product Warranties', existingWarranty.name || id, async () => {
      setWarranties(prev => prev.filter(warranty => warranty.id !== id));
      const linkedProducts = products.filter((product) => {
        const linkedById = product.warranty === id;
        const linkedByLegacyName = normalizeText(product.warranty) === normalizeText(existingWarranty.name);
        return linkedById || linkedByLegacyName;
      });
      const persistedProducts = new Map<string, Product>();
      for (const product of linkedProducts) {
        const updatedProduct: Product = {
          ...product,
          warranty: replacementWarranty?.id || undefined,
        };
        const productSaved = await syncRecordStrict('products', updatedProduct);
        if (!productSaved.ok) {
          recordActivity({
            action: 'Blocked',
            module: 'Warranties',
            description: `Failed to sync linked product ${updatedProduct.name || updatedProduct.sku || updatedProduct.id} after warranty delete (${productSaved.status || 0}).`,
          });
          continue;
        }
        persistedProducts.set(updatedProduct.id, updatedProduct);
      }
      if (persistedProducts.size > 0) {
        setProducts(prev => prev.map(product => persistedProducts.get(product.id) || product));
      }
    });
  };

  // ============================================================
  //  CRUD: SELLING PRICE GROUPS
  // ============================================================

  const addProductVariation = async (v: ProductVariation): Promise<CrudMutationResult> => {
    const saved = await syncRecordStrict('productVariations', v);
    const result = toCrudResult(saved);
    if (!result.ok) return result;
    setProductVariations(prev => [...prev, v]);
    return result;
  };
  const updateProductVariation = async (v: ProductVariation): Promise<CrudMutationResult> => {
    const saved = await syncRecordStrict('productVariations', v);
    const result = toCrudResult(saved);
    if (!result.ok) return result;
    setProductVariations(prev => prev.map(x => x.id === v.id ? v : x));
    return result;
  };
  const deleteProductVariation = async (id: string): Promise<CrudMutationResult> => {
    return confirmDeleteFromPostgres('productVariations', id, 'Product Variations', id, async () => {
      setProductVariations(prev => prev.filter(x => x.id !== id));
    });
  };

  const addSellingPriceGroup = async (group: SellingPriceGroup): Promise<CrudMutationResult> => {
    const normalizedGroup = normalizeSellingPriceGroupRecord(group);
    const saved = await syncRecordStrict('sellingPriceGroups', normalizedGroup);
    const result = toCrudResult(saved);
    if (!result.ok) return result;
    const groupsToLink = customerGroups.filter((customerGroup) => (
      !customerGroup.sellingPriceGroupId &&
      normalizeText(customerGroup.sellingPriceGroup) === normalizeText(normalizedGroup.name)
    ));
    const persistedGroups = new Map<string, CustomerGroup>();
    for (const customerGroup of groupsToLink) {
      const updatedGroup: CustomerGroup = {
        ...customerGroup,
        sellingPriceGroupId: normalizedGroup.id,
        sellingPriceGroup: normalizedGroup.name,
      };
      const groupSaved = await syncRecordStrict('customerGroups', updatedGroup);
      if (!groupSaved.ok) {
        recordActivity({
          action: 'Blocked',
          module: 'Selling Price Groups',
          description: `Failed to sync linked customer group ${updatedGroup.name || updatedGroup.id} after selling price group add (${groupSaved.status || 0}).`,
        });
        continue;
      }
      persistedGroups.set(updatedGroup.id, updatedGroup);
    }
    setSellingPriceGroups(prev => [...prev, normalizedGroup]);
    if (persistedGroups.size > 0) {
      setCustomerGroups(prev => prev.map(customerGroup => persistedGroups.get(customerGroup.id) || customerGroup));
    }
    return result;
  };
  const updateSellingPriceGroup = async (group: SellingPriceGroup): Promise<CrudMutationResult> => {
    const existing = sellingPriceGroups.find(g => g.id === group.id);
    const normalizedGroup = normalizeSellingPriceGroupRecord(group);
    const saved = await syncRecordStrict('sellingPriceGroups', normalizedGroup);
    const result = toCrudResult(saved);
    if (!result.ok) return result;
    const groupsToLink = customerGroups.filter((customerGroup) => {
      const linkedById = customerGroup.sellingPriceGroupId === normalizedGroup.id;
      const linkedByLegacyName = !customerGroup.sellingPriceGroupId &&
        !!existing &&
        normalizeText(customerGroup.sellingPriceGroup) === normalizeText(existing.name);
      return linkedById || linkedByLegacyName;
    });
    const persistedGroups = new Map<string, CustomerGroup>();
    for (const customerGroup of groupsToLink) {
      const updatedGroup: CustomerGroup = {
        ...customerGroup,
        sellingPriceGroupId: normalizedGroup.id,
        sellingPriceGroup: normalizedGroup.name,
      };
      const groupSaved = await syncRecordStrict('customerGroups', updatedGroup);
      if (!groupSaved.ok) {
        recordActivity({
          action: 'Blocked',
          module: 'Selling Price Groups',
          description: `Failed to sync linked customer group ${updatedGroup.name || updatedGroup.id} after selling price group update (${groupSaved.status || 0}).`,
        });
        continue;
      }
      persistedGroups.set(updatedGroup.id, updatedGroup);
    }
    setSellingPriceGroups(prev => prev.map(g => g.id === normalizedGroup.id ? normalizedGroup : g));
    if (persistedGroups.size > 0) {
      setCustomerGroups(prev => prev.map(customerGroup => persistedGroups.get(customerGroup.id) || customerGroup));
    }
    return result;
  };
  const deleteSellingPriceGroup = async (id: string): Promise<CrudMutationResult> => {
    const existing = sellingPriceGroups.find(g => g.id === id);
    return confirmDeleteFromPostgres('sellingPriceGroups', id, 'Selling Price Groups', existing?.name || id, async () => {
      setSellingPriceGroups(prev => prev.filter(g => g.id !== id));
      const groupsToLink = customerGroups.filter((customerGroup) => {
        const linkedById = customerGroup.sellingPriceGroupId === id;
        const linkedByLegacyName = !customerGroup.sellingPriceGroupId &&
          !!existing &&
          normalizeText(customerGroup.sellingPriceGroup) === normalizeText(existing.name);
        return linkedById || linkedByLegacyName;
      });
      const persistedGroups = new Map<string, CustomerGroup>();
      for (const customerGroup of groupsToLink) {
        const updatedGroup: CustomerGroup = {
          ...customerGroup,
          sellingPriceGroupId: '',
          sellingPriceGroup: '',
        };
        const groupSaved = await syncRecordStrict('customerGroups', updatedGroup);
        if (!groupSaved.ok) {
          recordActivity({
            action: 'Blocked',
            module: 'Selling Price Groups',
            description: `Failed to sync linked customer group ${updatedGroup.name || updatedGroup.id} after selling price group delete (${groupSaved.status || 0}).`,
          });
          continue;
        }
        persistedGroups.set(updatedGroup.id, updatedGroup);
      }
      if (persistedGroups.size > 0) {
        setCustomerGroups(prev => prev.map(customerGroup => persistedGroups.get(customerGroup.id) || customerGroup));
      }
    });
  };

  // ============================================================
  //  CRUD: DISCOUNTS
  // ============================================================

  const addDiscount = async (discount: Discount): Promise<CrudMutationResult> => {
    const normalized = normalizeDiscountRecord(discount);
    const saved = await syncRecordStrict('discounts', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Discounts',
        description: `Failed to add discount ${normalized.name || normalized.id} to Postgres (${saved.status || 0}).`,
      });
      return result;
    }
    setDiscounts(prev => [...prev, normalized]);
    recordActivity({
      action: 'Created',
      module: 'Discounts',
      description: `Added discount: ${normalized.name || normalized.id}`,
    });
    return result;
  };
  const updateDiscount = async (discount: Discount): Promise<CrudMutationResult> => {
    const normalized = normalizeDiscountRecord(discount);
    const saved = await syncRecordStrict('discounts', normalized);
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Discounts',
        description: `Failed to update discount ${normalized.name || normalized.id} in Postgres (${saved.status || 0}).`,
      });
      return result;
    }
    setDiscounts(prev => prev.map(d => d.id === discount.id ? normalized : d));
    recordActivity({
      action: 'Updated',
      module: 'Discounts',
      description: `Updated discount: ${normalized.name || normalized.id}`,
    });
    return result;
  };
  const deleteDiscount = async (id: string): Promise<CrudMutationResult> => {
    const existing = discounts.find(d => d.id === id);
    return confirmDeleteFromPostgres('discounts', id, 'Discounts', existing?.name || existing?.id || id, async () => {
      setDiscounts(prev => prev.filter(d => d.id !== id));
      recordActivity({
        action: 'Deleted',
        module: 'Discounts',
        description: `Deleted discount: ${existing?.name || existing?.id || id}`,
      });
    });
  };

  // ============================================================
  //  SETTINGS
  // ============================================================

  const updateSettings = async (newSettings: AppSettings): Promise<CrudMutationResult> => {
    if (!enforcePermissionBoundary('Settings', ['Access business settings', 'Access invoice settings'], 'Update settings')) {
      return failResult(403, 'Missing permission to update settings.');
    }
    const normalized = normalizeAppSettings(newSettings);
    const saved = await syncRecordStrict('settings', { id: 'SETTINGS', ...normalized });
    const result = toCrudResult(saved);
    if (!result.ok) {
      recordActivity({
        action: 'Blocked',
        module: 'Settings',
        description: `Failed to update settings in Postgres (${saved.status || 0}).`,
      });
      return result;
    }
    setSettings(normalized);
    recordActivity({
      action: 'Updated',
      module: 'Settings',
      description: 'Updated application settings',
    });
    return result;
  };

  const updateCurrentUserPreferences = async (
    patch: Record<string, unknown>,
    options?: { replace?: boolean },
  ): Promise<CrudMutationResult> => {
    const userId = String(currentUser?.id || '').trim();
    if (!userId) {
      return failResult(401, 'Authentication required.');
    }

    const normalizedPatch = toRecord(patch);
    const replace = options?.replace === true;
    if (!replace && Object.keys(normalizedPatch).length === 0) {
      return okResult(200);
    }

    const saved = await updateUserPreferencesApi(userId, normalizedPatch, { replace });
    const result = toCrudResult(saved);
    if (!result.ok) return result;

    const nextPreferences = toRecord(saved.preferences);
    const nextCurrentUser = normalizeUserRecord({
      ...currentUser!,
      preferences: nextPreferences,
    });
    setCurrentUser(nextCurrentUser);
    setUsers(prev =>
      prev.map(user =>
        user.id === userId
          ? normalizeUserRecord({ ...user, preferences: nextPreferences })
          : user,
      ),
    );
    return result;
  };

  // ============================================================
  //  PROVIDE CONTEXT
  // ============================================================

  return (
    <GlobalContext.Provider value={{
      products, setProducts, addProduct, updateProduct, deleteProduct,
      customers, setCustomers, addCustomer, updateCustomer, deleteCustomer, addCustomerRewardPoints, redeemCustomerRewardPoints,
      suppliers, setSuppliers, addSupplier, updateSupplier, deleteSupplier,
      contacts, setContacts, addContact, updateContact, deleteContact,
      sales, setSales, addSale, updateSale, deleteSale,
      sellReturns, setSellReturns, addSellReturn, updateSellReturn, deleteSellReturn,
      purchases, setPurchases, addPurchase, updatePurchase, deletePurchase,
      purchaseRequisitions, setPurchaseRequisitions, addPurchaseRequisition, updatePurchaseRequisition, deletePurchaseRequisition,
      purchaseOrders, setPurchaseOrders, addPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder,
      purchaseReturns, setPurchaseReturns, addPurchaseReturn, updatePurchaseReturn, deletePurchaseReturn,
      orders, setOrders, addOrder, updateOrder, deleteOrder,
      payments, setPayments, addPayment, updatePayment, deletePayment,
      expenses, setExpenses, addExpense, updateExpense, deleteExpense,
      expenseCategories, setExpenseCategories, addExpenseCategory, updateExpenseCategory, deleteExpenseCategory,
      users, setUsers, addUser, updateUser, deleteUser,
      roles, setRoles, addRole, updateRole, deleteRole,
      commissionAgents, setCommissionAgents, addCommissionAgent, updateCommissionAgent, deleteCommissionAgent,
      locations, setLocations, addLocation, updateLocation, deleteLocation,
      printers, setPrinters, addPrinter, updatePrinter, deletePrinter,
      invoiceSchemes, setInvoiceSchemes, addInvoiceScheme, updateInvoiceScheme, deleteInvoiceScheme,
      invoiceLayouts, setInvoiceLayouts, addInvoiceLayout, updateInvoiceLayout, deleteInvoiceLayout,
      barcodeSettings, setBarcodeSettings, addBarcodeSetting, updateBarcodeSetting, deleteBarcodeSetting,
      taxRates, setTaxRates, addTaxRate, updateTaxRate, deleteTaxRate,
      customerGroups, setCustomerGroups, addCustomerGroup, updateCustomerGroup, deleteCustomerGroup,
      productCategories, setProductCategories, addProductCategory, updateProductCategory, deleteProductCategory,
      productBrands, setProductBrands, addProductBrand, updateProductBrand, deleteProductBrand,
      productUnits, setProductUnits, addProductUnit, updateProductUnit, deleteProductUnit,
      warranties, setWarranties, addWarranty, updateWarranty, deleteWarranty,
      productVariations, setProductVariations, addProductVariation, updateProductVariation, deleteProductVariation,
      sellingPriceGroups, setSellingPriceGroups, addSellingPriceGroup, updateSellingPriceGroup, deleteSellingPriceGroup,
      discounts, setDiscounts, addDiscount, updateDiscount, deleteDiscount,
      activityLogs, setActivityLogs, addActivityLog, clearActivityLogs,
      settings, updateSettings,
      currentUser, setCurrentUser, userPreferences, updateCurrentUserPreferences,
      formatCurrency, generateId, nextInvoiceNumber,
      syncStatus,
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
