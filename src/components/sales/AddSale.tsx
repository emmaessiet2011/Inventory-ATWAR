import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Save, Plus, Calendar, Search, Trash2,
  ChevronDown, FileText, CreditCard,
  DollarSign, Info, Upload, User, MapPin,
  ShoppingCart, AlertCircle, X, Printer,
  Briefcase, Eye, FileCheck, Edit, Layers
} from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { Product, SHIPPING_STATUS_OPTIONS, ShippingStatus, useGlobalContext } from '@/context/GlobalContext';
import { findBestApplicableDiscount, formatDiscountAmount, resolveAppliedDiscount } from '@/utils/discountRules';
import ProductStockHistory from '@/components/products/ProductStockHistory';
import {
  fromPieceQuantity,
  getAvailableQuantityModes,
  getPackHint,
  normalizePackagingType,
  normalizeUnitsPerPackage,
  toPieceQuantity,
} from '@/utils/productPackaging';
import { normalizeSkuDigits, parseWeighingScaleBarcode } from '@/utils/weighingScaleBarcode';
import { notifyReceiptPrintFallback } from '@/utils/receiptPrinting';
import { resolveInvoiceLayoutRenderConfig } from '@/utils/receiptPrinting';
import { resolveDefaultAccountFromMethod } from '@/utils/paymentAccounts';
import { isLiveSyncEnabled } from '@/utils/apiClient';
import { printElementSnapshot } from '@/utils/printUtils';
import { resolveSaleDueDate } from '@/utils/paymentTerms';
import MultiProductPicker from '@/components/shared/MultiProductPicker';

interface AddSaleProps {
    onNavigate?: (page: string) => void;
    fromOrder?: boolean;
    sourceOrderId?: string;
    isEdit?: boolean;
    saleId?: string;
    initialStatus?: 'Final' | 'Draft' | 'Quotation' | 'Proforma';
    strictInitialStatus?: boolean;
}

const AddSale: React.FC<AddSaleProps> = ({ onNavigate, fromOrder, sourceOrderId: sourceOrderIdParam, isEdit, saleId, initialStatus, strictInitialStatus = false }) => {
  const { addNotification } = useNotifications();
  const {
    locations, sales, addSale, updateSale, updateOrder,
    customers, products, orders,
    customerGroups, sellingPriceGroups, commissionAgents,
    invoiceSchemes, invoiceLayouts,
    discounts,
    settings, currentUser, roles,
    nextInvoiceNumber,
    formatCurrency,
    taxRates,
    printers,
    addCustomerRewardPoints,
  } = useGlobalContext();

  const currentRoleRecord = roles.find(role => role.name === currentUser?.role);
  const rolePermissions = currentRoleRecord?.permissions || [];
  const roleHasExplicitPermissions = rolePermissions.length > 0;
  const hasRolePermission = (moduleName: string, permission: string) => {
    if (!currentUser) return false;
    if (String(currentUser.role || '').toLowerCase() === 'admin' || currentRoleRecord?.isSystem) return true;
    if (!roleHasExplicitPermissions) return true;
    return rolePermissions.includes(permission) || rolePermissions.includes(`${moduleName}::${permission}`);
  };
  const canEditSaleDiscount =
    hasRolePermission('Sell', 'Edit product discount from Sale screen') ||
    hasRolePermission('Sell', 'Add/Edit/Delete Discount');

  const getNowLocalDateTime = () => {
    const now = new Date();
    now.setSeconds(0, 0);
    const tzOffsetMs = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 16);
  };

  const sanitizePaymentAmountInput = (value: string): string => {
    const cleaned = value.replace(/[^\d.]/g, '');
    if (!cleaned) return '';
    const parts = cleaned.split('.');
    const intPart = parts[0] || '0';
    const decimalPart = parts.slice(1).join('').slice(0, 3);
    return parts.length > 1 ? `${intPart}.${decimalPart}` : intPart;
  };

  const formatPaymentAmount = (value: string | number): string => {
    const n = parseFloat(String(value));
    return Number.isFinite(n) ? n.toFixed(3) : '0.000';
  };

  const parsePaymentAmount = (value: string | number): number => {
    const n = parseFloat(String(value));
    return Number.isFinite(n) ? Number(n.toFixed(3)) : 0;
  };

  const parseOptionalNumberInput = (value: string): number | '' => {
    if (value.trim() === '') return '';
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : '';
  };
  const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
  const toNonNegativeAmount = (value: unknown): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Number(Math.max(0, parsed).toFixed(3));
  };
  const toIntegerQuantity = (value: unknown): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.floor(parsed));
  };
  const sanitizeOrderDiscountAmount = (
    type: string,
    value: number | '',
    baseSubTotal: number
  ): number | '' => {
    if (value === '') return '';
    const raw = Number(value);
    if (!Number.isFinite(raw)) return '';
    if (type === 'Percentage') return Number(clamp(raw, 0, 100).toFixed(3));
    if (type === 'Fixed') return Number(clamp(raw, 0, Math.max(0, baseSubTotal)).toFixed(3));
    return '';
  };
  const initialActiveLocation = locations.find(loc => loc.isActive !== false) || locations[0];

  // --- General Info State ---
  const [saleType, setSaleType] = useState('Paid');
  const [location, setLocation] = useState('');
  const [customer, setCustomer] = useState(''); // Stores Customer ID
  const [payTermNumber, setPayTermNumber] = useState('');
  const [payTermUnit, setPayTermUnit] = useState('Days');
  const [saleDate, setSaleDate] = useState(getNowLocalDateTime());
  const [status, setStatus] = useState<'Final' | 'Draft' | 'Quotation' | 'Proforma'>(initialStatus || 'Final');
  const [invoiceScheme, setInvoiceScheme] = useState(() => initialActiveLocation?.invoiceScheme || 'Default');
  const [invoiceLayout, setInvoiceLayout] = useState(() => initialActiveLocation?.invoiceLayoutSale || 'Default');
  const [selectedPriceGroupId, setSelectedPriceGroupId] = useState('');
  const [selectedCommissionAgentId, setSelectedCommissionAgentId] = useState('');
  const [commissionAgentValidationError, setCommissionAgentValidationError] = useState('');
  const isFinalStatus = status === 'Final';
  const isAddDraftFlow = !isEdit && !fromOrder && initialStatus === 'Draft';
  const isAddQuotationFlow = !isEdit && !fromOrder && initialStatus === 'Quotation';
  const forceInitialStatusLock = !isEdit && !fromOrder && strictInitialStatus && !!initialStatus;
  const [isDraftStatusLocked, setIsDraftStatusLocked] = useState(isAddDraftFlow);
  const [isQuotationStatusLocked, setIsQuotationStatusLocked] = useState(isAddQuotationFlow);
  const [pendingFinalStatus, setPendingFinalStatus] = useState<string | null>(null);
  const draftScope = initialStatus === 'Draft'
    ? 'draft'
    : initialStatus === 'Quotation'
      ? 'quotation'
      : 'sale';
  const draftOwner = String(currentUser?.id || currentUser?.name || 'anonymous')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  const scopedDraftStorageKey = `addSaleDraft:${draftScope}:${draftOwner}`;
  const legacySharedDraftKey = 'addSaleDraft';
  const shouldUseLocalDraftCache = !isLiveSyncEnabled();
  const normalizeSaleLifecycleStatus = (
    value?: string,
  ): 'Final' | 'Draft' | 'Quotation' | 'Proforma' => {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'FINAL') return 'Final';
    if (normalized === 'DRAFT' || normalized === 'SUSPEND') return 'Draft';
    if (normalized === 'QUOTATION') return 'Quotation';
    if (normalized === 'PROFORMA') return 'Proforma';
    return 'Final';
  };

  const commissionAgentEnabledInSale = settings.salesCommissionAgent === 'Enable' || settings.enableCommissionAgents;
  const commissionAgentRequiredInSale = commissionAgentEnabledInSale && settings.isCommissionAgentRequired;
  const activeCommissionAgents = useMemo(
    () => commissionAgents.filter(agent => agent.isActive !== false),
    [commissionAgents]
  );
  const hasValidSelectedCommissionAgent = useMemo(
    () => activeCommissionAgents.some(agent => String(agent.id) === String(selectedCommissionAgentId)),
    [activeCommissionAgents, selectedCommissionAgentId]
  );
  const activeLocations = useMemo(
    () => locations.filter(loc => loc.isActive !== false),
    [locations]
  );
  const defaultLocationName = useMemo(
    () => activeLocations[0]?.name || locations[0]?.name || '',
    [activeLocations, locations]
  );
  const selectableLocations = useMemo(() => {
    const active = activeLocations;
    if (!location) return active;
    const current = locations.find(loc => loc.name === location);
    if (current && current.isActive === false && !active.some(loc => loc.id === current.id)) {
      return [current, ...active];
    }
    return active;
  }, [activeLocations, location, locations]);

  // --- Customer Search State ---
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [selectedCustomerObj, setSelectedCustomerObj] = useState<any>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Real customers from GlobalContext — active only, for the dropdown
  const customerList = useMemo(() => (
    customers
      .filter(c => c.status === 'Active')
      .map(c => ({
        id: c.id,
        name: c.businessName,
        phone: c.mobile,
        customerGroup: c.customerGroup,
        customerGroupId: c.customerGroupId,
        type: c.customerGroup || 'Customer',
        payTerm: c.payTerm,
        creditLimit: c.creditLimit,
        billingAddress: c.address,
      }))
  ), [customers]);

  const invoiceSchemeOptions = useMemo(() => {
    const unique = Array.from(new Set([
      ...invoiceSchemes.map(scheme => scheme.name),
      ...locations.map(location => location.invoiceScheme),
    ].filter(Boolean)));
    return unique.length > 0 ? unique : ['Default'];
  }, [invoiceSchemes, locations]);

  const invoiceLayoutOptions = useMemo(() => {
    const unique = Array.from(new Set([
      ...invoiceLayouts.map(layout => layout.name),
      ...locations.map(location => location.invoiceLayoutSale),
    ].filter(Boolean)));
    return unique.length > 0 ? unique : ['Default'];
  }, [invoiceLayouts, locations]);

  const parsePayTerm = (payTermText?: string): { number: string; unit: 'Days' | 'Months' } | null => {
    const text = String(payTermText || '').trim();
    if (!text) return null;
    const match = text.match(/^(\d+)\s*(Days?|Months?)$/i);
    if (!match) return null;
    const unit = match[2].toLowerCase().startsWith('month') ? 'Months' : 'Days';
    return { number: match[1], unit };
  };

  const normalizeSku = (value?: string) =>
    String(value || '').trim().toLowerCase().replace(/\s+/g, '');

  const selectedCustomerRecord = useMemo(
    () => customers.find(c => c.id === customer),
    [customers, customer]
  );

  const activeSellingPriceGroups = useMemo(
    () => sellingPriceGroups.filter(g => g.status === 'Active'),
    [sellingPriceGroups]
  );

  const activeCustomerGroups = useMemo(
    () => customerGroups.filter(g => (g.status || 'Active') === 'Active'),
    [customerGroups]
  );

  const resolvedCustomerGroup = useMemo(() => {
    if (!selectedCustomerRecord) return null;
    const byId = selectedCustomerRecord.customerGroupId
      ? activeCustomerGroups.find(g => g.id === selectedCustomerRecord.customerGroupId)
      : undefined;
    if (byId) return byId;
    const normalizedGroupName = String(selectedCustomerRecord.customerGroup || '').trim().toLowerCase();
    if (!normalizedGroupName) return null;
    return activeCustomerGroups.find(g => g.name.trim().toLowerCase() === normalizedGroupName) || null;
  }, [selectedCustomerRecord, activeCustomerGroups]);

  const customerGroupCalculationPercentage = Number(
    resolvedCustomerGroup?.calculationPercentage ?? resolvedCustomerGroup?.discountPercent ?? 0
  ) || 0;

  const sellingPriceGroupResolution = useMemo(() => {
    const byId = (id: string) => activeSellingPriceGroups.find(g => g.id === id) || null;
    const byName = (name?: string) => {
      if (!name) return null;
      const normalized = name.trim().toLowerCase();
      return activeSellingPriceGroups.find(g => g.name.trim().toLowerCase() === normalized) || null;
    };
    const customerGroupById = (id?: string) =>
      id ? activeCustomerGroups.find(g => g.id === id) || null : null;
    const customerGroupByName = (name?: string) => {
      if (!name) return null;
      const normalized = name.trim().toLowerCase();
      return activeCustomerGroups.find(g => g.name.trim().toLowerCase() === normalized) || null;
    };

    if (selectedPriceGroupId) {
      const manual = byId(selectedPriceGroupId);
      if (manual) return { group: manual, source: 'Manual' };
    }

    const customerGroupRecord = customerGroupById(selectedCustomerRecord?.customerGroupId) ||
      customerGroupByName(selectedCustomerRecord?.customerGroup);
    if (customerGroupRecord) {
      const linkedGroup = byId(customerGroupRecord.sellingPriceGroupId || '') ||
        byName(customerGroupRecord.sellingPriceGroup);
      const fromCustomerGroup = linkedGroup;
      if (fromCustomerGroup) {
        return { group: fromCustomerGroup, source: `Customer Group (${customerGroupRecord.name})` };
      }
    }

    const locationGroupName = location
      ? locations.find(l => l.name === location)?.priceGroup
      : '';
    const fromLocation = byName(locationGroupName);
    if (fromLocation) {
      return { group: fromLocation, source: `Location (${location})` };
    }

    const defaultGroup = byName('Default Selling Price') || activeSellingPriceGroups[0] || null;
    return { group: defaultGroup, source: 'Default' };
  }, [selectedPriceGroupId, selectedCustomerRecord, location, locations, activeSellingPriceGroups, activeCustomerGroups]);

  const resolvedSellingPriceGroup = sellingPriceGroupResolution.group;
  const resolvedSellingPriceGroupSource = sellingPriceGroupResolution.source;

  const getGroupedProductPrice = (product: any) => {
    const basePrice = Number(product?.sellingPrice || 0);
    const group = resolvedSellingPriceGroup;
    const applyCustomerGroupCalc = (price: number) =>
      Math.max(0, price * (1 + (customerGroupCalculationPercentage / 100)));
    if (!group) return Number(applyCustomerGroupCalc(basePrice).toFixed(3));

    const adjustedBase = basePrice * (1 + (Number(group.priceCalcPercentage || 0) / 100));
    const applicable = group.applicableProducts || [];

    if (applicable.length === 0) {
      const groupedPrice = Math.max(0, adjustedBase * (1 - (Number(group.discount || 0) / 100)));
      return Number(applyCustomerGroupCalc(groupedPrice).toFixed(3));
    }

    const productRule = applicable.find(p =>
      p.id === product?.id ||
      (p.sku && normalizeSku(p.sku) === normalizeSku(product?.sku))
    );
    if (!productRule) return Number(applyCustomerGroupCalc(basePrice).toFixed(3));

    const productDiscount = Number.isFinite(productRule.discount) ? productRule.discount : Number(group.discount || 0);
    const groupedPrice = Math.max(0, adjustedBase * (1 - (productDiscount / 100)));
    return Number(applyCustomerGroupCalc(groupedPrice).toFixed(3));
  };

  const round3 = (value: number): number => Number((Number(value) || 0).toFixed(3));

  const applyRowQuantityMode = (row: any, product?: Product) => {
    const productKey = String(row?.productId || '').trim();
    const linkedProduct = product || products.find(p =>
      String(p.id || '').trim() === productKey ||
      String(p.sku || '').trim() === productKey
    );
    const packagingType = normalizePackagingType(linkedProduct?.packagingType || row?.productPackagingType);
    const unitsPerPackage = normalizeUnitsPerPackage(row?.unitsPerPackage ?? linkedProduct?.unitsPerPackage);
    const availableModes = getAvailableQuantityModes(packagingType, unitsPerPackage);
    const requestedMode = normalizePackagingType(row?.quantityMode);
    const quantityMode = availableModes.includes(requestedMode) ? requestedMode : 'Piece';
    const storedDisplayQty = Number(row?.quantityInput);
    const fallbackPieceQty = toIntegerQuantity(row?.qty || 0);
    const quantityInput = Number.isFinite(storedDisplayQty)
      ? Math.max(0, storedDisplayQty)
      : fromPieceQuantity(fallbackPieceQty, quantityMode, unitsPerPackage);
    const qtyInPieces = toIntegerQuantity(toPieceQuantity(quantityInput, quantityMode, unitsPerPackage));
    return {
      ...row,
      productPackagingType: availableModes.length > 1 ? packagingType : undefined,
      unitsPerPackage: availableModes.length > 1 ? unitsPerPackage : undefined,
      quantityMode,
      quantityInput: round3(quantityInput),
      qty: qtyInPieces,
    };
  };

  const recalcRowWithProduct = (row: any, product: any, forcedUnitPrice?: number) => {
    const quantityAdjustedRow = applyRowQuantityMode(row, product);
    const qty = toIntegerQuantity(quantityAdjustedRow?.qty || 0);
    const unitPrice = toNonNegativeAmount(
      typeof forcedUnitPrice === 'number' && Number.isFinite(forcedUnitPrice)
        ? forcedUnitPrice
        : quantityAdjustedRow?.unitPrice || 0
    );
    const lineBase = Number((unitPrice * qty).toFixed(3));
    const discount = Number(clamp(toNonNegativeAmount(quantityAdjustedRow?.discount || 0), 0, lineBase).toFixed(3));
    const subtotal = Number((lineBase - discount).toFixed(3));
    return {
      ...quantityAdjustedRow,
      unit: product?.unit || row?.unit || '',
      qty,
      quantityInput: round3(Number(quantityAdjustedRow?.quantityInput ?? qty)),
      unitPrice,
      discount,
      subtotal,
      tax: 0,
      total: subtotal,
    };
  };

  const resolveDefaultOrderTax = (): string => {
    if (!settings.defaultSaleTax || settings.defaultSaleTax === 'None') return 'None';
    if (taxRates.some(r => r.name === settings.defaultSaleTax)) return settings.defaultSaleTax;
    const normalized = settings.defaultSaleTax.trim().toLowerCase();
    const fallback = taxRates.find(r => r.name.trim().toLowerCase() === normalized);
    return fallback?.name || 'None';
  };

  // --- Top Product Search Bar State ---
  const [topProductSearch, setTopProductSearch] = useState('');
  const [topProductDropdownOpen, setTopProductDropdownOpen] = useState(false);
  const [showMultiPicker, setShowMultiPicker] = useState(false);
  const topSearchRef = useRef<HTMLDivElement>(null);

  // --- Attach Document State ---
  const attachDocRef = useRef<HTMLInputElement>(null);
  const [attachedFileName, setAttachedFileName] = useState('');

  // --- Product Search per Row ---
  const [rowProductSearch, setRowProductSearch] = useState<Record<number, string>>({});
  const [rowProductDropdownOpen, setRowProductDropdownOpen] = useState<Record<number, boolean>>({});
  const [isStockHistoryOpen, setIsStockHistoryOpen] = useState(false);
  const [stockHistoryProduct, setStockHistoryProduct] = useState<Product | null>(null);

  // --- Product Grid State ---
  const [rows, setRows] = useState<any[]>([]);

  // --- Bottom Section State ---
  const initialDefaultSaleDiscount = Number(settings.defaultSaleDiscount || 0);
  const [discountType, setDiscountType] = useState(
    Number.isFinite(initialDefaultSaleDiscount) && initialDefaultSaleDiscount > 0 ? 'Percentage' : 'None'
  );
  const [discountAmount, setDiscountAmount] = useState<number | ''>(
    Number.isFinite(initialDefaultSaleDiscount) && initialDefaultSaleDiscount > 0
      ? Number(initialDefaultSaleDiscount.toFixed(3))
      : ''
  );
  const [isDiscountManuallyOverridden, setIsDiscountManuallyOverridden] = useState(false);
  const [orderTax, setOrderTax] = useState(resolveDefaultOrderTax());
  const [sellNote, setSellNote] = useState('');
  
  // --- Shipping State ---
  const [shippingDetails, setShippingDetails] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCharges, setShippingCharges] = useState<number | ''>('');
  const [shippingStatus, setShippingStatus] = useState<ShippingStatus>('Ordered');
  const [deliveredTo, setDeliveredTo] = useState('');

  // --- Payment State ---
  const [amount, setAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState(getNowLocalDateTime());
  const [paymentMethod, setPaymentMethod] = useState(settings.defaultSalePaymentMethod || 'Cash');
  const [paymentAccount, setPaymentAccount] = useState('None');
  const [paymentNote, setPaymentNote] = useState('');

  // --- Preview State ---
  const [showPreview, setShowPreview] = useState(false);
  const [sourceOrderId, setSourceOrderId] = useState(() => String(sourceOrderIdParam || '').trim());
  const [sourceOrderNumber, setSourceOrderNumber] = useState('');

  // --- Draft State ---
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [draftData, setDraftData] = useState<any>(null);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);

  useEffect(() => {
    const nextSourceOrderId = String(sourceOrderIdParam || '').trim();
    if (!nextSourceOrderId || nextSourceOrderId === sourceOrderId) return;
    setSourceOrderId(nextSourceOrderId);
  }, [sourceOrderIdParam, sourceOrderId]);

  const isMeaningfulRow = (row: any) => {
    const productId = String(row?.productId ?? '').trim();
    const name = String(row?.name ?? '').trim();
    return productId !== '' || name !== '';
  };

  const normalizeRows = (input: any): any[] => {
    if (!Array.isArray(input)) return [];
    return input
      .filter(isMeaningfulRow)
      .map(row => {
        const linkedProduct = products.find(product =>
          String(product.id || '').trim() === String(row?.productId || '').trim()
        );
        const quantityAdjustedRow = applyRowQuantityMode(row, linkedProduct);
        const qty = Number(quantityAdjustedRow?.qty || 0);
        const unitPrice = Number(quantityAdjustedRow?.unitPrice || 0);
        const discount = Number(quantityAdjustedRow?.discount || 0);
        const subtotal = Math.max(0, (qty * unitPrice) - discount);
        return {
          ...quantityAdjustedRow,
          qty: Number(qty.toFixed(3)),
          quantityInput: Number((Number(quantityAdjustedRow?.quantityInput || qty) || 0).toFixed(3)),
          unitPrice: Number(unitPrice.toFixed(3)),
          discount: Number(discount.toFixed(3)),
          subtotal: Number(subtotal.toFixed(3)),
          tax: 0,
          total: Number(subtotal.toFixed(3)),
        };
      });
  };

  const mapOrderStatusToShippingStatus = (orderStatus?: string): ShippingStatus => {
    const normalized = String(orderStatus || '').trim();
    if (normalized === 'Delivered') return 'Delivered';
    if (normalized === 'Cancelled') return 'Cancelled';
    if (normalized === 'Shipped') return 'Shipped';
    if (normalized === 'Ready') return 'Packed';
    if (normalized === 'Processing') return 'Pending';
    return 'Ordered';
  };

  useEffect(() => {
    if (isEdit || fromOrder) return;
    if (!initialStatus) return;
    setStatus(initialStatus);
    if (initialStatus === 'Draft') {
      setSaleType(settings.disableCreditSaleButton ? 'Paid' : 'Credit Sale');
      return;
    }
    if (initialStatus === 'Quotation' || initialStatus === 'Proforma') {
      setSaleType('Paid');
    }
  }, [initialStatus, isEdit, fromOrder, settings.disableCreditSaleButton]);

  useEffect(() => {
    if (!isAddDraftFlow || !isDraftStatusLocked) return;
    if (status !== 'Draft') {
      setStatus('Draft');
    }
  }, [isAddDraftFlow, isDraftStatusLocked, status]);

  // Pre-fill pay term days from settings when switching to Credit Sale (new sale only)
  useEffect(() => {
    if (isEdit) return;
    if (saleType === 'Credit Sale' && !payTermNumber) {
      const days = String(settings.defaultCreditSaleDays || '').trim();
      if (days && Number(days) > 0) {
        setPayTermNumber(days);
        setPayTermUnit('Days');
      }
    }
  }, [saleType]);

  useEffect(() => {
    if (!isAddQuotationFlow || !isQuotationStatusLocked) return;
    if (status !== 'Quotation') {
      setStatus('Quotation');
    }
  }, [isAddQuotationFlow, isQuotationStatusLocked, status]);

  useEffect(() => {
    if (!forceInitialStatusLock || !initialStatus) return;
    if (status !== initialStatus) {
      setStatus(initialStatus);
    }
  }, [forceInitialStatusLock, initialStatus, status]);

  const removeScopedDraft = () => {
    if (!shouldUseLocalDraftCache) return;
    localStorage.removeItem(scopedDraftStorageKey);
    if (draftScope === 'sale') {
      localStorage.removeItem(legacySharedDraftKey);
    }
  };

  // Load Draft Logic
  useEffect(() => {
    if (!shouldUseLocalDraftCache) {
      setIsDraftLoaded(true);
      return;
    }
    if (!isEdit && !fromOrder) {
      const savedDraft = localStorage.getItem(scopedDraftStorageKey)
        || (draftScope === 'sale' ? localStorage.getItem(legacySharedDraftKey) : null);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          const draftRows = normalizeRows(parsed.rows);
          if (parsed.customer || draftRows.length > 0) {
             setDraftData({ ...parsed, rows: draftRows });
             setShowDraftPrompt(true);
          } else {
             setIsDraftLoaded(true);
          }
        } catch (e) {
             setIsDraftLoaded(true);
        }
      } else {
         setIsDraftLoaded(true);
      }
    } else {
       setIsDraftLoaded(true);
    }
  }, [isEdit, fromOrder, scopedDraftStorageKey, draftScope, legacySharedDraftKey, shouldUseLocalDraftCache]);

  // Save Draft Logic
  useEffect(() => {
    if (!shouldUseLocalDraftCache) return;
    if (isDraftLoaded && !isEdit && !fromOrder && !showDraftPrompt) {
      const draft = {
        saleType, customer, payTermNumber, payTermUnit, saleDate, status, invoiceScheme, invoiceLayout,
        rows, discountType, discountAmount, orderTax, sellNote, shippingDetails, shippingAddress,
        shippingCharges, shippingStatus, deliveredTo, amount, paymentDate, paymentMethod, paymentAccount, paymentNote,
        location, selectedPriceGroupId, selectedCommissionAgentId, attachedFileName
      };
      localStorage.setItem(scopedDraftStorageKey, JSON.stringify(draft));
      if (draftScope === 'sale') {
        localStorage.removeItem(legacySharedDraftKey);
      }
    }
  }, [isDraftLoaded, showDraftPrompt, saleType, customer, payTermNumber, payTermUnit, saleDate, status, invoiceScheme, invoiceLayout, rows, discountType, discountAmount, orderTax, sellNote, shippingDetails, shippingAddress, shippingCharges, shippingStatus, deliveredTo, amount, paymentDate, paymentMethod, paymentAccount, paymentNote, isEdit, fromOrder, location, selectedPriceGroupId, selectedCommissionAgentId, scopedDraftStorageKey, draftScope, legacySharedDraftKey, attachedFileName, shouldUseLocalDraftCache]);

  const restoreDraft = () => {
     if (draftData) {
         setSaleType(
           settings.disableCreditSaleButton && draftData.saleType === 'Credit Sale'
             ? 'Paid'
             : (draftData.saleType || 'Paid')
         );
         setLocation(draftData.location || '');
         setCustomer(draftData.customer || '');
         setPayTermNumber(draftData.payTermNumber || '');
         setPayTermUnit(draftData.payTermUnit || 'Days');
         setSaleDate(draftData.saleDate || getNowLocalDateTime());
        const restoredStatus = forceInitialStatusLock && initialStatus
          ? initialStatus
          : (draftData.status || 'Final');
        setStatus(restoredStatus);
         setInvoiceScheme(draftData.invoiceScheme || getInvoiceSchemeForLocation(draftData.location || location));
         setInvoiceLayout(draftData.invoiceLayout || getInvoiceLayoutForLocation(draftData.location || location));
         setSelectedPriceGroupId(draftData.selectedPriceGroupId || '');
         setSelectedCommissionAgentId(draftData.selectedCommissionAgentId || '');
         setRows(normalizeRows(draftData.rows));
         setDiscountType(draftData.discountType || 'None');
         setDiscountAmount(draftData.discountAmount ?? '');
         setIsDiscountManuallyOverridden(true);
         setOrderTax(draftData.orderTax || 'None');
         setSellNote(draftData.sellNote || '');
         setShippingDetails(draftData.shippingDetails || '');
         setShippingAddress(draftData.shippingAddress || '');
         setShippingCharges(draftData.shippingCharges ?? '');
         setShippingStatus(draftData.shippingStatus || 'Ordered');
         setDeliveredTo(draftData.deliveredTo || '');
         setAmount(draftData.amount === '' ? '' : formatPaymentAmount(draftData.amount || 0));
         setPaymentDate(draftData.paymentDate || getNowLocalDateTime());
         setPaymentMethod(draftData.paymentMethod || 'Cash');
        setPaymentAccount(draftData.paymentAccount || 'None');
        setPaymentNote(draftData.paymentNote || '');
        setAttachedFileName(draftData.attachedFileName || '');
        setIsDraftStatusLocked(isAddDraftFlow ? (draftData.status || 'Draft') === 'Draft' : false);
        setIsQuotationStatusLocked(isAddQuotationFlow ? (restoredStatus === 'Quotation') : false);
        setCommissionAgentValidationError('');
         
         // Try to restore customer search text from real customers
         if (draftData.customer) {
             const cust = customerList.find(c => c.id === draftData.customer);
             if (cust) {
                 setCustomerSearch(cust.name);
                 setSelectedCustomerObj(cust);
             }
         }
     }
     setShowDraftPrompt(false);
     setIsDraftLoaded(true);
  };

  const discardDraft = () => {
     removeScopedDraft();
     setShowDraftPrompt(false);
     setIsDraftLoaded(true);
  };

  const toDateTimeLocal = (value?: string) => {
    if (!value) return getNowLocalDateTime();
    return value.includes('T') ? value.slice(0, 16) : `${value}T00:00`;
  };

  const getInvoiceSchemeForLocation = (locationName?: string) => {
    if (!locationName) return invoiceSchemeOptions[0] || 'Default';
    const locObj = locations.find(l => l.name === locationName);
    return locObj?.invoiceScheme || invoiceSchemeOptions[0] || 'Default';
  };

  const getInvoiceLayoutForLocation = (locationName?: string) => {
    if (!locationName) return invoiceLayoutOptions[0] || 'Default';
    const locObj = locations.find(l => l.name === locationName);
    return locObj?.invoiceLayoutSale || invoiceLayoutOptions[0] || 'Default';
  };

  const getDefaultPaymentMethod = () => {
    const locObj = locations.find(l => l.name === location);
    const enabledMethods = (locObj?.paymentMethods || []).filter(pm => pm.enabled);
    if (enabledMethods.length > 0) return enabledMethods[0].name;
    return settings.defaultSalePaymentMethod || 'Cash';
  };

  // Keep invoice scheme synced to selected location/module settings
  useEffect(() => {
    if (!location) return;
    const schemeFromSettings = getInvoiceSchemeForLocation(location);
    if ((!settings.showInvoiceScheme || !invoiceScheme) && invoiceScheme !== schemeFromSettings) {
      setInvoiceScheme(schemeFromSettings);
    }
    const layoutFromSettings = getInvoiceLayoutForLocation(location);
    if ((!settings.showInvoiceLayoutDropdown || !invoiceLayout) && invoiceLayout !== layoutFromSettings) {
      setInvoiceLayout(layoutFromSettings);
    }
  }, [location, locations, invoiceSchemeOptions, invoiceLayoutOptions, invoiceScheme, invoiceLayout, settings.showInvoiceScheme, settings.showInvoiceLayoutDropdown]);

  useEffect(() => {
    if (settings.disableCreditSaleButton && saleType === 'Credit Sale') {
      setSaleType('Paid');
    }
  }, [settings.disableCreditSaleButton, saleType]);

  useEffect(() => {
    if (isAddDraftFlow) return;
    if (!settings.disableDraft) return;
    if (status === 'Draft') {
      setStatus('Final');
    }
  }, [settings.disableDraft, status, isAddDraftFlow]);

  useEffect(() => {
    if (isAddQuotationFlow) return;
    if (isEdit) return;
    if (!settings.disableQuotation) return;
    if (status === 'Quotation' || status === 'Proforma') {
      setStatus('Final');
    }
  }, [settings.disableQuotation, status, isAddQuotationFlow, isEdit]);

  useEffect(() => {
    if (!commissionAgentEnabledInSale && selectedCommissionAgentId) {
      setSelectedCommissionAgentId('');
    }
  }, [commissionAgentEnabledInSale, selectedCommissionAgentId]);

  useEffect(() => {
    const commissionMissing = isFinalStatus && commissionAgentRequiredInSale && !hasValidSelectedCommissionAgent;
    if (!commissionMissing && commissionAgentValidationError) {
      setCommissionAgentValidationError('');
    }
  }, [isFinalStatus, commissionAgentRequiredInSale, hasValidSelectedCommissionAgent, commissionAgentValidationError]);

  // Pre-fill logic
  useEffect(() => {
    if (fromOrder) {
        const selectedOrderId = String(sourceOrderId || '').trim();
        const sourceOrder = selectedOrderId ? orders.find(o => o.id === selectedOrderId) : undefined;

        if (sourceOrder) {
          if (sourceOrder.convertedSaleId) {
            const existingConvertedSale = sales.find(s => s.id === sourceOrder.convertedSaleId);
            if (existingConvertedSale) {
              addNotification({
                title: 'Order Already Converted',
                message: `Order ${sourceOrder.orderNumber} is already converted to invoice ${existingConvertedSale.invoiceNo}.`,
                type: 'warning',
              });
              setSourceOrderId(sourceOrder.id);
              setSourceOrderNumber(sourceOrder.orderNumber);
              if (onNavigate) {
                onNavigate(`edit-sale/${existingConvertedSale.id}`);
              }
              return;
            }
            // Stale conversion pointer (invoice record no longer exists):
            // allow regeneration and clear stale fields so future clicks work normally.
            updateOrder({
              ...sourceOrder,
              convertedSaleId: undefined,
              convertedInvoiceNo: undefined,
              convertedAt: undefined,
            });
          }

          const selectedCustomer = customerList.find(c => c.id === sourceOrder.customerId) || {
            id: sourceOrder.customerId,
            name: sourceOrder.customerName,
            phone: sourceOrder.customerPhone,
            payTerm: '',
            creditLimit: 0,
            billingAddress: sourceOrder.deliveryAddress || '',
          };

          const mappedRows = sourceOrder.items.map((item, idx) => {
            const productKey = String(item.productId || item.productSku || item.id || '').trim();
            const matchedProduct = products.find(product =>
              product.id === productKey ||
              product.sku === productKey ||
              product.name === item.name
            );
            return {
              id: Date.now() + idx,
              productId: matchedProduct?.id || productKey,
              name: item.name || matchedProduct?.name || '',
              qty: Number(item.qty || 0),
              quantityMode: normalizePackagingType((item as any)?.quantityMode),
              quantityInput: Number((item as any)?.quantityInput ?? item.qty ?? 0),
              unitsPerPackage: normalizeUnitsPerPackage((item as any)?.unitsPerPackage ?? matchedProduct?.unitsPerPackage),
              productPackagingType: normalizePackagingType((item as any)?.productPackagingType || matchedProduct?.packagingType),
              unit: matchedProduct?.unit || '',
              unitPrice: Number(item.price || matchedProduct?.sellingPrice || 0),
              discount: 0,
              subtotal: Number(item.total || 0),
              tax: 0,
              total: Number(item.total || 0),
            };
          });

          setSourceOrderId(sourceOrder.id);
          setCustomer(selectedCustomer.id);
          setSelectedCustomerObj(selectedCustomer);
          setCustomerSearch(selectedCustomer.name);
          setRows(mappedRows.length ? normalizeRows(mappedRows) : []);
          setSaleDate(toDateTimeLocal(sourceOrder.orderDate));
          const agentSuffix = sourceOrder.salesRep ? ` | Field Agent: ${sourceOrder.salesRep}` : '';
          setSellNote(
            sourceOrder.note
              ? `Converted from Order #${sourceOrder.orderNumber}${agentSuffix}. ${sourceOrder.note}`
              : `Converted from Order #${sourceOrder.orderNumber}${agentSuffix}`
          );
          setSourceOrderNumber(sourceOrder.orderNumber);

          const sourceBusinessLocation = String(sourceOrder.businessLocation || '').trim();
          const matchedLocationByBusiness = activeLocations.find(
            (loc) => String(loc.name || '').trim().toLowerCase() === sourceBusinessLocation.toLowerCase(),
          );
          const matchedLocationByArea = activeLocations.find(
            (loc) => String(loc.name || '').trim().toLowerCase() === String(sourceOrder.area || '').trim().toLowerCase(),
          );
          const chosenLocation = matchedLocationByBusiness?.name || matchedLocationByArea?.name || defaultLocationName;
          setLocation(chosenLocation);
          setInvoiceScheme(getInvoiceSchemeForLocation(chosenLocation));
          setInvoiceLayout(getInvoiceLayoutForLocation(chosenLocation));
          setShippingAddress(sourceOrder.deliveryAddress || '');
          setShippingDetails(sourceOrder.deliveryTimeSlot || '');
          setShippingStatus(mapOrderStatusToShippingStatus(sourceOrder.status));
          setDeliveredTo(sourceOrder.customerName || '');
          setOrderTax(sourceOrder.taxType || 'None');
          const sourceOrderDiscountType = sourceOrder.discountType === 'Fixed' || sourceOrder.discountType === 'Percentage'
            ? sourceOrder.discountType
            : 'None';
          setDiscountType(sourceOrderDiscountType);
          setDiscountAmount(sourceOrderDiscountType === 'None' ? '' : Number(sourceOrder.discountAmount || 0));
          setIsDiscountManuallyOverridden(true);
          setPaymentMethod(sourceOrder.paymentMethod || settings.defaultSalePaymentMethod || 'Cash');
          setAttachedFileName('');
          setStatus('Final');
          setSelectedPriceGroupId('');
          if (commissionAgentEnabledInSale && sourceOrder.salesRep) {
            const matchedAgent = activeCommissionAgents.find(
              (a) => a.name.toLowerCase().includes(sourceOrder.salesRep.toLowerCase()) ||
                     sourceOrder.salesRep.toLowerCase().includes(a.name.toLowerCase())
            );
            setSelectedCommissionAgentId(matchedAgent ? String(matchedAgent.id) : '');
          } else {
            setSelectedCommissionAgentId('');
          }

          if (sourceOrder.orderType === 'Credit') {
            setSaleType(settings.disableCreditSaleButton ? 'Paid' : 'Credit Sale');
            setAmount('0.000');
          } else {
            const isPrepaidOrder = /prepaid/i.test(String(sourceOrder.paymentMethod || ''));
            setSaleType('Paid');
            setAmount(isPrepaidOrder ? formatPaymentAmount(sourceOrder.total || 0) : '0.000');
          }
        } else if (!sourceOrderId) {
          setSourceOrderNumber('');
          if (defaultLocationName && !location) {
            setLocation(defaultLocationName);
          }
        }
    } else if (isEdit && saleId) {
        // Pre-fill for editing an existing sale from GlobalContext
        const existingSale = sales.find(s => s.id === saleId);
        if (!existingSale) {
          if (onNavigate) onNavigate('sales');
          return;
        }

        const selectedCustomer = customerList.find(c => c.id === String(existingSale.customerId)) || (
          existingSale.customerName ? {
            id: String(existingSale.customerId || ''),
            name: existingSale.customerName,
            phone: existingSale.contactNumber || '',
            payTerm: existingSale.payTerm || '',
            creditLimit: 0,
            billingAddress: existingSale.billingAddress || '',
          } : null
        );

        if (selectedCustomer) {
          handleCustomerSelect(selectedCustomer);
        } else {
          setCustomer(String(existingSale.customerId || ''));
          setCustomerSearch(existingSale.customerName || '');
        }

        const mappedExistingRows = (existingSale.items || []).map((item, idx) => ({
          id: Number(item.id) || Date.now() + idx,
          productId: item.id || '',
          name: item.name || '',
          qty: Number(item.qty || 0),
          quantityMode: normalizePackagingType((item as any)?.quantityMode),
          quantityInput: Number((item as any)?.quantityInput ?? item.qty ?? 0),
          unitsPerPackage: normalizeUnitsPerPackage((item as any)?.unitsPerPackage),
          productPackagingType: normalizePackagingType((item as any)?.productPackagingType),
          unit: item.unit || '',
          unitPrice: Number(item.unitPrice || 0),
          discount: Number(item.discount || 0),
          subtotal: Number(item.subtotal || 0),
          tax: 0,
          total: Number(item.total || 0),
        }));
        setRows(normalizeRows(mappedExistingRows));

        setSaleDate(toDateTimeLocal(existingSale.date));
        setSellNote(existingSale.sellNote || '');
        setStatus(normalizeSaleLifecycleStatus(existingSale.status || existingSale.saleStatus));
        const mappedSaleType = existingSale.saleType || (existingSale.paymentStatus === 'Paid' ? 'Paid' : 'Credit Sale');
        setSaleType(settings.disableCreditSaleButton && mappedSaleType === 'Credit Sale' ? 'Paid' : mappedSaleType);
        const resolvedLocation = existingSale.location || defaultLocationName;
        setLocation(resolvedLocation);
        setInvoiceScheme(existingSale.invoiceScheme || getInvoiceSchemeForLocation(resolvedLocation));
        setInvoiceLayout(existingSale.invoiceLayout || getInvoiceLayoutForLocation(resolvedLocation));
        setShippingDetails(existingSale.shippingDetails || '');
        setShippingAddress(existingSale.shippingAddress || '');
        setShippingCharges(existingSale.shippingCharges ?? '');
        setShippingStatus(existingSale.shippingStatus || 'Ordered');
        setDeliveredTo(existingSale.deliveredTo || '');
        setPaymentMethod(existingSale.paymentMethod || settings.defaultSalePaymentMethod || 'Cash');
        setPaymentAccount(existingSale.paymentAccount || 'None');
        setPaymentNote(existingSale.paymentNote || '');
        setPaymentDate(existingSale.paymentDate || toDateTimeLocal(existingSale.date));
        setAttachedFileName(existingSale.document || '');
        setOrderTax(existingSale.tax || 'None');
        const existingCommissionAgent = activeCommissionAgents.find(a =>
          String(a.id) === String((existingSale as any).commissionAgentId || '')
        ) || activeCommissionAgents.find(a =>
          a.name === (existingSale as any).commissionAgentName
        );
        setSelectedCommissionAgentId(existingCommissionAgent ? String(existingCommissionAgent.id) : '');
        const existingGroup = sellingPriceGroups.find(g =>
          g.id === (existingSale as any).sellingPriceGroupId ||
          g.name === (existingSale as any).sellingPriceGroup
        );
        setSelectedPriceGroupId(existingGroup?.id || '');
        setDiscountType(existingSale.discountType || 'None');
        setDiscountAmount(existingSale.discountAmount || 0);
        setIsDiscountManuallyOverridden(true);
        setAmount(formatPaymentAmount(existingSale.totalPaid || 0));

        if (existingSale.payTerm) {
          const [num, unit] = existingSale.payTerm.split(' ');
          setPayTermNumber(num || '');
          setPayTermUnit(unit || 'Days');
        }
    } else if (defaultLocationName && !location) {
        // Default to first location if adding new sale
        setLocation(defaultLocationName);
    }
  }, [
    fromOrder,
    isEdit,
    saleId,
    locations,
    activeLocations,
    defaultLocationName,
    orders,
    customerList,
    products,
    settings.defaultSalePaymentMethod,
    settings.disableCreditSaleButton,
    sales,
    sourceOrderId,
    onNavigate,
    sellingPriceGroups,
    activeCommissionAgents,
    addNotification,
  ]);

  // --- Calculations ---
  const subTotal = rows.reduce((acc, row) => acc + row.total, 0);

  const discountMatchItems = useMemo(
    () => rows
      .filter(row => row?.name)
      .map(row => {
        const rowProductKey = String(row.productId || row.id || '').trim();
        const matchedProduct = products.find(product =>
          product.id === rowProductKey ||
          product.sku === rowProductKey ||
          product.name === row.name
        );
        return {
          id: rowProductKey,
          name: row.name,
          brand: matchedProduct?.brand || '',
          category: matchedProduct?.category || '',
        };
      }),
    [rows, products]
  );

  const saleDateForDiscount = useMemo(() => {
    const parsed = new Date(saleDate);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [saleDate]);

  const matchedAutoDiscountRule = useMemo(
    () => findBestApplicableDiscount(discounts || [], {
      saleDate: saleDateForDiscount,
      location,
      sellingPriceGroup: resolvedSellingPriceGroup?.name || '',
      customerGroup: resolvedCustomerGroup?.name || selectedCustomerRecord?.customerGroup || '',
      items: discountMatchItems,
    }),
    [
      discounts,
      saleDateForDiscount,
      location,
      resolvedSellingPriceGroup?.name,
      resolvedCustomerGroup?.name,
      selectedCustomerRecord?.customerGroup,
      discountMatchItems,
    ]
  );

  const autoAppliedDiscount = useMemo(
    () => resolveAppliedDiscount(matchedAutoDiscountRule, subTotal),
    [matchedAutoDiscountRule, subTotal]
  );

  useEffect(() => {
    if (isEdit || isDiscountManuallyOverridden) return;
    if (autoAppliedDiscount) {
      setDiscountType(autoAppliedDiscount.discountType);
      setDiscountAmount(Number(autoAppliedDiscount.discountAmount.toFixed(3)));
      return;
    }

    const defaultDiscount = Number(settings.defaultSaleDiscount || 0);
    if (Number.isFinite(defaultDiscount) && defaultDiscount > 0) {
      setDiscountType('Percentage');
      setDiscountAmount(Number(defaultDiscount.toFixed(3)));
    } else {
      setDiscountType('None');
      setDiscountAmount('');
    }
  }, [isEdit, isDiscountManuallyOverridden, autoAppliedDiscount, settings.defaultSaleDiscount]);

  const normalizedOrderDiscountAmount = useMemo(
    () => sanitizeOrderDiscountAmount(discountType, discountAmount, subTotal),
    [discountType, discountAmount, subTotal]
  );

  const calculateGrandTotal = () => {
      let total = subTotal;
      
      // Discount
      if (discountType === 'Fixed' && typeof normalizedOrderDiscountAmount === 'number') {
          total -= normalizedOrderDiscountAmount;
      } else if (discountType === 'Percentage' && typeof normalizedOrderDiscountAmount === 'number') {
          total -= (total * (normalizedOrderDiscountAmount / 100));
      }

      // Order Tax (dynamic from taxRates)
      if (orderTax !== 'None') {
          const taxRateObj = taxRates.find(r => r.name === orderTax);
          if (taxRateObj) total += total * (taxRateObj.rate / 100);
      }

      // Shipping
      if (typeof shippingCharges === 'number') {
          total += shippingCharges;
      }

      return total;
  };

  const grandTotal = calculateGrandTotal();

  // Computed discount value for display
  const discountValue = useMemo(() => {
    if (discountType === 'Fixed' && typeof normalizedOrderDiscountAmount === 'number') return normalizedOrderDiscountAmount;
    if (discountType === 'Percentage' && typeof normalizedOrderDiscountAmount === 'number') {
      return subTotal * (normalizedOrderDiscountAmount / 100);
    }
    return 0;
  }, [discountType, normalizedOrderDiscountAmount, subTotal]);

  // Computed order tax value for display
  const orderTaxValue = useMemo(() => {
    if (orderTax === 'None') return 0;
    const taxRateObj = taxRates.find(r => r.name === orderTax);
    if (!taxRateObj) return 0;
    const base = Math.max(0, subTotal - discountValue);
    return base * (taxRateObj.rate / 100);
  }, [orderTax, taxRates, subTotal, discountValue]);

  // Customer advance balance
  const customerAdvanceBalance = useMemo(() => {
    if (!customer) return 0;
    const cust = customers.find(c => c.id === customer);
    return (cust as any)?.advanceBalance || 0;
  }, [customer, customers]);

  useEffect(() => {
    if (isEdit) return;

    if (resolvedSellingPriceGroup) {
      if (resolvedSellingPriceGroup.payTermDays > 0) {
        setPayTermNumber(String(resolvedSellingPriceGroup.payTermDays));
        setPayTermUnit(resolvedSellingPriceGroup.payTermUnit || 'Days');
      } else {
        setPayTermNumber('');
        setPayTermUnit('Days');
      }

      if (Number(resolvedSellingPriceGroup.taxRate || 0) === 0) {
        setOrderTax('None');
      } else {
        const matchingTax = taxRates.find(t => Math.abs(Number(t.rate) - Number(resolvedSellingPriceGroup.taxRate)) < 0.0001);
        if (matchingTax) {
          setOrderTax(matchingTax.name);
        }
      }
      return;
    }

    const parsed = parsePayTerm(selectedCustomerObj?.payTerm);
    if (parsed) {
      setPayTermNumber(parsed.number);
      setPayTermUnit(parsed.unit);
    } else {
      setPayTermNumber('');
      setPayTermUnit('Days');
    }
  }, [resolvedSellingPriceGroup?.id, selectedCustomerObj?.id, isEdit, taxRates]);

  useEffect(() => {
    if (isEdit) return;
    setRows(prev => prev.map(row => {
      if (!row?.productId) return row;
      if (row?.manualPrice) return row;
      const product = products.find(p => p.id === row.productId);
      if (!product) return row;
      const groupedPrice = getGroupedProductPrice(product);
      return recalcRowWithProduct(row, product, groupedPrice);
    }));
  }, [resolvedSellingPriceGroup?.id, customerGroupCalculationPercentage, isEdit, products]);

  // Auto-update payment fields: payment applies only for Final sales
  useEffect(() => {
    if (!isFinalStatus) {
      setAmount('');
      if (paymentMethod !== '') {
        setPaymentMethod('');
      }
      if (paymentAccount !== 'None') {
        setPaymentAccount('None');
      }
      if (paymentNote !== '') {
        setPaymentNote('');
      }
      return;
    }
    if (saleType === 'Credit Sale') {
        setAmount('0.000');
        if (paymentMethod !== '') {
          setPaymentMethod('');
        }
        if (paymentAccount !== 'None') {
          setPaymentAccount('None');
        }
        if (paymentNote !== '') {
          setPaymentNote('');
        }
    } else {
        setAmount(formatPaymentAmount(grandTotal));
        const resolvedMethod = paymentMethod || getDefaultPaymentMethod();
        if (!paymentMethod) {
          setPaymentMethod(resolvedMethod);
        }
        const resolvedAccount = resolveDefaultAccountFromMethod(resolvedMethod);
        if (paymentAccount !== resolvedAccount) {
          setPaymentAccount(resolvedAccount);
        }
    }
  }, [isFinalStatus, saleType, grandTotal, paymentMethod, paymentAccount, paymentNote, location, settings.defaultSalePaymentMethod]);

  // Business rule: final sales are considered delivered.
  useEffect(() => {
    if (isFinalStatus && shippingStatus !== 'Delivered') {
      setShippingStatus('Delivered');
    }
  }, [isFinalStatus, shippingStatus]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
      if (topSearchRef.current && !topSearchRef.current.contains(event.target as Node)) {
        setTopProductDropdownOpen(false);
      }
      setRowProductDropdownOpen({});
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const paymentValue = parsePaymentAmount(amount);
  const balance = grandTotal - paymentValue;
  const changeReturn = paymentValue > grandTotal ? paymentValue - grandTotal : 0;

  // --- Handlers ---
  const handleCustomerSelect = (cust: any) => {
      setCustomer(cust.id);
      setSelectedCustomerObj(cust);
      setCustomerSearch(cust.name);
      setIsCustomerDropdownOpen(false);
      if (!selectedPriceGroupId) {
        const parsed = parsePayTerm(cust?.payTerm);
        if (parsed) {
          setPayTermNumber(parsed.number);
          setPayTermUnit(parsed.unit);
        }
      }
  };

  // Filter customers from real GlobalContext data
  const filteredCustomers = customerList.filter(c =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.phone && c.phone.includes(customerSearch))
  );

  const getLocationScopedProducts = (): Product[] => {
    const normalizedLocation = String(location || '').trim().toLowerCase();
    if (!normalizedLocation || !settings.filterProductsByLocation) return products;
    return products.filter(p => {
      const pLoc = String(p.businessLocation || '').trim().toLowerCase();
      return !pLoc || pLoc === normalizedLocation;
    });
  };

  const findWeighingBarcodeMatch = (search: string, scopedProducts: Product[]) => {
    if (!settings.enableWeighingScale) return null;
    const parsed = parseWeighingScaleBarcode(search, settings);
    if (!parsed) return null;
    const exactSegment = String(parsed.skuSegment || '').trim().toLowerCase();
    const matchedProduct = scopedProducts.find((product) => {
      const normalizedSku = String(product.sku || '').trim().toLowerCase();
      if (normalizedSku === exactSegment) return true;
      const skuDigits = normalizeSkuDigits(String(product.sku || ''));
      return skuDigits === parsed.skuSegment || skuDigits.endsWith(parsed.skuSegment);
    });
    if (!matchedProduct) return null;
    return {
      product: matchedProduct,
      quantity: parsed.quantity,
    };
  };

  // Product search for row line items
  const getFilteredProducts = (search: string) => {
    const scopedProducts = getLocationScopedProducts();
    if (!search) return scopedProducts.slice(0, 20);
    const weighingBarcodeMatch = findWeighingBarcodeMatch(search, scopedProducts);
    if (weighingBarcodeMatch) return [weighingBarcodeMatch.product];
    return scopedProducts.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      String(p.sku || '').toLowerCase().includes(search.toLowerCase())
    ).slice(0, 20);
  };

  // Top product search filtered list (must be after getFilteredProducts)
  const topWeighingBarcodeMatch = useMemo(() => {
    if (!topProductSearch.trim()) return null;
    return findWeighingBarcodeMatch(topProductSearch, getLocationScopedProducts());
  }, [topProductSearch, location, products, settings]);
  const topFilteredProducts = topProductSearch.trim() ? getFilteredProducts(topProductSearch) : [];

  const openStockHistory = (product: Product) => {
    setStockHistoryProduct(product);
    setIsStockHistoryOpen(true);
  };

  const applyProductLocation = (product: any) => {
    if (settings.filterProductsByLocation) return; // strict mode — location drives products
    const productLoc = String(product.businessLocation || '').trim();
    if (!productLoc) return;
    const matched = locations.find(l => l.name.trim().toLowerCase() === productLoc.toLowerCase());
    if (matched) setLocation(matched.name);
  };

  const handleProductSelectForRow = (rowId: number, product: any) => {
    applyProductLocation(product);
    setRows(prev => prev.map(row => {
      if (row.id === rowId) {
        const groupedPrice = getGroupedProductPrice(product);
        const mergedRow = {
          ...row,
          productId: product.id,
          name: product.name,
          unit: product.unit,
          unitPrice: groupedPrice,
          manualPrice: false,
          productPackagingType: normalizePackagingType(product.packagingType),
          unitsPerPackage: normalizeUnitsPerPackage(product.unitsPerPackage),
          quantityMode: normalizePackagingType(row.quantityMode || 'Piece'),
          quantityInput: Math.max(1, toIntegerQuantity(row.quantityInput ?? row.qty ?? 1)),
        };
        return recalcRowWithProduct(mergedRow, product, groupedPrice);
      }
      return row;
    }));
    setRowProductSearch(prev => ({ ...prev, [rowId]: product.name }));
    setRowProductDropdownOpen(prev => ({ ...prev, [rowId]: false }));
  };

  const handleTopProductSelect = (product: any, qtyOverride?: number) => {
    applyProductLocation(product);
    const price = getGroupedProductPrice(product);
    const newId = Date.now();
    const qty = Math.max(1, toIntegerQuantity(qtyOverride || 1));
    const seedRow = {
      id: newId,
      productId: product.id,
      name: product.name,
      qty,
      quantityMode: 'Piece',
      quantityInput: qty,
      productPackagingType: normalizePackagingType(product.packagingType),
      unitsPerPackage: normalizeUnitsPerPackage(product.unitsPerPackage),
      unit: product.unit || '',
      unitPrice: price,
      manualPrice: false,
      discount: 0,
      subtotal: 0,
      tax: 0,
      total: 0,
    };
    const newRow = recalcRowWithProduct(seedRow, product, price);
    setRows(prev => [...prev, newRow]);
    setRowProductSearch(prev => ({ ...prev, [newId]: product.name }));
    setTopProductSearch('');
    setTopProductDropdownOpen(false);
  };

  const handleBulkAddProducts = (selectedProducts: any[]) => {
    // Auto-set location from the first product that has one
    if (selectedProducts.length > 0) applyProductLocation(selectedProducts[0]);
    const baseTime = Date.now();
    const newRowData = selectedProducts.map((product, index) => {
      const id = baseTime + index;
      const price = getGroupedProductPrice(product);
      const seedRow = {
        id,
        productId: product.id,
        name: product.name,
        qty: 1,
        quantityMode: 'Piece',
        quantityInput: 1,
        productPackagingType: normalizePackagingType(product.packagingType),
        unitsPerPackage: normalizeUnitsPerPackage(product.unitsPerPackage),
        unit: product.unit || '',
        unitPrice: price,
        manualPrice: false,
        discount: 0,
        subtotal: 0,
        tax: 0,
        total: 0,
      };
      return { id, row: recalcRowWithProduct(seedRow, product, price), name: product.name };
    });
    setRows(prev => {
      const nonEmpty = prev.filter(row => {
        const pid = String(row?.productId ?? '').trim();
        const nm = String(row?.name ?? '').trim();
        return pid !== '' || nm !== '';
      });
      return [...nonEmpty, ...newRowData.map(d => d.row)];
    });
    const searchUpdates: Record<number, string> = {};
    newRowData.forEach(d => { searchUpdates[d.id] = d.name; });
    setRowProductSearch(prev => ({ ...prev, ...searchUpdates }));
    setShowMultiPicker(false);
  };

  const handleRemoveRow = (id: number) => {
      setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: number, field: string, value: any) => {
      setRows(rows.map(row => {
          if (row.id === id) {
              const updated = {
                ...row,
                [field]: value,
                ...(field === 'unitPrice' ? { manualPrice: true } : {}),
              };
              if (field === 'qty') {
                updated.qty = Math.max(1, toIntegerQuantity(value));
              } else if (field === 'quantityInput') {
                updated.quantityInput = Math.max(1, toIntegerQuantity(value));
              } else if (field === 'unitPrice') {
                updated.unitPrice = toNonNegativeAmount(value);
              } else if (field === 'discount') {
                updated.discount = toNonNegativeAmount(value);
              }
              // Simple recalc
              if (field === 'qty' || field === 'quantityInput' || field === 'quantityMode' || field === 'unitPrice' || field === 'discount') {
                  const linkedProduct = products.find(p => p.id === updated.productId);
                  if (field === 'qty') {
                    const packagingType = normalizePackagingType(linkedProduct?.packagingType || updated.productPackagingType);
                    const unitsPerPackage = normalizeUnitsPerPackage(updated.unitsPerPackage ?? linkedProduct?.unitsPerPackage);
                    const availableModes = getAvailableQuantityModes(packagingType, unitsPerPackage);
                    const rowMode = availableModes.includes(normalizePackagingType(updated.quantityMode))
                      ? normalizePackagingType(updated.quantityMode)
                      : 'Piece';
                    updated.quantityInput = round3(fromPieceQuantity(updated.qty, rowMode, unitsPerPackage));
                  }
                  const quantityAdjusted = applyRowQuantityMode(updated, linkedProduct);
                  if (linkedProduct) {
                    return recalcRowWithProduct(quantityAdjusted, linkedProduct);
                  }
                  const price = toNonNegativeAmount(updated.unitPrice);
                  const qty = toIntegerQuantity(quantityAdjusted.qty);
                  const lineBase = Number((price * qty).toFixed(3));
                  const disc = Number(clamp(toNonNegativeAmount(updated.discount), 0, lineBase).toFixed(3));
                  quantityAdjusted.qty = qty;
                  quantityAdjusted.quantityInput = round3(Number(quantityAdjusted.quantityInput ?? qty));
                  quantityAdjusted.unitPrice = price;
                  quantityAdjusted.discount = disc;
                  quantityAdjusted.subtotal = Number((lineBase - disc).toFixed(3));
                  quantityAdjusted.tax = 0;
                  quantityAdjusted.total = quantityAdjusted.subtotal;
                  return quantityAdjusted;
              }
              return updated;
          }
          return row;
      }));
  };

  const resolveInvoicePrefixForStatus = (
    targetStatus: 'Final' | 'Draft' | 'Quotation' | 'Proforma',
    schemeName: string
  ): string => {
    if (targetStatus === 'Draft') {
      return settings.draftPrefix || 'DR-';
    }
    if (targetStatus === 'Quotation' || targetStatus === 'Proforma') {
      return settings.quotationPrefix || 'QT-';
    }
    return invoiceSchemes.find(item => item.name === schemeName)?.prefix || settings.salesInvoicePrefix || 'INV-';
  };

  // --- Build Sale Object (single source of truth) ---
  const buildSaleObject = (existingSale?: any): any => {
    const defaultScheme = getInvoiceSchemeForLocation(location);
    const scheme = settings.showInvoiceScheme
      ? (invoiceScheme || defaultScheme)
      : defaultScheme;
    const defaultLayout = getInvoiceLayoutForLocation(location);
    const layout = settings.showInvoiceLayoutDropdown
      ? (invoiceLayout || defaultLayout)
      : defaultLayout;
    const invoicePrefix = resolveInvoicePrefixForStatus(status, scheme);
    const existingInvoiceNo = String(existingSale?.invoiceNo || '').trim();
    const existingStatus = normalizeSaleLifecycleStatus(existingSale?.status || existingSale?.saleStatus);
    const wasNonFinal = !!existingSale && existingStatus !== 'Final';
    const finalPrefix = resolveInvoicePrefixForStatus('Final', scheme);
    const normalizedExistingInvoiceNo = existingInvoiceNo.toLowerCase();
    const hasLegacyNonFinalPrefix = [
      settings.draftPrefix || 'DR-',
      settings.quotationPrefix || 'QT-',
    ].some(prefix => normalizedExistingInvoiceNo.startsWith(String(prefix || '').trim().toLowerCase()));
    const shouldReissueInvoiceNo = !!existingSale &&
      isFinalStatus &&
      wasNonFinal &&
      (
        hasLegacyNonFinalPrefix ||
        !normalizedExistingInvoiceNo.startsWith(finalPrefix.toLowerCase())
      );
    const resolvedInvoiceNo = shouldReissueInvoiceNo || !existingInvoiceNo
      ? nextInvoiceNumber(location, invoicePrefix)
      : existingInvoiceNo;
    const amountPaid = isFinalStatus ? parsePaymentAmount(amount) : 0;
    const resolvedPaymentMethod = isFinalStatus && saleType !== 'Credit Sale'
      ? (paymentMethod || getDefaultPaymentMethod())
      : '';
    const resolvedPaymentAccount = resolvedPaymentMethod
      ? resolveDefaultAccountFromMethod(resolvedPaymentMethod)
      : 'None';
    const selectedCommissionAgent = commissionAgentEnabledInSale
      ? activeCommissionAgents.find(agent => String(agent.id) === selectedCommissionAgentId)
      : undefined;
    const commissionRate = Number(selectedCommissionAgent?.commissionPercentage || 0);
    const computedPaymentStatus = isFinalStatus
      ? (saleType === 'Credit Sale'
          ? 'Due'
          : amountPaid >= grandTotal
            ? 'Paid'
            : amountPaid > 0
              ? 'Partial'
              : 'Due')
      : 'Due';
    const computedDue = isFinalStatus
      ? (saleType === 'Credit Sale'
          ? grandTotal
          : Math.max(0, grandTotal - amountPaid))
      : 0;
    const resolvedPayTermValue = Math.max(0, Number(payTermNumber || 0));
    const resolvedPayTermType: 'Days' | 'Months' = payTermUnit === 'Months' ? 'Months' : 'Days';
    const resolvedPayTerm = resolvedPayTermValue > 0
      ? `${resolvedPayTermValue} ${resolvedPayTermType}`
      : '';
    const resolvedDueDate = isFinalStatus && saleType === 'Credit Sale' && resolvedPayTermValue > 0
      ? resolveSaleDueDate({
          date: saleDate,
          payTerm: resolvedPayTerm,
          payTermValue: resolvedPayTermValue,
          payTermType: resolvedPayTermType,
        })
      : '';
    const commissionBaseAmount = settings.commissionCalculationType === 'Paid amount'
      ? amountPaid
      : grandTotal;
    const computedCommissionAmount = selectedCommissionAgent && isFinalStatus
      ? Number((commissionBaseAmount * (commissionRate / 100)).toFixed(3))
      : 0;
    const resolvedShippingStatus: ShippingStatus = isFinalStatus ? 'Delivered' : shippingStatus;
    return {
      id: existingSale?.id || Date.now().toString(),
      date: saleDate,
      paymentDate: isFinalStatus && saleType !== 'Credit Sale' ? paymentDate : '',
      invoiceNo: resolvedInvoiceNo,
      invoiceScheme: scheme,
      invoiceLayout: layout,
      customerId: customer || 'WALK-IN',
      customerName: selectedCustomerObj?.name || 'Direct Customer',
      customerGroupId: resolvedCustomerGroup?.id || selectedCustomerRecord?.customerGroupId || '',
      customerGroup: resolvedCustomerGroup?.name || selectedCustomerRecord?.customerGroup || '',
      contactNumber: selectedCustomerObj?.phone || '',
      billingAddress: selectedCustomerObj?.billingAddress || '',
      shippingAddress,
      location,
      saleType,
      saleStatus: status,
      commissionAgentId: selectedCommissionAgent ? String(selectedCommissionAgent.id) : '',
      commissionAgentName: selectedCommissionAgent?.name || '',
      commissionRate,
      commissionAmount: computedCommissionAmount,
      commissionCalculationType: settings.commissionCalculationType,
      sellingPriceGroupId: resolvedSellingPriceGroup?.id || '',
      sellingPriceGroup: resolvedSellingPriceGroup?.name || '',
      sellingPriceGroupMode: selectedPriceGroupId ? 'manual' : 'auto',
      sellingPriceGroupDiscount: Number(resolvedSellingPriceGroup?.discount || 0),
      sellingPriceGroupPriceAdj: Number(resolvedSellingPriceGroup?.priceCalcPercentage || 0),
      sellingPriceGroupTaxRate: Number(resolvedSellingPriceGroup?.taxRate || 0),
      payTerm: resolvedPayTerm,
      payTermValue: resolvedPayTermValue > 0 ? resolvedPayTermValue : undefined,
      payTermType: resolvedPayTermValue > 0 ? resolvedPayTermType : undefined,
      dueDate: resolvedDueDate,
      paymentStatus: computedPaymentStatus as any,
      paymentMethod: resolvedPaymentMethod,
      paymentAccount: resolvedPaymentAccount,
      paymentNote: isFinalStatus && saleType !== 'Credit Sale' ? paymentNote : '',
      totalAmount: grandTotal,
      totalPaid: amountPaid,
      sellDue: computedDue,
      discount: discountType === 'Percentage'
        ? `${typeof normalizedOrderDiscountAmount === 'number' ? normalizedOrderDiscountAmount : 0}%`
        : `${typeof normalizedOrderDiscountAmount === 'number' ? normalizedOrderDiscountAmount : 0}`,
      orderTax,
      shippingStatus: resolvedShippingStatus,
      shippingDetails,
      shippingCharges: typeof shippingCharges === 'number' ? shippingCharges : 0,
      deliveredTo,
      totalItems: rows.filter(r => r.name).length,
      addedBy: currentUser?.name || 'Admin',
      sellNote,
      staffNote: '',
      document: attachedFileName || '',
      items: rows.filter(r => r.name).map(r => {
        const itemQuantityMode = normalizePackagingType(r.quantityMode);
        const itemPackagingType = normalizePackagingType(r.productPackagingType);
        const qty = toIntegerQuantity(r.qty);
        const unitPrice = toNonNegativeAmount(r.unitPrice);
        const lineBase = Number((qty * unitPrice).toFixed(3));
        const discount = Number(clamp(toNonNegativeAmount(r.discount), 0, lineBase).toFixed(3));
        const subtotal = Number((lineBase - discount).toFixed(3));
        return {
          id: r.productId || r.id?.toString(),
          name: r.name,
          qty,
          quantityMode: itemQuantityMode,
          quantityInput: round3(Number(r.quantityInput ?? qty)),
          unitsPerPackage: normalizeUnitsPerPackage(r.unitsPerPackage),
          productPackagingType: itemPackagingType === 'Piece' ? undefined : itemPackagingType,
          unit: r.unit || '',
          unitPrice,
          discount,
          subtotal,
          tax: 0,
          total: subtotal,
        };
      }),
      subTotal,
      discountType,
      discountAmount: typeof normalizedOrderDiscountAmount === 'number' ? normalizedOrderDiscountAmount : 0,
      tax: orderTax,
      taxAmount: orderTaxValue,
      grandTotal,
      status: status as any,
    };
  };

  // --- Action Handlers ---
  const handleSave = (andPrint = false) => {
      if (!location) {
          addNotification({ title: 'Error', message: 'Please select a Business Location.', type: 'error' });
          return;
      }
      const selectedLocationRecord = locations.find(loc => loc.name === location);
      if (!selectedLocationRecord || selectedLocationRecord.isActive === false) {
          addNotification({ title: 'Error', message: 'Selected business location is inactive.', type: 'error' });
          return;
      }
      if (customer && customer !== 'WALK-IN') {
          if (!selectedCustomerRecord) {
              addNotification({ title: 'Error', message: 'Selected customer is not available.', type: 'error' });
              return;
          }
          if (String(selectedCustomerRecord.status || 'Active') !== 'Active') {
              addNotification({ title: 'Error', message: 'Selected customer is inactive.', type: 'error' });
              return;
          }
      }
      if (isFinalStatus && settings.isPayTermRequired && saleType === 'Credit Sale' && (!payTermNumber || Number(payTermNumber) <= 0)) {
          addNotification({ title: 'Error', message: 'Pay term is required for Credit Sale.', type: 'error' });
          return;
      }
      if (isFinalStatus && commissionAgentRequiredInSale && !hasValidSelectedCommissionAgent) {
          setCommissionAgentValidationError('Commission agent is required for Final sales.');
          addNotification({ title: 'Error', message: 'Please select a commission agent for Final sales.', type: 'error' });
          return;
      }
      setCommissionAgentValidationError('');
      if (rows.filter(r => r.name).length === 0) {
          addNotification({ title: 'Error', message: 'Please add at least one product.', type: 'error' });
          return;
      }
      const invalidRow = rows
        .filter(r => r.name)
        .find(r => {
          const qty = Number(r.qty || 0);
          const unitPrice = Number(r.unitPrice || 0);
          const lineBase = qty * unitPrice;
          const lineDiscount = Number(r.discount || 0);
          return !Number.isInteger(qty) || qty <= 0 || unitPrice < 0 || lineDiscount < 0 || lineDiscount > lineBase;
        });
      if (invalidRow) {
        addNotification({
          title: 'Error',
          message: `Invalid values for "${invalidRow.name}". Quantity must be a whole number > 0, Unit Price >= 0, and Discount cannot exceed line amount.`,
          type: 'error',
        });
        return;
      }
      if (isFinalStatus && !settings.allowOverselling) {
          const oversold = rows
            .filter(r => r.name)
            .find(r => {
              const productKey = String(r.productId || '').trim();
              if (!productKey) return false;
              const product = products.find(p =>
                String(p.id || '').trim() === productKey ||
                String(p.sku || '').trim() === productKey
              );
              if (!product) return false;
              const rowQty = Number(r.qty || 0);
              return rowQty > Number(product.stock || 0);
            });
          if (oversold) {
            addNotification({
              title: 'Error',
              message: `Insufficient stock for "${oversold.name}".`,
              type: 'error',
            });
            return;
          }
      }

      const existingSale = isEdit && saleId ? sales.find(s => s.id === saleId) : undefined;
      const newSale = buildSaleObject(existingSale);

      if (isEdit) {
          updateSale(newSale);
      } else {
          const created = addSale(newSale);
          if (!created) {
            addNotification({
              title: 'Invoice Not Created',
              message: 'You do not have permission to create this invoice.',
              type: 'error',
            });
            return;
          }
          // Reward Points: earn points on Final sales when feature is enabled
          if (
            settings.enableRewardPoints &&
            newSale.status === 'Final' &&
            newSale.customerId &&
            newSale.customerId !== 'WALK-IN'
          ) {
            const amountPerPoint = Number(settings.rewardAmountPerPoint) || 0;
            const minOrder = Number(settings.rewardMinOrderToEarn) || 0;
            const maxPoints = Number(settings.rewardMaxPointsPerOrder) || Infinity;
            if (amountPerPoint > 0 && newSale.grandTotal >= minOrder) {
              const earnedPoints = Math.min(
                Math.floor(newSale.grandTotal / amountPerPoint),
                maxPoints
              );
              if (earnedPoints > 0) {
                addCustomerRewardPoints(newSale.customerId, earnedPoints);
                addNotification({
                  title: 'Reward Points Earned',
                  message: `${earnedPoints} ${settings.rewardPointDisplayName || 'points'} added to customer account.`,
                  type: 'info',
                });
              }
            }
          }
      }

      if (!isEdit && fromOrder && sourceOrderId) {
        const sourceOrderRecord = orders.find(order => order.id === sourceOrderId);
        if (sourceOrderRecord) {
          updateOrder({
            ...sourceOrderRecord,
            convertedSaleId: newSale.id,
            convertedInvoiceNo: newSale.invoiceNo,
            convertedAt: new Date().toISOString(),
            paymentStatus: (newSale.paymentStatus as any) || sourceOrderRecord.paymentStatus,
          });
        }
      }

      removeScopedDraft();
      const recordLabel = newSale.status === 'Draft'
        ? 'Draft'
        : newSale.status === 'Quotation'
          ? 'Quotation'
          : newSale.status === 'Proforma'
            ? 'Proforma'
            : 'Sale';
      addNotification({
        title: `${recordLabel} ${isEdit ? 'Updated' : 'Created'}`,
        message: `${recordLabel} ${newSale.invoiceNo} has been successfully ${isEdit ? 'updated' : 'created'}.`,
        type: 'success'
      });

      // In Add Sale, "Save" should only save.
      // Printing is explicit via "Save & Print".
      const shouldPrint = andPrint;
      const targetPage = newSale.status === 'Draft'
        ? 'drafts'
        : newSale.status === 'Quotation' || newSale.status === 'Proforma'
          ? 'quotations'
          : 'sales';
      if (shouldPrint) {
        setShowPreview(true);
        setTimeout(() => {
          notifyReceiptPrintFallback({
            location: selectedLocation,
            printers,
            addNotification,
            documentLabel: recordLabel,
          });
          printElementSnapshot({
            elementId: 'sale-invoice-preview-root',
            title: `${recordLabel} ${newSale.invoiceNo || ''}`.trim(),
            extraStyles: '@media print { @page { size: A4; margin: 5mm; } }',
          });
          setShowPreview(false);
          if (onNavigate) onNavigate(targetPage);
        }, 180);
        return;
      }
      if (onNavigate) onNavigate(targetPage);
      setShowPreview(false);
  };

  const handleSaveAndPrint = () => handleSave(true);
  const handlePreviewPrint = () => {
    notifyReceiptPrintFallback({
      location: selectedLocation,
      printers,
      addNotification,
      documentLabel: previewDocumentHeading,
    });
    printElementSnapshot({
      elementId: 'sale-invoice-preview-root',
      title: previewDocumentTitle,
      extraStyles: '@media print { @page { size: A4; margin: 5mm; } }',
    });
  };

  // --- Formatting Helper (uses settings currency) ---
  const formatRiyal = (val: number) => formatCurrency(val);
  const selectedLocation = useMemo(
    () => locations.find(l => l.name === location),
    [locations, location]
  );
  const previewLayoutName = settings.showInvoiceLayoutDropdown
    ? (invoiceLayout || getInvoiceLayoutForLocation(location))
    : getInvoiceLayoutForLocation(location);
  const previewLayoutConfig = useMemo(
    () => resolveInvoiceLayoutRenderConfig(previewLayoutName, invoiceLayouts),
    [previewLayoutName, invoiceLayouts]
  );
  const previewInvoiceNo = (() => {
    const editingSale = isEdit && saleId ? sales.find(s => s.id === saleId) : undefined;
    if (editingSale?.invoiceNo) return editingSale.invoiceNo;
    const previewScheme = settings.showInvoiceScheme
      ? (invoiceScheme || getInvoiceSchemeForLocation(location))
      : getInvoiceSchemeForLocation(location);
    const prefix = resolveInvoicePrefixForStatus(status, previewScheme);
    return nextInvoiceNumber(location, prefix);
  })();
  const formatPreviewDateTime = (value?: string) => {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hh = date.getHours();
    const mm = String(date.getMinutes()).padStart(2, '0');
    const h12 = String(hh % 12 || 12).padStart(2, '0');
    const meridiem = hh >= 12 ? 'PM' : 'AM';
    const dateOnly = settings.dateFormat === 'mm/dd/yyyy'
      ? `${month}/${day}/${year}`
      : `${day}/${month}/${year}`;
    return settings.timeFormat === '24'
      ? `${dateOnly} ${String(hh).padStart(2, '0')}:${mm}`
      : `${dateOnly} ${h12}:${mm} ${meridiem}`;
  };
  const metaGridClass = settings.showInvoiceLayoutDropdown
    ? (settings.showInvoiceScheme ? 'md:grid-cols-6' : 'md:grid-cols-5')
    : (settings.showInvoiceScheme ? 'md:grid-cols-5' : 'md:grid-cols-4');
  const pageTitle = isEdit
    ? 'Edit Sale'
    : isAddDraftFlow
      ? 'Add Draft'
      : isAddQuotationFlow
        ? 'Add Quotation'
        : 'Add Sale';
  const pageDescription = isEdit
    ? 'Modify details of existing invoice.'
    : isAddDraftFlow
      ? 'Create a draft sale and finalize later.'
      : isAddQuotationFlow
        ? 'Create a quotation and convert later.'
        : 'Create a new invoice for a customer.';
  const saveLabel = isEdit
    ? 'Update'
    : status === 'Draft'
      ? 'Save Draft'
      : (status === 'Quotation' || status === 'Proforma')
        ? 'Save Quotation'
        : 'Save';
  const saveAndPrintLabel = `${saveLabel} & Print`;
  const restoreEntityLabel = isAddQuotationFlow
    ? 'Quotation'
    : isAddDraftFlow
      ? 'Draft'
      : 'Sale';
  const previewDocumentTitle = status === 'Quotation'
    ? 'Quotation Preview'
    : status === 'Proforma'
      ? 'Proforma Preview'
      : status === 'Draft'
        ? 'Draft Preview'
        : 'Invoice Preview';
  const previewDocumentHeading = status === 'Quotation'
    ? 'QUOTATION'
    : status === 'Proforma'
      ? 'PROFORMA INVOICE'
      : status === 'Draft'
        ? 'DRAFT INVOICE'
        : 'INVOICE';
  const previewRows = useMemo(
    () => rows.filter(row => String(row?.name || '').trim() !== ''),
    [rows]
  );
  const previewQuantityPrecision = Number.isFinite(Number(settings.quantityPrecision))
    ? Math.max(0, Math.min(6, Math.round(Number(settings.quantityPrecision))))
    : 3;
  const previewNetSubtotal = Math.max(0, Number((subTotal - discountValue).toFixed(3)));
  const previewDueValue = Math.max(0, Number((grandTotal - paymentValue).toFixed(3)));
  const previewVatSummaryLabel = `VATIN (${settings.tax1Name || settings.taxLabel || 'VAT'}): (+)`;
  const previewBusinessName = String(selectedLocation?.name || settings.businessName || '--').trim() || '--';
  const previewBusinessAddressLine = (() => {
    const configuredAddress = String(settings.businessAddress || '').trim();
    if (configuredAddress) return configuredAddress;
    const parts = [selectedLocation?.city, selectedLocation?.state, selectedLocation?.country]
      .map(value => String(value || '').trim())
      .filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
    const cityFallback = String(settings.businessCity || '').trim();
    return cityFallback || '--';
  })();
  const previewBusinessTaxNumber = String(settings.taxNumber || settings.tax1Number || '').trim();
  const previewCustomerName = String(
    selectedCustomerObj?.name || selectedCustomerRecord?.businessName || selectedCustomerRecord?.name || 'Walk-in Customer'
  ).trim() || 'Walk-in Customer';
  const previewCustomerTaxNumber = String(selectedCustomerRecord?.taxNumber || '').trim();
  const previewCustomerMobile = String(
    selectedCustomerObj?.phone || selectedCustomerRecord?.mobile || selectedCustomerRecord?.phone || '--'
  ).trim() || '--';
  const previewPrintGeneratedAt = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date()),
    []
  );
  const previewInvoicePublicUrl = useMemo(() => {
    if (typeof window === 'undefined') return `invoice/${previewInvoiceNo}`;
    return `${window.location.origin}/invoice/${encodeURIComponent(previewInvoiceNo)}`;
  }, [previewInvoiceNo]);
  const showDraftOption = !settings.disableDraft || isAddDraftFlow || status === 'Draft';
  const showQuotationOption = !settings.disableQuotation || isAddQuotationFlow || status === 'Quotation' || status === 'Proforma';
  const isStatusLocked = forceInitialStatusLock || (isAddDraftFlow && isDraftStatusLocked) || (isAddQuotationFlow && isQuotationStatusLocked);

  return (
    <div className="space-y-8 animate-fade-in pb-32 max-w-[1800px] mx-auto">
        
        {/* Draft Prompt */}
        {showDraftPrompt && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl shadow-sm flex items-center justify-between animate-in slide-in-from-top-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                        <AlertCircle size={24} className="text-amber-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">Unsaved {restoreEntityLabel} Found</h3>
                        <p className="text-amber-700 text-sm">You have an unsaved {restoreEntityLabel.toLowerCase()}. Would you like to restore it?</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={discardDraft} className="text-sm bg-white border border-amber-200 hover:bg-amber-100 px-4 py-2 rounded-lg transition-colors font-medium">
                        Discard
                    </button>
                    <button onClick={restoreDraft} className="text-sm bg-amber-500 text-white hover:bg-amber-600 px-4 py-2 rounded-lg transition-colors font-medium">
                        Restore {restoreEntityLabel}
                    </button>
                </div>
            </div>
        )}

        {/* FROM ORDER BANNER */}
        {fromOrder && (
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-xl shadow-lg flex items-center justify-between animate-in slide-in-from-top-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                        <FileCheck size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">Converting Order to Invoice</h3>
                        <p className="text-blue-100 text-sm">{sourceOrderNumber ? `Order #${sourceOrderNumber} details have been pre-filled.` : 'Order details have been pre-filled.'}</p>
                    </div>
                </div>
                <button onClick={() => onNavigate && onNavigate('orders')} className="text-sm bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors font-medium">
                    Cancel & Return
                </button>
            </div>
        )}

        {/* Header */}
        <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                {isEdit ? <Edit className="text-blue-600" size={32} /> : <ShoppingCart className="text-blue-600" size={32} />}
                {pageTitle}
            </h2>
            <p className="text-slate-500 mt-1 text-lg">
                {pageDescription}
            </p>
        </div>

            {/* 1. Customer & General Info */}
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
            
            {/* Row 1: Business Location & Sale Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Business Location <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <select 
                            className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-700 appearance-none cursor-pointer"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                        >
                            <option value="">Select Location</option>
                            {selectableLocations.map(loc => (
                                <option key={loc.id} value={loc.name}>{loc.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>
                </div>

                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Sale Date <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="datetime-local" 
                            className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-700" 
                            value={saleDate}
                            onChange={(e) => setSaleDate(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Row 2: Sale Type, Customer, Pay Term */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Sale Type <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <select 
                            className={`w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-700 appearance-none ${settings.disableCreditSaleButton ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                            value={saleType}
                            onChange={(e) => setSaleType(e.target.value)}
                            disabled={settings.disableCreditSaleButton}
                        >
                            <option>Paid</option>
                            {!settings.disableCreditSaleButton && <option>Credit Sale</option>}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>
                    {settings.disableCreditSaleButton && (
                      <p className="text-[10px] text-slate-400 mt-1">Credit Sale is disabled in Settings.</p>
                    )}
                </div>

                {/* SEARCHABLE CUSTOMER DROPDOWN */}
                <div className="group" ref={customerDropdownRef}>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Customer</label>
                    <div className="flex gap-2 relative">
                        <div className="relative w-full">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="text"
                                className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-700 placeholder:font-normal"
                                placeholder="Direct Customer (type to search...)"
                                value={customerSearch}
                                onChange={(e) => {
                                    setCustomerSearch(e.target.value);
                                    setIsCustomerDropdownOpen(true);
                                    if(e.target.value === '') {
                                        setCustomer('');
                                        setSelectedCustomerObj(null);
                                    }
                                }}
                                onFocus={() => setIsCustomerDropdownOpen(true)}
                            />
                            {isCustomerDropdownOpen && (
                                <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 max-h-60 overflow-y-auto custom-scrollbar">
                                    {filteredCustomers.length > 0 ? (
                                        filteredCustomers.map(cust => (
                                            <div 
                                                key={cust.id}
                                                className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 flex justify-between items-center"
                                                onClick={() => handleCustomerSelect(cust)}
                                            >
                                                <div>
                                                    <div className="text-sm font-bold text-slate-800">{cust.name}</div>
                                                    {cust.phone && <div className="text-xs text-slate-400">{cust.phone}</div>}
                                                </div>
                                                <div className="text-[10px] font-bold px-2 py-1 bg-slate-100 rounded text-slate-500">
                                                    {cust.type}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="px-4 py-3 text-sm text-slate-400 italic">No customers found</div>
                                    )}
                                </div>
                            )}
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                        <button title="Add new customer" onClick={() => onNavigate?.('customers')} className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md transition-transform active:scale-95 flex-shrink-0"><Plus size={20} /></button>
                    </div>
                </div>

                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                      Pay Term {isFinalStatus && settings.isPayTermRequired && saleType === 'Credit Sale' && <span className="text-red-500">*</span>} <Info size={12} className="text-blue-500" />
                    </label>
                    <div className="flex">
                        <input 
                            type="number" 
                            placeholder="Term" 
                            className="w-1/2 px-4 py-3 rounded-l-xl bg-slate-50 border-r border-slate-200 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-700 outline-none"
                            value={payTermNumber}
                            onChange={(e) => setPayTermNumber(e.target.value)}
                        />
                        <select 
                            className="w-1/2 px-4 py-3 rounded-r-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-700 cursor-pointer outline-none"
                            value={payTermUnit}
                            onChange={(e) => setPayTermUnit(e.target.value)}
                        >
                            <option value="Days">Days</option>
                            <option value="Months">Months</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className={`grid grid-cols-1 ${metaGridClass} gap-6 mb-6`}>
                <div className="group">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Status <span className="text-red-500">*</span></label>
                      {(isAddDraftFlow || isAddQuotationFlow) && !forceInitialStatusLock && (
                        <button
                          type="button"
                          className={`text-[10px] font-bold px-2.5 py-1 rounded border transition ${
                            isStatusLocked
                              ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                          onClick={() => {
                            if (isAddDraftFlow) {
                              if (isDraftStatusLocked) {
                                setIsDraftStatusLocked(false);
                                return;
                              }
                              setStatus('Draft');
                              setIsDraftStatusLocked(true);
                              return;
                            }
                            if (isQuotationStatusLocked) {
                              setIsQuotationStatusLocked(false);
                              return;
                            }
                            setStatus('Quotation');
                            setIsQuotationStatusLocked(true);
                          }}
                        >
                          {isAddDraftFlow
                            ? (isDraftStatusLocked ? 'Convert Draft' : 'Lock Draft')
                            : (isQuotationStatusLocked ? 'Convert Quotation' : 'Lock Quotation')}
                        </button>
                      )}
                    </div>
                    <select 
                        className={`w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-700 ${
                          isStatusLocked ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'
                        }`}
                        value={status}
                        onChange={(e) => {
                          const newVal = e.target.value as 'Final' | 'Draft' | 'Quotation' | 'Proforma';
                          if ((status === 'Quotation' || status === 'Proforma') && newVal === 'Final') {
                            setPendingFinalStatus(newVal);
                          } else {
                            setStatus(newVal);
                          }
                        }}
                        disabled={isStatusLocked}
                    >
                        {forceInitialStatusLock && initialStatus ? (
                          <option>{initialStatus}</option>
                        ) : isAddDraftFlow && isDraftStatusLocked ? (
                          <option>Draft</option>
                        ) : isAddQuotationFlow && isQuotationStatusLocked ? (
                          <option>Quotation</option>
                        ) : (
                          <>
                            <option>Final</option>
                            {showDraftOption && <option>Draft</option>}
                            {showQuotationOption && <option>Quotation</option>}
                            {showQuotationOption && <option>Proforma</option>}
                          </>
                        )}
                    </select>
                    {isAddDraftFlow && isDraftStatusLocked && (
                      <p className="text-[10px] text-slate-400 mt-1">
                        Draft-first mode. Click <span className="font-bold">Convert Draft</span> to change status.
                      </p>
                    )}
                    {isAddQuotationFlow && isQuotationStatusLocked && (
                      <p className="text-[10px] text-slate-400 mt-1">
                        Quotation-first mode. Click <span className="font-bold">Convert Quotation</span> to change status.
                      </p>
                    )}
                    {forceInitialStatusLock && (
                      <p className="text-[10px] text-slate-400 mt-1">
                        Status is locked for this entry flow.
                      </p>
                    )}
                </div>

                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                      Commission Agent {commissionAgentRequiredInSale && isFinalStatus && <span className="text-red-500">*</span>}
                    </label>
                    <select
                        className={`w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-700 cursor-pointer ${
                          !commissionAgentEnabledInSale ? 'opacity-60 cursor-not-allowed' : ''
                        }`}
                        value={selectedCommissionAgentId}
                        onChange={(e) => {
                          setSelectedCommissionAgentId(e.target.value);
                          if (commissionAgentValidationError) setCommissionAgentValidationError('');
                        }}
                        disabled={!commissionAgentEnabledInSale}
                      >
                        <option value="">{commissionAgentEnabledInSale ? 'Select Agent' : 'Disabled in Settings'}</option>
                        {activeCommissionAgents.map(agent => (
                          <option key={agent.id} value={String(agent.id)}>
                            {agent.name} ({Number(agent.commissionPercentage || 0).toFixed(2)}%)
                          </option>
                        ))}
                    </select>
                    {commissionAgentEnabledInSale && selectedCommissionAgentId && (
                      <p className="text-[10px] text-slate-400 mt-1">
                        Calculation: {settings.commissionCalculationType}
                      </p>
                    )}
                    {commissionAgentValidationError && (
                      <p className="text-[10px] text-rose-600 mt-1">{commissionAgentValidationError}</p>
                    )}
                </div>

                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Selling Price Group</label>
                    <select
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-700 cursor-pointer"
                        value={selectedPriceGroupId}
                        onChange={(e) => setSelectedPriceGroupId(e.target.value)}
                    >
                        <option value="">
                            Auto ({resolvedSellingPriceGroup?.name || 'No active group'})
                        </option>
                        {activeSellingPriceGroups.map(group => (
                          <option key={group.id} value={group.id}>{group.name}</option>
                        ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Source: {resolvedSellingPriceGroupSource}
                      {customerGroupCalculationPercentage !== 0 && (
                        <> | Customer Group Adj: {customerGroupCalculationPercentage > 0 ? '+' : ''}{customerGroupCalculationPercentage}%</>
                      )}
                    </p>
                </div>

                {settings.showInvoiceScheme && (
                  <div className="group">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Invoice Scheme</label>
                      <select
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-700 cursor-pointer"
                          value={invoiceScheme}
                          onChange={(e) => setInvoiceScheme(e.target.value)}
                      >
                          {invoiceSchemeOptions.map((scheme) => (
                            <option key={scheme} value={scheme}>{scheme}</option>
                          ))}
                      </select>
                  </div>
                )}

                {settings.showInvoiceLayoutDropdown && (
                  <div className="group">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Invoice Layout</label>
                      <select
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-bold text-slate-700 cursor-pointer"
                          value={invoiceLayout}
                          onChange={(e) => setInvoiceLayout(e.target.value)}
                      >
                          {invoiceLayoutOptions.map((layout) => (
                            <option key={layout} value={layout}>{layout}</option>
                          ))}
                      </select>
                  </div>
                )}

                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Attach Document</label>
                    <input
                        ref={attachDocRef}
                        type="file"
                        accept=".pdf,.csv,.zip,.doc,.docx,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={(e) => setAttachedFileName(e.target.files?.[0]?.name || '')}
                    />
                    <div
                        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-slate-50 border border-dashed border-slate-300 hover:border-blue-400 transition-colors cursor-pointer hover:bg-white"
                        onClick={() => attachDocRef.current?.click()}
                    >
                        <Upload size={18} className="text-slate-400 hover:text-blue-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-slate-500 truncate">
                            {attachedFileName || 'pdf, csv, zip, doc, jpg, png'}
                        </span>
                        {attachedFileName && (
                            <button
                                className="ml-auto text-slate-400 hover:text-red-500 flex-shrink-0"
                                onClick={(e) => { e.stopPropagation(); setAttachedFileName(''); if (attachDocRef.current) attachDocRef.current.value = ''; }}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* 2. Products Grid */}
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
             
             {/* Search Bar */}
             <div className="mb-8 flex justify-center">
                 <div className="relative w-full max-w-4xl group" ref={topSearchRef}>
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <Search size={22} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-14 pr-28 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-lg text-slate-800 shadow-sm placeholder:text-slate-400 placeholder:font-medium"
                        placeholder="Enter Product name / SKU / Scan bar code"
                        value={topProductSearch}
                        onChange={(e) => { setTopProductSearch(e.target.value); setTopProductDropdownOpen(true); }}
                        onFocus={() => topProductSearch && setTopProductDropdownOpen(true)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (topWeighingBarcodeMatch) {
                              handleTopProductSelect(topWeighingBarcodeMatch.product, topWeighingBarcodeMatch.quantity);
                              return;
                            }
                            if (topFilteredProducts.length > 0) handleTopProductSelect(topFilteredProducts[0]);
                          }
                          if (e.key === 'Escape') setTopProductDropdownOpen(false);
                        }}
                    />
                    {topProductDropdownOpen && topFilteredProducts.length > 0 && (
                      <div className="absolute left-0 top-full mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto">
                        {topFilteredProducts.map(p => {
                          const packHint = getPackHint(p.unit, p.packagingType, p.unitsPerPackage);
                          return (
                            <div
                              key={p.id}
                              className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 flex justify-between items-center"
                              onMouseDown={() => handleTopProductSelect(p)}
                            >
                              <div>
                                <div className="font-bold text-sm text-slate-800">{p.name}</div>
                                <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                                  <span>SKU: {p.sku}</span>
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); openStockHistory(p); }}
                                    className={`font-bold hover:underline ${p.stock <= 0 ? 'text-red-500' : 'text-emerald-600'}`}
                                    title="Open stock history"
                                  >
                                    Stock: {p.stock}
                                  </button>
                                  <span>Price: {formatCurrency(getGroupedProductPrice(p))}</span>
                                  {packHint && <span>{packHint}</span>}
                                </div>
                              </div>
                              <div className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">{p.category || 'Product'}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                        <button
                          type="button"
                          className="p-2.5 bg-white border border-slate-200 rounded-xl text-purple-600 hover:bg-purple-50 hover:border-purple-200 shadow-sm transition-all"
                          onClick={() => setShowMultiPicker(true)}
                          title="Select multiple products at once"
                        >
                          <Layers size={20} />
                        </button>
                        <button className="p-2.5 bg-white border border-slate-200 rounded-xl text-blue-600 hover:bg-blue-50 hover:border-blue-200 shadow-sm transition-all" onClick={() => onNavigate?.('add-product')} title="Add new product">
                            <Plus size={20} />
                        </button>
                    </div>
                </div>
             </div>

             {/* Table */}
             <div className="overflow-x-auto rounded-xl border border-slate-200 mb-4">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="bg-[#5cb85c] text-white text-[11px] font-bold uppercase tracking-wider">
                            <th className="p-4 text-center w-12">#</th>
                            <th className="p-4 text-left w-64 border-l border-[#4cae4c]">Product Name</th>
                            <th className="p-4 text-center w-44 border-l border-[#4cae4c]">Quantity</th>
                            <th className="p-4 text-right w-32 border-l border-[#4cae4c]">Unit Price</th>
                            <th className="p-4 text-right w-28 border-l border-[#4cae4c]">Discount</th>
                            <th className="p-4 text-right w-40 border-l border-[#4cae4c]">Subtotal</th>
                            <th className="p-4 text-right w-40 border-l border-[#4cae4c]">Total</th>
                            <th className="p-4 text-center w-12 border-l border-[#4cae4c]"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {rows.map((row, index) => {
                          const prodSearch = rowProductSearch[row.id] ?? row.name;
                          const prodDropOpen = rowProductDropdownOpen[row.id] ?? false;
                          const filteredProds = getFilteredProducts(prodSearch && prodSearch !== row.name ? prodSearch : '');
                          const selectedProduct = products.find(p => p.id === row.productId);
                          const rowPackagingType = normalizePackagingType(selectedProduct?.packagingType || row.productPackagingType);
                          const rowUnitsPerPackage = normalizeUnitsPerPackage(row.unitsPerPackage ?? selectedProduct?.unitsPerPackage);
                          const quantityModes = getAvailableQuantityModes(rowPackagingType, rowUnitsPerPackage);
                          const rowQuantityMode = quantityModes.includes(normalizePackagingType(row.quantityMode))
                            ? normalizePackagingType(row.quantityMode)
                            : 'Piece';
                          const selectedProductPackHint = selectedProduct
                            ? getPackHint(selectedProduct.unit, selectedProduct.packagingType, selectedProduct.unitsPerPackage)
                            : null;
                          return (
                            <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 text-center font-bold text-slate-500">{index + 1}</td>
                                <td className="p-2 font-bold text-slate-800 min-w-[220px]">
                                    {/* Real product search input */}
                                    <div className="relative">
                                      <input
                                        type="text"
                                        value={prodSearch}
                                        placeholder="Search product by name or SKU..."
                                        onFocus={() => setRowProductDropdownOpen(prev => ({ ...prev, [row.id]: true }))}
                                        onChange={(e) => {
                                          setRowProductSearch(prev => ({ ...prev, [row.id]: e.target.value }));
                                          setRowProductDropdownOpen(prev => ({ ...prev, [row.id]: true }));
                                        }}
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none bg-white"
                                      />
                                      {prodDropOpen && (
                                        <div className="absolute left-0 top-full mt-1 w-80 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-56 overflow-y-auto">
                                          {filteredProds.length > 0 ? filteredProds.map(p => {
                                            const packHint = getPackHint(p.unit, p.packagingType, p.unitsPerPackage);
                                            return (
                                              <div
                                                key={p.id}
                                                className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 flex items-center gap-2"
                                                onMouseDown={() => handleProductSelectForRow(row.id, p)}
                                              >
                                                {p.image && (
                                                  <img src={p.image} alt={p.name} className="w-8 h-8 object-contain rounded border border-slate-200 bg-slate-50 flex-shrink-0" />
                                                )}
                                                <div className="min-w-0">
                                                  <div className="font-bold text-sm text-slate-800">{p.name}</div>
                                                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                                                    <span>SKU: {p.sku}</span>
                                                    <button
                                                      type="button"
                                                      onMouseDown={(e) => e.stopPropagation()}
                                                      onClick={(e) => { e.stopPropagation(); openStockHistory(p); }}
                                                      className={`font-bold hover:underline ${p.stock <= 0 ? 'text-red-500' : 'text-emerald-600'}`}
                                                      title="Open stock history"
                                                    >
                                                      Stock: {p.stock}
                                                    </button>
                                                    <span>Price: {formatCurrency(getGroupedProductPrice(p))}</span>
                                                    {packHint && <span>{packHint}</span>}
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          }) : (
                                            <div className="px-3 py-4 text-center text-slate-400 text-sm">No products found</div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    {selectedProduct && (
                                      <div className="flex items-center gap-2 mt-1 px-1">
                                        {selectedProduct.image && (
                                          <img
                                            src={selectedProduct.image}
                                            alt={selectedProduct.name}
                                            className="w-10 h-10 object-contain rounded-lg border border-slate-200 bg-slate-50 flex-shrink-0"
                                          />
                                        )}
                                        <div className="text-[10px] text-slate-400 font-normal">
                                          <button
                                            type="button"
                                            onClick={() => openStockHistory(selectedProduct)}
                                            className="text-blue-600 hover:underline"
                                            title="Open stock history"
                                          >
                                            Stock: {selectedProduct.stock} {selectedProduct.unit}
                                          </button>
                                          {selectedProductPackHint && <span> | {selectedProductPackHint}</span>}
                                          <span> | {selectedProduct.category}</span>
                                        </div>
                                      </div>
                                    )}
                                </td>
                                <td className="p-2">
                                    <div className="space-y-1">
                                      <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={row.qty}
                                        onChange={(e) => updateRow(row.id, 'qty', e.target.value)}
                                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-center text-sm font-bold text-slate-700 outline-none bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                      />
                                      <select
                                        value={rowQuantityMode}
                                        onChange={(e) => updateRow(row.id, 'quantityMode', e.target.value)}
                                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                      >
                                        {quantityModes.map(mode => (
                                          <option key={`${row.id}-${mode}`} value={mode}>{mode}</option>
                                        ))}
                                      </select>
                                      <div className="text-[10px] text-center text-slate-500 font-semibold">Quantity in pieces</div>
                                    </div>
                                </td>
                                <td className="p-3">
                                    <input 
                                        type="number" 
                                        min="0"
                                        step="0.001"
                                        value={row.unitPrice} 
                                        onChange={(e) => updateRow(row.id, 'unitPrice', e.target.value)}
                                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-right text-sm font-medium text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                    />
                                </td>
                                <td className="p-3">
                                    <input 
                                        type="number" 
                                        min="0"
                                        step="0.001"
                                        max={Number((Math.max(0, Number(row.qty || 0)) * Math.max(0, Number(row.unitPrice || 0))).toFixed(3))}
                                        value={row.discount} 
                                        onChange={(e) => updateRow(row.id, 'discount', e.target.value)}
                                        className={`w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-right text-sm font-medium text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none ${!canEditSaleDiscount ? 'cursor-not-allowed opacity-70' : ''}`} 
                                        placeholder="0.00"
                                        disabled={!canEditSaleDiscount}
                                    />
                                </td>
                                <td className="p-4 text-right font-medium text-slate-600">{row.subtotal.toFixed(3)}</td>
                                <td className="p-4 text-right font-bold text-slate-800">{row.total.toFixed(3)}</td>
                                <td className="p-4 text-center">
                                    <button onClick={() => handleRemoveRow(row.id)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                                </td>
                            </tr>
                          );
                        })}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                                    Scan barcode or search to add items
                                </td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 text-xs font-bold text-slate-700 uppercase">
                        <tr>
                            <td colSpan={2} className="p-4">Total Items: <span className="text-slate-900 ml-1">{rows.length}</span></td>
                            <td colSpan={4} className="p-4 text-right">Net Total Amount:</td>
                            <td className="p-4 text-right font-mono text-base text-slate-900">{subTotal.toFixed(3)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
             </div>
        </div>

        {/* 3. Discount, Tax & Note */}
        <div className="bg-white rounded shadow-sm border border-slate-200 p-6">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Discount Type:*</label>
                    <select 
                        className={`w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white ${!canEditSaleDiscount ? 'cursor-not-allowed opacity-70 bg-slate-100' : ''}`}
                        value={discountType}
                        disabled={!canEditSaleDiscount}
                        onChange={(e) => {
                          const nextType = e.target.value;
                          setIsDiscountManuallyOverridden(true);
                          setDiscountType(nextType);
                          if (nextType === 'None') {
                            setDiscountAmount('');
                            return;
                          }
                          setDiscountAmount(prev => sanitizeOrderDiscountAmount(nextType, prev, subTotal));
                        }}
                    >
                        <option>None</option>
                        <option>Percentage</option>
                        <option>Fixed</option>
                    </select>
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Discount Amount:*</label>
                    <input
                        type="number"
                        min="0"
                        step="0.001"
                        max={discountType === 'Percentage' ? 100 : Number(subTotal.toFixed(3))}
                        className={`w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm ${
                          discountType === 'None' || !canEditSaleDiscount ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''
                        }`}
                        value={discountAmount}
                        onChange={(e) => {
                          setIsDiscountManuallyOverridden(true);
                          const raw = parseOptionalNumberInput(e.target.value);
                          setDiscountAmount(sanitizeOrderDiscountAmount(discountType, raw, subTotal));
                        }}
                        disabled={discountType === 'None' || !canEditSaleDiscount}
                    />
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Order Tax:*</label>
                    <select 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                        value={orderTax}
                        onChange={(e) => setOrderTax(e.target.value)}
                    >
                        <option value="None">None</option>
                        {taxRates.map(tr => (
                          <option key={tr.id} value={tr.name}>{tr.name} ({tr.rate}%)</option>
                        ))}
                    </select>
                </div>
             </div>
             {!isEdit && matchedAutoDiscountRule && (
                <div className="mb-4 p-3 rounded border border-emerald-100 bg-emerald-50/70 text-xs text-emerald-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span>
                      Auto discount rule: <span className="font-bold">{matchedAutoDiscountRule.name}</span> ({matchedAutoDiscountRule.discountType} {formatDiscountAmount(matchedAutoDiscountRule)})
                    </span>
                    {isDiscountManuallyOverridden && canEditSaleDiscount && (
                      <button
                        type="button"
                        onClick={() => setIsDiscountManuallyOverridden(false)}
                        className="px-3 py-1 rounded bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700"
                      >
                        Apply Auto Discount
                      </button>
                    )}
                </div>
             )}
             {!canEditSaleDiscount && (
                <div className="mb-4 text-[11px] text-amber-600">
                    Discount editing is disabled for your role.
                </div>
             )}
             
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                 <div className="group md:col-span-3">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Sell note</label>
                    <textarea 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm resize-none" 
                        rows={3}
                        value={sellNote}
                        onChange={(e) => setSellNote(e.target.value)}
                    ></textarea>
                </div>
             </div>
             
             <div className="flex justify-end text-xs text-slate-500 space-y-1 flex-col items-end border-t border-slate-100 pt-4">
                 <div className="flex justify-between w-64"><span>Discount Amount: (-)</span> <span>{formatCurrency(discountValue)}</span></div>
                 <div className="flex justify-between w-64"><span>Order Tax: (+)</span> <span>{formatCurrency(orderTaxValue)}</span></div>
             </div>
        </div>

        {/* 4. Shipping */}
        <div className="bg-white rounded shadow-sm border border-slate-200 p-6">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                 <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Shipping Details</label>
                    <textarea 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm resize-none" 
                        rows={2}
                        value={shippingDetails}
                        onChange={(e) => setShippingDetails(e.target.value)}
                    ></textarea>
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Shipping Address</label>
                    <textarea 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm resize-none" 
                        rows={2}
                        value={shippingAddress}
                        onChange={(e) => setShippingAddress(e.target.value)}
                    ></textarea>
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Shipping Charges</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{settings.currencySymbol}</span>
                        <input
                            type="number"
                            className="w-full pl-12 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                            placeholder="0.000"
                            value={shippingCharges}
                            onChange={(e) => setShippingCharges(parseOptionalNumberInput(e.target.value))}
                        />
                    </div>
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Shipping Status</label>
                    <select 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                        value={shippingStatus}
                        onChange={(e) => {
                          const nextStatus = e.target.value as ShippingStatus;
                          setShippingStatus(isFinalStatus ? 'Delivered' : nextStatus);
                        }}
                    >
                        {SHIPPING_STATUS_OPTIONS.map(statusOption => (
                          <option key={statusOption} value={statusOption}>{statusOption}</option>
                        ))}
                    </select>
                    {isFinalStatus && (
                      <p className="text-[11px] text-slate-500 mt-1">Final sales are auto-marked as Delivered.</p>
                    )}
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Delivered To</label>
                    <input 
                        type="text" 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                        value={deliveredTo}
                        onChange={(e) => setDeliveredTo(e.target.value)}
                    />
                </div>
             </div>
             
             <div className="flex justify-end pt-4 border-t border-slate-100">
                 <div className="text-right">
                     <span className="block text-xs font-bold text-slate-700 uppercase mb-1">Total Payable:</span>
                      <span className="text-lg font-bold text-slate-900">{formatCurrency(grandTotal)}</span>
                 </div>
             </div>
        </div>

        {!isFinalStatus && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl shadow-sm">
            <div className="font-bold text-sm">Payment section is hidden for non-final statuses.</div>
            <div className="text-xs mt-1">Set status to <span className="font-bold">Final</span> to add payment details.</div>
          </div>
        )}

        {/* 4. Payment */}
        {isFinalStatus && (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-700 to-slate-900"></div>
             <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6">
                <CreditCard size={20} className="text-slate-700" /> Add Payment
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Advance Balance</label>
                    <div className="w-full px-4 py-3 rounded-xl bg-slate-100 border-transparent text-sm font-bold text-slate-500 cursor-not-allowed">
                        {formatCurrency(customerAdvanceBalance)}
                    </div>
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Amount <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text"
                            inputMode="decimal"
                            className={`w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 transition-all text-sm font-bold text-slate-900 ${saleType === 'Credit Sale' ? 'opacity-50 cursor-not-allowed' : ''}`} 
                            placeholder="0.000"
                            value={amount}
                            onChange={(e) => setAmount(sanitizePaymentAmountInput(e.target.value))}
                            onBlur={() => setAmount(amount === '' ? '' : formatPaymentAmount(amount))}
                            readOnly={saleType === 'Credit Sale'}
                        />
                    </div>
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Paid on <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="datetime-local" 
                            className={`w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 transition-all text-sm font-bold text-slate-700 ${
                              saleType === 'Credit Sale' ? 'opacity-50 cursor-not-allowed' : ''
                            }`} 
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            disabled={saleType === 'Credit Sale'}
                        />
                    </div>
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Method <span className="text-red-500">*</span></label>
                    <select
                        className={`w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 transition-all text-sm font-bold text-slate-700 ${saleType === 'Credit Sale' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        value={saleType === 'Credit Sale' ? '' : paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        disabled={saleType === 'Credit Sale'}
                    >
                        {saleType === 'Credit Sale' ? (
                          <option value="">--</option>
                        ) : (
                          (() => {
                            const locObj = locations.find(l => l.name === location);
                            const methods = locObj?.paymentMethods?.filter(pm => pm.enabled) || [];
                            if (methods.length > 0) {
                              return methods.map(pm => <option key={pm.id} value={pm.name}>{pm.name}</option>);
                            }
                            return ['Cash', 'Card', 'Cheque', 'Bank Transfer'].map(m => <option key={m} value={m}>{m}</option>);
                          })()
                        )}
                    </select>
                </div>
                <div className="md:col-span-2 group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Account</label>
                    <select 
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 transition-all text-sm font-bold text-slate-700 opacity-50 cursor-not-allowed"
                        value={paymentAccount}
                        onChange={(e) => setPaymentAccount(e.target.value)}
                        disabled
                    >
                        {saleType === 'Credit Sale' ? (
                          <option>None</option>
                        ) : (
                          <option>{resolveDefaultAccountFromMethod(paymentMethod || getDefaultPaymentMethod())}</option>
                        )}
                    </select>
                </div>
                <div className="md:col-span-2 group">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Note</label>
                    <textarea 
                        className={`w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-slate-500 focus:ring-4 focus:ring-slate-500/10 transition-all text-sm font-medium text-slate-700 resize-none ${
                          saleType === 'Credit Sale' ? 'opacity-50 cursor-not-allowed' : ''
                        }`} 
                        rows={1}
                        value={paymentNote}
                        onChange={(e) => setPaymentNote(e.target.value)}
                        disabled={saleType === 'Credit Sale'}
                    ></textarea>
                </div>
            </div>

            <div className="pt-6 border-t border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Change Return</label>
                        <div className="text-xl font-mono font-bold text-slate-700">
                            {formatRiyal(changeReturn)}
                        </div>
                    </div>
                    <div className="text-right">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Balance</label>
                        <div className={`text-xl font-mono font-bold ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {formatRiyal(Math.max(0, balance))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        )}

        {/* Sticky Action Footer */}
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-slate-900/90 backdrop-blur-md text-white px-3 py-2.5 rounded-full shadow-2xl flex items-center gap-3 border border-white/10 hover:scale-105 transition-transform duration-300">
             <button 
                className="px-6 py-2.5 rounded-full font-bold text-xs bg-slate-700 hover:bg-slate-600 shadow-lg transition flex items-center gap-2"
                onClick={() => setShowPreview(true)}
             >
                <Eye size={16} /> Preview
            </button>
             <button onClick={handleSave} className="px-6 py-2.5 rounded-full font-bold text-xs bg-indigo-600 hover:bg-indigo-500 shadow-lg transition flex items-center gap-2">
                <Save size={16} /> {saveLabel}
            </button>
            <button onClick={handleSaveAndPrint} className="px-6 py-2.5 rounded-full font-bold text-xs bg-emerald-600 hover:bg-emerald-500 shadow-lg transition flex items-center gap-2">
                <Printer size={16} /> {saveAndPrintLabel}
            </button>
       </div>

        {/* Invoice Preview Modal */}
        {showPreview && (
            <div
                id="sale-invoice-preview-root"
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300 print:p-0 print:bg-white print:static print:h-auto print:block"
            >
                <div className={`w-full max-w-[210mm] h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 print:shadow-none print:h-auto print:max-w-none print:rounded-none print:overflow-visible border ${previewLayoutConfig.theme.surfaceClass}`}>
                    
                    {/* Modal Header */}
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 print:hidden">
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <FileText size={18} className="text-slate-500" /> {previewDocumentTitle}
                        </h3>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handlePreviewPrint}
                            className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-bold hover:bg-slate-900 transition-colors flex items-center gap-2"
                          >
                            <Printer size={15} /> Print
                          </button>
                          <button onClick={() => setShowPreview(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
                              <X size={20} />
                          </button>
                        </div>
                    </div>
                    <div className="hidden print:block bg-white text-black">
                      <style>{`
                        @page { size: A4; margin: 5mm; }
                        @media print {
                          html, body { margin: 0 !important; padding: 0 !important; }
                          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                          body * { visibility: hidden !important; }
                          #sale-invoice-preview-root, #sale-invoice-preview-root * { visibility: visible !important; }
                          #sale-invoice-preview-root {
                            position: fixed !important;
                            inset: 0 !important;
                            z-index: 2147483647 !important;
                            background: #fff !important;
                            margin: 0 !important;
                            padding: 0 !important;
                          }
                          #sale-invoice-preview-root > div { margin: 0 !important; }
                        }
                      `}</style>
                    </div>

                    {/* Invoice Content */}
                    <div className={`flex-1 overflow-y-auto p-8 custom-scrollbar print:hidden ${previewLayoutConfig.theme.contentWrapClass}`}>
                        <div className={`max-w-[210mm] mx-auto bg-white shadow-sm p-12 min-h-[297mm] flex flex-col print:shadow-none print:p-8 ${previewLayoutConfig.theme.bodyTextSizeClass}`}>
                            
                            {/* Invoice Header */}
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <div className="text-2xl font-black tracking-tight text-slate-900 mb-2">
                                      {settings.businessName || 'Business Name'}
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        {selectedLocation?.landmark || '--'}<br />
                                        {[selectedLocation?.city, selectedLocation?.state, selectedLocation?.country].filter(Boolean).join(', ') || '--'}<br />
                                        {selectedLocation?.mobile ? `Mobile: ${selectedLocation.mobile}` : ''}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <h2 className="text-2xl font-bold text-slate-900 mb-1">{previewDocumentHeading}</h2>
                                    <p className="text-sm font-medium text-slate-500 mb-1"># {previewInvoiceNo}</p>
                                    <p className="text-xs text-slate-400">Date: {formatPreviewDateTime(saleDate)}</p>
                                    <p className="text-xs text-slate-400">Location: {location || '--'}</p>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 my-4"></div>

                            {/* Bill To */}
                            <div className="mb-8">
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Bill To:</h4>
                                <p className="text-sm font-bold text-slate-800">
                                    {selectedCustomerObj ? selectedCustomerObj.name : 'Direct Customer'}
                                </p>
                                <p className="text-xs text-slate-500">{selectedCustomerObj?.billingAddress || shippingAddress || '--'}</p>
                                <p className="text-xs text-slate-500">Ph: {selectedCustomerObj?.phone || '--'}</p>
                            </div>

                            {/* Items Table */}
                            <div className="mb-8">
                                <table className="w-full text-xs text-left">
                                    <thead className={`${previewLayoutConfig.theme.tableHeadClass} border-b border-slate-200`}>
                                        <tr>
                                            <th className="py-3 px-4 text-center font-bold w-12">S/N</th>
                                            <th className="py-3 px-4 font-bold">Item</th>
                                            <th className="py-3 px-4 text-center font-bold">Qty</th>
                                            <th className="py-3 px-4 text-right font-bold">Price</th>
                                            <th className="py-3 px-4 text-right font-bold">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className={`${previewLayoutConfig.theme.tableBodyClass} divide-y divide-slate-100`}>
                                        {previewRows.length > 0 ? (
                                          previewRows.map((row, i) => (
                                              <tr key={`${row.productId || row.id || row.name}-${i}`}>
                                                  <td className="py-3 px-4 text-center text-slate-500">{i + 1}</td>
                                                  <td className="py-3 px-4 font-medium text-slate-700">{row.name}</td>
                                                  <td className="py-3 px-4 text-center text-slate-600">{row.qty}</td>
                                                  <td className="py-3 px-4 text-right text-slate-600">{formatCurrency(Number(row.unitPrice || 0))}</td>
                                                  <td className="py-3 px-4 text-right font-bold text-slate-800">{formatCurrency(Number(row.total || 0))}</td>
                                              </tr>
                                          ))
                                        ) : (
                                          <tr>
                                            <td colSpan={5} className="py-8 px-4 text-center text-slate-400 italic">
                                              No line items available.
                                            </td>
                                          </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Totals */}
                            <div className="mt-auto flex justify-end">
                                <div className="w-64 space-y-2">
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span>Subtotal:</span>
                                        <span>{formatCurrency(subTotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span>Order Tax ({orderTax}):</span>
                                        <span>{formatCurrency(orderTaxValue)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span>Discount:</span>
                                        <span>-{formatCurrency(discountValue)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span>Shipping:</span>
                                        <span>{formatCurrency(typeof shippingCharges === 'number' ? shippingCharges : 0)}</span>
                                    </div>
                                    <div className="border-t border-slate-200 pt-2 flex justify-between text-lg font-black text-slate-900">
                                        <span>Total:</span>
                                        <span>{formatCurrency(grandTotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-emerald-600 font-bold pt-1">
                                        <span>Paid:</span>
                                        <span>{formatCurrency(paymentValue)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-red-600 font-bold">
                                        <span>Balance Due:</span>
                                        <span>{formatCurrency(Math.max(0, balance))}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 text-center text-[10px] text-slate-400">
                                <p>Thank you for your business!</p>
                                <p>Terms & Conditions Apply.</p>
                            </div>

                            {selectedCustomerRecord && (
                              <div className="mt-4 mr-auto w-full max-w-[52mm] border-2 border-dashed border-slate-400 rounded px-3 py-2 bg-slate-50">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">Account Statement</p>
                                <div className="flex justify-between items-baseline">
                                  <span className="text-[10px] text-slate-600">Total Outstanding:</span>
                                  <span className="text-sm font-black text-slate-800">{formatCurrency(Math.max(0, Number(selectedCustomerRecord.totalSellDue || 0)))}</span>
                                </div>
                                <p className="text-[8px] text-slate-400 mt-0.5">Balance across all invoices</p>
                              </div>
                            )}
                        </div>
                    </div>

                    <div className="hidden print:block bg-white text-black">
                      <div className="mx-auto w-full max-w-[200mm] px-0.5 py-0 text-[11px] leading-snug">
                        <div className="border-b border-slate-400 pb-2">
                          <div className="grid grid-cols-[84px_1fr_170px] items-start gap-2">
                            <div className="pt-1">
                              {settings.businessLogo ? (
                                <img
                                  src={settings.businessLogo}
                                  alt="Business logo"
                                  className="h-14 w-auto object-contain"
                                />
                              ) : (
                                <div className="h-14 w-14 border border-slate-400 text-[9px] text-slate-500 grid place-items-center">
                                  LOGO
                                </div>
                              )}
                            </div>
                            <div className="text-center">
                              <p className="text-[13px] font-bold uppercase tracking-wide">{previewBusinessName}</p>
                              <p>{previewBusinessAddressLine}</p>
                              <p>VATIN {previewBusinessTaxNumber || '--'}</p>
                              <p className="mt-1 text-[13px] font-bold">Tax Invoice</p>
                            </div>
                            <div className="text-right">
                              <div className="grid grid-cols-[78px_1fr] gap-x-1">
                                <span className="font-semibold">Invoice No.</span>
                                <span>{previewInvoiceNo || '--'}</span>
                                <span className="font-semibold">Date</span>
                                <span>{formatPreviewDateTime(saleDate)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-[72px_1fr] gap-y-0.5 gap-x-2">
                          <span className="font-semibold">Customer</span>
                          <span>{previewCustomerName}</span>
                          <span className="font-semibold">VATIN</span>
                          <span>{previewCustomerTaxNumber || '--'}</span>
                          <span className="font-semibold">Mobile</span>
                          <span>{previewCustomerMobile}</span>
                        </div>

                        <div className="mt-3 border border-slate-400">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-slate-100">
                                <th className="border-b border-slate-400 px-2 py-1 text-left font-semibold">Product</th>
                                <th className="border-b border-slate-400 px-2 py-1 text-right font-semibold">Quantity</th>
                                <th className="border-b border-slate-400 px-2 py-1 text-right font-semibold">Unit Price</th>
                                <th className="border-b border-slate-400 px-2 py-1 text-right font-semibold">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {previewRows.length > 0 ? (
                                previewRows.map((row, idx) => {
                                  const quantity = Number(row.qty || 0);
                                  const unitPrice = Number(row.unitPrice || 0);
                                  const lineSubtotal = Number(row.total ?? row.subtotal ?? (quantity * unitPrice));
                                  return (
                                    <tr key={`${row.productId || row.id || row.name || 'row'}-${idx}`}>
                                      <td className="border-b border-slate-200 px-2 py-1">{row.name || '--'}</td>
                                      <td className="border-b border-slate-200 px-2 py-1 text-right">
                                        {quantity.toFixed(previewQuantityPrecision)}
                                      </td>
                                      <td className="border-b border-slate-200 px-2 py-1 text-right">{formatCurrency(unitPrice)}</td>
                                      <td className="border-b border-slate-200 px-2 py-1 text-right">{formatCurrency(lineSubtotal)}</td>
                                    </tr>
                                  );
                                })
                              ) : (
                                <tr>
                                  <td colSpan={4} className="px-2 py-6 text-center italic text-slate-500">
                                    No products found.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div className="mt-3 ml-auto w-full max-w-[96mm] border border-slate-400">
                          {[
                            { label: 'Due', value: formatCurrency(previewDueValue) },
                            { label: 'Subtotal', value: formatCurrency(previewNetSubtotal) },
                            { label: previewVatSummaryLabel, value: formatCurrency(orderTaxValue) },
                            { label: 'Total', value: formatCurrency(grandTotal), bold: true },
                          ].map((row: any) => (
                            <div
                              key={row.label}
                              className={`grid grid-cols-[1fr_auto] border-b border-slate-300 px-2 py-1 last:border-b-0 ${row.bold ? 'font-bold' : ''}`}
                            >
                              <span>{row.label}</span>
                              <span>{row.value}</span>
                            </div>
                          ))}
                        </div>

                        {selectedCustomerRecord && (
                          <div className="mt-3 mr-auto w-full max-w-[96mm] border-2 border-dashed border-slate-500 px-3 py-2">
                            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">Account Statement</div>
                            <div className="flex justify-between items-baseline">
                              <span className="text-[10px] text-slate-700">Total Outstanding (all invoices):</span>
                              <span className="font-black text-[12px]">{formatCurrency(Math.max(0, Number(selectedCustomerRecord.totalSellDue || 0)))}</span>
                            </div>
                          </div>
                        )}

                        <div className="mt-5 grid grid-cols-2 gap-6">
                          <div>
                            <p className="font-semibold">Credit</p>
                            <p className="mt-4 font-semibold">Received By</p>
                            <p className="mt-3">Name: ____________________</p>
                            <p className="mt-2">Signature: ________________</p>
                          </div>
                          <div className="self-end text-[10px] text-slate-700">
                            Received in good condition; payment as agreed.
                          </div>
                        </div>

                        <div className="mt-8 grid grid-cols-[auto_auto_1fr_auto] gap-2 border-t border-slate-400 pt-2 text-[10px] text-slate-700">
                          <span>{previewPrintGeneratedAt}</span>
                          <span>{previewInvoiceNo || '--'}</span>
                          <span className="truncate">{previewInvoicePublicUrl}</span>
                          <span>1/1</span>
                        </div>
                      </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 print:hidden">
                        <button onClick={() => setShowPreview(false)} className="px-6 py-2.5 border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-white hover:shadow-sm transition-all text-sm">
                            Close
                        </button>
                        <button onClick={handleSave} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 shadow-lg transition-all text-sm flex items-center gap-2">
                            <Save size={16} /> {saveLabel}
                        </button>
                        <button onClick={handleSaveAndPrint} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 shadow-lg shadow-emerald-900/20 transition-all text-sm flex items-center gap-2">
                            <Printer size={16} /> {saveAndPrintLabel}
                        </button>
                    </div>
                </div>
            </div>
        )}

        <ProductStockHistory
          isOpen={isStockHistoryOpen}
          onClose={() => setIsStockHistoryOpen(false)}
          product={stockHistoryProduct}
          pageMode={true}
        />

        {showMultiPicker && (
          <MultiProductPicker
            products={getLocationScopedProducts()}
            getPrice={getGroupedProductPrice}
            formatCurrency={formatCurrency}
            onConfirm={handleBulkAddProducts}
            onClose={() => setShowMultiPicker(false)}
          />
        )}

        {pendingFinalStatus && createPortal(
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in zoom-in-95">
              <h3 className="text-lg font-black text-slate-900">Convert to Final Sale?</h3>
              <p className="text-sm text-slate-600">
                Converting this Quotation to a Final sale will deduct stock and generate an invoice. This cannot be easily undone.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setPendingFinalStatus(null)}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setStatus(pendingFinalStatus as 'Final'); setPendingFinalStatus(null); }}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition shadow-md"
                >
                  Confirm — Convert to Final
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

    </div>
  );
};

export default AddSale;
