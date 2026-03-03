import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, Plus, Calendar, Search, Trash2, 
  ChevronDown, FileText, Truck, CreditCard, 
  DollarSign, Info, Upload, User, MapPin, 
  ShoppingCart, Calculator, AlertCircle, X, Printer,
  Briefcase, Eye, Check, Link
} from 'lucide-react';

interface AddDraftProps {
    onNavigate?: (page: string) => void;
}

const AddDraft: React.FC<AddDraftProps> = ({ onNavigate }) => {
  // --- General Info State ---
  const [customer, setCustomer] = useState('');
  const [payTerm, setPayTerm] = useState('Please Select');
  const [saleDate, setSaleDate] = useState('2026-02-11T10:01');
  const [status, setStatus] = useState('Draft');
  const [invoiceScheme, setInvoiceScheme] = useState('Default');
  
  // --- Customer Search State ---
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [selectedCustomerObj, setSelectedCustomerObj] = useState<any>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Mock Customers Data
  const mockCustomers = [
      { id: '1', name: 'Direct Customer', phone: '', type: 'Individual' },
      { id: '2', name: 'Al Maha Hypermarket', phone: '+968 9911 2233', type: 'Business' },
      { id: '3', name: 'Happy Pets Shop', phone: '+968 9888 7777', type: 'Business' },
  ];

  // --- Product Grid State ---
  const [rows, setRows] = useState<any[]>([]); // Start empty as per screenshot

  // --- Bottom Section State ---
  const [discountType, setDiscountType] = useState('Percentage');
  const [discountAmount, setDiscountAmount] = useState<number | ''>(0);
  const [orderTax, setOrderTax] = useState('None');
  const [sellNote, setSellNote] = useState('');
  
  // --- Shipping State ---
  const [shippingDetails, setShippingDetails] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCharges, setShippingCharges] = useState<number | ''>(0);
  const [shippingStatus, setShippingStatus] = useState('Please Select');
  const [deliveredTo, setDeliveredTo] = useState('');
  const [deliveryPerson, setDeliveryPerson] = useState('Please Select');

  // --- Calculations ---
  const subTotal = rows.reduce((acc, row) => acc + row.total, 0);
  const totalItems = rows.reduce((acc, row) => acc + row.qty, 0);

  const calculateGrandTotal = () => {
      let total = subTotal;
      
      // Discount
      if (discountType === 'Fixed' && typeof discountAmount === 'number') {
          total -= discountAmount;
      } else if (discountType === 'Percentage' && typeof discountAmount === 'number') {
          total -= (total * (discountAmount / 100));
      }

      // Order Tax (Mock 5%)
      if (orderTax === 'VAT@5%') {
          total += (total * 0.05);
      }

      // Shipping
      if (typeof shippingCharges === 'number') {
          total += shippingCharges;
      }

      return total;
  };

  const grandTotal = calculateGrandTotal();
  const taxAmount = orderTax === 'VAT@5%' ? (subTotal * 0.05) : 0;
  const discountValue = discountType === 'Fixed' ? (discountAmount || 0) : (subTotal * ((discountAmount as number || 0) / 100));

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // --- Handlers ---
  const handleCustomerSelect = (cust: any) => {
      setCustomer(cust.id);
      setSelectedCustomerObj(cust);
      setCustomerSearch(cust.name);
      setIsCustomerDropdownOpen(false);
  };

  const filteredCustomers = mockCustomers.filter(c => 
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
      c.phone.includes(customerSearch)
  );

  const handleAddRow = () => {
      const newRow = { 
          id: Date.now(), 
          name: 'New Item (Search to add)', 
          qty: 1, 
          unitPrice: 0, 
          subtotal: 0, 
          total: 0 
      };
      setRows([...rows, newRow]);
  };

  const handleRemoveRow = (id: number) => {
      setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: number, field: string, value: any) => {
      setRows(rows.map(row => {
          if (row.id === id) {
              const updated = { ...row, [field]: value };
              // Simple recalc
              if (field === 'qty' || field === 'unitPrice') {
                  const price = parseFloat(updated.unitPrice) || 0;
                  const qty = parseFloat(updated.qty) || 0;
                  updated.subtotal = price * qty;
                  updated.total = updated.subtotal;
              }
              return updated;
          }
          return row;
      }));
  };

  return (
    <div className="space-y-6 animate-fade-in pb-32">
        {/* Header */}
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-900">Add Draft</h2>
        </div>

        {/* 1. Customer & General Info */}
        <div className="bg-white rounded shadow-sm border border-slate-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                
                {/* SEARCHABLE CUSTOMER DROPDOWN */}
                <div className="group" ref={customerDropdownRef}>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Customer:*</label>
                    <div className="flex gap-2 relative">
                        <div className="relative w-full">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="text"
                                className="w-full pl-9 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                placeholder="Select Customer"
                                value={customerSearch}
                                onChange={(e) => {
                                    setCustomerSearch(e.target.value);
                                    setIsCustomerDropdownOpen(true);
                                }}
                                onFocus={() => setIsCustomerDropdownOpen(true)}
                            />
                            {isCustomerDropdownOpen && (
                                <div className="absolute top-full left-0 w-full mt-1 bg-white rounded shadow-lg border border-slate-200 z-50 max-h-60 overflow-y-auto">
                                    {filteredCustomers.map(cust => (
                                        <div 
                                            key={cust.id}
                                            className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm"
                                            onClick={() => handleCustomerSelect(cust)}
                                        >
                                            {cust.name}
                                        </div>
                                    ))}
                                </div>
                            )}
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                        </div>
                        <button className="p-2 bg-white border border-slate-300 rounded hover:bg-slate-50 text-slate-500"><Plus size={18} /></button>
                    </div>
                </div>

                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">Pay term: <Info size={12} className="text-blue-500" /></label>
                    <div className="flex">
                        <input type="text" placeholder="Pay term" className="w-1/2 px-3 py-2 rounded-l border border-r-0 border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm" />
                        <select 
                            className="w-1/2 px-3 py-2 rounded-r border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                            value={payTerm}
                            onChange={(e) => setPayTerm(e.target.value)}
                        >
                            <option>Please Select</option>
                            <option>Days</option>
                            <option>Months</option>
                        </select>
                    </div>
                </div>

                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Sale Date:*</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="datetime-local" 
                            className="w-full pl-9 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm" 
                            value={saleDate}
                            onChange={(e) => setSaleDate(e.target.value)}
                        />
                    </div>
                </div>
                
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Status:*</label>
                    <select 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        disabled
                    >
                        <option>Draft</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-2">
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Billing Address:</label>
                    <div className="text-sm text-slate-600">{selectedCustomerObj?.name || 'Direct Customer'}</div>
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Shipping Address:</label>
                    <div className="text-sm text-slate-600">{selectedCustomerObj?.name || 'Direct Customer'}</div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                 <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Invoice scheme:</label>
                    <select 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                        value={invoiceScheme}
                        onChange={(e) => setInvoiceScheme(e.target.value)}
                    >
                        <option>Default</option>
                        <option>Format A</option>
                    </select>
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Attach Document:</label>
                    <div className="flex">
                        <input type="file" className="w-full px-3 py-1.5 rounded-l border border-r-0 border-slate-300 text-sm text-slate-500 file:mr-4 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                        <button className="px-3 py-1.5 bg-blue-600 text-white rounded-r text-sm font-medium">Browse...</button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Max file size: 5MB<br/>Allowed file: pdf, csv, zip, doc, docx, jpeg, jpg, png</p>
                </div>
            </div>
        </div>

        {/* 2. Products Grid */}
        <div className="bg-white rounded shadow-sm border border-slate-200 p-6">
             <div className="mb-6 flex justify-center">
                 <div className="relative w-full">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search size={16} className="text-slate-400" />
                    </div>
                    <input 
                        type="text" 
                        className="block w-full pl-10 pr-4 py-3 rounded bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm" 
                        placeholder="Enter Product name / SKU / Scan bar code"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddRow()}
                    />
                    <div className="absolute inset-y-0 right-2 flex items-center">
                        <button className="p-1 bg-white rounded text-blue-600 hover:bg-blue-50" onClick={handleAddRow}>
                            <Plus size={18} />
                        </button>
                    </div>
                </div>
             </div>

             <div className="overflow-x-auto mb-4 border border-slate-200 rounded">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="bg-slate-50 text-slate-700 text-xs font-bold">
                            <th className="p-3 text-left w-64 border-b border-slate-200">Product</th>
                            <th className="p-3 text-center w-32 border-b border-slate-200">Quantity</th>
                            <th className="p-3 text-right w-40 border-b border-slate-200">Unit Price</th>
                            <th className="p-3 text-right w-40 border-b border-slate-200">Subtotal</th>
                            <th className="p-3 text-center w-12 border-b border-slate-200"><Trash2 size={14}/></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {rows.map((row, index) => (
                            <tr key={row.id}>
                                <td className="p-3 font-medium text-slate-800">{row.name}</td>
                                <td className="p-3">
                                    <input 
                                        type="number" 
                                        value={row.qty}
                                        onChange={(e) => updateRow(row.id, 'qty', e.target.value)}
                                        className="w-full px-2 py-1 border border-slate-300 rounded text-center text-sm"
                                    />
                                </td>
                                <td className="p-3">
                                    <input 
                                        type="number" 
                                        value={row.unitPrice} 
                                        onChange={(e) => updateRow(row.id, 'unitPrice', e.target.value)}
                                        className="w-full px-2 py-1 border border-slate-300 rounded text-right text-sm"
                                    />
                                </td>
                                <td className="p-3 text-right font-medium text-slate-800">{row.total.toFixed(3)}</td>
                                <td className="p-3 text-center">
                                    <button onClick={() => handleRemoveRow(row.id)} className="text-red-500 hover:text-red-700">
                                        <X size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-slate-400 italic">No products added</td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 text-xs font-bold text-slate-700">
                        <tr>
                            <td colSpan={4} className="p-3 text-right">Items: {rows.length} Total: {totalItems.toFixed(3)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
             </div>
        </div>

        {/* 3. Discount, Tax & Note */}
        <div className="bg-white rounded shadow-sm border border-slate-200 p-6">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                 <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Discount Type:*</label>
                    <select 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value)}
                    >
                        <option>Percentage</option>
                        <option>Fixed</option>
                    </select>
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Discount Amount:*</label>
                    <div className="relative">
                        <input 
                            type="number" 
                            className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm" 
                            value={discountAmount}
                            onChange={(e) => setDiscountAmount(parseFloat(e.target.value))}
                        />
                        <Info size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Order Tax:*</label>
                    <select 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                        value={orderTax}
                        onChange={(e) => setOrderTax(e.target.value)}
                    >
                        <option>None</option>
                        <option>VAT@5%</option>
                    </select>
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                 <div className="group md:col-span-3">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Sell note</label>
                    <textarea 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm resize-none" 
                        rows={3}
                        value={sellNote}
                        onChange={(e) => setSellNote(e.target.value)}
                    ></textarea>
                </div>
             </div>
             
             <div className="flex justify-end text-xs text-slate-500 space-y-1 flex-col items-end border-t border-slate-100 pt-4">
                 <div className="flex justify-between w-64"><span>Discount Amount: (-)</span> <span>{discountValue.toFixed(3)}</span></div>
                 <div className="flex justify-between w-64"><span>Order Tax: (+)</span> <span>{taxAmount.toFixed(3)}</span></div>
             </div>
        </div>

        {/* 4. Shipping */}
        <div className="bg-white rounded shadow-sm border border-slate-200 p-6">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                 <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Shipping Details</label>
                    <textarea 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm resize-none" 
                        rows={2}
                        value={shippingDetails}
                        onChange={(e) => setShippingDetails(e.target.value)}
                    ></textarea>
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Shipping Address</label>
                    <textarea 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm resize-none" 
                        rows={2}
                        value={shippingAddress}
                        onChange={(e) => setShippingAddress(e.target.value)}
                    ></textarea>
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Shipping Charges</label>
                    <div className="relative">
                        <Info size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="number" 
                            className="w-full pl-9 pr-4 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm" 
                            placeholder="0.000"
                            value={shippingCharges}
                            onChange={(e) => setShippingCharges(parseFloat(e.target.value))}
                        />
                    </div>
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Shipping Status</label>
                    <select 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                        value={shippingStatus}
                        onChange={(e) => setShippingStatus(e.target.value)}
                    >
                        <option>Please Select</option>
                        <option>Ordered</option>
                        <option>Delivered</option>
                    </select>
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Delivered To</label>
                    <input 
                        type="text" 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                        value={deliveredTo}
                        onChange={(e) => setDeliveredTo(e.target.value)}
                    />
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Delivery Person:</label>
                    <select 
                        className="w-full px-3 py-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm bg-white"
                        value={deliveryPerson}
                        onChange={(e) => setDeliveryPerson(e.target.value)}
                    >
                        <option>Please Select</option>
                    </select>
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                 <div className="group md:col-span-3">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Shipping Documents:</label>
                    <div className="flex">
                        <input type="file" className="w-full px-3 py-1.5 rounded-l border border-r-0 border-slate-300 text-sm text-slate-500"/>
                        <button className="px-3 py-1.5 bg-blue-600 text-white rounded-r text-sm font-medium">Browse...</button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Max file size: 5MB<br/>Allowed file: pdf, csv, zip, doc, docx, jpeg, jpg, png</p>
                </div>
             </div>
             
             <div className="flex justify-center mb-4">
                 <button className="bg-[#6200ea] text-white text-xs font-bold py-2 px-4 rounded flex items-center gap-1 shadow-sm">
                     <Plus size={14} /> Add additional expenses <ChevronDown size={14} />
                 </button>
             </div>
             
             <div className="flex justify-end pt-4 border-t border-slate-100">
                 <div className="text-right">
                     <span className="block text-xs font-bold text-slate-700 uppercase mb-1">Total Payable:</span>
                     <span className="text-lg font-bold text-slate-900">OMR {grandTotal.toFixed(3)}</span>
                 </div>
             </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="fixed bottom-0 left-0 w-full bg-slate-100 border-t border-slate-200 py-4 px-8 z-40 flex justify-center gap-4">
             <button className="px-6 py-2 bg-blue-600 text-white font-bold rounded shadow hover:bg-blue-700 text-sm">Save</button>
             <button className="px-6 py-2 bg-emerald-500 text-white font-bold rounded shadow hover:bg-emerald-600 text-sm">Save and print</button>
        </div>

    </div>
  );
};

export default AddDraft;