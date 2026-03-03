import React, { useState } from 'react';
import { 
  FileText, Download, Printer, Search, Filter, 
  ChevronDown, ArrowUpDown, Calendar, CheckCircle2
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

// Utility for currency
const formatOMR = (amount: number) => {
  return `OMR ${amount.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
};

const VatBills: React.FC = () => {
  const { locations } = useGlobalContext();
  const [showFilters, setShowFilters] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [filters, setFilters] = useState({
      location: [] as string[],
      customer: [] as string[]
  });

  // Mock Data
  const invoices = [
    { id: 'INV-2026-001', date: '12/02/2026', customer: 'Al Maha Hypermarket', trn: 'OM12345678', net: 100.000, vat: 5.000, total: 105.000, status: 'Paid', location: 'CR:1450968' },
    { id: 'INV-2026-002', date: '12/02/2026', customer: 'Muscat Pet Center', trn: 'OM87654321', net: 45.500, vat: 2.275, total: 47.775, status: 'Paid', location: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649' },
    { id: 'INV-2026-003', date: '11/02/2026', customer: 'Direct Customer', trn: '--', net: 12.000, vat: 0.600, total: 12.600, status: 'Paid', location: 'CR:1450968' },
    { id: 'INV-2026-004', date: '11/02/2026', customer: 'Lulu Hypermarket', trn: 'OM55667788', net: 250.000, vat: 12.500, total: 262.500, status: 'Due', location: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649' },
    { id: 'INV-2026-005', date: '10/02/2026', customer: 'Shell Select', trn: 'OM99887766', net: 80.000, vat: 4.000, total: 84.000, status: 'Paid', location: 'CR:1450968' },
    { id: 'INV-2026-006', date: '09/02/2026', customer: 'Ahmed Al-Balushi', trn: '--', net: 35.000, vat: 1.750, total: 36.750, status: 'Paid', location: 'CR:1450968' },
    { id: 'INV-2026-007', date: '09/02/2026', customer: 'Carrefour City Centre', trn: 'OM11223344', net: 500.000, vat: 25.000, total: 525.000, status: 'Paid', location: 'KNWZ ARD ALKHLYJ ALMTHDH CR:1282649' },
    { id: 'INV-2026-008', date: '08/02/2026', customer: 'Happy Pets Shop', trn: 'OM44332211', net: 150.000, vat: 7.500, total: 157.500, status: 'Partial', location: 'CR:1450968' },
  ];

  const filteredInvoices = invoices.filter(inv => 
    (inv.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    inv.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.trn.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filters.location.length === 0 || filters.location.includes(inv.location)) &&
    (filters.customer.length === 0 || filters.customer.includes(inv.customer))
  );

  const totalNet = filteredInvoices.reduce((acc, curr) => acc + curr.net, 0);
  const totalVat = filteredInvoices.reduce((acc, curr) => acc + curr.vat, 0);
  const totalGross = filteredInvoices.reduce((acc, curr) => acc + curr.total, 0);

  const handlePrintAll = () => {
    alert("Preparing print job for all filtered VAT invoices...");
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">VAT Bills</h2>
          <p className="text-slate-500 mt-2 text-lg font-light">
            This print all PDF invoices that include VAT.
          </p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={handlePrintAll}
                className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition shadow-lg shadow-slate-900/20 flex items-center gap-2 transform active:scale-95 duration-150"
            >
                <Printer size={18} /> Print All VAT Invoices
            </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div 
            className="flex items-center gap-2 mb-4 text-blue-600 font-bold text-sm cursor-pointer w-fit"
            onClick={() => setShowFilters(!showFilters)}
          >
              <Filter size={16} /> Filters
          </div>
          
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 animate-in slide-in-from-top-2">
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
                        options={['Al Maha Hypermarket', 'Direct Customer', 'Lulu Hypermarket']}
                        selected={filters.customer}
                        onChange={(val) => setFilters({...filters, customer: val})}
                    />
                </div>
                <div className="group">
                    <DateRangeFilter />
                </div>
            </div>
          )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Net Amount</p>
            <p className="text-2xl font-black text-slate-900">{formatOMR(totalNet)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total VAT (5%)</p>
            <p className="text-2xl font-black text-red-600">{formatOMR(totalVat)}</p>
        </div>
         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Gross Total</p>
            <p className="text-2xl font-black text-emerald-600">{formatOMR(totalGross)}</p>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                      <th className="px-6 py-4">Invoice ID</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4">TRN</th>
                      <th className="px-6 py-4 text-right">Net Amount</th>
                      <th className="px-6 py-4 text-right">VAT</th>
                      <th className="px-6 py-4 text-right">Total</th>
                      <th className="px-6 py-4 text-center">Status</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-mono font-medium text-blue-600">{inv.id}</td>
                          <td className="px-6 py-4 text-slate-600">{inv.date}</td>
                          <td className="px-6 py-4 font-medium text-slate-800">{inv.customer}</td>
                          <td className="px-6 py-4 text-slate-500">{inv.trn}</td>
                          <td className="px-6 py-4 text-right font-medium">{formatOMR(inv.net)}</td>
                          <td className="px-6 py-4 text-right text-red-600">{formatOMR(inv.vat)}</td>
                          <td className="px-6 py-4 text-right font-bold text-slate-900">{formatOMR(inv.total)}</td>
                          <td className="px-6 py-4 text-center">
                              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                  inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 
                                  inv.status === 'Due' ? 'bg-red-100 text-red-700' : 
                                  'bg-amber-100 text-amber-700'
                              }`}>
                                  {inv.status}
                              </span>
                          </td>
                      </tr>
                  ))}
                  {filteredInvoices.length === 0 && (
                      <tr>
                          <td colSpan={8} className="px-6 py-8 text-center text-slate-500 italic">
                              No VAT invoices found matching your criteria.
                          </td>
                      </tr>
                  )}
              </tbody>
          </table>
      </div>
    </div>
  );
};

export default VatBills;