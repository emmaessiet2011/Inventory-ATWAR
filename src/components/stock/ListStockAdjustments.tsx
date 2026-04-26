import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, FileText, FileSpreadsheet, Printer,
  Columns, ChevronDown, Filter, ArrowUpDown, Eye, Edit, Trash2, X, SlidersHorizontal, CheckCircle2} from 'lucide-react';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import MultiSelect from '@/components/shared/MultiSelect';
import { useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import { printDocument, statusBadge } from '@/utils/printUtils';
import { formatDateBySettings, formatDateTimeBySettings } from '@/utils/dateTime';
import {
  appendStockLedgerEntries,
  bootstrapStockTransfersFromDB,
  makeNextStockTransferRef,
  readStockTransfers,
  simulateStockTransfer,
  writeStockTransfers,
} from '@/utils/stockTransfers';
import { applyStockLotAdjustments, StockLotAdjustment } from '@/utils/stockLots';
import {
  bootstrapStockAdjustmentsFromDB,
  normalizeStockAdjustmentDamageDisposition,
  StockAdjustmentRecord,
  normalizeStockAdjustmentStatus,
  readStockAdjustments,
  simulateStockAdjustment,
  writeStockAdjustments,
} from '@/utils/stockAdjustments';
import { deleteDedicatedStrict } from '@/utils/apiClient';

interface ListStockAdjustmentsProps {
  onNavigate: (page: string) => void;
  canAdd?: boolean;
  canEdit?: boolean;
  canApprove?: boolean;
  canManage?: boolean;
  canDelete?: boolean;
  restrictToAddedById?: string;
  restrictToAddedByName?: string;
}

interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

type ColumnKey =
  | 'date'
  | 'referenceNo'
  | 'location'
  | 'adjustmentType'
  | 'status'
  | 'totalAmount'
  | 'totalRecovered'
  | 'reason'
  | 'addedBy';

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const round3 = (value: number) => Math.round(value * 1000) / 1000;
const toIsoDate = (value: string) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
};
const buildExpenseRefNo = (prefix: string) =>
  `${String(prefix || 'EP').trim() || 'EP'}${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;
const isAdjustmentOwnerMatch = (
  adjustment: StockAdjustmentRecord,
  ownerIdFilter: string,
  ownerNameFilter: string,
) => {
  if (!ownerIdFilter && !ownerNameFilter) return true;
  const adjustmentOwnerId = normalize(adjustment.addedById);
  const adjustmentOwnerName = normalize(adjustment.addedBy);
  if (ownerIdFilter && ownerNameFilter) {
    return adjustmentOwnerId === ownerIdFilter && adjustmentOwnerName === ownerNameFilter;
  }
  if (ownerIdFilter) return adjustmentOwnerId === ownerIdFilter;
  if (ownerNameFilter) return adjustmentOwnerName === ownerNameFilter;
  return false;
};
const getCurrentYearRange = (): DateRangeValue => {
  const now = new Date();
  return {
    startDate: new Date(now.getFullYear(), 0, 1),
    endDate: new Date(now.getFullYear(), 11, 31),
    label: 'This Year',
  };
};
const sortAdjustments = (rows: StockAdjustmentRecord[]) =>
  [...rows].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

const ListStockAdjustments: React.FC<ListStockAdjustmentsProps> = ({
  onNavigate,
  canAdd,
  canEdit,
  canApprove = false,
  canManage = true,
  canDelete,
  restrictToAddedById = '',
  restrictToAddedByName = '',
}) => {
  const {
    locations,
    products,
    setProducts,
    currentUser,
    formatCurrency,
    addActivityLog,
    addExpense,
    deleteExpense,
    generateId,
    settings,
  } = useGlobalContext();
  const { addNotification } = useNotifications();
  const formatDateDisplay = (value?: string) =>
    formatDateBySettings(value || '', settings.dateFormat, settings.timeZone);
  const formatDateTimeDisplay = (value?: string) =>
    formatDateTimeBySettings(value || '', settings.dateFormat, settings.timeFormat, settings.timeZone);

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [adjustments, setAdjustments] = useState<StockAdjustmentRecord[]>([]);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [viewAdjustmentId, setViewAdjustmentId] = useState<string | null>(null);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [range, setRange] = useState<DateRangeValue>(getCurrentYearRange);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void} | null>(null);
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
    date: true,
    referenceNo: true,
    location: true,
    adjustmentType: true,
    status: true,
    totalAmount: true,
    totalRecovered: true,
    reason: true,
    addedBy: true,
  });

  const [filters, setFilters] = useState({
    location: [] as string[],
    adjustmentType: [] as string[],
    status: [] as string[],
    user: [] as string[],
  });

  const resolvedCanAdd = canAdd ?? canManage;
  const resolvedCanEdit = canEdit ?? canManage;
  const resolvedCanApprove = canApprove;
  const resolvedCanDelete = canDelete ?? resolvedCanEdit;
  const ownerIdFilter = normalize(restrictToAddedById);
  const ownerNameFilter = normalize(restrictToAddedByName);

  useEffect(() => {
    let isMounted = true;
    const refreshFromDB = async () => {
      await bootstrapStockAdjustmentsFromDB().catch(() => {});
      if (isMounted) setAdjustments(readStockAdjustments());
    };
    void refreshFromDB();
    const onFocus = () => { void refreshFromDB(); };
    const onUpdated = () => { void refreshFromDB(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('app:stock-adjustments-updated', onUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('app:stock-adjustments-updated', onUpdated);
    };
  }, []);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      const withinActionMenu = event.target.closest('[data-adjustment-action-menu]');
      const withinActionButton = event.target.closest('[data-adjustment-action-button]');
      const withinColumnMenu = event.target.closest('[data-adjustment-column-menu]');
      const withinColumnButton = event.target.closest('[data-adjustment-column-button]');

      if (!withinActionMenu && !withinActionButton) {
        setActiveActionId(null);
      }
      if (!withinColumnMenu && !withinColumnButton) {
        setShowColumnMenu(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setActiveActionId(null);
      setShowColumnMenu(false);
      setViewAdjustmentId(null);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const visibleAdjustments = useMemo(() => {
    const query = normalize(searchTerm);
    const startMs = range.startDate ? new Date(range.startDate.getFullYear(), range.startDate.getMonth(), range.startDate.getDate(), 0, 0, 0, 0).getTime() : null;
    const endMs = range.endDate ? new Date(range.endDate.getFullYear(), range.endDate.getMonth(), range.endDate.getDate(), 23, 59, 59, 999).getTime() : null;

    return adjustments
      .filter((adjustment) => {
        if (!isAdjustmentOwnerMatch(adjustment, ownerIdFilter, ownerNameFilter)) return false;
        if (query) {
          const itemNames = (adjustment.items || []).map((item) => item.productName).join(' ');
          const haystack = [
            adjustment.referenceNo,
            adjustment.location,
            adjustment.adjustmentType,
            adjustment.status,
            adjustment.damageDisposition,
            adjustment.damageSellableLocation,
            adjustment.reason,
            adjustment.addedBy,
            itemNames,
          ].map(normalize);
          if (!haystack.some((value) => value.includes(query))) return false;
        }
        if (filters.location.length > 0 && !filters.location.includes(adjustment.location)) return false;
        if (filters.adjustmentType.length > 0 && !filters.adjustmentType.includes(adjustment.adjustmentType)) return false;
        if (filters.status.length > 0 && !filters.status.includes(normalizeStockAdjustmentStatus(adjustment.status))) return false;
        if (filters.user.length > 0 && !filters.user.includes(adjustment.addedBy)) return false;
        if (startMs != null || endMs != null) {
          const adjustmentMs = Date.parse(adjustment.date);
          if (!Number.isFinite(adjustmentMs)) return false;
          if (startMs != null && adjustmentMs < startMs) return false;
          if (endMs != null && adjustmentMs > endMs) return false;
        }
        return true;
      })
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }, [adjustments, searchTerm, filters, range, ownerIdFilter, ownerNameFilter]);

  const viewAdjustment = useMemo(
    () => adjustments.find((item) => item.id === viewAdjustmentId),
    [adjustments, viewAdjustmentId],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, range, entriesPerPage, ownerIdFilter, ownerNameFilter]);

  const totalEntries = visibleAdjustments.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / entriesPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * entriesPerPage;
  const paginatedAdjustments = visibleAdjustments.slice(pageStartIndex, pageStartIndex + entriesPerPage);
  const pageStartEntry = totalEntries === 0 ? 0 : pageStartIndex + 1;
  const pageEndEntry = totalEntries === 0 ? 0 : pageStartIndex + paginatedAdjustments.length;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const filteredForUserOptions = useMemo(
    () => adjustments.filter((item) => isAdjustmentOwnerMatch(item, ownerIdFilter, ownerNameFilter)),
    [adjustments, ownerIdFilter, ownerNameFilter],
  );

  const userOptions = useMemo(
    () => Array.from(new Set(filteredForUserOptions.map((item) => item.addedBy).filter(Boolean))).sort(),
    [filteredForUserOptions],
  );

  const toggleColumn = (column: ColumnKey) => {
    setVisibleColumns((prev) => ({ ...prev, [column]: !prev[column] }));
  };

  const exportCsv = () => {
    const headers = [
      'Date', 'Reference No', 'Location', 'Type', 'Status',
      'Total Amount', 'Recovered', 'Reason', 'Added By',
    ];
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = visibleAdjustments.map((adjustment) => [
      escape(adjustment.date),
      escape(adjustment.referenceNo),
      escape(adjustment.location),
      escape(adjustment.adjustmentType),
      escape(normalizeStockAdjustmentStatus(adjustment.status)),
      escape(Number(adjustment.totalAmount || 0).toFixed(3)),
      escape(Number(adjustment.totalRecovered || 0).toFixed(3)),
      escape(adjustment.reason || ''),
      escape(adjustment.addedBy || ''),
    ].join(','));
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock-adjustments.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const headers = [
      'Date', 'Reference No', 'Location', 'Type', 'Status',
      'Total Amount', 'Recovered', 'Reason', 'Added By',
    ];
    const lines = visibleAdjustments.map((adjustment) => [
      adjustment.date,
      adjustment.referenceNo,
      adjustment.location,
      adjustment.adjustmentType,
      normalizeStockAdjustmentStatus(adjustment.status),
      Number(adjustment.totalAmount || 0).toFixed(3),
      Number(adjustment.totalRecovered || 0).toFixed(3),
      adjustment.reason || '',
      adjustment.addedBy || '',
    ].join('\t'));
    const tsv = [headers.join('\t'), ...lines].join('\n');
    const blob = new Blob([tsv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock-adjustments.xls';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const totalAmount = visibleAdjustments.reduce((sum, a) => sum + Number(a.totalAmount || 0), 0);
    const totalRecovered = visibleAdjustments.reduce((sum, a) => sum + Number(a.totalRecovered || 0), 0);
    const pendingCount = visibleAdjustments.filter((a) => normalizeStockAdjustmentStatus(a.status) === 'Pending').length;
    const approvedCount = visibleAdjustments.filter((a) => normalizeStockAdjustmentStatus(a.status) === 'Approved').length;
    printDocument({
      title: 'Stock Adjustments',
      subtitle: range?.label ? `Period: ${range.label}` : undefined,
      businessName: settings?.businessName || 'ATWAR AL MUSTAQBAL',
      businessAddress: settings?.address || '',
      printedBy: currentUser?.name || '',
      columns: [
        { label: 'Date', width: '80px' },
        { label: 'Reference No', width: '100px' },
        { label: 'Location' },
        { label: 'Type', width: '100px' },
        { label: 'Status', width: '80px' },
        { label: 'Total Amount', align: 'right', width: '90px' },
        { label: 'Recovered', align: 'right', width: '90px' },
        { label: 'Reason' },
        { label: 'Added By', width: '80px' },
      ],
      rows: visibleAdjustments.map(a => [
        formatDateDisplay(a.date),
        a.referenceNo,
        a.location,
        statusBadge(a.adjustmentType),
        statusBadge(normalizeStockAdjustmentStatus(a.status)),
        formatCurrency(Number(a.totalAmount || 0)),
        formatCurrency(Number(a.totalRecovered || 0)),
        a.reason || '--',
        a.addedBy || '--',
      ]),
      stats: [
        { label: 'Total Adjustments', value: String(visibleAdjustments.length), color: 'blue' },
        { label: 'Pending', value: String(pendingCount), color: 'amber' },
        { label: 'Approved', value: String(approvedCount), color: 'green' },
        { label: 'Total Amount', value: formatCurrency(totalAmount), color: 'amber' },
        { label: 'Total Recovered', value: formatCurrency(totalRecovered), color: 'green' },
      ],
      totalRow: ['TOTAL', '', '', '', '',
        formatCurrency(totalAmount),
        formatCurrency(totalRecovered),
        '', ''],
    });
  };

  const findProductBySkuLocation = (rows: typeof products, sku: string, locationName: string) => (
    rows.find((product) => (
      normalize(product.sku) === normalize(sku)
      && normalize(product.businessLocation) === normalize(locationName)
    ))
  );

  const buildTransferLotAdjustments = (
    workingProducts: typeof products,
    sourceLocation: string,
    targetLocation: string,
    items: Array<{ sku: string; qty: number; unit?: string; unitCost?: number; productName?: string }>,
    direction: 1 | -1,
    updatedAt: string,
  ): StockLotAdjustment[] => {
    const lotAdjustments: StockLotAdjustment[] = [];
    items.forEach((item) => {
      const qty = round3(Math.abs(Number(item.qty || 0)));
      if (!qty) return;

      const sourceProduct = findProductBySkuLocation(workingProducts, item.sku, sourceLocation);
      const targetProduct = findProductBySkuLocation(workingProducts, item.sku, targetLocation);
      const outQty = round3(-qty * direction);
      const inQty = round3(qty * direction);

      if (sourceProduct) {
        lotAdjustments.push({
          productId: sourceProduct.id,
          productName: sourceProduct.name || item.productName || '',
          sku: sourceProduct.sku || item.sku || '',
          location: sourceLocation,
          lotNumber: String(sourceProduct.lotNumber || '--').trim() || '--',
          expiryDate: String(sourceProduct.expiryDate || '').trim(),
          unit: sourceProduct.unit || item.unit || '',
          unitCost: round3(Number(item.unitCost ?? sourceProduct.unitPurchasePrice ?? 0)),
          qtyChange: outQty,
          updatedAt,
        });
      }

      if (targetProduct) {
        lotAdjustments.push({
          productId: targetProduct.id,
          productName: targetProduct.name || item.productName || '',
          sku: targetProduct.sku || item.sku || '',
          location: targetLocation,
          lotNumber: String(targetProduct.lotNumber || '--').trim() || '--',
          expiryDate: String(targetProduct.expiryDate || '').trim(),
          unit: targetProduct.unit || item.unit || '',
          unitCost: round3(Number(item.unitCost ?? targetProduct.unitPurchasePrice ?? 0)),
          qtyChange: inQty,
          updatedAt,
        });
      }
    });
    return lotAdjustments;
  };

  const buildLinkedTransferRecordFromAdjustment = (adjustment: StockAdjustmentRecord, actorName: string) => {
    const targetLocation = String(adjustment.damageSellableLocation || '').trim();
    if (!targetLocation) {
      throw new Error('Sellable damage location is missing on this adjustment.');
    }
    const transferItems = (adjustment.items || [])
      .map((item) => ({
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        qty: round3(Math.abs(Number(item.quantity || 0))),
        unit: item.unit || '',
        unitCost: round3(Number(item.unitCost || 0)),
      }))
      .filter((item) => item.qty > 0);
    if (transferItems.length === 0) {
      throw new Error('No transferable items found in this sellable damage adjustment.');
    }

    const nowIso = new Date().toISOString();
    const existingTransfers = readStockTransfers();
    return {
      transfer: {
        id: generateId('ST'),
        date: toIsoDate(adjustment.date || nowIso),
        refNo: makeNextStockTransferRef(settings.stockTransferPrefix || 'ST', existingTransfers),
        locationFrom: adjustment.location,
        locationTo: targetLocation,
        status: 'Completed' as const,
        shippingCharges: 0,
        totalAmount: round3(Number(adjustment.totalAmount || 0)),
        notes: `Sellable damage transfer for ${adjustment.referenceNo}${adjustment.reason ? ` - ${adjustment.reason}` : ''}`,
        items: transferItems,
        addedBy: actorName || 'System',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      transferItems,
      existingTransfers,
      targetLocation,
    };
  };

  const startEdit = (adjustment: StockAdjustmentRecord) => {
    if (!resolvedCanEdit) return;
    if (normalizeStockAdjustmentStatus(adjustment.status) !== 'Pending') {
      addNotification({
        title: 'Action Blocked',
        message: 'Approved stock adjustments cannot be edited.',
        type: 'error',
      });
      setActiveActionId(null);
      return;
    }
    setActiveActionId(null);
    onNavigate(`add-stock-adjustment/${adjustment.id}`);
  };

  const approveAdjustment = async (adjustment: StockAdjustmentRecord) => {
    if (!resolvedCanApprove) return;
    setActiveActionId(null);
    setConfirmModal({
      isOpen: true,
      title: 'Approve Adjustment',
      message: `Approve stock adjustment ${adjustment.referenceNo}? Stock will update immediately after approval.`,
      onConfirm: () => {
        setConfirmModal(null);
        void executeApproveAdjustment(adjustment.id);
      },
    });
  };

  const executeApproveAdjustment = async (adjustmentId: string) => {
    if (!resolvedCanApprove) return;

    try {
      await bootstrapStockAdjustmentsFromDB().catch(() => {});
      const latestAdjustments = readStockAdjustments();
      const adjustment = latestAdjustments.find((row) => row.id === adjustmentId);
      if (!adjustment) {
        setAdjustments(sortAdjustments(latestAdjustments));
        addNotification({
          title: 'Adjustment Not Found',
          message: 'The selected stock adjustment no longer exists.',
          type: 'error',
        });
        return;
      }

      const status = normalizeStockAdjustmentStatus(adjustment.status);
      if (status !== 'Pending') {
        setAdjustments(sortAdjustments(latestAdjustments));
        addNotification({
          title: 'Already Approved',
          message: `${adjustment.referenceNo} is already approved.`,
          type: 'warning',
        });
        return;
      }

      const actorName = currentUser?.name || 'System';
      const nowIso = new Date().toISOString();
      let linkedTransferId = '';
      let linkedExpenseId = '';
      let nextProductsAfter: typeof products | null = null;

      if (
        adjustment.adjustmentType === 'Damage'
        && normalizeStockAdjustmentDamageDisposition(adjustment.damageDisposition) === 'Sellable'
      ) {
        await bootstrapStockTransfersFromDB().catch(() => {});
        const { transfer, transferItems, existingTransfers, targetLocation } = buildLinkedTransferRecordFromAdjustment(adjustment, actorName);
        const destinationActive = locations.some(
          (row) => normalize(row.name) === normalize(targetLocation) && row.isActive !== false,
        );
        if (!destinationActive) {
          throw new Error(`Sellable damage location "${targetLocation}" is inactive or missing.`);
        }
        const appliedTransfer = simulateStockTransfer({
          transfer,
          direction: 1,
          products,
          generateId,
          actorName,
          notePrefix: `Damage approval ${adjustment.referenceNo}`,
        });
        nextProductsAfter = appliedTransfer.productsAfter;
        const transferLedgerSaved = await appendStockLedgerEntries(appliedTransfer.ledgerEntries);
        if (!transferLedgerSaved) {
          throw new Error('Unable to save stock ledger entries while approving transfer.');
        }
        const lotAdjustments = buildTransferLotAdjustments(
          appliedTransfer.productsAfter,
          transfer.locationFrom,
          transfer.locationTo,
          transferItems,
          1,
          toIsoDate(transfer.date),
        );
        if (lotAdjustments.length > 0) {
          const lotsSaved = await applyStockLotAdjustments(lotAdjustments);
          if (!lotsSaved) {
            throw new Error('Unable to save stock lot balances while approving transfer.');
          }
        }
        const nextTransfers = [
          transfer,
          ...existingTransfers.filter((row) => row.id !== transfer.id),
        ].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
        const transferSaved = await writeStockTransfers(nextTransfers, transfer.id);
        if (!transferSaved) {
          throw new Error('Unable to save linked stock transfer in Postgres.');
        }
        linkedTransferId = transfer.id;
      } else {
        const applied = simulateStockAdjustment({
          adjustment: { ...adjustment, status: 'Approved' },
          direction: 1,
          products,
          actorName,
          notePrefix: 'Approval',
        });
        nextProductsAfter = applied.productsAfter;
        const adjustmentLedgerSaved = await appendStockLedgerEntries(applied.ledgerEntries);
        if (!adjustmentLedgerSaved) {
          throw new Error('Unable to save stock ledger entries while approving adjustment.');
        }
        if (applied.lotAdjustments.length > 0) {
          const lotsSaved = await applyStockLotAdjustments(applied.lotAdjustments);
          if (!lotsSaved) {
            throw new Error('Unable to save stock lot balances while approving adjustment.');
          }
        }

        if (
          adjustment.adjustmentType === 'Damage'
          && normalizeStockAdjustmentDamageDisposition(adjustment.damageDisposition) === 'Unsellable'
        ) {
          const writeOffAmount = round3(
            Math.max(0, Number(adjustment.totalAmount || 0) - Number(adjustment.totalRecovered || 0)),
          );
          if (writeOffAmount > 0) {
            const expenseId = generateId('EXP');
            const expenseAdded = await addExpense({
              id: expenseId,
              refNo: buildExpenseRefNo(settings.expensesPrefix || 'EP'),
              date: toIsoDate(adjustment.date || nowIso),
              category: 'Damage / Write-off',
              subCategory: 'Unsellable Damage',
              location: adjustment.location || '',
              amount: writeOffAmount,
              tax: 0,
              totalAmount: writeOffAmount,
              paymentStatus: 'Due',
              paymentDue: writeOffAmount,
              expenseFor: 'Stock Damage Write-off',
              contact: '',
              paymentAccount: '',
              paymentMethod: 'Cash',
              note: `Auto-posted from stock adjustment ${adjustment.referenceNo}${adjustment.reason ? `: ${adjustment.reason}` : ''}`,
              paidAmount: 0,
              paidOn: '',
              paymentNote: '',
              addedById: currentUser?.id || '',
              addedBy: actorName,
              isRefund: false,
              isRecurring: false,
              recurringInterval: '',
              recurringUnit: '',
              recurringRepetitions: '',
            });
            if (!expenseAdded.ok) {
              throw new Error(expenseAdded.error || 'Unable to create linked damage expense in Postgres.');
            }
            linkedExpenseId = expenseId;
          }
        }
      }

      const approvedRecord: StockAdjustmentRecord = {
        ...adjustment,
        status: 'Approved',
        approvedBy: actorName,
        approvedById: currentUser?.id || '',
        approvedAt: nowIso,
        linkedTransferId,
        linkedExpenseId,
        updatedAt: nowIso,
      };
      const nextAdjustments = latestAdjustments.map((row) => (
        row.id === approvedRecord.id ? approvedRecord : row
      ));
      const sorted = sortAdjustments(nextAdjustments);
      const adjustmentSaved = await writeStockAdjustments(sorted, approvedRecord.id);
      if (!adjustmentSaved) {
        throw new Error('Unable to save approved stock adjustment in Postgres.');
      }
      if (nextProductsAfter) {
        setProducts(nextProductsAfter);
      }
      setAdjustments(sorted);
      addNotification({
        title: 'Adjustment Approved',
        message:
          approvedRecord.adjustmentType === 'Damage' && normalizeStockAdjustmentDamageDisposition(approvedRecord.damageDisposition) === 'Sellable'
            ? `${approvedRecord.referenceNo} approved. Stock moved to sellable-damage location.`
            : approvedRecord.linkedExpenseId
            ? `${approvedRecord.referenceNo} approved. Stock written off and damage expense posted.`
            : `${approvedRecord.referenceNo} approved and stock updated successfully.`,
        type: 'success',
      });
      addActivityLog({
        action: 'Approved',
        module: 'Stock Adjustments',
        description: `${approvedRecord.referenceNo} approved`,
      });
    } catch (error) {
      addNotification({
        title: 'Unable to Approve Adjustment',
        message: error instanceof Error ? error.message : 'Unexpected error while approving stock adjustment.',
        type: 'error',
      });
    }
  };

  const deleteAdjustment = (adjustment: StockAdjustmentRecord) => {
    if (!resolvedCanDelete) return;
    setActiveActionId(null);
    setConfirmModal({
      isOpen: true,
      title: 'Delete Adjustment',
      message: `Delete stock adjustment ${adjustment.referenceNo}?`,
      onConfirm: () => { setConfirmModal(null); void executeDeleteAdjustment(adjustment); },
    });
  };

  const executeDeleteAdjustment = async (adjustment: StockAdjustmentRecord) => {
    if (!resolvedCanDelete) return;

    try {
      const status = normalizeStockAdjustmentStatus(adjustment.status);
      let nextProductsAfter: typeof products | null = null;
      if (status === 'Approved') {
        const actorName = currentUser?.name || 'System';
        const isSellableDamage =
          adjustment.adjustmentType === 'Damage'
          && normalizeStockAdjustmentDamageDisposition(adjustment.damageDisposition) === 'Sellable';

        if (isSellableDamage) {
          await bootstrapStockTransfersFromDB().catch(() => {});
          const allTransfers = readStockTransfers();
          const linkedTransfer = allTransfers.find((row) => row.id === adjustment.linkedTransferId);
          const fallback = buildLinkedTransferRecordFromAdjustment(adjustment, actorName);
          const transfer = linkedTransfer || fallback.transfer;
          const transferItems = transfer.items.map((item) => ({
            sku: item.sku,
            qty: item.qty,
            unit: item.unit,
            unitCost: item.unitCost,
            productName: item.productName,
          }));

          const rollbackTransfer = simulateStockTransfer({
            transfer,
            direction: -1,
            products,
            generateId,
            actorName,
            notePrefix: `Delete rollback ${adjustment.referenceNo}`,
          });
          nextProductsAfter = rollbackTransfer.productsAfter;
          const rollbackTransferLedgerSaved = await appendStockLedgerEntries(rollbackTransfer.ledgerEntries);
          if (!rollbackTransferLedgerSaved) {
            throw new Error('Unable to save rollback stock ledger entries.');
          }
          const lotAdjustments = buildTransferLotAdjustments(
            rollbackTransfer.productsAfter,
            transfer.locationFrom,
            transfer.locationTo,
            transferItems,
            -1,
            toIsoDate(adjustment.date),
          );
          if (lotAdjustments.length > 0) {
            const lotsSaved = await applyStockLotAdjustments(lotAdjustments);
            if (!lotsSaved) {
              throw new Error('Unable to save stock lot balances while rolling back transfer.');
            }
          }

          const transferIdToDelete = linkedTransfer?.id || adjustment.linkedTransferId || '';
          if (transferIdToDelete) {
            const nextTransfers = allTransfers.filter((row) => row.id !== transferIdToDelete);
            const transferDeleteSynced = await writeStockTransfers(nextTransfers, undefined, transferIdToDelete);
            if (!transferDeleteSynced) {
              throw new Error('Unable to delete linked transfer from Postgres.');
            }
          }
        } else {
          const rollback = simulateStockAdjustment({
            adjustment,
            direction: -1,
            products,
            actorName,
            notePrefix: 'Delete rollback',
          });
          nextProductsAfter = rollback.productsAfter;
          const rollbackLedgerSaved = await appendStockLedgerEntries(rollback.ledgerEntries);
          if (!rollbackLedgerSaved) {
            throw new Error('Unable to save rollback stock ledger entries.');
          }
          if (rollback.lotAdjustments.length > 0) {
            const lotsSaved = await applyStockLotAdjustments(rollback.lotAdjustments);
            if (!lotsSaved) {
              throw new Error('Unable to save stock lot balances while rolling back adjustment.');
            }
          }
        }

        if (adjustment.linkedExpenseId) {
          const deletedExpense = await deleteExpense(adjustment.linkedExpenseId);
          if (!deletedExpense.ok) {
            throw new Error(deletedExpense.error || 'Unable to delete linked expense from Postgres.');
          }
        }
      }

      const nextAdjustments = sortAdjustments(adjustments.filter((row) => row.id !== adjustment.id));
      const savedAdjustments = await writeStockAdjustments(nextAdjustments);
      if (!savedAdjustments) {
        throw new Error('Unable to sync stock adjustments to Postgres.');
      }
      const deleted = await deleteDedicatedStrict('/api/sync/stock-adjustments', adjustment.id);
      if (!deleted.ok) {
        throw new Error('Unable to delete stock adjustment from Postgres.');
      }
      if (nextProductsAfter) {
        setProducts(nextProductsAfter);
      }
      setAdjustments(nextAdjustments);
      if (viewAdjustmentId === adjustment.id) setViewAdjustmentId(null);
      setActiveActionId(null);
      addNotification({
        title: 'Adjustment Deleted',
        message: `${adjustment.referenceNo} deleted successfully.`,
        type: 'success',
      });
      addActivityLog({
        action: 'Deleted',
        module: 'Stock Adjustments',
        description: `${adjustment.referenceNo} deleted (${status.toLowerCase()})`,
      });
    } catch (error) {
      addNotification({
        title: 'Unable to Delete Adjustment',
        message: error instanceof Error ? error.message : 'Unexpected delete error.',
        type: 'error',
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
            <SlidersHorizontal size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Stock Adjustments</h2>
            <p className="text-slate-500 text-sm mt-0.5">Add or deduct stock quantities</p>
          </div>
        </div>
        {resolvedCanAdd && (
          <button
            onClick={() => {
              onNavigate('add-stock-adjustment');
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-md active:scale-95 transition"
          >
            <Plus size={16} /> Add
          </button>
        )}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-4">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        <div
          className="flex items-center gap-2 cursor-pointer text-red-600 mb-4"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={16} />
          <span className="text-sm font-medium">Filters</span>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 animate-in slide-in-from-top-2">
            <div className="group">
              <MultiSelect
                label="Business Location"
                options={locations.map((loc) => loc.name)}
                selected={filters.location}
                onChange={(val) => setFilters({ ...filters, location: val })}
              />
            </div>
            <div className="group">
              <MultiSelect
                label="Adjustment Type"
                options={['Normal', 'Abnormal', 'Damage']}
                selected={filters.adjustmentType}
                onChange={(val) => setFilters({ ...filters, adjustmentType: val })}
              />
            </div>
            <div className="group">
              <MultiSelect
                label="Status"
                options={['Pending', 'Approved']}
                selected={filters.status}
                onChange={(val) => setFilters({ ...filters, status: val })}
              />
            </div>
            <div className="group">
              <MultiSelect
                label="User"
                options={userOptions}
                selected={filters.user}
                onChange={(val) => setFilters({ ...filters, user: val })}
              />
            </div>
            <div className="group">
              <DateRangeFilter onRangeSelect={(nextRange) => setRange(nextRange as DateRangeValue)} />
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600"></div>
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">All Stock Adjustments</h3>
        </div>

        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/30">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Show</span>
            <select
              className="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-red-500"
              value={entriesPerPage}
              onChange={(e) => setEntriesPerPage(Number(e.target.value) || 25)}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-slate-600">entries</span>
          </div>

          <div className="flex gap-1">
            <button onClick={exportCsv} className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={12} /> Export CSV</button>
            <button onClick={exportExcel} className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileSpreadsheet size={12} /> Export Excel</button>
            <button onClick={handlePrint} className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Printer size={12} /> Print</button>
            <div className="relative">
              <button
                data-adjustment-column-button
                onClick={() => setShowColumnMenu((prev) => !prev)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"
              >
                <Columns size={12} /> Column visibility
              </button>
              {showColumnMenu && (
                <div
                  data-adjustment-column-menu
                  className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-2 space-y-1"
                >
                  {([
                    ['date', 'Date'],
                    ['referenceNo', 'Reference No'],
                    ['location', 'Location'],
                    ['adjustmentType', 'Type'],
                    ['status', 'Status'],
                    ['totalAmount', 'Total Amount'],
                    ['totalRecovered', 'Recovered'],
                    ['reason', 'Reason'],
                    ['addedBy', 'Added By'],
                  ] as Array<[ColumnKey, string]>).map(([column, label]) => (
                    <label key={column} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                        checked={visibleColumns[column]}
                        onChange={() => toggleColumn(column)}
                      />
                      <span className="text-slate-700 font-medium">{label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Search:</label>
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                className="pl-8 pr-3 py-1.5 rounded border border-slate-300 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                {visibleColumns.date && <th className="px-4 py-3 whitespace-nowrap">Date <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.referenceNo && <th className="px-4 py-3 whitespace-nowrap">Reference No <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>}
                {visibleColumns.location && <th className="px-4 py-3 whitespace-nowrap">Location</th>}
                {visibleColumns.adjustmentType && <th className="px-4 py-3 whitespace-nowrap">Type</th>}
                {visibleColumns.status && <th className="px-4 py-3 whitespace-nowrap">Status</th>}
                {visibleColumns.totalAmount && <th className="px-4 py-3 whitespace-nowrap text-right">Total Amount</th>}
                {visibleColumns.totalRecovered && <th className="px-4 py-3 whitespace-nowrap text-right">Recovered</th>}
                {visibleColumns.reason && <th className="px-4 py-3 whitespace-nowrap">Reason</th>}
                {visibleColumns.addedBy && <th className="px-4 py-3 whitespace-nowrap">Added By</th>}
                <th className="px-4 py-3 whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedAdjustments.length > 0 ? (
                paginatedAdjustments.map((adjustment) => (
                  <tr key={adjustment.id} className="hover:bg-slate-50 transition-colors">
                    {visibleColumns.date && <td className="px-4 py-3 whitespace-nowrap">{formatDateTimeDisplay(adjustment.date)}</td>}
                    {visibleColumns.referenceNo && <td className="px-4 py-3 font-bold text-slate-700">{adjustment.referenceNo}</td>}
                    {visibleColumns.location && <td className="px-4 py-3">{adjustment.location}</td>}
                    {visibleColumns.adjustmentType && (
                      <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        adjustment.adjustmentType === 'Normal'
                          ? 'bg-blue-100 text-blue-700'
                          : adjustment.adjustmentType === 'Abnormal'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}>
                        {adjustment.adjustmentType}
                      </span>
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td className="px-4 py-3">
                        {normalizeStockAdjustmentStatus(adjustment.status) === 'Pending' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">Pending</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">Approved</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.totalAmount && <td className="px-4 py-3 text-right">{Number(adjustment.totalAmount || 0).toFixed(3)}</td>}
                    {visibleColumns.totalRecovered && <td className="px-4 py-3 text-right">{Number(adjustment.totalRecovered || 0).toFixed(3)}</td>}
                    {visibleColumns.reason && <td className="px-4 py-3 max-w-[280px] truncate">{adjustment.reason || '--'}</td>}
                    {visibleColumns.addedBy && <td className="px-4 py-3">{adjustment.addedBy || '--'}</td>}
                    <td className="px-4 py-3 relative">
                      <button
                        data-adjustment-action-button
                        onClick={() => setActiveActionId((prev) => (prev === adjustment.id ? null : adjustment.id))}
                        className="text-red-600 hover:text-red-800 font-bold flex items-center gap-1"
                      >
                        Action <ChevronDown size={10} />
                      </button>
                      {activeActionId === adjustment.id && (
                        <div data-adjustment-action-menu className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
                          <button onClick={() => { setViewAdjustmentId(adjustment.id); setActiveActionId(null); }} className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                            <Eye size={12} /> View
                          </button>
                          {resolvedCanApprove && normalizeStockAdjustmentStatus(adjustment.status) === 'Pending' && (
                            <button onClick={() => approveAdjustment(adjustment)} className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2">
                              <CheckCircle2 size={12} /> Approve
                            </button>
                          )}
                          {resolvedCanEdit && normalizeStockAdjustmentStatus(adjustment.status) === 'Pending' && (
                            <button onClick={() => startEdit(adjustment)} className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                              <Edit size={12} /> Edit
                            </button>
                          )}
                          {resolvedCanDelete && (
                            <button onClick={() => deleteAdjustment(adjustment)} className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2">
                              <Trash2 size={12} /> Delete
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(Boolean).length + 1} className="px-6 py-12 text-center text-slate-500 bg-slate-50/50 italic">
                    No data available in table
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 bg-slate-50/30">
          <div>Showing {pageStartEntry} to {pageEndEntry} of {totalEntries} entries</div>
          <div className="text-[11px]">
            Date Range: <span className="font-bold text-slate-700">{range.label || 'All'}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safeCurrentPage <= 1}
              className="px-2 py-1 rounded border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 hover:bg-slate-100"
            >
              Prev
            </button>
            <span className="px-2">Page {safeCurrentPage} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="px-2 py-1 rounded border border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 hover:bg-slate-100"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {viewAdjustment && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="bg-white w-full max-w-2xl rounded-xl border border-slate-200 shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Adjustment {viewAdjustment.referenceNo}</h3>
              <button onClick={() => setViewAdjustmentId(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4 overflow-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500">Date:</span> <span className="font-bold text-slate-800">{formatDateTimeDisplay(viewAdjustment.date)}</span></div>
                <div><span className="text-slate-500">Type:</span> <span className="font-bold text-slate-800">{viewAdjustment.adjustmentType}</span></div>
                <div><span className="text-slate-500">Status:</span> <span className="font-bold text-slate-800">{normalizeStockAdjustmentStatus(viewAdjustment.status)}</span></div>
                <div><span className="text-slate-500">Location:</span> <span className="font-bold text-slate-800">{viewAdjustment.location}</span></div>
                {viewAdjustment.adjustmentType === 'Damage' && (
                  <div>
                    <span className="text-slate-500">Damage Bucket:</span>{' '}
                    <span className="font-bold text-slate-800">{normalizeStockAdjustmentDamageDisposition(viewAdjustment.damageDisposition)}</span>
                  </div>
                )}
                {viewAdjustment.adjustmentType === 'Damage' && normalizeStockAdjustmentDamageDisposition(viewAdjustment.damageDisposition) === 'Sellable' && (
                  <div>
                    <span className="text-slate-500">Sellable Location:</span>{' '}
                    <span className="font-bold text-slate-800">{viewAdjustment.damageSellableLocation || '--'}</span>
                  </div>
                )}
                <div><span className="text-slate-500">Added By:</span> <span className="font-bold text-slate-800">{viewAdjustment.addedBy}</span></div>
                {normalizeStockAdjustmentStatus(viewAdjustment.status) === 'Approved' && (
                  <div><span className="text-slate-500">Approved By:</span> <span className="font-bold text-slate-800">{viewAdjustment.approvedBy || '--'}</span></div>
                )}
                <div><span className="text-slate-500">Total:</span> <span className="font-bold text-slate-800">{formatCurrency(Number(viewAdjustment.totalAmount || 0))}</span></div>
                <div><span className="text-slate-500">Recovered:</span> <span className="font-bold text-slate-800">{formatCurrency(Number(viewAdjustment.totalRecovered || 0))}</span></div>
                {normalizeStockAdjustmentStatus(viewAdjustment.status) === 'Approved' && (
                  <div><span className="text-slate-500">Approved At:</span> <span className="font-bold text-slate-800">{viewAdjustment.approvedAt ? formatDateTimeDisplay(viewAdjustment.approvedAt) : '--'}</span></div>
                )}
                {viewAdjustment.linkedTransferId && (
                  <div><span className="text-slate-500">Linked Transfer:</span> <span className="font-bold text-slate-800">{viewAdjustment.linkedTransferId}</span></div>
                )}
                {viewAdjustment.linkedExpenseId && (
                  <div><span className="text-slate-500">Linked Expense:</span> <span className="font-bold text-slate-800">{viewAdjustment.linkedExpenseId}</span></div>
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-700 mb-2">Items</h4>
                <div className="border border-slate-200 rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-left">SKU</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewAdjustment.items || []).map((item, index) => (
                        <tr key={`${item.productId}-${index}`} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-2">{item.productName}</td>
                          <td className="px-3 py-2">{item.sku}</td>
                          <td className={`px-3 py-2 text-right ${Number(item.quantity || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {Number(item.quantity || 0).toFixed(3)}
                          </td>
                        </tr>
                      ))}
                      {(viewAdjustment.items || []).length === 0 && (
                        <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-400 italic">No items</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {viewAdjustment.reason && (
                <div>
                  <h4 className="text-sm font-bold text-slate-700 mb-1">Reason</h4>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{viewAdjustment.reason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <div className="flex flex-col items-center text-center">
              <div className="p-4 rounded-full bg-rose-50 text-rose-500 mb-4"><Trash2 size={32} /></div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{confirmModal.title}</h3>
              <p className="text-slate-500 text-sm mb-6">{confirmModal.message}</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setConfirmModal(null)} className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition-colors">Cancel</button>
                <button onClick={confirmModal.onConfirm} className="flex-1 px-4 py-2.5 rounded-lg text-white font-bold bg-rose-600 hover:bg-rose-700 transition-colors">Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListStockAdjustments;
