import React, { useState } from 'react';
import { MapPin, Filter, Printer, Info, ChevronDown } from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

// Utility for currency formatting with Arabic suffix
const formatRiyal = (amount: number) => {
  return `${amount.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ريال`;
};

const ReportPurchaseSale: React.FC = () => {
  const { locations } = useGlobalContext();
  const [filters, setFilters] = useState({
      location: [] as string[]
  });

  // Mock Data matching the screenshot
  const data = {
    purchases: {
        total: 0.000,
        incTax: 0.000,
        returnIncTax: 0.000,
        due: 0.000
    },
    sales: {
        total: 6297.761,
        incTax: 6346.058,
        returnIncTax: 349.355,
        due: 3640.645
    },
    overall: {
        saleMinusPurchase: 5996.703,
        dueAmount: 3640.645
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* 1. Header & Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                Purchase & Sale Report
            </h2>
            <p className="text-xs text-slate-500 mt-1">Purchase & sale details for the selected date range</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
             <div className="relative w-full sm:w-64">
                  <MultiSelect 
                        label="Location"
                        options={locations.map(loc => loc.name)}
                        selected={filters.location}
                        onChange={(val) => setFilters({...filters, location: val})}
                        className="w-full"
                    />
              </div>
              
              <div className="bg-slate-100 rounded-lg p-1 border border-slate-200 w-full sm:w-auto">
                   <DateRangeFilter className="min-w-[200px]" />
               </div>

               <button className="w-full sm:w-auto bg-[#6200ea] text-white px-5 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-[#5000ca] flex items-center justify-center gap-2 transition-colors">
                   <Filter size={16} /> Filter by date
               </button>
        </div>
      </div>

      {/* 2. Main Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Purchases Column */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-slate-800 text-sm">Purchases</h3>
              </div>
              <div className="p-6 space-y-5 text-sm flex-1">
                  <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                      <span className="font-bold text-slate-700">Total Purchase:</span>
                      <span className="font-medium text-slate-600">{formatRiyal(data.purchases.total)}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                      <span className="font-bold text-slate-700">Purchase Including tax:</span>
                      <span className="font-medium text-slate-600">{formatRiyal(data.purchases.incTax)}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                      <span className="font-bold text-slate-700">Total Purchase Return Including Tax:</span>
                      <span className="font-medium text-slate-600">{formatRiyal(data.purchases.returnIncTax)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                      <span className="font-bold text-slate-700 flex items-center gap-1">
                          Purchase Due: <Info size={14} className="text-blue-500" />
                      </span>
                      <span className="font-medium text-slate-600">{formatRiyal(data.purchases.due)}</span>
                  </div>
              </div>
          </div>

          {/* Sales Column */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-slate-800 text-sm">Sales</h3>
              </div>
              <div className="p-6 space-y-5 text-sm flex-1">
                  <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                      <span className="font-bold text-slate-700">Total Sale:</span>
                      <span className="font-medium text-slate-600">{formatRiyal(data.sales.total)}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                      <span className="font-bold text-slate-700">Sale Including tax:</span>
                      <span className="font-medium text-slate-600">{formatRiyal(data.sales.incTax)}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                      <span className="font-bold text-slate-700">Total Sell Return Including Tax:</span>
                      <span className="font-medium text-slate-600">{formatRiyal(data.sales.returnIncTax)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                      <span className="font-bold text-slate-700 flex items-center gap-1">
                          Sale Due: <Info size={14} className="text-blue-500" />
                      </span>
                      <span className="font-medium text-slate-600">{formatRiyal(data.sales.due)}</span>
                  </div>
              </div>
          </div>
      </div>

      {/* 3. Overall Summary Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-8">
          <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2 text-sm">
              Overall ((Sale - Sell Return) - (Purchase - Purchase Return))
              <Info size={14} className="text-blue-500 cursor-help" />
          </h3>
          
          <div className="space-y-4 pl-4 border-l-4 border-emerald-500/20">
              <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-slate-500 w-32">Sale - Purchase:</span>
                  <span className="text-xl font-black text-emerald-500 tracking-tight">{formatRiyal(data.overall.saleMinusPurchase)}</span>
              </div>
              <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-slate-500 w-32">Due amount:</span>
                  <span className="text-xl font-black text-emerald-500 tracking-tight">{formatRiyal(data.overall.dueAmount)}</span>
              </div>
          </div>
      </div>

      {/* 4. Footer Actions */}
      <div className="flex justify-end pt-4">
          <button className="bg-[#6200ea] text-white px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-purple-900/20 hover:bg-[#5000ca] transition-all flex items-center gap-2 transform active:scale-95">
              <Printer size={18} /> Print
          </button>
      </div>
    </div>
  );
};

export default ReportPurchaseSale;