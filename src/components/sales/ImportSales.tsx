import React, { useMemo, useRef, useState } from 'react';
import { Download, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import type { Sale, SaleItem } from '@/context/GlobalContext';
import { formatDateTimeBySettings } from '@/utils/dateTime';

type PaymentStatus = Sale['paymentStatus'];
type Step = 'upload' | 'preview' | 'done';

interface ImportSalesProps {
  onNavigate?: (page: string) => void;
}

type ColumnKey =
  | 'invoiceNo'
  | 'customerName'
  | 'customerPhone'
  | 'customerEmail'
  | 'saleDate'
  | 'businessLocation'
  | 'productName'
  | 'productSku'
  | 'quantity'
  | 'unitPrice'
  | 'itemTax'
  | 'itemDiscount'
  | 'orderTotal'
  | 'paymentStatus'
  | 'amountPaid'
  | 'paymentMethod';

interface ColumnDefinition {
  key: ColumnKey;
  name: string;
  required: boolean;
  instruction: string;
  aliases?: string[];
}

interface ParsedSaleLine {
  rowNum: number;
  invoiceNo: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  saleDate: string;
  location: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  itemTax: number;
  itemDiscount: number;
  orderTotal?: number;
  paymentStatusInput: string;
  amountPaidInput?: number;
  paymentMethod: string;
  matchedCustomerId?: string | number;
  matchedCustomerName?: string;
  matchedCustomerPhone?: string;
  matchedProductId?: string;
  matchedProductName?: string;
  matchedUnit?: string;
  error?: string;
}

interface GroupedSale {
  key: string;
  invoiceNo: string;
  customerName: string;
  customerId: string | number;
  contactNumber: string;
  date: string;
  location: string;
  lines: ParsedSaleLine[];
  grandTotal: number;
  paymentStatus: PaymentStatus;
  totalPaid: number;
  sellDue: number;
  paymentMethod: string;
  error?: string;
}

interface ImportBatchRecord {
  id: string;
  imported: number;
  skipped: number;
  importTime: string;
  createdBy: string;
  invoices: number;
}


const columns: ColumnDefinition[] = [
  { key: 'invoiceNo', name: 'Invoice No.', required: false, instruction: 'Optional - leave blank to auto-generate' },
  { key: 'customerName', name: 'Customer name', required: true, instruction: 'Must match an existing customer name' },
  { key: 'customerPhone', name: 'Customer Phone number', required: false, instruction: 'Either phone, email, or name can match customer' },
  { key: 'customerEmail', name: 'Customer Email', required: false, instruction: 'Either phone, email, or name can match customer' },
  { key: 'saleDate', name: 'Sale Date', required: false, instruction: 'Format: YYYY-MM-DD. Blank uses today' },
  { key: 'businessLocation', name: 'Business Location', required: true, instruction: 'Must match an existing business location name' },
  { key: 'productName', name: 'Product Name', required: false, instruction: 'Either product name or SKU required' },
  { key: 'productSku', name: 'Product SKU', required: false, instruction: 'Either product name or SKU required' },
  { key: 'quantity', name: 'Quantity', required: true, instruction: 'Required - numbers only, must be > 0' },
  { key: 'unitPrice', name: 'Unit Price', required: true, instruction: 'Selling price per unit' },
  { key: 'itemTax', name: 'Item Tax', required: false, instruction: 'Tax amount per line (numbers only)' },
  { key: 'itemDiscount', name: 'Item Discount', required: false, instruction: 'Discount per line (numbers only)' },
  { key: 'orderTotal', name: 'Order Total', required: false, instruction: 'Optional line total; blank = auto-calculate' },
  { key: 'paymentStatus', name: 'Payment Status', required: false, instruction: 'Optional: Paid, Due, Partial, Overdue' },
  { key: 'amountPaid', name: 'Amount Paid', required: false, instruction: 'Optional numeric. Required when Payment Status = Partial' },
  { key: 'paymentMethod', name: 'Payment Method', required: false, instruction: 'Optional payment method' },
];

const TEMPLATE_HEADERS = columns.map(col => col.name);

const parseCSVLine = (line: string): string[] => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
};

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalizeHeader = (value: string) => normalizeText(value.replace(/^\uFEFF/, '')).toLowerCase();
const normalizePhone = (value: string) => normalizeText(value).replace(/[\s-]/g, '').toLowerCase();
const round3 = (value: number) => Math.round(value * 1000) / 1000;

const resolveHeaderIndexes = (headerCells: string[]): Partial<Record<ColumnKey, number>> => {
  const normalizedHeaders = headerCells.map(normalizeHeader);
  const resolved: Partial<Record<ColumnKey, number>> = {};
  columns.forEach((col) => {
    const aliases = [col.name, ...(col.aliases || [])].map(normalizeHeader);
    const idx = normalizedHeaders.findIndex(h => aliases.includes(h));
    if (idx >= 0) resolved[col.key] = idx;
  });
  return resolved;
};

const normalizeSaleDate = (raw: string): { value: string; error?: string } => {
  const input = normalizeText(raw);
  if (!input) return { value: new Date().toISOString().split('T')[0] };

  const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]) - 1;
    const day = Number(iso[3]);
    const parsed = new Date(year, month, day);
    if (parsed.getFullYear() !== year || parsed.getMonth() !== month || parsed.getDate() !== day) {
      return { value: '', error: `Invalid Sale Date "${raw}"` };
    }
    return { value: `${iso[1]}-${iso[2]}-${iso[3]}` };
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return { value: '', error: `Invalid Sale Date "${raw}"` };
  return { value: parsed.toISOString().split('T')[0] };
};

const normalizePaymentStatus = (raw: string): PaymentStatus | null => {
  const normalized = normalizeText(raw).toLowerCase();
  if (!normalized) return null;
  if (normalized === 'paid') return 'Paid';
  if (normalized === 'due') return 'Due';
  if (normalized === 'partial' || normalized === 'partially paid') return 'Partial';
  if (normalized === 'overdue') return 'Overdue';
  return null;
};

const incrementInvoiceSerial = (invoiceNo: string): string => {
  const match = invoiceNo.match(/^(.*?)(\d+)$/);
  if (!match) return `${invoiceNo}-1`;
  const serial = Number(match[2]);
  if (!Number.isFinite(serial)) return `${invoiceNo}-1`;
  return `${match[1]}${String(serial + 1).padStart(match[2].length, '0')}`;
};

const ImportSales: React.FC<ImportSalesProps> = () => {
  const {
    customers,
    products,
    sales,
    locations,
    currentUser,
    addSale,
    generateId,
    nextInvoiceNumber,
    settings,
  } = useGlobalContext();
  const { addNotification } = useNotifications();
  const formatDateTimeDisplay = (value?: string) =>
    formatDateTimeBySettings(value || '', settings.dateFormat, settings.timeFormat, settings.timeZone);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>('upload');
  const [groupedSales, setGroupedSales] = useState<GroupedSale[]>([]);
  const [importResults, setImportResults] = useState<{ imported: number; skipped: number } | null>(null);
  const [importHistory, setImportHistory] = useState<ImportBatchRecord[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const existingInvoiceSet = useMemo(
    () => new Set(sales.map(sale => normalizeText(String(sale.invoiceNo || '')).toLowerCase()).filter(Boolean)),
    [sales]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setStep('upload');
    setGroupedSales([]);
    setImportResults(null);
  };

  const handleDownloadTemplate = () => {
    const today = new Date().toISOString().split('T')[0];
    const defaultLocation = locations[0]?.name || 'Main Store';
    const exampleRows = [
      ['INV-2026-0001', 'Walk-in Customer', '96000001', 'customer@email.com', today, defaultLocation, 'Wireless Keyboard', 'SKU-KB-001', '2', '15.000', '0.750', '0', '', 'Paid', '31.500', 'Cash'],
      ['INV-2026-0001', 'Walk-in Customer', '96000001', 'customer@email.com', today, defaultLocation, 'USB Mouse', 'SKU-MS-001', '1', '8.500', '0.425', '0', '', 'Paid', '31.500', 'Cash'],
    ];
    const csv = [TEMPLATE_HEADERS.join(','), ...exampleRows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleParseFile = () => {
    if (!selectedFile) return;
    const reader = new FileReader();
    reader.onerror = () => {
      addNotification({ type: 'error', title: 'Read Error', message: 'Unable to read the selected file.' });
    };
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) {
        addNotification({ type: 'error', title: 'Empty File', message: 'No data rows found.' });
        return;
      }

      const headerCells = parseCSVLine(lines[0]).map(c => normalizeText(c));
      const headerIndexes = resolveHeaderIndexes(headerCells);
      const missingRequired = columns
        .filter(col => col.required && headerIndexes[col.key] === undefined)
        .map(col => col.name);
      if (missingRequired.length > 0) {
        addNotification({ type: 'error', title: 'Invalid Template', message: `Missing required column(s): ${missingRequired.join(', ')}` });
        return;
      }

      const locationNameMap = new Map<string, string>();
      locations.forEach(location => locationNameMap.set(normalizeText(location.name).toLowerCase(), location.name));
      const rows: ParsedSaleLine[] = [];

      for (let i = 1; i < lines.length; i += 1) {
        const cells = parseCSVLine(lines[i]);
        const get = (key: ColumnKey) => {
          const idx = headerIndexes[key];
          return idx === undefined ? '' : normalizeText(cells[idx] || '');
        };

        const invoiceNo = get('invoiceNo');
        const customerName = get('customerName');
        const customerPhone = get('customerPhone');
        const customerEmail = get('customerEmail');
        const saleDateRaw = get('saleDate');
        const businessLocationRaw = get('businessLocation');
        const productName = get('productName');
        const productSku = get('productSku');
        const quantityRaw = get('quantity');
        const unitPriceRaw = get('unitPrice');
        const itemTaxRaw = get('itemTax');
        const itemDiscountRaw = get('itemDiscount');
        const orderTotalRaw = get('orderTotal');
        const paymentStatusInput = get('paymentStatus');
        const amountPaidRaw = get('amountPaid');
        const paymentMethod = get('paymentMethod');

        const normalizedDate = normalizeSaleDate(saleDateRaw);
        const resolvedLocation = locationNameMap.get(normalizeText(businessLocationRaw).toLowerCase()) || '';
        const quantity = Number(quantityRaw);
        const unitPrice = Number(unitPriceRaw);
        const itemTax = itemTaxRaw ? Number(itemTaxRaw) : 0;
        const itemDiscount = itemDiscountRaw ? Number(itemDiscountRaw) : 0;
        const orderTotal = orderTotalRaw ? Number(orderTotalRaw) : undefined;
        const amountPaid = amountPaidRaw ? Number(amountPaidRaw) : undefined;
        const normalizedStatus = normalizePaymentStatus(paymentStatusInput);

        let error: string | undefined;
        if (!customerName && !customerPhone && !customerEmail) error = 'Customer name, phone, or email is required';
        else if (!businessLocationRaw) error = 'Business Location is required';
        else if (!resolvedLocation) error = `Location "${businessLocationRaw}" not found`;
        else if (!productName && !productSku) error = 'Product Name or Product SKU is required';
        else if (!Number.isFinite(quantity) || quantity <= 0) error = `Invalid Quantity "${quantityRaw}"`;
        else if (!Number.isFinite(unitPrice) || unitPrice < 0) error = `Invalid Unit Price "${unitPriceRaw}"`;
        else if (!Number.isFinite(itemTax) || itemTax < 0) error = `Invalid Item Tax "${itemTaxRaw}"`;
        else if (!Number.isFinite(itemDiscount) || itemDiscount < 0) error = `Invalid Item Discount "${itemDiscountRaw}"`;
        else if (itemDiscount > (unitPrice * quantity)) error = 'Item Discount cannot exceed line amount';
        else if (orderTotalRaw && (!Number.isFinite(orderTotal as number) || (orderTotal as number) < 0)) error = `Invalid Order Total "${orderTotalRaw}"`;
        else if (normalizedDate.error) error = normalizedDate.error;
        else if (paymentStatusInput && !normalizedStatus) error = `Invalid Payment Status "${paymentStatusInput}"`;
        else if (amountPaidRaw && (!Number.isFinite(amountPaid as number) || (amountPaid as number) < 0)) error = `Invalid Amount Paid "${amountPaidRaw}"`;

        const matchedProduct = !error
          ? products.find(product =>
              (productSku && normalizeText(product.sku || '').toLowerCase() === normalizeText(productSku).toLowerCase()) ||
              (productName && normalizeText(product.name).toLowerCase() === normalizeText(productName).toLowerCase())
            )
          : undefined;
        if (!error && !matchedProduct) error = `Product "${productSku || productName}" not found`;

        const phoneNorm = normalizePhone(customerPhone);
        const emailNorm = normalizeText(customerEmail).toLowerCase();
        const nameNorm = normalizeText(customerName).toLowerCase();
        const matchedCustomer = !error
          ? customers.find(customer => {
              const customerPhoneNorm = normalizePhone(customer.mobile || '');
              const customerEmailNorm = normalizeText(customer.email || '').toLowerCase();
              const customerNameNorm = normalizeText(customer.name || '').toLowerCase();
              const customerBusinessNorm = normalizeText(customer.businessName || '').toLowerCase();
              return (
                (phoneNorm && customerPhoneNorm === phoneNorm) ||
                (emailNorm && customerEmailNorm === emailNorm) ||
                (nameNorm && (customerNameNorm === nameNorm || customerBusinessNorm === nameNorm))
              );
            })
          : undefined;
        if (!error && !matchedCustomer) error = `Customer "${customerName || customerPhone || customerEmail}" not found`;

        rows.push({
          rowNum: i + 1,
          invoiceNo,
          customerName,
          customerPhone,
          customerEmail,
          saleDate: normalizedDate.value,
          location: resolvedLocation || businessLocationRaw,
          productName,
          productSku,
          quantity: Number.isFinite(quantity) ? quantity : 0,
          unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
          itemTax: Number.isFinite(itemTax) ? itemTax : 0,
          itemDiscount: Number.isFinite(itemDiscount) ? itemDiscount : 0,
          orderTotal: Number.isFinite(orderTotal as number) ? orderTotal : undefined,
          paymentStatusInput,
          amountPaidInput: Number.isFinite(amountPaid as number) ? amountPaid : undefined,
          paymentMethod,
          matchedCustomerId: matchedCustomer?.id,
          matchedCustomerName: matchedCustomer?.name || matchedCustomer?.businessName || customerName,
          matchedCustomerPhone: matchedCustomer?.mobile || customerPhone,
          matchedProductId: matchedProduct?.id,
          matchedProductName: matchedProduct?.name || productName || productSku,
          matchedUnit: matchedProduct?.unit,
          error,
        });
      }

      const groupsMap = new Map<string, ParsedSaleLine[]>();
      rows.forEach((line) => {
        const invoiceKey = normalizeText(line.invoiceNo).toLowerCase();
        const fallbackKey = `${normalizeText(line.customerName || String(line.matchedCustomerId || '')).toLowerCase()}|${line.saleDate}|${normalizeText(line.location).toLowerCase()}`;
        const key = invoiceKey ? `INV::${invoiceKey}` : `AUTO::${fallbackKey}`;
        if (!groupsMap.has(key)) groupsMap.set(key, []);
        groupsMap.get(key)!.push(line);
      });

      const grouped: GroupedSale[] = Array.from(groupsMap.entries()).map(([key, groupLines]) => {
        const first = groupLines[0];
        const lineError = groupLines.find(line => line.error)?.error;
        let error = lineError;

        const customerIds = Array.from(new Set(groupLines.map(line => String(line.matchedCustomerId || '').trim()).filter(Boolean)));
        const locationsInGroup = Array.from(new Set(groupLines.map(line => normalizeText(line.location).toLowerCase()).filter(Boolean)));
        const datesInGroup = Array.from(new Set(groupLines.map(line => line.saleDate).filter(Boolean)));
        const paymentStatuses = Array.from(new Set(groupLines.map(line => normalizeText(line.paymentStatusInput).toLowerCase()).filter(Boolean)));

        if (!error && customerIds.length > 1) error = 'Rows in this invoice match different customers';
        if (!error && locationsInGroup.length > 1) error = 'Rows in this invoice have different business locations';
        if (!error && datesInGroup.length > 1) error = 'Rows in this invoice have different sale dates';
        if (!error && paymentStatuses.length > 1) error = 'Rows in this invoice have different payment statuses';
        if (!error && first.invoiceNo && existingInvoiceSet.has(normalizeText(first.invoiceNo).toLowerCase())) error = `Invoice "${first.invoiceNo}" already exists`;

        const grandTotal = round3(groupLines.reduce((sum, line) => sum + (line.orderTotal ?? (line.unitPrice * line.quantity - line.itemDiscount + line.itemTax)), 0));
        let paymentStatus: PaymentStatus = 'Due';
        let totalPaid = first.amountPaidInput;
        const statusFromFile = normalizePaymentStatus(first.paymentStatusInput);

        if (statusFromFile) paymentStatus = statusFromFile;
        else if (typeof totalPaid === 'number') paymentStatus = totalPaid >= grandTotal - 0.001 ? 'Paid' : totalPaid > 0 ? 'Partial' : 'Due';

        if (typeof totalPaid !== 'number') {
          if (paymentStatus === 'Paid') totalPaid = grandTotal;
          else if (paymentStatus === 'Partial') error = error || 'Amount Paid is required when Payment Status is Partial';
          else totalPaid = 0;
        }

        totalPaid = round3(Number(totalPaid || 0));
        const sellDue = round3(Math.max(0, grandTotal - totalPaid));

        if (!error && totalPaid > grandTotal + 0.001) error = 'Amount Paid cannot exceed invoice total';
        if (!error && paymentStatus === 'Paid' && totalPaid < grandTotal - 0.001) error = 'Paid status requires Amount Paid equal to invoice total';
        if (!error && (paymentStatus === 'Due' || paymentStatus === 'Overdue') && totalPaid > 0.001) error = `${paymentStatus} status cannot have Amount Paid greater than 0`;
        if (!error && paymentStatus === 'Partial' && (totalPaid <= 0.001 || totalPaid >= grandTotal - 0.001)) error = 'Partial status requires Amount Paid between 0 and invoice total';

        return {
          key,
          invoiceNo: first.invoiceNo,
          customerName: first.matchedCustomerName || first.customerName,
          customerId: first.matchedCustomerId || '',
          contactNumber: first.matchedCustomerPhone || '',
          date: first.saleDate,
          location: first.location,
          lines: groupLines,
          grandTotal,
          paymentStatus,
          totalPaid,
          sellDue,
          paymentMethod: first.paymentMethod || (totalPaid > 0 ? 'Cash' : ''),
          error,
        };
      });

      setGroupedSales(grouped);
      setStep('preview');
    };
    reader.readAsText(selectedFile);
  };

  const handleConfirmImport = () => {
    const validSales = groupedSales.filter(group => !group.error);
    if (validSales.length === 0) {
      addNotification({ type: 'error', title: 'No Valid Invoices', message: 'Please fix the errors and try again.' });
      return;
    }

    let imported = 0;
    let skipped = 0;
    const usedInvoices = new Set(existingInvoiceSet);
    const allocateInvoiceNo = (preferredInvoice: string, locationName: string) => {
      const preferred = normalizeText(preferredInvoice);
      if (preferred) {
        usedInvoices.add(preferred.toLowerCase());
        return preferred;
      }
      let candidate = nextInvoiceNumber(locationName);
      let guard = 0;
      while (usedInvoices.has(normalizeText(candidate).toLowerCase()) && guard < 2000) {
        candidate = incrementInvoiceSerial(candidate);
        guard += 1;
      }
      usedInvoices.add(normalizeText(candidate).toLowerCase());
      return candidate;
    };

    validSales.forEach((group) => {
      const items: SaleItem[] = group.lines.map((line) => {
        const subtotal = round3((line.unitPrice * line.quantity) - line.itemDiscount);
        return {
          id: String(line.matchedProductId || line.productSku || line.productName),
          name: line.matchedProductName || line.productName || line.productSku || 'Unknown Product',
          qty: line.quantity,
          unitPrice: line.unitPrice,
          discount: line.itemDiscount,
          subtotal,
          tax: round3(line.itemTax),
          total: round3(subtotal + line.itemTax),
          unit: line.matchedUnit,
        };
      });

      const subTotal = round3(items.reduce((sum, item) => sum + item.subtotal, 0));
      const taxTotal = round3(items.reduce((sum, item) => sum + item.tax, 0));
      const invoiceNo = allocateInvoiceNo(group.invoiceNo, group.location);

      const sale: Sale = {
        id: generateId('SALE'),
        invoiceNo,
        date: group.date,
        customerId: group.customerId,
        customerName: group.customerName,
        contactNumber: group.contactNumber,
        location: group.location,
        saleType: group.paymentStatus === 'Due' || group.paymentStatus === 'Overdue' ? 'Credit Sale' : 'Paid',
        saleStatus: 'Final',
        status: 'Final',
        paymentStatus: group.paymentStatus,
        paymentMethod: group.totalPaid > 0 ? (group.paymentMethod || 'Cash') : '',
        paymentAccount: group.totalPaid > 0 ? 'Cash Account' : 'None',
        totalAmount: group.grandTotal,
        totalPaid: group.totalPaid,
        sellDue: group.sellDue,
        shippingStatus: 'Ordered',
        shippingCharges: 0,
        subTotal,
        discountType: 'None',
        discountAmount: 0,
        tax: taxTotal > 0 ? taxTotal.toFixed(3) : 'None',
        grandTotal: group.grandTotal,
        items,
        totalItems: items.length,
        addedBy: currentUser?.name || 'System',
      };

      const created = addSale(sale);
      if (created) {
        imported += 1;
      } else {
        skipped += 1;
      }
    });

    skipped += groupedSales.length - validSales.length;
    const batch: ImportBatchRecord = {
      id: `batch-${Date.now()}`,
      imported,
      skipped,
      importTime: new Date().toISOString(),
      createdBy: currentUser?.name || 'System',
      invoices: groupedSales.length,
    };

    setImportHistory(prev => [batch, ...prev].slice(0, 25));
    setImportResults({ imported, skipped });
    setStep('done');
    addNotification({ type: 'success', title: 'Import Complete', message: `${imported} sale(s) imported successfully.${skipped > 0 ? ` ${skipped} invoice(s) skipped.` : ''}` });
  };

  const handleReset = () => {
    setSelectedFile(null);
    setStep('upload');
    setGroupedSales([]);
    setImportResults(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const validCount = groupedSales.filter(group => !group.error).length;
  const errorCount = groupedSales.filter(group => !!group.error).length;

  return (
    <div className="space-y-8 animate-fade-in pb-20 max-w-[1600px] mx-auto">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Import Sales</h2>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        {step !== 'done' && (
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
            <div className="w-full md:w-1/2">
              <label className="block text-sm font-bold text-slate-900 mb-2">File To Import:</label>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer">
                  <span className="px-4 py-2 bg-slate-100 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-200 transition-colors flex items-center gap-2">
                    <Upload size={14} /> Choose File
                  </span>
                  <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} accept=".csv" />
                </label>
                <span className="text-sm text-slate-500">{selectedFile ? selectedFile.name : 'No file chosen'}</span>
              </div>
              {selectedFile && <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold mt-2"><CheckCircle2 size={12} /> Ready to parse</div>}
            </div>

            <div className="flex gap-3">
              {step === 'upload' && (
                <button
                  onClick={handleParseFile}
                  disabled={!selectedFile}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-bold shadow-md hover:bg-blue-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Upload and review
                </button>
              )}
              {step === 'preview' && (
                <>
                  <button onClick={handleReset} className="px-4 py-2 border border-slate-200 rounded text-sm font-bold text-slate-600 hover:bg-slate-50">Reset</button>
                  <button
                    onClick={handleConfirmImport}
                    disabled={validCount === 0}
                    className="px-6 py-2 bg-emerald-600 text-white rounded-md text-sm font-bold shadow-md hover:bg-emerald-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Import {validCount} Sale{validCount !== 1 ? 's' : ''}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {step !== 'done' && (
          <button onClick={handleDownloadTemplate} className="px-4 py-2 bg-emerald-500 text-white rounded-md text-sm font-bold shadow-md hover:bg-emerald-600 transition-all flex items-center gap-2">
            <Download size={16} /> Download template file
          </button>
        )}

        {step === 'done' && importResults && (
          <div className="text-center py-12">
            <CheckCircle2 className="mx-auto text-emerald-500 mb-4" size={56} />
            <h3 className="text-2xl font-black text-slate-900 mb-2">Import Complete!</h3>
            <div className="flex justify-center gap-8 mt-6">
              <div className="text-center">
                <div className="text-3xl font-black text-emerald-600">{importResults.imported}</div>
                <div className="text-xs font-bold text-slate-500 uppercase mt-1">Sales Imported</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black text-rose-500">{importResults.skipped}</div>
                <div className="text-xs font-bold text-slate-500 uppercase mt-1">Skipped</div>
              </div>
            </div>
            <button onClick={handleReset} className="mt-8 px-8 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all">
              Import More Sales
            </button>
          </div>
        )}
      </div>

      {step === 'preview' && groupedSales.length > 0 && (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
          <div className="flex items-center gap-4 mb-4">
            <h3 className="text-base font-bold text-slate-800">Preview ({groupedSales.length} invoices)</h3>
            {validCount > 0 && <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">{validCount} valid</span>}
            {errorCount > 0 && <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold">{errorCount} errors</span>}
          </div>
          <div className="overflow-x-auto rounded border border-slate-200">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Invoice No.</th>
                  <th className="px-3 py-3">Customer</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Location</th>
                  <th className="px-3 py-3">Payment</th>
                  <th className="px-3 py-3">Items</th>
                  <th className="px-3 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupedSales.map(group => (
                  <tr key={group.key} className={group.error ? 'bg-rose-50' : 'hover:bg-slate-50'}>
                    <td className="px-3 py-2">
                      {group.error
                        ? <span className="flex items-center gap-1 text-rose-600 font-bold"><AlertCircle size={12} />{group.error}</span>
                        : <span className="flex items-center gap-1 text-emerald-600 font-bold"><CheckCircle2 size={12} />Ready</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-600">{group.invoiceNo || 'auto'}</td>
                    <td className="px-3 py-2 font-bold text-slate-800">{group.customerName}</td>
                    <td className="px-3 py-2 text-slate-500">{group.date}</td>
                    <td className="px-3 py-2 text-slate-600">{group.location}</td>
                    <td className="px-3 py-2 text-slate-600">{group.paymentStatus}</td>
                    <td className="px-3 py-2">{group.lines.length} line{group.lines.length !== 1 ? 's' : ''}</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-800">{group.grandTotal.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step === 'upload' && (
        <>
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Instructions</h3>
            <div className="space-y-2 mb-8 text-sm text-slate-600">
              <div className="flex gap-2"><span className="font-bold text-slate-900">1.</span><span>Upload sales data in CSV format. Each row is one line item.</span></div>
              <div className="flex gap-2"><span className="font-bold text-slate-900">2.</span><span>Rows with the same Invoice No. are grouped into one sale. Blank invoice uses customer/date/location grouping and auto invoice generation.</span></div>
              <div className="flex gap-2"><span className="font-bold text-slate-900">3.</span><span>Customer, Product, and Business Location must already exist in the system.</span></div>
            </div>

            <div className="overflow-x-auto border rounded-md border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-900 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 w-1/3">Importable fields</th>
                    <th className="px-6 py-3">Instructions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {columns.map(col => (
                    <tr key={col.key} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3 font-medium text-slate-700">{col.name}{col.required ? ' *' : ''}</td>
                      <td className="px-6 py-3 text-slate-500">{col.instruction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            <h3 className="text-lg font-bold text-slate-800 mb-6">Imports</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white text-slate-900 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Import batch</th>
                    <th className="px-4 py-3">Import time</th>
                    <th className="px-4 py-3">Created By</th>
                    <th className="px-4 py-3">Invoices</th>
                    <th className="px-4 py-3">Imported</th>
                    <th className="px-4 py-3">Skipped</th>
                  </tr>
                </thead>
                <tbody>
                  {importHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">No previous imports found</td>
                    </tr>
                  ) : importHistory.map(record => (
                    <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{record.id}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDateTimeDisplay(record.importTime)}</td>
                      <td className="px-4 py-3 text-slate-700">{record.createdBy}</td>
                      <td className="px-4 py-3 text-slate-700">{record.invoices}</td>
                      <td className="px-4 py-3 text-emerald-700 font-bold">{record.imported}</td>
                      <td className="px-4 py-3 text-rose-600 font-bold">{record.skipped}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ImportSales;
