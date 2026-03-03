import React, { useState } from 'react';
import { Calendar, ChevronDown, Save, ArrowLeft } from 'lucide-react';

interface AddSellReturnProps {
    onNavigate: (page: string) => void;
}

const AddSellReturn: React.FC<AddSellReturnProps> = ({ onNavigate }) => {
    // Mock Data based on screenshot
    const [rows, setRows] = useState([
        { id: 1, name: 'X Pets Puppy (Lamb) Pate 400g', sku: '0164', unitPrice: 0.450, sellQty: 36.000, returnQty: 0.000, unit: 'Pc(s)' },
        { id: 2, name: 'X Pets Dog (Veal) Chunks 400g', sku: '0161', unitPrice: 0.450, sellQty: 36.000, returnQty: 0.000, unit: 'Pc(s)' },
    ]);

    const handleReturnQtyChange = (id: number, val: string) => {
        const qty = parseFloat(val);
        setRows(rows.map(r => r.id === id ? { ...r, returnQty: isNaN(qty) ? 0 : qty } : r));
    };

    const totalReturnAmount = rows.reduce((acc, r) => acc + (r.returnQty * r.unitPrice), 0);

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header Title */}
            <div className="flex items-center gap-4 mb-2">
                <button onClick={() => onNavigate('sales')} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                    <ArrowLeft size={24} />
                </button>
                <h2 className="text-2xl font-bold text-slate-900">Sell Return</h2>
            </div>
            
            {/* Blue Top Bar mimicking the screenshot */}
            <div className="h-1.5 w-full bg-blue-800 rounded-t-sm"></div>

            <div className="bg-white rounded-b-sm shadow-sm border border-slate-200 p-6 -mt-2">
                
                {/* Parent Sale Section */}
                <div className="bg-slate-50 border border-slate-200 rounded p-4 mb-6">
                    <h3 className="text-slate-800 text-sm font-bold border-b border-slate-200 pb-2 mb-3">Parent Sale</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs text-slate-700">
                        <div>
                            <span className="font-bold block text-slate-500 mb-1">Invoice No.:</span> 
                            K2026-2505
                        </div>
                        <div>
                            <span className="font-bold block text-slate-500 mb-1">Customer:</span> 
                            Direct Customer
                        </div>
                        <div>
                            <span className="font-bold block text-slate-500 mb-1">Date:</span> 
                            14/02/2026
                        </div>
                        <div>
                            <span className="font-bold block text-slate-500 mb-1">Business Location:</span> 
                            KNWZ ARD ALKHALYJ ALMTHDH CR:1282649
                        </div>
                    </div>
                </div>

                {/* Form Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                     <div className="group">
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Invoice No.:</label>
                        <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div className="group">
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Date:*</label>
                        <div className="relative">
                            <input type="text" defaultValue="14/02/2026 08:55 PM" className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                            <Calendar size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-sm mb-6">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-[#2ecc71] text-white font-bold">
                            <tr>
                                <th className="px-4 py-3 w-10 border-r border-green-600">#</th>
                                <th className="px-4 py-3 border-r border-green-600">Product Name</th>
                                <th className="px-4 py-3 w-32 border-r border-green-600">Unit Price</th>
                                <th className="px-4 py-3 w-32 border-r border-green-600">Sell Quantity</th>
                                <th className="px-4 py-3 w-40 border-r border-green-600">Return Quantity</th>
                                <th className="px-4 py-3 w-40 text-right">Return Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {rows.map((row, idx) => (
                                <tr key={row.id} className="bg-white hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 border-r border-slate-100">{idx + 1}</td>
                                    <td className="px-4 py-3 border-r border-slate-100 font-medium text-slate-700">
                                        {row.name}
                                        <div className="text-[10px] text-slate-400 mt-1">{row.sku}</div>
                                    </td>
                                    <td className="px-4 py-3 border-r border-slate-100"> ريال {row.unitPrice.toFixed(3)}</td>
                                    <td className="px-4 py-3 border-r border-slate-100">{row.sellQty.toFixed(3)} {row.unit}</td>
                                    <td className="px-4 py-3 border-r border-slate-100">
                                        <input 
                                            type="number" 
                                            className="w-full px-2 py-1.5 border border-slate-300 rounded-sm text-xs focus:border-blue-500 outline-none transition-all"
                                            value={row.returnQty}
                                            onChange={(e) => handleReturnQtyChange(row.id, e.target.value)}
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-slate-800 bg-slate-50"> ريال {(row.returnQty * row.unitPrice).toFixed(3)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer Section */}
                <div className="flex flex-col md:flex-row gap-8 border-t border-slate-200 pt-6">
                    {/* Left: Inputs */}
                    <div className="flex-1 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="group">
                                 <label className="block text-xs font-bold text-slate-700 mb-1.5">Discount Type:</label>
                                 <div className="relative">
                                     <select className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm bg-white appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500">
                                         <option>Percentage</option>
                                         <option>Fixed</option>
                                     </select>
                                     <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                                 </div>
                            </div>
                            <div className="group">
                                 <label className="block text-xs font-bold text-slate-700 mb-1.5">Discount Amount:</label>
                                 <input type="text" defaultValue="0.000" className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                            </div>
                        </div>
                         <div className="group">
                             <label className="block text-xs font-bold text-slate-700 mb-1.5">Return Note:</label>
                             <textarea rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-sm text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"></textarea>
                        </div>
                    </div>

                    {/* Right: Totals */}
                    <div className="w-full md:w-80 flex flex-col justify-end">
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-3">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-slate-600">Total Return Discount:</span>
                                <span className="font-bold text-slate-800">(-) ريال 0.000</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-slate-600">Total Return Tax:</span>
                                <span className="font-bold text-slate-800">(+) ريال 0.000</span>
                            </div>
                            <div className="border-t border-slate-300 my-2"></div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-black text-slate-800">Return Total:</span>
                                <span className="font-black text-slate-900">ريال {totalReturnAmount.toFixed(3)}</span>
                            </div>
                        </div>
                        
                        <div className="mt-6 flex justify-end">
                            <button className="bg-[#6200ea] text-white px-8 py-2.5 rounded-sm shadow-md font-bold hover:bg-[#5000ca] transition-colors text-sm flex items-center gap-2">
                                <Save size={16} /> Save
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AddSellReturn;