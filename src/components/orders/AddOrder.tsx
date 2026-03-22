import React, { useMemo, useState, useEffect } from 'react';
import {
  Save, Plus, Search, Trash2, Truck, CreditCard,
  Info, User, MapPin, Package, Percent, Edit2, UserCheck, Lock, Printer, Layers
} from 'lucide-react';
import { useGlobalContext, GlobalOrder, OrderItem } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import MultiProductPicker from '@/components/shared/MultiProductPicker';
import {
  fromPieceQuantity,
  getAvailableQuantityModes,
  getPackHint,
  normalizePackagingType,
  normalizeUnitsPerPackage,
  toPieceQuantity,
} from '@/utils/productPackaging';

interface AddOrderProps {
  isEdit?: boolean;
  onNavigate?: (page: string) => void;
  orderId?: string;
}

const DELIVERY_TIME_SLOT_OPTIONS = ['Morning', 'Afternoon', 'Evening'] as const;
const ORDER_DISCOUNT_TYPES = ['None', 'Fixed', 'Percentage'] as const;
type OrderDiscountType = (typeof ORDER_DISCOUNT_TYPES)[number];

const normalizeDeliveryTimeSlot = (value: unknown): '' | (typeof DELIVERY_TIME_SLOT_OPTIONS)[number] => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('morning')) return 'Morning';
  if (normalized.includes('afternoon')) return 'Afternoon';
  if (normalized.includes('evening')) return 'Evening';
  return '';
};

const normalizeOrderDiscountType = (value: unknown): OrderDiscountType => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'fixed') return 'Fixed';
  if (normalized === 'percentage') return 'Percentage';
  return 'None';
};

const AddOrder: React.FC<AddOrderProps> = ({ isEdit, onNavigate, orderId }) => {
  const {
    orders,
    customers,
    products,
    locations,
    taxRates,
    settings,
    currentUser,
    addOrder: globalAddOrder,
    updateOrder: globalUpdateOrder,
    formatCurrency,
    generateId,
  } = useGlobalContext();
  const { addNotification } = useNotifications();

  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [salesPerson, setSalesPerson] = useState(currentUser?.name || 'Admin');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 16));
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState('');
  const [status, setStatus] = useState<GlobalOrder['status']>('Pending');
  const [orderType, setOrderType] = useState<GlobalOrder['orderType']>('Paid');
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery');
  const [taxType, setTaxType] = useState('None');
  const [discountType, setDiscountType] = useState<OrderDiscountType>('None');
  const [discountAmount, setDiscountAmount] = useState<number | ''>('');
  const [businessLocation, setBusinessLocation] = useState('');
  const [area, setArea] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [note, setNote] = useState('');
  const createEmptyRow = (): OrderItem => ({
    id: Date.now(),
    productId: '',
    productSku: '',
    name: '',
    qty: 1,
    quantityMode: 'Piece',
    quantityInput: 1,
    price: 0,
    total: 0,
  });
  const [rows, setRows] = useState<OrderItem[]>([createEmptyRow()]);
  const [rowProductSearch, setRowProductSearch] = useState<Record<string, string>>({});
  const [rowProductDropdownOpen, setRowProductDropdownOpen] = useState<Record<string, boolean>>({});
  const [showMultiPicker, setShowMultiPicker] = useState(false);
  const activeLocations = useMemo(
    () => locations.filter(location => location.isActive !== false),
    [locations]
  );
  const defaultLocationName = useMemo(
    () => activeLocations[0]?.name || locations[0]?.name || '',
    [activeLocations, locations]
  );
  const selectableLocations = useMemo(() => {
    if (!businessLocation) return activeLocations;
    const current = locations.find(location => location.name === businessLocation);
    if (
      current &&
      current.isActive === false &&
      !activeLocations.some(location => location.id === current.id)
    ) {
      return [current, ...activeLocations];
    }
    return activeLocations;
  }, [activeLocations, locations, businessLocation]);

  const round3 = (value: number): number => Number((Number(value) || 0).toFixed(3));
  const toIntegerQuantity = (value: unknown): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.floor(parsed));
  };
  const toNonNegativePrice = (value: unknown): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Number(Math.max(0, parsed).toFixed(3));
  };
  const sanitizeOrderDiscountAmount = (
    type: OrderDiscountType,
    value: number | '' | unknown,
    baseSubTotal: number,
  ): number | '' => {
    if (type === 'None') return '';
    if (value === '' || value === null || value === undefined) return '';
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '';
    if (type === 'Percentage') {
      return Number(Math.min(100, Math.max(0, parsed)).toFixed(3));
    }
    return Number(Math.min(Math.max(0, parsed), Math.max(0, baseSubTotal)).toFixed(3));
  };

  const applyRowQuantityMode = (row: OrderItem, product?: typeof products[number]): OrderItem => {
    const productKey = String(row.productId || row.productSku || '').trim();
    const linkedProduct = product || products.find(p =>
      String(p.id || '').trim() === productKey ||
      String(p.sku || '').trim() === productKey
    );
    const packagingType = normalizePackagingType(linkedProduct?.packagingType || row.productPackagingType);
    const unitsPerPackage = normalizeUnitsPerPackage(row.unitsPerPackage ?? linkedProduct?.unitsPerPackage);
    const availableModes = getAvailableQuantityModes(packagingType, unitsPerPackage);
    const requestedMode = normalizePackagingType(row.quantityMode);
    const quantityMode = availableModes.includes(requestedMode) ? requestedMode : 'Piece';
    const storedQuantityInput = Number(row.quantityInput);
    const fallbackPieces = toIntegerQuantity(row.qty || 0);
    const quantityInput = Number.isFinite(storedQuantityInput)
      ? Math.max(0, storedQuantityInput)
      : fromPieceQuantity(fallbackPieces, quantityMode, unitsPerPackage);
    const qty = toIntegerQuantity(toPieceQuantity(quantityInput, quantityMode, unitsPerPackage));
    const price = toNonNegativePrice(row.price || 0);
    return {
      ...row,
      quantityMode,
      quantityInput: round3(quantityInput),
      qty,
      price,
      productPackagingType: availableModes.length > 1 ? packagingType : undefined,
      unitsPerPackage: availableModes.length > 1 ? unitsPerPackage : undefined,
      total: round3(qty * price),
    };
  };

  useEffect(() => {
    setSalesPerson(currentUser?.name || 'Admin');
  }, [currentUser]);

  useEffect(() => {
    if (isEdit) return;
    if (businessLocation) return;
    if (activeLocations.length === 0 && locations.length === 0) return;
    const userLocation = String(currentUser?.businessLocation || '').trim();
    const canUseUserLocation = userLocation.length > 0 && activeLocations.some(loc => loc.name === userLocation);
    setBusinessLocation(canUseUserLocation ? userLocation : defaultLocationName);
  }, [isEdit, businessLocation, currentUser?.businessLocation, activeLocations, locations, defaultLocationName]);

  useEffect(() => {
    if (!isEdit || !orderId) return;
    const existing = orders.find(o => o.id === orderId);
    if (!existing) {
      addNotification({ title: 'Order Not Found', message: 'The selected order no longer exists.', type: 'error' });
      onNavigate?.('list-orders');
      return;
    }
    setCustomerId(existing.customerId);
    setCustomerSearch(existing.customerName);
    setCustomerPhone(existing.customerPhone || '');
    setSalesPerson(existing.salesRep || currentUser?.name || 'Admin');
    setOrderDate(existing.orderDate || new Date().toISOString().slice(0, 16));
    setDeliveryDate(existing.deliveryDate || '');
    setDeliveryTimeSlot(normalizeDeliveryTimeSlot(existing.deliveryTimeSlot));
    setStatus(existing.status);
    setOrderType(existing.orderType);
    setPaymentMethod(existing.paymentMethod || 'Cash on Delivery');
    setTaxType(existing.taxType || 'None');
    const existingDiscountType = normalizeOrderDiscountType((existing as any).discountType);
    setDiscountType(existingDiscountType);
    setDiscountAmount(
      sanitizeOrderDiscountAmount(
        existingDiscountType,
        (existing as any).discountAmount ?? '',
        Number(existing.subTotal || 0),
      ),
    );
    setBusinessLocation(existing.businessLocation || currentUser?.businessLocation || defaultLocationName);
    setArea(existing.area || '');
    setDeliveryAddress(existing.deliveryAddress || '');
    setNote(existing.note || '');
    setRows(existing.items?.length
      ? existing.items.map(item => applyRowQuantityMode(item))
      : [createEmptyRow()]);
  }, [isEdit, orderId, orders, products, currentUser, locations, defaultLocationName, addNotification, onNavigate]);

  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === customerId),
    [customers, customerId]
  );

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase();
    return customers.filter(c =>
      c.businessName.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      (c.mobile || '').includes(customerSearch)
    ).slice(0, 15);
  }, [customers, customerSearch]);

  const selectedLocation = useMemo(
    () => locations.find(loc => loc.name === businessLocation),
    [locations, businessLocation]
  );

  const paymentMethodOptions = useMemo(() => {
    const locationMethods = (selectedLocation?.paymentMethods || [])
      .filter(method => method.enabled !== false)
      .map(method => String(method.name || '').trim())
      .filter(Boolean);
    const baseline = [
      settings.defaultSalePaymentMethod,
      'Cash on Delivery',
      'Card on Delivery',
      'Bank Transfer',
      'Prepaid (Online)',
    ].map(v => String(v || '').trim()).filter(Boolean);
    const merged = Array.from(new Set([...locationMethods, ...baseline]));
    return merged.length > 0 ? merged : ['Cash on Delivery'];
  }, [selectedLocation, settings.defaultSalePaymentMethod]);

  const taxOptions = useMemo(() => {
    const knownTaxes = taxRates
      .map(rate => String(rate.name || '').trim())
      .filter(Boolean);
    const merged = Array.from(new Set(['None', ...knownTaxes, taxType].filter(Boolean)));
    return merged;
  }, [taxRates, taxType]);

  useEffect(() => {
    if (paymentMethodOptions.includes(paymentMethod)) return;
    setPaymentMethod(paymentMethodOptions[0] || 'Cash on Delivery');
  }, [paymentMethodOptions, paymentMethod]);

  useEffect(() => {
    if (taxOptions.includes(taxType)) return;
    setTaxType('None');
  }, [taxOptions, taxType]);

  const getFilteredProducts = (search: string) => {
    const query = String(search || '').trim().toLowerCase();
    const normalizedBizLoc = businessLocation.trim().toLowerCase();
    const scopedProducts = (normalizedBizLoc && settings.filterProductsByLocation)
      ? products.filter(p => {
          const pLoc = String(p.businessLocation || '').trim().toLowerCase();
          return !pLoc || pLoc === normalizedBizLoc;
        })
      : products;
    if (!query) return scopedProducts.slice(0, 20);
    return scopedProducts.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.sku.toLowerCase().includes(query)
    ).slice(0, 20);
  };

  const handleSelectCustomer = (cust: typeof customers[number]) => {
    setCustomerId(cust.id);
    setCustomerSearch(cust.businessName);
    setCustomerPhone(cust.mobile || '');
    setArea(cust.city || cust.address || '');
    setDeliveryAddress(cust.address || '');
    setShowCustomerDropdown(false);
  };

  const handleAddRow = () => {
    setRows(prev => [...prev, createEmptyRow()]);
  };

  const handleRemoveRow = (id: string | number) => {
    setRows(prev => {
      const next = prev.filter(r => r.id !== id);
      return next.length > 0 ? next : [createEmptyRow()];
    });
  };

  const handleRowChange = (id: string | number, field: 'qty' | 'quantityInput' | 'price', value: string) => {
    const parsed = field === 'price'
      ? toNonNegativePrice(value)
      : toIntegerQuantity(value);
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const next = { ...r, [field]: parsed };
      if (field === 'qty') {
        next.quantityInput = parsed;
      }
      const linkedProduct = products.find(product =>
        product.id === next.productId || product.sku === next.productSku,
      );
      if (field === 'qty') {
        const packagingType = normalizePackagingType(linkedProduct?.packagingType || next.productPackagingType);
        const unitsPerPackage = normalizeUnitsPerPackage(next.unitsPerPackage ?? linkedProduct?.unitsPerPackage);
        const availableModes = getAvailableQuantityModes(packagingType, unitsPerPackage);
        const rowMode = availableModes.includes(normalizePackagingType(next.quantityMode))
          ? normalizePackagingType(next.quantityMode)
          : 'Piece';
        next.quantityInput = fromPieceQuantity(parsed, rowMode, unitsPerPackage);
      }
      return applyRowQuantityMode(next, linkedProduct);
    }));
  };

  const handleRowQuantityModeChange = (id: string | number, quantityMode: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      return applyRowQuantityMode({
        ...r,
        quantityMode: normalizePackagingType(quantityMode),
      });
    }));
  };

  const applyProductLocation = (product: typeof products[number]) => {
    if (settings.filterProductsByLocation) return;
    const productLoc = String(product.businessLocation || '').trim();
    if (!productLoc) return;
    const matched = locations.find(l => l.name.trim().toLowerCase() === productLoc.toLowerCase());
    if (matched) setBusinessLocation(matched.name);
  };

  const handleProductSelectForRow = (rowId: string | number, product: typeof products[number]) => {
    applyProductLocation(product);
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const qty = r.qty || 1;
      const price = product.sellingPrice || 0;
      return applyRowQuantityMode({
        ...r,
        productId: product.id,
        productSku: product.sku,
        name: product.name,
        qty,
        quantityMode: normalizePackagingType(r.quantityMode || 'Piece'),
        quantityInput: Number(r.quantityInput ?? qty) || 1,
        productPackagingType: normalizePackagingType(product.packagingType),
        unitsPerPackage: normalizeUnitsPerPackage(product.unitsPerPackage),
        price,
      }, product);
    }));
    const key = String(rowId);
    setRowProductSearch(prev => ({ ...prev, [key]: product.name }));
    setRowProductDropdownOpen(prev => ({ ...prev, [key]: false }));
  };

  const handleBulkAddProducts = (selectedProducts: typeof products[number][]) => {
    if (selectedProducts.length > 0) applyProductLocation(selectedProducts[0]);
    const baseTime = Date.now();
    const newRowData = selectedProducts.map((product, index) => {
      const id = baseTime + index;
      const price = product.sellingPrice || 0;
      const row = applyRowQuantityMode({
        id,
        productId: product.id,
        productSku: product.sku,
        name: product.name,
        qty: 1,
        quantityMode: 'Piece' as const,
        quantityInput: 1,
        productPackagingType: normalizePackagingType(product.packagingType),
        unitsPerPackage: normalizeUnitsPerPackage(product.unitsPerPackage),
        price,
        total: price,
      }, product);
      return { id, row, name: product.name };
    });
    setRows(prev => {
      const nonEmpty = prev.filter(r => r.productId || r.name);
      return [...nonEmpty, ...newRowData.map(d => d.row)];
    });
    const searchUpdates: Record<string, string> = {};
    newRowData.forEach(d => { searchUpdates[String(d.id)] = d.name; });
    setRowProductSearch(prev => ({ ...prev, ...searchUpdates }));
    setShowMultiPicker(false);
  };

  const resolvedTaxRatePercent = useMemo(() => {
    if (!taxType || taxType === 'None') return 0;
    const taxRecord = taxRates.find(rate => String(rate.name || '').trim() === taxType);
    if (taxRecord) return Number(taxRecord.rate || 0);
    const percentMatch = taxType.match(/(\d+(\.\d+)?)\s*%/);
    return percentMatch ? Number(percentMatch[1]) : 0;
  }, [taxType, taxRates]);

  const subTotal = round3(rows.reduce((acc, row) => acc + row.total, 0));
  const normalizedDiscountAmount = useMemo(
    () => sanitizeOrderDiscountAmount(discountType, discountAmount, subTotal),
    [discountType, discountAmount, subTotal],
  );
  const discountValue = useMemo(() => {
    if (discountType === 'Fixed' && typeof normalizedDiscountAmount === 'number') {
      return round3(normalizedDiscountAmount);
    }
    if (discountType === 'Percentage' && typeof normalizedDiscountAmount === 'number') {
      return round3(subTotal * (normalizedDiscountAmount / 100));
    }
    return 0;
  }, [discountType, normalizedDiscountAmount, subTotal]);
  const taxableBase = round3(Math.max(0, subTotal - discountValue));
  const taxAmount = round3(taxableBase * (resolvedTaxRatePercent / 100));
  const totalAmount = round3(taxableBase + taxAmount);

  useEffect(() => {
    if (discountType === 'None') {
      if (discountAmount !== '') setDiscountAmount('');
      return;
    }
    setDiscountAmount(prev => sanitizeOrderDiscountAmount(discountType, prev, subTotal));
  }, [discountType, discountAmount, subTotal]);

  const generateOrderNumber = () => {
    const d = new Date();
    const datePart = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const dailyCount = orders.filter(o => o.orderDate?.slice(0, 10) === d.toISOString().slice(0, 10)).length + 1;
    return `ORD-${datePart}-${String(dailyCount).padStart(4, '0')}`;
  };

  const printOrder = (order: GlobalOrder) => {
    const printWindow = window.open('', '_blank', 'width=1000,height=700');
    if (!printWindow) return;
    const printDiscountType = normalizeOrderDiscountType((order as any).discountType);
    const printDiscountAmount = Number((order as any).discountAmount || 0);
    const printDiscountValue = printDiscountType === 'Fixed'
      ? printDiscountAmount
      : printDiscountType === 'Percentage'
        ? Number((Number(order.subTotal || 0) * (printDiscountAmount / 100)).toFixed(3))
        : 0;

    const rowsHtml = order.items.map((item, index) => {
      const mode = normalizePackagingType((item as any).quantityMode);
      const hasPackageMode = mode !== 'Piece' && Number((item as any).unitsPerPackage || 0) > 0;
      const displayQty = Number((item as any).quantityInput ?? item.qty ?? 0);
      const qtyLabel = hasPackageMode
        ? `${displayQty.toFixed(3)} ${mode} (${Number(item.qty || 0).toFixed(3)} pieces)`
        : Number(item.qty || 0).toFixed(3);
      return `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;text-align:center;">${index + 1}</td>
        <td style="padding:8px;border:1px solid #ddd;">${item.name}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right;">${qtyLabel}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right;">${formatCurrency(Number(item.price || 0))}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right;">${formatCurrency(Number(item.total || 0))}</td>
      </tr>
    `;
    }).join('');

    printWindow.document.write(`
      <html>
      <head>
        <title>Order ${order.orderNumber}</title>
      </head>
      <body style="font-family:Arial,sans-serif;padding:24px;">
        <h2 style="margin-bottom:4px;">Order ${order.orderNumber}</h2>
        <p style="margin:0 0 4px;">Customer: ${order.customerName}</p>
        <p style="margin:0 0 4px;">Phone: ${order.customerPhone || '--'}</p>
        <p style="margin:0 0 4px;">Business Location: ${order.businessLocation || '--'}</p>
        <p style="margin:0 0 4px;">Order Date: ${order.orderDate}</p>
        <p style="margin:0 0 4px;">Delivery Date: ${order.deliveryDate}</p>
        <p style="margin:0 0 12px;">Time Slot: ${order.deliveryTimeSlot || '--'}</p>
        <table style="border-collapse:collapse;width:100%;font-size:12px;">
          <thead>
            <tr>
              <th style="padding:8px;border:1px solid #ddd;text-align:center;">#</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">Product</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:right;">Qty</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:right;">Price</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div style="margin-top:12px;font-size:13px;">
          <div style="display:flex;justify-content:space-between;max-width:320px;margin-left:auto;"><span>Subtotal</span><strong>${formatCurrency(order.subTotal || 0)}</strong></div>
          <div style="display:flex;justify-content:space-between;max-width:320px;margin-left:auto;"><span>Discount</span><strong>-${formatCurrency(printDiscountValue)}</strong></div>
          <div style="display:flex;justify-content:space-between;max-width:320px;margin-left:auto;"><span>Tax (${order.taxType || 'None'})</span><strong>${formatCurrency(order.taxAmount || 0)}</strong></div>
          <div style="display:flex;justify-content:space-between;max-width:320px;margin-left:auto;border-top:1px solid #ddd;padding-top:8px;"><span>Total</span><strong>${formatCurrency(order.total || 0)}</strong></div>
        </div>
        <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSave = (andPrint = false) => {
    const isRowBlank = (row: OrderItem): boolean => {
      const rowKey = String(row.id);
      const searchValue = String(rowProductSearch[rowKey] || '').trim();
      return !String(row.productId || '').trim()
        && !searchValue
        && !String(row.name || '').trim()
        && Number(row.price || 0) === 0;
    };
    const nonBlankRows = rows.filter(row => !isRowBlank(row));
    const invalidRows = nonBlankRows.filter(row =>
      !String(row.productId || '').trim() ||
      Number(row.qty || 0) <= 0 ||
      !Number.isInteger(Number(row.qty || 0)) ||
      Number(row.price || 0) < 0,
    );
    const cleanItems = nonBlankRows.filter(row =>
      String(row.productId || '').trim() &&
      Number(row.qty || 0) > 0 &&
      Number.isInteger(Number(row.qty || 0)) &&
      Number(row.price || 0) >= 0,
    );
    if (!customerId) {
      addNotification({ title: 'Validation Error', message: 'Select a customer before saving.', type: 'error' });
      return;
    }
    if (!businessLocation) {
      addNotification({ title: 'Validation Error', message: 'Business location is required.', type: 'error' });
      return;
    }
    if (!deliveryDate) {
      addNotification({ title: 'Validation Error', message: 'Delivery date is required.', type: 'error' });
      return;
    }
    if (nonBlankRows.length === 0) {
      addNotification({ title: 'Validation Error', message: 'Add at least one order item.', type: 'error' });
      return;
    }
    if (invalidRows.length > 0) {
      addNotification({
        title: 'Validation Error',
        message: 'Each order item must have a selected product, a whole-number quantity greater than zero, and a non-negative price.',
        type: 'error',
      });
      return;
    }
    if (totalAmount <= 0) {
      addNotification({ title: 'Validation Error', message: 'Order total must be greater than zero.', type: 'error' });
      return;
    }

    const paymentStatus: GlobalOrder['paymentStatus'] = orderType === 'Credit' ? 'Due' : 'Paid';
    const existing = isEdit && orderId ? orders.find(o => o.id === orderId) : null;
    const built: GlobalOrder = {
      id: existing?.id || generateId('ORD-'),
      orderNumber: existing?.orderNumber || generateOrderNumber(),
      customerId,
      customerName: selectedCustomer?.businessName || customerSearch,
      customerPhone: customerPhone || selectedCustomer?.mobile || '',
      orderDate,
      deliveryDate,
      deliveryTimeSlot: normalizeDeliveryTimeSlot(deliveryTimeSlot) || undefined,
      status,
      paymentStatus,
      orderType,
      paymentMethod: orderType === 'Paid' ? paymentMethod : undefined,
      source: existing?.source || 'POS',
      businessLocation,
      items: cleanItems.map(i => ({
        id: i.id,
        productId: i.productId || undefined,
        productSku: i.productSku || undefined,
        name: i.name,
        qty: toIntegerQuantity(i.qty || 0),
        quantityMode: normalizePackagingType(i.quantityMode),
        quantityInput: round3(Number(i.quantityInput ?? i.qty ?? 0)),
        unitsPerPackage: normalizeUnitsPerPackage(i.unitsPerPackage),
        productPackagingType: normalizePackagingType(i.productPackagingType) === 'Piece'
          ? undefined
          : normalizePackagingType(i.productPackagingType),
        price: toNonNegativePrice(i.price || 0),
        total: round3(toIntegerQuantity(i.qty || 0) * toNonNegativePrice(i.price || 0)),
      })),
      itemCount: cleanItems.length,
      subTotal,
      discountType,
      discountAmount: typeof normalizedDiscountAmount === 'number' ? normalizedDiscountAmount : 0,
      taxType,
      taxAmount,
      total: totalAmount,
      driver: existing?.driver,
      area: area || selectedCustomer?.city || selectedCustomer?.address || '',
      salesRep: salesPerson,
      deliveryAddress,
      note,
      addedBy: currentUser?.name || 'Admin',
      convertedSaleId: existing?.convertedSaleId,
      convertedInvoiceNo: existing?.convertedInvoiceNo,
      convertedAt: existing?.convertedAt,
    };

    if (isEdit) {
      globalUpdateOrder(built);
      addNotification({ title: 'Order Updated', message: `${built.orderNumber} updated successfully.`, type: 'success' });
    } else {
      globalAddOrder(built);
      addNotification({ title: 'Order Created', message: `${built.orderNumber} created successfully.`, type: 'success' });
    }

    if (andPrint) {
      printOrder(built);
    }
    onNavigate?.('list-orders');
  };

  return (
    <div className="space-y-8 animate-fade-in pb-32 max-w-[1600px] mx-auto">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          {isEdit ? <Edit2 className="text-indigo-600" size={32} /> : <Truck className="text-indigo-600" size={32} />}
          {isEdit ? 'Edit Order' : 'Create Order'}
        </h2>
        <p className="text-slate-500 mt-1 text-lg">
          {isEdit ? 'Modify details of existing order.' : 'New fulfillment request for delivery or pickup.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-blue-500"></div>
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <User size={20} className="text-indigo-500" /> Customer & Schedule
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="group md:col-span-2 relative">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Customer <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <div className="relative w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold text-slate-700 placeholder:font-normal"
                      placeholder="Search customer by name or mobile..."
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setShowCustomerDropdown(true);
                        if (e.target.value === '') {
                          setCustomerId('');
                          setCustomerPhone('');
                        }
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                    />
                    {showCustomerDropdown && (
                      <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-slate-100 z-50 max-h-64 overflow-y-auto">
                        {filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                          <div
                            key={c.id}
                            className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                            onMouseDown={() => handleSelectCustomer(c)}
                          >
                            <div className="text-sm font-bold text-slate-800">{c.businessName}</div>
                            <div className="text-xs text-slate-500">{c.name} {c.mobile ? `- ${c.mobile}` : ''}</div>
                          </div>
                        )) : (
                          <div className="px-4 py-3 text-sm text-slate-400">No customers found</div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    title="Add new customer"
                    onClick={() => onNavigate?.('customers')}
                    className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md transition-transform active:scale-95"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              <div className="group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Sales Person</label>
                <div className="relative">
                  <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600" size={18} />
                  <input
                    type="text"
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-emerald-50/50 border-emerald-100 text-sm font-bold text-emerald-800 cursor-not-allowed focus:ring-0"
                    value={salesPerson}
                    readOnly
                  />
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400 opacity-50" size={14} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                  <Info size={10} /> Logged in account
                </p>
              </div>

              <div className="group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Business Location <span className="text-red-500">*</span></label>
                <select
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium text-slate-700 cursor-pointer"
                  value={businessLocation}
                  onChange={(e) => setBusinessLocation(e.target.value)}
                >
                  <option value="">Select business location</option>
                  {selectableLocations.map((loc) => (
                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                  ))}
                </select>
              </div>

              <div className="group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Order Type</label>
                <select
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium text-slate-700 cursor-pointer"
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value as GlobalOrder['orderType'])}
                >
                  <option value="Paid">Standard (Paid)</option>
                  <option value="Credit">Credit Order</option>
                </select>
              </div>

              <div className="group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Order Date</label>
                <input
                  type="datetime-local"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium text-slate-700"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                />
              </div>

              <div className="group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Delivery Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium text-slate-700"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>

              <div className="group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Time Slot</label>
                <select
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium text-slate-700 cursor-pointer"
                  value={deliveryTimeSlot}
                  onChange={(e) => setDeliveryTimeSlot(e.target.value)}
                >
                  <option value="">Select time slot</option>
                  {DELIVERY_TIME_SLOT_OPTIONS.map((slot) => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </div>

              <div className="group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Status</label>
                <select
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium text-slate-700 cursor-pointer"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as GlobalOrder['status'])}
                >
                  <option value="Pending">Pending</option>
                  <option value="Processing">Processing</option>
                  <option value="Ready">Ready</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-visible z-20">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Package size={20} className="text-indigo-500" /> Order Items
            </h3>

            <div className="rounded-xl border border-slate-200 overflow-visible">
              <div className="hidden lg:block overflow-visible">
                <table className="w-full text-sm text-left table-fixed">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase">
                    <tr>
                      <th className="px-3 py-2.5 w-12 text-center">#</th>
                      <th className="px-3 py-2.5">Product</th>
                      <th className="px-3 py-2.5 w-28 text-center">Quantity</th>
                      <th className="px-3 py-2.5 w-28 text-center">Unit</th>
                      <th className="px-3 py-2.5 w-32 text-right">Price</th>
                      <th className="px-3 py-2.5 w-40 text-right">Total</th>
                      <th className="px-3 py-2.5 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row, index) => {
                      const rowKey = String(row.id);
                      const prodSearch = rowProductSearch[rowKey] ?? row.name;
                      const prodDropOpen = rowProductDropdownOpen[rowKey] ?? false;
                      const filteredProds = getFilteredProducts(prodSearch);
                      const selectedProduct = products.find(product => product.id === row.productId);
                      const rowPackagingType = normalizePackagingType(selectedProduct?.packagingType || row.productPackagingType);
                      const rowUnitsPerPackage = normalizeUnitsPerPackage(row.unitsPerPackage ?? selectedProduct?.unitsPerPackage);
                      const quantityModes = getAvailableQuantityModes(rowPackagingType, rowUnitsPerPackage);
                      const rowQuantityMode = quantityModes.includes(normalizePackagingType(row.quantityMode))
                        ? normalizePackagingType(row.quantityMode)
                        : 'Piece';
                      const packHint = getPackHint(selectedProduct?.unit, rowPackagingType, rowUnitsPerPackage);
                      return (
                        <tr key={String(row.id)} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2 text-center text-slate-400">{index + 1}</td>
                          <td className="px-3 py-2 font-bold text-slate-800 relative">
                            <input
                              type="text"
                              value={prodSearch}
                              placeholder="Search product by name or SKU..."
                              onFocus={() => setRowProductDropdownOpen(prev => ({ ...prev, [rowKey]: true }))}
                              onChange={(e) => {
                                const nextSearch = e.target.value;
                                setRowProductSearch(prev => ({ ...prev, [rowKey]: nextSearch }));
                                setRowProductDropdownOpen(prev => ({ ...prev, [rowKey]: true }));
                                setRows(prev => prev.map(r => {
                                  if (r.id !== row.id) return r;
                                  return applyRowQuantityMode({
                                    ...r,
                                    name: '',
                                    productId: '',
                                    productSku: '',
                                    productPackagingType: undefined,
                                    unitsPerPackage: undefined,
                                    quantityMode: 'Piece',
                                    quantityInput: Number(r.qty || 0),
                                  });
                                }));
                              }}
                              className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white"
                            />
                            {prodDropOpen && (
                              <div className="absolute left-3 top-full mt-1 w-[30rem] max-w-[calc(100vw-6rem)] bg-white border border-slate-200 rounded-lg shadow-xl z-[220] max-h-72 overflow-y-auto">
                                {filteredProds.length > 0 ? filteredProds.map(p => (
                                  <div
                                    key={p.id}
                                    className="px-3 py-2 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0"
                                    onMouseDown={() => handleProductSelectForRow(row.id, p)}
                                  >
                                    <div className="font-bold text-sm text-slate-800">{p.name}</div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                      SKU: {p.sku} - Price: {formatCurrency(p.sellingPrice)}
                                      {getPackHint(p.unit, p.packagingType, p.unitsPerPackage) ? ` | ${getPackHint(p.unit, p.packagingType, p.unitsPerPackage)}` : ''}
                                    </div>
                                  </div>
                                )) : (
                                  <div className="px-3 py-4 text-center text-slate-400 text-sm">No products found</div>
                                )}
                              </div>
                            )}
                            {packHint && (
                              <div className="text-[10px] text-slate-500 font-semibold mt-1">{packHint}</div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={row.qty}
                              onChange={(e) => handleRowChange(row.id, 'qty', e.target.value)}
                              className="w-full h-9 text-center bg-white border border-slate-200 rounded-lg px-2 text-sm font-semibold text-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={rowQuantityMode}
                              onChange={(e) => handleRowQuantityModeChange(row.id, e.target.value)}
                              className="w-full h-9 bg-white border border-slate-200 rounded-lg px-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none"
                            >
                              {quantityModes.map(mode => (
                                <option key={`${rowKey}-${mode}`} value={mode}>{mode}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              value={row.price}
                              onChange={(e) => handleRowChange(row.id, 'price', e.target.value)}
                              className="w-full h-9 text-right bg-white border border-slate-200 rounded-lg px-2 text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-black text-slate-800">{formatCurrency(row.total || 0)}</td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => handleRemoveRow(row.id)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="lg:hidden divide-y divide-slate-100">
                {rows.map((row, index) => {
                  const rowKey = String(row.id);
                  const prodSearch = rowProductSearch[rowKey] ?? row.name;
                  const prodDropOpen = rowProductDropdownOpen[rowKey] ?? false;
                  const filteredProds = getFilteredProducts(prodSearch);
                  const selectedProduct = products.find(product => product.id === row.productId);
                  const rowPackagingType = normalizePackagingType(selectedProduct?.packagingType || row.productPackagingType);
                  const rowUnitsPerPackage = normalizeUnitsPerPackage(row.unitsPerPackage ?? selectedProduct?.unitsPerPackage);
                  const quantityModes = getAvailableQuantityModes(rowPackagingType, rowUnitsPerPackage);
                  const rowQuantityMode = quantityModes.includes(normalizePackagingType(row.quantityMode))
                    ? normalizePackagingType(row.quantityMode)
                    : 'Piece';
                  const packHint = getPackHint(selectedProduct?.unit, rowPackagingType, rowUnitsPerPackage);

                  return (
                    <div key={String(row.id)} className="p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-slate-500">Item {index + 1}</div>
                        <button onClick={() => handleRemoveRow(row.id)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          value={prodSearch}
                          placeholder="Search product by name or SKU..."
                          onFocus={() => setRowProductDropdownOpen(prev => ({ ...prev, [rowKey]: true }))}
                          onChange={(e) => {
                            const nextSearch = e.target.value;
                            setRowProductSearch(prev => ({ ...prev, [rowKey]: nextSearch }));
                            setRowProductDropdownOpen(prev => ({ ...prev, [rowKey]: true }));
                            setRows(prev => prev.map(r => {
                              if (r.id !== row.id) return r;
                              return applyRowQuantityMode({
                                ...r,
                                name: '',
                                productId: '',
                                productSku: '',
                                productPackagingType: undefined,
                                unitsPerPackage: undefined,
                                quantityMode: 'Piece',
                                quantityInput: Number(r.qty || 0),
                              });
                            }));
                          }}
                          className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white"
                        />
                        {prodDropOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-[220] max-h-72 overflow-y-auto">
                            {filteredProds.length > 0 ? filteredProds.map(p => (
                              <div
                                key={p.id}
                                className="px-3 py-2 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0"
                                onMouseDown={() => handleProductSelectForRow(row.id, p)}
                              >
                                <div className="font-bold text-sm text-slate-800">{p.name}</div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  SKU: {p.sku} - Price: {formatCurrency(p.sellingPrice)}
                                  {getPackHint(p.unit, p.packagingType, p.unitsPerPackage) ? ` | ${getPackHint(p.unit, p.packagingType, p.unitsPerPackage)}` : ''}
                                </div>
                              </div>
                            )) : (
                              <div className="px-3 py-4 text-center text-slate-400 text-sm">No products found</div>
                            )}
                          </div>
                        )}
                      </div>

                      {packHint && (
                        <div className="text-[10px] text-slate-500 font-semibold">{packHint}</div>
                      )}

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Qty</label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={row.qty}
                            onChange={(e) => handleRowChange(row.id, 'qty', e.target.value)}
                            className="w-full h-9 text-center bg-white border border-slate-200 rounded-lg px-2 text-sm font-semibold text-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Unit</label>
                          <select
                            value={rowQuantityMode}
                            onChange={(e) => handleRowQuantityModeChange(row.id, e.target.value)}
                            className="w-full h-9 bg-white border border-slate-200 rounded-lg px-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none"
                          >
                            {quantityModes.map(mode => (
                              <option key={`${rowKey}-${mode}`} value={mode}>{mode}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Price</label>
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={row.price}
                            onChange={(e) => handleRowChange(row.id, 'price', e.target.value)}
                            className="w-full h-9 text-right bg-white border border-slate-200 rounded-lg px-2 text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                        <span className="text-xs font-bold text-slate-500">Total</span>
                        <span className="text-sm font-black text-slate-800">{formatCurrency(row.total || 0)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
              >
                <Plus size={14} /> Add Row
              </button>
              <button
                type="button"
                onClick={() => setShowMultiPicker(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700"
                title="Select multiple products at once"
              >
                <Layers size={14} /> Multi-Select
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              <MapPin size={16} className="text-indigo-500" /> Delivery Address
            </h3>
            <div className="space-y-4">
              <textarea
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium text-slate-700 resize-none"
                rows={3}
                placeholder="Full Address..."
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
              />
              <input
                type="text"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium text-slate-700"
                placeholder="City / Area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              />
              <textarea
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium text-slate-700 resize-none"
                rows={2}
                placeholder="Order note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              <CreditCard size={16} className="text-indigo-500" /> Payment & Tax
            </h3>

            <div className="space-y-4 mb-6">
              {orderType === 'Paid' && (
                <div className="group">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Payment Method</label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold text-slate-700 cursor-pointer"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    {paymentMethodOptions.map((method) => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                </div>
              )}

              {orderType === 'Credit' && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2">
                  <Info size={16} className="text-amber-600 mt-0.5" />
                  <div className="text-xs text-amber-800">
                    <span className="font-bold">Credit Order:</span> Payment will be recorded as Due.
                  </div>
                </div>
              )}

              <div className="group">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Discount Type</label>
                <select
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold text-slate-700 cursor-pointer"
                  value={discountType}
                  onChange={(e) => {
                    const nextType = normalizeOrderDiscountType(e.target.value);
                    setDiscountType(nextType);
                    setDiscountAmount((prev) => sanitizeOrderDiscountAmount(nextType, prev, subTotal));
                  }}
                >
                  {ORDER_DISCOUNT_TYPES.map((typeOption) => (
                    <option key={typeOption} value={typeOption}>{typeOption}</option>
                  ))}
                </select>
              </div>

              <div className="group">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Discount Amount {discountType === 'Percentage' ? '(%)' : `(${settings.currencySymbol})`}
                </label>
                <input
                  type="number"
                  min="0"
                  max={discountType === 'Percentage' ? 100 : Number(subTotal.toFixed(3))}
                  step="0.001"
                  value={discountAmount}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw.trim() === '') {
                      setDiscountAmount('');
                      return;
                    }
                    setDiscountAmount(sanitizeOrderDiscountAmount(discountType, Number(raw), subTotal));
                  }}
                  disabled={discountType === 'None'}
                  className={`w-full px-3 py-2.5 rounded-xl border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold text-slate-700 ${
                    discountType === 'None' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50'
                  }`}
                />
              </div>

              <div className="group">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Applicable Tax</label>
                <div className="relative">
                  <Percent size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold text-slate-700 cursor-pointer"
                    value={taxType}
                    onChange={(e) => setTaxType(e.target.value)}
                  >
                    {taxOptions.map((taxName) => (
                      <option key={taxName} value={taxName}>{taxName}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-2">
              <div className="flex justify-between text-sm text-slate-500 font-medium">
                <span>Subtotal</span>
                <span>{formatCurrency(subTotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500 font-medium">
                <span>Discount</span>
                <span className={discountValue > 0 ? 'text-rose-600 font-bold' : ''}>-{formatCurrency(discountValue)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500 font-medium">
                <span>Taxable Amount</span>
                <span>{formatCurrency(taxableBase)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500 font-medium">
                <span>Tax ({taxType || 'None'})</span>
                <span className={taxAmount > 0 ? 'text-slate-800 font-bold' : ''}>{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between text-xl font-black text-slate-900 pt-2 border-t border-slate-100 mt-2">
                <span>Total</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-slate-900/90 backdrop-blur-md text-white px-3 py-2.5 rounded-full shadow-2xl flex items-center gap-3 border border-white/10 hover:scale-105 transition-transform duration-300">
        <button onClick={() => handleSave()} className="px-6 py-2.5 rounded-full font-bold text-xs bg-indigo-600 hover:bg-indigo-500 shadow-lg transition flex items-center gap-2">
          <Save size={16} /> {isEdit ? 'Update Order' : 'Save Order'}
        </button>
        <button onClick={() => handleSave(true)} className="px-6 py-2.5 rounded-full font-bold text-xs bg-emerald-600 hover:bg-emerald-500 shadow-lg transition flex items-center gap-2">
          <Printer size={16} /> Save & Print
        </button>
      </div>

      {showMultiPicker && (
        <MultiProductPicker
          products={
            (businessLocation && settings.filterProductsByLocation)
              ? products.filter(p => {
                  const pLoc = String(p.businessLocation || '').trim().toLowerCase();
                  return !pLoc || pLoc === businessLocation.trim().toLowerCase();
                })
              : products
          }
          getPrice={p => p.sellingPrice || 0}
          formatCurrency={formatCurrency}
          onConfirm={handleBulkAddProducts}
          onClose={() => setShowMultiPicker(false)}
        />
      )}
    </div>
  );
};

export default AddOrder;
