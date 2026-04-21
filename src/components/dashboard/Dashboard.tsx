import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock3,
  CreditCard,
  DollarSign,
  Factory,
  LayoutDashboard,
  MessageCircle,
  Package,
  Phone,
  Percent,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LineChart,
  Legend,
  Line,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';
import { useGlobalContext } from '@/context/GlobalContext';
import { parseExpenseDateToMs } from '@/utils/expenses';
import { paymentLocationCandidates } from '@/utils/accountingSnapshot';
import { fetchDedicated } from '@/utils/apiClient';
import { formatDateBySettings } from '@/utils/dateTime';
import SafeResponsiveContainer from '@/components/shared/SafeResponsiveContainer';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

interface DashboardProps {
  onNavigate?: (page: string) => void;
}

type DashboardPreset = 'Admin' | 'Cashier' | 'Warehouse' | 'Accountant' | 'Sales' | 'All';

interface SavedDashboardView {
  id: string;
  name: string;
  locationFilter: string;
  startDate: string;
  endDate: string;
  preset: DashboardPreset;
  createdAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const CHART_COLORS = ['#0f172a', '#dc2626', '#2563eb', '#d97706', '#0ea5e9', '#16a34a'];
const MONTH_SHORT_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const toKey = (value: unknown) => String(value || '').trim().toLowerCase();
const toNum = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const toMs = (value: unknown) => {
  const parsed = parseExpenseDateToMs(value);
  if (Number.isFinite(parsed)) return parsed;
  const fallback = Date.parse(String(value || ''));
  return Number.isFinite(fallback) ? fallback : Number.NaN;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const {
    sales: salesSource,
    products: productsSource,
    purchases: purchasesSource,
    payments: paymentsSource,
    orders: ordersSource,
    locations: locationsSource,
    customers: customersSource,
    expenses: expensesSource,
    sellReturns: sellReturnsSource,
    purchaseReturns: purchaseReturnsSource,
    settings,
    currentUser,
    formatCurrency: formatCurrencySource,
  } = useGlobalContext();
  const sales = Array.isArray(salesSource) ? salesSource : [];
  const products = Array.isArray(productsSource) ? productsSource : [];
  const purchases = Array.isArray(purchasesSource) ? purchasesSource : [];
  const payments = Array.isArray(paymentsSource) ? paymentsSource : [];
  const orders = Array.isArray(ordersSource) ? ordersSource : [];
  const locations = Array.isArray(locationsSource) ? locationsSource : [];
  const customers = Array.isArray(customersSource) ? customersSource : [];
  const expenses = Array.isArray(expensesSource) ? expensesSource : [];
  const sellReturns = Array.isArray(sellReturnsSource) ? sellReturnsSource : [];
  const purchaseReturns = Array.isArray(purchaseReturnsSource) ? purchaseReturnsSource : [];
  const formatCurrency = typeof formatCurrencySource === 'function'
    ? formatCurrencySource
    : (value: number) => `${toNum(value).toFixed(3)}`;

  const today = new Date();
  const defaultEnd = today.toISOString().slice(0, 10);
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);

  const roleKey = toKey(currentUser?.role);
  const defaultPresetByRole: DashboardPreset =
    roleKey.includes('cashier')
      ? 'Cashier'
      : roleKey.includes('warehouse') || roleKey.includes('store')
        ? 'Warehouse'
        : roleKey.includes('account')
          ? 'Accountant'
          : roleKey.includes('sales')
            ? 'Sales'
            : roleKey.includes('admin')
              ? 'Admin'
              : 'All';

  const stickyStorageKey = `app_dashboard_sticky_${toKey(currentUser?.id || currentUser?.username || 'global')}`;
  const viewsStorageKey = `app_dashboard_views_${toKey(currentUser?.id || currentUser?.username || 'global')}`;

  const readSticky = () => {
    try {
      const raw = localStorage.getItem(stickyStorageKey);
      if (!raw) {
        return {
          locationFilter: 'all',
          startDate: defaultStart,
          endDate: defaultEnd,
          preset: defaultPresetByRole as DashboardPreset,
        };
      }
      const parsed = JSON.parse(raw) as Partial<{
        locationFilter: string;
        startDate: string;
        endDate: string;
        preset: DashboardPreset;
      }>;
      return {
        locationFilter: String(parsed.locationFilter || 'all'),
        startDate: String(parsed.startDate || defaultStart),
        endDate: String(parsed.endDate || defaultEnd),
        preset: (parsed.preset || defaultPresetByRole) as DashboardPreset,
      };
    } catch {
      return {
        locationFilter: 'all',
        startDate: defaultStart,
        endDate: defaultEnd,
        preset: defaultPresetByRole as DashboardPreset,
      };
    }
  };

  const readViews = (): SavedDashboardView[] => {
    try {
      const raw = localStorage.getItem(viewsStorageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => ({
          id: String(item?.id || ''),
          name: String(item?.name || '').trim(),
          locationFilter: String(item?.locationFilter || 'all'),
          startDate: String(item?.startDate || defaultStart),
          endDate: String(item?.endDate || defaultEnd),
          preset: (item?.preset || 'All') as DashboardPreset,
          createdAt: String(item?.createdAt || new Date().toISOString()),
        }))
        .filter((item) => item.id && item.name);
    } catch {
      return [];
    }
  };

  const sticky = readSticky();
  const [locationFilter, setLocationFilter] = useState(sticky.locationFilter);
  const [startDate, setStartDate] = useState(sticky.startDate);
  const [endDate, setEndDate] = useState(sticky.endDate);
  const [dashboardPreset, setDashboardPreset] = useState<DashboardPreset>(sticky.preset || defaultPresetByRole);
  const [savedViews, setSavedViews] = useState<SavedDashboardView[]>(readViews);
  const [selectedViewId, setSelectedViewId] = useState('');
  const [viewName, setViewName] = useState('');
  const [pendingDeleteViewId, setPendingDeleteViewId] = useState('');

  // Cheque reminders
  const todayMidnight = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const tomorrowMidnight = useMemo(() => { const d = new Date(todayMidnight); d.setDate(d.getDate() + 1); return d; }, [todayMidnight]);
  const pendingCheques = useMemo(() => {
    return payments
      .filter(p => {
        if (p.method !== 'Cheque' || !p.chequeDate || p.chequeCleared) return false;
        const d = new Date(p.chequeDate); d.setHours(0,0,0,0);
        return d <= tomorrowMidnight;
      })
      .sort((a, b) => new Date(a.chequeDate!).getTime() - new Date(b.chequeDate!).getTime());
  }, [payments, tomorrowMidnight]);
  const CHEQUE_REMINDER_KEY = 'app_cheque_reminder_date';
  const [showChequePopup, setShowChequePopup] = useState(() => {
    if (typeof window === 'undefined') return false;
    const lastShown = localStorage.getItem(CHEQUE_REMINDER_KEY);
    const todayStr = new Date().toISOString().split('T')[0];
    return lastShown !== todayStr;
  });
  const dismissChequePopup = () => {
    localStorage.setItem(CHEQUE_REMINDER_KEY, new Date().toISOString().split('T')[0]);
    setShowChequePopup(false);
  };

  useEffect(() => {
    try {
      localStorage.setItem(
        stickyStorageKey,
        JSON.stringify({
          locationFilter,
          startDate,
          endDate,
          preset: dashboardPreset,
        }),
      );
    } catch {
      // Ignore localStorage failures.
    }
  }, [stickyStorageKey, locationFilter, startDate, endDate, dashboardPreset]);

  useEffect(() => {
    try {
      localStorage.setItem(viewsStorageKey, JSON.stringify(savedViews));
    } catch {
      // Ignore localStorage failures.
    }
  }, [viewsStorageKey, savedViews]);

  const resetToRoleDefault = () => {
    setLocationFilter('all');
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    setDashboardPreset(defaultPresetByRole);
    setSelectedViewId('');
  };

  const saveCurrentView = () => {
    const cleanName = viewName.trim();
    if (!cleanName) return;
    const nowIso = new Date().toISOString();
    setSavedViews((prev) => {
      const sameName = prev.find((view) => toKey(view.name) === toKey(cleanName));
      if (sameName) {
        return prev.map((view) =>
          view.id === sameName.id
            ? {
                ...view,
                locationFilter,
                startDate,
                endDate,
                preset: dashboardPreset,
              }
            : view,
        );
      }
      return [
        {
          id: `view_${Date.now()}`,
          name: cleanName,
          locationFilter,
          startDate,
          endDate,
          preset: dashboardPreset,
          createdAt: nowIso,
        },
        ...prev,
      ].slice(0, 20);
    });
    setViewName('');
  };

  const applySavedView = (viewId: string) => {
    const match = savedViews.find((view) => view.id === viewId);
    if (!match) return;
    setSelectedViewId(viewId);
    setLocationFilter(match.locationFilter || 'all');
    setStartDate(match.startDate || defaultStart);
    setEndDate(match.endDate || defaultEnd);
    setDashboardPreset(match.preset || defaultPresetByRole);
  };

  const deleteSavedView = (viewId: string) => {
    setSavedViews((prev) => prev.filter((view) => view.id !== viewId));
    if (selectedViewId === viewId) setSelectedViewId('');
  };

  const locationNameById = useMemo(() => {
    const map = new Map<string, string>();
    locations.forEach((location) => map.set(toKey(location.id), toKey(location.name)));
    return map;
  }, [locations]);

  const startMs = useMemo(() => {
    const ms = Date.parse(`${startDate}T00:00:00`);
    return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
  }, [startDate]);

  const endMs = useMemo(() => {
    const ms = Date.parse(`${endDate}T23:59:59.999`);
    return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
  }, [endDate]);

  const selectedLocationKey = toKey(locationFilter);
  const isInRange = (value: unknown) => {
    const ms = toMs(value);
    if (!Number.isFinite(ms)) return true;
    return ms >= startMs && ms <= endMs;
  };
  const matchesLocation = (value?: string) => {
    if (selectedLocationKey === 'all') return true;
    const key = toKey(value);
    if (!key) return false;
    if (key === selectedLocationKey) return true;
    return locationNameById.get(key) === selectedLocationKey;
  };

  const finalSales = useMemo(
    () =>
      sales.filter(
        (sale) =>
          toKey(sale.status || sale.saleStatus) === 'final' &&
          isInRange(sale.date) &&
          matchesLocation(String(sale.location || '')),
      ),
    [sales, startMs, endMs, selectedLocationKey, locationNameById],
  );

  const filteredPurchases = useMemo(
    () => purchases.filter((purchase) => isInRange(purchase.date) && matchesLocation(String(purchase.location || ''))),
    [purchases, startMs, endMs, selectedLocationKey, locationNameById],
  );

  const filteredSellReturns = useMemo(
    () => sellReturns.filter((ret) => isInRange(ret.date) && matchesLocation(String(ret.location || ''))),
    [sellReturns, startMs, endMs, selectedLocationKey, locationNameById],
  );

  const filteredPurchaseReturns = useMemo(
    () => purchaseReturns.filter((ret) => isInRange(ret.date) && matchesLocation(String(ret.location || ''))),
    [purchaseReturns, startMs, endMs, selectedLocationKey, locationNameById],
  );

  const filteredExpenses = useMemo(
    () => expenses.filter((expense) => isInRange(expense.date) && matchesLocation(String(expense.location || ''))),
    [expenses, startMs, endMs, selectedLocationKey, locationNameById],
  );

  const productsById = useMemo(() => {
    const map = new Map<string, (typeof products)[number]>();
    products.forEach((product) => map.set(toKey(product.id), product));
    return map;
  }, [products]);
  const productsByName = useMemo(() => {
    const map = new Map<string, (typeof products)[number]>();
    products.forEach((product) => {
      const key = toKey(product.name);
      if (!map.has(key)) map.set(key, product);
    });
    return map;
  }, [products]);

  const resolveProduct = (item: { id?: string; name?: string; productId?: string }) =>
    productsById.get(toKey(item.id || item.productId)) || productsByName.get(toKey(item.name));

  const lineRevenue = (item: { total?: number; subtotal?: number; qty?: number; unitPrice?: number }) => {
    const total = toNum(item.total);
    if (total > 0) return total;
    const subtotal = toNum(item.subtotal);
    if (subtotal > 0) return subtotal;
    return toNum(item.qty) * toNum(item.unitPrice);
  };

  const saleGrossProfit = (sale: (typeof sales)[number]) =>
    (sale.items || []).reduce((sum, item) => {
      const revenue = lineRevenue(item);
      const product = resolveProduct(item as { id?: string; name?: string; productId?: string });
      const cost = toNum(product?.unitPurchasePrice) * toNum(item.qty);
      return sum + (revenue - cost);
    }, 0);

  const totalSales = useMemo(
    () => finalSales.reduce((sum, sale) => sum + toNum(sale.grandTotal || sale.totalAmount), 0),
    [finalSales],
  );
  const totalInvoiceDue = useMemo(
    () =>
      finalSales
        .filter((sale) => {
          const status = toKey(sale.paymentStatus);
          return status === 'due' || status === 'partial' || status === 'overdue';
        })
        .reduce((sum, sale) => sum + toNum(sale.sellDue), 0),
    [finalSales],
  );
  const totalPurchase = useMemo(
    () => filteredPurchases.reduce((sum, purchase) => sum + toNum(purchase.grandTotal), 0),
    [filteredPurchases],
  );
  const totalPurchaseDue = useMemo(
    () =>
      filteredPurchases
        .filter((purchase) => {
          const status = toKey(purchase.paymentStatus);
          return status === 'due' || status === 'partial';
        })
        .reduce((sum, purchase) => sum + toNum(purchase.paymentDue), 0),
    [filteredPurchases],
  );
  const totalSellReturn = useMemo(
    () => filteredSellReturns.reduce((sum, ret) => sum + toNum(ret.total), 0),
    [filteredSellReturns],
  );
  const totalPurchaseReturn = useMemo(
    () => filteredPurchaseReturns.reduce((sum, ret) => sum + toNum(ret.grandTotal), 0),
    [filteredPurchaseReturns],
  );
  const totalExpense = useMemo(
    () => filteredExpenses.reduce((sum, expense) => sum + toNum(expense.totalAmount || expense.amount), 0),
    [filteredExpenses],
  );
  const netSales = totalSales - totalSellReturn;
  const netPurchase = totalPurchase - totalPurchaseReturn;
  const netProfit = netSales - netPurchase - totalExpense;

  const locationProducts = useMemo(
    () =>
      selectedLocationKey === 'all'
        ? products
        : products.filter((product) => matchesLocation(String(product.businessLocation || ''))),
    [products, selectedLocationKey, locationNameById],
  );
  const lowStockCount = useMemo(
    () =>
      locationProducts.filter((product) => {
        const stock = toNum(product.stock);
        const threshold = toNum(product.alertQuantity) || 10;
        return stock <= threshold;
      }).length,
    [locationProducts],
  );

  const trendData = useMemo(() => {
    const nowMs = Date.now();
    const weeks = Array.from({ length: 6 }, (_, i) => ({ name: `Week ${i + 1}`, sales: 0, profit: 0 }));
    finalSales.forEach((sale) => {
      const saleMs = toMs(sale.date);
      if (!Number.isFinite(saleMs)) return;
      const diffDays = Math.floor((nowMs - saleMs) / DAY_MS);
      if (diffDays < 0 || diffDays >= 42) return;
      const bucket = 5 - Math.floor(diffDays / 7);
      weeks[bucket].sales += toNum(sale.grandTotal || sale.totalAmount);
      weeks[bucket].profit += saleGrossProfit(sale);
    });
    return weeks.map((week) => ({
      ...week,
      sales: Number(week.sales.toFixed(3)),
      profit: Number(week.profit.toFixed(3)),
    }));
  }, [finalSales, productsById, productsByName]);

  const categoryData = useMemo(() => {
    const totals = new Map<string, number>();
    finalSales.forEach((sale) => {
      (sale.items || []).forEach((item) => {
        const product = resolveProduct(item as { id?: string; name?: string; productId?: string });
        const category = String(product?.category || 'Uncategorized').trim() || 'Uncategorized';
        totals.set(category, (totals.get(category) || 0) + lineRevenue(item));
      });
    });
    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value: Number(value.toFixed(3)) }))
      .sort((a, b) => b.value - a.value);
  }, [finalSales, productsById, productsByName]);

  const topCategory = categoryData[0];
  const topCategoryShare = totalSales > 0 && topCategory ? (topCategory.value / totalSales) * 100 : 0;
  const activeCustomers = customers.filter((customer) => customer.status === 'Active').length;

  const inventoryActions = useMemo(() => {
    const nowMs = Date.now();
    const sinceMs = nowMs - 30 * DAY_MS;
    const soldQtyByKey = new Map<string, number>();
    sales.forEach((sale) => {
      if (toKey(sale.status || sale.saleStatus) !== 'final') return;
      if (!matchesLocation(String(sale.location || ''))) return;
      const saleMs = toMs(sale.date);
      if (!Number.isFinite(saleMs) || saleMs < sinceMs || saleMs > nowMs) return;
      (sale.items || []).forEach((item) => {
        const key = toKey(item.id || (item as { productId?: string }).productId || item.name);
        if (!key) return;
        soldQtyByKey.set(key, (soldQtyByKey.get(key) || 0) + toNum(item.qty));
      });
    });

    return locationProducts
      .map((product) => {
        const stock = toNum(product.stock);
        const alertQty = toNum(product.alertQuantity) || 10;
        const keyId = toKey(product.id);
        const keyName = toKey(product.name);
        const qty30 = toNum(soldQtyByKey.get(keyId) || soldQtyByKey.get(keyName));
        const daily = qty30 / 30;
        const daysLeft = daily > 0 ? stock / daily : Number.POSITIVE_INFINITY;

        let velocity: 'Low' | 'Medium' | 'High' = 'Low';
        if (daily >= 2) velocity = 'High';
        else if (daily > 0.5) velocity = 'Medium';

        let action = 'Monitor';
        if (stock <= 0) action = 'Out of Stock';
        else if (stock <= alertQty * 0.5) action = 'Urgent Reorder';
        else if (stock <= alertQty) action = 'Reorder Soon';
        else if (daily === 0 && stock > alertQty * 4) action = 'Review Overstock';

        return {
          id: product.id,
          name: product.name,
          velocity,
          stock,
          dailySales: Number(daily.toFixed(2)),
          daysLeft: Number.isFinite(daysLeft) ? Number(daysLeft.toFixed(0)) : null,
          action,
        };
      })
      .sort((a, b) => {
        const score = (action: string) =>
          action === 'Out of Stock'
            ? 0
            : action === 'Urgent Reorder'
              ? 1
              : action === 'Reorder Soon'
                ? 2
                : action === 'Monitor'
                  ? 3
                  : 4;
        return score(a.action) - score(b.action) || a.stock - b.stock;
      })
      .slice(0, 8);
  }, [sales, locationProducts, selectedLocationKey, locationNameById]);

  const salesLocationByInvoice = useMemo(() => {
    const map = new Map<string, string>();
    sales.forEach((sale) => {
      const invoice = String(sale.invoiceNo || '').trim();
      if (!invoice) return;
      map.set(invoice, String(sale.location || '').trim());
    });
    return map;
  }, [sales]);

  const expensesById = useMemo(() => {
    const map = new Map<string, (typeof expenses)[number]>();
    expenses.forEach((expense) => {
      map.set(String(expense.id || '').trim(), expense);
    });
    return map;
  }, [expenses]);

  const filteredPayments = useMemo(
    () =>
      payments.filter((payment) => {
        if (!isInRange(payment.date)) return false;
        if (selectedLocationKey === 'all') return true;
        const candidates = paymentLocationCandidates({
          payment,
          salesLocationByInvoice,
          expensesById,
        });
        return candidates.some((candidate) => matchesLocation(candidate));
      }),
    [payments, startMs, endMs, selectedLocationKey, locationNameById, salesLocationByInvoice, expensesById],
  );

  const scopedFinalSales = useMemo(
    () =>
      sales.filter(
        (sale) => toKey(sale.status || sale.saleStatus) === 'final' && matchesLocation(String(sale.location || '')),
      ),
    [sales, selectedLocationKey, locationNameById],
  );
  const scopedPurchases = useMemo(
    () => purchases.filter((purchase) => matchesLocation(String(purchase.location || ''))),
    [purchases, selectedLocationKey, locationNameById],
  );
  const scopedSellReturns = useMemo(
    () => sellReturns.filter((ret) => matchesLocation(String(ret.location || ''))),
    [sellReturns, selectedLocationKey, locationNameById],
  );
  const scopedPurchaseReturns = useMemo(
    () => purchaseReturns.filter((ret) => matchesLocation(String(ret.location || ''))),
    [purchaseReturns, selectedLocationKey, locationNameById],
  );
  const scopedExpenses = useMemo(
    () => expenses.filter((expense) => matchesLocation(String(expense.location || ''))),
    [expenses, selectedLocationKey, locationNameById],
  );

  const rangeDays = useMemo(() => {
    const rawDays = Math.floor((endMs - startMs) / DAY_MS) + 1;
    return Number.isFinite(rawDays) && rawDays > 0 ? rawDays : 1;
  }, [startMs, endMs]);
  const previousEndMs = startMs - 1;
  const previousStartMs = previousEndMs - rangeDays * DAY_MS + 1;

  const previousSales = scopedFinalSales.reduce((sum, row) => {
    const rowMs = toMs(row.date);
    if (!Number.isFinite(rowMs) || rowMs < previousStartMs || rowMs > previousEndMs) return sum;
    return sum + toNum(row.grandTotal || row.totalAmount);
  }, 0);
  const previousExpenses = scopedExpenses.reduce((sum, row) => {
    const rowMs = toMs(row.date);
    if (!Number.isFinite(rowMs) || rowMs < previousStartMs || rowMs > previousEndMs) return sum;
    return sum + toNum(row.totalAmount || row.amount);
  }, 0);
  const previousSellReturn = scopedSellReturns.reduce((sum, row) => {
    const rowMs = toMs(row.date);
    if (!Number.isFinite(rowMs) || rowMs < previousStartMs || rowMs > previousEndMs) return sum;
    return sum + toNum(row.total);
  }, 0);
  const previousPurchase = scopedPurchases.reduce((sum, row) => {
    const rowMs = toMs(row.date);
    if (!Number.isFinite(rowMs) || rowMs < previousStartMs || rowMs > previousEndMs) return sum;
    return sum + toNum(row.grandTotal);
  }, 0);
  const previousPurchaseReturn = scopedPurchaseReturns.reduce((sum, row) => {
    const rowMs = toMs(row.date);
    if (!Number.isFinite(rowMs) || rowMs < previousStartMs || rowMs > previousEndMs) return sum;
    return sum + toNum(row.grandTotal);
  }, 0);

  const previousNetSales = previousSales - previousSellReturn;
  const previousNetPurchase = previousPurchase - previousPurchaseReturn;
  const previousNetProfit = previousNetSales - previousNetPurchase - previousExpenses;
  const currentReturnsTotal = totalSellReturn + totalPurchaseReturn;
  const previousReturnsTotal = previousSellReturn + previousPurchaseReturn;

  const buildDelta = (currentValue: number, previousValue: number, invert = false) => {
    const diff = currentValue - previousValue;
    const basis = Math.abs(previousValue) > 0.0001 ? Math.abs(previousValue) : Math.max(Math.abs(currentValue), 1);
    const pct = (diff / basis) * 100;
    const favorable = invert ? diff <= 0 : diff >= 0;
    return {
      diff,
      pct: Number(pct.toFixed(1)),
      favorable,
    };
  };

  const periodCards = [
    {
      id: 'sales',
      label: 'Sales',
      current: totalSales,
      previous: previousSales,
      icon: ShoppingCart,
      invert: false,
    },
    {
      id: 'net-profit',
      label: 'Net Profit',
      current: netProfit,
      previous: previousNetProfit,
      icon: TrendingUp,
      invert: false,
    },
    {
      id: 'expenses',
      label: 'Expenses',
      current: totalExpense,
      previous: previousExpenses,
      icon: DollarSign,
      invert: true,
    },
    {
      id: 'returns',
      label: 'Returns',
      current: currentReturnsTotal,
      previous: previousReturnsTotal,
      icon: RefreshCw,
      invert: true,
    },
  ].map((entry) => {
    const delta = buildDelta(entry.current, entry.previous, entry.invert);
    return { ...entry, delta };
  });

  const salesSparkline = useMemo(() => {
    const days = 14;
    const start = endMs - (days - 1) * DAY_MS;
    const buckets = new Map<string, number>();
    scopedFinalSales.forEach((sale) => {
      const saleMs = toMs(sale.date);
      if (!Number.isFinite(saleMs) || saleMs < start || saleMs > endMs) return;
      const key = new Date(saleMs).toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) || 0) + toNum(sale.grandTotal || sale.totalAmount));
    });
    const series: Array<{ day: string; value: number }> = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const dayMs = endMs - i * DAY_MS;
      const key = new Date(dayMs).toISOString().slice(0, 10);
      series.push({
        day: key.slice(5),
        value: Number((buckets.get(key) || 0).toFixed(3)),
      });
    }
    return series;
  }, [scopedFinalSales, endMs]);

  const cashIn = filteredPayments
    .filter((payment) => payment.type === 'received')
    .reduce((sum, payment) => sum + toNum(payment.amount), 0);
  const cashOut = filteredPayments
    .filter((payment) => payment.type === 'sent')
    .reduce((sum, payment) => sum + toNum(payment.amount), 0);
  const netCash = cashIn - cashOut;
  const collectionEfficiency = totalSales > 0 ? clamp((totalSales - totalInvoiceDue) / totalSales, 0, 1) : 0;
  const supplierSettlementEfficiency = totalPurchase > 0 ? clamp((totalPurchase - totalPurchaseDue) / totalPurchase, 0, 1) : 0;
  const projectedIn7 = totalInvoiceDue * clamp(collectionEfficiency * 0.6 + 0.15, 0.1, 0.7);
  const projectedOut7 = totalPurchaseDue * clamp((1 - supplierSettlementEfficiency) * 0.5 + 0.2, 0.2, 0.8) + totalExpense * 0.2;
  const projectedGap7 = netCash + projectedIn7 - projectedOut7;

  const totalGrossProfit = useMemo(
    () => finalSales.reduce((sum, sale) => sum + saleGrossProfit(sale), 0),
    [finalSales, productsById, productsByName],
  );
  const grossMarginPct = netSales > 0 ? Number(((totalGrossProfit / netSales) * 100).toFixed(1)) : 0;

  const todaySalesData = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const todaySalesList = scopedFinalSales.filter(
      (sale) => String(sale.date || '').slice(0, 10) === todayKey,
    );
    return {
      amount: todaySalesList.reduce((sum, sale) => sum + toNum(sale.grandTotal || sale.totalAmount), 0),
      count: todaySalesList.length,
    };
  }, [scopedFinalSales]);

  const pendingApprovalCount = useMemo(
    () => orders.filter((o) => !o.isApproved && toKey(o.status) !== 'cancelled').length,
    [orders],
  );

  const [pendingFieldPaymentsData, setPendingFieldPaymentsData] = useState({ count: 0, total: 0 });

  useEffect(() => {
    let cancelled = false;
    const refreshPendingFieldPayments = async () => {
      const rows = await fetchDedicated<any>('/api/sync/field-payments').catch(() => null);
      if (cancelled || !rows) return;
      const pending = rows.filter((row) => toKey(row?.status) === 'pending');
      setPendingFieldPaymentsData({
        count: pending.length,
        total: pending.reduce((sum, row) => sum + toNum(row?.amount), 0),
      });
    };
    void refreshPendingFieldPayments();
    const onFocus = () => { void refreshPendingFieldPayments(); };
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const agingReferenceMs = Number.isFinite(endMs) ? endMs : Date.now();
  const createAgingBucket = () => [
    { key: '0-30', label: '0-30 days', value: 0 },
    { key: '31-60', label: '31-60 days', value: 0 },
    { key: '61-90', label: '61-90 days', value: 0 },
    { key: '90+', label: '90+ days', value: 0 },
  ];
  const ageToBucket = (days: number) => (days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3);

  const receivableAging = useMemo(() => {
    const buckets = createAgingBucket();
    scopedFinalSales.forEach((sale) => {
      const due = toNum(sale.sellDue);
      if (due <= 0) return;
      const saleMs = toMs(sale.date);
      if (!Number.isFinite(saleMs)) return;
      const ageDays = Math.max(0, Math.floor((agingReferenceMs - saleMs) / DAY_MS));
      buckets[ageToBucket(ageDays)].value += due;
    });
    return buckets.map((bucket) => ({ ...bucket, value: Number(bucket.value.toFixed(3)) }));
  }, [scopedFinalSales, agingReferenceMs]);

  const payableAging = useMemo(() => {
    const buckets = createAgingBucket();
    scopedPurchases.forEach((purchase) => {
      const due = toNum(purchase.paymentDue);
      if (due <= 0) return;
      const purchaseMs = toMs(purchase.date);
      if (!Number.isFinite(purchaseMs)) return;
      const ageDays = Math.max(0, Math.floor((agingReferenceMs - purchaseMs) / DAY_MS));
      buckets[ageToBucket(ageDays)].value += due;
    });
    return buckets.map((bucket) => ({ ...bucket, value: Number(bucket.value.toFixed(3)) }));
  }, [scopedPurchases, agingReferenceMs]);

  const mediumExpiryAlertDays = useMemo(() => {
    const parsed = Number(settings.stockExpiryAlertDays);
    if (!Number.isFinite(parsed)) return 60;
    return clamp(Math.trunc(parsed), 1, 365);
  }, [settings.stockExpiryAlertDays]);

  const inventoryRisk = useMemo(() => {
    const nowMs = Date.now();
    const soldWindowMs = nowMs - 90 * DAY_MS;
    const soldQtyByKey = new Map<string, number>();
    scopedFinalSales.forEach((sale) => {
      const saleMs = toMs(sale.date);
      if (!Number.isFinite(saleMs) || saleMs < soldWindowMs || saleMs > nowMs) return;
      (sale.items || []).forEach((item) => {
        const key = toKey(item.id || (item as { productId?: string }).productId || item.name);
        if (!key) return;
        soldQtyByKey.set(key, (soldQtyByKey.get(key) || 0) + toNum(item.qty));
      });
    });

    let outOfStock = 0;
    let belowAlert = 0;
    let nearExpiry = 0;
    let expiringIn90Days = 0;
    let expiringIn30Days = 0;
    let criticalExpiry = 0;
    let expiredStock = 0;
    let deadStock = 0;
    const reorderCandidates: Array<{ id: string; name: string; stock: number; alert: number; suggestedQty: number }> = [];

    locationProducts.forEach((product) => {
      const stock = toNum(product.stock);
      const alertQty = toNum(product.alertQuantity) || 10;
      const sold90 = toNum(soldQtyByKey.get(toKey(product.id)) || soldQtyByKey.get(toKey(product.name)));
      if (stock <= 0) outOfStock += 1;
      if (stock > 0 && stock <= alertQty) belowAlert += 1;
      if (stock > 0 && sold90 <= 0) deadStock += 1;

      const expiryMs = toMs(product.expiryDate);
      if (Number.isFinite(expiryMs) && stock > 0) {
        const daysToExpiry = Math.ceil((expiryMs - nowMs) / DAY_MS);
        if (daysToExpiry < 0) expiredStock += 1;
        if (daysToExpiry >= 0 && daysToExpiry <= 90) expiringIn90Days += 1;
        if (daysToExpiry >= 0 && daysToExpiry <= mediumExpiryAlertDays) nearExpiry += 1;
        if (daysToExpiry >= 0 && daysToExpiry <= 30) expiringIn30Days += 1;
        if (daysToExpiry >= 0 && daysToExpiry <= 7) criticalExpiry += 1;
      }

      if (stock <= alertQty) {
        reorderCandidates.push({
          id: product.id,
          name: product.name,
          stock,
          alert: alertQty,
          suggestedQty: Math.max(0, Math.ceil(alertQty * 2 - stock)),
        });
      }
    });

    reorderCandidates.sort((a, b) => a.stock / Math.max(1, a.alert) - b.stock / Math.max(1, b.alert));
    return {
      outOfStock,
      belowAlert,
      nearExpiry,
      expiringIn90Days,
      expiringIn30Days,
      criticalExpiry,
      expiredStock,
      deadStock,
      reorderCandidates: reorderCandidates.slice(0, 5),
    };
  }, [locationProducts, scopedFinalSales, mediumExpiryAlertDays]);

  const scopedOrders = useMemo(
    () =>
      orders.filter((order) => {
        if (!matchesLocation(String(order.businessLocation || ''))) return false;
        if (!isInRange(order.orderDate)) return false;
        return true;
      }),
    [orders, startMs, endMs, selectedLocationKey, locationNameById],
  );

  const pipelineStats = useMemo(() => {
    const orderCounts: Record<string, number> = {
      Pending: 0,
      Processing: 0,
      Ready: 0,
      Shipped: 0,
      Delivered: 0,
      Cancelled: 0,
    };
    scopedOrders.forEach((order) => {
      const status = String(order.status || 'Pending');
      if (orderCounts[status] === undefined) orderCounts[status] = 0;
      orderCounts[status] += 1;
    });

    const shipmentCounts: Record<string, number> = {
      Ordered: 0,
      Pending: 0,
      Packed: 0,
      Shipped: 0,
      Delivered: 0,
      Cancelled: 0,
    };
    finalSales.forEach((sale) => {
      const status = String(sale.shippingStatus || 'Pending');
      if (shipmentCounts[status] === undefined) shipmentCounts[status] = 0;
      shipmentCounts[status] += 1;
    });

    const nowMs = Date.now();
    const delayedOrders = scopedOrders.filter((order) => {
      const deliveryMs = toMs(order.deliveryDate);
      if (!Number.isFinite(deliveryMs)) return false;
      const status = toKey(order.status);
      return status !== 'delivered' && status !== 'cancelled' && deliveryMs < nowMs;
    }).length;

    const slaBreaches = finalSales.filter((sale) => {
      const status = toKey(sale.shippingStatus || 'pending');
      if (status === 'delivered' || status === 'cancelled') return false;
      const saleMs = toMs(sale.date);
      if (!Number.isFinite(saleMs)) return false;
      return nowMs - saleMs > 3 * DAY_MS;
    }).length;

    return {
      orderCounts,
      shipmentCounts,
      delayedOrders,
      slaBreaches,
    };
  }, [scopedOrders, finalSales]);

  const discountLeakage = useMemo(() => {
    const discountValue = finalSales.reduce((sum, sale) => sum + toNum(sale.discountAmount), 0);
    const leakageTotal = discountValue + totalSellReturn;
    const leakageRate = totalSales > 0 ? (leakageTotal / totalSales) * 100 : 0;
    const marginImpact = totalSales > 0 ? (leakageTotal / totalSales) * 100 : 0;
    return {
      discountValue,
      leakageTotal,
      leakageRate: Number(leakageRate.toFixed(1)),
      marginImpact: Number(marginImpact.toFixed(1)),
    };
  }, [finalSales, totalSellReturn, totalSales]);

  const leakageTrend = useMemo(() => {
    const todayDate = new Date();
    const months: Array<{ key: string; label: string; value: number }> = [];
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date(todayDate.getFullYear(), todayDate.getMonth() - i, 1);
      months.push({
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: MONTH_SHORT_LABELS[date.getMonth()],
        value: 0,
      });
    }
    const indexByKey = new Map(months.map((row, index) => [row.key, index]));

    scopedFinalSales.forEach((sale) => {
      const ms = toMs(sale.date);
      if (!Number.isFinite(ms)) return;
      const date = new Date(ms);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const idx = indexByKey.get(key);
      if (idx === undefined) return;
      months[idx].value += toNum(sale.discountAmount);
    });
    scopedSellReturns.forEach((ret) => {
      const ms = toMs(ret.date);
      if (!Number.isFinite(ms)) return;
      const date = new Date(ms);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const idx = indexByKey.get(key);
      if (idx === undefined) return;
      months[idx].value += toNum(ret.total);
    });

    return months.map((row) => ({ ...row, value: Number(row.value.toFixed(3)) }));
  }, [scopedFinalSales, scopedSellReturns]);

  const productIntelligence = useMemo(() => {
    type Perf = {
      id: string;
      name: string;
      qty: number;
      revenue: number;
      cost: number;
      profit: number;
      marginPct: number;
    };
    const perfMap = new Map<string, Perf>();

    finalSales.forEach((sale) => {
      (sale.items || []).forEach((item) => {
        const product = resolveProduct(item as { id?: string; name?: string; productId?: string });
        const id = String(product?.id || item.id || (item as { productId?: string }).productId || item.name || '');
        if (!id) return;
        const name = String(product?.name || item.name || id);
        const qty = toNum(item.qty);
        const revenue = lineRevenue(item);
        const cost = toNum(product?.unitPurchasePrice) * qty;
        const current = perfMap.get(id) || {
          id,
          name,
          qty: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
          marginPct: 0,
        };
        current.qty += qty;
        current.revenue += revenue;
        current.cost += cost;
        current.profit += revenue - cost;
        perfMap.set(id, current);
      });
    });

    const perfRows = Array.from(perfMap.values()).map((row) => ({
      ...row,
      marginPct: row.revenue > 0 ? Number(((row.profit / row.revenue) * 100).toFixed(1)) : 0,
      revenue: Number(row.revenue.toFixed(3)),
      profit: Number(row.profit.toFixed(3)),
    }));

    const topGross = [...perfRows].sort((a, b) => b.profit - a.profit).slice(0, 5);
    const erosion = [...perfRows]
      .filter((row) => row.revenue > 0)
      .sort((a, b) => a.marginPct - b.marginPct)
      .slice(0, 5);

    const nowMs = Date.now();
    const currentWindowStart = nowMs - 30 * DAY_MS;
    const previousWindowStart = nowMs - 60 * DAY_MS;
    const currentQty = new Map<string, number>();
    const previousQty = new Map<string, number>();

    scopedFinalSales.forEach((sale) => {
      const saleMs = toMs(sale.date);
      if (!Number.isFinite(saleMs)) return;
      const target = saleMs >= currentWindowStart ? currentQty : saleMs >= previousWindowStart ? previousQty : null;
      if (!target) return;
      (sale.items || []).forEach((item) => {
        const product = resolveProduct(item as { id?: string; name?: string; productId?: string });
        const key = String(product?.id || item.id || (item as { productId?: string }).productId || item.name || '');
        if (!key) return;
        target.set(key, (target.get(key) || 0) + toNum(item.qty));
      });
    });

    const growth = Array.from(new Set([...currentQty.keys(), ...previousQty.keys()]))
      .map((key) => {
        const curr = toNum(currentQty.get(key));
        const prev = toNum(previousQty.get(key));
        const product = productsById.get(toKey(key)) || productsByName.get(toKey(key));
        const name = String(product?.name || key);
        const pct = prev > 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0;
        return {
          id: key,
          name,
          currentQty: curr,
          previousQty: prev,
          growthPct: Number(pct.toFixed(1)),
        };
      })
      .filter((row) => row.currentQty > 0 || row.previousQty > 0)
      .sort((a, b) => b.growthPct - a.growthPct)
      .slice(0, 5);

    return { topGross, erosion, growth };
  }, [finalSales, scopedFinalSales, productsById, productsByName]);

  const taxCockpit = useMemo(() => {
    const saleTax = finalSales.reduce((sum, sale) => {
      const lineTax = (sale.items || []).reduce((lineSum, item) => lineSum + toNum(item.tax), 0);
      const orderTax = toNum((sale as { orderTax?: unknown }).orderTax) || toNum(sale.tax);
      return sum + (lineTax > 0 ? lineTax : orderTax);
    }, 0);
    const purchaseTax = filteredPurchases.reduce(
      (sum, purchase) => sum + toNum((purchase as { purchaseTaxAmount?: unknown }).purchaseTaxAmount),
      0,
    );
    const expenseTax = filteredExpenses.reduce((sum, expense) => sum + toNum(expense.tax), 0);
    const taxPaid = purchaseTax + expenseTax;
    const taxPayable = saleTax - taxPaid;

    const ref = Number.isFinite(endMs) ? new Date(endMs) : new Date();
    const dueDate = new Date(ref.getFullYear(), ref.getMonth() + 1, 15);
    const daysToDue = Math.ceil((dueDate.getTime() - Date.now()) / DAY_MS);

    return {
      collected: Number(saleTax.toFixed(3)),
      paid: Number(taxPaid.toFixed(3)),
      payable: Number(taxPayable.toFixed(3)),
      dueDate: dueDate.toISOString().slice(0, 10),
      daysToDue,
    };
  }, [finalSales, filteredPurchases, filteredExpenses, endMs]);

  const collectionsFocus = useMemo(() => {
    const customerById = new Map<string, (typeof customers)[number]>(
      customers.map((customer) => [String(customer.id), customer]),
    );
    const aggregate = new Map<
      string,
      { customerId: string; customerName: string; phone: string; due: number; oldestDays: number }
    >();

    scopedFinalSales.forEach((sale) => {
      const due = toNum(sale.sellDue);
      if (due <= 0) return;
      const saleMs = toMs(sale.date);
      const ageDays = Number.isFinite(saleMs) ? Math.max(0, Math.floor((agingReferenceMs - saleMs) / DAY_MS)) : 0;
      if (ageDays <= 30) return;

      const customerId = String(sale.customerId || '');
      const customer = customerById.get(customerId);
      const key = customerId || toKey(sale.customerName || 'walk-in');
      const current = aggregate.get(key) || {
        customerId,
        customerName: String(sale.customerName || customer?.businessName || customer?.name || 'Walk-in'),
        phone: String(customer?.mobile || customer?.phone || sale.contactNumber || ''),
        due: 0,
        oldestDays: 0,
      };
      current.due += due;
      current.oldestDays = Math.max(current.oldestDays, ageDays);
      aggregate.set(key, current);
    });

    return Array.from(aggregate.values())
      .map((row) => ({ ...row, due: Number(row.due.toFixed(3)) }))
      .sort((a, b) => b.due - a.due)
      .slice(0, 8);
  }, [scopedFinalSales, customers, agingReferenceMs]);

  const actionQueue = useMemo(() => {
    const overdueInvoices = scopedFinalSales.filter((sale) => {
      const due = toNum(sale.sellDue);
      if (due <= 0) return false;
      const saleMs = toMs(sale.date);
      if (!Number.isFinite(saleMs)) return false;
      const ageDays = Math.max(0, Math.floor((agingReferenceMs - saleMs) / DAY_MS));
      return ageDays > 30 || toKey(sale.paymentStatus) === 'overdue';
    }).length;
    const pendingShipments = finalSales.filter((sale) => {
      const status = toKey(sale.shippingStatus || 'pending');
      return status !== 'delivered' && status !== 'cancelled';
    }).length;
    const failedShipments = finalSales.filter((sale) => toKey(sale.shippingStatus) === 'cancelled').length;
    const unpaidExpenses = filteredExpenses.filter((expense) => toNum(expense.paymentDue) > 0).length;

    const queue = [
      { id: 'pending-approvals', label: 'Orders waiting for approval', count: pendingApprovalCount, severity: 4, page: 'list-orders' },
      { id: 'pending-field-payments', label: 'Field payments to confirm', count: pendingFieldPaymentsData.count, severity: 4, page: 'field-payments' },
      { id: 'overdue-invoices', label: 'Overdue invoices', count: overdueInvoices, severity: 4, page: 'sales' },
      { id: 'low-stock', label: 'Items running low on stock', count: lowStockCount, severity: 3, page: 'report-stock' },
      { id: 'expired-stock', label: 'Expired stock on hand', count: inventoryRisk.expiredStock, severity: 4, page: 'report-stock-expiry' },
      { id: 'critical-expiry', label: 'Items expiring in 7 days', count: inventoryRisk.criticalExpiry, severity: 4, page: 'report-stock-expiry' },
      { id: 'near-expiry', label: `Items expiring in ${mediumExpiryAlertDays} days`, count: inventoryRisk.nearExpiry, severity: 3, page: 'report-stock-expiry' },
      { id: 'pending-shipments', label: 'Deliveries not yet completed', count: pendingShipments, severity: 2, page: 'shipments' },
      { id: 'failed-shipments', label: 'Cancelled deliveries', count: failedShipments, severity: 3, page: 'shipments' },
      { id: 'expense-due', label: 'Expense bills due', count: unpaidExpenses, severity: 2, page: 'report-expense' },
    ];

    return queue
      .filter((row) => row.count > 0)
      .sort((a, b) => b.severity - a.severity || b.count - a.count)
      .slice(0, 8);
  }, [
    scopedFinalSales,
    finalSales,
    lowStockCount,
    inventoryRisk.nearExpiry,
    inventoryRisk.criticalExpiry,
    inventoryRisk.expiredStock,
    filteredExpenses,
    agingReferenceMs,
    pendingApprovalCount,
    pendingFieldPaymentsData,
    mediumExpiryAlertDays,
  ]);

  const presetVisibility = useMemo(() => {
    const allVisible = {
      period: true,
      cash: true,
      aging: true,
      inventory: true,
      pipeline: true,
      leakage: true,
      product: true,
      tax: true,
      collections: true,
      queue: true,
    };
    if (dashboardPreset === 'All' || dashboardPreset === 'Admin') return allVisible;
    if (dashboardPreset === 'Cashier') {
      return {
        period: true,
        cash: true,
        aging: false,
        inventory: false,
        pipeline: true,
        leakage: true,
        product: false,
        tax: false,
        collections: true,
        queue: true,
      };
    }
    if (dashboardPreset === 'Warehouse') {
      return {
        period: false,
        cash: false,
        aging: false,
        inventory: true,
        pipeline: true,
        leakage: false,
        product: true,
        tax: false,
        collections: false,
        queue: true,
      };
    }
    if (dashboardPreset === 'Accountant') {
      return {
        period: true,
        cash: true,
        aging: true,
        inventory: false,
        pipeline: true,
        leakage: true,
        product: false,
        tax: true,
        collections: true,
        queue: true,
      };
    }
    return {
      period: true,
      cash: true,
      aging: true,
      inventory: true,
      pipeline: true,
      leakage: true,
      product: true,
      tax: false,
      collections: true,
      queue: true,
    };
  }, [dashboardPreset]);

  const dialCustomer = (phone: string) => {
    const clean = String(phone || '').trim();
    if (!clean) return;
    window.open(`tel:${clean}`, '_blank', 'noopener,noreferrer');
  };

  const openWhatsapp = (phone: string) => {
    const digits = String(phone || '').replace(/[^\d]/g, '');
    if (!digits) return;
    window.open(`https://wa.me/${digits}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {pendingCheques.length > 0 && (
        <div className="rounded-[2rem] bg-amber-50 border border-amber-200 p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-400 rounded-t-[2rem]" />
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-100 rounded-xl"><AlertCircle size={18} className="text-amber-700" /></div>
            <h3 className="font-black text-amber-900">Cheque Reminders</h3>
            <span className="ml-auto px-2.5 py-1 rounded-full bg-amber-200 text-amber-800 text-xs font-bold">
              {pendingCheques.length} cheque{pendingCheques.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-2">
            {pendingCheques.map(p => {
              const d = new Date(p.chequeDate!); d.setHours(0,0,0,0);
              const isToday = d.getTime() === todayMidnight.getTime();
              const isOverdue = d < todayMidnight;
              return (
                <div key={p.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-amber-100">
                  <div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold mr-2 ${isOverdue ? 'bg-rose-100 text-rose-700' : isToday ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                      {isOverdue ? 'Overdue' : isToday ? 'Due Today' : 'Due Tomorrow'}
                    </span>
                    <span className="text-sm font-bold text-slate-800">{p.contactName}</span>
                    {p.chequeNo && <span className="text-xs text-slate-500 ml-2">#{p.chequeNo}</span>}
                    {p.bankName && <span className="text-xs text-slate-500 ml-1">· {p.bankName}</span>}
                  </div>
                  <span className="font-black text-slate-900">{formatCurrency(p.amount)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md shrink-0">
            <LayoutDashboard size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Welcome, {String(currentUser?.name || currentUser?.username || 'User').split(' ')[0]}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">Your business at a glance — filter by location and date to focus on any period.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 w-full xl:w-auto">
          <div>
            <label className="text-xs font-bold text-slate-900">Business Location</label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="mt-1 w-full sm:w-56 px-4 py-2.5 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
            >
              <option value="all">All locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.name}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-900">Start Date</label>
            <div className="relative mt-1">
              <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full sm:w-40 pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-900">End Date</label>
            <div className="relative mt-1">
              <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full sm:w-40 pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-900">Dashboard Preset</label>
            <select
              value={dashboardPreset}
              onChange={(e) => setDashboardPreset(e.target.value as DashboardPreset)}
              className="mt-1 w-full sm:w-48 px-4 py-2.5 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium text-slate-700"
            >
              <option value="Admin">Admin</option>
              <option value="Cashier">Cashier</option>
              <option value="Warehouse">Warehouse</option>
              <option value="Accountant">Accountant</option>
              <option value="Sales">Sales</option>
              <option value="All">All Widgets</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
        <span className="text-xs font-bold text-slate-500 shrink-0">Saved Views:</span>
        <input
          value={viewName}
          onChange={(e) => setViewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveCurrentView(); } }}
          placeholder="Name this view..."
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs w-36"
        />
        <button type="button" onClick={saveCurrentView} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800">
          Save
        </button>
        {savedViews.length > 0 && (
          <select
            value={selectedViewId}
            onChange={(e) => applySavedView(e.target.value)}
            className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs"
          >
            <option value="">Load a saved view...</option>
            {savedViews.map((view) => (
              <option key={view.id} value={view.id}>{view.name}</option>
            ))}
          </select>
        )}
        {selectedViewId && (
          <button type="button" onClick={() => setPendingDeleteViewId(selectedViewId)} className="px-2 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
            Delete
          </button>
        )}
        <button type="button" onClick={resetToRoleDefault} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 ml-auto">
          Reset Filters
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Sales', value: totalSales, icon: ShoppingCart, tone: 'blue' },
          { label: 'Net Revenue', value: netSales, icon: Banknote, tone: 'emerald' },
          { label: 'Unpaid Invoices', value: totalInvoiceDue, icon: AlertTriangle, tone: 'orange' },
          { label: 'Sales Returns', value: totalSellReturn, icon: RefreshCw, tone: 'rose' },
          { label: 'Total Purchases', value: totalPurchase, icon: TrendingUp, tone: 'blue' },
          { label: 'Supplier Balance Due', value: totalPurchaseDue, icon: AlertCircle, tone: 'orange' },
          { label: 'Purchase Returns', value: totalPurchaseReturn, icon: RefreshCw, tone: 'rose' },
          { label: 'Expenses', value: totalExpense, icon: DollarSign, tone: 'rose' },
        ].map((card) => (
          <div key={card.label} className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.tone === 'blue' ? 'bg-blue-50 text-blue-500' : card.tone === 'emerald' ? 'bg-emerald-50 text-emerald-500' : card.tone === 'orange' ? 'bg-orange-50 text-orange-500' : 'bg-rose-50 text-rose-500'}`}>
              <card.icon size={22} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{card.label}</p>
              <h3 className="text-xl font-black text-slate-900">{formatCurrency(card.value)}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-slate-900 to-slate-700 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-start justify-between mb-4">
            <div className="bg-white/20 p-2 rounded-lg">
              <TrendingUp size={20} className="text-slate-100" />
            </div>
            <span className="text-xs font-bold bg-white/15 px-2 py-1 rounded">Net Result</span>
          </div>
          <h3 className={`text-2xl font-bold mb-1 ${netProfit >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>
            {formatCurrency(netProfit)}
          </h3>
          <p className="text-slate-200 text-sm mb-4">Net Sales - Net Purchase - Expenses</p>
          <button
            type="button"
            onClick={() => onNavigate?.('report-profit-loss')}
            className="w-full py-1.5 bg-white/20 hover:bg-white/30 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-2"
          >
            View Profit / Loss <ArrowRight size={12} />
          </button>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-5 text-white shadow-lg">
          <div className="flex items-start justify-between mb-4">
            <div className="bg-white/20 p-2 rounded-lg">
              <Zap size={20} className="text-amber-100" />
            </div>
            <span className="text-xs font-bold bg-orange-600/50 px-2 py-1 rounded">Stock Risk</span>
          </div>
          <h3 className="text-2xl font-bold mb-1">{lowStockCount} Items</h3>
          <p className="text-amber-100 text-sm mb-4">Below alert quantity for selected location.</p>
          <button
            type="button"
            onClick={() => onNavigate?.('report-stock')}
            className="w-full py-1.5 bg-white/20 hover:bg-white/30 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-2"
          >
            View Risk List <ArrowRight size={12} />
          </button>
        </div>

        <div className="bg-white rounded-[2rem] p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
          <div className="flex items-start justify-between mb-4">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <TrendingUp size={20} className="text-emerald-600" />
            </div>
            <span className="text-xs font-bold text-slate-400">Profitability</span>
          </div>
          <h3 className={`text-2xl font-bold mb-1 ${grossMarginPct >= 20 ? 'text-emerald-700' : grossMarginPct >= 10 ? 'text-amber-700' : 'text-rose-700'}`}>
            {grossMarginPct}%
          </h3>
          <p className="text-slate-700 text-sm font-semibold">Gross Margin</p>
          <p className="text-slate-400 text-xs mb-4 mt-0.5">
            {topCategory
              ? `Best seller: ${topCategory.name} (${topCategoryShare.toFixed(1)}% of sales)`
              : 'No sales data for selected period.'}
          </p>
          <button
            type="button"
            onClick={() => onNavigate?.('report-profit-loss')}
            className="text-emerald-600 text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all"
          >
            View P&L Report <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
          <h3 className="text-lg font-bold text-slate-900">Sales vs Profit (Last 6 Weeks)</h3>
          <p className="text-sm text-slate-500 mb-5">Bars show total sales; the line shows gross profit per week.</p>
          <div className="h-80 w-full">
            <SafeResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
                <Tooltip formatter={(value: number, name: string) => [formatCurrency(toNum(value)), name]} />
                <Legend />
                <Bar dataKey="sales" name="Sales" fill="#0f172a" barSize={38} radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="profit" name="Gross Profit" stroke="#dc2626" strokeWidth={3} dot={{ r: 4, fill: '#dc2626' }} />
              </ComposedChart>
            </SafeResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Sales by Category</h3>
          <p className="text-xs text-slate-500 mb-5">Share of revenue by product category</p>
          <div className="flex-1 min-h-[250px] w-full relative">
            {categoryData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg">
                No category sales in selected filters.
              </div>
            ) : (
              <SafeResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={82} paddingAngle={3} dataKey="value">
                    {categoryData.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(toNum(value))} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </SafeResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Stock Action Plan</h3>
            <p className="text-sm text-slate-500">Products prioritised by urgency — out of stock first, then low stock, then slow-movers.</p>
          </div>
          <button type="button" onClick={() => onNavigate?.('products')} className="text-sm text-blue-600 hover:text-blue-700 font-medium px-2">
            View Full Report
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-slate-500 font-medium border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4 text-center">Velocity</th>
                <th className="px-6 py-4 text-center">Stock</th>
                <th className="px-6 py-4 text-center">Daily Sales</th>
                <th className="px-6 py-4 text-center">Days Left</th>
                <th className="px-6 py-4 text-right">Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {inventoryActions.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900">{row.name}</p>
                  </td>
                  <td className="px-6 py-4 text-center">{row.velocity}</td>
                  <td className="px-6 py-4 text-center">{row.stock}</td>
                  <td className="px-6 py-4 text-center">{row.dailySales}</td>
                  <td className="px-6 py-4 text-center">{row.daysLeft === null ? '--' : `${row.daysLeft} days`}</td>
                  <td className="px-6 py-4 text-right font-semibold">{row.action}</td>
                </tr>
              ))}
              {inventoryActions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                    No products found for selected location.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-[2rem] p-4 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><ShoppingCart size={18} /></div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{todaySalesData.count} invoice{todaySalesData.count !== 1 ? 's' : ''}</span>
          </div>
          <h3 className="text-xl font-bold text-slate-900">{formatCurrency(todaySalesData.amount)}</h3>
          <p className="text-xs text-slate-500 font-medium">Today's Sales</p>
        </div>
        <div className="bg-white rounded-[2rem] p-4 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><TrendingUp size={18} /></div>
          </div>
          <h3 className={`text-xl font-bold ${grossMarginPct >= 20 ? 'text-emerald-700' : grossMarginPct >= 10 ? 'text-amber-700' : 'text-rose-700'}`}>
            {grossMarginPct}%
          </h3>
          <p className="text-xs text-slate-500 font-medium">Gross Margin (Period)</p>
        </div>
        <div className="bg-white rounded-[2rem] p-4 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
          <div className="flex justify-between items-start mb-2">
            <div className={`p-2 rounded-lg ${pendingApprovalCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}><Clock3 size={18} /></div>
          </div>
          <h3 className={`text-xl font-bold ${pendingApprovalCount > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{pendingApprovalCount}</h3>
          <p className="text-xs text-slate-500 font-medium">Orders Awaiting Approval</p>
          {pendingApprovalCount > 0 && (
            <button type="button" onClick={() => onNavigate?.('list-orders')} className="text-xs text-amber-600 font-bold mt-1 hover:underline">Review now →</button>
          )}
        </div>
        <div className="bg-white rounded-[2rem] p-4 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
          <div className="flex justify-between items-start mb-2">
            <div className={`p-2 rounded-lg ${pendingFieldPaymentsData.count > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}><Wallet size={18} /></div>
          </div>
          <h3 className={`text-xl font-bold ${pendingFieldPaymentsData.count > 0 ? 'text-rose-700' : 'text-slate-400'}`}>{pendingFieldPaymentsData.count}</h3>
          <p className="text-xs text-slate-500 font-medium">Field Payments to Confirm</p>
          {pendingFieldPaymentsData.count > 0 && (
            <p className="text-xs text-rose-600 mt-0.5 font-bold">{formatCurrency(pendingFieldPaymentsData.total)} waiting</p>
          )}
        </div>
      </div>

      {presetVisibility.period && (
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">How This Period Compares</h3>
              <p className="text-sm text-slate-500">
                {formatDateBySettings(startMs, settings.dateFormat, settings.timeZone)} – {formatDateBySettings(endMs, settings.dateFormat, settings.timeZone)} vs the previous {rangeDays}-day period.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('report-profit-loss')}
              className="px-4 py-2 rounded-lg text-sm font-bold text-slate-700 bg-slate-100 border border-slate-200"
            >
              Open Full P/L
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {periodCards.map((card) => (
              <div key={card.id} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-slate-600">
                    <card.icon size={16} />
                    <span className="text-xs font-bold uppercase">{card.label}</span>
                  </div>
                  <span className={`text-xs font-bold flex items-center gap-1 ${card.delta.favorable ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {card.delta.favorable ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {Math.abs(card.delta.pct)}%
                  </span>
                </div>
                <p className="text-lg font-black text-slate-900">{formatCurrency(card.current)}</p>
                <p className="text-xs text-slate-500">Previous: {formatCurrency(card.previous)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 h-32">
            <SafeResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={salesSparkline}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Line type="monotone" dataKey="value" stroke="#0f172a" strokeWidth={2} dot={false} />
              </LineChart>
            </SafeResponsiveContainer>
          </div>
        </div>
      )}

      {(presetVisibility.cash || presetVisibility.aging) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {presetVisibility.cash && (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
              <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Wallet size={18} className="text-emerald-600" />
                Money In & Out
              </h3>
              <p className="text-sm text-slate-500 mb-4">Payment collections and payouts recorded for the selected period.</p>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Cash In</p>
                  <p className="text-lg font-black text-emerald-700">{formatCurrency(cashIn)}</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Cash Out</p>
                  <p className="text-lg font-black text-rose-700">{formatCurrency(cashOut)}</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Net Cash</p>
                  <p className={`text-lg font-black ${netCash >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrency(netCash)}</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500">7-Day Cash Forecast</p>
                  <p className={`text-lg font-black ${projectedGap7 >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatCurrency(projectedGap7)}</p>
                </div>
              </div>
              <div className="mt-4 text-xs text-slate-500">
                Expected next 7 days: +{formatCurrency(projectedIn7)} in | −{formatCurrency(projectedOut7)} out
              </div>
            </div>
          )}

          {presetVisibility.aging && (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
              <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Clock3 size={18} className="text-amber-600" />
                What's Owed & When
              </h3>
              <p className="text-sm text-slate-500 mb-4">How long outstanding amounts have been unpaid.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-600 mb-2">Receivables</p>
                  <div className="space-y-2">
                    {receivableAging.map((bucket) => (
                      <div key={`r-${bucket.key}`} className="flex items-center justify-between text-sm border border-slate-200 rounded px-3 py-2">
                        <span>{bucket.label}</span>
                        <span className="font-bold">{formatCurrency(bucket.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-600 mb-2">Payables</p>
                  <div className="space-y-2">
                    {payableAging.map((bucket) => (
                      <div key={`p-${bucket.key}`} className="flex items-center justify-between text-sm border border-slate-200 rounded px-3 py-2">
                        <span>{bucket.label}</span>
                        <span className="font-bold">{formatCurrency(bucket.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {(presetVisibility.inventory || presetVisibility.pipeline) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {presetVisibility.inventory && (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
              <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Package size={18} className="text-blue-600" />
                Stock Alerts
              </h3>
              <p className="text-sm text-slate-500 mb-4">Products that need restocking, are expiring, or have stopped selling.</p>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
                <div className="border border-slate-200 rounded-lg p-3"><p className="text-xs text-slate-500">Out of Stock</p><p className="text-xl font-black text-rose-700">{inventoryRisk.outOfStock}</p></div>
                <div className="border border-slate-200 rounded-lg p-3"><p className="text-xs text-slate-500">Below Alert</p><p className="text-xl font-black text-amber-700">{inventoryRisk.belowAlert}</p></div>
                <div className="border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Expiring (≤{mediumExpiryAlertDays} days)</p>
                  <p className="text-xl font-black text-orange-700">{inventoryRisk.nearExpiry}</p>
                  <p className="text-[10px] text-slate-500 mt-1">≤90d: {inventoryRisk.expiringIn90Days} · ≤30d: {inventoryRisk.expiringIn30Days} · ≤7d: {inventoryRisk.criticalExpiry}</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Not Sold (90 Days)</p>
                  <p className="text-xl font-black text-slate-700">{inventoryRisk.deadStock}</p>
                  <p className="text-[10px] text-rose-600 mt-1">Expired on hand: {inventoryRisk.expiredStock}</p>
                </div>
              </div>
              <p className="text-xs font-bold text-slate-600 mb-2">Suggested Items to Reorder</p>
              <div className="space-y-2">
                {inventoryRisk.reorderCandidates.map((row) => (
                  <div key={row.id} className="flex items-center justify-between border border-slate-200 rounded px-3 py-2 text-sm">
                    <span className="truncate pr-2">{row.name}</span>
                    <span className="font-bold">Stock {row.stock} / Alert {row.alert} / Suggest {row.suggestedQty}</span>
                  </div>
                ))}
                {inventoryRisk.reorderCandidates.length === 0 && (
                  <div className="text-sm text-slate-500 border border-dashed border-slate-200 rounded px-3 py-3">No reorder suggestions in current location.</div>
                )}
              </div>
            </div>
          )}

          {presetVisibility.pipeline && (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
              <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Truck size={18} className="text-indigo-600" />
                Orders & Deliveries
              </h3>
              <p className="text-sm text-slate-500 mb-4">Current status of all orders and delivery progress.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                {Object.entries(pipelineStats.orderCounts).map(([status, count]) => (
                  <div key={status} className="border border-slate-200 rounded-lg p-3">
                    <p className="text-xs text-slate-500">{status}</p>
                    <p className="text-lg font-black text-slate-800">{count}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
                <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                  <p className="text-xs text-amber-700">Delayed Orders</p>
                  <p className="text-xl font-black text-amber-800">{pipelineStats.delayedOrders}</p>
                </div>
                <div className="border border-rose-200 bg-rose-50 rounded-lg p-3">
                  <p className="text-xs text-rose-700">Late Deliveries</p>
                  <p className="text-xl font-black text-rose-800">{pipelineStats.slaBreaches}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.('shipments')}
                className="mt-4 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold"
              >
                Open Shipments
              </button>
            </div>
          )}
        </div>
      )}

      {(presetVisibility.leakage || presetVisibility.product) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {presetVisibility.leakage && (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
              <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Percent size={18} className="text-rose-600" />
                Returns & Discounts
              </h3>
              <p className="text-sm text-slate-500 mb-4">Revenue given back through returns and discounts.</p>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
                <div className="border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Discount Value</p>
                  <p className="text-lg font-black text-slate-800">{formatCurrency(discountLeakage.discountValue)}</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Total Revenue Lost</p>
                  <p className="text-lg font-black text-rose-700">{formatCurrency(discountLeakage.leakageTotal)}</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500">% of Revenue Lost</p>
                  <p className="text-lg font-black text-rose-700">{discountLeakage.leakageRate}%</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Active Customers</p>
                  <p className="text-lg font-black text-slate-800">{activeCustomers}</p>
                </div>
              </div>
              <div className="h-32">
                <SafeResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={leakageTrend}>
                    <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis hide />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </SafeResponsiveContainer>
              </div>
            </div>
          )}

          {presetVisibility.product && (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
              <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Factory size={18} className="text-blue-600" />
                Product Performance
              </h3>
              <p className="text-sm text-slate-500 mb-4">Your top earners, fastest-growing, and lowest-margin products.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-600 mb-2">Top Profit Earners</p>
                  <div className="space-y-2">
                    {productIntelligence.topGross.map((row) => (
                      <div key={`gp-${row.id}`} className="border border-slate-200 rounded px-3 py-2 text-xs">
                        <p className="font-semibold truncate">{row.name}</p>
                        <p className="text-emerald-700 font-bold">{formatCurrency(row.profit)}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-600 mb-2">Growing Fast (Last 30 Days)</p>
                  <div className="space-y-2">
                    {productIntelligence.growth.map((row) => (
                      <div key={`gr-${row.id}`} className="border border-slate-200 rounded px-3 py-2 text-xs">
                        <p className="font-semibold truncate">{row.name}</p>
                        <p className={`font-bold ${row.growthPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{row.growthPct}%</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-600 mb-2">Lowest Margin Products</p>
                  <div className="space-y-2">
                    {productIntelligence.erosion.map((row) => (
                      <div key={`er-${row.id}`} className="border border-slate-200 rounded px-3 py-2 text-xs">
                        <p className="font-semibold truncate">{row.name}</p>
                        <p className="text-rose-700 font-bold">{row.marginPct}% margin</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {(presetVisibility.tax || presetVisibility.collections || presetVisibility.queue) && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {presetVisibility.tax && (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
              <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <ClipboardList size={18} className="text-indigo-600" />
                VAT Summary
              </h3>
              <p className="text-sm text-slate-500 mb-4">VAT collected from sales vs paid on purchases, with filing reminder.</p>
              <div className="space-y-3">
                <div className="flex justify-between text-sm"><span>Tax Collected</span><span className="font-bold">{formatCurrency(taxCockpit.collected)}</span></div>
                <div className="flex justify-between text-sm"><span>Tax Paid</span><span className="font-bold">{formatCurrency(taxCockpit.paid)}</span></div>
                <div className="flex justify-between text-sm border-t border-slate-200 pt-2"><span>Net VAT to Pay</span><span className={`font-bold ${taxCockpit.payable >= 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatCurrency(taxCockpit.payable)}</span></div>
              </div>
              <div className={`mt-4 border rounded-lg px-3 py-2 text-xs ${taxCockpit.daysToDue <= 7 ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                Filing due: {taxCockpit.dueDate} — {taxCockpit.daysToDue >= 0 ? `${taxCockpit.daysToDue} days remaining` : `${Math.abs(taxCockpit.daysToDue)} days overdue`}
              </div>
            </div>
          )}

          {presetVisibility.collections && (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
              <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Users size={18} className="text-emerald-600" />
                Overdue Customers
              </h3>
              <p className="text-sm text-slate-500 mb-4">Customers with payments overdue — tap to call, message, or record payment.</p>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {collectionsFocus.map((row) => (
                  <div key={`${row.customerId}-${row.customerName}`} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm text-slate-800">{row.customerName}</p>
                        <p className="text-xs text-slate-500">Oldest due: {row.oldestDays} days</p>
                      </div>
                      <p className="text-sm font-black text-rose-700">{formatCurrency(row.due)}</p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button type="button" onClick={() => dialCustomer(row.phone)} className="text-xs px-2 py-1.5 rounded border border-slate-200 flex items-center justify-center gap-1"><Phone size={12} />Call</button>
                      <button type="button" onClick={() => openWhatsapp(row.phone)} className="text-xs px-2 py-1.5 rounded border border-slate-200 flex items-center justify-center gap-1"><MessageCircle size={12} />WA</button>
                      <button type="button" onClick={() => onNavigate?.('new-payment')} className="text-xs px-2 py-1.5 rounded border border-slate-200 flex items-center justify-center gap-1"><CreditCard size={12} />Pay</button>
                      <button
                        type="button"
                        onClick={() => onNavigate?.(row.customerId ? `view-customer/${row.customerId}` : 'customers')}
                        className="text-xs px-2 py-1.5 rounded border border-slate-200 flex items-center justify-center gap-1"
                      >
                        <ClipboardList size={12} />
                        Ledger
                      </button>
                    </div>
                  </div>
                ))}
                {collectionsFocus.length === 0 && (
                  <div className="text-sm text-slate-500 border border-dashed border-slate-200 rounded p-3">No overdue customers in selected location.</div>
                )}
              </div>
            </div>
          )}

          {presetVisibility.queue && (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
              <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-blue-600" />
                Needs Attention Now
              </h3>
              <p className="text-sm text-slate-500 mb-4">Items requiring action. Red = urgent, amber = important, blue = monitor.</p>
              <div className="space-y-2">
                {actionQueue.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => onNavigate?.(row.page)}
                    className={`w-full text-left border rounded-lg px-3 py-2 hover:opacity-90 transition-opacity ${
                      row.severity >= 4
                        ? 'border-rose-200 bg-rose-50'
                        : row.severity === 3
                          ? 'border-amber-200 bg-amber-50'
                          : 'border-blue-100 bg-blue-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${
                        row.severity >= 4 ? 'text-rose-800' : row.severity === 3 ? 'text-amber-800' : 'text-blue-800'
                      }`}>{row.label}</span>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                        row.severity >= 4
                          ? 'bg-rose-200 text-rose-900'
                          : row.severity === 3
                            ? 'bg-amber-200 text-amber-900'
                            : 'bg-blue-200 text-blue-900'
                      }`}>{row.count}</span>
                    </div>
                  </button>
                ))}
                {actionQueue.length === 0 && (
                  <div className="text-sm text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-lg px-3 py-2">
                    Everything is up to date. Nothing needs attention right now.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showChequePopup && pendingCheques.length > 0 && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 to-orange-400" />
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-amber-100 rounded-2xl"><Bell size={22} className="text-amber-700" /></div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Cheque Reminders</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Cheques due soon — don't miss the deposit</p>
                </div>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {pendingCheques.map(p => {
                  const d = new Date(p.chequeDate!); d.setHours(0,0,0,0);
                  const isToday = d.getTime() === todayMidnight.getTime();
                  const isOverdue = d < todayMidnight;
                  return (
                    <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100">
                      <div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold mr-2 ${isOverdue ? 'bg-rose-100 text-rose-700' : isToday ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                          {isOverdue ? 'Overdue' : isToday ? 'Due Today' : 'Due Tomorrow'}
                        </span>
                        <span className="text-sm font-bold text-slate-800">{p.contactName}</span>
                        {p.chequeNo && <span className="text-xs text-slate-500 ml-2">#{p.chequeNo}</span>}
                        {p.bankName && <span className="text-xs text-slate-500 ml-1">· {p.bankName}</span>}
                      </div>
                      <span className="font-black text-slate-900 text-sm">{formatCurrency(p.amount)}</span>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={dismissChequePopup}
                className="mt-5 w-full py-3 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-700 transition"
              >
                Dismiss for today
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <ConfirmDialog
        isOpen={!!pendingDeleteViewId}
        title="Delete Saved View"
        message="Are you sure you want to delete this saved dashboard view?"
        confirmLabel="Delete"
        tone="danger"
        onCancel={() => setPendingDeleteViewId('')}
        onConfirm={() => {
          if (pendingDeleteViewId) deleteSavedView(pendingDeleteViewId);
          setPendingDeleteViewId('');
        }}
      />
    </div>
  );
};

export default Dashboard;
