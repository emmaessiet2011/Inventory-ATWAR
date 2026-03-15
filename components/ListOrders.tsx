import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, FileText, FileSpreadsheet, Printer,
  Eye, MoreVertical, Filter, ChevronDown, Truck, Phone,
  Edit, FileCheck, User, XCircle, Check,
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import MultiSelect from './MultiSelect';
import { useGlobalContext, GlobalOrder } from '../src/context/GlobalContext';
import { useNotifications } from '../src/context/NotificationContext';
import { printDocument, statusBadge, paymentBadge } from '../src/utils/printUtils';

interface ListOrdersProps {
  onNavigate: (page: string) => void;
  onSelectOrder: (id: string) => void;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canGenerateInvoice?: boolean;
  canApprove?: boolean;
}

interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
const toCsvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const parseDateToMs = (value: unknown): number => {
  const raw = String(value ?? '').trim();
  if (!raw) return Number.NaN;
  const direct = Date.parse(raw);
  if (Number.isFinite(direct)) return direct;

  const dmyWithOptionalTime = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?$/i,
  );
  if (!dmyWithOptionalTime) return Number.NaN;
  const day = Number(dmyWithOptionalTime[1]);
  const month = Number(dmyWithOptionalTime[2]) - 1;
  const year = Number(dmyWithOptionalTime[3]);
  const rawHour = Number(dmyWithOptionalTime[4] || 0);
  const minute = Number(dmyWithOptionalTime[5] || 0);
  const meridiem = normalize(dmyWithOptionalTime[6]);
  let hour = rawHour;
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  const parsed = new Date(year, month, day, hour, minute, 0, 0).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const formatDateTime = (value: string) => {
  const ms = parseDateToMs(value);
  if (!Number.isFinite(ms)) return value || '--';
  return new Date(ms).toLocaleString();
};

const getCurrentYearRange = (): DateRangeValue => {
  const now = new Date();
  return {
    startDate: new Date(now.getFullYear(), 0, 1),
    endDate: new Date(now.getFullYear(), 11, 31),
    label: 'This Year',
  };
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Pending': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'Processing': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'Ready': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    case 'Shipped': return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'Delivered': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'Cancelled': return 'bg-rose-100 text-rose-700 border-rose-200';
    default: return 'bg-slate-100 text-slate-600';
  }
};

const ListOrders: React.FC<ListOrdersProps> = ({
  onNavigate,
  onSelectOrder,
  canAdd = true,
  canEdit = true,
  canDelete = true,
  canGenerateInvoice = true,
  canApprove = false,
}) => {
  const {
    orders: globalOrders,
    sales,
    users,
    currentUser,
    updateOrder: globalUpdateOrder,
    formatCurrency,
    settings,
  } = useGlobalContext();
  const { addNotification } = useNotifications();

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [range, setRange] = useState<DateRangeValue>(getCurrentYearRange);
  const [filters, setFilters] = useState({
    deliveryStatus: [] as string[],
    paymentStatus: [] as string[],
    salesPerson: [] as string[],
    approvalStatus: [] as string[],
  });

  const salesPersonOptions = useMemo(() => Array.from(new Set([
    ...users.map((user) => String(user.name || '').trim()),
    ...globalOrders.map((order) => String(order.salesRep || '').trim()),
  ].filter(Boolean))).sort(), [users, globalOrders]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      const inMenu = event.target.closest('[data-order-action-menu]');
      const inButton = event.target.closest('[data-order-action-button]');
      if (!inMenu && !inButton) setActiveActionId(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setActiveActionId(null);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const filteredOrders = useMemo(() => {
    const q = normalize(searchTerm);
    const startMs = range.startDate
      ? new Date(range.startDate.getFullYear(), range.startDate.getMonth(), range.startDate.getDate(), 0, 0, 0, 0).getTime()
      : null;
    const endMs = range.endDate
      ? new Date(range.endDate.getFullYear(), range.endDate.getMonth(), range.endDate.getDate(), 23, 59, 59, 999).getTime()
      : null;

    return globalOrders
      .filter((order: GlobalOrder) => {
        if (q) {
          const haystack = [
            order.orderNumber,
            order.customerName,
            order.customerPhone,
            order.area,
            order.businessLocation,
            order.salesRep,
          ].map(normalize);
          if (!haystack.some((value) => value.includes(q))) return false;
        }

        if (filters.deliveryStatus.length > 0 && !filters.deliveryStatus.includes(order.status)) return false;
        if (filters.paymentStatus.length > 0 && !filters.paymentStatus.includes(order.paymentStatus)) return false;
        if (filters.salesPerson.length > 0 && !filters.salesPerson.includes(order.salesRep)) return false;
        if (filters.approvalStatus.length > 0) {
          const wantsApproved = filters.approvalStatus.includes('Approved');
          const wantsPending = filters.approvalStatus.includes('Pending Approval');
          if (wantsApproved && !wantsPending && !order.isApproved) return false;
          if (wantsPending && !wantsApproved && order.isApproved) return false;
        }

        if (startMs != null || endMs != null) {
          const orderMs = parseDateToMs(order.orderDate);
          if (!Number.isFinite(orderMs)) return false;
          if (startMs != null && orderMs < startMs) return false;
          if (endMs != null && orderMs > endMs) return false;
        }

        return true;
      })
      .sort((a, b) => parseDateToMs(b.orderDate) - parseDateToMs(a.orderDate));
  }, [globalOrders, searchTerm, filters, range]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, range, entriesPerPage]);

  const totalEntries = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / entriesPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * entriesPerPage;
  const paginatedOrders = filteredOrders.slice(pageStartIndex, pageStartIndex + entriesPerPage);
  const showingFrom = totalEntries === 0 ? 0 : pageStartIndex + 1;
  const showingTo = totalEntries === 0 ? 0 : pageStartIndex + paginatedOrders.length;

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const exportCsv = () => {
    const headers = [
      'Order No', 'Customer', 'Phone', 'Sales Rep', 'Area', 'Business Location',
      'Order Date', 'Delivery Date', 'Delivery Status', 'Approval Status', 'Payment Status',
      'Items', 'Total',
    ];
    const rows = filteredOrders.map((order) => [
      toCsvCell(order.orderNumber),
      toCsvCell(order.customerName),
      toCsvCell(order.customerPhone || ''),
      toCsvCell(order.salesRep),
      toCsvCell(order.area || ''),
      toCsvCell(order.businessLocation || ''),
      toCsvCell(order.orderDate || ''),
      toCsvCell(order.deliveryDate || ''),
      toCsvCell(order.status),
      toCsvCell(order.isApproved ? `Approved by ${order.approvedBy || ''}` : 'Pending Approval'),
      toCsvCell(order.paymentStatus),
      toCsvCell(order.itemCount),
      toCsvCell(Number(order.total || 0).toFixed(3)),
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orders.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const headers = [
      'Order No', 'Customer', 'Phone', 'Sales Rep', 'Area', 'Business Location',
      'Order Date', 'Delivery Date', 'Delivery Status', 'Approval Status', 'Payment Status',
      'Items', 'Total',
    ];
    const rows = filteredOrders.map((order) => [
      order.orderNumber,
      order.customerName,
      order.customerPhone || '',
      order.salesRep,
      order.area || '',
      order.businessLocation || '',
      order.orderDate || '',
      order.deliveryDate || '',
      order.status,
      order.isApproved ? `Approved by ${order.approvedBy || ''}` : 'Pending Approval',
      order.paymentStatus,
      String(order.itemCount || 0),
      Number(order.total || 0).toFixed(3),
    ].join('\t'));
    const tsv = [headers.join('\t'), ...rows].join('\n');
    const blob = new Blob([tsv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orders.xls';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const totalAmount = filteredOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    printDocument({
      title: 'List Orders',
      subtitle: range?.label ? `Period: ${range.label}` : undefined,
      businessName: settings?.businessName || 'ATWAR AL MUSTAQBAL',
      businessAddress: settings?.address || '',
      printedBy: currentUser?.name || '',
      columns: [
        { label: 'Order No', width: '90px' },
        { label: 'Customer' },
        { label: 'Phone', width: '90px' },
        { label: 'Sales Rep', width: '90px' },
        { label: 'Area', width: '80px' },
        { label: 'Location', width: '80px' },
        { label: 'Order Date', width: '85px' },
        { label: 'Delivery Date', width: '85px' },
        { label: 'Delivery Status', width: '80px' },
        { label: 'Payment Status', width: '80px' },
        { label: 'Items', align: 'right', width: '40px' },
        { label: 'Total', align: 'right', width: '80px' },
      ],
      rows: filteredOrders.map(order => [
        order.orderNumber,
        order.customerName,
        order.customerPhone || '--',
        order.salesRep,
        order.area || '--',
        order.businessLocation || '--',
        formatDateTime(order.orderDate),
        formatDateTime(order.deliveryDate),
        statusBadge(order.status),
        paymentBadge(order.paymentStatus),
        String(order.itemCount || 0),
        formatCurrency(order.total || 0),
      ]),
      stats: [
        { label: 'Total Orders', value: String(filteredOrders.length), color: 'blue' },
        { label: 'Total Amount', value: formatCurrency(totalAmount), color: 'green' },
      ],
      totalRow: ['TOTAL', '', '', '', '', '', '', '', '', '',
        String(filteredOrders.reduce((sum, o) => sum + Number(o.itemCount || 0), 0)),
        formatCurrency(totalAmount)],
    });
  };

  const exportPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const marginLeft = 40;
      let y = 50;

      doc.setFontSize(16);
      doc.text('Orders', marginLeft, y);
      y += 22;

      doc.setFontSize(9);
      doc.text('Order No', marginLeft, y);
      doc.text('Customer', marginLeft + 90, y);
      doc.text('Status', marginLeft + 280, y);
      doc.text('Payment', marginLeft + 350, y);
      doc.text('Date', marginLeft + 420, y);
      doc.text('Total', marginLeft + 500, y);
      y += 16;

      filteredOrders.forEach((order) => {
        if (y > 780) {
          doc.addPage();
          y = 50;
        }
        doc.text(String(order.orderNumber || ''), marginLeft, y, { maxWidth: 85 });
        doc.text(String(order.customerName || ''), marginLeft + 90, y, { maxWidth: 180 });
        doc.text(String(order.status || ''), marginLeft + 280, y, { maxWidth: 65 });
        doc.text(String(order.paymentStatus || ''), marginLeft + 350, y, { maxWidth: 65 });
        doc.text(formatDateTime(order.orderDate), marginLeft + 420, y, { maxWidth: 75 });
        doc.text(Number(order.total || 0).toFixed(3), marginLeft + 500, y, { maxWidth: 45, align: 'right' });
        y += 14;
      });

      doc.save('orders.pdf');
    } catch {
      addNotification({ title: 'Export Error', message: 'Unable to export PDF right now.', type: 'error' });
    }
  };

  const handleCancelOrder = (order: GlobalOrder) => {
    if (!canDelete) return;
    if (order.status === 'Cancelled') {
      addNotification({ title: 'Already Cancelled', message: `${order.orderNumber} is already cancelled.`, type: 'warning' });
      return;
    }
    if (!window.confirm(`Cancel order ${order.orderNumber}?`)) return;
    globalUpdateOrder({ ...order, status: 'Cancelled' });
    setActiveActionId(null);
    addNotification({ title: 'Order Cancelled', message: `${order.orderNumber} marked as cancelled.`, type: 'success' });
  };

  const handleApproveOrder = (order: GlobalOrder) => {
    if (!canApprove) return;
    if (order.isApproved) {
      addNotification({ title: 'Already Approved', message: `${order.orderNumber} is already approved.`, type: 'info' });
      return;
    }
    if (order.status === 'Cancelled') {
      addNotification({ title: 'Cannot Approve', message: 'Cancelled orders cannot be approved.', type: 'warning' });
      return;
    }
    if (!window.confirm(`Approve order ${order.orderNumber} for invoicing?`)) return;
    globalUpdateOrder({
      ...order,
      isApproved: true,
      approvedBy: currentUser?.name || 'Admin',
      approvedAt: new Date().toISOString(),
    });
    setActiveActionId(null);
    addNotification({ title: 'Order Approved', message: `${order.orderNumber} approved and ready for invoicing.`, type: 'success' });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">List Orders</h2>
          <p className="text-slate-500 mt-1">Manage fulfillment and delivery orders.</p>
        </div>
        {canAdd && (
          <button
            onClick={() => onNavigate('add-order')}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
          >
            <Plus size={18} /> Create Order
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div
          className="flex items-center gap-2 p-4 cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={16} className="text-indigo-600" />
          <span className="text-sm font-bold text-slate-700">Filters</span>
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </div>

        {showFilters && (
          <div className="p-6 bg-slate-50/50 animate-in slide-in-from-top-2">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <MultiSelect
                label="Delivery Status"
                options={['Pending', 'Processing', 'Ready', 'Shipped', 'Delivered', 'Cancelled']}
                selected={filters.deliveryStatus}
                onChange={(val) => setFilters({ ...filters, deliveryStatus: val })}
              />
              <MultiSelect
                label="Payment Status"
                options={['Paid', 'Due', 'Partial']}
                selected={filters.paymentStatus}
                onChange={(val) => setFilters({ ...filters, paymentStatus: val })}
              />
              <MultiSelect
                label="Approval Status"
                options={['Approved', 'Pending Approval']}
                selected={filters.approvalStatus}
                onChange={(val) => setFilters({ ...filters, approvalStatus: val })}
              />
              <MultiSelect
                label="Sales Person"
                options={salesPersonOptions}
                selected={filters.salesPerson}
                onChange={(val) => setFilters({ ...filters, salesPerson: val })}
              />
              <div className="group">
                <DateRangeFilter onRangeSelect={(nextRange) => setRange(nextRange as DateRangeValue)} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

        <div className="p-5 border-b border-slate-100 bg-white">
          <div className="flex flex-col xl:flex-row justify-between gap-4 items-center">
            <div className="flex items-center gap-3 w-full xl:w-auto">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Show</span>
              <div className="relative">
                <select
                  value={entriesPerPage}
                  onChange={(e) => setEntriesPerPage(Number(e.target.value) || 25)}
                  className="border border-slate-300 bg-white rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none cursor-pointer appearance-none pr-8"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">entries</span>
            </div>

            <div className="flex flex-wrap justify-center gap-2 w-full xl:w-auto">
              <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap">
                <FileText size={14} /> CSV
              </button>
              <button onClick={exportExcel} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap">
                <FileSpreadsheet size={14} /> Excel
              </button>
              <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap">
                <Printer size={14} /> Print
              </button>
              <button onClick={exportPdf} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap">
                <FileText size={14} /> PDF
              </button>
            </div>

            <div className="relative w-full xl:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search order, customer, area..."
                className="w-full xl:w-64 pl-9 pr-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none text-sm placeholder:text-slate-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 w-40">Order No</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Sales Rep</th>
                <th className="px-6 py-4">Area / Location</th>
                <th className="px-6 py-4 text-center">Dates</th>
                <th className="px-6 py-4 text-center">Delivery Status</th>
                <th className="px-6 py-4 text-center">Payment Status</th>
                <th className="px-6 py-4 text-right">Items</th>
                <th className="px-6 py-4 text-right">Total</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedOrders.length > 0 ? (
                paginatedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="font-bold text-indigo-600">{order.orderNumber}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{order.customerName}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone size={10} /> {order.customerPhone || '--'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-700 flex items-center gap-1">
                        <User size={12} className="text-indigo-400" />
                        {order.salesRep}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-700 font-medium">{order.area || '--'}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{order.businessLocation || '--'}</div>
                      {order.driver && (
                        <div className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5 font-medium">
                          <Truck size={10} /> {order.driver}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-xs text-slate-600">
                        <span className="text-slate-400">Ord:</span> {formatDateTime(order.orderDate)}
                      </div>
                      <div className="text-xs font-bold text-slate-700 mt-0.5">
                        <span className="text-slate-400 font-normal">Del:</span> {formatDateTime(order.deliveryDate)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                      {order.isApproved && (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                            <Check size={9} /> Approved
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                        order.paymentStatus === 'Paid'
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                          : order.paymentStatus === 'Partial'
                            ? 'bg-sky-100 text-sky-700 border-sky-200'
                            : 'bg-amber-100 text-amber-700 border-amber-200'
                      }`}>
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-600 font-medium">
                      {order.itemCount}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-slate-800">
                      {formatCurrency(order.total)}
                    </td>
                    <td className="px-6 py-4 text-center relative">
                      <button
                        data-order-action-button
                        onClick={() => setActiveActionId(activeActionId === order.id ? null : order.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <MoreVertical size={18} />
                      </button>

                      {activeActionId === order.id && (
                        <div data-order-action-menu className="absolute right-10 top-2 z-50 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1 text-left animate-in fade-in zoom-in-95 duration-200">
                          <button
                            className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                            onClick={() => {
                              onSelectOrder(order.id);
                              onNavigate('view-order');
                              setActiveActionId(null);
                            }}
                          >
                            <Eye size={14} /> View Order
                          </button>

                          {canEdit && (
                            <button
                              className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                              onClick={() => {
                                onSelectOrder(order.id);
                                onNavigate('edit-order');
                                setActiveActionId(null);
                              }}
                            >
                              <Edit size={14} /> Edit Order
                            </button>
                          )}

                          {canApprove && !order.isApproved && order.status !== 'Cancelled' && (
                            <button
                              className="w-full text-left px-4 py-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2"
                              onClick={() => handleApproveOrder(order)}
                            >
                              <Check size={14} /> Approve Order
                            </button>
                          )}

                          {canGenerateInvoice && order.isApproved && order.status !== 'Cancelled' && (!order.convertedSaleId || !sales.some((sale) => sale.id === order.convertedSaleId)) && (
                            <button
                              className="w-full text-left px-4 py-2.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                              onClick={() => {
                                onSelectOrder(order.id);
                                localStorage.setItem('app_convert_order_id', order.id);
                                onNavigate('convert-order-to-invoice');
                                setActiveActionId(null);
                              }}
                            >
                              <FileCheck size={14} /> Generate Invoice
                            </button>
                          )}

                          {canGenerateInvoice && !order.isApproved && order.status !== 'Cancelled' && !order.convertedSaleId && (
                            <div className="px-4 py-2.5 text-xs text-slate-400 italic flex items-center gap-2">
                              <FileCheck size={14} /> Awaiting Approval
                            </div>
                          )}

                          {canGenerateInvoice && !!order.convertedSaleId && sales.some((sale) => sale.id === order.convertedSaleId) && (
                            <button
                              className="w-full text-left px-4 py-2.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50 flex items-center gap-2"
                              onClick={() => {
                                const convertedSale = sales.find((sale) => sale.id === order.convertedSaleId);
                                if (!convertedSale) {
                                  addNotification({
                                    title: 'Invoice Missing',
                                    message: `Converted invoice for ${order.orderNumber} was not found.`,
                                    type: 'warning',
                                  });
                                  setActiveActionId(null);
                                  return;
                                }
                                onNavigate(`edit-sale/${convertedSale.id}`);
                                setActiveActionId(null);
                              }}
                            >
                              <FileCheck size={14} /> View Invoice
                            </button>
                          )}

                          {canDelete && (
                            <>
                              <div className="h-px bg-slate-100 my-1"></div>
                              <button
                                className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                                onClick={() => handleCancelOrder(order)}
                              >
                                <XCircle size={14} /> Cancel
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-400 italic">
                    No orders matching criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-500 bg-white">
          <div>Showing {showingFrom} to {showingTo} of {totalEntries} entries</div>
          <div className="flex gap-1">
            <button
              className="px-3 py-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safeCurrentPage <= 1}
            >
              Previous
            </button>
            <button className="px-3 py-1.5 bg-indigo-600 text-white rounded shadow-md shadow-indigo-900/10">{safeCurrentPage}</button>
            <button
              className="px-3 py-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safeCurrentPage >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListOrders;
