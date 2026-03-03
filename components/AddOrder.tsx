import React, { useMemo, useState, useEffect } from 'react';
import {
  Save, Plus, Search, Trash2, Truck, CreditCard,
  Info, User, MapPin, Package, Percent, Edit2, UserCheck, Lock, Printer
} from 'lucide-react';
import { useGlobalContext, GlobalOrder, OrderItem } from '../src/context/GlobalContext';

interface AddOrderProps {
  isEdit?: boolean;
  onNavigate?: (page: string) => void;
  orderId?: string;
}

const AddOrder: React.FC<AddOrderProps> = ({ isEdit, onNavigate, orderId }) => {
  const {
    orders,
    customers,
    products,
    currentUser,
    addOrder: globalAddOrder,
    updateOrder: globalUpdateOrder,
    formatCurrency,
    generateId,
  } = useGlobalContext();

  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [salesPerson, setSalesPerson] = useState(currentUser?.name || 'Admin');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 16));
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState('');
  const [status, setStatus] = useState<GlobalOrder['status']>('Pending');
  const [orderType, setOrderType] = useState<GlobalOrder['orderType']>('Paid');
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery');
  const [taxType, setTaxType] = useState('None');
  const [area, setArea] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<OrderItem[]>([{ id: Date.now(), name: '', qty: 1, price: 0, total: 0 }]);
  const [rowProductSearch, setRowProductSearch] = useState<Record<string, string>>({});
  const [rowProductDropdownOpen, setRowProductDropdownOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSalesPerson(currentUser?.name || 'Admin');
  }, [currentUser]);

  useEffect(() => {
    if (!isEdit || !orderId) return;
    const existing = orders.find(o => o.id === orderId);
    if (!existing) return;
    setCustomerId(existing.customerId);
    setCustomerSearch(existing.customerName);
    setCustomerPhone(existing.customerPhone || '');
    setSalesPerson(existing.salesRep || currentUser?.name || 'Admin');
    setOrderDate(existing.orderDate || new Date().toISOString().slice(0, 16));
    setDeliveryDate(existing.deliveryDate || '');
    setDeliveryTimeSlot(existing.deliveryTimeSlot || '');
    setStatus(existing.status);
    setOrderType(existing.orderType);
    setPaymentMethod(existing.paymentMethod || 'Cash on Delivery');
    setTaxType(existing.taxType || 'None');
    setArea(existing.area || '');
    setDeliveryAddress(existing.deliveryAddress || '');
    setNote(existing.note || '');
    setRows(existing.items?.length ? existing.items : [{ id: Date.now(), name: '', qty: 1, price: 0, total: 0 }]);
  }, [isEdit, orderId, orders, currentUser]);

  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === customerId),
    [customers, customerId]
  );

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase();
    return customers.filter(c =>
      c.businessName.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      (c.mobile || '').includes(customerSearch)
    ).slice(0, 15);
  }, [customers, customerSearch]);

  const getFilteredProducts = (search: string) => {
    if (!search) return products.slice(0, 20);
    return products.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 20);
  };

  const handleSelectCustomer = (cust: typeof customers[number]) => {
    setCustomerId(cust.id);
    setCustomerSearch(cust.businessName);
    setCustomerPhone(cust.mobile || '');
    setArea(cust.city || cust.address || '');
    setDeliveryAddress(cust.address || '');
    setShowCustomerDropdown(false);
  };

  const handleAddRow = () => {
    const id = Date.now();
    setRows(prev => [...prev, { id, name: '', qty: 1, price: 0, total: 0 }]);
  };

  const handleRemoveRow = (id: string | number) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleRowChange = (id: string | number, field: 'qty' | 'price', value: string) => {
    const parsed = parseFloat(value) || 0;
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const next = { ...r, [field]: parsed };
      next.total = (next.qty || 0) * (next.price || 0);
      return next;
    }));
  };

  const handleProductSelectForRow = (rowId: string | number, product: typeof products[number]) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const qty = r.qty || 1;
      const price = product.sellingPrice || 0;
      return {
        ...r,
        name: product.name,
        qty,
        price,
        total: qty * price,
      };
    }));
    const key = String(rowId);
    setRowProductSearch(prev => ({ ...prev, [key]: product.name }));
    setRowProductDropdownOpen(prev => ({ ...prev, [key]: false }));
  };

  const subTotal = rows.reduce((acc, row) => acc + row.total, 0);
  const taxAmount = taxType === 'VAT@5%' ? subTotal * 0.05 : 0;
  const totalAmount = subTotal + taxAmount;

  const generateOrderNumber = () => {
    const d = new Date();
    const datePart = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const dailyCount = orders.filter(o => o.orderDate?.slice(0, 10) === d.toISOString().slice(0, 10)).length + 1;
    return `ORD-${datePart}-${String(dailyCount).padStart(4, '0')}`;
  };

  const handleSave = () => {
    const cleanItems = rows.filter(r => r.name && r.qty > 0);
    if (!customerId || cleanItems.length === 0 || !deliveryDate) return;

    const paymentStatus: GlobalOrder['paymentStatus'] = orderType === 'Credit' ? 'Due' : 'Paid';
    const existing = isEdit && orderId ? orders.find(o => o.id === orderId) : null;
    const built: GlobalOrder = {
      id: existing?.id || generateId('ORD-'),
      orderNumber: existing?.orderNumber || generateOrderNumber(),
      customerId,
      customerName: selectedCustomer?.businessName || customerSearch,
      customerPhone: customerPhone || selectedCustomer?.mobile || '',
      orderDate,
      deliveryDate,
      deliveryTimeSlot: deliveryTimeSlot || undefined,
      status,
      paymentStatus,
      orderType,
      paymentMethod: orderType === 'Paid' ? paymentMethod : undefined,
      source: existing?.source || 'POS',
      items: cleanItems.map(i => ({
        id: i.id,
        name: i.name,
        qty: Number(i.qty || 0),
        price: Number(i.price || 0),
        total: Number(i.total || 0),
      })),
      itemCount: cleanItems.length,
      subTotal,
      taxType,
      taxAmount,
      total: totalAmount,
      driver: existing?.driver,
      area: area || selectedCustomer?.city || selectedCustomer?.address || '',
      salesRep: salesPerson,
      deliveryAddress,
      note,
      addedBy: currentUser?.name || 'Admin',
    };

    if (isEdit) {
      globalUpdateOrder(built);
    } else {
      globalAddOrder(built);
    }

    onNavigate?.('list-orders');
  };

  return (
    <div className="space-y-8 animate-fade-in pb-32 max-w-[1600px] mx-auto">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          {isEdit ? <Edit2 className="text-indigo-600" size={32} /> : <Truck className="text-indigo-600" size={32} />}
          {isEdit ? 'Edit Order' : 'Create Order'}
        </h2>
        <p className="text-slate-500 mt-1 text-lg">
          {isEdit ? 'Modify details of existing order.' : 'New fulfillment request for delivery or pickup.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-blue-500"></div>
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <User size={20} className="text-indigo-500" /> Customer & Schedule
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="group md:col-span-2 relative">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Customer <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <div className="relative w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold text-slate-700 placeholder:font-normal"
                      placeholder="Search customer by name or mobile..."
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setShowCustomerDropdown(true);
                        if (e.target.value === '') {
                          setCustomerId('');
                          setCustomerPhone('');
                        }
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                    />
                    {showCustomerDropdown && (
                      <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-slate-100 z-50 max-h-64 overflow-y-auto">
                        {filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                          <div
                            key={c.id}
                            className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                            onMouseDown={() => handleSelectCustomer(c)}
                          >
                            <div className="text-sm font-bold text-slate-800">{c.businessName}</div>
                            <div className="text-xs text-slate-500">{c.name} {c.mobile ? `- ${c.mobile}` : ''}</div>
                          </div>
                        )) : (
                          <div className="px-4 py-3 text-sm text-slate-400">No customers found</div>
                        )}
                      </div>
                    )}
                  </div>
                  <button type="button" className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md transition-transform active:scale-95"><Plus size={20} /></button>
                </div>
              </div>

              <div className="group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Sales Person</label>
                <div className="relative">
                  <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600" size={18} />
                  <input
                    type="text"
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-emerald-50/50 border-emerald-100 text-sm font-bold text-emerald-800 cursor-not-allowed focus:ring-0"
                    value={salesPerson}
                    readOnly
                  />
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400 opacity-50" size={14} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                  <Info size={10} /> Logged in account
                </p>
              </div>

              <div className="group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Order Type</label>
                <select
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium text-slate-700 cursor-pointer"
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value as GlobalOrder['orderType'])}
                >
                  <option value="Paid">Standard (Paid)</option>
                  <option value="Credit">Credit Order</option>
                </select>
              </div>

              <div className="group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Order Date</label>
                <input
                  type="datetime-local"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium text-slate-700"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                />
              </div>

              <div className="group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Delivery Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium text-slate-700"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>

              <div className="group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Time Slot</label>
                <select
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium text-slate-700 cursor-pointer"
                  value={deliveryTimeSlot}
                  onChange={(e) => setDeliveryTimeSlot(e.target.value)}
                >
                  <option value="">Any Time</option>
                  <option value="morning">Morning (9am - 12pm)</option>
                  <option value="afternoon">Afternoon (12pm - 4pm)</option>
                  <option value="evening">Evening (4pm - 8pm)</option>
                </select>
              </div>

              <div className="group">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Status</label>
                <select
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium text-slate-700 cursor-pointer"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as GlobalOrder['status'])}
                >
                  <option value="Pending">Pending</option>
                  <option value="Processing">Processing</option>
                  <option value="Ready">Ready</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Package size={20} className="text-indigo-500" /> Order Items
            </h3>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center">#</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3 w-24 text-center">Qty</th>
                    <th className="px-4 py-3 w-32 text-right">Price</th>
                    <th className="px-4 py-3 w-40 text-right">Total</th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, index) => {
                    const rowKey = String(row.id);
                    const prodSearch = rowProductSearch[rowKey] ?? row.name;
                    const prodDropOpen = rowProductDropdownOpen[rowKey] ?? false;
                    const filteredProds = getFilteredProducts(prodSearch && prodSearch !== row.name ? prodSearch : '');
                    return (
                      <tr key={String(row.id)} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-center text-slate-400">{index + 1}</td>
                        <td className="px-4 py-3 font-bold text-slate-800 relative min-w-[260px]">
                          <input
                            type="text"
                            value={prodSearch}
                            placeholder="Search product by name or SKU..."
                            onFocus={() => setRowProductDropdownOpen(prev => ({ ...prev, [rowKey]: true }))}
                            onChange={(e) => {
                              setRowProductSearch(prev => ({ ...prev, [rowKey]: e.target.value }));
                              setRowProductDropdownOpen(prev => ({ ...prev, [rowKey]: true }));
                            }}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white"
                          />
                          {prodDropOpen && (
                            <div className="absolute left-4 right-4 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-56 overflow-y-auto">
                              {filteredProds.length > 0 ? filteredProds.map(p => (
                                <div
                                  key={p.id}
                                  className="px-3 py-2 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0"
                                  onMouseDown={() => handleProductSelectForRow(row.id, p)}
                                >
                                  <div className="font-bold text-sm text-slate-800">{p.name}</div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">SKU: {p.sku} - Price: {formatCurrency(p.sellingPrice)}</div>
                                </div>
                              )) : (
                                <div className="px-3 py-4 text-center text-slate-400 text-sm">No products found</div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={row.qty}
                            onChange={(e) => handleRowChange(row.id, 'qty', e.target.value)}
                            className="w-full text-center bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={row.price}
                            onChange={(e) => handleRowChange(row.id, 'price', e.target.value)}
                            className="w-full text-right bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none"
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-800">{formatCurrency(row.total || 0)}</td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => handleRemoveRow(row.id)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={handleAddRow}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
            >
              <Plus size={14} /> Add Row
            </button>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              <MapPin size={16} className="text-indigo-500" /> Delivery Address
            </h3>
            <div className="space-y-4">
              <textarea
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium text-slate-700 resize-none"
                rows={3}
                placeholder="Full Address..."
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
              />
              <input
                type="text"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium text-slate-700"
                placeholder="City / Area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              />
              <textarea
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-medium text-slate-700 resize-none"
                rows={2}
                placeholder="Order note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              <CreditCard size={16} className="text-indigo-500" /> Payment & Tax
            </h3>

            <div className="space-y-4 mb-6">
              {orderType === 'Paid' && (
                <div className="group">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Payment Method</label>
                  <select
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold text-slate-700 cursor-pointer"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option>Cash on Delivery</option>
                    <option>Card on Delivery</option>
                    <option>Bank Transfer</option>
                    <option>Prepaid (Online)</option>
                  </select>
                </div>
              )}

              {orderType === 'Credit' && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2">
                  <Info size={16} className="text-amber-600 mt-0.5" />
                  <div className="text-xs text-amber-800">
                    <span className="font-bold">Credit Order:</span> Payment will be recorded as Due.
                  </div>
                </div>
              )}

              <div className="group">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Applicable Tax</label>
                <div className="relative">
                  <Percent size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold text-slate-700 cursor-pointer"
                    value={taxType}
                    onChange={(e) => setTaxType(e.target.value)}
                  >
                    <option value="None">None</option>
                    <option value="VAT@5%">VAT @ 5%</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-2">
              <div className="flex justify-between text-sm text-slate-500 font-medium">
                <span>Subtotal</span>
                <span>{formatCurrency(subTotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500 font-medium">
                <span>Tax</span>
                <span className={taxAmount > 0 ? 'text-slate-800 font-bold' : ''}>{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between text-xl font-black text-slate-900 pt-2 border-t border-slate-100 mt-2">
                <span>Total</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-slate-900/90 backdrop-blur-md text-white px-3 py-2.5 rounded-full shadow-2xl flex items-center gap-3 border border-white/10 hover:scale-105 transition-transform duration-300">
        <button onClick={() => handleSave()} className="px-6 py-2.5 rounded-full font-bold text-xs bg-indigo-600 hover:bg-indigo-500 shadow-lg transition flex items-center gap-2">
          <Save size={16} /> {isEdit ? 'Update Order' : 'Save Order'}
        </button>
        <button onClick={() => handleSave()} className="px-6 py-2.5 rounded-full font-bold text-xs bg-emerald-600 hover:bg-emerald-500 shadow-lg transition flex items-center gap-2">
          <Printer size={16} /> Save & Print
        </button>
      </div>
    </div>
  );
};

export default AddOrder;
