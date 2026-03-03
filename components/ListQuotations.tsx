import React, { useState } from 'react';
import { 
  Plus, Search, FileText, FileSpreadsheet, Printer, 
  Columns, Download, Edit, Trash2, ChevronDown, 
  Filter, Eye, MoreVertical, ArrowUpDown, Calendar as CalendarIcon
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

interface Quotation {
  id: string;
  date: string;
  refNo: string;
  customerName: string;
  contactNumber: string;
  location: string;
  totalItems: number;
  addedBy: string;
  status: 'Pending' | 'Accepted' | 'Rejected';
}

const initialQuotations: Quotation[] = [
  { id: '1', date: '2023-11-01', refNo: 'QT-2023-001', customerName: 'Direct Customer', contactNumber: '12345678', location: 'CR:1450968', totalItems: 5, addedBy: 'Admin', status: 'Pending' },
  { id: '2', date: '2023-11-02', refNo: 'QT-2023-002', customerName: 'Al Maha Hypermarket', contactNumber: '87654321', location: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649', totalItems: 10, addedBy: 'Sales Staff', status: 'Accepted' },
];

interface ListQuotationsProps {
    onNavigate: (page: string) => void;
}

const ListQuotations: React.FC<ListQuotationsProps> = ({
  onNavigate }) => {
  const { locations } = useGlobalContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [quotations, setQuotations] = useState<Quotation[]>(initialQuotations);
  const [showFilters, setShowFilters] = useState(true);
  
  const [filters, setFilters] = useState({
      location: [] as string[],
      customer: [] as string[],
      user: [] as string[],
      status: [] as string[]
  });

  const filteredQuotations = quotations.filter(q => 
    (q.refNo.toLowerCase().includes(searchTerm.toLowerCase()) || 
    q.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.contactNumber.includes(searchTerm)) &&
    (filters.location.length === 0 || filters.location.includes(q.location)) &&
    (filters.customer.length === 0 || filters.customer.includes(q.customerName)) &&
    (filters.user.length === 0 || filters.user.includes(q.addedBy)) &&
    (filters.status.length === 0 || filters.status.includes(q.status))
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* Header */}
      <h2 className="text-2xl font-bold text-slate-900">List quotations</h2>

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
                            options={['Direct Customer', 'Al Maha Hypermarket']}
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
                            label="Status"
                            options={['Pending', 'Accepted', 'Rejected']}
                            selected={filters.status}
                            onChange={(val) => setFilters({...filters, status: val})}
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
               <button 
                onClick={() => onNavigate('add-quotation')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-1"
               >
                   <Plus size={16} /> Add Quotation
               </button>
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
                <th className="px-4 py-3 whitespace-nowrap">Date <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Reference No <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Customer name <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Contact Number <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Location <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Total Items <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Added By <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Action <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQuotations.length > 0 ? (
                  filteredQuotations.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">{q.date}</td>
                      <td className="px-4 py-3">{q.refNo}</td>
                      <td className="px-4 py-3">{q.customerName}</td>
                      <td className="px-4 py-3">{q.contactNumber}</td>
                      <td className="px-4 py-3">{q.location}</td>
                      <td className="px-4 py-3">{q.totalItems}</td>
                      <td className="px-4 py-3">{q.addedBy}</td>
                      <td className="px-4 py-3">
                          <button className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1">
                              Action <ChevronDown size={10} />
                          </button>
                      </td>
                    </tr>
                  ))
              ) : (
                  <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-500 bg-slate-50/50">
                          No data available in table
                      </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
            <div>Showing {filteredQuotations.length > 0 ? 1 : 0} to {filteredQuotations.length} of {filteredQuotations.length} entries</div>
            <div className="flex gap-1">
                 <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled>Previous</button>
                <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled>Next</button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default ListQuotations;