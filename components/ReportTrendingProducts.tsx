import React, { useState } from 'react';
import { Filter, Info, Printer } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import DateRangeFilter from './DateRangeFilter';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

const ReportTrendingProducts: React.FC = () => {
  const { locations } = useGlobalContext();
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState({
      location: [] as string[],
      category: [] as string[],
      subCategory: [] as string[],
      brand: [] as string[],
      unit: [] as string[],
      productType: [] as string[]
  });

  // Mock Data for Chart
  const data = [
    { name: 'Wet food cat, chicken (Kitten)', sold: 9000, location: 'CR:1450968', category: 'Pet Food', subCategory: 'Cat Food', brand: 'Whiskas', unit: 'Pcs', productType: 'Single' },
    { name: 'Wet food Dog, Beef (adult)', sold: 5000, location: 'CR:1450968', category: 'Pet Food', subCategory: 'Dog Food', brand: 'Pedigree', unit: 'Pcs', productType: 'Single' },
    { name: 'Wet food cat, chicken (Adult)', sold: 5000, location: 'CR:1450968', category: 'Pet Food', subCategory: 'Cat Food', brand: 'Whiskas', unit: 'Pcs', productType: 'Single' },
    { name: 'EuroCat Chicken', sold: 3000, location: 'CR:1450968', category: 'Pet Food', subCategory: 'Cat Food', brand: 'EuroCat', unit: 'Pcs', productType: 'Single' },
    { name: 'Kinza - 0050 (Cartoon)', sold: 2800, location: 'CR:1450968', category: 'Beverages', subCategory: 'Soft Drinks', brand: 'Kinza', unit: 'Carton', productType: 'Single' },
  ];

  const filteredData = data.filter(item => 
    (filters.location.length === 0 || filters.location.includes(item.location)) &&
    (filters.category.length === 0 || filters.category.includes(item.category)) &&
    (filters.subCategory.length === 0 || filters.subCategory.includes(item.subCategory)) &&
    (filters.brand.length === 0 || filters.brand.includes(item.brand)) &&
    (filters.unit.length === 0 || filters.unit.includes(item.unit)) &&
    (filters.productType.length === 0 || filters.productType.includes(item.productType))
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <h2 className="text-xl font-bold text-slate-900">Trending Products</h2>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-blue-600 font-bold text-sm cursor-pointer w-fit" onClick={() => setShowFilters(!showFilters)}>
              <Filter size={16} /> Filters
          </div>
          
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2 animate-in slide-in-from-top-2">
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
                        label="Category"
                        options={['Pet Food', 'Beverages']}
                        selected={filters.category}
                        onChange={(val) => setFilters({...filters, category: val})}
                    />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Sub category"
                        options={['Cat Food', 'Dog Food', 'Soft Drinks']}
                        selected={filters.subCategory}
                        onChange={(val) => setFilters({...filters, subCategory: val})}
                    />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Brand"
                        options={['Whiskas', 'Pedigree', 'EuroCat', 'Kinza']}
                        selected={filters.brand}
                        onChange={(val) => setFilters({...filters, brand: val})}
                    />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Unit"
                        options={['Pcs', 'Carton']}
                        selected={filters.unit}
                        onChange={(val) => setFilters({...filters, unit: val})}
                    />
                </div>
                <div className="group">
                    <DateRangeFilter />
                </div>
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">Number of products: <Info size={10} className="text-blue-500"/></label>
                    <input type="number" defaultValue="5" className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium outline-none" />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Product Type"
                        options={['Single', 'Variable', 'Combo']}
                        selected={filters.productType}
                        onChange={(val) => setFilters({...filters, productType: val})}
                    />
                </div>
                <div className="md:col-span-4 flex justify-end">
                    <button className="bg-[#6200ea] text-white px-6 py-2 rounded-lg text-xs font-bold shadow-sm hover:bg-[#5000ca]">Apply Filters</button>
                </div>
            </div>
          )}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 overflow-hidden">
          <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">Top Trending Products <Info size={14} className="text-blue-500"/></h3>
              <button className="p-2 border border-slate-200 rounded text-slate-500 hover:bg-slate-50"><Printer size={16}/></button>
          </div>
          
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredData} layout="horizontal" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} interval={0} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                    <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0'}} />
                    <Bar dataKey="sold" fill="#7cb5ec" name="Total unit sold" barSize={60} />
                </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center items-center gap-2 mt-4 text-xs text-slate-600">
              <div className="w-3 h-3 bg-[#7cb5ec] rounded-full"></div> Total unit sold
          </div>
      </div>
    </div>
  );
};

export default ReportTrendingProducts;