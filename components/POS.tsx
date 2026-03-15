import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, User, Trash2, Pause, RotateCcw,
  CreditCard, Plus, Calculator, History,
  LayoutGrid, Tag, ChevronLeft, Maximize,
  Minus, PlusCircle, Calendar, FileText, XCircle,
  Banknote, Wallet, X, ShoppingCart, Undo2, Monitor
} from 'lucide-react';
import { useGlobalContext, Product as GlobalProduct } from '../src/context/GlobalContext';
import { useNotifications } from '../src/context/NotificationContext';
import { findBestApplicableDiscount, formatDiscountAmount, resolveAppliedDiscount } from '../src/utils/discountRules';
import ProductStockHistory from './ProductStockHistory';
import {
  addRegisterTransaction,
  closeRegisterSession,
  getActiveRegisterSession,
  getRegisterTransactions,
  RegisterSessionRecord,
} from '../src/utils/registerLedger';
import { normalizeSkuDigits, parseWeighingScaleBarcode } from '../src/utils/weighingScaleBarcode';
import { notifyReceiptPrintFallback } from '../src/utils/receiptPrinting';

interface CartItem extends GlobalProduct {
  cartId: number;
  qty: number;
  subtotal: number;
}

interface POSProps {
  onNavigate?: (page: string) => void;
}

type CheckoutMode = 'paid' | 'card' | 'credit' | 'multi' | 'draft' | 'quotation' | 'suspend';

const normalizeText = (value?: string) => String(value || '').trim().toLowerCase();

/** Check if a KeyboardEvent matches a shortcut string like 'f2', 'shift+e', 'ctrl+f4' */
const matchesShortcut = (e: KeyboardEvent, shortcut: string): boolean => {
  if (!shortcut) return false;
  const parts = shortcut.toLowerCase().split('+');
  const key = parts[parts.length - 1];
  const needsShift = parts.includes('shift');
  const needsCtrl = parts.includes('ctrl');
  const needsAlt = parts.includes('alt');
  return (
    e.key.toLowerCase() === key &&
    e.shiftKey === needsShift &&
    e.ctrlKey === needsCtrl &&
    e.altKey === needsAlt
  );
};

const displayShortcut = (s: string) => s.toUpperCase();
const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const POS: React.FC<POSProps> = ({ onNavigate }) => {
  const {
    products: globalProducts,
    addSale,
    nextInvoiceNumber,
    invoiceSchemes,
    invoiceLayouts,
    locations,
    customers,
    currentUser,
    roles,
    discounts,
    settings,
    formatCurrency,
    printers,
    addCustomerRewardPoints,
  } = useGlobalContext();
  const { addNotification } = useNotifications();

  const [dateTime, setDateTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'category' | 'brand'>('category');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState('WALK-IN');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [registerSession, setRegisterSession] = useState<RegisterSessionRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isStockHistoryOpen, setIsStockHistoryOpen] = useState(false);
  const [stockHistoryProduct, setStockHistoryProduct] = useState<GlobalProduct | null>(null);

  const [discount, setDiscount] = useState<number>(0);
  const [isDiscountManuallyOverridden, setIsDiscountManuallyOverridden] = useState(false);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [shipping, setShipping] = useState<number>(0);

  // Cash denomination picker state
  const [showDenomPicker, setShowDenomPicker] = useState(false);
  const [denomTendered, setDenomTendered] = useState<number>(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);

  const products = globalProducts;
  const activeLocations = useMemo(
    () => locations.filter(location => location.isActive !== false),
    [locations]
  );
  const defaultLocationId = useMemo(
    () => activeLocations[0]?.id || locations[0]?.id || '',
    [activeLocations, locations]
  );
  const selectableLocations = useMemo(() => {
    if (!selectedLocationId) return activeLocations;
    const current = locations.find(location => location.id === selectedLocationId);
    if (
      current &&
      current.isActive === false &&
      !activeLocations.some(location => location.id === current.id)
    ) {
      return [current, ...activeLocations];
    }
    return activeLocations;
  }, [activeLocations, locations, selectedLocationId]);

  const selectedCustomer = customers.find(c => c.id === customerId);
  const selectedLocation = locations.find(loc => loc.id === selectedLocationId);
  const locationScopedProducts = useMemo(() => {
    const selectedLocationName = normalizeText(selectedLocation?.name);
    if (!selectedLocationName) return products;
    return products.filter(product => normalizeText(product.businessLocation) === selectedLocationName);
  }, [products, selectedLocation?.name]);
  const categories = useMemo(
    () => ['All', ...Array.from(new Set(locationScopedProducts.map(product => product.category).filter(Boolean)))],
    [locationScopedProducts]
  );
  const brands = useMemo(
    () => ['All', ...Array.from(new Set(locationScopedProducts.map(product => product.brand).filter(Boolean)))],
    [locationScopedProducts]
  );
  const featuredProductKeys = useMemo(
    () =>
      String(selectedLocation?.posFeaturedProducts || '')
        .split(',')
        .map(token => normalizeText(token))
        .filter(Boolean),
    [selectedLocation?.posFeaturedProducts]
  );

  const currentRoleRecord = roles.find(role => role.name === currentUser?.role);
  const rolePermissions = currentRoleRecord?.permissions || [];
  const roleHasExplicitPermissions = rolePermissions.length > 0;
  const hasRolePermission = (moduleName: string, permission: string) => {
    if (!currentUser) return false;
    if (String(currentUser.role || '').toLowerCase() === 'admin' || currentRoleRecord?.isSystem) return true;
    if (!roleHasExplicitPermissions) return true;
    return rolePermissions.includes(permission) || rolePermissions.includes(`${moduleName}::${permission}`);
  };
  const canAccessSellReturns =
    hasRolePermission('Sell', 'Access all sell return') ||
    hasRolePermission('Sell', 'Access own sell return');
  const canEditPosDiscount = hasRolePermission('POS', 'Edit product discount from POS screen');
  const canAddExpenses = settings.enableExpenses && hasRolePermission('Expense', 'Add Expense');

  const discountMatchItems = useMemo(
    () => cart.map(item => ({
      id: item.id,
      name: item.name,
      brand: item.brand,
      category: item.category,
    })),
    [cart]
  );

  const matchedAutoDiscountRule = useMemo(
    () => findBestApplicableDiscount(discounts || [], {
      saleDate: dateTime,
      location: selectedLocation?.name || '',
      customerGroup: selectedCustomer?.customerGroup || '',
      items: discountMatchItems,
    }),
    [discounts, dateTime, selectedLocation?.name, selectedCustomer?.customerGroup, discountMatchItems]
  );

  const cartSubTotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.subtotal, 0),
    [cart]
  );
  const autoAppliedDiscount = useMemo(
    () => resolveAppliedDiscount(matchedAutoDiscountRule, cartSubTotal),
    [matchedAutoDiscountRule, cartSubTotal]
  );

  const formatDateTimeDisplay = (value: Date) => {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const year = value.getFullYear();
    const hours24 = value.getHours();
    const hours12 = String(hours24 % 12 || 12).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    const meridiem = hours24 >= 12 ? 'PM' : 'AM';
    const dateOnly = settings.dateFormat === 'mm/dd/yyyy'
      ? `${month}/${day}/${year}`
      : `${day}/${month}/${year}`;
    return settings.timeFormat === '24'
      ? `${dateOnly} ${String(hours24).padStart(2, '0')}:${minutes}`
      : `${dateOnly} ${hours12}:${minutes} ${meridiem}`;
  };

  const calculateTotals = () => {
    const subtotal = cartSubTotal;
    const effectiveTaxRate = settings.posEnableTax ? taxRate : 0;
    const effectiveDiscount = settings.posEnableDiscount
      ? (isDiscountManuallyOverridden ? discount : (autoAppliedDiscount?.discountValue || 0))
      : 0;
    const discountAmount = Math.min(Math.max(0, effectiveDiscount), Math.max(0, subtotal));
    const taxableSubtotal = Math.max(0, subtotal - discountAmount);
    const taxAmount = taxableSubtotal * (effectiveTaxRate / 100);
    const rawTotal = taxableSubtotal + taxAmount + shipping;
    const total = Math.max(0, rawTotal);
    const itemsCount = cart.reduce((acc, item) => acc + item.qty, 0);
    return { subtotal, total, itemsCount };
  };

  const { subtotal, total, itemsCount } = calculateTotals();

  const printSuspendReceipt = (sale: any) => {
    const popup = window.open('', '_blank', 'width=980,height=720');
    if (!popup) {
      addNotification({
        title: 'Print blocked',
        message: 'Allow pop-ups to print suspended invoices.',
        type: 'warning',
      });
      return;
    }
    const itemsHtml = (sale.items || [])
      .map((item: any, index: number) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(String(item.name || ''))}</td>
          <td style="text-align:right;">${Number(item.qty || 0).toFixed(3)}</td>
          <td style="text-align:right;">${formatCurrency(Number(item.unitPrice || 0))}</td>
          <td style="text-align:right;">${formatCurrency(Number(item.total || 0))}</td>
        </tr>
      `)
      .join('');
    popup.document.write(`
      <html>
      <head>
        <title>Suspend Invoice ${escapeHtml(String(sale.invoiceNo || ''))}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 16px; color: #111827; }
          h2 { margin: 0 0 8px; font-size: 20px; }
          .meta { margin-bottom: 12px; font-size: 12px; line-height: 1.5; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #d1d5db; padding: 6px 8px; font-size: 12px; }
          th { background: #f3f4f6; text-align: left; }
          .totals { margin-top: 12px; text-align: right; font-weight: 700; }
        </style>
      </head>
      <body>
        <h2>Suspend Invoice</h2>
        <div class="meta">
          <div><strong>Invoice No:</strong> ${escapeHtml(String(sale.invoiceNo || '--'))}</div>
          <div><strong>Date:</strong> ${escapeHtml(formatDateTimeDisplay(new Date(sale.date || Date.now())))}</div>
          <div><strong>Customer:</strong> ${escapeHtml(String(sale.customerName || '--'))}</div>
          <div><strong>Location:</strong> ${escapeHtml(String(sale.location || '--'))}</div>
          <div><strong>Status:</strong> ${escapeHtml(String(sale.saleStatus || sale.status || '--'))}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th style="text-align:right;">Qty</th>
              <th style="text-align:right;">Unit Price</th>
              <th style="text-align:right;">Line Total</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div class="totals">Grand Total: ${escapeHtml(formatCurrency(Number(sale.grandTotal || 0)))}</div>
      </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
    popup.close();
  };

  const resetCart = (withConfirm: boolean) => {
    if (withConfirm && cart.length > 0 && !confirm('Clear all cart items and reset this POS form?')) {
      return;
    }
    setCart([]);
    setDiscount(0);
    setShipping(0);
    setTaxRate(0);
    setSearchTerm('');
    setShowDenomPicker(false);
    setDenomTendered(0);
  };

  /** Parse cashDenominations setting into a sorted array of numbers */
  const parsedDenominations = useMemo(() => {
    const raw = String(settings.cashDenominations || '').trim();
    if (!raw) return [];
    return raw.split(',')
      .map(s => parseFloat(s.trim()))
      .filter(n => !isNaN(n) && n > 0)
      .sort((a, b) => a - b);
  }, [settings.cashDenominations]);

  /** True when denomination picker should be shown for POS cash checkout */
  const needsDenomPicker = useMemo(() => {
    if (!settings.strictCashDenominationCheck) return false;
    if (parsedDenominations.length === 0) return false;
    const screen = String(settings.cashDenominationEnabledOn || 'All screens');
    return screen === 'All screens' || screen === 'POS screen';
  }, [settings.strictCashDenominationCheck, settings.cashDenominationEnabledOn, parsedDenominations]);

  const canAdjustProductQty = (product: GlobalProduct, desiredQty: number): boolean => {
    if (settings.allowOverselling) return true;
    return desiredQty <= Number(product.stock || 0);
  };

  const openStockHistory = (product: GlobalProduct, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setStockHistoryProduct(product);
    setIsStockHistoryOpen(true);
  };

  const addToCart = (product: GlobalProduct, qtyToAdd = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      const currentQty = existing?.qty || 0;
      const nextQty = currentQty + qtyToAdd;
      if (!canAdjustProductQty(product, nextQty)) {
        addNotification({
          title: 'Insufficient stock',
          message: `${product.name} stock is ${Number(product.stock || 0).toFixed(3)}.`,
          type: 'error',
        });
        return prev;
      }
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, qty: nextQty, subtotal: nextQty * item.sellingPrice }
            : item
        );
      }
      return [...prev, { ...product, cartId: Date.now(), qty: qtyToAdd, subtotal: qtyToAdd * product.sellingPrice }];
    });
  };

  const updateQty = (cartId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.cartId !== cartId) return item;
      const newQty = Math.max(1, item.qty + delta);
      if (!canAdjustProductQty(item, newQty)) {
        addNotification({
          title: 'Insufficient stock',
          message: `${item.name} stock is ${Number(item.stock || 0).toFixed(3)}.`,
          type: 'error',
        });
        return item;
      }
      return { ...item, qty: newQty, subtotal: newQty * item.sellingPrice };
    }));
  };

  const removeFromCart = (cartId: number) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId));
  };

  const findProductBySearch = (term: string) => {
    const query = normalizeText(term);
    if (!query) return undefined;
    return products.find(product =>
      normalizeText(product.sku) === query ||
      normalizeText(product.name) === query ||
      normalizeText(product.id) === query
    );
  };

  const findProductByWeighingScaleBarcode = (term: string) => {
    if (!settings.enableWeighingScale) return undefined;
    const parsed = parseWeighingScaleBarcode(term, settings);
    if (!parsed) return undefined;
    const normalizedSegment = normalizeText(parsed.skuSegment);
    const match = products.find((product) => {
      const sku = normalizeText(product.sku);
      if (sku === normalizedSegment) return true;
      const skuDigits = normalizeSkuDigits(product.sku || '');
      return skuDigits === parsed.skuSegment || skuDigits.endsWith(parsed.skuSegment);
    });
    if (!match) return undefined;
    return {
      product: match,
      quantity: parsed.quantity,
    };
  };

  const handleSearchSubmit = () => {
    const exact = findProductBySearch(searchTerm);
    if (exact) {
      addToCart(exact);
      setSearchTerm('');
      return;
    }
    const weighingBarcodeMatch = findProductByWeighingScaleBarcode(searchTerm);
    if (weighingBarcodeMatch) {
      addToCart(weighingBarcodeMatch.product, weighingBarcodeMatch.quantity);
      setSearchTerm('');
      return;
    }
    addNotification({
      title: 'Product not found',
      message: 'No exact SKU/ID/product name match found.',
      type: 'warning',
    });
  };

  const ensureCanCreateSale = (): boolean => {
    if (!registerSession) {
      addNotification({
        title: 'Register not open',
        message: 'Please open a register before creating POS transactions.',
        type: 'error',
      });
      onNavigate?.('open-register');
      return false;
    }
    if (cart.length === 0) {
      addNotification({
        title: 'Cart is empty',
        message: 'Add at least one product before continuing.',
        type: 'error',
      });
      return false;
    }
    if (!selectedLocation) {
      addNotification({
        title: 'Location required',
        message: 'Please select a business location before checkout.',
        type: 'error',
      });
      return false;
    }
    return true;
  };

  const createSaleFromCart = (mode: CheckoutMode) => {
    if ((mode === 'draft' || mode === 'suspend') && settings.disableDraft) {
      addNotification({
        title: 'Action blocked',
        message: 'Draft flow is disabled in Settings.',
        type: 'error',
      });
      return;
    }
    if (mode === 'quotation' && settings.disableQuotation) {
      addNotification({
        title: 'Action blocked',
        message: 'Quotation flow is disabled in Settings.',
        type: 'error',
      });
      return;
    }
    if (mode === 'suspend' && settings.disableSuspendSale) {
      addNotification({
        title: 'Action blocked',
        message: 'Suspend Sale is disabled in Settings.',
        type: 'error',
      });
      return;
    }
    if (!ensureCanCreateSale()) return;

    const effectiveTaxRate = settings.posEnableTax ? taxRate : 0;
    const effectiveDiscountType = settings.posEnableDiscount
      ? (isDiscountManuallyOverridden ? 'Fixed' : (autoAppliedDiscount?.discountType || 'Fixed'))
      : 'None';
    const effectiveDiscountAmount = settings.posEnableDiscount
      ? (isDiscountManuallyOverridden
          ? Number(discount.toFixed(3))
          : Number((autoAppliedDiscount?.discountAmount || 0).toFixed(3)))
      : 0;
    const customerName = customerId === 'WALK-IN'
      ? 'Walk-in Customer'
      : (selectedCustomer?.businessName || 'Walk-in Customer');

    const defaultScheme = invoiceSchemes.find(s => s.isDefault)?.name || invoiceSchemes[0]?.name || 'Default';
    const defaultLayout = invoiceLayouts.find(l => l.isDefault)?.name || invoiceLayouts[0]?.name || 'Default';
    const invoiceScheme = selectedLocation?.invoiceScheme || defaultScheme;
    const invoiceLayout = selectedLocation?.invoiceLayoutPos || defaultLayout;
    const schemePrefix = invoiceSchemes.find(s => s.name === invoiceScheme)?.prefix || settings.salesInvoicePrefix || 'INV-';
    const isFinal = mode === 'paid' || mode === 'card' || mode === 'credit' || mode === 'multi';
    const status = mode === 'quotation' ? 'Quotation' : (mode === 'draft' || mode === 'suspend' ? 'Draft' : 'Final');
    const saleStatus = mode === 'suspend' ? 'Suspend' : status;
    const invoicePrefix = mode === 'draft' || mode === 'suspend'
      ? (settings.draftPrefix || 'DR-')
      : mode === 'quotation'
        ? (settings.quotationPrefix || 'QT-')
        : schemePrefix;
    const invoiceNo = nextInvoiceNumber(selectedLocation?.id, invoicePrefix);
    const resolvedPaymentMethod =
      mode === 'card' ? 'Card'
        : mode === 'multi' ? 'Multi Pay'
          : mode === 'credit' ? ''
            : (settings.posDefaultPaymentMethod || 'Cash');
    const paymentStatus = mode === 'credit'
      ? 'Due'
      : isFinal
        ? 'Paid'
        : 'Due';
    const totalPaid = paymentStatus === 'Paid' ? total : 0;
    const sellDue = Math.max(0, total - totalPaid);

    const newSale = {
      id: `SALE-POS-${Date.now()}`,
      invoiceNo,
      invoiceScheme,
      invoiceLayout,
      date: new Date().toISOString(),
      customerId,
      customerName,
      contactNumber: selectedCustomer?.mobile || '',
      location: selectedLocation?.name || '',
      items: cart.map(item => ({
        id: item.id,
        name: item.name,
        qty: item.qty,
        unitPrice: item.sellingPrice,
        discount: 0,
        subtotal: item.subtotal,
        tax: 0,
        total: item.subtotal,
        unit: item.unit,
      })),
      subTotal: subtotal,
      discountType: effectiveDiscountType,
      discountAmount: effectiveDiscountAmount,
      tax: effectiveTaxRate > 0 ? `${effectiveTaxRate}%` : 'None',
      shippingCharges: Number(shipping.toFixed(3)),
      grandTotal: Number(total.toFixed(3)),
      paymentStatus,
      paymentMethod: resolvedPaymentMethod,
      totalPaid: Number(totalPaid.toFixed(3)),
      sellDue: Number(sellDue.toFixed(3)),
      saleType:
        mode === 'credit'
          ? 'Credit Sale'
          : mode === 'quotation'
            ? 'Quotation'
            : mode === 'draft'
              ? 'Draft'
              : mode === 'suspend'
                ? 'Suspend'
                : 'POS',
      addedBy: currentUser?.name || 'Admin',
      status,
      saleStatus,
      payTerm: mode === 'credit' && settings.defaultCreditSaleDays
        ? `${settings.defaultCreditSaleDays} Days`
        : undefined,
    };

    addSale(newSale);

    // Reward Points: award on final POS sales
    if (
      settings.enableRewardPoints &&
      isFinal &&
      customerId !== 'WALK-IN' &&
      customerId
    ) {
      const amountPerPoint = Number(settings.rewardAmountPerPoint) || 0;
      const minOrder = Number(settings.rewardMinOrderToEarn) || 0;
      const maxPoints = Number(settings.rewardMaxPointsPerOrder) || Infinity;
      if (amountPerPoint > 0 && total >= minOrder) {
        const earnedPoints = Math.min(Math.floor(total / amountPerPoint), maxPoints);
        if (earnedPoints > 0) {
          addCustomerRewardPoints(customerId, earnedPoints);
          addNotification({
            title: 'Reward Points',
            message: `${earnedPoints} ${settings.rewardPointDisplayName || 'points'} earned.`,
            type: 'info',
          });
        }
      }
    }

    if (mode === 'suspend' && settings.printInvoiceOnSuspend) {
      printSuspendReceipt(newSale);
    }
    const shouldAutoPrintFinal = isFinal && selectedLocation?.autoPrintInvoiceAfterFinalizing === true;
    if (shouldAutoPrintFinal) {
      notifyReceiptPrintFallback({
        location: selectedLocation,
        printers,
        addNotification,
        documentLabel: 'Invoice',
      });
      setTimeout(() => window.print(), 120);
    }

    if (registerSession) {
      addRegisterTransaction({
        id: `RTX-POS-${Date.now()}`,
        sessionId: registerSession.id,
        date: new Date().toISOString(),
        type:
          mode === 'draft'
            ? 'draft'
            : mode === 'quotation'
              ? 'quotation'
              : mode === 'suspend'
                ? 'suspend'
                : 'sale',
        amount: Number(total.toFixed(3)),
        method: resolvedPaymentMethod || undefined,
        invoiceNo,
        note: `POS ${mode} transaction`,
        addedBy: currentUser?.name || 'Admin',
      });
    }

    const actionLabel =
      mode === 'draft'
        ? 'saved as draft'
        : mode === 'quotation'
          ? 'saved as quotation'
          : mode === 'suspend'
            ? 'suspended'
            : `processed (${resolvedPaymentMethod || 'No payment'})`;

    addNotification({
      title: 'POS transaction saved',
      message: `Invoice ${invoiceNo} ${actionLabel}.`,
      type: 'success',
    });

    resetCart(false);
    if ((mode === 'draft' || mode === 'suspend') && !settings.disableDraft) onNavigate?.('drafts');
    if (mode === 'quotation' && !settings.disableQuotation) onNavigate?.('quotations');
  };

  const openCalculator = () => {
    const input = prompt('Calculator\nEnter expression (example: 12.5+7*3)');
    if (!input) return;
    if (!/^[\d\s+\-*/().%]+$/.test(input)) {
      addNotification({
        title: 'Invalid expression',
        message: 'Only numeric operators are allowed.',
        type: 'error',
      });
      return;
    }
    try {
      const result = Function(`"use strict"; return (${input});`)();
      addNotification({
        title: 'Calculator result',
        message: `${input} = ${Number(result).toFixed(3)}`,
        type: 'info',
      });
    } catch {
      addNotification({
        title: 'Calculation failed',
        message: 'Unable to evaluate that expression.',
        type: 'error',
      });
    }
  };

  const handleCloseRegister = () => {
    if (!registerSession) {
      addNotification({
        title: 'No open register',
        message: 'Open register first.',
        type: 'warning',
      });
      onNavigate?.('open-register');
      return;
    }

    const tx = getRegisterTransactions().filter(entry => entry.sessionId === registerSession.id);
    const cashNet = tx.reduce((sum, entry) => {
      if (entry.type === 'open') return sum + entry.amount;
      if (entry.type === 'close') return sum - entry.amount;
      if ((entry.type === 'sale' || entry.type === 'payment') && normalizeText(entry.method) === 'cash') {
        return sum + entry.amount;
      }
      if (entry.type === 'expense') {
        const expenseMethod = normalizeText(entry.method);
        if (!expenseMethod || expenseMethod === 'cash') return sum - entry.amount;
      }
      return sum;
    }, 0);
    const suggested = Number(Math.max(0, cashNet).toFixed(3));
    const input = prompt('Close register\nEnter closing cash amount', suggested.toFixed(3));
    if (input === null) return;
    const parsed = Number(input);
    if (!Number.isFinite(parsed) || parsed < 0) {
      addNotification({
        title: 'Invalid amount',
        message: 'Closing cash must be a non-negative number.',
        type: 'error',
      });
      return;
    }

    const closed = closeRegisterSession(
      registerSession.id,
      currentUser?.name || 'Admin',
      Number(parsed.toFixed(3))
    );
    if (!closed) {
      addNotification({
        title: 'Close failed',
        message: 'Register session could not be closed.',
        type: 'error',
      });
      return;
    }
    addRegisterTransaction({
      id: `RTX-CLOSE-${Date.now()}`,
      sessionId: registerSession.id,
      date: new Date().toISOString(),
      type: 'close',
      amount: Number(parsed.toFixed(3)),
      note: `Register closed by ${currentUser?.name || 'Admin'}`,
      addedBy: currentUser?.name || 'Admin',
    });
    setRegisterSession(null);
    addNotification({
      title: 'Register closed',
      message: `Register ${registerSession.id} closed successfully.`,
      type: 'success',
    });
    onNavigate?.('open-register');
  };

  useEffect(() => {
    const timer = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const active = getActiveRegisterSession();
    if (active?.locationId) {
      setRegisterSession(active);
      setSelectedLocationId(active.locationId);
    }
  }, []);

  useEffect(() => {
    if (!selectedLocationId && defaultLocationId) {
      setSelectedLocationId(defaultLocationId);
    }
  }, [selectedLocationId, defaultLocationId]);

  useEffect(() => {
    if (!selectedLocationId || selectableLocations.length === 0) return;
    if (!selectableLocations.some(loc => loc.id === selectedLocationId)) {
      setSelectedLocationId(selectableLocations[0].id);
    }
  }, [selectedLocationId, selectableLocations]);

  useEffect(() => {
    if (!settings.posEnableDiscount) {
      setDiscount(0);
      setIsDiscountManuallyOverridden(false);
    }
  }, [settings.posEnableDiscount]);

  useEffect(() => {
    if (!settings.posEnableDiscount || isDiscountManuallyOverridden) return;
    const nextDiscount = Number((autoAppliedDiscount?.discountValue || 0).toFixed(3));
    setDiscount(nextDiscount);
  }, [settings.posEnableDiscount, isDiscountManuallyOverridden, autoAppliedDiscount?.discountValue]);

  useEffect(() => {
    if (cart.length === 0) {
      setIsDiscountManuallyOverridden(false);
    }
  }, [cart.length]);

  useEffect(() => {
    if (!settings.posEnableTax) {
      setTaxRate(0);
    }
  }, [settings.posEnableTax]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesShortcut(e, settings.posShortcutProductQty || 'f2')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (matchesShortcut(e, settings.posShortcutExpressCheckout || 'f4') && !settings.disableExpressCheckout) {
        e.preventDefault();
        createSaleFromCart('paid');
      } else if (matchesShortcut(e, settings.posShortcutEditDiscount || 'f8')) {
        e.preventDefault();
        discountInputRef.current?.focus();
      } else if (matchesShortcut(e, settings.posShortcutCancel || 'f9')) {
        e.preventDefault();
        resetCart(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings.disableExpressCheckout, cart, total, selectedLocationId, customerId, discount, taxRate, shipping, searchTerm]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => undefined);
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  const filteredProducts = useMemo(() => {
    const query = normalizeText(searchTerm);
    return locationScopedProducts.filter(p => {
      if (selectedFilter !== 'All') {
        if (activeTab === 'category' && p.category !== selectedFilter) return false;
        if (activeTab === 'brand' && p.brand !== selectedFilter) return false;
      }
      if (!query) return true;
      return (
        normalizeText(p.name).includes(query) ||
        normalizeText(p.sku).includes(query) ||
        normalizeText(p.id).includes(query)
      );
    });
  }, [locationScopedProducts, selectedFilter, activeTab, searchTerm]);

  const featuredProducts = useMemo(() => {
    if (featuredProductKeys.length === 0) return [] as GlobalProduct[];
    return filteredProducts.filter(product => {
      const id = normalizeText(product.id);
      const sku = normalizeText(product.sku);
      const name = normalizeText(product.name);
      return featuredProductKeys.includes(id) || featuredProductKeys.includes(sku) || featuredProductKeys.includes(name);
    });
  }, [filteredProducts, featuredProductKeys]);

  const displayedProducts = useMemo(() => {
    if (!settings.dontShowProductSuggestion) return filteredProducts;
    if (normalizeText(searchTerm)) return filteredProducts;
    return [];
  }, [filteredProducts, searchTerm, settings.dontShowProductSuggestion]);
  const renderedProducts = useMemo(() => {
    if (normalizeText(searchTerm)) return displayedProducts;
    if (featuredProducts.length > 0) return featuredProducts;
    return displayedProducts;
  }, [displayedProducts, featuredProducts, searchTerm]);

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden font-sans">
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate?.('list-pos')}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
            title="Back"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Location:</span>
            <select
              className="bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-72 p-2 font-bold shadow-sm disabled:bg-slate-100 disabled:text-slate-400"
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              disabled={!!registerSession}
            >
              {selectableLocations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
          {registerSession && (
            <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded">
              Register Open: {registerSession.locationName}
            </div>
          )}
          {settings.enableTransactionDateOnPOSScreens && (
            <div className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 shadow-sm">
              <Calendar size={14} />
              {formatDateTimeDisplay(dateTime)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {canAddExpenses && (
            <button
              onClick={() => onNavigate?.('add-expense')}
              className="flex flex-col items-center justify-center p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors w-16"
              title="Add Expense"
            >
              <Wallet size={18} className="mb-0.5 text-red-500" />
              <span className="text-[9px] font-bold">Expense</span>
            </button>
          )}
          {!settings.disableDraft && (
            <button
              onClick={() => onNavigate?.('drafts')}
              className="flex flex-col items-center justify-center p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors w-16"
              title="Suspended Sales"
            >
              <Pause size={18} className="mb-0.5 text-orange-500" />
              <span className="text-[9px] font-bold">Suspend</span>
            </button>
          )}
          {canAccessSellReturns && (
            <button
              onClick={() => onNavigate?.('returns')}
              className="flex flex-col items-center justify-center p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors w-16"
              title="Sell Return"
            >
              <Undo2 size={18} className="mb-0.5 text-rose-500" />
              <span className="text-[9px] font-bold">Return</span>
            </button>
          )}
          {!settings.dontShowRecentTransactions && (
            <button
              onClick={() => onNavigate?.('list-pos')}
              className="flex flex-col items-center justify-center p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors w-16"
              title="Recent Transactions"
            >
              <History size={18} className="mb-0.5 text-purple-600" />
              <span className="text-[9px] font-bold">Recent</span>
            </button>
          )}
          <button
            onClick={() => {
              if (!registerSession) {
                addNotification({
                  title: 'No active register',
                  message: 'Open register first.',
                  type: 'warning',
                });
                onNavigate?.('open-register');
                return;
              }
              const details = `Register: ${registerSession.id}\n` +
                `Location: ${registerSession.locationName}\n` +
                `Opened by: ${registerSession.openedBy}\n` +
                `Opened at: ${new Date(registerSession.openedAt).toLocaleString()}\n` +
                `Cash in hand: ${formatCurrency(registerSession.cashInHand)}\n\n` +
                `Click OK to close this register, Cancel to keep it open.`;
              if (confirm(details)) {
                handleCloseRegister();
              }
            }}
            className="flex flex-col items-center justify-center p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors w-16"
            title="Register Details"
          >
            <Monitor size={18} className="mb-0.5 text-teal-600" />
            <span className="text-[9px] font-bold">Register</span>
          </button>
          <button
            onClick={openCalculator}
            className="flex flex-col items-center justify-center p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors w-16"
            title="Calculator"
          >
            <Calculator size={18} className="mb-0.5 text-blue-600" />
            <span className="text-[9px] font-bold">Calc</span>
          </button>
          <button onClick={toggleFullscreen} className="flex flex-col items-center justify-center p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors w-16" title="Fullscreen">
            <Maximize size={18} className="mb-0.5 text-slate-700" />
            <span className="text-[9px] font-bold">Screen</span>
          </button>
          <button
            onClick={() => resetCart(true)}
            className="flex flex-col items-center justify-center p-2 text-slate-600 hover:bg-red-50 rounded-lg transition-colors w-16 group"
            title="Reset"
          >
            <RotateCcw size={18} className="mb-0.5 text-red-600 group-hover:rotate-180 transition-transform duration-500" />
            <span className="text-[9px] font-bold text-red-600">Reset</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[45%] flex flex-col bg-white border-r border-slate-200">
          <div className="p-3 space-y-3 border-b border-slate-100 shadow-sm z-10">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <select
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="WALK-IN">Walk-in Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.businessName}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => onNavigate?.('customers')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-white border border-slate-200 rounded hover:bg-blue-50 text-blue-600"
                  title="Open Customers"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={`Enter Product name / SKU / Scan bar code (${displayShortcut(settings.posShortcutProductQty || 'f2')})`}
                className="w-full pl-10 pr-12 py-3 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm placeholder:text-slate-400 font-medium"
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchSubmit();
                  }
                }}
              />
              <button
                onClick={() => onNavigate?.('add-product')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600"
                title="Add New Product"
              >
                <PlusCircle size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-white text-slate-600 font-bold border-b border-slate-200 sticky top-0 shadow-sm z-10 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-2 py-3 text-center">Quantity</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-2 py-3 text-center w-10"><X size={14} /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {cart.length > 0 ? (
                  cart.map((item) => (
                    <tr key={item.cartId} className="bg-white hover:bg-blue-50/50 transition-colors group">
                      <td className="px-4 py-3 align-middle">
                        <div className="font-bold text-slate-800 text-sm mb-0.5">{item.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.sku}</div>
                      </td>
                      <td className="px-2 py-3 align-middle">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => updateQty(item.cartId, -1)}
                            className="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors border border-slate-200"
                          >
                            <Minus size={12} />
                          </button>
                          <input
                            type="text"
                            value={item.qty}
                            readOnly
                            className="w-10 text-center font-bold text-slate-800 bg-transparent text-sm"
                          />
                          <button
                            onClick={() => updateQty(item.cartId, 1)}
                            className="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors border border-slate-200"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800 align-middle">
                        {formatCurrency(item.subtotal)}
                      </td>
                      <td className="px-2 py-3 text-center align-middle">
                        <button
                          onClick={() => removeFromCart(item.cartId)}
                          className="text-red-400 hover:text-red-600 p-1.5 rounded-full hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-32 text-center text-slate-400 italic">
                      <div className="flex flex-col items-center gap-2">
                        <ShoppingCart className="opacity-20" size={48} />
                        <span>Scan barcode or click products to add</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
            <div className="grid grid-cols-5 gap-0 text-xs border-b border-slate-200 bg-slate-50">
              <div className="p-3 border-r border-slate-200">
                <label className="block font-bold text-slate-500 uppercase mb-1">Items</label>
                <div className="font-mono font-bold text-base text-slate-800">{itemsCount.toFixed(3)} <span className="text-[10px] text-slate-400 font-normal">({cart.length})</span></div>
              </div>
              <div className="p-3 border-r border-slate-200">
                <label className="block font-bold text-slate-500 uppercase mb-1">Total</label>
                <div className="font-mono font-bold text-base text-slate-800">{formatCurrency(subtotal)}</div>
              </div>
              <div className="p-2 border-r border-slate-200">
                <label className="block font-bold text-slate-500 uppercase mb-1">
                  Discount (-) [{displayShortcut(settings.posShortcutEditDiscount || 'f8')}]{!settings.posEnableDiscount ? ' (Disabled in Settings)' : !canEditPosDiscount ? ' (No Permission)' : ''}
                </label>
                <input
                  ref={discountInputRef}
                  type="number"
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm font-bold focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  placeholder="0.00"
                  value={discount}
                  onChange={(e) => {
                    setIsDiscountManuallyOverridden(true);
                    setDiscount(Number(e.target.value) || 0);
                  }}
                  disabled={!settings.posEnableDiscount || !canEditPosDiscount}
                />
                {settings.posEnableDiscount && matchedAutoDiscountRule && (
                  <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-emerald-700">
                    <span className="truncate">
                      Auto: {matchedAutoDiscountRule.name} ({formatDiscountAmount(matchedAutoDiscountRule)})
                    </span>
                    {isDiscountManuallyOverridden && canEditPosDiscount && (
                      <button
                        type="button"
                        onClick={() => setIsDiscountManuallyOverridden(false)}
                        className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                      >
                        Use Auto
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="p-2 border-r border-slate-200">
                <label className="block font-bold text-slate-500 uppercase mb-1">
                  Order Tax (+){!settings.posEnableTax ? ' (Disabled in Settings)' : ''}
                </label>
                <input
                  type="number"
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm font-bold focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  placeholder="0%"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                  disabled={!settings.posEnableTax}
                />
              </div>
              <div className="p-2">
                <label className="block font-bold text-slate-500 uppercase mb-1">Shipping (+)</label>
                <input
                  type="number"
                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm font-bold focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="0.00"
                  value={shipping}
                  onChange={(e) => setShipping(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-900 text-white">
              <span className="font-medium text-slate-300 text-sm">Total Payable:</span>
              <span className="text-2xl font-black tracking-tight">{formatCurrency(total)}</span>
            </div>

            <div className="grid grid-cols-4 gap-2 p-3 bg-white">
              <button
                onClick={() => createSaleFromCart('draft')}
                disabled={settings.disableDraft}
                className="flex flex-col items-center justify-center py-3 bg-amber-400 hover:bg-amber-500 text-amber-950 rounded-lg transition-all shadow-sm active:scale-95 group disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FileText size={20} className="mb-1 opacity-80 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-wide">Draft</span>
              </button>
              <button
                onClick={() => createSaleFromCart('quotation')}
                disabled={settings.disableQuotation}
                className="flex flex-col items-center justify-center py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-all shadow-sm active:scale-95 group disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FileText size={20} className="mb-1 opacity-90 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-wide">Quotation</span>
              </button>
              <button
                onClick={() => createSaleFromCart('suspend')}
                disabled={settings.disableSuspendSale || settings.disableDraft}
                className="flex flex-col items-center justify-center py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all shadow-sm active:scale-95 group disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Pause size={20} className="mb-1 opacity-90 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-wide">Suspend</span>
              </button>
              <button
                onClick={() => createSaleFromCart('credit')}
                disabled={settings.disableCreditSaleButton}
                className="flex flex-col items-center justify-center py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all shadow-sm active:scale-95 group disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CreditCard size={20} className="mb-1 opacity-90 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-wide">Credit Sale</span>
              </button>

              <button
                onClick={() => createSaleFromCart('card')}
                className="flex flex-col items-center justify-center py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-sm active:scale-95 group"
              >
                <CreditCard size={20} className="mb-1 opacity-90 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-wide">Card</span>
              </button>
              <button
                onClick={() => createSaleFromCart('multi')}
                disabled={settings.disableMultiplePay}
                className="flex flex-col items-center justify-center py-3 bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition-all shadow-sm active:scale-95 group disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <LayoutGrid size={20} className="mb-1 opacity-90 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-wide">Multi Pay</span>
              </button>
              <button
                onClick={() => {
                  if (needsDenomPicker) {
                    setDenomTendered(0);
                    setShowDenomPicker(true);
                  } else {
                    createSaleFromCart('paid');
                  }
                }}
                disabled={settings.disableExpressCheckout}
                className="flex flex-col items-center justify-center py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all shadow-sm active:scale-95 group disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Banknote size={20} className="mb-1 opacity-90 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-wide">{settings.posDefaultPaymentMethod || 'Cash'} [{displayShortcut(settings.posShortcutExpressCheckout || 'f4')}]</span>
              </button>
              <button
                onClick={() => resetCart(false)}
                className="flex flex-col items-center justify-center py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all shadow-sm active:scale-95 group"
              >
                <XCircle size={20} className="mb-1 opacity-90 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-bold uppercase tracking-wide">Cancel [{displayShortcut(settings.posShortcutCancel || 'f9')}]</span>
              </button>
            </div>
          </div>
        </div>

        {/* Cash Denomination Picker Modal */}
        {showDenomPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-white rounded-2xl shadow-2xl w-80 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900">Select Cash Tendered</h3>
                <button onClick={() => setShowDenomPicker(false)} className="text-slate-400 hover:text-slate-700">
                  <X size={18} />
                </button>
              </div>
              <div className="text-sm text-slate-600">Total: <span className="font-black text-slate-900">{formatCurrency(total)}</span></div>
              <div className="grid grid-cols-3 gap-2">
                {parsedDenominations.map(denom => (
                  <button
                    key={denom}
                    onClick={() => setDenomTendered(prev => Math.round((prev + denom) * 1000) / 1000)}
                    className="py-2 bg-slate-100 hover:bg-emerald-100 text-slate-800 font-bold text-sm rounded-lg border border-slate-200 hover:border-emerald-400 transition"
                  >
                    {formatCurrency(denom)}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-500">Tendered: <span className="font-bold text-slate-800">{formatCurrency(denomTendered)}</span></span>
                <span className="text-xs text-slate-500">Change: <span className={`font-bold ${denomTendered >= total ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(Math.max(0, denomTendered - total))}</span></span>
              </div>
              <button
                onClick={() => {
                  if (denomTendered < total) {
                    addNotification({ title: 'Insufficient amount', message: 'Tendered amount must cover the total.', type: 'error' });
                    return;
                  }
                  setShowDenomPicker(false);
                  setDenomTendered(0);
                  createSaleFromCart('paid');
                }}
                disabled={denomTendered < total}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold rounded-xl text-sm transition"
              >
                Confirm &amp; Complete Sale
              </button>
              <button
                onClick={() => { setShowDenomPicker(false); setDenomTendered(0); }}
                className="w-full py-2 text-slate-600 hover:text-slate-900 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 bg-slate-100 flex flex-col overflow-hidden relative border-l border-slate-200">
          <div className="flex bg-white border-b border-slate-200 shadow-sm z-10">
            <button
              onClick={() => { setActiveTab('category'); setSelectedFilter('All'); }}
              className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-4 transition-all ${activeTab === 'category' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
            >
              <LayoutGrid size={16} /> Category
            </button>
            <button
              onClick={() => { setActiveTab('brand'); setSelectedFilter('All'); }}
              className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-4 transition-all ${activeTab === 'brand' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
            >
              <Tag size={16} /> Brands
            </button>
          </div>

          <div className="px-4 py-3 overflow-x-auto whitespace-nowrap bg-white border-b border-slate-200 custom-scrollbar shadow-sm">
            <div className="flex gap-2">
              {(activeTab === 'category' ? categories : brands).map(item => (
                <button
                  key={item}
                  onClick={() => setSelectedFilter(item)}
                  className={`px-5 py-2 rounded-full text-xs font-bold transition-all shadow-sm border ${
                    selectedFilter === item
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-100">
            {renderedProducts.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                {settings.dontShowProductSuggestion && !normalizeText(searchTerm)
                  ? 'Product suggestions are disabled. Search SKU/name to load products.'
                  : 'No products match your filter/search.'}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-20">
                {renderedProducts.map(product => (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden cursor-pointer hover:shadow-md hover:border-blue-400 transition-all group flex flex-col h-full active:scale-95"
                  >
                    <div className="relative aspect-square bg-slate-50 border-b border-slate-100 overflow-hidden p-4">
                      <img src={product.image} alt={product.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300" />
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => openStockHistory(product, e)}
                        className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full hover:bg-slate-800"
                        title="Open stock history"
                      >
                        Stock: {product.stock}
                      </button>
                    </div>
                    <div className="p-3 flex flex-col flex-1">
                      <h4 className="text-xs font-bold text-slate-700 line-clamp-2 mb-1 h-8 leading-tight">{product.name}</h4>
                      <div className="text-[10px] text-slate-400 mb-2 font-mono">{product.sku}</div>
                      {settings.showPricingOnProductSuggestionTooltip && (
                        <div className="mt-auto font-black text-slate-900 text-sm">
                          {formatCurrency(product.sellingPrice)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <ProductStockHistory
        isOpen={isStockHistoryOpen}
        onClose={() => setIsStockHistoryOpen(false)}
        product={stockHistoryProduct}
      />
    </div>
  );
};

export default POS;
