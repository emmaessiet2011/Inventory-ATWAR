import React, { useMemo, useState } from 'react';
import { FileText, Filter, Printer } from 'lucide-react';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import MultiSelect from '@/components/shared/MultiSelect';
import { Sale, useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import { formatDateBySettings } from '@/utils/dateTime';
import { printDocument } from '@/utils/printUtils';

interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

type VatInvoiceStatus = 'Paid' | 'Due' | 'Partial' | 'Overdue';

interface VatInvoiceRow {
  id: string;
  date: string;
  dateMs: number;
  customer: string;
  customerType: string;
  customerGroup: string;
  trn: string;
  net: number;
  vat: number;
  total: number;
  status: VatInvoiceStatus;
  location: string;
  addedBy: string;
  paymentMethod: string;
  sale: Sale;
}

const normalizeText = (value: unknown): string => String(value || '').trim().toLowerCase();
const round3 = (value: number): number => Math.round(value * 1000) / 1000;

const toMs = (value: unknown): number => {
  const parsed = new Date(String(value || ''));
  return Number.isNaN(parsed.getTime()) ? Number.NaN : parsed.getTime();
};

const getCurrentYearRange = (): DateRangeValue => {
  const now = new Date();
  return {
    startDate: new Date(now.getFullYear(), 0, 1),
    endDate: new Date(now.getFullYear(), 11, 31),
    label: 'This Year',
  };
};

const parseRateFromLabel = (value: unknown): number => {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const match = raw.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) return 0;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const resolvePayTermDays = (sale: Sale): number => {
  const explicitValue = Number((sale as any)?.payTermValue);
  const explicitType = String((sale as any)?.payTermType || '').trim().toLowerCase();
  if (Number.isFinite(explicitValue) && explicitValue > 0) {
    if (explicitType.startsWith('month')) return explicitValue * 30;
    return explicitValue;
  }

  const payTermText = String(sale?.payTerm || '').trim().toLowerCase();
  const match = payTermText.match(/(\d+(?:\.\d+)?)\s*(day|days|month|months)/);
  if (!match) return 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return match[2].startsWith('month') ? value * 30 : value;
};

const resolveVatInvoiceStatus = (sale: Sale): VatInvoiceStatus => {
  const dueAmount = Number(
    sale?.sellDue ??
      Math.max(0, Number(sale?.grandTotal || sale?.totalAmount || 0) - Number(sale?.totalPaid || 0)),
  );
  if (dueAmount <= 0.001) return 'Paid';

  const rawStatus = String(sale?.paymentStatus || '').trim();
  if (rawStatus === 'Overdue') return 'Overdue';
  if (rawStatus === 'Partial') return 'Partial';
  if (rawStatus === 'Paid' || rawStatus === 'Due') {
    const payTermDays = resolvePayTermDays(sale);
    const saleDateMs = toMs(String(sale?.date || ''));
    if (payTermDays > 0 && Number.isFinite(saleDateMs)) {
      const dueDateMs = saleDateMs + payTermDays * 24 * 60 * 60 * 1000;
      if (Date.now() > dueDateMs) return 'Overdue';
    }
  }
  return 'Due';
};

const resolveSaleDiscountValue = (sale: Sale): number => {
  const subTotal = Number(sale.subTotal || 0);
  const discountRaw = Number(sale.discountAmount || 0);
  if (!Number.isFinite(discountRaw) || discountRaw <= 0) return 0;
  if (String(sale.discountType || '').trim() === 'Percentage') {
    return round3(Math.max(0, subTotal * (discountRaw / 100)));
  }
  return round3(Math.max(0, discountRaw));
};

const truncate = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
};

const VatBills: React.FC = () => {
  const { addNotification } = useNotifications();
  const {
    locations,
    customers,
    sales,
    taxRates,
    users,
    formatCurrency,
    settings,
    currentUser,
  } = useGlobalContext();

  const [showFilters, setShowFilters] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeValue>(getCurrentYearRange);
  const [filters, setFilters] = useState({
    location: [] as string[],
    customer: [] as string[],
    customerType: [] as string[],
    customerGroup: [] as string[],
    paymentStatus: [] as VatInvoiceStatus[],
    user: [] as string[],
  });

  const taxRateByName = useMemo(() => {
    const map = new Map<string, number>();
    taxRates.forEach((rate) => {
      const key = normalizeText((rate as any)?.name);
      if (!key) return;
      const value = Number((rate as any)?.rate || 0);
      if (Number.isFinite(value)) map.set(key, value);
    });
    return map;
  }, [taxRates]);

  const resolveSaleVat = (sale: Sale): number => {
    const headerVat = Number((sale as any)?.taxAmount || 0);
    if (Number.isFinite(headerVat) && headerVat > 0.0001) return round3(headerVat);

    const itemVat = (sale.items || []).reduce((sum, item) => sum + Number(item.tax || 0), 0);
    if (Number.isFinite(itemVat) && itemVat > 0.0001) return round3(itemVat);

    const subTotal = Number(sale.subTotal || 0);
    const discountValue = resolveSaleDiscountValue(sale);
    const taxableBase = Math.max(0, subTotal - discountValue);
    const taxName = String((sale as any)?.orderTax || sale.tax || '').trim();
    if (taxName && normalizeText(taxName) !== 'none') {
      const mappedRate = taxRateByName.get(normalizeText(taxName)) || 0;
      const parsedRate = mappedRate > 0 ? mappedRate : parseRateFromLabel(taxName);
      if (parsedRate > 0) {
        return round3(taxableBase * (parsedRate / 100));
      }
    }

    const shipping = Number(sale.shippingCharges || 0);
    const total = Number(sale.grandTotal || sale.totalAmount || 0);
    const fallbackDiff = total - shipping - taxableBase;
    if (Number.isFinite(fallbackDiff) && fallbackDiff > 0.0001) return round3(fallbackDiff);

    return 0;
  };

  const invoices = useMemo<VatInvoiceRow[]>(() => {
    return sales
      .filter((sale) => String(sale.status || sale.saleStatus || '').trim() === 'Final')
      .map((sale) => {
        const customerName = String(sale.customerName || 'Direct Customer').trim() || 'Direct Customer';
        const customerById = customers.find(
          (customer) => normalizeText(customer.id) === normalizeText(sale.customerId),
        );
        const customerByName = customers.find(
          (customer) =>
            normalizeText(customer.businessName) === normalizeText(customerName) ||
            normalizeText(customer.name) === normalizeText(customerName),
        );
        const customer = customerById || customerByName;
        const trn = String(customer?.taxNumber || '--').trim() || '--';
        const vat = resolveSaleVat(sale);
        const total = round3(Number(sale.grandTotal || sale.totalAmount || 0));
        const net = round3(Math.max(0, total - vat));
        const customerType = String(customer?.contactCategory || (customer ? 'Business' : 'Walk-in')).trim();
        const customerGroup = String(sale.customerGroup || customer?.customerGroup || '--').trim() || '--';

        return {
          id: String(sale.invoiceNo || sale.id),
          date: String(sale.date || ''),
          dateMs: toMs(sale.date),
          customer: customerName,
          customerType,
          customerGroup,
          trn,
          net,
          vat,
          total,
          status: resolveVatInvoiceStatus(sale),
          location: String(sale.location || '--'),
          addedBy: String(sale.addedBy || '--'),
          paymentMethod: String(sale.paymentMethod || '--'),
          sale,
        };
      })
      .filter((invoice) => invoice.vat > 0.0001)
      .sort((a, b) => b.dateMs - a.dateMs);
  }, [customers, sales, taxRateByName]);

  const uniqueSorted = (values: string[]): string[] =>
    Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    );

  const customerOptions = useMemo(
    () => uniqueSorted(invoices.map((invoice) => invoice.customer)),
    [invoices],
  );
  const customerTypeOptions = useMemo(
    () => uniqueSorted(invoices.map((invoice) => invoice.customerType)),
    [invoices],
  );
  const customerGroupOptions = useMemo(
    () => uniqueSorted(invoices.map((invoice) => invoice.customerGroup)),
    [invoices],
  );
  const paymentStatusOptions = useMemo(
    () => uniqueSorted(invoices.map((invoice) => invoice.status)),
    [invoices],
  );
  const locationOptions = useMemo(
    () => uniqueSorted([...locations.map((location) => location.name), ...invoices.map((invoice) => invoice.location)]),
    [invoices, locations],
  );
  const userOptions = useMemo(
    () => uniqueSorted([...users.map((user) => user.name), ...invoices.map((invoice) => invoice.addedBy)]),
    [invoices, users],
  );

  const filteredInvoices = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const locationSet = new Set(filters.location.map(normalizeText));
    const customerSet = new Set(filters.customer.map(normalizeText));
    const customerTypeSet = new Set(filters.customerType.map(normalizeText));
    const customerGroupSet = new Set(filters.customerGroup.map(normalizeText));
    const paymentStatusSet = new Set(filters.paymentStatus.map(normalizeText));
    const userSet = new Set(filters.user.map(normalizeText));

    const startMs = dateRange.startDate
      ? new Date(dateRange.startDate).setHours(0, 0, 0, 0)
      : Number.NaN;
    const endMs = dateRange.endDate
      ? new Date(dateRange.endDate).setHours(23, 59, 59, 999)
      : Number.NaN;
    const hasDateRange = Number.isFinite(startMs) && Number.isFinite(endMs);

    return invoices.filter((invoice) => {
      const textMatch =
        query.length === 0 ||
        invoice.id.toLowerCase().includes(query) ||
        invoice.customer.toLowerCase().includes(query) ||
        invoice.trn.toLowerCase().includes(query) ||
        invoice.location.toLowerCase().includes(query);

      const filterMatch =
        (locationSet.size === 0 || locationSet.has(normalizeText(invoice.location))) &&
        (customerSet.size === 0 || customerSet.has(normalizeText(invoice.customer))) &&
        (customerTypeSet.size === 0 || customerTypeSet.has(normalizeText(invoice.customerType))) &&
        (customerGroupSet.size === 0 || customerGroupSet.has(normalizeText(invoice.customerGroup))) &&
        (paymentStatusSet.size === 0 || paymentStatusSet.has(normalizeText(invoice.status))) &&
        (userSet.size === 0 || userSet.has(normalizeText(invoice.addedBy)));

      const dateMatch =
        !hasDateRange ||
        (Number.isFinite(invoice.dateMs) && invoice.dateMs >= startMs && invoice.dateMs <= endMs);

      return textMatch && filterMatch && dateMatch;
    });
  }, [dateRange.endDate, dateRange.startDate, filters, invoices, searchTerm]);

  const totals = useMemo(() => {
    return filteredInvoices.reduce(
      (acc, invoice) => {
        acc.net += invoice.net;
        acc.vat += invoice.vat;
        acc.gross += invoice.total;
        return acc;
      },
      { net: 0, vat: 0, gross: 0 },
    );
  }, [filteredInvoices]);

  const formatDate = (value: string): string =>
    formatDateBySettings(value, settings.dateFormat, settings.timeZone);

  const handlePrintSummary = () => {
    if (filteredInvoices.length === 0) {
      addNotification({
        title: 'No VAT invoices',
        message: 'No VAT invoices matched your selected filters.',
        type: 'warning',
      });
      return;
    }
    printDocument({
      title: 'VAT Bills Summary',
      subtitle: dateRange.label ? `Range: ${dateRange.label}` : undefined,
      businessName: settings?.businessName || 'Business',
      businessAddress: settings?.address || '',
      printedBy: currentUser?.name || '',
      columns: [
        { label: 'Invoice', width: '80px' },
        { label: 'Date', width: '76px' },
        { label: 'Customer' },
        { label: 'Type', width: '68px' },
        { label: 'Group', width: '78px' },
        { label: 'TRN', width: '72px' },
        { label: 'Location', width: '82px' },
        { label: 'VAT', align: 'right', width: '82px' },
        { label: 'Total', align: 'right', width: '90px' },
      ],
      rows: filteredInvoices.map((invoice) => [
        invoice.id,
        formatDate(invoice.date),
        invoice.customer,
        invoice.customerType,
        invoice.customerGroup,
        invoice.trn,
        invoice.location,
        formatCurrency(invoice.vat),
        formatCurrency(invoice.total),
      ]),
      stats: [
        { label: 'Total Invoices', value: String(filteredInvoices.length), color: 'blue' },
        { label: 'Net', value: formatCurrency(totals.net), color: 'slate' },
        { label: 'VAT', value: formatCurrency(totals.vat), color: 'amber' },
        { label: 'Gross', value: formatCurrency(totals.gross), color: 'green' },
      ],
      totalRow: [
        'TOTAL',
        '',
        '',
        '',
        '',
        '',
        '',
        formatCurrency(totals.vat),
        formatCurrency(totals.gross),
      ],
    });
  };

  const handleExportInvoicesPdf = async () => {
    if (filteredInvoices.length === 0) {
      addNotification({
        title: 'No VAT invoices',
        message: 'No VAT invoices matched your selected filters.',
        type: 'warning',
      });
      return;
    }

    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const left = 12;
      const right = 198;

      filteredInvoices.forEach((invoice, index) => {
        if (index > 0) doc.addPage();

        const sale = invoice.sale;
        let y = 12;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(String(settings.businessName || 'Business'), left, y);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const address = String(settings.address || '').trim() || 'Address not set';
        const addressLines = doc.splitTextToSize(address, 90) as string[];
        doc.text(addressLines, left, y + 5);
        const leftHeaderBottom = y + 5 + addressLines.length * 4;

        let rightY = 12;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('VAT INVOICE', right, rightY, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        rightY += 6;
        doc.text(`Invoice: ${invoice.id}`, right, rightY, { align: 'right' });
        rightY += 5;
        doc.text(`Date: ${formatDate(invoice.date)}`, right, rightY, { align: 'right' });
        rightY += 5;
        doc.text(`Location: ${invoice.location || '--'}`, right, rightY, { align: 'right' });
        rightY += 5;
        doc.text(`Status: ${invoice.status}`, right, rightY, { align: 'right' });
        rightY += 5;
        doc.text(`Payment: ${invoice.paymentMethod || '--'}`, right, rightY, { align: 'right' });

        y = Math.max(leftHeaderBottom, rightY) + 4;
        doc.line(left, y, right, y);
        y += 6;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Bill To', left, y);
        doc.text('Tax Details', 120, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Customer: ${invoice.customer}`, left, y);
        doc.text(`TRN: ${invoice.trn}`, 120, y);
        y += 5;
        doc.text(`Customer Type: ${invoice.customerType}`, left, y);
        doc.text(`Customer Group: ${invoice.customerGroup}`, 120, y);
        y += 5;
        doc.text(`Added By: ${invoice.addedBy || '--'}`, left, y);
        y += 4;
        doc.line(left, y, right, y);
        y += 6;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text('Item', left, y);
        doc.text('Qty', 120, y, { align: 'right' });
        doc.text('Unit Price', 142, y, { align: 'right' });
        doc.text('Tax', 162, y, { align: 'right' });
        doc.text('Line Total', right, y, { align: 'right' });
        y += 2;
        doc.line(left, y, right, y);
        y += 4;

        doc.setFont('helvetica', 'normal');
        const items = Array.isArray(sale.items) ? sale.items : [];
        const maxRows = 26;
        if (items.length === 0) {
          doc.text('No line items recorded.', left, y);
          y += 4.5;
        } else {
          items.slice(0, maxRows).forEach((item) => {
            const itemName = truncate(String(item.name || 'Item'), 52);
            const qty = Number(item.qty || 0);
            const unitPrice = Number(item.unitPrice || 0);
            const itemTax = Number(item.tax || 0);
            const lineTotal = Number(item.total ?? item.subtotal ?? qty * unitPrice);
            doc.text(itemName, left, y);
            doc.text(qty.toFixed(3), 120, y, { align: 'right' });
            doc.text(formatCurrency(unitPrice), 142, y, { align: 'right' });
            doc.text(formatCurrency(itemTax), 162, y, { align: 'right' });
            doc.text(formatCurrency(lineTotal), right, y, { align: 'right' });
            y += 4.5;
          });
          if (items.length > maxRows) {
            doc.setFont('helvetica', 'italic');
            doc.text(`+${items.length - maxRows} more item(s) not shown in batch export`, left, y);
            doc.setFont('helvetica', 'normal');
            y += 4.5;
          }
        }

        y += 1;
        doc.line(left, y, right, y);
        y += 5;

        const subTotal = Number(sale.subTotal || 0);
        const discountValue = resolveSaleDiscountValue(sale);
        const shipping = Number(sale.shippingCharges || 0);
        const paid = Number(sale.totalPaid || 0);
        const due = Number(
          sale.sellDue ?? Math.max(0, Number(sale.grandTotal || sale.totalAmount || 0) - paid),
        );

        const summaryRows: Array<{ label: string; value: number; bold?: boolean }> = [
          { label: 'Subtotal', value: subTotal },
          { label: 'Discount', value: discountValue },
          { label: 'VAT', value: invoice.vat },
          { label: 'Shipping', value: shipping },
          { label: 'Grand Total', value: invoice.total, bold: true },
          { label: 'Paid', value: paid },
          { label: 'Due', value: due, bold: true },
        ];

        summaryRows.forEach((row) => {
          doc.setFont('helvetica', row.bold ? 'bold' : 'normal');
          doc.text(row.label, 158, y, { align: 'right' });
          doc.text(formatCurrency(round3(row.value)), right, y, { align: 'right' });
          y += 4.8;
        });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`Generated ${new Date().toLocaleString()}`, left, 287);
      });

      const fileDate = new Date().toISOString().slice(0, 10);
      doc.save(`vat-invoices-${fileDate}.pdf`);

      addNotification({
        title: 'VAT PDF Exported',
        message: `Exported ${filteredInvoices.length} VAT invoice${filteredInvoices.length === 1 ? '' : 's'} to one PDF.`,
        type: 'success',
      });
    } catch (error) {
      addNotification({
        title: 'Export failed',
        message: 'Unable to generate VAT invoices PDF. Please try again.',
        type: 'error',
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">VAT Bills</h2>
          <p className="text-slate-500 mt-2 text-lg font-light">
            VAT-bearing final invoices with one-click batch PDF export (one invoice per page).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handlePrintSummary}
            className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition shadow-lg shadow-slate-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
          >
            <Printer size={16} /> Print Summary
          </button>
          <button
            onClick={() => {
              void handleExportInvoicesPdf();
            }}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
          >
            <FileText size={16} /> Export Invoices PDF
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div
          className="flex items-center gap-2 mb-4 text-blue-600 font-bold text-sm cursor-pointer w-fit"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={16} /> Filters
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6 pt-2 animate-in slide-in-from-top-2">
            <MultiSelect
              label="Business Location"
              options={locationOptions}
              selected={filters.location}
              onChange={(value) => setFilters({ ...filters, location: value })}
            />
            <MultiSelect
              label="Customer"
              options={customerOptions}
              selected={filters.customer}
              onChange={(value) => setFilters({ ...filters, customer: value })}
            />
            <MultiSelect
              label="Customer Type"
              options={customerTypeOptions}
              selected={filters.customerType}
              onChange={(value) => setFilters({ ...filters, customerType: value })}
            />
            <MultiSelect
              label="Customer Group"
              options={customerGroupOptions}
              selected={filters.customerGroup}
              onChange={(value) => setFilters({ ...filters, customerGroup: value })}
            />
            <MultiSelect
              label="Payment Status"
              options={paymentStatusOptions}
              selected={filters.paymentStatus}
              onChange={(value) => setFilters({ ...filters, paymentStatus: value as VatInvoiceStatus[] })}
            />
            <MultiSelect
              label="Added By"
              options={userOptions}
              selected={filters.user}
              onChange={(value) => setFilters({ ...filters, user: value })}
            />
            <DateRangeFilter
              allowAllTime
              onRangeSelect={(range) => setDateRange(range)}
              initialRange={dateRange}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Net Amount</p>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(round3(totals.net))}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total VAT</p>
          <p className="text-2xl font-black text-red-600">{formatCurrency(round3(totals.vat))}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Gross Total</p>
          <p className="text-2xl font-black text-emerald-600">{formatCurrency(round3(totals.gross))}</p>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600" />
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full md:w-96 px-3 py-2 border border-slate-300 rounded text-sm"
            placeholder="Search by invoice, customer, TRN, or location..."
          />
          <p className="text-xs font-semibold text-slate-500">
            Showing {filteredInvoices.length} of {invoices.length} VAT invoice{invoices.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Invoice ID</th>
                <th className="px-4 py-3 whitespace-nowrap">Date</th>
                <th className="px-4 py-3 whitespace-nowrap">Customer</th>
                <th className="px-4 py-3 whitespace-nowrap">Type</th>
                <th className="px-4 py-3 whitespace-nowrap">Group</th>
                <th className="px-4 py-3 whitespace-nowrap">TRN</th>
                <th className="px-4 py-3 whitespace-nowrap">Location</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Net Amount</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">VAT</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Total</th>
                <th className="px-4 py-3 whitespace-nowrap text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-medium text-blue-600">{invoice.id}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(invoice.date)}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{invoice.customer}</td>
                  <td className="px-4 py-3 text-slate-600">{invoice.customerType}</td>
                  <td className="px-4 py-3 text-slate-600">{invoice.customerGroup}</td>
                  <td className="px-4 py-3 text-slate-500">{invoice.trn}</td>
                  <td className="px-4 py-3 text-slate-600">{invoice.location}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(invoice.net)}</td>
                  <td className="px-4 py-3 text-right text-red-600">{formatCurrency(invoice.vat)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(invoice.total)}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                        invoice.status === 'Paid'
                          ? 'bg-emerald-100 text-emerald-700'
                          : invoice.status === 'Due' || invoice.status === 'Overdue'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {invoice.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-slate-500 italic">
                    No VAT invoices found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default VatBills;
