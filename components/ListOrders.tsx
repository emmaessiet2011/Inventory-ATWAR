import React, { useState } from 'react';
import {
  Plus, Search, FileText, FileSpreadsheet, Printer,
  Eye, MoreVertical, Filter, ChevronDown, Truck, Phone,
  Edit, FileCheck, User, XCircle
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import MultiSelect from './MultiSelect';
import { useGlobalContext, GlobalOrder } from '../src/context/GlobalContext';

interface ListOrdersProps {
  onNavigate: (page: string) => void;
  onSelectOrder: (id: string) => void;
}

const ListOrders: React.FC<ListOrdersProps> = ({ onNavigate, onSelectOrder }) => {
  const {
    orders: globalOrders,
    users,
    updateOrder: globalUpdateOrder,
    formatCurrency,
  } = useGlobalContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    deliveryStatus: [] as string[],
    paymentStatus: [] as string[],
    salesPerson: [] as string[],
  });

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

  const filteredOrders = globalOrders.filter((o: GlobalOrder) =>
    (
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.area.toLowerCase().includes(searchTerm.toLowerCase())
    ) &&
    (filters.deliveryStatus.length === 0 || filters.deliveryStatus.includes(o.status)) &&
    (filters.paymentStatus.length === 0 || filters.paymentStatus.includes(o.paymentStatus)) &&
    (filters.salesPerson.length === 0 || filters.salesPerson.includes(o.salesRep))
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">List Orders</h2>
          <p className="text-slate-500 mt-1">Manage fulfillment and delivery orders.</p>
        </div>
        <button
          onClick={() => onNavigate('add-order')}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
        >
          <Plus size={18} /> Create Order
        </button>
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                label="Sales Person"
                options={users.map(u => u.name)}
                selected={filters.salesPerson}
                onChange={(val) => setFilters({ ...filters, salesPerson: val })}
              />
              <div className="group">
                <DateRangeFilter />
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
                <select className="border border-slate-300 bg-white rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none cursor-pointer appearance-none pr-8">
                  <option>25</option>
                  <option>50</option>
                  <option>100</option>
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">entries</span>
            </div>

            <div className="flex flex-wrap justify-center gap-2 w-full xl:w-auto">
              {[
                { icon: FileSpreadsheet, label: 'Excel' },
                { icon: Printer, label: 'Print' },
                { icon: FileText, label: 'PDF' },
              ].map((action, i) => (
                <button key={i} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm whitespace-nowrap">
                  <action.icon size={14} /> {action.label}
                </button>
              ))}
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
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Items</th>
                <th className="px-6 py-4 text-right">Total</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
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
                      <div className="text-slate-700 font-medium">{order.area}</div>
                      {order.driver && (
                        <div className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5 font-medium">
                          <Truck size={10} /> {order.driver}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-xs text-slate-600">
                        <span className="text-slate-400">Ord:</span> {order.orderDate}
                      </div>
                      <div className="text-xs font-bold text-slate-700 mt-0.5">
                        <span className="text-slate-400 font-normal">Del:</span> {order.deliveryDate}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${getStatusColor(order.status)}`}>
                        {order.status}
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
                        onClick={() => setActiveActionId(activeActionId === order.id ? null : order.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <MoreVertical size={18} />
                      </button>

                      {activeActionId === order.id && (
                        <div className="absolute right-10 top-2 z-50 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1 text-left animate-in fade-in zoom-in-95 duration-200">
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
                          <div className="h-px bg-slate-100 my-1"></div>
                          <button
                            className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                            onClick={() => {
                              globalUpdateOrder({ ...order, status: 'Cancelled' });
                              setActiveActionId(null);
                            }}
                          >
                            <XCircle size={14} /> Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400 italic">
                    No orders matching criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-500 bg-white">
          <div>Showing 1 to {filteredOrders.length} of {filteredOrders.length} entries</div>
          <div className="flex gap-1">
            <button className="px-3 py-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm" disabled>Previous</button>
            <button className="px-3 py-1.5 bg-indigo-600 text-white rounded shadow-md shadow-indigo-900/10">1</button>
            <button className="px-3 py-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-700 transition disabled:opacity-50 shadow-sm" disabled>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListOrders;
