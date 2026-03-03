import React, { useState } from 'react';
import { 
  Printer, Filter, MapPin, Calendar, ChevronDown, 
  FileText, FileSpreadsheet, Columns, Download, Search,
  ArrowUpDown, Info
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

// Utility for currency formatting
const formatRiyal = (amount: number) => {
  return `${amount.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ريال`;
};

const ReportProfitLoss: React.FC = () => {
  const { locations } = useGlobalContext();
  const [activeTab, setActiveTab] = useState('products');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
      location: [] as string[]
  });

  // Mock Financial Data matching the screenshot structure
  const financialData = {
    openingStockPurchase: 5088.430,
    openingStockSale: 62459.871,
    totalPurchase: 0.000,
    totalStockAdjustment: 0.000,
    totalExpense: 76.300,
    totalPurchaseShipping: 0.000,
    purchaseAdditionalExpenses: 0.000,
    totalTransferShipping: 0.000,
    totalSellDiscount: 107.536,
    totalCustomerReward: 0.000,
    totalSellReturn: 335.652,

    closingStockPurchase: 2642.107,
    closingStockSale: 60640.574,
    totalSales: 6297.761,
    totalSellShipping: 12.200,
    sellAdditionalExpenses: 0.000,
    totalStockRecovered: 0.000,
    totalPurchaseReturn: 0.000,
    totalPurchaseDiscount: 0.000,
    totalSellRoundOff: 0.000,
  };

  const cogs = 5730.537;
  const grossProfit = 5851.080;
  const netProfit = 5680.644;

  // Mock Table Data for "Profit by products"
  const productProfits = [
    { id: 1, product: 'Activated Carbon 10L (0147)', grossProfit: 0.815, location: 'CR:1450968' },
    { id: 2, product: 'Activated Carbon 5L (0146)', grossProfit: 20.849, location: 'CR:1450968' },
    { id: 3, product: 'Aloe Vera 10L (0141)', grossProfit: 3.788 },
    { id: 4, product: 'Aloe Vera 20L (0142)', grossProfit: 21.002 },
    { id: 5, product: 'Aloe Vera 5L (0140)', grossProfit: 40.607 },
    { id: 6, product: 'Baby Powder 10L (0144)', grossProfit: 0.125 },
    { id: 7, product: 'Baby Powder 5L (0145)', grossProfit: 59.929 },
    { id: 8, product: 'Cebican (Cat) Mix_3KG (8436611140168)', grossProfit: 54.320 },
    { id: 9, product: 'Cebican (Cat) Tuna_3KG (8436611140187)', grossProfit: 157.290 },
    { id: 10, product: 'Cebican Cosmo Cat Adult Lamb 1.5kg (0154)', grossProfit: 87.450 },
    { id: 11, product: 'Cebican Cosmo Cat Adult Lamb 7.5kg (0156)', grossProfit: 61.000 },
    { id: 12, product: 'Cebican Cosmo Cat Tuna Adult 1.5kg (0155)', grossProfit: 66.000 },
    { id: 13, product: 'Cebican Kitten_1kg (8436036368916)', grossProfit: 124.500 },
    { id: 14, product: 'Cebican mini Adult 3kg (8436611140392)', grossProfit: 238.290 },
    { id: 15, product: 'Daily Care 8kg (8436036368548)', grossProfit: 120.700 },
    { id: 16, product: 'Danna Sprime Cat_10kg (0117)', grossProfit: 36.000 },
    { id: 17, product: 'Danna Supreme Complet Dog_20kg (0118)', grossProfit: 870.000 },
    { id: 18, product: 'Danna Supreme Elite (Dog)_10kg (0114)', grossProfit: 94.000 },
    { id: 19, product: 'Danna Supreme Puppy_10kg (0116)', grossProfit: 109.000 },
    { id: 20, product: 'Dimas Oil 10W 40 (1L)4T (0109)', grossProfit: 100.000 },
    { id: 21, product: 'Dimas Oil 5W 20 (4L) (0105)', grossProfit: 16.000 },
    { id: 22, product: 'Dimas Oil 5W 30 (4L) (0099)', grossProfit: 32.000 },
    { id: 23, product: 'Dimas Oil 5W 40 (1L) (0102)', grossProfit: 2.250 },
    { id: 24, product: 'Dimas Oil 5W 40 (4L) (0101)', grossProfit: 8.000 },
    { id: 25, product: 'Dimas Oil Coolant PSI OAT G12 (0111)', grossProfit: 6.200 },
  ];

  const filteredProducts = productProfits.filter(item => 
    item.product.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (filters.location.length === 0 || filters.location.includes(item.location))
  );

  const totalTableProfit = filteredProducts.reduce((sum, item) => sum + item.grossProfit, 0);

  const tabs = [
    { id: 'products', label: 'Profit by products', icon: '📦' },
    { id: 'categories', label: 'Profit by categories', icon: '📂' },
    { id: 'brands', label: 'Profit by brands', icon: '🏷️' },
    { id: 'locations', label: 'Profit by locations', icon: '📍' },
    { id: 'invoice', label: 'Profit by invoice', icon: '🧾' },
    { id: 'date', label: 'Profit by date', icon: '📅' },
    { id: 'customer', label: 'Profit by customer', icon: '👤' },
    { id: 'day', label: 'Profit by day', icon: '☀️' },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      
      {/* Header & Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
              <h2 className="text-xl font-bold text-slate-800 whitespace-nowrap">Profit / Loss Report</h2>
              <div className="h-6 w-px bg-slate-200 hidden md:block"></div>
              <div className="relative w-full md:w-64">
                  <MultiSelect 
                        label="Location"
                        options={locations.map(loc => loc.name)}
                        selected={filters.location}
                        onChange={(val) => setFilters({...filters, location: val})}
                        className="w-full"
                    />
              </div>
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
               <div className="bg-slate-100 rounded-lg p-1 border border-slate-200">
                   <DateRangeFilter className="min-w-[200px]" />
               </div>
               <button className="bg-[#6200ea] text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-[#5000ca] flex items-center gap-2">
                   <Filter size={16} /> Filter by date
               </button>
          </div>
      </div>

      {/* Financial Breakdown Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          
          {/* Left Card: Opening Stock & Expenses */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 space-y-3 text-xs">
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="font-bold text-slate-700">Opening Stock <br/><span className="font-normal text-[10px] text-slate-500">(By purchase price):</span></span>
                      <span className="font-medium text-slate-600">{formatRiyal(financialData.openingStockPurchase)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="font-bold text-slate-700">Opening Stock <br/><span className="font-normal text-[10px] text-slate-500">(By sale price):</span></span>
                      <span className="font-medium text-slate-600">{formatRiyal(financialData.openingStockSale)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="font-bold text-slate-700">Total Purchase: <br/><span className="font-normal text-[10px] text-slate-500">(Exc. tax, Discount)</span></span>
                      <span className="font-medium text-slate-600">{formatRiyal(financialData.totalPurchase)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="font-bold text-slate-700">Total Stock Adjustment:</span>
                      <span className="font-medium text-slate-600">{formatRiyal(financialData.totalStockAdjustment)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="font-bold text-slate-700">Total Expense:</span>
                      <span className="font-medium text-slate-600">{formatRiyal(financialData.totalExpense)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="font-bold text-slate-700">Total purchase shipping charge:</span>
                      <span className="font-medium text-slate-600">{formatRiyal(financialData.totalPurchaseShipping)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="font-bold text-slate-700">Purchase additional expenses:</span>
                      <span className="font-medium text-slate-600">{formatRiyal(financialData.purchaseAdditionalExpenses)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="font-bold text-slate-700">Total transfer shipping charge:</span>
                      <span className="font-medium text-slate-600">{formatRiyal(financialData.totalTransferShipping)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="font-bold text-slate-700">Total Sell discount:</span>
                      <span className="font-medium text-slate-600">{formatRiyal(financialData.totalSellDiscount)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="font-bold text-slate-700">Total customer reward:</span>
                      <span className="font-medium text-slate-600">{formatRiyal(financialData.totalCustomerReward)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                      <span className="font-bold text-slate-700">Total Sell Return:</span>
                      <span className="font-medium text-slate-600">{formatRiyal(financialData.totalSellReturn)}</span>
                  </div>
              </div>
          </div>

          {/* Right Card: Closing Stock & Sales */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 space-y-3 text-xs">
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="font-bold text-slate-700">Closing Stock <br/><span className="font-normal text-[10px] text-slate-500">(By purchase price):</span></span>
                      <span className="font-medium text-slate-600">{formatRiyal(financialData.closingStockPurchase)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="font-bold text-slate-700">Closing Stock <br/><span className="font-normal text-[10px] text-slate-500">(By sale price):</span></span>
                      <span className="font-medium text-slate-600">{formatRiyal(financialData.closingStockSale)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="font-bold text-slate-700">Total Sales: <br/><span className="font-normal text-[10px] text-slate-500">(Exc. tax, Discount)</span></span>
                      <span className="font-medium text-slate-600">{formatRiyal(financialData.totalSales)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="font-bold text-slate-700">Total sell shipping charge:</span>
                      <span className="font-medium text-slate-600">{formatRiyal(financialData.totalSellShipping)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="font-bold text-slate-700">Sell additional expenses:</span>
                      <span className="font-medium text-slate-600">{formatRiyal(financialData.sellAdditionalExpenses)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="font-bold text-slate-700">Total Stock Recovered:</span>
                      <span className="font-medium text-slate-600">{formatRiyal(financialData.totalStockRecovered)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="font-bold text-slate-700">Total Purchase Return:</span>
                      <span className="font-medium text-slate-600">{formatRiyal(financialData.totalPurchaseReturn)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="font-bold text-slate-700">Total Purchase discount:</span>
                      <span className="font-medium text-slate-600">{formatRiyal(financialData.totalPurchaseDiscount)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                      <span className="font-bold text-slate-700">Total sell round off:</span>
                      <span className="font-medium text-slate-600">{formatRiyal(financialData.totalSellRoundOff)}</span>
                  </div>
              </div>
          </div>
      </div>

      {/* Summary Calculations */}
      <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div>
              <h3 className="text-xl font-medium text-slate-500 flex items-center gap-2">
                  COGS: <span className="font-bold text-slate-700">{formatRiyal(cogs)}</span>
              </h3>
              <p className="text-[10px] text-slate-400 font-mono mt-1">
                  (Total opening stock + Total purchase + Total purchase shipping charge + Total Stock Adjustment + Purchase additional expenses) - (Total purchase return + Total purchase discount + Total closing stock)
              </p>
          </div>
          <div>
              <h3 className="text-xl font-medium text-slate-500 flex items-center gap-2">
                  Gross Profit: <span className="font-bold text-slate-700">{formatRiyal(grossProfit)}</span>
              </h3>
              <p className="text-[10px] text-slate-400 font-mono mt-1">
                  (Total sell price - Total purchase price)
              </p>
          </div>
          <div className="pt-2 border-t border-slate-200">
              <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                  Net Profit: <span className="text-emerald-600">{formatRiyal(netProfit)}</span>
              </h3>
              <p className="text-[10px] text-slate-400 font-mono mt-1">
                  Gross Profit + (Total sell shipping charge + Sell additional expenses + Total Stock Recovered + Total Purchase discount + Total sell round off ) - ( Total Stock Adjustment + Total Expense + Total purchase shipping charge + Total transfer shipping charge + Purchase additional expenses + Total Sell discount + Total customer reward )
              </p>
          </div>
      </div>

      {/* Detailed Reports */}
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
                      <span>{tab.icon}</span> {tab.label}
                  </button>
              ))}
          </div>

          {/* Table Controls */}
          {activeTab === 'products' && (
              <>
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
                        <button className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1 shadow-sm"><FileText size={10}/> Export CSV</button>
                        <button className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1 shadow-sm"><FileSpreadsheet size={10}/> Excel</button>
                        <button className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1 shadow-sm"><Printer size={10}/> Print</button>
                        <button className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1 shadow-sm"><Columns size={10}/> Visibility</button>
                        <button className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-bold text-slate-600 hover:bg-slate-200 flex items-center gap-1 shadow-sm"><FileText size={10}/> PDF</button>
                    </div>

                    <div className="flex items-center gap-2 relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            className="pl-8 pr-3 py-1.5 rounded border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-white text-slate-700 font-bold border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3">Product <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                                <th className="px-6 py-3 text-right">Gross Profit <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredProducts
                                .map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-3 text-slate-700 font-medium">{item.product}</td>
                                    <td className="px-6 py-3 text-right text-slate-600">{formatRiyal(item.grossProfit)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-200 font-bold text-slate-800 text-xs border-t border-slate-300">
                            <tr>
                                <td className="px-6 py-3 text-right uppercase">Total:</td>
                                <td className="px-6 py-3 text-right">{formatRiyal(totalTableProfit)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
                    <div>Showing {filteredProducts.length} entries</div>
                    <div className="flex gap-1">
                        <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled>Previous</button>
                        <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled>Next</button>
                    </div>
                </div>
              </>
          )}

          {activeTab !== 'products' && (
              <div className="p-12 text-center text-slate-400 italic">
                  Content for {tabs.find(t => t.id === activeTab)?.label} would appear here.
              </div>
          )}
      </div>

      <div className="text-[10px] text-slate-400 mt-4 leading-relaxed">
          <p><strong>Note:</strong> Profit by products / categories / brands only considers inline discount. Invoice discount is not considered.</p>
      </div>

    </div>
  );
};

export default ReportProfitLoss;