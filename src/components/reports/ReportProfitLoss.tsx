import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Printer,
  MapPin,
  Calendar,
  FileText,
  FileSpreadsheet,
  Columns,
  Download,
  Search,
  ArrowUpDown,
  Info,
  Package,
  Tags,
  Tag,
  User,
  CalendarDays,TrendingUp} from 'lucide-react';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import { useGlobalContext } from '@/context/GlobalContext';

import MultiSelect from '@/components/shared/MultiSelect';

import { printActiveReportTable } from '@/utils/printUtils';
import {
  bootstrapStockTransfersFromDB,
  readStockTransfers,
} from '@/utils/stockTransfers';
import {
  bootstrapStockAdjustmentsFromDB,
  readStockAdjustments,
} from '@/utils/stockAdjustments';
import { parseExpenseDateToMs } from '@/utils/expenses';

interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

type ProfitTabId =
  | 'products'
  | 'categories'
  | 'brands'
  | 'locations'
  | 'invoice'
  | 'date'
  | 'customer'
  | 'day';

interface ProfitLineRecord {
  product: string;
  category: string;
  brand: string;
  grossProfit: number;
}

interface ProfitSaleRecord {
  invoice: string;
  location: string;
  customer: string;
  date: string;
  dateMs: number;
  day: string;
  dayIndex: number;
  grossProfit: number;
}

interface ProfitAggregateRow {
  key: string;
  grossProfit: number;
  sortValue?: number;
}

const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dayOrderMap = new Map(dayOrder.map((name, index) => [name, index]));
const jsDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const round3 = (value: number) => Math.round(value * 1000) / 1000;
const normalizeText = (value?: string) => String(value || '').trim().toLowerCase();

const getCurrentYearRange = (): DateRangeValue => {
  const now = new Date();
  return {
    startDate: new Date(now.getFullYear(), 0, 1),
    endDate: new Date(now.getFullYear(), 11, 31),
    label: 'This Year',
  };
};

const parseReportDateToMs = (value: unknown): number => {
  const raw = String(value || '').trim();
  if (!raw) return Number.NaN;
  const direct = Date.parse(raw);
  if (Number.isFinite(direct)) return direct;
  return parseExpenseDateToMs(raw);
};

const formatDateBySettings = (ms: number, dateFormat: string): string => {
  if (!Number.isFinite(ms)) return '--';
  const date = new Date(ms);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return dateFormat === 'mm/dd/yyyy' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
};

const escapeCsv = (value: string) => `"${String(value).replace(/"/g, '""')}"`;

const downloadBlob = (filename: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const buildPageItems = (currentPage: number, totalPages: number): Array<number | '...'> => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const items: Array<number | '...'> = [1];
  const left = Math.max(2, currentPage - 1);
  const right = Math.min(totalPages - 1, currentPage + 1);
  if (left > 2) items.push('...');
  for (let page = left; page <= right; page += 1) {
    items.push(page);
  }
  if (right < totalPages - 1) items.push('...');
  items.push(totalPages);
  return items;
};

const ReportProfitLoss: React.FC = () => {
  const {
    locations,
    expenses,
    sales,
    purchases,
    purchaseReturns,
    sellReturns,
    products,
    customers,
    settings,
    formatCurrency,
  } = useGlobalContext();

  const [activeTab, setActiveTab] = useState<ProfitTabId>('products');
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [dateRange, setDateRange] = useState<DateRangeValue>(getCurrentYearRange);
  const [filters, setFilters] = useState({
    location: [] as string[],
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    label: true,
    grossProfit: true,
  });
  const [stockOpsVersion, setStockOpsVersion] = useState(0);
  const columnMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const refreshStockOps = () => setStockOpsVersion((prev) => prev + 1);
    let isMounted = true;

    const refreshFromDB = async () => {
      await Promise.all([
        bootstrapStockTransfersFromDB().catch(() => {}),
        bootstrapStockAdjustmentsFromDB().catch(() => {}),
      ]);
      if (isMounted) refreshStockOps();
    };

    void refreshFromDB();
    const onFocus = () => { void refreshFromDB(); };
    const onTransfersUpdated = () => { void refreshFromDB(); };
    const onAdjustmentsUpdated = () => { void refreshFromDB(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('app:stock-transfers-updated', onTransfersUpdated);
    window.addEventListener('app:stock-adjustments-updated', onAdjustmentsUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('app:stock-transfers-updated', onTransfersUpdated);
      window.removeEventListener('app:stock-adjustments-updated', onAdjustmentsUpdated);
    };
  }, []);

  const startMs = useMemo(() => (
    dateRange.startDate
      ? new Date(
          dateRange.startDate.getFullYear(),
          dateRange.startDate.getMonth(),
          dateRange.startDate.getDate(),
          0,
          0,
          0,
          0,
        ).getTime()
      : null
  ), [dateRange.startDate]);

  const endMs = useMemo(() => (
    dateRange.endDate
      ? new Date(
          dateRange.endDate.getFullYear(),
          dateRange.endDate.getMonth(),
          dateRange.endDate.getDate(),
          23,
          59,
          59,
          999,
        ).getTime()
      : null
  ), [dateRange.endDate]);

  const hasDateFilter = startMs != null || endMs != null;

  const selectedLocationSet = useMemo(
    () => new Set(filters.location.map((location) => normalizeText(location))),
    [filters.location],
  );

  const locationOptions = useMemo(() => {
    return Array.from(new Set([
      ...locations.map((location) => String(location.name || '').trim()).filter(Boolean),
      ...sales.map((sale) => String(sale.location || '').trim()).filter(Boolean),
      ...products.map((product) => String(product.businessLocation || '').trim()).filter(Boolean),
    ])).sort((left, right) => left.localeCompare(right));
  }, [locations, products, sales]);

  const productMaps = useMemo(() => {
    const byId = new Map<string, (typeof products)[number]>();
    const byName = new Map<string, (typeof products)[number]>();
    products.forEach((product) => {
      byId.set(String(product.id || ''), product);
      const key = normalizeText(product.name);
      if (key) byName.set(key, product);
    });
    return { byId, byName };
  }, [products]);

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((customer) => {
      const label = String(customer.businessName || customer.name || '').trim();
      map.set(String(customer.id || ''), label || 'Walk-in Customer');
    });
    return map;
  }, [customers]);

  const isDateMatch = (value: unknown) => {
    const dateMs = parseReportDateToMs(value);
    if (!Number.isFinite(dateMs)) return !hasDateFilter;
    if (startMs != null && dateMs < startMs) return false;
    if (endMs != null && dateMs > endMs) return false;
    return true;
  };

  const isLocationMatch = (locationValue?: string) => {
    if (selectedLocationSet.size === 0) return true;
    return selectedLocationSet.has(normalizeText(locationValue));
  };

  const filteredFinalSales = useMemo(() => {
    return sales.filter((sale) => {
      const status = normalizeText(sale.status || sale.saleStatus);
      if (status !== 'final') return false;
      if (!isDateMatch(sale.date)) return false;
      if (!isLocationMatch(sale.location)) return false;
      return true;
    });
  }, [sales, startMs, endMs, hasDateFilter, selectedLocationSet]);

  const { lineRecords, saleRecords, totalSellCost } = useMemo(() => {
    const lines: ProfitLineRecord[] = [];
    const saleRows: ProfitSaleRecord[] = [];
    let cumulativeSellCost = 0;

    filteredFinalSales.forEach((sale) => {
      const saleMs = parseReportDateToMs(sale.date);
      const invoice = String(sale.invoiceNo || '--').trim() || '--';
      const location = String(sale.location || '--').trim() || '--';
      const customer = String(
        sale.customerName || customerNameById.get(String(sale.customerId || '')) || 'Walk-in Customer',
      ).trim() || 'Walk-in Customer';
      const dayName = Number.isFinite(saleMs)
        ? jsDayNames[new Date(saleMs).getDay()]
        : 'Unknown';
      const dayIndex = dayOrderMap.get(dayName) ?? Number.MAX_SAFE_INTEGER;

      let invoiceGrossProfit = 0;

      (sale.items || []).forEach((item) => {
        const product = productMaps.byId.get(String(item.id || '')) ||
          productMaps.byName.get(normalizeText(item.name));
        const qty = Number(item.qty || 0);
        const unitPrice = Number(item.unitPrice || 0);
        const lineDiscount = Number(item.discount || 0);
        const subtotalRaw = Number(item.subtotal);
        const lineRevenue = Number.isFinite(subtotalRaw)
          ? subtotalRaw
          : Math.max(0, (qty * unitPrice) - lineDiscount);
        const itemUnitCost = Number((item as any).unitCost ?? (item as any).purchasePrice ?? product?.unitPurchasePrice ?? 0);
        const lineCost = qty * (Number.isFinite(itemUnitCost) ? itemUnitCost : 0);
        const lineGrossProfit = lineRevenue - lineCost;

        const productName = String(item.name || product?.name || item.id || 'Unknown Product').trim() || 'Unknown Product';
        const category = String(product?.category || '--').trim() || '--';
        const brand = String(product?.brand || '--').trim() || '--';

        lines.push({
          product: productName,
          category,
          brand,
          grossProfit: lineGrossProfit,
        });

        invoiceGrossProfit += lineGrossProfit;
        cumulativeSellCost += lineCost;
      });

      const invoiceDiscount = Number(sale.discountAmount || 0);
      if (Number.isFinite(invoiceDiscount)) {
        invoiceGrossProfit -= invoiceDiscount;
      }

      saleRows.push({
        invoice,
        location,
        customer,
        date: Number.isFinite(saleMs)
          ? formatDateBySettings(saleMs, settings.dateFormat)
          : String(sale.date || '--'),
        dateMs: Number.isFinite(saleMs) ? saleMs : Number.MAX_SAFE_INTEGER,
        day: dayName,
        dayIndex,
        grossProfit: invoiceGrossProfit,
      });
    });

    return {
      lineRecords: lines,
      saleRecords: saleRows,
      totalSellCost: round3(cumulativeSellCost),
    };
  }, [filteredFinalSales, productMaps, customerNameById, settings.dateFormat]);

  const groupedRowsByTab = useMemo<Record<ProfitTabId, ProfitAggregateRow[]>>(() => {
    const aggregateFromLine = (keySelector: (record: ProfitLineRecord) => string) => {
      const map = new Map<string, number>();
      lineRecords.forEach((record) => {
        const key = String(keySelector(record) || '--').trim() || '--';
        map.set(key, (map.get(key) || 0) + record.grossProfit);
      });
      return Array.from(map.entries())
        .map(([key, grossProfit]) => ({ key, grossProfit: round3(grossProfit) }))
        .sort((left, right) => left.key.localeCompare(right.key, undefined, { sensitivity: 'base' }));
    };

    const aggregateFromSales = (
      keySelector: (record: ProfitSaleRecord) => string,
      sortValueSelector?: (record: ProfitSaleRecord) => number,
    ) => {
      const map = new Map<string, { grossProfit: number; sortValue: number }>();
      saleRecords.forEach((record) => {
        const key = String(keySelector(record) || '--').trim() || '--';
        const sortValue = sortValueSelector ? sortValueSelector(record) : 0;
        const existing = map.get(key);
        if (existing) {
          existing.grossProfit += record.grossProfit;
          existing.sortValue = Math.min(existing.sortValue, sortValue);
          return;
        }
        map.set(key, { grossProfit: record.grossProfit, sortValue });
      });

      return Array.from(map.entries()).map(([key, value]) => ({
        key,
        grossProfit: round3(value.grossProfit),
        sortValue: value.sortValue,
      }));
    };

    const byInvoice = aggregateFromSales((record) => record.invoice)
      .sort((left, right) => left.key.localeCompare(right.key, undefined, { numeric: true }));

    const byDate = aggregateFromSales((record) => record.date, (record) => record.dateMs)
      .sort((left, right) => (left.sortValue || 0) - (right.sortValue || 0));

    const byCustomer = aggregateFromSales((record) => record.customer)
      .sort((left, right) => left.key.localeCompare(right.key, undefined, { sensitivity: 'base' }));

    const byLocation = aggregateFromSales((record) => record.location)
      .sort((left, right) => left.key.localeCompare(right.key, undefined, { sensitivity: 'base' }));

    const byDay = aggregateFromSales((record) => record.day, (record) => record.dayIndex)
      .sort((left, right) => (left.sortValue || Number.MAX_SAFE_INTEGER) - (right.sortValue || Number.MAX_SAFE_INTEGER));

    return {
      products: aggregateFromLine((record) => record.product),
      categories: aggregateFromLine((record) => record.category),
      brands: aggregateFromLine((record) => record.brand),
      locations: byLocation,
      invoice: byInvoice,
      date: byDate,
      customer: byCustomer,
      day: byDay,
    };
  }, [lineRecords, saleRecords]);

  const activeRows = useMemo(() => {
    const query = normalizeText(searchTerm);
    const rows = groupedRowsByTab[activeTab] || [];
    if (!query) return rows;
    return rows.filter((row) => normalizeText(row.key).includes(query));
  }, [groupedRowsByTab, activeTab, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, entriesPerPage, filters.location, dateRange.startDate, dateRange.endDate]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(activeRows.length / entriesPerPage)),
    [activeRows.length, entriesPerPage],
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!showColumnMenu) return undefined;
    const handleClickOutside = (event: MouseEvent) => {
      if (!columnMenuRef.current) return;
      if (!columnMenuRef.current.contains(event.target as Node)) {
        setShowColumnMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColumnMenu]);

  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;

  const pageRows = useMemo(
    () => activeRows.slice(startIndex, endIndex),
    [activeRows, startIndex, endIndex],
  );

  const activeRowsTotal = useMemo(
    () => round3(activeRows.reduce((sum, row) => sum + row.grossProfit, 0)),
    [activeRows],
  );

  const tabConfig: Array<{ id: ProfitTabId; label: string; icon: React.ElementType; columnLabel: string }> = [
    { id: 'products', label: 'Profit by products', icon: Package, columnLabel: 'Product' },
    { id: 'categories', label: 'Profit by categories', icon: Tags, columnLabel: 'Category' },
    { id: 'brands', label: 'Profit by brands', icon: Tag, columnLabel: 'Brand' },
    { id: 'locations', label: 'Profit by locations', icon: MapPin, columnLabel: 'Location' },
    { id: 'invoice', label: 'Profit by invoice', icon: FileText, columnLabel: 'Invoice No.' },
    { id: 'date', label: 'Profit by date', icon: Calendar, columnLabel: 'Date' },
    { id: 'customer', label: 'Profit by customer', icon: User, columnLabel: 'Customer' },
    { id: 'day', label: 'Profit by day', icon: CalendarDays, columnLabel: 'Days' },
  ];

  const activeTabConfig = tabConfig.find((tab) => tab.id === activeTab) || tabConfig[0];
  const pageItems = buildPageItems(currentPage, totalPages);
  const visibleColumnCount = Math.max(1, Number(visibleColumns.label) + Number(visibleColumns.grossProfit));

  const exportRows = activeRows;
  const exportFilenameBase = `profit_${activeTab}`;
  const exportHeader = [activeTabConfig.columnLabel, 'Gross Profit'];

  const handleExportCsv = () => {
    const csv = [
      exportHeader.map(escapeCsv).join(','),
      ...exportRows.map((row) => [escapeCsv(row.key), escapeCsv(row.grossProfit.toFixed(3))].join(',')),
    ].join('\n');
    downloadBlob(`${exportFilenameBase}.csv`, csv, 'text/csv;charset=utf-8;');
  };

  const handleExportExcel = () => {
    const tsv = [
      exportHeader.join('\t'),
      ...exportRows.map((row) => `${row.key}\t${row.grossProfit.toFixed(3)}`),
    ].join('\n');
    downloadBlob(
      `${exportFilenameBase}.xls`,
      tsv,
      'application/vnd.ms-excel;charset=utf-8;',
    );
  };

  const totalTransferShipping = useMemo(() => {
    const total = readStockTransfers().reduce((sum, transfer) => {
      const shipping = Number(transfer.shippingCharges || 0);
      if (!Number.isFinite(shipping)) return sum;
      if (!isDateMatch(transfer.date)) return sum;
      if (selectedLocationSet.size > 0) {
        const from = normalizeText(transfer.locationFrom);
        const to = normalizeText(transfer.locationTo);
        if (!selectedLocationSet.has(from) && !selectedLocationSet.has(to)) return sum;
      }
      return sum + shipping;
    }, 0);
    return round3(total);
  }, [startMs, endMs, hasDateFilter, selectedLocationSet, stockOpsVersion]);

  const totalStockAdjustment = useMemo(() => {
    const total = readStockAdjustments().reduce((sum, adjustment) => {
      const amount = Number(adjustment.totalAmount || 0);
      if (!Number.isFinite(amount)) return sum;
      if (!isDateMatch(adjustment.date)) return sum;
      if (!isLocationMatch(adjustment.location)) return sum;
      return sum + amount;
    }, 0);
    return round3(total);
  }, [startMs, endMs, hasDateFilter, selectedLocationSet, stockOpsVersion]);

  const totalStockRecovered = useMemo(() => {
    const total = readStockAdjustments().reduce((sum, adjustment) => {
      const recovered = Number(adjustment.totalRecovered || 0);
      if (!Number.isFinite(recovered)) return sum;
      if (!isDateMatch(adjustment.date)) return sum;
      if (!isLocationMatch(adjustment.location)) return sum;
      return sum + recovered;
    }, 0);
    return round3(total);
  }, [startMs, endMs, hasDateFilter, selectedLocationSet, stockOpsVersion]);

  const totalExpense = useMemo(() => {
    const total = expenses.reduce((sum, expense) => {
      const amount = Number(expense.totalAmount || expense.amount || 0);
      if (!Number.isFinite(amount)) return sum;
      if (!isDateMatch(expense.date)) return sum;
      if (!isLocationMatch(expense.location)) return sum;
      return sum + (expense.isRefund ? -amount : amount);
    }, 0);
    return round3(total);
  }, [expenses, startMs, endMs, hasDateFilter, selectedLocationSet]);

  const malformedExpenseDateCount = useMemo(() => {
    if (!hasDateFilter) return 0;
    return expenses.reduce((count, expense) => {
      if (selectedLocationSet.size > 0 && !selectedLocationSet.has(normalizeText(expense.location))) {
        return count;
      }
      const parsed = parseReportDateToMs(expense.date);
      if (Number.isFinite(parsed)) return count;
      return count + 1;
    }, 0);
  }, [expenses, hasDateFilter, selectedLocationSet]);

  const totalPurchase = useMemo(() => {
    return round3(purchases.reduce((sum, purchase) => {
      if (!isDateMatch(purchase.date)) return sum;
      if (!isLocationMatch(purchase.location)) return sum;
      const subTotal = Number(purchase.subTotal);
      const purchaseTaxAmount = Number(purchase.purchaseTaxAmount || 0);
      const grandTotal = Number(purchase.grandTotal || 0);
      const computed = Number.isFinite(subTotal)
        ? subTotal
        : Math.max(0, grandTotal - (Number.isFinite(purchaseTaxAmount) ? purchaseTaxAmount : 0));
      return sum + (Number.isFinite(computed) ? computed : 0);
    }, 0));
  }, [purchases, startMs, endMs, hasDateFilter, selectedLocationSet]);

  const totalPurchaseShipping = useMemo(() => {
    return round3(purchases.reduce((sum, purchase) => {
      if (!isDateMatch(purchase.date)) return sum;
      if (!isLocationMatch(purchase.location)) return sum;
      const shipping = Number(purchase.shippingCharges || 0);
      return sum + (Number.isFinite(shipping) ? shipping : 0);
    }, 0));
  }, [purchases, startMs, endMs, hasDateFilter, selectedLocationSet]);

  const totalPurchaseDiscount = useMemo(() => {
    return round3(purchases.reduce((sum, purchase) => {
      if (!isDateMatch(purchase.date)) return sum;
      if (!isLocationMatch(purchase.location)) return sum;
      const discount = Number(purchase.discountAmount || 0);
      return sum + (Number.isFinite(discount) ? discount : 0);
    }, 0));
  }, [purchases, startMs, endMs, hasDateFilter, selectedLocationSet]);

  const totalPurchaseReturn = useMemo(() => {
    return round3(purchaseReturns.reduce((sum, record) => {
      if (!isDateMatch(record.date)) return sum;
      if (!isLocationMatch(record.location)) return sum;
      const amount = Number(record.subTotal || record.grandTotal || 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0));
  }, [purchaseReturns, startMs, endMs, hasDateFilter, selectedLocationSet]);

  const totalSales = useMemo(() => {
    return round3(filteredFinalSales.reduce((sum, sale) => {
      const subTotal = Number(sale.subTotal || 0);
      return sum + (Number.isFinite(subTotal) ? subTotal : 0);
    }, 0));
  }, [filteredFinalSales]);

  const totalSellShipping = useMemo(() => {
    return round3(filteredFinalSales.reduce((sum, sale) => {
      const shipping = Number(sale.shippingCharges || 0);
      return sum + (Number.isFinite(shipping) ? shipping : 0);
    }, 0));
  }, [filteredFinalSales]);

  const totalSellDiscount = useMemo(() => {
    return round3(filteredFinalSales.reduce((sum, sale) => {
      const discount = Number(sale.discountAmount || 0);
      return sum + (Number.isFinite(discount) ? discount : 0);
    }, 0));
  }, [filteredFinalSales]);

  const totalSellReturn = useMemo(() => {
    return round3(sellReturns.reduce((sum, saleReturn) => {
      if (!isDateMatch(saleReturn.date)) return sum;
      if (!isLocationMatch(saleReturn.location)) return sum;
      const amount = Number(saleReturn.total || saleReturn.subTotal || 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0));
  }, [sellReturns, startMs, endMs, hasDateFilter, selectedLocationSet]);

  const openingStockPurchase = useMemo(() => {
    return round3(products.reduce((sum, product) => {
      if (!isLocationMatch(product.businessLocation)) return sum;
      const openingQty = Number(product.openingStock || 0);
      const unitCost = Number(product.unitPurchasePrice || 0);
      if (!Number.isFinite(openingQty) || !Number.isFinite(unitCost)) return sum;
      return sum + (openingQty * unitCost);
    }, 0));
  }, [products, selectedLocationSet]);

  const openingStockSale = useMemo(() => {
    return round3(products.reduce((sum, product) => {
      if (!isLocationMatch(product.businessLocation)) return sum;
      const openingQty = Number(product.openingStock || 0);
      const sellingPrice = Number(product.sellingPrice || 0);
      if (!Number.isFinite(openingQty) || !Number.isFinite(sellingPrice)) return sum;
      return sum + (openingQty * sellingPrice);
    }, 0));
  }, [products, selectedLocationSet]);

  const closingStockPurchase = useMemo(() => {
    return round3(products.reduce((sum, product) => {
      if (!isLocationMatch(product.businessLocation)) return sum;
      const qty = Number(product.stock || 0);
      const unitCost = Number(product.unitPurchasePrice || 0);
      if (!Number.isFinite(qty) || !Number.isFinite(unitCost)) return sum;
      return sum + (qty * unitCost);
    }, 0));
  }, [products, selectedLocationSet]);

  const closingStockSale = useMemo(() => {
    return round3(products.reduce((sum, product) => {
      if (!isLocationMatch(product.businessLocation)) return sum;
      const qty = Number(product.stock || 0);
      const sellingPrice = Number(product.sellingPrice || 0);
      if (!Number.isFinite(qty) || !Number.isFinite(sellingPrice)) return sum;
      return sum + (qty * sellingPrice);
    }, 0));
  }, [products, selectedLocationSet]);

  const purchaseAdditionalExpenses = 0;
  const totalCustomerReward = 0;
  const sellAdditionalExpenses = 0;
  const totalSellRoundOff = 0;

  const cogs = round3(
    (openingStockPurchase + totalPurchase + totalPurchaseShipping + totalStockAdjustment + purchaseAdditionalExpenses)
    - (totalPurchaseReturn + totalPurchaseDiscount + closingStockPurchase),
  );

  const grossProfit = round3(totalSales - totalSellCost);

  const netProfit = round3(
    grossProfit
      + (totalSellShipping + sellAdditionalExpenses + totalStockRecovered + totalPurchaseDiscount + totalSellRoundOff)
      - (
        totalStockAdjustment
        + totalExpense
        + totalPurchaseShipping
        + totalTransferShipping
        + purchaseAdditionalExpenses
        + totalSellDiscount
        + totalCustomerReward
      ),
  );

  const showingFrom = activeRows.length === 0 ? 0 : startIndex + 1;
  const showingTo = Math.min(endIndex, activeRows.length);

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
<div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-4 mb-6">
        <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
          <TrendingUp size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Profit / Loss Report</h1>
          <p className="text-slate-500 text-sm mt-0.5">Revenue, cost, and net profit overview</p>
        </div>
      </div>
          <div className="h-6 w-px bg-slate-200 hidden md:block" />
          <div className="w-full md:w-64">
            <MultiSelect
              label="Business Location"
              options={locationOptions}
              selected={filters.location}
              onChange={(nextLocation) => setFilters({ location: nextLocation })}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <div className="bg-slate-100 rounded-lg p-1 border border-slate-200">
            <DateRangeFilter
              className="min-w-[200px]"
              onRangeSelect={(nextRange) => setDateRange(nextRange as DateRangeValue)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
          <div className="p-6 space-y-3 text-xs">
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="font-bold text-slate-700">Opening Stock <br /><span className="font-normal text-[10px] text-slate-500">(By purchase price):</span></span>
              <span className="font-medium text-slate-600">{formatCurrency(openingStockPurchase)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="font-bold text-slate-700">Opening Stock <br /><span className="font-normal text-[10px] text-slate-500">(By sale price):</span></span>
              <span className="font-medium text-slate-600">{formatCurrency(openingStockSale)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="font-bold text-slate-700">Total Purchase: <br /><span className="font-normal text-[10px] text-slate-500">(Exc. tax, Discount)</span></span>
              <span className="font-medium text-slate-600">{formatCurrency(totalPurchase)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="font-bold text-slate-700">Total Stock Adjustment:</span>
              <span className="font-medium text-slate-600">{formatCurrency(totalStockAdjustment)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="font-bold text-slate-700">Total Expense:</span>
              <span className="font-medium text-slate-600">{formatCurrency(totalExpense)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="font-bold text-slate-700">Total purchase shipping charge:</span>
              <span className="font-medium text-slate-600">{formatCurrency(totalPurchaseShipping)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="font-bold text-slate-700">Purchase additional expenses:</span>
              <span className="font-medium text-slate-600">{formatCurrency(purchaseAdditionalExpenses)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="font-bold text-slate-700">Total transfer shipping charge:</span>
              <span className="font-medium text-slate-600">{formatCurrency(totalTransferShipping)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="font-bold text-slate-700">Total Sell discount:</span>
              <span className="font-medium text-slate-600">{formatCurrency(totalSellDiscount)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="font-bold text-slate-700">Total customer reward:</span>
              <span className="font-medium text-slate-600">{formatCurrency(totalCustomerReward)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="font-bold text-slate-700">Total Sell Return:</span>
              <span className="font-medium text-slate-600">{formatCurrency(totalSellReturn)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
          <div className="p-6 space-y-3 text-xs">
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="font-bold text-slate-700">Closing Stock <br /><span className="font-normal text-[10px] text-slate-500">(By purchase price):</span></span>
              <span className="font-medium text-slate-600">{formatCurrency(closingStockPurchase)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="font-bold text-slate-700">Closing Stock <br /><span className="font-normal text-[10px] text-slate-500">(By sale price):</span></span>
              <span className="font-medium text-slate-600">{formatCurrency(closingStockSale)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="font-bold text-slate-700">Total Sales: <br /><span className="font-normal text-[10px] text-slate-500">(Exc. tax, Discount)</span></span>
              <span className="font-medium text-slate-600">{formatCurrency(totalSales)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="font-bold text-slate-700">Total sell shipping charge:</span>
              <span className="font-medium text-slate-600">{formatCurrency(totalSellShipping)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="font-bold text-slate-700">Sell additional expenses:</span>
              <span className="font-medium text-slate-600">{formatCurrency(sellAdditionalExpenses)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="font-bold text-slate-700">Total Stock Recovered:</span>
              <span className="font-medium text-slate-600">{formatCurrency(totalStockRecovered)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="font-bold text-slate-700">Total Purchase Return:</span>
              <span className="font-medium text-slate-600">{formatCurrency(totalPurchaseReturn)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="font-bold text-slate-700">Total Purchase discount:</span>
              <span className="font-medium text-slate-600">{formatCurrency(totalPurchaseDiscount)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="font-bold text-slate-700">Total sell round off:</span>
              <span className="font-medium text-slate-600">{formatCurrency(totalSellRoundOff)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div>
          <h3 className="text-xl font-medium text-slate-500 flex items-center gap-2">
            COGS: <span className="font-bold text-slate-700">{formatCurrency(cogs)}</span>
          </h3>
          <p className="text-[10px] text-slate-400 font-mono mt-1">
            (Total opening stock + Total purchase + Total purchase shipping charge + Total Stock Adjustment + Purchase additional expenses) - (Total purchase return + Total purchase discount + Total closing stock)
          </p>
        </div>
        <div>
          <h3 className="text-xl font-medium text-slate-500 flex items-center gap-2">
            Gross Profit: <span className="font-bold text-slate-700">{formatCurrency(grossProfit)}</span>
          </h3>
          <p className="text-[10px] text-slate-400 font-mono mt-1">
            (Total sell price - Total purchase price)
          </p>
        </div>
        <div className="pt-2 border-t border-slate-200">
          <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            Net Profit: <span className={netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(netProfit)}</span>
          </h3>
          <p className="text-[10px] text-slate-400 font-mono mt-1">
            Gross Profit + (Total sell shipping charge + Sell additional expenses + Total Stock Recovered + Total Purchase discount + Total sell round off) - (Total Stock Adjustment + Total Expense + Total purchase shipping charge + Total transfer shipping charge + Purchase additional expenses + Total Sell discount + Total customer reward)
          </p>
        </div>
      </div>

      {malformedExpenseDateCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
          <span className="font-bold">Warning:</span>{' '}
          {malformedExpenseDateCount} expense record(s) have invalid dates and were excluded from the selected date range.
        </div>
      )}

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50/50">
          {tabConfig.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-xs font-bold whitespace-nowrap transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-white'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 font-bold">Show</span>
            <select
              className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none"
              value={entriesPerPage}
              onChange={(event) => setEntriesPerPage(Number(event.target.value) || 25)}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-xs text-slate-600 font-bold">entries</span>
          </div>

          <div className="flex gap-1 flex-wrap relative" ref={columnMenuRef}>
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1 shadow-sm"
            >
              <FileText size={10} />
              Export CSV
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1 shadow-sm"
            >
              <FileSpreadsheet size={10} />
              Export Excel
            </button>
            <button
              type="button"
              onClick={() => printActiveReportTable()}
              className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1 shadow-sm"
            >
              <Printer size={10} />
              Print
            </button>
            <button
              type="button"
              onClick={() => setShowColumnMenu((value) => !value)}
              className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1 shadow-sm"
            >
              <Columns size={10} />
              Column visibility
            </button>
            {showColumnMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded shadow-xl z-20 p-2 text-xs space-y-1">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={visibleColumns.label}
                    onChange={() => setVisibleColumns((previous) => ({ ...previous, label: !previous.label }))}
                  />
                  {activeTabConfig.columnLabel}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={visibleColumns.grossProfit}
                    onChange={() => setVisibleColumns((previous) => ({ ...previous, grossProfit: !previous.grossProfit }))}
                  />
                  Gross Profit
                </label>
              </div>
            )}
            <button
              type="button"
              onClick={() => printActiveReportTable()}
              className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1 shadow-sm"
            >
              <Download size={10} />
              Export PDF
            </button>
          </div>

          <div className="flex items-center gap-2 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search ..."
              className="pl-8 pr-3 py-1.5 rounded border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-white text-slate-700 font-bold border-b border-slate-200">
              <tr>
                {visibleColumns.label && <th className="px-6 py-3">
                  {activeTabConfig.columnLabel}
                  <ArrowUpDown size={10} className="inline ml-1 text-slate-400" />
                </th>}
                {visibleColumns.grossProfit && <th className="px-6 py-3 text-right">
                  Gross Profit
                  <ArrowUpDown size={10} className="inline ml-1 text-slate-400" />
                </th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.length > 0 ? pageRows.map((row) => (
                <tr key={`${activeTab}-${row.key}`} className="hover:bg-slate-50 transition-colors">
                  {visibleColumns.label && <td className={`px-6 py-3 text-slate-700 ${activeTab === 'invoice' ? 'text-blue-600 hover:underline cursor-pointer' : 'font-medium'}`}>
                    {row.key}
                  </td>}
                  {visibleColumns.grossProfit && <td className="px-6 py-3 text-right text-slate-600">{formatCurrency(row.grossProfit)}</td>}
                </tr>
              )) : (
                <tr>
                  <td colSpan={visibleColumnCount} className="px-6 py-10 text-center text-slate-400 italic">
                    No data available in table
                  </td>
                </tr>
              )}
            </tbody>
            {pageRows.length > 0 && (
              <tfoot className="bg-slate-200 font-bold text-slate-800 text-xs border-t border-slate-300">
                <tr>
                  <td colSpan={visibleColumnCount} className="px-6 py-3 text-right">Total: {formatCurrency(activeRowsTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <div>Showing {showingFrom} to {showingTo} of {activeRows.length} entries</div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
              disabled={currentPage <= 1}
            >
              Previous
            </button>
            {pageItems.map((item, index) => (
              item === '...'
                ? (
                  <span key={`ellipsis-${index}`} className="px-2 py-1 text-slate-400">
                    ...
                  </span>
                )
                : (
                  <button
                    key={`page-${item}`}
                    type="button"
                    onClick={() => setCurrentPage(item)}
                    className={`px-3 py-1 border rounded ${
                      currentPage === item
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {item}
                  </button>
                )
            ))}
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
              disabled={currentPage >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="text-[10px] text-slate-400 mt-4 leading-relaxed flex items-start gap-1">
        <Info size={12} className="mt-[1px]" />
        <p><strong>Note:</strong> Profit by products/categories/brands only considers inline discount. Invoice discount is not considered.</p>
      </div>
    </div>
  );
};

export default ReportProfitLoss;
