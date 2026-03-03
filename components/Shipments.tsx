import React, { useState } from 'react';
import { 
  Search, FileText, FileSpreadsheet, Printer, 
  Columns, Download, ChevronDown, Filter, 
  ArrowUpDown
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

interface Shipment {
  id: string;
  date: string;
  invoiceNo: string;
  customerName: string;
  contactNumber: string;
  location: string;
  deliveryPerson: string;
  shippingStatus: 'Delivered' | 'Pending' | 'Shipped' | 'Ordered' | 'Packed';
  paymentStatus: 'Paid' | 'Due' | 'Partial';
}

const initialShipments: Shipment[] = [
  { id: '1', date: '11/02/2026 07:54 AM', invoiceNo: 'K2026-2494', customerName: '02 Pet Shop (Mowaleh)', contactNumber: '97266992', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', deliveryPerson: '', shippingStatus: 'Delivered', paymentStatus: 'Due' },
  { id: '2', date: '11/02/2026 07:20 AM', invoiceNo: '2026-1615', customerName: 'ATMED Fix (Mabailah)', contactNumber: '+96895661443', location: 'CR:1450968', deliveryPerson: '', shippingStatus: 'Delivered', paymentStatus: 'Due' },
  { id: '3', date: '10/02/2026 09:27 PM', invoiceNo: 'K2026-2493', customerName: 'Aquatic World Trd LLC', contactNumber: '94984558', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', deliveryPerson: '', shippingStatus: 'Delivered', paymentStatus: 'Paid' },
  { id: '4', date: '10/02/2026 09:24 PM', invoiceNo: 'K2026-2492', customerName: 'Aquatic World Trd LLC', contactNumber: '94984558', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', deliveryPerson: '', shippingStatus: 'Delivered', paymentStatus: 'Paid' },
  { id: '5', date: '10/02/2026 03:54 PM', invoiceNo: 'K2026-2491', customerName: 'Direct Customer', contactNumber: '0', location: 'KNWZ ARD ALKHALYJ ALMTHDAH CR:1282649', deliveryPerson: '', shippingStatus: 'Delivered', paymentStatus: 'Paid' },
];

interface ShipmentsProps {
    onNavigate: (page: string) => void;
}

const Shipments: React.FC<ShipmentsProps> = ({ onNavigate }) => {
  const { locations } = useGlobalContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [shipments, setShipments] = useState<Shipment[]>(initialShipments);
  const [showFilters, setShowFilters] = useState(true);
  
  const [filters, setFilters] = useState({
      location: [] as string[],
      customer: [] as string[],
      user: [] as string[],
      paymentStatus: [] as string[],
      shippingStatus: [] as string[],
      deliveryPerson: [] as string[]
  });

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* Header */}
      <h2 className="text-2xl font-bold text-slate-900">Shipments</h2>

      {/* Filter Section */}
      <div className="bg-white rounded shadow-sm border border-slate-200 p-4">
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
                            label="Business Location"
                            options={locations.map(loc => loc.name)}
                            selected={filters.location}
                            onChange={(val) => setFilters({...filters, location: val})}
                        />
                  </div>
                  <div className="group">
                        <MultiSelect 
                            label="Customer"
                            options={['02 Pet Shop (Mowaleh)', 'Aquatic World Trd LLC']}
                            selected={filters.customer}
                            onChange={(val) => setFilters({...filters, customer: val})}
                        />
                  </div>
                  <div className="group">
                      <DateRangeFilter />
                  </div>
                  <div className="group">
                       <MultiSelect 
                            label="User"
                            options={['Admin', 'Sales Staff']}
                            selected={filters.user}
                            onChange={(val) => setFilters({...filters, user: val})}
                        />
                  </div>
                  <div className="group">
                       <MultiSelect 
                            label="Payment Status"
                            options={['Paid', 'Due', 'Partial']}
                            selected={filters.paymentStatus}
                            onChange={(val) => setFilters({...filters, paymentStatus: val})}
                        />
                  </div>
                  <div className="group">
                       <MultiSelect 
                            label="Shipping Status"
                            options={['Delivered', 'Pending', 'Ordered']}
                            selected={filters.shippingStatus}
                            onChange={(val) => setFilters({...filters, shippingStatus: val})}
                        />
                  </div>
                  <div className="group">
                       <MultiSelect 
                            label="Delivery Person"
                            options={['Driver 1', 'Driver 2']}
                            selected={filters.deliveryPerson}
                            onChange={(val) => setFilters({...filters, deliveryPerson: val})}
                        />
                  </div>
              </div>
          )}
      </div>

      {/* Main Content */}
      <div className="bg-white rounded shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Controls Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
           <div className="flex items-center gap-2">
               <span className="text-sm text-slate-600">Show</span>
               <select className="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none">
                   <option>25</option>
                   <option>50</option>
                   <option>100</option>
               </select>
               <span className="text-sm text-slate-600">entries</span>
           </div>

           <div className="flex gap-1">
                <button className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1"><FileText size={12}/> Export CSV</button>
                <button className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1"><FileSpreadsheet size={12}/> Export Excel</button>
                <button className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1"><Printer size={12}/> Print</button>
                <button className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1"><Columns size={12}/> Column visibility</button>
                <button className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1"><FileText size={12}/> Export PDF</button>
           </div>

           <div className="flex items-center gap-2">
               <input 
                   type="text" 
                   placeholder="Search..." 
                   className="px-3 py-2 rounded border border-slate-300 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
               />
           </div>
        </div>

        {/* Table */}
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
              {shipments.map((ship) => (
                <tr key={ship.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-center">
                      <button className="text-blue-600 hover:text-blue-800 font-bold flex items-center justify-center gap-1 mx-auto bg-blue-50 px-2 py-1 rounded border border-blue-100 hover:bg-blue-100 transition-colors">
                          Actions <ChevronDown size={10} />
                      </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{ship.date}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{ship.invoiceNo}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{ship.customerName}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{ship.contactNumber}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-[10px] text-slate-500">{ship.location}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{ship.deliveryPerson || '--'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          ship.shippingStatus === 'Delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                          {ship.shippingStatus}
                      </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          ship.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-orange-50 text-orange-700 border-orange-200'
                      }`}>
                          {ship.paymentStatus}
                      </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
            <div>Showing 1 to {shipments.length} of {shipments.length} entries</div>
            <div className="flex gap-1">
                 <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled>Previous</button>
                 <button className="px-3 py-1 bg-blue-600 text-white rounded shadow-sm">1</button>
                 <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50">2</button>
                 <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50">3</button>
                 <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50">4</button>
                 <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50">5</button>
                <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50">Next</button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default Shipments;