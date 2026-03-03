import React, { useState } from 'react';
import { 
  Filter, FileText, FileSpreadsheet, Printer, 
  Columns, Search, ArrowUpDown, ChevronDown, 
  List, Calendar, Layers, Tag, ShoppingBag
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

// Utility for currency formatting
const formatRiyal = (amount: number) => {
  return `${amount.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ريال`;
};

const ReportProductSell: React.FC = () => {
  const { locations } = useGlobalContext();
  const [activeTab, setActiveTab] = useState('detailed_category');
  const [showFilters, setShowFilters] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [filters, setFilters] = useState({
      customer: [] as string[],
      customerGroup: [] as string[],
      location: [] as string[],
      category: [] as string[],
      brand: [] as string[]
  });

  // 1. Detailed Data
  const detailedData = [
    { id: 1, product: 'X Pets Dog (Veal) Chunks 400g', sku: '0161', customer: 'Direct Customer', contactId: 'Direct Customer', inv: 'K2026-2505', date: '14/02/2026 07:33 AM', qty: 36.000, unit: 'Pc(s)', uPrice: 0.450, disc: 0.000, tax: 0.000, priceInc: 0.450, total: 16.200, payMethod: 'Emad', group: '', location: 'CR:1450968', category: 'Wet Pet Food', brand: 'X Pets' },
    { id: 2, product: 'X Pets Puppy (Lamb) Pate 400g', sku: '0164', customer: 'Direct Customer', contactId: 'Direct Customer', inv: 'K2026-2505', date: '14/02/2026 07:33 AM', qty: 36.000, unit: 'Pc(s)', uPrice: 0.450, disc: 0.000, tax: 0.000, priceInc: 0.450, total: 16.200, payMethod: 'Emad', group: '', location: 'CR:1450968', category: 'Wet Pet Food', brand: 'X Pets' },
    { id: 3, product: 'Baby Powder 5L', sku: '0143', customer: 'Tbroza Hypermarket (Mobailah)', contactId: 'Tbroza Hypermarket (Mobailah)', inv: 'K2026-2504', date: '14/02/2026 07:24 AM', qty: 10.000, unit: 'Pc(s)', uPrice: 1.520, disc: 0.000, tax: 0.000, priceInc: 1.520, total: 15.200, payMethod: '', group: 'Supermarkets Customers', location: 'CR:1450968', category: 'Cat Litter', brand: 'ClearCat Blanco' },
    { id: 4, product: 'Activated Carbon 5L', sku: '0146', customer: 'Tbroza Hypermarket (Mobailah)', contactId: 'Tbroza Hypermarket (Mobailah)', inv: 'K2026-2504', date: '14/02/2026 07:24 AM', qty: 10.000, unit: 'Pc(s)', uPrice: 1.520, disc: 0.000, tax: 0.000, priceInc: 1.520, total: 15.200, payMethod: '', group: 'Supermarkets Customers', location: 'CR:1450968', category: 'Cat Litter', brand: 'ClearCat Blanco' },
    { id: 5, product: 'Aloe Vera 10L', sku: '0141', customer: 'Tbroza Hypermarket (Mobailah)', contactId: 'Tbroza Hypermarket (Mobailah)', inv: 'K2026-2504', date: '14/02/2026 07:24 AM', qty: 5.000, unit: 'Pc(s)', uPrice: 2.565, disc: 0.000, tax: 0.000, priceInc: 2.565, total: 12.825, payMethod: '', group: 'Supermarkets Customers', location: 'CR:1450968', category: 'Cat Litter', brand: 'ClearCat Blanco' },
    { id: 6, product: 'Lavender 5L', sku: '0137', customer: 'Tbroza Hypermarket (Mobailah)', contactId: 'Tbroza Hypermarket (Mobailah)', inv: 'K2026-2504', date: '14/02/2026 07:24 AM', qty: 10.000, unit: 'Pc(s)', uPrice: 1.520, disc: 0.000, tax: 0.000, priceInc: 1.520, total: 15.200, payMethod: '', group: 'Supermarkets Customers', location: 'CR:1450968', category: 'Cat Litter', brand: 'ClearCat Blanco' },
    { id: 7, product: 'Cebican (Cat) Tuna_3KG', sku: '8436611140187', customer: 'Tbroza Hypermarket (Mobailah)', contactId: 'Tbroza Hypermarket (Mobailah)', inv: 'K2026-2504', date: '14/02/2026 07:24 AM', qty: 6.000, unit: 'Pc(s)', uPrice: 3.570, disc: 0.000, tax: 0.000, priceInc: 3.570, total: 21.420, payMethod: '', group: 'Supermarkets Customers', location: 'CR:1450968', category: 'Dry Pet Food', brand: 'Cebican' },
    { id: 8, product: 'Aloe Vera 5L', sku: '0140', customer: 'Tbroza Hypermarket (Mobailah)', contactId: 'Tbroza Hypermarket (Mobailah)', inv: 'K2026-2504', date: '14/02/2026 07:24 AM', qty: 10.000, unit: 'Pc(s)', uPrice: 1.520, disc: 0.000, tax: 0.000, priceInc: 1.520, total: 15.200, payMethod: '', group: 'Supermarkets Customers', location: 'CR:1450968', category: 'Cat Litter', brand: 'ClearCat Blanco' },
    { id: 9, product: 'X Pets Cat (Chicken) Chunks 400g', sku: '0168', customer: 'Dr. Amani (Manooma)', contactId: 'Dr. Amani (Manooma)', inv: 'K2026-2503', date: '12/02/2026 04:21 PM', qty: 60.000, unit: 'Pc(s)', uPrice: 0.357, disc: 0.000, tax: 0.000, priceInc: 0.357, total: 21.420, payMethod: '', group: '', location: 'CR:1450968', category: 'Wet Pet Food', brand: 'X Pets' },
    { id: '10', product: 'Danna Supreme Complet Dog_20kg', sku: '0118', customer: 'Ajyal Veterinary Center (Mobailah)', contactId: 'Ajyal Veterinary Center (Mobailah)', inv: 'K2026-2502', date: '10/02/2026 10:09 AM', qty: 5.000, unit: 'Pc(s)', uPrice: 17.000, disc: 0.048, tax: 0.000, priceInc: 17.000, total: 85.000, payMethod: 'Cash', group: 'Pet food customer', location: 'CR:1450968', category: 'Dry Pet Food', brand: 'Danna' },
  ];

  // 2. Detailed (With Purchase) Data
  const detailedPurchaseData = [
    { id: 1, product: 'X Pets Puppy (Lamb) Pate 400g', sku: '0164', customer: 'Direct Customer', inv: 'K2026-2505', date: '14/02/2026 07:33 AM', purchaseRef: '(Opening Stock)', lot: '', supplier: '', qty: 36.000, group: '', location: 'CR:1450968', category: 'Wet Pet Food', brand: 'X Pets' },
    { id: 2, product: 'X Pets Dog (Veal) Chunks 400g', sku: '0161', customer: 'Direct Customer', inv: 'K2026-2505', date: '14/02/2026 07:33 AM', purchaseRef: '(Opening Stock)', lot: '', supplier: '', qty: 36.000, group: '', location: 'CR:1450968', category: 'Wet Pet Food', brand: 'X Pets' },
    { id: 3, product: 'Activated Carbon 5L', sku: '0146', customer: 'Tbroza Hypermarket (Mobailah)', inv: 'K2026-2504', date: '14/02/2026 07:24 AM', purchaseRef: '(Opening Stock)', lot: '', supplier: '', qty: 10.000, group: 'Supermarkets Customers', location: 'CR:1450968', category: 'Cat Litter', brand: 'ClearCat Blanco' },
    { id: 4, product: 'Lavender 5L', sku: '0137', customer: 'Tbroza Hypermarket (Mobailah)', inv: 'K2026-2504', date: '14/02/2026 07:24 AM', purchaseRef: '(Opening Stock)', lot: '', supplier: '', qty: 10.000, group: 'Supermarkets Customers', location: 'CR:1450968', category: 'Cat Litter', brand: 'ClearCat Blanco' },
    { id: 5, product: 'Aloe Vera 5L', sku: '0140', customer: 'Tbroza Hypermarket (Mobailah)', inv: 'K2026-2504', date: '14/02/2026 07:24 AM', purchaseRef: '(Opening Stock)', lot: '', supplier: '', qty: 10.000, group: 'Supermarkets Customers', location: 'CR:1450968', category: 'Cat Litter', brand: 'ClearCat Blanco' },
    { id: 6, product: 'Baby Powder 5L', sku: '0143', customer: 'Tbroza Hypermarket (Mobailah)', inv: 'K2026-2504', date: '14/02/2026 07:24 AM', purchaseRef: '(Opening Stock)', lot: '', supplier: '', qty: 10.000, group: 'Supermarkets Customers', location: 'CR:1450968', category: 'Cat Litter', brand: 'ClearCat Blanco' },
    { id: 7, product: 'Aloe Vera 10L', sku: '0141', customer: 'Tbroza Hypermarket (Mobailah)', inv: 'K2026-2504', date: '14/02/2026 07:24 AM', purchaseRef: '(Opening Stock)', lot: '', supplier: '', qty: 5.000, group: 'Supermarkets Customers', location: 'CR:1450968', category: 'Cat Litter', brand: 'ClearCat Blanco' },
    { id: 8, product: 'Cebican (Cat) Tuna_3KG', sku: '8436611140187', customer: 'Tbroza Hypermarket (Mobailah)', inv: 'K2026-2504', date: '14/02/2026 07:24 AM', purchaseRef: '(Opening Stock)', lot: '', supplier: '', qty: 6.000, group: 'Supermarkets Customers', location: 'CR:1450968', category: 'Dry Pet Food', brand: 'Cebican' },
    { id: 9, product: 'X Pets Cat (Chicken) Chunks 400g', sku: '0163', customer: 'Dr. Amani (Manooma)', inv: 'K2026-2503', date: '12/02/2026 04:21 PM', purchaseRef: '(Opening Stock)', lot: '', supplier: '', qty: 60.000, group: '', location: 'CR:1450968', category: 'Wet Pet Food', brand: 'X Pets' },
    { id: 10, product: 'X Pets Kitten (Chicken + Milk) Pate 400g', sku: '0158', customer: 'Direct Customer', inv: 'K2026-2501', date: '12/02/2026 09:14 AM', purchaseRef: '(Opening Stock)', lot: '', supplier: '', qty: 12.000, group: '', location: 'CR:1450968', category: 'Wet Pet Food', brand: 'X Pets' },
  ];

  // 3. Grouped (By Date) Data
  const groupedDateData = [
    { id: 1, product: 'Cebican mini Adult 3kg', sku: '8436611140392', date: '04/02/2026', stock: 311.000, sold: 3.000, total: 9.000, category: 'Dry Pet Food', brand: 'Cebican' },
    { id: 2, product: 'Cebican mini Adult 3kg', sku: '8436611140392', date: '21/01/2026', stock: 311.000, sold: 3.000, total: 9.000, category: 'Dry Pet Food', brand: 'Cebican' },
    { id: 3, product: 'Cebican mini Adult 3kg', sku: '8436611140392', date: '06/01/2026', stock: 311.000, sold: 6.000, total: 18.000, category: 'Dry Pet Food', brand: 'Cebican' },
    { id: 4, product: 'Cebican mini Adult 3kg', sku: '8436611140392', date: '10/02/2026', stock: 311.000, sold: 21.000, total: 66.780, category: 'Dry Pet Food', brand: 'Cebican' },
    { id: 5, product: 'Cebican mini Adult 3kg', sku: '8436611140392', date: '11/02/2026', stock: 311.000, sold: 39.000, total: 108.000, category: 'Dry Pet Food', brand: 'Cebican' },
    { id: 6, product: 'Cebican (Cat) Tuna_3KG', sku: '8436611140187', date: '01/02/2026', stock: 315.000, sold: 7.000, total: 16.800, category: 'Dry Pet Food', brand: 'Cebican' },
    { id: 7, product: 'Cebican (Cat) Tuna_3KG', sku: '8436611140187', date: '14/02/2026', stock: 315.000, sold: 3.000, total: 10.710, category: 'Dry Pet Food', brand: 'Cebican' },
    { id: 8, product: 'Cebican (Cat) Tuna_3KG', sku: '8436611140187', date: '03/02/2026', stock: 315.000, sold: 3.000, total: 10.710, category: 'Dry Pet Food', brand: 'Cebican' },
    { id: 9, product: 'Cebican (Cat) Tuna_3KG', sku: '8436611140187', date: '12/02/2026', stock: 315.000, sold: 6.000, total: 21.420, category: 'Dry Pet Food', brand: 'Cebican' },
    { id: 10, product: 'Cebican (Cat) Tuna_3KG', sku: '8436611140187', date: '10/01/2026', stock: 315.000, sold: 3.000, total: 10.710, category: 'Dry Pet Food', brand: 'Cebican' },
    { id: 11, product: 'Cebican (Cat) Tuna_3KG', sku: '8436611140187', date: '29/01/2026', stock: 315.000, sold: 15.000, total: 45.000, category: 'Dry Pet Food', brand: 'Cebican' },
    { id: 12, product: 'Cebican (Cat) Tuna_3KG', sku: '8436611140187', date: '11/02/2026', stock: 315.000, sold: 1.000, total: 1.500, category: 'Dry Pet Food', brand: 'Cebican' },
    { id: 13, product: 'Cebican (Cat) Tuna_3KG', sku: '8436611140187', date: '06/01/2026', stock: 315.000, sold: 1.000, total: 3.000, category: 'Dry Pet Food', brand: 'Cebican' },
  ];

  // 4. By Category Data
  const categoryData = [
    { id: 1, category: 'Dry Pet Food', stock: 13.000, sold: 505.000, total: 2832.270 },
    { id: 2, category: 'Engine oil', stock: 63.000, sold: 277.000, total: 2315.950 },
    { id: 3, category: 'Sand (clear cat)', stock: 236.000, sold: 335.000, total: 591.246 },
    { id: 4, category: 'Wet Pet Food', stock: 1788.000, sold: 1871.000, total: 685.383 },
  ];

  // 5. Detailed Category Report Data (Hierarchical)
  const detailedCategoryReportData = [
      {
          category: "Engine Oil",
          brands: [
              {
                  name: "Kennol",
                  items: [
                      { id: 1, name: "Kennol 5W-30 (1L)", qty: 120, price: 3.500 },
                      { id: 2, name: "Kennol 5W-40 (5L)", qty: 60, price: 13.000 },
                      { id: 3, name: "Kennol 0W-20 (1L)", qty: 0, price: 4.000 }
                  ]
              },
              {
                  name: "Dimas Oil",
                  items: [
                      { id: 4, name: "Dimas Oil 10W 40 (1L)", qty: 50, price: 2.000 }
                  ]
              }
          ]
      },
      {
          category: "Dry Pet Food",
          brands: [
              {
                  name: "Cebican",
                  items: [
                      { id: 5, name: "Cebican (Cat) Tuna_3KG", qty: 45, price: 3.570 },
                      { id: 6, name: "Cebican mini Adult 3kg", qty: 20, price: 3.180 }
                  ]
              },
               {
                  name: "X Pets",
                  items: [
                      { id: 7, name: "X Pets Cat (Chicken) Chunks 400g", qty: 60, price: 0.357 }
                  ]
              }
          ]
      },
      {
          category: "Cat Litter",
          brands: [
              {
                  name: "ClearCat Blanco",
                  items: [
                      { id: 8, name: "Aloe Vera 10L", qty: 37, price: 2.565 },
                      { id: 9, name: "Lavender 5L", qty: 42, price: 1.520 }
                  ]
              }
          ]
      }
  ];

  // 6. By Brand Data
  const brandData = [
    { id: 1, brand: 'Cebican', stock: 21.000, sold: 272.000, total: 816.520 },
    { id: 2, brand: 'Cebican Cosmo', stock: 37.000, sold: 76.000, total: 214.450 },
    { id: 3, brand: 'ClearCat Blanco', stock: 236.000, sold: 335.000, total: 591.246 },
    { id: 4, brand: 'Danna', stock: 13.000, sold: 61.000, total: 1109.000 },
    { id: 5, brand: 'Dimas Oil', stock: 285.000, sold: 50.000, total: 164.450 },
    { id: 6, brand: 'Dousti', stock: 1.000, sold: 96.000, total: 692.300 },
    { id: 7, brand: 'Kennol', stock: 63.000, sold: 227.000, total: 2151.500 },
    { id: 8, brand: 'X Pets', stock: 1788.000, sold: 1871.000, total: 685.383 },
  ];

  const getFilteredData = () => {
      const commonFilters = (d: any) => 
        (filters.customer.length === 0 || (d.customer && filters.customer.includes(d.customer))) &&
        (filters.customerGroup.length === 0 || (d.group && filters.customerGroup.includes(d.group))) &&
        (filters.location.length === 0 || (d.location && filters.location.includes(d.location))) &&
        (filters.category.length === 0 || (d.category && filters.category.includes(d.category))) &&
        (filters.brand.length === 0 || (d.brand && filters.brand.includes(d.brand)));

      switch(activeTab) {
          case 'detailed': return detailedData.filter(d => d.product.toLowerCase().includes(searchTerm.toLowerCase()) && commonFilters(d));
          case 'detailed_purchase': return detailedPurchaseData.filter(d => d.product.toLowerCase().includes(searchTerm.toLowerCase()) && commonFilters(d));
          case 'grouped': return groupedDateData.filter(d => d.product.toLowerCase().includes(searchTerm.toLowerCase()) && commonFilters(d));
          case 'category': return categoryData.filter(d => d.category.toLowerCase().includes(searchTerm.toLowerCase()) && (filters.category.length === 0 || filters.category.includes(d.category)));
          case 'brand': return brandData.filter(d => d.brand.toLowerCase().includes(searchTerm.toLowerCase()) && (filters.brand.length === 0 || filters.brand.includes(d.brand)));
          // detailed_category handled separately in render
          default: return [];
      }
  };

  const filteredData = getFilteredData();
  
  // Logic to filter hierarchical data for Detailed Category
  const filteredHierarchicalData = detailedCategoryReportData.map(cat => ({
      ...cat,
      brands: cat.brands.map(brand => ({
          ...brand,
          items: brand.items.filter(item => 
              (item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
              brand.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              cat.category.toLowerCase().includes(searchTerm.toLowerCase()))
          )
      })).filter(brand => brand.items.length > 0)
  })).filter(cat => 
    cat.brands.length > 0 &&
    (filters.category.length === 0 || filters.category.includes(cat.category)) &&
    (filters.brand.length === 0 || cat.brands.some(b => filters.brand.includes(b.name)))
  );

  // Aggregates for Footer
  const calculateFooter = () => {
    switch(activeTab) {
        case 'detailed':
            return {
                qty: (filteredData as typeof detailedData).reduce((a, b) => a + b.qty, 0),
                total: (filteredData as typeof detailedData).reduce((a, b) => a + b.total, 0)
            };
        case 'detailed_purchase':
            return {
                qty: (filteredData as typeof detailedPurchaseData).reduce((a, b) => a + b.qty, 0),
                total: 0 // No total amount in this view based on columns
            };
        case 'grouped':
            return {
                currentStock: (filteredData as typeof groupedDateData).reduce((a, b) => a + b.stock, 0),
                unitSold: (filteredData as typeof groupedDateData).reduce((a, b) => a + b.sold, 0),
                total: (filteredData as typeof groupedDateData).reduce((a, b) => a + b.total, 0)
            };
        case 'category':
            return {
                currentStock: (filteredData as typeof categoryData).reduce((a, b) => a + b.stock, 0),
                unitSold: (filteredData as typeof categoryData).reduce((a, b) => a + b.sold, 0),
                total: (filteredData as typeof categoryData).reduce((a, b) => a + b.total, 0)
            };
        case 'brand':
            return {
                currentStock: (filteredData as typeof brandData).reduce((a, b) => a + b.stock, 0),
                unitSold: (filteredData as typeof brandData).reduce((a, b) => a + b.sold, 0),
                total: (filteredData as typeof brandData).reduce((a, b) => a + b.total, 0)
            };
        default:
            return { qty: 0, total: 0 };
    }
  };

  const footer = calculateFooter();

  const tabs = [
      { id: 'detailed', label: 'Detailed', icon: List },
      { id: 'detailed_purchase', label: 'Detailed (With purchase)', icon: ShoppingBag },
      { id: 'grouped', label: 'Grouped (By Date)', icon: Calendar },
      { id: 'category', label: 'By Category', icon: Layers },
      { id: 'detailed_category', label: 'Detailed Category', icon: Layers },
      { id: 'brand', label: 'By Brand', icon: Tag },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <h2 className="text-xl font-bold text-slate-900">Product Sell Report</h2>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div 
            className="flex items-center gap-2 mb-2 text-blue-600 font-bold text-sm cursor-pointer w-fit"
            onClick={() => setShowFilters(!showFilters)}
          >
              <Filter size={16} /> Filters
          </div>
          
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2 animate-in slide-in-from-top-2">
                <div className="group">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Search Product:</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                            type="text" 
                            placeholder="Enter Product name / SKU / Scan bar code" 
                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs font-medium outline-none" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Customer"
                        options={['Direct Customer', 'Tbroza Hypermarket (Mobailah)', 'Dr. Amani (Manooma)', 'Ajyal Veterinary Center (Mobailah)']}
                        selected={filters.customer}
                        onChange={(val) => setFilters({...filters, customer: val})}
                    />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Customer Group Name"
                        options={['Supermarkets Customers', 'Pet food customer']}
                        selected={filters.customerGroup}
                        onChange={(val) => setFilters({...filters, customerGroup: val})}
                    />
                </div>
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
                        options={['Dry Pet Food', 'Engine oil', 'Sand (clear cat)', 'Wet Pet Food', 'Cat Litter']}
                        selected={filters.category}
                        onChange={(val) => setFilters({...filters, category: val})}
                    />
                </div>
                <div className="group">
                    <MultiSelect 
                        label="Brand"
                        options={['Cebican', 'Cebican Cosmo', 'ClearCat Blanco', 'Danna', 'Dimas Oil', 'Dousti', 'Kennol', 'X Pets']}
                        selected={filters.brand}
                        onChange={(val) => setFilters({...filters, brand: val})}
                    />
                </div>
                <div className="group md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Date Range:</label>
                    <DateRangeFilter />
                </div>
            </div>
          )}
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {/* Tabs */}
          <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50/50">
              {tabs.map((tab) => (
                  <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-6 py-4 text-xs font-bold whitespace-nowrap transition-all border-b-2 ${
                          activeTab === tab.id 
                          ? 'border-blue-600 text-blue-600 bg-white' 
                          : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-white'
                      }`}
                  >
                      <span><tab.icon size={14} /></span> {tab.label}
                  </button>
              ))}
          </div>

          {/* Controls - Visible for ALL tabs now including Detailed Category */}
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
              <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-bold">Show</span>
                  <select className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none">
                      <option>25</option>
                      <option>50</option>
                  </select>
                  <span className="text-xs text-slate-600 font-bold">entries</span>
              </div>
              <div className="flex gap-1">
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10}/> Export CSV</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileSpreadsheet size={10}/> Export Excel</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Printer size={10}/> Print</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Columns size={10}/> Column visibility</button>
                  <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10}/> Export PDF</button>
              </div>
              <div className="flex items-center gap-2">
                  <Search className="text-slate-400" size={14} />
                  <input type="text" placeholder="Search..." className="pl-2 py-1 border border-slate-300 rounded text-xs outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
          </div>

          <div className="overflow-x-auto min-h-[400px]">
              {activeTab === 'detailed' && (
                  <table className="w-full text-[10px] text-left border-collapse">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                              <th className="px-4 py-3 whitespace-nowrap">Product <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap">SKU <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap">Customer name <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap">Contact ID <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap">Invoice No. <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap">Date <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap text-right">Quantity <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap text-right">Unit Price <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap text-right">Discount <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap text-right">Tax <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap text-right">Price inc. tax <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap text-right">Total <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap">Payment Method <ArrowUpDown size={8} className="inline ml-1" /></th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {(filteredData as typeof detailedData).map((row) => (
                              <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-4 py-2 font-medium text-slate-700">{row.product}</td>
                                  <td className="px-4 py-2 text-slate-500 font-mono">{row.sku}</td>
                                  <td className="px-4 py-2">{row.customer}</td>
                                  <td className="px-4 py-2 text-slate-500">{row.contactId}</td>
                                  <td className="px-4 py-2 text-slate-700 font-bold">{row.inv}</td>
                                  <td className="px-4 py-2 text-slate-600">{row.date}</td>
                                  <td className="px-4 py-2 text-right">{row.qty.toFixed(3)} {row.unit}</td>
                                  <td className="px-4 py-2 text-right">{formatRiyal(row.uPrice)}</td>
                                  <td className="px-4 py-2 text-right">{row.disc.toFixed(3)}</td>
                                  <td className="px-4 py-2 text-right">{row.tax.toFixed(3)}</td>
                                  <td className="px-4 py-2 text-right">{formatRiyal(row.priceInc)}</td>
                                  <td className="px-4 py-2 text-right font-bold text-slate-800">{formatRiyal(row.total)}</td>
                                  <td className="px-4 py-2">{row.payMethod}</td>
                              </tr>
                          ))}
                      </tbody>
                      <tfoot className="bg-slate-200 font-bold text-slate-800 text-[10px] border-t border-slate-300 sticky bottom-0">
                          <tr>
                              <td colSpan={6} className="px-4 py-3 text-right uppercase">Total:</td>
                              <td className="px-4 py-3 text-right">{(footer as any).qty?.toFixed(3)} Pc(s)</td>
                              <td colSpan={4}></td>
                              <td className="px-4 py-3 text-right">{formatRiyal((footer as any).total || 0)}</td>
                              <td></td>
                          </tr>
                      </tfoot>
                  </table>
              )}

              {activeTab === 'detailed_purchase' && (
                  <table className="w-full text-[10px] text-left border-collapse">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                              <th className="px-4 py-3 whitespace-nowrap">Product <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap">SKU <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap">Customer name <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap">Invoice No. <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap">Date <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap">Purchase ref no. <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap">Lot Number <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap">Supplier Name <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap text-right">Quantity <ArrowUpDown size={8} className="inline ml-1" /></th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {(filteredData as typeof detailedPurchaseData).map((row) => (
                              <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-4 py-2 font-medium text-slate-700">{row.product}</td>
                                  <td className="px-4 py-2 text-slate-500 font-mono">{row.sku}</td>
                                  <td className="px-4 py-2">{row.customer}</td>
                                  <td className="px-4 py-2 text-slate-700 font-bold">{row.inv}</td>
                                  <td className="px-4 py-2 text-slate-600">{row.date}</td>
                                  <td className="px-4 py-2 text-slate-500 italic">{row.purchaseRef}</td>
                                  <td className="px-4 py-2">{row.lot}</td>
                                  <td className="px-4 py-2">{row.supplier}</td>
                                  <td className="px-4 py-2 text-right">{row.qty.toFixed(3)} Pc(s)</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              )}

              {activeTab === 'grouped' && (
                  <table className="w-full text-[10px] text-left border-collapse">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                              <th className="px-4 py-3 whitespace-nowrap">Product <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap">SKU <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap">Date <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap text-right">Current stock <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap text-right">Total unit sold <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap text-right">Total <ArrowUpDown size={8} className="inline ml-1" /></th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {(filteredData as typeof groupedDateData).map((row) => (
                              <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-4 py-2 font-medium text-slate-700">{row.product}</td>
                                  <td className="px-4 py-2 text-slate-500 font-mono">{row.sku}</td>
                                  <td className="px-4 py-2 text-slate-600">{row.date}</td>
                                  <td className="px-4 py-2 text-right">{row.stock.toFixed(3)} Pc(s)</td>
                                  <td className="px-4 py-2 text-right">{row.sold.toFixed(3)} Pc(s)</td>
                                  <td className="px-4 py-2 text-right font-bold">{formatRiyal(row.total)}</td>
                              </tr>
                          ))}
                      </tbody>
                      <tfoot className="bg-slate-200 font-bold text-slate-800 text-[10px] border-t border-slate-300 sticky bottom-0">
                          <tr>
                              <td colSpan={3} className="px-4 py-3 text-right uppercase">Total:</td>
                              <td className="px-4 py-3 text-right">{(footer as any).currentStock?.toFixed(3)} Pc(s)</td>
                              <td className="px-4 py-3 text-right">{(footer as any).unitSold?.toFixed(3)} Pc(s)</td>
                              <td className="px-4 py-3 text-right">{formatRiyal((footer as any).total || 0)}</td>
                          </tr>
                      </tfoot>
                  </table>
              )}

              {(activeTab === 'category' || activeTab === 'brand') && (
                  <table className="w-full text-[10px] text-left border-collapse">
                      <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                              <th className="px-4 py-3 whitespace-nowrap">{activeTab === 'category' ? 'Category' : 'Brand'} <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap text-right">Current stock <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap text-right">Total unit sold <ArrowUpDown size={8} className="inline ml-1" /></th>
                              <th className="px-4 py-3 whitespace-nowrap text-right">Total <ArrowUpDown size={8} className="inline ml-1" /></th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {(filteredData as any[]).map((row: any) => (
                              <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-4 py-2 font-medium text-slate-700">{activeTab === 'category' ? row.category : row.brand}</td>
                                  <td className="px-4 py-2 text-right">{row.stock.toFixed(3)}</td>
                                  <td className="px-4 py-2 text-right">{row.sold.toFixed(3)}</td>
                                  <td className="px-4 py-2 text-right font-bold">{formatRiyal(row.total)}</td>
                              </tr>
                          ))}
                      </tbody>
                      <tfoot className="bg-slate-200 font-bold text-slate-800 text-[10px] border-t border-slate-300 sticky bottom-0">
                          <tr>
                              <td className="px-4 py-3 text-right uppercase">Total:</td>
                              <td className="px-4 py-3 text-right">{(footer as any).currentStock?.toFixed(3)}</td>
                              <td className="px-4 py-3 text-right">{(footer as any).unitSold?.toFixed(3)}</td>
                              <td className="px-4 py-3 text-right">{formatRiyal((footer as any).total || 0)}</td>
                          </tr>
                      </tfoot>
                  </table>
              )}

              {/* === HIERARCHICAL DETAILED CATEGORY REPORT === */}
              {activeTab === 'detailed_category' && (
                  <div className="w-full bg-white pb-6">
                      
                      {filteredHierarchicalData.map((categoryGroup, catIndex) => {
                          // Calculate Category Total
                          const catTotal = categoryGroup.brands.reduce((acc, brand) => {
                              return acc + brand.items.reduce((bAcc, item) => bAcc + (item.qty * item.price), 0);
                          }, 0);

                          return (
                              <div key={catIndex} className="mb-8 border-b-2 border-slate-100 pb-6 last:border-0 last:pb-0">
                                  {/* Major Category Header */}
                                  <div className="bg-slate-100/80 px-6 py-3 border-y border-slate-200 sticky top-0 z-10">
                                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex justify-between items-center">
                                          <span>{categoryGroup.category}</span>
                                          <span className="text-slate-500 font-medium text-xs">Category Total: {formatRiyal(catTotal)}</span>
                                      </h3>
                                  </div>

                                  <div className="px-6">
                                      {categoryGroup.brands.map((brandGroup, brandIndex) => {
                                           // Calculate Brand Subtotal
                                           const brandTotal = brandGroup.items.reduce((acc, item) => acc + (item.qty * item.price), 0);

                                           return (
                                              <div key={brandIndex} className="mt-6 mb-4">
                                                  {/* Brand Header */}
                                                  <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                                                      <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-2">
                                                          <Tag size={12} /> {brandGroup.name}
                                                      </h4>
                                                  </div>

                                                  {/* Data Table */}
                                                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                                                      <table className="w-full text-xs text-left">
                                                          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                                              <tr>
                                                                  <th className="px-4 py-2 w-12 text-center">S.N</th>
                                                                  <th className="px-4 py-2">Product Name</th>
                                                                  <th className="px-4 py-2 text-right w-32">Quantity</th>
                                                                  <th className="px-4 py-2 text-right w-32">Unit Price</th>
                                                                  <th className="px-4 py-2 text-right w-40">Total</th>
                                                              </tr>
                                                          </thead>
                                                          <tbody className="divide-y divide-slate-100">
                                                              {brandGroup.items.map((item, itemIndex) => (
                                                                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                                      <td className="px-4 py-2 text-center text-slate-400 font-mono text-[10px]">{itemIndex + 1}</td>
                                                                      <td className="px-4 py-2 font-medium text-slate-700">{item.name}</td>
                                                                      <td className="px-4 py-2 text-right text-slate-600">
                                                                          {item.qty > 0 ? item.qty : ''}
                                                                      </td>
                                                                      <td className="px-4 py-2 text-right text-slate-600">
                                                                          {item.qty > 0 ? formatRiyal(item.price) : ''}
                                                                      </td>
                                                                      <td className="px-4 py-2 text-right font-bold text-slate-800">
                                                                          {item.qty > 0 ? formatRiyal(item.qty * item.price) : ''}
                                                                      </td>
                                                                  </tr>
                                                              ))}
                                                          </tbody>
                                                          <tfoot className="bg-slate-50 font-bold text-slate-700 border-t border-slate-200">
                                                              <tr>
                                                                  <td colSpan={4} className="px-4 py-2 text-right text-[10px] uppercase">Sub-Total ({brandGroup.name}):</td>
                                                                  <td className="px-4 py-2 text-right">{formatRiyal(brandTotal)}</td>
                                                              </tr>
                                                          </tfoot>
                                                      </table>
                                                  </div>
                                              </div>
                                           );
                                      })}
                                  </div>
                                  
                                  {/* Category Footer Summary */}
                                  <div className="mt-4 mr-6 flex justify-end">
                                      <div className="bg-slate-800 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm">
                                          {categoryGroup.category} Total: {formatRiyal(catTotal)}
                                      </div>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}
          </div>

          {activeTab !== 'detailed_category' && (
             <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
                <div>Showing 1 to {filteredData.length} of {filteredData.length} entries</div>
                <div className="flex gap-1">
                    <button className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-50" disabled>Previous</button>
                    <button className="px-2 py-1 bg-blue-600 text-white border border-blue-600 rounded shadow-sm">1</button>
                    <button className="px-2 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50">2</button>
                    <button className="px-2 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50">3</button>
                    <button className="px-2 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50">4</button>
                    <button className="px-2 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50">5</button>
                    <button className="px-2 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50">Next</button>
                </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default ReportProductSell;