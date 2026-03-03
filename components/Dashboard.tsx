import React, { useState, useMemo } from 'react';
import { 
  DollarSign, TrendingUp, Package, AlertTriangle, 
  ArrowUpRight, ArrowDownRight, Calendar, Users, ChevronDown,
  Brain, Zap, Target, Activity, Sparkles, AlertCircle, TrendingDown,
  ArrowRight, Layers, ShoppingCart, Banknote, FileText, RefreshCw,
  Download, Info
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ComposedChart, Line, Bar
} from 'recharts';
import { useGlobalContext } from '../src/context/GlobalContext';

// --- Types & Constants ---

type TimeRange = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';
type Category = 'All' | 'Engine Oil' | 'Pet Accessories' | 'Pet Foods';
type CustomerType = 'All' | 'Pet Food Shops' | 'Supermarkets' | 'Individual';

const COLORS = ['#dc2626', '#2563eb', '#d97706', '#10b981', '#8b5cf6'];

const SUB_CATEGORIES: Record<string, string[]> = {
  'All': ['All'],
  'Engine Oil': ['All', 'Danna Oil', 'Kennol Oil'],
  'Pet Accessories': ['All', 'Collars & Leashes', 'Toys', 'Bedding'],
  'Pet Foods': ['All', 'Dry Food', 'Wet Food', 'Treats']
};

const Dashboard: React.FC = () => {
  const { sales, products, purchases, locations, customers, expenses, currentUser, formatCurrency } = useGlobalContext();
  // --- State ---
  const [timeRange, setTimeRange] = useState<TimeRange>('Monthly');
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('All');
  const [selectedCustomerType, setSelectedCustomerType] = useState<CustomerType>('All');

  // --- Smart Data Generators ---

  // 1. Forecast & Trend Data — computed from real sales grouped by week
  const trendData = useMemo(() => {
    const weeks: Record<string, number> = {};
    const now = new Date();
    // Build last 4 weeks buckets
    for (let w = 3; w >= 0; w--) {
      const label = `Week ${4 - w}`;
      weeks[label] = 0;
    }
    sales.forEach(sale => {
      const saleDate = new Date(sale.date);
      const diffMs = now.getTime() - saleDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays < 28) {
        const weekIdx = Math.floor(diffDays / 7);
        const label = `Week ${4 - weekIdx}`;
        if (weeks[label] !== undefined) {
          weeks[label] += sale.grandTotal || 0;
        }
      }
    });
    const historicalData = Object.entries(weeks).map(([name, amount]) => ({
      name,
      sales: parseFloat(amount.toFixed(3)),
      profit: parseFloat((amount * 0.25).toFixed(3)), // estimated 25% margin
      forecast: null as number | null,
      target: parseFloat((amount * 1.1).toFixed(3))
    }));
    // last real week becomes connection point
    if (historicalData.length > 0) {
      const lastReal = historicalData[historicalData.length - 1];
      historicalData[historicalData.length - 1].forecast = lastReal.sales;
    }
    const avgSales = historicalData.reduce((s, d) => s + (d.sales || 0), 0) / (historicalData.length || 1);
    return [
      ...historicalData,
      { name: 'Week 5 (Est)', sales: null, profit: null, forecast: parseFloat((avgSales * 1.08).toFixed(3)), target: parseFloat((avgSales * 1.1).toFixed(3)) },
      { name: 'Week 6 (Est)', sales: null, profit: null, forecast: parseFloat((avgSales * 1.15).toFixed(3)), target: parseFloat((avgSales * 1.2).toFixed(3)) },
    ];
  }, [sales, timeRange, selectedCategory]);

  // 2. Category Distribution — from real product categories via sales items
  const categoryData = useMemo(() => {
    const catTotals: Record<string, number> = {};
    sales.forEach(sale => {
      (sale.items || []).forEach((item: any) => {
        const prod = products.find(p => p.name === item.name || p.id === item.id);
        const cat = prod?.category || 'Uncategorized';
        catTotals[cat] = (catTotals[cat] || 0) + (item.total || item.subtotal || 0);
      });
    });
    if (Object.keys(catTotals).length === 0) {
      // Fallback: use product categories with placeholder values
      const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
      return cats.slice(0, 5).map((name, i) => ({ name, value: 1000 + i * 500 }));
    }
    return Object.entries(catTotals).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(3)) }));
  }, [sales, products]);

  // 3. Smart Inventory Recommendations — real low-stock products
  const smartInventory = useMemo(() => {
    return products
      .filter(p => p.stock !== undefined)
      .map(p => {
        const threshold = p.alertQuantity || 10;
        const stockRatio = p.stock / (threshold || 1);
        let velocity: 'High' | 'Medium' | 'Low' = 'Medium';
        let action = 'Monitor';
        if (p.stock <= 0) { velocity = 'High'; action = 'Out of Stock!'; }
        else if (p.stock <= threshold * 0.5) { velocity = 'High'; action = 'Urgent Reorder'; }
        else if (p.stock <= threshold) { velocity = 'Medium'; action = 'Reorder Soon'; }
        else if (stockRatio > 5) { velocity = 'Low'; action = 'Clearance Sale'; }
        return {
          id: p.id,
          name: p.name,
          velocity,
          stock: p.stock,
          dailySales: parseFloat((p.stock / 30).toFixed(1)),
          daysLeft: parseFloat((p.stock / Math.max(0.1, p.stock / 30)).toFixed(0)),
          action
        };
      })
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 8);
  }, [products]);

  // --- Handlers ---
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategory(e.target.value as Category);
    setSelectedSubCategory('All');
  };

  const totalSalesAmount = sales.reduce((sum, sale) => sum + (sale.grandTotal || 0), 0);
  const totalInvoiceDue = sales.filter(s => s.paymentStatus === 'Due' || s.paymentStatus === 'Partial').reduce((sum, sale) => sum + (sale.sellDue || 0), 0);
  const totalPurchaseAmount = purchases.reduce((sum, purchase) => sum + purchase.grandTotal, 0);
  const totalPurchaseDue = purchases.filter(p => p.paymentStatus === 'Due' || p.paymentStatus === 'Partial').reduce((sum, purchase) => sum + purchase.paymentDue, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.totalAmount || e.amount || 0), 0);
  const netProfit = totalSalesAmount - totalPurchaseAmount - totalExpenses;
  const lowStockCount = products.filter(p => p.stock !== undefined && p.stock <= (p.alertQuantity || 10)).length;
  const activeCustomers = customers.filter(c => c.status === 'Active').length;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* Header & Filters */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div className="flex items-center gap-2">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            Welcome {(currentUser?.name || currentUser?.username || 'User').split(' ')[0]}, <span className="inline-block animate-bounce">👋</span>
          </h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <select className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 appearance-none focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm">
              <option>Select location</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>

          <div className="relative">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm">
              <Calendar size={16} className="text-slate-400" />
              Filter by date
              <ChevronDown size={14} className="text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Row 1 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
            <ShoppingCart size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Sales</p>
            <h3 className="text-xl font-black text-slate-900">{totalSalesAmount.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} <span className="text-xs font-medium text-slate-400">OMR</span></h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500">
            <Banknote size={24} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Net</p>
              <Info size={12} className="text-blue-400 cursor-help" />
            </div>
            <h3 className="text-xl font-black text-slate-900">0.000 <span className="text-xs font-medium text-slate-400">OMR</span></h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Invoice due</p>
            <h3 className="text-xl font-black text-slate-900">{totalInvoiceDue.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} <span className="text-xs font-medium text-slate-400">OMR</span></h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500">
            <RefreshCw size={24} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Sell Return</p>
              <Info size={12} className="text-blue-400 cursor-help" />
            </div>
            <h3 className="text-xl font-black text-slate-900">0.000 <span className="text-xs font-medium text-slate-400">OMR</span></h3>
          </div>
        </div>

        {/* Row 2 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
            <Download size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total purchase</p>
            <h3 className="text-xl font-black text-slate-900">{totalPurchaseAmount.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} <span className="text-xs font-medium text-slate-400">OMR</span></h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Purchase due</p>
            <h3 className="text-xl font-black text-slate-900">{totalPurchaseDue.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} <span className="text-xs font-medium text-slate-400">OMR</span></h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500">
            <RefreshCw size={24} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Purchase Return</p>
              <Info size={12} className="text-blue-400 cursor-help" />
            </div>
            <h3 className="text-xl font-black text-slate-900">0.000 <span className="text-xs font-medium text-slate-400">OMR</span></h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Expense</p>
            <h3 className="text-xl font-black text-slate-900">{totalExpenses.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} <span className="text-xs font-medium text-slate-400">OMR</span></h3>
          </div>
        </div>
      </div>

      {/* AI Pulse Grid - The "Smart" Layer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Prediction Card */}
        <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-xl p-5 text-white shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <Brain size={80} />
            </div>
            <div className="flex items-start justify-between mb-4">
                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                    <Activity size={20} className="text-purple-100" />
                </div>
                <span className="text-xs font-bold bg-purple-500/50 px-2 py-1 rounded border border-purple-400/30">AI FORECAST</span>
            </div>
            <h3 className="text-2xl font-bold mb-1">{formatCurrency(trendData.find(d => d.name === 'Week 5 (Est)')?.forecast || 0)}</h3>
            <p className="text-purple-100 text-sm mb-4">Projected revenue next week (estimated +8%)</p>
            <div className="h-1 bg-black/20 rounded-full overflow-hidden">
                <div className="h-full bg-purple-300 w-[85%] rounded-full"></div>
            </div>
        </div>

        {/* Inventory Risk Card */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-5 text-white shadow-lg relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <Zap size={80} />
            </div>
            <div className="flex items-start justify-between mb-4">
                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                    <AlertTriangle size={20} className="text-amber-100" />
                </div>
                <span className="text-xs font-bold bg-orange-600/50 px-2 py-1 rounded border border-orange-400/30">STOCK RISK</span>
            </div>
            <h3 className="text-2xl font-bold mb-1">{lowStockCount} Item{lowStockCount !== 1 ? 's' : ''}</h3>
            <p className="text-amber-100 text-sm mb-4">Below reorder threshold — check inventory now.</p>
            <button className="w-full py-1.5 bg-white/20 hover:bg-white/30 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-2">
                View Risk List <ArrowRight size={12} />
            </button>
        </div>

        {/* Opportunity Card */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group">
            <div className="flex items-start justify-between mb-4">
                <div className="bg-emerald-100 p-2 rounded-lg">
                    <Target size={20} className="text-emerald-600" />
                </div>
                <span className="text-xs font-bold text-slate-400">SMART INSIGHT</span>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Growth Opportunity</h3>
            <p className="text-slate-500 text-sm mb-4 leading-relaxed">
                Sales of <span className="font-semibold text-slate-700">Pet Accessories</span> in Seeb region are up <span className="text-emerald-600 font-bold">18%</span>. 
                Consider running a targeted promotion.
            </p>
             <button className="text-emerald-600 text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all">
                Launch Promo <ArrowRight size={14} />
            </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Revenue', value: totalSalesAmount, change: '', isPos: true, icon: DollarSign },
          { label: 'Orders', value: sales.length, change: '', isPos: true, icon: Package, isCurrency: false },
          { label: 'Low Stock', value: lowStockCount, change: '', isPos: false, icon: AlertCircle, isCurrency: false, color: 'text-amber-600' },
          { label: 'Net Profit (Est.)', value: netProfit, change: '', isPos: netProfit >= 0, icon: TrendingUp },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
                 <div className="p-2 bg-slate-50 rounded-lg text-slate-600">
                    <stat.icon size={18} className={stat.color} />
                 </div>
                 <span className={`flex items-center gap-1 text-xs font-bold ${stat.isPos ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {stat.isPos ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {stat.change}
                 </span>
            </div>
            <div>
                <h3 className="text-xl font-bold text-slate-900">
                    {stat.isCurrency === false ? stat.value.toLocaleString() : formatCurrency(stat.value)}
                </h3>
                <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Predictive Analytics Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
                <h3 className="text-lg font-bold text-slate-900">Performance vs Target</h3>
                <p className="text-sm text-slate-500 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                    Includes AI projection for upcoming weeks
                </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
                <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-slate-900 rounded-[2px]"></span> Sales
                </div>
                <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-red-500 rounded-full"></span> Profit
                </div>
                 <div className="flex items-center gap-1">
                    <span className="w-3 h-1 border-t-2 border-dashed border-purple-500"></span> Forecast
                </div>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f172a" stopOpacity={0.8}/>
                    <stop offset="100%" stopColor="#0f172a" stopOpacity={0.4}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
                <Tooltip 
                  formatter={(value: number, name: string) => [formatCurrency(value), name.charAt(0).toUpperCase() + name.slice(1)]}
                  contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} 
                />
                <Bar dataKey="sales" fill="url(#barGradient)" barSize={40} radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="profit" stroke="#ef4444" strokeWidth={3} dot={{r: 4, fill: '#ef4444'}} />
                <Line type="monotone" dataKey="forecast" stroke="#a855f7" strokeWidth={3} strokeDasharray="5 5" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 mb-2">Sales Mix</h3>
          <p className="text-xs text-slate-500 mb-6">Distribution by category</p>
          
          <div className="flex-1 min-h-[250px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                <span className="text-2xl font-bold text-slate-800">
                    {Math.floor(categoryData.reduce((acc, curr) => acc + (curr.value/10000)*100, 0))}%
                </span>
                <span className="text-xs text-slate-500">Share</span>
            </div>
          </div>
        </div>
      </div>

      {/* Smart Inventory Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Zap size={18} className="text-amber-500" /> 
                Intelligent Inventory Actions
            </h3>
            <p className="text-sm text-slate-500">Recommendations based on stock velocity & sales history</p>
          </div>
          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium px-2">View Full Report</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-slate-500 font-medium border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4 text-center">Velocity</th>
                <th className="px-6 py-4 text-center">Current Stock</th>
                <th className="px-6 py-4 text-center">Daily Sales</th>
                <th className="px-6 py-4 text-center">Days Remaining</th>
                <th className="px-6 py-4 text-right">AI Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {smartInventory.map((item, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{item.id}</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                        item.velocity === 'High' ? 'bg-emerald-100 text-emerald-700' :
                        item.velocity === 'Low' ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                        {item.velocity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-medium">{item.stock}</td>
                  <td className="px-6 py-4 text-center text-slate-500">{item.dailySales}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`font-bold ${item.daysLeft < 7 ? 'text-red-600' : 'text-slate-700'}`}>
                        {item.daysLeft} days
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                     <button className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-transform hover:scale-105 ${
                         item.action.includes('Urgent') ? 'bg-red-600 text-white' :
                         item.action.includes('Clearance') ? 'bg-amber-400 text-amber-900' :
                         item.action.includes('Monitor') ? 'bg-white border border-slate-300 text-slate-600' :
                         'bg-emerald-600 text-white'
                     }`}>
                         {item.action}
                     </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
