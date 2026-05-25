import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, FileText, FileSpreadsheet, Printer,
  Columns, ChevronDown, Filter, ArrowUpDown, Eye, Edit, Trash2, X,ArrowLeftRight} from 'lucide-react';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import MultiSelect from '@/components/shared/MultiSelect';
import { useGlobalContext } from '@/context/GlobalContext';
import { useNotifications } from '@/context/NotificationContext';
import { printDocument, statusBadge } from '@/utils/printUtils';
import { buildPaginationItems } from '@/utils/pagination';
import { formatDateBySettings, formatDateTimeBySettings } from '@/utils/dateTime';
import {
  StockTransferRecord,
  appendStockLedgerEntries,
  bootstrapStockTransfersFromDB,
  readStockTransfers,
  simulateStockTransfer,
  
  writeStockTransfers,
} from '@/utils/stockTransfers';
import { fetchLocationInventoryFromDB } from '@/utils/stockLocationInventory';
import { isLocationAccessible } from '@/utils/productVisibility';

interface ListStockTransfersProps {
  onNavigate: (page: string) => void;
  canManage?: boolean;
}

interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const getCurrentYearRange = (): DateRangeValue => {
  const now = new Date();
  return {
    startDate: new Date(now.getFullYear(), 0, 1),
    endDate: new Date(now.getFullYear(), 11, 31),
    label: 'This Year',
  };
};

const ListStockTransfers: React.FC<ListStockTransfersProps> = ({ onNavigate, canManage = true }) => {
  const { locations, products, refreshProductsFromServer, generateId, currentUser, formatCurrency, addActivityLog, settings } = useGlobalContext();
  const { addNotification } = useNotifications();
  const formatDateDisplay = (value?: string) =>
    formatDateBySettings(value || '', settings.dateFormat, settings.timeZone);
  const formatDateTimeDisplay = (value?: string) =>
    formatDateTimeBySettings(value || '', settings.dateFormat, settings.timeFormat, settings.timeZone);

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [transfers, setTransfers] = useState<StockTransferRecord[]>([]);
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [viewTransferId, setViewTransferId] = useState<string | null>(null);
  const [range, setRange] = useState<DateRangeValue>(getCurrentYearRange);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void} | null>(null);

  const [filters, setFilters] = useState({
    locationFrom: [] as string[],
    locationTo: [] as string[],
    status: [] as string[],
  });

  useEffect(() => {
    let isMounted = true;

    const refreshFromDB = async () => {
      await bootstrapStockTransfersFromDB().catch(() => {});
      if (isMounted) setTransfers(readStockTransfers());
    };

    void refreshFromDB();
    const onFocus = () => { void refreshFromDB(); };
    const onUpdated = () => { void refreshFromDB(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('app:stock-transfers-updated', onUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('app:stock-transfers-updated', onUpdated);
    };
  }, []);

  const visibleTransfers = useMemo(() => {
    const query = normalize(searchTerm);
    const startMs = range.startDate ? new Date(range.startDate.getFullYear(), range.startDate.getMonth(), range.startDate.getDate(), 0, 0, 0, 0).getTime() : null;
    const endMs = range.endDate ? new Date(range.endDate.getFullYear(), range.endDate.getMonth(), range.endDate.getDate(), 23, 59, 59, 999).getTime() : null;

    return transfers
      .filter((transfer) => {
        if (query) {
          const itemNames = (transfer.items || []).map(item => item.productName).join(' ');
          const haystack = [
            transfer.refNo,
            transfer.locationFrom,
            transfer.locationTo,
            transfer.status,
            transfer.notes,
            transfer.addedBy,
            itemNames,
          ].map(normalize);
          if (!haystack.some(value => value.includes(query))) return false;
        }
        if (filters.locationFrom.length > 0 && !filters.locationFrom.includes(transfer.locationFrom)) return false;
        if (filters.locationTo.length > 0 && !filters.locationTo.includes(transfer.locationTo)) return false;
        if (filters.status.length > 0 && !filters.status.includes(transfer.status)) return false;

        const fromAccessible = isLocationAccessible(transfer.locationFrom, currentUser, locations);
        const toAccessible = isLocationAccessible(transfer.locationTo, currentUser, locations);
        if (!fromAccessible && !toAccessible) return false;
        if (startMs != null || endMs != null) {
          const transferMs = Date.parse(transfer.date);
          if (!Number.isFinite(transferMs)) return false;
          if (startMs != null && transferMs < startMs) return false;
          if (endMs != null && transferMs > endMs) return false;
        }
        return true;
      })
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }, [transfers, searchTerm, filters, range]);

  const viewTransfer = useMemo(
    () => transfers.find(item => item.id === viewTransferId),
    [transfers, viewTransferId],
  );

  const totalPages = Math.max(1, Math.ceil(visibleTransfers.length / entriesPerPage));
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const pageStart = (safeCurrentPage - 1) * entriesPerPage;
  const pagedTransfers = visibleTransfers.slice(pageStart, pageStart + entriesPerPage);
  const pageItems = buildPaginationItems(safeCurrentPage, totalPages);
  const showingFrom = visibleTransfers.length === 0 ? 0 : pageStart + 1;
  const showingTo = Math.min(pageStart + pagedTransfers.length, visibleTransfers.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, range, entriesPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const exportCsv = () => {
    const headers = [
      'Date', 'Reference No', 'Location From', 'Location To', 'Status',
      'Shipping Charges', 'Total Amount', 'Notes', 'Added By',
    ];
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = visibleTransfers.map((transfer) => [
      escape(transfer.date),
      escape(transfer.refNo),
      escape(transfer.locationFrom),
      escape(transfer.locationTo),
      escape(transfer.status),
      escape(Number(transfer.shippingCharges || 0).toFixed(3)),
      escape(Number(transfer.totalAmount || 0).toFixed(3)),
      escape(transfer.notes || ''),
      escape(transfer.addedBy || ''),
    ].join(','));
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock-transfers.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const headers = [
      'Date', 'Reference No', 'Location From', 'Location To', 'Status',
      'Shipping Charges', 'Total Amount', 'Notes', 'Added By',
    ];
    const lines = visibleTransfers.map((transfer) => [
      transfer.date,
      transfer.refNo,
      transfer.locationFrom,
      transfer.locationTo,
      transfer.status,
      Number(transfer.shippingCharges || 0).toFixed(3),
      Number(transfer.totalAmount || 0).toFixed(3),
      transfer.notes || '',
      transfer.addedBy || '',
    ].join('\t'));
    const tsv = [headers.join('\t'), ...lines].join('\n');
    const blob = new Blob([tsv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock-transfers.xls';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const totalShipping = visibleTransfers.reduce((sum, t) => sum + Number(t.shippingCharges || 0), 0);
    const totalAmount = visibleTransfers.reduce((sum, t) => sum + Number(t.totalAmount || 0), 0);
    printDocument({
      title: 'Stock Transfers',
      subtitle: range?.label ? `Period: ${range.label}` : undefined,
      businessName: settings?.businessName || 'ATWAR AL MUSTAQBAL',
      businessAddress: settings?.address || '',
      printedBy: currentUser?.name || '',
      columns: [
        { label: 'Date', width: '80px' },
        { label: 'Reference No', width: '100px' },
        { label: 'From Location' },
        { label: 'To Location' },
        { label: 'Status', width: '80px' },
        { label: 'Shipping Charges', align: 'right', width: '90px' },
        { label: 'Total Amount', align: 'right', width: '90px' },
        { label: 'Notes' },
        { label: 'Added By', width: '80px' },
      ],
      rows: visibleTransfers.map(t => [
        formatDateDisplay(t.date),
        t.refNo,
        t.locationFrom,
        t.locationTo,
        statusBadge(t.status),
        formatCurrency(Number(t.shippingCharges || 0)),
        formatCurrency(Number(t.totalAmount || 0)),
        t.notes || '--',
        t.addedBy || '--',
      ]),
      stats: [
        { label: 'Total Transfers', value: String(visibleTransfers.length), color: 'blue' },
        { label: 'Total Amount', value: formatCurrency(totalAmount), color: 'green' },
      ],
      totalRow: ['TOTAL', '', '', '', '',
        formatCurrency(totalShipping),
        formatCurrency(totalAmount),
        '', ''],
    });
  };

  const startEdit = (transferId: string) => {
    if (!canManage) return;
    setActiveActionId(null);
    onNavigate(`add-stock-transfer/${transferId}`);
  };

  const deleteTransfer = (transfer: StockTransferRecord) => {
    if (!canManage) return;
    setActiveActionId(null);
    setConfirmModal({
      isOpen: true,
      title: 'Delete Transfer',
      message: `Delete stock transfer ${transfer.refNo}?`,
      onConfirm: () => { setConfirmModal(null); void executeDeleteTransfer(transfer); },
    });
  };

  const executeDeleteTransfer = async (transfer: StockTransferRecord) => {
    if (!canManage) return;
    try {
      if (transfer.status === 'Completed') {
        const fromLoc = locations.find(l => l.name.trim().toLowerCase() === transfer.locationFrom.trim().toLowerCase());
        const toLoc = locations.find(l => l.name.trim().toLowerCase() === transfer.locationTo.trim().toLowerCase());
        
        if (!fromLoc) throw new Error(`Cannot resolve ID for source location: ${transfer.locationFrom}`);
        if (!toLoc) throw new Error(`Cannot resolve ID for destination location: ${transfer.locationTo}`);
        
        const workingInventory = await fetchLocationInventoryFromDB();
        
        const rollback = simulateStockTransfer({
          transfer,
          direction: -1,
          products,
          inventoryRows: workingInventory,
          locationFromId: fromLoc.id,
          locationToId: toLoc.id,
          generateId,
          actorName: currentUser?.name || 'System',
          notePrefix: 'Delete rollback',
        });
        const ledgerSaved = await appendStockLedgerEntries(rollback.ledgerEntries);
        if (!ledgerSaved) {
          throw new Error('Unable to persist rollback ledger entries in Postgres.');
        }
        /* We rely on background product refresh instead of syncing products directly */
      }

      const nextTransfers = transfers.filter(row => row.id !== transfer.id);
      const transferSaved = await writeStockTransfers(nextTransfers, undefined, transfer.id);
      if (!transferSaved) {
        throw new Error('Unable to delete stock transfer from Postgres.');
      }
      setTransfers(nextTransfers);
      if (transfer.status === 'Completed') {
        void refreshProductsFromServer();
      }
      if (viewTransferId === transfer.id) setViewTransferId(null);
      setActiveActionId(null);
      addNotification({
        title: 'Transfer Deleted',
        message: `${transfer.refNo} deleted successfully.`,
        type: 'success',
      });
      await addActivityLog({
        action: 'Deleted',
        module: 'Stock Transfers',
        description: `${transfer.refNo} deleted`,
      });
    } catch (error) {
      addNotification({
        title: 'Unable to Delete Transfer',
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
            <ArrowLeftRight size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Stock Transfers</h2>
            <p className="text-slate-500 text-sm mt-0.5">Transfer stock between locations</p>
          </div>
        </div>
        {canManage && (
          <button
            onClick={() => {
              onNavigate('add-stock-transfer');
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
          className="flex items-center gap-2 cursor-pointer text-blue-600 mb-4"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={16} />
          <span className="text-sm font-medium">Filters</span>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
            <div className="group">
              <MultiSelect
                label="Business Location (From)"
                options={locations.map(loc => loc.name)}
                selected={filters.locationFrom}
                onChange={(val) => setFilters({ ...filters, locationFrom: val })}
              />
            </div>
            <div className="group">
              <MultiSelect
                label="Business Location (To)"
                options={locations.map(loc => loc.name)}
                selected={filters.locationTo}
                onChange={(val) => setFilters({ ...filters, locationTo: val })}
              />
            </div>
            <div className="group">
              <MultiSelect
                label="Status"
                options={['Pending', 'In Transit', 'Completed']}
                selected={filters.status}
                onChange={(val) => setFilters({ ...filters, status: val })}
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
          <h3 className="text-sm font-bold text-slate-700">All Stock Transfers</h3>
        </div>

        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/30">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Show</span>
            <select
              value={entriesPerPage}
              onChange={(event) => setEntriesPerPage(Number(event.target.value) || 25)}
              className="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value={10}>10</option>
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
            <span className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-500 flex items-center gap-1 shadow-sm cursor-default"><Columns size={12} /> Column visibility</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Search:</label>
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                className="pl-8 pr-3 py-1.5 rounded border border-slate-300 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                <th className="px-4 py-3 whitespace-nowrap">Date <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Reference No <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Location (From)</th>
                <th className="px-4 py-3 whitespace-nowrap">Location (To)</th>
                <th className="px-4 py-3 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Shipping Charges</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Total Amount</th>
                <th className="px-4 py-3 whitespace-nowrap">Additional Notes</th>
                <th className="px-4 py-3 whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedTransfers.length > 0 ? (
                pagedTransfers.map((transfer) => (
                  <tr key={transfer.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTimeDisplay(transfer.date)}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">{transfer.refNo}</td>
                    <td className="px-4 py-3">{transfer.locationFrom}</td>
                    <td className="px-4 py-3">{transfer.locationTo}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        transfer.status === 'Completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : transfer.status === 'In Transit'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}>
                        {transfer.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{Number(transfer.shippingCharges || 0).toFixed(3)}</td>
                    <td className="px-4 py-3 text-right font-bold">{Number(transfer.totalAmount || 0).toFixed(3)}</td>
                    <td className="px-4 py-3 max-w-[280px] truncate">{transfer.notes || '--'}</td>
                    <td className="px-4 py-3 relative">
                      <button
                        onClick={() => setActiveActionId(prev => (prev === transfer.id ? null : transfer.id))}
                        className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
                      >
                        Action <ChevronDown size={10} />
                      </button>
                      {activeActionId === transfer.id && (
                        <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
                          <button onClick={() => { setViewTransferId(transfer.id); setActiveActionId(null); }} className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                            <Eye size={12} /> View
                          </button>
                          {canManage && (
                            <button onClick={() => startEdit(transfer.id)} className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                              <Edit size={12} /> Edit
                            </button>
                          )}
                          {canManage && (
                            <button onClick={() => deleteTransfer(transfer)} className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2">
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
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500 bg-slate-50/50 italic">
                    No data available in table
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 bg-slate-50/30">
          <div className="flex items-center gap-4">
            <span>Showing {showingFrom} to {showingTo} of {visibleTransfers.length} entries</span>
            <div className="text-[11px]">
              Date Range: <span className="font-bold text-slate-700">{range.label || 'All'}</span>
            </div>
          </div>
          <div className="flex gap-1">
            <button
              className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </button>
            {pageItems.map((item, index) => item === '...'
              ? <span key={`page-ellipsis-${index}`} className="px-2 py-1 text-slate-400">...</span>
              : (
                <button
                  key={item}
                  className={`px-3 py-1 border rounded shadow-sm ${item === safeCurrentPage ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                  onClick={() => setCurrentPage(item)}
                >
                  {item}
                </button>
              ))}
            <button
              className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {viewTransfer && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="bg-white w-full max-w-2xl rounded-xl border border-slate-200 shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Transfer {viewTransfer.refNo}</h3>
              <button onClick={() => setViewTransferId(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4 overflow-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500">Date:</span> <span className="font-bold text-slate-800">{formatDateTimeDisplay(viewTransfer.date)}</span></div>
                <div><span className="text-slate-500">Status:</span> <span className="font-bold text-slate-800">{viewTransfer.status}</span></div>
                <div><span className="text-slate-500">From:</span> <span className="font-bold text-slate-800">{viewTransfer.locationFrom}</span></div>
                <div><span className="text-slate-500">To:</span> <span className="font-bold text-slate-800">{viewTransfer.locationTo}</span></div>
                <div><span className="text-slate-500">Shipping:</span> <span className="font-bold text-slate-800">{formatCurrency(Number(viewTransfer.shippingCharges || 0))}</span></div>
                <div><span className="text-slate-500">Total:</span> <span className="font-black text-slate-900">{formatCurrency(Number(viewTransfer.totalAmount || 0))}</span></div>
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
                      {(viewTransfer.items || []).map((item, index) => (
                        <tr key={`${item.productId}-${index}`} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-2">{item.productName}</td>
                          <td className="px-3 py-2">{item.sku}</td>
                          <td className="px-3 py-2 text-right">{Number(item.qty || 0).toFixed(3)}</td>
                        </tr>
                      ))}
                      {(viewTransfer.items || []).length === 0 && (
                        <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-400 italic">No items</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {viewTransfer.notes && (
                <div>
                  <h4 className="text-sm font-bold text-slate-700 mb-1">Notes</h4>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{viewTransfer.notes}</p>
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

export default ListStockTransfers;


