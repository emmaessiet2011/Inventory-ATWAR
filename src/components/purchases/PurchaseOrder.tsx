import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, FileText, FileSpreadsheet, Printer, Download,
  Edit, Trash2, Filter, X, Info, Upload,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import {
  useGlobalContext,
  PurchaseOrder as GlobalPurchaseOrder,
  PurchaseOrderItem,
} from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import { printDocument, statusBadge, paymentBadge } from '@/utils/printUtils';

interface PurchaseOrderProps {
  onNavigate?: (page: string) => void;
}

interface PurchaseOrderItemForm extends PurchaseOrderItem {
  rowId: string;
}

interface PurchaseOrderFormState {
  orderDate: string;
  referenceNo: string;
  supplierId: string;
  supplierAddress: string;
  location: string;
  deliveryDate: string;
  payTermValue: string;
  payTermType: 'Days' | 'Months';
  attachDocumentName: string;
  purchaseRequisitionId: string;
  items: PurchaseOrderItemForm[];
  shippingDetails: string;
  shippingAddress: string;
  shippingCharges: number;
  shippingStatus: 'Pending' | 'Ordered' | 'Shipped' | 'Delivered';
  deliveredTo: string;
  shippingDocumentName: string;
  additionalExpenses: number;
  additionalNotes: string;
  status: 'Draft' | 'Sent' | 'Received' | 'Partial';
}

const csvEscape = (value: string): string => {
  const normalized = String(value ?? '');
  return /["\n,]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
};

const escapeHtml = (value: string): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toLocalDateTimeInput = (value?: string): string => {
  const src = value ? new Date(value) : new Date();
  const date = Number.isNaN(src.getTime()) ? new Date() : src;
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const toLocalDateInput = (value?: string): string => {
  if (!value) return '';
  const src = new Date(value);
  if (Number.isNaN(src.getTime())) return '';
  return new Date(src.getTime() - src.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const toNumber = (value: string | number | undefined): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const toIntegerQuantity = (value: string | number | undefined): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const formatAppDateTime = (value: string): string => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = String(h % 12 || 12).padStart(2, '0');
  return `${day}/${month}/${year} ${hour12}:${minutes} ${ampm}`;
};

const createRowId = (): string => `po-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const PREFILL_REQUISITION_KEY = 'app_purchase_prefill_requisition_id';
const PREFILL_ORDER_KEY = 'app_purchase_prefill_order_id';

const recalcItem = (item: PurchaseOrderItemForm): PurchaseOrderItemForm => {
  const orderQty = toIntegerQuantity(item.orderQty);
  const unitCostBeforeDiscount = Math.max(0, toNumber(item.unitCostBeforeDiscount));
  const discountPercent = clamp(toNumber(item.discountPercent), 0, 100);
  const unitCostBeforeTax = unitCostBeforeDiscount * (1 - discountPercent / 100);
  const lineTotal = orderQty * unitCostBeforeTax;
  return {
    ...item,
    orderQty,
    unitCostBeforeDiscount,
    discountPercent,
    unitCostBeforeTax,
    lineTotal,
  };
};

const PurchaseOrder: React.FC<PurchaseOrderProps> = ({ onNavigate }) => {
  const { addNotification } = useNotifications();
  const {
    purchaseOrders,
    purchases,
    addPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
    purchaseRequisitions,
    updatePurchaseRequisition,
    locations,
    suppliers,
    products,
    currentUser,
    settings,
    generateId,
    formatCurrency,
  } = useGlobalContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [locationFilter, setLocationFilter] = useState('All');
  const [supplierFilter, setSupplierFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [shippingStatusFilter, setShippingStatusFilter] = useState('All');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<GlobalPurchaseOrder | null>(null);
  const [formError, setFormError] = useState('');
  const [productQuickSearch, setProductQuickSearch] = useState('');

  const locationOptions = useMemo(
    () => Array.from(new Set(locations.map(l => l.name).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    [locations]
  );
  const supplierOptions = useMemo(
    () => suppliers
      .filter(s => s.status === 'Active')
      .map(s => ({ id: s.id, name: s.businessName, address: s.address || '' }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [suppliers]
  );
  const requisitionOptions = useMemo(
    () => purchaseRequisitions
      .map(r => ({ id: r.id, referenceNo: r.referenceNo, location: r.location }))
      .sort((a, b) => a.referenceNo.localeCompare(b.referenceNo)),
    [purchaseRequisitions]
  );

  const buildReferenceNo = (): string => {
    const year = new Date().getFullYear();
    let maxSeq = 0;
    purchaseOrders.forEach(item => {
      const match = String(item.referenceNo || '').match(/(\d{4})[\/-](\d+)\s*$/);
      if (!match) return;
      if (Number(match[1]) === year) maxSeq = Math.max(maxSeq, Number(match[2]));
    });
    return `PO${year}/${String(maxSeq + 1).padStart(4, '0')}`;
  };

  const buildEmptyForm = (): PurchaseOrderFormState => ({
    orderDate: toLocalDateTimeInput(),
    referenceNo: buildReferenceNo(),
    supplierId: '',
    supplierAddress: '',
    location: locationOptions[0] || '',
    deliveryDate: '',
    payTermValue: '',
    payTermType: 'Days',
    attachDocumentName: '',
    purchaseRequisitionId: '',
    items: [],
    shippingDetails: '',
    shippingAddress: '',
    shippingCharges: 0,
    shippingStatus: 'Pending',
    deliveredTo: '',
    shippingDocumentName: '',
    additionalExpenses: 0,
    additionalNotes: '',
    status: 'Draft',
  });

  const [form, setForm] = useState<PurchaseOrderFormState>(buildEmptyForm);

  useEffect(() => {
    const requisitionId = localStorage.getItem(PREFILL_REQUISITION_KEY);
    if (!requisitionId) return;
    const req = purchaseRequisitions.find(item => item.id === requisitionId);
    if (!req) {
      localStorage.removeItem(PREFILL_REQUISITION_KEY);
      return;
    }
    const seededItems = (req.items || []).map(item => {
      const p = products.find(prod => prod.id === item.productId);
      return recalcItem({
        rowId: createRowId(),
        productId: item.productId,
        productName: item.productName,
        orderQty: Math.max(1, toIntegerQuantity(item.requiredQty)),
        unitCostBeforeDiscount: toNumber(p?.unitPurchasePrice || 0),
        discountPercent: 0,
        unitCostBeforeTax: 0,
        lineTotal: 0,
      });
    });
    const selectedSupplier = supplierOptions.find(s => s.id === req.supplierId) || supplierOptions.find(s => s.name === req.supplier);
    const base = buildEmptyForm();
    setEditingOrder(null);
    setFormError('');
    setProductQuickSearch('');
    setForm({
      ...base,
      location: req.location || base.location,
      supplierId: selectedSupplier?.id || req.supplierId || '',
      supplierAddress: selectedSupplier?.address || '',
      purchaseRequisitionId: req.id,
      items: seededItems,
    });
    setIsModalOpen(true);
    localStorage.removeItem(PREFILL_REQUISITION_KEY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseRequisitions, products, supplierOptions]);

  const openAddModal = () => {
    setEditingOrder(null);
    setFormError('');
    setProductQuickSearch('');
    setForm(buildEmptyForm());
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingOrder(null);
    setFormError('');
  };

  const openEditModal = (order: GlobalPurchaseOrder) => {
    setEditingOrder(order);
    setFormError('');
    setProductQuickSearch('');
    setForm({
      orderDate: toLocalDateTimeInput(order.orderDate),
      referenceNo: order.referenceNo || '',
      supplierId: order.supplierId || '',
      supplierAddress: order.supplierAddress || '',
      location: order.location || locationOptions[0] || '',
      deliveryDate: toLocalDateInput(order.deliveryDate),
      payTermValue: order.payTermValue || '',
      payTermType: order.payTermType === 'Months' ? 'Months' : 'Days',
      attachDocumentName: order.attachDocumentName || '',
      purchaseRequisitionId: order.purchaseRequisitionId || '',
      items: (order.items || []).map((item, idx) => recalcItem({
        rowId: `${order.id}-${item.productId}-${idx}`,
        productId: item.productId || '',
        productName: item.productName || '',
        orderQty: toIntegerQuantity(item.orderQty),
        unitCostBeforeDiscount: toNumber(item.unitCostBeforeDiscount),
        discountPercent: toNumber(item.discountPercent),
        unitCostBeforeTax: toNumber(item.unitCostBeforeTax),
        lineTotal: toNumber(item.lineTotal),
      })),
      shippingDetails: order.shippingDetails || '',
      shippingAddress: order.shippingAddress || '',
      shippingCharges: toNumber(order.shippingCharges),
      shippingStatus: order.shippingStatus || 'Pending',
      deliveredTo: order.deliveredTo || '',
      shippingDocumentName: order.shippingDocumentName || '',
      additionalExpenses: toNumber(order.additionalExpenses),
      additionalNotes: order.additionalNotes || '',
      status: order.status || 'Draft',
    });
    setIsModalOpen(true);
  };

  const addItemRow = (product?: { id: string; name: string; unitPurchasePrice: number }) => {
    const row = recalcItem({
      rowId: createRowId(),
      productId: product?.id || '',
      productName: product?.name || '',
      orderQty: 1,
      unitCostBeforeDiscount: toNumber(product?.unitPurchasePrice || 0),
      discountPercent: 0,
      unitCostBeforeTax: 0,
      lineTotal: 0,
    });
    setForm(prev => ({ ...prev, items: [...prev.items, row] }));
  };

  const handleRemoveItem = (rowId: string) => {
    setForm(prev => ({ ...prev, items: prev.items.filter(item => item.rowId !== rowId) }));
  };

  const handleUpdateItemNumber = (
    rowId: string,
    field: 'orderQty' | 'unitCostBeforeDiscount' | 'discountPercent',
    value: string
  ) => {
    const parsed = field === 'orderQty'
      ? toIntegerQuantity(value)
      : field === 'unitCostBeforeDiscount'
        ? Math.max(0, toNumber(value))
        : clamp(toNumber(value), 0, 100);
    setForm(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.rowId !== rowId) return item;
        return recalcItem({ ...item, [field]: parsed });
      }),
    }));
  };

  const handleSelectProductForRow = (rowId: string, productId: string) => {
    const selected = products.find(p => p.id === productId);
    setForm(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.rowId !== rowId) return item;
        return recalcItem({
          ...item,
          productId: selected?.id || '',
          productName: selected?.name || '',
          unitCostBeforeDiscount: selected ? toNumber(selected.unitPurchasePrice) : 0,
          discountPercent: toNumber(item.discountPercent),
        });
      }),
    }));
  };

  const quickProductMatches = useMemo(() => {
    const q = productQuickSearch.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 8);
  }, [products, productQuickSearch]);

  const addQuickProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    addItemRow({ id: product.id, name: product.name, unitPurchasePrice: toNumber(product.unitPurchasePrice) });
    setProductQuickSearch('');
  };

  const handleSupplierChange = (supplierId: string) => {
    const selected = supplierOptions.find(s => s.id === supplierId);
    setForm(prev => ({
      ...prev,
      supplierId,
      supplierAddress: selected?.address || prev.supplierAddress,
    }));
  };

  const handleSelectRequisition = (requisitionId: string) => {
    if (!requisitionId) {
      setForm(prev => ({ ...prev, purchaseRequisitionId: '' }));
      return;
    }
    const req = purchaseRequisitions.find(r => r.id === requisitionId);
    if (!req) return;
    const requisitionRows = (req.items || []).map(row => {
      const p = products.find(prod => prod.id === row.productId);
      return recalcItem({
        rowId: createRowId(),
        productId: row.productId,
        productName: row.productName,
        orderQty: Math.max(1, toIntegerQuantity(row.requiredQty)),
        unitCostBeforeDiscount: toNumber(p?.unitPurchasePrice || 0),
        discountPercent: 0,
        unitCostBeforeTax: 0,
        lineTotal: 0,
      });
    });
    const requisitionSupplier = supplierOptions.find(s => s.id === req.supplierId);
    setForm(prev => ({
      ...prev,
      purchaseRequisitionId: requisitionId,
      location: req.location || prev.location,
      supplierId: req.supplierId || prev.supplierId,
      supplierAddress: requisitionSupplier?.address || prev.supplierAddress,
      items: requisitionRows.length > 0 ? requisitionRows : prev.items,
    }));
  };

  const totals = useMemo(() => {
    const totalItems = form.items.reduce((sum, item) => sum + toIntegerQuantity(item.orderQty), 0);
    const netTotalAmount = form.items.reduce((sum, item) => sum + toNumber(item.lineTotal), 0);
    const shippingCharges = toNumber(form.shippingCharges);
    const additionalExpenses = toNumber(form.additionalExpenses);
    const orderTotal = netTotalAmount + shippingCharges + additionalExpenses;
    return { totalItems, netTotalAmount, shippingCharges, additionalExpenses, orderTotal };
  }, [form.items, form.shippingCharges, form.additionalExpenses]);

  const handleSave = () => {
    setFormError('');
    const supplierId = form.supplierId.trim();
    const location = form.location.trim();
    const orderDate = form.orderDate.trim();
    const referenceNo = form.referenceNo.trim() || editingOrder?.referenceNo || buildReferenceNo();

    if (!supplierId) return setFormError('Supplier is required.');
    if (!location) return setFormError('Business location is required.');
    if (!orderDate) return setFormError('Order date is required.');
    if (form.items.length === 0) return setFormError('Add at least one product row.');

    const normalizedItems = form.items
      .map(item => recalcItem(item))
      .filter(item => item.productId || item.productName.trim());

    if (normalizedItems.length === 0) return setFormError('Select at least one product.');
    if (normalizedItems.some(item => !item.productId)) {
      return setFormError('Select products from the dropdown so each row has a valid product.');
    }
    if (normalizedItems.some(item => toNumber(item.orderQty) <= 0)) {
      return setFormError('Each product row must have order quantity greater than 0.');
    }
    if (normalizedItems.some(item => !Number.isInteger(toNumber(item.orderQty)))) {
      return setFormError('Order quantity must be a whole number.');
    }

    const selectedSupplier = supplierOptions.find(s => s.id === supplierId);
    const selectedReq = purchaseRequisitions.find(r => r.id === form.purchaseRequisitionId);
    const payload: GlobalPurchaseOrder = {
      id: editingOrder?.id || generateId('PO-'),
      orderDate,
      referenceNo,
      supplierId,
      supplierName: selectedSupplier?.name || editingOrder?.supplierName || '',
      supplierAddress: form.supplierAddress.trim(),
      location,
      deliveryDate: form.deliveryDate || '',
      payTermValue: form.payTermValue.trim(),
      payTermType: form.payTermType,
      attachDocumentName: form.attachDocumentName || '',
      purchaseRequisitionId: form.purchaseRequisitionId || '',
      purchaseRequisitionRef: selectedReq?.referenceNo || '',
      items: normalizedItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        orderQty: toIntegerQuantity(item.orderQty),
        unitCostBeforeDiscount: toNumber(item.unitCostBeforeDiscount),
        discountPercent: toNumber(item.discountPercent),
        unitCostBeforeTax: toNumber(item.unitCostBeforeTax),
        lineTotal: toNumber(item.lineTotal),
      })),
      shippingDetails: form.shippingDetails.trim(),
      shippingAddress: form.shippingAddress.trim(),
      shippingCharges: toNumber(form.shippingCharges),
      shippingStatus: form.shippingStatus,
      deliveredTo: form.deliveredTo.trim(),
      shippingDocumentName: form.shippingDocumentName || '',
      additionalExpenses: toNumber(form.additionalExpenses),
      additionalNotes: form.additionalNotes.trim(),
      totalItems: totals.totalItems,
      netTotalAmount: totals.netTotalAmount,
      orderTotal: totals.orderTotal,
      status: form.status,
      addedBy: editingOrder?.addedBy || currentUser?.name || 'Admin',
    };

    if (editingOrder) updatePurchaseOrder(payload);
    else addPurchaseOrder(payload);

    if (selectedReq && selectedReq.status !== 'Ordered') {
      updatePurchaseRequisition({ ...selectedReq, status: 'Ordered' });
    }

    closeModal();
  };

  const handleDelete = (id: string) => {
    if (purchases.some(purchase => purchase.purchaseOrderId === id)) {
      addNotification({
        title: 'Delete blocked',
        message: 'This purchase order cannot be deleted because it is linked to an existing purchase.',
        type: 'warning',
      });
      return;
    }
    if (confirm('Delete this purchase order?')) deletePurchaseOrder(id);
  };

  const handleCreatePurchaseFromOrder = (orderId: string) => {
    localStorage.setItem(PREFILL_ORDER_KEY, orderId);
    onNavigate?.('add-purchase');
  };

  const filteredOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const fromMs = dateFromFilter ? new Date(`${dateFromFilter}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const toMs = dateToFilter ? new Date(`${dateToFilter}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;

    return purchaseOrders
      .filter(item => {
        const matchesSearch = !q ||
          item.referenceNo.toLowerCase().includes(q) ||
          item.supplierName.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q) ||
          item.status.toLowerCase().includes(q);
        const matchesLocation = locationFilter === 'All' || item.location === locationFilter;
        const matchesSupplier = supplierFilter === 'All' || item.supplierName === supplierFilter;
        const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
        const matchesShippingStatus = shippingStatusFilter === 'All' || (item.shippingStatus || 'Pending') === shippingStatusFilter;
        const orderDateMs = new Date(item.orderDate).getTime();
        const matchesDate = Number.isNaN(orderDateMs) ? true : (orderDateMs >= fromMs && orderDateMs <= toMs);
        return matchesSearch && matchesLocation && matchesSupplier && matchesStatus && matchesShippingStatus && matchesDate;
      })
      .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }, [purchaseOrders, searchTerm, locationFilter, supplierFilter, statusFilter, shippingStatusFilter, dateFromFilter, dateToFilter]);

  const exportRows = filteredOrders.map(item => ({
    date: formatAppDateTime(item.orderDate),
    referenceNo: item.referenceNo,
    location: item.location,
    supplier: item.supplierName,
    status: item.status,
    shippingStatus: item.shippingStatus || 'Pending',
    quantity: item.totalItems.toFixed(3),
    total: item.orderTotal.toFixed(3),
    addedBy: item.addedBy,
  }));

  const download = (content: string, type: string, filename: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const headers = ['Date', 'Reference No', 'Location', 'Supplier', 'Status', 'Shipping Status', 'Quantity', 'Order Total', 'Added By'];
    const rows = exportRows.map(r => [r.date, r.referenceNo, r.location, r.supplier, r.status, r.shippingStatus, r.quantity, r.total, r.addedBy].map(csvEscape).join(','));
    download([headers.join(','), ...rows].join('\n'), 'text/csv;charset=utf-8;', 'purchase-orders.csv');
  };

  const exportExcel = () => {
    const headers = ['Date', 'Reference No', 'Location', 'Supplier', 'Status', 'Shipping Status', 'Quantity', 'Order Total', 'Added By'];
    const rows = exportRows.map(r => [r.date, r.referenceNo, r.location, r.supplier, r.status, r.shippingStatus, r.quantity, r.total, r.addedBy].join('\t'));
    download([headers.join('\t'), ...rows].join('\n'), 'application/vnd.ms-excel;charset=utf-8;', 'purchase-orders.xls');
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    let y = 44;
    const marginX = 36;
    const width = doc.internal.pageSize.getWidth() - marginX * 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Purchase Orders Report', marginX, y);
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, marginX, y);
    y += 18;
    exportRows.forEach((row, idx) => {
      const line = `${idx + 1}. ${row.referenceNo} | ${row.date} | ${row.supplier} | ${row.status} | ${row.quantity} | ${row.total}`;
      const wrapped = doc.splitTextToSize(line, width);
      if (y + wrapped.length * 14 > doc.internal.pageSize.getHeight() - 36) {
        doc.addPage();
        y = 44;
      }
      doc.text(wrapped, marginX, y);
      y += wrapped.length * 14 + 2;
    });
    doc.save('purchase-orders.pdf');
  };

  const handlePrint = () => {
    printDocument({
      title: 'Purchase Orders',
      businessName: settings?.businessName || 'ATWAR AL MUSTAQBAL',
      businessAddress: settings?.businessAddress || settings?.address || '',
      printedBy: currentUser?.name || '',
      columns: [
        { label: 'Date', width: '90px' },
        { label: 'Reference No', width: '100px' },
        { label: 'Supplier' },
        { label: 'Location' },
        { label: 'Status', width: '80px', align: 'center' },
        { label: 'Shipping', width: '80px', align: 'center' },
        { label: 'Qty', width: '55px', align: 'right' },
        { label: 'Total', width: '90px', align: 'right' },
      ],
      rows: exportRows.map(r => [
        r.date,
        r.referenceNo,
        r.supplier,
        r.location,
        statusBadge(r.status),
        statusBadge(r.shippingStatus),
        r.quantity,
        r.total,
      ]),
    });
  };

  const getStatusClass = (status: GlobalPurchaseOrder['status']) =>
    status === 'Draft' ? 'bg-slate-100 text-slate-700' :
      status === 'Sent' ? 'bg-blue-100 text-blue-700' :
        status === 'Received' ? 'bg-emerald-100 text-emerald-700' :
          'bg-amber-100 text-amber-700';

  const getShippingStatusClass = (status: PurchaseOrderFormState['shippingStatus'] | undefined) => {
    if (status === 'Delivered') return 'bg-emerald-100 text-emerald-700';
    if (status === 'Shipped') return 'bg-blue-100 text-blue-700';
    if (status === 'Ordered') return 'bg-violet-100 text-violet-700';
    return 'bg-amber-100 text-amber-700';
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Purchase Order</h2>
      </div>
      {!isModalOpen && (
      <>
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        <div className="text-[#0ea5e9] text-sm font-bold mb-3 flex items-center gap-2">
          <Filter size={16} /> Filters
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Business Location:</label>
            <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-sm">
              <option value="All">All</option>
              {locationOptions.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Supplier:</label>
            <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-sm">
              <option value="All">All</option>
              {supplierOptions.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Status:</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-sm">
              <option value="All">All</option>
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Received">Received</option>
              <option value="Partial">Partial</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Shipping Status:</label>
            <select value={shippingStatusFilter} onChange={(e) => setShippingStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded bg-white text-sm">
              <option value="All">All</option>
              <option value="Pending">Pending</option>
              <option value="Ordered">Ordered</option>
              <option value="Shipped">Shipped</option>
              <option value="Delivered">Delivered</option>
            </select>
          </div>
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Date From:</label>
              <input type="date" value={dateFromFilter} onChange={(e) => setDateFromFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Date To:</label>
              <input type="date" value={dateToFilter} onChange={(e) => setDateToFilter(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="p-5 border-b border-slate-100 flex flex-col xl:flex-row justify-between gap-4 xl:items-center">
          <div className="text-sm font-bold text-slate-700">All purchase orders</div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setShowFilters(prev => !prev)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border ${showFilters ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <Filter size={14} /> {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
            <button onClick={exportCSV} className="px-3 py-2 border border-slate-200 rounded text-xs font-bold flex items-center gap-1"><FileText size={14} /> Export CSV</button>
            <button onClick={exportExcel} className="px-3 py-2 border border-slate-200 rounded text-xs font-bold flex items-center gap-1"><FileSpreadsheet size={14} /> Export Excel</button>
            <button onClick={handlePrint} className="px-3 py-2 border border-slate-200 rounded text-xs font-bold flex items-center gap-1"><Printer size={14} /> Print</button>
            <button onClick={exportPDF} className="px-3 py-2 border border-slate-200 rounded text-xs font-bold flex items-center gap-1"><Download size={14} /> Export PDF</button>
            <button onClick={openAddModal} className="ml-2 bg-indigo-600 text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-indigo-700 flex items-center gap-1">
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-slate-100">
          <div className="relative w-full xl:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded text-sm" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Reference No</th>
                <th className="px-4 py-3 text-left">Location</th>
                <th className="px-4 py-3 text-left">Supplier</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Quantity Remaining</th>
                <th className="px-4 py-3 text-left">Shipping Status</th>
                <th className="px-4 py-3 text-left">Added By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length > 0 ? filteredOrders.map(order => (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleCreatePurchaseFromOrder(order.id)} className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded" title="Create Purchase">
                        <Plus size={14} />
                      </button>
                      <button onClick={() => openEditModal(order)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => handleDelete(order.id)} className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatAppDateTime(order.orderDate)}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">{order.referenceNo}</td>
                  <td className="px-4 py-3 text-slate-700">{order.location}</td>
                  <td className="px-4 py-3 text-slate-700">{order.supplierName}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getStatusClass(order.status)}`}>{order.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold">{order.totalItems.toFixed(3)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getShippingStatusClass(order.shippingStatus)}`}>{order.shippingStatus || 'Pending'}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{order.addedBy}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400 italic">No purchase orders found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {isModalOpen && (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
          <div className="w-full bg-white rounded-[2rem] border border-slate-100 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">{editingOrder ? 'Edit Purchase Order' : 'Add Purchase Order'}</h3>
              <button onClick={closeModal} className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="p-4 bg-slate-100 space-y-3">
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  <div className="lg:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Supplier: <span className="text-rose-500">*</span></label>
                    <div className="flex gap-2">
                      <select value={form.supplierId} onChange={(e) => handleSupplierChange(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white">
                        <option value="">Please Select</option>
                        {supplierOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <button type="button" className="px-2 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" title="Create supplier in Contacts > Suppliers">
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Reference No:</label>
                    <input type="text" value={form.referenceNo} onChange={(e) => setForm(prev => ({ ...prev, referenceNo: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Order date: <span className="text-rose-500">*</span></label>
                    <input type="datetime-local" value={form.orderDate} onChange={(e) => setForm(prev => ({ ...prev, orderDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Delivery date:</label>
                    <input type="date" value={form.deliveryDate} onChange={(e) => setForm(prev => ({ ...prev, deliveryDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
                  </div>

                  <div className="lg:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Address:</label>
                    <textarea rows={2} value={form.supplierAddress} onChange={(e) => setForm(prev => ({ ...prev, supplierAddress: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded text-sm resize-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">Business Location: <Info size={12} className="text-blue-500" /></label>
                    <select value={form.location} onChange={(e) => setForm(prev => ({ ...prev, location: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white">
                      <option value="">Please Select</option>
                      {locationOptions.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">Pay term: <Info size={12} className="text-blue-500" /></label>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" min="0" value={form.payTermValue} onChange={(e) => setForm(prev => ({ ...prev, payTermValue: e.target.value }))} placeholder="Pay term" className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
                      <select value={form.payTermType} onChange={(e) => setForm(prev => ({ ...prev, payTermType: e.target.value as 'Days' | 'Months' }))} className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white">
                        <option value="Days">Days</option>
                        <option value="Months">Months</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Attach Document:</label>
                    <label className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white flex items-center justify-between cursor-pointer">
                      <span className="truncate text-slate-500">{form.attachDocumentName || 'Browse...'}</span>
                      <span className="text-blue-600 flex items-center gap-1"><Upload size={12} /> Browse</span>
                      <input type="file" className="hidden" onChange={(e) => setForm(prev => ({ ...prev, attachDocumentName: e.target.files?.[0]?.name || '' }))} />
                    </label>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Purchase Requisition:</label>
                    <select value={form.purchaseRequisitionId} onChange={(e) => handleSelectRequisition(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white">
                      <option value="">Select requisition</option>
                      {requisitionOptions.map(r => <option key={r.id} value={r.id}>{r.referenceNo}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Status:</label>
                    <select value={form.status} onChange={(e) => setForm(prev => ({ ...prev, status: e.target.value as PurchaseOrderFormState['status'] }))} className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white">
                      <option value="Draft">Draft</option>
                      <option value="Sent">Sent</option>
                      <option value="Received">Received</option>
                      <option value="Partial">Partial</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-3">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <div className="lg:col-span-2 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={productQuickSearch}
                      onChange={(e) => setProductQuickSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded text-sm"
                      placeholder="Enter Product name / SKU / Scan bar code"
                    />
                    {productQuickSearch.trim() && quickProductMatches.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow max-h-56 overflow-y-auto">
                        {quickProductMatches.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => addQuickProduct(p.id)}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs border-b border-slate-100 last:border-b-0"
                          >
                            <div className="font-bold text-slate-700">{p.name}</div>
                            <div className="text-slate-500">SKU: {p.sku} | Cost: {formatCurrency(toNumber(p.unitPurchasePrice))}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-end">
                    <button type="button" onClick={() => addItemRow()} className="text-sm font-bold text-blue-600 hover:text-blue-700">
                      + Add new product
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto mt-3 border border-slate-200 rounded">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-[#5cb85c] text-white text-[11px] uppercase tracking-wider font-bold">
                        <th className="px-3 py-2 w-10">#</th>
                        <th className="px-3 py-2 text-left border-l border-[#4cae4c]">Product Name</th>
                        <th className="px-3 py-2 text-center border-l border-[#4cae4c]">Order quantity</th>
                        <th className="px-3 py-2 text-right border-l border-[#4cae4c]">Unit Cost (Before Discount)</th>
                        <th className="px-3 py-2 text-center border-l border-[#4cae4c]">Discount Percent</th>
                        <th className="px-3 py-2 text-right border-l border-[#4cae4c]">Unit Cost (Before Tax)</th>
                        <th className="px-3 py-2 text-right border-l border-[#4cae4c]">Line Total</th>
                        <th className="px-3 py-2 text-center border-l border-[#4cae4c] w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {form.items.length > 0 ? form.items.map((item, index) => (
                        <tr key={item.rowId}>
                          <td className="px-3 py-2 text-center text-slate-500 font-bold">{index + 1}</td>
                          <td className="px-3 py-2">
                            <select value={item.productId} onChange={(e) => handleSelectProductForRow(item.rowId, e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white">
                              <option value="">Select product</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="1" step="1" value={item.orderQty} onChange={(e) => handleUpdateItemNumber(item.rowId, 'orderQty', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-center" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" step="0.001" value={item.unitCostBeforeDiscount} onChange={(e) => handleUpdateItemNumber(item.rowId, 'unitCostBeforeDiscount', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-right" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" max="100" step="0.001" value={item.discountPercent} onChange={(e) => handleUpdateItemNumber(item.rowId, 'discountPercent', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-center" />
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-slate-700">{toNumber(item.unitCostBeforeTax).toFixed(3)}</td>
                          <td className="px-3 py-2 text-right font-bold text-slate-900">{toNumber(item.lineTotal).toFixed(3)}</td>
                          <td className="px-3 py-2 text-center">
                            <button type="button" onClick={() => handleRemoveItem(item.rowId)} className="text-rose-500 hover:text-rose-700">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={8} className="px-3 py-6 text-center text-slate-400 italic">No products added yet. Use search or "Add new product".</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Shipping Details</label>
                    <textarea rows={2} value={form.shippingDetails} onChange={(e) => setForm(prev => ({ ...prev, shippingDetails: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded text-sm resize-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Shipping Address</label>
                    <textarea rows={2} value={form.shippingAddress} onChange={(e) => setForm(prev => ({ ...prev, shippingAddress: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded text-sm resize-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Shipping Charges</label>
                    <input type="number" min="0" step="0.001" value={form.shippingCharges} onChange={(e) => setForm(prev => ({ ...prev, shippingCharges: toNumber(e.target.value) }))} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Shipping Status</label>
                    <select value={form.shippingStatus} onChange={(e) => setForm(prev => ({ ...prev, shippingStatus: e.target.value as PurchaseOrderFormState['shippingStatus'] }))} className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white">
                      <option value="Pending">Pending</option>
                      <option value="Ordered">Ordered</option>
                      <option value="Shipped">Shipped</option>
                      <option value="Delivered">Delivered</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Delivered To</label>
                    <input type="text" value={form.deliveredTo} onChange={(e) => setForm(prev => ({ ...prev, deliveredTo: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Shipping Documents</label>
                    <label className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white flex items-center justify-between cursor-pointer">
                      <span className="truncate text-slate-500">{form.shippingDocumentName || 'Browse...'}</span>
                      <span className="text-blue-600 flex items-center gap-1"><Upload size={12} /> Browse</span>
                      <input type="file" className="hidden" onChange={(e) => setForm(prev => ({ ...prev, shippingDocumentName: e.target.files?.[0]?.name || '' }))} />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Additional Expenses</label>
                    <input type="number" min="0" step="0.001" value={form.additionalExpenses} onChange={(e) => setForm(prev => ({ ...prev, additionalExpenses: toNumber(e.target.value) }))} className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Additional Notes</label>
                    <textarea rows={2} value={form.additionalNotes} onChange={(e) => setForm(prev => ({ ...prev, additionalNotes: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded text-sm resize-none" />
                  </div>
                </div>

                <div className="mt-4 ml-auto w-full max-w-md bg-slate-50 border border-slate-200 rounded p-3 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-600">Net Total:</span><span className="font-bold">{formatCurrency(totals.netTotalAmount)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Shipping Charges:</span><span className="font-bold">{formatCurrency(totals.shippingCharges)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Additional Expenses:</span><span className="font-bold">{formatCurrency(totals.additionalExpenses)}</span></div>
                  <div className="h-px bg-slate-200"></div>
                  <div className="flex justify-between text-base"><span className="font-black text-slate-900">Order Total:</span><span className="font-black text-slate-900">{formatCurrency(totals.orderTotal)}</span></div>
                </div>
              </div>

              {formError && <div className="px-3 py-2 rounded border border-rose-200 bg-rose-50 text-rose-700 text-sm font-medium">{formError}</div>}
              <div className="flex justify-center pb-2">
                <button onClick={handleSave} className="px-8 py-2 rounded bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrder;
