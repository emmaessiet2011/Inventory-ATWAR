import React, { useMemo, useState } from 'react';
import { Eye, Printer, RotateCcw, Search, Wallet } from 'lucide-react';
import { useGlobalContext } from '@/context/GlobalContext';
import MultiSelect from '@/components/shared/MultiSelect';
import { formatDateTimeBySettings } from '@/utils/dateTime';
import { printDocument } from '@/utils/printUtils';

interface LedgerProps {
  onNavigate: (page: string) => void;
}

interface CustomerLedgerRow {
  customerId: string;
  customerName: string;
  contactName: string;
  mobile: string;
  customerGroup: string;
  status: 'Active' | 'Inactive';
  outstanding: number;
  credit: number;
  openInvoices: number;
  lastSaleDate: string;
  lastSaleInvoice: string;
  lastSaleAmount: number;
  lastPaymentDate: string;
  lastPaymentAmount: number;
  lastPaymentMethod: string;
  lastPaymentRef: string;
  activityTs: number;
}

const normalizeText = (value: unknown): string => String(value || '').trim().toLowerCase();
const round3 = (value: number): number => Number((Number(value) || 0).toFixed(3));
const hasNonZeroAmount = (value: unknown): boolean => Math.abs(Number(value || 0)) > 0.0005;

const parseDateMs = (value: unknown): number => {
  const raw = String(value || '').trim();
  if (!raw) return Number.NaN;
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return parsed;
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!dmy) return Number.NaN;
  const day = Number(dmy[1]);
  const month = Number(dmy[2]) - 1;
  const year = Number(dmy[3]);
  const local = new Date(year, month, day, 0, 0, 0, 0).getTime();
  return Number.isFinite(local) ? local : Number.NaN;
};

const toStartOfDayMs = (dateStr: string): number => {
  const parsed = new Date(`${dateStr}T00:00:00`).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

const toEndOfDayMs = (dateStr: string): number => {
  const parsed = new Date(`${dateStr}T23:59:59.999`).getTime();
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
};

const Ledger: React.FC<LedgerProps> = ({ onNavigate }) => {
  const { customers, sales, payments, settings, currentUser, formatCurrency } = useGlobalContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [dueOnly, setDueOnly] = useState(true);
  const [groupFilter, setGroupFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [methodFilter, setMethodFilter] = useState<string[]>([]);
  const [activityFrom, setActivityFrom] = useState('');
  const [activityTo, setActivityTo] = useState('');
  const [minOutstanding, setMinOutstanding] = useState('');
  const [maxOutstanding, setMaxOutstanding] = useState('');

  const isFinalizedSale = (sale: any): boolean => {
    const status = normalizeText(sale?.status || sale?.saleStatus);
    return status === 'final';
  };

  const isSaleForCustomer = (sale: any, customer: any): boolean => {
    const customerId = String(customer?.id || '').trim();
    const saleCustomerId = String(sale?.customerId || '').trim();
    if (customerId && saleCustomerId && customerId === saleCustomerId) return true;
    const customerBusiness = normalizeText(customer?.businessName);
    const customerContact = normalizeText(customer?.name);
    const saleCustomer = normalizeText(sale?.customerName);
    return !!saleCustomer && (saleCustomer === customerBusiness || saleCustomer === customerContact);
  };

  const isPaymentForCustomer = (payment: any, customer: any): boolean => {
    if (String(payment?.contactType || '').trim() !== 'Customer') return false;
    if (String(payment?.type || '').trim() === 'sent') return false;
    const customerId = String(customer?.id || '').trim();
    const paymentContactId = String(payment?.contactId || '').trim();
    if (customerId && paymentContactId && customerId === paymentContactId) return true;
    const customerBusiness = normalizeText(customer?.businessName);
    const customerContact = normalizeText(customer?.name);
    const paymentContact = normalizeText(payment?.contactName);
    return !!paymentContact && (paymentContact === customerBusiness || paymentContact === customerContact);
  };

  const customerGroups = useMemo(
    () =>
      Array.from(new Set(
        customers
          .map((customer) => String(customer.customerGroup || '').trim())
          .filter(Boolean),
      )).sort((a: string, b: string) => a.localeCompare(b)),
    [customers],
  );

  const rows = useMemo<CustomerLedgerRow[]>(() => {
    const computedRows: CustomerLedgerRow[] = [];

    customers.forEach((customer) => {
      const typeKey = normalizeText(customer?.type);
      if (typeKey === 'supplier') return;

      const customerSales = sales
        .filter((sale) => isFinalizedSale(sale) && isSaleForCustomer(sale, customer))
        .map((sale) => {
          const total = Number(sale.grandTotal || sale.totalAmount || 0);
          const due = typeof sale.sellDue === 'number'
            ? Math.max(0, Number(sale.sellDue))
            : Math.max(0, total - Number(sale.totalPaid || 0));
          return {
            sale,
            dateMs: parseDateMs(sale.date),
            due,
            total,
          };
        });

      const lastSaleEntry = customerSales.reduce<{ sale: any; dateMs: number; total: number } | null>((latest, entry) => {
        if (!Number.isFinite(entry.dateMs)) return latest;
        if (!latest || entry.dateMs > latest.dateMs) {
          return { sale: entry.sale, dateMs: entry.dateMs, total: entry.total };
        }
        return latest;
      }, null);

      const customerPayments = payments
        .filter((payment) => isPaymentForCustomer(payment, customer))
        .map((payment) => ({
          payment,
          dateMs: parseDateMs(payment.paidOn || payment.date),
          amount: Number(payment.amount || 0),
        }));

      const lastPaymentEntry = customerPayments.reduce<{ payment: any; dateMs: number; amount: number } | null>((latest, entry) => {
        if (!Number.isFinite(entry.dateMs)) return latest;
        if (!latest || entry.dateMs > latest.dateMs) {
          return { payment: entry.payment, dateMs: entry.dateMs, amount: entry.amount };
        }
        return latest;
      }, null);

      const outstanding = Math.max(0, Number(customer.totalSellDue || 0));
      const credit = Math.max(0, Number(customer.advanceBalance || 0));
      const openInvoices = customerSales.filter((entry) => entry.due > 0.0005).length;
      const hasCustomerSignals =
        typeKey === 'customer' ||
        hasNonZeroAmount(customer.totalSellDue) ||
        hasNonZeroAmount(customer.advanceBalance) ||
        customerSales.length > 0 ||
        customerPayments.length > 0;

      if (!hasCustomerSignals) return;

      const activityTs = Math.max(
        Number.isFinite(lastSaleEntry?.dateMs) ? Number(lastSaleEntry?.dateMs) : 0,
        Number.isFinite(lastPaymentEntry?.dateMs) ? Number(lastPaymentEntry?.dateMs) : 0,
      );

      computedRows.push({
        customerId: String(customer.id || '').trim(),
        customerName: String(customer.businessName || customer.name || '--').trim() || '--',
        contactName: String(customer.name || '--').trim() || '--',
        mobile: String(customer.mobile || customer.phone || '--').trim() || '--',
        customerGroup: String(customer.customerGroup || '--').trim() || '--',
        status: customer.status === 'Inactive' ? 'Inactive' : 'Active',
        outstanding: round3(outstanding),
        credit: round3(credit),
        openInvoices,
        lastSaleDate: String(lastSaleEntry?.sale?.date || '').trim(),
        lastSaleInvoice: String(lastSaleEntry?.sale?.invoiceNo || '--').trim() || '--',
        lastSaleAmount: round3(Number(lastSaleEntry?.total || 0)),
        lastPaymentDate: String(lastPaymentEntry?.payment?.paidOn || lastPaymentEntry?.payment?.date || '').trim(),
        lastPaymentAmount: round3(Number(lastPaymentEntry?.amount || 0)),
        lastPaymentMethod: String(lastPaymentEntry?.payment?.method || '--').trim() || '--',
        lastPaymentRef: String(lastPaymentEntry?.payment?.referenceNo || '--').trim() || '--',
        activityTs,
      });
    });

    return computedRows.sort((a, b) => {
      if (b.outstanding !== a.outstanding) return b.outstanding - a.outstanding;
      if (b.activityTs !== a.activityTs) return b.activityTs - a.activityTs;
      return a.customerName.localeCompare(b.customerName);
    });
  }, [customers, payments, sales]);

  const lastPaymentMethods = useMemo(
    () =>
      Array.from(new Set(
        rows
          .map((row) => String(row.lastPaymentMethod || '').trim())
          .filter((method) => method && method !== '--'),
      )).sort((a: string, b: string) => a.localeCompare(b)),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const query = normalizeText(searchTerm);
    const groupSet = new Set(groupFilter.map(normalizeText));
    const statusSet = new Set(statusFilter.map(normalizeText));
    const methodSet = new Set(methodFilter.map(normalizeText));

    const hasMinOutstanding = minOutstanding.trim() !== '' && Number.isFinite(Number(minOutstanding));
    const hasMaxOutstanding = maxOutstanding.trim() !== '' && Number.isFinite(Number(maxOutstanding));
    const minOutstandingValue = Number(minOutstanding);
    const maxOutstandingValue = Number(maxOutstanding);
    const hasFrom = !!activityFrom;
    const hasTo = !!activityTo;
    const fromMs = hasFrom ? toStartOfDayMs(activityFrom) : Number.NEGATIVE_INFINITY;
    const toMs = hasTo ? toEndOfDayMs(activityTo) : Number.POSITIVE_INFINITY;

    return rows.filter((row) => {
      if (dueOnly && row.outstanding <= 0.0005) return false;
      if (groupSet.size > 0 && !groupSet.has(normalizeText(row.customerGroup))) return false;
      if (statusSet.size > 0 && !statusSet.has(normalizeText(row.status))) return false;
      if (methodSet.size > 0 && !methodSet.has(normalizeText(row.lastPaymentMethod))) return false;
      if (hasMinOutstanding && row.outstanding < minOutstandingValue - 0.0005) return false;
      if (hasMaxOutstanding && row.outstanding > maxOutstandingValue + 0.0005) return false;

      if (hasFrom || hasTo) {
        if (!Number.isFinite(row.activityTs) || row.activityTs <= 0) return false;
        if (row.activityTs < fromMs || row.activityTs > toMs) return false;
      }

      if (!query) return true;
      return [
        row.customerName,
        row.contactName,
        row.mobile,
        row.customerGroup,
        row.lastSaleInvoice,
        row.lastPaymentRef,
        row.lastPaymentMethod,
      ].some((value) => normalizeText(value).includes(query));
    });
  }, [
    activityFrom,
    activityTo,
    dueOnly,
    groupFilter,
    maxOutstanding,
    methodFilter,
    minOutstanding,
    rows,
    searchTerm,
    statusFilter,
  ]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.outstanding += row.outstanding;
        acc.credit += row.credit;
        acc.openInvoices += row.openInvoices;
        if (row.outstanding > 0.0005) acc.owingCount += 1;
        return acc;
      },
      { outstanding: 0, credit: 0, openInvoices: 0, owingCount: 0 },
    );
  }, [filteredRows]);

  const formatDateTime = (value: string): string => {
    if (!value) return '--';
    return formatDateTimeBySettings(value, settings.dateFormat, settings.timeFormat, settings.timeZone);
  };

  const activeFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (searchTerm.trim()) parts.push(`Search: ${searchTerm.trim()}`);
    if (groupFilter.length > 0) parts.push(`Groups: ${groupFilter.join(', ')}`);
    if (statusFilter.length > 0) parts.push(`Status: ${statusFilter.join(', ')}`);
    if (methodFilter.length > 0) parts.push(`Last payment method: ${methodFilter.join(', ')}`);
    if (activityFrom || activityTo) parts.push(`Last activity: ${activityFrom || 'Any'} to ${activityTo || 'Any'}`);
    if (minOutstanding.trim() !== '' || maxOutstanding.trim() !== '') {
      parts.push(`Outstanding: ${minOutstanding || 'Any'} to ${maxOutstanding || 'Any'}`);
    }
    if (dueOnly) parts.push('Due only');
    return parts;
  }, [activityFrom, activityTo, dueOnly, groupFilter, maxOutstanding, methodFilter, minOutstanding, searchTerm, statusFilter]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setDueOnly(true);
    setGroupFilter([]);
    setStatusFilter([]);
    setMethodFilter([]);
    setActivityFrom('');
    setActivityTo('');
    setMinOutstanding('');
    setMaxOutstanding('');
  };

  const handlePrint = () => {
    const businessName = String(
      settings.businessName || settings.companyName || settings.shopName || 'ATWAR BSS',
    ).trim();
    const businessAddress = String(settings.businessAddress || settings.address || '').trim();
    const subtitle = activeFilterSummary.length > 0
      ? `Filters: ${activeFilterSummary.join(' | ')}`
      : 'All customers';

    printDocument({
      title: 'Customer Payment Ledger',
      subtitle,
      businessName: businessName || 'ATWAR BSS',
      businessAddress: businessAddress || undefined,
      businessLogo: settings.businessLogo || undefined,
      printedBy: currentUser?.name || currentUser?.username || 'System',
      columns: [
        { label: 'Customer', width: '18%' },
        { label: 'Group', width: '10%' },
        { label: 'Outstanding', align: 'right', width: '11%' },
        { label: 'Credit', align: 'right', width: '10%' },
        { label: 'Open Invoices', align: 'center', width: '8%' },
        { label: 'Last Payment', width: '22%' },
        { label: 'Last Sale', width: '21%' },
      ],
      rows: filteredRows.map((row) => [
        `${row.customerName}\n${row.mobile} | ${row.contactName}\n${row.status}`,
        row.customerGroup,
        formatCurrency(row.outstanding),
        formatCurrency(row.credit),
        String(row.openInvoices),
        [
          row.lastPaymentAmount > 0 ? formatCurrency(row.lastPaymentAmount) : '--',
          row.lastPaymentDate ? formatDateTime(row.lastPaymentDate) : '--',
          `${row.lastPaymentMethod} | ${row.lastPaymentRef}`,
        ].join(' | '),
        [
          row.lastSaleInvoice || '--',
          row.lastSaleDate ? formatDateTime(row.lastSaleDate) : '--',
          row.lastSaleAmount > 0 ? formatCurrency(row.lastSaleAmount) : '--',
        ].join(' | '),
      ]),
      stats: [
        { label: 'Rows', value: String(filteredRows.length), color: 'blue' },
        { label: 'Customers Owing', value: String(totals.owingCount), color: 'amber' },
        { label: 'Total Outstanding', value: formatCurrency(round3(totals.outstanding)), color: 'rose' },
        { label: 'Customer Credit', value: formatCurrency(round3(totals.credit)), color: 'green' },
      ],
      totalRow: [
        'TOTAL',
        '',
        formatCurrency(round3(totals.outstanding)),
        formatCurrency(round3(totals.credit)),
        String(totals.openInvoices),
        '',
        '',
      ],
    });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Customer Ledger</h2>
          <p className="text-slate-500 mt-2 text-sm">
            Quick debt snapshot: outstanding balance, last payment, and last sale per customer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50"
          >
            <RotateCcw size={13} /> Reset
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
          >
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Customers Owing</p>
          <p className="mt-1 text-3xl font-black text-slate-900">{totals.owingCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Outstanding</p>
          <p className="mt-1 text-3xl font-black text-rose-600">{formatCurrency(round3(totals.outstanding))}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Customer Credit</p>
          <p className="mt-1 text-3xl font-black text-emerald-600">{formatCurrency(round3(totals.credit))}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Open Invoices</p>
          <p className="mt-1 text-3xl font-black text-sky-700">{totals.openInvoices}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Search</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm"
                placeholder="Search customer, mobile, invoice, payment ref, method..."
              />
            </div>
          </div>

          <MultiSelect
            label="Customer Group"
            options={customerGroups}
            selected={groupFilter}
            onChange={setGroupFilter}
          />

          <MultiSelect
            label="Status"
            options={['Active', 'Inactive']}
            selected={statusFilter}
            onChange={setStatusFilter}
          />

          <MultiSelect
            label="Last Payment Method"
            options={lastPaymentMethods}
            selected={methodFilter}
            onChange={setMethodFilter}
          />

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Activity From</label>
            <input
              type="date"
              value={activityFrom}
              onChange={(event) => setActivityFrom(event.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Activity To</label>
            <input
              type="date"
              value={activityTo}
              onChange={(event) => setActivityTo(event.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Min Outstanding</label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={minOutstanding}
              onChange={(event) => setMinOutstanding(event.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm"
              placeholder="0.000"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Max Outstanding</label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={maxOutstanding}
              onChange={(event) => setMaxOutstanding(event.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm"
              placeholder="Any"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <input
              id="due-only"
              type="checkbox"
              checked={dueOnly}
              onChange={(event) => setDueOnly(event.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="due-only" className="text-sm font-medium text-slate-700">
              Show only customers with outstanding balance
            </label>
          </div>
          {activeFilterSummary.length > 0 && (
            <p className="text-xs text-slate-500">
              Active filters: {activeFilterSummary.join(' | ')}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Customer</th>
                <th className="px-4 py-3 whitespace-nowrap">Group</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Outstanding</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Credit</th>
                <th className="px-4 py-3 whitespace-nowrap text-center">Open Invoices</th>
                <th className="px-4 py-3 whitespace-nowrap">Last Payment</th>
                <th className="px-4 py-3 whitespace-nowrap">Last Sale</th>
                <th className="px-4 py-3 whitespace-nowrap text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row) => (
                <tr key={row.customerId} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-900">{row.customerName}</div>
                    <div className="text-xs text-slate-500">{row.mobile} | {row.contactName}</div>
                    <div className="mt-1">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        row.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {row.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.customerGroup}</td>
                  <td className="px-4 py-3 text-right font-black text-rose-600">{formatCurrency(row.outstanding)}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(row.credit)}</td>
                  <td className="px-4 py-3 text-center font-bold text-slate-700">{row.openInvoices}</td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-slate-800">
                      {row.lastPaymentAmount > 0 ? formatCurrency(row.lastPaymentAmount) : '--'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {row.lastPaymentDate ? formatDateTime(row.lastPaymentDate) : '--'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {row.lastPaymentMethod} | {row.lastPaymentRef}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-blue-700">{row.lastSaleInvoice || '--'}</div>
                    <div className="text-xs text-slate-500">
                      {row.lastSaleDate ? formatDateTime(row.lastSaleDate) : '--'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {row.lastSaleAmount > 0 ? formatCurrency(row.lastSaleAmount) : '--'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => onNavigate(`view-customer/${row.customerId}:ledger`)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 text-xs font-bold hover:bg-indigo-50"
                    >
                      <Eye size={12} /> Open
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-400 italic">
                    No customers matched your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-500 flex items-center gap-2">
        <Wallet size={14} className="text-slate-400" />
        This page is read-only summary. Use customer ledger view for full statement details and transaction history.
      </div>
    </div>
  );
};

export default Ledger;
