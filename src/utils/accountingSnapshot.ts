import type { Expense, Payment, Purchase, Sale } from '../context/GlobalContext';
import { parseExpenseDateToMs } from './expenses';

const normalizeText = (value: unknown) => String(value || '').trim().toLowerCase();

const parseDateToMs = (value?: string): number => {
  const raw = String(value || '').trim();
  if (!raw) return Number.NaN;
  const direct = Date.parse(raw);
  if (Number.isFinite(direct)) return direct;
  return parseExpenseDateToMs(raw);
};

const endOfDayMs = (reportDate: string): number => {
  const value = String(reportDate || '').trim();
  const direct = Date.parse(`${value}T23:59:59.999`);
  if (Number.isFinite(direct)) return direct;
  const parsed = parseDateToMs(value);
  if (Number.isFinite(parsed)) {
    const date = new Date(parsed);
    date.setHours(23, 59, 59, 999);
    return date.getTime();
  }
  return Number.POSITIVE_INFINITY;
};

const isOnOrBefore = (value: string | undefined, cutoffMs: number) => {
  const parsed = parseDateToMs(value);
  if (!Number.isFinite(parsed)) return true;
  return parsed <= cutoffMs;
};

const matchesLocation = (locationFilter: string, value?: string) => {
  if (locationFilter === 'all') return true;
  return normalizeText(value) === normalizeText(locationFilter);
};

const matchSaleToPayment = (sale: Pick<Sale, 'customerId' | 'customerName'>, payment: Payment) => {
  const paymentContactId = normalizeText(payment.contactId);
  const paymentContactName = normalizeText(payment.contactName);
  const saleCustomerId = normalizeText(sale.customerId);
  const saleCustomerName = normalizeText(sale.customerName);
  return (
    (!!paymentContactId && !!saleCustomerId && paymentContactId === saleCustomerId) ||
    (!!paymentContactName && !!saleCustomerName && paymentContactName === saleCustomerName)
  );
};

const matchPurchaseToPayment = (purchase: Pick<Purchase, 'supplierId' | 'supplier'>, payment: Payment) => {
  const paymentContactId = normalizeText(payment.contactId);
  const paymentContactName = normalizeText(payment.contactName);
  const purchaseSupplierId = normalizeText(purchase.supplierId);
  const purchaseSupplierName = normalizeText(purchase.supplier);
  return (
    (!!paymentContactId && !!purchaseSupplierId && paymentContactId === purchaseSupplierId) ||
    (!!paymentContactName && !!purchaseSupplierName && paymentContactName === purchaseSupplierName)
  );
};

const parseAmount = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

const isFinalSale = (sale: Sale) => String(sale.status || sale.saleStatus || '').trim() === 'Final';

type BaseSale = {
  id: string;
  invoiceNo: string;
  date: string;
  location?: string;
  customerId: string;
  customerName: string;
};

type BasePurchase = {
  id: string;
  refNo: string;
  date: string;
  location?: string;
  supplierId: string;
  supplierName: string;
};

export interface DueSnapshotInput {
  sales: Sale[];
  purchases: Purchase[];
  payments: Payment[];
  reportDate: string;
  locationFilter: string;
}

export interface DueSnapshotResult {
  customerDue: number;
  supplierDue: number;
}

export interface PaymentLocationSnapshotInput {
  payment: Payment;
  salesLocationByInvoice: Map<string, string>;
  expensesById: Map<string, Expense>;
}

export const paymentLocationCandidates = ({
  payment,
  salesLocationByInvoice,
  expensesById,
}: PaymentLocationSnapshotInput): string[] => {
  const explicitLocation = String(payment.location || '').trim();
  if (explicitLocation) return [explicitLocation];

  const linkedExpense = payment.contactType === 'Expense'
    ? expensesById.get(String(payment.expenseId || payment.contactId || '').trim())
    : undefined;
  const expenseLocation = String(linkedExpense?.location || '').trim();
  if (expenseLocation) return [expenseLocation];

  const invoiceLocations = (payment.linkedInvoices || [])
    .map(invoice => salesLocationByInvoice.get(String(invoice || '').trim()) || '')
    .map(location => String(location || '').trim())
    .filter(Boolean);

  return Array.from(new Set(invoiceLocations));
};

export const buildDueSnapshot = ({
  sales,
  purchases,
  payments,
  reportDate,
  locationFilter,
}: DueSnapshotInput): DueSnapshotResult => {
  const cutoffMs = endOfDayMs(reportDate);

  const baseSales = sales
    .filter(sale => isFinalSale(sale) && isOnOrBefore(sale.date, cutoffMs))
    .map<BaseSale>(sale => ({
      id: String(sale.id || ''),
      invoiceNo: String(sale.invoiceNo || '').trim(),
      date: String(sale.date || ''),
      location: sale.location,
      customerId: String(sale.customerId || '').trim(),
      customerName: String(sale.customerName || '').trim(),
    }));

  const saleDueById = new Map<string, number>();
  sales.forEach(sale => {
    if (!isFinalSale(sale) || !isOnOrBefore(sale.date, cutoffMs)) return;
    const total = parseAmount(sale.grandTotal ?? sale.totalAmount);
    saleDueById.set(String(sale.id || ''), total);
  });

  const customerPayments = payments
    .filter(payment =>
      payment.contactType === 'Customer' &&
      payment.type === 'received' &&
      isOnOrBefore(payment.date, cutoffMs)
    )
    .slice()
    .sort((left, right) => {
      const leftMs = parseDateToMs(left.date);
      const rightMs = parseDateToMs(right.date);
      return (Number.isFinite(leftMs) ? leftMs : 0) - (Number.isFinite(rightMs) ? rightMs : 0);
    });

  customerPayments.forEach(payment => {
    let remaining = parseAmount(payment.amount);
    if (remaining <= 0) return;

    const paymentMs = parseDateToMs(payment.date);
    const dueInvoices = baseSales
      .filter(baseSale => {
        if (!matchSaleToPayment({
          customerId: baseSale.customerId,
          customerName: baseSale.customerName,
        }, payment)) {
          return false;
        }

        const currentDue = saleDueById.get(baseSale.id) || 0;
        if (currentDue <= 0) return false;

        if (Number.isFinite(paymentMs)) {
          const invoiceMs = parseDateToMs(baseSale.date);
          if (Number.isFinite(invoiceMs) && invoiceMs > paymentMs) return false;
        }

        return true;
      })
      .sort((left, right) => {
        const leftMs = parseDateToMs(left.date);
        const rightMs = parseDateToMs(right.date);
        return (Number.isFinite(leftMs) ? leftMs : 0) - (Number.isFinite(rightMs) ? rightMs : 0);
      });

    const linkedInvoiceSet = new Set(
      (payment.linkedInvoices || [])
        .map(invoice => String(invoice || '').trim())
        .filter(Boolean),
    );

    const prioritizedInvoices = linkedInvoiceSet.size === 0
      ? dueInvoices
      : [
          ...dueInvoices.filter(invoice => linkedInvoiceSet.has(invoice.invoiceNo)),
          ...dueInvoices.filter(invoice => !linkedInvoiceSet.has(invoice.invoiceNo)),
        ];

    prioritizedInvoices.forEach(invoice => {
      if (remaining <= 0) return;
      const currentDue = saleDueById.get(invoice.id) || 0;
      if (currentDue <= 0) return;
      const settled = Math.min(remaining, currentDue);
      remaining -= settled;
      saleDueById.set(invoice.id, Number((currentDue - settled).toFixed(3)));
    });
  });

  const customerDue = baseSales.reduce((sum, sale) => {
    if (!matchesLocation(locationFilter, sale.location)) return sum;
    return sum + (saleDueById.get(sale.id) || 0);
  }, 0);

  const basePurchases = purchases
    .filter(purchase => isOnOrBefore(purchase.date, cutoffMs))
    .map<BasePurchase>(purchase => ({
      id: String(purchase.id || ''),
      refNo: String(purchase.refNo || '').trim(),
      date: String(purchase.date || ''),
      location: purchase.location,
      supplierId: String(purchase.supplierId || '').trim(),
      supplierName: String(purchase.supplier || '').trim(),
    }));

  const purchaseDueById = new Map<string, number>();
  purchases.forEach(purchase => {
    if (!isOnOrBefore(purchase.date, cutoffMs)) return;
    const total = parseAmount(purchase.grandTotal || purchase.paymentDue);
    purchaseDueById.set(String(purchase.id || ''), total);
  });

  const supplierPayments = payments
    .filter(payment =>
      payment.contactType === 'Supplier' &&
      payment.type === 'sent' &&
      isOnOrBefore(payment.date, cutoffMs)
    )
    .slice()
    .sort((left, right) => {
      const leftMs = parseDateToMs(left.date);
      const rightMs = parseDateToMs(right.date);
      return (Number.isFinite(leftMs) ? leftMs : 0) - (Number.isFinite(rightMs) ? rightMs : 0);
    });

  supplierPayments.forEach(payment => {
    let remaining = parseAmount(payment.amount);
    if (remaining <= 0) return;

    const paymentMs = parseDateToMs(payment.date);
    const duePurchases = basePurchases
      .filter(basePurchase => {
        if (!matchPurchaseToPayment({
          supplier: basePurchase.supplierName,
          supplierId: basePurchase.supplierId,
        }, payment)) {
          return false;
        }

        const currentDue = purchaseDueById.get(basePurchase.id) || 0;
        if (currentDue <= 0) return false;

        if (Number.isFinite(paymentMs)) {
          const purchaseMs = parseDateToMs(basePurchase.date);
          if (Number.isFinite(purchaseMs) && purchaseMs > paymentMs) return false;
        }

        return true;
      })
      .sort((left, right) => {
        const leftMs = parseDateToMs(left.date);
        const rightMs = parseDateToMs(right.date);
        return (Number.isFinite(leftMs) ? leftMs : 0) - (Number.isFinite(rightMs) ? rightMs : 0);
      });

    const linkedRefSet = new Set(
      (payment.linkedInvoices || [])
        .map(ref => String(ref || '').trim())
        .filter(Boolean),
    );

    const prioritizedPurchases = linkedRefSet.size === 0
      ? duePurchases
      : [
          ...duePurchases.filter(purchase => linkedRefSet.has(purchase.refNo)),
          ...duePurchases.filter(purchase => !linkedRefSet.has(purchase.refNo)),
        ];

    prioritizedPurchases.forEach(purchase => {
      if (remaining <= 0) return;
      const currentDue = purchaseDueById.get(purchase.id) || 0;
      if (currentDue <= 0) return;
      const settled = Math.min(remaining, currentDue);
      remaining -= settled;
      purchaseDueById.set(purchase.id, Number((currentDue - settled).toFixed(3)));
    });
  });

  const supplierDue = basePurchases.reduce((sum, purchase) => {
    if (!matchesLocation(locationFilter, purchase.location)) return sum;
    return sum + (purchaseDueById.get(purchase.id) || 0);
  }, 0);

  return {
    customerDue: Number(customerDue.toFixed(3)),
    supplierDue: Number(supplierDue.toFixed(3)),
  };
};
