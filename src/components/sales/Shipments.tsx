import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUpDown,
  ChevronDown,
  Edit,
  Eye,
  Filter,
  Package,
  Printer,
  ScrollText,
  Search,
  X,Truck} from 'lucide-react';
import DateRangeFilter from '@/components/shared/DateRangeFilter';
import MultiSelect from '@/components/shared/MultiSelect';
import DeliveryNote from '@/components/shipping/DeliveryNote';
import EditShippingModal from '@/components/shipping/EditShippingModal';
import PackingSlip from '@/components/shipping/PackingSlip';
import ViewSaleDetails from './ViewSaleDetails';
import { Sale as GlobalSale, ShippingStatus, useGlobalContext } from '@/context/GlobalContext';
import { formatDateTimeBySettings } from '@/utils/dateTime';
import { useNotifications } from '@/context/NotificationContext';
import { findLocationByIdOrName, notifyReceiptPrintFallback } from '@/utils/receiptPrinting';

interface ShipmentsProps {
  onNavigate: (page: string) => void;
}

interface DateRangeSelection {
  startDate: Date | null;
  endDate: Date | null;
  label: string;
}

interface DropdownPosition {
  top?: number;
  bottom?: number;
  left: number;
  transformOrigin: string;
  maxHeight?: number;
}

type PaymentStatus = NonNullable<GlobalSale['paymentStatus']>;

interface ShipmentRow {
  id: string;
  date: string;
  invoiceNo: string;
  customerName: string;
  contactNumber: string;
  location: string;
  deliveryPerson: string;
  shippingStatus: ShippingStatus;
  paymentStatus: PaymentStatus;
  addedBy: string;
}

const Shipments: React.FC<ShipmentsProps> = ({ onNavigate: _onNavigate }) => {
  const { addNotification } = useNotifications();
  const {
    sales: globalSales,
    locations,
    printers,
    users,
    settings,
    currentUser,
    roles,
    updateSale: globalUpdateSale,
  } = useGlobalContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState({
    location: [] as string[],
    customer: [] as string[],
    user: [] as string[],
    paymentStatus: [] as string[],
    shippingStatus: [] as string[],
    deliveryPerson: [] as string[],
  });

  const [dateRange, setDateRange] = useState<DateRangeSelection>(() => {
    const now = new Date();
    return {
      startDate: new Date(now.getFullYear(), 0, 1),
      endDate: new Date(now.getFullYear(), 11, 31),
      label: 'This Year',
    };
  });

  const [entriesPerPage, setEntriesPerPage] = useState<number>(Number(settings.defaultTableEntries || 25));
  const [currentPage, setCurrentPage] = useState(1);

  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({
    top: 0,
    left: 0,
    transformOrigin: 'origin-top-left',
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [invoiceAutoPrintRequestId, setInvoiceAutoPrintRequestId] = useState<string | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editShippingModalOpen, setEditShippingModalOpen] = useState(false);
  const [packingSlipModalOpen, setPackingSlipModalOpen] = useState(false);
  const [deliveryNoteModalOpen, setDeliveryNoteModalOpen] = useState(false);

  const isFinalizedSale = (sale?: GlobalSale | null): boolean =>
    !!sale && ((sale.status || sale.saleStatus || '').trim() === 'Final');

  const currentRoleRecord = roles.find(r => r.name === currentUser?.role);
  const rolePermissions = currentRoleRecord?.permissions || [];
  const roleHasExplicitPermissions = rolePermissions.length > 0;
  const hasRolePermission = (moduleName: string, permission: string) => {
    if (!currentUser) return false;
    if (String(currentUser.role || '').toLowerCase() === 'admin' || currentRoleRecord?.isSystem) return true;
    if (!roleHasExplicitPermissions) return true;
    return (
      rolePermissions.includes(permission) ||
      rolePermissions.includes(`${moduleName}::${permission}`)
    );
  };
  const canAccessAllShipments = hasRolePermission('Shipments', 'Access all shipments');
  const canAccessOwnShipments = hasRolePermission('Shipments', 'Access own shipments');
  const canAccessPendingShipmentsOnly = hasRolePermission('Shipments', 'Access pending shipments only');
  const canAccessCommissionAgentOwnShipments = hasRolePermission('Shipments', 'Commission agent can access their own shipments');
  const canAccessShipments =
    canAccessAllShipments ||
    canAccessOwnShipments ||
    canAccessPendingShipmentsOnly ||
    canAccessCommissionAgentOwnShipments;

  const parseDateValue = (value?: string): Date | null => {
    if (!value) return null;
    const dmyWithTime = value.match(
      /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?$/i
    );
    if (dmyWithTime) {
      const day = Number(dmyWithTime[1]);
      const month = Number(dmyWithTime[2]) - 1;
      const year = Number(dmyWithTime[3]);
      const rawHour = Number(dmyWithTime[4] || 0);
      const minute = Number(dmyWithTime[5] || 0);
      const ampm = (dmyWithTime[6] || '').toUpperCase();
      const hour24 = ampm ? ((rawHour % 12) + (ampm === 'PM' ? 12 : 0)) : rawHour;
      const parsed = new Date(year, month, day, hour24, minute);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatDateTimeDisplay = (value?: string): string => {
    return formatDateTimeBySettings(
      value,
      settings.dateFormat,
      settings.timeFormat,
      settings.timeZone
    );
  };

  const shipments = useMemo<ShipmentRow[]>(
    () => globalSales
      .filter(isFinalizedSale)
      .map(sale => ({
        id: sale.id,
        date: sale.date || '',
        invoiceNo: sale.invoiceNo || '--',
        customerName: sale.customerName || 'Walk-in Customer',
        contactNumber: sale.contactNumber || '--',
        location: sale.location || '--',
        deliveryPerson: sale.deliveryPerson || '',
        shippingStatus: (sale.shippingStatus || 'Ordered') as ShippingStatus,
        paymentStatus: (sale.paymentStatus || 'Due') as PaymentStatus,
        addedBy: sale.addedBy || '--',
      })),
    [globalSales]
  );

  const saleById = useMemo(
    () => new Map(globalSales.map(sale => [sale.id, sale])),
    [globalSales]
  );
  const scopedShipments = useMemo(
    () => shipments.filter(ship => {
      if (canAccessAllShipments) return true;

      const currentUserName = String(currentUser?.name || '').trim().toLowerCase();
      const currentUserId = String(currentUser?.id || '').trim().toLowerCase();
      if (canAccessOwnShipments && currentUserName.length > 0) {
        const addedBy = String(ship.addedBy || '').trim().toLowerCase();
        if (addedBy === currentUserName) return true;
      }

      if (canAccessPendingShipmentsOnly && ship.shippingStatus === 'Pending') {
        return true;
      }

      if (canAccessCommissionAgentOwnShipments) {
        const sale = saleById.get(ship.id);
        const commissionAgentName = String(sale?.commissionAgentName || '').trim().toLowerCase();
        const commissionAgentId = String(sale?.commissionAgentId || '').trim().toLowerCase();
        if (
          (currentUserName.length > 0 && commissionAgentName === currentUserName) ||
          (currentUserId.length > 0 && commissionAgentId === currentUserId)
        ) {
          return true;
        }
      }

      return false;
    }),
    [
      shipments,
      canAccessAllShipments,
      canAccessOwnShipments,
      canAccessPendingShipmentsOnly,
      canAccessCommissionAgentOwnShipments,
      currentUser?.name,
      currentUser?.id,
      saleById,
    ]
  );

  const locationOptions = useMemo(
    () => Array.from(new Set([...locations.map(loc => loc.name), ...scopedShipments.map(ship => ship.location)])).filter(Boolean).sort(),
    [locations, scopedShipments]
  );
  const customerOptions = useMemo(
    () => Array.from(new Set(scopedShipments.map(ship => ship.customerName))).filter(Boolean).sort(),
    [scopedShipments]
  );
  const userOptions = useMemo(
    () => Array.from(new Set([...users.map(user => user.name), ...scopedShipments.map(ship => ship.addedBy)])).filter(Boolean).sort(),
    [users, scopedShipments]
  );
  const paymentStatusOptions = useMemo(
    () => Array.from(new Set(scopedShipments.map(ship => ship.paymentStatus))).filter(Boolean).sort(),
    [scopedShipments]
  );
  const shippingStatusOptions = useMemo(
    () => Array.from(new Set(scopedShipments.map(ship => ship.shippingStatus))).filter(Boolean).sort(),
    [scopedShipments]
  );
  const deliveryPersonOptions = useMemo(
    () => Array.from(new Set([...scopedShipments.map(ship => ship.deliveryPerson), ...users.map(user => user.name)])).filter(Boolean).sort(),
    [scopedShipments, users]
  );

  const filteredShipments = useMemo(
    () => scopedShipments.filter(ship => {
      const normalizedSearch = searchTerm.trim().toLowerCase();
      const textMatch = normalizedSearch.length === 0 || (
        ship.invoiceNo.toLowerCase().includes(normalizedSearch) ||
        ship.customerName.toLowerCase().includes(normalizedSearch) ||
        ship.contactNumber.toLowerCase().includes(normalizedSearch) ||
        ship.location.toLowerCase().includes(normalizedSearch) ||
        ship.deliveryPerson.toLowerCase().includes(normalizedSearch)
      );

      const filterMatch =
        (filters.location.length === 0 || filters.location.includes(ship.location)) &&
        (filters.customer.length === 0 || filters.customer.includes(ship.customerName)) &&
        (filters.user.length === 0 || filters.user.includes(ship.addedBy)) &&
        (filters.paymentStatus.length === 0 || filters.paymentStatus.includes(ship.paymentStatus)) &&
        (filters.shippingStatus.length === 0 || filters.shippingStatus.includes(ship.shippingStatus)) &&
        (filters.deliveryPerson.length === 0 || filters.deliveryPerson.includes(ship.deliveryPerson));

      const dateMatch = (() => {
        if (!dateRange.startDate || !dateRange.endDate) return true;
        const shipDate = parseDateValue(ship.date);
        if (!shipDate) return false;
        const rangeStart = new Date(dateRange.startDate);
        rangeStart.setHours(0, 0, 0, 0);
        const rangeEnd = new Date(dateRange.endDate);
        rangeEnd.setHours(23, 59, 59, 999);
        return shipDate >= rangeStart && shipDate <= rangeEnd;
      })();

      return textMatch && filterMatch && dateMatch;
    }),
    [scopedShipments, searchTerm, filters, dateRange]
  );

  const sortedShipments = useMemo(
    () => [...filteredShipments].sort((a, b) => {
      const ad = parseDateValue(a.date)?.getTime() || 0;
      const bd = parseDateValue(b.date)?.getTime() || 0;
      return bd - ad;
    }),
    [filteredShipments]
  );

  const totalPages = Math.max(1, Math.ceil(sortedShipments.length / entriesPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * entriesPerPage;
  const pageEnd = pageStart + entriesPerPage;
  const pagedShipments = sortedShipments.slice(pageStart, pageEnd);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, dateRange, entriesPerPage]);

  useEffect(() => {
    const parsed = Number(settings.defaultTableEntries || 25);
    if (Number.isFinite(parsed) && parsed > 0) {
      setEntriesPerPage(parsed);
    }
  }, [settings.defaultTableEntries]);

  const toggleActions = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    if (activeActionId === id) {
      setActiveActionId(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const desiredHeight = 260;
    const isDropUp = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
    const maxHeight = isDropUp
      ? Math.min(desiredHeight, spaceAbove - 20)
      : Math.min(desiredHeight, spaceBelow - 20);

    setDropdownPosition({
      top: isDropUp ? undefined : rect.bottom + 6,
      bottom: isDropUp ? window.innerHeight - rect.top + 6 : undefined,
      left: rect.left,
      transformOrigin: isDropUp ? 'origin-bottom-left' : 'origin-top-left',
      maxHeight,
    });
    setActiveActionId(id);
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) return;
      setActiveActionId(null);
    };
    const handleScroll = () => setActiveActionId(null);
    const handleResize = () => setActiveActionId(null);

    if (activeActionId) {
      window.addEventListener('mousedown', handleOutsideClick);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
    }

    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [activeActionId]);

  const selectedSale = useMemo(
    () => (selectedSaleId ? globalSales.find(sale => sale.id === selectedSaleId) || null : null),
    [selectedSaleId, globalSales]
  );
  const activeShipment = useMemo(
    () => (activeActionId ? scopedShipments.find(ship => ship.id === activeActionId) || null : null),
    [activeActionId, scopedShipments]
  );

  const handleView = (saleId: string) => {
    setSelectedSaleId(saleId);
    setInvoiceAutoPrintRequestId(null);
    setViewModalOpen(true);
    setActiveActionId(null);
  };
  const handleEditShipping = (saleId: string) => {
    setSelectedSaleId(saleId);
    setEditShippingModalOpen(true);
    setActiveActionId(null);
  };
  const handlePrintInvoice = (saleId: string) => {
    const sale = globalSales.find(row => row.id === saleId);
    const saleLocation = findLocationByIdOrName(locations, sale?.location);
    notifyReceiptPrintFallback({
      location: saleLocation,
      printers,
      addNotification,
      documentLabel: 'Invoice',
    });
    setSelectedSaleId(saleId);
    setViewModalOpen(true);
    setInvoiceAutoPrintRequestId(`${saleId}-${Date.now()}`);
    setActiveActionId(null);
  };
  const handlePackingSlip = (saleId: string) => {
    setSelectedSaleId(saleId);
    setPackingSlipModalOpen(true);
    setActiveActionId(null);
  };
  const handleDeliveryNote = (saleId: string) => {
    setSelectedSaleId(saleId);
    setDeliveryNoteModalOpen(true);
    setActiveActionId(null);
  };

  const shippingStatusClass = (status: ShippingStatus) => {
    if (status === 'Delivered') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'Cancelled') return 'bg-rose-50 text-rose-700 border-rose-200';
    if (status === 'Shipped') return 'bg-sky-50 text-sky-700 border-sky-200';
    if (status === 'Packed') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (status === 'Pending') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-50 text-slate-600 border-slate-200';
  };

  const paymentStatusClass = (status: PaymentStatus) => {
    if (status === 'Paid') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'Partial') return 'bg-sky-50 text-sky-700 border-sky-200';
    if (status === 'Overdue') return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-orange-50 text-orange-700 border-orange-200';
  };

  if (!canAccessShipments) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400">
        <h2 className="text-2xl font-bold text-slate-300 mb-2">Access Denied</h2>
        <p>You do not have permission to access Shipments.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-16 print:p-0">
      <div className="flex items-center gap-4">
        <div className="p-2.5 bg-blue-600 rounded-2xl shadow-md">
          <Truck size={24} className="text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Shipments</h2>
          <p className="text-slate-500 text-sm mt-0.5">Track delivery status and shipping details</p>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600 rounded-t-[2rem]"></div>
        <div
          className="flex items-center gap-2 cursor-pointer text-slate-600 mb-4"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={16} />
          <span className="text-sm font-medium">Filters</span>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
            <MultiSelect label="Business Location" options={locationOptions} selected={filters.location} onChange={(val) => setFilters({ ...filters, location: val })} />
            <MultiSelect label="Customer" options={customerOptions} selected={filters.customer} onChange={(val) => setFilters({ ...filters, customer: val })} />
            <DateRangeFilter onRangeSelect={(range) => setDateRange(range)} />
            <MultiSelect label="User" options={userOptions} selected={filters.user} onChange={(val) => setFilters({ ...filters, user: val })} />
            <MultiSelect label="Payment Status" options={paymentStatusOptions} selected={filters.paymentStatus} onChange={(val) => setFilters({ ...filters, paymentStatus: val })} />
            <MultiSelect label="Shipping Status" options={shippingStatusOptions} selected={filters.shippingStatus} onChange={(val) => setFilters({ ...filters, shippingStatus: val })} />
            <MultiSelect label="Delivery Person" options={deliveryPersonOptions} selected={filters.deliveryPerson} onChange={(val) => setFilters({ ...filters, deliveryPerson: val })} />
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-800 to-slate-600 rounded-t-[2rem]"></div>
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Show</span>
            <select
              value={entriesPerPage}
              onChange={(e) => {
                const val = Number(e.target.value);
                setEntriesPerPage(Number.isFinite(val) && val > 0 ? val : 25);
              }}
              className="px-3 py-2 rounded-xl border-0 bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 text-sm font-medium focus:outline-none"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-slate-600">entries</span>
          </div>

          <div className="relative w-full md:w-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full md:w-64 pl-9 pr-4 py-2.5 rounded-xl border-0 bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-medium text-slate-700"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-white text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Action</th>
                <th className="px-4 py-3 whitespace-nowrap">Date <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Invoice No. <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Customer name <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Contact Number <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Location <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Delivery Person <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Shipping Status <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Payment Status <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedShipments.length > 0 ? (
                pagedShipments.map((ship) => (
                  <tr key={ship.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => toggleActions(e, ship.id)}
                        className={`font-bold flex items-center justify-center gap-1 mx-auto px-2 py-1 rounded border transition-colors ${
                          activeActionId === ship.id
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'text-blue-600 bg-blue-50 border-blue-100 hover:bg-blue-100'
                        }`}
                      >
                        Actions <ChevronDown size={10} />
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTimeDisplay(ship.date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{ship.invoiceNo}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{ship.customerName}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{ship.contactNumber}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-[10px] text-slate-500">{ship.location}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{ship.deliveryPerson || '--'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${shippingStatusClass(ship.shippingStatus)}`}>
                        {ship.shippingStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${paymentStatusClass(ship.paymentStatus)}`}>
                        {ship.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400 italic">
                    No shipments found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <div>
            {sortedShipments.length === 0
              ? 'Showing 0 to 0 of 0 entries'
              : `Showing ${pageStart + 1} to ${Math.min(pageEnd, sortedShipments.length)} of ${sortedShipments.length} entries`}
          </div>
          <div className="flex gap-1">
            <button
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            >
              Previous
            </button>
            <button className="px-4 py-2 bg-slate-900 text-white rounded-lg shadow-sm">{safeCurrentPage}</button>
            <button
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {activeActionId && activeShipment && createPortal(
        <div
          ref={dropdownRef}
          className={`fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-100 w-64 max-w-[calc(100vw-2rem)] animate-in fade-in zoom-in-95 duration-200 overflow-y-auto ${dropdownPosition.transformOrigin}`}
          style={{
            top: dropdownPosition.top,
            bottom: dropdownPosition.bottom,
            left: dropdownPosition.left,
            maxHeight: dropdownPosition.maxHeight,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-2.5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Invoice #{activeShipment.invoiceNo.split('-').pop() || '--'}
            </span>
            <button onClick={() => setActiveActionId(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={14} />
            </button>
          </div>
          <div className="py-1">
            <button className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors" onClick={() => handleView(activeShipment.id)}>
              <Eye size={14} className="text-slate-400" /> View
            </button>
            <button className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors" onClick={() => handleEditShipping(activeShipment.id)}>
              <Edit size={14} className="text-slate-400" /> Edit Shipping
            </button>
            <button className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors" onClick={() => handlePrintInvoice(activeShipment.id)}>
              <Printer size={14} className="text-slate-400" /> Print Invoice
            </button>
            <button className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors" onClick={() => handlePackingSlip(activeShipment.id)}>
              <Package size={14} className="text-slate-400" /> Packing Slip
            </button>
            <button className="w-full text-left px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors" onClick={() => handleDeliveryNote(activeShipment.id)}>
              <ScrollText size={14} className="text-slate-400" /> Delivery Note
            </button>
          </div>
        </div>,
        document.body
      )}

      {viewModalOpen && (
        <ViewSaleDetails
          isOpen={viewModalOpen}
          onClose={() => {
            setViewModalOpen(false);
            setInvoiceAutoPrintRequestId(null);
          }}
          saleId={selectedSaleId}
          autoPrintRequestId={invoiceAutoPrintRequestId}
          onOpenPackingSlip={() => {
            setViewModalOpen(false);
            setInvoiceAutoPrintRequestId(null);
            setPackingSlipModalOpen(true);
          }}
        />
      )}

      {editShippingModalOpen && (
        <EditShippingModal
          isOpen={editShippingModalOpen}
          onClose={() => setEditShippingModalOpen(false)}
          sale={selectedSale}
          onSave={(updatedSale) => globalUpdateSale(updatedSale)}
        />
      )}

      {packingSlipModalOpen && (
        <PackingSlip
          onClose={() => setPackingSlipModalOpen(false)}
          invoiceNo={selectedSale?.invoiceNo}
          date={selectedSale?.date}
          sale={selectedSale || undefined}
        />
      )}

      {deliveryNoteModalOpen && (
        <DeliveryNote
          onClose={() => setDeliveryNoteModalOpen(false)}
          invoiceNo={selectedSale?.invoiceNo}
          date={selectedSale?.date}
          sale={selectedSale || undefined}
        />
      )}
    </div>
  );
};

export default Shipments;
