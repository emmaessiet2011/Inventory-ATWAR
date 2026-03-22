import React, { useMemo, useState } from 'react';
import { Filter, Printer } from 'lucide-react';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import MultiSelect from '@/components/shared/MultiSelect';
import { useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import { printDocument, paymentBadge } from '@/utils/printUtils';

const formatOMR = (amount: number) =>
  `OMR ${amount.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;

const normalize = (value: unknown): string => String(value || '').trim().toLowerCase();

const formatDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || '--';
  return parsed.toLocaleDateString('en-GB');
};

const toMs = (value: string): number => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const resolvePayTermDays = (sale: any): number => {
  const explicitValue = Number(sale?.payTermValue);
  const explicitType = String(sale?.payTermType || '').trim().toLowerCase();
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

const resolveVatInvoiceStatus = (sale: any): VatInvoiceRow['status'] => {
  const dueAmount = Number(
    sale?.sellDue ??
    Math.max(0, Number(sale?.grandTotal || sale?.totalAmount || 0) - Number(sale?.totalPaid || 0)),
  );
  if (dueAmount <= 0.001) return 'Paid';

  const rawStatus = String(sale?.paymentStatus || '').trim();
  if (rawStatus === 'Overdue') return 'Overdue';
  if (rawStatus === 'Partial' || rawStatus === 'Paid' || rawStatus === 'Due') {
    const payTermDays = resolvePayTermDays(sale);
    const saleDateMs = toMs(String(sale?.date || ''));
    if (payTermDays > 0 && saleDateMs > 0) {
      const dueDateMs = saleDateMs + payTermDays * 24 * 60 * 60 * 1000;
      if (Date.now() > dueDateMs) return 'Overdue';
    }
    return rawStatus === 'Partial' ? 'Partial' : 'Due';
  }

  const fallbackPayTermDays = resolvePayTermDays(sale);
  const fallbackSaleDateMs = toMs(String(sale?.date || ''));
  if (fallbackPayTermDays > 0 && fallbackSaleDateMs > 0) {
    const dueDateMs = fallbackSaleDateMs + fallbackPayTermDays * 24 * 60 * 60 * 1000;
    if (Date.now() > dueDateMs) return 'Overdue';
  }
  return 'Due';
};

interface VatInvoiceRow {
  id: string;
  date: string;
  customer: string;
  trn: string;
  net: number;
  vat: number;
  total: number;
  status: 'Paid' | 'Due' | 'Partial' | 'Overdue';
  location: string;
}

const VatBills: React.FC = () => {
  const { addNotification } = useNotifications();
  const { locations, customers, sales, taxRates, formatCurrency, settings, currentUser } = useGlobalContext();
  const [showFilters, setShowFilters] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    location: [] as string[],
    customer: [] as string[],
  });

  const invoices = useMemo<VatInvoiceRow[]>(() => {
    return sales
      .filter(sale => String(sale.status || sale.saleStatus || '').trim() === 'Final')
      .map(sale => {
        const itemTax = (sale.items || []).reduce((sum, item) => sum + Number(item.tax || 0), 0);
        const subTotal = Number(sale.subTotal || 0);
        const discountRaw = Number(sale.discountAmount || 0);
        const discountValue = sale.discountType === 'Percentage'
          ? (subTotal * discountRaw) / 100
          : discountRaw;
        const taxRate = sale.orderTax && sale.orderTax !== 'None'
          ? Number(taxRates.find(rate => rate.name === sale.orderTax)?.rate || 0)
          : 0;
        const taxableBase = Math.max(0, subTotal - discountValue);
        const orderTax = taxableBase * (taxRate / 100);
        const vat = Number((itemTax + orderTax).toFixed(3));
        const total = Number((sale.grandTotal || sale.totalAmount || 0).toFixed(3));
        const net = Number(Math.max(0, total - vat).toFixed(3));
        const customerName = String(sale.customerName || 'Direct Customer').trim() || 'Direct Customer';
        const customerById = customers.find(customer => normalize(customer.id) === normalize(sale.customerId));
        const customerByName = customers.find(customer =>
          normalize(customer.businessName) === normalize(customerName) ||
          normalize(customer.name) === normalize(customerName)
        );
        const trn = String(customerById?.taxNumber || customerByName?.taxNumber || '--').trim() || '--';

        return {
          id: String(sale.invoiceNo || sale.id),
          date: String(sale.date || ''),
          customer: customerName,
          trn,
          net,
          vat,
          total,
          status: resolveVatInvoiceStatus(sale),
          location: String(sale.location || '--'),
        } as VatInvoiceRow;
      })
      .filter(invoice => invoice.vat > 0.0001)
      .sort((a, b) => toMs(b.date) - toMs(a.date));
  }, [customers, sales, taxRates]);

  const customerOptions = useMemo<string[]>(() => {
    const options = Array.from(new Set(invoices.map(invoice => String(invoice.customer)))) as string[];
    return options.sort((a, b) => a.localeCompare(b));
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return invoices.filter(invoice =>
      (query.length === 0 ||
        invoice.id.toLowerCase().includes(query) ||
        invoice.customer.toLowerCase().includes(query) ||
        invoice.trn.toLowerCase().includes(query)) &&
      (filters.location.length === 0 || filters.location.includes(invoice.location)) &&
      (filters.customer.length === 0 || filters.customer.includes(invoice.customer))
    );
  }, [filters.customer, filters.location, invoices, searchTerm]);

  const totals = useMemo(() => {
    return filteredInvoices.reduce(
      (acc, invoice) => {
        acc.net += invoice.net;
        acc.vat += invoice.vat;
        acc.gross += invoice.total;
        return acc;
      },
      { net: 0, vat: 0, gross: 0 }
    );
  }, [filteredInvoices]);

  const handlePrintAll = () => {
    addNotification({
      title: 'VAT Print Started',
      message: `Preparing ${filteredInvoices.length} VAT invoice${filteredInvoices.length === 1 ? '' : 's'} for print.`,
      type: 'info',
    });
    printDocument({
      title: 'VAT Bills',
      businessName: settings?.businessName || 'ATWAR AL MUSTAQBAL',
      businessAddress: settings?.address || '',
      printedBy: currentUser?.name || '',
      columns: [
        { label: 'Invoice No', width: '100px' },
        { label: 'Date', width: '80px' },
        { label: 'Customer' },
        { label: 'TRN', width: '100px' },
        { label: 'Location', width: '90px' },
        { label: 'Net Amount', align: 'right', width: '90px' },
        { label: 'VAT (5%)', align: 'right', width: '80px' },
        { label: 'Total', align: 'right', width: '90px' },
        { label: 'Status', width: '70px' },
      ],
      rows: filteredInvoices.map(inv => [
        inv.id,
        formatDate(inv.date),
        inv.customer,
        inv.trn,
        inv.location,
        formatCurrency(inv.net),
        formatCurrency(inv.vat),
        formatCurrency(inv.total),
        paymentBadge(inv.status),
      ]),
      stats: [
        { label: 'Total Invoices', value: String(filteredInvoices.length), color: 'blue' },
        { label: 'Total Net', value: formatCurrency(totals.net), color: 'slate' },
        { label: 'Total VAT', value: formatCurrency(totals.vat), color: 'amber' },
        { label: 'Total Gross', value: formatCurrency(totals.gross), color: 'green' },
      ],
      totalRow: ['TOTAL', '', '', '', '',
        formatCurrency(totals.net),
        formatCurrency(totals.vat),
        formatCurrency(totals.gross),
        ''],
    });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">VAT Bills</h2>
          <p className="text-slate-500 mt-2 text-lg font-light">
            Prints VAT-bearing final invoices from real sales data.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrintAll}
            className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition shadow-lg shadow-slate-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
          >
            <Printer size={18} /> Print All VAT Invoices
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 animate-in slide-in-from-top-2">
            <div className="group">
              <MultiSelect
                label="Business Location"
                options={locations.map(location => location.name)}
                selected={filters.location}
                onChange={value => setFilters({ ...filters, location: value })}
              />
            </div>
            <div className="group">
              <MultiSelect
                label="Customer"
                options={customerOptions}
                selected={filters.customer}
                onChange={value => setFilters({ ...filters, customer: value })}
              />
            </div>
            <div className="group">
              <DateRangeFilter />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Net Amount</p>
          <p className="text-2xl font-black text-slate-900">{formatOMR(totals.net)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total VAT</p>
          <p className="text-2xl font-black text-red-600">{formatOMR(totals.vat)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Gross Total</p>
          <p className="text-2xl font-black text-emerald-600">{formatOMR(totals.gross)}</p>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <input
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            className="w-full md:w-96 px-3 py-2 border border-slate-300 rounded text-sm"
            placeholder="Search by invoice, customer, or TRN..."
          />
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">Invoice ID</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Customer</th>
              <th className="px-6 py-4">TRN</th>
              <th className="px-6 py-4 text-right">Net Amount</th>
              <th className="px-6 py-4 text-right">VAT</th>
              <th className="px-6 py-4 text-right">Total</th>
              <th className="px-6 py-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredInvoices.map(invoice => (
              <tr key={invoice.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-mono font-medium text-blue-600">{invoice.id}</td>
                <td className="px-6 py-4 text-slate-600">{formatDate(invoice.date)}</td>
                <td className="px-6 py-4 font-medium text-slate-800">{invoice.customer}</td>
                <td className="px-6 py-4 text-slate-500">{invoice.trn}</td>
                <td className="px-6 py-4 text-right font-medium">{formatOMR(invoice.net)}</td>
                <td className="px-6 py-4 text-right text-red-600">{formatOMR(invoice.vat)}</td>
                <td className="px-6 py-4 text-right font-bold text-slate-900">{formatOMR(invoice.total)}</td>
                <td className="px-6 py-4 text-center">
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
                <td colSpan={8} className="px-6 py-8 text-center text-slate-500 italic">
                  No VAT invoices found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VatBills;
