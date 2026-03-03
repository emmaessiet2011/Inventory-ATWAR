import React, { useState } from 'react';
import { Download, Upload, CheckCircle2, FileText, Info, AlertCircle } from 'lucide-react';

const ImportOpeningStock: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const columns = [
    { num: 1, name: 'SKU', required: true, instruction: 'Product SKU' },
    { num: 2, name: 'Location', required: true, instruction: 'Name of the business location' },
    { num: 3, name: 'Quantity', required: true, instruction: 'Opening stock quantity' },
    { num: 4, name: 'Unit Cost (Before Tax)', required: true, instruction: 'Unit cost of the product before tax' },
    { num: 5, name: 'Lot Number', required: false, instruction: 'Lot number of the stock' },
    { num: 6, name: 'Expiry Date', required: false, instruction: 'Stock Expiry Date\nFormat: mm-dd-yyyy' },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-20 max-w-[1600px] mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Import Opening Stock</h2>
        <p className="text-slate-500 mt-2">Update opening stock for existing products via CSV file.</p>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
        
        {/* File Upload Section */}
        <div className="flex flex-col md:flex-row gap-6 mb-8 items-start border-b border-slate-100 pb-8">
             <div className="w-full md:w-1/2 space-y-3">
                 <label className="text-sm font-bold text-slate-900 uppercase tracking-wide">File To Import:</label>
                 <div className="flex items-center gap-3">
                    <label className="cursor-pointer">
                        <span className="px-6 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-sm flex items-center gap-2">
                            <Upload size={16} /> Choose File
                        </span>
                        <input type="file" className="hidden" onChange={handleFileChange} accept=".csv,.xlsx,.xls" />
                    </label>
                    <span className="text-sm text-slate-500 italic">
                        {selectedFile ? selectedFile.name : 'No file chosen'}
                    </span>
                 </div>
                 {selectedFile && (
                    <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold mt-2">
                        <CheckCircle2 size={14} /> Ready to upload
                    </div>
                 )}
             </div>
             
             <div className="w-full md:w-1/2 flex justify-end items-center h-full gap-4 mt-auto pt-6">
                 <button className="px-8 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-700 transition-all active:scale-95">
                      Submit Import
                  </button>
             </div>
        </div>
        
        <div className="mb-10 flex gap-4">
            <button className="px-6 py-3 bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/20 hover:bg-emerald-600 transition-all flex items-center gap-2 active:scale-95">
                <Download size={16} /> Download template file
            </button>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 mb-10 flex gap-4 items-start">
            <Info className="text-blue-500 shrink-0" size={24} />
            <div className="text-sm text-blue-800 leading-relaxed">
                <p className="font-bold mb-1">Important Notes:</p>
                <ul className="list-disc list-inside space-y-1">
                    <li>Opening stock can only be imported for products that have stock management enabled.</li>
                    <li>If the product already has opening stock, this import will add to the existing quantity.</li>
                    <li>Make sure the SKU and Location names match exactly with the system records.</li>
                </ul>
            </div>
        </div>

        {/* Instructions Table */}
        <div className="border rounded-xl overflow-hidden border-slate-200">
             <div className="bg-slate-50/50 px-6 py-5 border-b border-slate-200">
                 <h3 className="text-lg font-bold text-slate-800">Instructions</h3>
                 <p className="text-sm text-slate-500 mt-1">The columns of the file should be in the following order.</p>
             </div>
             
             <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                     <thead className="bg-white text-xs uppercase text-slate-500 font-extrabold border-b border-slate-200">
                         <tr>
                             <th className="px-6 py-4 w-32">Col #</th>
                             <th className="px-6 py-4 w-64">Column Name</th>
                             <th className="px-6 py-4">Instruction</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 text-sm">
                         {columns.map((col) => (
                             <tr key={col.num} className="hover:bg-slate-50/50 transition-colors">
                                 <td className="px-6 py-4 text-slate-400 font-mono font-medium">{col.num}</td>
                                 <td className="px-6 py-4 font-bold text-slate-700">
                                     {col.name} 
                                     {col.required === true && <span className="text-[10px] text-red-500 font-bold ml-1 italic">(Required)</span>}
                                     {col.required === false && <span className="text-[10px] text-slate-400 font-normal ml-1 italic">(Optional)</span>}
                                 </td>
                                 <td className="px-6 py-4 text-slate-600 whitespace-pre-wrap leading-relaxed text-xs font-medium">
                                     {col.instruction}
                                 </td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
             </div>
        </div>

      </div>
    </div>
  );
};

export default ImportOpeningStock;
