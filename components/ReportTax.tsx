import React, { useState, useMemo } from 'react';
import {
  Filter, FileText,
  FileSpreadsheet, Printer, Columns,
  Search, Info, ArrowUpDown, CreditCard
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import MultiSelect from './MultiSelect';
import { useGlobalContext } from '../src/context/GlobalContext';

interface TaxTransaction {
  id: string;
  date: string;
  invoiceNo: string;
  partyName: string;
  taxNumber: string;
  totalAmount: number;
  paymentMethod: string;
  discount: string;
  vat: number;
  location?: string;
}

const ReportTax: React.FC = () => {
  const { locations, sales, purchases, expenses, customers, suppliers, formatCurrency } = useGlobalContext();
  const [activeTab, setActiveTab] = useState<'purchase' | 'sales' | 'expense'>('sales');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    location: [] as string[],
    contact: [] as string[],
  });

  // ---- Build real Output Tax (Sales) — only sales with VAT applied ----
  const salesTaxData: TaxTransaction[] = useMemo(() => {
    return sales
      .filter(sale => sale.tax === 'VAT@5%' || (sale.items || []).some((item: any) => (parseFloat(item.tax) || 0) > 0))
      .map(sale => {
        const vatAmount = (sale.items || []).reduce((acc: number, item: any) => acc + (parseFloat(item.tax) || 0), 0);
        const customer = customers.find(c => c.id === sale.customerId);
        const discountAmt = typeof sale.discountAmount === 'number' ? sale.discountAmount : 0;
        return {
          id: sale.id,
          date: sale.date,
          invoiceNo: sale.invoiceNo,
          partyName: sale.customerName || 'Walk-in Customer',
          taxNumber: customer?.taxNumber || '',
          totalAmount: sale.grandTotal || 0,
          paymentMethod: sale.paymentMethod || '',
          discount: discountAmt > 0 ? formatCurrency(discountAmt) : '0.000%',
          vat: parseFloat(vatAmount.toFixed(3)),
          location: sale.location,
        };
      });
  }, [sales, customers, formatCurrency]);

  // ---- Build real Input Tax (Purchases) — only purchases with VAT ----
  const purchaseTaxData: TaxTransaction[] = useMemo(() => {
    return purchases
      .filter(p => p.purchaseTax === 'VAT@5%' || p.tax === 'VAT@5%' || (p.items || []).some((item: any) => (parseFloat(item.tax) || 0) > 0))
      .map(purchase => {
        const vatAmount = (purchase.items || []).reduce((acc: number, item: any) => acc + (parseFloat(item.tax) || 0), 0);
        const supplier = suppliers.find(s => s.id === purchase.supplierId || s.businessName === purchase.supplier);
        return {
          id: purchase.id,
          date: purchase.date,
          invoiceNo: purchase.refNo || purchase.id,
          partyName: purchase.supplier || purchase.supplierName || 'Unknown Supplier',
          taxNumber: supplier?.taxNumber || '',
          totalAmount: purchase.grandTotal || 0,
          paymentMethod: purchase.paymentMethod || '',
          discount: '0.000',
          vat: parseFloat(vatAmount.toFixed(3)),
          location: purchase.location,
        };
      });
  }, [purchases, suppliers]);

  // ---- Build real Expense Tax — only expenses with tax > 0 ----
  const expenseTaxData: TaxTransaction[] = useMemo(() => {
    return expenses
      .filter(e => (e.tax || 0) > 0)
      .map(expense => ({
        id: expense.id,
        date: expense.date,
        invoiceNo: expense.refNo || expense.id,
        partyName: expense.category,
        taxNumber: '',
        totalAmount: expense.totalAmount || expense.amount || 0,
        paymentMethod: expense.paymentMethod || '',
        discount: '0.000',
        vat: parseFloat((expense.tax || 0).toFixed(3)),
        location: expense.location,
      }));
  }, [expenses]);

  // Active dataset
  const currentData = activeTab === 'sales' ? salesTaxData
    : activeTab === 'purchase' ? purchaseTaxData
    : expenseTaxData;

  const partyHeader = activeTab === 'sales' ? 'Customer'
    : activeTab === 'purchase' ? 'Supplier'
    : 'Expense Category';

  const referenceHeader = activeTab === 'expense' ? 'Reference No' : 'Invoice No.';

  // Totals
  const totalAmount = currentData.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const totalVAT = currentData.reduce((acc, curr) => acc + curr.vat, 0);

  // Overall net tax = Output - Input - Expense
  const outputTax = salesTaxData.reduce((acc, d) => acc + d.vat, 0);
  const inputTax = purchaseTaxData.reduce((acc, d) => acc + d.vat, 0);
  const expTax = expenseTaxData.reduce((acc, d) => acc + d.vat, 0);
  const overallTax = outputTax - inputTax - expTax;

  // Contact filter options from real active data
  const contactOptions = useMemo(() => {
    return [...new Set(currentData.map(d => d.partyName))];
  }, [currentData]);

  // Filtered data
  const filteredData = currentData.filter(d =>
    (d.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filters.location.length === 0 || (d.location && filters.location.includes(d.location))) &&
    (filters.contact.length === 0 || filters.contact.includes(d.partyName))
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20">

      {/* Header & Filters */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Tax Report</h2>
          <p className="text-xs text-slate-500 mt-1">VAT details computed from your real sales, purchases, and expenses.</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-blue-600 font-bold text-sm cursor-pointer">
            <Filter size={16} /> Filters
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <MultiSelect
                label="Business Location"
                options={locations.map(loc => loc.name)}
                selected={filters.location}
                onChange={(val) => setFilters({ ...filters, location: val })}
              />
            </div>
            <div>
              <MultiSelect
                label="Contact"
                options={contactOptions}
                selected={filters.contact}
                onChange={(val) => setFilters({ ...filters, contact: val })}
              />
            </div>
            <div>
              <DateRangeFilter />
            </div>
          </div>
        </div>
      </div>

      {/* Overall Summary */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1">
          Overall Tax (Output - Input - Expense) <Info size={12} className="text-blue-500" />
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Output Tax (Sales)</p>
            <p className="text-sm font-bold text-emerald-600">{formatCurrency(outputTax)}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Input Tax (Purchases)</p>
            <p className="text-sm font-bold text-red-500">{formatCurrency(inputTax)}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Expense Tax</p>
            <p className="text-sm font-bold text-red-500">{formatCurrency(expTax)}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <p className="text-xs text-blue-700 font-bold">Net Tax Payable</p>
            <p className={`text-lg font-bold ${overallTax >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(overallTax)}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs & Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/50">
          <button
            onClick={() => setActiveTab('purchase')}
            className={`px-6 py-4 text-xs font-bold transition-all border-b-2 ${activeTab === 'purchase' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <span className="flex items-center gap-2"><CreditCard size={14} /> Input Tax (Purchases) {purchaseTaxData.length > 0 && <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full">{purchaseTaxData.length}</span>}</span>
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-6 py-4 text-xs font-bold transition-all border-b-2 ${activeTab === 'sales' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <span className="flex items-center gap-2"><CreditCard size={14} /> Output Tax (Sales) {salesTaxData.length > 0 && <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full">{salesTaxData.length}</span>}</span>
          </button>
          <button
            onClick={() => setActiveTab('expense')}
            className={`px-6 py-4 text-xs font-bold transition-all border-b-2 ${activeTab === 'expense' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <span className="flex items-center gap-2"><CreditCard size={14} /> Expense Tax {expenseTaxData.length > 0 && <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full">{expenseTaxData.length}</span>}</span>
          </button>
        </div>

        {/* Table Controls */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 font-bold">Show</span>
            <select className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none">
              <option>25</option><option>50</option>
            </select>
            <span className="text-xs text-slate-600 font-bold">entries</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileText size={10} /> Export CSV</button>
            <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><FileSpreadsheet size={10} /> Excel</button>
            <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm" onClick={() => window.print()}><Printer size={10} /> Print</button>
            <button className="px-2 py-1 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-sm"><Columns size={10} /> Columns</button>
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

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Date <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">{referenceHeader} <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">{partyHeader} <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap">Tax Number</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Total Amount <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
                <th className="px-4 py-3 whitespace-nowrap text-center">Payment Method</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Discount</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">VAT <ArrowUpDown size={10} className="inline ml-1 text-slate-400" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.length > 0 ? (
                filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{item.date}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap font-mono text-[10px]">{item.invoiceNo}</td>
                    <td className="px-4 py-3 text-slate-700 font-bold whitespace-nowrap">{item.partyName}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap font-mono text-[10px]">{item.taxNumber || '--'}</td>
                    <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">{formatCurrency(item.totalAmount)}</td>
                    <td className="px-4 py-3 text-center text-slate-600 whitespace-nowrap">{item.paymentMethod || '--'}</td>
                    <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{item.discount}</td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-bold whitespace-nowrap">{formatCurrency(item.vat)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400 italic">
                    {currentData.length === 0
                      ? `No ${activeTab === 'sales' ? 'sales' : activeTab === 'purchase' ? 'purchases' : 'expenses'} with VAT recorded yet.`
                      : 'No records match your filters.'
                    }
                  </td>
                </tr>
              )}
            </tbody>
            {filteredData.length > 0 && (
              <tfoot className="bg-slate-200 font-bold text-slate-800 text-xs border-t border-slate-300">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right uppercase">Total:</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(totalAmount)}</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right text-emerald-800">{formatCurrency(totalVAT)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <div>Showing {filteredData.length} of {currentData.length} records</div>
          <div className="flex gap-1">
            <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled>Previous</button>
            <button className="px-3 py-1 bg-blue-600 text-white border border-blue-600 rounded shadow-sm">1</button>
            <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50" disabled>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportTax;
